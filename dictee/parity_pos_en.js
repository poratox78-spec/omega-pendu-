// parity_pos_en.js — PARITÉ du POS-tagger ANGLAIS entre le JS (corrector_en.js) et la référence
// Python (pos_en.py). Même discipline que le FR (parity_pos.js) : les deux moteurs doivent produire
// la MÊME séquence d'UPOS sur les mêmes phrases, sinon une règle grammaticale divergerait selon le moteur.
// Corpus : UD English-EWT local (data_local/en_ewt-ud-train.conllu) si présent, sinon un jeu intégré.
//   node dictee/parity_pos_en.js [N]        · node dictee/parity_pos_en.js --check   (garde CI)
const fs = require('fs'), path = require('path'), zlib = require('zlib'), cp = require('child_process');
const HERE = __dirname;
const C = require('./corrector_en.js');

const mp = path.join(HERE, 'pos_hmm_en.json');
if(!fs.existsSync(mp)){ console.log('[SKIP] pos_hmm_en.json absent'); process.exit(0); }
C.setPosModel(JSON.parse(fs.readFileSync(mp, 'utf8')));

// --- phrases de test : EWT local si dispo, sinon repli intégré ---
const N = parseInt(process.argv.find(a => /^\d+$/.test(a)) || '400', 10);
let sents = [];
const ewt = path.join(HERE, '..', 'data_local', 'en_ewt-ud-train.conllu');
if(fs.existsSync(ewt)){
  let cur = [];
  for(const l of fs.readFileSync(ewt, 'utf8').split('\n')){
    if(l.startsWith('#')) continue;
    if(!l.trim()){ if(cur.length) sents.push(cur); cur = []; if(sents.length >= N) break; continue; }
    const c = l.split('\t');
    if(c.length < 4 || c[0].includes('-') || c[0].includes('.')) continue;
    cur.push(c[1]);
  }
} else {
  sents = [['Their','is','no','point','.'], ['I','put','it','over','there','.'],
           ['You','are','going','to','their','house','.'], ['He','have','runned','fast','.']];
}
console.log('parité POS EN : %d phrases', sents.length);

// --- côté Python (un seul appel, JSON in/out) ---
const inp = JSON.stringify(sents);
const py = cp.spawnSync('python', ['-c', `
import sys, json, io
sys.path.insert(0, ${JSON.stringify(HERE)})
from pos_en import tag_sentence, load_model
M = load_model()
S = json.loads(sys.stdin.read())
sys.stdout.write(json.dumps([tag_sentence(s, M) for s in S]))
`], { input: inp, encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });
if(py.status !== 0){ console.error('[python KO]', (py.stderr || '').slice(0, 400)); process.exit(1); }
const pyTags = JSON.parse(py.stdout);

let diff = 0, toks = 0;
for(let i = 0; i < sents.length; i++){
  const js = C.tagSentence(sents[i]), pt = pyTags[i];
  for(let k = 0; k < sents[i].length; k++){
    toks++;
    if(js[k] !== pt[k]){
      diff++;
      if(diff <= 8) console.log('  ✗ « %s » : JS %s vs PY %s (phrase %d)', sents[i][k], js[k], pt[k], i);
    }
  }
}
console.log(diff === 0 ? '✅ PARITÉ OK (JS == Python sur %d tokens)' : '❌ %d divergence(s) / %d tokens',
            diff === 0 ? toks : diff, toks);
if(process.argv.includes('--check') && diff !== 0) process.exit(1);
