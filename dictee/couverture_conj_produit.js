// ===== Couverture de la conjugaison, rejouée sur le PRODUIT (ligne 25b, étape 4, 22/10/2026) =====
// Mêmes cas que dictee/couverture_conj_probe.py (sujet × temps, une faute de PERSONNE, le temps gardé ; énumérés par le Python et
// écrits dans couverture_conj_cas.json par export_couverture.py), jugés sur le moteur du PRODUIT (dys-core + assets,
// extension/charger_node.js). Réussite = une marque du produit sur la forme fausse qui propose la forme juste (marques fusionnées :
// le produit range ses oranges de grammaire dans la couche orthographe). Test de COUVERTURE : rien sur les faux positifs.
// Ancrage : couverture_conj_produit_ref.json (taux ET réussites par sujet ; le nombre absolu ne baisse que si on perd vraiment).
//   node dictee/couverture_conj_produit.js [--fix] [--detail]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = require(path.join(ROOT, 'extension', 'charger_node.js'))({ ext: path.join(ROOT, 'extension') });
const K = require('./couverture_conj_cas.json');
const REF = path.join(__dirname, 'couverture_conj_produit_ref.json');
const FIX = process.argv.includes('--fix'), DETAIL = process.argv.includes('--detail');
const res = {}, rates = {};
for (const [sujet, temps, faux, juste, phrase] of K.cas) {
  const k = sujet + '|' + temps;
  res[k] = res[k] || [0, 0];
  res[k][1]++;
  const fl = (D.diagnoseAll(phrase).flags || []).filter((f) => f.name !== 'point final');
  // ⭐ 23/10/2026 (ligne 139 ①) : la correction peut arriver avec l'élision du pronom, sur DEUX mots (« je irons » → « j'irai ») — le
  // dernier mot marqué est la forme fausse, la suggestion finit par la forme juste, après « ' » ou une espace.
  const fin = (s) => String(s).toLowerCase().split(/\s+/).pop();
  const bon = (f) => { const w = String(f.word).toLowerCase(), s = String(f.sugg).toLowerCase(), j = juste.toLowerCase();
    return (w === faux.toLowerCase() && s === j) || (/\s/.test(w) && fin(w) === faux.toLowerCase() && (s.endsWith("'" + j) || s.endsWith(' ' + j))); };
  if (fl.some(bon)) res[k][0]++;
  else if ((rates[k] = rates[k] || []).length < 3) {
    const p = fl.filter((f) => String(f.word).toLowerCase() === faux.toLowerCase()).map((f) => f.sugg);
    rates[k].push(`${sujet} ${faux} → ${juste}${p.length ? ' (proposé : ' + p[0] + ')' : ' (muet)'}`);
  }
}
console.log(`COUVERTURE DE LA CONJUGAISON AU PRODUIT — faute de PERSONNE, le TEMPS est gardé (${K.cas.length} cas, ${K.sujets.length} sujets)`);
const taux = {}, reus = {};
for (const s of K.sujets) {
  let tf = 0, tn = 0;
  const ligne = K.temps.map((t) => { const r = res[s + '|' + t]; if (!r) return '—'.padStart(12); tf += r[0]; tn += r[1]; return `${r[0]}/${r[1]}`.padStart(12); });
  taux[s] = tn ? Math.round(1000 * tf / tn) / 10 : null;
  reus[s] = tf;
  console.log(`${s.padEnd(12)} ${ligne.join(' ')}   ${taux[s] === null ? '—' : taux[s].toFixed(1) + ' %'}`);
}
if (DETAIL) for (const k of Object.keys(rates)) console.log('   ' + k.padEnd(20) + rates[k].join(' | '));
if (FIX) {
  const o = {}; for (const s of K.sujets) o[s] = [taux[s], reus[s]];
  fs.writeFileSync(REF, JSON.stringify(o, null, 2) + '\n');
  console.log(`\n✓ ancré : ${K.sujets.length} sujets`);
  process.exit(0);
}
const ref = fs.existsSync(REF) ? JSON.parse(fs.readFileSync(REF, 'utf8')) : null;
if (!ref) { console.error('\n✗ COUVERTURE AU PRODUIT : aucun ancrage (lancer --fix)'); process.exit(1); }
const baisses = [];
for (const s of Object.keys(ref)) {
  const [t0, r0] = ref[s];
  if (taux[s] == null || t0 == null) continue;
  if (taux[s] < t0 - 0.05) baisses.push(`${s.padEnd(10)} ${taux[s].toFixed(1)} % < plancher ${t0.toFixed(1)} %`);
  if (reus[s] < r0) baisses.push(`${s.padEnd(10)} ${reus[s]} réussites < plancher ${r0}`);
}
if (baisses.length) {
  console.error('\n✗ COUVERTURE AU PRODUIT : la couverture a BAISSÉ :\n    ' + baisses.join('\n    ') + '\n    (baisse VOULUE et mesurée : node dictee/couverture_conj_produit.js --fix)');
  process.exit(1);
}
console.log(`\n✓ COUVERTURE AU PRODUIT : aucun sujet en baisse (${Object.keys(ref).length} ancrés)`);
