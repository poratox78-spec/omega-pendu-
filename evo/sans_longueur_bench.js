// OMEGA — BENCH DU MODE SANS LONGUEUR (J1+, AUDIT_SANS_LONGUEUR.md). Moteur COMPLET config de
// référence, jamais un morceau (consigne Rem 03/11/2026). Protocole = ci_smoke.js à l'identique
// (in-lexique K=1, warmup 120 / test 60, graines 12345+777, mots 7–12) ; CFG copiée de ci_smoke —
// GARDER SYNCHRONE. S'ajoutent : __defauts() entre conditions (bancs honnêtes ①, le bench enchaîne
// plusieurs modes dans un même moteur) et la condition M_SANS_LONGUEUR_ENABLED=true (board virtuel).
//
//   node evo/sans_longueur_bench.js                                   # la COPIE : OFF (inertie) puis ON (le mode)
//   APP=app/omega-pendu.html node evo/sans_longueur_bench.js          # l'ORIGINAL : référence
//
// PREUVE D'INERTIE (R66) : la copie mode OFF doit rendre EXACTEMENT les winrates de l'original
// (mêmes graines, moteur déterministe). Tout écart = la couture fuit — ne pas merger.
//
// Divergence SOLDÉE (décision Rem 04/11/2026) : ci_smoke lui-même est devenu cheat-free
// (M_NEO_PHON_COHORT_ENABLED dans sa CFG) et a gagné l'arbitrage OS n-gram (M_NEO_OS_ARB +
// M_NEO_OS_ARB_NGRAM) — la CFG ci-dessous est resynchronisée. En MODE les 3 toggles sont des no-ops
// (la couture force déjà le son board-dérivé, et la porte de l'arbitrage passe par M_SANS_LONGUEUR_
// ENABLED ; _useNG couvert par _slOn) — vérifié au re-run : parties du mode identiques par graine.
// Ancienne référence « mot entendu » (CFG ci_smoke d'avant, +NEO board réel 99,6 %) : ne plus la citer.
'use strict';
const path = require('path');
const { loadEngine } = require('./fitness_harness.js');

// Config de référence cheat-free — copiée de evo/ci_smoke.js (elle-même de docs/CONFIG_REFERENCE.md).
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
  'M_NEO_PHON_COHORT_ENABLED=true','M_NEO_OS_ARB=true','M_NEO_OS_ARB_NGRAM=true',   // décision Rem 04/11/2026 — resynchronisé sur ci_smoke
  'M_DECLARE_NEO_CONF=0.75','M_DECLARE_NEO_RECALL_MARGIN=0.20','M_NEO_G2P_EXP_PEN=0.5',
].join(';');

const WARMUP = +(process.env.SL_WARMUP || 120);
const TEST   = +(process.env.SL_TEST   || 60);
const SEEDS  = (process.env.SL_SEEDS || '12345,777').split(',').map(s => +s);
const APP    = process.env.APP
  ? path.resolve(process.cwd(), process.env.APP)
  : path.join(__dirname, '..', 'app', 'omega-pendu-sans-longueur.html');

(async () => {
  const O = loadEngine(APP); await O.loadLex(); const ev = O.evalIn;
  const LEX = ev('OMEGA_LEX4'); const origLI = LEX.len_index, W = LEX.words;
  ev('globalThis.__play=function(w){startNewGame(w);var sf=300;while(gameActive&&sf-->0)omegaStep();return !!lastGameWon;}');
  const play = global.__play;
  const hasSL = ev("typeof M_SANS_LONGUEUR_ENABLED !== 'undefined'");

  function pickSets(seed) {   // miroir exact de ci_smoke / ab_cohort (valid 7..12, shuffle LCG)
    const valid = [];
    for (let i = 0; i < W.length; i++){ const m = W[i] && W[i].m; if (m && m.length >= 7 && m.length <= 12 && /^[A-Z]+$/.test(m)) valid.push(i); }
    let r = (seed >>> 0); const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
    for (let i = valid.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); const t = valid[i]; valid[i] = valid[j]; valid[j] = t; }
    return { trainW: valid.slice(TEST, TEST + WARMUP).map(i => W[i].m), testW: valid.slice(0, TEST).map(i => W[i].m) };
  }

  function runCond(seed, sets, neo, sl) {   // ORDRE CRITIQUE (AUDIT §1.4.3) : défauts, config AVANT init, puis ré-applique.
    ev('__defauts()');
    ev(CFG);
    ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();`
      + `if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();`
      + `if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
    ev(CFG);
    ev(`M_DECLARE_NEO_ENABLED=${!!neo};`);
    // (04/11/2026) Le cheat-free n'est plus posé ici : M_NEO_PHON_COHORT_ENABLED vit dans la CFG
    // elle-même depuis que ci_smoke l'a adopté (décision Rem) — personne n'entend le mot.
    if (sl) ev('M_SANS_LONGUEUR_ENABLED=true;');   // APRÈS init+CFG : la couture est purement runtime, rien à bâtir
    if (ev("M_VOIE_PHON_ENABLED && !(typeof M1_phon!=='undefined' && M1_phon && M1_phon.output)"))
      throw new Error('voie phon ON mais buffers non alloués — ordre d\'init cassé (AUDIT §1.4.3)');
    LEX.len_index = origLI; ev(`_omegaRng=makeMulberry32(${seed});`);
    for (let i = 0; i < sets.trainW.length; i++) play(sets.trainW[i]);   // warmup DANS le même mode (expérience cohérente)
    let win = 0; for (let i = 0; i < sets.testW.length; i++) if (play(sets.testW[i])) win++;
    LEX.len_index = origLI;
    return 100 * win / (sets.testW.length || 1);
  }

  const conds = [
    { nom: 'cognition seule · board RÉEL   ', neo: false, sl: false },
    { nom: '+NEO config réf. · board RÉEL   ', neo: true,  sl: false },
  ];
  if (hasSL) conds.push(
    { nom: 'cognition seule · SANS longueur', neo: false, sl: true },
    { nom: '+NEO config réf. · SANS longueur', neo: true,  sl: true },
  );

  console.log(`[sl_bench] app=${path.relative(process.cwd(), APP)} · in-lexique K=1 · warmup ${WARMUP} / test ${TEST} · graines [${SEEDS.join(',')}]`
    + (hasSL ? '' : ' · (pas de toggle sans-longueur dans cette app : référence seule)'));
  for (const c of conds) {
    const per = [];
    for (const seed of SEEDS) { const sets = pickSets(seed); per.push(runCond(seed, sets, c.neo, c.sl)); }
    const avg = per.reduce((a, b) => a + b, 0) / per.length;
    console.log(`[sl_bench] ${c.nom} : ${avg.toFixed(1)}%  · par graine [${per.map(v => v.toFixed(1)).join(', ')}]`);
  }
})().catch(e => { console.error('[sl_bench] ERR', e && e.stack || e); process.exit(1); });
