# -*- coding: utf-8 -*-
# PROBE CORRECTEUR — détection ET correction d'homophones grammaticaux SANS corrigé.
# ============================================================================================
# Hypothèse risquée à trancher (cap §1) : le levier d'accord/POS de diag_sentence.py peut-il, SANS
# connaître la phrase cible (≠ dictée), (a) DÉTECTER une faute d'homophone grammatical et (b) proposer
# la CORRECTION ? C'est le cœur d'un correcteur orthographique dys « semi-direct ».
#
# On vise les confusions que le contexte tranche (≠ ces/ses, sémantique) :
#   -é/-er (mangé/manger) · son/sont · on/ont · leur/leurs · a/à · et/est.
# Chaque règle = decide(T,i) -> forme correcte selon le contexte (voisins, POS), ou None (s'abstient).
# Le correcteur FLAGUE si la forme tapée ≠ forme décidée, et PROPOSE la forme décidée.
#
# Mesuré : faux positifs (sur les 30 phrases CORRECTES + cas témoins) · détection (faute injectée flaguée ?)
#          · correction (la proposition est-elle la bonne ?). Réutilise diag_sentence (doctrine §5).
# Lancer : python3 dictee/correcteur_probe.py
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import diag_sentence as D
from diag_sentence import deacc, toks, is_verb, is_participle, governor_number, NUM_DET, PREP

SENT = json.load(open(os.path.join(HERE, 'sentences.json'), encoding='utf-8'))

# Verbes/mots-outils suivis d'un INFINITIF (pour -é/-er). PREP (de/à/pour/sans…) vient de diag_sentence.
MODAL = {'veux','veut','veulent','peux','peut','peuvent','dois','doit','doivent','va','vais','vas','vont',
         'faut','sais','sait','aime','aimes','aiment','adore','espere','souhaite','prefere','preferent',
         'vient','viens','allons','allez','laisse','laissent','semble','ose','vais','pour','sans','afin','de'}
AUX = set(D.AUX_ETRE) | set(D.AUX_AVOIR)

# Couverture verbale élargie SANS le lexique 34 Mo : liste BLANCHE de formes fréquentes (exactes → 0 FP par
# sur-généralisation). Stopgap avant Lexique4 cgram (étape 3). Désaccentué, minuscule.
COMMON_VERBS = set("""
suis es est sommes etes sont etais etait etions etiez etaient sera seront fut furent serait soit
ai as a avons avez ont avais avait avaient aura auront aurait eu
vais vas va allons allez vont allais allait ira iront alle aille
fais fait faisons faites font faisait fera fait fasse
dis dit disons dites disent disait dira
peux peut pouvons pouvez peuvent pouvait pourra pu puisse
veux veut voulons voulez veulent voulait voudra voulu veuille
dois doit devons devez doivent devait devra du doive
sais sait savons savez savent savait saura su sache
vois voit voyons voyez voient voyait verra vu voie
viens vient venons venez viennent venait viendra venu vienne
prends prend prenons prenez prennent prenait prendra pris prenne
mets met mettons mettez mettent mettait mettra mis mette
mange mangent mangeons mangez mangeait parle parlent parlez parlait
aime aiment aimez aimait donne donnent donnez trouve trouvent regarde regardent
joue jouent jouez jouait porte portent cherche cherchent pense pensent reste restent
passe passent arrive arrivent entre entrent monte montent tombe tombent tombait
chante chantent court courent boit boivent lit lisent ecrit ecrivent dort dorment
finit finissent etudie etudient quitte quittent calme creuse vend vendent
""".split())


# Étape 3 : si dictee/cgram_verbs.json existe (généré par build_cgram.py depuis Lexique4), on l'utilise
# en PLUS de la liste blanche (couverture verbale complète). Sinon, repli transparent sur la liste blanche.
_CGRAM_PATH = os.path.join(HERE, 'cgram_verbs.json')
VERB_LEX = set(COMMON_VERBS)
CGRAM_LOADED = False
if os.path.exists(_CGRAM_PATH):
    try:
        VERB_LEX |= set(json.load(open(_CGRAM_PATH, encoding='utf-8')))
        CGRAM_LOADED = True
    except Exception:
        pass


def vlike(T, i):
    """Verbe EN CONTEXTE : levier dictée (is_verb) OU lexique verbal (cgram si présent, sinon liste blanche)."""
    if i < 0 or i >= len(T): return False
    if is_verb(T, i): return True
    w = deacc(T[i].lower())
    return (w in VERB_LEX) and not (i > 0 and T[i-1].lower() in NUM_DET)  # « le porte » reste un nom


def prev(T, i): return deacc(T[i-1].lower()) if i > 0 else None
def nxt(T, i):  return deacc(T[i+1].lower()) if i+1 < len(T) else None
def is_plural_noun(T, j):
    if j < 0 or j >= len(T): return False
    dw = deacc(T[j].lower())
    if not (dw.endswith('s') or dw.endswith('x')): return False
    return j > 0 and T[j-1].lower() in NUM_DET and NUM_DET[T[j-1].lower()] == 'pl'   # nom marqué par un dét. pluriel


# ---------- règles : decide(T,i) -> forme correcte (orthographe) | None ----------
def rule_e_er(T, i):
    w = T[i]; lw = w.lower()
    if lw.endswith('é'):              forms = (w, w[:-1] + 'er')          # tapé = participe
    elif deacc(lw).endswith('er') and len(lw) > 3: forms = (w[:-2] + 'é', w)  # tapé = infinitif
    else: return None
    p = prev(T, i)
    if p is None: return None
    if p in AUX:                 return forms[0]      # auxiliaire → participe -é
    if p in PREP or p in MODAL:  return forms[1]      # préposition/semi-aux → infinitif -er
    return None

def rule_son_sont(T, i):
    lw = deacc(T[i].lower())
    if lw not in ('son', 'sont'): return None
    if i == 0: return 'son'                                             # début de phrase déclarative → possessif
    pl = T[i-1].lower()
    if vlike(T, i-1) or pl in PREP or pl in ('et', 'ou', 'ni'):         # complément après verbe/préposition/conj → possessif
        return 'son'
    return 'sont'                                                       # précédé du sujet (nom/adj/ils-elles) → verbe être 3pl

def rule_on_ont(T, i):
    lw = deacc(T[i].lower())
    if lw not in ('on', 'ont'): return None
    p = prev(T, i)
    if p in ('ils', 'elles') or is_plural_noun(T, i-1): return 'ont'    # sujet/antécédent pluriel → avoir 3pl
    if is_participle(T, i+1): return 'ont'
    if vlike(T, i+1):         return 'on'                               # « on » sujet + verbe
    return None

def rule_leur_leurs(T, i):
    lw = deacc(T[i].lower())
    if lw not in ('leur', 'leurs'): return None
    if i+1 >= len(T): return None
    if is_verb(T, i+1): return 'leur'                                   # pronom (invariable) : « je leur parle »
    dn = deacc(T[i+1].lower())
    return 'leurs' if (dn.endswith('s') or dn.endswith('x')) else 'leur'  # déterminant : accord avec le nom

def rule_a_aa(T, i):
    if deacc(T[i].lower()) != 'a': return None
    p = prev(T, i)
    if p in ('il', 'elle', 'on', 'qui', 'ca', "c", "ça"): return 'a'   # sujet 3sg → avoir
    if i+1 < len(T) and is_participle(T, i+1):            return 'a'    # « a mangé » (aux)
    if vlike(T, i-1):                                     return 'à'    # après un verbe (« va à ») → préposition
    return None

def rule_et_est(T, i):
    lw = deacc(T[i].lower())
    if lw not in ('et', 'est'): return None
    p = prev(T, i)
    sg_subj = p in ('il', 'elle', 'on', 'c', 'ce', 'ca', 'ça', 'qui') or \
              (i > 0 and T[i-1].lower() not in NUM_DET and not is_plural_noun(T, i-1) and
               i > 1 and T[i-2].lower() in NUM_DET and NUM_DET[T[i-2].lower()] == 'sg')   # « le chat _ »
    if sg_subj and i+1 < len(T):
        n = deacc(T[i+1].lower())
        if is_participle(T, i+1) or T[i+1].lower() not in NUM_DET:      # suivi d'un attribut → être
            return 'est'
    return None

def rule_peu(T, i):
    lw = deacc(T[i].lower())
    if lw not in ('peu', 'peux', 'peut'): return None
    p = prev(T, i)
    if p in ('je', 'tu'):              return 'peux'                    # 1re/2e pers. → pouvoir
    if p in ('il', 'elle', 'on', 'qui'): return 'peut'                 # 3e sg → pouvoir
    if p in ('un', 'de', 'tres', 'si', 'trop', 'assez', 'bien', 'plus', 'tout', 'aussi', 'y'):
        return 'peu'                                                   # adverbe de quantité
    return None

def rule_ce_se(T, i):
    lw = deacc(T[i].lower())
    if lw not in ('ce', 'se'): return None
    if i+1 >= len(T): return None
    nd = deacc(T[i+1].lower())
    if nd in ('qui', 'que', 'dont') or nd in AUX or nd in ('sont', 'est'):
        return 'ce'                                                    # ce qui/que/dont · c'est · ce sont
    if vlike(T, i+1): return 'se'                                      # se + verbe pronominal
    return 'ce'                                                        # ce + nom (démonstratif)

RULES = [('-é/-er', rule_e_er), ('son/sont', rule_son_sont), ('on/ont', rule_on_ont),
         ('leur/leurs', rule_leur_leurs), ('a/à', rule_a_aa), ('et/est', rule_et_est),
         ('peu/peux/peut', rule_peu), ('ce/se', rule_ce_se)]


def correct(text):
    """-> liste de (index, mot_tapé, suggestion, nom_règle) pour chaque mot jugé fautif."""
    T = toks(text); out = []
    for i in range(len(T)):
        for name, rule in RULES:
            dec = rule(T, i)
            if dec is not None and dec.lower() != T[i].lower():
                out.append((i, T[i], dec, name)); break
    return out


# ---------- jeu de test : (phrase correcte, mot-déclencheur, forme fautive, règle) ----------
CASES = [
    ("Il a mangé la soupe", "mangé", "manger", "-é/-er"),
    ("Il veut manger la soupe", "manger", "mangé", "-é/-er"),
    ("Elle a préféré rester", "préféré", "préférer", "-é/-er"),
    ("Il met son manteau", "son", "sont", "son/sont"),
    ("Les enfants sont contents", "sont", "son", "son/sont"),
    ("Mes amis sont gentils", "sont", "son", "son/sont"),
    ("Ils ont mangé la tarte", "ont", "on", "on/ont"),
    ("On mange ensemble", "On", "Ont", "on/ont"),
    ("Les chats ont faim", "ont", "on", "on/ont"),
    ("Ils prennent leurs cahiers", "leurs", "leur", "leur/leurs"),
    ("Il caresse leur chien", "leur", "leurs", "leur/leurs"),
    ("Je leur parle souvent", "leur", "leurs", "leur/leurs"),
    ("Elle a trouvé un trésor", "a", "à", "a/à"),
    ("Elle va à Paris", "à", "a", "a/à"),
    ("Il pense à son chien", "à", "a", "a/à"),
    ("Le chat est noir", "est", "et", "et/est"),
    ("Le chien et le chat jouent", "et", "est", "et/est"),
    ("Je peux venir demain", "peux", "peut", "peu/peux/peut"),
    ("Il peut venir demain", "peut", "peux", "peu/peux/peut"),
    ("Il mange un peu de pain", "peu", "peut", "peu/peux/peut"),
    ("Le chat se trouve là", "se", "ce", "ce/se"),
    ("Il prend ce livre", "ce", "se", "ce/se"),
    ("On mange ensemble", "On", "Ont", "on/ont"),
    ("Ils ont fini leur travail", "ont", "on", "on/ont"),
]


def main():
    print("=== PROBE CORRECTEUR — homophones grammaticaux, SANS corrigé (détection + correction) ===")
    print(f"  couverture verbale : {'Lexique4 cgram (' + str(len(VERB_LEX)) + ' formes)' if CGRAM_LOADED else 'liste blanche stopgap (cgram absent — voir build_cgram.py)'}\n")

    # 1) FAUX POSITIFS sur les 30 phrases CORRECTES du corpus
    fp_corpus = []
    for e in SENT:
        for (i, w, sug, name) in correct(e['text']):
            fp_corpus.append((e['text'], w, sug, name))
    print(f"  [1] Faux positifs sur 30 phrases CORRECTES : {len(fp_corpus)}")
    for txt, w, sug, name in fp_corpus:
        print(f"        ⚠️ flague « {w} »→« {sug} » [{name}]  dans : {txt}")

    # 2) FAUX POSITIFS sur les phrases-témoins correctes (où la forme tapée EST la bonne)
    fp_cases = det = corr = 0
    per = {}
    for (good_sent, trig, wrong, name) in CASES:
        per.setdefault(name, [0, 0, 0])  # [fp, detect, correct]
        # 2a : la phrase CORRECTE ne doit pas flaguer le déclencheur
        flags_ok = correct(good_sent)
        if any(deacc(w.lower()) == deacc(trig.lower()) for (i, w, sug, nm) in flags_ok):
            fp_cases += 1; per[name][0] += 1
        # 2b : injecter la faute → doit DÉTECTER + CORRIGER
        T = toks(good_sent)
        bad = ' '.join(wrong if deacc(t.lower()) == deacc(trig.lower()) else t for t in T)
        flags_bad = correct(bad)
        hit = next(((i, w, sug, nm) for (i, w, sug, nm) in flags_bad if deacc(w.lower()) == deacc(wrong.lower())), None)
        if hit:
            det += 1; per[name][1] += 1
            if hit[2].lower() == trig.lower():
                corr += 1; per[name][2] += 1
    n = len(CASES)
    print(f"\n  [2] Témoins ({n} confusions) :")
    print(f"        faux positifs (forme correcte flaguée à tort) : {fp_cases}/{n}")
    print(f"        DÉTECTION (faute injectée repérée)             : {det}/{n}")
    print(f"        CORRECTION (bonne forme proposée)              : {corr}/{n}")
    print("        par confusion (fp · détection · correction) :")
    for name in [r[0] for r in RULES]:
        if name in per:
            fp, d, c = per[name]; tot = sum(1 for x in CASES if x[3] == name)
            print(f"           {name:10} fp={fp}/{tot}  det={d}/{tot}  corr={c}/{tot}")

    print("\n  Lecture : faux positifs ≈ 0 = on ne « corrige » pas du texte juste (condition n°1 d'un correcteur).")
    print("            détection+correction élevées = le levier d'accord tranche l'homophone SANS corrigé.")
    print("            → si oui, le correcteur dys (détecte, corrige, situe le STADE) est constructible sur l'existant.")


if __name__ == '__main__':
    main()
