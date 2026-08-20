# -*- coding: utf-8 -*-
u"""GREFFE juge-aval sait/s'est+INFINITIF — la 1re greffe du corps mou sur le squelette (mesure).
Le mur assumé du squelette (saisVig) : « [il/elle/on] sait + INFINITIF » — « elle sait marier les
saveurs » est légitime, « elle sais marier a l'age de vingt ans » (ASEI texte4 RÉEL) veut dire
« elle s'est mariée ». Trancher exige la sémantique → le juge b2 (14 M maison) compare les DEUX
candidates que le squelette fabrique (écrit vs sait→s'est + inf→participe accordé) et départage.
Pire : aujourd'hui le squelette corrige sais→sait dans ce cadre (il RENFORCE la mauvaise lecture).
Bancs (juges externes, le juge ne se juge jamais sur lui-même) :
  · CORRECT : phrases UD+fp_scale au cadre sait+inf — préférer le candidat = FP.
  · FAUTÉ   : phrases UD+fp_scale au cadre s'est+participe, RÉÉCRITES en sait+inf (l'inverse
              exact de la faute dys) — préférer le candidat = rappel.
  · RÉEL    : le cas ASEI texte4 verbatim.
Sortie : FP/rappel par seuil de marge τ. Verdict chiffré AVANT tout branchement.
  python dictee/greffe_sais_probe.py [modele.pt]      (défaut b2_model_14m.pt)"""
import os, sys, io, re, json

import torch
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from b2_train import CharT

UD = os.path.join(ROOT, 'data_local', 'ud_fr_gsd-train.conllu')
FP_SCALE = os.path.join(HERE, 'fp_scale_corpus.txt')
TAUS = (0.0, 0.01, 0.02, 0.04, 0.08)

_cj = json.load(open(os.path.join(HERE, 'cgram_conj.json'), encoding='utf-8'))
CONJ_C = _cj.get('c', {})
DEACC = dict(zip(u'àâäéèêëîïôöùûüç', u'aaaeeeeiioouuuc'))
def deacc(s): return ''.join(DEACC.get(c, c) for c in s)
def est_inf(w):
    d = deacc(w.lower())
    return w.lower() in CONJ_C or d in CONJ_C

GAP = u"(?:(?:pas|plus|jamais|bien|mal|déjà|encore|toujours|souvent|très|vite|tout|si|aussi) )*"
SUBJ = u"([Ii]l|[Ee]lle|[Oo]n|[Qq]ui|[A-ZÀ-Ý][a-zà-ÿ]{2,})"   # pronom, relatif, nom propre — partout où « s'est » est plausible (3sg)
RX_SAIT = re.compile(u"\\b" + SUBJ + u" ((?:ne |n')?)(sais|sait) (" + GAP + u")([a-zà-ÿ]{3,}er)\\b")
RX_SEST = re.compile(u"\\b" + SUBJ + u" ((?:ne |n')?)s'est (" + GAP + u")([a-zà-ÿ]{2,}é)(e?)\\b")

def cas_sait(s):
    u"""Cadre écrit « sait + inf » → (écrit, candidat s'est+participe) ou None."""
    mm = RX_SAIT.search(s)
    if not mm: return None
    inf = mm.group(5)
    if not est_inf(inf): return None
    acc = u'e' if mm.group(1).lower() == u'elle' else u''
    cand = s[:mm.start()] + mm.group(1) + u' ' + mm.group(2) + u"s'est " + mm.group(4) + inf[:-2] + u'é' + acc + s[mm.end():]
    return s, cand

def cas_sest(s):
    u"""Cadre écrit « s'est + participé » → réécriture dys « sait + inf » ; retourne (fauté, candidat=original)."""
    mm = RX_SEST.search(s)
    if not mm: return None
    part = mm.group(4)
    inf = part[:-1] + u'er'
    if not est_inf(inf): return None
    if (mm.group(5) == u'e') != (mm.group(1).lower() == u'elle'): return None   # accord atypique (on…e, il…e) → hors cadre miroir
    faute = s[:mm.start()] + mm.group(1) + u' ' + mm.group(2) + u'sait ' + mm.group(3) + inf + s[mm.end():]
    return faute, s

def main():
    fmod = sys.argv[1] if len(sys.argv) > 1 else 'b2_model_14m.pt'
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    ck = torch.load(os.path.join(ROOT, 'data_local', fmod), map_location='cpu', weights_only=False)
    chars = ck['chars']; v2i = {c: i for i, c in enumerate(chars)}
    CTX = ck['cfg']['CTX']
    m = CharT(len(chars), ck['cfg']).to(dev); m.load_state_dict(ck['model']); m.eval()

    def score(s):
        ids = [v2i.get(c, 0) for c in s][:CTX]
        if len(ids) < 3: return -99.0
        t = torch.tensor([ids], device=dev)
        with torch.no_grad():
            lg = m(t)[0, :-1]
            lp = F.log_softmax(lg.float(), -1)
            return lp.gather(1, t[0, 1:, None]).mean().item()

    ud = []
    for l in io.open(UD, encoding='utf-8'):
        if l.startswith('# text ='): ud.append(l[8:].strip())
    held = [l.strip() for l in io.open(FP_SCALE, encoding='utf-8') if l.strip()]
    for fn in ('faiblesses.jsonl', 'dictees_gold.jsonl'):                     # côtés CORRIGÉS des corpus dys = correct JAMAIS vu à l'entraînement
        p = os.path.join(ROOT, 'data_local', 'dys_reel', fn)
        if os.path.exists(p):
            for l in io.open(p, encoding='utf-8'):
                if l.strip(): held.append(json.loads(l).get('fixed', ''))
    ud = [s.replace(u'’', u"'") for s in ud]
    held = [s.replace(u'’', u"'") for s in held if s]
    print(u'corpus correct : UD %d (vu à l entraînement) · HELD-OUT %d · modèle %s' % (len(ud), len(held), fmod))

    reel = cas_sait(u"elle a grandi pendant la gerre . elle sais marier a l'age de vingt ans , elle a eu trois enfants")

    def deltas(cas):
        return [(score(cand) - score(ecrit), ecrit, cand) for (ecrit, cand) in cas]

    for nom, corpus in ((u'UD (vu)', ud), (u'HELD-OUT', held)):
        fp_cas = [c for c in (cas_sait(s) for s in corpus) if c]      # correct : préférer le candidat = FP
        rc_cas = [c for c in (cas_sest(s) for s in corpus) if c]      # corrompu sait+inf : préférer le candidat = rappel
        d_fp = deltas(fp_cas); d_rc = deltas(rc_cas)
        print(u'\n═ %s — cadres CORRECT %d · FAUTÉ %d' % (nom, len(d_fp), len(d_rc)))
        print(u'  τ      FP                        rappel')
        for tau in TAUS:
            nfp = sum(1 for (d, _, _) in d_fp if d > tau)
            nrc = sum(1 for (d, _, _) in d_rc if d > tau)
            print(u'  %.2f   %3d/%3d (%5.1f %%)         %3d/%3d (%5.1f %%)'
                  % (tau, nfp, len(d_fp), 100.0 * nfp / max(len(d_fp), 1),
                     nrc, len(d_rc), 100.0 * nrc / max(len(d_rc), 1)))
        for d, e, c in sorted(d_fp, reverse=True)[:4]:
            if d > 0.02: print(u'    FP Δ=%+.3f  « %s »' % (d, e[:88]))
        for d, e, c in sorted(d_rc)[:4]:
            if d <= 0.02: print(u'    raté Δ=%+.3f  « %s »' % (d, e[:88]))
    if reel:
        d = score(reel[1]) - score(reel[0])
        print(u'\n── RÉEL ASEI texte4 : Δ=%+.3f → %s' % (d, u'le juge dit s’est mariée ✓' if d > 0.02 else u'le juge RATE ✗'))
        print(u'   écrit    : %s' % reel[0][:100])
        print(u'   candidat : %s' % reel[1][:100])

if __name__ == '__main__':
    main()
