# OMEGA-Ω — mémoire projet (Claude Code local)

> Lis ce fichier en entier au démarrage. Il ORIENTE — il n'enseigne plus : le savoir profond vit dans les documents pointés.
> ⚖️ **`DOCTRINE.md` : à lire en entier avant de coder.** Aucun résumé ici (le résumé tuait la source — mesuré le 24/08).
> Ce fichier est gardé par `python3 dictee/docs_probe.py` : ≤ 1 500 mots, aucune ligne > 200 caractères, zéro phrase recopiée de la doctrine.
> Ne recopie JAMAIS un chiffre de mémoire : relance la sonde ou lis `ETAT.md`.

## Le dépôt : 4 choses
1. **OMEGA-Ω** — moteur cognitif de pendu français (`app/omega-pendu.html`, monolithique). Détails : `docs/MEMOIRE.html`, `docs/CODE_MAP.md`.
2. **`omega-key/`** — messagerie chiffrée (dérivé, non audité crypto). Pas le focus.
3. **`evo/`** — exploratoire : OMEGA apprend à coder ; harnais headless `evo/fitness_harness.js`.
4. **`dictee/`** — **CHANTIER ACTIF** : correcteur dys + dictée diagnostique sur la double route d'OMEGA.

## ⛔ Interdits de lecture (sinon : fenêtre saturée, compactage permanent)
- Ne JAMAIS lire en entier : `app/omega-pendu.html` (~5 Mo, ~1,3 M tokens), `dictee/phono_homophones.json` (~2,1 Mo sur 1 ligne),
  `data_local/Lexique4.tsv` (33 Mo), tout gros `.tsv`/`.gz`/`.jsonl`.
- Méthode obligatoire : `Grep` pour localiser → `Read` avec `offset`/`limit` sur la plage utile seulement ;
  les gros JSON/TSV se traitent par script, jamais en lecture directe.
- Pour éditer le monolithe : `python tools/omega_edit.py` (pièges connus du fichier).

## Chantier actif : le correcteur dys (dictée de phrases)
- Trois moteurs à parité gardée en CI : **référence Python** (`dictee/correcteur_probe.py`, `speller_probe.py`, `diag_sentence.py`) ·
  **app** (panneaux du monolithe) · **extension Chrome** (`extension/dys-core.js`, copie verbatim). Le clone EN et le site se construisent depuis l'app.
- **LE chiffre de référence du produit** — `OMEGA_DYS_DATA=… python3 dictee/dys_pipeline_probe.py` (72 productions dys réelles, 6 217 mots) :
  **294 fautes réparées sans clic (19,1 %) · 244 rattrapables en un clic · 14 mots justes cassés (0,30 %)**
  **· 73 rouges appliqués vers un AUTRE mauvais mot (5,8 % des ratés)** — colonne posée le 07/09, invisibles avant
  (ils tombaient en MUET), **dont 42 « bon lemme, mauvaise flexion »** (58 %). Mesuré le 12/09/2026 — 286 → 294 le 12/09 parce que
  le juge admet enfin l'apostrophe (la couche élision du produit lui était invisible), pas parce que le produit a changé.
  produit ne fait que proposer (→ 239/14 le 05/09, palier vigilance porté), puis la référence a reçu ce que le
  produit affirme (→ 284/14, contexte-first ; → 286/15 le 10/09 ; → 286/14 le 11/09, moteur). Accord de palier : **100 %**
  (880/880 le 10/09, palier « inconnu » compris), gardé par `palier_gold_probe.py` — la série « la référence décrit le
  produit » (#659 → #679, dix maillons) est close : 286/14 est le POINT, plus une borne (hors accord : 1, une autre famille).
  **Accents comptés à part depuis le 12/09** (le juge désaccentue) : 274 fautes d'accent seul, 166 réparées (61 %), 1 cassé
  (ambigu : « se manifestent a un cocar ») — les 2 casses a/à réparées le 12/09 (gardes de `vlike`).
  C'est LUI qui pilote les décisions : les mesures par couche mentent sur le produit.
- Garde cardinale : **FP=0 sur batterie** — un rouge s'applique seul, un orange n'agit qu'au clic ; casser un mot juste est la seule vraie faute.
  À l'échelle : 1,36 % de phrases correctes flaggées (UD 2 500, plafond CI 3 %) — mesuré le 12/09/2026 (1,40 % du 03/09 au 12/09).
- Extension Chrome = pivot produit : **0.6.3 téléversée au Web Store (04/09, revue en cours)**, 0.6.4 prête (11/09, moteur). Dossier : `extension/STORE.md`.
- Corpus : `data_local/dys_reel` (privé, hors git ; `OMEGA_DYS_DATA=` pour un worktree). ⚠️ 92,7 % de sondes à faute unique —
  lire `python3 dictee/corpus_profile_probe.py` avant d'interpréter tout pourcentage « dys ».

## Décisions vivantes (ne pas re-débattre)
- **Cible n°1 = dys / troubles de l'écrit. Cadre = phrases** (mot isolé mal posé : 84 % ont des homophones).
- Garde d'ancre **par règle**, jamais de primitive lexicale globale (3 confirmations mesurées — JOURNAL 08/2026).
- Accents : la solution existe — lookup accentué en lexique, hors-lexique le phonème porte l'accent. Ne pas réinventer.
- Police de son : **le TEXTE ne change jamais** (spans + 3 graisses, pas d'alphabet privé, PUA dépréciés).
- Calcul (dyscalculie) : la soustraction pose la retenue **ADDITIVE** (sur le chiffre du bas) — la méthode soustractive affichait
  « il reste −1 » sur 502−347 (vécu 25/08 : la sonde restait verte, le négatif naissait dans l'affichage).
- Lexique moteur 155k : winrate-inerte mais gardé (`AUDIT_BASELINE.md`).
- Tout A/B du moteur pendu embarque un **placebo** (plancher de bruit ~200 parties/3 000 — JOURNAL 03/09).
- **Falsifiés, ne pas refaire** (détail : JOURNAL, `notes/MOTEUR_HISTORIQUE.md`, `AUDIT_OMEGA.md`, skill linguistique) :
  M3_d homophones · pendu-de-phrases comme levier winrate · C cognitif OOV léger ET lourd · boucles du pendu (Möbius phon/ortho) ·
  lemme « n'invente aucune lettre » · did-you-mean · relâche nbhomog · IPA fidèle · initiale phonétique dans `_cands`.

## Données & licence
- `data_local/Lexique4.tsv` (33 Mo, 188 863 mots) : présent en local, hors git. Les sondes lisent l'env `LEX4=` (défaut `/tmp/lex4/Lexique4.tsv`).
- Licences : Lexique 4 **CC BY-SA 4.0** (citation complète : `NOTICE`) · **Morphalou 3.1 (ATILF/CNRS, LGPL-LR)** · Wiktionnaire/kaikki CC BY-SA.
  Tout dérivé embarqué suit. Paquet public du site : `omega-lexiques.zip` (~706 000 formes, `python3 build_lexiques.py --check`).
- Speller embarqué : 705 653 formes (Lexique 4 + Wiktionnaire + 3 lots Morphalou).

## Comment lancer (l'essentiel)
- `./dev.sh` — toutes les gardes (≡ CI, la parité est elle-même gardée). Compte et liste commentée : `ETAT.md` §2.
- `python3 dictee/correcteur_probe.py` (batterie FP=0) · `python3 dictee/fp_scale_probe.py --check` (FP échelle) ·
  `OMEGA_DYS_DATA=… python3 dictee/dys_pipeline_probe.py` (le chiffre produit).
- `python3 dictee/dys_precision_probe.py [--navigateur]` — précision par famille ; `--navigateur` = le PRODUIT réel (extension dans Chrome).
- App : ouvrir `app/omega-pendu.html` (boutons ✍️ Dictée · 🩹 Correcteur · 🔤 Décompose).
  Assets extension : `python3 extension/build_assets.py` · zip Store : `python3 extension/build_zip.py --store`.
- Pendu : `node evo/fitness_harness.js [seed] [n]` · A/B apparié avec placebo : `node evo/pendu_paired_ab.js`.
- Régénérations : `build_cgram.py` (LEX4), `build_pos.py`, `etat_gen.py` (→ `ETAT.md`).

## Git & CI
- Dépôt `poratox78-spec/omega-pendu-`. Une branche fraîche depuis `origin/main` par incrément → un PR ; **Rem merge**, jamais de merge direct sur main.
- Commit/push systématique (mémoire durable — la session cloud subit des rollbacks). CI : `.github/workflows/ci.yml` ≡ `dev.sh`.

## Où est le savoir (pointeurs)
- **`DOCTRINE.md`** — la doctrine.
- **`ETAT.md`** — l'état GÉNÉRÉ (`dictee/etat_gen.py`) : chiffres au registre unique, gardes de dev.sh, chantiers ouverts/fermés
  (source curée : `dictee/etat_chantiers.json`).
- **`dictee/JOURNAL.md`** — l'histoire datée : chaque mesure, falsification, rétractation. Le cimetière de référence.
- **`.claude/skills/linguistique/SKILL.md`** — playbook des règles du correcteur : ajouter/mesurer une règle FP=0, primitives, juges et leurs biais.
- **Audit du correcteur dans le vrai Chrome (11/09/2026)** : `dictee/AUDIT_CORRECTEUR_2026-09-11.md` — textes, fausse orange, silences, plan ordonné.
- Composants dictée : `dictee/CORRECTEUR.md` · `GRAMMAIRE_DOUBLE_VOIE.md` · `DECOMPOSE.md` · `P2G.md` ·
  `ETAT_DES_LIEUX.md` (corpus dys & littérature) · `dictee/README.md`.
- Moteur pendu : `AUDIT_OMEGA.md` · `docs/CONFIG_TOGGLES.md` · `docs/COGNITION_DESIGN.md` · `docs/HANGMAN_SOTA.md` · `REPRISE_MOTEUR.md` ·
  `docs/rapport-mode-emploi.html` (§18 = dictée) · `AUDIT_STRUCTUREL.md`.
- Extension : `extension/README.md` + `STORE.md` · Police : `police/` (`DESIGN_AVEUGLE.md`, `LITTERATURE.md`) · Word : `word/` ·
  Anglais : `CHANTIER_ANGLAIS.md` · Plans : `DICTEE_ROADMAP.md`, `evo/EVO_ROADMAP.md` · Ancien cadre mot-isolé : `dictee/legacy/` (superseded).
