// OMEGA — DIAGNOSTIC AMONT : le concept (M3_m/M3_d) et la position (M2_m) portent-ils un signal SPÉCIFIQUE AU MOT,
// ou sont-ils GLOBAUX / dominés par la LONGUEUR (S2) ? Tranche H1 (connexion à poser) vs H2 (racine = le concept).
//
// Mesures (R67 lecture seule — currentWord lu pour instrumenter, jamais pour décider) :
//   (A) concept : histogramme de la cellule dominante M3_m.lastDominantCell (cellules mortes ? 1 concept pour tous ?)
//   (B) détecteur de longueur : table longueur-du-mot → cellule dominante modale + sa part (si quasi-déterministe ⇒ longueur)
//   (C) M3_d.output : norme (bPC le met-il à 0 ?) + cosinus moyen inter-mots (≈1 ⇒ concept global)
//   (D) M2_m.zonePenalty : variance inter-mots + corrélation avec la longueur
//
// Usage : node evo/diag_mirror.js [warmupN] [testN] [seed]   (défauts 200 / 80 / 12345)
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

function cos(a,b){ let d=0,na=0,nb=0; for(let i=0;i<a.length;i++){ d+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; } return (na>1e-12&&nb>1e-12)? d/Math.sqrt(na*nb):0; }

(async () => {
  const warmupN = +(process.argv[2] || 200);
  const testN   = +(process.argv[3] || 80);
  const seed    = +(process.argv[4] || 12345);

  const O = loadEngine();
  await O.loadLex();
  const ev = O.evalIn;
  const LEX = ev('OMEGA_LEX4');
  const W = LEX.words;

  const valid = [];
  for (let i = 0; i < W.length; i++){ const m = W[i] && W[i].m; if (m && m.length>=7 && m.length<=12 && /^[A-Z]+$/.test(m)) valid.push(i); }
  let r=(seed>>>0); const rnd=()=>{ r=(r*1664525+1013904223)>>>0; return r/4294967296; };
  for (let i=valid.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const t=valid[i]; valid[i]=valid[j]; valid[j]=t; }
  const trainW = valid.slice(testN, testN+warmupN).map(i=>W[i].m);
  const testW  = valid.slice(0, testN).map(i=>W[i].m);

  ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
  ev(CFG_COG);
  ev('globalThis.__start=function(w){startNewGame(w);};globalThis.__step=function(){omegaStep();};');
  ev('globalThis.__state=function(){return {active:gameActive, len:(currentWord||"").length};};');
  ev('globalThis.__cell=function(){return (typeof M3_m!=="undefined"&&M3_m)?M3_m.lastDominantCell:-2;};');
  ev('globalThis.__m3out=function(){return (typeof M3_d!=="undefined"&&M3_d&&M3_d.output)?Array.prototype.slice.call(M3_d.output):null;};');
  ev('globalThis.__zone=function(){return (typeof M2_m!=="undefined"&&M2_m&&M2_m.zonePenalty)?Array.prototype.slice.call(M2_m.zonePenalty):null;};');
  ev('globalThis.__ncells=function(){return (typeof N_CONCEPT_CELLS!=="undefined")?N_CONCEPT_CELLS:12;};');

  ev(`_omegaRng=makeMulberry32(${seed});`);
  for (const w of trainW){ global.__start(w); let sf=300; while(global.__state().active && sf-->0) global.__step(); }

  const NC = global.__ncells();
  const cellHist = new Array(NC+1).fill(0);   // index NC = "-1/aucune"
  const byLen = {};                            // len -> {cellCount:{}, n}
  const firstM3 = [];                          // M3_d.output au 1er tick par mot
  let m3normSum=0, m3normN=0;
  const firstZone = [];                        // M2_m.zonePenalty échantillon par mot
  for (const w of testW){
    global.__start(w);
    let sf=300, first=true; const len=w.length;
    while(global.__state().active && sf-->0){
      global.__step();                          // forward+miroir de ce tick
      const c = global.__cell();
      const ci = (c>=0 && c<NC) ? c : NC;
      cellHist[ci]++;
      if(!byLen[len]) byLen[len]={cc:{}, n:0};
      byLen[len].cc[ci]=(byLen[len].cc[ci]||0)+1; byLen[len].n++;
      if(first){
        const m=global.__m3out(); if(m){ let nn=0; for(const x of m) nn+=x*x; nn=Math.sqrt(nn); m3normSum+=nn; m3normN++; if(nn>1e-9) firstM3.push(m); }
        const z=global.__zone(); if(z) firstZone.push({len, z});
        first=false;
      }
    }
  }

  console.log(`\n=== DIAGNOSTIC AMONT concept/position (cognition, warmup ${warmupN} / test ${testN}, seed ${seed}) ===\n`);

  // (A) histogramme cellules dominantes
  const totC = cellHist.reduce((a,b)=>a+b,0)||1;
  const live = cellHist.slice(0,NC).map((n,i)=>({i,n})).filter(o=>o.n>0).sort((a,b)=>b.n-a.n);
  console.log(`(A) CELLULE concept dominante — ${live.length}/${NC} cellules vivantes (le reste = mortes)`);
  console.log('    top : ' + live.slice(0,6).map(o=>`#${o.i}:${(100*o.n/totC).toFixed(0)}%`).join('  ') + (cellHist[NC]?`  (aucune:${(100*cellHist[NC]/totC).toFixed(0)}%)`:''));

  // (B) détecteur de longueur : par longueur, cellule modale + part
  console.log(`\n(B) DÉTECTEUR DE LONGUEUR ? — par longueur : cellule dominante modale (part)`);
  const lens = Object.keys(byLen).map(Number).sort((a,b)=>a-b);
  for(const L of lens){ const cc=byLen[L].cc, n=byLen[L].n; const top=Object.keys(cc).map(k=>({k:+k,v:cc[k]})).sort((a,b)=>b.v-a.v)[0]; console.log(`    len ${L} (n=${String(n).padStart(4)}) → cellule #${top.k===NC?'—':top.k} à ${(100*top.v/n).toFixed(0)}%`); }
  const distinctModal = new Set(lens.map(L=>{const cc=byLen[L].cc; return Object.keys(cc).map(k=>({k,v:cc[k]})).sort((a,b)=>b.v-a.v)[0].k;}));
  console.log(`    → ${distinctModal.size} cellule(s) modale(s) distincte(s) sur ${lens.length} longueurs  ${distinctModal.size<=2?'(⇒ signe FORT de détecteur de longueur / concept global)':'(⇒ varie : possible info spécifique)'}`);

  // (C) concept global ? norme + cosinus inter-mots
  console.log(`\n(C) M3_d.output — norme moyenne ${m3normN?(m3normSum/m3normN).toFixed(3):'0 (bPC met output=0 → concept ne passe PAS par M3_d.output)'}`);
  if(firstM3.length>=2){ let s=0,p=0; for(let i=0;i<Math.min(firstM3.length,40);i++)for(let j=i+1;j<Math.min(firstM3.length,40);j++){ s+=cos(firstM3[i],firstM3[j]); p++; } console.log(`    cosinus moyen inter-mots (1er tick) = ${(s/p).toFixed(3)}  ${(s/p)>0.9?'(⇒ concept QUASI-IDENTIQUE entre mots = global)':'(⇒ concept varie selon le mot)'}`); }

  // (D) M2_m.zonePenalty
  if(firstZone.length>=2){ const NZ=firstZone[0].z.length; let varSum=0; for(let z=0;z<NZ;z++){ let m=0; for(const o of firstZone)m+=o.z[z]; m/=firstZone.length; let v=0; for(const o of firstZone)v+=(o.z[z]-m)*(o.z[z]-m); varSum+=v/firstZone.length; } console.log(`\n(D) M2_m.zonePenalty — variance inter-mots moyenne = ${(varSum/NZ).toExponential(2)}  ${(varSum/NZ)<1e-4?'(≈0 ⇒ positionnel global)':'(varie)'}`); }

  console.log(`\nVerdict H1/H2 : si (A) ≤2 vivantes, (B) ≤2 modales, (C) cos≈1 → H2 (le concept est un détecteur de longueur :`);
  console.log(`recâbler M1_m←M3_m ne sert à rien, la racine est le concept → audit §3 prédiction-masquée). Sinon H1 (connexion à poser).`);
})().catch(e => { console.error('ERR', e && e.stack || e); process.exit(1); });
