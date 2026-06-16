// OMEGA — A/B de REPRODUCTION : son board-dérivé (cohorte) vs son-lu (wp.get), argmax vs JOINTE.
// But : reproduire de façon DÉTERMINISTE et FALSIFIABLE les chiffres de AUDIT_OMEGA §1.1 (OOV) et §1.2 (in-lexique K=1).
//
// Réutilise le moteur HEADLESS (evo/fitness_harness.js → loadEngine + pont evalIn) et MIROITE le protocole
// du bench embarqué `_omega_trexquant_bench` (même baseCfg / warmup-test / RNG LCG / filtrage OOV).
// Il appelle le VRAI code de décision du moteur (startNewGame/omegaStep) — pas une réimplémentation de la cognition.
//
// Usage :
//   node evo/ab_cohort.js inlex [warmupN] [testN] [seeds]   # §1.2 : REF son-lu vs ARGMAX vs JOINTE, in-lexique
//   node evo/ab_cohort.js oov   [warmupN] [testN] [seeds]   # §1.1 : son-lu vs cohorte (+garde), hors-lexique
// Défauts : inlex → warmup 200 / test 100 / graines 12345,777,2024,99 ; oov → 300 / 80 / 12345,777
'use strict';
const { loadEngine } = require('./fitness_harness.js');

// Config de référence cheat-free — RECOPIÉE de docs/CONFIG_REFERENCE.md (table « 39 toggles », 22 ON / 17 OFF)
// + rapport §8.3. PAS inventée : chaque flag vient de la doc. → 97,50 % (K=1) / 98,82 % (K=3) cheat-free.
const CFG_INLEX = [
  // OFF (17) — « À LAISSER ÉTEINT » (CONFIG_REFERENCE) : triche grise + déclares non retenus + à-mesurer
  'L01_A1_M2_ORTHO_ENABLED=false','L01_A2_M4_LEX4_ENABLED=false','L01_A3_M5M_WORDLEX4_ENABLED=false','L01_B2_MOBIUS_ENABLED=false',
  'M_WORD_DECLARE_ENABLED=false','M_IG_SELECT_ENABLED=false','M_IG_PSUCCESS_ENABLED=false','M_BPC_DECLARE_ENABLED=false',
  'M_DECLARE_DUAL_ENABLED=false','M_LEARN_FROM_COGNITION_ENABLED=false','M_OS_LEARNING_ONLINE_ENABLED=false',
  'M_EMERGENT_DECLARE_ENABLED=false','M_EMERGENT_ASSEMBLED_ENABLED=false','M_EMERGENT_G2P_ONLINE=false',
  'M_NEO_MUTE_ENABLED=false','M_NEO_TRIGGER_ENABLED=false','M_TREXQUANT_MODE_ENABLED=false',
  // ON (cognition, preset §8.3)
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_BPC_READOUT_COUPLE_ENABLED=true','M_PHON_READOUT_COUPLE_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
  'M_OS_LEARNING_ENABLED=true','M_OS_LEARNING_GUARD_1_BOUNDED=true','M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true','M_OS_LEARNING_GUARD_3_MDL_REGUL=true','M_OS_LEARNING_GUARD_4_COHERENCE=true',
  // ON (declare NEO : R + Assemblé + Cohorte + g2p révélé)
  'M_DECLARE_NEO_ENABLED=true','M_NEO_RECALL_ENABLED=true','M_NEO_ASSEMBLED_ENABLED=true','M_NEO_COHORT_ENABLED=true','M_NEO_G2P_EXP_ENABLED=true',
  // params doc
  'M_DECLARE_NEO_CONF=0.75','M_DECLARE_NEO_RECALL_MARGIN=0.20','M_NEO_G2P_EXP_PEN=0.5',
  // cohorte board (sans currentWord) — ajout post-doc, piloté par condition (le SEUL changement légitime « sans currentWord »)
  'M_NEO_PHON_COHORT_PURITY=0.5','M_NEO_PHON_COHORT_JOINTE_CONF=0.30','M_NEO_PHON_COHORT_CAP=4000',
].join(';');

// Config HORS-LEXIQUE : reprend baseCfg() du bench embarqué (voie phon OFF, Mobius ON) + chaîne NEO, conf 0.60.
const CFG_OOV = [
  'L01_A1_M2_ORTHO_ENABLED=false','L01_A2_M4_LEX4_ENABLED=false','L01_A3_M5M_WORDLEX4_ENABLED=false',
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true','L01_B2_MOBIUS_ENABLED=true',
  'M_OS_V07_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_BPC_M3D_ENABLED=true','M_BPC_READOUT_COUPLE_ENABLED=true',
  'M_OS_LEARNING_ONLINE_ENABLED=true','M_OS_LEARNING_GUARD_1_BOUNDED=true','M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true','M_OS_LEARNING_GUARD_3_MDL_REGUL=true','M_OS_LEARNING_GUARD_4_COHERENCE=true',
  'M_VOIE_PHON_ENABLED=false','M4_PHON_USE_P_ENABLED=false','M_PHON_FEEDBACK_ENABLED=false','M_PHON_READOUT_COUPLE_ENABLED=false','M_PHON_CONCEPT_BIND_ENABLED=false',
  'M_DECLARE_NEO_ENABLED=true','M_NEO_RECALL_ENABLED=true','M_NEO_ASSEMBLED_ENABLED=true','M_NEO_COHORT_ENABLED=true','M_NEO_MUTE_ENABLED=false','M_NEO_TRIGGER_ENABLED=false','M_EMERGENT_DECLARE_ENABLED=true',
  'M_DECLARE_NEO_CONF=0.60','M_NEO_PHON_COHORT_PURITY=0.5','M_NEO_PHON_COHORT_CAP=4000',
].join(';');

function pad(s, n){ s = String(s); while (s.length < n) s += ' '; return s; }

(async () => {
  const mode = (process.argv[2] || 'inlex').toLowerCase();
  const oov = (mode === 'oov');
  const warmupN = +(process.argv[3] || (oov ? 300 : 200));
  const testN   = +(process.argv[4] || (oov ?  80 : 100));
  const seeds   = (process.argv[5] || (oov ? '12345,777' : '12345,777,2024,99')).split(',').map(s => +s);

  const O = loadEngine();
  await O.loadLex();
  const ev = O.evalIn;
  const LEX = ev('OMEGA_LEX4');
  const origLI = LEX.len_index;
  const W = LEX.words;

  // helper de jeu, défini DANS la portée du moteur (closure sur startNewGame/omegaStep/...).
  ev('globalThis.__play=function(w){startNewGame(w);var sf=300;while(gameActive&&sf-->0)omegaStep();return !!lastGameWon;}');
  const play = global.__play;

  // sélection de mots — MIROIR EXACT de _omega_trexquant_bench (valid 7..12, shuffle LCG seedé).
  function pickSets(seed) {
    const valid = [];
    for (let i = 0; i < W.length; i++){ const m = W[i] && W[i].m; if (m && m.length >= 7 && m.length <= 12 && /^[A-Z]+$/.test(m)) valid.push(i); }
    let r = (seed >>> 0); const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
    for (let i = valid.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); const t = valid[i]; valid[i] = valid[j]; valid[j] = t; }
    const testIdx = valid.slice(0, testN);
    const trainW  = valid.slice(testN, testN + warmupN).map(i => W[i].m);
    const testW   = testIdx.map(i => W[i].m);
    const testSet = new Set(testIdx);
    const filtered = {}; for (const k in origLI) filtered[k] = origLI[k].filter(id => !testSet.has(id));
    return { trainW, testW, filtered };
  }

  // une condition = reset complet + config + flags cohorte/jointe/morpho, warmup (lexique plein) puis test.
  function runCond(seed, sets, { cohort, jointe, morpho }) {
    ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();`
      + `if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();`
      + `if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
    ev(oov ? CFG_OOV : CFG_INLEX);
    ev(`M_NEO_PHON_COHORT_ENABLED=${!!cohort};M_NEO_PHON_COHORT_JOINTE=${!!jointe};`);
    ev(`M_NEO_MORPHO=${!!morpho};`);   // backoff dense morpho (jonction #2) — piloté par condition
    LEX.len_index = origLI;                                   // warmup : lexique plein (le mot vécu est légitime en descendant)
    ev(`_omegaRng=makeMulberry32(${seed});`);
    for (let i = 0; i < sets.trainW.length; i++) play(sets.trainW[i]);
    LEX.len_index = oov ? sets.filtered : origLI;             // test : OOV → filtré (mots retirés du lexique) ; in-lexique → plein
    let win = 0; for (let i = 0; i < sets.testW.length; i++){ if (play(sets.testW[i])) win++; }
    LEX.len_index = origLI;
    return 100 * win / sets.testW.length;
  }

  const conds = oov
    ? [ { key: 'REF  son-lu (wp.get)        ', cohort: false, jointe: false },
        { key: 'cohorte argmax + garde 0.5  ', cohort: true,  jointe: false } ]
    : (mode === 'morpho')
    ? [ { key: 'REF  son-lu (triche)        ', cohort: false, jointe: false, morpho: false },
        { key: 'jointe BIGRAMME (sans CW)   ', cohort: true,  jointe: true,  morpho: false },
        { key: 'jointe + MORPHO dense (sCW) ', cohort: true,  jointe: true,  morpho: true  } ]
    : [ { key: 'REF  son-lu (wp.get·triche) ', cohort: false, jointe: false },
        { key: 'cohorte ARGMAX (board)      ', cohort: true,  jointe: false },
        { key: 'cohorte JOINTE @0.30        ', cohort: true,  jointe: true  } ];

  console.log(`\n=== A/B cohorte — mode ${oov ? 'HORS-LEXIQUE (§1.1)' : 'IN-LEXIQUE K=1 (§1.2)'} · warmup ${warmupN} / test ${testN} · graines [${seeds.join(',')}] ===`);
  const rows = conds.map(c => ({ key: c.key, vals: [] }));
  for (const seed of seeds) {
    const sets = pickSets(seed);
    for (let ci = 0; ci < conds.length; ci++) {
      const t0 = Date.now();
      const wr = runCond(seed, sets, conds[ci]);
      rows[ci].vals.push(wr);
      process.stderr.write(`  [seed ${seed}] ${conds[ci].key.trim()} = ${wr.toFixed(1)}%  (${((Date.now()-t0)/1000).toFixed(1)}s)\n`);
    }
  }
  console.log('\n  condition                      ' + seeds.map(s => pad(s, 8)).join('') + '  moyenne');
  for (const row of rows) {
    const mean = row.vals.reduce((a, b) => a + b, 0) / row.vals.length;
    console.log('  ' + row.key + '  ' + row.vals.map(v => pad(v.toFixed(1) + '%', 8)).join('') + '  ' + mean.toFixed(1) + '%');
  }
  // Δ falsifiables
  const mean = i => rows[i].vals.reduce((a, b) => a + b, 0) / rows[i].vals.length;
  if (oov) {
    console.log(`\n  Δ cohorte − son-lu (coût d'honnêteté OOV) : ${(mean(1)-mean(0)).toFixed(1)} pts`);
  } else {
    const a = rows[2].key.trim(), b = rows[1].key.trim();
    const perSeed = rows[2].vals.map((v, i) => v - rows[1].vals[i]);
    console.log(`\n  Δ « ${a} » − « ${b} » : moyenne ${(mean(2)-mean(1)).toFixed(1)} pts · par graine [${perSeed.map(d => (d>=0?'+':'')+d.toFixed(1)).join(', ')}]`);
    console.log(`  Δ « ${a} » − son-lu (écart résiduel) : ${(mean(2)-mean(0)).toFixed(1)} pts`);
    const allWin = perSeed.every(d => d > 0), noLoss = perSeed.every(d => d >= 0);
    console.log(`  → bat à CHAQUE graine ? ${allWin ? 'OUI' : (noLoss ? 'égalité au pire' : 'NON')}  (barrière §6.4 : gardé seulement si ≥ 0 partout et moyenne > 0)`);
  }
})().catch(e => { console.error('ERR', e && e.stack || e); process.exit(1); });
