// OMEGA — Harnais de FITNESS (Phase 1 "se copie" / sélection des générations).
// Charge le moteur du pendu HEADLESS depuis app/omega-pendu.html, joue N parties seedées,
// renvoie le tri-critère { winrate, erreurs, coups, temps } et compare deux versions
// de façon LEXICOGRAPHIQUE : plancher win rate -> min erreurs -> min temps.
//
// Usage : node evo/fitness_harness.js [seed] [n]
// API   : const {runBench, fitterLex} = require('./evo/fitness_harness.js')
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app', 'omega-pendu.html');

function loadEngine() {
  const html = fs.readFileSync(APP, 'utf8');
  const parts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  let js = '', lex = '';
  for (const m of parts) {
    if (/lex4-data-gz/.test(m[1])) { lex = m[2]; continue; }   // <script type=text/plain id=lex4-data-gz> (gzip+base64)
    // Ne garder que les VRAIS blocs JS. Tout type non-JS (text/plain, application/json) = données embarquées
    // (vdc-lex, speller-lex-gz, gdet-lex-gz…) → JAMAIS concaténer (sinon SyntaxError à l'eval). Robuste aux ajouts futurs.
    const tm = m[1].match(/\btype\s*=\s*["']([^"']*)["']/i);
    const type = tm ? tm[1].toLowerCase().trim() : '';
    const isJS = type === '' || type === 'text/javascript' || type === 'application/javascript' || type === 'module';
    if (!isJS) continue;
    js += '\n;\n' + m[2];
  }
  const stub = new Proxy(function(){}, { get:(t,p)=>{ if(p==='style')return {}; if(p==='textContent')return ''; if(p==='classList')return {add(){},remove(){},toggle(){},contains:()=>false}; if(p==='getContext')return ()=>stub; return stub; }, set:()=>true, apply:()=>stub, construct:()=>stub });
  global.document = { getElementById:(id)=> id==='lex4-data-gz' ? {textContent:lex} : stub, head:stub, querySelector:()=>stub, querySelectorAll:()=>[], createElement:()=>stub, addEventListener(){}, body:stub, documentElement:stub, getElementsByTagName:()=>[] };
  global.addEventListener=()=>{}; global.removeEventListener=()=>{}; global.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
  global.getComputedStyle=()=>({getPropertyValue:()=>''}); global.AudioContext=function(){return stub;}; global.webkitAudioContext=global.AudioContext;
  global.window=global; global.requestAnimationFrame=()=>0; global.cancelAnimationFrame=()=>{};
  global.setTimeout=()=>0; global.setInterval=()=>0; global.clearTimeout=()=>{}; global.clearInterval=()=>{};
  global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  global.performance={now:()=>Number(process.hrtime.bigint())/1e6}; try{global.navigator={userAgent:'node'};}catch(e){} global.alert=()=>{};
  const exp = `;globalThis.__O={
    loadLex:(typeof loadOmegaLex4!=='undefined')?loadOmegaLex4:null,
    init:(typeof initOmegaGlobals!=='undefined')?initOmegaGlobals:null,
    startNewGame:(typeof startNewGame!=='undefined')?startNewGame:null,
    omegaStep:(typeof omegaStep!=='undefined')?omegaStep:null,
    pick:(typeof _omega_pickWords!=='undefined')?_omega_pickWords:null,
    setSeed:(s)=>{ try{ _omegaSeed=s; if(typeof makeMulberry32!=='undefined')_omegaRng=makeMulberry32(s);}catch(e){} },
    get active(){return (typeof gameActive!=='undefined')?gameActive:undefined},
    get won(){return (typeof lastGameWon!=='undefined')?lastGameWon:undefined},
    get word(){return (typeof currentWord!=='undefined')?currentWord:undefined},
    get tried(){return (typeof alreadyTried!=='undefined')?alreadyTried:undefined},
    evalIn:(c)=>eval(c) };`;   // pont de MESURE (direct eval = même portée que le moteur) : lit/écrit les toggles (let) et objets internes par référence. N'altère pas la baseline (clé d'export en plus).
  eval(js + exp);
  installerBancHonnete(globalThis.__O, js);
  return globalThis.__O;
}

// ── BANCS HONNÊTES (27/09/2026) ─────────────────────────────────────────────────────────────────────────────────
// ① TOUS LES RÉGLAGES, PUIS L'INIT. Une config qui ne pose qu'une partie des réglages hérite du reste de ce qui a
//    tourné avant ; et initOmegaGlobals() appelé AVANT la pose bâtit ses structures avec l'état précédent. Mesuré :
//    la « même » config de l'évolution faisait 25/40 dans un moteur neuf et 28/40 posée après le préréglage de la page.
//    __defauts() remet TOUS les réglages (les `let M_*`, `M4_*`, `M5_*`, `L01_*` à valeur simple, relevés dans le
//    code) à leur valeur de chargement. Une config s'écrit donc : __defauts() ; <ses réglages> ; initOmegaGlobals().
// ② UN MOT HORS DU LEXIQUE N'A PAS DE SON. Retirer le mot test de len_index ne suffisait pas : la table des
//    prononciations `wp` (_emrg_initOnline, _emrg_initG2P) est bâtie sur OMEGA_LEX4.words, et la voie « assemblé »
//    lisait le son du mot caché — c'était tout le « 74 % hors-lexique » (dictee/JOURNAL.md, 27/09/2026). Ici `wp.get`
//    ne rend un son que pour un mot présent dans le lexique EN COURS, comme dans le produit où un mot inconnu n'a pas de
//    son. Pour mesurer VOLONTAIREMENT le « mot entendu » (oreille parfaite) : `--entendu` sur la ligne de commande,
//    ou `__OREILLE_PARFAITE = true` dans le moteur — et le dire dans le résultat.
const REGLAGE = /(?:^|\n)[ \t]*let[ \t]+((?:M_|M4_|M5_|L01_)[A-Z0-9_]+)[ \t]*=[ \t]*(?:true|false|-?\d[\d.]*|'[^'\n]*'|"[^"\n]*")[ \t]*[;,]/g;
function installerBancHonnete(O, js) {
  const noms = [...new Set([...js.matchAll(REGLAGE)].map((m) => m[1]))];
  O.evalIn(`(function(){
    const D = {};
    for (const n of ${JSON.stringify(noms)}) { try { D[n] = eval(n); } catch (e) {} }
    globalThis.__DEFAUTS = D;
    globalThis.__defauts = function(){ for (const n in D) { try { eval(n + '=' + JSON.stringify(D[n])); } catch (e) {} } };
    globalThis.__OREILLE_PARFAITE = ${process.argv.includes('--entendu') ? 'true' : 'false'};
    let src = null, ens = null;
    const dansLexique = (m) => {
      const LI = (typeof OMEGA_LEX4 !== 'undefined' && OMEGA_LEX4) ? OMEGA_LEX4.len_index : null;
      if (!LI) return true;
      if (LI !== src) { src = LI; ens = new Set(); for (const k in LI) for (const id of LI[k]) { const w = OMEGA_LEX4.words[id]; if (w && w.m) ens.add(w.m); } }
      return ens.has(m);
    };
    const garder = (G) => {
      if (!G || !G.wp || G.__banc) return G;
      const get0 = G.wp.get.bind(G.wp);
      G.wp.get = function (k) { return (__OREILLE_PARFAITE || dansLexique(k)) ? get0(k) : undefined; };
      G.__banc = true; return G;
    };
    const on0 = _emrg_initOnline; _emrg_initOnline = function () { return garder(on0()); };
    const g0 = _emrg_initG2P; _emrg_initG2P = function () { return garder(g0()); };
    globalThis.__dansLexique = dansLexique;
  })()`);
  O.reglages = Object.keys(O.evalIn('__DEFAUTS')).length;
}

function _snap(O){ const t=O.tried,w=O.word; if(!t||!w)return null; let coups=0,err=0; for(let i=0;i<26;i++){ if(t[i]){coups++; if(!w.includes(String.fromCharCode(65+i)))err++;} } return {coups,err}; }
function _playOne(O,w){ O.startNewGame(w); let sf=300,last=_snap(O); while(O.active&&sf-->0){ O.omegaStep(); const s=_snap(O); if(s)last=s; } return {won:!!O.won, coups:last?last.coups:0, err:last?last.err:0}; }

// Mesure tri-critère, déterministe (graine fixe). repeats>1 pour stabiliser le temps.
async function runBench({seed=12345, n=30, repeats=1, O=null}={}) {
  O = O || loadEngine();
  if(O.loadLex) await O.loadLex();
  O.setSeed(seed); if(O.init)O.init(); O.setSeed(seed);
  const words=(O.pick?O.pick(n,seed):[]).filter(Boolean);
  let W=0,E=0,C=0; let best=Infinity;
  for(let r=0;r<repeats;r++){ const t0=performance.now();
    let w0=0,e0=0,c0=0; for(const w of words){ const x=_playOne(O,w); if(x.won)w0++; e0+=x.err; c0+=x.coups; }
    const dt=performance.now()-t0; if(dt<best)best=dt;
    if(r===0){W=w0;E=e0;C=c0;}
  }
  const m=words.length||1;
  return { seed, n:m, winrate:+(W/m).toFixed(4), erreurs:+(E/m).toFixed(3), coups:+(C/m).toFixed(3), ms:+best.toFixed(1) };
}

// Comparaison LEXICOGRAPHIQUE : cand vs parent. eps = tolérance plancher win rate.
// Renvoie >0 si cand MEILLEUR, <0 si PIRE, 0 si équivalent.
function fitterLex(cand, parent, {eps=0.005}={}) {
  if (cand.winrate < parent.winrate - eps) return -1;          // plancher : ne pas régresser
  if (cand.winrate > parent.winrate + eps) return +1;          // gagne sur le win rate
  if (cand.erreurs < parent.erreurs - 1e-6) return +1;         // à win rate égal : moins d'erreurs
  if (cand.erreurs > parent.erreurs + 1e-6) return -1;
  if (cand.ms < parent.ms * 0.98) return +1;                   // puis : plus rapide (marge 2%)
  if (cand.ms > parent.ms * 1.02) return -1;
  return 0;
}

module.exports = { loadEngine, runBench, fitterLex };

if (require.main === module) {
  const seed=+(process.argv[2]||12345), n=+(process.argv[3]||30);
  runBench({seed, n, repeats:3}).then(function(r){
    console.log('=== OMEGA fitness bench (config défaut) ===');
    console.log('seed '+r.seed+' · '+r.n+' mots');
    console.log('win rate      : '+(r.winrate*100).toFixed(1)+' %');
    console.log('erreurs/partie: '+r.erreurs);
    console.log('coups/partie  : '+r.coups);
    console.log('temps (min/3 runs) : '+r.ms+' ms');
  }).catch(function(e){console.error(e);});
}
