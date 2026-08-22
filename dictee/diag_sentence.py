# -*- coding: utf-8 -*-
# Diagnostic de DICTÉE DE PHRASES : aligne mots cible vs élève, diagnostique chaque mot.
# Le contexte est encodé dans la phrase cible -> homophones et ACCORDS deviennent gradables (sans M3_d).
import json, re, unicodedata, os, random, sys
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
        if w.startswith("l'") and len(w)>2: return (T[j],'s')   # déterminant ÉLIDÉ : « l'automne » = le/la SINGULIER — sinon le scan traversait le GN élidé et enseignait le « les » d'une AUTRE proposition (« Quand les feuilles tombent, l'automne est arrivé » → les !) — audit 07/2026. (PAS « d' » : « d'énormes vagues » = des, pluriel.)
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
    known = w in VERB_FORMS
    if not known and w not in NOTVERB and len(w)>3 and any(w.endswith(s) for s in VERB_SUF):
        if w.endswith('ons'):                             # -ons = TRÈS ambigu (maisons, raisons, saisons, garçons…) :
            known = idx==0 or any(deacc(T[j].lower())=='nous' for j in range(max(0,idx-3),idx))   # verbe seulement si « nous » proche (ou impératif en tête) — audit 07/2026 (« maisons » expliqué accord sujet-verbe)
        else:
            known = True
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
# ROUTE LEXICALE du genre (double voie §lexicale) : genre du NOM-tête via Lexique4 (cgram_gender.json),
# quand le déterminant ne marque pas le genre (les/des/absent). Chargé si présent, sinon inerte (repli déterminant).
_GENDER_PATH=os.path.join(HERE,'cgram_gender.json')
try: GENDER_LEX=json.load(open(_GENDER_PATH,encoding='utf-8')) if os.path.exists(_GENDER_PATH) else {}
except Exception: GENDER_LEX={}
def lexical_gender(T,idx):
    """Genre du nom-tête du GN lu dans le lexique (route lexicale) : nom le plus proche à gauche (adjectif postposé,
    « robes vertes ») puis à droite (antéposé, « belles robes »), sans franchir préposition/pronom. None si absent/ambigu."""
    if not GENDER_LEX: return None
    for j in range(idx-1,max(-1,idx-4),-1):
        w=T[j].lower()
        if w in NUM_PRON or deacc(w) in PREP: break
        g=GENDER_LEX.get(deacc(w))
        if g in ('m','f'): return (T[j],g)
    for j in range(idx+1,min(len(T),idx+3)):
        w=T[j].lower()
        if w in NUM_PRON or deacc(w) in PREP: break
        g=GENDER_LEX.get(deacc(w))
        if g in ('m','f'): return (T[j],g)
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
def toks(s): return [w.replace('’',"'").replace('ʼ',"'") for w in re.findall(r"[A-Za-zÀ-ÿœŒ'’ʼ]+", s)]   # inclut œ/Œ (hors plage À-ÿ) — sinon « œuf »/« sœur » se cassent
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

# Homophones GRAMMATICAUX (mots-outils dont la confusion se tranche par la FONCTION : verbe/préposition/déterminant…)
# vs homophones LEXICAUX (ver/vert/verre : choix par le SENS). Set = formes DÉACCENTUÉES ; règle = grammatical si l'un OU
# l'autre des deux mots de la paire est un mot-outil (reconnaître le mot grammatical = la compétence morphosyntaxique).
_GRAM_HOMO = {
    'a','as','et','est','es','ai','ais','ait','son','sont','sons','on','ont','ce','se','ces','ses','sais','sait',
    'ou','la','las','les','lez','leur','leurs','mais','mes','met','mets','mai','maie','mon','mont','monts','ma','ta',
    'sa','ca','quel','quelle','quels','quelles','peu','peut','peux','si','ci','dont','donc','ni','dans','sans','quand',
    'quant','pres','pret','prets','du','dus','dut','due','dues','des','plus','au','aux','tout','tous','sur',
}
def _homo_gram(t,s):
    return deacc(t.lower()) in _GRAM_HOMO or deacc(s.lower()) in _GRAM_HOMO

_LIAISON_LIC = {'z': 'sxz', 't': 'dt', 'n': 'n', 'r': 'r', 'p': 'p'}   # consonne de liaison AUDIBLE -> finales du mot précédent qui la licencient (s/x/z->z, d/t->t...)
_LIAISON_VOW = set('aeiouyh')
def is_liaison(prev, t, s):
    """Faute de LIAISON : la consonne de liaison audible est écrite en tête du mot suivant
    (les amis->les zamis, petit ami->petit tami, nous avons->nous zavons). `prev` = mot CIBLE
    précédent (sa finale muette licencie la liaison). Réf de dictée connue -> 0 FP.
    MIROIR app isLiaison."""
    if not prev: return False
    dt, ds = deacc(t.lower()), deacc(s.lower())
    if len(ds) != len(dt) + 1 or ds[1:] != dt or not dt or dt[0] not in _LIAISON_VOW: return False
    pd = deacc(prev.lower())
    return ds[0] in _LIAISON_LIC and bool(pd) and pd[-1] in _LIAISON_LIC[ds[0]]

def diag_word(t,s,fam):
    """t=cible, s=élève (mots). fam=liste homophones de t. -> liste de types."""
    if s.lower()==t.lower(): return []
    dt,ds=deacc(t.lower()),deacc(s.lower()); out=[]
    if dt==ds and s.lower()!=t.lower(): out.append('accent')
    _seg=(re.sub(r"['’ \-]",'',dt)==re.sub(r"['’ \-]",'',ds)) and dt!=ds   # diffère SEULEMENT par apostrophe/espace/trait d'union = SEGMENTATION (l'hôpital↔lhopital, du coup↔ducoup) — MIROIR app diagWord l.22372, Bodard §18.5
    if _seg: out.append('segmentation')
    if len(s)==len(t):
        d=[i for i in range(len(t)) if t[i].lower()!=s[i].lower()]
        if len(d)==1:
            a,b=t[d[0]].lower(),s[d[0]].lower()
            if VS.get(a)==b: out.append('voisee_sourde')
    if len(dt)==len(ds) and dt!=ds and sorted(dt)==sorted(ds): out.append('inversion')
    if not _seg and len(ds)<len(dt) and subseq(ds,dt): out.append('muette')   # !_seg : une apostrophe retirée n'est PAS une lettre muette (miroir app)
    if not _seg and len(ds)>len(dt) and subseq(dt,ds): out.append('ajout')
    if s.lower() in (x.lower() for x in fam):
        out.append('accord' if is_accord(t,s) else ('homophone_gram' if _homo_gram(t,s) else 'homophone_lex'))   # grammatical (a/à, son/sont → morphosyntaxique) vs lexical (ver/vert → lexical)
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

def paire_nombre_verbale(t,s):
    """Paire cible/élève qui ne diffère que par la MARQUE DE NOMBRE d'un verbe → ('accord', inaudible).
    Inaudible : -e/-ent (mange/mangent), -t/-ent à radical vocalique ou en -r (voit/voient, court/courent).
    Audible : vend/vendent, finit/finissent (la consonne se prononce). Idée : Excuse My French
    (silentNumberPair, 2026-08-21) — réimplémentée, pas copiée. Miroir app (paireNombreVerbale)."""
    a,b=deacc(t.lower()),deacc(s.lower())
    if a==b or not a or not b: return None
    pl,sg=(a,b) if len(a)>len(b) else (b,a)
    if not pl.endswith('ent') or len(pl)<5: return None
    stem=pl[:-3]
    if sg==stem+'e': return ('accord',True)
    if sg==stem+'t' and stem and (stem[-1] in 'aeiouy' or stem[-1]=='r'): return ('accord',True)
    if sg==stem: return ('accord',False)                    # vend/vendent, perd/perdent, répond/répondent : la consonne se prononce au pluriel
    if pl.endswith('ssent') and sg==pl[:-5]+'t': return ('accord',False)
    return None

def diagnose_sentence(cible, eleve, fam):
    T,S=toks(cible),toks(eleve); facts=[]; ti=-1
    for op,t,s in align(T,S):
        if op=='ins':
            facts.append({'mot':s,'types':['mot_en_trop'],'msg':f'Mot en trop : « {s} ».'}); continue
        ti+=1                                                   # match/sub/del avancent dans la cible
        if op=='match':
            if t!=s:                                            # même mot à la CASSE près (align insensible à la casse) → faute de casse (réf connue → 0 FP)
                manque=t[:1].isupper() and s[:1].islower()
                facts.append({'mot':t,'tentative':s,'types':['majuscule'],
                              'msg':(f'« {s} » → « {t} » : il manque la majuscule.' if manque else f'« {s} » → « {t} » : pas de majuscule ici.')})
            continue
        if op=='del':
            facts.append({'mot':t,'types':['omission'],'msg':f'Mot oublié : « {t} ».'}); continue
        types=diag_word(t,s,fam.get(t.lower(),[]))
        if ti>=1 and is_liaison(T[ti-1],t,s): types=['liaison']   # consonne de liaison mal placée (les amis -> les zamis) : prime sur 'ajout'
        _muet=False
        _pnv=paire_nombre_verbale(t,s) if 'accord' not in types else None
        if _pnv:                                                  # croisement Excuse My French : « ils mange » pour « ils mangent » HORS famille curée
            _gv=governor_number(T,ti,skip_pp=True)                #  → c'est un ACCORD (morphosyntaxique), pas une « lettre muette » lexicale
            _want='pl' if len(deacc(t))>len(deacc(s)) else 'sg'      # NUM_PRON/NUM_DET valent 'pl'/'sg'
            if _gv and _gv[1]==_want:
                types=[x for x in types if x not in ('muette','ajout')]+['accord']
                _nx=T[ti+1] if ti+1<len(T) else ''
                _muet=_pnv[1] and not (_nx[:1].lower() in 'aeiouyhàâéèêëîïôöùûü')   # liaison possible → la marque peut s'entendre
        fact={'mot':t,'tentative':s,'types':types,'msg':f'« {s} » → « {t} » : {",".join(types)}'}
        if _muet: fact['audible']=False; fact['msg']+=' (marque MUETTE : ça ne s\'entend pas, c\'est l\'accord qui le dit)'
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
                verb=is_verb(T,ti) or (_pnv is not None)       # nom/verbe désambiguïsé par le contexte (ou paire de nombre VERBALE détectée)
                at=accord_type(t,s,verb); fact['accord_type']=at
                if at=='genre' and not verb:                  # chaîne du GN : ACCORD EN GENRE (« une robe vert »)
                    gg=governor_gender(T,ti) or lexical_gender(T,ti)   # déterminant genré, sinon route lexicale (nom-tête)
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
    'alphabetique':    ['surface','accent','segmentation','liaison'],   # écrit "comme ça sonne" / mauvais découpage : graphies, accents, apostrophe (l'ami), liaison (les zamis)
    'lexical':         ['muette','homophone_lex','homophone'],# orthographe du MOT : lettres muettes, homophone LEXICAL (ver/vert) ; 'homophone' nu = repli lexical
    'morphosyntaxique':['accord','homophone_gram'],           # GRAMMAIRE : accords ET homophones GRAMMATICAUX (a/à, son/sont) — apex, sans indice sonore
}
STAGE_ORDER = ['phonologique','alphabetique','lexical','morphosyntaxique']  # du plus amont au plus avancé
FAM2STAGE = {f:st for st,fs in STAGE_OF.items() for f in fs}
STAGE_MSG = {
    'phonologique':    "travaille le SON (conscience phonémique) : confusions sourde/sonore, inversions, lettres en trop.",
    'alphabetique':    "écrit « comme ça sonne » : il faut passer du son à l'orthographe conventionnelle (accents, graphies).",
    'lexical':         "maîtrise le son→lettre ; reste l'orthographe du MOT : lettres muettes, homophones LEXICAUX (ver/vert/verre).",
    'morphosyntaxique':"orthographe lexicale OK ; reste la GRAMMAIRE : accords en genre/nombre/verbal ET homophones grammaticaux (a/à, son/sont) — le palier le plus tardif.",
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

# Générateurs de corruption RÉUTILISÉS par le self-test ET par le dump de parité (--dump-cas,
# consommé par dictee/parity_diag.js) — un seul endroit qui sait fabriquer un cas par famille,
# doctrine §5 A2 (ce qui existe se réutilise, ne pas réinventer un 2e générateur ailleurs).
def cas_accent(T, fam):
    for i, w in enumerate(T):
        if any(c in 'éèê' for c in w):
            w2 = w.replace('é','è',1) if 'é' in w else w.replace('è','é',1) if 'è' in w else w.replace('ê','e',1)
            if w2 != w: return T[:i]+[w2]+T[i+1:]
    return None
def cas_accord(T, fam):
    for w in T:
        for h in fam.get(w.lower(), []):
            if is_accord(w, h): return [h if t == w else t for t in T]
    return None
def cas_homophone(T, fam):
    for w in T:
        for h in fam.get(w.lower(), []):
            if not is_accord(w, h) and deacc(h) != deacc(w.lower()): return [h if t == w else t for t in T]
    return None
def cas_omission(T, fam):
    if len(T) > 3:
        i = len(T)//2
        return T[:i]+T[i+1:]
    return None
def cas_surface(T, fam):
    SUB=[('ç','s'),('eau','o'),('ph','f'),('qu','k'),('ai','è'),('au','o')]
    for i, w in enumerate(T):
        for a, b in SUB:
            if a in w.lower():
                w2 = w.lower().replace(a, b, 1)
                if w2 != w.lower() and norm(w2) == norm(w): return T[:i]+[w2]+T[i+1:]
    return None
CAS_GENERATEURS = [('accent', cas_accent), ('accord', cas_accord), ('homophone', cas_homophone),
                    ('omission', cas_omission), ('surface', cas_surface)]

if len(sys.argv) > 1 and sys.argv[1] == '--dump-cas':
    # Dump JSON des cas générés + diagnostic Python, pour la parité Python↔JS (parity_diag.js).
    SENT = json.load(open(os.path.join(HERE, 'sentences.json'), encoding='utf-8'))
    out = []
    for e in SENT:
        T = toks(e['text']); fam = e['fam']
        for nom, gen in CAS_GENERATEURS:
            S = gen(T, fam)
            if S is None: continue
            eleve = ' '.join(S)
            f = diagnose_sentence(e['text'], eleve, fam)
            types = sorted(set(ty for x in f for ty in x['types']))
            out.append({'cible': e['text'], 'eleve': eleve, 'fam': fam, 'famille_visee': nom, 'types': types})
    print(json.dumps(out, ensure_ascii=False))
    sys.exit(0)

if __name__=='__main__':
    SENT=json.load(open(os.path.join(HERE,'sentences.json'),encoding='utf-8'))
    def lc_fam(e): return {k:v for k,v in e['fam'].items()}
    # synthèse d'erreurs par famille -> on vérifie la détection
    tot={}; ok={}
    def rec(fam_name, good): tot[fam_name]=tot.get(fam_name,0)+1; ok[fam_name]=ok.get(fam_name,0)+(1 if good else 0)
    import copy
    for e in SENT:
        T=toks(e['text']); fam=e['fam']
        S=cas_accent(T,fam)
        if S is not None:
            f=diagnose_sentence(e['text'],' '.join(S),fam); rec('accent', any('accent' in x['types'] for x in f))
        S=cas_accord(T,fam)
        if S is not None:
            f=diagnose_sentence(e['text'],' '.join(S),fam); rec('accord', any('accord' in x['types'] for x in f))
        S=cas_homophone(T,fam)
        if S is not None:
            f=diagnose_sentence(e['text'],' '.join(S),fam)
            rec('homophone', any(ty.startswith('homophone') for x in f for ty in x['types']))
        S=cas_omission(T,fam)
        if S is not None:
            f=diagnose_sentence(e['text'],' '.join(S),fam); rec('omission', any('omission' in x['types'] for x in f))
        S=cas_surface(T,fam)
        if S is not None:
            f=diagnose_sentence(e['text'],' '.join(S),fam); rec('surface', any('surface' in x['types'] for x in f))
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
    def first_lexical(T,fam):   # homophone LEXICAL (non flexionnel ET non grammatical : ver/vert, pas son/sont)
        for i,w in enumerate(T):
            for h in fam.get(w.lower(),[]):
                if h.lower()!=w.lower() and not is_accord(w,h) and deacc(h)!=deacc(w.lower()) and not _homo_gram(w,h): return T[:i]+[h]+T[i+1:]
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
    # === ROUTE LEXICALE du genre : décider le genre quand le DÉTERMINANT ne le marque pas (leur/notre/des…) ===
    print(f"  route lexicale du genre : lexique = {('chargé, '+str(len(GENDER_LEX))+' noms') if GENDER_LEX else 'ABSENT (cgram_gender.json — repli déterminant seul)'}")
    lex_cases=[("Leur grande maison brûle","grande","grand","f"),     # « leur » neutre → genre via le nom « maison » (f)
               ("Notre petite voiture roule","petite","petit","f"),
               ("Leur chien noir dort","noir","noire","m")]
    for txt,adj,bad,exp in lex_cases:
        T=toks(txt); i=[k for k,w in enumerate(T) if w.lower()==adj.lower()][0]
        det=governor_gender(T,i); lex=lexical_gender(T,i)            # déterminant seul (None) vs route lexicale
        f=diagnose_sentence(txt,' '.join(T[:i]+[bad]+T[i+1:]),{adj.lower():[bad,adj]})
        fa=next((x for x in f if x.get('mot')==adj),None)
        got=fa.get('gouv_genre') if fa else None
        flag=('· lexique absent' if not GENDER_LEX else ('✓' if got==exp else '✗'))
        print(f"    {flag} « {txt} » : déterminant seul={det} → abstention · lexique={lex} → genre décidé={got}")

    # démo (par mot + STADE)
    print('\n--- démo ---')
    e=SENT[10]  # "Les élèves répètent la leçon difficile."
    for bad in ["Les élève répète la leçon difficile.", "Les éleves répètent la leson difficile."]:
        print(f'cible : {e["text"]}'); print(f'élève : {bad}')
        facts=diagnose_sentence(e['text'],bad,e['fam'])
        for x in facts: print('   -',x['msg'])
        print('   ⇒',developmental_diagnosis(facts)['msg'])
        print()
