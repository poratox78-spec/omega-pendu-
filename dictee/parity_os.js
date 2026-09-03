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
try { D.setNounPost(zlib.gunzipSync(fs.readFileSync(path.join(EXT, 'assets', 'noun-post.txt.gz'))).toString('utf8')); } catch (e) {}   // le produit charge noun-post : la parité aussi (03/09/2026)
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

// 4) batterie postposé/homographe (lock du nouveau comportement #1 gate + #2 routes inversées) — 3 moteurs doivent s'accorder
const BATT = ["Ainsi s'achève les travaux de rénovation.", "Là s'entassait des palettes.", 'Que devient les anciens modèles ?',
  'Sur la table reposait les dossiers.', 'Les rumeurs circule vite.',
  'Le chat dort sur le canapé.', 'Ainsi va la vie.', 'La compétition rassemble les meilleurs clubs.',
  /* SUJET POSTPOSÉ **SINGULIER** dans une relative en « que » (signalé par Rem sur une phrase CORRECTE).
     Le mode postposé ne savait dire que « pluriel » : face à un antécédent pluriel, un sujet postposé
     singulier était sans défense, et les routes génériques proposaient « ressassaient / corrigent /
     lisaient » — faux, sur du français correct. Ces 4 phrases sont CORRECTES : aucun des 3 moteurs
     ne doit rien proposer. Les 2 dernières sont les CONTRÔLES du sens inverse (sujet postposé
     PLURIEL, et relative à sujet préverbal) : eux doivent continuer de tirer. */
  'Les billevesées que ressassait cet aréopage sont vieilles.',
  'Les erreurs que corrige le professeur sont nombreuses.',
  'Les livres que lisait mon frère sont là.',
  'Les rapports que rédige la secrétaire arrivent demain.',
  'Les dossiers que traitent les employés sont urgents.',
  'les enfants que je vois joue'];   // cibles postposées/homographe + contrôles (« Ainsi va la vie » sing, « La compétition rassemble les clubs » sujet préverbal = ne pas flaguer)
let pyBatt;
try { pyBatt = JSON.parse(cp.execFileSync('python3', [path.join(HERE, 'os_subject_probe.py'), 'probeflags'],
  { input: JSON.stringify(BATT), encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) })); }
catch (e) { console.error('probeflags échoué : ' + e.message); process.exit(2); }
let extBatt = []; for (const s of BATT) for (const f of D.osProbe(s)) extBatt.push([f.word, f.sugg]);
let appBatt = []; for (const s of BATT) for (const f of appProbe(s)) appBatt.push([f.word, f.sugg]);
const okB = norm(pyBatt) === norm(extBatt) && norm(pyBatt) === norm(appBatt);

/* ⚠️ GARDE EXPLICITE — la parité vérifie que les 3 moteurs S'ACCORDENT, pas ce qu'ils DISENT : si on
   retirait le correctif des trois, ils s'accorderaient sur la MAUVAISE réponse et la parité resterait
   verte. On exige donc le COMPORTEMENT : silence sur du français correct, et les contrôles du sens
   inverse doivent continuer de tirer. */
const _CORRECT = ['Les billevesées que ressassait cet aréopage sont vieilles.',
                  'Les erreurs que corrige le professeur sont nombreuses.',
                  'Les livres que lisait mon frère sont là.',
                  'Les rapports que rédige la secrétaire arrivent demain.'];
/* ⚠️ Le contrôle doit porter sur la couche TESTÉE. Premier jet : j'y avais mis « les enfants que je
   vois joue »→jouent — mais cette correction vient de la GRAMMAIRE (`rAccordRelObj`, rouge), pas de
   la couche OS, donc `osProbe` n'en dit rien et le contrôle échouait sur un moteur pourtant sain.
   Le vrai contrôle du sens inverse, ici, c'est le sujet postposé PLURIEL.
   ⭐ Vérifié un par un : parmi les postposés de la batterie, `osProbe` ne tire QUE sur celui-ci —
   « Ainsi s'achève… » et « Là s'entassait… » sont traités ailleurs. Un contrôle se choisit sur
   MESURE, pas sur intuition. */
const _DOIT_TIRER = [['Sur la table reposait les dossiers.', 'reposaient']];
let _pp = 0;
for (const ph of _CORRECT) {
  const a = appProbe(ph).map(f => f.word + '->' + f.sugg), e = D.osProbe(ph).map(f => f.word + '->' + f.sugg);
  if (a.length || e.length) { _pp++; console.log('✗ SUJET POSTPOSÉ : ' + JSON.stringify(ph) + ' est CORRECT, rien ne doit être proposé — app ' + JSON.stringify(a) + ' ext ' + JSON.stringify(e)); }
}
for (const [ph, att] of _DOIT_TIRER) {
  const a = appProbe(ph).map(f => String(f.sugg).toLowerCase()), e = D.osProbe(ph).map(f => String(f.sugg).toLowerCase());
  if (!a.includes(att) || !e.includes(att)) { _pp++; console.log('✗ CONTRÔLE PERDU : ' + JSON.stringify(ph) + ' doit proposer « ' + att + ' » — app ' + JSON.stringify(a) + ' ext ' + JSON.stringify(e)); }
}
if (_pp) { console.log('PARITÉ OS KO — ' + _pp + ' cas de sujet postposé.'); process.exit(1); }

// comparaison
const nPy = norm(py), nExt = norm(extFlags), nApp = norm(appFlags);
const okExt = nPy === nExt, okApp = nPy === nApp;
console.log('parité OS-sujet (fp_scale) : Python=' + py.length + ' flags | extension=' + extFlags.length + (okExt ? ' ✓' : ' ✗ ÉCART') + ' | app=' + appFlags.length + (okApp ? ' ✓' : ' ✗ ÉCART'));
console.log('parité OS batterie postposé : Python=' + pyBatt.length + ' | ext=' + extBatt.length + ' | app=' + appBatt.length + (okB ? ' ✓' : ' ✗ ÉCART'));
if (okExt && okApp && okB) { console.log('✅ PARITÉ OS 3 moteurs OK'); process.exit(0); }
console.error('✗ DIVERGENCE parité OS-sujet (JS ≠ référence Python)'); process.exit(1);
