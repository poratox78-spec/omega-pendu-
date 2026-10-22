// ===== PARITÉ DIRECTE app ≡ extension de la GRAMMAIRE, sans la référence Python (ligne 25b, étape 9, 22/10/2026) =====
// parity_corr.js (app ⊆ Python) et extension/parity_core.js (extension ⊆ Python) ne comparaient l'app et l'extension qu'À TRAVERS le
// Python : deux sous-ensembles d'une même référence peuvent différer entre eux sans qu'aucun ne rougisse, et la parité s'éteint avec
// le Python. Ici les deux moteurs, équipés par leurs harnais (mode --dump, chacun dans son processus), corrigent les MÊMES phrases et
// doivent rendre EXACTEMENT les mêmes marques : position, mot, suggestion, règle, palier.
// Phrases : les deux batteries des harnais + tout ce que les bancs du produit commitent (phrases correctes de la dictée, batterie du
// correcteur, garde j'est, vocabulaire neuf, couverture de la conjugaison, genre perdu par la désaccentuation, 2 500 phrases d'UD).
// Mesuré à la pose : 0 différence (une seule avant la réparation du harnais de l'app, à qui manquait le genre accentué).
//   node dictee/parity_app_ext.js
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const HERE = __dirname, ROOT = path.join(HERE, '..');
const lire = (f) => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));
function dump(script, phrases) {
  const r = cp.spawnSync('node', [path.join(ROOT, script), '--dump'], { input: phrases ? JSON.stringify(phrases) : '', encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  if (r.status !== 0) { console.error(`${script} --dump : échec\n${(r.stderr || '').slice(-2000)}`); process.exit(2); }
  return JSON.parse(r.stdout);
}
const ph = new Set();
const add = (s) => { if (typeof s === 'string' && s.trim()) ph.add(s); };
dump('dictee/parity_corr.js').p.forEach(add);
dump('extension/parity_core.js').p.forEach(add);
lire('sentences.json').forEach((e) => add(e.text));
const B = lire('batterie_correcteur.json');
B.cases.forEach(([good, trig, wrong]) => { add(good); add(good.split(/\s+/).map((t) => (t.toLowerCase() === trig.toLowerCase() ? wrong : t)).join(' ')); });
B.muets.forEach((e) => add(e[0]));
const R = lire('recall_comportements.json');
for (const k of Object.keys(R)) R[k].forEach((x) => add(Array.isArray(x) ? x[0] : x));
lire('corpus_externe.json').cases.forEach(([good]) => add(good));
lire('couverture_conj_cas.json').cas.forEach((c) => add(c[4]));
lire('gender_coll_cas.json').cas.forEach(([mot, g]) => { add(`Il note un ${mot} ici.`); add(`Il note une ${mot} ici.`); });
fs.readFileSync(path.join(HERE, 'fp_scale_corpus.txt'), 'utf8').split('\n').forEach((l) => add(l.replace(/\r$/, '')));
const phrases = [...ph];
const A = dump('dictee/parity_corr.js', phrases).f, E = dump('extension/parity_core.js', phrases).f;
const cle = (f) => f.map((x) => x.join('|')).sort().join(' ; ');
const diff = [];
phrases.forEach((p, k) => { if (cle(A[k]) !== cle(E[k])) diff.push(`${p}\n        app : ${cle(A[k]) || '—'}\n        ext : ${cle(E[k]) || '—'}`); });
const marques = A.reduce((n, f) => n + f.length, 0);
console.log(`PARITÉ DIRECTE app ≡ extension (grammaire) — ${phrases.length} phrases, ${marques} marques côté app`);
diff.slice(0, 20).forEach((d) => console.log('  ✗ ' + d));
if (diff.length) { console.log(`✗ ${diff.length} phrase(s) où l'app et l'extension ne corrigent pas pareil`); process.exit(1); }
console.log('✓ app ≡ extension : mêmes marques (position, mot, suggestion, règle, palier) sur toutes les phrases');
