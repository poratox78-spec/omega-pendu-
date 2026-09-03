// OMEGA — A/B APPARIÉ du pendu (outil, hors batterie). Mêmes mots, mêmes graines, issue par MOT : on compte les paires
// DISCORDANTES (référence gagne / variante perd, et l'inverse) et on donne le test exact (McNemar binomial). Plus puissant
// que deux Wilson sur les marges : les mots gagnés des deux côtés ne comptent pas. Né le 03/09/2026 pour trancher les
// « boucles fermées » (Möbius ortho L01_B2, co-décision M5_D_M1_M, Möbius phon expérimental) : toutes dans le bruit
// (cf. dictee/JOURNAL.md). Une variante = une liste `TOGGLE=valeur;…` appliquée par-dessus la config de référence de ci_smoke.
//   Usage : node evo/pendu_paired_ab.js            (env AB_TEST=1000 AB_SEEDS=12345,777,4242 AB_NEO=0|1
//           AB_VARS="L01_B2_MOBIUS_ENABLED=true|M5_D_M1_M_ENABLED=true")
'use strict';
const { loadEngine } = require('./fitness_harness.js');
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/ci_smoke.js', 'utf8');   // la config de référence, lue à la source (jamais recopiée)
const CFG = eval('[' + src.match(/const CFG = \[([\s\S]*?)\]\.join\(';'\);/)[1] + ']').join(';');

const WARMUP = +(process.env.AB_WARMUP || 120);
const TEST   = +(process.env.AB_TEST   || 1000);
const SEEDS  = (process.env.AB_SEEDS || '12345,777,4242').split(',').map(s => +s);
const NEO    = process.env.AB_NEO === '1';
const VARS   = (process.env.AB_VARS || 'L01_B2_MOBIUS_ENABLED=true|M5_D_M1_M_ENABLED=true').split('|');

function binomTwoSided(k, n) {   // P(X <= min(k, n-k)) * 2 sous H0 p=0.5 (exact, log-space)
  if (!n) return 1; const m = Math.min(k, n - k); let lc = 0, s = 0;
  const logC = (n, i) => { let r = 0; for (let j = 1; j <= i; j++) r += Math.log(n - i + j) - Math.log(j); return r; };
  for (let i = 0; i <= m; i++) s += Math.exp(logC(n, i) - n * Math.LN2);
  return Math.min(1, 2 * s);
}

(async () => {
  const O = loadEngine(); await O.loadLex(); const ev = O.evalIn;
  const LEX = ev('OMEGA_LEX4'); const origLI = LEX.len_index, W = LEX.words;
  ev('globalThis.__play=function(w){startNewGame(w);var sf=300;while(gameActive&&sf-->0)omegaStep();return !!lastGameWon;}');
  const play = global.__play;
  function pickSets(seed) {
    const valid = [];
    for (let i = 0; i < W.length; i++) { const m = W[i] && W[i].m; if (m && m.length >= 7 && m.length <= 12 && /^[A-Z]+$/.test(m)) valid.push(i); }
    let r = (seed >>> 0); const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
    for (let i = valid.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = valid[i]; valid[i] = valid[j]; valid[j] = t; }
    return { trainW: valid.slice(TEST, TEST + WARMUP).map(i => W[i].m), testW: valid.slice(0, TEST).map(i => W[i].m) };
  }
  function runCond(seed, sets, set) {   // rend le vecteur des issues par mot de test
    ev(CFG); if (set) ev(set);
    ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();`
      + `if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();`
      + `if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
    ev(CFG); if (set) ev(set);
    ev(`M_DECLARE_NEO_ENABLED=${NEO};`);
    LEX.len_index = origLI; ev(`_omegaRng=makeMulberry32(${seed});`);
    for (let i = 0; i < sets.trainW.length; i++) play(sets.trainW[i]);
    const out = []; for (let i = 0; i < sets.testW.length; i++) out.push(play(sets.testW[i]) ? 1 : 0);
    LEX.len_index = origLI; return out;
  }
  console.log(`A/B APPARIÉ · ${NEO ? '+NEO (config réf.)' : 'cognition seule'} · warmup ${WARMUP} / test ${TEST} × graines [${SEEDS.join(',')}] = ${TEST * SEEDS.length} mots par condition`);
  const sets = {}; for (const s of SEEDS) sets[s] = pickSets(s);
  const base = {}; let t0 = Date.now(); for (const s of SEEDS) base[s] = runCond(s, sets[s], '');
  const nb = Object.values(base).flat().reduce((a, b) => a + b, 0), N = TEST * SEEDS.length;
  console.log(`E0 référence : ${nb}/${N} = ${(100 * nb / N).toFixed(2)} %  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  for (const v of VARS) {
    t0 = Date.now(); let win = 0, vGagne = 0, vPerd = 0; const exemples = { g: [], p: [] };
    for (const s of SEEDS) { const r = runCond(s, sets[s], v); const b = base[s];
      for (let i = 0; i < r.length; i++) { win += r[i]; if (r[i] && !b[i]) { vGagne++; if (exemples.g.length < 6) exemples.g.push(sets[s].testW[i]); } else if (!r[i] && b[i]) { vPerd++; if (exemples.p.length < 6) exemples.p.push(sets[s].testW[i]); } } }
    const disc = vGagne + vPerd, p = binomTwoSided(vGagne, disc);
    console.log(`${v}\n   ${win}/${N} = ${(100 * win / N).toFixed(2)} %  · écart ${((win - nb) * 100 / N).toFixed(2)} pt  · paires discordantes ${disc} (variante gagne ${vGagne} / perd ${vPerd})  · McNemar exact p = ${p.toFixed(3)}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    console.log(`   mots gagnés par la variante : ${exemples.g.join(', ') || '—'}\n   mots perdus par la variante : ${exemples.p.join(', ') || '—'}`);
  }
  process.exit(0);
})().catch(e => { console.error('ERR', e && e.stack || e); process.exit(1); });
