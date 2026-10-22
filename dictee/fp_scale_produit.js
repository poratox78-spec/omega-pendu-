// ===== FP À L'ÉCHELLE, sur le PRODUIT (ligne 25b, étape 2, 22/10/2026) =====
// Même garde que dictee/fp_scale_probe.py, rejouée sur le moteur du PRODUIT (extension/dys-core.js + assets, extension/charger_node.js)
// au lieu du moteur Python, sur fp_scale_corpus.txt — 2 500 phrases correctes d'UD French-GSD (CC BY-SA 4.0). Le texte est correct :
// toute phrase marquée est un faux positif (ou une vraie faute d'UD). Deux chiffres, deux plafonds :
//   [1] GRAMMAIRE (diagnoseAll().grammar, tous paliers) : le jumeau de la garde Python, même plafond 3,0 % ;
//   [2] FUSION = la grammaire + les ORANGES DE GRAMMAIRE que le produit range dans la couche orthographe (la chaîne orange vigAt :
//       familles « … à vérifier »). Le Python les juge dans sa grammaire, le produit les rend avec l'orthographe : sans [2], une orange
//       qui se met à tirer sur du français correct passerait sous la garde. Mesuré à la pose : 105 phrases (4,20 %), dont 48 des 50
//       que le Python marque ; plafond 5,2 % = le mesuré + la marge de la garde Python (25 phrases : 50 mesurées, plafond 75).
// L'orthographe elle-même (accents, non-mots, élision) a sa propre garde : speller_fp_scale_probe.js.
//   node dictee/fp_scale_produit.js           → taux + détail par règle
//   node dictee/fp_scale_produit.js --check   → sort 1 au-dessus d'un plafond
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const D = require(path.join(ROOT, 'extension', 'charger_node.js'))({ ext: path.join(ROOT, 'extension') });
const CEILING = 3.0, CEILING_FUSION = 5.2;
const orangeGram = (f) => / à vérifier$/.test(f.name);
const sents = fs.readFileSync(path.join(__dirname, 'fp_scale_corpus.txt'), 'utf8').split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim());
const by = new Map(); let flagged = 0, fusion = 0;
for (const s of sents) {
  const r = D.diagnoseAll(s);
  const g = r.grammar || [], v = (r.spell || []).filter(orangeGram);
  if (g.length) flagged++;
  if (g.length || v.length) fusion++;
  for (const f of g.concat(v)) by.set(f.name, (by.get(f.name) || 0) + 1);
}
const rate = 100 * flagged / sents.length, rateF = 100 * fusion / sents.length;
const detail = () => [...by.entries()].sort((a, b) => b[1] - a[1]).forEach(([n, c]) => console.log('    ' + n.padEnd(45) + c));
if (process.argv.includes('--check')) {
  const err = [];
  if (rate > CEILING) err.push(`grammaire ${rate.toFixed(2)} % > plafond ${CEILING} % (${flagged}/${sents.length})`);
  if (rateF > CEILING_FUSION) err.push(`grammaire + oranges de l'orthographe ${rateF.toFixed(2)} % > plafond ${CEILING_FUSION} % (${fusion}/${sents.length})`);
  if (err.length) { console.log(`✗ FP à l'échelle AU PRODUIT : ${err.join(' ; ')}. Détail :`); detail(); process.exit(1); }
  console.log(`✓ FP à l'échelle AU PRODUIT : grammaire ${rate.toFixed(2)} % ≤ ${CEILING} %, avec les oranges de l'orthographe ${rateF.toFixed(2)} % ≤ ${CEILING_FUSION} % (${sents.length} phrases correctes UD)`);
  process.exit(0);
}
console.log(`Produit sur ${sents.length} phrases correctes (UD French-GSD) : grammaire ${flagged} marquées = ${rate.toFixed(2)} % ; avec les oranges de l'orthographe ${fusion} = ${rateF.toFixed(2)} %`);
detail();
