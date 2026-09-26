// OMEGA-Ω — service worker : installable, HORS-LIGNE, instantané en visite répétée.
//
// ⚠️ Cloudflare Pages fait des "clean URLs" (redirections 308 : /x.html → /x). Un service worker NE DOIT JAMAIS
//    rejouer une réponse REDIRIGÉE pour une navigation — Chrome refuse et affiche une PAGE BLANCHE. On "reshape"
//    donc toute réponse redirigée en réponse 200 propre avant de la mettre en cache / la renvoyer.
// Chemins RELATIFS (./) → marche sous un sous-chemin (GitHub Pages) comme sur un domaine perso (Cloudflare).
// V = numéro + EMPREINTE du contenu du site. NE PAS éditer à la main : `node dictee/sw_probe.js --fix` le régénère,
// et le même probe ÉCHOUE en CI si le site a changé sans que V suive. (L'ancienne consigne « incrémenter à chaque
// déploiement » n'a pas tenu : mesuré, V est resté figé pendant 70 commits touchant le site — d'où le cache périmé.)
const V = 'omega-v264-f1a81ab4';
// PRÉCACHE : toutes les PETITES pages du site (~180 Ko) → la navigation marche HORS-LIGNE même vers une page
// jamais visitée. Chaque entrée passe par la garde anti-redirection (reshape) : sur Cloudflare les .html
// répondent 308 → l'ancien addAll aurait caché une réponse redirigée = PAGE BLANCHE (audit 07/2026).
// L'app (11 Mo), pendable et scrabidon restent cachés À LA VISITE (poids).
// ⚠️ URL SANS EXTENSION (SEO, 08/2026) : les liens du site ne pointent plus vers `.html`.
// Cloudflare Pages repond 308 sur les `.html` -> Google les classait « Page avec redirection »
// et les EXCLUAIT de l'index. Ce precache DOIT suivre : precacher `/correcteur.html` quand le
// visiteur demande `/correcteur` = cache manquant = navigation HORS-LIGNE CASSEE.
const CORE = ['./', './correcteur', './dictee',
              './saisie-vocale', './calcul', './calc_dys.js', './omega-key', './recherche', './donnees', './confidentialite', './evolution', './site.css', './nav.js', './manifest.json', './icon.svg'];

/* ⭐ REVALIDER = `cache: 'no-cache'` (18/09/2026). Cloudflare sert les .js / .css / .gz / polices avec
   `Cache-Control: public, max-age=14400` : pendant QUATRE HEURES un `fetch()` ordinaire ne va même pas au réseau, il relit
   le cache HTTP du navigateur. « Réseau d'abord » sans ce drapeau rendrait donc encore l'ancien script, et le précache d'une
   nouvelle version du service worker pouvait y figer un `nav.js` périmé. `no-cache` force une requête CONDITIONNELLE
   (If-None-Match) : 304 sans corps si rien n'a changé, le fichier neuf sinon. */
const FRAIS = { cache: 'no-cache' };

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then((c) => Promise.all(CORE.map(async (u) => {
    try { const r = await fetch(u, FRAIS); if (r && r.ok) await c.put(u, r.redirected ? await reshape(r) : r); } catch (err) {}   // best-effort PAR ENTRÉE + reshape
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
/* Range une réponse du réseau dans le cache — sauf si c'est, d'après son ETag, le fichier qu'on a déjà : après un 304 le
   navigateur rend une réponse 200 reconstituée, et la ranger réécrivait le fichier sur le disque à CHAQUE visite (15 Mo pour
   le modèle du juge). Rend la réponse PROPRE (jamais « redirected »), SANS attendre la fin de l'écriture (elle dure autant que
   le téléchargement du corps) — mais l'écriture est CONFIÉE à `waitUntil` : vu en production le 18/09/2026, une entrée de
   cache n'a pas été remplacée alors que le fichier du réseau avait bien été servi ; rien ne retenait le service worker
   jusqu'à la fin du `put`, le navigateur peut l'arrêter avant. */
async function range(cache, req, res, cached, e) {
  const clean = res.redirected ? await reshape(res) : res;
  const etag = res.headers.get('etag');
  if (!(cached && etag && cached.headers.get('etag') === etag)) {
    const ecrit = cache.put(req, clean.clone()).catch(() => {});
    try { e.waitUntil(ecrit); } catch (err) {}                          // l'événement n'est plus prolongeable : l'écriture part quand même
  }
  return clean;
}
function revalidate(cache, req, cached, e) {
  return fetch(req, FRAIS).then((res) => { if (res && res.ok) return range(cache, req, res, cached, e); }).catch(() => {});
}

// STRATÉGIE — TROIS régimes, parce que « frais », « assorti » et « léger » ne se règlent pas pareil :
//  • PAGES (navigations, ~180 Ko) → RÉSEAU D'ABORD, repli cache si hors-ligne. Le cache-first servait la page
//    de la visite PRÉCÉDENTE : on voyait le site avec un tour de retard, et seul un Ctrl+Shift+R montrait le vrai
//    (bug remonté par Rem 07/2026 : la section téléchargement de correcteur.html n'apparaissait jamais). Une page
//    fait quelques Ko → la fraîcheur vaut largement l'aller-retour réseau, et le hors-ligne reste garanti.
//  • CODE, STYLE et PETITES DONNÉES (.js .css .json .tsv) → RÉSEAU D'ABORD REVALIDÉ, repli cache. Jusqu'au 18/09/2026
//    ils étaient « cache d'abord » comme le reste : un visiteur de retour recevait donc la page NEUVE avec les scripts de
//    sa visite PRÉCÉDENTE. Mesuré en production après #776 : la page du correcteur anglais, neuve, tournait avec l'ancien
//    moteur (« with out » corrigé en « without out ») ; à la visite suivante tout était juste. Et après #775, `nav.js`
//    périmé : entrée de menu absente, bascule FR/EN vers l'accueil. Une page et son code se déploient ENSEMBLE, ils doivent
//    être servis ensemble. Coût mesuré : une requête conditionnelle par fichier (304, ~0,3 Ko d'en-têtes, aucun corps).
//    ⚠️ DÉLAI DE GRÂCE : « réseau d'abord » sur un réseau qui ne répond pas (train, wifi saturé) figerait la page sur un
//    <script> bloquant, là où le cache d'abord était instantané. Si une copie existe et que le réseau n'a pas répondu en
//    GRACE_MS, on sert la copie ; le téléchargement continue et range le fichier pour la prochaine fois.
//  • LOURDS et le reste (lexiques .gz, modèle .bin, polices, images, app en sous-ressource) → cache d'abord +
//    revalidation en fond. Le poids interdit d'attendre le réseau ; une DONNÉE d'une visite de retard est compatible
//    avec le code neuf (un lexique plus petit), un CODE d'une visite de retard ne l'est pas.
const CODE = /\.(?:js|mjs|css|json|tsv)$/i;
const GRACE_MS = 3000;

function reseauDAbord(cache, req, cached, e) {
  const reseau = fetch(req, FRAIS).then((res) => {
    if (res && res.ok) return range(cache, req, res, cached, e);
    return (res && res.status >= 500 && cached) ? cached : res;          // panne passagère du serveur : la copie vaut mieux ; un 404 est une réponse (fichier retiré)
  });
  if (!cached) return reseau.catch(() => Response.error());
  e.waitUntil(reseau.catch(() => {}));                                   // servi par la copie ou non, le téléchargement va au bout
  return Promise.race([
    reseau.catch(() => cached),                                          // hors ligne : la copie
    new Promise((ok) => setTimeout(() => ok(cached), GRACE_MS)),         // réseau muet : la copie, après le délai de grâce
  ]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate';
  e.respondWith(caches.open(V).then(async (cache) => {
    if (isPage) {                                                          // ── réseau d'abord ──
      const res = await fetch(req.url, { redirect: 'follow' }).catch(() => null);   // req.url + follow, PAS fetch(req) : une requête de NAVIGATION porte redirect:'manual' → sur une redirection Cloudflare le SW recevait un opaqueredirect (ok=false), tombait sur le repli et servait l'INDEX à la place de la page (scrabidon/pendable non précachées → accueil). Suivre les redirections rend un vrai 200.
      if (res && res.ok) {
        const clean = res.redirected ? await reshape(res) : res;           // jamais de réponse redirigée (page blanche)
        e.waitUntil(cache.put(req, clean.clone()).catch(() => {}));         // l'écriture va au bout (cf. range)
        return clean;
      }
      if (res) return res;                                                 // le serveur a répondu (dont 404.html : depuis le vrai 404
                                                                           // racine — 27/08 — une URL inconnue a une VRAIE page d'erreur ;
                                                                           // la jeter rendait Response.error() = page d'erreur navigateur)
      const cached = await cache.match(req);                               // hors-ligne : la page elle-même si cachée
      if (cached) return cached;
      const path = new URL(req.url).pathname;                              // dernier recours : le shell UNIQUEMENT pour la racine — NE JAMAIS servir l'index à la place d'une AUTRE page
      if (path === '/' || path.endsWith('/index.html')) return (await cache.match('./')) || Response.error();
      return Response.error();
    }
    const cached = await cache.match(req);
    if (CODE.test(new URL(req.url).pathname)) return reseauDAbord(cache, req, cached, e);   // ── code, style, petites données : réseau d'abord revalidé ──
    if (cached) { e.waitUntil(revalidate(cache, req, cached, e)); return cached; }             // ── lourds : cache d'abord, revalidation en fond ──
    const res = await fetch(req).catch(() => null);
    if (!res) return Response.error();
    const clean = res.redirected ? await reshape(res) : res;
    if (res.ok) e.waitUntil(cache.put(req, clean.clone()).catch(() => {}));
    return clean;
  }));
});
