'use strict';
// UN BANC HORS-LEXIQUE N'ENTEND PAS LE MOT, ET SA CONFIG NE DÉPEND PAS DE CE QUI A TOURNÉ AVANT (garde, 27/09/2026).
//
// ① LE SON. Le « 74 % hors-lexique » de l'évolution venait de là : le banc retirait le mot test de len_index, pas de
//    la table des prononciations `wp` ; le gène arbConf 0,30 faisait décider la voie « assemblé », qui lisait le son du
//    mot caché (sans ce son : 37,5 %, contre 56,1 % au gène 0 — dictee/JOURNAL.md, 27/09). fitness_harness.js coupe
//    désormais le son des mots hors du lexique en cours. La garde joue la config de l'évolution (gène 0,30) sur des
//    mots retirés et COMPTE les lectures du son du mot caché : 0 attendu. Puis elle lève la garde (__OREILLE_PARFAITE)
//    et doit en voir : sinon elle ne saurait pas voir une fuite.
// ② L'ORDRE. La « même » config faisait 25/40 dans un moteur neuf et 28/40 posée après le préréglage de la page :
//    elle initialisait AVANT de poser ses réglages et en laissait trois non posés. Protocole réparé : __defauts(),
//    réglages, initOmegaGlobals(). La garde joue la config dans un moteur neuf, puis après le préréglage du produit :
//    mêmes mots gagnés attendus. Et l'ancien protocole, après le préréglage, doit en gagner d'AUTRES — sinon la
//    garde ne saurait pas voir l'héritage d'état.
//   node evo/banc_oov_probe.js
const { loadEngine } = require('./fitness_harness.js');

const REGLAGES_EVO = `L01_A4_M4M_DECOMP_ENABLED=true;L01_A5_M2M_POSITIONAL_ENABLED=true;L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true;L01_B2_MOBIUS_ENABLED=true;M_OS_V07_ENABLED=true;M_SUBSTRAT_ORTHO_PURE_ENABLED=true;M_BPC_M3D_ENABLED=true;M_BPC_READOUT_COUPLE_ENABLED=true;M_OS_LEARNING_ONLINE_ENABLED=true;M_OS_LEARNING_GUARD_1_BOUNDED=true;M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true;M_OS_LEARNING_GUARD_3_MDL_REGUL=true;M_OS_LEARNING_GUARD_4_COHERENCE=true;
  M_VOIE_PHON_ENABLED=false;M4_PHON_USE_P_ENABLED=false;M_PHON_FEEDBACK_ENABLED=false;M_PHON_READOUT_COUPLE_ENABLED=false;M_PHON_CONCEPT_BIND_ENABLED=false;
  M_DECLARE_NEO_ENABLED=true;M_NEO_RECALL_ENABLED=true;M_NEO_ASSEMBLED_ENABLED=true;M_NEO_COHORT_ENABLED=true;M_NEO_PHON_COHORT_ENABLED=false;M_NEO_MUTE_ENABLED=false;M_NEO_TRIGGER_ENABLED=false;M_EMERGENT_DECLARE_ENABLED=true;
  M_NEO_LETTER_NGRAM=false;M_NEO_OS_ARB=true;M_NEO_OS_ARB_NGRAM=true;M_NEO_NGRAM_GAP=false;M_NEO_C_HEAVY=false;M_NEO_OS_ARB_ALPHA=1;M_NEO_OS_ARB_BETA=1;M_NEO_OS_ARB_CONF=0.30;`;

(async () => {
  const O = loadEngine(); await O.loadLex(); const ev = O.evalIn;
  ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`);
  ev(`(function(){
    const W=OMEGA_LEX4.words, valid=[];
    for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&m.length>=7&&m.length<=12&&/^[A-Z]+$/.test(m)) valid.push(i);}
    let r=12345; const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
    for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
    const test=valid.slice(0,40), train=valid.slice(40,80), ts=new Set(test), LI=OMEGA_LEX4.len_index, f={};
    for(const k in LI) f[k]=LI[k].filter(id=>!ts.has(id));
    globalThis.__b={LI, f, testW:test.map(i=>W[i].m), trainW:train.map(i=>W[i].m)};
    // réparé : TOUS les réglages, PUIS l'init
    globalThis.__cfgRepare=function(){ __defauts(); _omegaSeed=12345;_omegaRng=makeMulberry32(12345); ${REGLAGES_EVO} initOmegaGlobals();
      if(typeof _omega_OSL_reset==='function')_omega_OSL_reset(); if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;} };
    // l'ANCIEN protocole des bancs : init d'abord, réglages ensuite, sans remise à zéro
    globalThis.__cfgAncien=function(){ _omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();
      if(typeof _omega_OSL_reset==='function')_omega_OSL_reset(); if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}
      ${REGLAGES_EVO} };
    globalThis.__jouer=function(cfg){ cfg();
      function play(w){startNewGame(w);let s=300;while(gameActive&&s-->0)omegaStep();return lastGameWon;}
      OMEGA_LEX4.len_index=__b.LI; _neoWBL=null; _neoNG=null; _omegaRng=makeMulberry32(12345);
      for(const w of __b.trainW) play(w);
      OMEGA_LEX4.len_index=__b.f; _neoWBL=null; _neoNG=null;
      const G=_emrg_initOnline(), g=G.wp.get.bind(G.wp); let lu=0, enTest=true;
      G.wp.get=function(k){ const v=g(k); if(enTest && gameActive && k===currentWord && v) lu++; return v; };
      const gagnes=[]; for(const w of __b.testW) if(play(w)) gagnes.push(w);
      enTest=false; G.wp.get=g; OMEGA_LEX4.len_index=__b.LI; _neoWBL=null; _neoNG=null;
      return {gagnes, lu}; };
  })()`);

  const rouges = [];
  // ① le son
  const honnete = ev(`__OREILLE_PARFAITE=false; __jouer(__cfgRepare)`);
  const entendu = ev(`__OREILLE_PARFAITE=true; const _r=__jouer(__cfgRepare); __OREILLE_PARFAITE=false; _r`);
  if (honnete.lu !== 0) rouges.push(`le banc hors-lexique lit encore le son du mot caché : ${honnete.lu} lectures sur 40 parties`);
  if (entendu.lu === 0) rouges.push(`garde lève, aucune lecture du son caché vue : la garde ne saurait pas voir une fuite`);
  // ② l'ordre
  const neuf = ev(`__jouer(__cfgRepare)`);
  const apresProduit = ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);applyReferenceConfig(); __jouer(__cfgRepare)`);
  const ancien = ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);applyReferenceConfig(); __jouer(__cfgAncien)`);
  const memes = (a, b) => a.gagnes.join(',') === b.gagnes.join(',');
  if (!memes(neuf, honnete)) rouges.push(`la même config rejouée ne gagne pas les mêmes mots (${honnete.gagnes.length} puis ${neuf.gagnes.length})`);
  if (!memes(neuf, apresProduit)) rouges.push(`la config dépend de ce qui a tourné avant : ${neuf.gagnes.length}/40 dans un moteur neuf, ` +
                                               `${apresProduit.gagnes.length}/40 après le préréglage du produit`);
  if (memes(ancien, apresProduit)) rouges.push(`l'ancien protocole, après le préréglage, gagne les mêmes mots : la garde ne saurait pas voir l'héritage d'état`);
  if (rouges.length) {
    console.log('✗ BANC HORS-LEXIQUE :');
    rouges.forEach((x) => console.log('  ' + x));
    process.exit(1);
  }
  console.log(`✓ banc hors-lexique : 0 lecture du son caché sur 40 parties (${entendu.lu} garde levée) · ` +
              `config réparée : mêmes ${neuf.gagnes.length}/40 mots gagnés, moteur neuf ou après le préréglage ` +
              `(l'ancien protocole, lui, en gagnait ${ancien.gagnes.length}/40 : il héritait)`);
})().catch((e) => { console.error('✗ banc_oov_probe :', e && e.stack || e); process.exit(1); });
