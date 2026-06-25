'use strict';
// EVO P1 — 1ère MESURE DE FIDÉLITÉ du substrat de copie (roadmap point b + crux capacité §8.1).
// Question : l'autoencodeur bPC (M3_d, 12 cellules) reconstruit-il une séquence, et JUSQU'OÙ ?
//   (R) erreur relative de reconstruction ‖M1_d.output − M3_d._m2hat‖/‖M1_d.output‖ vs LONGUEUR.
//   (G) par-cœur vs structurel : Δ test(inédit) − train(vu en warmup), + check si bpcW bouge en ligne.
// Réutilise le mécanisme PROUVÉ de diag_bpc.js (même __rec). OFF-inerte (lecture seule), déterministe.
// Usage : node evo/evo_p1_fidelity.js [perLen] [seed]
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
  const perLen=+(process.argv[2]||30), seed=+(process.argv[3]||12345);
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const W=LEX.words;

  const LENS=[7,8,9,10,11,12,13,14,15];   // moteur : MIN_WORD_LEN=7
  const pool={}; for(const L of LENS) pool[L]=[];
  for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&/^[A-Z]+$/.test(m)&&pool[m.length]) pool[m.length].push(m);}
  let r=(seed>>>0); const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  const shuf=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}return a;};
  const testByLen={}, trainByLen={}, allTrain=[];
  for(const L of LENS){ const p=shuf(pool[L].slice()); testByLen[L]=p.slice(0,perLen); trainByLen[L]=p.slice(perLen,2*perLen); allTrain.push(...trainByLen[L]); }

  ev(CFG);
  ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
  ev(CFG);
  if(ev("!(M_BPC_M3D_ENABLED && M3_d && M3_d.bpcW)")) { console.error('ERR bPC non actif'); process.exit(1); }
  ev('globalThis.__start=function(w){try{startNewGame(w);return true;}catch(e){gameActive=false;return false;}};globalThis.__step=function(){omegaStep();};globalThis.__active=function(){return gameActive;};');
  ev('globalThis.__rec=function(){var m1=(typeof M1_d!=="undefined"&&M1_d.output)?M1_d.output:null,mh=M3_d._m2hat;if(!m1||!mh)return -1;var en=0,dn=0;for(var i=0;i<m1.length;i++){var d=m1[i]-mh[i];en+=d*d;dn+=m1[i]*m1[i];}return dn>1e-12?Math.sqrt(en/dn):-1;};');
  ev('globalThis.__nc=function(){return (typeof N_CONCEPT_CELLS!=="undefined")?N_CONCEPT_CELLS:-1;};');
  ev('globalThis.__bpcw=function(){var s=0;(function nrm(a){if(!a)return;for(var i=0;i<a.length;i++){var v=a[i];if(typeof v==="number")s+=v*v;else if(v&&v.length!=null)nrm(v);}})(M3_d.bpcW);return Math.sqrt(s);};');

  function recOf(w){ if(!global.__start(w))return -1; let sf=300,s=0,n=0; while(global.__active()&&sf-->0){ global.__step(); const x=global.__rec(); if(x>=0){s+=x;n++;} } return n?s/n:-1; }

  const w0=global.__bpcw();
  ev(`_omegaRng=makeMulberry32(${seed});`);
  for(const w of shuf(allTrain.slice())){ if(!global.__start(w))continue; let sf=300; while(global.__active()&&sf-->0)global.__step(); }
  const w1=global.__bpcw();

  const out=[];
  for(const L of LENS){
    let ts=0,tn=0; for(const w of testByLen[L]){ const x=recOf(w); if(x>=0){ts+=x;tn++;} }
    let rs=0,rn=0; for(const w of trainByLen[L]){ const x=recOf(w); if(x>=0){rs+=x;rn++;} }
    out.push({L, test:tn?ts/tn:-1, train:rn?rs/rn:-1, n:tn});
  }

  console.log(`\n=== EVO P1 — fidélité de reconstruction du substrat de copie (bPC, ${global.__nc()} cellules) · ${perLen}/len · seed ${seed} ===`);
  console.log(`bpcW ‖·‖ avant/après warmup : ${w0.toFixed(4)} → ${w1.toFixed(4)}  ${Math.abs(w1-w0)>1e-6?'(apprend en ligne)':'(figé — Δ rote non interprétable)'}`);
  console.log(`erreur relative ‖m1−m̂‖/‖m1‖ (0 = copie parfaite, ≥0.9 = quasi nul) :\n`);
  console.log(`  len │ test(inédit) │ train(vu) │ Δ(rote)`);
  console.log(`  ────┼──────────────┼───────────┼────────`);
  const f=v=>v<0?' n/a ':v.toFixed(3);
  for(const o of out){ const d=(o.test>=0&&o.train>=0)?(o.test-o.train):NaN;
    console.log(`  ${String(o.L).padStart(3)} │    ${f(o.test)}     │   ${f(o.train)}   │  ${isNaN(d)?'n/a':((d>=0?'+':'')+d.toFixed(3))}`); }

  const good=out.filter(o=>o.test>=0&&o.test<0.5).map(o=>o.L);
  const wall=out.find(o=>o.test>=0.9);
  const ds=out.filter(o=>o.test>=0&&o.train>=0).map(o=>o.test-o.train);
  const avgD=ds.length?ds.reduce((a,b)=>a+b,0)/ds.length:NaN;
  console.log(`\n  → reconstruit BIEN (err<0.5) jusqu'à len ${good.length?Math.max(...good):'—'} ; mur (err≥0.9) dès len ${wall?wall.L:'(jamais sur 4-15)'}`);
  console.log(`  → Δ(rote) moyen test−train = ${isNaN(avgD)?'n/a':((avgD>=0?'+':'')+avgD.toFixed(3))} ${isNaN(avgD)?'':(Math.abs(w1-w0)<=1e-6?'(bpcW figé → non concluant)':(avgD>0.03?'(le VU se reconstruit mieux → composante PAR CŒUR)':'(test ≈ train → reconstruction STRUCTURELLE)'))}`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
