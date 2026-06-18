// OMEGA — §3.2 test : M1_m SANS homéostasie-fréquence récupère-t-il le +0,087 marginal ?
// M1_m.letterScore = 1 − M4_m.letterPenalty. HOMEO_V2 ON = letterPenalty ancré à la FRÉQUENCE (relavé) ;
// HOMEO_V2 OFF = baseline decay→0 (un-ancré : penalty s'accumule sur les RATÉS, pas d'ancre-fréquence).
// Test : GAP NET (in−out − fréquence) de M1_m.letterScore, HOMEO_V2 ON vs OFF. Prédiction : ON≈0, OFF≈+0,087.
//
// Voie phon active (init §1.4.3). R67. Usage : node evo/diag_m1m_homeo.js [warmup] [test] [seed]
'use strict';
const { loadEngine } = require('./fitness_harness.js');
const CFG = [
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_BPC_READOUT_COUPLE_ENABLED=true','M_PHON_READOUT_COUPLE_ENABLED=true',
  'M_OS_LEARNING_ENABLED=true','M_OS_LEARNING_GUARD_1_BOUNDED=true','M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true','M_OS_LEARNING_GUARD_3_MDL_REGUL=true','M_OS_LEARNING_GUARD_4_COHERENCE=true',
  'M_DECLARE_NEO_ENABLED=false','M_NEO_RECALL_ENABLED=false','M_NEO_ASSEMBLED_ENABLED=false','M_NEO_COHORT_ENABLED=false','M_NEO_G2P_EXP_ENABLED=false',
].join(';');

function probe(ev, global, homeo, trainW, testW){
  ev(CFG);
  ev(`_omegaSeed=1;_omegaRng=makeMulberry32(1);initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
  ev(CFG);
  ev(`M4_M_HOMEO_V2_ENABLED=${!!homeo};`);
  if(ev("!!M4_M_HOMEO_V2_ENABLED")!==!!homeo) throw new Error('HOMEO_V2 non posé (const ?)');
  ev(`_omegaRng=makeMulberry32(1);`);
  for(const w of trainW){global.__start(w);let sf=300;while(global.__state().active&&sf-->0)global.__step();}
  const freq=global.__freq(); let inS=0,outS=0,inF=0,outF=0,inN=0,outN=0;
  for(const w of testW){
    global.__start(w); const ws=new Set(w.split('').map(c=>c.charCodeAt(0)-65)); let sf=300;
    while(global.__state().active&&sf-->0){
      global.__step(); const st=global.__state(); const ls=global.__ls();
      for(let l=0;l<26;l++){ if(st.tried[l])continue; if(ws.has(l)){inS+=ls[l];inF+=freq[l];inN++;}else{outS+=ls[l];outF+=freq[l];outN++;} }
    }
  }
  const gLs=(inS/Math.max(1,inN))-(outS/Math.max(1,outN));
  const gFreq=(inF/Math.max(1,inN))-(outF/Math.max(1,outN));
  return { gLs, gFreq, gNet: gLs-gFreq };
}

(async () => {
  const warmupN=+(process.argv[2]||200), testN=+(process.argv[3]||80), seed=+(process.argv[4]||12345);
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const W=LEX.words;
  const valid=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&m.length>=7&&m.length<=12&&/^[A-Z]+$/.test(m))valid.push(i);}
  let r=(seed>>>0); const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
  const trainW=valid.slice(testN,testN+warmupN).map(i=>W[i].m), testW=valid.slice(0,testN).map(i=>W[i].m);

  ev('globalThis.__start=function(w){startNewGame(w);};globalThis.__step=function(){omegaStep();};globalThis.__state=function(){return{active:gameActive,tried:Array.prototype.slice.call(alreadyTried)};};');
  ev('globalThis.__ls=function(){return Array.prototype.slice.call(M1_m.letterScore);};');
  ev('globalThis.__freq=function(){var t=M4_m.letterTarget,o=[];for(var l=0;l<26;l++)o.push(1-t[l]);return o;};');

  console.log(`\n=== §3.2 — M1_m.letterScore discrimination : HOMEO_V2 (ancre-fréquence) ON vs OFF · warmup ${warmupN}/test ${testN} · seed ${seed} ===\n`);
  const on  = probe(ev, global, true,  trainW, testW);
  const off = probe(ev, global, false, trainW, testW);
  console.log(`  HOMEO_V2 ON  (ancré fréquence) : GAP letterScore ${on.gLs.toFixed(4)} · fréquence ${on.gFreq.toFixed(4)} · GAP NET ${(on.gNet>=0?'+':'')}${on.gNet.toFixed(4)}`);
  console.log(`  HOMEO_V2 OFF (un-ancré decay→0): GAP letterScore ${off.gLs.toFixed(4)} · fréquence ${off.gFreq.toFixed(4)} · GAP NET ${(off.gNet>=0?'+':'')}${off.gNet.toFixed(4)}`);
  console.log(`\n  → récupération du marginal : NET(OFF) − NET(ON) = ${(off.gNet-on.gNet>=0?'+':'')}${(off.gNet-on.gNet).toFixed(4)}  (hypothèse §3.2 : ~+0,087 si l'ancre-fréquence est bien le frein)`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
