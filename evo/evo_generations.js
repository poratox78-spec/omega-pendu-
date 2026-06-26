'use strict';
// EVO — LE VRAI LOOP : deux VERSIONS d'OMEGA (génomes = params/poids, le bon génome de P3) se COMBINENT pour
// fabriquer la version SUIVANTE ; le PENDU est le JUGE (fitness), pas la tâche ; on CROISE les générations
// (l'enfant se marie avec une version de la génération précédente). « Communiquer » = échanger leurs génomes pour
// produire un enfant MEILLEUR que les deux parents (recombinaison sélectionnée par la fitness). Moteur RÉEL.
// Usage : node evo/evo_generations.js
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
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const W=LEX.words;
  ev(CFG); ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`); ev(CFG);
  ev('globalThis.__play=function(w){try{startNewGame(w);}catch(e){return{won:false,err:6};}var sf=300,le=0;while(gameActive&&sf-->0){try{omegaStep();}catch(e){break;}var t=alreadyTried,wd=currentWord;if(t&&wd){var er=0;for(var i=0;i<26;i++){if(t[i]&&wd.indexOf(String.fromCharCode(65+i))<0)er++;}le=er;}}return{won:!!lastGameWon,err:le};};');
  const valid=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m;if(m&&m.length===7&&/^[A-Z]+$/.test(m))valid.push(m);}
  let s=12345; const rnd0=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
  for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd0()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
  const train=valid.slice(0,40), held=valid.slice(40,140);
  function fitOn(g,words){ ev(`initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`); ev(CFG);
    ev(`M_DECLARE_NEO_CONF=${g.NEO_CONF};M_DECLARE_NEO_RECALL_MARGIN=${g.RECALL_MARGIN};M_NEO_G2P_EXP_PEN=${g.G2P_PEN};`);
    ev('_omegaRng=makeMulberry32(999);'); let win=0,err=0; for(const w of words){const x=global.__play(w);if(x.won)win++;err+=x.err;}
    return {winrate:win/words.length, erreurs:+(err/words.length).toFixed(3), ms:1, _wr:+(100*win/words.length).toFixed(1)}; }
  const fit=g=>fitOn(g,train);

  let rng=2024; const rnd=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296;};
  const randG=()=>({NEO_CONF:clamp('NEO_CONF',0.3+rnd()*0.65),RECALL_MARGIN:clamp('RECALL_MARGIN',0.05+rnd()*0.45),G2P_PEN:clamp('G2P_PEN',0.1+rnd()*0.9)});
  const mutate=(g,sg)=>{const o={};for(const k of KEYS)o[k]=clamp(k,g[k]+(rnd()*2-1)*sg*(RANGE[k][1]-RANGE[k][0]));return o;};

  // « COMMUNIQUER » : les deux parents échangent leurs génomes → on évalue les 8 recombinaisons par-gène + 2 mutations,
  // on garde l'ENFANT que le PENDU juge le meilleur (fitterLex). L'enfant combine les forces des deux.
  function breed(A,B){ const cands=[]; for(let m=0;m<8;m++){ const c={}; for(let k=0;k<KEYS.length;k++)c[KEYS[k]]=(m>>k&1)?B[KEYS[k]]:A[KEYS[k]]; cands.push(c); }
    let best=cands[0],bf=fit(best); for(let i=1;i<cands.length;i++){const f=fit(cands[i]); if(fitterLex(f,bf)>0){bf=f;best=cands[i];}} return {g:best,f:bf}; }

  console.log(`\n=== EVO — GÉNÉRATIONS : deux versions se combinent pour fabriquer la suivante, le pendu juge ===`);
  console.log(`génome = params réels (NEO_CONF, marge, pén) · fitness = pendu (winrate plancher → erreurs) · ${train.length} mots len-7\n`);

  // gen 0 : deux versions diverses
  let A=randG(), B=randG(); let fA=fit(A), fB=fit(B);
  console.log(`  gén 0 — deux versions :`);
  console.log(`    version A : winrate ${fA._wr}% · err ${fA.erreurs}  {${A.NEO_CONF.toFixed(2)}, ${A.RECALL_MARGIN.toFixed(2)}, ${A.G2P_PEN.toFixed(2)}}`);
  console.log(`    version B : winrate ${fB._wr}% · err ${fB.erreurs}  {${B.NEO_CONF.toFixed(2)}, ${B.RECALL_MARGIN.toFixed(2)}, ${B.G2P_PEN.toFixed(2)}}`);

  // lignée : enfant = breed(meilleurs courants), CROISÉ avec la génération PRÉCÉDENTE
  let prev = fitterLex(fA,fB)>=0?{g:A,f:fA}:{g:B,f:fB};      // meilleur de gen 0
  let cur  = fitterLex(fA,fB)>=0?{g:B,f:fB}:{g:A,f:fA};       // l'autre
  const hist=[];
  for(let gen=1; gen<=3; gen++){
    const child = breed(prev.g, cur.g);                       // les deux versions communiquent → enfant
    const better = fitterLex(child.f,prev.f)>0 && fitterLex(child.f,cur.f)>0;
    hist.push({gen, wr:child.f._wr, err:child.f.erreurs, better});
    console.log(`  gén ${gen} — enfant(prec×cur) : winrate ${child.f._wr}% · err ${child.f.erreurs}  ${better?'✅ MEILLEUR que ses deux parents':'(≤ un parent)'}`);
    // croiser les générations : l'enfant devient courant, l'ancien meilleur devient le "précédent"
    const ranked=[prev,cur,child].sort((x,y)=>-fitterLex(x.f,y.f));
    prev=ranked[0]; cur=ranked[1];
  }
  const champ=prev;
  // le pendu JUGE en HELD-OUT (mots non vus)
  const champHeld=fitOn(champ.g,held), refHeld=fitOn({NEO_CONF:0.75,RECALL_MARGIN:0.20,G2P_PEN:0.50},held);
  console.log(`\n  CHAMPION (dernière gén) vs RÉFÉRENCE, jugés en HELD-OUT (${held.length} mots non vus) :`);
  console.log(`    référence {0.75,0.20,0.50} : winrate ${refHeld._wr}% · err ${refHeld.erreurs}`);
  console.log(`    champion évolué            : winrate ${champHeld._wr}% · err ${champHeld.erreurs}  ${fitterLex(champHeld,refHeld)>0?'✅ MEILLEUR que la référence (généralise)':fitterLex(champHeld,refHeld)<0?'⚠️ pire':'≈ égal'}`);
  console.log(`\n  → boucle EVO : deux versions COMMUNIQUENT (combinent leurs génomes) → fabriquent une meilleure version → on CROISE les générations.`);
  console.log(`    Le pendu n'est que le JUGE. C'est « fabriquer une nouvelle version d'OMEGA », pas un comité qui vote des coups.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
