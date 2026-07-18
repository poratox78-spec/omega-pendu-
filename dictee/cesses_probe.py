# -*- coding: utf-8 -*-
# RÉFÉRENCE de la VIGILANCE-ENSEIGNANTE ces/ses (POS-free, carte chaud-froid baké ces_ses_model.json).
# NE corrige JAMAIS — TRIGGER : |score|>τ ET la carte DÉSACCORDE l'écrit → « ces ou ses ? » (l'auteur tranche, l'encart
# enseigne). Le 90 % du modèle est nul pour décider mais parfait pour POINTER (une erreur = un prompt anodin, pas une
# fausse correction). C'est LA RÉFÉRENCE que portent app+extension (orange, comme osVerbVig). τ serré = pas de fatigue.
#   python dictee/cesses_probe.py   → taux de déclenchement sur fp_scale (fatigue) + batterie
import os, re, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
M = json.load(open(os.path.join(HERE, 'ces_ses_model.json'), encoding='utf-8'))
PRIOR = M['prior']; LR = M['lr']; TAU = M['tau']
TOK = re.compile(r"[a-zA-Zà-ÿœæ'\-]+")
def tk(s): return [w.lower() for w in TOK.findall(s.replace('’', "'"))]

def _feats(T, i):                                      # POS-FREE (miroir exact build_cesses + JS) ; T = tokens minuscules
    n = len(T)
    return ['nx='  + (T[i+1] if i+1 < n else '</s>'),
            'nx2=' + (T[i+2] if i+2 < n else '</s>'),
            'pv='  + (T[i-1] if i > 0 else '<s>'),
            'pos=' + ('deb' if i <= 1 else 'mil')]
def _score(T, i):
    s = PRIOR
    for x in _feats(T, i):
        if x in LR: s += LR[x]
    return s
def cesVig(T, i):
    """rend la forme suggérée (« ces »/« ses ») si la carte DÉSACCORDE l'écrit au-dessus de τ, sinon None. Vigilance : ne réécrit pas."""
    w = T[i].lower()
    if w not in ('ces', 'ses'): return None
    s = _score([t.lower() for t in T], i)
    pred = 'ces' if s >= 0 else 'ses'
    if abs(s) > TAU and pred != w:
        return pred
    return None

if __name__ == '__main__':
    fp = [l.strip() for l in open(os.path.join(HERE, 'fp_scale_corpus.txt'), encoding='utf-8') if l.strip()]
    if len(sys.argv) > 1 and sys.argv[1] == 'floodflags':          # mode PARITÉ : flags sur fp_scale[:1500] → comparé aux moteurs JS
        flags = []
        for s in fp[:1500]:
            T = tk(s)
            for i in range(len(T)):
                r = cesVig(T, i)
                if r and r != T[i]: flags.append([T[i], r])
        print(json.dumps(sorted(flags), ensure_ascii=False)); sys.exit(0)
    occ = trig = words = 0
    for s in fp[:2500]:
        T = tk(s); words += len(T)
        for i in range(len(T)):
            if T[i] in ('ces', 'ses'):
                occ += 1
                if cesVig(T, i): trig += 1
    print("=== VIGILANCE ces/ses (τ=%.1f, modèle %d features) ===" % (TAU, len(LR)))
    print("  fatigue sur fp_scale CORRECT : %d faux sourcils / %d occ. ces-ses / %d mots (1 tous les ~%d mots)"
          % (trig, occ, words, words // max(1, trig)))
    print("  batterie (faute → doit lever le sourcil) :")
    for s in ["il range ces affaires", "elle aime ces enfants et ces jouets",
              "regarde ces photos", "ces dernières années",
              "marie a perdu ces clés", "ils ont vendu ces maisons de campagne"]:
        T = tk(s); fr = []
        for i in range(len(T)):
            r = cesVig(T, i)
            if r: fr.append("%s→%s?" % (T[i], r))
        print("     %-42s %s" % (s, fr or "(silence)"))
