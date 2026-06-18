# -*- coding: utf-8 -*-
# Diagnostic de DICTÉE DE PHRASES : aligne mots cible vs élève, diagnostique chaque mot.
# Le contexte est encodé dans la phrase cible -> homophones et ACCORDS deviennent gradables (sans M3_d).
import json, re, unicodedata, os, random
random.seed(42)
HERE=os.path.dirname(os.path.abspath(__file__))
VS={'b':'p','p':'b','d':'t','t':'d','g':'k','k':'g','v':'f','f':'v','z':'s','s':'z'}
INFL=set('setxn')
# Levier GRAMMAIRE : nombre porté par les mots-outils (classe fermée, fiable sans POS complet).
NUM_DET={'le':'sg','la':'sg','un':'sg','une':'sg','ce':'sg','cet':'sg','cette':'sg','mon':'sg','ton':'sg','son':'sg','ma':'sg','ta':'sg','sa':'sg','notre':'sg','votre':'sg','leur':'sg',
         'les':'pl','des':'pl','ces':'pl','mes':'pl','tes':'pl','ses':'pl','nos':'pl','vos':'pl','leurs':'pl'}
NUM_PRON={'je':'sg','tu':'sg','il':'sg','elle':'sg','on':'sg','nous':'pl','vous':'pl','ils':'pl','elles':'pl'}
PREP={'de','à','a','du','des','au','aux','sur','dans','par','pour','avec','sans','sous','chez','vers','près','pres',
      'travers','malgré','malgre','dès','entre','depuis','contre'}   # (2) déterminant après prép = PP, pas le sujet
def governor_number(T,idx,skip_pp=False):
    """Gouverneur d'accord = pronom sujet ou déterminant le plus proche À GAUCHE → (mot, nombre).
    (2) skip_pp : pour un VERBE/participe-être, saute les déterminants de groupe prépositionnel
        (« le ver DE LA terre creuse » → sujet = « le ver », pas « la terre »)."""
    for j in range(idx-1,-1,-1):
        w=T[j].lower()
        if w in NUM_PRON: return (T[j],NUM_PRON[w])
        if w in NUM_DET:
            if skip_pp and j>0 and deacc(T[j-1].lower()) in PREP: continue   # det de PP → on cherche le vrai sujet
            return (T[j],NUM_DET[w])
    return None
# POS-contexte : formes verbales finies/aux du corpus (deacc). (3) + repli morphologique pour scaler hors-corpus.
VERB_FORMS={'dort','jouent','boit','court','lit','met','mangeons','ecrit','chantent','repetent','creuse',
            'porte','prennent','sont','vend','eteignent','galopent','faut','finisses','etudient','tombent',
            'est','aurait','restions','cachait','quittent','calme','attendaient','furent','poursuivirent','avons','a'}
VERB_SUF=('ons','ez','aient','ait','erent','irent','issent')   # (3) suffixes verbaux peu ambigus (PAS -ent : adverbes/noms)
NOTVERB={'longtemps','ensemble','vraiment','souvent','comment','patiemment','rapidement'}
def is_verb(T,idx):
    """Verbe EN CONTEXTE : forme verbale (lexique corpus OU repli morphologique) ET non précédée d'un déterminant.
    Résout l'homographie nom/verbe : « le lit/la porte » (nom) vs « papa lit/elle porte » (verbe)."""
    if not (0<=idx<len(T)): return False
    w=deacc(T[idx].lower())
    known = (w in VERB_FORMS) or (w not in NOTVERB and len(w)>3 and any(w.endswith(s) for s in VERB_SUF))
    if not known: return False
    return not (idx>0 and T[idx-1].lower() in NUM_DET)
# (1) PARTICIPE PASSÉ : agrée avec le SUJET via être, invariable via avoir (sauf COD antéposé).
AUX_ETRE={'est','sont','furent','fut','etait','etaient','sera','seront','suis','es','sommes','etes','soit'}
AUX_AVOIR={'a','ont','avons','avez','ai','as','avait','avaient','aurait','aura','auront','aurais','eu'}
PART_FORMS={'arrive','arrives','arrivee','arrivees','peint','peints','peinte','peintes','cueilli','cueillie',
            'cueillis','cueillies','trouve','trouves','trouvee','trouvees','prefere','preferes','preferee',
            'preferees','abandonne','abandonnes','abandonnee','abandonnees'}
def is_participle(T,idx): return 0<=idx<len(T) and deacc(T[idx].lower()) in PART_FORMS
def find_aux(T,idx):
    """Auxiliaire le plus proche à gauche (fenêtre courte) d'un participe → 'etre' | 'avoir' | None."""
    for j in range(idx-1,max(-1,idx-5),-1):
        w=deacc(T[j].lower())
        if w in AUX_ETRE: return 'etre'
        if w in AUX_AVOIR: return 'avoir'
    return None
# Chaîne du GN : GENRE porté par le déterminant genré le plus proche à gauche (classe fermée, fiable sans POS).
GEN_DET={'le':'m','un':'m','ce':'m','cet':'m','mon':'m','ton':'m','son':'m','au':'m','du':'m',
         'la':'f','une':'f','cette':'f','ma':'f','ta':'f','sa':'f'}
def governor_gender(T,idx):
    """Genre du GN via le déterminant GENRÉ le plus proche à gauche (le/la/un/une…) → (mot, 'm'|'f').
    None si non marqué (les/des/mes…) ou si on quitte le GN (pronom sujet) : « une robe vert » → fém."""
    for j in range(idx-1,-1,-1):
        w=T[j].lower()
        if w in GEN_DET: return (T[j],GEN_DET[w])
        if w in NUM_DET or w in NUM_PRON: return None     # plur. non genré / pronom → genre non porté
    return None
def find_cod_antepose(T,idx):
    """Règle de l'accord du participe avec AVOIR : il s'accorde avec le COD s'il est ANTÉPOSÉ.
    Cas régulier = relatif « que/qu' » à gauche → l'antécédent (GN avant le relatif) est le COD.
    Renvoie (antécédent, genre|None, nombre|None) si un relatif gouverne, sinon None (→ invariable).
    « la pomme qu'il a cueillie » : COD = « la pomme » (fém. sg) → accord ; « il a cueilli des pommes » : COD après → invariable."""
    for j in range(idx-1,max(-1,idx-6),-1):
        w=T[j].lower()
        if w=='que' or w.startswith("qu'"):
            if j==0: return None
            gg=governor_gender(T,j); gn=governor_number(T,j)   # genre/nombre de l'antécédent (GN avant le relatif)
            return (T[j-1], gg[1] if gg else None, gn[1] if gn else None)
    return None
def deacc(s): return ''.join(c for c in unicodedata.normalize('NFD',s) if unicodedata.category(c)!='Mn')
def norm(w):
    """graphème → pseudo-son (approx) : 2 graphies qui normalisent pareil = soundalike (surface)."""
    w=w.lower()
    w=w.replace('ph','f').replace('th','t')
    w=re.sub(r'qu|q','k',w); w=w.replace('ç','s')
    w=re.sub(r'c([eiyéèê])',r's\1',w); w=w.replace('c','k')
    w=re.sub(r'gu([eiéè])',r'g\1',w); w=re.sub(r'g([eiyéè])',r'j\1',w)
    w=w.replace('eaux','o').replace('eau','o').replace('aux','o').replace('au','o')
    w=re.sub(r'ai|ei|ais|ait|aient','e',w); w=w.replace('y','i')
    w=re.sub(r'([aeiouéèêàâô])s([aeiouéèêàâô])',r'\1z\2',w)
    w=w.replace('h',''); w=deacc(w)
    w=re.sub(r'(.)\1',r'\1',w); w=re.sub(r'(ent|s|t|d|x|p|e)$','',w); w=re.sub(r'(.)\1',r'\1',w)
    return w
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

def accord_type(t,s,verb=False):
    """Type d'accord. Avec POS-contexte (`verb`) : verbal prime (désambigue genre -e vs verbal -e).
    Sinon par le suffixe : nombre (-s/-x) · genre (-e). nt/-t résiduel → verbal."""
    if verb: return 'verbal'
    a,b=deacc(t.lower()),deacc(s.lower()); p=0
    while p<len(a) and p<len(b) and a[p]==b[p]: p+=1
    suf=a[p:]+b[p:]
    if 's' in suf or 'x' in suf: return 'nombre'                 # pluriel -s/-x
    if suf.endswith('nt') or 't' in suf: return 'verbal'        # -ent/-nt/-t sans POS (rare hors verbe)
    if 'e' in suf: return 'genre'                                # féminin -e
    return 'flexion'

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
    if not out: out.append('surface' if norm(t)==norm(s) else 'autre')
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
    T,S=toks(cible),toks(eleve); facts=[]; ti=-1
    for op,t,s in align(T,S):
        if op=='ins':
            facts.append({'mot':s,'types':['mot_en_trop'],'msg':f'Mot en trop : « {s} ».'}); continue
        ti+=1                                                   # match/sub/del avancent dans la cible
        if op=='match': continue
        if op=='del':
            facts.append({'mot':t,'types':['omission'],'msg':f'Mot oublié : « {t} ».'}); continue
        types=diag_word(t,s,fam.get(t.lower(),[]))
        fact={'mot':t,'tentative':s,'types':types,'msg':f'« {s} » → « {t} » : {",".join(types)}'}
        if 'accord' in types:                                  # LEVIER GRAMMAIRE (POS-contexte)
            if is_participle(T,ti):                            # (1) PARTICIPE PASSÉ
                aux=find_aux(T,ti); fact['accord_type']='participe'
                if aux=='etre':
                    gov=governor_number(T,ti,skip_pp=True)     # (2) accord avec le SUJET (à distance)
                    fact['grammaire']='participe passé (être)'
                    if gov: fact['gouverneur'],fact['gouv_nombre']=gov[0],gov[1]; fact['msg']+=f' (participe passé avec être : accord avec le sujet « {gov[0]} » {gov[1]})'
                    else:   fact['msg']+=' (participe passé avec être : accord avec le sujet)'
                elif aux=='avoir':
                    fact['grammaire']='participe passé (avoir)'
                    cod=find_cod_antepose(T,ti)               # COD antéposé (relatif « que ») → accord ; sinon invariable
                    if cod:
                        if cod[1]: fact['gouv_genre']=cod[1]
                        if cod[2]: fact['gouv_nombre']=cod[2]
                        fact['cod_antepose']=cod[0]
                        marq=[m for m in (('féminin' if cod[1]=='f' else 'masculin') if cod[1] else None,
                                          ('pluriel' if cod[2]=='pl' else 'singulier') if cod[2] else None) if m]
                        det=(' '+' '.join(marq)) if marq else ''
                        fact['msg']+=f' (participe passé avec avoir : COD antéposé « {cod[0]} »{det} → accorder « {t} »)'
                    else:
                        fact['msg']+=' (participe passé avec avoir : invariable, COD placé après)'
                else:
                    fact['grammaire']='participe passé'; fact['msg']+=' (participe passé)'
            else:
                verb=is_verb(T,ti)                             # nom/verbe désambiguïsé par le contexte
                at=accord_type(t,s,verb); fact['accord_type']=at
                if at=='genre' and not verb:                  # chaîne du GN : ACCORD EN GENRE (« une robe vert »)
                    gg=governor_gender(T,ti)
                    if gg:
                        gl='féminin' if gg[1]=='f' else 'masculin'
                        fact['gouverneur'],fact['gouv_genre'],fact['grammaire']=gg[0],gg[1],'groupe nominal (genre)'
                        fact['msg']+=f' (accord en genre : « {gg[0]} » {gl} → accorder « {t} »)'
                    else:
                        fact['grammaire']='groupe nominal (genre)'; fact['msg']+=' (accord en genre)'
                else:
                    gov=governor_number(T,ti,skip_pp=verb)     # (2) verbe → vrai sujet (saute les PP)
                    if gov:
                        rel='sujet-verbe' if verb else 'groupe nominal'
                        fact['gouverneur'],fact['gouv_nombre'],fact['grammaire']=gov[0],gov[1],rel
                        fact['msg']+=f' (accord {rel} : « {gov[0]} » {gov[1]} → accorder « {t} »)'
                    else:
                        fact['msg']+=f' (accord: {at})'
        facts.append(fact)
    return facts

# === Diagnostic DÉVELOPPEMENTAL (stades) — additif, réutilise diag_word ===
# Fondé sur Ferreiro (genèse de l'écriture) via Berliocchi (2022) + typologie dysorthographique
# (phonologique / lexicale-surface / morphosyntaxique). Chaque famille révèle le PALIER non maîtrisé.
STAGE_OF = {
    'phonologique':    ['voisee_sourde','inversion','ajout'], # le SON mal perçu/segmenté (conscience phonémique)
    'alphabetique':    ['surface','accent'],                  # écrit "comme ça sonne", pas l'ortho conventionnelle
    'lexical':         ['muette','homophone'],                # orthographe du MOT : lettres muettes lexicales, homophone lexical
    'morphosyntaxique':['accord'],                            # GRAMMAIRE : accords (genre/nombre/verbal), sans indice sonore — apex
}
STAGE_ORDER = ['phonologique','alphabetique','lexical','morphosyntaxique']  # du plus amont au plus avancé
FAM2STAGE = {f:st for st,fs in STAGE_OF.items() for f in fs}
STAGE_MSG = {
    'phonologique':    "travaille le SON (conscience phonémique) : confusions sourde/sonore, inversions, lettres en trop.",
    'alphabetique':    "écrit « comme ça sonne » : il faut passer du son à l'orthographe conventionnelle (accents, graphies).",
    'lexical':         "maîtrise le son→lettre ; reste l'orthographe du MOT : lettres muettes, homophones lexicaux.",
    'morphosyntaxique':"orthographe lexicale OK ; reste la GRAMMAIRE : accords en genre/nombre/verbal (le palier le plus tardif).",
}

def stage_of_fact(types):
    """Stade d'UNE erreur (mot). diag_word est multi-étiquette : une erreur spécifique (homophone, accord…)
    co-déclenche souvent un détecteur STRUCTUREL de longueur (ajout/muette). Le stade le plus AVANCÉ
    l'emporte → la famille spécifique prime sur le détecteur structurel incident."""
    sts=[FAM2STAGE[t] for t in types if t in FAM2STAGE]
    return max(sts, key=lambda s: STAGE_ORDER.index(s)) if sts else None

def developmental_diagnosis(all_facts):
    """all_facts = facts (sortie de diagnose_sentence) agrégés sur une dictée/session.
    Stade de l'élève = bande la plus EN AMONT où il bute encore (on maîtrise de bas en haut) ;
    chaque erreur est d'abord rangée dans UN stade (le plus avancé de ses types) pour ne pas
    sur-compter les co-tags structurels. 'autre'/omission/mot_en_trop = hors-stades (attention/lexique)."""
    counts={st:0 for st in STAGE_ORDER}; off=0
    for f in all_facts:
        st=stage_of_fact(f.get('types',[]))
        if st: counts[st]+=1
        elif any(t in ('autre','omission','mot_en_trop') for t in f.get('types',[])): off+=1
    if sum(counts.values())==0:
        return {'stade':None,'counts':counts,'hors_stade':off,'msg':"Pas d'erreur graduable — niveau orthographique consolidé."}
    stade=next(st for st in STAGE_ORDER if counts[st]>0)   # bande la plus en amont avec ≥1 erreur
    return {'stade':stade,'counts':counts,'hors_stade':off,'msg':"Stade : "+stade+" — "+STAGE_MSG[stade]}

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
        # surface : muter un mot en une graphie qui SONNE pareil (ç->s, eau->o, ph->f, qu->k, c->k...)
        SUB=[('ç','s'),('eau','o'),('ph','f'),('qu','k'),('ai','è'),('au','o')]
        done=False
        for i,w in enumerate(T):
            for a,b in SUB:
                if a in w.lower():
                    w2=w.lower().replace(a,b,1)
                    if w2!=w.lower() and norm(w2)==norm(w):
                        S=T[:i]+[w2]+T[i+1:]; f=diagnose_sentence(e['text'],' '.join(S),fam)
                        rec('surface', any('surface' in x['types'] for x in f)); done=True; break
            if done: break
    print('=== rappel par famille (dictée de phrases, 30 phrases) ===')
    for k in sorted(tot): print(f'  {k:11} {ok[k]}/{tot[k]}  = {ok[k]/tot[k]*100:.0f}%')

    # === mesure STADE développemental : un élève "pur" par stade est-il bien placé ? ===
    def first_vs_swap(T,fam):
        for i,w in enumerate(T):
            for j,ch in enumerate(w.lower()):
                if ch in VS: return T[:i]+[w[:j]+VS[ch]+w[j+1:]]+T[i+1:]
        return None
    def first_surface(T,fam):
        for i,w in enumerate(T):
            for a,b in [('ç','s'),('eau','o'),('ph','f'),('qu','k'),('au','o')]:
                if a in w.lower():
                    w2=w.lower().replace(a,b,1)
                    if w2!=w.lower() and norm(w2)==norm(w): return T[:i]+[w2]+T[i+1:]
        return None
    def first_lexical(T,fam):   # homophone LEXICAL (non flexionnel)
        for i,w in enumerate(T):
            for h in fam.get(w.lower(),[]):
                if h.lower()!=w.lower() and not is_accord(w,h) and deacc(h)!=deacc(w.lower()): return T[:i]+[h]+T[i+1:]
        return None
    def first_morpho(T,fam):    # accord (flexionnel) = grammaire
        for i,w in enumerate(T):
            for h in fam.get(w.lower(),[]):
                if h.lower()!=w.lower() and is_accord(w,h): return T[:i]+[h]+T[i+1:]
        return None
    builders={'phonologique':first_vs_swap,'alphabetique':first_surface,'lexical':first_lexical,'morphosyntaxique':first_morpho}
    print('=== diagnostic par STADE (élève "pur" par stade) ===')
    for exp,build in builders.items():
        facts_all=[]
        for e in SENT:
            T=toks(e['text']); S=build(T,e['fam'])
            if S: facts_all+=[f for f in diagnose_sentence(e['text'],' '.join(S),e['fam']) if f.get('types')]
        dx=developmental_diagnosis(facts_all)
        flag='OK' if dx['stade']==exp else 'X'
        extra=''
        if exp=='morphosyntaxique':   # graine grammaire : répartition des types d'accord
            at={}; [at.__setitem__(f['accord_type'],at.get(f['accord_type'],0)+1) for f in facts_all if f.get('accord_type')]
            extra=f"  · types d'accord : {at}"
        print(f"  élève '{exp:16}' (n={sum(dx['counts'].values())}) → « {dx['stade']} »  {flag}{extra}")

    # === levier GRAMMAIRE : sur une erreur d'accord, remonte-t-on au sujet/gouverneur ? accord sujet-verbe ? ===
    gv_tot=gv_ok=sv_tot=sv_ok=0
    for e in SENT:
        T=toks(e['text']); fam=e['fam']
        for i,w in enumerate(T):
            for h in fam.get(w.lower(),[]):
                if h.lower()!=w.lower() and is_accord(w,h):
                    f=diagnose_sentence(e['text'],' '.join(T[:i]+[h]+T[i+1:]),fam)
                    fa=next((x for x in f if x.get('mot')==w and 'accord' in x.get('types',[])),None)
                    if fa:
                        gv_tot+=1; gv_ok+=1 if fa.get('grammaire') else 0
                        if is_verb(T,i): sv_tot+=1; sv_ok+=1 if fa.get('grammaire')=='sujet-verbe' else 0
                    break
    print('=== levier GRAMMAIRE (accord en CONTEXTE — la dictée de phrases paie) ===')
    print(f"  gouverneur (sujet/GN) identifié sur erreur d'accord : {gv_ok}/{gv_tot} = {100*gv_ok/max(1,gv_tot):.0f}%")
    print(f"  accord SUJET-VERBE détecté (verbe en contexte)      : {sv_ok}/{sv_tot} = {100*sv_ok/max(1,sv_tot):.0f}%")
    # POS-contexte : désambiguïsation nom/verbe des homographes (le piège du français)
    homo=[(0,'lit','nom'),(4,'lit','verbe'),(2,'verre','nom'),(12,'porte','verbe'),(26,'calme','verbe')]
    print('  désambiguïsation homographes nom/verbe :', end=' ')
    for idx,word,exp in homo:
        T=toks(SENT[idx]['text']); pos=[k for k,w in enumerate(T) if w.lower()==word]
        got='verbe' if (pos and is_verb(T,pos[0])) else 'nom'
        print(f"{word}@{idx}={got}{'✓' if got==exp else '✗('+exp+')'}", end='  ')
    print()
    # (1) participe passé détecté ? (sur les participes du corpus à homophone flexionnel)
    pp_tot=pp_ok=0
    for e in SENT:
        T=toks(e['text']); fam=e['fam']
        for i,w in enumerate(T):
            if not is_participle(T,i): continue
            for h in fam.get(w.lower(),[]):
                if h.lower()!=w.lower() and is_accord(w,h):
                    f=diagnose_sentence(e['text'],' '.join(T[:i]+[h]+T[i+1:]),fam)
                    fa=next((x for x in f if x.get('mot')==w),None)
                    if fa: pp_tot+=1; pp_ok+=1 if fa.get('grammaire','').startswith('participe') else 0
                    break
    print(f"  (1) participe passé détecté : {pp_ok}/{pp_tot}")
    # participe avec AVOIR : COD antéposé (relatif « que ») → accord · COD postposé → invariable
    pp_cases=[("La pomme qu'il a cueillie est mûre","cueillie","cueilli",True),   # COD antéposé fém sg → accord
              ("Les fleurs qu'elle a cueillies sont belles","cueillies","cueilli",True),  # COD antéposé pl → accord
              ("Elle a cueilli des pommes rouges","cueilli","cueillie",False)]    # COD postposé → invariable
    print("  participe (avoir) COD antéposé/postposé :")
    for txt,part,bad,anteposed in pp_cases:
        T=toks(txt); i=[k for k,w in enumerate(T) if w.lower()==part.lower()][0]
        f=diagnose_sentence(txt,' '.join(T[:i]+[bad]+T[i+1:]),{part.lower():[bad,part]})
        fa=next((x for x in f if x.get('mot')==part),None)
        got=bool(fa and fa.get('cod_antepose')); flag='✓' if got==anteposed else '✗'
        info=(f"COD antéposé « {fa.get('cod_antepose')} » g={fa.get('gouv_genre')} n={fa.get('gouv_nombre')}" if got else "invariable") if fa else "(non diagnostiqué)"
        print(f"    {flag} « {txt} » → {info}")
    # (2) sujet à distance (PP déterminé intercalé) — démo synthétique : le bon NOMBRE n'est trouvé qu'avec skip_pp
    Td=toks("Les vers de la terre creusent")    # sujet pluriel « Les vers », PP « de la terre » (sg) intercalé
    vi=[k for k,w in enumerate(Td) if w.lower()=='creusent'][0]
    g0=governor_number(Td,vi); g1=governor_number(Td,vi,skip_pp=True)
    print(f"  (2) sujet à distance « Les vers de la terre creusent » : sans skip={g0} (faux) · skip_pp={g1} (vrai sujet)")
    # chaîne du GN : sur une erreur d'accord en GENRE, le genre n'existe QUE si un déterminant genré gouverne.
    # On mesure donc 2 choses : (a) déterminant genré présent → identifié ; (b) absent (pronom/leur/init) → abstention.
    ge_marked=ge_found=ge_unmarked=0
    for e in SENT:
        T=toks(e['text']); fam=e['fam']
        for i,w in enumerate(T):
            for h in fam.get(w.lower(),[]):
                if h.lower()!=w.lower() and is_accord(w,h):
                    f=diagnose_sentence(e['text'],' '.join(T[:i]+[h]+T[i+1:]),fam)
                    fa=next((x for x in f if x.get('mot')==w and x.get('accord_type')=='genre'),None)
                    if fa:
                        marked=any(T[j].lower() in GEN_DET for j in range(i)) and governor_gender(T,i) is not None
                        if marked: ge_marked+=1; ge_found+=1 if fa.get('gouv_genre') else 0
                        else: ge_unmarked+=1
                    break
    print(f"  chaîne du GN — accord en GENRE : déterminant genré présent → identifié {ge_found}/{ge_marked} ; "
          f"non marqué (pronom/leur/init) → abstention {ge_unmarked}/{ge_unmarked}")
    Tg=toks("Elle porte une robe verte")        # « une robe vert » : genre du GN porté par « une » (pas par « Elle »)
    ai=[k for k,w in enumerate(Tg) if w.lower()=='verte'][0]
    print(f"  chaîne du GN « une robe vert(e) » : gouverneur genre = {governor_gender(Tg,ai)} (skippe le pronom « Elle »)")

    # démo (par mot + STADE)
    print('\n--- démo ---')
    e=SENT[10]  # "Les élèves répètent la leçon difficile."
    for bad in ["Les élève répète la leçon difficile.", "Les éleves répètent la leson difficile."]:
        print(f'cible : {e["text"]}'); print(f'élève : {bad}')
        facts=diagnose_sentence(e['text'],bad,e['fam'])
        for x in facts: print('   -',x['msg'])
        print('   ⇒',developmental_diagnosis(facts)['msg'])
        print()
