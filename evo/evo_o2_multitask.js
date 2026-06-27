'use strict';
// EVO O2 — MESURE MULTI-USAGE (première brique). Roadmap : "ne mesurer que le pendu (in-lex)" est aveugle ; une version
// n'est "meilleure" que si elle progresse sur une SUITE de tâches. Ici : le MÊME génome évalué sur DEUX usages du même
// substrat cognitif — pendu IN-LEXIQUE (rappel/cohorte) et pendu HORS-LEXIQUE (généralisation, held-out propre façon bigN).
// On bâtit le VECTEUR de fitness (in-lex, OOV), on calcule le FRONT DE PARETO, et on montre que la sélection SCALAIRE
// (in-lex seul) n'est PAS la sélection multi-tâches → un scalaire pendu sur-apprend un usage. C'est la brique manquante
// pour brancher une fitness multi-objectif sur la lignée P3.
//
// NB (obstacle mesuré) : le bench OOV NATIF (_omega_trexquant_bench) RESTAURE/réinitialise la config → insensible au génome
// (cohorte-OFF ne baisse pas la voie cohorte, phon-OFF ne tue pas la voie son). On NE l'utilise donc PAS ; on mesure l'OOV
// par held-out explicite qui HONORE le génome (filtre len_index + vide _neoWBL/_neoNG), repris de evo_oov_bigN.js.
//   Usage : node evo/evo_o2_multitask.js
const { loadEngine } = require('./fitness_harness.js');

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn;
  ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`);

  // held-out OOV (repris bigN) : retire les mots de test du len_index, vide les caches de cohorte
  ev(`globalThis.__oovSetup=function(seed,testN,warmupN){
    const W=OMEGA_LEX4.words, valid=[];
    for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&m.length>=7&&m.length<=12&&/^[A-Z]+$/.test(m)) valid.push(i);}
    let r=(seed>>>0); const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
    for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
    const testIdx=valid.slice(0,testN), trainIdx=valid.slice(testN,testN+warmupN);
    const testSet=new Set(testIdx); const origLI=OMEGA_LEX4.len_index; const filtered={};
    for(const k in origLI) filtered[k]=origLI[k].filter(id=>!testSet.has(id));
    globalThis.__oov={origLI,filtered,trainW:trainIdx.map(i=>W[i].m),testW:testIdx.map(i=>W[i].m)};
    return __oov.testW.length;
  };`);

  // applique un GÉNOME (mêmes toggles de base ; on FAIT VARIER phon / OS-arbitrage / arbConf / gap / seuil declare)
  ev(`globalThis.__applyGenome=function(g,seed){
    _omegaSeed=seed;_omegaRng=makeMulberry32(seed);initOmegaGlobals();
    if(typeof _omega_OSL_reset==='function')_omega_OSL_reset(); if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}
    L01_A4_M4M_DECOMP_ENABLED=true;L01_A5_M2M_POSITIONAL_ENABLED=true;L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true;M_OS_V07_ENABLED=true;M_SUBSTRAT_ORTHO_PURE_ENABLED=true;M_BPC_M3D_ENABLED=true;
    // --- gène PHON (route du son : forte en lexique, neutre/coûteuse en OOV-sans-son) ---
    M_VOIE_PHON_ENABLED=g.phon;M4_PHON_USE_P_ENABLED=g.phon;M_PHON_FEEDBACK_ENABLED=g.phon;M_PHON_CONCEPT_BIND_ENABLED=g.phon;
    M_DECLARE_NEO_ENABLED=true;M_NEO_RECALL_ENABLED=true;M_NEO_ASSEMBLED_ENABLED=true;M_NEO_COHORT_ENABLED=true;M_EMERGENT_DECLARE_ENABLED=true;
    // --- gènes OOV (substrat d'agrégation) ---
    M_NEO_LETTER_NGRAM=false; M_NEO_OS_ARB=g.osArb; M_NEO_OS_ARB_NGRAM=g.osArb; M_NEO_NGRAM_GAP=g.gap;
    if(typeof M_NEO_C_HEAVY!=='undefined') M_NEO_C_HEAVY=false;
    if(typeof M_NEO_OS_ARB_CONF!=='undefined') M_NEO_OS_ARB_CONF=g.arbConf;
    if(typeof M_DECLARE_NEO_CONF!=='undefined') M_DECLARE_NEO_CONF=g.neoConf;
  };`);
  ev(`globalThis.__play=function(w){startNewGame(w);let sf=300;while(gameActive&&sf-->0)omegaStep();return !!lastGameWon;};`);

  // tâche 1 — IN-LEXIQUE (lexique complet, mots standard)
  ev(`globalThis.__scoreInlex=function(g,seed,words){ __applyGenome(g,seed); _omegaRng=makeMulberry32(seed);
    let win=0; for(let i=0;i<words.length;i++){ if(__play(words[i])) win++; } return +(100*win/words.length).toFixed(1); };`);
  // tâche 2 — HORS-LEXIQUE (held-out, honore le génome)
  ev(`globalThis.__scoreOOV=function(g,seed){ __applyGenome(g,seed);
    OMEGA_LEX4.len_index=__oov.origLI; _neoWBL=null; _neoNG=null; _omegaRng=makeMulberry32(seed);
    for(let i=0;i<__oov.trainW.length;i++)__play(__oov.trainW[i]);
    OMEGA_LEX4.len_index=__oov.filtered; _neoWBL=null; _neoNG=null;
    let win=0; for(let i=0;i<__oov.testW.length;i++){ if(__play(__oov.testW[i])) win++; }
    OMEGA_LEX4.len_index=__oov.origLI; _neoWBL=null; _neoNG=null;
    return +(100*win/__oov.testW.length).toFixed(1); };`);

  // GÉNOMES : pensés pour exposer un compromis in-lex vs OOV
  const GENOMES=[
    {name:'phon+cohorte (in-lex champion)', phon:true,  osArb:false, arbConf:0.0,  gap:false, neoConf:0.75},
    {name:'OS-arb n-gram (OOV bigN)',       phon:false, osArb:true,  arbConf:0.30, gap:false, neoConf:0.75},
    {name:'OS-arb + gap-aware',             phon:false, osArb:true,  arbConf:0.30, gap:true,  neoConf:0.75},
    {name:'phon + OS-arb (équilibre ?)',    phon:true,  osArb:true,  arbConf:0.30, gap:false, neoConf:0.75},
  ];

  const SEEDS=[12345,7777], TESTN=180, WARM=220, INLEXN=180;
  ev(`globalThis.__pick=function(n,seed){ _omegaSeed=seed;_omegaRng=makeMulberry32(seed); return (typeof _omega_pickWords!=='undefined')?_omega_pickWords(n,seed):[]; };`);

  console.log(`\n=== EVO O2 — MESURE MULTI-USAGE : MÊME génome, 2 tâches (in-lex rappel · OOV généralisation) ===`);
  console.log(`    ${INLEXN} mots in-lex · ${TESTN} mots held-out OOV · ${SEEDS.length} graines · vrai omegaStep\n`);
  const rows=[];
  for(const g of GENOMES){
    let il=[], oo=[];
    for(const sd of SEEDS){ const words=(ev(`__pick(${INLEXN},${sd})`)||[]).filter(Boolean);
      ev(`__oovSetup(${sd},${TESTN},${WARM})`);
      il.push(ev(`__scoreInlex(${JSON.stringify(g)},${sd},${JSON.stringify(words)})`));
      oo.push(ev(`__scoreOOV(${JSON.stringify(g)},${sd})`)); }
    const mean=a=>+(a.reduce((s,x)=>s+x,0)/a.length).toFixed(1);
    rows.push({name:g.name, inlex:mean(il), oov:mean(oo)});
  }
  console.log('  génome                                in-lex    OOV');
  for(const r of rows) console.log('  '+r.name.padEnd(36)+r.inlex.toFixed(1).padStart(6)+' %'+r.oov.toFixed(1).padStart(7)+' %');

  // sélections : scalaire in-lex vs scalaire OOV vs Pareto
  const bestIn=rows.reduce((m,x)=>x.inlex>m.inlex?x:m,rows[0]);
  const bestOov=rows.reduce((m,x)=>x.oov>m.oov?x:m,rows[0]);
  const pareto=rows.filter(r=>!rows.some(o=>o!==r && o.inlex>=r.inlex && o.oov>=r.oov && (o.inlex>r.inlex||o.oov>r.oov)));
  console.log(`\n  sélection SCALAIRE "pendu in-lex" → ${bestIn.name}  (OOV ${bestIn.oov} %)`);
  console.log(`  sélection SCALAIRE "OOV"           → ${bestOov.name}  (in-lex ${bestOov.inlex} %)`);
  console.log(`  FRONT DE PARETO (non-dominés)      : ${pareto.map(r=>r.name.split(' ')[0]).join(' · ')}  (${pareto.length}/${rows.length})`);
  const sameWinner = bestIn.name===bestOov.name;
  const msg = sameWinner
    ? 'même gagnant sur les 2 tâches → pas de compromis ICI (mais le harnais vecteur+Pareto est la brique, prêt pour P3).'
    : "gagnants DIFFÉRENTS selon la tâche → un scalaire \"pendu in-lex\" SUR-APPREND un usage et est AVEUGLE à l'autre.";
  console.log('\n  >>> ' + msg);
  console.log(`      Conséquence O2 : la sélection P3 doit optimiser le VECTEUR (Pareto/pondéré), pas le scalaire pendu.`);
  console.log(`      Brique POSÉE : 2 tâches scorées, honorant le génome, + front de Pareto. Suite : brancher sur la lignée P3,`);
  console.log(`      puis élargir la suite (correcteur dys, décompo dictée, complétion) — chacune dans son harnais propre.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
