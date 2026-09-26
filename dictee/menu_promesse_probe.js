#!/usr/bin/env node
/* UNE BARRE DE NAVIGATION NE PROMET PAS UNE PAGE POUR EN LIVRER UNE AUTRE.
 *
 * NÉ D'UN DÉFAUT RAPPORTÉ DEUX FOIS. Rem, 25/09/2026 : « quand je clique sur le pendu dans le menu
 * j'arrive sur le main ». Corrigé le jour même — dans `nav.js` SEULEMENT. Or `nav.js` remplace au
 * chargement une barre de repli écrite en dur dans chaque page : c'est elle que voit un visiteur
 * sans JavaScript, et c'est elle que tout le monde voit pendant les premières millisecondes.
 * Mesuré le 26/09 : **34 liens sur 24 pages** (18 en français, 16 en anglais) disaient encore
 * « Le pendu » / « The Hangman » / « Hangman » et menaient à l'ACCUEIL. Le bug avait survécu à sa
 * propre correction, dans l'autre moitié du menu.
 *
 * LA RÈGLE, ÉTROITE ET VOULUE TELLE. Dans un `<header>` ou un `<nav>`, un lien vers l'accueil ne
 * porte pas le nom d'une AUTRE page du site. Les noms sont relevés dans `nav.js` (les libellés du
 * menu) et dans les `<h1>` des pages : rien n'est recopié à la main, donc renommer une page met
 * le banc à jour tout seul.
 *
 * ⚠️ CE QU'ELLE NE COUVRE PAS, DÉLIBÉRÉMENT : la PROSE. « le moteur dont il est né :
 * <a href="./">le pendu cognitif →</a> » est juste — l'accueil est l'endroit où cette histoire se
 * raconte, et la phrase le dit. Quatre liens de ce genre existent (404, correcteur FR+EN,
 * pendable) ; les inclure obligerait à abîmer des phrases justes pour satisfaire une règle de
 * forme. Une barre de navigation, elle, n'a pas de phrase autour : son libellé EST sa promesse.
 *
 *   node dictee/menu_promesse_probe.js            # verbeux
 *   node dictee/menu_promesse_probe.js --check    # CI : silencieux si vert, sort 1 si rouge
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CHECK = process.argv.includes('--check');
const RACINE = path.join(__dirname, '..');
const rouges = [];
const log = (...a) => { if (!CHECK) console.log(...a); };

/* ── les pages du site (le périmètre de sitemap_probe : zh/ et node_modules exclus) ─────────── */
function pages(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'zh') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) pages(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const FICHIERS = pages(RACINE).filter((f) => !/[\\/](app|extension|police|evo|data_local)[\\/]/.test(f));
if (FICHIERS.length < 20) {
  console.log(`✗ MENU : seulement ${FICHIERS.length} pages lues — la lecture du site est cassée`);
  process.exit(1);
}

/* ── les NOMS des pages, relevés et non recopiés ────────────────────────────────────────────── */
const noms = new Map();          // nom en minuscules -> ce qu'il désigne (pour le message)

/* ① les libellés du menu construit */
const nav = fs.readFileSync(path.join(RACINE, 'nav.js'), 'utf8');
const mGroupes = nav.match(/var GROUPS = \[[\s\S]*?\n {2}\];/);
if (!mGroupes) {
  console.log('✗ MENU : GROUPS introuvable dans nav.js — ce banc ne mesure plus rien');
  process.exit(1);
}
let n = 0;
for (const m of mGroupes[0].matchAll(/\['([^']+)',\s*'([^']+)'\]/g)) {
  const [, href, libelle] = m;
  if (href === './' || href === '/' || href === 'index') continue;   // l'accueil lui-même
  noms.set(libelle.toLowerCase(), `« ${libelle} » (menu → ${href})`);
  n++;
}
if (n < 8) {
  console.log(`✗ MENU : seulement ${n} libellés lus dans nav.js — l'extraction est cassée`);
  process.exit(1);
}

/* ② les <h1> des pages, pour les noms que le menu ne porte pas */
for (const f of FICHIERS) {
  const s = fs.readFileSync(f, 'utf8');
  const m = s.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!m) continue;
  const t = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const rel = path.relative(RACINE, f).replace(/\\/g, '/');
  if (rel === 'index.html' || rel.endsWith('/index.html')) continue;  // l'accueil
  if (t && t.length <= 40 && !noms.has(t.toLowerCase())) {
    noms.set(t.toLowerCase(), `« ${t} » (titre de ${rel})`);
  }
}

/* ── la règle : dans une barre de navigation, un lien vers l'accueil ne porte pas ces noms ──── */
const ACCUEIL = /^(\.?\/|index|\.\/index\.html|index\.html|\/en\/|\.\.\/)$/;
let barres = 0, liens = 0;
for (const f of FICHIERS) {
  const s = fs.readFileSync(f, 'utf8');
  const rel = path.relative(RACINE, f).replace(/\\/g, '/');
  for (const bloc of s.matchAll(/<(header|nav)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    barres++;
    for (const a of bloc[2].matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const href = a[1].trim();
      const texte = a[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      if (!ACCUEIL.test(href)) continue;
      liens++;
      const cle = texte.toLowerCase().replace(/^[←→\s·]+|[←→\s·]+$/g, '');
      if (noms.has(cle)) {
        rouges.push(`${rel} : la barre de navigation promet ${noms.get(cle)} et pointe vers ` +
                    `l'accueil (href="${href}")`);
      }
    }
  }
}
if (barres < 20) rouges.push(`seulement ${barres} barres de navigation lues — l'extraction est cassée`);

if (rouges.length) {
  console.log('✗ MENU : une barre de navigation promet une page et en livre une autre —');
  rouges.slice(0, 12).forEach((r) => console.log('  ' + r));
  if (rouges.length > 12) console.log(`  … (+${rouges.length - 12})`);
  console.log("  (renommer le lien d'après ce qu'il ouvre : « Accueil » / « Home »)");
  process.exit(1);
}
log(`✓ menu : ${barres} barres de navigation, ${liens} liens vers l'accueil — aucun ne porte le nom ` +
    `d'une autre page (${noms.size} noms relevés dans nav.js et les h1, jamais recopiés).`);
