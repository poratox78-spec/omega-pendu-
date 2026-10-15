// INVENTAIRE DU CORRECTEUR — liste n° 27 (audit du 13/10/2026) : ce qui EXISTE, écrit par un script à partir du code, jamais de mémoire.
// Pour chaque règle : son nom affiché, sa fonction dans l'extension (≡ app) et sa jumelle Python, son palier (rouge / orange), la
// famille de son conseil (ce que le panneau explique) et les tables qu'elle lit (directement ou par les fonctions qu'elle appelle).
//   node dictee/inventaire_correcteur.js           → réécrit dictee/INVENTAIRE_CORRECTEUR.md
//   node dictee/inventaire_correcteur.js --check   → sortie 1 si le fichier commité n'est plus à jour, ou si une garde tombe :
//     ① la chaîne des règles de l'app ≡ celle de l'extension (mêmes noms, mêmes fonctions, même ordre) ;
//     ② la chaîne de l'extension ≡ celle du moteur Python (même ordre, aux alias de nom près) ; une règle que le Python est seul à
//        avoir dans sa chaîne doit exister côté JS hors chaîne (les oranges posées après coup) ;
//     ③ chaque nom de règle a une famille de conseil par son NOM (le routage complet est gardé par dictee/textes_probe.js).
// Le Python est lu en l'important (correcteur_probe.RULES) : la liste est construite en plusieurs temps, le source seul mentirait.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), EXT = path.join(ROOT, 'extension'), OUT = path.join(__dirname, 'INVENTAIRE_CORRECTEUR.md');
const CHECK = process.argv.includes('--check');
const D = require(path.join(EXT, 'charger_node.js'))({ ext: EXT });
const ext = fs.readFileSync(path.join(EXT, 'dys-core.js'), 'utf8'), app = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8');
const errs = []; const fail = (m) => errs.push(m);

// — la chaîne des règles (CRULES) ——————————————————————————————————————————————————————————————————————————————————————————
const chaine = (src, qui) => { const i = src.indexOf('var CRULES=['), j = src.indexOf('];', i);
  if (i < 0) { fail(qui + ' : CRULES introuvable'); return []; }
  return [...src.slice(i, j).matchAll(/\[(?:'([^']+)'|"([^"]+)"),\s*([A-Za-z_$][\w$]*)\]/g)].map((m) => [m[1] || m[2], m[3]]); };
const CR = chaine(ext, 'extension'), CRA = chaine(app, 'app');
if (CR.length < 80) fail('extraction de CRULES : ' + CR.length + ' règles seulement (le motif ne lit plus le moteur ?)');
if (JSON.stringify(CR) !== JSON.stringify(CRA)) fail('① la chaîne des règles de l\'app ≠ celle de l\'extension (' + CRA.length + ' / ' + CR.length + ')');

// — le moteur Python —————————————————————————————————————————————————————————————————————————————————————————————————————————
const PYSRC = 'import json,sys; sys.path.insert(0, sys.argv[1]); import correcteur_probe as C; print(json.dumps([(n, getattr(f, "__name__", "?")) for n, f in C.RULES]))';
let PY = null;
for (const exe of ['python', 'python3']) {
  try { PY = JSON.parse(cp.execFileSync(exe, ['-c', PYSRC, __dirname], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }) })); break; } catch (e) { }
}
if (!PY) { console.error('✗ inventaire : moteur Python illisible (python / python3)'); process.exit(1); }
const ALIAS_PY = { 'accord grammatical (é/er)': '-é/-er' };   // même règle, nom affiché différent
const nPy = (n) => ALIAS_PY[n] || n;

// — les noms posés hors de la chaîne (orthographe, typographie, oranges posées après coup) ——————————————————————————————————
const LIT = new Map(); for (const m of ext.matchAll(/name:(?:'([^']+)'|"([^"]+)")/g)) { const n = m[1] || m[2]; LIT.set(n, (LIT.get(n) || 0) + 1); }
if (ext.indexOf("'impératif (pronom)'") >= 0) LIT.set('impératif (pronom)', 1);

// ② appariement JS ↔ Python : la k-ième règle d'un nom côté JS ↔ la k-ième côté Python ; l'ORDRE doit être le même, hors règles
// nommées ici (déplacées, relevé du 14/10/2026 — l'ordre ne change une sortie que si deux règles marquent le même mot).
const DEPLACEES = { 'infinitif après pronom sujet à vérifier': 'orange ; le Python la pose en fin de chaîne, l\'extension après « accord tout »' };
const nomsCR = new Set(CR.map(([n]) => nPy(n)));
const pyChaine = PY.filter(([n]) => nomsCR.has(n)), pySeul = PY.filter(([n]) => !nomsCR.has(n));
const seqJ = CR.map(([n]) => nPy(n)).filter((n) => !DEPLACEES[n]), seqP = pyChaine.map(([n]) => n).filter((n) => !DEPLACEES[n]);
if (pyChaine.length !== CR.length || seqJ.length !== seqP.length || seqJ.some((n, k) => n !== seqP[k]))
  fail('② la chaîne Python ne suit plus celle de l\'extension (' + pyChaine.length + ' / ' + CR.length + ' ; premier écart hors règles déplacées connues : ' +
       (seqJ.findIndex((n, k) => n !== seqP[k]) + 1) + 'e)');
const jumelle = []; { const vu = new Map(); for (const [n] of CR) { const k = vu.get(nPy(n)) || 0; vu.set(nPy(n), k + 1); const q = pyChaine.filter(([m]) => m === nPy(n))[k]; jumelle.push(q ? q[1] : '?'); } }
const deplacees = Object.keys(DEPLACEES).filter((n) => CR.findIndex(([m]) => nPy(m) === n) !== pyChaine.findIndex(([m]) => m === n));
for (const n of Object.keys(DEPLACEES)) if (deplacees.indexOf(n) < 0) fail('② « ' + n + ' » est revenue à sa place dans le Python : retire-la de DEPLACEES');
for (const [n] of pySeul) if (!LIT.has(n)) fail('② « ' + n + ' » : dans la chaîne Python, nulle part côté JS');

// — corps des fonctions, graphe d'appels, tables ————————————————————————————————————————————————————————————————————————————
// Un passage de LEXEUR sur le source : chaînes, commentaires et expressions régulières sont blanchis (un nom de fonction cité dans un
// commentaire n'est pas un appel ; une accolade dans une regex n'en est pas une), les accolades du code sont appariées, et chaque
// « function NOM( » du code reçoit son corps (jusqu'à l'accolade qui ferme).
function fonctions(src) {
  const n = src.length, code = src.split(''), ferme = new Map(), decl = [], pile = [];
  const KW = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'throw', 'else', 'do', 'instanceof']);
  const isId = (c) => /[A-Za-z0-9_$]/.test(c), blanc = (a, b) => { for (let k = a; k < b && k < n; k++) if (code[k] !== '\n') code[k] = ' '; };
  let i = 0, dernier = '', mot = '';
  while (i < n) {
    const c = src[i], a = i;
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; blanc(a, i); continue; }
    if (c === '/' && src[i + 1] === '*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? n : j + 2; blanc(a, i); continue; }
    if (c === "'" || c === '"' || c === '`') { i++; while (i < n && src[i] !== c && (c === '`' || src[i] !== '\n')) { if (src[i] === '\\') i++; i++; } i++; blanc(a + 1, i - 1); dernier = c; mot = ''; continue; }
    if (c === '/' && (!dernier || '(,=:[!&|?{};+-*%<>~^'.indexOf(dernier) >= 0 || (isId(dernier) && KW.has(mot)))) {
      i++; let cl = false; while (i < n && src[i] !== '\n') { const d = src[i]; if (d === '\\') { i += 2; continue; } if (d === '[') cl = true; else if (d === ']') cl = false; else if (d === '/' && !cl) break; i++; }
      i++; while (i < n && /[a-z]/.test(src[i])) i++; blanc(a, i); dernier = '/'; mot = ''; continue;
    }
    if (isId(c)) { let j = i; while (j < n && isId(src[j])) j++; mot = src.slice(i, j);
      if (mot === 'function') { const m = /^function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(src.slice(i, i + 200)); if (m) decl.push([m[1], i]); }
      dernier = src[j - 1]; i = j; continue; }
    if (c === '{') pile.push(i); else if (c === '}') { const o = pile.pop(); if (o !== undefined) ferme.set(o, i); }
    dernier = c; mot = ''; i++;
  }
  const txt = code.join(''), ouv = [...ferme.keys()].sort((x, y) => x - y), FN = new Map();
  for (const [nom, at] of decl) {
    let lo = 0, hi = ouv.length; while (lo < hi) { const mi = (lo + hi) >> 1; if (ouv[mi] > at) hi = mi; else lo = mi + 1; }   // 1re accolade du code après la déclaration
    if (lo < ouv.length) FN.set(nom, (FN.get(nom) || '') + txt.slice(at, ferme.get(ouv[lo]) + 1));
  }
  return FN;
}
const FN = fonctions(ext);
if (FN.size < 300) fail('lexeur : ' + FN.size + ' fonctions seulement dans dys-core.js');
const IDS = new Map(); for (const [f, b] of FN) IDS.set(f, new Set([...b.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)/g)].map((m) => m[1])));
// table → la fonction qui la charge (set* de dys-core, ou le _apply* qu'il appelle) → les variables qu'elle pose
const TAB = [['vdc-lex (conjugaison, genre, pluriels)', '_applyVdc'], ['genre relâché', '_applyGenderRelaxed'], ['dictionnaire (speller)', '_applySpellerTSV'],
  ['noun-post', '_applyNounPost'], ['étiqueteur HMM', 'setPosHmm'], ['modèle OS-sujet', 'setOsLm'], ['prénoms', '_applyPrenoms'], ['genre accentué', '_applyGaccLex'],
  ['confusables', 'setConfusables'], ['genre de l\'auteur (réglage)', 'setAuteur'], ['ponctuation vocale', 'setPonctLm']];
const VARS = new Map();   // variable → tables qui la remplissent (GENDER_PURE : vdc-lex puis genre relâché)
for (const [t, f] of TAB) {
  const b = FN.get(f); if (!b) { fail('chargeur ' + f + ' introuvable (table « ' + t + ' »)'); continue; }
  const loc = new Set(); for (const m of b.matchAll(/\b(?:var|let|const)\s+([^;]+)/g)) for (const x of m[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)/g)) loc.add(x[1]);
  let n = 0; for (const m of b.matchAll(/(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*(?:\.[\w$]+|\[[^=;\n]*?\])?\s*=(?!=)/g))
    if (!loc.has(m[1]) && /^[A-Z_]/.test(m[1]) && m[1] !== f) { if (!VARS.has(m[1])) VARS.set(m[1], new Set()); VARS.get(m[1]).add(t); n++; }
  if (!n) fail('chargeur ' + f + ' : aucune variable posée lue (table « ' + t + ' »)');
}
const lu = new Map();
function tables(f) {   // tables lues par f et par tout ce qu'il appelle (parcours complet du graphe d'appels, cycles compris)
  if (lu.has(f)) return lu.get(f);
  const r = new Set(), vu = new Set([f]), file = [f];
  while (file.length) { const g = file.pop(); for (const x of IDS.get(g) || []) { if (VARS.has(x)) for (const t of VARS.get(x)) r.add(t); if (FN.has(x) && !vu.has(x)) { vu.add(x); file.push(x); } } }
  lu.set(f, r); return r;
}
const direct = (t) => [...FN.keys()].filter((f) => [...(IDS.get(f) || [])].some((x) => VARS.has(x) && VARS.get(x).has(t)) && !TAB.some(([, g]) => g === f));
const ORDRE_T = TAB.map(([t]) => t), triT = (s) => ORDRE_T.filter((t) => s.has(t));

// — palier et conseil —————————————————————————————————————————————————————————————————————————————————————————————————————————
const iV = ext.indexOf('var _VIG_FAM={'), VIG = new Set([...ext.slice(iV, ext.indexOf('};', iV)).matchAll(/'([^']+)':1/g)].map((m) => m[1]));
if (VIG.size < 5) fail('_VIG_FAM illisible');
const palier = (n, f) => /à vérifier$/.test(n) ? 'orange' : VIG.has(n) ? 'rouge ou orange (sous-cas mesuré, _tierOf)'
  : (f && /vig:1/.test(FN.get(f) || '')) ? 'rouge, orange dans un cas posé par la règle' : 'rouge';
const fam = (n) => D.famRegle(n, 'y') || D.flagsToFacts([{ name: n, word: 'x', sugg: 'y' }])[0].types[0];
const conseil = (n) => { const t = fam(n); return t + (D.REMED[t] ? '' : ' (sans conseil)'); };
for (const n of new Set([...CR.map(([x]) => x), ...LIT.keys()])) if (!D.famRegle(n, 'y') && fam(n) === 'homophone_gram') fail('③ « ' + n + ' » n\'a pas de famille de conseil par son nom');
// côté Python, un nom hors chaîne peut vivre dans une autre sonde (orthographe, OS-sujet…)
const PYF = ['correcteur_probe.py', 'speller_probe.py', 'os_subject_probe.py'].map((f) => [f, fs.existsSync(path.join(__dirname, f)) ? fs.readFileSync(path.join(__dirname, f), 'utf8') : '']);
const pyOu = (n) => { const q = PYF.filter(([, s]) => s.indexOf("'" + n + "'") >= 0 || s.indexOf('"' + n + '"') >= 0).map(([f]) => f); return q.length ? q.join(', ') : '—'; };

// — le fichier ——————————————————————————————————————————————————————————————————————————————————————————————————————————————
const L = [], esc = (s) => String(s).replace(/\|/g, '\\|');
const nPal = (p) => CR.filter(([n, f]) => palier(n, f).startsWith(p)).length;
L.push('# Inventaire du correcteur', '',
  'Écrit par `node dictee/inventaire_correcteur.js` à partir du code (liste n° 27, audit du 13/10/2026) — ne pas éditer à la main ;',
  '`--check` (dev.sh, CI) refuse un inventaire en retard sur le moteur. Le routage complet des conseils est gardé par `dictee/textes_probe.js`.', '',
  '## En chiffres', '',
  '- Chaîne des règles de grammaire (`CRULES`, extension ≡ app) : **' + CR.length + '** entrées, **' + new Set(CR.map(([n]) => n)).size + '** noms affichés ; ' +
  'rouge : ' + CR.filter(([n, f]) => palier(n, f) === 'rouge').length + ' · rouge avec un cas orange posé par la règle : ' + nPal('rouge, orange') +
  ' · rouge ou orange selon le sous-cas : ' + nPal('rouge ou orange') + ' · orange : ' + nPal('orange') + '.',
  '- Moteur Python (`correcteur_probe.RULES`) : **' + PY.length + '** entrées — les ' + CR.length + ' de la chaîne, dans le même ordre, et ' + pySeul.length +
  ' oranges que l\'extension pose hors de la chaîne. Ordre identique, sauf : ' +
  (deplacees.map((n) => '« ' + n + ' » (' + DEPLACEES[n] + ')').join(' ; ') || 'aucune') + '.',
  '- Noms posés hors de la chaîne côté extension (orthographe, typographie, oranges) : **' + LIT.size + '**.',
  '- Tables chargées : ' + TAB.length + ' (le chargeur unique `extension/charger_node.js` les charge toutes pour les bancs).', '',
  '## Règles de grammaire, dans l\'ordre de la chaîne', '',
  'La « famille » est celle du conseil affiché (`famRegle` / `flagsToFacts`) ; « sans conseil » = famille sans texte d\'explication, voulu',
  '(ponctuation, style, répétition). Les tables sont repérées dans le source (lecture directe ou par une fonction appelée).', '',
  '| # | règle | extension / app | Python | palier | famille du conseil | tables lues |', '|---|---|---|---|---|---|---|');
CR.forEach(([n, f], k) => L.push('| ' + (k + 1) + ' | ' + esc(n) + ' | `' + f + '` | `' + jumelle[k] + '` | ' + palier(n, f) + ' | ' + conseil(n) + ' | ' + (triT(tables(f)).join(', ') || '—') + ' |'));
L.push('', '## Noms posés hors de la chaîne (extension)', '',
  'Orthographe, typographie, mots inconnus, et les oranges posées après la chaîne. « Python » = fichier où le nom apparaît.', '',
  '| nom | occurrences | palier | famille du conseil | dans la chaîne Python | Python |', '|---|---|---|---|---|---|');
[...LIT.keys()].sort((a, b) => a.localeCompare(b, 'fr')).forEach((n) => L.push('| ' + esc(n) + ' | ' + LIT.get(n) + ' | ' + (/à vérifier$/.test(n) ? 'orange' : 'selon la couche') + ' | ' + conseil(n) + ' | ' +
  (pySeul.some(([m]) => m === n) ? 'oui' : 'non') + ' | ' + pyOu(n) + ' |'));
L.push('', '## Tables et qui les lit', '', '« Directement » : les fonctions dont le code nomme une variable de la table (les 8 premières, ordre du fichier).', '',
  '| table | chargée par | variables | règles de la chaîne qui la lisent | lue directement par |', '|---|---|---|---|---|');
for (const [t, f] of TAB) {
  const vs = [...VARS].filter(([, x]) => x.has(t)).map(([v]) => v), qui = CR.filter(([, g]) => tables(g).has(t)).length, d = direct(t);
  L.push('| ' + t + ' | `' + f + '` | ' + vs.map((v) => '`' + v + '`').join(' ') + ' | ' + qui + ' / ' + CR.length + ' | ' +
         d.slice(0, 8).map((x) => '`' + x + '`').join(' ') + (d.length > 8 ? ' … (' + d.length + ')' : '') + ' |');
}
L.push('');
const txt = L.join('\n');

if (errs.length) { for (const e of errs) console.log('  ✗ ' + e); console.log('✗ inventaire : ' + errs.length + ' garde(s) tombée(s)'); process.exit(1); }
if (CHECK) {
  const avant = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
  if (avant !== txt) { console.log('✗ inventaire : dictee/INVENTAIRE_CORRECTEUR.md n\'est plus à jour — relance node dictee/inventaire_correcteur.js et commite'); process.exit(1); }
  console.log('✓ inventaire à jour : ' + CR.length + ' règles (ext ≡ app ≡ Python, même ordre), ' + LIT.size + ' noms hors chaîne, ' + TAB.length + ' tables');
} else { fs.writeFileSync(OUT, txt); console.log('écrit ' + path.relative(ROOT, OUT) + ' : ' + CR.length + ' règles, ' + LIT.size + ' noms hors chaîne, ' + TAB.length + ' tables'); }
