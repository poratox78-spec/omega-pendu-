'use strict';
// EVO — CAPTURE OOV pour le visuel : produit un JSON fidèle (vrai omegaStep) avec (1) le LEVIER (sweep arbConf sur 1 seed),
// (2) la ROBUSTESSE out-of-sample (ref vs évolué sur seeds neuves), (3) le PARETO (OOV vs in-lex). Aucun chiffre inventé.
// Réutilise la méthodo validée (config OS_ARB, caches invalidés au swap). Usage : node evo/evo_oov_capture.js
const { loadEngine } = require('./fitness_harness.js');
const fs=require('fs'), path=require('path');

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn;
  ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`);
  ev(`globalThis.__oovSetup=function(seed,testN,warmupN){
    const W=OMEGA_LEX4.words, valid=[];
    for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&m.length>=7&&m.length<=12&&/^[A-Z]+$/.test(m)) valid.push(i);}
    let r=(seed>>>0); const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
    for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
    const testIdx=valid.slice(0,testN), trainIdx=valid.slice(testN,testN+warmupN);
    const testSet=new Set(testIdx); const origLI=OMEGA_LEX4.len_index; const filtered={};
    for(const k in origLI) filtered[k]=origLI[k].filter(id=>!testSet.has(id));
    globalThis.__oov={origLI,filtered,trainW:trainIdx.map(i=>W[i].m),testW:testIdx.map(i=>W[i].m)};
    return __oov.testW.length;
  };`);
  ev(`globalThis.__oovGene=function(seed,arbConf,oov){
    _omegaSeed=seed;_omegaRng=makeMulberry32(seed);initOmegaGlobals();
    if(typeof _omega_OSL_reset==='function')_omega_OSL_reset(); if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}
    L01_A4_M4M_DECOMP_ENABLED=true;L01_A5_M2M_POSITIONAL_ENABLED=true;L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true;L01_B2_MOBIUS_ENABLED=true;M_OS_V07_ENABLED=true;M_SUBSTRAT_ORTHO_PURE_ENABLED=true;M_BPC_M3D_ENABLED=true;M_BPC_READOUT_COUPLE_ENABLED=true;M_OS_LEARNING_ONLINE_ENABLED=true;M_OS_LEARNING_GUARD_1_BOUNDED=true;M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true;M_OS_LEARNING_GUARD_3_MDL_REGUL=true;M_OS_LEARNING_GUARD_4_COHERENCE=true;
    M_VOIE_PHON_ENABLED=false;M4_PHON_USE_P_ENABLED=false;M_PHON_FEEDBACK_ENABLED=false;M_PHON_READOUT_COUPLE_ENABLED=false;M_PHON_CONCEPT_BIND_ENABLED=false;
    M_DECLARE_NEO_ENABLED=true;M_NEO_RECALL_ENABLED=true;M_NEO_ASSEMBLED_ENABLED=true;M_NEO_COHORT_ENABLED=true;M_NEO_PHON_COHORT_ENABLED=false;M_NEO_MUTE_ENABLED=false;M_NEO_TRIGGER_ENABLED=false;M_EMERGENT_DECLARE_ENABLED=true;
    M_NEO_LETTER_NGRAM=false; M_NEO_OS_ARB=true; M_NEO_OS_ARB_NGRAM=true; M_NEO_NGRAM_GAP=false;
    if(typeof M_NEO_C_HEAVY!=='undefined') M_NEO_C_HEAVY=false;
    if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=M_NEO_OS_ARB_ALPHA=1;M_OS_v07.beta=M_NEO_OS_ARB_BETA=1;}
    if(typeof M_NEO_OS_ARB_CONF!=='undefined')M_NEO_OS_ARB_CONF=arbConf;
    function play(w){startNewGame(w);let sf=300;while(gameActive&&sf-->0)omegaStep();return lastGameWon;}
    OMEGA_LEX4.len_index=__oov.origLI; _neoWBL=null; _neoNG=null; _omegaRng=makeMulberry32(seed);
    for(let i=0;i<__oov.trainW.length;i++)play(__oov.trainW[i]);
    OMEGA_LEX4.len_index=(oov?__oov.filtered:__oov.origLI); _neoWBL=null; _neoNG=null;
    let win=0; for(let i=0;i<__oov.testW.length;i++){ if(play(__oov.testW[i])) win++; }
    OMEGA_LEX4.len_index=__oov.origLI; _neoWBL=null; _neoNG=null;
    return +(100*win/__oov.testW.length).toFixed(1);
  };`);

  const TESTN=120, WARM=150, EVO=0.30;
  // (1) LEVIER : sweep arbConf sur seed 12345 (OOV)
  ev(`__oovSetup(12345,${TESTN},${WARM})`);
  const arbConfs=[0,0.15,0.30,0.45]; const sweep=arbConfs.map(a=>({arbConf:a, oov:ev(`__oovGene(12345,${a},true)`)}));
  // (3) PARETO sur seed 12345 : in-lex ref/évolué (OOV ref/évolué = sweep[0]/sweep[2])
  const inlexRef=ev(`__oovGene(12345,0.0,false)`), inlexEvo=ev(`__oovGene(12345,${EVO},false)`);
  // (2) OUT-OF-SAMPLE : seeds neuves, ref vs évolué (OOV)
  const osSeeds=[7,101,333]; const oos=[];
  for(const sd of osSeeds){ ev(`__oovSetup(${sd},${TESTN},${WARM})`);
    oos.push({seed:sd, ref:ev(`__oovGene(${sd},0.0,true)`), evolved:ev(`__oovGene(${sd},${EVO},true)`)}); }
  const allRef=[sweep[0].oov,...oos.map(o=>o.ref)], allEvo=[sweep[2].oov,...oos.map(o=>o.evolved)];
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;

  const out={ meta:{ phase:'P3 — générations, régime OOV (le relief)', what:'sélection sur le génome param en hors-lexique (Trexquant), là où OMEGA n\'est pas au plafond',
      gene:'M_NEO_OS_ARB_CONF', evolvedValue:EVO, config:'OS_ARB seul', testN:TESTN, warmup:WARM, fidelity:'100% omegaStep, caches invalidés au swap' },
    ceilingInlex:97,
    sweep,                                   // le levier : arbConf monte → winrate OOV monte
    pareto:{ seed:12345, oovRef:sweep[0].oov, oovEvolved:sweep[2].oov, inlexRef, inlexEvolved:inlexEvo },
    outOfSample:{ seeds:osSeeds, rows:oos, meanRef:+mean(allRef).toFixed(1), meanEvolved:+mean(allEvo).toFixed(1), meanDelta:+(mean(allEvo)-mean(allRef)).toFixed(1), nSeeds:allRef.length } };
  fs.writeFileSync(path.join(__dirname,'oov_capture.json'), JSON.stringify(out));
  console.log(`\n=== EVO — CAPTURE OOV → evo/oov_capture.json ===`);
  console.log(`levier arbConf (seed 12345, OOV) : ${sweep.map(s=>s.arbConf+'→'+s.oov+'%').join('  ')}`);
  console.log(`pareto (seed 12345) : OOV ${out.pareto.oovRef}→${out.pareto.oovEvolved}  ·  in-lex ${inlexRef}→${inlexEvo}`);
  console.log(`out-of-sample (${osSeeds.join(',')}) : réf moy ${out.outOfSample.meanRef}% → évolué ${out.outOfSample.meanEvolved}%  (Δ +${out.outOfSample.meanDelta}, ${out.outOfSample.nSeeds} seeds)`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
