# 📌 POST-IT — Correcteur dys : état (option 3 retenue + volet LLM)

> Synthèse rapide (2026-06-20). Détail mesuré : `dictee/JOURNAL.md` · `dictee/CORRECTEUR.md`. PR #9 (`claude/cool-curie-ctnvhi`).

## 🎯 OBJECTIF — verrouillé (ne pas dériver)
**Le moteur de correction est un CONSOMMABLE. NOTRE cognition dys est LE PRODUIT.** On ne devient pas un wrapper.

```
   [ MOTEUR de correction ]  ← interchangeable, le meilleur dispo
       règles MAISON (nos données)  = hors-ligne, FP=0, dans l'app — AMÉLIORÉES (genre, mais/mes…)
       (Grammalecte ÉCARTÉ : ses données sont REDONDANTES avec les nôtres + GPL-3.0 → option 3 retenue)
       LLM / modèle local           = plafond CONTEXTE (cloud opt-in · Ollama local · **Chrome Nano câblé** · WebLLM)
                    │  produit des erreurs (offsets, suggestions, FAMILLE)
                    ▼
   [ NOTRE COUCHE DYS ]  ← LE PRODUIT, jamais remplacé, agnostique au moteur
       erreur → FAMILLE → STADE développemental → REMÉDIATION ciblée   (double-route OMEGA)
```
**Décision (Rem, « 3 oui ») :** on écrit nos propres règles sur **nos** données (zéro dépendance, zéro bloat, **licence MIT conservée**) ; le **LLM** ne fait que le **contexte** par-dessus ; **notre couche dys** est le produit.

## ✅ FAIT (mesuré + poussé)
| Brique | État | Chiffre clé |
|---|---|---|
| **Règles MAISON améliorées** (nos données) | livré | **genre relâché** `le voiture→la` (Python+**APP**, +0,19 Mo) · **mais→mes** · **j'est→j'ai** (avoir/être, déterminant-gardé) — Python+**APP**, parité+**FP TOTAL = 0/98 GEC** |
| **3 pistes « sans contexte »** | **FALSIFIÉES** (sondes+CI) | did-you-mean · phonème (g2p-sur-typo) · morpho→trexquant (thèse §1.8) |
| **LA COLLE** (notre couche dys) | **câblée** | sortie moteur (LLM `famille`) → **STADE dys affiché** par-dessus (engine-agnostic) |
| **Remédiation ciblée PAR FAMILLE** | **livré** | table `REMED` (8 stratégies orthophonie ancrées double-route) → `remedBlock` aux **3 sorties + profil** ; correctif stade règles (homophone≠accord) |
| **Plafond LLM** | mesuré (moi = modèle fort) | **récall ~total · FP≈1-2/30** (gold GEC parfois faux) — `je sui dan le voiture…` = **6/6** |
| **LLM opt-in** | **câblé dans l'app** | OFF par défaut · clé dans l'UI · OpenAI-compatible → marche aussi **local (Ollama)** |
| **Chrome Nano (local)** | **câblé dans l'app** | case 🧠 → Prompt API hors-ligne, **sans clé/égress** · JSON contraint · même COLLE (stade) · à mesurer chez Rem |
| ~~Grammalecte~~ | **ÉCARTÉ** | données redondantes + GPL → on garde nos règles (option 3) |

## 🧩 EXTENSION CHROME (`extension/`, pivot produit — phase 1 livrée)
**Objectif (Rem)** : corriger **dans n'importe quel champ**, hors-ligne. Moteur = **réutilisé** (`dys-core.js` = copie
verbatim du correcteur app, **parité ⊆ Python, FP=0**, en CI). Barre flottante → clic = corrige **dans le champ** +
**stade + remédiation**. Charger `extension/` via `chrome://extensions` (mode développeur). **Phase 2** = speller
(typos) + Nano (contexte) · **Phase 3** = clavier virtuel / zone universelle.

## ⚠️ OUVERT — baseline moteur (NE PAS oublier)
Rem : « la base à ne pas toucher a **peut-être** bougé, résultats **peut-être** différents — n'invente pas ». Fait : le
**lexique moteur embarqué** a changé (83k→155k, `9d3763c` ; mb réintégré, `3ff98c1`) dans la fenêtre décompose, et le
banc `fitness_harness` lit ce lexique → **audit profond à faire** (`AUDIT_BASELINE.md`). **Ne PAS « réparer » sans A/B.**

## ⏳ EN COURS / EN ATTENTE
1. **Tester l'extension chez Rem** (Chrome, mode développeur) : charger `extension/`, écrire dans un champ.
2. **Mesurer Chrome Nano chez Rem** (je ne peux pas l'exécuter en conteneur) : qualité + FP dans **Chrome/Edge ≥ 138**.
3. **Phase 2 extension** : porter le speller (non-mots/accents) + Nano dans `dys-core.js`/`content.js`.
4. **Couche dys — suite** : remédiation **par stade global**, suivi **longitudinal**, exercices générés.

## 🧭 Carte mentale (mesurée)
- **Limite partout = le CONTEXTE** (3 falsifications). Ce qui est faisable **hors-ligne sur nos données** = fait (genre, mais/mes, FP=0) ; le reste (`je sui`, `j'est`, `bouliées`) = **contexte → LLM**.
- **Moteur = consommable** : nos règles (plancher hors-ligne) + LLM (contexte, opt-in). **Pas de Grammalecte, pas de GPL.**
- **Notre travail = la couche dys** (famille→stade→remédiation). **C'est ÇA qu'on développe.**

## 📍 Où
PR #9 `claude/cool-curie-ctnvhi`, tête **`3dd7bd9`**, CI verte. Tout committé/poussé. **Licence : MIT** (Grammalecte écarté).
