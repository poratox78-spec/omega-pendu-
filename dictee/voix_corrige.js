// Dernier étage de la voie B (dictee/asr_voix.py) : le texte décodé passe dans le correcteur du PRODUIT, rouges seulement
// (le moteur Python n'évolue plus, ligne 25b). Lit le texte sur l'entrée standard, écrit le texte corrigé ; la ponctuation reste.
'use strict';
const path = require('path');
const D = require(path.join(__dirname, '..', 'extension', 'charger_node.js'))({ ext: path.join(__dirname, '..', 'extension') });
const TOK = /[A-Za-zÀ-ÿœŒ'’ʼ]+/g;
const FORME = /virgule|point final|point d'interrogation|typographie|majuscule|espace|espacement/;

function corrige(t) {
  const flags = (D.diagnoseAll(t).flags || []).filter((f) => typeof f.i === 'number' && typeof f.sugg === 'string' && f.tier === 'auto' && !FORME.test(f.name));
  if (!flags.length) return t;
  const parMot = new Map(flags.map((f) => [f.i, f]));
  const pos = []; let m; TOK.lastIndex = 0;
  while ((m = TOK.exec(t))) pos.push([m.index, m.index + m[0].length]);
  let out = '', cur = 0;
  for (let k = 0; k < pos.length; k++) {
    const f = parMot.get(k); if (!f) continue;
    const fin = pos[Math.min(k + (f.span || 1) - 1, pos.length - 1)][1];
    out += t.slice(cur, pos[k][0]) + f.sugg; cur = fin;
    k += (f.span || 1) - 1;
  }
  return out + t.slice(cur);
}
if (require.main === module) {
  let s = ''; process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { s += d; });
  process.stdin.on('end', () => { process.stdout.write(corrige(s.replace(/\s+$/, ''))); });
}
module.exports = { corrige };
