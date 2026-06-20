# -*- coding: utf-8 -*-
# DÉCOMPOSITION PARALLÈLE ortho / phon / grammaire d'erreurs RÉELLES (corpus GEC français).
# Le corpus corpus_gec_fr.jsonl (paires bad→good, type fautes dys/GEC) est la donnée réelle
# (le « goulot » identifié par l'audit). Ici on :
#   1. ROUTE chaque diff bad↔good vers UNE des 3 voies parallèles (ORTHO surface / PHON son / GRAMMAIRE),
#      en réutilisant decompose (phono), diag_sentence (familles, accord, levier grammaire) ;
#   2. teste le CORRECTEUR sur données réelles : FP sur les phrases CORRECTES (doit ≈ 0, propriété
#      cardinale FP=0) + rappel sur les phrases FAUTIVES (familles couvertes).
# Lancer : python3 dictee/corpus_diag.py
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import decompose as D
from diag_sentence import align, toks, deacc, is_accord, NUM_DET, GEN_DET, VS
from correcteur_probe import correct

CORPUS = os.path.join(HERE, 'corpus_gec_fr.jsonl')
FUNC = set(('le la les un une des du de au aux à en dans ce cet cette ces mon ma mes ton ta tes son sa ses '
            'notre nos votre vos leur leurs et est ou où ni car mais donc or que qui').split())

def same_phon(a, b):
    return D.sublexical_phon(a)[0] == D.sublexical_phon(b)[0]

def route_of(good, bad):
    """Voie PARALLÈLE dominante d'une substitution good↔bad → (voie, famille)."""
    dg, db = deacc(good.lower()), deacc(bad.lower())
    if good.lower() == bad.lower():
        return None
    if dg == db:                                            # ne diffèrent que par les accents/cédille
        return ('PHON', 'accent')
    if is_accord(good, bad):                                # même radical, lettres flexionnelles (s/e/t/x/n)
        return ('GRAMMAIRE', 'accord')
    if good.lower() in FUNC or bad.lower() in FUNC:         # mot-outil (déterminant/préposition) : du/de, le/la, un/une
        return ('GRAMMAIRE', 'mot-outil')
    # voisée/sourde (1 lettre) → PHON
    if len(good) == len(bad):
        diff = [i for i in range(len(good)) if good[i].lower() != bad[i].lower()]
        if len(diff) == 1 and VS.get(good[diff[0]].lower()) == bad[diff[0]].lower():
            return ('PHON', 'voisée/sourde')
    if len(dg) == len(db) and sorted(dg) == sorted(db):     # mêmes lettres permutées
        return ('PHON', 'inversion')
    if same_phon(good, bad):                                # sonnent pareil, graphie ≠ → surface/ortho
        return ('ORTHO', 'surface/homophone')
    return ('GRAMMAIRE', 'lexical')                         # mots distincts (genre/accord lexical, etc.)

def main():
    if not os.path.exists(CORPUS):
        print("[corpus] corpus_gec_fr.jsonl absent."); return 1
    rows = [json.loads(l) for l in open(CORPUS, encoding='utf-8') if l.strip()]
    voies = {'ORTHO': {}, 'PHON': {}, 'GRAMMAIRE': {}}; n_sub = n_omis = n_trop = 0
    examples = []
    for r in rows:
        T, S = toks(r['good']), toks(r['bad'])
        reorder = sorted(deacc(w.lower()) for w in T) == sorted(deacc(w.lower()) for w in S)  # phrase = pur ré-ordonnancement
        for op, t, s in align(T, S):
            if op == 'del': n_omis += 1; continue           # mot du good absent du bad = omission (grammaire/sens)
            if op == 'ins': n_trop += 1; continue           # mot en trop dans le bad
            if op == 'sub':
                rt = ('GRAMMAIRE', 'ordre') if reorder else route_of(t, s)
                if not rt: continue
                voie, fam = rt; n_sub += 1
                voies[voie][fam] = voies[voie].get(fam, 0) + 1
                if len(examples) < 10:
                    examples.append((s, t, voie, fam))
    tot = sum(sum(f.values()) for f in voies.values())
    print(f"=== DÉCOMPOSITION PARALLÈLE des erreurs réelles ({len(rows)} paires, {n_sub} substitutions) ===")
    for voie in ('PHON', 'ORTHO', 'GRAMMAIRE'):
        s = sum(voies[voie].values())
        det = ' · '.join(f"{k} {v}" for k, v in sorted(voies[voie].items(), key=lambda x: -x[1]))
        print(f"  {voie:10} {s:4} ({100*s/max(1,tot):4.0f}%)   {det}")
    print(f"  (+ {n_omis} omissions, {n_trop} mots en trop — voie GRAMMAIRE/sens, hors substitution)")
    print("  exemples de routage :")
    for s, t, voie, fam in examples:
        print(f"    « {s} » → « {t} »   [{voie}/{fam}]")

    # === CORRECTEUR sur données RÉELLES : FP=0 (sur le CORRECT) + rappel (sur le FAUTIF) ===
    fp = 0; ghits = 0
    for r in rows:
        fp += len(correct(r['good']))                       # phrases CORRECTES → 0 correction attendue (FP=0)
    catch = 0; reachable = 0
    for r in rows:
        T_good = toks(r['good'])
        for (i, word, sugg, name) in correct(r['bad']):
            # « bonne » correction = la suggestion rejoint le mot good aligné (heuristique simple : présent dans good)
            if sugg.lower() in (w.lower() for w in T_good):
                catch += 1
    print(f"=== CORRECTEUR sur données réelles ({len(rows)} phrases) ===")
    print(f"  FAUX POSITIFS sur les phrases CORRECTES : {fp}  (propriété cardinale : doit rester ≈ 0)")
    print(f"  corrections proposées sur le fautif, plausibles (suggestion ∈ good) : {catch}")
    print("  (le correcteur ne couvre que SES familles : a/à, son/sont, -é/-er, genre-adj… ; le corpus")
    print("   est plus large — accords nominaux, déterminants du/de — d'où un rappel partiel attendu.)")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
