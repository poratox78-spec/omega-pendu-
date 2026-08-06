#!/usr/bin/env node
/* REJOUER UNE VRAIE DICTÉE DANS LE MOTEUR LIVRÉ.
 *
 * POURQUOI CE FICHIER EXISTE. Pendant toute la journée du 2026-08-06, chaque bug de ponctuation
 * signalé par Rem s'est heurté au même mur : impossible de le REPRODUIRE. Le harnais synthétique
 * de `proso_probe` fabrique des silences propres ; la vraie dictée, elle, a des reprises, des
 * hésitations, des segments que Google révise. Trois tentatives d'écrire un cas de garde pour le
 * « ,, » ont donné des cas qui passaient AVEC ET SANS le correctif — c'est-à-dire rien.
 * Le bouton Diagnostic (PR#406) produit exactement l'entrée de `prosodyText` : segments bruts,
 * instants, et la timeline énergie/hauteur. Cette sonde la lui redonne.
 *
 * ⚠️ ON REJOUE DANS LE MOTEUR LIVRÉ, extrait du fichier publié par `charge()` de proso_probe —
 * jamais dans une copie. Une sonde qui rejoue sa propre version ne diagnostique rien.
 *
 * ⚠️ LES DUMPS SONT DANS data_local/ ET N'Y BOUGENT PAS : ils contiennent le texte réel de
 * quelqu'un. Gitignoré, jamais commité. Le site est public.
 *
 *   node dictee/rejeu_probe.js data_local/voix/diag1.txt
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const RACINE = path.dirname(__dirname);

require(path.join(RACINE, 'extension', 'dys-core.js'));
const DC = global.DYSCORE;
DC.setPosHmm(JSON.parse(fs.readFileSync(path.join(RACINE, 'dictee', 'pos_hmm.json'), 'utf8')));
DC.setPonctLm(JSON.parse(zlib.gunzipSync(
  fs.readFileSync(path.join(RACINE, 'extension', 'assets', 'ponct-lm.json.gz'))).toString('utf8')));

/* ── LE MOTEUR LIVRÉ. On réutilise l'extracteur de  (exporté quand il est require)
      plutôt que d'en écrire un second : deux extracteurs = deux occasions de diverger. */
const { charge } = require(path.join(RACINE, 'dictee', 'proso_probe.js'));

const FICHIER = process.argv[2] || path.join(RACINE, 'data_local', 'voix', 'diag1.txt');
if (!fs.existsSync(FICHIER)) { console.log('dump absent : ' + FICHIER); process.exit(0); }
const d = JSON.parse(fs.readFileSync(FICHIER, 'utf8').trim());

/* Le dump compacte la timeline en triplets [t, r, f] ; le moteur attend {t, r, f}. */
const etat = {
  base: '', finals: d.finals, ftimes: d.ftimes, tEnd: d.tEnd,
  au: { maxr: d.au.maxr, tl: d.au.tl.map(x => ({ t: x[0], r: x[1], f: x[2] })) },
};

const site = charge(path.join(RACINE, 'saisie-vocale.html'), 'prosodyText');
const ext = charge(path.join(RACINE, 'extension', 'sidepanel.js'), 'prosodyText');
const a = site(JSON.parse(JSON.stringify(etat)));
const b = ext(JSON.parse(JSON.stringify(etat)));

console.log('REJEU — ' + path.basename(FICHIER));
console.log('  ' + Object.keys(d.finals).length + ' segments · ' + (d.tEnd / 1000).toFixed(1) +
            ' s · ' + d.au.tl.length + ' points de timeline\n');
console.log('  site : ' + a);
if (a !== b) { console.log('\n  ⚠️ EXT DIVERGE : ' + b); }
else console.log('\n  ext  : identique (parité OK)');

if (d.texte && d.texte !== a) {
  /* ⚠️ Une divergence ici n'est PAS forcément un bug du rejeu : le dump porte le texte APRÈS
     d'éventuelles corrections cliquées dans la zone de saisie. On la signale sans conclure. */
  console.log('\n  ⓘ le texte du dump diffère du rejeu (corrections appliquées après coup ?) :');
  console.log('    dump  : ' + d.texte);
}

/* ── OÙ SONT LES SILENCES, ET QUELLE MARQUE ILS ONT REÇUE ────────────────────────────────── */
const rs = d.au.tl.map(x => x[1]).slice().sort((x, y) => x - y);
const q = p => rs[Math.min(rs.length - 1, Math.floor(p * rs.length))];
const seuil = Math.min(Math.max(0.008, q(0.10) * 3 + 0.004), Math.max(0.008, q(0.50) * 0.5));
console.log('\n  seuil de silence (formule livrée) : ' + seuil.toFixed(5) +
            '  = ' + (100 * seuil / d.au.maxr).toFixed(2) + ' % du max\n');
const ks = Object.keys(d.finals).map(Number).sort((x, y) => x - y);
console.log('  FRONTIÈRES DE SEGMENT — silence mesuré et marque obtenue :');
for (let i = 1; i < ks.length; i++) {
  const t0 = d.ftimes[ks[i - 1]];
  let fin = t0, deb = null;
  for (const [t, r] of d.au.tl) {
    if (t < t0) continue;
    if (r < seuil) { if (deb === null) deb = t; }
    else { if (deb !== null) { fin = deb; break; } }
  }
  const sil = deb !== null ? (fin === deb ? 0 : 0) : 0;
  // silence effectif : du dernier cadre parlant avant ftimes au premier cadre parlant après
  let dernier = null, premier = null;
  for (const [t, r] of d.au.tl) {
    if (t <= t0 && r >= seuil) dernier = t;
    if (t > t0 && r >= seuil && premier === null) premier = t;
  }
  const ms = (dernier !== null && premier !== null) ? premier - dernier : null;
  const bande = ms === null ? '?' : (ms < 190 ? 'RIEN' : (ms < 600 ? 'virgule' : 'POINT'));
  console.log('    ' + String(ms === null ? '?' : ms + ' ms').padStart(8) + '  ' + bande.padEnd(8) +
              ' « ' + String(d.finals[ks[i - 1]]).slice(-34) + ' | ' +
              String(d.finals[ks[i]]).slice(0, 30) + ' »');
}
