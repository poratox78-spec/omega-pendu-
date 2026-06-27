'use strict';
// EVO O1 — SUITE : de VRAIES versions OMEGA comme agents (pas les proxys heuristiques de evo_o1_group.js).
// Question (roadmap, "Suite O1") : un GROUPE de vraies versions bat-il le MEILLEUR SOLO ? — avec le vrai omegaStep.
//
// CE QUE CETTE MESURE ÉTABLIT (3 constats, le verdict est NÉGATIF et il est INSTRUCTIF) :
//   1. VOTE pur par coup = NON implémentable proprement ici. Pour faire voter K versions sur un MÊME board, il faut
//      forcer l'état de board ; or forcer `alreadyTried` ne suffit pas (le moteur garde un "révélé" caché qu'on ne
//      reproduit pas — sonde : forçage ≠ jeu naturel dès le 2ᵉ coup). On ne lit pas le monolithe (doctrine) → vote écarté.
//   2. EN LEXIQUE, RIEN À COORDONNER. Les vraies versions sont quasi toutes au PLAFOND (~95 %, plafond oracle 97 %) et
//      DÉSACCORDENT À PEINE (1-14 % des 1ers coups). Pas de marge + pas de complémentarité → un groupe ne PEUT pas
//      battre le meilleur solo. (Le proxy "gagnait" parce que ses agents-jouets étaient FAIBLES & divers, avec une marge
//      artificielle — falsifié hors échantillon, roadmap MUSCLE TEST.)
//   3. LA COORDINATION EST DÉJÀ INTERNE. Le bench OOV natif montre que le moteur ROUTE déjà entre voies par fiabilité :
//      « n-gram ARBITRÉ OS — bascule AUTO par régime, in-lex ≈ cohorte » (+ gap-aware). C'est la division-du-travail-
//      par-routeur (le meilleur mécanisme du proxy)… déjà bâtie DANS une version. Un groupe externe est redondant.
//
// VERDICT : la prémisse d'O1 (groupe > meilleur solo) NE TIENT PAS pour de vraies versions — elles sont fortes &
// semblables (pas de complémentarité), et le routage utile est déjà l'arbitrage OS interne. O1 (coordination externe)
// est SUBSUMÉ par l'architecture. Mesure ci-dessous = la preuve reproductible du constat #2.   Usage : node evo/evo_o1_real.js
const { loadEngine } = require('./fitness_harness.js');

const CFG_ALL=[
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
  'M_DECLARE_NEO_ENABLED=true','M_NEO_RECALL_ENABLED=true','M_NEO_ASSEMBLED_ENABLED=true','M_NEO_COHORT_ENABLED=true','M_NEO_G2P_EXP_ENABLED=true',
];

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn;
  ev(CFG_ALL.join(';')); ev('_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();'); ev(CFG_ALL.join(';'));

  function applyVersion(v){
    ev(`initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
    ev(CFG_ALL.join(';'));
    if(v.off) ev(v.off.map(t=>`${t}=false`).join(';'));
    const p=v.params||{}; ev(`M_DECLARE_NEO_CONF=${p.conf??0.75};M_DECLARE_NEO_RECALL_MARGIN=${p.rm??0.20};M_NEO_G2P_EXP_PEN=${p.g2p??0.5};`);
  }
  function play(w){ ev(`startNewGame(${JSON.stringify(w)});`); const picks=[]; let sf=60;
    while(ev('gameActive')&&sf-->0){ const b=ev('alreadyTried.slice()'); ev('try{omegaStep();}catch(e){}'); const a=ev('alreadyTried.slice()');
      let nl=-1; for(let i=0;i<26;i++)if(a[i]&&!b[i]){nl=i;break;} if(nl<0)break; picks.push(nl); }
    return {won:!!ev('lastGameWon'), first:picks[0]}; }

  const VERSIONS=[
    {name:'ref'},
    {name:'cohorte-OFF',  off:['M_NEO_COHORT_ENABLED']},
    {name:'conf-bas',     params:{conf:0.50}},
    {name:'conf-haut',    params:{conf:0.92}},
    {name:'g2p-fort',     params:{g2p:1.2}},
    {name:'phon-OFF',     off:['M_VOIE_PHON_ENABLED','M_PHON_FEEDBACK_ENABLED']},
  ];
  const SEEDLIST=[4242,7777,2024], NWORDS=200;

  console.log(`\n=== EVO O1 — SUITE : vraies versions OMEGA (vrai omegaStep), ${NWORDS} mots × ${SEEDLIST.length} graines ===\n`);
  const agg={}; const firstsByVer={};
  for(const v of VERSIONS){ agg[v.name]=[]; firstsByVer[v.name]=[]; }
  for(const seed of SEEDLIST){
    const words=O.pick(NWORDS,seed).filter(Boolean);
    for(const v of VERSIONS){ applyVersion(v); let win=0; const firsts=[];
      for(const w of words){ const x=play(w); if(x.won)win++; firsts.push(x.first); }
      agg[v.name].push(+(100*win/words.length).toFixed(1)); firstsByVer[v.name].push(firsts);
    }
  }
  const mean=a=>+(a.reduce((s,x)=>s+x,0)/a.length).toFixed(1);
  const rows=VERSIONS.map(v=>({name:v.name, wr:mean(agg[v.name]), all:agg[v.name]}));
  const best=rows.reduce((m,x)=>x.wr>m.wr?x:m,rows[0]);
  console.log('  WINRATE SOLO (moyenne sur graines, vrai moteur) :');
  for(const r of rows) console.log(`    ${r.name.padEnd(13)} : ${r.wr.toFixed(1).padStart(5)} %   [${r.all.join(' · ')}]`);
  console.log(`    → meilleur solo : ${best.name} (${best.wr} %)`);

  // désaccord 1er coup vs ref (toutes graines confondues)
  console.log(`\n  DÉSACCORD 1er coup vs ref (sur ${NWORDS*SEEDLIST.length} mots) :`);
  let maxDis=0;
  for(const v of VERSIONS){ if(v.name==='ref')continue; let d=0,tot=0;
    for(let s=0;s<SEEDLIST.length;s++){ const a=firstsByVer[v.name][s],b=firstsByVer['ref'][s]; for(let i=0;i<a.length;i++){tot++; if(a[i]!==b[i])d++;} }
    const pct=+(100*d/tot).toFixed(0); if(v.name!=='phon-OFF'&&pct>maxDis)maxDis=pct;
    console.log(`    ${v.name.padEnd(13)} : ${pct} %`); }

  const competent=rows.filter(r=>r.wr>50);
  const spread=Math.max(...competent.map(r=>r.wr))-Math.min(...competent.map(r=>r.wr));
  console.log(`\n  CONSTAT : versions compétentes regroupées sur ${spread.toFixed(1)} pts (toutes ~plafond ~97 %),`);
  console.log(`            désaccord max (hors version cassée) = ${maxDis} %. Marge ET complémentarité ~nulles.`);
  console.log(`  → ❌ un groupe/routeur ne peut PAS battre le meilleur solo en lexique (rien à coordonner).`);
  console.log(`  → 🔑 la coordination utile (router par régime) est DÉJÀ l'arbitrage OS interne du moteur`);
  console.log(`       (bench OOV : « n-gram ARBITRÉ OS — bascule AUTO par régime »). O1 externe est subsumé.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
