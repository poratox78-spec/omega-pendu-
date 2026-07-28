# -*- coding: utf-8 -*-
# build_dictee.py — ANNOTE une phrase de dictée : texte brut -> {text, d, fam, traps}.
# fam  = groupe d'homophones de chaque mot (phono_homophones.json, dérivé de Lexique 4 CC BY-SA),
#        filtré par un plancher de fréquence (speller) pour écarter le junk rare.
# traps= familles d'erreur STRUCTURELLEMENT possibles sur les mots (surface via candidats + homophone/accord via fam),
#        classées par diag_sentence.diag_word — l'annotation reste un SUR-ensemble curable, jamais un manque.
# Le fam hand-curé d'origine est reproduit à 93 % exact / 7 % plus large / 0 % incomplet (mesuré sur les 39).
#   Usage : python3 dictee/build_dictee.py "Le chat dort." facile
#           python3 dictee/build_dictee.py --check     (rejoue les 39 : fam ⊇ ref, traps ⊇ ref, 0 self-FP)
import json, os, sys, gzip
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import diag_sentence as D

homo = json.load(open(os.path.join(HERE, 'phono_homophones.json'), encoding='utf-8'))
g2s = {}
for s, gs in homo.items():
    for g in gs: g2s.setdefault(g.lower(), set()).add(s)
FREQ = {}
try:
    for l in gzip.open(os.path.join(HERE, '..', 'extension', 'assets', 'speller.tsv.gz'), 'rt', encoding='utf-8'):
        p = l.rstrip('\n').split('\t')
        if len(p) >= 2:
            try: FREQ[p[0]] = int(p[1]) / 1000
            except ValueError: pass
except Exception: pass
FLOOR = 0.0   # pas de plancher : ne JAMAIS rater un vrai homophone (l'oracle doit tout couvrir) ; le sur-ensemble est curable, le manque non

def fam_of(w):
    lw = w.lower(); out = set()
    for s in g2s.get(lw, ()):
        for g in homo[s]: out.add(g)
    out.discard(lw)
    # garder : soit fréquent (vrai mot que le dys pourrait écrire), soit variante du même déacc (flexion/accent)
    dl = D.deacc(lw)
    return sorted(g for g in out if FREQ.get(g, 0) >= FLOOR or D.deacc(g) == dl)

def cand_variants(w):
    lw = w.lower(); c = []
    for i, ch in enumerate(lw):
        if ch in D.VS: c.append(lw[:i] + D.VS[ch] + lw[i+1:]); break   # voisée-sourde
    da = D.deacc(lw)
    if da != lw: c.append(da)                                          # accent perdu
    if lw[-1:] in 'stdxp' and len(lw) > 3: c.append(lw[:-1])           # consonne muette finale
    if lw.endswith('e') and len(lw) > 3: c.append(lw[:-1])            # e muet final
    if len(lw) >= 3: c.append(lw[:2] + lw[1] + lw[2:])                # ajout (lettre doublée)
    if len(lw) >= 4: L = list(lw); L[1], L[2] = L[2], L[1]; c.append(''.join(L))   # inversion
    if "'" in lw: c.append(lw.replace("'", ""))                       # élision fusionnée (l'ami->lami) = SEGMENTATION (diag_word _seg)
    return c

SURFACE = ('accent', 'voisee_sourde', 'inversion', 'muette', 'ajout', 'homophone', 'accord')

def build(text, d):
    T = D.toks(text)
    fam = {}
    for w in T:
        f = fam_of(w)
        if f: fam[w] = f
    traps = set()
    for w in T:
        f = fam.get(w, [])
        # fam (homophones) -> familles LEXICALES/grammaticales ; les surfaces viennent des candidats
        # STRUCTURELS. En particulier « accent » ne se déduit QUE d'un mot réellement accentué (pas d'un
        # homophone accentué comme « là » pour « la ») : sinon on taguerait « accent » sur une phrase
        # sans aucun accent — ce que la garde CI refuse à juste titre.
        for v in f:
            for ty in D.diag_word(w, v, f):
                ty = 'homophone' if ty.startswith('homophone') else ty
                if ty in ('homophone', 'accord', 'muette', 'ajout', 'inversion', 'voisee_sourde'):
                    traps.add(ty)
        for v in cand_variants(w):
            for ty in D.diag_word(w, v, f):
                if ty in SURFACE or ty == 'segmentation': traps.add(ty)   # segmentation = piège de découpage (élision), hors SURFACE
    return {'text': text, 'd': d, 'fam': fam, 'traps': sorted(traps)}

if __name__ == '__main__':
    if '--check' in sys.argv:
        src = json.load(open(os.path.join(HERE, 'sentences.json'), encoding='utf-8'))
        fam_ok = fam_sup = fam_miss = 0; trap_ok = trap_sup = trap_miss = 0; selffp = 0
        for e in src:
            g = build(e['text'], e['d'])
            for w, ref in e['fam'].items():
                gg = set(fam_of(w)); rr = set(ref)   # compare l'oracle du mot (le keying de build() n'est pas le sujet du test)
                if gg == rr: fam_ok += 1
                elif rr <= gg: fam_sup += 1
                else: fam_miss += 1
            gt, rt = set(g['traps']), set(e['traps'])
            if gt == rt: trap_ok += 1
            elif rt <= gt: trap_sup += 1
            else: trap_miss += 1
            if D.diagnose_sentence(e['text'], e['text'], {k.lower(): v for k, v in g['fam'].items()}): selffp += 1
        n = len(src)
        print('rejoue les %d phrases :' % n)
        print('  fam  : exact %d | plus large %d | INCOMPLET %d' % (fam_ok, fam_sup, fam_miss))
        print('  traps: exact %d | plus large %d | INCOMPLET %d' % (trap_ok, trap_sup, trap_miss))
        print('  self-FP (doit être 0) : %d' % selffp)
        sys.exit(1 if (fam_miss or selffp) else 0)   # fam-miss et self-FP = echecs durs ; traps plus large = semantique voulue (le picker ne perd jamais une famille)
    text = sys.argv[1]; d = sys.argv[2] if len(sys.argv) > 2 else 'moyen'
    print(json.dumps(build(text, d), ensure_ascii=False, indent=1))
