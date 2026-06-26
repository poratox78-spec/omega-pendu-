'use strict';
// EVO — QUELLE CONFIG OOV ? (réponse au pointeur de Rem : « OOV a des toggles spécifiques »). On compare les variantes
// documentées (CONFIG_TOGGLES §6) : cascade LETTER_NGRAM vs OS_ARB_NGRAM vs +GAP vs +C_HEAVY, sur 120 mots hors-lexique,
// avec INVALIDATION EXPLICITE des caches cohorte/n-gram au swap (OOV honnête, pas de fuite _neoWBL). But : trouver la
// MEILLEURE config OOV (la bande doc = 52-65 %) avant de faire évoluer le génome dessus. Usage : node evo/evo_oov_configs.js
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

  // c = {ngram, osarb, gap, cheavy, conf, alpha, beta}
  ev(`globalThis.__oovRunCfg=function(seed,c){
    _omegaSeed=seed;_omegaRng=makeMulberry32(seed);initOmegaGlobals();
    if(typeof _omega_OSL_reset==='function')_omega_OSL_reset(); if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}
    L01_A4_M4M_DECOMP_ENABLED=true;L01_A5_M2M_POSITIONAL_ENABLED=true;L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true;L01_B2_MOBIUS_ENABLED=true;M_OS_V07_ENABLED=true;M_SUBSTRAT_ORTHO_PURE_ENABLED=true;M_BPC_M3D_ENABLED=true;M_BPC_READOUT_COUPLE_ENABLED=true;M_OS_LEARNING_ONLINE_ENABLED=true;M_OS_LEARNING_GUARD_1_BOUNDED=true;M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true;M_OS_LEARNING_GUARD_3_MDL_REGUL=true;M_OS_LEARNING_GUARD_4_COHERENCE=true;
    M_VOIE_PHON_ENABLED=false;M4_PHON_USE_P_ENABLED=false;M_PHON_FEEDBACK_ENABLED=false;M_PHON_READOUT_COUPLE_ENABLED=false;M_PHON_CONCEPT_BIND_ENABLED=false;
    M_DECLARE_NEO_ENABLED=true;M_NEO_RECALL_ENABLED=true;M_NEO_ASSEMBLED_ENABLED=true;M_NEO_COHORT_ENABLED=true;M_NEO_PHON_COHORT_ENABLED=false;M_NEO_MUTE_ENABLED=false;M_NEO_TRIGGER_ENABLED=false;M_EMERGENT_DECLARE_ENABLED=true;
    M_NEO_LETTER_NGRAM=!!c.ngram;
    M_NEO_OS_ARB=!!c.osarb; M_NEO_OS_ARB_NGRAM=!!c.osarb;
    M_NEO_NGRAM_GAP=!!c.gap;
    if(typeof M_NEO_C_HEAVY!=='undefined') M_NEO_C_HEAVY=!!c.cheavy;
    if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=M_NEO_OS_ARB_ALPHA=(c.alpha!=null?c.alpha:1);M_OS_v07.beta=M_NEO_OS_ARB_BETA=(c.beta!=null?c.beta:1);}
    if(typeof M_DECLARE_NEO_CONF!=='undefined'&&c.conf!=null)M_DECLARE_NEO_CONF=c.conf;
    function play(w){startNewGame(w);let sf=300;while(gameActive&&sf-->0)omegaStep();return lastGameWon;}
    OMEGA_LEX4.len_index=__oov.origLI; _neoWBL=null; _neoNG=null; _omegaRng=makeMulberry32(seed);
    for(let i=0;i<__oov.trainW.length;i++)play(__oov.trainW[i]);
    OMEGA_LEX4.len_index=__oov.filtered; _neoWBL=null; _neoNG=null;        // <-- INVALIDATION EXPLICITE : cohorte/n-gram rebâtis SANS les mots de test
    let win=0; for(let i=0;i<__oov.testW.length;i++){ if(play(__oov.testW[i])) win++; }
    OMEGA_LEX4.len_index=__oov.origLI; _neoWBL=null; _neoNG=null;
    return +(100*win/__oov.testW.length).toFixed(1);
  };`);

  const SEED=12345, TESTN=120, WARM=180;
  const setup=ev(`__oovSetup(${SEED},${TESTN},${WARM})`);
  console.log(`\n=== EVO — COMPARAISON CONFIGS OOV · ${setup.test} mots hors-lexique, warmup ${setup.train}, seed ${SEED}, caches invalidés au swap ===\n`);
  const configs=[
    {name:'OS_ARB + GAP (mon osngGap)',      c:{osarb:1,gap:1}},
    {name:'cascade LETTER_NGRAM + GAP',      c:{ngram:1,gap:1}},
    {name:'cascade LETTER_NGRAM seul',       c:{ngram:1}},
    {name:'OS_ARB seul (sans gap)',          c:{osarb:1}},
    {name:'OS_ARB + GAP + C_HEAVY',          c:{osarb:1,gap:1,cheavy:1}},
    {name:'OS_ARB + GAP, β=1.6 (sublex++)',  c:{osarb:1,gap:1,beta:1.6}},
  ];
  const res=[];
  for(const cf of configs){ const wr=ev(`__oovRunCfg(${SEED},${JSON.stringify(cf.c)})`); res.push({...cf,wr});
    console.log(`  ${cf.name.padEnd(34)} : ${wr.toFixed(1)} %`); }
  const best=res.reduce((a,b)=>b.wr>a.wr?b:a,res[0]); const mn=Math.min(...res.map(r=>r.wr)), mx=Math.max(...res.map(r=>r.wr));
  console.log(`\n  → meilleure config OOV : ${best.name} = ${best.wr} %  (bande doc §6 attendue : 52-65 %)`);
  console.log(`  spread entre configs : ${(mx-mn).toFixed(1)} pts (min ${mn} → max ${mx})`);
  console.log(`  → ${mx>=58?'✅ on retrouve la bande doc — ma réplication tient ; la config compte (toggles), pas un bug.':mx<55?'⚠️ tout reste bas (~'+mx+'%) : soit petit échantillon, soit un toggle OOV manque encore.':'≈ milieu de bande.'}`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
