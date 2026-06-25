'use strict';
// EVO P1 (b-bis) — FIDÉLITÉ DE COPIE sur le BON substrat : le HDC/VSA 1024D, pas le goulot 12-cellules.
// Constat précédent (evo_p1_fidelity) : le concept M3_d (12 cellules) reconstruit M1_d (512D) à ~0,65 d'erreur
// PLATE — parce que c'est une compression extrême + lossy PAR DESIGN (readout 0,20). Or OMEGA a déjà un
// encodeur de SÉQUENCE haute-capacité : _emrg_bind(word) = bundle 1024D des lettres liées à leur position
// (circularShift). On le DÉCODE position par position (circularShiftInverse + cleanup cosine sur letterVecsSDIM)
// et on mesure le taux de récupération exact vs longueur. Primitives RÉELLES du moteur. OFF-inerte, déterministe.
// Usage : node evo/evo_p1_vsa_copy.js [perLen] [seed]
const { loadEngine } = require('./fitness_harness.js');

const CFG = [
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
].join(';');

(async () => {
  const perLen=+(process.argv[2]||60), seed=+(process.argv[3]||12345);
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const W=LEX.words;

  ev(CFG);
  ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();`);
  ev(CFG);
  if(ev("!(typeof letterVecsSDIM!=='undefined' && letterVecsSDIM && typeof _emrg_bind==='function' && typeof circularShiftInverse==='function' && typeof cosineSim==='function')"))
    { console.error('ERR primitives VSA non dispo (letterVecsSDIM/_emrg_bind/circularShiftInverse/cosineSim)'); process.exit(1); }
  ev('globalThis.__sdim=function(){return SDIM;};');
  ev('globalThis.__bind=function(w){return _emrg_bind(w,null);};');   // encodeur de séquence DÉJÀ dans le moteur
  // décodage VSA : pour chaque position p, défaire le liage (shift inverse p+1) puis cleanup = lettre la plus proche
  ev('globalThis.__decode=function(c,len){var out="";for(var p=0;p<len;p++){var u=circularShiftInverse(c,p+1);var bi=0,bv=-2;for(var l=0;l<26;l++){var d=cosineSim(u,letterVecsSDIM[l]);if(d>bv){bv=d;bi=l;}}out+=String.fromCharCode(65+bi);}return out;};');

  const LENS=[7,8,9,10,11,12,13,14,15,18,22];
  const pool={}; for(const L of LENS) pool[L]=[];
  for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&/^[A-Z]+$/.test(m)&&pool[m.length]) pool[m.length].push(m);}
  let r=(seed>>>0); const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  const shuf=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}return a;};

  console.log(`\n=== EVO P1 — fidélité de COPIE sur le substrat VSA 1024D (SDIM=${global.__sdim()}) · ${perLen}/len · seed ${seed} ===`);
  console.log(`encode = _emrg_bind (moteur) · decode = unbind(circularShiftInverse)+cleanup(cosine) sur letterVecsSDIM\n`);
  console.log(`  len │ lettres OK │ mots exacts │ (n)`);
  console.log(`  ────┼────────────┼─────────────┼─────`);
  const rows=[];
  for(const L of LENS){
    const ws=shuf(pool[L].slice()).slice(0,perLen); if(!ws.length){console.log(`  ${String(L).padStart(3)} │   (aucun mot de cette longueur)`);continue;}
    let posOK=0,posTot=0,wordOK=0;
    for(const w of ws){ const c=global.__bind(w); const rec=global.__decode(c,w.length);
      let ok=0; for(let i=0;i<w.length;i++) if(rec[i]===w[i]) ok++;
      posOK+=ok; posTot+=w.length; if(rec===w) wordOK++; }
    const pp=100*posOK/posTot, ww=100*wordOK/ws.length; rows.push({L,pp,ww});
    console.log(`  ${String(L).padStart(3)} │   ${pp.toFixed(1).padStart(5)} %  │   ${ww.toFixed(1).padStart(5)} %   │ ${ws.length}`);
  }
  const full=rows.filter(o=>o.ww>=99).map(o=>o.L);
  console.log(`\n  → copie de MOT exacte ≥99 % jusqu'à len ${full.length?Math.max(...full):'—'} ; au-delà, dégradation gracieuse (crosstalk VSA).`);
  console.log(`  → rappel : le goulot 12-cellules plafonnait à ~0,65 d'erreur (≈⅓ du signal) ; ici la capacité est dans le 1024D.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
