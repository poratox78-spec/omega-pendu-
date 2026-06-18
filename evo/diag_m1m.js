// OMEGA — DIAGNOSTIC du POURQUOI : que porte réellement M1_m.letterScore au moment de décider ?
// Hypothèse (audit §1.4.1, code 2026-06-17) : M1_m.letterScore = 1 − M4_m.letterPenalty, où letterPenalty
//   homéostate vers letterTarget = PRIOR GLOBAL de fréquence inverse (init 2904-2921). Donc M1_m porterait
//   un prior de fréquence GLOBAL (context-free), redondant avec les 30% fréquence-lettre déjà dans M4_d —
//   ET il ne lit ni M3_m (concept) ni M2_m (position) : la correction concept→lettre n'atteint pas la décision.
//
// Mesure (R67 lecture seule — currentWord lu pour INSTRUMENTER, jamais pour décider) :
//   (1) discrimination = moyenne(ls | lettre ∈ mot, non essayée) − moyenne(ls | lettre ∉ mot, non essayée).
//       Si ≈ 0 → M1_m ne pointe PAS vers les lettres du mot (prior plat). Comparé au prior de fréquence brut.
//   (2) corrélation(ls au tick 0, prior 1−letterTarget) → si ≈ 1, ls EST le prior de fréquence.
//   (3) variance de ls[l] ENTRE mots au tick 0 → si ≈ 0, ls est un vecteur GLOBAL (mêmes valeurs quel que soit le mot).
//
// Usage : node evo/diag_m1m.js [warmupN] [testN] [seed]   (défauts 200 / 80 / 12345)
'use strict';
const { loadEngine } = require('./fitness_harness.js');

const CFG_COG = [
  'L01_A1_M2_ORTHO_ENABLED=false','L01_A2_M4_LEX4_ENABLED=false','L01_A3_M5M_WORDLEX4_ENABLED=false',
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_BPC_READOUT_COUPLE_ENABLED=true','M_PHON_READOUT_COUPLE_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
  'M_OS_LEARNING_ENABLED=true','M_OS_LEARNING_GUARD_1_BOUNDED=true','M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true','M_OS_LEARNING_GUARD_3_MDL_REGUL=true','M_OS_LEARNING_GUARD_4_COHERENCE=true',
  'M_DECLARE_NEO_ENABLED=false','M_NEO_RECALL_ENABLED=false','M_NEO_ASSEMBLED_ENABLED=false','M_NEO_COHORT_ENABLED=false','M_NEO_G2P_EXP_ENABLED=false',
].join(';');

function pearson(a, b) {
  const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++){ ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
  let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++){ const x = a[i]-ma, y = b[i]-mb; num += x*y; da += x*x; db += y*y; }
  return (da > 1e-12 && db > 1e-12) ? num / Math.sqrt(da*db) : 0;
}

(async () => {
  const warmupN = +(process.argv[2] || 200);
  const testN   = +(process.argv[3] || 80);
  const seed    = +(process.argv[4] || 12345);

  const O = loadEngine();
  await O.loadLex();
  const ev = O.evalIn;
  const LEX = ev('OMEGA_LEX4');
  const W = LEX.words;

  if (ev("typeof M1_m") === 'undefined') { console.error('ERR: M1_m absent'); process.exit(1); }

  // sélection miroir ab_cohort
  const valid = [];
  for (let i = 0; i < W.length; i++){ const m = W[i] && W[i].m; if (m && m.length >= 7 && m.length <= 12 && /^[A-Z]+$/.test(m)) valid.push(i); }
  let r = (seed >>> 0); const rnd = () => { r = (r*1664525+1013904223)>>>0; return r/4294967296; };
  for (let i = valid.length-1; i>0; i--){ const j = Math.floor(rnd()*(i+1)); const t=valid[i]; valid[i]=valid[j]; valid[j]=t; }
  const trainW = valid.slice(testN, testN+warmupN).map(i => W[i].m);
  const testW  = valid.slice(0, testN).map(i => W[i].m);

  ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
  ev(CFG_COG);
  ev('M5_D_M1_M_ENABLED=true;');

  // helpers de lecture (closure moteur)
  ev('globalThis.__ls=function(){return Array.prototype.slice.call(M1_m.letterScore);};');
  ev('globalThis.__prior=function(){var t=M4_m.letterTarget,o=[];for(var l=0;l<26;l++)o.push(1-t[l]);return o;};'); // prior 1−target (fréquence)
  ev('globalThis.__step=function(){omegaStep();};');
  ev('globalThis.__start=function(w){startNewGame(w);};');
  ev('globalThis.__state=function(){return {w:currentWord, tried:Array.prototype.slice.call(alreadyTried), active:gameActive};};');

  // warmup (construit M1_m via le miroir, inter-jeux L04)
  ev(`_omegaRng=makeMulberry32(${seed});`);
  for (const w of trainW){ global.__start(w); let sf=300; while(global.__state().active && sf-->0) global.__step(); }

  const prior = global.__prior();

  // (1) discrimination in-word vs out-word, échantillonné à CHAQUE tick ; (3) variance inter-mots au tick 0
  let inSum=0, inN=0, outSum=0, outN=0;        // M1_m.letterScore
  let inSumP=0, outSumP=0;                       // prior de fréquence brut (référence)
  const tick0vectors = [];
  for (const w of testW){
    global.__start(w);
    const wordSet = new Set(w.split('').map(c => c.charCodeAt(0)-65));
    let sf=300, firstTick=true;
    while(global.__state().active && sf-->0){
      const st = global.__state();
      const ls = global.__ls();
      if (firstTick){ tick0vectors.push(ls.slice()); firstTick=false; }
      for (let l=0;l<26;l++){
        if (st.tried[l]) continue;               // ne juger que les lettres encore jouables
        if (wordSet.has(l)){ inSum+=ls[l]; inN++; inSumP+=prior[l]; }
        else { outSum+=ls[l]; outN++; outSumP+=prior[l]; }
      }
      global.__step();
    }
  }
  const inM=inSum/Math.max(1,inN), outM=outSum/Math.max(1,outN);
  const inMP=inSumP/Math.max(1,inN), outMP=outSumP/Math.max(1,outN);

  // (2) corrélation ls(tick0 moyen) vs prior de fréquence
  const lsAvg = new Array(26).fill(0);
  for (const v of tick0vectors) for (let l=0;l<26;l++) lsAvg[l]+=v[l];
  for (let l=0;l<26;l++) lsAvg[l]/=tick0vectors.length;
  const corrFreq = pearson(lsAvg, prior);

  // (3) variance inter-mots de ls[l] au tick 0 (moyennée sur l)
  let crossVar=0;
  for (let l=0;l<26;l++){ let m=0; for(const v of tick0vectors) m+=v[l]; m/=tick0vectors.length; let s=0; for(const v of tick0vectors) s+=(v[l]-m)*(v[l]-m); crossVar+=s/tick0vectors.length; }
  crossVar/=26;

  console.log(`\n=== DIAGNOSTIC M1_m — que porte letterScore au moment de décider ? (cognition, warmup ${warmupN} / test ${testN}, seed ${seed}) ===\n`);
  console.log(`(1) DISCRIMINATION du mot courant  (moyenne du score sur lettres non essayées)`);
  console.log(`    M1_m.letterScore : in-word ${inM.toFixed(4)} · out-word ${outM.toFixed(4)} · GAP ${(inM-outM>=0?'+':'')}${(inM-outM).toFixed(4)}`);
  console.log(`    prior fréquence  : in-word ${inMP.toFixed(4)} · out-word ${outMP.toFixed(4)} · GAP ${(inMP-outMP>=0?'+':'')}${(inMP-outMP).toFixed(4)}   (référence : ce que la simple fréquence donne)`);
  console.log(`\n(2) corrélation Pearson( M1_m.letterScore tick0 , prior 1−letterTarget ) = ${corrFreq.toFixed(3)}`);
  console.log(`    → proche de 1 ⇒ M1_m.letterScore EST (à peu près) le prior de fréquence global.`);
  console.log(`\n(3) variance de M1_m.letterScore[l] ENTRE mots au tick 0 (moyennée sur les 26 lettres) = ${crossVar.toExponential(2)}`);
  console.log(`    → proche de 0 ⇒ vecteur GLOBAL : mêmes 26 valeurs quel que soit le mot (aucune info spécifique au mot).`);
  console.log(`\nLecture : si GAP(M1_m) ≈ GAP(fréquence) et corr ≈ 1 et variance ≈ 0, alors M1_m n'apporte QUE de la fréquence`);
  console.log(`globale — déjà présente dans M4_d (30%) — d'où Δ winrate nul/négatif. Le concept (M3_m) n'atteint jamais la lettre.`);
})().catch(e => { console.error('ERR', e && e.stack || e); process.exit(1); });
