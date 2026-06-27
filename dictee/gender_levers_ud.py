# gender_levers_ud.py — TESTE 2 leviers d'accord en genre sur UD réel (genre+POS gold), parité correcteur Python.
#  (1) DÉTERMINANT : récupérer du recall en relâchant la garde verbe-homographe (un mot après un déterminant à fort
#      P(NOUN) est un NOM même s'il est aussi un verbe). On garde P(NOUN)≥τ → mesure si le FP reste ~0.
#  (2) ADJECTIF : portée SERRÉE (nom-tête IMMÉDIAT + pur + genre connu + déterminant qui CORROBORE le genre).
#      Mesure si ce périmètre étroit fait tomber le FP à ~0 (vs 3,37/1000 de la règle large) — et son recall.
# Corpus UD hors-repo (data_local/). Réutilise les internes de correcteur_probe (mêmes données que l'app).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import correcteur_probe as cp
da = cp.deacc
UD = os.path.join(HERE, '..', 'data_local', 'ud_fr_gsd-train.conllu')
if not os.path.exists(UD): print("UD absent (data_local/) — cf. evo/evo_o2_homophone_context.js"); sys.exit(2)

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

# (1) déterminant relâché : copie de rule_det_gender SANS la garde verbe (garde P(NOUN)≥τ)
def det_relaxed(T, i):
    lw = da(T[i].lower())
    if lw not in cp.DET_GENDER or "'" in T[i].lower(): return None
    if i+1>=len(T): return None
    nxt_raw=T[i+1].lower()
    if "'" in nxt_raw: return None
    nd=da(nxt_raw)
    if len(nd)<2 or not nd.isalpha(): return None
    if lw in ('son','mon','ton') and nd[:1] in 'aeiouyh': return None
    if T[i+1][:1].isupper() or nd in cp.DET_SKIP: return None
    _pp=cp.NOUN_POST.get(nd)
    if not (_pp and _pp[0]>=cp.PL_TAU_M): return None        # RELAXÉ : on DROPPE la garde P(VERB)<eps
    g_noun=cp.GENDER_PURE.get(nd)
    if g_noun not in ('m','f') or g_noun==cp.DET_GENDER[lw]: return None
    sugg=cp.DET_ALT.get((lw,g_noun))
    return cp._keepcase(T[i],sugg) if sugg else None

# (2) adjectif portée serrée
def adj_tight(T, i):
    if not cp._pure_adj(T[i]): return None
    g_adj, alt = cp.ADJ_LEX[da(T[i].lower())]
    for j in (i-1, i+1):                                       # nom-tête IMMÉDIAT
        if not (0<=j<len(T)): continue
        nd=da(T[j].lower())
        g=cp.GENDER_PURE.get(nd)
        if g in ('m','f') and nd not in cp.ADJ_LEX and nd not in cp.VERB_LEX:
            corro=False                                       # un déterminant de MÊME genre dans les 2 positions avant le nom
            for k in (j-1, j-2):
                if 0<=k<len(T):
                    dl=da(T[k].lower())
                    if dl in cp.DET_GENDER and cp.DET_GENDER[dl]==g: corro=True; break
            if not corro: return None
            return alt if g!=g_adj else None
    return None

# ---- FP des variantes sur du FR CORRECT ----
det0=det1=adj_t=nw=0
for s in sents:
    T=[t[0] for t in s]; nw+=len(T)
    for i in range(len(T)):
        a=cp.rule_det_gender(T,i)
        if a is not None and a.lower()!=T[i].lower(): det0+=1
        b=det_relaxed(T,i)
        if b is not None and b.lower()!=T[i].lower(): det1+=1
        c=adj_tight(T,i)
        if c is not None and c.lower()!=T[i].lower(): adj_t+=1

# ---- RECALL déterminant (orig vs relâché), injection un↔une ----
SWAP={'un':'une','une':'un','le':'la','la':'le','ce':'cette','cette':'ce','mon':'ma','ma':'mon','ton':'ta','ta':'ton','son':'sa','sa':'son'}
kc=lambda src,t: t.capitalize() if src[:1].isupper() else t
inj=d0=d1=0
for s in sents:
    forms=[t[0] for t in s]; pos=[t[1] for t in s]; gen=[t[2] for t in s]
    for i in range(len(forms)-1):
        low=forms[i].lower()
        if low in ('le','la') and i>0 and forms[i-1].lower() in ('de','à','des'): continue
        if pos[i]=='DET' and low in SWAP and gen[i] in ('Masc','Fem') and pos[i+1]=='NOUN':
            orig=forms[i]; bad=kc(orig,SWAP[low]); corr=forms[:]; corr[i]=bad; inj+=1
            if (cp.rule_det_gender(corr,i) or '').lower()==orig.lower(): d0+=1
            if (det_relaxed(corr,i) or '').lower()==orig.lower(): d1+=1
            break

# ---- RECALL adjectif serré, injection genre adj (forme alt) ----
ainj=ad=0
for s in sents:
    forms=[t[0] for t in s]
    for i in range(len(forms)):
        if not cp._pure_adj(forms[i]): continue
        # n'injecter que là où adj_tight POURRAIT statuer (nom immédiat + corroboration) = périmètre serré
        T=forms
        g_adj,alt=cp.ADJ_LEX[da(forms[i].lower())]
        corr=forms[:]; corr[i]=kc(forms[i],alt)             # forme de genre OPPOSÉ = faute
        if adj_tight(forms,i) is None and adj_tight(corr,i) is not None:  # le bon ne déclenche pas, le fautif oui
            ainj+=1
            if (adj_tight(corr,i) or '').lower()==forms[i].lower(): ad+=1
            break

print(f"corpus UD : {len(sents)} phrases · {nw} tokens (genre/POS gold)\n")
print("=== (2-bis) DÉTERMINANT — récupérer du recall sans casser FP=0 ===")
print(f"  règle ACTUELLE  : FP {det0} ({1000*det0/nw:.2f}/1000) · recall {100*d0/max(inj,1):.1f} %")
print(f"  règle RELÂCHÉE  : FP {det1} ({1000*det1/nw:.2f}/1000) · recall {100*d1/max(inj,1):.1f} %  ({'+' if d1>=d0 else ''}{100*(d1-d0)/max(inj,1):.1f} pts)")
verdict_det = "✅ relâcher PAIE (recall ↑, FP toujours ~0)" if (det1<=det0+max(3,0.0001*nw) and d1>d0) else "⚠️ relâcher coûte des FP — à border"
print(f"  → {verdict_det}\n")
print("=== (1) ADJECTIF — portée serrée : FP→0 possible ? ===")
print(f"  règle LARGE (rule_genre_adj)   : ~3,37 FP/1000 (mesuré précédemment)")
print(f"  portée SERRÉE (adj_tight)      : FP {adj_t} ({1000*adj_t/nw:.2f}/1000) · précision sur son périmètre {100*ad/max(ainj,1):.1f} %")
print(f"     ⚠️ périmètre ÉTROIT : {ainj} cas seulement sur {nw} mots → COUVERTURE faible (les cas faciles det-corroborés).")
verdict_adj = "✅ activable comme SOUS-ENSEMBLE FP-safe (FP ~0, précis), mais étroit ; le large reste = parsing" if 1000*adj_t/nw < 0.3 else "⚠️ FP encore trop haut — resserrer plus"
print(f"  → {verdict_adj}")
