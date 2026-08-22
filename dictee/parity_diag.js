/* Parité DICTÉE Python↔JS (audit 2026-08-22, demande de Rem) : diag_sentence.py et diagnoseSentence
 * (app) sont deux pipelines INDÉPENDANTS — aucune règle ne les lie, contrairement à tout le reste
 * du projet (parity_corr.js, parity_os.js, parity_cesses.js, parity_gender_coll.js…). Ce script
 * comble le trou : dictee/diag_sentence.py --dump-cas génère ~1300 cas (5 familles de corruption ×
 * sentences.json, réutilisant les générateurs cas_accent/cas_accord/… déjà dans diag_sentence.py)
 * et son diagnostic ; on rejoue les MÊMES (cible, eleve, fam) sous diagnoseSentence (JS) et on
 * compare l'ensemble des `types` déclenchés. Défaut = référence Python, jamais réécrite (R67).
 *   node dictee/parity_diag.js
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const HERE = __dirname, ROOT = path.join(HERE, '..');

// 1) référence Python
let cas;
try {
  const out = cp.execFileSync('python3', [path.join(HERE, 'diag_sentence.py'), '--dump-cas'],
    { encoding: 'utf8', maxBuffer: 1e8, env: Object.assign({}, process.env, { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }) });
  cas = JSON.parse(out);
} catch (e) { console.error('diag_sentence.py --dump-cas échoué : ' + e.message); process.exit(2); }
if (!Array.isArray(cas) || !cas.length) { console.error('dump vide — rien à comparer'); process.exit(2); }

// 2) moteur JS de l'app — même tranche que dys_rappel_dump.js/arbitre_vig_dump.js (diagnoseSentence
//    vit DANS la même IIFE que spellText, déjà couverte par cette tranche : rien à étendre).
const html = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8');
try { globalThis.OMEGA_VDC = require(path.join(HERE, 'blobgz')).vdcSeed(html); } catch (e) {}
const i0 = html.indexOf('mode PHRASES'), start = html.indexOf('(function(){', i0);
const spIdx = html.indexOf('function spellText', start);
const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
const code = html.slice(start, cut) + ';globalThis.__C={diagnose:diagnoseSentence,ready:()=>SP.ready};})();';
function blob(id) { const m = html.match(new RegExp('id="' + id + '">([\\s\\S]*?)</script>')); return m ? m[1] : ''; }
const B = { 'vdc-lex': blob('vdc-lex'), 'speller-lex-gz': blob('speller-lex-gz'), 'noun-post-gz': blob('noun-post-gz'),
            'pos-hmm-gz': blob('pos-hmm-gz'), 'gdet-lex-gz': blob('gdet-lex-gz') };
const stub = new Proxy(function(){}, { get(t,k){ if(k==='style')return{}; if(k==='classList')return{add(){},remove(){},toggle(){},contains:()=>false}; return stub; }, set:()=>true, apply:()=>stub });
global.document = { getElementById:(id)=> B[id]!==undefined && B[id]!=='' ? {textContent:B[id]} : stub, createElement:()=>stub, body:stub, head:stub, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] };
global.window = global; try { global.navigator = { userAgent:'node' }; } catch (e) { Object.defineProperty(global, 'navigator', { value: { userAgent:'node' }, configurable: true }); }
global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
(0, eval)(code);
const C = globalThis.__C;

// 3) comparaison — ensemble des `types` déclenchés (même granularité que le self-test Python,
//    qui teste déjà par `any(fam in x['types'] ...)` : la liste triée, pas l'alignement token-à-token,
//    qui peut légitimement différer d'ordre entre deux implémentations équivalentes).
let echecs = [];
for (const c of cas) {
  let jsTypes;
  try { const F = C.diagnose(c.cible, c.eleve, c.fam); jsTypes = Array.from(new Set(F.flatMap(f => f.types || []))).sort(); }
  catch (e) { echecs.push({ cible: c.cible, eleve: c.eleve, famille_visee: c.famille_visee, erreur: 'JS a levé : ' + e.message }); continue; }
  const pyTypes = (c.types || []).slice().sort();
  if (JSON.stringify(jsTypes) !== JSON.stringify(pyTypes))
    echecs.push({ cible: c.cible, eleve: c.eleve, famille_visee: c.famille_visee, python: pyTypes, js: jsTypes });
}
console.log('parité dictée Python↔JS : ' + (cas.length - echecs.length) + '/' + cas.length + ' cas identiques');
if (echecs.length) {
  console.log('\n✗ ' + echecs.length + ' divergence(s) :');
  for (const e of echecs.slice(0, 20)) console.log('  [' + e.famille_visee + '] « ' + e.cible + ' » vs « ' + e.eleve + ' » — python=' + JSON.stringify(e.python || e.erreur) + ' js=' + JSON.stringify(e.js));
  if (echecs.length > 20) console.log('  … +' + (echecs.length - 20) + ' de plus');
  process.exit(1);
}
console.log('✓ dictée Python↔JS : aucune divergence');
