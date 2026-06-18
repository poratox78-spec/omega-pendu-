// Parité APP↔Python du correcteur : extrait correctText() de l'IIFE dictée du monolithe, l'exécute headless
// (DOM bouchonné), et compare ses flags à ceux du probe Python (correcteur_probe.py) sur une batterie de phrases.
// Garantit que la règle d'accord sujet-verbe (et les 8 homophones) se comportent pareil dans l'app et le probe.
// Lancer : node dictee/parity_corr.js
const fs = require('fs'), path = require('path'), cp = require('child_process');
const HERE = __dirname, HTML = path.join(HERE, '..', 'app', 'omega-pendu.html');
const html = fs.readFileSync(HTML, 'utf8');

// 1) extraire l'IIFE jusqu'à correctText, refermer en exposant correctText
const start = html.indexOf('(function(){', html.indexOf('mode PHRASES'));
const ctIdx = html.indexOf('function correctText', start);
const ctEnd = html.indexOf('return out;}', ctIdx) + 'return out;}'.length;
if (start < 0 || ctIdx < 0 || ctEnd < 0) { console.error('extraction IIFE échouée'); process.exit(2); }
const code = html.slice(start, ctEnd) + ';globalThis.__corr=correctText;})();';

// 2) embed vdc-lex pour getElementById
const m = html.match(/<script type="application\/json" id="vdc-lex">([\s\S]*?)<\/script>/);
const EMBED = m ? m[1] : '{}';

// 3) DOM bouchon minimal (le panneau dictée se construit avant correctText)
const el = () => new Proxy(function () {}, {
  get(t, k) { if (k === 'textContent' || k === 'innerHTML' || k === 'value') return t['_' + k] || '';
    if (k === 'style') return {}; if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
    if (k === Symbol.toPrimitive) return () => ''; return el(); },
  set(t, k, v) { t['_' + k] = v; return true; }, apply() { return el(); }
});
global.document = { getElementById: (id) => id === 'vdc-lex' ? { textContent: EMBED, addEventListener() {}, value: '' } : el(),
  createElement: () => el(), body: el(), head: el(), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
global.window = el(); global.navigator = { userAgent: '' };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.speechSynthesis = { speak() {}, cancel() {}, getVoices: () => [] };
global.SpeechSynthesisUtterance = function () { return el(); };

try { (0, eval)(code); } catch (e) { console.error('exécution IIFE échouée :', e.message); process.exit(2); }
const corr = globalThis.__corr;
if (typeof corr !== 'function') { console.error('correctText non exposé'); process.exit(2); }

// 4) batterie : doit DÉTECTER / ne doit RIEN flaguer
const PHRASES = [
  'Les enfant joue dans le jardin et il sont content. Je doit manger. On ont gagné. à mon avis.',
  'Je doit partir', 'Tu doit venir', 'Il ont faim', 'Elles a faim', 'On ont gagné', 'Ils doit manger',
  'Je peux venir', 'Tu manges bien', 'Il nous voit', 'Nous mangeons', 'Ils peut-être là', 'Vous êtes prêts',
  'Il y a un chat', 'je suis content', 'tu es gentil', 'ils doivent partir', 'il faut', 'elle veut partir',
  'on peut essayer', 'je vais bien', 'Il a mangé la soupe', 'Il veut manger la soupe', 'Les enfants sont contents',
  'Elle a trouvé un trésor', 'Elle va à Paris', 'Il prend ce livre', 'Le chat se trouve là', 'Je leur parle souvent'
];

// flags Python via un petit pont
const py = cp.spawnSync('python3', ['-c', `
import sys, json
sys.path.insert(0, ${JSON.stringify(HERE)})
import correcteur_probe as C
ph = json.loads(sys.stdin.read())
print(json.dumps([[(i, w, s, n) for (i, w, s, n) in C.correct(p)] for p in ph]))
`], { input: JSON.stringify(PHRASES), encoding: 'utf8' });
if (py.status !== 0) { console.error('probe Python échoué :', py.stderr); process.exit(2); }
const pyflags = JSON.parse(py.stdout);

let diff = 0;
PHRASES.forEach((p, k) => {
  const js = corr(p).map(f => [f.i, f.word, f.sugg, f.name]);
  const pf = pyflags[k];
  const norm = a => JSON.stringify(a.map(x => [x[0], String(x[1]).toLowerCase(), String(x[2]).toLowerCase()]));
  const ok = norm(js) === norm(pf);
  if (!ok) { diff++;
    console.log('≠ ', JSON.stringify(p));
    console.log('   JS :', JSON.stringify(js));
    console.log('   PY :', JSON.stringify(pf));
  }
});
console.log(diff === 0
  ? `PARITÉ OK — ${PHRASES.length} phrases identiques APP↔Python (correcteur + accord sujet-verbe).`
  : `PARITÉ KO — ${diff}/${PHRASES.length} divergences.`);
process.exit(diff === 0 ? 0 : 1);
