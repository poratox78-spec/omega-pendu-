#!/usr/bin/env node
/* UNE PAGE ABSENTE DU SITEMAP N'EXISTE PAS POUR GOOGLE — ET UNE PAGE `noindex` DÉCLARÉE AU
 * SITEMAP EST UN SIGNAL CONTRADICTOIRE.
 *
 * Né d'un échec RÉEL (Search Console, validation « Page avec redirection » lancée le 13/08/2026,
 * échouée le 15/08) : quatre pages étaient liées depuis le menu mais absentes du sitemap, et rien
 * ne le disait. Règles :
 *   ① toute page du site (hors app, sous-applications, jeton de vérification et `zh/`) doit être
 *      DÉCLARÉE — sauf si elle porte `noindex` ;
 *   ② une page déclarée doit EXISTER, et ne doit PAS porter `noindex` (sitemap et balise robots
 *      qui se contredisent = Google arbitre contre nous) ;
 *   ③ (14/09) une page déclarée porte un canonical ÉGAL à son URL déclarée ;
 *   ④ (14/09) aucun lien interne vers `page.html` — Cloudflare Pages y répond 308 et Google range
 *      l'URL « Page avec redirection ». Le PR #576 avait réécrit 386 liens, mais sa règle ne voyait
 *      ni les liens à ancre (`recherche.html#main`), ni le mode d'emploi OMEGA·KEY, ni l'entrée
 *      `decompose-outil.html` de nav.js : 9 liens restaient le 14/09 (les 8 des pages vus en ligne, celui
 *      du menu construit par JavaScript vu par ce check). On lit donc
 *      TOUS les href (ancre et requête retirées, absolus du site compris) ET les entrées de nav.js.
 *
 * ⚠️ `zh/` est exclu à la demande de Rem (23/08/2026) : version chinoise non destinée à l'index.
 * `omega-key/docs/` est DANS le périmètre depuis le 14/09 (page de contenu liée depuis 4 pages,
 * indexable, restée hors sitemap et sans canonical) ; l'application `omega-key/app/` reste dehors.
 *
 *   node dictee/sitemap_probe.js       # code de sortie != 0 si le sitemap et le site divergent
 */
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const IGNORE = new Set(['.git','node_modules','app','vendor','.claude','data_local',
                        'police','word','extension','evo','dictee','zh','icons','fonts','.github']);
const fail = [];

const xml = fs.readFileSync(path.join(RACINE, 'sitemap.xml'), 'utf8');
const declare = new Set([...xml.matchAll(/<loc>https:\/\/omegapendu\.com\/([^<]*)<\/loc>/g)]
                        .map(m => m[1].replace(/\/$/, '')));

const pages = [];
(function marche(dir, prefixe) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!IGNORE.has(e.name)) marche(path.join(dir, e.name), prefixe + e.name + '/'); }
    else if (e.name.endsWith('.html') && !e.name.startsWith('google')) pages.push(prefixe + e.name);
  }
})(RACINE, '');

const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8');
const cle = (p) => p.replace(/\.html$/, '').replace(/(^|\/)index$/, '$1').replace(/\/$/, '');
const noindex = (p) => /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(lire(p));
function canonical(p) {
  const t = /<link\b[^>]*\brel=["']canonical["'][^>]*>/i.exec(lire(p));
  if (!t) return null;
  const h = /\bhref=["']([^"']*)["']/i.exec(t[0]);
  return h ? h[1] : '';
}

const vues = new Set();
for (const p of pages) {
  const k = cle(p); vues.add(k);
  const ni = noindex(p);
  if (!ni && !declare.has(k)) fail.push('page ABSENTE du sitemap : ' + p + '  (→ /' + k + ')');
  if (ni && declare.has(k)) fail.push('page « noindex » DÉCLARÉE au sitemap (signal contradictoire) : ' + p);
  if (declare.has(k)) {
    const c = canonical(p), attendu = 'https://omegapendu.com/' + (k ? k + (/(^|\/)index\.html$/.test(p) ? '/' : '') : '');
    if (c === null) fail.push('page déclarée SANS canonical : ' + p + '  (attendu ' + attendu + ')');
    else if (c !== attendu) fail.push('canonical ≠ URL déclarée : ' + p + '  (' + c + ' ≠ ' + attendu + ')');
  }
}
for (const d of declare) if (d && !vues.has(d)) fail.push('sitemap déclare une page SANS fichier : /' + d);

/* ④ liens internes vers `.html` — un lien = un chemin du dépôt ; seul compte celui qui vise une PAGE du
   périmètre (l'app, les sous-applications et le jeton Google gardent leur extension, cf. #576). */
const PAGES = new Set(pages);
const HOTE = /^https?:\/\/(www\.)?omegapendu\.com(?=\/|$)/i;
function cible(u, depuis) {
  u = u.trim().replace(/[#?].*$/, '');
  if (!u) return null;
  if (HOTE.test(u)) u = u.replace(HOTE, '') || '/';
  else if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(u)) return null;
  return path.posix.normalize(u.startsWith('/') ? u.slice(1) : path.posix.join(path.posix.dirname(depuis), u));
}
let nLiens = 0;
const versHtml = (u, depuis, ou) => {
  nLiens++;
  const c = cible(u, depuis);
  if (c && c.endsWith('.html') && PAGES.has(c)) fail.push('lien interne vers « .html » (308, « Page avec redirection ») : ' + ou + '  href="' + u + '"  → écrire « ' + u.replace(/(^|\/)index\.html(?=[#?]|$)/, (m, a) => a || './').replace(/\.html(?=[#?]|$)/, '') + ' »');
};
for (const p of pages) {
  const t = lire(p).replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));   // un lien commenté n'est pas un lien
  for (const m of t.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi))
    versHtml(m[1], p, p + ':' + (t.slice(0, m.index).split('\n').length));
}
const nav = lire('nav.js');
for (const [nom, depuis] of [['GROUPS', 'index.html'], ['GROUPS_EN', 'en/index.html']]) {
  const i = nav.indexOf('var ' + nom + ' = [');
  if (i < 0) { fail.push('nav.js : groupe ' + nom + ' introuvable (le check des liens du menu serait MUET)'); continue; }
  const bloc = nav.slice(i, nav.indexOf('\n  ];', i));
  const entrees = [...bloc.matchAll(/\['([^']+)'\s*,/g)];
  if (!entrees.length) fail.push('nav.js : aucune entrée lue dans ' + nom + ' (le check des liens du menu serait MUET)');
  for (const m of entrees) versHtml(m[1], depuis, 'nav.js ' + nom);
}


/* ⑤ NOM DE SITE — Rem (17/09/2026) : sur Google, « omega pendu » listait Pendable, Confidentialité, le modèle double route, le
   mémoire, l'arbitrage… Le nom que Google lit (WebSite.name de l'accueil, og:site_name, <title>) doit être « OMEGA Pendu » —
   ce que les gens tapent — et le même partout ; les cinq pages à montrer (accueil, correcteur, dictée, saisie vocale, Pendable)
   le portent dans leur <title> ; et le menu (sur toutes les pages) ne pousse plus les pages de recherche : une seule entrée
   « recherche », arbitrage/évolution se lisent depuis elle.
   ⚠️ 18/09/2026 — DONNÉES N'EN FAIT PAS PARTIE : c'est une page produit (lexiques à télécharger, police dys). Elle était sortie
   du menu avec le groupe « Recherche » ; Rem : « je suis pas d'accord […] on a fait un gros travail dessus et en plus y a la
   police dys ». Le menu DOIT la porter. */
const NOM = 'OMEGA Pendu';
{
  const acc = lire('index.html');
  const ws = /"@type":"WebSite"[^}]*?"name":"([^"]*)"/.exec(acc);
  if (!ws) fail.push('accueil : données structurées WebSite sans « name » (Google n\'a plus de nom de site)');
  else if (ws[1] !== NOM) fail.push('accueil : WebSite.name = « ' + ws[1] + ' » ≠ « ' + NOM + ' »');
  if (!/"alternateName":\[[^\]]*"OMEGA-Ω"/.test(acc)) fail.push('accueil : WebSite.alternateName ne garde plus « OMEGA-Ω »');
  for (const p of pages) {
    const m = /property="og:site_name" content="([^"]*)"/.exec(lire(p));
    if (m && m[1] !== NOM && m[1] !== 'OMEGA·KEY') fail.push('og:site_name « ' + m[1] + ' » ≠ « ' + NOM + ' » : ' + p);
  }
  for (const p of ['index.html', 'correcteur.html', 'dictee.html', 'saisie-vocale.html', 'pendable.html']) {
    const t = /<title>([^<]*)<\/title>/.exec(lire(p));
    if (!t || t[1].indexOf(NOM) < 0) fail.push('<title> sans « ' + NOM + ' » : ' + p + (t ? '  (« ' + t[1] + ' »)' : ''));
  }
  const i = nav.indexOf('var GROUPS = ['), bloc = i < 0 ? '' : nav.slice(i, nav.indexOf('\n  ];', i));
  const rech = [...bloc.matchAll(/\['(recherche|arbitrage|evolution|docs\/[a-zA-Z-]+)'/g)].map(m => m[1]);
  /* ⚠️ 19/09/2026 — RÈGLE RETOURNÉE. Le 17/09 elle EXIGEAIT que le menu ne porte que « recherche » ; conséquence
     mesurée : /arbitrage n'était plus liée que par les DOCUMENTS INTERNES (docs/MEMOIRE, docs/rapport-mode-emploi) ;
     aucune page normale ne la portait hors de la barre de repli que nav.js remplace. Pas invisible : enterrée. Le vrai
     problème SEO d'origine, ce sont les DOCUMENTS INTERNES dans les liens de site : ils sont traités par leur
     `noindex`, pas en amputant le menu. La règle garde donc l'interdiction des `docs/…` et EXIGE désormais
     les trois pages publiques, pour qu'aucune ne puisse re-disparaître en silence.
     ⚠️ 24/09/2026 — ce `noindex` est PRÉVU, pas encore déployé : il part au BLOC 2, séparé du BLOC 1 parce
     qu'il retire ~324 impressions à 0 clic et ferait monter le CTR du site sans un clic de plus. Cette règle
     ne suppose donc RIEN de l'état d'indexation : elle parle du MENU, qui est fait de pages de produit. */
  const docsMenu = rech.filter((r) => r.indexOf('docs/') === 0);
  if (docsMenu.length) fail.push('nav.js GROUPS pousse des DOCUMENTS INTERNES dans le menu de toutes les pages : ' + docsMenu.join(', ') + " — le menu est fait des pages de PRODUIT ; un rapport interne s'atteint depuis la page qui le cite");
  for (const exigee of ['recherche', 'arbitrage', 'evolution'])
    if (rech.indexOf(exigee) < 0) fail.push('nav.js GROUPS : « ' + exigee + ' » a disparu du menu — page publique, elle DOIT y rester (19/09/2026 : son retrait avait rendu /arbitrage orpheline)');
  if (!/\['donnees',/.test(bloc)) fail.push('nav.js GROUPS : la page Données (lexiques à télécharger, police dys) a disparu du menu — décision de Rem du 18/09/2026 : elle doit y être');
}

/* ⑥ CE QUE GOOGLE AFFICHE — longueur des titres et des descriptions (19/09/2026).
   Mesuré : sur `site:omegapendu.com`, Google REMPLAÇAIT nos titres par le H1 ou par un bout de phrase
   (« Un correcteur qui ne te corrige jamais à tort. », « modèle double route, dyslexie | OMEGA-Ω »,
   « reasons instead of reading the answer »). Cause : des <title> de 77 à 99 caractères là où la page de
   résultats en affiche ~60, écrits en trois morceaux et comme des slogans. Conséquence chiffrée : sur
   /correcteur, position 3,9 et CTR 1,9 % — la ligne bleue ne contenait ni « dyslexie » ni « gratuit ».
   Une description au-delà de ~155 caractères est coupée : tout ce qui suit est invisible.
   ⚠️ Ces seuils ne garantissent pas que Google garde le titre — rien ne le garantit. Ils suppriment la
   RAISON connue de ne pas le garder, et ils empêchent la dérive de revenir dans trois semaines.
   ⚠️ PÉRIMÈTRE : seulement les pages DÉCLARÉES au sitemap — une page `noindex` ou hors sitemap (404,
   documents internes) n'a aucune ligne dans Google, sa longueur de titre n'y change rien. */
const TMAX = 60, DMIN = 110, DMAX = 155;
for (const p of pages) {
  if (!declare.has(cle(p))) continue;                       // hors sitemap = aucune ligne à afficher
  const h = lire(p);
  const t = /<title>([^<]*)<\/title>/.exec(h);
  if (!t) { fail.push('<title> absent : ' + p); continue; }
  if (t[1].length > TMAX) fail.push('<title> de ' + t[1].length + ' caractères (max ' + TMAX + ', au-delà Google le remplace) : ' + p + '  « ' + t[1] + ' »');
  const d = /<meta name="description" content="([^"]*)"/.exec(h);
  if (!d) fail.push('meta description absente (Google compose alors le résumé tout seul) : ' + p);
  else if (d[1].length > DMAX) fail.push('description de ' + d[1].length + ' caractères (max ' + DMAX + ', le reste est coupé) : ' + p);
  else if (d[1].length < DMIN) fail.push('description de ' + d[1].length + ' caractères (min ' + DMIN + ' : trop courte pour dire ce qu\'on fait sur la page) : ' + p);
}

if (fail.length) { fail.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('✓ sitemap : ' + declare.size + ' URL déclarées == ' + pages.length + ' pages du site (noindex exclues, zh/ hors périmètre), canonical = URL déclarée ; '
            + nLiens + ' liens internes lus (pages + nav.js), aucun vers « .html » ; nom de site « ' + NOM + ' » (WebSite, og:site_name, 5 titres), titres ≤ ' + TMAX + ' et descriptions ' + DMIN + '-' + DMAX + ' caractères, menu sans pages de recherche, avec Données.');
