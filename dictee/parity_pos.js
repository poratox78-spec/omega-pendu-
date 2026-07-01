// parity_pos.js — PARITÉ du POS-tagger HMM : Python (correcteur_probe.pos_tags) == extension (DYSCORE.posTags) == app.
// (a) extension.posTags == Python sur une batterie ; (b) le décodeur posTags de l'app est TEXTUELLEMENT identique à
// celui de l'extension ; (c) le blob pos-hmm-gz embarqué dans l'app décode exactement vers dictee/pos_hmm.json.
// → l'app calcule donc les mêmes tags que Python (transitivité). Lancé par dev.sh + CI.
const fs = require('fs'), path = require('path'), cp = require('child_process'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const model = JSON.parse(fs.readFileSync(path.join(ROOT, 'dictee', 'pos_hmm.json'), 'utf8'));

const BATT = [
  "Le petit chat noir mange une souris grise dans le jardin.",
  "Les poules son dans le jardin.",
  "Elle porte une belle robe rouge.",
  "Il faut que tu manges tes légumes.",
  "Le chien mange sa pâtée.",
  "Nous sommes allés à la plage hier.",
  "Ça ne me dérange pas du tout.",
  "Les enfants heureux offrent des fleurs à leur institutrice.",
  "Quand il pleut, je reste à la maison.",
  "La vieille dame traverse la rue prudemment."
];

// --- Python : tags de référence ---
const py = cp.execFileSync('python', ['-c', `
import sys, json
sys.path.insert(0, r'${path.join(ROOT, 'dictee').replace(/\\/g, '\\\\')}')
import correcteur_probe as C
B = json.loads(sys.stdin.read())
print(json.dumps([C.pos_tags(C.toks(s)) for s in B], ensure_ascii=False))
`], { input: JSON.stringify(BATT), encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });
const pyTags = JSON.parse(py);

// --- extension : DYSCORE.posTags ---
require(path.join(ROOT, 'extension', 'dys-core.js'));
const D = global.DYSCORE;
D.setPosHmm(model);
// toks Python vs toks extension peuvent différer ; on tague la MÊME séquence de tokens (celle de Python) pour comparer le DÉCODEUR.
const pyToks = JSON.parse(cp.execFileSync('python', ['-c', `
import sys, json
sys.path.insert(0, r'${path.join(ROOT, 'dictee').replace(/\\/g, '\\\\')}')
import correcteur_probe as C
print(json.dumps([C.toks(s) for s in json.loads(sys.stdin.read())], ensure_ascii=False))
`], { input: JSON.stringify(BATT), encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) }));

let diffs = 0;
for (let i = 0; i < BATT.length; i++) {
  const js = D.posTags(pyToks[i]);
  if (JSON.stringify(js) !== JSON.stringify(pyTags[i])) {
    diffs++;
    console.log('DIFF:', JSON.stringify(pyToks[i]));
    console.log('  py:', JSON.stringify(pyTags[i]));
    console.log('  js:', JSON.stringify(js));
  }
}

// --- (b) décodeur app == décodeur extension (texte normalisé) ---
function extractPosTags(src) {
  const i = src.indexOf('function posTags(T){');
  if (i < 0) return null;
  // équilibrage d'accolades à partir du 1er {
  let j = src.indexOf('{', i), depth = 0, k = j;
  for (; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (depth === 0) { k++; break; } } }
  return src.slice(i, k).replace(/\s+/g, ' ').trim();
}
const extSrc = extractPosTags(fs.readFileSync(path.join(ROOT, 'extension', 'dys-core.js'), 'utf8'));
const appSrc = extractPosTags(fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8'));
const decoderSame = extSrc && appSrc && extSrc === appSrc;

// --- (c) blob pos-hmm-gz de l'app == modèle fichier ---
const html = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8');
const m = html.match(/id="pos-hmm-gz">([A-Za-z0-9+/=]+)</);
let blobSame = false;
if (m) {
  const appModel = JSON.parse(zlib.gunzipSync(Buffer.from(m[1], 'base64')).toString('utf8'));
  blobSame = JSON.stringify(appModel) === JSON.stringify(model);
}

console.log(`extension==Python : ${diffs === 0 ? 'OK' : diffs + ' diffs'} (${BATT.length} phrases)`);
console.log(`décodeur app==extension (texte) : ${decoderSame ? 'OK' : 'DIFFÈRE'}`);
console.log(`blob app==modèle fichier : ${blobSame ? 'OK' : 'DIFFÈRE'}`);
const ok = diffs === 0 && decoderSame && blobSame;
console.log(ok ? 'PARITÉ POS OK — Python == extension == app' : 'PARITÉ POS ÉCHOUÉE');
process.exit(ok ? 0 : 1);
