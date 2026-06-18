// OMEGA — A/B : le readout concept bPC (cLetterScore, couplage 0,20) fait-il GAGNER ?
// cLetterScore discrimine +0,128 (diag_bpc) — mais discrimination ≠ winrate. Test : M_BPC_READOUT_COUPLE ON vs OFF,
// bPC M3D actif, cognition cheat-free (PAS d'A2), voie phon active (init corrigé §1.4.3), in-lex K=1.
// Usage : node evo/ab_bpcr.js [warmup] [test] [seeds]   (défauts 200 / 100 / 8 graines)
'use strict';
const { loadEngine } = require('./fitness_harness.js');

const CFG = [
  'L01_A1_M2_ORTHO_ENABLED=false','L01_A2_M4_LEX4_ENABLED=false','L01_A3_M5M_WORDLEX4_ENABLED=false',
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_PHON_READOUT_COUPLE_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
  'M_OS_LEARNING_ENABLED=true','M_OS_LEARNING_GUARD_1_BOUNDED=true','M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true','M_OS_LEARNING_GUARD_3_MDL_REGUL=true','M_OS_LEARNING_GUARD_4_COHERENCE=true',
  'M_DECLARE_NEO_ENABLED=false','M_NEO_RECALL_ENABLED=false','M_NEO_ASSEMBLED_ENABLED=false','M_NEO_COHORT_ENABLED=false','M_NEO_G2P_EXP_ENABLED=false',
].join(';');

function pad(s,n){s=String(s);while(s.length<n)s+=' ';return s;}

(async () => {
  const warmupN=+(process.argv[2]||200), testN=+(process.argv[3]||100);
  const seeds=(process.argv[4]||'12345,777,2024,99,2025,7,314,1000').split(',').map(s=>+s);
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const origLI=LEX.len_index; const W=LEX.words;
  ev('globalThis.__play=function(w){startNewGame(w);var s=300;while(gameActive&&s-->0)omegaStep();return !!lastGameWon;}');
  const play=global.__play;

  function pickSets(seed){
    const valid=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&m.length>=7&&m.length<=12&&/^[A-Z]+$/.test(m))valid.push(i);}
    let r=(seed>>>0); const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
    for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
    return { trainW: valid.slice(testN,testN+warmupN).map(i=>W[i].m), testW: valid.slice(0,testN).map(i=>W[i].m) };
  }
  function runCond(seed, sets, couple){
    ev(CFG);
    ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
    ev(CFG);
    ev(`M_BPC_READOUT_COUPLE_ENABLED=${!!couple};`);
    if(ev("!(M_BPC_M3D_ENABLED && M3_d && M3_d.cLetterScore)")) throw new Error('bPC M3D inactif');
    if(ev("!!M_BPC_READOUT_COUPLE_ENABLED")!==!!couple) throw new Error('couplage non posé');
    LEX.len_index=origLI; ev(`_omegaRng=makeMulberry32(${seed});`);
    for(let i=0;i<sets.trainW.length;i++)play(sets.trainW[i]);
    let win=0;for(let i=0;i<sets.testW.length;i++)if(play(sets.testW[i]))win++;
    return 100*win/sets.testW.length;
  }

  console.log(`\n=== A/B readout concept bPC (M_BPC_READOUT_COUPLE) — cognition cheat-free (pas d'A2) · in-lex K=1 · warmup ${warmupN}/test ${testN} · ${seeds.length} graines ===\n`);
  const on=[],off=[];
  for(const seed of seeds){
    const sets=pickSets(seed);
    const wOn=runCond(seed,sets,true), wOff=runCond(seed,sets,false);
    on.push(wOn);off.push(wOff);
    process.stderr.write(`  seed ${seed} : COUPLE ON ${wOn.toFixed(1)}%  OFF ${wOff.toFixed(1)}%  Δ ${(wOn-wOff>=0?'+':'')}${(wOn-wOff).toFixed(1)}\n`);
  }
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length; const per=on.map((v,i)=>v-off[i]);
  console.log('  condition                  '+seeds.map(s=>pad(s,7)).join('')+'  moyenne');
  console.log('  readout COUPLE ON (0,20)   '+on.map(v=>pad(v.toFixed(0)+'%',7)).join('')+'  '+mean(on).toFixed(1)+'%');
  console.log('  readout COUPLE OFF         '+off.map(v=>pad(v.toFixed(0)+'%',7)).join('')+'  '+mean(off).toFixed(1)+'%');
  console.log(`  Δ ON−OFF : moyenne ${(mean(on)-mean(off)>=0?'+':'')}${(mean(on)-mean(off)).toFixed(1)} · par graine [${per.map(d=>(d>=0?'+':'')+d.toFixed(0)).join(', ')}]`);
  const w=per.filter(d=>d>0).length,t=per.filter(d=>d===0).length,l=per.filter(d=>d<0).length;
  console.log(`  → ON>OFF ${w} · nul ${t} · ON<OFF ${l}\n  Lecture : Δ>0 ⇒ cLetterScore (+0,128 discrim.) CONVERTIT en winrate ; Δ≈0 ⇒ discrimine mais n'aide pas (cognition tranche déjà).`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
