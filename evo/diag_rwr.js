// OMEGA — (b) POURQUOI le readout rwR marche là où letterPenalty échoue ?
// Hypothèse : rwR = P(lettre | pattern-concept a) [conditionnel sur la FORME] ; letterPenalty = P(lettre) [marginale].
// Test : cLetterScore avec le VRAI a (par mot) vs un a PLAT (uniforme, même magnitude → pattern supprimé = marginalisé).
//   real[l] = Σ_c a[c]·rwR[l][c]   (conditionnel)      flat[l] = mean(a)·Σ_c rwR[l][c]   (marginal : a uniforme)
// Si GAP NET(real) ≫ GAP NET(flat) → toute la spécificité-mot vient du CONDITIONNEMENT sur la forme (≠ marginale).
//
// Voie phon active (init §1.4.3). R67 lecture seule. Usage : node evo/diag_rwr.js [warmup] [test] [seed]
'use strict';
const { loadEngine } = require('./fitness_harness.js');

const CFG = [
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

  ev(CFG);
  ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
  ev(CFG);
  if(ev("!(M_BPC_M3D_ENABLED && M3_d && M3_d.rwR)")) { console.error('ERR rwR absent'); process.exit(1); }
  ev('globalThis.__start=function(w){startNewGame(w);};globalThis.__step=function(){omegaStep();};globalThis.__state=function(){return{active:gameActive,tried:Array.prototype.slice.call(alreadyTried)};};');
  // real (conditionnel) vs flat (marginal : a uniforme = mean(a)) — calculés depuis a et rwR courants
  ev('globalThis.__scores=function(){var a=M3_d.activations,R=M3_d.rwR,NC=N_CONCEPT_CELLS;var am=0;for(var c=0;c<NC;c++)am+=a[c];am/=NC;var real=[],flat=[];for(var l=0;l<26;l++){var sr=0,sf=0,row=R[l];for(var c2=0;c2<NC;c2++){sr+=a[c2]*row[c2];sf+=row[c2];}real.push(sr);flat.push(am*sf);}return{real:real,flat:flat};};');
  ev('globalThis.__freq=function(){var t=M4_m.letterTarget,o=[];for(var l=0;l<26;l++)o.push(1-t[l]);return o;};');

  ev(`_omegaRng=makeMulberry32(${seed});`);
  for(const w of trainW){global.__start(w);let sf=300;while(global.__state().active&&sf-->0)global.__step();}

  const freq=global.__freq();
  let inR=0,outR=0,inFl=0,outFl=0,inF=0,outF=0,inN=0,outN=0;
  for(const w of testW){
    global.__start(w); const ws=new Set(w.split('').map(c=>c.charCodeAt(0)-65)); let sf=300;
    while(global.__state().active&&sf-->0){
      global.__step(); const st=global.__state(); const s=global.__scores();
      for(let l=0;l<26;l++){ if(st.tried[l])continue; if(ws.has(l)){inR+=s.real[l];inFl+=s.flat[l];inF+=freq[l];inN++;}else{outR+=s.real[l];outFl+=s.flat[l];outF+=freq[l];outN++;} }
    }
  }
  const gReal=(inR/Math.max(1,inN))-(outR/Math.max(1,outN));
  const gFlat=(inFl/Math.max(1,inN))-(outFl/Math.max(1,outN));
  const gFreq=(inF/Math.max(1,inN))-(outF/Math.max(1,outN));
  console.log(`\n=== (b) rwR conditionnel vs marginal — cognition voie phon active · warmup ${warmupN}/test ${testN} · seed ${seed} ===\n`);
  console.log(`  GAP in−out cLetterScore RÉEL (a·rwR, conditionnel sur la forme) = ${(gReal>=0?'+':'')}${gReal.toFixed(4)}`);
  console.log(`  GAP in−out cLetterScore PLAT (mean(a)·ΣrwR, marginal, pattern supprimé) = ${(gFlat>=0?'+':'')}${gFlat.toFixed(4)}`);
  console.log(`  GAP in−out FRÉQUENCE (référence) = ${(gFreq>=0?'+':'')}${gFreq.toFixed(4)}`);
  console.log(`\n  → part CONDITIONNELLE (réel − plat) = ${(gReal-gFlat>=0?'+':'')}${(gReal-gFlat).toFixed(4)}`);
  console.log(`  Lecture : si réel ≫ plat (≈ fréquence) → la spécificité-mot vient du CONDITIONNEMENT sur le pattern-concept (forme),`);
  console.log(`  pas de rwR en soi. rwR = P(lettre|forme) ; letterPenalty (26 nombres) = P(lettre) marginale → c'est ça la différence.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
