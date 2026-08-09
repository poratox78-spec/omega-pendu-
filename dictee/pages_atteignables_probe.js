#!/usr/bin/env node
/* UNE PAGE QUE PERSONNE NE PEUT ATTEINDRE VAUT ZÉRO.
 *
 * ⚠️ CORRECTION DE MON PREMIER JET, À LIRE AVANT DE TOUCHER À CE FICHIER.
 * La v1 ne lisait que le HTML STATIQUE et concluait « 5 pages anglaises orphelines ». C'était FAUX
 * pour la quasi-totalité des visiteurs : `nav.js` RÉÉCRIT la barre de navigation au chargement et
 * contient déjà tous ces liens. Les <a> codés en dur ne sont qu'un REPLI SANS JAVASCRIPT.
 * Mesurer le HTML servi n'est pas mesurer ce que l'utilisateur voit — exactement le même piège
 * que « la sonde appelle le moteur, jamais la page » (`en_page_wiring_probe.js`).
 * ⇒ On vérifie donc les DEUX mondes, séparément, parce qu'ils peuvent diverger :
 *     ① AVEC JS   : la page est-elle dans les groupes de `nav.js` (source unique du menu) ?
 *     ② SANS JS   : est-elle atteignable en suivant les liens du HTML servi ?
 *   Une page absente des deux est invisible pour tout le monde ; absente du seul ② ne pénalise
 *   que les lecteurs sans JS — c'est moins grave, mais ça reste une régression d'accessibilité.
 *
 * ③ Et une page SANS <nav> du tout est un cul-de-sac pour TOUS : on y entre, on n'en sort pas.
 *
 * ⚠️ Toute exception s'inscrit dans `_HORS_NAV` AVEC SA RAISON. Sans ça, ce check finirait
 * contourné en silence, comme tous les checks qu'on peut taire.
 *
 *   node dictee/pages_atteignables_probe.js      # code de sortie ≠ 0 si une page est invisible
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.dirname(__dirname);

/* Pages hors navigation VOLONTAIREMENT — la raison est obligatoire. */
const _HORS_NAV = {
  'googleaadee2f545868c76.html': 'jeton de vérification Google Search Console : doit rester à la racine, ne se lie pas',
  'omega-pendu.html': "l'application elle-même : on y entre par les pages, elle a sa propre interface",
  'omega-pendu-en.html': "idem, version anglaise",
};
/* Pages-OUTIL sans <nav> assumée : plein écran, on en sort par le bouton retour de la page. */
const _SANS_NAV_OK = {};

/* ---------- ① ce que nav.js sert VRAIMENT (source unique du menu) ---------- */
function groupesNav(nomVar){
  const src = fs.readFileSync(path.join(RACINE, 'nav.js'), 'utf8');
  const i = src.indexOf('var ' + nomVar + ' = [');
  if (i < 0) return null;
  const bloc = src.slice(i, src.indexOf('\n  ];', i));
  return new Set([...bloc.matchAll(/\['([^']+\.html)'\s*,/g)].map(m => m[1]));
}

const SITES = [
  { nom: 'français', dir: '.',  accueil: 'index.html', groupes: 'GROUPS' },
  { nom: 'anglais',  dir: 'en', accueil: 'index.html', groupes: 'GROUPS_EN' },
];

let echec = false;
for (const site of SITES) {
  const abs = path.join(RACINE, site.dir);
  if (!fs.existsSync(abs)) continue;
  const pages = fs.readdirSync(abs).filter(f => f.endsWith('.html'));
  if (!pages.includes(site.accueil)) { console.log('✗ accueil introuvable : ' + site.dir); echec = true; continue; }

  const lire = (p) => fs.readFileSync(path.join(abs, p), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  /* Un lien commenté n'est pas un lien ; les liens externes et ../ sortent de la langue. */
  const liensDe = (p) => [...lire(p).matchAll(/href="([^"#?]+)"/g)].map(m => m[1])
      .filter(u => u.endsWith('.html') && !/^(https?:)?\/\//.test(u) && !u.startsWith('../'))
      .map(u => u.split('/').pop());

  /* ① AVEC JS — le menu centralisé, plus ce qu'il permet d'atteindre de proche en proche. */
  const menu = groupesNav(site.groupes) || new Set();
  const avecJS = new Set([site.accueil, ...menu].filter(p => pages.includes(p)));
  { const f = [...avecJS];
    while (f.length){ for (const l of liensDe(f.shift())) if (pages.includes(l) && !avecJS.has(l)) { avecJS.add(l); f.push(l); } } }

  /* ② SANS JS — uniquement les liens réellement présents dans le HTML servi. */
  const sansJS = new Set([site.accueil]); const file = [site.accueil];
  while (file.length){ for (const l of liensDe(file.shift())) if (pages.includes(l) && !sansJS.has(l)) { sansJS.add(l); file.push(l); } }

  const invisibles = pages.filter(p => !avecJS.has(p) && !_HORS_NAV[p]);
  const sansJsSeul = pages.filter(p => avecJS.has(p) && !sansJS.has(p) && !_HORS_NAV[p]);
  const exemptees  = pages.filter(p => !avecJS.has(p) && _HORS_NAV[p]);
  /* ③ CULS-DE-SAC : on y entre, on n'en sort pas.
     ⚠️ Le critère n'est PAS « la page a une <nav> » — mon premier jet le croyait et accusait
     `pendable`, `scrabidon` et les deux `arbitrage`, qui ont tous un lien retour vers l'accueil.
     Ce qui compte n'est pas la balise, c'est de POUVOIR SORTIR : un seul lien interne suffit. */
  const cul = pages.filter(p => p !== site.accueil && !_SANS_NAV_OK[p] && !_HORS_NAV[p]
    && lire(p).indexOf('nav.js') < 0
    && liensDe(p).filter(l => pages.includes(l) && l !== p).length === 0);

  console.log('  %s : %d pages · %d atteignables AVEC JS · %d SANS JS%s',
    site.nom.padEnd(9), pages.length, avecJS.size, sansJS.size,
    exemptees.length ? ' · ' + exemptees.length + ' hors-nav assumée(s)' : '');
  for (const p of exemptees) console.log('      – ' + p + ' (' + _HORS_NAV[p] + ')');

  if (invisibles.length) { echec = true;
    console.log('    ✗ INVISIBLES POUR TOUS — ni dans nav.js, ni liées : ' + invisibles.join(', '));
    console.log('      Les ajouter aux groupes de nav.js, ou les inscrire dans _HORS_NAV AVEC LA RAISON.'); }
  if (sansJsSeul.length) { echec = true;
    console.log('    ✗ PERDUES SANS JAVASCRIPT — nav.js les sert, le HTML servi non : ' + sansJsSeul.join(', '));
    console.log('      Les <a> codés en dur sont le REPLI : les y remettre (nav ou pied de page).'); }
  if (cul.length) { echec = true;
    console.log('    ✗ CULS-DE-SAC — aucune <nav> ni nav.js, on entre sans pouvoir sortir : ' + cul.join(', ')); }
}
if (echec) process.exit(1);
console.log('  ✓ toutes les pages sont atteignables, avec ET sans JavaScript');
