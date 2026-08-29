// ===== Parité « police de son » (CI) =====
// 1) FRAÎCHEUR : le bloc son-core injecté dans l'app == police/son_core.js (byte-égal) ;
//    les 3 blocs base64 décodent bien vers des TTF (magic 00 01 00 00).
// 2) CLITIQUES ≡ Python : pour chaque mot-fonction de son_layer.json (réf. Python),
//    segs JS (g, cls) identiques — le cœur partagé, indépendant du g2p.
// 3) END-TO-END sur le g2p APP (_DECL2 extrait de l'app) : pour chaque phrase de la réf.,
//    reconstruction EXACTE du texte (principe cardinal), classes valides, et ancres :
//    poison→s voisé, poisson→ss sourd, finales de « chats » muettes.
//    (Pas de comparaison seg-à-seg hors clitiques : la réf. Python roule le g2p ENRICHI
//    (SEG+corrections), l'app le g2p moteur — divergence de segmentation assumée.)
const fs = require('fs'), path = require('path');
const HERE = __dirname;
const html = fs.readFileSync(path.join(HERE, '..', 'app', 'omega-pendu.html'), 'utf8');
const fail = [];

// --- 1. fraîcheur du bloc injecté ---
const coreSrc = fs.readFileSync(path.join(HERE, 'son_core.js'), 'utf8');
const mCore = html.match(/<script id="omegadys-son-core">\n([\s\S]*?)<\/script>/);
if (!mCore) fail.push('bloc omegadys-son-core absent de l\'app (lancer inject_fonts.py)');
else if (mCore[1] !== coreSrc) fail.push('son_core.js injecté ≠ police/son_core.js (relancer inject_fonts.py)');
const uiSrc = fs.readFileSync(path.join(HERE, 'son_ui.js'), 'utf8');
const mUi = html.match(/<script id="omegadys-son-ui">\n([\s\S]*?)<\/script>/);
if (!mUi) fail.push('bloc omegadys-son-ui absent de l\'app (lancer inject_fonts.py)');
else if (mUi[1] !== uiSrc) fail.push('son_ui.js injecté ≠ police/son_ui.js (relancer inject_fonts.py)');
// --- 1bis. extension : assets dérivés FRAIS (build_assets.py)
const EXT = path.join(HERE, '..', 'extension', 'assets');
try {
  const extCore = fs.readFileSync(path.join(EXT, 'son_core.js'), 'utf8');
  if (extCore !== coreSrc) fail.push('extension/assets/son_core.js ≠ police/son_core.js (relancer extension/build_assets.py)');
  const extG2p = fs.readFileSync(path.join(EXT, 'g2p.js'), 'utf8');
  const j0 = html.indexOf('var _DECL2 = (function () {'), jR = html.indexOf('return { g2p: g2p,', j0), jE = html.indexOf('})()', jR) + 4;
  if (extG2p.indexOf(html.slice(j0, jE)) < 0) fail.push('extension/assets/g2p.js ≠ tranche _DECL2 de l\'app (relancer build_assets.py)');
  for (const fn of ['OmegaDys-Regular.ttf', 'OmegaDys-Light.ttf', 'OmegaDys-Heavy.ttf'])
    if (!fs.readFileSync(path.join(EXT, fn)).equals(fs.readFileSync(path.join(HERE, fn)))) fail.push('extension/assets/' + fn + ' ≠ police/' + fn);
} catch (e) { fail.push('assets extension police de son absents : ' + e.message); }
for (const k of ['regular', 'light', 'heavy']) {
  const m = html.match(new RegExp('<script type="text/plain" id="omegadys-b64-' + k + '">([^<]*)</script>'));
  if (!m || !m[1]) { fail.push('bloc police ' + k + ' absent'); continue; }
  const buf = Buffer.from(m[1], 'base64');
  if (!(buf[0] === 0 && buf[1] === 1 && buf[2] === 0 && buf[3] === 0)) fail.push('bloc ' + k + ' : pas une TTF');
}

// --- 2 & 3. cœur + g2p app ---
const core = require(path.join(HERE, 'son_core.js'));
const i0 = html.indexOf('var _DECL2 = (function () {');
const iRet = html.indexOf('return { g2p: g2p,', i0);
const iEnd = html.indexOf('})()', iRet) + '})()'.length;
if (i0 < 0 || iRet < 0) { console.error('extraction _DECL2 échouée'); process.exit(2); }
let DECL2;
try { DECL2 = (0, eval)(html.slice(i0 + 'var _DECL2 = '.length, iEnd)); }
catch (e) { console.error('eval _DECL2 échoué :', e.message); process.exit(2); }

const ref = JSON.parse(fs.readFileSync(path.join(HERE, 'son_layer.json'), 'utf8'));
const CLS = {voi: 1, srd: 1, mute: 1, n: 1};
for (const s of ref) {
  const out = core.sentenceSegments(s.texte, DECL2.g2p);
  const rebuilt = out.map(m => m.raw !== undefined ? m.raw : m.segs.map(x => x.g).join('')).join('');
  if (rebuilt !== s.texte) fail.push('texte altéré : ' + JSON.stringify(rebuilt) + ' ≠ ' + JSON.stringify(s.texte));
  for (const m of out) if (m.segs) for (const x of m.segs) if (!CLS[x.cls]) fail.push('classe inconnue ' + x.cls);
  for (const m of s.mots) {                       // clitiques + ÉLISIONS (préfixe par table) : parité EXACTE avec Python
    if (m.raw !== undefined || (m.src !== 'clit' && m.src !== 'elide')) continue;
    const js = core.wordSegments(m.mot, DECL2.g2p);
    const a = JSON.stringify(js.map(x => [x.g, x.cls]));
    const b = JSON.stringify(m.segs.map(x => [x.g, x.cls]));
    if (m.src === 'clit' && a !== b) fail.push('clitique « ' + m.mot + ' » : JS ' + a + ' ≠ Python ' + b);
    if (m.src === 'elide') {                        // le préfixe élidé + l'apostrophe doivent coïncider (le reste roule le g2p de chaque côté)
      const ap = m.mot.search(/['’]/);
      const pa = js.slice(0, js.findIndex(x => /^['’]$/.test(x.g)) + 1), pb = m.segs.slice(0, m.segs.findIndex(x => /^['’]$/.test(x.g)) + 1);
      if (ap > 0 && JSON.stringify(pa.map(x => [x.g, x.cls])) !== JSON.stringify(pb.map(x => [x.g, x.cls]))) fail.push('élision « ' + m.mot + ' » : JS ' + JSON.stringify(pa) + ' ≠ Python ' + JSON.stringify(pb));
    }
  }
}
// syllabes ≡ Python là où la segmentation en graphèmes coïncide (même g2p → mêmes frontières)
let sylCmp = 0;
for (const s of ref) for (const m of s.mots) {
  if (m.raw !== undefined || !m.syll || m.src === 'elide') continue;   // élisions : syllabes non comparées (apostrophe = segment neutre)
  const js = core.wordSegments(m.mot, DECL2.g2p);
  // mêmes graphèmes ET mêmes phonèmes (la réf. Python roule g2p enrichi + corrections apprises :
  // ex. « derrière » i→/j/ devant è côté Python, /i/ côté moteur app → syllabes différentes, hors sujet ici)
  if (JSON.stringify(js.map(x => [x.g, x.ph])) !== JSON.stringify(m.segs.map(x => [x.g, x.ph]))) continue;
  sylCmp++;
  const a = JSON.stringify(core.syllables(js)), b = JSON.stringify(m.syll);
  if (a !== b) fail.push('syllabes « ' + m.mot + ' » : JS ' + a + ' ≠ Python ' + b);
}
if (sylCmp < 10) fail.push('parité syllabes : trop peu de mots comparables (' + sylCmp + ')');
// ancres end-to-end (g2p app)
const seg = w => core.wordSegments(w, DECL2.g2p);
const find = (w, g) => seg(w).find(x => x.g.toLowerCase() === g);
if ((find('poison', 's') || {}).cls !== 'voi') fail.push('poison : s attendu VOISÉ, eu ' + JSON.stringify(find('poison', 's')));
if ((find('poisson', 'ss') || {}).cls !== 'srd') fail.push('poisson : ss attendu SOURD, eu ' + JSON.stringify(find('poisson', 'ss')));
const chats = seg('chats');
if (chats[chats.length - 1].cls !== 'mute' || chats[chats.length - 2].cls !== 'mute')
  fail.push('chats : finales t/s attendues muettes, eu ' + JSON.stringify(chats));
if (seg('bateau').filter(x => x.cls === 'voi').length !== 1) fail.push('bateau : b seul voisé attendu');

// ===== 4) PLAGE DE GRAISSE sur chaque FontFace (régression du 29/08/2026) =====
// `new FontFace(nom, source)` sans 3ᵉ argument n'enregistre la face qu'en poids 400 : dès qu'une
// lettre habillée tombe dans du gras — et dans « texte corrigé » chaque mot corrigé EST un <b> —
// le navigateur SYNTHÉTISE le gras. Mesuré au canvas (pixels encrés, 34 px) : Light 836 → 1263,
// donc PLUS ÉPAIS que Heavy (1242) : le signal de voisement s'INVERSE.
// ⚠️ La largeur ne le voit pas (chasse fixe, 143,17 px des deux côtés) — ne pas « vérifier » par là.
// Correctif : {weight:'1 1000'} fait matcher la face unique pour tout poids demandé.
const SOURCES_FONTFACE = ['../app/omega-pendu.html', 'son_ui.js', '../extension/son_panel.js'];
for (const rel of SOURCES_FONTFACE) {
  const p = path.join(HERE, rel);
  if (!fs.existsSync(p)) { fail.push('FontFace : fichier introuvable ' + rel); continue; }
  const src = fs.readFileSync(p, 'utf8');
  const appels = src.match(/new FontFace\([^;]*?\)\s*;/g) || [];
  if (!appels.length) { fail.push('FontFace : aucun appel trouvé dans ' + rel + ' (la garde ne garde plus rien ?)'); continue; }
  appels.forEach(a => {
    if (!/weight\s*:/.test(a))
      fail.push('FontFace SANS plage de graisse dans ' + rel + ' -> faux gras, voisement inversé : ' + a.replace(/\s+/g, ' ').slice(0, 110));
  });
}

if (fail.length) { console.error('PARITÉ SON — ÉCHEC :'); fail.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
console.log('PARITÉ SON — OK (fraîcheur bloc + TTF, clitiques ≡ Python, texte intact, ancres voisé/sourd/muettes, plage de graisse)');
