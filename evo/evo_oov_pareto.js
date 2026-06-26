'use strict';
// EVO — PARETO ou TRADE-OFF ? Le gène arbConf=0,30 gagne +14 pts en OOV. Le paie-t-il en lexique ? On mesure le MÊME gène
// (M_NEO_OS_ARB_CONF 0 vs 0,30, config OS_ARB) en OOV (mots retirés) ET in-lex (mots gardés), sur 3 seeds. Si OOV monte et
// in-lex ne bouge pas → vrai PARETO (rare et fort). Si in-lex chute → trade-off (honnête à dire). Usage : node evo/evo_oov_pareto.js
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
  // oov=true → test sur lexique amputé ; oov=false → test sur lexique plein (in-lex)
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

  const TESTN=100, WARM=150, A=0.30, seeds=[12345,7,101];
  console.log(`\n=== EVO — PARETO ? gène arbConf 0 vs ${A} · OOV vs IN-LEX · ${TESTN} mots × ${seeds.length} seeds ===\n`);
  console.log(`  seed │   OOV réf → évolué (Δ)   │   in-lex réf → évolué (Δ)`);
  const oR=[],oE=[],iR=[],iE=[];
  for(const sd of seeds){ ev(`__oovSetup(${sd},${TESTN},${WARM})`);
    const or=ev(`__oovGene(${sd},0.0,true)`), oe=ev(`__oovGene(${sd},${A},true)`),
          ir=ev(`__oovGene(${sd},0.0,false)`), ie=ev(`__oovGene(${sd},${A},false)`);
    oR.push(or);oE.push(oe);iR.push(ir);iE.push(ie);
    console.log(`  ${String(sd).padStart(5)} │  ${or.toFixed(1)} → ${oe.toFixed(1)} (${oe-or>=0?'+':''}${(oe-or).toFixed(1)})   │  ${ir.toFixed(1)} → ${ie.toFixed(1)} (${ie-ir>=0?'+':''}${(ie-ir).toFixed(1)})`); }
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const dOOV=avg(oE)-avg(oR), dILX=avg(iE)-avg(iR);
  console.log(`\n  Δ OOV moyen    : ${dOOV>=0?'+':''}${dOOV.toFixed(1)} pt`);
  console.log(`  Δ in-lex moyen : ${dILX>=0?'+':''}${dILX.toFixed(1)} pt`);
  let v;
  if(dOOV>3 && dILX>=-1) v=`✅ PARETO : +${dOOV.toFixed(1)} OOV sans rien perdre en lexique (${dILX>=0?'+':''}${dILX.toFixed(1)}). Le gène est un gain NET.`;
  else if(dOOV>3 && dILX<-1) v=`⚖️ TRADE-OFF honnête : +${dOOV.toFixed(1)} OOV mais ${dILX.toFixed(1)} in-lex. À dire tel quel.`;
  else v=`~ effet faible/mitigé : OOV ${dOOV.toFixed(1)}, in-lex ${dILX.toFixed(1)}.`;
  console.log(`  → ${v}`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
