#!/usr/bin/env node
/* UNE PAGE QUE PERSONNE NE PEUT ATTEINDRE VAUT ZÉRO.
 *
 * POURQUOI CE CHECK EXISTE. Le 2026-08-09, cinq pages du site ANGLAIS n'étaient reliées à rien
 * depuis l'accueil : `confidentialite.html`, `donnees.html`, `dictee.html`, `arbitrage.html`,
 * `decompose-outil.html`. Mesuré : **7 pages atteignables sur 12**, contre **16 sur 17** côté
 * français. Le pied de page anglais avait été traduit en OUBLIANT des liens que le français avait.
 * Le plus grave n'est pas cosmétique : la page promet « nothing is sent anywhere » et le lecteur
 * ne pouvait pas atteindre la politique de confidentialité qui l'atteste.
 * ⇒ C'est le même bug de fond que « une règle non branchée dans la page vaut zéro »
 *   (`en_page_wiring_probe.js`), un cran plus haut : le travail existe, il n'ARRIVE pas.
 *
 * CE QU'IL VÉRIFIE. Depuis chaque accueil (`index.html` à la racine, `en/index.html`), on suit les
 * liens `href` de proche en proche et on exige que toute page HTML de la même langue soit atteinte.
 * ⚠️ Une page volontairement hors navigation s'inscrit dans `_HORS_NAV` AVEC SA RAISON. Sans ça,
 * ce check finirait par être contourné en silence, comme tous les checks qu'on peut taire.
 *
 *   node dictee/pages_atteignables_probe.js      # code de sortie ≠ 0 si une page est orpheline
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.dirname(__dirname);

/* Pages hors navigation VOLONTAIREMENT — la raison est obligatoire. */
const _HORS_NAV = {
  'googleaadee2f545868c76.html': 'jeton de vérification Google Search Console : doit rester à la racine, ne se lie pas',
};

const SITES = [
  { nom: 'français', dir: '.',  accueil: 'index.html' },
  { nom: 'anglais',  dir: 'en', accueil: 'index.html' },
];

let echec = false;
for (const site of SITES) {
  const abs = path.join(RACINE, site.dir);
  if (!fs.existsSync(abs)) continue;
  const pages = fs.readdirSync(abs).filter(f => f.endsWith('.html'));
  if (!pages.includes(site.accueil)) { console.log('✗ accueil introuvable : ' + site.dir); echec = true; continue; }

  /* On ignore les commentaires HTML : un lien commenté n'est pas un lien. */
  const liensDe = (p) => {
    const h = fs.readFileSync(path.join(abs, p), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    return [...h.matchAll(/href="([^"#?]+)"/g)].map(m => m[1])
      .filter(u => u.endsWith('.html') && !/^(https?:)?\/\//.test(u) && !u.startsWith('../'))
      .map(u => u.split('/').pop());
  };
  const vus = new Set([site.accueil]), file = [site.accueil];
  while (file.length) {
    const p = file.shift();
    for (const l of liensDe(p)) if (pages.includes(l) && !vus.has(l)) { vus.add(l); file.push(l); }
  }
  const orphelines = pages.filter(p => !vus.has(p) && !_HORS_NAV[p]);
  const exemptees  = pages.filter(p => !vus.has(p) && _HORS_NAV[p]);

  console.log('  %s : %d pages · %d atteignables depuis %s/%s%s',
    site.nom.padEnd(9), pages.length, vus.size, site.dir, site.accueil,
    exemptees.length ? ' · ' + exemptees.length + ' hors-nav assumée(s)' : '');
  for (const p of exemptees) console.log('      – ' + p + ' (' + _HORS_NAV[p] + ')');
  if (orphelines.length) {
    echec = true;
    console.log('    ✗ ORPHELINES — aucun chemin depuis l\'accueil : ' + orphelines.join(', '));
    console.log('      Les relier (pied de page ou nav), ou les inscrire dans _HORS_NAV AVEC LA RAISON.');
  }
}
if (echec) process.exit(1);
console.log('  ✓ toutes les pages sont atteignables depuis leur accueil');
