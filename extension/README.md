# OMEGA-Ω — Correcteur dys (extension Chrome)

Correcteur orthographique et grammatical pour les **troubles de l'écrit (dys)**, **hors-ligne**, utilisable dans
**n'importe quel champ de saisie** du web. C'est le moteur du correcteur de `app/omega-pendu.html` (mesuré **FP=0**,
en parité avec la référence Python `dictee/correcteur_probe.py`) porté en extension — pour qu'il marche **partout**,
pas seulement dans une page dédiée.

> Objectif (Rem) : « corriger le texte directement dans la zone de saisie », partout, sans clé ni service en ligne.

## Le produit, c'est la couche dys
Le **moteur de correction est un consommable** ; **notre couche dys est le produit** : chaque faute est rattachée à
une **famille** → une **remédiation ciblée**, écrite à partir du mot fautif. La barre flottante affiche la correction **et** le
conseil. (Le « stade développemental » n'est plus affiché depuis la 0.6.35 : sur un seul texte, avec des soupçons orange
dedans, il tombait presque toujours sur « alphabétique » et son message était souvent faux — mesuré, voir `dys-core.js`.)

## Mode d'emploi (utilisateur)
Le bouton **❓ Mode d'emploi** du panneau ouvre `aide.html`, une page du paquet (hors-ligne, sans script en ligne) : ouvrir le
correcteur, lire les couleurs, copier, écouter, dicter, la bulle et le clic droit, les réglages, la vie privée, les pannes.
Il décrit le code, et c'est gardé : `dictee/textes_probe.js` §9 (chaque libellé cité existe, chaque commande du panneau est
expliquée, les exemples sont de vraies sorties du moteur, le CSS des exemples est celui du panneau) et
`extension/navigateur_ext_probe.js` (bouton ❓ visible, page ouverte dans Chrome sans erreur, réglages suivis en direct).
`build_zip.py` refuse un paquet dont une page, un script ou une image référencés manquent.

## Publier sur le Chrome Web Store
Dossier de soumission complet (fiche prête à coller, justifications de chaque permission, déclarations de
confidentialité, captures à produire, commandes) : **`STORE.md`**. Techniquement le paquet est prêt —
icônes 16/32/48/128 (`build_icons.py`, dérivées de `icon-512.png`), `description` ≤ 132 caractères,
`minimum_chrome_version` 114, et `python3 extension/build_zip.py --store` produit le zip **avec
`manifest.json` à la racine** (ce que le Store exige, contrairement au zip du site). Reste le compte
développeur (5 $) et les captures d'écran.

## Installer (mode développeur)
1. `chrome://extensions` → activer **Mode développeur**.
2. **Charger l'extension non empaquetée** → choisir ce dossier `extension/`.
3. Cliquer l'icône Ω de l'extension : le panneau latéral s'ouvre. Écrire ou coller un texte (ex. `les enfants joue`,
   `le voiture`, `il son contents`) : les corrections sûres sont appliquées au texte corrigé, « 📋 Copier » le copie.
   La bulle dans la page (clic sur une faute → appliqué **dans le champ**) est une option du panneau, décochée par défaut.
   Le bouton **❓** ouvre le mode d'emploi.

## Aide-frappe (complétion)
Pendant la frappe, pour le mot **sous le curseur**, la barre propose aussi des **complétions** — mots plus longs du
même préfixe, triés par fréquence et **accentués** (`recev` → `recevoir`, `télé` → `téléphone`). Clique pour insérer.
Réutilise le **même** lexique accentué (`speller.tsv.gz`) que la correction. **Hors périmètre de parité** : une
complétion est une suggestion d'UI, pas un *flag* FP=0 (l'invariant `flags ⊆ Python` n'est donc pas concerné).
La même complétion existe dans l'app (panneau « 🩹 Correcteur », **Tab** = accepter la 1re).

## Miroir fidèle et rouges d'office (panneau)
- **Miroir** (« Recopier ce que je tape sur la page ») : le panneau reflète le champ actif **vide compris** —
  un site qui vide le champ sans frappe (bouton « Envoyer », éditeur riche) est vu par une sonde 500 ms ;
  changer d'onglet vide le panneau ; et la zone du panneau ne bloque plus le miroir après « Tout corriger »
  (l'ancienne garde `activeElement` survivait à la perte de focus fenêtre → panneau figé).
- **Rouges d'office** : comme sur le site, le FP=0 (auto + rouge) est appliqué dans le **texte corrigé**
  (aperçu vert sous les boutons) et c'est lui que **📋 Copier** copie ; la zone reste intacte (pas de bataille
  avec le miroir). Chaque rouge se révoque d'un clic (« annuler » / « réappliquer »). L'orange reste au clic.
  « ✓ Tout corriger » écrit le corrigé dans la zone (réversible par ↩).

## Lien vers le site
L'en-tête du panneau porte **🌐 omegapendu.com** (globe seul en panneau étroit) : ouvre le site complet
(app, dictée, pendu) dans un nouvel onglet. `homepage_url` du manifeste pointe au même endroit.

## Architecture
| Fichier | Rôle |
|---|---|
| `dys-core.js` | **Le moteur** — copie **verbatim** des règles de l'app : GRAMMAIRE (homophones, accord sujet-verbe, genre déterminant, `j'est→j'ai`) **+ ORTHOGRAPHE** (`spellToken`/`spellText` : non-mots/accents/typos, AUTO/FLAG, élision) + couche dys (familles, remédiation) + **`complete()`** (complétion préfixe accentuée, hors parité). Sans DOM. |
| `assets/` | Lexiques extraits de l'app (`vdc-lex.json`, `gender-relaxed.tsv.gz`, `speller.tsv.gz` = 92 743 formes accentuées). Régénérés par `build_assets.py`. Données Lexique 4 → **CC BY-SA 4.0**. |
| `content.js` | S'accroche aux champs (`textarea`, `input`, `contenteditable`), lance le moteur (`diagnoseAll` = grammaire + orthographe), **applique en place** (gère la fusion de 2 tokens pour l'élision) ; affiche aussi les **complétions** du mot en cours (`DYSCORE.complete`). |
| `icons/` | Icônes 16/32/48/128 exigées par Chrome et le Store — **dérivées** de `icon-512.png` par `build_icons.py` (pur Python, déterministe, gardé en CI). |
| `build_zip.py` | Paquet livré : sans option = zip du **site** (à dézipper → extension non empaquetée) ; `--store` = paquet **Chrome Web Store** (manifeste à la racine) ; `--check` = garde de fraîcheur CI. |
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

## Aide au nombre & calcul (panneau latéral)

Bloc **« 🔢 Aide au nombre »** (repliable, `#omdys-calc`) dans le panneau : on y écrit un nombre ou une expression, et
l'extension rend la réponse sous **trois formes** — groupé (`1 234 567`), **en toutes lettres**, et
la **valeur de position** chiffre par chiffre (« le 3 de 305 vaut 300 »). C'est l'outil **rapide** :
on écrit ailleurs, on veut le résultat, lisible.

⛔ **Aucun `eval`, jamais.** Une saisie utilisateur passée à `eval` dans une extension à
`<all_urls>` serait une porte ouverte — et le Store la refuserait à juste titre. L'expression est
analysée par un analyseur descendant maison (4 opérations, parenthèses, virgule décimale
française). Une saisie invalide **rend `null`** et l'interface affiche une raison : elle n'invente
pas un résultat.

Moteur : `calc_dys.js`, **copie exacte** de `calc_dys.js` à la racine du dépôt (celui de la page
[`/calcul`](https://omegapendu.com/calcul) du site). Les deux sont gardées par
`dictee/calc_dys_probe.js` (batterie + CI) : octets identiques **et** comportement interrogé.
La version **développée** — les quatre opérations posées en colonnes, chaque retenue expliquée,
la division en potence — est sur le site, pas ici : le panneau sert à aller vite.

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
