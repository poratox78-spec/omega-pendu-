# Baseline du classifieur de diagnostic — résultats (Phase 0, mesure d'abord)

Script : `diag_baseline.py` · données : `test_set.tsv` · reproductible (seed=42).
Méthode : pour chaque mot, on synthétise une tentative erronée par catégorie applicable,
puis un classifieur **surface/phono (sans M3_d)** renvoie l'ensemble des catégories compatibles.

## Chiffres (415 cas)
- **Diagnostic exact (1 cat, juste) : 91,3 %**
- **Ambigu (≥2 cat compatibles en surface) : 8,7 %** ← cible d'un signal sémantique (M3_d) + contexte

| Catégorie | n | exact | ambigu |
|---|---|---|---|
| accent (é/è/ê) | 99 | 100 % | 0 % |
| voisée/sourde | 73 | 100 % | 0 % |
| muette | 173 | 90,2 % | 9,8 % |
| homophone | 70 | 72,9 % | **27,1 %** |

Confusions dominantes : `homophone↔muette` (≈35 cas, ex. *battu/battus*), `homophone↔accent` (1).

## Lecture (lien M3_d)
- **accent** et **voisée/sourde** sont **100 % décidables en surface** → M3_d n'y apporte rien.
- L'ambiguïté (~9 %) se concentre sur les **homophones** → seul le **sens** tranche → **job potentiel de M3_d**
  (le latent sémantique sous-employé du mémoire §8.1/§12).
- Indécidable sur **mot isolé** (vrai pour un humain aussi) → **n'a de sens qu'avec contexte** → argument fort
  pour la **dictée de phrases**.

## Prochaine expérience (falsifiable, R66)
Tester si un **signal sémantique en contexte** (M3_d ou autre) **réduit le taux d'ambigu** sur les homophones :
baseline = 27,1 % ambigu homophone → cible = le faire baisser. OFF-inerte ; gardé seulement si Δ mesuré.
