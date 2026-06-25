# OMEGA-Ω — Correcteur dys · bundle de test

Deux versions du **même moteur** de correction (orthographe + grammaire pour les troubles de l'écrit),
à tester indépendamment. Le moteur est **identique** dans les deux (parité vérifiée) : tout ce qui marche
dans l'un marche dans l'autre. **100 % hors-ligne**, aucune donnée envoyée.

Contenu :
```
extension/   → l'extension Chrome (correcteur dans N'IMPORTE QUEL champ de saisie)
app/         → le jeu de pendu OMEGA, qui embarque les panneaux Dictée + Correcteur
```

---

## 1) Extension Chrome — corrige dans n'importe quel champ

1. Ouvre **chrome://extensions** (ou edge://extensions).
2. Active **« Mode développeur »** (coin haut-droit).
3. Clique **« Charger l'extension non empaquetée »** et choisis le dossier **`extension/`**.
4. Va sur n'importe quelle page avec un champ texte (Gmail, un forum, une zone de commentaire…),
   clique dans le champ et **écris**. Une petite barre **🩹 Correcteur dys** apparaît sous le champ.
   - **Accents/non-mots sûrs** (ex. `fenetre`→`fenêtre`) : corrigés **tout seuls, en silence** (FP=0).
   - **Homophones / accords / genre** (ex. `les enfants joue`, `un maison`, `Je doit`) : **soulignés**,
     clic sur la suggestion = applique la correction + affiche le **stade développemental** + la remédiation.

Phrases d'essai à coller dans un champ :
```
Les enfant joue dans le jardin et il sont content. Je doit manger. On ont gagné.
j'est le poisse de oartir à la monagne
la fenetre est ouverte mais voiture est rouge
```

> Note : sur certaines pages (éditeurs riches type Google Docs), le contenteditable est best-effort.
> Les champs simples (`input`, `textarea`) et la plupart des zones de saisie marchent directement.

---

## 2) App pendu (panneau Correcteur intégré)

1. **Double-clique `app/omega-pendu.html`** (s'ouvre dans le navigateur — fichier autonome, ~8 Mo,
   nécessite un navigateur ≥ 2023 pour la décompression du lexique).
2. En bas, deux boutons :
   - **« ✍️ Dictée diag »** — dictée diagnostique de phrases (diagnostic par famille d'erreurs).
   - **« 🩹 Correcteur »** — colle/écris un texte, il **détecte + corrige + situe le stade**.

---

## Ce que le correcteur couvre (périmètre mesuré)

| Couche | Exemples | Comportement |
|---|---|---|
| Orthographe (non-mots/accents) | `fenetre`→`fenêtre`, `leson`→`leçon` | AUTO sûr (FP=0) ou souligné |
| Homophones grammaticaux | a/à, son/sont, on/ont, leur/leurs, -é/-er, ce/se, et/est, peu/peux/peut | souligné + suggestion |
| Accord sujet-verbe | `les enfants joue`→`jouent`, `Je doit`→`dois` | souligné + suggestion |
| Genre du déterminant | `un maison`→`une`, `la fondateur`→`le` | souligné + suggestion (garde POS-155k) |

**Garde-fou cardinal = ne jamais « corriger » du texte juste.** Mesuré : FP **0** sur batterie ;
**2,35 %** sur français encyclopédique réel (UD French, 16 342 phrases) — le domaine dys (phrases
courtes) est plus bas. Sur ces 2,35 %, les classes résiduelles (a/à, on/ont) exigent un modèle de
contexte, pas branché (au profit du FP-safe).

---

*Données dérivées de Lexique 4 (New et al., 2026) — licence CC BY-SA 4.0. Voir `NOTICE` dans le dépôt.*
