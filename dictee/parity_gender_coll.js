// PARITÉ 3 MOTEURS du genre perdu par la DÉSACCENTUATION (âme/amé, affaire/affairé, lettre/lettré).
//
// POURQUOI CE HARNAIS EXISTE, ET POURQUOI parity_corr NE SUFFISAIT PAS.
// `parity_corr.js` vérifie l'invariant « app ⊆ Python » sur une liste FIXE de phrases : il attrape
// un faux positif propre à l'app, mais JAMAIS un RETARD de l'app. Or c'est exactement ce qui s'était
// produit : la référence Python corrigeait « la lettre » et « une affaire », l'app et l'extension
// non — et les trois checks de parité passaient au vert. Le travail existait, il n'arrivait pas.
// ⇒ Ici on exige l'ÉGALITÉ des trois rappels sur le MÊME échantillon, fourni par le Python
//   (`gender_coll_probe.py --dump`) pour qu'aucun moteur n'ait son propre banc.
//
//   node dictee/parity_gender_coll.js
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), zlib = require('zlib');
const HERE = __dirname, ROOT = path.join(HERE, '..');

// ---------- 0) l'échantillon + le résultat de RÉFÉRENCE (Python) ----------
const py = cp.spawnSync('python3', [path.join(HERE, 'gender_coll_probe.py'), '--dump'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });
if (py.status !== 0) { console.error('probe Python échoué :', py.stderr); process.exit(2); }
const REF = JSON.parse(py.stdout);
const CAS = REF.cas;
if (!CAS.length) { console.log('  (aucun cas — table de genre accentuée absente, parité ignorée)'); process.exit(0); }

// ---------- 1) moteur de l'APP (extrait du monolithe, comme parity_corr) ----------
const HTML = path.join(ROOT, 'app', 'omega-pendu.html');
const html = fs.readFileSync(HTML, 'utf8');
try { globalThis.OMEGA_VDC = require('./blobgz').vdcSeed(html); } catch (e) {}
const bloc = (id) => (html.match(new RegExp('<script type="text/plain" id="' + id + '">([^<]*)</script>')) || [])[1] || '';
const gunzB64 = (s) => zlib.gunzipSync(Buffer.from(s.replace(/\s/g, ''), 'base64')).toString('utf8');
try { const s = bloc('lex4-data-gz'); if (s) globalThis.OMEGA_LEX4 = JSON.parse(gunzB64(s)); } catch (e) {}
try { const s = bloc('noun-post-gz'); if (s) { globalThis.OMEGA_NOUN_POST = {};
  gunzB64(s).split('\n').forEach(l => { const p = l.split('\t'); if (p.length >= 3) globalThis.OMEGA_NOUN_POST[p[0]] = [+p[1], +p[2]]; }); } } catch (e) {}
try { const s = bloc('pos-hmm-gz'); if (s) globalThis.OMEGA_POS_HMM = JSON.parse(gunzB64(s)); } catch (e) {}

const start = html.indexOf('(function(){', html.indexOf('mode PHRASES'));
const ctIdx = html.indexOf('function correctText', start);
const ctEnd = html.indexOf('return out;}', ctIdx) + 'return out;}'.length;
const ptIdx = html.indexOf('function posTags(T){', start);
const ptEnd = ptIdx >= 0 ? html.indexOf('}', html.indexOf('return seq.reverse();', ptIdx)) + 1 : ctEnd;
if (start < 0 || ctIdx < 0) { console.error('extraction IIFE échouée'); process.exit(2); }
// DOM bouchon — repris À L'IDENTIQUE de parity_corr.js : le panneau dictée se construit AVANT
// correctText, et un bouchon trop mince casse sur `appendChild` (piège payé au premier jet).
const EMBED = (html.match(/<script type="application\/json" id="vdc-lex">([\s\S]*?)<\/script>/) || [, '{}'])[1];
const el = () => new Proxy(function () {}, {
  get(t, k) { if (k === 'textContent' || k === 'innerHTML' || k === 'value') return t['_' + k] || '';
    if (k === 'style') return {}; if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
    if (k === Symbol.toPrimitive) return () => ''; return el(); },
  set(t, k, v) { t['_' + k] = v; return true; }, apply() { return el(); }
});
global.document = { getElementById: (id) => id === 'vdc-lex' ? { textContent: EMBED, addEventListener() {}, value: '' } : el(),
  createElement: () => el(), body: el(), head: el(), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
global.window = el();
// `navigator` est en LECTURE SEULE depuis Node 21 : l'affectation directe (comme dans parity_corr,
// écrit sous une version plus ancienne) lève ici. defineProperty passe sur toutes les versions.
try { Object.defineProperty(global, 'navigator', { value: { userAgent: '' }, configurable: true }); } catch (e) {}
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.speechSynthesis = { speak() {}, cancel() {}, getVoices: () => [] };
global.SpeechSynthesisUtterance = function () { return el(); };
try { (0, eval)(html.slice(start, Math.max(ctEnd, ptEnd)) + ';globalThis.__corrApp=correctText;})();'); }
catch (e) { console.error('exécution IIFE échouée :', e.message); process.exit(2); }
const corrApp = globalThis.__corrApp;
if (typeof corrApp !== 'function') { console.error('correctText non exposé'); process.exit(2); }

// ---------- 2) moteur de l'EXTENSION (comme parity_core) ----------
require(path.join(ROOT, 'extension', 'dys-core.js'));
const D = global.DYSCORE;
const A = (f) => path.join(ROOT, 'extension', 'assets', f);
D.setLex(JSON.parse(fs.readFileSync(A('vdc-lex.json'), 'utf8')),
         zlib.gunzipSync(fs.readFileSync(A('gender-relaxed.tsv.gz'))).toString('utf8'));
D.setNounPost(zlib.gunzipSync(fs.readFileSync(A('noun-post.txt.gz'))).toString('utf8'));
D.setPosHmm(JSON.parse(zlib.gunzipSync(fs.readFileSync(A('pos-hmm.json.gz'))).toString('utf8')));

// ---------- 3) même mesure sur les trois ----------
function mesure(corr) {
  let rappel = 0; const fp = [];
  for (const c of CAS) {
    const bon = 'Il note ' + c.bon + ' ' + c.mot + ' ici.';
    const faux = 'Il note ' + c.faux + ' ' + c.mot + ' ici.';
    if (corr(faux).some(f => String(f.word).toLowerCase() === c.faux && String(f.sugg).toLowerCase() === c.bon)) rappel++;
    for (const f of corr(bon)) if (String(f.word).toLowerCase() === c.bon) fp.push(c.bon + ' ' + c.mot + ' -> ' + f.sugg);
  }
  for (const p of REF.pieges) for (const f of corr(p)) if (f.name === 'genre déterminant') fp.push(f.word + ' -> ' + f.sugg + '  « ' + p.slice(0, 50) + ' »');
  return { rappel, fp };
}
const app = mesure(corrApp), ext = mesure(t => D.correctText(t));

console.log('GENRE À CLÉ PARTAGÉE — %d cas, parité 3 moteurs', CAS.length);
console.log('  rappel   Python %d · app %d · extension %d', REF.rappel_python, app.rappel, ext.rappel);
console.log('  FP       app %d · extension %d', app.fp.length, ext.fp.length);
app.fp.slice(0, 6).forEach(x => console.log('      app FP : ' + x));
ext.fp.slice(0, 6).forEach(x => console.log('      ext FP : ' + x));

const ok = app.rappel === REF.rappel_python && ext.rappel === REF.rappel_python
        && app.fp.length === 0 && ext.fp.length === 0;
console.log(ok ? '  ✓ les trois moteurs corrigent la MÊME chose, sans faux positif'
                : '  ✗ DIVERGENCE — un moteur est en retard sur la référence (ou flague à tort)');
process.exit(ok ? 0 : 1);
