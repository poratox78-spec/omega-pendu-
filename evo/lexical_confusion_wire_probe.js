'use strict';
// PRE-CÂBLAGE — transforme le signal "sens lexical" en RÈGLE EMBARQUABLE FP=0, et la valide AVANT de toucher au correcteur.
// Le classifieur NB softmax sature (conf→1.0, trompeur). Ici on utilise des LOG-ODDS (pas de saturation) :
//   logodds(occurrence z∈{X,Y}, contexte C) = log(freqY/freqX) + Σ_{w∈C} LLR(w),  LLR(w)=log P(w|Y) − log P(w|X) (lissé).
//   prédiction = Y si logodds>0 sinon X ; "force" = |logodds|.
// FP = sur du texte CORRECT, prédiction≠écrit avec force ≥ seuil. On prend T = (max force d'un FP held-out) + MARGE (headroom).
// Recall = sur faute injectée (on écrit l'autre), prédiction=vrai mot avec force ≥ T.
// Sort une TABLE embarquable (top discriminants) par paire + le seuil T → ce qu'on câblera si ça tient.
//   Usage : node evo/lexical_confusion_wire_probe.js
const fs=require('fs'), path=require('path');
const CONLLU=path.join(__dirname,'..','data_local','ud_fr_gsd-train.conllu');
if(!fs.existsSync(CONLLU)){ console.error('UD absent (data_local/)'); process.exit(2); }
const WIN=4, LAMBDA=0.5, MINF=4, TESTFRAC=0.25, SEEDS=[1,2,3];
const TOPK=40, MIN_CTX_CNT=3, HEADROOM=1.0;   // headroom en log-odds (≈ ×2.7 de marge) pour robustesse hors-UD

const sents=[]; let cur=[];
for(const line of fs.readFileSync(CONLLU,'utf8').split('\n')){
  if(line===''){ if(cur.length){sents.push(cur);cur=[];} continue; }
  if(line[0]==='#') continue;
  const c=line.split('\t'); if(c.length<5||c[0].includes('-')||c[0].includes('.')) continue;
  cur.push(c[1].toLowerCase());
}
if(cur.length)sents.push(cur);
function shuffle(a,seed){ a=a.slice(); let r=seed>>>0; for(let i=a.length-1;i>0;i--){ r=(r*1664525+1013904223)>>>0; const j=r%(i+1); const t=a[i];a[i]=a[j];a[j]=t;} return a; }

// les 4 paires sûres (recall@FP=0 ≥ 18% mesuré) — toutes binaires
const PAIRS=[['père','paire'],['moi','mois'],['très','trait'],['prix','pris']];
const allc=new Set(); PAIRS.forEach(p=>p.forEach(c=>allc.add(c)));

const ST=PAIRS.map(()=>({fpForce:[], inj:0, caughtForce:[], n:0}));
let EMB=null;

for(const seed of SEEDS){
  const sh=shuffle(sents,seed); const ntest=Math.floor(sh.length*TESTFRAC);
  const test=sh.slice(0,ntest), train=sh.slice(ntest);
  const freq=new Map(), ctx=new Map(), tot=new Map(); const V=new Set();
  for(const s of train){ for(let i=0;i<s.length;i++){ const w=s[i];
    if(allc.has(w)){ freq.set(w,(freq.get(w)||0)+1); if(!ctx.has(w))ctx.set(w,new Map()); const cm=ctx.get(w); let t=0;
      for(let j=Math.max(0,i-WIN);j<=Math.min(s.length-1,i+WIN);j++){ if(j===i)continue; cm.set(s[j],(cm.get(s[j])||0)+1); V.add(s[j]); t++; } tot.set(w,(tot.get(w)||0)+t); } } }
  const Vn=V.size;
  // construit LLR par paire (et garde la table du seed 1 pour l'embarqué)
  const tables=PAIRS.map(([X,Y])=>{
    const cmX=ctx.get(X)||new Map(), cmY=ctx.get(Y)||new Map(), tX=tot.get(X)||0, tY=tot.get(Y)||0;
    const words=new Set([...cmX.keys(),...cmY.keys()]); const llr={};
    for(const w of words){ const cX=cmX.get(w)||0, cY=cmY.get(w)||0; if(cX+cY<MIN_CTX_CNT)continue;
      llr[w]=Math.log((cY+LAMBDA)/(tY+LAMBDA*Vn)) - Math.log((cX+LAMBDA)/(tX+LAMBDA*Vn)); }
    // top-K par |llr|
    const top=Object.entries(llr).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,TOPK);
    return {X,Y, prior: Math.log(((freq.get(Y)||0)+LAMBDA)/((freq.get(X)||0)+LAMBDA)), llr:Object.fromEntries(top)};
  });
  if(seed===1) EMB=tables;
  function logodds(tab, context){ let s=tab.prior; for(const w of context) if(tab.llr[w]!==undefined) s+=tab.llr[w]; return s; }
  for(let pi=0; pi<PAIRS.length; pi++){ const [X,Y]=PAIRS[pi]; const tab=tables[pi];
    if((freq.get(X)||0)<MINF || (freq.get(Y)||0)<MINF) continue;
    for(const s of test){ for(let i=0;i<s.length;i++){ const z=s[i]; if(z!==X&&z!==Y)continue;
      const context=[]; for(let j=Math.max(0,i-WIN);j<=Math.min(s.length-1,i+WIN);j++){ if(j!==i)context.push(s[j]); }
      if(context.length<2)continue;
      ST[pi].n++;
      const lo=logodds(tab,context); const pred=lo>0?Y:X, force=Math.abs(lo);
      if(pred!==z) ST[pi].fpForce.push(force);                 // flag sur correct = FP
      // faute injectée : on écrit l'AUTRE, le contexte reste celui de z ; bonne correction = prédire z
      ST[pi].inj++; if(pred===z) ST[pi].caughtForce.push(force);
    }}
  }
}

console.log(`UD French-GSD · règle LOG-ODDS embarquable · held-out ${TESTFRAC*100}% × ${SEEDS.length} graines · headroom ${HEADROOM} log-odds\n`);
console.log(`  paire           n    inj   T(FP=0+marge)   recall@T   #mots embarqués`);
const wire=[];
for(let pi=0; pi<PAIRS.length; pi++){ const st=ST[pi], [X,Y]=PAIRS[pi];
  const maxFP = st.fpForce.length? Math.max(...st.fpForce):0;
  const T = maxFP + HEADROOM;
  const rec = 100*st.caughtForce.filter(f=>f>=T).length/st.inj;
  const nemb = Object.keys(EMB[pi].llr).length;
  wire.push({pair:`${X}/${Y}`, T:+T.toFixed(2), recall:+rec.toFixed(1)});
  console.log(`  ${(X+'/'+Y).padEnd(12)} ${String(st.n).padStart(4)}  ${String(st.inj).padStart(4)}     ${T.toFixed(2).padStart(7)}      ${(rec.toFixed(1)+'%').padStart(7)}        ${nemb}`);
}
console.log(`\n  Verdict câblage : ${wire.filter(w=>w.recall>=8).length}/4 gardent un recall utile (≥8%) à FP=0 AVEC marge de sécurité.`);
console.log(`  (Si une paire tombe ~0% avec headroom, elle ne vaut pas le risque — on ne la câble pas.)`);
// export d'un aperçu de la table embarquable (paire la plus forte)
const best=EMB[0];
console.log(`\n  Aperçu table embarquable « ${best.X}/${best.Y} » (prior=${best.prior.toFixed(2)}, top discriminants) :`);
console.log('   '+Object.entries(best.llr).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,10).map(([w,v])=>`${w}:${v.toFixed(1)}`).join('  '));
