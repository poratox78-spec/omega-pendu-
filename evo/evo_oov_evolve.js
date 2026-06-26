'use strict';
// EVO — CONFIRMATION OOV : le gène arbConf (M_NEO_OS_ARB_CONF) a donné +12,7 pts sur seed 12345 (64→76,7%). Est-ce ROBUSTE
// ou sur-appris à cette graine ? Test HORS ÉCHANTILLON : on fixe la valeur évoluée (0,30, choisie sur 12345) et on la teste
// sur 5 AUTRES seeds vs la référence (arbConf 0). Config OS_ARB (la meilleure), caches invalidés. Si le gain tient → vraie
// évolution OOV (là où l'in-lex était saturé). Usage : node evo/evo_oov_evolve.js
const { loadEngine } = require('./fitness_harness.js');

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
  ev(`globalThis.__oovGene=function(seed,arbConf){
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
    OMEGA_LEX4.len_index=__oov.filtered; _neoWBL=null; _neoNG=null;
    let win=0; for(let i=0;i<__oov.testW.length;i++){ if(play(__oov.testW[i])) win++; }
    OMEGA_LEX4.len_index=__oov.origLI; _neoWBL=null; _neoNG=null;
    return +(100*win/__oov.testW.length).toFixed(1);
  };`);

  const TESTN=150, WARM=180, EVOLVED=0.30;     // valeur choisie sur seed 12345 (NON re-tunée ici)
  const seeds=[7,101,333,888,1500];            // 5 graines NOUVELLES (out-of-sample)
  console.log(`\n=== EVO — CONFIRMATION OOV hors échantillon · arbConf=${EVOLVED} (évolué sur seed 12345) vs réf 0 · ${TESTN} mots OOV × ${seeds.length} seeds ===\n`);
  console.log(`  seed │ réf (arbConf 0) │ évolué (arbConf ${EVOLVED}) │ Δ`);
  const rows=[];
  for(const sd of seeds){ ev(`__oovSetup(${sd},${TESTN},${WARM})`);
    const ref=ev(`__oovGene(${sd},0.0)`), evd=ev(`__oovGene(${sd},${EVOLVED})`);
    const d=+(evd-ref).toFixed(1); rows.push({sd,ref,evd,d});
    console.log(`  ${String(sd).padStart(4)} │     ${ref.toFixed(1)} %      │      ${evd.toFixed(1)} %       │ ${d>=0?'+':''}${d}`); }
  const ds=rows.map(r=>r.d), mean=ds.reduce((a,b)=>a+b,0)/ds.length, sd=Math.sqrt(ds.reduce((a,b)=>a+(b-mean)*(b-mean),0)/ds.length);
  const wins=rows.filter(r=>r.d>0.5).length;
  console.log(`\n  Δ moyen = ${mean>=0?'+':''}${mean.toFixed(2)} pt (écart-type ${sd.toFixed(2)}) · évolué gagne ${wins}/${seeds.length} seeds`);
  const robust = mean>3 && wins>=seeds.length-1 && mean>sd;
  let verdict;
  if(robust) verdict=`✅ GAIN OOV ROBUSTE — l'évolution paie HORS ÉCHANTILLON`;
  else if(mean>1) verdict=`≈ gain réel mais plus petit / variable que sur seed 12345`;
  else verdict=`❌ ne tient pas — c'était sur-appris à seed 12345`;
  console.log(`  → ${verdict}`);
  console.log(`  → honnête : arbConf monte le winrate OOV moyen de ${mean.toFixed(1)} pt sur des graines NON utilisées pour le choisir.${mean>3?' Première vraie évolution OOV mesurée.':''}`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
