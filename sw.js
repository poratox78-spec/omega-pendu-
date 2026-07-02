// OMEGA-Ω — service worker : installable, HORS-LIGNE, instantané en visite répétée.
//
// ⚠️ Cloudflare Pages fait des "clean URLs" (redirections 308 : /x.html → /x). Un service worker NE DOIT JAMAIS
//    rejouer une réponse REDIRIGÉE pour une navigation — Chrome refuse et affiche une PAGE BLANCHE. On "reshape"
//    donc toute réponse redirigée en réponse 200 propre avant de la mettre en cache / la renvoyer.
// Chemins RELATIFS (./) → marche sous un sous-chemin (GitHub Pages) comme sur un domaine perso (Cloudflare).
const V = 'omega-v106';   // ⬅️ incrémenter à CHAQUE déploiement pour pousser une mise à jour aux clients
const CORE = ['./', './site.css', './manifest.json', './icon.svg'];   // UNIQUEMENT des ressources non redirigées (200)

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then((c) => c.addAll(CORE).catch(() => {})));   // best-effort
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
