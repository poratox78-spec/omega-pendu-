'use strict';
// EVO P2 — CAPTURE FIDÈLE pour la viz : fait tourner le VRAI moteur, capture (1) l'apprentissage de A (winrate/epoch +
// value par rang), (2) pour des mots de démo, le MESSAGE soufflé par A + la SÉQUENCE EXACTE des lettres jouées par B
// (le moteur) avec hit/miss + le board qui se remplit, AVEC et SANS message. Exporte un JSON que la viz REJOUE.
// Aucun chiffre inventé : tout vient de omegaStep. Usage : node evo/evo_p2_capture.js
const fs=require('fs'), path=require('path');
const { loadEngine } = require('./fitness_harness.js');

const CFG=[
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true','M_DECLARE_NEO_ENABLED=false',   // B = cognition seule (marge pour que le message paie)
].join(';');

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const W=LEX.words;
  ev(CFG); ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`); ev(CFG);

  // B joue, et on LOGUE chaque coup : lettre proposée par le moteur, hit/miss, board après, nb d'erreurs.
  ev(`globalThis.__playLog=function(w,msg){
    startNewGame(w); var pre=[];
    for(var li=0;li<msg.length;li++){var idx=msg.charCodeAt(li)-65;if(idx<0||idx>=26)continue;if(typeof alreadyTried!=="undefined")alreadyTried[idx]=true;for(var p=0;p<w.length;p++)if(w[p]===msg[li])revealedMask[p]=true;pre.push(msg[li]);}
    function board(){var s='';for(var p=0;p<w.length;p++)s+=revealedMask[p]?w[p]:'.';return s;}
    var steps=[]; var sf=300, wrong=0;
    while(gameActive&&sf-->0){
      var before=alreadyTried.slice();
      omegaStep();
      for(var i=0;i<26;i++){ if(alreadyTried[i]&&!before[i]){ var ch=String.fromCharCode(65+i); var hit=w.indexOf(ch)>=0; if(!hit)wrong++; steps.push({L:ch,hit:hit,board:board(),wrong:wrong}); } }
    }
    return {won:!!lastGameWon, msg:pre, message:msg, board0:(function(){var s='';for(var p=0;p<w.length;p++)s+=revealedMask[p]?w[p]:'.';return s;})(), steps:steps, len:w.length, wrong:wrong};
  };`);

  // rareté globale (l'info que A exploite)
  const cnt=new Array(26).fill(0); for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m;if(!m)continue;for(const c of m){const k=c.charCodeAt(0)-65;if(k>=0&&k<26)cnt[k]++;}}
  const ranked=w=>[...new Set(w.split(''))].sort((a,b)=>cnt[a.charCodeAt(0)-65]-cnt[b.charCodeAt(0)-65]);

  const valid=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m;if(m&&m.length>=8&&m.length<=12&&/^[A-Z]+$/.test(m))valid.push(m);}
  let r=12345; const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
  const pool=valid.slice(0,2000), demoPool=valid.slice(2000,2160), aggPool=valid.slice(2160,2260);

  // ── (1) A APPREND (vrai entraînement, reward contrastif, value par rang de rareté) ──
  const MAXR=12; const value=new Array(MAXR).fill(0); const LR=0.25, EPOCHS=8, PER=70; const curve=[];
  const smPick=(w,T)=>{ const ds=ranked(w),n=ds.length; const vs=[]; let mx=-1e9;
    for(let rk=0;rk<n;rk++){const v=value[Math.min(rk,MAXR-1)]/T;vs.push(v);if(v>mx)mx=v;}
    let z=0;const ex=vs.map(v=>{const e=Math.exp(v-mx);z+=e;return e;}); let x=rnd()*z,rk=0; for(;rk<n;rk++){x-=ex[rk];if(x<=0)break;} rk=Math.min(rk,n-1);
    return {L:ds[rk],rk:Math.min(rk,MAXR-1)}; };
  const amPick=w=>{ const ds=ranked(w); let bi=0,bv=-1e9; for(let rk=0;rk<ds.length;rk++){const v=value[Math.min(rk,MAXR-1)];if(v>bv){bv=v;bi=rk;}} return ds[bi]; };
  for(let e=0;e<EPOCHS;e++){ const T=Math.max(0.5,2.0*(1-e/EPOCHS)); let win=0;
    for(let n=0;n<PER;n++){ const w=pool[Math.floor(rnd()*pool.length)]; const {L,rk}=smPick(w,T);
      const a=global.__playLog(w,L).won?1:0, b=global.__playLog(w,'').won?1:0; value[rk]+=LR*(a-b); win+=a; }
    curve.push(+(100*win/PER).toFixed(1)); }
  const prefRank=[...value.slice(0,8).keys()].sort((a,b)=>value[b]-value[a])[0];

  // ── (2) AGRÉGAT réel : winrate B sans / avec message appris ──
  let wWithout=0,wWith=0; for(const w of aggPool){ if(global.__playLog(w,'').won)wWithout++; if(global.__playLog(w,amPick(w)).won)wWith++; }
  const aggWithout=+(100*wWithout/aggPool.length).toFixed(1), aggWith=+(100*wWith/aggPool.length).toFixed(1);

  // ── (3) MATCHS de démo : on cherche des mots VARIÉS (message décisif, et message neutre) ──
  const matches=[]; const decisive=[], neutral=[]; let scanned=0;
  for(const w of demoPool){ scanned++; const msg=amPick(w); const withM=global.__playLog(w,msg); const without=global.__playLog(w,'');
    const rec={word:w, message:msg, rarityRank:0, with:{won:withM.won,steps:withM.steps,board0:withM.board0,wrong:withM.wrong}, without:{won:without.won,steps:without.steps,board0:without.board0,wrong:without.wrong}};
    if(withM.won && !without.won) decisive.push(rec); else neutral.push(rec);
    if((decisive.length>=6 && neutral.length>=3) || scanned>=120) break; }
  matches.push(...decisive.slice(0,6), ...neutral.slice(0,3));

  const out={ meta:{ task:'pendu référentiel P2', speaker:'A (apprend quoi souffler)', listener:'B = moteur OMEGA réel (omegaStep, cognition seule)',
      channel:'1 lettre', protocol:'A → la lettre la plus RARE du mot (appris)', wordLenRange:'8-12', fidelity:'100% omegaStep, aucune valeur inventée' },
    learning:{ epochs:EPOCHS, perEpoch:PER, curve, valueByRank:value.slice(0,8).map(v=>+v.toFixed(3)), preferredRank:prefRank, lr:LR },
    aggregate:{ pool:aggPool.length, winrateWithout:aggWithout, winrateWith:aggWith, gain:+(aggWith-aggWithout).toFixed(1) },
    matches };
  const outPath=path.join(__dirname,'p2_capture.json'); fs.writeFileSync(outPath, JSON.stringify(out));
  console.log(`\n=== EVO P2 — CAPTURE (vrai moteur) → ${path.relative(process.cwd(),outPath)} ===`);
  console.log(`apprentissage : winrate/epoch ${curve.join(' ')}  · rang préféré #${prefRank}${prefRank===0?' (plus rare du mot)':''}`);
  console.log(`value par rang [0..4] : ${value.slice(0,5).map(v=>v.toFixed(2)).join(' ')}`);
  console.log(`agrégat (${aggPool.length} mots non vus) : SANS message ${aggWithout}%  →  AVEC message appris ${aggWith}%  (gain ${(aggWith-aggWithout).toFixed(1)} pt)`);
  console.log(`matchs capturés : ${matches.length} (${decisive.length} décisifs + ${neutral.length} neutres)`);
  const ex=matches[0]; if(ex){ console.log(`\nexemple décisif — mot ${ex.word}, A souffle « ${ex.message} » :`);
    console.log(`  AVEC : ${ex.with.steps.map(s=>s.L+(s.hit?'':'✗')).join(' ')} → ${ex.with.won?'GAGNÉ':'perdu'} (${ex.with.wrong} err)`);
    console.log(`  SANS : ${ex.without.steps.map(s=>s.L+(s.hit?'':'✗')).join(' ')} → ${ex.without.won?'gagné':'PERDU'} (${ex.without.wrong} err)`); }
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
