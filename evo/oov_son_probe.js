'use strict';
// EVO — LE « 74 % HORS-LEXIQUE » : D'OÙ VIENT-IL ? (27/09/2026)
//
// Question de Rem : pourquoi l'évolution (gène M_NEO_OS_ARB_CONF = 0,30) monte à ~74 % hors-lexique,
// au-dessus des LLM et du SOTA Trexquant (65-68 %), et au-dessus du produit ?
//
// RÉPONSE MESURÉE : LE MOTEUR ENTEND LE MOT CACHÉ. Le banc OOV (evo_oov_*.js, evolution.html) retire le
// mot test de OMEGA_LEX4.len_index SEULEMENT. La table des prononciations `wp` (mot → phonèmes) de
// _emrg_initOnline() est bâtie sur TOUS les mots de OMEGA_LEX4.words et n'est jamais filtrée. Le gène 0,30
// fait s'abstenir l'arbitrage n-gram quand il doute ; la décision tombe alors sur la voie « assemblé » qui,
// cohorte phon OFF, lit `wp.get(currentWord)` = la prononciation du mot caché (« mot entendu », que l'UI
// du produit marque elle-même ORANGE). La sélection n'a pas trouvé une meilleure stratégie de lettres :
// elle a trouvé la fuite.
//
// CE QUE CE BANC FAIT : il reproduit le protocole de evo_oov_bigN.js (même tirage, même warmup, même
// config recopiée mot pour mot) et fait varier UNE chose à la fois. Chaque (graine, condition) tourne dans
// un processus NEUF : l'état hérité d'une config précédente change le résultat (mesuré : la « même »
// config evo fait 25/40 dans un moteur neuf et 28/40 posée par-dessus le préréglage de la page, parce
// qu'elle initialise AVANT de poser ses interrupteurs et en laisse trois non posés).
//
// Conditions : evo0 · evo30 · evo30_placebo · evo0_sourd · evo30_sourd · evo30_sourdPendant ·
//   evo30_bruitNN (NN = % de phonèmes remplacés au hasard) · produit · produit_placebo · produit_inlex ·
//   produit_ngram · produit_ngram_inlex · evo30_inlex · evo30_apresProduit
//   produit_ngram = le préréglage du produit + le n-gram arbitré (M_NEO_OS_ARB_NGRAM), rien d'autre.
//                   Mesuré le 27/09 (10 graines) : hors lexique 21,5 → 56,1 %, dans le lexique 95,9 → 95,8 % (162
//                   parties changent d'issue à parts égales, 80/82 : effet net nul — le placebo RNG, lui, n'en fait
//                   basculer qu'UNE dans le lexique : ce sont des bascules de chemin de calcul, cf. JOURNAL 03/09)
//   sourd         = le son des mots test est retiré de `wp` pendant tout le test (vrai hors-lexique)
//   sourdPendant  = retiré PENDANT la partie seulement (l'apprentissage de fin de partie le reçoit)
//   bruitNN       = oreille imparfaite : chaque phonème du mot caché remplacé par un phonème AU HASARD
//                   avec la probabilité NN %, tirage figé par mot (on entend le mot une fois)
//   placebo       = un tirage du RNG consommé avant le test : ne change rien au moteur, mesure combien
//                   de parties basculent par pur hasard (tout A/B du pendu embarque un placebo, JOURNAL 03/09)
//   inlex         = le mot test reste dans le lexique (le régime où le produit est réglé)
//
// Compteurs par partie de test : lectures du son du mot caché pendant la partie (hors apprentissage de
// fin), appels de l'arbitrage OS (_neoDeclareOSmix), fois où il s'abstient, appels du n-gram de lettres.
//
//   node evo/oov_son_probe.js                                   # 3 graines × 5 conditions (~10 min)
//   node evo/oov_son_probe.js --graines 11,23,42,97,256,1024,2025,4096,31337,65521 --conditions evo0,evo30
//   node evo/oov_son_probe.js --exemples                        # à quoi ressemble le son, exact et bruité
//   options : --n 350 (mots test) · --warm 250 (échauffement) · --jobs 8 (processus en parallèle)
const path = require('path');
const { fork } = require('child_process');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

// ── la config du banc évolution, recopiée MOT POUR MOT de evo_oov_bigN.js (défauts compris) ───────
const CFG_EVO = `globalThis.__cfgEvo=function(seed,arbConf){
  _omegaSeed=seed;_omegaRng=makeMulberry32(seed);initOmegaGlobals();
  if(typeof _omega_OSL_reset==='function')_omega_OSL_reset(); if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}
  L01_A4_M4M_DECOMP_ENABLED=true;L01_A5_M2M_POSITIONAL_ENABLED=true;L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true;L01_B2_MOBIUS_ENABLED=true;M_OS_V07_ENABLED=true;M_SUBSTRAT_ORTHO_PURE_ENABLED=true;M_BPC_M3D_ENABLED=true;M_BPC_READOUT_COUPLE_ENABLED=true;M_OS_LEARNING_ONLINE_ENABLED=true;M_OS_LEARNING_GUARD_1_BOUNDED=true;M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true;M_OS_LEARNING_GUARD_3_MDL_REGUL=true;M_OS_LEARNING_GUARD_4_COHERENCE=true;
  M_VOIE_PHON_ENABLED=false;M4_PHON_USE_P_ENABLED=false;M_PHON_FEEDBACK_ENABLED=false;M_PHON_READOUT_COUPLE_ENABLED=false;M_PHON_CONCEPT_BIND_ENABLED=false;
  M_DECLARE_NEO_ENABLED=true;M_NEO_RECALL_ENABLED=true;M_NEO_ASSEMBLED_ENABLED=true;M_NEO_COHORT_ENABLED=true;M_NEO_PHON_COHORT_ENABLED=false;M_NEO_MUTE_ENABLED=false;M_NEO_TRIGGER_ENABLED=false;M_EMERGENT_DECLARE_ENABLED=true;
  M_NEO_LETTER_NGRAM=false; M_NEO_OS_ARB=true; M_NEO_OS_ARB_NGRAM=true; M_NEO_NGRAM_GAP=false;
  if(typeof M_NEO_C_HEAVY!=='undefined') M_NEO_C_HEAVY=false;
  if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=M_NEO_OS_ARB_ALPHA=1;M_OS_v07.beta=M_NEO_OS_ARB_BETA=1;}
  if(typeof M_NEO_OS_ARB_CONF!=='undefined')M_NEO_OS_ARB_CONF=arbConf;
};`;
// ── la config du PRODUIT : le préréglage que la page applique au chargement ───────────────────────
const CFG_PRODUIT = `globalThis.__cfgProduit=function(seed){ _omegaSeed=seed;_omegaRng=makeMulberry32(seed); applyReferenceConfig(); };`;
// ── le tirage de evo_oov_bigN.js : mots 7-12 lettres A-Z, mélangés par graine, test puis échauffement ─
const SETUP = `globalThis.__oovSetup=function(seed,testN,warmupN){
  const W=OMEGA_LEX4.words, valid=[];
  for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&m.length>=7&&m.length<=12&&/^[A-Z]+$/.test(m)) valid.push(i);}
  let r=(seed>>>0); const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
  const testIdx=valid.slice(0,testN), trainIdx=valid.slice(testN,testN+warmupN);
  const testSet=new Set(testIdx); const origLI=OMEGA_LEX4.len_index; const filtered={};
  for(const k in origLI) filtered[k]=origLI[k].filter(id=>!testSet.has(id));
  globalThis.__oov={origLI,filtered,trainW:trainIdx.map(i=>W[i].m),testW:testIdx.map(i=>W[i].m)};
  return __oov.testW.length;
};`;

function condition(cond, seed) {
  const T = {
    evo0:               { cfg: `__cfgEvo(${seed},0.0)` },
    evo30:              { cfg: `__cfgEvo(${seed},0.30)` },
    evo30_placebo:      { cfg: `__cfgEvo(${seed},0.30)`, placebo: true },
    evo0_sourd:         { cfg: `__cfgEvo(${seed},0.0)`, sourd: true },
    evo30_sourd:        { cfg: `__cfgEvo(${seed},0.30)`, sourd: true },
    evo30_sourdPendant: { cfg: `__cfgEvo(${seed},0.30)`, sourdPendant: true },
    evo30_inlex:        { cfg: `__cfgEvo(${seed},0.30)`, inlex: true },
    evo30_apresProduit: { cfg: `__cfgProduit(${seed}); __cfgEvo(${seed},0.30)` },
    produit:            { cfg: `__cfgProduit(${seed})` },
    produit_placebo:    { cfg: `__cfgProduit(${seed})`, placebo: true },
    produit_inlex:      { cfg: `__cfgProduit(${seed})`, inlex: true },
    // le n-gram ARBITRÉ dans la config du PRODUIT : un seul changement, M_NEO_OS_ARB_NGRAM. Mesuré le 19/06
    // dans une config de test (AUDIT_OMEGA §1.9), jamais dans le préréglage jusqu'au 27/09
    produit_ngram:       { cfg: `__cfgProduit(${seed}); M_NEO_OS_ARB_NGRAM=true;` },
    produit_ngram_inlex: { cfg: `__cfgProduit(${seed}); M_NEO_OS_ARB_NGRAM=true;`, inlex: true },
  };
  if (T[cond]) return T[cond];
  const m = /^evo(0|30)_bruit(\d+)$/.exec(cond);
  if (m) return { cfg: `__cfgEvo(${seed},${m[1] === '0' ? '0.0' : '0.30'})`, bruit: (+m[2]) / 100 };
  return null;
}

// ═══ UN PROCESSUS = UNE (graine, condition), moteur neuf ═══════════════════════════════════════════
async function travailleur(seed, cond, testN, warmN) {
  const { loadEngine } = require('./fitness_harness.js');
  const C = condition(cond, seed);
  if (!C) throw new Error('condition inconnue : ' + cond);
  const O = loadEngine(); await O.loadLex(); const ev = O.evalIn;
  ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`);
  ev(CFG_EVO); ev(CFG_PRODUIT); ev(SETUP);
  // Ce banc REPRODUIT le protocole d'origine, fuite comprise, et gère lui-même le son de chaque condition
  // (exact, retiré, bruité, entendu par l'oreille) : il lève donc la garde du harnais.
  ev('__OREILLE_PARFAITE = true;');
  ev(`__oovSetup(${seed},${testN},${warmN})`);
  return ev(`(function(){
    ${C.cfg};
    function play(w){startNewGame(w);let sf=300;while(gameActive&&sf-->0)omegaStep();return lastGameWon;}
    OMEGA_LEX4.len_index=__oov.origLI; _neoWBL=null; _neoNG=null; _omegaRng=makeMulberry32(${seed});
    for(let i=0;i<__oov.trainW.length;i++)play(__oov.trainW[i]);
    OMEGA_LEX4.len_index=${C.inlex ? '__oov.origLI' : '__oov.filtered'}; _neoWBL=null; _neoNG=null;
    if(${C.placebo ? 'true' : 'false'}) _omegaRng();
    // — compteurs : on enveloppe sans rien changer au calcul —
    const K={lectures:0,arb:0,arbAbstient:0,ngram:0,fins:0}; let enTest=false, enFin=false;
    const _fin=endCurrentGame; endCurrentGame=function(x){ if(enTest)K.fins++; enFin=true; try{ return _fin(x); } finally { enFin=false; } };
    const _arb=_neoDeclareOSmix; _neoDeclareOSmix=function(){ const r=_arb(); if(enTest){ K.arb++; if(!r) K.arbAbstient++; } return r; };
    const _ng=_neoLetterNgramDist; _neoLetterNgramDist=function(){ if(enTest)K.ngram++; return _ng.apply(this,arguments); };
    // — le son du mot caché : lu, retiré ou déformé —
    const G=_emrg_initOnline(); const wpGet=G.wp.get.bind(G.wp);
    const SP=${C.sourdPendant ? 'true' : 'false'}, BR=${C.bruit || 0}; const cacheBruit=new Map(); const INV=G.PH.filter(x=>x!==G.EPS);
    function bruite(w,p){ if(!p) return p; if(cacheBruit.has(w)) return cacheBruit.get(w);
      let h=${seed}>>>0; for(let i=0;i<w.length;i++){ h=Math.imul(h^w.charCodeAt(i),2654435761)>>>0; }
      const rnd=()=>{ h=(Math.imul(h,1664525)+1013904223)>>>0; return h/4294967296; };
      let q=''; for(const ch of p){ if(rnd()<BR){ let r; do{ r=INV[Math.floor(rnd()*INV.length)]; }while(r===ch); q+=r; } else q+=ch; }
      cacheBruit.set(w,q); return q; }
    G.wp.get=function(k){ if(enTest && !enFin && k===currentWord && gameActive){ K.lectures++; if(SP) return undefined; if(BR) return bruite(k, wpGet(k)); } return wpGet(k); };
    const retire=[]; if(${C.sourd ? 'true' : 'false'}){ for(const w of __oov.testW){ if(G.wp.has(w)){ retire.push([w,wpGet(w)]); G.wp.delete(w); } } }
    enTest=true; let win=0; const gagnes=[];
    for(let i=0;i<__oov.testW.length;i++){ if(play(__oov.testW[i])){ win++; gagnes.push(__oov.testW[i]); } }
    enTest=false; for(const [w,p] of retire) G.wp.set(w,p);
    G.wp.get=wpGet; endCurrentGame=_fin; _neoDeclareOSmix=_arb; _neoLetterNgramDist=_ng;
    OMEGA_LEX4.len_index=__oov.origLI; _neoWBL=null; _neoNG=null;
    return { win, n:__oov.testW.length, gagnes, K };
  })()`);
}

// ═══ --exemples : le son d'un mot, exact puis déformé ═════════════════════════════════════════════
async function exemples() {
  const { loadEngine } = require('./fitness_harness.js');
  const O = loadEngine(); await O.loadLex(); const ev = O.evalIn;
  ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`); ev(SETUP); ev(`__oovSetup(11,350,250)`);
  return ev(`(function(){
    const G=_emrg_initOnline(); const INV=G.PH.filter(x=>x!==G.EPS); const out={inventaire:INV.join(' '), mots:[]};
    for(const w of __oov.testW.slice(0,6)){ const p=G.wp.get(w); const ligne={mot:w, son:p};
      for(const BR of [0.1,0.2,0.3,0.5]){ let h=11>>>0; for(let i=0;i<w.length;i++){ h=Math.imul(h^w.charCodeAt(i),2654435761)>>>0; }
        const rnd=()=>{ h=(Math.imul(h,1664525)+1013904223)>>>0; return h/4294967296; };
        let q=''; for(const ch of p){ if(rnd()<BR){ let r; do{ r=INV[Math.floor(rnd()*INV.length)]; }while(r===ch); q+=r; } else q+=ch; }
        ligne['bruit'+Math.round(BR*100)]=q; }
      out.mots.push(ligne); }
    return out; })()`);
}

// ═══ analyse appariée : même graine = mêmes mots test pour toutes les conditions ══════════════════
function erfc(x) { const t = 1 / (1 + 0.5 * Math.abs(x)); const y = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? y : 2 - y; }
function rapport(R, graines, conds) {
  const get = (c, s) => R.find((x) => x.cond === c && x.seed === s);
  console.log(`\n${graines.length} graine(s) : ${graines.join(', ')} — ${R[0] ? R[0].n : '?'} mots test par graine\n`);
  console.log('condition'.padEnd(20) + 'gagnées'.padStart(9) + '   son caché lu   arbitrage OS   dont abstentions   n-gram appelé   (par partie)');
  for (const c of conds) {
    const r = graines.map((s) => get(c, s)).filter(Boolean); if (!r.length) continue;
    const n = r.reduce((a, x) => a + x.n, 0), w = r.reduce((a, x) => a + x.win, 0);
    const k = (f) => (r.reduce((a, x) => a + x.K[f], 0) / n).toFixed(1).padStart(6);
    console.log(c.padEnd(20) + ((100 * w / n).toFixed(1) + ' %').padStart(9) + `   ${k('lectures')}         ${k('arb')}         ${k('arbAbstient')}            ${k('ngram')}`);
  }
  const paires = [['evo0', 'evo30'], ['evo30', 'evo30_placebo'], ['evo0', 'evo0_sourd'], ['evo30', 'evo30_sourd'],
    ['evo30_sourd', 'evo30_sourdPendant'], ['produit', 'produit_placebo'], ['produit', 'evo0'],
    ['produit', 'produit_ngram'], ['produit_inlex', 'produit_ngram_inlex']];
  console.log('\nappariement mot à mot (A → B) : parties perdues→gagnées / gagnées→perdues');
  for (const [A, B] of paires) {
    if (!conds.includes(A) || !conds.includes(B)) continue;
    let b = 0, c = 0, n = 0;
    for (const s of graines) { const x = get(A, s), y = get(B, s); if (!x || !y) continue; n += x.n;
      const ga = new Set(x.gagnes), gb = new Set(y.gagnes);
      for (const w of new Set([...ga, ...gb])) { if (ga.has(w) && !gb.has(w)) b++; if (!ga.has(w) && gb.has(w)) c++; } }
    const chi = (b + c) ? Math.pow(Math.abs(b - c) - 1, 2) / (b + c) : 0, p = erfc(Math.sqrt(chi / 2));
    console.log(`  ${(A + ' → ' + B).padEnd(34)} Δ ${((c - b) / n * 100 >= 0 ? '+' : '') + ((c - b) / n * 100).toFixed(1)} pt · +${c} / −${b} sur ${n} · McNemar p ${p < 1e-12 ? '< 1e-12' : p.toExponential(1)}`);
  }
  console.log('\n⚠️ Les p de ce moteur sont ANTI-CONSERVATEURS (état appris partagé entre parties) : seul compte l\'écart AU PLACEBO.');
}

// ═══ chef d'orchestre ═════════════════════════════════════════════════════════════════════════════
(async () => {
  if (argv[0] === '--un') {                                   // mode travailleur (processus neuf)
    const [, s, cond, n, w] = argv;
    const r = await travailleur(+s, cond, +n, +w);
    process.send ? process.send({ seed: +s, cond, ...r }) : console.log(JSON.stringify({ seed: +s, cond, ...r }));
    return;
  }
  if (argv.includes('--exemples')) { console.log(JSON.stringify(await exemples(), null, 1)); return; }
  const graines = opt('--graines', '11,23,42').split(',').map(Number);
  const conds = opt('--conditions', 'evo0,evo30,evo30_placebo,evo30_sourd,produit').split(',');
  for (const c of conds) if (!condition(c, 1)) { console.error('condition inconnue : ' + c); process.exit(2); }
  const testN = +opt('--n', 350), warmN = +opt('--warm', 250), jobs = +opt('--jobs', 8);
  const file = []; for (const s of graines) for (const c of conds) file.push([s, c]);
  console.log(`=== OOV : d'où vient le « 74 % » ? ${file.length} runs (${graines.length} graines × ${conds.length} conditions), ${jobs} en parallèle ===`);
  const R = []; let i = 0;
  await new Promise((fini) => {
    let actifs = 0;
    const lance = () => {
      while (actifs < jobs && i < file.length) {
        const [s, c] = file[i++]; actifs++;
        const p = fork(__filename, ['--un', String(s), c, String(testN), String(warmN)], { silent: true });
        let recu = false;
        p.on('message', (m) => { recu = true; R.push(m); process.stdout.write(`  ✓ ${c} · graine ${s} : ${(100 * m.win / m.n).toFixed(1)} %\n`); });
        p.on('exit', (code) => { actifs--; if (!recu) { console.error(`  ✗ ${c} · graine ${s} : processus sorti (${code}) sans résultat`); process.exitCode = 1; }
          if (i >= file.length && actifs === 0) fini(); else lance(); });
      }
    };
    lance();
  });
  rapport(R, graines, conds);
})().catch((e) => { console.error('ERR', e && e.stack || e); process.exit(1); });
