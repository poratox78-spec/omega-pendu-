'use strict';
// ⭐ 14/10/2026 (liste n° 25) — GARDE DU CHARGEUR UNIQUE.
//  ① extension/charger_node.js charge les MÊMES tables que l'extension : les clés de loadLex dans content.js et sidepanel.js (et le
//     chargement des confusables) sont toutes couvertes — une table ajoutée au produit sans passer par le chargeur fait échouer la garde ;
//  ② aucun banc Node ne charge dys-core.js à la main sans le dire : soit il passe par charger_node.js, soit il porte la mention
//     « chargeur partiel voulu : <raison> » (un banc d'un seul module, une parité avec Python qui n'a pas le modèle OS…).
//   node extension/chargeur_probe.js [--check]
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), CHECK = process.argv.includes('--check');
const err = [];
const C = require('./charger_node.js');
const couvertes = new Set(['vdc', 'genderRelaxed', 'speller', ...Object.keys(C.TABLES)]);
for (const f of ['content.js', 'sidepanel.js']) {
  const s = fs.readFileSync(path.join(__dirname, f), 'utf8');
  const i = s.indexOf('DC.loadLex(');
  if (i < 0) { err.push(f + ' : appel DC.loadLex introuvable'); continue; }
  const bloc = s.slice(i, s.indexOf('})', i) + 2);
  const cles = [...bloc.matchAll(/(\w+)\s*:\s*(?:chrome\.runtime\.getURL\(|[a-zA-Z]+Url\b|sp\b|nom\b)/g)].map(m => m[1]);
  if (!cles.length) err.push(f + ' : aucune clé lue dans loadLex');
  for (const k of cles) if (!couvertes.has(k)) err.push(f + ' : la table « ' + k + ' » est chargée par le produit mais PAS par charger_node.js');
  if (/loadJuge\(/.test(s) && !/setJuge/.test(fs.readFileSync(path.join(__dirname, 'charger_node.js'), 'utf8'))) err.push(f + ' : le juge léger est chargé par le produit mais PAS par charger_node.js');
  if (/loadConfusables\(/.test(s) && !/setConfusables/.test(fs.readFileSync(path.join(__dirname, 'charger_node.js'), 'utf8'))) err.push(f + ' : confusables chargées par le produit, pas par charger_node.js');
}
const bancs = [];
for (const d of ['extension', 'dictee']) for (const f of fs.readdirSync(path.join(ROOT, d))) {
  if (!/\.js$/.test(f) || f === 'dys-core.js' || f === 'charger_node.js' || f === 'chargeur_probe.js') continue;
  const s = fs.readFileSync(path.join(ROOT, d, f), 'utf8');
  if (!/require\([^)]*dys-core\.js|['"]dys-core\.js['"]\s*\)\s*\)|charger_node(\.js)?['"]/.test(s)) continue;
  const ok = /charger_node(\.js)?['"]/.test(s), partiel = /chargeur partiel voulu\s*:/.test(s);
  bancs.push([d + '/' + f, ok ? 'chargeur unique' : partiel ? 'partiel déclaré' : 'NON DÉCLARÉ']);
  if (!ok && !partiel) err.push(d + '/' + f + ' : charge dys-core.js à la main sans passer par charger_node.js ni déclarer « chargeur partiel voulu : <raison> »');
}
const n = (k) => bancs.filter(b => b[1] === k).length;
if (err.length) { console.error('✗ CHARGEUR UNIQUE :\n  ' + err.join('\n  ')); if (CHECK) process.exit(1); }
else console.log('✓ chargeur unique : les tables de content.js et sidepanel.js sont toutes dans charger_node.js ; ' + bancs.length + ' bancs Node chargent le moteur (' + n('chargeur unique') + ' par le chargeur, ' + n('partiel déclaré') + ' partiels déclarés avec leur raison).');
