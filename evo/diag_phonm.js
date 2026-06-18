// OMEGA — DIAGNOSTIC phon→ortho DESCENDANT : M4_phon_m.letterPenalty (seul signal phon descendant consommé, lu en 3590)
// porte-t-il un signal SPÉCIFIQUE AU MOT, ou est-il un BIAIS GLOBAL comme le miroir ortho M1_m (§1.4.1) ?
//
// Si global (gap ≈ fréquence, variance inter-mots ≈ 0) → les DEUX miroirs descendants sont des biais globaux ;
// le seul levier phon→ortho spécifique au mot est l'ASCENDANT (assemblé NEO, +5,28), pas la correction descendante.
//
// Mesure (R67 lecture seule). Score-like phon = (1 − letterPenalty) car consommé en 3590 : scores[l] *= (1 − lp[l]).
// Usage : node evo/diag_phonm.js [warmupN] [testN] [seed]   (défauts 200 / 80 / 12345)
'use strict';
const { loadEngine } = require('./fitness_harness.js');

const CFG_COG = [
  'L01_A1_M2_ORTHO_ENABLED=false','L01_A2_M4_LEX4_ENABLED=false','L01_A3_M5M_WORDLEX4_ENABLED=false',
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_BPC_READOUT_COUPLE_ENABLED=true','M_PHON_READOUT_COUPLE_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
  'M_OS_LEARNING_ENABLED=true','M_OS_LEARNING_GUARD_1_BOUNDED=true','M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true','M_OS_LEARNING_GUARD_3_MDL_REGUL=true','M_OS_LEARNING_GUARD_4_COHERENCE=true',
  'M_DECLARE_NEO_ENABLED=false','M_NEO_RECALL_ENABLED=false','M_NEO_ASSEMBLED_ENABLED=false','M_NEO_COHORT_ENABLED=false','M_NEO_G2P_EXP_ENABLED=false',
].join(';');

(async () => {
  const warmupN=+(process.argv[2]||200), testN=+(process.argv[3]||80), seed=+(process.argv[4]||12345);
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const W=LEX.words;

  const valid=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&m.length>=7&&m.length<=12&&/^[A-Z]+$/.test(m))valid.push(i);}
  let r=(seed>>>0); const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
  const trainW=valid.slice(testN,testN+warmupN).map(i=>W[i].m), testW=valid.slice(0,testN).map(i=>W[i].m);

  ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
  ev(CFG_COG);
  if(ev("typeof M4_phon_m")==='undefined'){console.error('ERR M4_phon_m absent');process.exit(1);}
  ev('globalThis.__start=function(w){startNewGame(w);};globalThis.__step=function(){omegaStep();};globalThis.__state=function(){return{active:gameActive,tried:Array.prototype.slice.call(alreadyTried)};};');
  // score-like phon = 1 - letterPenalty (sens de consommation en 3590)
  ev('globalThis.__pls=function(){var lp=(M4_phon_m&&M4_phon_m.letterPenalty)?M4_phon_m.letterPenalty:null;if(!lp)return null;var o=[];for(var l=0;l<26;l++)o.push(1-lp[l]);return o;};');

  ev(`_omegaRng=makeMulberry32(${seed});`);
  for(const w of trainW){global.__start(w);let sf=300;while(global.__state().active&&sf-->0)global.__step();}

  let inSum=0,inN=0,outSum=0,outN=0; const tick0=[];
  for(const w of testW){
    global.__start(w); const ws=new Set(w.split('').map(c=>c.charCodeAt(0)-65)); let sf=300,first=true;
    while(global.__state().active&&sf-->0){
      const st=global.__state(); const pls=global.__pls();
      if(pls){ if(first){tick0.push(pls.slice());first=false;} for(let l=0;l<26;l++){ if(st.tried[l])continue; if(ws.has(l)){inSum+=pls[l];inN++;}else{outSum+=pls[l];outN++;} } }
      global.__step();
    }
  }
  const inM=inSum/Math.max(1,inN), outM=outSum/Math.max(1,outN);
  let crossVar=0; if(tick0.length){ for(let l=0;l<26;l++){let m=0;for(const v of tick0)m+=v[l];m/=tick0.length;let s=0;for(const v of tick0)s+=(v[l]-m)*(v[l]-m);crossVar+=s/tick0.length;} crossVar/=26; }

  console.log(`\n=== DIAGNOSTIC phon DESCENDANT — M4_phon_m.letterPenalty (cognition, warmup ${warmupN}/test ${testN}, seed ${seed}) ===\n`);
  console.log(`(1) DISCRIMINATION du mot : score-like(1−lp) in-word ${inM.toFixed(4)} · out-word ${outM.toFixed(4)} · GAP ${(inM-outM>=0?'+':'')}${(inM-outM).toFixed(4)}`);
  console.log(`(2) variance de (1−lp)[l] ENTRE mots au tick 0 = ${crossVar.toExponential(2)}  ${crossVar<1e-4?'(≈0 ⇒ vecteur GLOBAL : même biais quel que soit le mot)':'(varie selon le mot)'}`);
  console.log(`\nLecture : si GAP ≈ 0 et variance ≈ 0 → le miroir phon DESCENDANT est lui aussi un BIAIS GLOBAL (comme M1_m).`);
  console.log(`Alors le seul levier phon→ortho spécifique au mot est l'ASCENDANT (assemblé NEO), pas la correction descendante.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
