// Parité VIGILANCE ces/ses 3 moteurs (orange « ces/ses à vérifier »). Compare les flags produits par la RÉFÉRENCE
// Python (cesses_probe.py floodflags), l'EXTENSION (dys-core.cesProbe) et l'APP (IIFE cesProbe) sur fp_scale_corpus.
// Modèle POS-free inline (ces_ses_model.json) → aucun asset/tagger requis. Échoue si un moteur diverge.
//   node dictee/parity_cesses.js
const fs = require('fs'), path = require('path'), cp = require('child_process');
const HERE = __dirname, ROOT = path.join(HERE, '..'), EXT = path.join(ROOT, 'extension');
const norm = (pairs) => JSON.stringify(pairs.map(p => [String(p[0]).toLowerCase(), String(p[1]).toLowerCase()]).sort());

// 1) Python (référence)
let py;
try { py = JSON.parse(cp.execFileSync('python3', [path.join(HERE, 'cesses_probe.py'), 'floodflags'],
  { encoding: 'utf8', maxBuffer: 1e8, env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) })); }
catch (e) { console.error('cesses_probe.py floodflags échoué : ' + e.message); process.exit(2); }
const fp = fs.readFileSync(path.join(HERE, 'fp_scale_corpus.txt'), 'utf8').split('\n').filter(x => x.trim()).slice(0, 1500);

// 2) EXTENSION (dys-core.cesProbe) — POS-free, modèle inline, aucun setter requis
require(path.join(EXT, 'dys-core.js'));
const D = global.DYSCORE;
let extFlags = []; for (const s of fp) for (const f of D.cesProbe(s)) extFlags.push([f.word, f.sugg]);

// 3) APP (IIFE cesProbe) — DOM bouchon ; on extrait l'IIFE jusqu'à cesProbe (défini avant participeEtreVig)
const html = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8');
const start = html.indexOf('(function(){', html.indexOf('mode PHRASES'));
const opIdx = html.indexOf('function cesProbe', start);
const opEnd = html.indexOf('return out;}', opIdx) + 'return out;}'.length;
if (start < 0 || opIdx < 0) { console.error('extraction IIFE app (cesProbe) échouée'); process.exit(2); }
const code = html.slice(start, opEnd) + ';globalThis.__cesProbe=cesProbe;})();';
const el = () => new Proxy(function () {}, {
  get(t, k) { if (k === 'textContent' || k === 'innerHTML' || k === 'value') return t['_' + k] || ''; if (k === 'style') return {}; if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } }; if (k === Symbol.toPrimitive) return () => ''; return el(); },
  set(t, k, v) { t['_' + k] = v; return true; }, apply() { return el(); } });
global.document = { getElementById: () => el(), createElement: () => el(), body: el(), head: el(), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
global.window = el(); global.navigator = { userAgent: '' }; global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.speechSynthesis = { speak() {}, cancel() {}, getVoices: () => [] }; global.SpeechSynthesisUtterance = function () { return el(); };
try { (0, eval)(code); } catch (e) { console.error('app IIFE (cesProbe) échouée : ' + e.message); process.exit(2); }
const appProbe = globalThis.__cesProbe;
if (typeof appProbe !== 'function') { console.error('cesProbe app non exposé'); process.exit(2); }
let appFlags = []; for (const s of fp) for (const f of appProbe(s)) appFlags.push([f.word, f.sugg]);

const nPy = norm(py), nExt = norm(extFlags), nApp = norm(appFlags);
const okExt = nPy === nExt, okApp = nPy === nApp;
console.log('parité ces/ses (fp_scale) : Python=' + py.length + ' flags | extension=' + extFlags.length + (okExt ? ' ✓' : ' ✗ ÉCART') + ' | app=' + appFlags.length + (okApp ? ' ✓' : ' ✗ ÉCART'));
if (okExt && okApp) { console.log('✅ PARITÉ ces/ses 3 moteurs OK'); process.exit(0); }
console.error('✗ DIVERGENCE parité ces/ses (JS ≠ référence Python)'); process.exit(1);
