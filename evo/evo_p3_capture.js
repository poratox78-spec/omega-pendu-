'use strict';
// EVO P3 — CAPTURE FIDÈLE (générations) : deux VERSIONS d'OMEGA (génomes = params réels) se combinent → un ENFANT qui
// hérite, gène par gène, du meilleur des deux ; le PENDU juge ; on valide HORS-ÉCHANTILLON. On capture les génomes,
// l'origine de chaque gène, et les winrates (parents, enfant, champion vs référence). Moteur réel. Usage : node evo/evo_p3_capture.js
const { loadEngine, fitterLex } = require('./fitness_harness.js');
const fs=require('fs'), path=require('path');

const CFG=[
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
  'M_DECLARE_NEO_ENABLED=true','M_NEO_RECALL_ENABLED=true','M_NEO_ASSEMBLED_ENABLED=true','M_NEO_COHORT_ENABLED=true','M_NEO_G2P_EXP_ENABLED=true',
].join(';');
const KEYS=['NEO_CONF','RECALL_MARGIN','G2P_PEN'];
const LABEL={NEO_CONF:'seuil de confiance',RECALL_MARGIN:'marge de rappel',G2P_PEN:'pénalité g2p'};
const RANGE={NEO_CONF:[0.30,0.95],RECALL_MARGIN:[0.05,0.50],G2P_PEN:[0.10,1.00]};
const clamp=(k,v)=>Math.max(RANGE[k][0],Math.min(RANGE[k][1],v));

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const W=ev('OMEGA_LEX4').words;
  ev(CFG); ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`); ev(CFG);
  ev('globalThis.__play=function(w){try{startNewGame(w);}catch(e){return{won:false,err:6};}var sf=300,le=0;while(gameActive&&sf-->0){try{omegaStep();}catch(e){break;}var t=alreadyTried,wd=currentWord;if(t&&wd){var er=0;for(var i=0;i<26;i++){if(t[i]&&wd.indexOf(String.fromCharCode(65+i))<0)er++;}le=er;}}return{won:!!lastGameWon,err:le};};');
  const valid=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m;if(m&&m.length===7&&/^[A-Z]+$/.test(m))valid.push(m);}
  let s=12345; const rnd0=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
  for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd0()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
  const train=valid.slice(0,40), held=valid.slice(40,140);
  function fitOn(g,words){ ev(`initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`); ev(CFG);
    ev(`M_DECLARE_NEO_CONF=${g.NEO_CONF};M_DECLARE_NEO_RECALL_MARGIN=${g.RECALL_MARGIN};M_NEO_G2P_EXP_PEN=${g.G2P_PEN};`);
    ev('_omegaRng=makeMulberry32(999);'); let win=0,err=0; for(const w of words){const x=global.__play(w);if(x.won)win++;err+=x.err;}
    return {winrate:win/words.length, erreurs:+(err/words.length).toFixed(3), _wr:+(100*win/words.length).toFixed(1)}; }
  const fit=g=>fitOn(g,train);

  let rng=2024; const rnd=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296;};
  const randG=()=>({NEO_CONF:clamp('NEO_CONF',0.3+rnd()*0.65),RECALL_MARGIN:clamp('RECALL_MARGIN',0.05+rnd()*0.45),G2P_PEN:clamp('G2P_PEN',0.1+rnd()*0.9)});

  // CROISEMENT : on évalue les 8 recombinaisons par-gène, on garde l'enfant que le PENDU juge le meilleur ; on note l'origine de chaque gène.
  function breed(A,B){ let best=null,bf=null,bm=0;
    for(let m=0;m<8;m++){ const c={}; for(let k=0;k<KEYS.length;k++)c[KEYS[k]]=(m>>k&1)?B[KEYS[k]]:A[KEYS[k]];
      const f=fit(c); if(!bf||fitterLex(f,bf)>0){bf=f;best=c;bm=m;} }
    const origin=KEYS.map((k,ki)=>(bm>>ki&1)?'B':'A');
    return {g:best,f:bf,origin}; }

  const A=randG(), B=randG(); const fA=fit(A), fB=fit(B);
  const child=breed(A,B);
  const betterBoth=fitterLex(child.f,fA)>0 && fitterLex(child.f,fB)>0;
  const refG={NEO_CONF:0.75,RECALL_MARGIN:0.20,G2P_PEN:0.50};
  const champHeld=fitOn(child.g,held), refHeld=fitOn(refG,held);
  const genStr=g=>KEYS.map(k=>+g[k].toFixed(2));

  const out={ meta:{ phase:'P3 — générations', what:'deux versions (génomes params) se combinent → un enfant qui hérite du meilleur gène de chaque parent ; le pendu juge ; validé hors-échantillon',
      fidelity:'100% omegaStep, génome = vrais paramètres du moteur' },
    genes:KEYS.map(k=>({key:k,label:LABEL[k],min:RANGE[k][0],max:RANGE[k][1]})),
    parents:{ A:{genome:genStr(A),wr:fA._wr,err:fA.erreurs}, B:{genome:genStr(B),wr:fB._wr,err:fB.erreurs} },
    child:{ genome:genStr(child.g), wr:child.f._wr, err:child.f.erreurs, origin:child.origin, betterThanBoth:betterBoth },
    heldout:{ pool:held.length, champion:{wr:champHeld._wr,err:champHeld.erreurs}, reference:{genome:genStr(refG),wr:refHeld._wr,err:refHeld.erreurs}, championBetter:fitterLex(champHeld,refHeld)>0 } };
  fs.writeFileSync(path.join(__dirname,'p3_capture.json'), JSON.stringify(out));
  console.log(`\n=== EVO P3 — CAPTURE (générations) → evo/p3_capture.json ===`);
  console.log(`parent A {${genStr(A).join(', ')}} : ${fA._wr}% / ${fA.erreurs}err   ·   parent B {${genStr(B).join(', ')}} : ${fB._wr}% / ${fB.erreurs}err`);
  console.log(`ENFANT  {${genStr(child.g).join(', ')}} (gènes de ${child.origin.join('+')}) : ${child.f._wr}% / ${child.f.erreurs}err  ${betterBoth?'✅ MEILLEUR que les deux parents':'(≤ un parent)'}`);
  console.log(`HORS-ÉCHANTILLON (${held.length} mots non vus) : champion ${champHeld._wr}%/${champHeld.erreurs} vs référence ${refHeld._wr}%/${refHeld.erreurs}  ${fitterLex(champHeld,refHeld)>0?'✅ généralise':fitterLex(champHeld,refHeld)<0?'⚠️ pire':'≈ égal'}`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
