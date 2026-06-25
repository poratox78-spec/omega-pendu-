// OMEGA-Ω — service worker : application installable, HORS-LIGNE, instantanée en visite répétée.
// Stratégie : petit "core" précaché (install rapide) + cache RUNTIME stale-while-revalidate
// (le monolithe app/omega-pendu.html ~9 Mo se met en cache au 1er chargement, puis sert depuis le cache).
// Chemins RELATIFS (./) → marche sous un sous-chemin GitHub Pages (/omega-pendu-/) comme sur un domaine perso.
const V = 'omega-v1';   // ⬅️ incrémenter à CHAQUE déploiement pour pousser une mise à jour aux clients
const CORE = ['./', './index.html', './recherche.html', './site.css', './manifest.json', './icon.svg'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then((c) => c.addAll(CORE).catch(() => {})));   // best-effort
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== V).map((k) => caches.delete(k)));   // purge anciennes versions
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;   // même origine seulement
  e.respondWith(caches.open(V).then(async (cache) => {
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }     // cache-first + revalidation en arrière-plan
    const res = await network;
    return res || (await cache.match('./app/omega-pendu.html')) || (await cache.match('./index.html')) || Response.error();
  }));
});
