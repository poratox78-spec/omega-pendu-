# OMEGA-Ω — Correcteur dys (extension Chrome)

Correcteur orthographique et grammatical pour les **troubles de l'écrit (dys)**, **hors-ligne**, utilisable dans
**n'importe quel champ de saisie** du web. C'est le moteur du correcteur de `app/omega-pendu.html` (mesuré **FP=0**,
en parité avec la référence Python `dictee/correcteur_probe.py`) porté en extension — pour qu'il marche **partout**,
pas seulement dans une page dédiée.

> Objectif (Rem) : « corriger le texte directement dans la zone de saisie », partout, sans clé ni service en ligne.

## Le produit, c'est la couche dys
Le **moteur de correction est un consommable** ; **notre couche dys est le produit** : chaque faute est rattachée à
une **famille** → un **stade développemental** (phonologique → alphabétique → lexical → morphosyntaxique) → une
**remédiation ciblée**. La barre flottante affiche la correction **et** le stade **et** le conseil.

## Installer (mode développeur)
1. `chrome://extensions` → activer **Mode développeur**.
2. **Charger l'extension non empaquetée** → choisir ce dossier `extension/`.
3. Ouvrir n'importe quelle page, cliquer dans un champ texte, écrire (ex. `j'est le poisse`, `les enfants joue`,
   `le voiture`, `il son contents`). Une barre apparaît : clique une faute (ou **tout corriger**) → c'est appliqué
   **dans le champ**.

## Aide-frappe (complétion)
Pendant la frappe, pour le mot **sous le curseur**, la barre propose aussi des **complétions** — mots plus longs du
même préfixe, triés par fréquence et **accentués** (`recev` → `recevoir`, `télé` → `téléphone`). Clique pour insérer.
Réutilise le **même** lexique accentué (`speller.tsv.gz`) que la correction. **Hors périmètre de parité** : une
complétion est une suggestion d'UI, pas un *flag* FP=0 (l'invariant `flags ⊆ Python` n'est donc pas concerné).
La même complétion existe dans l'app (panneau « 🩹 Correcteur », **Tab** = accepter la 1re).

## Lien vers le site
L'en-tête du panneau porte **🌐 omegapendu.com** (globe seul en panneau étroit) : ouvre le site complet
(app, dictée, pendu) dans un nouvel onglet. `homepage_url` du manifeste pointe au même endroit.

## Architecture
| Fichier | Rôle |
|---|---|
| `dys-core.js` | **Le moteur** — copie **verbatim** des règles de l'app : GRAMMAIRE (homophones, accord sujet-verbe, genre déterminant, `j'est→j'ai`) **+ ORTHOGRAPHE** (`spellToken`/`spellText` : non-mots/accents/typos, AUTO/FLAG, élision) + couche dys (stades, remédiation) + **`complete()`** (complétion préfixe accentuée, hors parité). Sans DOM. |
| `assets/` | Lexiques extraits de l'app (`vdc-lex.json`, `gender-relaxed.tsv.gz`, `speller.tsv.gz` = 92 743 formes accentuées). Régénérés par `build_assets.py`. Données Lexique 4 → **CC BY-SA 4.0**. |
| `content.js` | S'accroche aux champs (`textarea`, `input`, `contenteditable`), lance le moteur (`diagnoseAll` = grammaire + orthographe), **applique en place** (gère la fusion de 2 tokens pour l'élision) ; affiche aussi les **complétions** du mot en cours (`DYSCORE.complete`). |
| `popup.html/js` | Réglages (activer/désactiver). |
| `parity_core.js` | Test grammaire : `dys-core.js` ⊆ Python sur la batterie de référence (aucun FP propre). |
| `test_speller.js` | Test orthographe : AUTO FP=0, hybride (accord contexte), accent-POS (élève/élevé), élision **+ parité directe `dys-core.spell()` ≡ `app.spellText()`**. |

## Régénérer / tester
```bash
python3 extension/build_assets.py      # ré-extrait les lexiques depuis l'app
node    extension/parity_core.js        # parité grammaire extension ↔ Python (FP=0)
node    extension/test_speller.js       # orthographe : FP=0 + parité ext ≡ app
```

## Police de son (panneau latéral)

Case **« 🔡 Police de son »** (OFF par défaut) dans les réglages du panneau : ta saisie, et la liste
des corrections, s'affichent en police OMEGA Dys — phonème **voisé = épais**, **sourd = fin**,
lettre **muette = vermillon** (teinte adaptée au fond clair/sombre). **« ✂️ Syllabes »** alterne la couleur
des syllabes (règle de l'attaque maximale). Le texte ne change jamais : seuls des `<span>` d'habillage
sont posés sur les nœuds texte (copier-coller = texte normal). Moteur : `assets/g2p.js` (g2p du moteur
OMEGA, extrait verbatim de l'app par `build_assets.py`) + `assets/son_core.js` (identique à
`police/son_core.js`, parité CI `police/parity_son.js`) + 3 TTF, chargés **paresseusement** à la
première activation. Surface panneau seulement : on n'habille jamais un champ de site tiers.

## Périmètre & limites (honnête)
- **Couvert (hors-ligne, FP=0)** :
  - **Grammaire** : homophones (a/à, son/sont, on/ont, et/est, ce/se, peu/peux/peut, leur/leurs, é/er, mais/mes),
    **accord sujet-verbe**, **genre déterminant** (`le voiture→la`), **`j'est→j'ai`**.
  - **Orthographe** (✅ phase 2 livrée) : non-mots/accents/typos (`fenetre→fenêtre` **AUTO**, `leson→leçon`,
    `oartir→partir`, `monagne→montagne` **FLAG**), désambiguïsation par le contexte (genre/nombre, POS : élève/élevé),
    **élision** (`c est→c'est`, `lannée→l'année`). Bleu dans la barre.
- **AUTO appliqué EN SILENCE** (comme l'app, `applyAutos`) : les corrections sûres (FP=0, ex. `fenetre→fenêtre`,
  `le gateau→gâteau`) se corrigent toutes seules — **sauf le mot sous le curseur** (en cours de frappe), et le
  curseur est repositionné. Les **FLAG** incertaines restent **cliquables** (soulignées, « · sûr » si AUTO en attente).
- **Phase 2b (à venir)** : couche **contexte** via **Gemini Nano** (Chrome intégré, hors-ligne).
- **Phase 3 (à venir)** : repli **clavier virtuel / zone de saisie universelle** pour les champs où l'injection
  directe est impossible (éditeurs riches, canvas).
- `contenteditable` : supporté en **texte simple** ; les éditeurs riches (Gmail, Docs) = best-effort pour l'instant.

## Licence
Code MIT. Données dérivées de Lexique 4 (`assets/`) sous **CC BY-SA 4.0** — voir `../NOTICE`.
