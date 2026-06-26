'use strict';
// EVO — SONDE OOV (trexquant) : y a-t-il de la PLACE pour évoluer hors-lexique ? On reproduit FIDÈLEMENT la méthodo du
// bench moteur (_omega_trexquant_bench, l.9499-9519) : config cheat-free intégrale (son OFF) + NEO assemblé + n-gram
// ARBITRÉ OS + GAP-AWARE ; warmup sur lexique plein, puis test sur lexique AMPUTÉ des mots de test (vrai OOV). On fait
// VARIER le génome (NEO_CONF, α/β de l'arbitrage sub↔lex) et on regarde si le winrate OOV BOUGE (≠ saturé in-lex).
// Si oui → il y a de la marge pour P3/O1 en OOV. Usage : node evo/evo_oov_probe.js
const { loadEngine } = require('./fitness_harness.js');

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn;
  ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`);

  // setup OOV : tire test/warmup, ampute le len_index (réplique exacte du bench)
  ev(`globalThis.__oovSetup=function(seed,testN,warmupN){
    const W=OMEGA_LEX4.words, valid=[];
    for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&m.length>=7&&m.length<=12&&/^[A-Z]+$/.test(m)) valid.push(i);}
    let r=(seed>>>0); const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
    for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
    const testIdx=valid.slice(0,testN), trainIdx=valid.slice(testN,testN+warmupN);
    const testSet=new Set(testIdx); const origLI=OMEGA_LEX4.len_index; const filtered={};
    for(const k in origLI) filtered[k]=origLI[k].filter(id=>!testSet.has(id));
    globalThis.__oov={origLI,filtered,trainW:trainIdx.map(i=>W[i].m),testW:testIdx.map(i=>W[i].m)};
    return {test:__oov.testW.length, train:__oov.trainW.length};
  };`);

  // run OOV avec un génome (conf, alpha, beta) — réplique runCond(osngGap) avec params variables
  ev(`globalThis.__oovRun=function(seed,conf,alpha,beta){
    _omegaSeed=seed;_omegaRng=makeMulberry32(seed);initOmegaGlobals();
    if(typeof _omega_OSL_reset==='function')_omega_OSL_reset(); if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}
    L01_A4_M4M_DECOMP_ENABLED=true;L01_A5_M2M_POSITIONAL_ENABLED=true;L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true;L01_B2_MOBIUS_ENABLED=true;M_OS_V07_ENABLED=true;M_SUBSTRAT_ORTHO_PURE_ENABLED=true;M_BPC_M3D_ENABLED=true;M_BPC_READOUT_COUPLE_ENABLED=true;M_OS_LEARNING_ONLINE_ENABLED=true;M_OS_LEARNING_GUARD_1_BOUNDED=true;M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true;M_OS_LEARNING_GUARD_3_MDL_REGUL=true;M_OS_LEARNING_GUARD_4_COHERENCE=true;
    M_VOIE_PHON_ENABLED=false;M4_PHON_USE_P_ENABLED=false;M_PHON_FEEDBACK_ENABLED=false;M_PHON_READOUT_COUPLE_ENABLED=false;M_PHON_CONCEPT_BIND_ENABLED=false;
    M_DECLARE_NEO_ENABLED=true;M_NEO_RECALL_ENABLED=true;M_NEO_ASSEMBLED_ENABLED=true;M_NEO_COHORT_ENABLED=true;M_NEO_PHON_COHORT_ENABLED=false;M_NEO_MUTE_ENABLED=false;M_NEO_TRIGGER_ENABLED=false;M_EMERGENT_DECLARE_ENABLED=true;
    M_NEO_LETTER_NGRAM=false;M_NEO_OS_ARB=true;M_NEO_OS_ARB_NGRAM=true;M_NEO_NGRAM_GAP=true;
    if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=M_NEO_OS_ARB_ALPHA=alpha;M_OS_v07.beta=M_NEO_OS_ARB_BETA=beta;}
    if(typeof M_DECLARE_NEO_CONF!=='undefined')M_DECLARE_NEO_CONF=conf;
    function play(w){startNewGame(w);let sf=300;while(gameActive&&sf-->0)omegaStep();return lastGameWon;}
    OMEGA_LEX4.len_index=__oov.origLI;_omegaRng=makeMulberry32(seed);for(let i=0;i<__oov.trainW.length;i++)play(__oov.trainW[i]);
    OMEGA_LEX4.len_index=__oov.filtered;let win=0;for(let i=0;i<__oov.testW.length;i++){if(play(__oov.testW[i]))win++;}
    OMEGA_LEX4.len_index=__oov.origLI;
    return +(100*win/__oov.testW.length).toFixed(1);
  };`);

  const SEED=12345, TESTN=70, WARM=250;
  const setup=ev(`__oovSetup(${SEED},${TESTN},${WARM})`);
  const genomes=[
    {n:'BASELINE (conf .60, α1 β1)', c:0.60,a:1.0,b:1.0},
    {n:'conf .45',                   c:0.45,a:1.0,b:1.0},
    {n:'conf .75',                   c:0.75,a:1.0,b:1.0},
    {n:'sub++ (α1.6 β0.6)',          c:0.60,a:1.6,b:0.6},
    {n:'lex++ (α0.6 β1.6)',          c:0.60,a:0.6,b:1.6},
    {n:'conf .50 + sub++',           c:0.50,a:1.6,b:0.6},
  ];
  console.log(`\n=== EVO — SONDE OOV (trexquant) · ${setup.test} mots hors-lexique, warmup ${setup.train}, seed ${SEED}, budget 6 ===`);
  console.log(`question : le winrate OOV BOUGE-t-il avec le génome ? (en lexique il est saturé ~97% → Δ≈0)\n`);
  const res=[];
  for(const g of genomes){ const wr=ev(`__oovRun(${SEED},${g.c},${g.a},${g.b})`); res.push({...g,wr});
    console.log(`  ${g.n.padEnd(30)} : ${wr.toFixed(1)} %`); }
  const wrs=res.map(r=>r.wr), mn=Math.min(...wrs), mx=Math.max(...wrs), spread=+(mx-mn).toFixed(1);
  const best=res.reduce((a,b)=>b.wr>a.wr?b:a,res[0]);
  console.log(`\n  baseline OOV ≈ ${res[0].wr.toFixed(1)} %  (repère bench cheat-free : ~64 %, bons solveurs 65-68 %)`);
  console.log(`  SPREAD entre génomes : ${spread} pts  (min ${mn} → max ${mx})  ·  meilleur : ${best.n} (${best.wr}%)`);
  const room = spread>=3;
  console.log(`\n  → ${room?'✅ IL Y A DE LA PLACE':'≈ peu de place'} : le génome fait ${room?'bouger':'à peine bouger'} le winrate OOV de ${spread} pts.`);
  if(room) console.log(`    → la marge existe (contrairement à l'in-lex saturé) : ça vaut le coup d'y faire évoluer P3 et de re-tester O1 en OOV.`);
  else      console.log(`    → même hors-lexique, le génome ne change pas grand-chose ici ; l'évolution n'aurait pas plus de prise.`);
  console.log(`  (honnête : 1 seed pour cette sonde. Si la place existe, on confirmera sur plusieurs seeds avant de conclure.)`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
