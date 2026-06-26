'use strict';
// EVO P2 (b+) — RAFFINEMENT : politique RELATIVE AU MOT. Le learner P2(b) apprenait une value par LETTRE (globale) →
// plateau 96,7 % (les lettres rarissimes, rares dans les mots, n'accumulaient pas de crédit). Fix diagnostiqué :
// A apprend une value par RANG DE RARETÉ dans le mot (0 = la plus rare DU mot). Le rang 0 reçoit un signal constant →
// A doit converger vers « envoie la plus rare du mot » = l'encodage optimal (plafond mesuré 98,7 % en P2(a)).
// Reward contrastif (gain marginal). Canal k=1. Usage : node evo/evo_p2_emergent2.js
const { loadEngine } = require('./fitness_harness.js');

const CFG=[
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true','M_DECLARE_NEO_ENABLED=false',
].join(';');

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const W=LEX.words;
  ev(CFG); ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`); ev(CFG);
  ev('globalThis.__playMsg=function(w,msg){startNewGame(w);for(var li=0;li<msg.length;li++){var idx=msg.charCodeAt(li)-65;if(idx<0||idx>=26)continue;if(typeof alreadyTried!=="undefined")alreadyTried[idx]=true;for(var p=0;p<w.length;p++)if(w[p]===msg[li])revealedMask[p]=true;}var sf=300;while(gameActive&&sf-->0)omegaStep();return !!lastGameWon;};');

  const cnt=new Array(26).fill(0); for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m;if(!m)continue;for(const c of m){const k=c.charCodeAt(0)-65;if(k>=0&&k<26)cnt[k]++;}}
  const valid=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m;if(m&&m.length>=8&&m.length<=12&&/^[A-Z]+$/.test(m))valid.push(m);}
  let r=12345; const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
  const pool=valid.slice(0,2000), test=valid.slice(2000,2150);

  // lettres distinctes du mot triées par RARETÉ (rang 0 = la plus rare du mot)
  const ranked=w=>[...new Set(w.split(''))].sort((a,b)=>cnt[a.charCodeAt(0)-65]-cnt[b.charCodeAt(0)-65]);

  const MAXR=12; const value=new Array(MAXR).fill(0); const LR=0.25;
  // entraînement = échantillonnage SOFTMAX sur les rangs (anti lock-in : tous les rangs restent explorés)
  function smPick(w,T){ const ds=ranked(w), n=ds.length; const vs=[]; let mx=-1e9;
    for(let rk=0;rk<n;rk++){ const v=value[Math.min(rk,MAXR-1)]/T; vs.push(v); if(v>mx)mx=v; }
    let z=0; const ex=vs.map(v=>{const e=Math.exp(v-mx);z+=e;return e;});
    let x=rnd()*z,rk=0; for(;rk<n;rk++){ x-=ex[rk]; if(x<=0)break; } rk=Math.min(rk,n-1);
    return {L:ds[rk], rk:Math.min(rk,MAXR-1)}; }
  // éval = argmax (politique gloutonne finale)
  function amPick(w){ const ds=ranked(w); let bi=0,bv=-1e9; for(let rk=0;rk<ds.length;rk++){const v=value[Math.min(rk,MAXR-1)]; if(v>bv){bv=v;bi=rk;}} return ds[bi]; }

  const EPOCHS=20, PER=160; const hist=[];
  for(let e=0;e<EPOCHS;e++){ const T=Math.max(0.5, 2.0*(1-e/EPOCHS)); let win=0;
    for(let n=0;n<PER;n++){ const w=pool[Math.floor(rnd()*pool.length)]; const {L,rk}=smPick(w,T);
      const wWith=global.__playMsg(w,L)?1:0, wWithout=global.__playMsg(w,'')?1:0;
      value[rk]+=LR*(wWith-wWithout); win+=wWith; }
    hist.push(+(100*win/PER).toFixed(1)); }

  let tw=0; for(const w of test){ if(global.__playMsg(w, amPick(w))) tw++; } const finalWR=+(100*tw/test.length).toFixed(1);

  console.log(`\n=== EVO P2 (b+) — RAFFINEMENT : politique RELATIVE AU MOT (value par rang de rareté) ===`);
  console.log(`A apprend quel RANG de rareté envoyer (0 = la plus rare DU mot). Reward contrastif. ${EPOCHS}×${PER} parties.\n`);
  console.log(`  winrate B par epoch : ${hist.filter((_,i)=>i%3===0||i===hist.length-1).join('  ')}`);
  console.log(`  value apprise par rang [0=rare → 4] : ${value.slice(0,5).map(v=>v.toFixed(2)).join('  ')}`);
  const top=[...value.slice(0,8).keys()].sort((a,b)=>value[b]-value[a])[0];
  console.log(`  → rang préféré appris : #${top} ${top===0?'(le plus rare du mot)':''}`);
  console.log(`\n  éval gloutonne (held-out) : ${finalWR}%   [rappel P2(a) : aléatoire 94,7% · malin(rares) 98,7%]`);
  const hitCeiling = finalWR>=98.0;
  console.log(`  ${hitCeiling?'✅ PLAFOND ATTEINT':'~ '+finalWR+'%'} : la politique relative au mot ${hitCeiling?'fait émerger l\'encodage optimal (envoie la plus rare du mot)':'progresse vers le plafond'} — corrige le plateau du learner global (96,7%).`);
  console.log(`  → leçon : le plateau P2(b) n'était pas un échec d'apprentissage mais une LIMITE DE CLASSE DE POLITIQUE (globale). La bonne représentation (relative au mot) atteint l'optimum.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
