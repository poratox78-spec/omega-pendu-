// Parité OS-sujet 3 moteurs (orange « accord verbe à vérifier »). Compare les flags OS produits par la RÉFÉRENCE
// Python (os_subject_probe.py floodflags), l'EXTENSION (dys-core.osProbe) et l'APP (IIFE osProbe) sur fp_scale_corpus
// (committé, self-contained — pas de data_local). Échoue si un moteur diverge. Garantit que le port JS reste fidèle.
//   node dictee/parity_os.js
const fs = require('fs'), path = require('path'), cp = require('child_process'), zlib = require('zlib');
const HERE = __dirname, ROOT = path.join(HERE, '..'), EXT = path.join(ROOT, 'extension');
const norm = (pairs) => JSON.stringify(pairs.map(p => [String(p[0]).toLowerCase(), String(p[1]).toLowerCase()]).sort());

// 1) Python (référence)
let py;
try { py = JSON.parse(cp.execFileSync('python3', [path.join(HERE, 'os_subject_probe.py'), 'floodflags'],
  { encoding: 'utf8', maxBuffer: 1e8, env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) })); }
catch (e) { console.error('os_subject_probe.py floodflags échoué : ' + e.message); process.exit(2); }
const fp = fs.readFileSync(path.join(HERE, 'fp_scale_corpus.txt'), 'utf8').split('\n').filter(x => x.trim()).slice(0, 1500);

// 2) EXTENSION (dys-core.osProbe)
require(path.join(EXT, 'dys-core.js'));
const D = global.DYSCORE;
D.setLex(JSON.parse(fs.readFileSync(path.join(EXT, 'assets', 'vdc-lex.json'), 'utf8')),
         zlib.gunzipSync(fs.readFileSync(path.join(EXT, 'assets', 'gender-relaxed.tsv.gz'))).toString('utf8'));
D.setPosHmm(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(EXT, 'assets', 'pos-hmm.json.gz'))).toString('utf8')));
D.setOsLm(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(EXT, 'assets', 'os-subj-lm.json.gz'))).toString('utf8')));
let extFlags = []; for (const s of fp) for (const f of D.osProbe(s)) extFlags.push([f.word, f.sugg]);

// 3) APP (IIFE osProbe) — seeds + DOM bouchon comme parity_corr
const html = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8');
try { globalThis.OMEGA_VDC = require(path.join(HERE, 'blobgz')).vdcSeed(html); } catch (e) {}
const grab = (id) => (html.match(new RegExp('<script type="text/plain" id="' + id + '">([^<]*)</script>')) || [])[1] || '';
let s2;
if ((s2 = grab('lex4-data-gz'))) try { globalThis.OMEGA_LEX4 = JSON.parse(zlib.gunzipSync(Buffer.from(s2.replace(/\s/g, ''), 'base64')).toString('utf8')); } catch (e) {}
if ((s2 = grab('noun-post-gz'))) try { globalThis.OMEGA_NOUN_POST = {}; zlib.gunzipSync(Buffer.from(s2.replace(/\s/g, ''), 'base64')).toString('utf8').split('\n').forEach(l => { const p = l.split('\t'); if (p.length >= 3) globalThis.OMEGA_NOUN_POST[p[0]] = [+p[1], +p[2]]; }); } catch (e) {}
if ((s2 = grab('pos-hmm-gz'))) try { globalThis.OMEGA_POS_HMM = JSON.parse(zlib.gunzipSync(Buffer.from(s2.replace(/\s/g, ''), 'base64')).toString('utf8')); } catch (e) {}
if ((s2 = grab('os-lm-gz'))) try { globalThis.OMEGA_OS_LM = JSON.parse(zlib.gunzipSync(Buffer.from(s2.replace(/\s/g, ''), 'base64')).toString('utf8')); } catch (e) {}
const start = html.indexOf('(function(){', html.indexOf('mode PHRASES'));
const opIdx = html.indexOf('function osProbe', start);
const opEnd = html.indexOf('return out;}', opIdx) + 'return out;}'.length;
if (start < 0 || opIdx < 0) { console.error('extraction IIFE app échouée'); process.exit(2); }
const code = html.slice(start, opEnd) + ';globalThis.__osProbe=osProbe;})();';
const m = html.match(/<script type="application\/json" id="vdc-lex">([\s\S]*?)<\/script>/); const EMBED = m ? m[1] : '{}';
const el = () => new Proxy(function () {}, {
  get(t, k) { if (k === 'textContent' || k === 'innerHTML' || k === 'value') return t['_' + k] || ''; if (k === 'style') return {}; if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } }; if (k === Symbol.toPrimitive) return () => ''; return el(); },
  set(t, k, v) { t['_' + k] = v; return true; }, apply() { return el(); } });
global.document = { getElementById: (id) => id === 'vdc-lex' ? { textContent: EMBED, addEventListener() {}, value: '' } : el(), createElement: () => el(), body: el(), head: el(), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
global.window = el(); global.navigator = { userAgent: '' }; global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.speechSynthesis = { speak() {}, cancel() {}, getVoices: () => [] }; global.SpeechSynthesisUtterance = function () { return el(); };
try { (0, eval)(code); } catch (e) { console.error('app IIFE échouée : ' + e.message); process.exit(2); }
const appProbe = globalThis.__osProbe;
if (typeof appProbe !== 'function') { console.error('osProbe app non exposé'); process.exit(2); }
let appFlags = []; for (const s of fp) for (const f of appProbe(s)) appFlags.push([f.word, f.sugg]);

// comparaison
const nPy = norm(py), nExt = norm(extFlags), nApp = norm(appFlags);
const okExt = nPy === nExt, okApp = nPy === nApp;
console.log('parité OS-sujet (fp_scale) : Python=' + py.length + ' flags | extension=' + extFlags.length + (okExt ? ' ✓' : ' ✗ ÉCART') + ' | app=' + appFlags.length + (okApp ? ' ✓' : ' ✗ ÉCART'));
if (okExt && okApp) { console.log('✅ PARITÉ OS 3 moteurs OK'); process.exit(0); }
console.error('✗ DIVERGENCE parité OS-sujet (JS ≠ référence Python)'); process.exit(1);
