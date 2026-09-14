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

if (fail.length) { fail.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('✓ sitemap : ' + declare.size + ' URL déclarées == ' + pages.length + ' pages du site (noindex exclues, zh/ hors périmètre), canonical = URL déclarée ; '
            + nLiens + ' liens internes lus (pages + nav.js), aucun vers « .html ».');
