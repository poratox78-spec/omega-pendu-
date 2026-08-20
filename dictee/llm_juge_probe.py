# -*- coding: utf-8 -*-
u"""SONDE COMPARATIVE « corps mou » (2026-08-21, idée de Rem : squelette↔mou en boucle).
Deux juges de perplexité, mesurés sur les MÊMES bancs EXTERNES (jamais la boucle sur elle-même) :
  · voie A : transformer FR pré-entraîné (asi/gpt-fr-cased-small, 124 M) — le mou « acheté » ;
  · voie B : LM caractères MAISON (n-grammes interpolés, ~Mo) entraîné sur UD train — le mou
    minuscule, première marche de la boucle de Rem (le généré dys_gen viendra en discriminatif).
Bancs (préférer la BONNE phrase d'une paire) :
  REEL    : paires phrase-niveau des 6 dictées ASEI (vraies fautes dys) — data_local ;
  GEN     : 120 paires du générateur calibré (genere_gold.jsonl) — data_local ;
  PIEGE   : phrases CORRECTES piégeuses (« elle sait marier les saveurs ») vs variante s'est —
            le juge doit préférer l'ÉCRIT (un juge qui « corrige » ça est un danger, pas un juge) ;
  FATIGUE : phrases correctes de fp_scale contenant un homophone cible, variante permutée —
            préférer l'écrit (taux d'erreur = fatigue du futur orange).
  python dictee/llm_juge_probe.py b        # voie B seule (rapide, zéro dépendance)
  python dictee/llm_juge_probe.py a        # voie A (torch+transformers, télécharge le modèle)
Corpus privés sous data_local → sonde LOCALE (sortie douce si absents)."""
import os, sys, io, json, math, re, unicodedata
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DL = os.path.join(ROOT, 'data_local')

def lignes(p):
    return io.open(p, encoding='utf-8').read().split('\n')

# ── BANCS ────────────────────────────────────────────────────────────────────
def phrases_de(texte):
    return [s.strip() for s in re.split(u'(?<=[.!?])\\s+', texte) if s.strip()]

def bancs():
    B = {'REEL': [], 'GEN': [], 'PIEGE': [], 'FATIGUE': []}
    gp = os.path.join(DL, 'dys_reel', 'dictees_gold.jsonl')
    if os.path.exists(gp):
        for l in lignes(gp):
            if not l.strip(): continue
            d = json.loads(l)
            pr, pf = phrases_de(d['raw']), phrases_de(d['fixed'])
            if len(pr) == len(pf):
                for a, b in zip(pr, pf):
                    if a != b: B['REEL'].append((b, a))          # (bonne, mauvaise)
    gg = os.path.join(DL, 'dys_reel', 'genere_gold.jsonl')
    if os.path.exists(gg):
        for l in lignes(gg):
            if not l.strip(): continue
            d = json.loads(l)
            if d.get('raw') and d.get('fixed') and d['raw'] != d['fixed']:
                B['GEN'].append((d['fixed'], d['raw']))
    B['PIEGE'] = [
        (u"Elle sait marier les saveurs avec talent.", u"Elle s'est marier les saveurs avec talent."),
        (u"Il sait nager depuis longtemps.", u"Il s'est nager depuis longtemps."),
        (u"On ne sait jamais ce qui peut arriver.", u"On ne s'est jamais ce qui peut arriver."),
        (u"Elle sait cuisiner comme personne.", u"Elle s'est cuisiner comme personne."),
        (u"Il sait parler aux enfants.", u"Il s'est parler aux enfants."),
        (u"Ces enfants jouent dans la cour.", u"Ses enfants jouent dans la cour."),
        (u"Il range ses affaires chaque soir.", u"Il range ces affaires chaque soir."),
        (u"Tout est bien fait dans cette maison.", u"Tout est bienfait dans cette maison."),
        (u"Ils ont très mal fait le travail.", u"Ils ont très malfait le travail."),
        (u"Une fois emprisonné, Michael prépare son évasion.", u"Une fois emprisonnée, Michael prépare son évasion."),
        (u"Le sommet sur la biodiversité organisé en octobre a réuni cent pays.", u"Le sommet sur la biodiversité organisée en octobre a réuni cent pays."),
        (u"Il a le même âge que moi.", u"Il a le même age que moi."),
    ]
    fp = os.path.join(HERE, 'fp_scale_corpus.txt')
    SW = {u'sait': u"s'est", u"s'est": u'sait', u'ces': u'ses', u'ses': u'ces', u'ont': u'on', u'on': u'ont'}
    for s in lignes(fp):
        s = s.strip()
        if not s or len(B['FATIGUE']) >= 250: continue
        T = s.split(' ')
        for k, w in enumerate(T):
            lw = w.lower()
            if lw in SW:
                V = T[:]; V[k] = SW[lw] if w == lw else SW[lw].capitalize()
                B['FATIGUE'].append((s, ' '.join(V)))
                break
    return B

# ── VOIE B : LM caractères n-grammes interpolés (2/4/6), MAISON ──────────────
class CharLM(object):
    ORDERS = (2, 4, 6)
    def __init__(self):
        self.c = {n: defaultdict(int) for n in self.ORDERS}
        self.ctx = {n: defaultdict(int) for n in self.ORDERS}
        self.v = set()
    def _prep(self, s):
        return u'\x02' + re.sub(u'\\s+', u' ', s.strip().lower()) + u'\x03'
    def train(self, textes):
        for s in textes:
            t = self._prep(s)
            for ch in t: self.v.add(ch)
            for n in self.ORDERS:
                for i in range(len(t) - n + 1):
                    g = t[i:i + n]
                    self.c[n][g] += 1
                    self.ctx[n][g[:-1]] += 1
        # élagage des singletons d'ordre 6 (mémoire) — les contextes restent
        self.c[6] = defaultdict(int, {g: k for g, k in self.c[6].items() if k >= 2})
    def logp(self, s):
        t = self._prep(s); V = max(64, len(self.v)); tot = 0.0
        LAMB = {2: 0.2, 4: 0.3, 6: 0.5}
        for i in range(1, len(t)):
            p = 0.0
            for n in self.ORDERS:
                if i - n + 1 < 0: continue
                g = t[i - n + 1:i + 1]
                num = self.c[n].get(g, 0) + 0.1
                den = self.ctx[n].get(g[:-1], 0) + 0.1 * V
                p += LAMB[n] * (num / den)
            tot += math.log(max(p, 1e-12))
        return tot / max(1, len(t) - 1)                        # log-prob moyen par caractère

def voie_b(B):
    ud = os.path.join(DL, 'ud_fr_gsd-train.conllu')
    if not os.path.exists(ud):
        print(u'(UD absent de data_local — voie B impossible ici)'); return None
    textes = [l[9:] for l in lignes(ud) if l.startswith('# text = ')]
    lm = CharLM(); lm.train(textes)
    n6 = len(lm.c[6])
    print(u'voie B : LM caractères entraîné sur %d phrases UD (%d hexagrammes retenus)' % (len(textes), n6))
    return lambda s: lm.logp(s)

# ── VOIE A : transformer FR pré-entraîné ─────────────────────────────────────
def voie_a():
    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM
    nom = 'asi/gpt-fr-cased-small'
    tok = AutoTokenizer.from_pretrained(nom)
    mdl = AutoModelForCausalLM.from_pretrained(nom)
    mdl.eval()
    def score(s):
        with torch.no_grad():
            ids = tok(s, return_tensors='pt').input_ids
            if ids.shape[1] < 2: return -99.0
            out = mdl(ids, labels=ids)
            return -out.loss.item()                            # log-prob moyen par token
    return score

# ── ÉVALUATION ───────────────────────────────────────────────────────────────
def evalue(nom, score, B):
    print(u'\n══ %s ══' % nom)
    for banc in ('REEL', 'GEN', 'PIEGE', 'FATIGUE'):
        paires = B[banc]
        if not paires: print(u'  %-8s (vide)' % banc); continue
        ok = 0; rates = []
        for bonne, mauvaise in paires:
            if score(bonne) > score(mauvaise): ok += 1
            elif len(rates) < 4: rates.append((bonne, mauvaise))
        print(u'  %-8s %3d/%3d préférences justes (%.0f %%)' % (banc, ok, len(paires), 100.0 * ok / len(paires)))
        for b_, m_ in rates:
            print(u'      ✗ préfère « %s » à « %s »' % (m_[:70], b_[:70]))

if __name__ == '__main__':
    quoi = sys.argv[1] if len(sys.argv) > 1 else 'b'
    B = bancs()
    print(u'bancs : REEL=%d GEN=%d PIEGE=%d FATIGUE=%d' % (len(B['REEL']), len(B['GEN']), len(B['PIEGE']), len(B['FATIGUE'])))
    if quoi in ('b', 'ab'):
        fb = voie_b(B)
        if fb: evalue(u'VOIE B — LM caractères maison (~Mo)', fb, B)
    if quoi in ('a', 'ab'):
        fa = voie_a()
        evalue(u'VOIE A — gpt-fr-cased-small (124 M, pré-entraîné)', fa, B)
