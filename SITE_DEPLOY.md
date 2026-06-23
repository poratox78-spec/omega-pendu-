# Mettre le site en ligne

Le site est **statique** (3 fichiers à la racine : `index.html` = produit, `recherche.html` = recherche,
`site.css`). Aucun build. Il fait des liens **relatifs** vers `app/omega-pendu.html` (l'app) et
`docs/*.html` (mémoire/rapport) — donc il faut servir **tout le dépôt**, pas seulement le dossier du site.

> Remplace l'ancien `index.html` (qui redirigeait direct vers le jeu de pendu). Maintenant la page d'accueil
> est le **correcteur** (produit), avec l'app à un clic et la **recherche** en 2ᵉ page.

## Option A — GitHub Pages (le plus simple, gratuit)
1. Sur GitHub&nbsp;: **Settings → Pages**.
2. **Source** = *Deploy from a branch*.
3. **Branch** = `claude/cool-curie-ctnvhi` *(ou `main` une fois la PR #9 fusionnée)* · **Folder** = `/ (root)`.
4. Enregistre. L'URL apparaît au bout d'1-2 min&nbsp;:
   **https://poratox78-spec.github.io/omega-pendu-/**

> Servir depuis la **racine** (pas `/docs`) est important&nbsp;: sinon les liens vers `app/` ne marchent pas.

## Option B — Netlify / Vercel (domaine perso facile)
- Connecte le dépôt GitHub.
- **Build command**&nbsp;: *(vide)* · **Publish directory**&nbsp;: `.` (racine) · **Branch**&nbsp;: `claude/cool-curie-ctnvhi`.
- Tu obtiens une URL `*.netlify.app` (ou ton domaine).

## Option C — Tester en local
Ouvre simplement `index.html` (double-clic). Tout marche en `file://` (liens relatifs).

## Notes
- L'app `app/omega-pendu.html` fait ~5-7 Mo&nbsp;: le **premier** chargement prend quelques secondes, puis c'est instantané. Pages/Netlify la servent sans souci.
- Pour que l'accueil soit visible sur la branche par défaut du dépôt, il faudra **fusionner la PR #9 dans `main`** (sinon configure Pages directement sur la branche `cool-curie`).
- Contenu **à jour** au moment de l'écriture (juin 2026) ; pense à rafraîchir les chiffres si le correcteur évolue (source de vérité&nbsp;: `dictee/JOURNAL.md`).
