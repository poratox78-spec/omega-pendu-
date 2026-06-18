// OMEGA — AUDIT structurel + TEST de bPC (M_BPC_M3D) et de son readout cLetterScore (couplé 0,20).
// Questions :
//  (R) RECONSTRUCTION : l'autoencodeur 12 cellules reconstruit-il M1_d.output ? (erreur relative ‖m1−m̂‖/‖m1‖)
//  (C) CELLULES : combien actives / cellule dominante (collapse ?) + détecteur de longueur (dominante par longueur)
//  (S) cLetterScore : discrimine-t-il les lettres DU MOT au-delà de la FRÉQUENCE ? (contrôle = 1−M4_m.letterTarget)
//      → si GAP NET ≈ 0 : le concept readout (couplé 0,20) ne porte que de la fréquence (comme M1_m, §1.4.1).
//
// Voie phon active (init corrigé §1.4.3). R67 lecture seule. Usage : node evo/diag_bpc.js [warmup] [test] [seed]
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
  if(ev("!(M_BPC_M3D_ENABLED && M3_d && M3_d.bpcW)")) { console.error('ERR bPC non actif'); process.exit(1); }
  ev('globalThis.__start=function(w){startNewGame(w);};globalThis.__step=function(){omegaStep();};globalThis.__state=function(){return{active:gameActive,tried:Array.prototype.slice.call(alreadyTried),len:(currentWord||"").length};};');
  // erreur de reconstruction relative ‖m1−m̂‖/‖m1‖ (m̂ = M3_d._m2hat, m1 = M1_d.output)
  ev('globalThis.__rec=function(){var m1=(typeof M1_d!=="undefined"&&M1_d.output)?M1_d.output:null,mh=M3_d._m2hat;if(!m1||!mh)return -1;var en=0,dn=0;for(var i=0;i<m1.length;i++){var d=m1[i]-mh[i];en+=d*d;dn+=m1[i]*m1[i];}return dn>1e-12?Math.sqrt(en/dn):-1;};');
  ev('globalThis.__act=function(){return Array.prototype.slice.call(M3_d.activations);};');
  ev('globalThis.__cls=function(){return Array.prototype.slice.call(M3_d.cLetterScore);};');
  ev('globalThis.__freq=function(){var t=M4_m.letterTarget,o=[];for(var l=0;l<26;l++)o.push(1-t[l]);return o;};');
  ev('globalThis.__nc=function(){return N_CONCEPT_CELLS;};');

  ev(`_omegaRng=makeMulberry32(${seed});`);
  for(const w of trainW){global.__start(w);let sf=300;while(global.__state().active&&sf-->0)global.__step();}

  const NC=global.__nc(); const freq=global.__freq();
  let recSum=0,recN=0; const cellHist=new Array(NC).fill(0); let activeSum=0,actCnt=0; const byLen={};
  let inS=0,inN=0,outS=0,outN=0, inF=0,outF=0;
  for(const w of testW){
    global.__start(w); const ws=new Set(w.split('').map(c=>c.charCodeAt(0)-65)); let sf=300;
    while(global.__state().active&&sf-->0){
      global.__step();
      const st=global.__state();
      const rec=global.__rec(); if(rec>=0){recSum+=rec;recN++;}
      const a=global.__act(); let bc=-1,bv=-1,nactive=0; for(let c=0;c<NC;c++){ if(a[c]>1e-6)nactive++; if(a[c]>bv){bv=a[c];bc=c;} }
      if(bc>=0){cellHist[bc]++; activeSum+=nactive; actCnt++; if(!byLen[st.len])byLen[st.len]={cc:{},n:0}; byLen[st.len].cc[bc]=(byLen[st.len].cc[bc]||0)+1; byLen[st.len].n++;}
      const cls=global.__cls();
      for(let l=0;l<26;l++){ if(st.tried[l])continue; if(ws.has(l)){inS+=cls[l];inN++;inF+=freq[l];}else{outS+=cls[l];outN++;outF+=freq[l];} }
    }
  }
  const recM=recN?recSum/recN:-1;
  const inM=inS/Math.max(1,inN),outM=outS/Math.max(1,outN),inMF=inF/Math.max(1,inN),outMF=outF/Math.max(1,outN);
  const gapCls=inM-outM, gapFreq=inMF-outMF, gapNet=gapCls-gapFreq;
  const totC=cellHist.reduce((a,b)=>a+b,0)||1; const live=cellHist.map((n,i)=>({i,n})).filter(o=>o.n>0).sort((a,b)=>b.n-a.n);

  console.log(`\n=== AUDIT bPC (M_BPC_M3D) — cognition voie phon active · warmup ${warmupN}/test ${testN} · seed ${seed} ===\n`);
  console.log(`(R) RECONSTRUCTION autoencodeur : erreur relative moyenne ‖m1−m̂‖/‖m1‖ = ${recM>=0?recM.toFixed(3):'n/a'}  ${recM>=0?(recM<0.5?'(reconstruit bien)':recM<0.9?'(reconstruit partiellement)':'(quasi nul)'):''}`);
  console.log(`(C) CELLULES : ${live.length}/${NC} vivantes · dominante ${live.length?('#'+live[0].i+' à '+(100*live[0].n/totC).toFixed(0)+'%'):'—'} · activées/tick ${actCnt?(activeSum/actCnt).toFixed(1):'—'}/${NC}`);
  console.log(`    détecteur de longueur — cellule dominante modale par longueur :`);
  const lens=Object.keys(byLen).map(Number).sort((a,b)=>a-b);
  for(const L of lens){const cc=byLen[L].cc,n=byLen[L].n;const top=Object.keys(cc).map(k=>({k:+k,v:cc[k]})).sort((a,b)=>b.v-a.v)[0];console.log(`      len ${L} (n=${String(n).padStart(4)}) → #${top.k} à ${(100*top.v/n).toFixed(0)}%`);}
  console.log(`(S) cLetterScore (readout concept, couplé 0,20) :`);
  console.log(`    GAP brut in−out = ${(gapCls>=0?'+':'')}${gapCls.toFixed(4)} · GAP fréquence (contrôle) = ${(gapFreq>=0?'+':'')}${gapFreq.toFixed(4)} · GAP NET = ${(gapNet>=0?'+':'')}${gapNet.toFixed(4)}`);
  console.log(`    ${Math.abs(gapNet)<0.02*Math.abs(gapFreq||1)+0.003?'→ ≈ fréquence : le concept readout ne discrimine PAS le mot au-delà de la fréquence (comme M1_m)':'→ porte un signal AU-DELÀ de la fréquence (spécifique au mot)'}`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
