// ===== Validation HELD-OUT (vocabulaire neuf), rejouée sur le PRODUIT (ligne 25b, étape 6, 22/10/2026) =====
// Même jeu que dictee/eval_externe.py (dictee/corpus_externe.json : phrases au vocabulaire absent des autres bancs), mêmes trois
// mesures, jugées sur le moteur du PRODUIT (dys-core + assets, extension/charger_node.js ; marques fusionnées, sans « point final ») :
//   faux positifs — la phrase correcte ne marque pas le déclencheur ;
//   détection     — la faute injectée (même construction que le Python : le déclencheur remplacé) est repérée ;
//   correction    — la bonne forme est proposée.
// Le Python se contente d'afficher ; ici les chiffres sont des PLANCHERS. Mesuré à la pose : 0 FP, 25/26 repérées et corrigées (le
// Python 26/26 : « ce » devant un mot à la fois nom et verbe, après un sujet NOMINAL, dont aucune table ne connaît le genre — le
// produit se taisait). Comblé le 23/10/2026 (ligne 139 ④) : 26/26, plancher monté.
//   node dictee/eval_externe_produit.js
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = require(path.join(ROOT, 'extension', 'charger_node.js'))({ ext: path.join(ROOT, 'extension') });
const { cases } = require('./corpus_externe.json');
const PLANCHER = 26;   // détection ET correction : 25 à la pose (22/10/2026), 26 depuis la ligne 139 (23/10) — monter, jamais descendre
const deacc = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const lo = (s) => deacc(String(s).toLowerCase());
const marques = (t) => (D.diagnoseAll(t).flags || []).filter((f) => f.name !== 'point final');
let fp = 0, det = 0, corr = 0; const per = {}, notes = [];
for (const [good, trig, wrong, kind] of cases) {
  const p = (per[kind] = per[kind] || [0, 0, 0, 0]); p[3]++;
  if (marques(good).some((f) => lo(f.word) === lo(trig))) { fp++; p[0]++; notes.push(`FP : ${good} [${kind}]`); }
  const bad = D.toks(good).map((t) => (lo(t) === lo(trig) ? wrong : t)).join(' ');
  const h = marques(bad).find((f) => lo(f.word) === lo(wrong));
  if (h) {
    det++; p[1]++;
    if (String(h.sugg).toLowerCase() === trig.toLowerCase()) { corr++; p[2]++; } else notes.push(`correction : ${bad} → ${h.sugg} (attendu ${trig}) [${kind}]`);
  } else notes.push(`raté : ${bad} [${kind}]`);
}
console.log('=== VALIDATION HELD-OUT AU PRODUIT (vocabulaire neuf) ===');
console.log(`  faux positifs ${fp}/${cases.length} · DÉTECTION ${det}/${cases.length} · CORRECTION ${corr}/${cases.length} (plancher ${PLANCHER})`);
for (const k of Object.keys(per).sort()) { const [a, b, c, t] = per[k]; console.log(`     ${k.padEnd(20)} fp=${a}/${t}  det=${b}/${t}  corr=${c}/${t}`); }
notes.forEach((x) => console.log('     · ' + x));
const ok = fp === 0 && det >= PLANCHER && corr >= PLANCHER;
console.log(`${ok ? '✓' : '✗'} held-out AU PRODUIT : FP ${fp} (max 0), détection ${det}, correction ${corr} (plancher ${PLANCHER})`);
process.exit(ok ? 0 : 1);
