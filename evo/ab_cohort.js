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
  ev('globalThis.__play=function(w){startNewGame(w);var sf=300,lc=0,le=0;while(gameActive&&sf-->0){omegaStep();var c=0,e=0;for(var i=0;i<26;i++){if(alreadyTried[i]){c++;if(currentWord.indexOf(String.fromCharCode(65+i))<0)e++;}}if(c>0){lc=c;le=e;}}return {won:!!lastGameWon,coups:lc,err:le};}');
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

  // une condition = reset complet + config + flags cohorte/jointe/cross-modal/dual/osarb, warmup (lexique plein) puis test.
  // ORDRE CRITIQUE (corrigé 2026-06-17, AUDIT §1.4.3) : les buffers de la voie phon ne sont alloués
  //   QUE si M_VOIE_PHON_ENABLED est vrai À initOmegaGlobals (app ~2768). Donc config AVANT init,
  //   puis ré-application défensive après init, sinon la voie phon tourne INERTE (buffers null) en silence.
  function runCond(seed, sets, { cohort, jointe, xmodal, dual, freqonly, osarb, arbA, arbB }) {
    ev(oov ? CFG_OOV : CFG_INLEX);                            // (1) toggles d'abord → init bâtit la voie phon
    ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();`
      + `if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();`
      + `if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
    ev(oov ? CFG_OOV : CFG_INLEX);                            // (2) ré-applique après init (défensif)
    ev(`M_NEO_PHON_COHORT_ENABLED=${!!cohort};M_NEO_PHON_COHORT_JOINTE=${!!jointe};`);
    // garde anti-inerte : si la voie phon est censée être ON, ses buffers DOIVENT exister (sinon §1.4.3 null muet).
    if (ev("M_VOIE_PHON_ENABLED && !(typeof M1_phon!=='undefined' && M1_phon && M1_phon.output)")) {
      throw new Error('voie phon ON mais buffers non alloués — ordre d\'init cassé (AUDIT §1.4.3)');
    }
    ev(`M_BPC_CROSSMODAL_ENABLED=${!!xmodal};`);   // croisement dormant : M3_d perçoit M1_d ⊕ M1_phon (hub-and-spoke, descendant bPC)
    ev(`M_DECLARE_DUAL_ENABLED=${!!dual};`);        // DUAL : declare cohorte-board (freq × ortho × phon), cheat-free, sans currentWord ; conf/poids aux défauts 0,85/0,50/0,25
    if (dual) ev(`M_DECLARE_DUAL_WORTHO=${freqonly?0:0.50};M_DECLARE_DUAL_WPHON=${freqonly?0:0.25};`);   // freqonly → wO=wP=0 : DUAL = PRIOR FRÉQUENCE pur sur la cohorte (aucune somme ortho+phon ; teste si le gain est propre)
    ev(`M_NEO_OS_ARB=${!!osarb};`);                 // arbitrage OS des 2 voies DRC (mélange convexe sublexical⟷lexical) au lieu de la cascade
    if (osarb) ev(`M_NEO_OS_ARB_ALPHA=${arbA==null?1:arbA};M_NEO_OS_ARB_BETA=${arbB==null?1:arbB};`);   // (α,β) PROPRES au declare, mesure §1.6 (défaut 1/1 = neutre)
    LEX.len_index = origLI;                                   // warmup : lexique plein (le mot vécu est légitime en descendant)
    ev(`_omegaRng=makeMulberry32(${seed});`);
    for (let i = 0; i < sets.trainW.length; i++) play(sets.trainW[i]);
    LEX.len_index = oov ? sets.filtered : origLI;             // test : OOV → filtré (mots retirés du lexique) ; in-lexique → plein
    let win = 0, sumC = 0, sumE = 0; const n = sets.testW.length || 1;
    for (let i = 0; i < sets.testW.length; i++){ const x = play(sets.testW[i]); if (x.won) win++; sumC += x.coups; sumE += x.err; }
    LEX.len_index = origLI;
    return { wr: 100*win/n, err: sumE/n, coups: sumC/n };
  }

  const conds = oov
    ? [ { key: 'REF  son-lu (wp.get)        ', cohort: false, jointe: false },
        { key: 'cohorte argmax + garde 0.5  ', cohort: true,  jointe: false } ]
    : (mode === 'xmodal')
    ? [ { key: 'config réf. (cross-modal OFF)', cohort: false, jointe: false, xmodal: false },
        { key: 'config réf. + CROSS-MODAL ON ', cohort: false, jointe: false, xmodal: true  } ]
    : (mode === 'dual')
    ? [ { key: 'NEO seul (config réf.)      ', cohort: false, jointe: false, dual: false },
        { key: 'NEO + DUAL (filet cohorte)  ', cohort: false, jointe: false, dual: true  } ]
    : (mode === 'dualncw')
    ? [ { key: 'NEO cohorte-jointe (sans CW)', cohort: true,  jointe: true,  dual: false },
        { key: 'NEO cohorte-jointe + DUAL   ', cohort: true,  jointe: true,  dual: true  } ]
    : (mode === 'dualfreq')
    ? [ { key: 'cohorte-jointe (sans CW)    ', cohort: true,  jointe: true,  dual: false },
        { key: 'cohorte-jointe + DUAL freq-seule', cohort: true, jointe: true, dual: true, freqonly: true } ]
    : (mode === 'arb')
    ? [ { key: 'cohorte-jointe (cascade, base)', cohort: true, jointe: true },
        { key: 'cohorte-jointe + DUAL (cascade)', cohort: true, jointe: true, dual: true },
        { key: 'cohorte-jointe + ARBITRAGE OS ', cohort: true, jointe: true, osarb: true } ]
    : (mode === 'arbsweep')
    ? [ { key: 'DUAL (incumbent)             ', cohort: true, jointe: true, dual: true },
        { key: 'cascade jointe (base)        ', cohort: true, jointe: true },
        { key: 'OS-arb a1.0 b1.0 (neutre)    ', cohort: true, jointe: true, osarb: true, arbA: 1.0, arbB: 1.0 },
        { key: 'OS-arb a1.0 b0.5 (+lexical)  ', cohort: true, jointe: true, osarb: true, arbA: 1.0, arbB: 0.5 },
        { key: 'OS-arb a2.0 b0.5 (+lex raide)', cohort: true, jointe: true, osarb: true, arbA: 2.0, arbB: 0.5 } ]
    : [ { key: 'REF  son-lu (wp.get·triche) ', cohort: false, jointe: false },
        { key: 'cohorte ARGMAX (board)      ', cohort: true,  jointe: false },
        { key: 'cohorte JOINTE @0.30        ', cohort: true,  jointe: true  } ];

  console.log(`\n=== A/B cohorte — mode ${oov ? 'HORS-LEXIQUE (§1.1)' : 'IN-LEXIQUE K=1 (§1.2)'} · warmup ${warmupN} / test ${testN} · graines [${seeds.join(',')}] ===`);
  const rows = conds.map(c => ({ key: c.key, vals: [], errs: [], coups: [] }));
  for (const seed of seeds) {
    const sets = pickSets(seed);
    for (let ci = 0; ci < conds.length; ci++) {
      const t0 = Date.now();
      const r = runCond(seed, sets, conds[ci]);
      rows[ci].vals.push(r.wr); rows[ci].errs.push(r.err); rows[ci].coups.push(r.coups);
      process.stderr.write(`  [seed ${seed}] ${conds[ci].key.trim()} = ${r.wr.toFixed(1)}% · err ${r.err.toFixed(2)} · coups ${r.coups.toFixed(2)}  (${((Date.now()-t0)/1000).toFixed(1)}s)\n`);
    }
  }
  console.log('\n  condition                      ' + seeds.map(s => pad(s, 8)).join('') + '  moyenne');
  for (const row of rows) {
    const mean = row.vals.reduce((a, b) => a + b, 0) / row.vals.length;
    console.log('  ' + row.key + '  ' + row.vals.map(v => pad(v.toFixed(1) + '%', 8)).join('') + '  ' + mean.toFixed(1) + '%');
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  console.log('\n  tri-critère (moyenne graines) — winrate · erreurs/partie · coups/partie (↓ = plus efficace) :');
  for (const row of rows) {
    console.log('  ' + row.key + '  ' + pad(avg(row.vals).toFixed(1) + '%', 8) + ' · err ' + pad(avg(row.errs).toFixed(2), 6) + ' · coups ' + avg(row.coups).toFixed(2));
  }
  // Δ falsifiables
  const mean = i => rows[i].vals.reduce((a, b) => a + b, 0) / rows[i].vals.length;
  if (mode === 'arbsweep') {   // incumbent = DUAL (rows[0]) ; chaque OS-arb (rows>=2) vs DUAL, barrière §6.4
    console.log("\n  Barrière de mérite §6.4 — un OS-arb ne se garde que s'il bat DUAL à CHAQUE graine ET en moyenne :");
    for (let i = 2; i < rows.length; i++) {
      const d = rows[i].vals.map((v, k) => v - rows[0].vals[k]);
      const allWin = d.every(x => x > 0), noLoss = d.every(x => x >= 0);
      console.log('  ' + rows[i].key + ' − DUAL : moy ' + (mean(i)-mean(0)>=0?'+':'') + (mean(i)-mean(0)).toFixed(1) + ' pts · [' + d.map(x=>(x>=0?'+':'')+x.toFixed(1)).join(', ') + ']  → ' + (allWin ? 'BAT DUAL partout' : (noLoss ? 'égalité au pire' : 'NON')));
    }
  } else if (rows.length === 2) {   // 2 conditions (oov / xmodal) : Δ 2e − 1re, par graine + barrière de mérite §6.4
    const a = rows[1].key.trim(), b = rows[0].key.trim();
    const perSeed = rows[1].vals.map((v, i) => v - rows[0].vals[i]);
    console.log(`\n  Δ « ${a} » − « ${b} » : moyenne ${(mean(1)-mean(0)).toFixed(1)} pts · par graine [${perSeed.map(d => (d>=0?'+':'')+d.toFixed(1)).join(', ')}]`);
    const allWin = perSeed.every(d => d > 0), noLoss = perSeed.every(d => d >= 0);
    console.log(`  → bat à CHAQUE graine ? ${allWin ? 'OUI' : (noLoss ? 'égalité au pire' : 'NON')}  (gardé seulement si ≥ 0 partout et moyenne > 0)`);
  } else {   // 3 conditions : Δ de la 3e vs la 2e ET vs la 1re (générique, libellés des conditions)
    const c2 = rows[2].key.trim(), c1 = rows[1].key.trim(), c0 = rows[0].key.trim();
    const d21 = rows[2].vals.map((v, i) => v - rows[1].vals[i]);
    const d20 = rows[2].vals.map((v, i) => v - rows[0].vals[i]);
    console.log(`\n  Δ « ${c2} » − « ${c1} » : moyenne ${(mean(2)-mean(1)).toFixed(1)} pts · par graine [${d21.map(d => (d>=0?'+':'')+d.toFixed(1)).join(', ')}]`);
    console.log(`  Δ « ${c2} » − « ${c0} » : moyenne ${(mean(2)-mean(0)).toFixed(1)} pts · par graine [${d20.map(d => (d>=0?'+':'')+d.toFixed(1)).join(', ')}]`);
    const allWin = d20.every(d => d > 0), noLoss = d20.every(d => d >= 0);
    console.log(`  → « ${c2} » bat la base à CHAQUE graine ? ${allWin ? 'OUI' : (noLoss ? 'égalité au pire' : 'NON')}  (barrière §6.4)`);
  }
})().catch(e => { console.error('ERR', e && e.stack || e); process.exit(1); });
