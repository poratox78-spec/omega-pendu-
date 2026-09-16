// parity_pos_en.js — PARITÉ du POS-tagger ANGLAIS entre le JS (corrector_en.js) et la référence
// Python (pos_en.py). Même discipline que le FR (parity_pos.js) : les deux moteurs doivent produire
// la MÊME séquence d'UPOS sur les mêmes phrases, sinon une règle grammaticale divergerait selon le moteur.
// Corpus : les 1 000 phrases d'UD English-PUD COMMITTÉES (dictee/parity_en_corpus.txt, CC BY-SA 3.0) — donc la garde
// tourne EN CI — plus, en local, les N premières phrases d'UD English-EWT (data_local/en_ewt-ud-train.conllu).
// ⚠️ 16/09/2026 : cette garde ne tournait qu'en local et son ❌ ne faisait pas échouer sans --check ; les trois
// post-passes du JS (#428-#430) ont manqué au Python pendant cinq semaines. Désormais : PUD toujours, rouge = exit 1.
//   node dictee/parity_pos_en.js [N]        (N = phrases EWT en plus, défaut 2000 ; sans EWT : PUD seul)
const fs = require('fs'), path = require('path'), zlib = require('zlib'), cp = require('child_process');
const HERE = __dirname;
const C = require('./corrector_en.js');

const mp = path.join(HERE, 'pos_hmm_en.json');
if(!fs.existsSync(mp)){ console.log('[SKIP] pos_hmm_en.json absent'); process.exit(0); }
C.setPosModel(JSON.parse(fs.readFileSync(mp, 'utf8')));

// --- phrases de test : PUD committé (tokenisé par le moteur, comme la page) + EWT local (tokens du treebank) ---
const N = parseInt(process.argv.find(a => /^\d+$/.test(a)) || '2000', 10);
let sents = [];
const cases = path.join(HERE, 'parity_en_cases.txt');           // phrases inventées de garde (cf. parity_en.js)
if(!fs.existsSync(cases)){ console.error('❌ phrases de garde absentes : ' + cases); process.exit(1); }
for(const l of fs.readFileSync(cases, 'utf8').split('\n')) if(l.trim() && !l.startsWith('#')) sents.push(C.tokenize(l));
const corpus = path.join(HERE, 'parity_en_corpus.txt');
if(!fs.existsSync(corpus)){ console.error('❌ corpus committé absent : ' + corpus); process.exit(1); }
for(const l of fs.readFileSync(corpus, 'utf8').split('\n')) if(l.trim()) sents.push(C.tokenize(l));
const nPud = sents.length;                                       // garde + PUD (les phrases de garde comptent avec PUD)
const ewt = path.join(HERE, '..', 'data_local', 'en_ewt-ud-train.conllu');
if(fs.existsSync(ewt)){
  let cur = [];
  for(const l of fs.readFileSync(ewt, 'utf8').split('\n')){
    if(l.startsWith('#')) continue;
    if(!l.trim()){ if(cur.length) sents.push(cur); cur = []; if(sents.length >= nPud + N) break; continue; }
    const c = l.split('\t');
    if(c.length < 4 || c[0].includes('-') || c[0].includes('.')) continue;
    cur.push(c[1]);
  }
}
console.log('parité POS EN : %d phrases (PUD %d%s)', sents.length, nPud, sents.length > nPud ? ' + EWT ' + (sents.length - nPud) : '');

// --- côté Python (un seul appel, JSON in/out) ---
const inp = JSON.stringify(sents);
const py = cp.spawnSync('python', ['-c', `
import sys, json, io
sys.path.insert(0, ${JSON.stringify(HERE)})
from pos_en import tag_sentence, load_model
M = load_model()
S = json.loads(sys.stdin.read())
sys.stdout.write(json.dumps([tag_sentence(s, M) for s in S]))
`], { input: inp, encoding: 'utf8', maxBuffer: 1 << 28,          // 13 544 phrases de tags > 1 Mo : sans ce plafond, spawnSync coupait la sortie (ENOBUFS) et la garde mourait sans message
     env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });
if(py.status !== 0){ console.error('[python KO]', py.error ? String(py.error) : '', (py.stderr || '').slice(0, 400)); process.exit(1); }
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
console.log(diff === 0 ? '✅ PARITÉ POS EN OK (JS == Python sur %d tokens)' : '❌ PARITÉ POS EN ROMPUE : %d divergence(s) / %d tokens',
            diff === 0 ? toks : diff, toks);
process.exit(diff === 0 ? 0 : 1);                         // toujours strict (comme parity_pos.js FR) : un ❌ qui sort 0 n'est pas une garde
