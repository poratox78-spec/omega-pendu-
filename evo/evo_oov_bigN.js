'use strict';
// EVO — OOV GROS N : l'absolu ~75-79 % (au-dessus du SOTA 65-68 %) tient-il à plus grande échelle, ou régresse-t-il vers la
// bande ? On refait arbConf 0 vs 0,30 (config OS_ARB) en OOV sur 350 mots × 2 seeds. Seul juge de l'AFFIRMATION absolue.
// node evo/evo_oov_bigN.js
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

  const TESTN=350, WARM=250, seeds=[12345,7];
  console.log(`\n=== EVO — OOV GROS N · arbConf 0 vs 0,30 · ${TESTN} mots hors-lexique × ${seeds.length} seeds ===\n`);
  console.log(`  seed │ réf (0) │ évolué (0,30) │ Δ`);
  const R=[],E=[];
  for(const sd of seeds){ ev(`__oovSetup(${sd},${TESTN},${WARM})`);
    const r=ev(`__oovGene(${sd},0.0)`), e=ev(`__oovGene(${sd},0.30)`); R.push(r);E.push(e);
    console.log(`  ${String(sd).padStart(5)} │ ${r.toFixed(1)} % │   ${e.toFixed(1)} %    │ ${e-r>=0?'+':''}${(e-r).toFixed(1)}`); }
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length, mR=avg(R), mE=avg(E), d=mE-mR;
  console.log(`\n  moyenne : réf ${mR.toFixed(1)} % → évolué ${mE.toFixed(1)} %  (Δ ${d>=0?'+':''}${d.toFixed(1)} pt) sur ${TESTN} mots`);
  let v;
  if(mE>=72) v=`✅ l'absolu TIENT à gros N (~${mE.toFixed(0)} %, au-dessus de la bande SOTA 65-68%) — surprenant, mérite un œil externe, mais ça ne s'effondre pas.`;
  else if(mE>=66) v=`≈ l'absolu RÉGRESSE vers le haut de la bande (~${mE.toFixed(0)} %), dans le SOTA. Le gain Δ ${d>=0?'+':''}${d.toFixed(1)} reste, mais l'absolu était optimiste sur petit N.`;
  else v=`⚠️ l'absolu retombe dans/sous la bande (~${mE.toFixed(0)} %) ; le petit N gonflait. Le gain relatif Δ ${d>=0?'+':''}${d.toFixed(1)} est le vrai résultat.`;
  console.log(`  → ${v}`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
