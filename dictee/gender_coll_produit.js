// ===== Genre perdu par la désaccentuation, rejoué sur le PRODUIT (ligne 25b, étape 5, 22/10/2026) =====
// Même banc que dictee/gender_coll_probe.py (mots dont la clé désaccentuée est partagée avec un autre genre : âme/amé,
// affaire/affairé ; échantillon et pièges exportés dans gender_coll_cas.json par export_gender_coll.py), sur le moteur du PRODUIT
// (dys-core + assets, extension/charger_node.js). Deux lectures :
//   [1] la GRAMMAIRE du produit (correctText), jugée comme le Python juge la sienne :
//       ① RAPPEL — « Il note un|une <mot> ici. » au mauvais genre : le déterminant est corrigé (plancher du Python) ;
//       ② FAUX POSITIFS — le mot bien accordé ne touche pas le déterminant ; les pièges d'adjectif antéposé ne déclenchent jamais
//          le genre du déterminant. Zéro, non négociable ;
//   [2] le produit COMPLET (diagnoseAll) : l'orthographe passe AVANT la grammaire, donc sur un nom mal écrit (« mere », « pole »),
//       le produit corrige le NOM et le déterminant suit le nom corrigé — ce n'est ni un raté ni une fausse alerte. Ce qui reste
//       interdit : toucher le déterminant d'un nom laissé tel qu'il est écrit. Zéro.
// Mesuré à la pose : [1] rappel 269 = le Python, 0 FP ; [2] 327 phrases réparées (déterminant ou nom), 0 déterminant touché à tort.
//   node dictee/gender_coll_produit.js
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = require(path.join(ROOT, 'extension', 'charger_node.js'))({ ext: path.join(ROOT, 'extension') });
const K = require('./gender_coll_cas.json');
const lo = (s) => String(s).toLowerCase();
const gram = (t) => D.correctText(t) || [];
const complet = (t) => (D.diagnoseAll(t).flags || []).filter((f) => f.name !== 'point final');
let rappel = 0, repares = 0; const rates = [], fp = [], fpComplet = [];
for (const [mot, g] of K.cas) {
  const faux = g === 'f' ? 'un' : 'une', bon = g === 'f' ? 'une' : 'un';
  const pf = `Il note ${faux} ${mot} ici.`, pb = `Il note ${bon} ${mot} ici.`;
  if (gram(pf).some((f) => lo(f.word) === faux && lo(f.sugg) === bon)) rappel++;
  else if (rates.length < 8) rates.push(`${faux} ${mot}`);
  for (const f of gram(pb)) if (lo(f.word) === bon) fp.push(`${bon} ${mot} → ${f.sugg}`);
  const F = complet(pf);
  if (F.some((f) => lo(f.word) === faux && lo(f.sugg) === bon) || F.some((f) => lo(f.word) === lo(mot) && f.name === 'orthographe')) repares++;
  const B = complet(pb);
  if (B.some((f) => lo(f.word) === bon) && !B.some((f) => lo(f.word) === lo(mot))) fpComplet.push(`${bon} ${mot}`);
}
for (const p of K.pieges) {
  for (const f of gram(p)) if (f.name === 'genre déterminant') fp.push(`${f.word} → ${f.sugg}  « ${p.slice(0, 60)} »`);
  for (const f of complet(p)) if (f.name === 'genre déterminant') fpComplet.push(`${f.word} → ${f.sugg}  « ${p.slice(0, 60)} »`);
}
console.log(`GENRE PERDU PAR LA DÉSACCENTUATION AU PRODUIT — ${K.cas.length} mots à clé partagée`);
console.log(`  [1] grammaire : rappel ${rappel} / ${K.cas.length} (plancher ${K.rappel_min}) · faux positifs ${fp.length}`);
rates.forEach((r) => console.log('      raté : ' + r));
fp.slice(0, 10).forEach((x) => console.log('      FP : ' + x));
console.log(`  [2] produit complet : ${repares} phrases réparées (déterminant ou nom) · déterminant touché sur un nom laissé tel quel : ${fpComplet.length}`);
fpComplet.slice(0, 10).forEach((x) => console.log('      FP : ' + x));
const ok = rappel >= K.rappel_min && fp.length === 0 && fpComplet.length === 0;
console.log(`${ok ? '✓' : '✗'} genre à clé partagée AU PRODUIT : rappel ${rappel} (plancher ${K.rappel_min}), FP ${fp.length} + ${fpComplet.length} (max 0)`);
process.exit(ok ? 0 : 1);
