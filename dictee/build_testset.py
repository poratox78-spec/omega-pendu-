# -*- coding: utf-8 -*-
# Construit un jeu de test étiqueté pour la dictée diagnostique, depuis Lexique4.tsv.
# Étiquettes dérivées des colonnes : homophone, muette, accent(é/è/ê), voisée/sourde (vraie paire minimale).
import csv, random, re, json
random.seed(42)
SRC='/tmp/lex4/Lexique4.tsv'

ACC=set('éèêëàâäîïôöùûüçœæ')
VS_PAIRS={'p':'b','b':'p','t':'d','d':'t','k':'g','g':'k','f':'v','v':'f','s':'z','z':'s','S':'Z','Z':'S'}
rows=[]
phono2orthos={}        # phono -> set(ortho)  (toutes entrées, pour homophones + paires minimales)
phonoset=set()
with open(SRC, encoding='utf-8', newline='') as f:
    r=csv.reader(f, delimiter='\t'); hdr=next(r)
    for c in r:
        if len(c)<37: continue
        mot=c[0].strip(); phon=c[1].strip()
        if not mot or not phon: continue
        rows.append(c)
        phonoset.add(phon)
        phono2orthos.setdefault(phon, set()).add(mot.lower())

def fnum(x):
    try: return float(x)
    except: return 0.0

def minimal_vs(phon):
    # renvoie un mot existant obtenu par 1 swap voisée/sourde (vraie confusion), sinon None
    for i,ch in enumerate(phon):
        if ch in VS_PAIRS:
            alt=phon[:i]+VS_PAIRS[ch]+phon[i+1:]
            if alt in phonoset and alt!=phon:
                cands=sorted(phono2orthos.get(alt,[]))
                if cands: return (ch+'→'+VS_PAIRS[ch], cands[0])
    return None

def difficulty(freq, preval):
    if preval>=95 or freq>=50: return 'facile'
    if preval>=80 or freq>=5:  return 'moyen'
    return 'difficile'

cand={'homophone':[], 'muette':[], 'accent':[], 'voisee_sourde':[], 'controle':[]}
for c in rows:
    mot=c[0].strip(); low=mot.lower(); phon=c[1].strip(); ipa=c[2].strip()
    cgram=c[4].strip()
    freq=fnum(c[10]); nbl=int(fnum(c[14])); nbp=int(fnum(c[15])); nbhom=int(fnum(c[23]))
    syll=int(fnum(c[25])); preval=fnum(c[32])
    # filtre « mot enseignable » : alpha français pur, longueur 3-12, fréquent
    if not re.fullmatch(r"[a-zàâäéèêëîïôöùûüçœæ]+", low): continue
    if not (3<=len(low)<=12): continue
    if freq<2.0: continue
    labels=[]; extra={}
    # homophone : autre orthographe avec le même phono
    homs=sorted(o for o in phono2orthos.get(phon,[]) if o!=low)
    if nbhom>0 and homs:
        labels.append('homophone'); extra['homophones']=homs[:4]
    # lettre muette
    if (nbl-nbp)>=2:
        labels.append('muette')
    # accent é/è/ê (le piège classique de dictée)
    if any(ch in 'éèê' for ch in low):
        labels.append('accent')
    # voisée/sourde : vraie paire minimale
    vs=minimal_vs(phon)
    if vs:
        labels.append('voisee_sourde'); extra['confus_vs']=vs[0]+' ('+vs[1]+')'
    rec={'mot':mot,'phono':phon,'ipa':ipa,'cgram':cgram,'nblettres':len(low),'nbphons':nbp,
         'syll':syll,'freq':round(freq,3),'preval':round(preval,1),
         'labels':labels,'difficulte':difficulty(freq,preval),**extra}
    if not labels: cand['controle'].append(rec)
    else:
        # catégorie principale = priorité homophone>voisee_sourde>accent>muette (pour l'échantillonnage équilibré)
        for k in ('homophone','voisee_sourde','accent','muette'):
            if k in labels: cand[k].append(rec); break

TARGET={'homophone':70,'voisee_sourde':60,'accent':70,'muette':70,'controle':30}
chosen=[]; seen=set()
for k,n in TARGET.items():
    pool=[r for r in cand[k] if r['mot'] not in seen]
    random.shuffle(pool)
    take=pool[:n]
    for r in take: seen.add(r['mot'])
    chosen+=take
chosen.sort(key=lambda r:(r['difficulte']!='facile', r['mot']))

# sortie TSV
cols=['mot','phono','ipa','cgram','nblettres','nbphons','syll','freq','preval','difficulte','labels','homophones','confus_vs']
with open('/tmp/dictee_testset.tsv','w',encoding='utf-8',newline='') as o:
    w=csv.writer(o,delimiter='\t'); w.writerow(cols)
    for r in chosen:
        w.writerow([r['mot'],r['phono'],r['ipa'],r['cgram'],r['nblettres'],r['nbphons'],r['syll'],
                    r['freq'],r['preval'],r['difficulte'],';'.join(r['labels']),
                    ' '.join(r.get('homophones',[])), r.get('confus_vs','')])
# stats
from collections import Counter
catc=Counter(); diffc=Counter()
for r in chosen:
    for l in r['labels']: catc[l]+=1
    diffc[r['difficulte']]+=1
print('total mots:',len(chosen))
print('par étiquette (multi):',dict(catc))
print('par difficulté:',dict(diffc))
print('--- 15 exemples ---')
for r in chosen[:15]:
    print(f"{r['mot']:14} /{r['phono']:12}/ {','.join(r['labels']):28} {r.get('confus_vs','')} {r.get('homophones','')}")
