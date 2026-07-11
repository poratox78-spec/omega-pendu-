# -*- coding: utf-8 -*-
# Extracteur À L'ÉCHELLE : kaikki French Wiktextract JSONL -> lignes Lexique4 (37 col) pour les mots MANQUANTS.
# Extrait TOUT en une passe (mot·POS·genre·IPA·lemme·nombre) = "pas de double travail". MESURE d'abord :
#   combien d'ajoutables, couverture POS/IPA/genre, recouvrement du flood, delta de taille estimé.
#   Rien n'est intégré ici ; ça produit wikt_rows.tsv + les stats.
import json, sys, io, lzma, unicodedata, gzip, collections
sys.stdout.reconfigure(encoding='utf-8')
KAIKKI, LEXXZ, OUTDIR = sys.argv[1], sys.argv[2], sys.argv[3]

def deacc(s):
    s = s.replace('œ','oe').replace('æ','ae')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
ALPHA=set("abcdefghijklmnopqrstuvwxyz")
def ok_word(w):                      # même filtre que build_speller_lex : toutes lettres a-z une fois déacc, len>=2
    return len(w) >= 2 and all(deacc(c) in ALPHA for c in w)

# POS kaikki (anglais normalisé) -> Cgram Lexique. name=nom propre EXCLU. locutions/affixes/symboles exclus.
POS2CG = {'noun':'NOM','verb':'VER','adj':'ADJ','adv':'ADV','pron':'PRO','prep':'PRE',
          'conj':'CON','det':'ART','num':'ADJ','intj':'ONO','article':'ART'}
SKIP_POS = {'name','phrase','proverb','prep_phrase','suffix','prefix','affix','symbol',
            'character','contraction','particle','circumfix','infix','punct'}

print('1) Lexique4 : surfaces connues (reconnaissance) + fréquentes (garde edit-1)...')
KNOWN=set(); FREQ=set()
with lzma.open(LEXXZ,'rt',encoding='utf-8') as f:
    f.readline()
    for line in f:
        c=line.rstrip('\n').split('\t')
        if not c or not c[0]: continue
        w=c[0].lower(); dw=deacc(w)
        KNOWN.add(dw)
        if len(c)>10:
            try: fr=float((c[10] or '0').replace(',','.'))
            except: fr=0.0
            if fr>=1.0 and w.isalpha(): FREQ.add(dw)
print('   KNOWN=%d surfaces · FREQ(garde)=%d'%(len(KNOWN),len(FREQ)))

AB='abcdefghijklmnopqrstuvwxyz'
def e1(w):
    S=[(w[:i],w[i:]) for i in range(len(w)+1)]
    return set([a+b[1:] for a,b in S if b]+[a+c+b[1:] for a,b in S if b for c in AB]+[a+c+b for a,b in S for c in AB]+[a+b[1]+b[0]+b[2:] for a,b in S if len(b)>1])
def risky(dw): return any(x in FREQ for x in e1(dw))

def clean_ipa(s):
    return (s or '').strip().strip('/[]').strip()

print('2) parse kaikki (streaming)...')
# agrégation par surface (déacc-clé -> record) : un mot peut avoir plusieurs entrées POS
agg={}   # dw -> {'surf':mot_accentué, 'pos':set, 'gen':set, 'ipa':str|None, 'lem':str|None, 'num':set}
seen_pos=collections.Counter(); n=0
for line in io.open(KAIKKI,encoding='utf-8'):
    n+=1
    try: r=json.loads(line)
    except: continue
    p=r.get('pos')
    if p in SKIP_POS: continue
    cg=POS2CG.get(p)
    if not cg: continue
    w=(r.get('word') or '').strip()
    if not w or not ok_word(w): continue
    dw=deacc(w.lower())
    rec=agg.get(dw)
    if rec is None:
        rec=agg[dw]={'surf':w.lower(),'pos':set(),'gen':set(),'ipa':None,'lem':None,'num':set()}
    rec['pos'].add(cg)
    # genre (noms) : head_templates args value dans {m,f,mf}
    if cg=='NOM':
        for h in (r.get('head_templates') or []):
            for v in (h.get('args') or {}).values():
                sv=str(v)
                if sv in ('m','f'): rec['gen'].add(sv)
                elif sv in ('mf','mf?'): rec['gen'].add('e')   # épicène -> ambigu (comme build_cgram ignore 'e')
    # IPA (garder la 1re dispo)
    if rec['ipa'] is None:
        for s in (r.get('sounds') or []):
            ip=clean_ipa(s.get('ipa'))
            if ip: rec['ipa']=ip; break
    # nombre : tags de l'entrée
    t=r.get('tags') or []
    if 'plural' in t: rec['num'].add('p')
    if 'singular' in t: rec['num'].add('s')
    seen_pos[cg]+=1
print('   %d lignes lues · %d surfaces uniques extraites'%(n,len(agg)))

print('3) filtre : MANQUANT vs Lexique + garde edit-1...')
addable={}; drop_known=0; drop_risky=0
for dw,rec in agg.items():
    if dw in KNOWN: drop_known+=1; continue
    if risky(dw): drop_risky+=1; continue
    addable[dw]=rec
print('   déjà dans Lexique : %d · bloqués garde edit-1 : %d · AJOUTABLES : %d'%(drop_known,drop_risky,len(addable)))

# stats de couverture sur l'ajoutable
def gender_of(rec):
    g=rec['gen']
    return (list(g)[0] if len(g)==1 and list(g)[0] in ('m','f') else '')
wpos=collections.Counter(); wipa=0; wgen=0
for rec in addable.values():
    for pp in rec['pos']: wpos[pp]+=1
    if rec['ipa']: wipa+=1
    if gender_of(rec): wgen+=1
N=len(addable) or 1
print('   POS ajoutables :',wpos.most_common())
print('   avec IPA  : %d (%.0f%%)'%(wipa,100*wipa/N))
print('   avec genre net (noms) : %d'%wgen)

# recouvrement du flood mesuré (les vrais "mot inconnu" de l'UD)
flood=[w.strip().lower() for w in io.open(OUTDIR+'/flood_ud.txt',encoding='utf-8') if w.strip()]
cov=sum(1 for w in flood if deacc(w) in addable or deacc(w) in KNOWN)
covA=sum(1 for w in flood if deacc(w) in addable)
print('   FLOOD UD : %d/%d couverts (%.0f%%) — dont %d nouveaux via Wiktionnaire'%(cov,len(flood),100*cov/len(flood),covA))

print('4) écrit wikt_rows.tsv (schéma Lexique4 37 col) + estime la taille...')
NC=37
CI={'Mot':0,'Phono_IPA':2,'Lemme':3,'Cgram':4,'CgramOrtho':5,'Genre':6,'Nombre':7,
    'FreqMot':9,'FreqOrtho':10,'FreqLemme':11}
FLOOR='0.05'                          # plancher : passe MINFREQ du speller, mais range au plancher (jamais dominant)
rows=[]; speller_lines=[]
for dw in sorted(addable):
    rec=addable[dw]; surf=rec['surf']
    cg=('NOM' if 'NOM' in rec['pos'] else ('VER' if 'VER' in rec['pos'] else
        ('ADJ' if 'ADJ' in rec['pos'] else sorted(rec['pos'])[0])))    # POS dominante déterministe
    g=(gender_of(rec) if rec['pos']=={'NOM'} else '')                  # genre SEULEMENT sur nom PUR (pas d'homographe verbe/adj) → FP=0
    nb=('p' if rec['num']=={'p'} else ('s' if rec['num']=={'s'} else ''))
    row=['']*NC
    row[CI['Mot']]=surf; row[CI['Phono_IPA']]=rec['ipa'] or ''; row[CI['Lemme']]=(rec['lem'] or surf)
    row[CI['Cgram']]=cg; row[CI['CgramOrtho']]=cg; row[CI['Genre']]=g; row[CI['Nombre']]=nb
    row[CI['FreqMot']]=FLOOR; row[CI['FreqOrtho']]=FLOOR; row[CI['FreqLemme']]=FLOOR
    rows.append('\t'.join(row))
    # ligne speller (mesure taille) : mot\tfreq_milli\tPOS-tags
    pp=''.join(sorted(x for x in ('N' if 'NOM' in rec['pos'] else '', 'V' if 'VER' in rec['pos'] else '', 'A' if 'ADJ' in rec['pos'] else '') if x))
    speller_lines.append('%s\t50\t%s'%(surf,pp))
io.open(OUTDIR+'/wikt_rows.tsv','w',encoding='utf-8').write('\n'.join(rows)+'\n')
raw=('\n'.join(speller_lines)).encode('utf-8')
gz=gzip.compress(raw,9)
print('   wikt_rows.tsv : %d lignes'%len(rows))
print('   delta SP.WORDS estimé : +%d mots · brut %.2f Mo · gzip %.2f Mo · base64 %.2f Mo'%(
      len(speller_lines),len(raw)/1e6,len(gz)/1e6,len(gz)*4/3/1e6))
