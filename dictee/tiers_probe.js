#!/usr/bin/env node
/* LA PAGE CONFIDENTIALITÉ PROMET « Pas de requête vers un serveur tiers au chargement : polices, icônes
 * et code sont servis depuis le site ». RIEN NE LE VÉRIFIAIT.
 *
 * Mesuré le 14/09/2026 (contrôle SEO) : le mode d'emploi OMEGA·KEY (`omega-key/docs/`) chargeait encore
 * trois ressources Google Fonts — le retrait « partout » de juillet (PR #73) ne l'avait pas vu, la page
 * étant rangée avec la sous-application. Tout visiteur de cette page envoyait son adresse IP à Google.
 *
 * Règle : aucune page HTML du dépôt ne charge À L'OUVERTURE une ressource d'un autre hôte — balises
 * <link> (feuille de style, préconnexion, préchargement, icône…), <script src>, <img>, <iframe>, <source>,
 * <video>, <audio>, et `@import` / `url()` des styles. Les liens <a> (partent au clic) et les <link>
 * canonical / alternate (des adresses, pas des chargements) ne comptent pas.
 * Limite assumée : un chargement construit par JavaScript n'est pas vu ici.
 * Toute exception s'inscrit dans `_EXCEPTIONS` AVEC SA RAISON.
 *
 *   node dictee/tiers_probe.js       # code de sortie != 0 si une page charge une ressource tierce
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const IGNORE = new Set(['.git', 'node_modules', '.claude', 'data_local']);
const _EXCEPTIONS = {
  'word/taskpane.html': "complément Word : Office.js DOIT être chargé depuis appsforoffice.microsoft.com (exigence Microsoft) ; la page ne s'ouvre que dans Word, pas depuis le site",
};
const SITE = /^(www\.)?omegapendu\.com$/i;

const pages = [];
(function marche(dir, prefixe) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!IGNORE.has(e.name)) marche(path.join(dir, e.name), prefixe + e.name + '/'); }
    else if (e.name.endsWith('.html')) pages.push(prefixe + e.name);
  }
})(RACINE, '');

const fail = [], vues = new Set();
let nPages = 0;
for (const p of pages) {
  nPages++;
  const t = fs.readFileSync(path.join(RACINE, p), 'utf8').replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
  const ligne = (i) => t.slice(0, i).split('\n').length;
  const tiers = [];
  for (const m of t.matchAll(/<(link|script|img|iframe|source|video|audio)\b[^>]*>/gi)) {
    const tag = m[0], nom = m[1].toLowerCase();
    if (nom === 'link' && /\brel\s*=\s*["'][^"']*\b(canonical|alternate|author|license|me)\b/i.test(tag)) continue;
    const a = /\b(href|src|srcset)\s*=\s*["']\s*(https?:)?\/\/([^\/"'\s:]+)/i.exec(tag);
    if (a && !SITE.test(a[3])) tiers.push('<' + nom + '> ' + a[3] + ' (ligne ' + ligne(m.index) + ')');
  }
  for (const m of t.matchAll(/(@import\s+|url\(\s*)["']?(https?:)?\/\/([^\/"')\s:]+)/gi))
    if (!SITE.test(m[3])) tiers.push('style ' + m[3] + ' (ligne ' + ligne(m.index) + ')');
  if (!tiers.length) continue;
  if (_EXCEPTIONS[p]) { vues.add(p); continue; }
  fail.push(p + ' charge une ressource TIERCE à l’ouverture : ' + tiers.join(' ; '));
}
for (const p of Object.keys(_EXCEPTIONS)) if (!vues.has(p)) fail.push('exception PÉRIMÉE (la page ne charge plus rien de tiers, ou n’existe plus) : ' + p + ' — la retirer de _EXCEPTIONS');
if (nPages < 40) fail.push('seulement ' + nPages + ' pages lues : le parcours du dépôt est cassé (check MUET)');

if (fail.length) { fail.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('✓ confidentialité : ' + nPages + ' pages HTML, aucune ne charge de ressource tierce à l’ouverture (' + Object.keys(_EXCEPTIONS).length + ' exception motivée : ' + Object.keys(_EXCEPTIONS).join(', ') + ').');
