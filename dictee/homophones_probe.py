# -*- coding: utf-8 -*-
# homophones_probe.py — JEU DE TEST GOLD pour les homophones (mesure de RAPPEL + garde FP=0).
#
# Source des cas : exercices corrigés (Acadomia, « Les homophones grammaticaux et lexicaux »).
# Ce sont des phrases ÉTIQUETÉES par un référent pédagogique → vérité terrain sur les fautes
# qu'un correcteur dys DOIT attraper, et les phrases correctes qu'il ne doit JAMAIS toucher.
#
# ⚠️ CE N'EST PAS un garde CI (le rappel est volontairement bas aujourd'hui — règles prudentes).
#    C'est un COMPTEUR DE PROGRÈS : on le relance après chaque ajout de règle pour voir
#    le rappel monter SANS faire apparaître de faux positif (la colonne FP doit rester 0).
#   python3 dictee/homophones_probe.py
#
# DOCTRINE / PISTE (audit 2026-07-01) : le correcteur est FP=0 mais rate la plupart des
# homophones de manuel car ses règles ne firent qu'après un SUJET-PRONOM. La voie FP=0 pour
# remonter le rappel = les ASTUCES DE SUBSTITUTION (déterministes, donc FP=0 par construction) :
#     a/à        -> remplacer par « avait »  (si OK → « a »)              [capte les sujets-NOMS]
#     son/sont   -> « étaient »              (si OK → « sont »)           [capte les sujets-NOMS]
#     peu/peut   -> « pouvait »              (si OK → peut/peux)
#     quel/quelle-> « qu'il(s) »             (si OK → qu'elle) + accord de genre du nom suivant
#     près/prêt  -> « proche de »            (si OK → près)
#     mais       -> « pourtant »             (si OK → mais)
#     c'est      -> « cela est »             (si OK → c'est ; sinon s'est)
#     ça/sa      -> « cela »                 (si OK → ça ; sinon sa = possessif devant nom)
#     tout(famille, 4 rôles) :
#         nom tout(s)/toux -> « ensemble(s) » (→ tout) | ajouter « vilaine » (→ toux)
#         pronom tout/tous/toutes -> « cela / ils / elles » (avant verbe) ou EFFAÇABLE (après verbe)
#         déterminant -> « le/la/les » ou « chaque »  (+ accord avec le NOM suivant)
#         adverbe -> « tout à fait / complètement »  (invariable SAUF devant adj. fém. à consonne/h aspiré : toute(s))
#   FAMILLES À ÉLISION (révélées par la fiche dys-positif — préposition vs pronom élidé, déterminable par structure) :
#     dans / d'en   (dans + nom  |  d'en = de + en)
#     sans / s'en   (sans + nom/que  |  s'en = se + en, devant verbe)
#     ni / n'y      (ni ... ni  |  n'y = ne + y, devant verbe)
#     si / s'y / ci (si = condition/adverbe  |  s'y = se + y  |  -ci = démonstratif)
#     est / et      (être 3sg « est »  |  conjonction « et »)
#     ou / où · la / là  (déjà repérés)
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import correcteur_probe as C

# (phrase, mot-cible, attendu)  ; attendu = 'ok' (aucun flag rouge sur la cible) OU la forme corrigée attendue.
GOLD_GRAMMATICAL = [
    ("Il peut venir demain.", "peut", "ok"),
    ("Il peux venir demain.", "peux", "peut"),
    ("Je peux vous aider.", "peux", "ok"),
    ("Nous sommes presque prêts.", "prêts", "ok"),
    ("Nous sommes presque près.", "près", "prêts"),       # près/prêt — pas encore de règle
    ("C'est une bonne idée.", "c'est", "ok"),
    ("Elle s'est levée tôt.", "s'est", "ok"),
    ("Elle c'est levée tôt.", "c'est", "s'est"),          # c'est/s'est — pas encore
    ("Le bébé a une drôle de tête.", "a", "ok"),
    ("Le bébé à une drôle de tête.", "à", "a"),           # sujet NOM → raté aujourd'hui
    ("Quel jour sommes-nous ?", "quel", "ok"),
    ("Quelle jour sommes-nous ?", "quelle", "quel"),      # quel/quelle — pas encore
    ("C'est son livre.", "son", "ok"),
    ("C'est sont livre.", "sont", "son"),
    ("Les poules sont dans le jardin.", "sont", "ok"),
    ("Les poules son dans le jardin.", "son", "sont"),    # sujet NOM pluriel → raté aujourd'hui
    ("Le chien met sa patte.", "met", "ok"),
    ("Il mais son manteau.", "mais", "met"),              # met/mais — pas encore
    # ça / sa  (pronom « ça »=cela vs déterminant possessif « sa »)
    ("Ça ne me dérange pas.", "ça", "ok"),
    ("Sa ne me dérange pas.", "sa", "ça"),                # sa→ça (test « cela »)
    ("Sa maison est grande.", "sa", "ok"),
    ("Ça maison est grande.", "ça", "sa"),                # ça→sa (devant un nom)
    # tout / tous / toute / toutes  (déterminant — accord avec le nom suivant)
    ("Je marche tous les jours.", "tous", "ok"),
    ("Je marche tout les jours.", "tout", "tous"),        # tout→tous (det. devant « les jours »)
    ("Tout le monde est là.", "tout", "ok"),
    ("Toutes les fleurs sont fanées.", "toutes", "ok"),
]

# Homophones LEXICAUX (même catégorie, sens pur) → territoire VERT (vigilance), JAMAIS rouge.
# Ici on vérifie seulement le FP=0 : sur ces phrases correctes, le rouge ne doit RIEN flaguer.
GOLD_LEXICAL_OK = [
    "La mer est agitée aujourd'hui.", "Le comte raconte une histoire.", "Il voudrait une paire de lunettes.",
    "Il faut tenir les rênes bien droites.", "Le cerf traverse la clairière.", "Prends un autre verre.",
    "La maison se trouve vers le parc.", "Nous entrons dans une nouvelle ère.", "Mon père rentre tard.",
    # Phrases CORRECTES denses en homophones grammaticaux (fiches dys-positif / ça-sa) — must rester 0 rouge :
    "Les chevaliers vont à la cour du roi et là ils content leurs aventures.",
    "La reine a organisé une réception où des danseurs se sont produits.",
    "Il rêve d'en faire son dîner ; il l'emporte dans son sac.",
    "Elle s'en va de chez elle sans que sa mère ne s'en aperçoive.",
    "Ils ne distinguent ni la côte ni les rochers ; rien n'y a fait.",
    "Si le théâtre est ouvert, ils s'y rendront.",
    "Il a oublié sa casquette ; regarde comme ça sent bon.",
]

def norm(w): return re.sub(r"[^A-Za-zÀ-ÿ']", "", w).lower()

def run():
    caught = missed = fp = 0
    print("=== GOLD grammatical (rappel + FP=0) ===")
    print("  %-38s %-7s %-8s %-10s %s" % ("phrase", "cible", "attendu", "obtenu", "verdict"))
    for s, tgt, exp in GOLD_GRAMMATICAL:
        got = [sug for (i, w, sug, n) in C.correct(s) if norm(w) == norm(tgt)]
        g = got[0] if got else None
        if exp == 'ok':
            v = "OK (pas de FP)" if not g else "FAUX POSITIF ->" + str(g)
            if g: fp += 1
        elif g and norm(g) == norm(exp):
            v = "attrape"; caught += 1
        elif g:
            v = "flag mais ->" + str(g)
        else:
            v = "RATE"; missed += 1
        print("  %-38s %-7s %-8s %-10s %s" % (s[:38], tgt, exp, g or '0', v))
    print("\n=== GOLD lexical -> VERT (ici on exige juste : aucun rouge = FP=0) ===")
    for s in GOLD_LEXICAL_OK:
        fl = C.correct(s)
        if fl: fp += 1; print("  FAUX POSITIF: %s -> %s" % (s, [(w, sug) for (i, w, sug, n) in fl]))
    n_err = sum(1 for _, _, e in GOLD_GRAMMATICAL if e != 'ok')
    print("\nGrammatical : %d/%d fautes attrapées | RATÉS : %d | FAUX POSITIFS : %d (doit rester 0)" % (caught, n_err, missed, fp))
    return fp

if __name__ == '__main__':
    fp = run()
    # On ne FAIT échouer que sur un FAUX POSITIF (le rappel, lui, est un compteur de progrès).
    sys.exit(1 if fp else 0)
