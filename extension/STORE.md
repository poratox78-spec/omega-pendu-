# Publier l'extension sur le Chrome Web Store — dossier de préparation

> ✅ **PUBLIÉE le 28/08/2026** — revue Google passée, état « Publié · public ».
> Fiche : https://chromewebstore.google.com/detail/dbochkbaechbemahapplibbhmfkcldln
> ID : `dbochkbaechbemahapplibbhmfkcldln` · version en ligne : **0.6.0** — **0.6.2 téléversée par Rem le 03/09/2026**, puis **0.6.3 téléversée le 04/09/2026** (revue Google en cours) — **0.6.4 PRÊTE le 11/09/2026, non téléversée** : le « e » muet du futur exige un verbe courant (garde mesurée, 3 moteurs ; `revérrons` n'est plus cassé)
>
> Ce fichier reste le **dossier de soumission** : tout ce qui se colle dans la console développeur est
> écrit ici, prêt à copier, et sert tel quel pour **chaque mise à jour** — le §3 (fiche), le §4
> (justifications) et le §5 (données) sont redemandés à chaque envoi qui touche aux permissions.
> ⚠️ Toute mise à jour exige une `version` **strictement supérieure à 0.6.2 (dernière téléversée)**, et repasse en revue.

## 0. Où on en est

| # | Point | État |
|---|---|---|
| 1 | Icônes 16/32/48/128 déclarées dans le manifeste | ✅ `extension/icons/`, dérivées de `icon-512.png` (`build_icons.py`) |
| 2 | `description` du manifeste ≤ 132 caractères | ✅ 119 (elle en faisait **343** → refus automatique) |
| 3 | Paquet avec `manifest.json` **à la racine** du zip | ✅ `python3 extension/build_zip.py --store` |
| 4 | `minimum_chrome_version` cohérent avec les API utilisées | ✅ `114` (c'est la version qui introduit `sidePanel`) |
| 5 | Manifeste accepté par le parseur de Chrome lui-même | ✅ mesuré : `chrome --pack-extension` produit un `.crx` (cf. §8) |
| 6 | Aucun code distant (politique « Remote code ») | ✅ mesuré : aucun `eval`/`new Function`, aucun `fetch` http, aucun `<script src>` externe |
| 7 | Permissions toutes réellement utilisées | ✅ `storage`, `contextMenus`, `sidePanel` — et **pas** de `tabs` (cf. §4) |
| 8 | Politique de confidentialité publique couvrant **l'extension** | ✅ `omegapendu.com/confidentialite` — SANS `.html`, l'autre renvoie un 308 (section « L'extension Chrome ») |
| 9 | Compte développeur (5 $ US, une fois) + e-mail de contact vérifié | ✅ fait par Rem |
| 10 | Captures d'écran 1280×800 (1 à 5) | ✅ fournies par Rem |
| 11 | Remplir la fiche + les justifications, envoyer | ✅ envoyé et **accepté** le 28/08/2026 |
| 12 | Après publication : mettre à jour `correcteur.html` | ✅ fait le 28/08/2026 — bouton « Ajouter à Chrome », repli manuel gardé dans un `<details>` |
| 13 | **Prochaine mise à jour** : `version` **strictement supérieure** à celle publiée | ✅ montée à **0.6.4** le 11/09/2026 (garde du e muet du futur, `manifest.json`) — auparavant **0.6.3** le 03/09/2026 — la **0.6.2 a été téléversée par Rem le 03/09/2026** (état de main après #652 : lexique 705 653 formes, questions sans trait d'union, panneau latéral qui applique, relative en « qui », parseur de sujet d'abord). La 0.6.3 rattrape **#654** (règles de forme avant le nombre, « faire » semi-auxiliaire, participe présent après « en », gardes de sujet). ⚠️ Un numéro remis à Rem est brûlé : bumper le manifest AVANT de reconstruire un paquet. |
| 14 | Le bloc **« 🔢 Aide au nombre »** est décrit dans la fiche | ✅ paragraphe du §3 collé à l'envoi du 28/08/2026 |
| 15 | **Paquet à téléverser** : `omega-correcteur-dys-store.zip` (manifest à la racine, v0.6.3) | ✅ régénéré le 03/09/2026 par `python3 extension/build_zip.py --store` — ✅ **téléversé par Rem le 04/09/2026** (revue Google en cours ; la prochaine mise à jour devra être > 0.6.3) |

## 1. Ce qui était bloquant et qui est corrigé

- **Pas une seule icône.** Le Store exige une 128×128 (fiche, gestionnaire d'extensions) et Chrome
  affiche 16/32/48 (barre d'outils, `chrome://extensions`). Sans elles : refus à l'upload.
  → `extension/build_icons.py` les **dérive** de `icon-512.png` (l'icône déjà servie par le site) : même
  marque, pas de second logo à maintenir. Zéro dépendance (décodage/rééchantillonnage/réencodage PNG en pur
  Python), sortie déterministe, gardée par `--check`.
- **`description` = 343 caractères.** La limite du manifeste est **132**. Le pitch long n'est pas perdu :
  il devient la description de la fiche (§3), qui, elle, accepte 16 000 caractères.
- **Le zip commité n'est pas un paquet Store.** `omega-correcteur-dys.zip` range tout sous `extension/`
  (c'est voulu : on le dézippe et on charge le dossier en mode développeur). Le Store, lui, veut
  `manifest.json` **à la racine** — sinon « *Manifest file is missing or unreadable* ».
  → `--store` produit `omega-correcteur-dys-store.zip` (racine aplatie, `README.md` retiré, 31 fichiers,
  4,0 Mo). **Non commité** (artefact de publication, `.gitignore`) ; le zip du site reste commité et gardé frais en CI.

## 2. Compte développeur ⬜ Rem

1. https://chrome.google.com/webstore/devconsole — **frais uniques de 5 $ US**, compte Google ordinaire.
2. **Vérifier l'adresse e-mail de contact** (obligatoire, sinon la soumission est bloquée).
3. ⚠️ Si Google REDEMANDE une vérification de domaine : le fichier `googleaadee2f545868c76.html` est
   servi **après un 308** (Cloudflare retire le `.html`), son contenu est correct à
   `/googleaadee2f545868c76`. Ça a marché la première fois, mais si une re-vérification échoue, la
   cause est là — pas un fichier manquant.
4. Le domaine `omegapendu.com` est **déjà vérifié auprès de Google** (`googleaadee2f545868c76.html` à la
   racine du site) : rattache-le dans la console → l'éditeur peut alors s'afficher comme **vérifié** et le
   `homepage_url` du manifeste est accepté sans discussion.

## 3. Fiche du Store — copie prête à coller

**Nom** (max 75) — `OMEGA-Ω — Correcteur dys`

**Résumé court** (max 132, celui du manifeste) —
`Correcteur d'orthographe et de grammaire pour les dys : hors-ligne, dans le panneau latéral, avec stade et remédiation.`

**Catégorie** — **Accessibilité** (et non « Productivité » : la cible est le trouble de l'écrit ; la
catégorie est moins encombrée et dit la bonne promesse).

**Langue** — Français.

**Description détaillée** :

```
Un correcteur pensé pour les troubles de l'écrit (dyslexie, dysorthographie) — pas un correcteur
générique avec une police différente.

Tout se passe dans le panneau latéral de Chrome : ce que vous tapez dans la page s'y recopie, vous
corrigez, vous copiez. Rien ne sort de votre appareil.

CE QU'IL CORRIGE
• Les mots qui n'existent pas : accents, fautes de frappe, écriture phonétique (fenetre → fenêtre,
  leson → leçon, monagne → montagne), élisions (c est → c'est, lannée → l'année).
• Les homophones grammaticaux : a/à, son/sont, on/ont, et/est, ce/se, peu/peux/peut, leur/leurs,
  -é/-er, mais/mes.
• Les accords : sujet-verbe (« les enfants joue » → jouent), pluriel du nom (« des ami » → amis),
  genre du déterminant (« le voiture » → la), participe passé.

CE QUI LE REND DIFFÉRENT
• Deux niveaux de confiance, jamais un seul. Les corrections sûres sont appliquées ; les incertaines
  sont seulement signalées, et se posent d'un clic. On ne réécrit jamais votre texte en douce.
• Chaque faute est rattachée à une famille d'erreur, donc à un stade d'écriture (phonologique,
  alphabétique, lexical, morphosyntaxique) et à un conseil de remédiation. C'est la couche utile :
  savoir POURQUOI on s'est trompé.
• Police de son (option) : phonème voisé en gras, sourd en fin, lettre muette en couleur, découpage
  en syllabes. Le texte lui-même n'est jamais modifié — copier-coller donne du texte normal.
• Dictée vocale et lecture à voix haute, pour écrire sans passer par le clavier et se relire à l'oreille.

HORS-LIGNE
Le dictionnaire (plus de 200 000 formes) et toutes les règles sont embarqués dans l'extension. Aucun
compte, aucune clé, aucun serveur : la correction fonctionne sans connexion, et votre texte n'est jamais
envoyé nulle part. Seule exception, optionnelle et désactivée par défaut : la dictée vocale, qui utilise
le service de reconnaissance vocale du navigateur (Google) — un encart vous le dit au moment de l'activer.

Gratuit, sans publicité, sans traqueur. Code ouvert : github.com/poratox78-spec/omega-pendu-
Données linguistiques dérivées de Lexique 4 (CC BY-SA 4.0).
```

### À AJOUTER à la description lors du prochain envoi

Le panneau a gagné depuis le premier dépôt un bloc **« 🔢 Aide au nombre »** (aide au calcul, cible
dyscalculie) que la fiche ci-dessus ne décrit pas. Paragraphe à insérer après « CE QU'IL CORRIGE » :

```
AUSSI POUR LES NOMBRES
Le panneau lit et écrit les nombres : 1 234 567 s'affiche aussi en toutes lettres, et chaque
chiffre est situé à sa place (le 3 de 305 vaut trois cents). Une expression simple est calculée
et sa réponse rendue sous les mêmes formes lisibles. Pour apprendre à POSER l'opération en
colonnes, avec les retenues expliquées, la version développée est sur omegapendu.com/calcul.
```

⚠️ Ne pas coller ce paragraphe sans **monter le numéro de version** (ligne 13 du §0).

## 4. Justifications — onglet « Confidentialité » de la console

Google demande **une phrase par permission**, plus l'objectif unique. Textes à coller :

**Objectif unique (single purpose)**
```
Aider les personnes ayant un trouble de l'écrit (dyslexie, dysorthographie) à écrire : détecter et
corriger leurs fautes d'orthographe et de grammaire dans le navigateur, hors-ligne, et leur expliquer
à quelle famille d'erreur et à quel stade d'écriture chaque faute correspond.
```

**`storage`**
```
Mémoriser les réglages de l'utilisateur (activation, taille et lisibilité du texte, thème, police de
son, corrections annulées) et son profil d'erreurs par famille, qui sert à proposer la remédiation.
Ces données restent locales : elles ne sont ni transmises ni synchronisées.
```

**`contextMenus`**
```
Ajouter une entrée « Correcteur dys » au clic droit dans un champ éditable, pour corriger le mot sous
le curseur sans quitter le clavier — le chemin le plus court pour un utilisateur qui écrit lentement.
```

**`sidePanel`**
```
Le correcteur s'affiche dans le panneau latéral : c'est la surface où l'utilisateur voit son texte,
les corrections, le stade et le conseil, sans que l'extension modifie l'apparence des pages visitées.
```

**Accès à tous les sites (`<all_urls>` du content script)**
```
Le besoin est d'écrire correctement PARTOUT : formulaire d'inscription, messagerie, ENT scolaire,
recherche d'emploi, réseau social. L'extension ne peut pas savoir à l'avance sur quel site l'utilisateur
écrira. Le script de contenu lit uniquement le texte du champ de saisie actif, pour le corriger sur
l'appareil et le recopier dans le panneau. Il ne lit pas le contenu des pages, ne suit pas la navigation,
n'envoie rien sur le réseau, et n'utilise pas la permission « tabs » (les événements d'onglet servent
seulement à vider le panneau quand on change de page).
```

**Code distant** — répondre **Non** : *« Je n'utilise pas de code distant »*. C'est vrai et vérifiable :
tout le moteur et les lexiques sont dans le paquet, aucun `fetch` vers un domaine externe, aucun `eval`.

## 5. Déclarations d'utilisation des données

Les trois cases obligatoires — cocher les trois, elles sont exactes :
- ✅ Je ne vends ni ne transfère les données des utilisateurs à des tiers, sauf usages approuvés.
- ✅ Je n'utilise ni ne transfère les données des utilisateurs à des fins sans rapport avec l'objectif unique.
- ✅ Je n'utilise ni ne transfère les données des utilisateurs pour évaluer la solvabilité ou accorder des prêts.

**Catégories collectées : aucune.** L'extension ne transmet rien : la correction est calculée sur
l'appareil, les réglages restent dans `chrome.storage.local`.

⚠️ **Le point à ne pas cacher : la dictée vocale.** Si l'utilisateur l'active (désactivé par défaut,
avec un encart explicite), le navigateur envoie l'audio au service de reconnaissance vocale de Google —
c'est l'API `SpeechRecognition` de Chrome, pas un serveur à nous, et nous n'en recevons rien.
**Recommandation : le dire quand même**, dans la politique de confidentialité (c'est fait) et dans le
champ libre de justification. Un examinateur qui découvre un `SpeechRecognition` non mentionné suspend la
publication ; un examinateur à qui on l'a annoncé passe.

**URL de la politique de confidentialité** : `https://omegapendu.com/confidentialite`
⚠️ **SANS le `.html`** — vérifié en production le 2026-08-25 : `confidentialite.html` renvoie un
**308** vers l'URL sans extension, `confidentialite` renvoie **200** directement. Cloudflare Pages
retire le `.html`. C'est exactement le piège de PR#576, où Google avait exclu des pages de son index
pour cette raison. On donne à l'examinateur l'URL qui répond 200 du premier coup.
(la section « L'extension Chrome » couvre nommément l'extension, comme l'exige le Store).

## 6. Visuels ⬜ Rem

| Visuel | Format | État |
|---|---|---|
| Icône du Store | 128×128 PNG | ✅ `extension/icons/icon128.png` |
| Captures d'écran | **1280×800** (ou 640×400), PNG ou JPEG 24 bits **sans canal alpha**, 1 à 5 | ⬜ |
| Petite vignette promo | 440×280 | ⬜ facultative (nécessaire seulement pour être mis en avant) |

Les 4 captures qui racontent le produit, dans cet ordre :
1. **Le panneau en action** — un texte dys réel, corrections en vert, une orange soulignée.
2. **Le pourquoi** — la carte d'une correction dépliée : famille d'erreur + stade + conseil de remédiation.
3. **La police de son** — même phrase, voisé/sourd/muette/syllabes.
4. **Hors-ligne** — le panneau qui corrige, Wi-Fi coupé (le seul argument que personne d'autre n'affiche).

Conseil : capturer sur une fenêtre à 1280×800 exactement, fond clair, et **ne pas** mettre de texte
marketing par-dessus (Google refuse les captures surchargées).

## 7. À quoi s'attendre à la revue

- **`<all_urls>` = revue lente.** Compter de quelques jours à quelques semaines, pas quelques heures.
  C'est le prix du « partout », et c'est justement la promesse du produit. La justification du §4 est
  écrite pour ça : elle dit ce que le script lit (le champ actif) et ce qu'il ne lit pas (la page).
- **Paquet de 4 Mo.** Normal et défendable : ce sont les lexiques embarqués, c'est ce qui permet le
  hors-ligne. Aucune limite du Store n'est approchée.
- **Micro.** `micro.html` demande l'autorisation micro dans un vrai onglet (le panneau latéral ne peut
  pas afficher l'invite). Fonctionnalité optionnelle, déclarée au §5.
- **Refus le plus probable** : une justification jugée trop vague. Si ça arrive, ne pas réécrire le
  produit — répondre en citant §4 mot pour mot, c'est le niveau de détail que Google demande.

## 8. Commandes

```bash
# 1. régénérer les assets depuis l'app (source unique du moteur)
python3 extension/build_assets.py

# 2. les gardes qui doivent être vertes AVANT de publier
node   extension/parity_core.js          # parité moteur extension ↔ Python (FP=0)
node   extension/test_speller.js         # orthographe : FP=0 + parité extension ≡ app
node   extension/assets_wired_probe.js   # aucun asset livré-mais-muet
python3 extension/build_icons.py --check # icônes fraîches (== icon-512.png)
python3 extension/build_zip.py  --check  # zip du site frais (== sources)
#   ou tout d'un coup : bash dev.sh

# 3. le paquet à téléverser
python3 extension/build_zip.py --store   # → omega-correcteur-dys-store.zip (non commité)

# 4. validation locale par Chrome lui-même (facultatif, mais c'est SON parseur qui tranche)
unzip -q omega-correcteur-dys-store.zip -d /tmp/ext
chrome --pack-extension=/tmp/ext         # produit /tmp/ext.crx si le manifeste est valide
```

## 9. Après publication

- ✅ **Fait le 28/08/2026.** `correcteur.html` et `en/correcteur.html` portent le bouton
  « Ajouter à Chrome » vers la fiche, et le zip + la marche à suivre manuelle sont **gardés** dans un
  `<details>` replié, pour Firefox, Chromium sans Store et les postes d'école qui bloquent le Store.
  `zh/correcteur-zh.html` n'a jamais eu de bloc d'installation : rien à y faire (le chinois reste privé).
- ⚠️ **L'extension est FRANÇAISE, et la page anglaise le dit maintenant.** Elle n'a ni `_locales` ni
  `default_locale`, et son paquet ne contient que des données FR. `en/correcteur.html` annonçait
  « Download the extension » en pointant sur le zip français — un défaut **antérieur** à la publication,
  réparé le même jour : le bloc s'y intitule « Browser extension — corrects French » et renvoie vers
  l'app web anglaise (`dictee/corrector_en.js`) pour qui veut corriger de l'anglais.
- 🎯 **Reste ouvert : localiser l'interface de l'extension** (`_locales` + `default_locale`, puis la
  fiche multilingue). C'est un vrai chantier, et il imposerait un bump de version **et une nouvelle
  revue Google** — à décider à froid, pas dans la foulée de la publication.
- **Versions** : le Store refuse un envoi dont la `version` n'augmente pas. Une publication = un bump de
  `version` dans `manifest.json` (+ régénération du zip du site, gardé frais en CI).
- La première publication d'un nouvel éditeur peut être soumise à une **période probatoire** avant que
  l'extension soit listée publiquement dans la recherche : ne pas s'inquiéter d'un référencement lent.
