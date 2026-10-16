// g2p du moteur sous Node, avec la MÊME portée que l'app (tables de conjugaison pour le « -ent » des verbes) —
// pendant JS de dictee/g2p_parity_probe.py. Lit une liste de mots (JSON) et écrit {mot: {s: [[graphème, phonème], …], k: clé de son}}.
// Le produit (dys-core + ses tables) passe par le chargeur unique extension/charger_node.js : la clé de son `sonKey` est celle de l'extension.
//   node dictee/g2p_parity_node.js <mots.json> <sortie.json>
'use strict';
const fs = require('fs'), path = require('path');
const HERE = __dirname, EXT = path.join(HERE, '..', 'extension');
global.self = global;
const DC = require(path.join(EXT, 'charger_node.js'))({ ext: EXT });
globalThis.CONJ_F = {}; globalThis.CONJ_C = {};
try {
  let cj = JSON.parse(fs.readFileSync(path.join(EXT, 'assets', 'vdc-lex.json'), 'utf8')).cj;
  if (cj && !cj.f) cj = DC.cjRebuild(cj);   // table de conjugaison compacte : `f` recalculé comme dans le produit
  globalThis.CONJ_F = (cj && cj.f) || {}; globalThis.CONJ_C = (cj && cj.c) || {};
} catch (e) { console.error('vdc-lex.json illisible : ' + e.message); process.exit(2); }
const src = fs.readFileSync(path.join(EXT, 'assets', 'g2p.js'), 'utf8');
const D = new Function('self', 'global', src + '\nreturn _DECL2;')(global, global);
if (!D || typeof D.g2p !== 'function') { console.error('assets/g2p.js : pas de _DECL2.g2p'); process.exit(2); }
if (typeof DC.sonKey !== 'function') { console.error('dys-core n\'expose plus sonKey'); process.exit(2); }
const words = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = {};
for (const w of words) out[w] = { s: D.g2p(w).map((s) => [s.g, s.ph]), k: DC.sonKey(w) };
fs.writeFileSync(process.argv[3], JSON.stringify(out));
