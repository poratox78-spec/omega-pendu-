# -*- coding: utf-8 -*-
# SPELLER ANGLAIS — référence (comme dictee/speller_probe.py côté FR). Noisy-channel : lexique
# lex_en.tsv.gz (mot·freq·POS) + index phonétique LOSSY + edits1 ; ranking tier × fréquence × phon ;
# seuil AUTO (rouge, corrige) vs FLAG (orange, « à vérifier ») vs OK.
#
# Doctrine (mesurée côté FR, [[phonetic-recall-channel]]) : une clé phonétique LOSSY DES DEUX CÔTÉS bat
# l'IPA fidèle pour rapprocher typo↔correct (le dys laisse tomber les finales muettes) → on N'utilise PAS
# l'IPA de lex_en ici (gardée pour dictée/pendu), mais une clé lossy à l'anglaise (Metaphone-lite).
# FP=0 = ne JAMAIS auto-corriger (rouge) un mot correct ; le doute → ORANGE (jamais le silence).
#   Lancer : PYTHONUTF8=1 python dictee/speller_en_probe.py            (CASES + FP scale EWT)
import gzip, os, re, sys, unicodedata, collections
sys.stdout.reconfigure(encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
LEX = os.path.join(HERE, 'lex_en.tsv.gz')
ALPHA = 'abcdefghijklmnopqrstuvwxyz'

def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

# ---------- clé phonétique anglaise LOSSY (Metaphone-lite) ----------
def phon_key(s):
    """Deux mots qui SONNENT proche → même clé (lossy). recieve≈receive, definately≈definitely,
    peapl≈people. Approx (collisions attendues) → usage FLAG, classé par fréquence."""
    s = deacc(s.lower())
    s = re.sub(r'[^a-z]', '', s)
    if not s: return ''
    # débuts muets
    s = re.sub(r'^(kn|gn|pn)', lambda m: m.group(0)[1], s)   # knight→night, gnome→nome
    s = re.sub(r'^wr', 'r', s)                                # write→rite
    s = re.sub(r'^wh', 'w', s)                                # what→wat
    s = re.sub(r'^x', 'z', s)                                 # xylophone→zylophone
    # digraphes / clusters
    s = s.replace('ough', 'o').replace('augh', 'a')          # through/though/taught (lossy)
    s = s.replace('ph', 'f').replace('gh', '')               # laugh/night (lossy : gh muet)
    s = s.replace('sch', 'sk').replace('tch', 'ch').replace('ck', 'k')
    s = s.replace('dge', 'j').replace('dg', 'j')
    s = s.replace('sh', 'S').replace('ch', 'C').replace('th', 'T')   # classes de sons distinctes
    s = s.replace('qu', 'kw').replace('q', 'k').replace('x', 'ks')
    s = s.replace('wr', 'r').replace('mb', 'm')              # comb→com
    # teams de voyelles → voyelle simple (l'anglais épelle un son de 10 façons)
    s = s.replace('eigh', 'a').replace('igh', 'i')
    s = re.sub(r'(ee|ea|ie|ei|ey)', 'i', s)
    s = re.sub(r'(oo|ou|ew|ue|ui)', 'u', s)
    s = re.sub(r'(oa|ow|oe)', 'o', s)
    s = re.sub(r'(ai|ay|ei)', 'a', s)
    s = re.sub(r'(au|aw|augh)', 'o', s)
    out = []
    for j, ch in enumerate(s):
        nx = s[j+1] if j+1 < len(s) else ''
        if ch == 'c':   out.append('s' if nx in 'eiy' else 'k')
        elif ch == 'g': out.append('j' if nx in 'eiy' else 'g')
        elif ch == 'z': out.append('s')
        elif ch == 'y': out.append('i')
        elif ch == 'h': pass                                  # h faible
        else: out.append(ch)
    s = ''.join(out)
    s = re.sub(r'e$', '', s)                                  # e final muet (make→mak)
    s = re.sub(r'[aeiou]', 'a', s)                            # voyelles → 1 classe (le dys confond les voyelles)
    o2 = []                                                   # collapse doublons consécutifs
    for ch in s:
        if not o2 or o2[-1] != ch: o2.append(ch)
    return ''.join(o2)

def edits1(d):
    sp = [(d[:i], d[i:]) for i in range(len(d) + 1)]
    res = set()
    for a, b in sp:
        if b: res.add(a + b[1:])                              # delete
        if len(b) > 1: res.add(a + b[1] + b[0] + b[2:])       # transpose
        for c in ALPHA:
            res.add(a + c + b)                                # insert
            if b: res.add(a + c + b[1:])                      # replace
    return res

# ---------- lexique ----------
def load_lexicon():
    KNOWN = set(); FREQ = {}; POS = {}; PHON = collections.defaultdict(list)
    with gzip.open(LEX, 'rt', encoding='utf-8') as f:
        f.readline()
        for line in f:
            c = line.rstrip('\n').split('\t')
            if len(c) < 7: continue
            w = c[0]
            if not w: continue
            KNOWN.add(w)
            try: fr = int(c[6])
            except ValueError: fr = 0
            FREQ[w] = fr
            if c[1]: POS[w] = c[1]
    # index phonétique : mots a-z seulement (candidats), classés par fréquence décroissante
    az = [w for w in KNOWN if all(ch in ALPHA for ch in w)]
    for w in sorted(az, key=lambda w: -FREQ.get(w, 0)):
        PHON[phon_key(w)].append(w)
    return KNOWN, FREQ, POS, PHON

class SpellerEN:
    def __init__(self):
        self.KNOWN, self.FREQ, self.POS, self.PHON = load_lexicon()

    def is_known(self, w):
        lw = w.lower()
        return lw in self.KNOWN

    def _cands(self, low):
        """dict cand -> tier : 1 = edit-1 (∩KNOWN), 0 = voisin phonétique (FLAG)."""
        c = {}
        for e in edits1(low):
            if e in self.KNOWN and all(ch in ALPHA for ch in e):
                c[e] = max(c.get(e, 0), 1)
        pk = phon_key(low)
        for w in self.PHON.get(pk, [])[:12]:                 # voisins phonétiques limités, déjà classés freq
            if w != low and all(ch in ALPHA for ch in w):    # ASCII-seul : ne JAMAIS suggérer un accent (l'anglais n'en a pas ;
                c[w] = max(c.get(w, 0), 0)                    #   les emprunts café/résumé restent KNOWN mais ne sont pas PROPOSÉS)
        return c, pk

    def suggest(self, w):
        """-> (suggestion|None, mode) ; mode ∈ {'OK','AUTO','FLAG','NONE'}."""
        low = deacc(w.lower())
        if not low or len(low) < 2 or any(ch not in ALPHA for ch in low):
            return None, 'OK'                                # lettre seule (a, I) / non a-z : hors périmètre speller
        if low in self.KNOWN:
            return None, 'OK'
        if w[:1].isupper():
            return None, 'OK'                                # capitalisé = nom propre probable → pas de speller (anti-flood ; les homophones gèrent leur casse)
        cands, pk = self._cands(low)
        if not cands:
            return None, 'OK'                                # inconnu sans candidat proche → ne pas harceler (rare/technique/étranger)
        def rank(x):                                         # edit-1 d'abord, puis FRÉQUENCE (the ≫ te)
            return (cands[x], self.FREQ.get(x, 0))
        best = max(cands, key=rank)
        bt = cands[best]; bf = self.FREQ.get(best, 0)
        others = [x for x in cands if x != best]
        second = max((self.FREQ.get(x, 0) for x in others), default=0)
        # AUTO (rouge) FP=0 : edit-1, correction fréquente ET dominante, ET la preuve que l'original
        # EST une faute — soit il SONNE comme la correction (phon_key = typo phonétique : recieve→
        # receive), soit c'est une TRANSPOSITION pure (teh→the). Sinon → ORANGE (doute→orange).
        phon_match = phon_key(best) == pk
        transp = (len(best) == len(low) and sorted(best) == sorted(low))
        # ... et AUCUN rival à ÉGALITÉ. La fréquence seule ne suffit pas à faire un rouge : si un autre
        # candidat est à la MÊME distance d'édition ET sonne pareil, le choix est un pari, pas une preuve.
        # Mesuré : c'est exactement la forme des 3 FP rouges du banc (weakend→weekend alors que
        # « weakened » est aussi à edit-1 et homophone ; intered→entered ; welcame→welcome).
        # Seuil CALIBRÉ, pas deviné (balayage -1/2000/500/100/20/0 sur le banc Wikipédia) : le genou est
        # à 20 — AUTO_WRONG 2->1 pour 33 rouges de moins, alors que descendre à 0 en coûte 70 de plus
        # SANS rien gagner. Au-delà de 20, les FP reviennent.
        rival = any(cands[x] == 1 and (phon_key(x) == pk or self.FREQ.get(x, 0) >= 20) for x in others)
        if (bt == 1 and len(low) >= 3 and bf >= 200
                and bf >= 20 * max(second, 1) and (phon_match or transp) and not rival):
            return best, 'AUTO'
        return best, 'FLAG'                                  # sinon : orange (candidat proposé, à vérifier)

    def correct(self, text):
        out = []
        for tok in re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)*|[^A-Za-z]+", text):
            if tok[:1].isalpha():
                s, mode = self.suggest(tok)
                if mode == 'AUTO' and s:
                    out.append(_keepcase(tok, s))
                else:
                    out.append(tok)
            else:
                out.append(tok)
        return ''.join(out)

def _keepcase(src, sugg):
    if src.isupper(): return sugg.upper()
    if src[:1].isupper(): return sugg[:1].upper() + sugg[1:]
    return sugg

# ---------- jeu de test : vraies fautes dys anglaises (non-mot → correction) ----------
CASES = [
    ("recieve","receive"),("seperate","separate"),("definately","definitely"),("occured","occurred"),
    ("untill","until"),("wich","which"),("becuase","because"),("freind","friend"),("beleive","believe"),
    ("wierd","weird"),("tommorow","tomorrow"),("thier","their"),("teh","the"),("adress","address"),
    ("arguement","argument"),("calender","calendar"),("cemetary","cemetery"),("collegue","colleague"),
    ("concious","conscious"),("dilema","dilemma"),("embarass","embarrass"),("enviroment","environment"),
    ("foriegn","foreign"),("goverment","government"),("gaurd","guard"),("harrass","harass"),
    ("independant","independent"),("knowlege","knowledge"),("libary","library"),("neccessary","necessary"),
    ("occassion","occasion"),("persistant","persistent"),("prefered","preferred"),("reccomend","recommend"),
    ("refered","referred"),("relevent","relevant"),("religous","religious"),("succesful","successful"),
    ("truely","truly"),("vaccuum","vacuum"),("wellcome","welcome"),("finaly","finally"),
    ("realy","really"),("basicly","basically"),("diffrent","different"),("intrest","interest"),
    ("bussiness","business"),("suprise","surprise"),("wanna","wanna"),   # wanna = mot réel (contrôle : ne DOIT pas être « corrigé »)
    ("alright","alright"),                                                # mot réel (contrôle)
    ("peopl","people"),("becuse","because"),("wold","would"),("realy","really"),
    ("littel","little"),("goign","going"),("dosnt","doesnt"),("didnt","didnt"),
]

def main():
    sp = SpellerEN()
    print('=== SPELLER EN — %d mots connus, %d clés phon ===' % (len(sp.KNOWN), len(sp.PHON)))
    hit = auto = flag = miss = ctrl_ok = ctrl_bad = 0
    ctrl = {'wanna','alright','didnt'}   # mots réels/tolérés (ne doivent pas être corrigés en rouge)
    for bad, good in CASES:
        s, mode = sp.suggest(bad)
        if bad in ctrl or bad == good:
            if mode == 'AUTO': ctrl_bad += 1; print('  FP-CTRL  %-14s AUTO→%s (ne devrait pas)' % (bad, s))
            else: ctrl_ok += 1
            continue
        ok = (s == good)
        if ok and mode == 'AUTO': auto += 1; hit += 1
        elif ok and mode == 'FLAG': flag += 1; hit += 1
        else:
            miss += 1; print('  MISS  %-14s → %-14s (attendu %s, %s)' % (bad, str(s), good, mode))
    tot = len([1 for b, g in CASES if b not in ctrl and b != g])
    print('\nrecall %d/%d (auto rouge %d + flag orange %d) · contrôles OK %d, FP contrôle %d'
          % (hit, tot, auto, flag, ctrl_ok, ctrl_bad))
    fp_scale(sp)
    if '--check' in sys.argv:                                # garde CI : recall + contrôles (FP=0 sur casse)
        ok = (hit >= 40 and ctrl_bad == 0)
        print('[check] %s — recall %d (min 40), FP contrôle %d (max 0)' % ('OK' if ok else 'ÉCHEC', hit, ctrl_bad))
        if not ok: sys.exit(1)

def fp_scale(sp):
    """FP=0 à l'échelle : sur du texte anglais CORRECT (UD English-EWT), aucun mot ne doit être
    AUTO-corrigé (rouge). On compte aussi les FLAG (orange) sur mots corrects (tolérés mais suivis)."""
    path = os.path.join(HERE, '..', 'data_local', 'en_ewt-ud-train.conllu')
    if not os.path.exists(path):
        print('[fp] EWT introuvable — skip'); return
    seen = auto_fp = flag_ct = toks = 0
    ex = []
    for l in open(path, encoding='utf-8'):
        if not l.startswith('# text = '): continue
        seen += 1
        for tok in re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)*", l.split('=', 1)[1]):
            toks += 1
            s, mode = sp.suggest(tok)
            if mode == 'AUTO':
                auto_fp += 1
                if len(ex) < 15: ex.append('%s→%s' % (tok, s))
            elif mode == 'FLAG':
                flag_ct += 1
    print('\n=== FP SCALE (EWT %d phrases, %d tokens a-z) ===' % (seen, toks))
    print('  AUTO (rouge) sur texte correct : %d (%.3f%%)  ← doit tendre vers 0' % (auto_fp, 100*auto_fp/max(toks,1)))
    print('  FLAG (orange) : %d (%.2f%%)  ← toléré (inconnus : noms propres, rares)' % (flag_ct, 100*flag_ct/max(toks,1)))
    if ex: print('  ex AUTO-FP :', ', '.join(ex))

if __name__ == '__main__':
    main()
