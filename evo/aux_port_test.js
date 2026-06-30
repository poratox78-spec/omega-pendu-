// Test du PORT être/avoir dans le monolithe : extrait correctText() de l'IIFE dictée, l'exécute headless, et vérifie
// détection (usage + aux mal orthographié) + non-FP sur du correct. Lancer : node evo/aux_port_test.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const HTML = path.join(__dirname, '..', 'app', 'omega-pendu.html');
const html = fs.readFileSync(HTML, 'utf8');
const lx = (html.match(/<script type="text\/plain" id="lex4-data-gz">([^<]*)<\/script>/) || [])[1] || '';
if (lx) { try { globalThis.OMEGA_LEX4 = JSON.parse(zlib.gunzipSync(Buffer.from(lx.replace(/\s/g, ''), 'base64')).toString('utf8')); } catch (e) {} }
const np = (html.match(/<script type="text\/plain" id="noun-post-gz">([^<]*)<\/script>/) || [])[1] || '';
if (np) { try { globalThis.OMEGA_NOUN_POST = {}; zlib.gunzipSync(Buffer.from(np.replace(/\s/g, ''), 'base64')).toString('utf8').split('\n').forEach(l => { const p = l.split('\t'); if (p.length >= 3) globalThis.OMEGA_NOUN_POST[p[0]] = [+p[1], +p[2]]; }); } catch (e) {} }
const start = html.indexOf('(function(){', html.indexOf('mode PHRASES'));
const ctEnd = html.indexOf('return out;}', html.indexOf('function correctText', start)) + 'return out;}'.length;
const code = html.slice(start, ctEnd) + ';globalThis.__corr=correctText;})();';
const m = html.match(/<script type="application\/json" id="vdc-lex">([\s\S]*?)<\/script>/); const EMBED = m ? m[1] : '{}';
const el = () => new Proxy(function () {}, { get(t, k) { if (k === 'textContent' || k === 'innerHTML' || k === 'value') return t['_' + k] || ''; if (k === 'style') return {}; if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } }; if (k === Symbol.toPrimitive) return () => ''; return el(); }, set(t, k, v) { t['_' + k] = v; return true; }, apply() { return el(); } });
global.document = { getElementById: id => id === 'vdc-lex' ? { textContent: EMBED, addEventListener() {}, value: '' } : el(), createElement: () => el(), body: el(), head: el(), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
global.window = el(); global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; global.speechSynthesis = { speak() {}, cancel() {}, getVoices: () => [] }; global.SpeechSynthesisUtterance = function () { return el(); };
try { (0, eval)(code); } catch (e) { console.error('exec KO:', e.message); process.exit(2); }
const corr = globalThis.__corr;
const flags = s => corr(s).map(f => f.word + '→' + f.sugg + ' [' + f.name + ']');
console.log('=== DÉTECTION (doit corriger) ===');
['il est faim', 'il a allé à Paris', 'ils ont restés ici', 'on est 10 ans', 'tu es soif', 'vous ete là', 'nous avon faim', 'vous ave raison', 'nous étion là'].forEach(s => { const f = corr(s); console.log((f.length ? ' ✓ ' : ' ✗ ') + s + ' → ' + (flags(s).join(', ') || 'rien')); });
console.log('\n=== FP (ne doit RIEN toucher) ===');
['il a faim', 'il est content', 'il est allé', 'il est mort', 'il a tort', 'elle est restée', 'j\'ai été malade', 'il a eu peur', 'elle aurait préféré', 'nous avons un chien', 'ils sont partis'].forEach(s => { const f = corr(s); console.log((f.length ? ' FP! ' : ' ok  ') + s + (f.length ? ' → ' + flags(s).join(', ') : '')); });
