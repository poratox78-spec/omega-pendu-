// OMEGA — HARVEST d'états de jeu RÉELS (réponse à « entraîne le C sur 10 000 vraies parties, pas des masques aléatoires »).
// Joue N parties OOV (mot retiré du len_index) à CONFIG OPTIMALE et enregistre, à CHAQUE décision, l'état de board
// révélé (revealedMask) — la VRAIE distribution d'états que voit OMEGA (lettres révélées dans l'ordre stratégique),
// ≠ masquage aléatoire. Sortie : lignes « MOT 0101… » (mot + bitmask révélé). Le C s'entraîne ensuite dessus
// (heavy_c_probe.js STATES=<fichier>), puis re-test winrate (heavy_c_winrate.js).
// Usage : node evo/harvest_states.js [out] [nGames] [seed]
'use strict';
const fs=require('fs');
const { loadEngine } = require('./fitness_harness.js');

const CFG_OOV = [
  'L01_A1_M2_ORTHO_ENABLED=false','L01_A2_M4_LEX4_ENABLED=false','L01_A3_M5M_WORDLEX4_ENABLED=false',
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true','L01_B2_MOBIUS_ENABLED=true',
  'M_OS_V07_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_BPC_M3D_ENABLED=true','M_BPC_READOUT_COUPLE_ENABLED=true',
  'M_OS_LEARNING_ONLINE_ENABLED=true','M_OS_LEARNING_GUARD_1_BOUNDED=true','M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true','M_OS_LEARNING_GUARD_3_MDL_REGUL=true','M_OS_LEARNING_GUARD_4_COHERENCE=true',
  'M_VOIE_PHON_ENABLED=false','M4_PHON_USE_P_ENABLED=false','M_PHON_FEEDBACK_ENABLED=false','M_PHON_READOUT_COUPLE_ENABLED=false','M_PHON_CONCEPT_BIND_ENABLED=false',
  'M_DECLARE_NEO_ENABLED=true','M_NEO_RECALL_ENABLED=true','M_NEO_ASSEMBLED_ENABLED=true','M_NEO_COHORT_ENABLED=true','M_NEO_MUTE_ENABLED=false','M_NEO_TRIGGER_ENABLED=false','M_EMERGENT_DECLARE_ENABLED=true',
  'M_NEO_OS_ARB=true','M_NEO_OS_ARB_NGRAM=true','M_NEO_NGRAM_GAP=true','M_NEO_OS_ARB_ALPHA=1','M_NEO_OS_ARB_BETA=1',
  'M_DECLARE_NEO_CONF=0.60','M_NEO_PHON_COHORT_PURITY=0.5','M_NEO_PHON_COHORT_CAP=4000','M_NEO_C_HEAVY=false',
].join(';');

(async () => {
  const OUT = process.argv[2] || '/tmp/real_states.txt';
  const NGAMES = +(process.argv[3] || 10000);
  const SEED = +(process.argv[4] || 424242);
  const O = loadEngine(); await O.loadLex(); const ev=O.evalIn;
  const LEX=ev('OMEGA_LEX4'); const W=LEX.words;
  // exclusion anti-fuite : mots du test winrate (EXCLUDE=fichier, un mot/ligne) retirés du harvest
  const excl = process.env.EXCLUDE ? new Set(fs.readFileSync(process.env.EXCLUDE,'utf8').split(/\s+/).filter(Boolean)) : new Set();
  const valid=[]; for(let i=0;i<W.length;i++){ const m=W[i]&&W[i].m; if(m&&m.length>=7&&m.length<=12&&/^[A-Z]+$/.test(m)&&!excl.has(m)) valid.push(i); }
  if(excl.size) process.stderr.write('  exclusion anti-fuite : '+excl.size+' mots de test retirés\n');
  let r=SEED>>>0; const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
  const games=valid.slice(0, Math.min(NGAMES, valid.length));
  ev(CFG_OOV);
  ev(`_omegaSeed=${SEED};_omegaRng=makeMulberry32(${SEED});initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
  ev(CFG_OOV);
  // joue une partie OOV (mot retiré du len_index) et renvoie les masks de révélation à chaque décision.
  ev(`globalThis.__rec=function(wi){
    var w=OMEGA_LEX4.words[wi].m, save=OMEGA_LEX4.len_index, fil={};
    for(var k in save) fil[k]=save[k].filter(function(id){return id!==wi;});
    OMEGA_LEX4.len_index=fil;
    startNewGame(w); var out=[], sf=300, prev='';
    while(gameActive&&sf-->0){ var rm=''; for(var p=0;p<w.length;p++) rm+=revealedMask[p]?'1':'0';
      if(rm!==prev){ out.push(rm); prev=rm; } omegaStep(); }
    OMEGA_LEX4.len_index=save; return w+'\\n'+out.join(',');
  }`);
  const rec=global.__rec;
  const fd=fs.openSync(OUT,'w'); let nst=0, t0=Date.now();
  for(let g=0; g<games.length; g++){
    const res=rec(games[g]); const [w, masks]=res.split('\n'); const ms=masks?masks.split(','):[];
    for(const m of ms){ if(m.indexOf('0')<0) continue; fs.writeSync(fd, w+' '+m+'\n'); nst++; }  // garde les états avec ≥1 position cachée
    if(g%1000===0) process.stderr.write('  '+g+'/'+games.length+' parties · '+nst+' états · '+((Date.now()-t0)/1000).toFixed(0)+'s\n');
  }
  fs.closeSync(fd);
  console.log('harvest : '+games.length+' parties → '+nst+' états réels → '+OUT+'  ('+(fs.statSync(OUT).size/1048576).toFixed(1)+' Mo)');
})().catch(e=>{ console.error(e&&e.stack||e); process.exit(1); });
