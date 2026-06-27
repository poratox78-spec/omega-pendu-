# gender_probe_ud.py — MESURE l'accord en GENRE du correcteur sur du français RÉEL (UD French-GSD, genre+POS gold).
# Le correcteur a une règle de genre DÉTERMINANT active (rule_det_gender) et une règle de genre ADJECTIF
# DÉSACTIVÉE car « FP-insûre » (cf. RULES). UD permet de chiffrer les deux sur du vrai texte :
#   (1) FP de chaque règle sur des phrases CORRECTES (la règle active doit être ~0 ; la désactivée : combien de FP ?)
#   (2) RECALL du genre déterminant par injection contrôlée (un↔une, le↔la… validée par le genre gold UD).
# Corpus UD hors-repo (data_local/, cf. evo/evo_o2_homophone_context.js pour le téléchargement). Lecture seule, parité Python.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from correcteur_probe import correct, rule_det_gender, rule_genre_adj, toks  # parité avec l'app

UD = os.path.join(HERE, '..', 'data_local', 'ud_fr_gsd-train.conllu')
if not os.path.exists(UD):
    print("Corpus UD absent (data_local/ud_fr_gsd-train.conllu) — cf. en-tête evo/evo_o2_homophone_context.js"); sys.exit(2)

def parse_ud(path):
    sents=[]; cur=[]
    for line in open(path, encoding='utf-8'):
        line=line.rstrip('\n')
        if line=='':
            if cur: sents.append(cur); cur=[]
            continue
        if line.startswith('#'): continue
        c=line.split('\t')
        if len(c)<6 or '-' in c[0] or '.' in c[0]: continue
        g='Fem' if 'Gender=Fem' in c[5] else ('Masc' if 'Gender=Masc' in c[5] else None)
        cur.append((c[1], c[3], g))
    if cur: sents.append(cur)
    return sents

sents = parse_ud(UD)
print(f"corpus UD : {len(sents)} phrases · {sum(len(s) for s in sents)} tokens (genre/POS gold)")

SWAP={'un':'une','une':'un','le':'la','la':'le','ce':'cette','cette':'ce',
      'mon':'ma','ma':'mon','ton':'ta','ta':'ton','son':'sa','sa':'son'}
def keepcase(src,tgt): return tgt.capitalize() if src[:1].isupper() else tgt

# (1) FAUX POSITIFS des deux règles de genre sur du FR CORRECT (T = tokens UD, alignés au POS gold)
det_fp=adj_fp=adj_on_adj=adj_on_nonadj=nwords=0
for s in sents:
    T=[t[0] for t in s]; pos=[t[1] for t in s]; nwords+=len(T)
    for i in range(len(T)):
        d=rule_det_gender(T,i)
        if d is not None and d.lower()!=T[i].lower(): det_fp+=1
        a=rule_genre_adj(T,i)
        if a is not None and a.lower()!=T[i].lower():
            adj_fp+=1
            if pos[i]=='ADJ': adj_on_adj+=1      # vrai adjectif : un POS-gate NE l'enlèverait PAS (FP irréductible)
            else: adj_on_nonadj+=1               # PAS un adjectif (homographe) : un POS-gate l'ENLÈVERAIT

# (2) RECALL du genre DÉTERMINANT par injection (un↔une… validée par le genre gold UD)
inj=det=0; misses=[]
for s in sents:
    forms=[t[0] for t in s]; pos=[t[1] for t in s]; gen=[t[2] for t in s]
    for i in range(len(forms)-1):
        low=forms[i].lower()
        if low in ('le','la') and i>0 and forms[i-1].lower() in ('de','à','des'): continue  # artefact contraction du/au (UD split)
        if pos[i]=='DET' and low in SWAP and gen[i] in ('Masc','Fem') and pos[i+1]=='NOUN':
            orig=forms[i]; bad=keepcase(orig, SWAP[low])
            corr=forms[:]; corr[i]=bad
            flags=correct(' '.join(corr)); inj+=1
            hit=any(f[1].lower()==bad.lower() and f[2].lower()==orig.lower() for f in flags)
            if hit: det+=1
            elif len(misses)<8: misses.append(f"{orig}->{bad} : {' '.join(forms[max(0,i-1):i+2])}")
            break

print(f"\n=== (1) FAUX POSITIFS des règles de genre sur {nwords} mots de FR CORRECT (UD) ===")
print(f"  genre DÉTERMINANT (rule_det_gender, ACTIVE)   : {det_fp} FP  ({1000*det_fp/nwords:.2f} / 1000 mots)")
print(f"  genre ADJECTIF    (rule_genre_adj, DÉSACTIVÉE) : {adj_fp} FP  ({1000*adj_fp/nwords:.2f} / 1000 mots)")
print(f"     dont sur un VRAI adjectif (POS-gate n'enlève PAS) : {adj_on_adj}  ({1000*adj_on_adj/nwords:.2f} / 1000)")
print(f"     dont sur un NON-adjectif (POS-gate ENLÈVERAIT)    : {adj_on_nonadj}  ({1000*adj_on_nonadj/nwords:.2f} / 1000)")
print(f"     → un POS-gate ferait passer l'adjectif de {1000*adj_fp/nwords:.2f} à {1000*adj_on_adj/nwords:.2f} FP/1000 ({100*adj_on_nonadj/max(adj_fp,1):.0f}% des FP supprimés)")
print(f"\n=== (2) RECALL du genre déterminant (injection contrôlée un↔une…, validée genre gold) ===")
print(f"  injections : {inj} · détectées+corrigées : {det}  → recall {100*det/max(inj,1):.1f} %")
if misses: print("  exemples de ratés :", ' | '.join(misses[:6]))
print(f"\n  >>> lecture : le déterminant ACTIF doit montrer FP≈0 (invariant) et un recall mesuré sur du vrai français ;")
print(f"      l'adjectif DÉSACTIVÉ chiffre POURQUOI (son taux de FP réel) — et si un POS-gate UD pourrait le rendre FP-sûr.")
