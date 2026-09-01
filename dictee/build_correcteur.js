// dictee/build_correcteur.js — GÉNÈRE un moteur correcteur AUTONOME (sans HTML, sans UI, sans DOM réel).
//
// Bake la tranche moteur du monolithe + les lexiques embarqués dans UN SEUL fichier réutilisable (Node + navigateur).
// Source unique = app/omega-pendu.html (régénérer après toute modif du correcteur). Le DOM est injecté en dur
// (les blocs de données deviennent des constantes), donc le fichier produit ne dépend plus du HTML au runtime.
//
//   node dictee/build_correcteur.js [sortie.js]        (défaut: /tmp/correcteur.standalone.js)
//   puis :  const C = require('./correcteur.standalone.js'); await C.init(); C.correct("une grosse fote");
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const APP = path.join(__dirname, '..', 'app', 'omega-pendu.html');
const OUT = process.argv[2] || path.join(os.tmpdir(), 'correcteur.standalone.js');

const html = fs.readFileSync(APP, 'utf8'); try{globalThis.OMEGA_VDC=require('./blobgz').vdcSeed(html);}catch(e){}   // #30 : seed sync vdc-lex-gz (le moteur peuple les maps grammaire sans async)
const start = html.indexOf('(function(){', html.indexOf('mode PHRASES'));
const spIdx = html.indexOf('function spellText', start);
const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
if (start < 0 || spIdx < 0 || cut < 0) { console.error('extraction moteur échouée'); process.exit(2); }
let slice = html.slice(start, cut);
// l'IIFE moteur reçoit le DOM bouchon + dépendances en paramètres (au lieu des globals)
slice = slice.replace('(function(){', '(function(document,localStorage,speechSynthesis,SpeechSynthesisUtterance){');
const vdc = JSON.stringify(globalThis.OMEGA_VDC || {});   // #30 : vdc-lex-gz décompressé (via blobgz, ligne 14) → baké en clair dans le standalone
// ⭐ TOUS les lexiques, pas un seul. Le bake n'embarquait que `speller-lex-gz` et son `init()`
// n'appelait que `loadSpellerLex()` — donc l'accord du NOMBRE (noun-post), du GENRE (gdet/gacc),
// les PRÉNOMS et le tagger POS étaient MUETS dans le moteur autonome. Vérifié le 01/09/2026 en
// interrogeant l'artefact produit : « les chien aboient », « des oiseau dans le ciel » et
// « Marie est venu. » rendaient (RIEN). C'est le bug de 2026-08-11 (« le moteur livré n'appelait
// que loadSpellerLex ») : réparé dans l'app, JAMAIS dans le bake — or `CORRECTEUR.md` propose ce
// bake comme voie d'intégration à des tiers. Les deux sondes qui le gardaient (dev.sh:90 et :98)
// ne testaient qu'UN cas, `fote`→`faute`, une correction du SPELLER : la grammaire muette passait.
// `lex4-data-gz` (5,4 Mo) reste dehors : il ne sert à aucune de ces règles.
function blob(id){var i=html.indexOf('id="'+id+'">');if(i<0)return '';i=html.indexOf('>',i)+1;var j=html.indexOf('</script>',i);return j<0?'':html.slice(i,j);}
const LEXIQUES = ['speller-lex-gz','noun-post-gz','gdet-lex-gz','gacc-lex-gz','prenoms-gz','pos-hmm-gz','os-lm-gz'];
const BLOBS = {}; for (const id of LEXIQUES) { BLOBS[id] = blob(id); if (!BLOBS[id]) { console.error('lexique ABSENT de l app : ' + id); process.exit(2); } }
const spl = BLOBS['speller-lex-gz'];

const out =
`// correcteur.standalone.js — GÉNÉRÉ par dictee/build_correcteur.js (ne pas éditer à la main).
// Moteur de correction français AUTONOME (grammaire + orthographe + hybride), sans HTML/UI/DOM.
// Usage :  const C = require('./correcteur.standalone.js'); await C.init(); C.correct("une grosse fote");
// Requiert un runtime avec DecompressionStream/Blob/Response/atob (Node >=18 ou navigateur moderne).
;(function(root){'use strict';
var __VDC__=${JSON.stringify(vdc)};
var __SPL__=${JSON.stringify(spl)};
// objet direct, PAS une chaîne JSON à re-parser : le double échappement quadruplait le fichier
var __LEX__=${JSON.stringify(BLOBS)};
var __stub=new Proxy(function(){},{get:function(t,k){if(k==='style')return{};if(k==='classList')return{add:function(){},remove:function(){},toggle:function(){},contains:function(){return false;}};return __stub;},set:function(){return true;},apply:function(){return __stub;}});
var __doc={getElementById:function(id){if(id==='vdc-lex')return{textContent:__VDC__};if(__LEX__[id])return{textContent:__LEX__[id]};return __stub;},createElement:function(){return __stub;},body:__stub,head:__stub,addEventListener:function(){},querySelector:function(){return null;},querySelectorAll:function(){return[];}};
var __ls={getItem:function(){return null;},setItem:function(){},removeItem:function(){}};
var __ss={speak:function(){},cancel:function(){},getVoices:function(){return[];}};
var OMEGA_VDC=JSON.parse(__VDC__);   // #30 : seed sync des maps grammaire (le moteur lit OMEGA_VDC, plus de bloc JSON en clair dans l'app)
${slice};root.__corrEngine={correctText:correctText,spellText:spellText,loadSpellerLex:loadSpellerLex,loadNounPost:loadNounPost,loadGenderLex:loadGenderLex,loadPrenoms:loadPrenoms,loadGaccLex:loadGaccLex,loadPosHmm:loadPosHmm,loadOsLm:loadOsLm,ready:function(){return SP.ready;}};})(__doc,__ls,__ss,function(){return __stub;});
var E=root.__corrEngine;
var api={
  ready:function(){return E.ready();},
  // ⭐ init() appelle les HUIT chargeurs, pas seulement le speller : sans eux l'accord du nombre,
  // du genre et les prénoms sont MUETS et RIEN ne le signale (bug 2026-08-11, réparé côté app
  // seulement). Aucune erreur n'est avalée : si un lexique manque, init() REJETTE.
  init:function(){return Promise.all([E.loadSpellerLex(),E.loadNounPost(),E.loadGenderLex(),E.loadPrenoms(),E.loadGaccLex(),E.loadPosHmm(),E.loadOsLm()]);},
  grammar:function(t){return E.correctText(t);},
  spell:function(t){return E.spellText(t);},
  correct:function(t){var gf=E.correctText(t),sf=E.ready()?E.spellText(t):[],byTok={};gf.forEach(function(f){byTok[f.i]=f;});sf.forEach(function(f){if(byTok[f.i]==null)byTok[f.i]=f;});return Object.keys(byTok).map(function(k){return byTok[k];}).sort(function(a,b){return a.i-b.i;});}
};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Correcteur=api;
})(typeof globalThis!=='undefined'?globalThis:(typeof self!=='undefined'?self:this));
`;
fs.writeFileSync(OUT, out);
console.log('généré : ' + OUT + '  (' + (out.length / 1e6).toFixed(2) + ' Mo, autonome — HTML non requis au runtime)');
