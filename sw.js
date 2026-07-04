// OMEGA-Ω — service worker : installable, HORS-LIGNE, instantané en visite répétée.
//
// ⚠️ Cloudflare Pages fait des "clean URLs" (redirections 308 : /x.html → /x). Un service worker NE DOIT JAMAIS
//    rejouer une réponse REDIRIGÉE pour une navigation — Chrome refuse et affiche une PAGE BLANCHE. On "reshape"
//    donc toute réponse redirigée en réponse 200 propre avant de la mettre en cache / la renvoyer.
// Chemins RELATIFS (./) → marche sous un sous-chemin (GitHub Pages) comme sur un domaine perso (Cloudflare).
const V = 'omega-v137';   // ⬅️ incrémenter à CHAQUE déploiement pour pousser une mise à jour aux clients
// PRÉCACHE : toutes les PETITES pages du site (~180 Ko) → la navigation marche HORS-LIGNE même vers une page
// jamais visitée. Chaque entrée passe par la garde anti-redirection (reshape) : sur Cloudflare les .html
// répondent 308 → l'ancien addAll aurait caché une réponse redirigée = PAGE BLANCHE (audit 07/2026).
// L'app (11 Mo), pendable et scrabidon restent cachés À LA VISITE (poids).
const CORE = ['./', './index.html', './correcteur.html', './correcteur-outil.html', './dictee.html',
              './omega-key.html', './recherche.html', './evolution.html', './site.css', './manifest.json', './icon.svg'];

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

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(V).then(async (cache) => {
    const cached = await cache.match(req);
    if (cached) { e.waitUntil(revalidate(cache, req)); return cached; }    // cache-first (le cache est TOUJOURS "propre")
    const res = await fetch(req).catch(() => null);
    if (!res) return (req.mode === 'navigate' ? await cache.match('./') : null) || Response.error();   // secours hors-ligne
    const clean = res.redirected ? await reshape(res) : res;               // jamais de réponse redirigée
    if (res.ok) cache.put(req, clean.clone()).catch(() => {});
    return clean;
  }));
});
