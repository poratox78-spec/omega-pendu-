# Complément Word « OMEGA Dys — police de son » (bêta)

La **quatrième surface** de la police de son, après le Correcteur, la Dictée et l'extension Chrome :
dans Word, le texte sélectionné (ou tout le document) est ré-inséré **caractère pour caractère** en
runs stylés — phonème **voisé = OMEGA Dys Heavy**, **sourd = Light**, **muette = grisée**, syllabes
en couleur (option). Le texte n'est **jamais** modifié : la garde est dans le code (`son_word.js`
refuse tout mot dont la reconstruction diffère) et en CI (`word/test_son_word.js`, g2p réel).

## Architecture (zéro duplication de moteur)

| Fichier | Rôle |
|---|---|
| `taskpane.html` | volet Word ; charge `../extension/assets/g2p.js` (g2p du moteur, extrait verbatim de l'app) et `../extension/assets/son_core.js` (== `police/son_core.js`), polices via `@font-face` pour l'aperçu |
| `son_word.js` | **planificateur pur** (sans Office.js) : mot → morceaux `{text, font, color}` ; testé sous node |
| `taskpane.js` | glue Office.js : `getTextRanges` (mots) → `insertText('Replace')` puis `insertText('After')` par morceau, police + couleur par run ; « Police seule » ; « Police d'origine » |
| `manifest.xml` | manifeste Office (TaskPaneApp, WordApi 1.3), pointe sur `https://omega-pendu.pages.dev/word/taskpane.html` |
| `test_son_word.js` | garde CI : texte identique partout, polices connues, ancres poison/poisson/chats, glue simulée |

## Installer (sideload — pas encore sur AppSource)

1. Installer les polices : pack `omega-police-dys.zip` (page Données) → les 3 `.ttf`.
2. Télécharger `manifest.xml` (ce dossier).
3. **Word Windows** : créer un dossier partagé (ex. `C:\OmegaDys\`, partage réseau `\\PC\OmegaDys`),
   Fichier → Options → Centre de gestion de la confidentialité → Paramètres → **Catalogues de compléments
   approuvés** → ajouter l'URL du partage, cocher « Afficher dans le menu », redémarrer Word →
   Insertion → Compléments → **Dossier partagé** → OMEGA Dys.
   **Word Mac** : copier `manifest.xml` dans `~/Library/Containers/com.microsoft.Word/Data/Documents/wef/`
   puis Insertion → Compléments → Mes compléments.
   **Word en ligne** : Insertion → Compléments → **Charger mon complément** → `manifest.xml`.
4. Ouvrir le volet, sélectionner du texte, « Appliquer la police de son ».

## Limites (honnêtes)

- **Non testé dans Word par nous** à ce stade : la logique est testée sous node avec le g2p réel et une
  glue Office simulée ; le premier essai réel dans Word est à faire (tout retour est bienvenu).
- Si les polices ne sont pas installées, Word substitue une police : le texte reste intact, la graisse
  ne suit pas.
- « Police d'origine » rétablit la police mémorisée à la première application et met la couleur en noir
  (pas « automatique »).
- Google Docs : impossible (pas de polices personnalisées).
