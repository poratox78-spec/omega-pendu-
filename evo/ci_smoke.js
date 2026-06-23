// OMEGA — SMOKE ANTI-RÉGRESSION du MOTEUR (CI). AUDIT_COMPLET CI1 / AUDIT_STRUCTUREL §S3 « risque #1 ».
// Jusqu'ici AUCUN test ne gardait le winrate du moteur (la CI ne teste que la dictée Python + la syntaxe app) :
// une régression silencieuse du scoreur passerait. Ce smoke joue des parties SEEDÉES sur le VRAI code de
// décision (startNewGame/omegaStep) en config de référence cheat-free et ASSERT deux planchers.
//
// Réutilise loadEngine (evo/fitness_harness.js) + la CFG de référence et le protocole de ab_cohort.js
// (in-lexique K=1). Les seuils sont des PLANCHERS conservateurs (sous les valeurs mesurées 91,5 / 97,5)
// pour ne pas « flaker » à petit N ; une vraie casse (module cassé) fait chuter le winrate bien en-dessous.
//   Usage : node evo/ci_smoke.js     (réglable via env CI_WARMUP/CI_TEST/CI_SEEDS/CI_FLOOR_COG/CI_FLOOR_NEO)
'use strict';
const { loadEngine } = require('./fitness_harness.js');

// Config de référence cheat-free — copiée de docs/CONFIG_REFERENCE.md / ab_cohort.js (CFG_INLEX).
const CFG = [
  'L01_A1_M2_ORTHO_ENABLED=false','L01_A2_M4_LEX4_ENABLED=false','L01_A3_M5M_WORDLEX4_ENABLED=false','L01_B2_MOBIUS_ENABLED=false',
  'M_WORD_DECLARE_ENABLED=false','M_IG_SELECT_ENABLED=false','M_IG_PSUCCESS_ENABLED=false','M_BPC_DECLARE_ENABLED=false',
  'M_DECLARE_DUAL_ENABLED=false','M_LEARN_FROM_COGNITION_ENABLED=false','M_OS_LEARNING_ONLINE_ENABLED=false',
  'M_EMERGENT_DECLARE_ENABLED=false','M_EMERGENT_ASSEMBLED_ENABLED=false','M_EMERGENT_G2P_ONLINE=false',
  'M_NEO_MUTE_ENABLED=false','M_NEO_TRIGGER_ENABLED=false','M_TREXQUANT_MODE_ENABLED=false',
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_BPC_READOUT_COUPLE_ENABLED=true','M_PHON_READOUT_COUPLE_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
  'M_OS_LEARNING_ENABLED=true','M_OS_LEARNING_GUARD_1_BOUNDED=true','M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true','M_OS_LEARNING_GUARD_3_MDL_REGUL=true','M_OS_LEARNING_GUARD_4_COHERENCE=true',
  'M_DECLARE_NEO_ENABLED=true','M_NEO_RECALL_ENABLED=true','M_NEO_ASSEMBLED_ENABLED=true','M_NEO_COHORT_ENABLED=true','M_NEO_G2P_EXP_ENABLED=true',
  'M_DECLARE_NEO_CONF=0.75','M_DECLARE_NEO_RECALL_MARGIN=0.20','M_NEO_G2P_EXP_PEN=0.5',
].join(';');

const WARMUP = +(process.env.CI_WARMUP || 120);
const TEST   = +(process.env.CI_TEST   || 60);
const SEEDS  = (process.env.CI_SEEDS || '12345,777').split(',').map(s => +s);
const FLOOR_COG = +(process.env.CI_FLOOR_COG || 84);   // mesuré ~91,5 → plancher conservateur
const FLOOR_NEO = +(process.env.CI_FLOOR_NEO || 93);   // mesuré ~97,5 → plancher conservateur

(async () => {
  const O = loadEngine(); await O.loadLex(); const ev = O.evalIn;
  const LEX = ev('OMEGA_LEX4'); const origLI = LEX.len_index, W = LEX.words;
  ev('globalThis.__play=function(w){startNewGame(w);var sf=300;while(gameActive&&sf-->0)omegaStep();return !!lastGameWon;}');
  const play = global.__play;

  function pickSets(seed) {   // miroir exact de _omega_trexquant_bench / ab_cohort (valid 7..12, shuffle LCG)
    const valid = [];
    for (let i = 0; i < W.length; i++){ const m = W[i] && W[i].m; if (m && m.length >= 7 && m.length <= 12 && /^[A-Z]+$/.test(m)) valid.push(i); }
    let r = (seed >>> 0); const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
    for (let i = valid.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); const t = valid[i]; valid[i] = valid[j]; valid[j] = t; }
    return { trainW: valid.slice(TEST, TEST + WARMUP).map(i => W[i].m), testW: valid.slice(0, TEST).map(i => W[i].m) };
  }

  function runCond(seed, sets, neo) {   // ORDRE CRITIQUE (AUDIT §1.4.3) : config AVANT init, puis ré-applique.
    ev(CFG);
    ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();`
      + `if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();`
      + `if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
    ev(CFG);
    ev(`M_DECLARE_NEO_ENABLED=${!!neo};`);   // NEO off = cognition seule ; on = config de référence
    if (ev("M_VOIE_PHON_ENABLED && !(typeof M1_phon!=='undefined' && M1_phon && M1_phon.output)"))
      throw new Error('voie phon ON mais buffers non alloués — ordre d\'init cassé (AUDIT §1.4.3)');
    LEX.len_index = origLI; ev(`_omegaRng=makeMulberry32(${seed});`);
    for (let i = 0; i < sets.trainW.length; i++) play(sets.trainW[i]);
    let win = 0; for (let i = 0; i < sets.testW.length; i++) if (play(sets.testW[i])) win++;
    LEX.len_index = origLI;
    return 100 * win / (sets.testW.length || 1);
  }

  const cogs = [], neos = [];
  for (const seed of SEEDS) { const sets = pickSets(seed); cogs.push(runCond(seed, sets, false)); neos.push(runCond(seed, sets, true)); }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const cog = avg(cogs), neo = avg(neos);
  console.log(`[ci_smoke] in-lexique K=1 · warmup ${WARMUP} / test ${TEST} · graines [${SEEDS.join(',')}]`);
  console.log(`[ci_smoke] cognition seule (NEO off) : ${cog.toFixed(1)}%  (plancher ${FLOOR_COG}) · par graine [${cogs.map(v => v.toFixed(0)).join(',')}]`);
  console.log(`[ci_smoke] +NEO (config réf.)        : ${neo.toFixed(1)}%  (plancher ${FLOOR_NEO}) · par graine [${neos.map(v => v.toFixed(0)).join(',')}]`);
  let ok = true;
  if (cog < FLOOR_COG) { console.error(`[ci_smoke] ÉCHEC : cognition ${cog.toFixed(1)}% < plancher ${FLOOR_COG}% — régression du scoreur ?`); ok = false; }
  if (neo < FLOOR_NEO) { console.error(`[ci_smoke] ÉCHEC : +NEO ${neo.toFixed(1)}% < plancher ${FLOOR_NEO}% — régression du declare ?`); ok = false; }
  if (neo <= cog)      { console.error(`[ci_smoke] ÉCHEC : +NEO (${neo.toFixed(1)}%) n'améliore pas la cognition (${cog.toFixed(1)}%)`); ok = false; }
  console.log(ok ? '[ci_smoke] OK — moteur cheat-free non régressé.' : '[ci_smoke] RÉGRESSION DÉTECTÉE.');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('[ci_smoke] ERR', e && e.stack || e); process.exit(1); });
