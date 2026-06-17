// OMEGA — A/B JONCTION M1_m : la co-décision descendante ortho (M5_D_M1_M_WEIGHT=0,1, F198) gagne-t-elle ses 0,1 ?
// Audit 2026-06-17 §1.4/D2 : M1_m co-décide M5 à 0,1 (pas 0,0). Toggle R66 `M5_D_M1_M_ENABLED` ajouté (défaut ON).
// Ici : mesure du Δ (M1_m ON − OFF), in-lexique K=1, déterministe — teste l'hypothèse "feedback IA top-down lettre" (DRC).
//
// Réutilise le moteur HEADLESS (evo/fitness_harness.js → loadEngine + pont evalIn) et le protocole warmup/test de
// evo/ab_cohort.js (même pickSets miroir _omega_trexquant_bench, RNG LCG seedé). Appelle le VRAI code de décision.
//
// Usage :
//   node evo/ab_m1m.js [cog|ref|both] [warmupN] [testN] [seeds]
// Défauts : both · warmup 200 / test 100 · graines 12345,777,2024,99
'use strict';
const { loadEngine } = require('./fitness_harness.js');

// Config IN-LEXIQUE de référence (copie CONFIG_REFERENCE §8.3 / ab_cohort.js CFG_INLEX : voie phon ON, A1/A2/A3 OFF).
const CFG_REF = [
  'L01_A1_M2_ORTHO_ENABLED=false','L01_A2_M4_LEX4_ENABLED=false','L01_A3_M5M_WORDLEX4_ENABLED=false',
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_BPC_READOUT_COUPLE_ENABLED=true','M_PHON_READOUT_COUPLE_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
  'M_OS_LEARNING_ENABLED=true','M_OS_LEARNING_GUARD_1_BOUNDED=true','M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true','M_OS_LEARNING_GUARD_3_MDL_REGUL=true','M_OS_LEARNING_GUARD_4_COHERENCE=true','M_OS_LEARNING_ONLINE_ENABLED=false',
  'M_WORD_DECLARE_ENABLED=false','M_BPC_DECLARE_ENABLED=false','M_DECLARE_DUAL_ENABLED=false','M_EMERGENT_DECLARE_ENABLED=false',
  'M_DECLARE_NEO_ENABLED=true','M_NEO_RECALL_ENABLED=true','M_NEO_ASSEMBLED_ENABLED=true','M_NEO_COHORT_ENABLED=true','M_NEO_G2P_EXP_ENABLED=true','M_NEO_MUTE_ENABLED=false','M_NEO_TRIGGER_ENABLED=false',
  'M_DECLARE_NEO_CONF=0.75','M_DECLARE_NEO_RECALL_MARGIN=0.20','M_NEO_G2P_EXP_PEN=0.5',
  'M_NEO_PHON_COHORT_PURITY=0.5','M_NEO_PHON_COHORT_JOINTE_CONF=0.30','M_NEO_PHON_COHORT_CAP=4000',
].join(';');

// Cognition SEULE = la référence MOINS la cascade de declares (isole l'effet per-lettre de M1_m, non masqué par les declares).
const CFG_COG = CFG_REF + ';' + [
  'M_DECLARE_NEO_ENABLED=false','M_NEO_RECALL_ENABLED=false','M_NEO_ASSEMBLED_ENABLED=false','M_NEO_COHORT_ENABLED=false','M_NEO_G2P_EXP_ENABLED=false',
].join(';');

function pad(s, n){ s = String(s); while (s.length < n) s += ' '; return s; }

(async () => {
  const mode    = (process.argv[2] || 'both').toLowerCase();
  const warmupN = +(process.argv[3] || 200);
  const testN   = +(process.argv[4] || 100);
  const seeds   = (process.argv[5] || '12345,777,2024,99').split(',').map(s => +s);

  const O = loadEngine();
  await O.loadLex();
  const ev = O.evalIn;
  const LEX = ev('OMEGA_LEX4');
  const origLI = LEX.len_index;
  const W = LEX.words;

  // garde-fou : le toggle doit exister dans le build (sinon la mesure est nulle).
  if (ev("typeof M5_D_M1_M_ENABLED") !== 'boolean') { console.error('ERR: M5_D_M1_M_ENABLED absent du build — toggle non posé.'); process.exit(1); }

  ev('globalThis.__play=function(w){startNewGame(w);var sf=300;while(gameActive&&sf-->0)omegaStep();return !!lastGameWon;}');
  const play = global.__play;

  // sélection de mots — MIROIR EXACT de _omega_trexquant_bench / ab_cohort.js (valid 7..12, shuffle LCG seedé).
  function pickSets(seed) {
    const valid = [];
    for (let i = 0; i < W.length; i++){ const m = W[i] && W[i].m; if (m && m.length >= 7 && m.length <= 12 && /^[A-Z]+$/.test(m)) valid.push(i); }
    let r = (seed >>> 0); const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
    for (let i = valid.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); const t = valid[i]; valid[i] = valid[j]; valid[j] = t; }
    const trainW = valid.slice(testN, testN + warmupN).map(i => W[i].m);
    const testW  = valid.slice(0, testN).map(i => W[i].m);
    return { trainW, testW };
  }

  // une condition = reset complet + config + flag M1_m, warmup puis test (in-lexique : lexique plein partout).
  function runCond(seed, sets, cfg, m1m) {
    ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();`
      + `if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();`
      + `if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
    ev(cfg);
    ev(`M5_D_M1_M_ENABLED=${!!m1m};`);
    LEX.len_index = origLI;
    ev(`_omegaRng=makeMulberry32(${seed});`);
    for (let i = 0; i < sets.trainW.length; i++) play(sets.trainW[i]);
    let win = 0; for (let i = 0; i < sets.testW.length; i++){ if (play(sets.testW[i])) win++; }
    return 100 * win / sets.testW.length;
  }

  const configs = mode === 'cog' ? [['cognition seule', CFG_COG]]
                : mode === 'ref' ? [['référence (+NEO)', CFG_REF]]
                : [['cognition seule', CFG_COG], ['référence (+NEO)', CFG_REF]];

  console.log(`\n=== A/B JONCTION M1_m — in-lexique K=1 · warmup ${warmupN} / test ${testN} · graines [${seeds.join(',')}] ===`);
  console.log('   Hypothèse : la co-décision descendante M1_m (0,1, feedback top-down lettre type IA/DRC) bat son OFF.\n');

  for (const [label, cfg] of configs) {
    const onVals = [], offVals = [];
    for (const seed of seeds) {
      const sets = pickSets(seed);
      const wOn  = runCond(seed, sets, cfg, true);
      const wOff = runCond(seed, sets, cfg, false);
      onVals.push(wOn); offVals.push(wOff);
      process.stderr.write(`  [${label}] seed ${seed} : ON ${wOn.toFixed(1)}%  OFF ${wOff.toFixed(1)}%  Δ ${(wOn-wOff>=0?'+':'')}${(wOn-wOff).toFixed(1)}\n`);
    }
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const perSeed = onVals.map((v, i) => v - offVals[i]);
    const dMean = mean(onVals) - mean(offVals);
    console.log(`  ── ${label} ──`);
    console.log('    condition          ' + seeds.map(s => pad(s, 8)).join('') + '  moyenne');
    console.log('    M1_m ON  (0,1)     ' + onVals.map(v => pad(v.toFixed(1)+'%', 8)).join('') + '  ' + mean(onVals).toFixed(1) + '%');
    console.log('    M1_m OFF (0,0)     ' + offVals.map(v => pad(v.toFixed(1)+'%', 8)).join('') + '  ' + mean(offVals).toFixed(1) + '%');
    console.log(`    Δ ON−OFF : moyenne ${(dMean>=0?'+':'')}${dMean.toFixed(1)} pts · par graine [${perSeed.map(d => (d>=0?'+':'')+d.toFixed(1)).join(', ')}]`);
    const wins = perSeed.filter(d => d > 0).length, ties = perSeed.filter(d => d === 0).length, losses = perSeed.filter(d => d < 0).length;
    console.log(`    → ON > OFF : ${wins} graines · égalité ${ties} · ON < OFF : ${losses}\n`);
  }
})().catch(e => { console.error('ERR', e && e.stack || e); process.exit(1); });
