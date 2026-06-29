# Mettre le site en ligne

Le site est **statique** (`index.html` = **le pendu** (accueil/vitrine), `correcteur.html`, `dictee.html`, `scrabidon.html`, `recherche.html`, `evolution.html`, `omega-key.html`, `site.css`, + le **PWA** :
`manifest.json`, `sw.js`, `icon.svg`). Aucun build. Il fait des liens **relatifs** vers `app/omega-pendu.html`
(l'app, ~9 Mo, **monolithe entier — pendu inclus**) et `docs/*.html` (mémoire/rapport) — donc il faut servir
**tout le dépôt**, pas seulement le dossier du site. Chemins relatifs (`./`) → marche aussi bien sous le
sous-chemin GitHub Pages que sur un domaine perso.

> La page d'accueil est **le pendu** (le solveur / vitrine), avec l'app jouable à un clic. Le **correcteur**,
> la **dictée**, **Scrabidon**, la **recherche** et l'**évolution** ont chacun leur propre page (voir la nav).

## Option A — GitHub Pages (le plus simple, gratuit)
1. Sur GitHub&nbsp;: **Settings → Pages**.
2. **Source** = *Deploy from a branch*.
3. **Branch** = `main` *(branche déployée)* · **Folder** = `/ (root)`.
4. Enregistre. L'URL apparaît au bout d'1-2 min&nbsp;:
   **https://poratox78-spec.github.io/omega-pendu-/**

> Servir depuis la **racine** (pas `/docs`) est important&nbsp;: sinon les liens vers `app/` ne marchent pas.

## Option B — Netlify / Vercel (domaine perso facile)
- Connecte le dépôt GitHub.
- **Build command**&nbsp;: *(vide)* · **Publish directory**&nbsp;: `.` (racine) · **Branch**&nbsp;: `main`.
- Tu obtiens une URL `*.netlify.app` (ou ton domaine).

## Option C — Tester en local
Ouvre simplement `index.html` (double-clic). Tout marche en `file://` (liens relatifs). *Le service-worker (PWA)
est volontairement inactif en `file://`* — il ne s'active qu'en `http(s)`, sans erreur en local.

## PWA — installable + hors-ligne (déjà câblé)
`manifest.json` + `sw.js` (enregistré depuis `index.html` **et** l'app) rendent le site **installable** (icône
bureau/mobile) et **hors-ligne** : le monolithe ~9 Mo se met en cache au 1er chargement (*stale-while-revalidate*),
puis se sert **instantanément**. La compression du host (gzip GH Pages ≈ 3 Mo / brotli Cloudflare ≈ 2-2,5 Mo) fait
le reste — « 9 Mo » réels transférés une seule fois.
- **Pousser une mise à jour** aux visiteurs : incrémenter `V` en tête de `sw.js` (`omega-v1` → `omega-v2`) à chaque
  déploiement (sinon l'ancien cache persiste).
- `_headers` (Cloudflare/Netlify, ignoré par GH Pages) force `no-cache` sur `sw.js` et le bon MIME du manifest.

## Notes
- L'app `app/omega-pendu.html` fait ~9 Mo (surtout du base64 → compresse ~3×)&nbsp;: le **premier** chargement prend quelques secondes, puis c'est instantané (cache + PWA). Pages/Netlify/Cloudflare la servent sans souci.
- Le déploiement se fait depuis **`main`** (push direct) ; à chaque mise à jour visible, incrémenter `V` dans `sw.js` pour forcer le rafraîchissement du cache PWA.
- Contenu **à jour** au moment de l'écriture (juin 2026) ; pense à rafraîchir les chiffres si le correcteur évolue (source de vérité&nbsp;: `dictee/JOURNAL.md`).
