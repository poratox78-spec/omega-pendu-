#!/usr/bin/env node
/* LE MOTEUR NE DÉPEND PAS DE L'ORDRE DES VERBES DE SA TABLE DE CONJUGAISON (LA LISTE n° 145, 24/10/2026).
 *
 * Vu en rejouant la 144 : une table au contenu identique mais aux verbes rangés autrement rendait « nous vîtes », « il vîmes » muets
 * (24 cas de couverture) — l'index du passé simple (_PS_INDEX) gardait les verbes dans l'ordre de la table, et la règle lisait le
 * premier (« vîmes » est réclamé par voir et, à tort, par visser — ligne 147). Depuis la 145, il les range par fréquence.
 * Ce banc fait tourner le produit deux fois — table livrée, puis la même table aux verbes en ordre INVERSE — sur tous les cas de
 * passé simple de la couverture (dictee/couverture_conj_cas.json), et exige les mêmes marques, cas pour cas.
 *   node dictee/ordre_moteur_probe.js        (sortie 1 = une marque dépend de l'ordre)
 */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
if (process.argv[2] === '--marques') {   // passage enfant : les marques du produit (dossier d'extension donné) sur les phrases de stdin
  const D = require(path.join(ROOT, 'extension', 'charger_node.js'))({ ext: process.argv[3] });
  const phrases = JSON.parse(fs.readFileSync(0, 'utf8'));
  process.stdout.write(JSON.stringify(phrases.map((p) => (D.diagnoseAll(p).flags || []).map((f) => [f.i, f.name, f.tier, f.sugg]))), () => process.exit(0));
  return;
}
const cas = require('./couverture_conj_cas.json').cas.filter((c) => c[1] === 'ind:pas');
const phrases = cas.map((c) => c[4]);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ordre145_'));
try {
  const ext = path.join(tmp, 'extension');
  fs.cpSync(path.join(ROOT, 'extension'), ext, { recursive: true });
  const p = path.join(ext, 'assets', 'vdc-lex.json'), v = JSON.parse(fs.readFileSync(p, 'utf8'));
  const c = v.cj.c, inv = {};
  for (const lem of Object.keys(c).reverse()) inv[lem] = c[lem];   // même contenu, verbes en ordre inverse (`f` se recalcule de `c`)
  v.cj.c = inv;
  fs.writeFileSync(p, JSON.stringify(v));
  const marques = (dossier) => JSON.parse(cp.execFileSync(process.execPath, ['--max-old-space-size=4096', __filename, '--marques', dossier],
    { input: JSON.stringify(phrases), maxBuffer: 1 << 28 }).toString('utf8'));
  const A = marques(path.join(ROOT, 'extension')), B = marques(ext);
  const ko = [];
  for (let k = 0; k < phrases.length; k++) if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) ko.push(cas[k][0] + ' ' + cas[k][2]);
  if (ko.length) {
    console.log('✗ ' + ko.length + ' cas de passé simple changent de marque quand les verbes de la table changent d\'ordre (ex. ' + ko.slice(0, 4).join(' · ') + ')');
    process.exitCode = 1;
  } else console.log('✓ moteur indépendant de l\'ordre des verbes de sa table : ' + phrases.length + ' cas de passé simple, mêmes marques (table livrée / ordre inverse)');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
