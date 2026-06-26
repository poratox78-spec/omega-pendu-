'use strict';
// EVO — GÈNES OOV : sur la MEILLEURE config OOV trouvée (OS_ARB seul, ~63 %), le génome a-t-il de la PRISE ? On sweepe
// les vrais leviers de l'arbitrage sublexical↔lexical : β (favorise sub si >1), α (raideur), M_NEO_OS_ARB_CONF (seuil),
// M_DECLARE_NEO_CONF. Si le winrate OOV BOUGE → il y a de quoi évoluer (contrairement à l'in-lex saturé). 1 seed d'abord
// (puis multi-seed si prometteur). Caches invalidés au swap (OOV honnête). Usage : node evo/evo_oov_genes.js
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
    return {test:__oov.testW.length, train:__oov.trainW.length};
  };`);

  // config OS_ARB seul (gap OFF) + génome {alpha,beta,arbConf,conf}
  ev(`globalThis.__oovGene=function(seed,g){
    _omegaSeed=seed;_omegaRng=makeMulberry32(seed);initOmegaGlobals();
    if(typeof _omega_OSL_reset==='function')_omega_OSL_reset(); if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}
    L01_A4_M4M_DECOMP_ENABLED=true;L01_A5_M2M_POSITIONAL_ENABLED=true;L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true;L01_B2_MOBIUS_ENABLED=true;M_OS_V07_ENABLED=true;M_SUBSTRAT_ORTHO_PURE_ENABLED=true;M_BPC_M3D_ENABLED=true;M_BPC_READOUT_COUPLE_ENABLED=true;M_OS_LEARNING_ONLINE_ENABLED=true;M_OS_LEARNING_GUARD_1_BOUNDED=true;M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true;M_OS_LEARNING_GUARD_3_MDL_REGUL=true;M_OS_LEARNING_GUARD_4_COHERENCE=true;
    M_VOIE_PHON_ENABLED=false;M4_PHON_USE_P_ENABLED=false;M_PHON_FEEDBACK_ENABLED=false;M_PHON_READOUT_COUPLE_ENABLED=false;M_PHON_CONCEPT_BIND_ENABLED=false;
    M_DECLARE_NEO_ENABLED=true;M_NEO_RECALL_ENABLED=true;M_NEO_ASSEMBLED_ENABLED=true;M_NEO_COHORT_ENABLED=true;M_NEO_PHON_COHORT_ENABLED=false;M_NEO_MUTE_ENABLED=false;M_NEO_TRIGGER_ENABLED=false;M_EMERGENT_DECLARE_ENABLED=true;
    M_NEO_LETTER_NGRAM=false; M_NEO_OS_ARB=true; M_NEO_OS_ARB_NGRAM=true; M_NEO_NGRAM_GAP=false;
    if(typeof M_NEO_C_HEAVY!=='undefined') M_NEO_C_HEAVY=false;
    if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=M_NEO_OS_ARB_ALPHA=g.alpha;M_OS_v07.beta=M_NEO_OS_ARB_BETA=g.beta;}
    if(typeof M_NEO_OS_ARB_CONF!=='undefined')M_NEO_OS_ARB_CONF=g.arbConf;
    if(typeof M_DECLARE_NEO_CONF!=='undefined')M_DECLARE_NEO_CONF=g.conf;
    function play(w){startNewGame(w);let sf=300;while(gameActive&&sf-->0)omegaStep();return lastGameWon;}
    OMEGA_LEX4.len_index=__oov.origLI; _neoWBL=null; _neoNG=null; _omegaRng=makeMulberry32(seed);
    for(let i=0;i<__oov.trainW.length;i++)play(__oov.trainW[i]);
    OMEGA_LEX4.len_index=__oov.filtered; _neoWBL=null; _neoNG=null;
    let win=0; for(let i=0;i<__oov.testW.length;i++){ if(play(__oov.testW[i])) win++; }
    OMEGA_LEX4.len_index=__oov.origLI; _neoWBL=null; _neoNG=null;
    return +(100*win/__oov.testW.length).toFixed(1);
  };`);

  const SEED=12345, TESTN=150, WARM=180;
  const setup=ev(`__oovSetup(${SEED},${TESTN},${WARM})`);
  const D={alpha:1.0,beta:1.0,arbConf:0.0,conf:0.60};   // génome de référence (OS_ARB défaut)
  const g=o=>Object.assign({},D,o);
  const genomes=[
    {n:'référence (α1 β1 conf.60 arb0)', g:g({})},
    {n:'β0.5 (lex++)',  g:g({beta:0.5})}, {n:'β1.5 (sub++)', g:g({beta:1.5})}, {n:'β2.0', g:g({beta:2.0})}, {n:'β3.0', g:g({beta:3.0})},
    {n:'α0.5',          g:g({alpha:0.5})}, {n:'α2.0', g:g({alpha:2.0})},
    {n:'conf .45',      g:g({conf:0.45})}, {n:'conf .75', g:g({conf:0.75})},
    {n:'arbConf .15',   g:g({arbConf:0.15})}, {n:'arbConf .30', g:g({arbConf:0.30})},
    {n:'β2.0 + arbConf.15', g:g({beta:2.0,arbConf:0.15})},
  ];
  console.log(`\n=== EVO — GÈNES OOV sur la config OS_ARB (~63%) · ${setup.test} mots hors-lexique, warmup ${setup.train}, seed ${SEED} ===\n`);
  const res=[];
  for(const it of genomes){ const wr=ev(`__oovGene(${SEED},${JSON.stringify(it.g)})`); res.push({...it,wr});
    console.log(`  ${it.n.padEnd(32)} : ${wr.toFixed(1)} %`); }
  const wrs=res.map(r=>r.wr), mn=Math.min(...wrs), mx=Math.max(...wrs), spread=+(mx-mn).toFixed(1);
  const best=res.reduce((a,b)=>b.wr>a.wr?b:a,res[0]); const ref=res[0].wr;
  console.log(`\n  référence : ${ref} %  ·  SPREAD du génome : ${spread} pts (min ${mn} → max ${mx})  ·  meilleur : ${best.n} (${best.wr}%)`);
  const room = spread>=4;
  console.log(`  → ${room?'✅ LE GÉNOME A DE LA PRISE EN OOV':'≈ peu de prise'} : ${spread} pts d'écart (vs ~0 en in-lex saturé, vs 1,4 sur la mauvaise config).`);
  if(room) console.log(`    → ça vaut le coup d'évoluer ce génome en OOV, PUIS de confirmer sur plusieurs seeds (gain ${best.n}: ${(best.wr-ref).toFixed(1)} pt vs réf).`);
  else      console.log(`    → même sur la bonne config OOV, l'arbitrage ne déplace pas la compétence ; la généralisation vient de l'agrégat figé du lexique, pas de params réglables.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
