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
  for (const m of s.mots) {                       // clitiques : parité EXACTE avec Python
    if (m.raw !== undefined || m.src !== 'clit') continue;
    const js = core.wordSegments(m.mot, DECL2.g2p);
    const a = JSON.stringify(js.map(x => [x.g, x.cls]));
    const b = JSON.stringify(m.segs.map(x => [x.g, x.cls]));
    if (a !== b) fail.push('clitique « ' + m.mot + ' » : JS ' + a + ' ≠ Python ' + b);
  }
}
// ancres end-to-end (g2p app)
const seg = w => core.wordSegments(w, DECL2.g2p);
const find = (w, g) => seg(w).find(x => x.g.toLowerCase() === g);
if ((find('poison', 's') || {}).cls !== 'voi') fail.push('poison : s attendu VOISÉ, eu ' + JSON.stringify(find('poison', 's')));
if ((find('poisson', 'ss') || {}).cls !== 'srd') fail.push('poisson : ss attendu SOURD, eu ' + JSON.stringify(find('poisson', 'ss')));
const chats = seg('chats');
if (chats[chats.length - 1].cls !== 'mute' || chats[chats.length - 2].cls !== 'mute')
  fail.push('chats : finales t/s attendues muettes, eu ' + JSON.stringify(chats));
if (seg('bateau').filter(x => x.cls === 'voi').length !== 1) fail.push('bateau : b seul voisé attendu');

if (fail.length) { console.error('PARITÉ SON — ÉCHEC :'); fail.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
console.log('PARITÉ SON — OK (fraîcheur bloc + TTF, clitiques ≡ Python, texte intact, ancres voisé/sourd/muettes)');
