// OMEGA — MESURE : OS-ARB + JOINTE AU BOARD RÉEL DE L'ORIGINAL (04/11/2026, suite du chantier
// sans-longueur — AUDIT_SANS_LONGUEUR.md). MESURE PURE : aucun défaut ne change (ni la page, ni
// ci_smoke, ni la CFG des benchs) — les chiffres vont à Rem, c'est lui qui décide.
// POURQUOI : en mode sans longueur, l'arbitrage OS (J4) + la JOINTE (J7) ont porté le mode AU-DESSUS
// de la référence cheat-free. Ces voies existent déjà dans l'ORIGINAL (OFF par défaut, R66
// OFF-inertes) : que valent-elles au board réel, longueur connue ?
//
// Protocole = ci_smoke à l'identique (in-lexique K=1, warmup 120 / test 60, mots 7–12) ; CFG copiée
// de evo/sans_longueur_bench.js — GARDER SYNCHRONE. Toutes les conditions sont +NEO et CHEAT-FREE :
// M_NEO_PHON_COHORT_ENABLED=true partout (directive Rem 04/11/2026 : personne n'entend le mot).
// La condition « réf. » doit reproduire la ligne « +NEO · board RÉEL » de sans_longueur_bench
// (mêmes graines, moteur déterministe) — contrôle croisé gratuit.
//
//   node evo/osarb_board_reel_bench.js                        # l'ORIGINAL (défaut)
//   APP=app/... SL_SEEDS=... node evo/osarb_board_reel_bench.js
//
// RÈGLE PRÉ-ENREGISTRÉE (écrite AVANT de lancer, comme J6–J8) :
//   · PLACEBO = M_NEO_OS_ARB_NGRAM seul : ce toggle n'est lu que dans _neoDeclareOSmix (jamais
//     appelée sans M_NEO_OS_ARB) et dans la porte l.~7713 (court-circuitée sans M_NEO_OS_ARB).
//     Attendu : winrates IDENTIQUES par graine à la réf. Tout écart = le protocole fuit → STOP.
//   · |Δ moyenne| < 1,0 pt vs réf → BRUIT (60 parties/graine : 1 partie = ~0,4 pt ; l'écart
//     inter-graines de la réf dépasse à lui seul plusieurs points).
//   · Δ ≥ +1,0 pt ET au moins 3 graines ≥ leur réf → CANDIDAT (à proposer à Rem, pas à activer).
//   · Δ ≤ −1,0 pt → CONTRE-INDIQUÉ au board réel. Entre les deux → INDÉCIS, le dire tel quel.
//
// ⚠ CFG FIGÉE à l'état d'AVANT la décision du 04/11/2026 (Rem a activé OS_ARB+NGRAM+PHON_COHORT dans
// la CFG de ci_smoke sur la foi de CETTE mesure) : NE PAS resynchroniser — ce bench rejoue la mesure
// fondatrice, ses conditions n'ont de sens que sur la CFG d'époque (sinon « réf. » = déjà tout ON).
'use strict';
const path = require('path');
const { loadEngine } = require('./fitness_harness.js');

// Config de référence cheat-free d'AVANT la décision (voir ⚠ ci-dessus) — ne pas resynchroniser.
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

const WARMUP = +(process.env.SL_WARMUP || 120);
const TEST   = +(process.env.SL_TEST   || 60);
const SEEDS  = (process.env.SL_SEEDS || '12345,777,424242,31337').split(',').map(s => +s);
const APP    = process.env.APP
  ? path.resolve(process.cwd(), process.env.APP)
  : path.join(__dirname, '..', 'app', 'omega-pendu.html');

(async () => {
  const O = loadEngine(APP); await O.loadLex(); const ev = O.evalIn;
  const LEX = ev('OMEGA_LEX4'); const origLI = LEX.len_index, W = LEX.words;
  ev('globalThis.__play=function(w){startNewGame(w);var sf=300;while(gameActive&&sf-->0)omegaStep();return !!lastGameWon;}');
  const play = global.__play;

  function pickSets(seed) {   // miroir exact de ci_smoke / sans_longueur_bench (valid 7..12, shuffle LCG)
    const valid = [];
    for (let i = 0; i < W.length; i++){ const m = W[i] && W[i].m; if (m && m.length >= 7 && m.length <= 12 && /^[A-Z]+$/.test(m)) valid.push(i); }
    let r = (seed >>> 0); const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
    for (let i = valid.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); const t = valid[i]; valid[i] = valid[j]; valid[j] = t; }
    return { trainW: valid.slice(TEST, TEST + WARMUP).map(i => W[i].m), testW: valid.slice(0, TEST).map(i => W[i].m) };
  }

  function runCond(seed, sets, extra) {   // ORDRE CRITIQUE (AUDIT §1.4.3) : défauts, config AVANT init, puis ré-applique.
    ev('__defauts()');
    ev(CFG);
    ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();`
      + `if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();`
      + `if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
    ev(CFG);
    ev('M_NEO_PHON_COHORT_ENABLED=true;');   // cheat-free PARTOUT (directive Rem 04/11/2026)
    if (extra) ev(extra);
    if (ev("M_VOIE_PHON_ENABLED && !(typeof M1_phon!=='undefined' && M1_phon && M1_phon.output)"))
      throw new Error('voie phon ON mais buffers non alloués — ordre d\'init cassé (AUDIT §1.4.3)');
    LEX.len_index = origLI; ev(`_omegaRng=makeMulberry32(${seed});`);
    for (let i = 0; i < sets.trainW.length; i++) play(sets.trainW[i]);   // warmup DANS la même condition
    let win = 0; for (let i = 0; i < sets.testW.length; i++) if (play(sets.testW[i])) win++;
    LEX.len_index = origLI;
    return 100 * win / (sets.testW.length || 1);
  }

  const conds = [
    { nom: 'réf. cheat-free (+NEO, phon-cohorte)', extra: '' },
    { nom: 'PLACEBO (NGRAM seul, doit = réf.)   ', extra: 'M_NEO_OS_ARB_NGRAM=true;' },
    { nom: '+JOINTE (assemblé croisé)           ', extra: 'M_NEO_PHON_COHORT_JOINTE=true;' },
    { nom: '+OS_ARB (arb. jointe⟷cohorte)       ', extra: 'M_NEO_OS_ARB=true;' },
    { nom: '+OS_ARB+NGRAM (voie sub = n-gram)   ', extra: 'M_NEO_OS_ARB=true;M_NEO_OS_ARB_NGRAM=true;' },
    { nom: '+JOINTE+OS_ARB (paire du préréglage)', extra: 'M_NEO_PHON_COHORT_JOINTE=true;M_NEO_OS_ARB=true;' },
  ];

  console.log(`[osarb_bench] app=${path.relative(process.cwd(), APP)} · in-lexique K=1 · warmup ${WARMUP} / test ${TEST} · graines [${SEEDS.join(',')}] · board RÉEL, tout cheat-free`);
  const res = [];
  for (const c of conds) {
    const per = [];
    for (const seed of SEEDS) { const sets = pickSets(seed); per.push(runCond(seed, sets, c.extra)); }
    const avg = per.reduce((a, b) => a + b, 0) / per.length;
    res.push({ nom: c.nom, avg, per });
    console.log(`[osarb_bench] ${c.nom} : ${avg.toFixed(1)}%  · par graine [${per.map(v => v.toFixed(1)).join(', ')}]`);
  }
  const ref = res[0], pla = res[1];
  const placeboOK = pla.per.every((v, i) => v === ref.per[i]);
  console.log(`[osarb_bench] placebo ${placeboOK ? 'IDENTIQUE à la réf. (R66 tenu, protocole étanche)' : '≠ réf. — LE PROTOCOLE FUIT, chiffres invalides'}`);
  if (!placeboOK) process.exit(2);
})().catch(e => { console.error('[osarb_bench] ERR', e && e.stack || e); process.exit(1); });
