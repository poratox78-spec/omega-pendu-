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
const spl = (html.match(/<script type="text\/plain" id="speller-lex-gz">([^<]*)<\/script>/) || [])[1] || '';

const out =
`// correcteur.standalone.js — GÉNÉRÉ par dictee/build_correcteur.js (ne pas éditer à la main).
// Moteur de correction français AUTONOME (grammaire + orthographe + hybride), sans HTML/UI/DOM.
// Usage :  const C = require('./correcteur.standalone.js'); await C.init(); C.correct("une grosse fote");
// Requiert un runtime avec DecompressionStream/Blob/Response/atob (Node >=18 ou navigateur moderne).
;(function(root){'use strict';
var __VDC__=${JSON.stringify(vdc)};
var __SPL__=${JSON.stringify(spl)};
var __stub=new Proxy(function(){},{get:function(t,k){if(k==='style')return{};if(k==='classList')return{add:function(){},remove:function(){},toggle:function(){},contains:function(){return false;}};return __stub;},set:function(){return true;},apply:function(){return __stub;}});
var __doc={getElementById:function(id){return id==='vdc-lex'?{textContent:__VDC__}:id==='speller-lex-gz'?{textContent:__SPL__}:__stub;},createElement:function(){return __stub;},body:__stub,head:__stub,addEventListener:function(){},querySelector:function(){return null;},querySelectorAll:function(){return[];}};
var __ls={getItem:function(){return null;},setItem:function(){},removeItem:function(){}};
var __ss={speak:function(){},cancel:function(){},getVoices:function(){return[];}};
var OMEGA_VDC=JSON.parse(__VDC__);   // #30 : seed sync des maps grammaire (le moteur lit OMEGA_VDC, plus de bloc JSON en clair dans l'app)
${slice};root.__corrEngine={correctText:correctText,spellText:spellText,loadSpellerLex:loadSpellerLex,ready:function(){return SP.ready;}};})(__doc,__ls,__ss,function(){return __stub;});
var E=root.__corrEngine;
var api={
  ready:function(){return E.ready();},
  init:function(){return E.loadSpellerLex();},                 // décompresse le lexique ortho (async, à appeler 1×)
  grammar:function(t){return E.correctText(t);},
  spell:function(t){return E.spellText(t);},
  correct:function(t){var gf=E.correctText(t),sf=E.ready()?E.spellText(t):[],byTok={};gf.forEach(function(f){byTok[f.i]=f;});sf.forEach(function(f){if(byTok[f.i]==null)byTok[f.i]=f;});return Object.keys(byTok).map(function(k){return byTok[k];}).sort(function(a,b){return a.i-b.i;});}
};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Correcteur=api;
})(typeof globalThis!=='undefined'?globalThis:(typeof self!=='undefined'?self:this));
`;
fs.writeFileSync(OUT, out);
console.log('généré : ' + OUT + '  (' + (out.length / 1e6).toFixed(2) + ' Mo, autonome — HTML non requis au runtime)');
