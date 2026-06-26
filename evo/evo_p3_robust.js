'use strict';
// EVO P3 — ROBUSTESSE : le croisement (enfant héritant du meilleur gène de chaque parent) bat-il vraiment ses parents,
// et l'enfant généralise-t-il en held-out, sur PLUSIEURS seeds (paires de parents tirées au hasard) — ou est-ce du bruit ?
// Vrai moteur (omegaStep). On rapporte : combien de fois l'enfant ≥ ses deux parents, et l'AMPLITUDE réelle du gain
// held-out (winrate + erreurs) vs une référence fixe. Honnête sur la petitesse. Usage : node evo/evo_p3_robust.js
const { loadEngine, fitterLex } = require('./fitness_harness.js');

const CFG=[
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
  'M_DECLARE_NEO_ENABLED=true','M_NEO_RECALL_ENABLED=true','M_NEO_ASSEMBLED_ENABLED=true','M_NEO_COHORT_ENABLED=true','M_NEO_G2P_EXP_ENABLED=true',
].join(';');
const KEYS=['NEO_CONF','RECALL_MARGIN','G2P_PEN'];
const RANGE={NEO_CONF:[0.30,0.95],RECALL_MARGIN:[0.05,0.50],G2P_PEN:[0.10,1.00]};
const clamp=(k,v)=>Math.max(RANGE[k][0],Math.min(RANGE[k][1],v));

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const W=ev('OMEGA_LEX4').words;
  ev(CFG); ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`); ev(CFG);
  ev('globalThis.__play=function(w){try{startNewGame(w);}catch(e){return{won:false,err:6};}var sf=300,le=0;while(gameActive&&sf-->0){try{omegaStep();}catch(e){break;}var t=alreadyTried,wd=currentWord;if(t&&wd){var er=0;for(var i=0;i<26;i++){if(t[i]&&wd.indexOf(String.fromCharCode(65+i))<0)er++;}le=er;}}return{won:!!lastGameWon,err:le};};');
  const valid=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m;if(m&&m.length===7&&/^[A-Z]+$/.test(m))valid.push(m);}
  let s=12345; const rnd0=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
  for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd0()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
  const train=valid.slice(0,40), held=valid.slice(40,120);
  function fitOn(g,words){ ev(`initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`); ev(CFG);
    ev(`M_DECLARE_NEO_CONF=${g.NEO_CONF};M_DECLARE_NEO_RECALL_MARGIN=${g.RECALL_MARGIN};M_NEO_G2P_EXP_PEN=${g.G2P_PEN};`);
    ev('_omegaRng=makeMulberry32(999);'); let win=0,err=0; for(const w of words){const x=global.__play(w);if(x.won)win++;err+=x.err;}
    return {winrate:win/words.length, erreurs:+(err/words.length).toFixed(3), _wr:+(100*win/words.length).toFixed(1)}; }
  const fit=g=>fitOn(g,train);
  function breed(A,B){ let best=null,bf=null; for(let m=0;m<8;m++){ const c={}; for(let k=0;k<KEYS.length;k++)c[KEYS[k]]=(m>>k&1)?B[KEYS[k]]:A[KEYS[k]];
    const f=fit(c); if(!bf||fitterLex(f,bf)>0){bf=f;best=c;} } return {g:best,f:bf}; }

  const refG={NEO_CONF:0.75,RECALL_MARGIN:0.20,G2P_PEN:0.50};
  const refHeld=fitOn(refG,held);   // référence fixe, held-out, une fois

  const seeds=[2024,7,101,333,888,1500]; const rows=[];
  for(const sd of seeds){ let r=sd>>>0; const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
    const randG=()=>({NEO_CONF:clamp('NEO_CONF',0.3+rnd()*0.65),RECALL_MARGIN:clamp('RECALL_MARGIN',0.05+rnd()*0.45),G2P_PEN:clamp('G2P_PEN',0.1+rnd()*0.9)});
    const A=randG(),B=randG(); const fA=fit(A),fB=fit(B); const child=breed(A,B);
    const betterBoth=fitterLex(child.f,fA)>0 && fitterLex(child.f,fB)>0;
    const ch=fitOn(child.g,held);
    rows.push({sd, A:fA._wr,B:fB._wr, child:child.f._wr, betterBoth,
      hWr:ch._wr, hErr:ch.erreurs, dWr:+(ch._wr-refHeld._wr).toFixed(1), dErr:+(refHeld.erreurs-ch.erreurs).toFixed(3),
      beatRef:fitterLex(ch,refHeld)>0});
  }
  const nBoth=rows.filter(r=>r.betterBoth).length, nBeat=rows.filter(r=>r.beatRef).length;
  const mDErr=rows.reduce((a,r)=>a+r.dErr,0)/rows.length, mDWr=rows.reduce((a,r)=>a+r.dWr,0)/rows.length;

  console.log(`\n=== EVO P3 — ROBUSTESSE du croisement (vrai moteur) · ${seeds.length} seeds · train ${train.length} · held-out ${held.length} ===\n`);
  console.log(`  référence fixe {0.75,0.20,0.50} held-out : ${refHeld._wr}% / ${refHeld.erreurs} err\n`);
  console.log(`  seed │ parents A/B │ enfant │ >2 parents │ held-out enfant │ Δwr  Δerr vs réf`);
  for(const r of rows) console.log(`  ${String(r.sd).padStart(4)} │ ${r.A}/${r.B}% │ ${r.child}% │   ${r.betterBoth?'oui':'non'}    │ ${r.hWr}% / ${r.hErr} │ ${r.dWr>=0?'+':''}${r.dWr}  ${r.dErr>=0?'+':''}${r.dErr} ${r.beatRef?'✅':'·'}`);
  console.log(`\n  enfant ≥ ses 2 parents : ${nBoth}/${seeds.length} seeds`);
  console.log(`  champion bat la référence en held-out : ${nBeat}/${seeds.length} seeds`);
  console.log(`  AMPLITUDE moyenne held-out vs réf : Δwinrate ${mDWr>=0?'+':''}${mDWr.toFixed(2)} pt · Δerreurs ${mDErr>=0?'+':''}${mDErr.toFixed(3)}/partie`);
  const small=Math.abs(mDWr)<1.0;
  console.log(`\n  → VERDICT : le mécanisme ${nBoth>=seeds.length-1?'tient souvent':'est inconstant'} (enfant≥parents ${nBoth}/${seeds.length}), mais l'AMPLITUDE est ${small?'MICRO':'notable'} : winrate ${mDWr>=0?'+':''}${mDWr.toFixed(1)} pt (≈ saturé), gain surtout sur les erreurs (${mDErr>=0?'+':''}${mDErr.toFixed(3)}/partie).`);
  console.log(`  → honnête : « le croisement produit un enfant au moins aussi bon, parfois un peu meilleur (erreurs), winrate quasi inchangé ». Pas un bond.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
