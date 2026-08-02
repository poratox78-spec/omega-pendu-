// Garde de PARITÉ Python↔JS pour le correcteur anglais (comme parity_core.js côté FR).
// Fait tourner le moteur JS (corrector_en.js) ET les probes Python sur TOUT UD English-EWT,
// puis compare les agrégats (speller AUTO, homophone RED). Divergence => exit 1.
//   node dictee/parity_en.js        (nécessite data_local/en_ewt-ud-train.conllu + python)
'use strict';
const path = require('path'), fs = require('fs');
const { execFileSync } = require('child_process');
const ce = require('./corrector_en.js');

const EWT = path.join(__dirname, '..', 'data_local', 'en_ewt-ud-train.conllu');
if(!fs.existsSync(EWT)){ console.log('[parity_en] EWT absent — skip'); process.exit(0); }

const lex = ce.loadLexNode(path.join(__dirname, 'lex_en.tsv.gz'));
let jsAuto = 0, jsRed = 0, jsFlag = 0, jsOrange = 0;
for(const line of fs.readFileSync(EWT, 'utf8').split('\n')){
  if(!line.startsWith('# text = ')) continue;
  const T = ce.tokenize(line.slice(9));
  for(let i = 0; i < T.length; i++){
    const [, m] = ce.spellSuggest(lex, T[i]);
    if(m === 'AUTO') jsAuto++; else if(m === 'FLAG') jsFlag++;
    const [, hl] = ce.homoDecide(lex, T, i);
    if(hl === 'RED') jsRed++; else if(hl === 'ORANGE') jsOrange++;
  }
}

function py(script, re){
  const out = execFileSync('python', [path.join(__dirname, script)],
    { encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' } });
  const m = out.match(re);
  return m ? parseInt(m[1], 10) : -1;
}
const pyAuto = py('speller_en_probe.py', /AUTO \(rouge\) sur texte correct : (\d+)/);
const pyRed  = py('homophone_en_probe.py', /RED \(rouge\) sur texte correct : (\d+)/);

console.log('speller  AUTO : JS %d  vs  PY %d', jsAuto, pyAuto);
console.log('homophone RED : JS %d  vs  PY %d', jsRed, pyRed);
console.log('(info) JS FLAG %d · ORANGE %d', jsFlag, jsOrange);
if(jsAuto !== pyAuto || jsRed !== pyRed){
  console.error('❌ PARITÉ ROMPUE (JS ≠ Python)'); process.exit(1);
}
console.log('✅ PARITÉ OK (JS == Python sur EWT)');
