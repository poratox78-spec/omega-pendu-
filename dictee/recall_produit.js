// ===== Garde de rappel « j'est être/avoir + élision + FP », rejouée sur le PRODUIT (ligne 25b, étape 3, 22/10/2026) =====
// Mêmes comportements que dictee/recall_probe.py --check (exportés dans recall_comportements.json par export_recall.py), jugés sur
// le moteur du PRODUIT (dys-core + assets, extension/charger_node.js) au lieu du moteur Python :
//   expect / abstain / nofp / elide / palier → les MARQUES du produit (diagnoseAll().flags, sans « point final ») : le Python juge sa
//     grammaire à tous paliers, le produit range ses oranges de grammaire dans la couche orthographe (vigAt) — c'est la fusion qui compte ;
//     nofp ne compte pas la typographie (couche à part, hors grammaire, absente du Python) ni l'orthographe d'un NON-MOT (« séte ») :
//     ces phrases gardent une faute d'orthographe exprès, c'est la GRAMMAIRE qui doit se taire ; un vrai mot touché reste un FP ;
//   vig → la suggestion de l'ORTHOGRAPHE du produit (diagnoseAll().spell, tous paliers) ;
//   a_participe → ni la grammaire ni le pipeline complet ne touchent « a » devant un participe mal écrit ou un inconnu accentué.
//   node dictee/recall_produit.js
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = require(path.join(ROOT, 'extension', 'charger_node.js'))({ ext: path.join(ROOT, 'extension') });
const C = require('./recall_comportements.json');
const deacc = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const lo = (s) => deacc(s.toLowerCase());
const gram = (t) => (D.diagnoseAll(t).flags || []).filter((f) => f.name !== 'point final');
const connu = (w) => D._spLire.W(String(w || '').toLowerCase());
const horsGrammaire = (f) => f.from !== undefined || ((f.name === 'orthographe' || f.name === 'mot inconnu') && !connu(f.word));
const bad = [];
for (const [s, w, sug] of C.elide) if (!gram(s).some((f) => lo(f.word) === lo(w) && f.sugg === sug)) bad.push(`${s} → ${w}→${sug} non détecté`);
for (const [s, exp] of C.expect) { const f = gram(s).find((x) => lo(x.word) === "j'est"); if (!f || f.sugg !== exp) bad.push(`${s} → attendu ${exp}, eu ${f ? f.sugg : 'rien'}`); }
for (const s of C.abstain) if (gram(s).some((f) => lo(f.word) === "j'est")) bad.push(`${s} → ne devrait pas toucher « j'est »`);
for (const s of C.nofp) { const g = gram(s).filter((f) => !horsGrammaire(f)); if (g.length) bad.push(`${s} → FAUX POSITIF : ${g.map((f) => f.word + '→' + f.sugg).join(', ')}`); }
for (const [s, w, tr] of C.palier) { const got = gram(s).filter((f) => lo(f.word) === lo(w)).map((f) => f.tier); if (got.length !== 1 || got[0] !== tr) bad.push(`${s} → palier de ${w} attendu ${tr}, eu ${got.join(',') || 'rien'}`); }
for (const [s, w, sug] of C.vig) { const got = (D.diagnoseAll(s).spell || []).filter((f) => lo(f.word) === lo(w)).map((f) => f.sugg); if (got.length !== 1 || got[0] !== sug) bad.push(`${s} → orthographe : ${w} attendu ${sug}, eu ${got.join(',') || 'rien'}`); }
for (const s of C.a_participe) { const fl = D.diagnoseAll(s).flags || []; if (fl.some((f) => f.word === 'a')) bad.push(`${s} → « a » touché devant un participe mal écrit`); }
const n = Object.values(C).reduce((a, v) => a + v.length, 0);
if (bad.length) { console.error('✗ rappel AU PRODUIT : régression(s) :\n    ' + bad.join('\n    ')); process.exit(1); }
console.log(`✓ rappel AU PRODUIT : ${n} comportements clés OK (j'est être/avoir + élision + FP + orthographe)`);
