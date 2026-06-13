# Roadmap — DICTÉE DIAGNOSTIQUE (sur le moteur OMEGA-Ω)

> Outil de **dictée française à diagnostic d'erreur**, fondé sur la **double route** d'OMEGA
> (lexicale = mémoire/homophones · sublexicale = assemblage son→lettre). Visée : **dys / troubles
> de l'écrit** (école, soutien, orthophonie en n°1). Document vivant — on ajuste à chaque jalon.

## Pourquoi cette direction (rappel décision)
- La **force mesurée** d'OMEGA est **phon→ortho** (70 % hors-lexique, 97-98 % en lexique) — la dictée *est* cette tâche.
- Son **profil de défaite est une signature de dyslexie phonologique** (§11.2 mémoire : 96 % des défaites = paire phonétiquement proche ; **58 % voisée/sourde** P/B, T/D, K/G, F/V, S/Z).
- La **dictée existe déjà à moitié** : routes lexicale (`M_DICTEE_LEXICAL`) et sublexicale (`M_DICTEE_SUBLEXICAL`, EM phonème→graphème) dans `app/omega-pendu.html`.
- Les **accents sont récupérables** : surface ASCII (NFD), mais le **SAMPA `p` porte la distinction** (é=/e/, è/ê=/E/) via `PHON_TO_LETTERS` + prior `M4_PHON_USE_P`.

## Principes (hérités d'OMEGA, non négociables)
1. **Mesure d'abord** : chaque ajout = un effet *mesurable* sur un jeu de test étiqueté, jamais « ça semble marcher ».
2. **OFF-inerte / falsification R66** : rien ne dégrade le pendu ; toute brique est OFF par défaut, baseline byte-identique au repos, gardée seulement si l'apport ON est mesuré.
3. **Isolation** : prototypage sur copies jetables ; le build n'est pas modifié sans validation.
4. **Une jonction à la fois** : tester l'**utilité** avant de scaler. Roadmap > improvisation.
5. **Distinguer cognition vs oracle** : la route sublexicale (généralise) est le cœur ; la lexicale (mémoire/homophones) est un *complément assumé*, pas la performance.

---

## Phase 0 — Cadrage & métriques *(AVANT tout code)*
But : savoir ce qu'on mesure et sur quoi, sinon tout Δ est du bruit.
- [ ] 0.1 **Cible & périmètre V1** : confirmer « dys / troubles de l'écrit » ; périmètre = mots FR courants (pas seulement ≥7 lettres).
- [ ] 0.2 **Jeu de test étiqueté** : ~200-300 mots avec, pour chacun, les **types d'erreurs attendus** (accent é/è, voisée/sourde, homophone, lettre muette, régularisation). Source : Lexique4 (déjà inliné) + sélection manuelle des pièges.
- [ ] 0.3 **Métriques définies** :
  - moteur : % mots phon→ortho corrects **avec accents** (in-lexique / hors-lexique séparés) ;
  - diagnostic : **taux de bonne classification** du type de faute sur le jeu 0.2.
- [ ] 0.4 **Décision « hors cadre pendu »** : comment gérer mots courts (<7) + sortie accentuée (cf. Phase 1).
- [ ] 0.5 **Harnais déterministe** réutilisé (omegaRand seedé) pour reproductibilité.

## Phase 1 — Restitution des accents *(le verrou identifié)*
But : que la sortie écrive les accents, en exploitant l'info déjà présente dans le SAMPA.
- [ ] 1.1 **Enrichir `PHON_TO_LETTERS`** pour émettre les graphèmes accentués : /e/→É, /ɛ/(E)→È/Ê, /o/(o)→Ô (selon contexte), /ɑ̃ /, ç via /s/ devant e/i, etc. (table dérivée, pas codée au doigt mouillé).
- [ ] 1.2 **Mesure** : % de ré-accentuation correcte, in-lexique vs hors-lexique (jeu 0.2).
- [ ] 1.3 **Falsification R66** : OFF = comportement ASCII actuel **inchangé** (pendu intact) ; ON = gain mesuré sur l'accentuation, sinon on reverte.

## Phase 2 — Boucle dictée réelle *(entrée apprenant)*
But : passer de « OMEGA s'auto-dicte » à « l'élève écrit, on corrige ».
- [ ] 2.1 **UI dictée** : déclencher un mot (afficher l'invite), **champ de saisie**, validation.
- [ ] 2.2 **Comparaison** saisie ↔ cible, **lettre + accent**, correct/incorrect basique (pas encore de diagnostic).
- [ ] 2.3 **Sélection des mots** graduée (longueur, fréquence, pièges) depuis Lexique4.

## Phase 3 — Diagnostic d'erreur par double route *(le cœur de valeur)*
But : classer **pourquoi** c'est faux, l'atout que personne d'autre n'a.
- [ ] 3.1 **Classifieur d'erreur** par type :
  - **accent** (bonne lettre, mauvais diacritique → é/è) — via Phase 1 ;
  - **voisée/sourde** (P/B, T/D, K/G, F/V, S/Z) — liste du mémoire §11.2 + levier `M_PHON_CORRECTION` (α=0,10/β=0,05) à activer/mesurer ;
  - **homophone / lexicale** (mot homophone existant → *ver/vert/verre*) — via route lexicale (`omega_dicteeLexical` renvoie déjà les homophones) ;
  - **régularisation phonétique** (graphie plausible au son mais fausse) — via route sublexicale ;
  - **lettre muette** (finale non prononcée).
- [ ] 3.2 **Mesure** : taux de bonne classification sur le jeu 0.2. Falsifiable.
- [ ] 3.3 Réutilise tel quel : les 2 routes existantes + la table accents (Phase 1).

## Phase 4 — Restitution pédagogique *(feedback dys)*
But : transformer le diagnostic en aide compréhensible.
- [ ] 4.1 **Messages par type** : « tu l'as écrit comme ça sonne — ici /ɛ/ s'écrit *è* » · « confusion sourde-sonore *p↔b* » · « homophone : *vert / ver / verre* ».
- [ ] 4.2 **Profil d'apprenant** : suivi des erreurs par type dans le temps (où il bute).
- [ ] 4.3 **Mode entraînement ciblé** : redonner des mots du type le plus raté.

## Phase 5 — Audio & accessibilité
- [ ] 5.1 **TTS** : dicter le mot à voix haute (le SAMPA est là ; mapper vers une voix navigateur).
- [ ] 5.2 **(parqué) Braille / malvoyant** : modalité d'E/S sur un **autre axe** (visuel) — à brancher seulement après la V1 dys, car OMEGA n'y apporte pas son atout distinctif.

## Phase 6 — Validation & contenu
- [ ] 6.1 **Listes graduées** par difficulté / piège.
- [ ] 6.2 **Validation utilisateurs** (école / orthophoniste) si possible — l'utilité réelle, pas qu'un chiffre.

---

## Ordre conseillé (impact × effort)
**0 → 1 → 2 → 3** d'abord (le moteur accentué + la boucle + le diagnostic = la valeur).
**4** ensuite (pédagogie). **5-6** quand le cœur est prouvé.

## Ce qu'on RÉUTILISE vs ce qu'on AJOUTE
| Réutilisé tel quel | À ajouter |
|---|---|
| Route lexicale + homophones (`omega_dicteeLexical`) | Restitution accents (table enrichie, Ph.1) |
| Route sublexicale EM phon→graphème (`omega_subTrain/Decode`) | Boucle de saisie apprenant (Ph.2) |
| Prior phono `M4_PHON_USE_P` + `PHON_TO_LETTERS` | Classifieur de type d'erreur (Ph.3) |
| Lexique4 inliné (phon, fréquence, morpho) | Feedback pédagogique + profil (Ph.4) |
| Harnais déterministe (omegaRand) | TTS (Ph.5) |
| Levier `M_PHON_CORRECTION` (voisée/sourde) | Jeux de mots gradués + validation (Ph.6) |

## Risques / limites connus (à garder en tête)
- Décodage sublexical **glouton** (meilleur chunk par phonème, sans contexte) → erreurs ; à muscler (contexte / morphologie).
- `qualité` plafonnée ~0,80 et voisée/sourde non résolue côté pendu → le diagnostic doit savoir afficher l'incertitude.
- Sortir du cadre pendu (≥7 ASCII) demande de gérer mots courts + diacritiques proprement.
