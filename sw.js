// OMEGA-Ω — service worker : installable, HORS-LIGNE, instantané en visite répétée.
//
// ⚠️ Cloudflare Pages fait des "clean URLs" (redirections 308 : /x.html → /x). Un service worker NE DOIT JAMAIS
//    rejouer une réponse REDIRIGÉE pour une navigation — Chrome refuse et affiche une PAGE BLANCHE. On "reshape"
//    donc toute réponse redirigée en réponse 200 propre avant de la mettre en cache / la renvoyer.
// Chemins RELATIFS (./) → marche sous un sous-chemin (GitHub Pages) comme sur un domaine perso (Cloudflare).
// V = numéro + EMPREINTE du contenu du site. NE PAS éditer à la main : `node dictee/sw_probe.js --fix` le régénère,
// et le même probe ÉCHOUE en CI si le site a changé sans que V suive. (L'ancienne consigne « incrémenter à chaque
// déploiement » n'a pas tenu : mesuré, V est resté figé pendant 70 commits touchant le site — d'où le cache périmé.)
const V = 'omega-v220-0ddf3304';
// PRÉCACHE : toutes les PETITES pages du site (~180 Ko) → la navigation marche HORS-LIGNE même vers une page
// jamais visitée. Chaque entrée passe par la garde anti-redirection (reshape) : sur Cloudflare les .html
// répondent 308 → l'ancien addAll aurait caché une réponse redirigée = PAGE BLANCHE (audit 07/2026).
// L'app (11 Mo), pendable et scrabidon restent cachés À LA VISITE (poids).
const CORE = ['./', './index.html', './correcteur.html', './correcteur-outil.html', './dictee.html', './dictee-outil.html',
              './saisie-vocale.html', './omega-key.html', './recherche.html', './donnees.html', './confidentialite.html', './evolution.html', './site.css', './nav.js', './manifest.json', './icon.svg'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then((c) => Promise.all(CORE.map(async (u) => {
    try { const r = await fetch(u); if (r && r.ok) await c.put(u, r.redirected ? await reshape(r) : r); } catch (err) {}   // best-effort PAR ENTRÉE + reshape
  }))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== V).map((k) => caches.delete(k)));   // purge les anciens caches (entrées redirigées poison)
    await self.clients.claim();
  })());
});

// Retire le flag "redirected" d'une réponse (sinon rejeu impossible pour une navigation → page blanche).
async function reshape(res) {
  const body = await res.clone().blob();
  return new Response(body, { status: 200, statusText: 'OK', headers: res.headers });
}
function revalidate(cache, req) {
  return fetch(req).then(async (res) => {
    if (res && res.ok) cache.put(req, res.redirected ? await reshape(res) : res).catch(() => {});
  }).catch(() => {});
}

// STRATÉGIE — deux régimes, parce que « frais » et « léger » ne se règlent pas pareil :
//  • PAGES (navigations, ~180 Ko) → RÉSEAU D'ABORD, repli cache si hors-ligne. Le cache-first servait la page
//    de la visite PRÉCÉDENTE : on voyait le site avec un tour de retard, et seul un Ctrl+Shift+R montrait le vrai
//    (bug remonté par Rem 07/2026 : la section téléchargement de correcteur.html n'apparaissait jamais). Une page
//    fait quelques Ko → la fraîcheur vaut largement l'aller-retour réseau, et le hors-ligne reste garanti.
//  • RESTE (app 11 Mo, css, icônes) → cache-first + revalidation en fond. Le poids interdit le réseau d'abord ;
//    la revalidation est peu coûteuse (Cache-Control + ETag → 304 si inchangé) et rafraîchit pour la visite d'après.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate';
  e.respondWith(caches.open(V).then(async (cache) => {
    if (isPage) {                                                          // ── réseau d'abord ──
      const res = await fetch(req.url, { redirect: 'follow' }).catch(() => null);   // req.url + follow, PAS fetch(req) : une requête de NAVIGATION porte redirect:'manual' → sur une redirection Cloudflare le SW recevait un opaqueredirect (ok=false), tombait sur le repli et servait l'INDEX à la place de la page (scrabidon/pendable non précachées → accueil). Suivre les redirections rend un vrai 200.
      if (res && res.ok) {
        const clean = res.redirected ? await reshape(res) : res;           // jamais de réponse redirigée (page blanche)
        cache.put(req, clean.clone()).catch(() => {});
        return clean;
      }
      const cached = await cache.match(req);                               // hors-ligne : la page elle-même si cachée
      if (cached) return cached;
      const path = new URL(req.url).pathname;                              // dernier recours : le shell UNIQUEMENT pour la racine — NE JAMAIS servir l'index à la place d'une AUTRE page
      if (path === '/' || path.endsWith('/index.html')) return (await cache.match('./')) || Response.error();
      return Response.error();
    }
    const cached = await cache.match(req);                                 // ── cache d'abord (lourds) ──
    if (cached) { e.waitUntil(revalidate(cache, req)); return cached; }
    const res = await fetch(req).catch(() => null);
    if (!res) return Response.error();
    const clean = res.redirected ? await reshape(res) : res;
    if (res.ok) cache.put(req, clean.clone()).catch(() => {});
    return clean;
  }));
});
