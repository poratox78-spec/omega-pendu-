// OMEGA — TEST VALIDE du C lourd : WINRATE dans le VRAI moteur à CONFIG OPTIMALE (AUDIT §1.12).
// Réponse à la critique « tes tests sont caducs : top-1 sur masques aléatoires, hors pipeline, hors config optimale ».
// Ici : on câble le C lourd comme VOIE SUBLEXICALE de l'arbitrage OS (M_NEO_C_HEAVY, remplace le n-gram gap-aware),
// on tourne la CONFIG OPTIMALE de référence (CFG_INLEX/CFG_OOV, mêmes que ab_cohort.js / CONFIG_REFERENCE.md), et on
// mesure le WINRATE sur de VRAIES parties (startNewGame/omegaStep) — voie gap vs voie C — in-lexique ET OOV séparés (§1),
// multi-graines (§6.4). Les états de board sont ceux du jeu réel (le moteur appelle _neoHeavyCDist en cours de partie).
//
// Réutilise (§5) : loadEngine + evalIn (fitness_harness), le protocole runCond/pickSets (miroir de ab_cohort.js).
// Usage : node evo/heavy_c_winrate.js <poids.json> [warmupN] [testN] [seeds]   (défaut 200/100/12345,777,2024)
'use strict';
const fs=require('fs');
const { loadEngine } = require('./fitness_harness.js');

// Config optimale de référence — RECOPIÉE de evo/ab_cohort.js (CONFIG_REFERENCE.md). + arbitrage OS n-gram (§1.9).
const CFG_INLEX = [
  'L01_A1_M2_ORTHO_ENABLED=false','L01_A2_M4_LEX4_ENABLED=false','L01_A3_M5M_WORDLEX4_ENABLED=false','L01_B2_MOBIUS_ENABLED=false',
  'M_WORD_DECLARE_ENABLED=false','M_IG_SELECT_ENABLED=false','M_IG_PSUCCESS_ENABLED=false','M_BPC_DECLARE_ENABLED=false',
  'M_DECLARE_DUAL_ENABLED=false','M_LEARN_FROM_COGNITION_ENABLED=false','M_OS_LEARNING_ONLINE_ENABLED=false',
  'M_EMERGENT_DECLARE_ENABLED=false','M_EMERGENT_ASSEMBLED_ENABLED=false','M_EMERGENT_G2P_ONLINE=false',
  'M_NEO_MUTE_ENABLED=false','M_NEO_TRIGGER_ENABLED=false','M_TREXQUANT_MODE_ENABLED=false',
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_BPC_READOUT_COUPLE_ENABLED=true','M_PHON_READOUT_COUPLE_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
  'M_OS_LEARNING_ENABLED=true','M_OS_LEARNING_GUARD_1_BOUNDED=true','M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true','M_OS_LEARNING_GUARD_3_MDL_REGUL=true','M_OS_LEARNING_GUARD_4_COHERENCE=true',
  'M_DECLARE_NEO_ENABLED=true','M_NEO_RECALL_ENABLED=true','M_NEO_ASSEMBLED_ENABLED=true','M_NEO_COHORT_ENABLED=true','M_NEO_G2P_EXP_ENABLED=true',
  'M_DECLARE_NEO_CONF=0.75','M_DECLARE_NEO_RECALL_MARGIN=0.20','M_NEO_G2P_EXP_PEN=0.5',
  'M_NEO_PHON_COHORT_PURITY=0.5','M_NEO_PHON_COHORT_JOINTE_CONF=0.30','M_NEO_PHON_COHORT_CAP=4000',
].join(';');
const CFG_OOV = [
  'L01_A1_M2_ORTHO_ENABLED=false','L01_A2_M4_LEX4_ENABLED=false','L01_A3_M5M_WORDLEX4_ENABLED=false',
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true','L01_B2_MOBIUS_ENABLED=true',
  'M_OS_V07_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_BPC_M3D_ENABLED=true','M_BPC_READOUT_COUPLE_ENABLED=true',
  'M_OS_LEARNING_ONLINE_ENABLED=true','M_OS_LEARNING_GUARD_1_BOUNDED=true','M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true','M_OS_LEARNING_GUARD_3_MDL_REGUL=true','M_OS_LEARNING_GUARD_4_COHERENCE=true',
  'M_VOIE_PHON_ENABLED=false','M4_PHON_USE_P_ENABLED=false','M_PHON_FEEDBACK_ENABLED=false','M_PHON_READOUT_COUPLE_ENABLED=false','M_PHON_CONCEPT_BIND_ENABLED=false',
  'M_DECLARE_NEO_ENABLED=true','M_NEO_RECALL_ENABLED=true','M_NEO_ASSEMBLED_ENABLED=true','M_NEO_COHORT_ENABLED=true','M_NEO_MUTE_ENABLED=false','M_NEO_TRIGGER_ENABLED=false','M_EMERGENT_DECLARE_ENABLED=true',
  'M_DECLARE_NEO_CONF=0.60','M_NEO_PHON_COHORT_PURITY=0.5','M_NEO_PHON_COHORT_CAP=4000',
].join(';');

const pad=(s,n)=>{ s=String(s); while(s.length<n)s+=' '; return s; };

(async () => {
  const WPATH = process.argv[2]; if(!WPATH){ console.error('usage: node evo/heavy_c_winrate.js <poids.json> [warmup] [test] [seeds]'); process.exit(1); }
  const warmupN = +(process.argv[3] || 200);
  const testN   = +(process.argv[4] || 100);
  const seeds   = (process.argv[5] || '12345,777,2024').split(',').map(s=>+s);
  const weights = fs.readFileSync(WPATH,'utf8');   // string JSON, injecté tel quel dans la portée moteur

  const O = loadEngine(); await O.loadLex(); const ev=O.evalIn;
  const LEX = ev('OMEGA_LEX4'); const origLI = LEX.len_index; const W = LEX.words;
  // injecte les poids du C lourd dans la portée du moteur (par référence)
  ev('_neoHeavyC = '+weights+';');
  const np = ev('_neoHeavyC ? (_neoHeavyC.E.length + _neoHeavyC.Wc.length + _neoHeavyC.Lyr.reduce((a,o)=>a+o.Wq.length*4+o.W1.length*2,0)) : 0');
  console.log('poids C lourd injectés (~'+np+' floats) · cfg '+JSON.stringify(ev('_neoHeavyC.cfg')));

  ev('globalThis.__play=function(w){startNewGame(w);var sf=300;while(gameActive&&sf-->0)omegaStep();return !!lastGameWon;}');
  const play = global.__play;

  function pickSets(seed){
    const valid=[]; for(let i=0;i<W.length;i++){ const m=W[i]&&W[i].m; if(m&&m.length>=7&&m.length<=12&&/^[A-Z]+$/.test(m)) valid.push(i); }
    let r=(seed>>>0); const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
    for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
    const testIdx=valid.slice(0,testN); const trainW=valid.slice(testN,testN+warmupN).map(i=>W[i].m); const testW=testIdx.map(i=>W[i].m);
    const testSet=new Set(testIdx); const filtered={}; for(const k in origLI) filtered[k]=origLI[k].filter(id=>!testSet.has(id));
    return {trainW,testW,filtered};
  }

  // une condition : config optimale + arbitrage OS n-gram ; sublexicale = C lourd (heavy=true) ou n-gram gap-aware (heavy=false).
  function runCond(seed, sets, oov, heavy){
    const CFG = oov ? CFG_OOV : CFG_INLEX;
    ev(CFG);
    ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();`
      + `if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();`
      + `if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
    ev(CFG);
    // arbitrage OS avec voie sublexicale = n-gram agrégé (§1.9), + gap-aware (§1.10)
    ev('M_NEO_OS_ARB=true; M_NEO_OS_ARB_NGRAM=true; M_NEO_NGRAM_GAP=true; M_NEO_OS_ARB_ALPHA=1; M_NEO_OS_ARB_BETA=1;');
    ev('M_NEO_C_HEAVY='+(heavy?'true':'false')+';');   // ← le SEUL changement entre les 2 conditions : la voie sublexicale
    LEX.len_index = origLI; ev(`_omegaRng=makeMulberry32(${seed});`);
    for(let i=0;i<sets.trainW.length;i++) play(sets.trainW[i]);
    LEX.len_index = oov ? sets.filtered : origLI;
    let win=0; for(let i=0;i<sets.testW.length;i++){ if(play(sets.testW[i])) win++; }
    LEX.len_index = origLI;
    return 100*win/(sets.testW.length||1);
  }

  for(const oov of [false, true]){
    console.log(`\n=== ${oov?'HORS-LEXIQUE (OOV)':'IN-LEXIQUE'} · config optimale · warmup ${warmupN}/test ${testN} · graines [${seeds.join(',')}] ===`);
    const G=[], C=[];
    for(const seed of seeds){
      const sets=pickSets(seed);
      const g=runCond(seed,sets,oov,false); const c=runCond(seed,sets,oov,true);
      G.push(g); C.push(c);
      process.stderr.write(`  [seed ${seed}] gap ${g.toFixed(1)}%  ·  C-lourd ${c.toFixed(1)}%  ·  Δ ${(c-g>=0?'+':'')+(c-g).toFixed(1)}\n`);
    }
    const mg=G.reduce((a,b)=>a+b,0)/G.length, mc=C.reduce((a,b)=>a+b,0)/C.length;
    const dlt=C.map((c,i)=>c-G[i]);
    console.log('  voie gap-aware : '+G.map(v=>pad(v.toFixed(1)+'%',8)).join('')+' | moy '+mg.toFixed(1)+'%');
    console.log('  voie C lourd   : '+C.map(v=>pad(v.toFixed(1)+'%',8)).join('')+' | moy '+mc.toFixed(1)+'%');
    console.log('  Δ (C − gap)    : '+dlt.map(v=>pad((v>=0?'+':'')+v.toFixed(1),8)).join('')+' | moy '+(mc-mg>=0?'+':'')+(mc-mg).toFixed(1));
    const allWin=dlt.every(d=>d>0), noLoss=dlt.every(d=>d>=0);
    console.log('  → barrière §6.4 (bat gap à CHAQUE graine ?) : '+(allWin?'OUI':(noLoss?'égalité au pire':'NON')));
  }
})().catch(e=>{ console.error('ERR', e&&e.stack||e); process.exit(1); });
