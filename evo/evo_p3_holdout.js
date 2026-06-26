'use strict';
// EVO P3 — VALIDATION HELD-OUT du génome gagnant de la lignée. La lignée a trouvé {conf 0.48, marge 0.25, pén 0.71}
// meilleur que la référence sur 80 mots len-7 (err 1,163 vs 1,40). Sur-apprentissage ou vraie meilleure version ?
// On rejoue REF vs GAGNANT sur des mots NON VUS : (a) len-7 frais (même distrib), (b) len 8-10 (autre distrib).
// Si le gagnant reste meilleur en held-out → généralise. Sinon → tuning local. Usage : node evo/evo_p3_holdout.js
const { loadEngine, fitterLex } = require('./fitness_harness.js');

const CFG=[
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
  'M_DECLARE_NEO_ENABLED=true','M_NEO_RECALL_ENABLED=true','M_NEO_ASSEMBLED_ENABLED=true','M_NEO_COHORT_ENABLED=true','M_NEO_G2P_EXP_ENABLED=true',
].join(';');
const REF    ={NEO_CONF:0.75,RECALL_MARGIN:0.20,G2P_PEN:0.50};
const WINNER ={NEO_CONF:0.48,RECALL_MARGIN:0.25,G2P_PEN:0.71};

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const W=LEX.words;
  ev(CFG); ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`); ev(CFG);
  ev('globalThis.__play=function(w){try{startNewGame(w);}catch(e){return{won:false,err:6};}var sf=300,le=0;while(gameActive&&sf-->0){try{omegaStep();}catch(e){break;}var t=alreadyTried,wd=currentWord;if(t&&wd){var er=0;for(var i=0;i<26;i++){if(t[i]&&wd.indexOf(String.fromCharCode(65+i))<0)er++;}le=er;}}return{won:!!lastGameWon,err:le};};');

  function pick(lenMin,lenMax,seed){ const v=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m;if(m&&m.length>=lenMin&&m.length<=lenMax&&/^[A-Z]+$/.test(m))v.push(m);}
    let r=seed>>>0; const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
    for(let i=v.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=v[i];v[i]=v[j];v[j]=t;} return v; }
  const l7=pick(7,7,12345);
  const train   = l7.slice(0,80);          // ce qu'a vu la lignée
  const heldL7  = l7.slice(80,280);        // len-7 NON VUS (même distrib)
  const heldL810= pick(8,10,98765).slice(0,200);   // autre distrib (len 8-10), autre graine

  function evalG(g,words){ ev(`initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`); ev(CFG);
    ev(`M_DECLARE_NEO_CONF=${g.NEO_CONF};M_DECLARE_NEO_RECALL_MARGIN=${g.RECALL_MARGIN};M_NEO_G2P_EXP_PEN=${g.G2P_PEN};`);
    ev('_omegaRng=makeMulberry32(999);'); let win=0,err=0; for(const w of words){const x=global.__play(w);if(x.won)win++;err+=x.err;}
    return {winrate:win/words.length, erreurs:+(err/words.length).toFixed(3), ms:1, _wr:+(100*win/words.length).toFixed(1)}; }

  const sets=[['TRAIN len-7 (vu, rappel)',train],['HELD-OUT len-7 (non vu)',heldL7],['HELD-OUT len 8-10 (autre distrib)',heldL810]];
  console.log(`\n=== EVO P3 — VALIDATION HELD-OUT du génome gagnant vs référence ===`);
  console.log(`REF {0.75, 0.20, 0.50}  vs  GAGNANT {0.48, 0.25, 0.71}\n`);
  console.log(`  jeu                                  │  RÉF (wr · err)    │  GAGNANT (wr · err)   │ verdict`);
  console.log(`  ─────────────────────────────────────┼────────────────────┼───────────────────────┼─────────`);
  let heldGen=true;
  for(const [name,words] of sets){
    const fr=evalG(REF,words), fw=evalG(WINNER,words);
    const cmp=fitterLex(fw,fr); const better = cmp>0, worse = cmp<0;
    const v = better?'✅ gagnant':worse?'❌ réf':'≈ égal';
    if(name.startsWith('HELD') && !better) heldGen=false;
    console.log(`  ${name.padEnd(36)} │  ${fr._wr.toFixed(1)}% · ${fr.erreurs.toFixed(3)}   │  ${fw._wr.toFixed(1)}% · ${fw.erreurs.toFixed(3)}    │ ${v}`);
  }
  console.log(`\n  ${heldGen?'✅ GÉNÉRALISE : le génome gagnant reste meilleur sur les mots NON VUS → vraie meilleure version, pas du tuning local.':'⚠️ NE GÉNÉRALISE PAS (au moins un held-out) : amélioration en partie locale au set d\'entraînement (sur-apprentissage).'}`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
