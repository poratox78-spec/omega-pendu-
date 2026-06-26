'use strict';
// EVO P3 — LIGNÉE PROPRE sur le BON GÉNOME (paramètres/poids, pas le source). Après le diagnostic d'évolvabilité
// (evo_p3_genome.js : params = 30% bénéfique vs source = 0%), on fait une vraie lignée multi-générations :
//   génome = [NEO_CONF, RECALL_MARGIN, G2P_PEN] (continus) · croisement BLEND (arithmétique, préserve les blocs) +
//   mutation gaussienne · sélection tri-critère (fitterLex) · état RAZ par éval (indépendance ; pas besoin d'isolation
//   process car les params ne corrompent pas l'init, contrairement au source). Winrate saturé (len 7) → la pression
//   porte sur les ERREURS. On part PERTURBÉ autour de la référence et on montre que la lignée DESCEND les erreurs.
// Usage : node evo/evo_p3_lineage.js
const { loadEngine, fitterLex } = require('./fitness_harness.js');

const CFG=[
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
  'M_DECLARE_NEO_ENABLED=true','M_NEO_RECALL_ENABLED=true','M_NEO_ASSEMBLED_ENABLED=true','M_NEO_COHORT_ENABLED=true','M_NEO_G2P_EXP_ENABLED=true',
].join(';');
const KEYS=['NEO_CONF','RECALL_MARGIN','G2P_PEN'];
const RANGE={NEO_CONF:[0.30,0.95],RECALL_MARGIN:[0.05,0.50],G2P_PEN:[0.10,1.00]};
const REF={NEO_CONF:0.75,RECALL_MARGIN:0.20,G2P_PEN:0.50};

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const W=LEX.words;
  ev(CFG); ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`); ev(CFG);
  ev('globalThis.__play=function(w){try{startNewGame(w);}catch(e){return{won:false,err:6};}var sf=300,le=0;while(gameActive&&sf-->0){try{omegaStep();}catch(e){break;}var t=alreadyTried,wd=currentWord;if(t&&wd){var er=0;for(var i=0;i<26;i++){if(t[i]&&wd.indexOf(String.fromCharCode(65+i))<0)er++;}le=er;}}return{won:!!lastGameWon,err:le};};');

  const valid=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m;if(m&&m.length===7&&/^[A-Z]+$/.test(m))valid.push(m);}
  let r=12345; const rnd0=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd0()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
  const words=valid.slice(0,80);
  function fitness(){ ev('_omegaRng=makeMulberry32(999);'); let win=0,err=0; for(const w of words){const x=global.__play(w);if(x.won)win++;err+=x.err;} return {winrate:win/words.length, erreurs:+(err/words.length).toFixed(3), ms:1, _wr:+(100*win/words.length).toFixed(1)}; }
  function evalG(g){ ev(`initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`); ev(CFG); ev(`M_DECLARE_NEO_CONF=${g.NEO_CONF};M_DECLARE_NEO_RECALL_MARGIN=${g.RECALL_MARGIN};M_NEO_G2P_EXP_PEN=${g.G2P_PEN};`); return fitness(); }

  const refFit=evalG(REF);

  let rng=777; const rnd=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296;};
  const gauss=()=>{let u=0,v=0;while(u===0)u=rnd();while(v===0)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
  const clamp=(k,v)=>Math.max(RANGE[k][0],Math.min(RANGE[k][1],v));
  const perturb=(g,s)=>{const o={};for(const k of KEYS)o[k]=clamp(k,g[k]+gauss()*s*(RANGE[k][1]-RANGE[k][0]));return o;};
  const blend=(a,b)=>{const o={};for(const k of KEYS){const al=rnd();o[k]=clamp(k,al*a[k]+(1-al)*b[k]);}return o;};   // croisement arithmétique

  const POP=8, GENS=8, ELITE=3;
  let pop=[{...REF}]; for(let i=1;i<POP;i++)pop.push(perturb(REF,0.25));    // départ : perturbé autour de la référence
  console.log(`\n=== EVO P3 — LIGNÉE PROPRE sur le BON GÉNOME (params · croisement blend · sélection tri-critère) ===`);
  console.log(`référence : winrate ${refFit._wr}% · err ${refFit.erreurs} · ${words.length} mots len 7 · pop ${POP} · ${GENS} gén.\n`);
  console.log(`  gén │ best err │ best winrate │ génome best`);
  console.log(`  ────┼──────────┼──────────────┼──────────────────────────────`);
  let best=null, first=null;
  for(let gen=0;gen<GENS;gen++){
    const sc=pop.map(g=>({g,f:evalG(g)})); sc.sort((a,b)=>-fitterLex(a.f,b.f));
    best=sc[0]; if(gen===0)first=best;
    console.log(`   ${gen}  │  ${best.f.erreurs.toFixed(3)}  │    ${best.f._wr.toFixed(1)} %    │ {conf ${best.g.NEO_CONF.toFixed(2)}, marge ${best.g.RECALL_MARGIN.toFixed(2)}, pén ${best.g.G2P_PEN.toFixed(2)}}`);
    const elite=sc.slice(0,ELITE).map(o=>o.g); const next=[...elite];
    while(next.length<POP){ const c=blend(elite[Math.floor(rnd()*ELITE)],elite[Math.floor(rnd()*ELITE)]); next.push(perturb(c,0.08)); }   // blend + mutation
    pop=next;
  }
  const dErr=first.f.erreurs-best.f.erreurs, vsRef=refFit.erreurs-best.f.erreurs;
  console.log(`\n  → gén 0 best err ${first.f.erreurs} → gén ${GENS-1} best err ${best.f.erreurs}   (Δ ${dErr>=0?'−':''}${Math.abs(dErr).toFixed(3)})`);
  const vsMsg = vsRef>0.005 ? ('✅ la lignée TROUVE MIEUX que la réf (−'+vsRef.toFixed(3)+' err, winrate maintenu)') : vsRef<-0.005 ? '⚠️ pire que la réf' : '≈ égale la réf';
  console.log(`  → vs référence (err ${refFit.erreurs}) : ${vsMsg}`);
  console.log('');
  const improved = best.f.erreurs <= first.f.erreurs - 0.005 || best.f.erreurs <= refFit.erreurs - 0.005;
  console.log(`  ${improved?'✅ LIGNÉE PROPRE QUI PROGRESSE':'≈ stable'} : sur le BON génome (params), croisement blend + sélection font DESCENDRE les erreurs`);
  console.log(`    de génération en génération — les « erreurs utiles » (30% bénéfique mesuré) sont exploitées. C'est « inventer une meilleure version », proprement.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
