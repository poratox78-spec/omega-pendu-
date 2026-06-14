# -*- coding: utf-8 -*-
# Diagnostic de DICTÉE DE PHRASES : aligne mots cible vs élève, diagnostique chaque mot.
# Le contexte est encodé dans la phrase cible -> homophones et ACCORDS deviennent gradables (sans M3_d).
import json, re, unicodedata, os, random
random.seed(42)
HERE=os.path.dirname(os.path.abspath(__file__))
VS={'b':'p','p':'b','d':'t','t':'d','g':'k','k':'g','v':'f','f':'v','z':'s','s':'z'}
INFL=set('setxn')
def deacc(s): return ''.join(c for c in unicodedata.normalize('NFD',s) if unicodedata.category(c)!='Mn')
def toks(s): return re.findall(r"[A-Za-zÀ-ÿ']+", s)
def subseq(a,b):
    i=0
    for c in b:
        if i<len(a) and a[i]==c: i+=1
    return i==len(a)
def is_accord(t,s):
    a,b=deacc(t.lower()),deacc(s.lower())
    p=0
    while p<len(a) and p<len(b) and a[p]==b[p]: p+=1
    ra,rb=a[p:],b[p:]
    return (ra!=rb) and all(c in INFL for c in ra+rb)

def diag_word(t,s,fam):
    """t=cible, s=élève (mots). fam=liste homophones de t. -> liste de types."""
    if s.lower()==t.lower(): return []
    dt,ds=deacc(t.lower()),deacc(s.lower()); out=[]
    if dt==ds and s.lower()!=t.lower(): out.append('accent')
    if len(s)==len(t):
        d=[i for i in range(len(t)) if t[i].lower()!=s[i].lower()]
        if len(d)==1:
            a,b=t[d[0]].lower(),s[d[0]].lower()
            if VS.get(a)==b: out.append('voisee_sourde')
    if len(dt)==len(ds) and dt!=ds and sorted(dt)==sorted(ds): out.append('inversion')
    if len(ds)<len(dt) and subseq(ds,dt): out.append('muette')
    if len(ds)>len(dt) and subseq(dt,ds): out.append('ajout')
    if s.lower() in (x.lower() for x in fam):
        out.append('accord' if is_accord(t,s) else 'homophone')
    if not out: out.append('autre')
    return out

def align(T,S):
    """Levenshtein sur listes de mots -> opérations (match/sub/del/ins)."""
    n,m=len(T),len(S)
    dp=[[0]*(m+1) for _ in range(n+1)]
    for i in range(n+1): dp[i][0]=i
    for j in range(m+1): dp[0][j]=j
    for i in range(1,n+1):
        for j in range(1,m+1):
            c=0 if T[i-1].lower()==S[j-1].lower() else 1
            dp[i][j]=min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+c)
    ops=[]; i,j=n,m
    while i>0 or j>0:
        if i>0 and j>0 and dp[i][j]==dp[i-1][j-1]+(0 if T[i-1].lower()==S[j-1].lower() else 1):
            ops.append(('match' if T[i-1].lower()==S[j-1].lower() else 'sub', T[i-1], S[j-1])); i-=1; j-=1
        elif i>0 and dp[i][j]==dp[i-1][j]+1:
            ops.append(('del',T[i-1],None)); i-=1
        else:
            ops.append(('ins',None,S[j-1])); j-=1
    ops.reverse(); return ops

def diagnose_sentence(cible, eleve, fam):
    T,S=toks(cible),toks(eleve); facts=[]
    for op,t,s in align(T,S):
        if op=='match': continue
        if op=='del': facts.append({'mot':t,'types':['omission'],'msg':f'Mot oublié : « {t} ».'}); continue
        if op=='ins': facts.append({'mot':s,'types':['mot_en_trop'],'msg':f'Mot en trop : « {s} ».'}); continue
        types=diag_word(t,s,fam.get(t.lower(),[]))
        facts.append({'mot':t,'tentative':s,'types':types,'msg':f'« {s} » → « {t} » : {",".join(types)}'})
    return facts

if __name__=='__main__':
    SENT=json.load(open(os.path.join(HERE,'sentences.json'),encoding='utf-8'))
    def lc_fam(e): return {k:v for k,v in e['fam'].items()}
    # synthèse d'erreurs par famille -> on vérifie la détection
    tot={}; ok={}
    def rec(fam_name, good): tot[fam_name]=tot.get(fam_name,0)+1; ok[fam_name]=ok.get(fam_name,0)+(1 if good else 0)
    import copy
    for e in SENT:
        T=toks(e['text']); fam=e['fam']
        # accent
        for i,w in enumerate(T):
            if any(c in 'éèê' for c in w):
                w2=w.replace('é','è',1) if 'é' in w else w.replace('è','é',1) if 'è' in w else w.replace('ê','e',1)
                if w2!=w:
                    S=T[:i]+[w2]+T[i+1:]; f=diagnose_sentence(e['text'],' '.join(S),fam)
                    rec('accent', any('accent' in x['types'] for x in f)); break
        # accord : remplacer un mot par un homophone flexionnel
        done=False
        for w in T:
            for h in fam.get(w.lower(),[]):
                if is_accord(w,h):
                    S=[h if t==w else t for t in T]; f=diagnose_sentence(e['text'],' '.join(S),fam)
                    rec('accord', any('accord' in x['types'] for x in f)); done=True; break
            if done: break
        # homophone lexical
        done=False
        for w in T:
            for h in fam.get(w.lower(),[]):
                if not is_accord(w,h) and deacc(h)!=deacc(w.lower()):
                    S=[h if t==w else t for t in T]; f=diagnose_sentence(e['text'],' '.join(S),fam)
                    rec('homophone', any('homophone' in x['types'] for x in f)); done=True; break
            if done: break
        # omission
        if len(T)>3:
            i=len(T)//2; S=T[:i]+T[i+1:]; f=diagnose_sentence(e['text'],' '.join(S),fam)
            rec('omission', any('omission' in x['types'] for x in f))
    print('=== rappel par famille (dictée de phrases, 30 phrases) ===')
    for k in sorted(tot): print(f'  {k:11} {ok[k]}/{tot[k]}  = {ok[k]/tot[k]*100:.0f}%')
    # démo
    print('\n--- démo ---')
    e=SENT[10]  # "Les élèves répètent la leçon difficile."
    for bad in ["Les élève répète la leçon difficile.", "Les éleves répètent la leson difficile."]:
        print(f'cible : {e["text"]}'); print(f'élève : {bad}')
        for x in diagnose_sentence(e['text'],bad,e['fam']): print('   -',x['msg'])
        print()
