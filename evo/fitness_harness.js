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
    if (/application\/json/.test(m[1])) lex = m[2];   // <script type=application/json id=lex4-data>
    else js += '\n;\n' + m[2];
  }
  const stub = new Proxy(function(){}, { get:(t,p)=>{ if(p==='style')return {}; if(p==='textContent')return ''; if(p==='classList')return {add(){},remove(){},toggle(){},contains:()=>false}; if(p==='getContext')return ()=>stub; return stub; }, set:()=>true, apply:()=>stub, construct:()=>stub });
  global.document = { getElementById:(id)=> id==='lex4-data' ? {textContent:lex} : stub, querySelector:()=>stub, querySelectorAll:()=>[], createElement:()=>stub, addEventListener(){}, body:stub, documentElement:stub, getElementsByTagName:()=>[] };
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
    get tried(){return (typeof alreadyTried!=='undefined')?alreadyTried:undefined} };`;
  eval(js + exp);
  const O = globalThis.__O;
  if (O.loadLex) O.loadLex();
  return O;
}

function _snap(O){ const t=O.tried,w=O.word; if(!t||!w)return null; let coups=0,err=0; for(let i=0;i<26;i++){ if(t[i]){coups++; if(!w.includes(String.fromCharCode(65+i)))err++;} } return {coups,err}; }
function _playOne(O,w){ O.startNewGame(w); let sf=300,last=_snap(O); while(O.active&&sf-->0){ O.omegaStep(); const s=_snap(O); if(s)last=s; } return {won:!!O.won, coups:last?last.coups:0, err:last?last.err:0}; }

// Mesure tri-critère, déterministe (graine fixe). repeats>1 pour stabiliser le temps.
function runBench({seed=12345, n=30, repeats=1, O=null}={}) {
  O = O || loadEngine();
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
  const r=runBench({seed, n, repeats:3});
  console.log('=== OMEGA fitness bench (config défaut) ===');
  console.log(`seed ${r.seed} · ${r.n} mots`);
  console.log(`win rate      : ${(r.winrate*100).toFixed(1)} %`);
  console.log(`erreurs/partie: ${r.erreurs}`);
  console.log(`coups/partie  : ${r.coups}`);
  console.log(`temps (min/${3} runs) : ${r.ms} ms`);
}
