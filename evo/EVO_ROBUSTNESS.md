# EVO — Robustesse (balayage nuit, juin 2026)

Sweep automatisé de la nuit du **25→26 juin 2026** sur la branche `claude/cool-curie-ctnvhi`.
Objectif : vérifier que les chiffres-phares des briques EVO tiennent sur **plusieurs graines**
(pas de résultat « chanceux »), et que la CI passe. Données honnêtes — les points
seed-dépendants sont signalés tels quels.

Bruit moteur filtré à l'exécution via :
`2>&1 | grep -ivE "correcteur|bloc vdc|Lex4]|Embedded|Substrat]|VoiePhon]|Init]|NaN in softmax|cos(|validatePhoneticInit|R40"`

Env : Windows 11 / Git Bash · node v24.17.0 · Python 3.13.14.

---

## CI complète (`./dev.sh`)

**27/27 checks ✅ — TOUT VERT** (exit 0). C'est exactement ce que voit la CI Linux.

- Le quirk Windows attendu (« correcteur AUTONOME (bake) », chemins `/tmp` traduits
  par MSYS) **n'a PAS frappé cette fois** : la check est passée ✅.
- Seul effet de bord build : `build_*` a régénéré `extension/assets/noun-post.txt.gz`
  (diff de mtime uniquement) — annulé avec `git checkout --` avant tout commit.
  Aucun fichier suivi n'est touché par ce rapport.

(Le comptage « 27/27 » est celui affiché par `dev.sh` ; la consigne parlait de ~25,
le script en énumère 27.)

---

## Briques à graine — multi-seed

### `evo_p1_vsa_copy.js 60 <seed>` — fidélité de copie (% lettres / % mot exact)

| seed | len 7 | len 12 | len 15 |
|------|-------|--------|--------|
| 2024 | 99.8 % · 98.3 % | 98.8 % · 86.7 % | 96.7 % · 56.7 % |
| 99   | 98.8 % · 91.7 % | 94.7 % · 45.0 % | 93.8 % · 31.7 % |
| 7    | 99.5 % · 96.7 % | 98.5 % · 81.7 % | 97.4 % · 70.0 % |
| 314  | 99.0 % · 93.3 % | 98.3 % · 80.0 % | 98.6 % · 81.7 % |

**Verdict : % lettres STABLE · % mot exact aux longues graines = VARIE.**
Le taux **par lettre** est très robuste (92–99 % partout, peu de dispersion).
Le **mot exact** aux longueurs dures (13–15) dépend de la graine : seed 99 est nettement
le plus faible (~31–45 % à len 12–15) alors que 2024/7/314 tiennent 56–82 %.
La promesse « ≥99 % de mot exact jusqu'à une longueur, puis dégradation gracieuse »
tient qualitativement, mais le **point de bascule recule plus tôt sur les graines malchanceuses**.

### `evo_p1_cross.js 60 <seed>` — croisement vs route unique (mot exact, len 11–18)

| seed | route unique (11 / 15 / 18) | 2 routes croisées (11 / 15 / 18) | croisement gagne ? |
|------|------------------------------|----------------------------------|--------------------|
| 2024 | 85.0 / 50.0 / 20.0 % | 98.3 / 83.3 / 71.7 % | ✅ nettement (+13 à +52 pts) |
| 99   | 53.3 / 28.3 / 13.3 % | 53.3 / 25.0 / 25.0 % | ⚠️ à peu près à égalité (parfois pire) |
| 7    | 80.0 / 63.3 / 50.0 % | 98.3 / 86.7 / 86.7 % | ✅ nettement (+18 à +37 pts) |

**Verdict : VARIE / seed-dépendant.**
Sur 2 graines (2024, 7) le croisement relève clairement le mot exact aux longueurs 11–18
(souvent +20 à +35 pts). Sur seed 99 le croisement **n'apporte rien** — il est tantôt égal,
tantôt légèrement en dessous (ex. len 9 : 68 % croisé vs 77 % unique).
Cohérent avec la note du script (« le croisement relève SI les routes sont indépendantes ») :
l'avantage existe pour la majorité des graines mais **n'est pas universel**.
C'est le point le plus seed-sensible du balayage — à ne pas vendre comme garanti.

### `evo_p1_code.js <seed>` — copie de code, surface vs MULTIPLY

| seed | chars surface | chars MULTIPLY | chars ADD | lignes /15 (surf · MUL) | longues lignes |
|------|---------------|----------------|-----------|--------------------------|----------------|
| 2024 | 83.3 % | 89.8 % | 86.9 % | 5 · 9 | MULTIPLY gagne |
| 99   | 83.4 % | 91.7 % | 86.3 % | 8 · 9 | MULTIPLY gagne |
| 7    | 83.4 % | 91.0 % | 90.2 % | 9 · 9 | MULTIPLY gagne |

**Verdict : STABLE.**
MULTIPLY bat la surface seule sur les caractères exacts à **chaque** graine
(89.8 / 91.7 / 91.0 % vs ~83.4 % en surface), et domine sur les **longues lignes** (107–120 car.)
systématiquement. La surface est elle-même remarquablement constante (83.3–83.4 %).
Claim solide.

### `evo_p1_fidelity.js 30 <seed>` — plafond de reconstruction (erreur relative)

| seed | plage err (len 7→15) | Δ(rote) test−train moyen |
|------|----------------------|--------------------------|
| 2024 | 0.711 → 0.657 | +0.032 |
| 99   | 0.724 → 0.651 | +0.033 |

**Verdict : STABLE.**
Le plafond reste dans la bande annoncée (~0.65–0.75) sur les deux graines, jamais de mur
(err ≥ 0.9 jamais atteint sur 7–15). La composante « par cœur » (le VU se reconstruit mieux)
est reproductible (+0.032 vs +0.033). Plafond confirmé.

---

## Briques déterministes (graine interne fixe) — verdict-phare

| brique | attendu | obtenu |
|--------|---------|--------|
| `evo_p1_quine.js`   | imprime `QUINE VÉRIFIÉ`, exit 0 | ✅ `QUINE VÉRIFIÉ`, exit 0 · 5 fonctions reconstruites byte-exact |
| `evo_p3_genome.js`  | params >0 % bénéfique, source 0 % | ✅ params **30 %** bénéfique / 0 % létal · source **75 % létal / 0 % bénéfique** |
| `evo_p3_lineage.js` | err finale ≤ err initiale | ✅ 1.188 → 1.163 (Δ −0.025), bat la réf (−0.237) |
| `evo_p3_holdout.js` | imprime `GÉNÉRALISE` | ✅ `GÉNÉRALISE` · gagnant ≥ réf sur tous les jeux held-out |

Aucune de ces quatre briques n'a planté ; toutes reproduisent leur verdict.

---

## Verdict global — honnête

- **CI : 27/27 ✅**, sans même le quirk bake. Rien à signaler côté checks.
- **Briques déterministes : 4/4 tiennent** leur verdict-phare exactement.
- **Briques à graine — 2 solides, 2 à nuancer :**
  - `evo_p1_code` (MULTIPLY > surface) et `evo_p1_fidelity` (plafond ~0.65–0.75) :
    **stables** sur toutes les graines testées.
  - `evo_p1_vsa_copy` : le **taux par lettre est stable**, mais le **mot exact aux longues**
    longueurs **varie** avec la graine (seed 99 nettement plus faible).
  - `evo_p1_cross` : l'avantage du **croisement est seed-dépendant** — net sur 2024/7,
    quasi nul sur 99. À présenter comme « gain conditionnel à l'indépendance des routes »,
    **pas** comme un gain garanti.

**Conclusion :** les claims structurels (quine, le bon génome, lignée qui progresse,
généralisation, MULTIPLY, plafond de fidélité) tiennent à travers les graines.
Les claims chiffrés sur le **mot exact aux grandes longueurs** (copie VSA brute et,
surtout, gain du croisement) sont **partiellement seed-dépendants** — robustes en moyenne,
mais une graine malchanceuse (99 ici) les abaisse sensiblement. À garder en tête avant
de citer un chiffre de mot-exact long isolé.
