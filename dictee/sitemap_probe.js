#!/usr/bin/env node
/* UNE PAGE ABSENTE DU SITEMAP N'EXISTE PAS POUR GOOGLE — ET UNE PAGE `noindex` DÉCLARÉE AU
 * SITEMAP EST UN SIGNAL CONTRADICTOIRE.
 *
 * Né d'un échec RÉEL (Search Console, validation « Page avec redirection » lancée le 13/08/2026,
 * échouée le 15/08) : quatre pages étaient liées depuis le menu mais absentes du sitemap, et rien
 * ne le disait. Deux règles, symétriques :
 *   ① toute page du site (hors app, sous-applications, jeton de vérification et `zh/`) doit être
 *      DÉCLARÉE — sauf si elle porte `noindex` ;
 *   ② une page déclarée doit EXISTER, et ne doit PAS porter `noindex` (sitemap et balise robots
 *      qui se contredisent = Google arbitre contre nous).
 *
 * ⚠️ `zh/` est exclu à la demande de Rem (23/08/2026) : version chinoise non destinée à l'index.
 *
 *   node dictee/sitemap_probe.js       # code de sortie != 0 si le sitemap et le site divergent
 */
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const IGNORE = new Set(['.git','node_modules','app','omega-key','vendor','.claude','data_local',
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

const cle = (p) => p.replace(/\.html$/, '').replace(/(^|\/)index$/, '$1').replace(/\/$/, '');
const noindex = (p) => /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i
                       .test(fs.readFileSync(path.join(RACINE, p), 'utf8'));

const vues = new Set();
for (const p of pages) {
  const k = cle(p); vues.add(k);
  const ni = noindex(p);
  if (!ni && !declare.has(k)) fail.push('page ABSENTE du sitemap : ' + p + '  (→ /' + k + ')');
  if (ni && declare.has(k)) fail.push('page « noindex » DÉCLARÉE au sitemap (signal contradictoire) : ' + p);
}
for (const d of declare) if (d && !vues.has(d)) fail.push('sitemap déclare une page SANS fichier : /' + d);

if (fail.length) { fail.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('✓ sitemap : ' + declare.size + ' URL déclarées == ' + pages.length + ' pages du site (noindex exclues, zh/ hors périmètre).');
