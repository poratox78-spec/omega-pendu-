'use strict';
// EVO P3 — GÉNÉRATIONS & CROISEMENT. Une population de « versions » (génomes = params de cognition) est sélectionnée
// par la FITNESS TRI-CRITÈRE du harnais (fitterLex : plancher winrate → min erreurs → min temps), croisée (crossover +
// mutation), génération après génération. Crux roadmap : le winrate plafonne → la pression de progrès passe sur les
// ERREURS/temps. On part de génomes ALÉATOIRES (dégradés) et on montre que les générations REMONTENT la fitness.
// Réutilise loadEngine + fitterLex. Usage : node evo/evo_p3_generations.js
const { loadEngine, fitterLex } = require('./fitness_harness.js');

const CFG=[
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
  'M_DECLARE_NEO_ENABLED=true','M_NEO_RECALL_ENABLED=true','M_NEO_ASSEMBLED_ENABLED=true','M_NEO_COHORT_ENABLED=true','M_NEO_G2P_EXP_ENABLED=true',
].join(';');

// génome = [NEO_on/off, NEO_CONF, RECALL_MARGIN, G2P_EXP_PEN] (params réels du moteur). Le gène 0 (NEO maître)
// crée le SPREAD de fitness : NEO off ≈ cognition (~88%), NEO on ≈ ~97% — il y a donc une sélection à opérer.
const RANGE=[[0,1],[0.30,0.95],[0.05,0.50],[0.10,1.00]];

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const W=LEX.words;
  ev(CFG); ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`); ev(CFG);
  ev('globalThis.__play=function(w){startNewGame(w);var sf=300,lc=0,le=0;while(gameActive&&sf-->0){omegaStep();var t=alreadyTried,wd=currentWord;if(t&&wd){var co=0,er=0;for(var i=0;i<26;i++){if(t[i]){co++;if(wd.indexOf(String.fromCharCode(65+i))<0)er++;}}lc=co;le=er;}}return{won:!!lastGameWon,err:le};};');

  const valid=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m;if(m&&m.length===7&&/^[A-Z]+$/.test(m))valid.push(m);}   // len 7 = le plus dur in-lex
  let r=12345; const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
  const words=valid.slice(0,80);

  function evalGenome(g){
    ev(`M_DECLARE_NEO_ENABLED=${g[0]>0.5};M_DECLARE_NEO_CONF=${g[1]};M_DECLARE_NEO_RECALL_MARGIN=${g[2]};M_NEO_G2P_EXP_PEN=${g[3]};`);
    ev('_omegaRng=makeMulberry32(999);');
    let win=0,err=0; const t0=Number(process.hrtime.bigint());
    for(const w of words){ const x=global.__play(w); if(x.won)win++; err+=x.err; }
    const ms=(Number(process.hrtime.bigint())-t0)/1e6;
    return { winrate:win/words.length, erreurs:+(err/words.length).toFixed(3), ms:+ms.toFixed(1), _wr:+(100*win/words.length).toFixed(1) };
  }
  const clamp=(v,i)=>Math.max(RANGE[i][0],Math.min(RANGE[i][1],v));
  const randGenome=()=>RANGE.map((R,i)=>clamp(R[0]+rnd()*(R[1]-R[0]),i));
  const cross=(a,b)=>a.map((v,i)=>rnd()<0.5?v:b[i]);                                  // croisement
  const mutate=g=>g.map((v,i)=>clamp(v+(rnd()*2-1)*0.15*(RANGE[i][1]-RANGE[i][0]),i)); // mutation gaussienne bornée
  const ri=n=>Math.floor(rnd()*n);

  const POP=8, GENS=7, ELITE=3;
  let pop=Array.from({length:POP},randGenome);
  console.log(`\n=== EVO P3 — GÉNÉRATIONS & CROISEMENT (sélection par fitness tri-critère) ===`);
  console.log(`génome = [NEO on/off, CONF, MARGIN, G2P_PEN] · pop ${POP} · ${GENS} générations · ${words.length} mots len 7 (durs)`);
  console.log(`départ = ALÉATOIRE (dégradé). fitness lexicographique : plancher winrate → min erreurs → min temps.\n`);
  console.log(`  gén │ best winrate │ best err/partie │ génome best (NEO, conf, marge, pén)`);
  console.log(`  ────┼──────────────┼─────────────────┼────────────────────────────────────`);
  let first=null, best=null;
  for(let gen=0; gen<GENS; gen++){
    const scored=pop.map(g=>({g, f:evalGenome(g)}));
    scored.sort((a,b)=> -fitterLex(a.f, b.f));   // meilleur d'abord
    best=scored[0]; if(gen===0)first=best;
    console.log(`   ${gen}  │    ${best.f._wr.toFixed(1)} %    │     ${best.f.erreurs.toFixed(3)}      │ [NEO=${best.g[0]>0.5?'on ':'off'}, ${best.g.slice(1).map(x=>x.toFixed(2)).join(', ')}]`);
    const elites=scored.slice(0,ELITE).map(s=>s.g);
    const next=[...elites];
    while(next.length<POP) next.push(mutate(cross(elites[ri(ELITE)], elites[ri(ELITE)])));
    pop=next;
  }
  const dWr=best.f._wr-first.f._wr, dErr=first.f.erreurs-best.f.erreurs;
  console.log(`\n  → gén 0 (aléatoire) : ${first.f._wr}% · err ${first.f.erreurs}   →   gén ${GENS-1} : ${best.f._wr}% · err ${best.f.erreurs}`);
  const improved = (best.f._wr>first.f._wr+0.5) || (best.f._wr>=first.f._wr-0.5 && best.f.erreurs<first.f.erreurs-0.05);
  console.log(`  ${improved?'✅ LES GÉNÉRATIONS REMONTENT LA FITNESS':'⚠️ pas d\'amélioration nette'} : winrate ${dWr>=0?'+':''}${dWr.toFixed(1)} pt, erreurs ${dErr>=0?'−':''}${Math.abs(dErr).toFixed(3)}/partie.`);
  console.log(`  → sélection tri-critère + croisement : une population de versions s'améliore de génération en génération.`);
  console.log(`    (Crux roadmap : quand le winrate plafonne, la pression bascule sur les erreurs/temps — la 2e clé lexicographique.)`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
