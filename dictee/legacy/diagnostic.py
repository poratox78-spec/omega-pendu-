# -*- coding: utf-8 -*-
# Module de diagnostic d'erreur de dictée — MULTI-ÉTIQUETTE + feedback français.
# Donné (mot cible connu, tentative de l'élève) → liste les faits d'erreur, sans M3_d.
# (Phase 1 accents = la cible vient accentuée du lexique ; reconstruction OOV = route app, déférée.)
import csv, json, unicodedata, os, random
random.seed(42)
HERE=os.path.dirname(os.path.abspath(__file__))
VS={'b':'p','p':'b','d':'t','t':'d','g':'k','k':'g','v':'f','f':'v','z':'s','s':'z'}
VSN={'b':'sonore→sourde','p':'sourde→sonore','d':'sonore→sourde','t':'sourde→sonore',
     'g':'sonore→sourde','k':'sourde→sonore','v':'sonore→sourde','f':'sourde→sonore',
     'z':'sonore→sourde','s':'sourde→sonore'}

def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c)!='Mn')

# index homophones : phono -> [orthos] ; et ortho -> phono
_FAM = json.load(open(os.path.join(HERE,'phono_homophones.json'), encoding='utf-8'))
_O2P = {}
for ph, orths in _FAM.items():
    for o in orths: _O2P.setdefault(o, ph)

def _subseq(a, b):
    it=iter(b); return all(c in it for c in a)

def _missing_letters(short, long):
    # lettres de `long` absentes de `short` (en respectant l'ordre/sous-séquence)
    res=[]; it=iter(short); cur=next(it, None)
    for ch in long:
        if cur is not None and ch==cur: cur=next(it, None)
        else: res.append(ch)
    return res

def diagnose(cible, tentative, phono=None):
    """Renvoie une liste de faits {type, message}. cible = mot juste (connu), tentative = saisie élève."""
    facts=[]
    if tentative == cible:
        return [{'type':'correct','message':'✓ Correct.'}]
    dc, dt = deacc(cible), deacc(tentative)
    # accent : mêmes lettres une fois désaccentuées
    if dc == dt:
        facts.append({'type':'accent',
            'message':f'Bon mot, mauvais accent : « {tentative} » → « {cible} » (le son tranche é/è/ê).'})
    # voisée/sourde : même longueur, 1 consonne permutée dans une paire
    if len(tentative)==len(cible):
        diff=[i for i in range(len(cible)) if tentative[i]!=cible[i]]
        if len(diff)==1:
            i=diff[0]; a,b=cible[i].lower(), tentative[i].lower()
            if a in VS and b==VS[a]:
                facts.append({'type':'voisee_sourde',
                    'message':f'Confusion sourde/sonore {b}↔{a} ({VSN.get(a,"")}) : « {tentative} » → « {cible} ».'})
    # muette : tentative = cible privée de lettres (désaccenté sous-séquence)
    if len(dt)<len(dc) and _subseq(dt, dc):
        miss=_missing_letters(dt, dc)
        facts.append({'type':'muette',
            'message':f'Lettre(s) muette(s) oubliée(s) : il manque « {"".join(miss)} » dans « {cible} ».'})
    # homophone : tentative est un autre mot de même prononciation
    ph = phono or _O2P.get(cible.lower())
    fam = set(_FAM.get(ph, [])) if ph else set()
    if tentative.lower() in fam and deacc(tentative.lower())!=dc:
        facts.append({'type':'homophone',
            'message':f'Homophone : « {tentative} » existe (même son) mais ce n\'est pas le bon mot — ici c\'est « {cible} ».'})
    if not facts:
        facts.append({'type':'autre',
            'message':f'Graphie incorrecte : « {tentative} » → « {cible} » (à vérifier).'})
    return facts

# ---- mesure + démo sur le jeu de test ----
if __name__=='__main__':
    rows=list(csv.DictReader(open(os.path.join(HERE,'test_set.tsv'), encoding='utf-8'), delimiter='\t'))
    def synth(mot, labels, homs):
        out=[]
        if 'accent' in labels:
            a=mot
            for x,y in (('é','è'),('è','é'),('ê','e')):
                if x in a: a=a.replace(x,y,1); break
            if a!=mot: out.append(('accent',a))
        if 'homophone' in labels and homs: out.append(('homophone',homs[0]))
        if 'voisee_sourde' in labels:
            for i,ch in enumerate(mot):
                if ch in VS: out.append(('voisee_sourde',mot[:i]+VS[ch]+mot[i+1:])); break
        if 'muette' in labels and mot[-1] in 'stdxzep' and len(mot)>3:
            out.append(('muette',mot[:-1]))
        return out
    tot=0; recall=0; multi=0; per={}
    demo=[]
    for r in rows:
        mot=r['mot']; labels=set((r['labels'] or '').split(';'))-{''}
        homs=[h for h in (r['homophones'] or '').split() if h]
        for truth, att in synth(mot, labels, homs):
            tot+=1
            facts=diagnose(mot, att, r['phono'])
            types={f['type'] for f in facts}
            per.setdefault(truth,[0,0]); per[truth][0]+=1
            if truth in types: recall+=1; per[truth][1]+=1
            if len(facts)>1: multi+=1
            if len(demo)<8 and truth in ('accent','homophone','voisee_sourde','muette'):
                demo.append((mot,att,facts))
    print(f"cas: {tot}  |  rappel (le vrai type est détecté): {recall/tot*100:.1f}%  |  multi-étiquette: {multi/tot*100:.1f}%")
    for c,(n,ok) in sorted(per.items()): print(f"  {c:14} rappel={ok/n*100:5.1f}%  (n={n})")
    print("\n--- exemples de feedback (cible ← tentative) ---")
    seen=set()
    for mot,att,facts in demo:
        k=facts[0]['type']
        if k in seen: continue
        seen.add(k)
        print(f"\n« {mot} » ← « {att} »")
        for f in facts: print(f"   [{f['type']}] {f['message']}")
