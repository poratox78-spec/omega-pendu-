# -*- coding: utf-8 -*-
# N-GRAMME DE PHONÈMES anglais (idée de Rem, point 3 de l'audit phon) — MESURE d'abord. Le pendu a un
# n-gramme de LETTRES (ortho, type-weighté) mais AUCUN n-gramme phonémique. On bâtit ici le tri-gramme de
# phonèmes FRÉQUENTIEL depuis les p du lex4 EN, et on MESURE sa valeur intrinsèque (perplexité next-phonème)
# avant tout câblage moteur : freq vs type, et signal réel de la phonotactique anglaise.
#   Lancer : PYTHONUTF8=1 python dictee/build_phon_ngram_en.py
import gzip, io, os, sys, json, math, unicodedata, collections
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
LEX = os.path.join(HERE, 'lex_en.tsv.gz')

# --- tokeniseur IPA -> phonèmes GA (strip accent/point ; fusionne diphtongues & affriquées) ---
STRIP = set("ˈˌ.ˑ|‖/[]() '’‿-")
MERGE2 = {('a','ɪ'),('a','ʊ'),('ɔ','ɪ'),('o','ʊ'),('e','ɪ'),('ə','ɹ'),('t','ʃ'),('d','ʒ')}
def toks(s):
    out=[];
    for ch in s:
        if ch in STRIP: continue
        if unicodedata.category(ch)=='Mn' or ch=='ː':
            if out: out[-1]+=ch
            continue
        out.append(ch)
    # fusion des paires connues
    m=[]; i=0
    while i<len(out):
        a=''.join(c for c in out[i] if unicodedata.category(c)!='Mn')
        if i+1<len(out):
            b=''.join(c for c in out[i+1] if unicodedata.category(c)!='Mn')
            if (a,b) in MERGE2: m.append(a+b); i+=2; continue
        m.append(out[i]); i+=1
    return m

BOS,EOS='^','$'
rows=[]
with gzip.open(LEX,'rt',encoding='utf-8') as f:
    f.readline()
    for ln in f:
        c=ln.rstrip('\n').split('\t')
        if len(c)<7: continue
        surf,ipa=c[0],c[2]
        if not (surf.isalpha() and surf.isascii()) or not ipa: continue
        try: fr=int(c[6])
        except:
            try: fr=int(float(c[6]))
            except: fr=0
        ph=toks(ipa)
        if len(ph)>=2: rows.append((fr,ph))
print('mots avec phon tokenisé :', len(rows))

def build(weighted):
    uni=collections.Counter(); bi=collections.Counter(); tri=collections.Counter(); ctx2=collections.Counter()
    for fr,ph in rows:
        w = (1+math.log10(1+fr)) if weighted else 1.0
        seq=[BOS,BOS]+ph+[EOS]
        for i in range(2,len(seq)):
            uni[seq[i]]+=w; bi[(seq[i-1],seq[i])]+=w
            tri[(seq[i-2],seq[i-1],seq[i])]+=w; ctx2[(seq[i-2],seq[i-1])]+=w
    return uni,bi,tri,ctx2

# perplexité next-phonème en held-out (tri avec backoff bi/uni, lissage add-δ)
def perplexity(uni,bi,tri,ctx2, hold):
    V=len(uni); Uc=sum(uni.values()); d=0.1; ll=0.0; n=0
    uctx=collections.Counter()
    for a,b in bi: uctx[a]+=bi[(a,b)]
    for fr,ph in hold:
        seq=[BOS,BOS]+ph+[EOS]
        for i in range(2,len(seq)):
            w2=(seq[i-2],seq[i-1]); w1=seq[i-1]; x=seq[i]
            pt=(tri.get((w2[0],w1,x),0)+d)/(ctx2.get(w2,0)+d*V)
            pb=(bi.get((w1,x),0)+d)/(uctx.get(w1,0)+d*V)
            pu=(uni.get(x,0)+d)/(Uc+d*V)
            p=0.6*pt+0.3*pb+0.1*pu
            ll+=math.log2(max(p,1e-12)); n+=1
    return 2**(-ll/max(1,n))

# split 90/10 déterministe (par index)
train=[r for i,r in enumerate(rows) if i%10!=0]
hold =[r for i,r in enumerate(rows) if i%10==0]
for lab,wt in [('TYPE (chaque mot 1×)',False),('FREQ (log-pondéré)',True)]:
    tr=[r for r in train]
    u,b,t,c=build(wt)
    # reconstruire sur train seulement pour un held-out honnête
    globals()['rows_bak']=rows
    pass
# rebuild proprement sur train
def build_on(data,weighted):
    uni=collections.Counter(); bi=collections.Counter(); tri=collections.Counter(); ctx2=collections.Counter()
    for fr,ph in data:
        w=(1+math.log10(1+fr)) if weighted else 1.0
        seq=[BOS,BOS]+ph+[EOS]
        for i in range(2,len(seq)):
            uni[seq[i]]+=w; bi[(seq[i-1],seq[i])]+=w
            tri[(seq[i-2],seq[i-1],seq[i])]+=w; ctx2[(seq[i-2],seq[i-1])]+=w
    return uni,bi,tri,ctx2
print('\nperplexité next-phonème (held-out 10%, tri+backoff) :')
for lab,wt in [('TYPE',False),('FREQ',True)]:
    u,b,t,c=build_on(train,wt)
    pp=perplexity(u,b,t,c,hold)
    print('  %-5s : PP=%.2f  (inventaire %d phonèmes)' % (lab,pp,len(u)))
# entropie unigramme (borne haute = zéro contexte)
u,_,_,_=build_on(train,False); tot=sum(u.values())
H0=-sum((n/tot)*math.log2(n/tot) for n in u.values())
print('  H0 unigramme = %.2f bits (PP0=%.1f) → le n-gramme doit battre ça pour porter un signal' % (H0,2**H0))
