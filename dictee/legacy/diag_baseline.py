# -*- coding: utf-8 -*-
# Baseline du classifieur de diagnostic d'erreur de dictée (surface + phono, SANS M3_d).
# Mesure : recouvrement par catégorie + TAUX D'AMBIGUÏTÉ (cas indécidables en surface → cible M3_d/sens).
import csv, unicodedata, random
random.seed(42)
SRC='dictee/test_set.tsv'
VS={'b':'p','p':'b','d':'t','t':'d','g':'k','k':'g','v':'f','f':'v','z':'s','s':'z'}

def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c)!='Mn')

rows=list(csv.DictReader(open(SRC, encoding='utf-8'), delimiter='\t'))

def synth(mot, labels, homs):
    """génère (catégorie_vraie, tentative_erronée) plausible pour une catégorie applicable."""
    out=[]
    # accent : basculer é<->è, ou enlever l'accent
    if 'accent' in labels:
        a=mot
        for x,y in (('é','è'),('è','é'),('ê','e')):
            if x in a: a=a.replace(x,y,1); break
        if a!=mot: out.append(('accent',a))
    # homophone : écrire un homophone réel (même son, autre graphie)
    if 'homophone' in labels and homs:
        out.append(('homophone', homs[0]))
    # voisée/sourde : permuter une consonne voisée<->sourde dans la graphie
    if 'voisee_sourde' in labels:
        for i,ch in enumerate(mot):
            if ch in VS:
                out.append(('voisee_sourde', mot[:i]+VS[ch]+mot[i+1:])); break
    # muette : supprimer une finale muette plausible
    if 'muette' in labels:
        if mot[-1] in 'stdxzep' and len(mot)>3:
            out.append(('muette', mot[:-1]))
    return out

def classify(mot, att, homset):
    """renvoie l'ENSEMBLE des catégories compatibles en surface (sans sens)."""
    cats=set()
    if att==mot: return cats
    # homophone : tentative = autre graphie connue du même mot
    if att in homset: cats.add('homophone')
    da, dm = deacc(att), deacc(mot)
    # accent : identiques une fois désaccentués, mais diffèrent avec accents
    if da==dm and att!=mot: cats.add('accent')
    # voisée/sourde : exactement 1 consonne permutée dans une paire (même longueur)
    if len(att)==len(mot):
        diff=[i for i in range(len(mot)) if att[i]!=mot[i]]
        if len(diff)==1:
            i=diff[0]
            if mot[i] in VS and att[i]==VS[mot[i]]: cats.add('voisee_sourde')
    # muette : tentative = cible privée de lettre(s), désaccenté sous-séquence
    if len(att)<len(mot) and _subseq(da, dm): cats.add('muette')
    return cats

def _subseq(a,b):
    it=iter(b); return all(c in it for c in a)

# évaluation
tot=0; correct=0; ambig=0
per={}  # cat -> [n, correct, ambig]
conf={}
for r in rows:
    mot=r['mot']; labels=set((r['labels'] or '').split(';')) - {''}
    homs=[h for h in (r['homophones'] or '').split() if h]
    homset=set(homs)
    for truth, att in synth(mot, labels, homs):
        tot+=1
        cats=classify(mot, att, homset)
        per.setdefault(truth,[0,0,0]); per[truth][0]+=1
        ok = (cats=={truth})
        if ok: correct+=1; per[truth][1]+=1
        if len(cats)>1: ambig+=1; per[truth][2]+=1
        key=(truth, '|'.join(sorted(cats)) or '∅')
        conf[key]=conf.get(key,0)+1

print(f"cas testés : {tot}")
print(f"diagnostic EXACT (1 seule cat, juste) : {correct} ({correct/tot*100:.1f}%)")
print(f"AMBIGU (≥2 cat compatibles en surface) : {ambig} ({ambig/tot*100:.1f}%)  ← cible M3_d/sens")
print("\npar catégorie vraie  [n · exact% · ambigu%] :")
for c,(n,ok,am) in sorted(per.items()):
    print(f"  {c:14} n={n:3}  exact={ok/n*100:5.1f}%  ambigu={am/n*100:5.1f}%")
print("\nconfusions (vérité → cats prédites : n) :")
for (t,p),n in sorted(conf.items(), key=lambda x:-x[1])[:12]:
    print(f"  {t:14} → {p:28} : {n}")
