# -*- coding: utf-8 -*-
# PROBE BOUCLE DESCENDANTE (grammaire) — apprendre depuis les cibles connues, mesurer la généralisation.
# =====================================================================================================
# La double voie (GRAMMAIRE_DOUBLE_VOIE.md) : boucle MONTANTE = décider (acquis) ; boucle DESCENDANTE =
# APPRENDRE depuis le résultat connu (miroir du pendu). Ici on fait apprendre la pièce la plus propre et
# NON circulaire : le LEXIQUE DE GENRE, depuis les contextes à déterminant genré des phrases correctes
# (« une table » → table=f). C'est « la boucle apprend ce que le lexique contient » — et on peut la
# VALIDER contre Lexique4 (vérité terrain), donc c'est falsifiable.
#
# Mesuré : (1) précision du genre appris vs Lexique4 ; (2) généralisation leave-one-out (un nom appris
# AILLEURS sert-il sur la phrase tenue à l'écart ?) ; (3) usage en DÉTECTION d'accord, FP=0.
# Lancer : python3 dictee/descending_probe.py
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import diag_sentence as D
from diag_sentence import toks, deacc, GEN_DET, GENDER_LEX

SENT = json.load(open(os.path.join(HERE, 'sentences.json'), encoding='utf-8'))


def learn_gender(train):
    """Boucle descendante : apprend nom→genre depuis « déterminant genré + nom » des phrases CORRECTES."""
    counts = {}
    for e in train:
        T = toks(e['text'])
        for i in range(1, len(T)):
            d = T[i-1].lower()
            if d in GEN_DET:                                  # le/la/un/une/ce/mon… → marque le genre du nom suivant
                noun = deacc(T[i].lower())
                if len(noun) < 2:
                    continue
                counts.setdefault(noun, {'m': 0, 'f': 0})[GEN_DET[d]] += 1
    # résolution : genre majoritaire, en écartant l'ambigu (vu dans les 2 genres de façon non tranchée)
    learned = {}
    for n, c in counts.items():
        if c['m'] and c['f']:
            continue                                          # ambigu observé → on s'abstient (FP-safe)
        learned[n] = 'm' if c['m'] else 'f'
    return learned


def main():
    print("=== PROBE BOUCLE DESCENDANTE — apprendre le lexique de GENRE depuis la dictée ===\n")
    if not GENDER_LEX:
        print("  (Lexique4 absent : pas de vérité terrain pour valider — lance build_cgram.py d'abord.)")

    # (1) apprendre sur TOUT le corpus, précision vs Lexique4
    learned_all = learn_gender(SENT)
    val = [(n, g, GENDER_LEX.get(n)) for n, g in learned_all.items() if GENDER_LEX.get(n) in ('m', 'f')]
    ok = sum(1 for _, g, t in val if g == t)
    print(f"  [1] genre APPRIS depuis les déterminants : {len(learned_all)} noms")
    print(f"      validables contre Lexique4 : {len(val)} · CORRECTS : {ok}/{len(val)} "
          f"({100*ok/max(1,len(val)):.0f}% de précision)")
    bad = [(n, g, t) for n, g, t in val if g != t]
    for n, g, t in bad:
        # · et non ✗ : ce sont les erreurs d'APPRENTISSAGE résiduelles, listées à dessein et
        # déjà sous le plancher mesuré plus bas. Un ✗ ici faisait croire à un contrôle en échec
        # dans une sortie VERTE — exactement le bruit qui use l'attention (cf. PR#620).
        print(f"        · « {n} » appris {g}, lexique {t}")

    # (2) généralisation LEAVE-ONE-OUT : un nom appris AILLEURS aide-t-il sur la phrase tenue à l'écart ?
    gen_tot = gen_ok = 0
    for k in range(len(SENT)):
        train = SENT[:k] + SENT[k+1:]
        learned = learn_gender(train)
        T = toks(SENT[k]['text'])
        for i, w in enumerate(T):
            n = deacc(w.lower())
            if n in learned and GENDER_LEX.get(n) in ('m', 'f'):   # nom dont le genre a été appris hors de cette phrase
                gen_tot += 1
                gen_ok += 1 if learned[n] == GENDER_LEX[n] else 0
    print(f"  [2] généralisation (leave-one-out) : noms d'une phrase dont le genre est appris AILLEURS = {gen_tot}")
    print(f"      genre généralisé CORRECT : {gen_ok}/{gen_tot} ({100*gen_ok/max(1,gen_tot):.0f}%)")

    # (3) usage en DÉTECTION : le genre APPRIS (pas le lexique) permet-il de flaguer un accord faux, FP=0 ?
    #     démo : déterminant neutre (« leur ») + adjectif ; le nom-tête a été appris depuis une autre phrase.
    learned_all2 = learn_gender(SENT)
    def learned_gender_of(T, idx):
        for j in range(idx-1, max(-1, idx-4), -1):
            n = deacc(T[j].lower())
            if n in learned_all2: return learned_all2[n]
        for j in range(idx+1, min(len(T), idx+3)):
            n = deacc(T[j].lower())
            if n in learned_all2: return learned_all2[n]
        return None
    cases = [("Leur chat noir dort", "noir", "noire", "m"),       # « chat » appris (le chat…) → m
             ("Leur table verte casse", "verte", "vert", "f"),    # « table » appris (la maîtresse… non ; une table ?)
             ("Leur jardin vert pousse", "vert", "verte", "m")]   # « jardin » appris (le jardin)
    print("  [3] détection via genre APPRIS (déterminant neutre « leur ») :")
    fp = det = 0
    for txt, adj, bad, exp in cases:
        T = toks(txt); i = [k for k, w in enumerate(T) if w.lower() == adj.lower()][0]
        lg = learned_gender_of(T, i)
        # FP : sur la phrase correcte, le genre appris contredit-il l'adjectif correct ? (ne devrait pas flaguer)
        # détection : on note si le genre du nom-tête est connu (→ accord vérifiable)
        if lg is not None:
            det += 1
            if lg != exp: fp += 1
        print(f"      « {txt} » : genre appris du nom-tête = {lg} (attendu {exp}) {'✓' if lg==exp else ('—' if lg is None else '✗')}")
    print(f"      nom-tête au genre connu : {det}/{len(cases)} · contradictions (FP) : {fp}")

    # ⭐ CONTRAT — cette sonde ne pouvait PAS échouer : elle mesurait, imprimait, et rendait toujours 0.
    # Un banc sans code de sortie branché sur sa mesure est un banc DÉCORATIF : il nomme une garantie
    # qu'il n'apporte pas. Les planchers ci-dessous sont l'ÉTAT MESURÉ à la pose (186/188, 178/178,
    # 3/3, 0 FP) — aucun verdict ne bascule aujourd'hui. Ce sont des PLANCHERS (>=) : un corpus qui
    # grandit ou un apprentissage qui progresse passent ; seule une RÉGRESSION rougit.
    PLANCHER_JUSTES, PLANCHER_VAL = 186, 188      # (1) précision du genre appris vs Lexique4
    PLANCHER_GEN = 178                            # (2) généralisation leave-one-out, exigée à 100 %
    err = []
    if not GENDER_LEX:
        # sans vérité terrain il n'y a rien à valider : on le DIT, on ne rend pas un vert muet.
        print("")
        print("  · CONTRAT : SAUTÉ (pas de lexique de genre — rien à valider contre)")
    else:
        if len(val) < PLANCHER_VAL:
            err.append(f"noms validables {len(val)} < plancher {PLANCHER_VAL} (la sonde mesure MOINS)")
        if ok < PLANCHER_JUSTES:
            err.append(f"genre appris JUSTE {ok} < plancher {PLANCHER_JUSTES}")
        if gen_tot < PLANCHER_GEN:
            err.append(f"généralisation : {gen_tot} noms testés < plancher {PLANCHER_GEN}")
        if gen_ok < gen_tot:
            err.append(f"généralisation {gen_ok}/{gen_tot} — elle était à 100 %")
        if det < len(cases):
            err.append(f"détection : nom-tête au genre connu {det}/{len(cases)}")
        if fp:
            err.append(f"{fp} contradiction(s) FP — le genre appris contredit une phrase CORRECTE")
    if err:
        print("")
        print("✗ BOUCLE DESCENDANTE : l'apprentissage du genre a RÉGRESSÉ :")
        for e in err: print("    " + e)
        return 1

    print("\n  Lecture : précision élevée + généralisation = la boucle descendante APPREND vraiment le lexique de")
    print("            genre depuis l'usage (miroir du pendu, mais ici ça PAIE et c'est validable). Limite HONNÊTE :")
    print("            30 phrases n'apprennent qu'une poignée de noms → la valeur réelle vient du VOLUME (corpus")
    print("            corrigés réels = validation terrain). C'est le moteur du correcteur qui s'auto-enrichit.")


if __name__ == '__main__':
    sys.exit(main() or 0)
