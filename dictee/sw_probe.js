// Verrou CI du SERVICE WORKER (invariant hors-ligne) — sw.js n'avait AUCUNE couverture alors qu'il change
// à chaque déploiement (audit 07/2026). Vérifie les invariants STATIQUES qui protègent de la page blanche :
//  1. syntaxe valide ; 2. version au format omega-vNNN ; 3. précache CORE = liste blanche de ressources
//  non redirigées ; 4. TOUTE mise en cache passe par la garde anti-redirection (reshape) ;
//  5. l'activation purge les vieux caches ;
//  6. (18/09/2026) le COMPORTEMENT : sw.js est EXÉCUTÉ dans un bac à sable (faux cache, faux réseau, fausse minuterie) et
//     on regarde ce qu'il SERT — une page et son code se déploient ensemble, ils doivent être servis ensemble.
//  Lancer : node dictee/sw_probe.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const fail = [];

try { new Function(src); } catch (e) { fail.push('syntaxe sw.js : ' + e.message); }

// VERSION = numéro + EMPREINTE DU CONTENU (omega-vNNN-xxxxxxxx). Avant, V était un simple numéro « à incrémenter
// à CHAQUE déploiement » : MESURÉ, il n'a pas bougé pendant 70 commits touchant le site (dernier bump 2026-07-05)
// → les clients gardaient un cache figé, seul Ctrl+Shift+R montrait le site réel. Une consigne en commentaire ne
// tient pas ; l'empreinte, si. Si le site change et que V ne suit pas, CE CHECK ÉCHOUE et donne la valeur à poser.
// Régénérer : node dictee/sw_probe.js --fix
// Périmètre = les fichiers PRÉCACHÉS (CORE), pas l'app 11 Mo : c'est là que la péremption mord (ils sont figés au
// moment de l'install et n'en bougent qu'au changement de V). L'app est cachée à la visite et se rafraîchit par
// revalidation (ETag → 304) ; l'inclure ici coupleraît sw.js à CHAQUE injection de lexique — conflit dans toutes
// les PR pour un bump dont l'app n'a pas besoin.
const HASHED = ['index.html', 'correcteur.html', 'correcteur-outil.html', 'dictee.html', 'dictee-outil.html', 'saisie-vocale.html', 'double-sens.html', 'omega-key.html',
                'calcul.html', 'calc_dys.js', 'recherche.html', 'donnees.html', 'confidentialite.html', 'toile.html', 'arbitrage.html', 'evolution.html', 'site.css', 'nav.js', 'manifest.json', 'icon.svg'];
// ⚠️ NORMALISER LES FINS DE LIGNE AVANT DE HACHER, sinon l'empreinte dépend de l'OS et la CI diverge du poste :
// le dépôt a des fins de ligne MIXTES en base (index.html/site.css en LF, mais dictee.html/omega-key.html/
// evolution.html en CRLF), et sans .gitattributes un checkout Windows convertit encore. Mesuré : disque Windows
// a599b4ee vs Linux/CI a69a31f5 sur des fichiers pourtant identiques. CRLF→LF des deux côtés ⇒ même empreinte.
const crypto = require('crypto');
const h = crypto.createHash('sha256');
for (const f of HASHED) {
  const p = path.join(__dirname, '..', f);
  if (fs.existsSync(p)) h.update(Buffer.from(fs.readFileSync(p, 'latin1').replace(/\r\n/g, '\n'), 'latin1'));
}
const SITE_HASH = h.digest('hex').slice(0, 8);

const v = src.match(/const V\s*=\s*'([^']+)'/);
if (!v || !/^omega-v\d+(-[0-9a-f]{8})?$/.test(v[1])) {
  fail.push('version V introuvable ou format inattendu (omega-vNNN-xxxxxxxx) : ' + (v && v[1]));
} else if (v[1].split('-')[2] !== SITE_HASH) {                 // absente (ancien format) ou périmée
  const next = 'omega-v' + (parseInt(v[1].match(/v(\d+)/)[1], 10) + 1) + '-' + SITE_HASH;
  if (process.argv.includes('--fix')) {
    fs.writeFileSync(path.join(__dirname, '..', 'sw.js'), src.replace(/const V\s*=\s*'[^']+'/, "const V = '" + next + "'"));
    console.log('✓ sw.js : V régénéré → ' + next + ' (le site avait changé)');
    process.exit(0);
  }
  fail.push('le SITE a changé mais V ne suit pas → les clients garderaient le vieux cache.\n    ' +
            'attendu : ' + next + '   (corriger : node dictee/sw_probe.js --fix)');
}

const core = src.match(/const CORE\s*=\s*\[([^\]]*)\]/);
// liste blanche du précache : les petites pages du site + assets. Les LOURDS (app 11 Mo, pendable, scrabidon)
// sont volontairement exclus (cachés à la visite) — les précacher re-téléchargerait ~13 Mo à CHAQUE bump de version.
// ⚠️ URL SANS EXTENSION (SEO, 08/2026) : cette liste blanche decrit « les ressources qui NE
// REDIRIGENT PAS ». Ce sont desormais les URL SANS `.html` — c'est le `.html` qui prend le 308
// de Cloudflare Pages (ce que Google classait « Page avec redirection », d'ou l'exclusion de
// l'index). Precacher un `.html` reviendrait exactement au risque que ce check existe pour eviter.
const WHITELIST = new Set(['./', './correcteur', './correcteur-outil', './dictee', './dictee-outil', './double-sens',
  './saisie-vocale', './calcul', './calc_dys.js', './omega-key', './recherche', './donnees', './confidentialite', './toile', './arbitrage', './evolution', './site.css', './nav.js', './manifest.json', './icon.svg']);
if (!core) fail.push('CORE introuvable');
else for (const it of core[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean)) {
  if (!WHITELIST.has(it)) fail.push('CORE contient une entrée hors liste blanche (risque 308 → cache empoisonné) : ' + it);
}

// toute ligne cache.put doit mettre une réponse passée par la garde redirection (reshape/clean/redirected)
for (const line of src.split('\n')) {
  if (line.indexOf('cache.put(') >= 0 && !/reshape|clean|redirected/.test(line)) {
    fail.push('cache.put sans garde anti-redirection : ' + line.trim());
  }
}
if (!/caches\.delete/.test(src)) fail.push("l'activation ne purge pas les anciens caches (caches.delete absent)");
if (!/skipWaiting/.test(src)) fail.push('skipWaiting absent (les clients resteraient sur la vieille version)');

/* ── 6. LE COMPORTEMENT, dans un bac à sable ──
   POURQUOI. Mesuré en production le 18/09/2026 : sw.js servait les pages « réseau d'abord » et TOUT LE RESTE « cache d'abord ».
   Après un déploiement, un visiteur de retour exécutait donc la page NEUVE avec les scripts de sa visite PRÉCÉDENTE (page du
   correcteur anglais neuve + ancien moteur : « with out » corrigé en « without out » ; nav.js périmé après #775 : entrée de menu
   absente). Aucune regex sur le source ne peut garder ça : on CHARGE le vrai sw.js, on lui envoie de vrais événements
   (install, fetch) et on lit la réponse SERVIE, l'état du cache, et les options passées au réseau.
   Le faux réseau rend ce que chaque scénario décide (réponse, panne, silence) ; la minuterie est fausse aussi, pour jouer le
   délai de grâce sans attendre trois secondes. */
async function comportement() {
  const ORIGINE = 'https://site.test';
  const abs = (u) => new URL(typeof u === 'string' ? u : u.url, ORIGINE + '/').href;
  const rep = (corps, etag, status) => new Response(corps, { status: status || 200, headers: etag ? { etag: etag } : {} });
  function bac() {
    const ecoute = {}, journal = [], minuteries = [], ecrits = [], magasin = new Map(), reseau = new Map();
    const lent = { actif: false, lache: [] };                                  // écriture LENTE à la demande : `put` ne finit que quand le test le décide
    const cache = {
      async match(req) { const r = magasin.get(abs(req)); return r ? r.clone() : undefined; },
      put(req, res) { const fin = () => { ecrits.push(abs(req)); magasin.set(abs(req), res); };
        if (!lent.actif) { fin(); return Promise.resolve(); }
        return new Promise((ok) => { lent.lache.push(() => { fin(); ok(); }); }); },
    };
    const env = {
      self: { addEventListener: (t, f) => { ecoute[t] = f; }, skipWaiting() {}, clients: { claim: async () => {} } },
      caches: { open: async () => cache, keys: async () => [], delete: async () => true },
      fetch: (entree, init) => { const u = abs(entree); journal.push({ url: u, cache: init && init.cache, redirect: init && init.redirect });
        const f = reseau.get(u); return f ? f() : Promise.reject(new TypeError('hors ligne')); },
      location: { origin: ORIGINE },
      setTimeout: (f, ms) => { minuteries.push({ f: f, ms: ms }); return minuteries.length; },
    };
    new Function('self', 'caches', 'fetch', 'location', 'setTimeout', src)(env.self, env.caches, env.fetch, env.location, env.setTimeout);
    const tic = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
    async function demande(chemin, mode, methode, origine) {
      const ev = { request: { url: (origine || ORIGINE) + chemin, method: methode || 'GET', mode: mode || 'no-cors' }, reponse: null, fond: [],
                   respondWith(p) { this.reponse = p; Promise.resolve(p).catch(() => {}); },   // un rejet se lit plus tard, par `texte` : sans ce catch Node tue la sonde sur « unhandled rejection » avant qu'elle ait pu le DIRE
                   waitUntil(p) { this.fond.push(p); } };
      ecoute.fetch(ev); await tic(); return ev;
    }
    return { ecoute, journal, minuteries, ecrits, magasin, reseau, cache, demande, tic, lent };
  }
  const texte = async (p) => { try { const r = await p; return r && r.type !== 'error' ? await r.text() : '(erreur réseau)'; } catch (e) { return '(promesse rejetée : ' + (e && e.message) + ')'; } };
  const enCache = async (b, chemin) => { const r = await b.cache.match(ORIGINE + chemin); return r ? r.text() : null; };
  const JS = '/dictee/corrector_en.js', GZ = '/dictee/lex_en.tsv.gz';

  // A. le cas de production : script en cache (v1), le site a été redéployé (v2) -> la page neuve doit recevoir v2, tout de suite
  { const b = bac(); b.magasin.set(ORIGINE + JS, rep('v1', '"a"')); b.reseau.set(ORIGINE + JS, async () => rep('v2', '"b"'));
    const ev = await b.demande(JS), servi = await texte(ev.reponse);
    if (servi !== 'v2') fail.push('script en cache + site redéployé : la page reçoit « ' + servi + ' » au lieu du script NEUF (une visite de retard : page neuve + ancien moteur)');
    if (await enCache(b, JS) !== 'v2') fail.push('le script neuf n\'est pas rangé dans le cache (hors ligne, on resservirait l\'ancien)');
    const j = b.journal.find((x) => x.url === ORIGINE + JS);
    if (!j || j.cache !== 'no-cache') fail.push('le script est demandé SANS `cache: no-cache` : Cloudflare envoie max-age=14400, le navigateur relirait son cache HTTP pendant 4 h sans aller au réseau'); }
  /* A bis. L'ÉCRITURE DANS LE CACHE EST CONFIÉE À waitUntil (vu en production le 18/09/2026 : le fichier du réseau était servi,
     mais l'entrée du cache n'était pas remplacée — rien ne retenait le service worker jusqu'à la fin du `put`). On rend le
     `put` LENT : la réponse doit être servie sans l'attendre, et les promesses confiées à waitUntil ne doivent PAS être
     toutes tenues tant que l'écriture n'est pas finie. Même exigence pour une page et pour un fichier lourd jamais vu. */
  for (const [quoi, chemin, mode] of [['script', JS, 'no-cors'], ['page', '/correcteur', 'navigate'], ['fichier lourd jamais vu', GZ, 'no-cors']]) {
    const b = bac(); b.lent.actif = true; if (quoi === 'script') b.magasin.set(ORIGINE + chemin, rep('v1', '"a"'));
    b.reseau.set(ORIGINE + chemin, async () => rep('v2', '"b"'));
    const ev = await b.demande(chemin, mode); let servi = null; ev.reponse.then(async (r) => { servi = await r.text(); }); await b.tic();
    if (servi !== 'v2') fail.push(quoi + ' : la réponse attend la fin de l\'écriture dans le cache (« ' + servi + ' ») — elle doit partir tout de suite');
    let fondFini = false; Promise.all(ev.fond).then(() => { fondFini = true; }); await b.tic();
    if (!b.lent.lache.length) fail.push(quoi + ' : rien n\'est écrit dans le cache');
    else if (fondFini) fail.push(quoi + ' : l\'écriture dans le cache n\'est pas confiée à waitUntil — le navigateur peut arrêter le service worker avant la fin du put (entrée jamais remplacée)');
    b.lent.lache.forEach((f) => f()); await b.tic();
    if (!fondFini) fail.push(quoi + ' : waitUntil ne se libère pas une fois l\'écriture finie'); }
  // B. hors ligne : la copie
  { const b = bac(); b.magasin.set(ORIGINE + JS, rep('v1', '"a"'));
    const servi = await texte((await b.demande(JS)).reponse);
    if (servi !== 'v1') fail.push('hors ligne, le script en cache n\'est pas servi : « ' + servi + ' »'); }
  // C. réseau MUET (il ne répond jamais) : la copie, après le délai de grâce — pas de page figée sur un <script> bloquant
  { const b = bac(); b.magasin.set(ORIGINE + JS, rep('v1', '"a"')); b.reseau.set(ORIGINE + JS, () => new Promise(() => {}));
    const ev = await b.demande(JS); let servi = null; ev.reponse.then(async (r) => { servi = await r.text(); });
    await b.tic();
    if (servi !== null) fail.push('réseau muet : la copie est servie AVANT le délai de grâce — le réseau n\'a plus la priorité');
    if (!b.minuteries.length) fail.push('réseau muet : aucun délai de grâce — la page resterait figée sur son <script>');
    else { if (b.minuteries[0].ms < 1000 || b.minuteries[0].ms > 5000) fail.push('délai de grâce hors de la plage 1-5 s : ' + b.minuteries[0].ms + ' ms');
      b.minuteries[0].f(); await b.tic();
      if (servi !== 'v1') fail.push('réseau muet : après le délai de grâce la copie n\'est pas servie (« ' + servi + ' »)'); }
    if (!ev.fond.length) fail.push('réseau muet : le téléchargement n\'est pas confié à waitUntil (le navigateur peut tuer le service worker avant la fin)'); }
  // D. jamais vu + réseau : servi et rangé · E. jamais vu + hors ligne : erreur réseau (pas une réponse inventée)
  { const b = bac(); b.reseau.set(ORIGINE + JS, async () => rep('v2', '"b"'));
    if (await texte((await b.demande(JS)).reponse) !== 'v2' || await enCache(b, JS) !== 'v2') fail.push('script jamais vu : pas servi ou pas rangé');
    const b2 = bac(); const r = await (await b2.demande(JS)).reponse;
    if (!r || r.type !== 'error') fail.push('script jamais vu et hors ligne : on attend une erreur réseau, pas une réponse fabriquée'); }
  // K. le serveur a une panne passagère (503) : la copie ; le fichier a été RETIRÉ (404) : le 404
  { const b = bac(); b.magasin.set(ORIGINE + JS, rep('v1', '"a"')); b.reseau.set(ORIGINE + JS, async () => rep('panne', null, 503));
    if (await texte((await b.demande(JS)).reponse) !== 'v1') fail.push('503 du serveur avec une copie en cache : la copie doit être servie');
    const b2 = bac(); b2.magasin.set(ORIGINE + JS, rep('v1', '"a"')); b2.reseau.set(ORIGINE + JS, async () => rep('absent', null, 404));
    const r = await (await b2.demande(JS)).reponse;
    if (!r || r.status !== 404) fail.push('404 du serveur : la réponse du serveur doit passer (un fichier retiré ne se ressuscite pas depuis le cache)'); }
  // F. un LOURD en cache est servi SANS attendre le réseau (ici le réseau ne répond jamais), et revalidé en fond, vraiment
  { const b = bac(); b.magasin.set(ORIGINE + GZ, rep('lex1', '"a"')); let lache = null;
    b.reseau.set(ORIGINE + GZ, () => new Promise((ok) => { lache = ok; }));
    const ev = await b.demande(GZ); let servi = null; ev.reponse.then(async (r) => { servi = await r.text(); }); await b.tic();
    if (servi !== 'lex1') fail.push('un fichier lourd en cache attend le réseau : 2 Mo de lexique bloqués derrière un aller-retour');
    if (b.minuteries.length) fail.push('un fichier lourd passe par le délai de grâce : il est traité comme du code');
    const j = b.journal.find((x) => x.url === ORIGINE + GZ);
    if (!j) fail.push('un fichier lourd n\'est plus revalidé en fond : il ne se mettrait jamais à jour');
    else if (j.cache !== 'no-cache') fail.push('la revalidation en fond relit le cache HTTP (max-age=14400) : demander avec `cache: no-cache`');
    if (lache) { lache(rep('lex2', '"b"')); await Promise.all(ev.fond); await b.tic(); }
    if (await enCache(b, GZ) !== 'lex2') fail.push('la revalidation en fond ne range pas le fichier neuf (« ' + (await enCache(b, GZ)) + ' »)'); }
  // G. même ETag : on ne réécrit pas le fichier sur le disque à chaque visite
  { const b = bac(); b.magasin.set(ORIGINE + GZ, rep('lex1', '"a"')); b.reseau.set(ORIGINE + GZ, async () => rep('lex1', '"a"'));
    const ev = await b.demande(GZ); await Promise.all(ev.fond); await b.tic();
    if (b.ecrits.length) fail.push('fichier inchangé (même ETag) réécrit dans le cache : ' + b.ecrits.join(', ')); }
  // L. le classement se fait sur le CHEMIN (pas sur l'URL entière) et couvre code, style et petites données — pas les lourds
  for (const [chemin, code] of [['/site.css', true], ['/nav.js?v=3', true], ['/dictee/pos_hmm_en.json', true], ['/dictee/misspell_en.tsv', true],
                                ['/dictee/forms_en.tsv.gz', false], ['/app/b2_web.bin', false], ['/police/OmegaDys-Regular.ttf', false], ['/icon.svg', false]]) {
    const b = bac(), u = ORIGINE + chemin; b.magasin.set(u, rep('vieux', '"a"')); b.reseau.set(u, async () => rep('neuf', '"b"'));
    const servi = await texte((await b.demande(chemin)).reponse);
    if (code && servi !== 'neuf') fail.push(chemin + ' : code, style ou petite donnée servi depuis le cache (« ' + servi + ' ») alors que le site a changé');
    if (!code && servi !== 'vieux') fail.push(chemin + ' : fichier lourd servi « réseau d\'abord »'); }
  // H. les PAGES : inchangé — réseau d'abord, jamais de réponse « redirected », hors ligne la page elle-même, jamais l'index à sa place
  { const b = bac(), P = ORIGINE + '/correcteur';
    const redirigee = { ok: true, status: 200, redirected: true, headers: new Headers(), clone() { return this; }, blob: async () => new Blob(['page neuve']) };
    b.magasin.set(P, rep('page en cache')); b.reseau.set(P, async () => redirigee);
    const r = await (await b.demande('/correcteur', 'navigate')).reponse;
    if (!r || r.redirected || await r.text() !== 'page neuve') fail.push('navigation : la réponse redirigée n\'est pas remodelée (page blanche dans Chrome) ou la page neuve n\'est pas servie');
    const j = b.journal.find((x) => x.url === P); if (!j || j.redirect !== 'follow') fail.push('navigation : le réseau n\'est plus demandé avec redirect:follow (l\'index était servi à la place des pages)');
    const b2 = bac(); b2.magasin.set(P, rep('page en cache')); b2.magasin.set(ORIGINE + '/', rep('index'));
    if (await texte((await b2.demande('/correcteur', 'navigate')).reponse) !== 'page en cache') fail.push('navigation hors ligne : la page en cache n\'est pas servie');
    const r3 = await (await b2.demande('/jamais-vue', 'navigate')).reponse;
    if (!r3 || r3.type !== 'error') fail.push('navigation hors ligne vers une page jamais vue : l\'index est servi à sa place'); }
  // I. hors périmètre : autre origine, autre méthode -> le service worker ne s'en mêle pas
  { const b = bac();
    if ((await b.demande('/x.js', 'no-cors', 'GET', 'https://ailleurs.test')).reponse) fail.push('une requête vers une AUTRE origine est interceptée');
    if ((await b.demande('/x.js', 'cors', 'POST')).reponse) fail.push('une requête POST est interceptée'); }
  // J. l'installation précache des fichiers REVALIDÉS (sinon une nouvelle version fige le nav.js du cache HTTP, vieux de 4 h)
  { const b = bac(); let attente = null; b.ecoute.install({ waitUntil(p) { attente = p; } }); await attente;
    const sans = b.journal.filter((x) => x.cache !== 'no-cache');
    if (!b.journal.length) fail.push('installation : rien n\'est précaché');
    if (sans.length) fail.push('installation : ' + sans.length + ' fichier(s) précaché(s) sans `cache: no-cache` (ex. ' + sans[0].url + ') — le cache HTTP de 4 h y figerait un fichier périmé'); }
}

comportement().catch((e) => { fail.push('bac à sable : ' + (e && e.stack || e)); }).then(() => {
  if (fail.length) { console.error('✗ SW KO :\n  ' + fail.join('\n  ')); process.exit(1); }
  console.log('✓ sw.js : syntaxe, version ' + v[1] + ', précache liste blanche, garde anti-redirection sur chaque cache.put, purge des vieux caches ; comportement joué dans un bac à sable (code et style réseau d\'abord revalidé, délai de grâce, lourds cache d\'abord, pages inchangées).');
});
