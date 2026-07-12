// recall_probe.js — REJEU du corpus injecté (recall_probe.py --dump) dans les DEUX moteurs JS et comparaison
// du RAPPEL par famille : app (pendu, OMEGA_LEX4 155k natif) vs extension (dys-core, assets HF) vs réf. Python.
// But : chiffrer enfin l'écart de rappel des deux versions à l'échelle (le HF abstient sur les mots rares).
// Réutilise les ponts de parity_corr.js (app) et parity_core.js (extension) — §5, zéro réinvention. Lecture seule.
//   python3 dictee/recall_probe.py --dump <bad.json>  &&  node dictee/recall_probe.js <bad.json>
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const HERE = __dirname, ROOT = path.join(HERE, '..');
const CORPUS = process.argv[2];
if (!CORPUS) { console.error('usage: node dictee/recall_probe.js <corpus_injecté.json>'); process.exit(2); }
const cases = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
const deacc = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- moteur APP (pendu) : OMEGA_LEX4 155k + noun-post + correctText de l'IIFE (cf. parity_corr.js) ----------
// ⚠️ CAVEAT (mesuré 2026-06-23) : on n'extrait l'IIFE que jusqu'à correctText (~l.11700) → les loaders ASYNC de l'app
// (loadGenderLex/loadSpellerLex, déclenchés au CLIC du bouton correcteur) ne tournent PAS ici. Le GENRE-relâché
// (bloc gdet-lex-gz, 46432 entrées) n'est donc PAS appliqué au moteur APP de ce harnais → la colonne APP SOUS-ESTIME
// le rappel GENRE/speller. Données RUNTIME identiques app≡extension≡Python (build_assets extrait l'asset extension
// DU bloc app) → la colonne EXT est la référence fidèle pour le genre. (La parité réelle est garantie par parity_*.)
function loadApp() {
  const html = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8'); try{globalThis.OMEGA_VDC=require('./blobgz').vdcSeed(html);}catch(e){}   // #30 : seed sync vdc-lex-gz (le moteur peuple les maps grammaire sans async)
  const _lx = (html.match(/<script type="text\/plain" id="lex4-data-gz">([^<]*)<\/script>/) || [])[1] || '';
  if (_lx) { try { globalThis.OMEGA_LEX4 = JSON.parse(zlib.gunzipSync(Buffer.from(_lx.replace(/\s/g, ''), 'base64')).toString('utf8')); } catch (e) {} }
  const _np = (html.match(/<script type="text\/plain" id="noun-post-gz">([^<]*)<\/script>/) || [])[1] || '';
  if (_np) { try { globalThis.OMEGA_NOUN_POST = {}; zlib.gunzipSync(Buffer.from(_np.replace(/\s/g, ''), 'base64')).toString('utf8').split('\n').forEach(l => { const p = l.split('\t'); if (p.length >= 3) globalThis.OMEGA_NOUN_POST[p[0]] = [+p[1], +p[2]]; }); } catch (e) {} }
  const start = html.indexOf('(function(){', html.indexOf('mode PHRASES'));
  const ctIdx = html.indexOf('function correctText', start);
  const ctEnd = html.indexOf('return out;}', ctIdx) + 'return out;}'.length;
  const code = html.slice(start, ctEnd) + ';globalThis.__corr=correctText;})();';
  const m = html.match(/<script type="application\/json" id="vdc-lex">([\s\S]*?)<\/script>/);
  const EMBED = m ? m[1] : '{}';
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
  (0, eval)(code);
  return globalThis.__corr;
}

// ---------- moteur EXTENSION (dys-core + assets HF) (cf. parity_core.js) ----------
function loadExt() {
  require(path.join(ROOT, 'extension', 'dys-core.js'));
  const D = global.DYSCORE;
  const vdc = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'assets', 'vdc-lex.json'), 'utf8'));
  const grText = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'extension', 'assets', 'gender-relaxed.tsv.gz'))).toString('utf8');
  D.setLex(vdc, grText);
  D.setNounPost(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'extension', 'assets', 'noun-post.txt.gz'))).toString('utf8'));
  return p => D.correctText(p);
}

function isDetected(flags, c) {                       // détecté si un flag porte le mot injecté (match deacc)
  return flags.some(f => deacc(f.word) === deacc(c.wrong));
}

const ext = loadExt();        // require d'abord (DOM-free) puis l'app (qui bouchonne document)
const app = loadApp();

const FAMS = [...new Set(cases.map(c => c.family))];
function tally(runner) {
  const per = {}; FAMS.forEach(f => per[f] = [0, 0]);   // [injections, détectées]
  for (const c of cases) {
    per[c.family][0]++;
    let flags; try { flags = runner(c.bad) || []; } catch (e) { flags = []; }
    if (isDetected(flags, c)) per[c.family][1]++;
  }
  return per;
}
const PY = {}; FAMS.forEach(f => PY[f] = [0, 0]);
for (const c of cases) { PY[c.family][0]++; if (c.detected) PY[c.family][1]++; }   // Python depuis le dump

const APP = tally(app), EXT = tally(ext);
const pct = (x, n) => n ? Math.round(100 * x / n) + '%' : '—';
console.log(`=== RAPPEL par VERSION (rejeu de ${cases.length} cas injectés) ===`);
console.log(`  ${'famille'.padEnd(16)} ${'inj'.padStart(4)}  ${'PY'.padStart(4)} ${'APP'.padStart(4)} ${'EXT'.padStart(4)}`);
let t = { inj: 0, PY: 0, APP: 0, EXT: 0 };
for (const f of FAMS) {
  const n = PY[f][0];
  t.inj += n; t.PY += PY[f][1]; t.APP += APP[f][1]; t.EXT += EXT[f][1];
  console.log(`  ${f.padEnd(16)} ${String(n).padStart(4)}  ${pct(PY[f][1], n).padStart(4)} ${pct(APP[f][1], n).padStart(4)} ${pct(EXT[f][1], n).padStart(4)}`);
}
console.log(`  ${'TOTAL'.padEnd(16)} ${String(t.inj).padStart(4)}  ${pct(t.PY, t.inj).padStart(4)} ${pct(t.APP, t.inj).padStart(4)} ${pct(t.EXT, t.inj).padStart(4)}`);
console.log('\n  PY = réf. Python (cgram complet) · APP = pendu (OMEGA_LEX4 155k natif) · EXT = extension (assets HF).');
console.log('  APP/EXT < PY = couverture lexicale moindre (HF) sur ces familles ; égalité = parité de rappel.');
