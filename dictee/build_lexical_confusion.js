'use strict';
// GÉNÈRE dictee/lexical_confusion.json — table embarquable FP=0 pour la règle « confusion lexicale » du correcteur.
// 2 paires d'homophones VALIDÉES (passent FP=0 avec marge : père/paire 75%, moi/mois 44% — cf. evo/lexical_confusion_wire_probe.js).
// Modèle = LOG-ODDS interprétable : logodds(z,ctx)=log(freqY/freqX)+Σ LLR(w) ; flag si force≥T et prédit l'AUTRE.
// Entraîné sur 75 % UD (seed fixe), seuil T calibré FP=0+marge sur 25 % held-out (pas de fuite). Consommé par les 3 moteurs.
//   Corpus UD hors-repo (data_local/, cf. evo/evo_o2_homophone_context.js).   Usage : node dictee/build_lexical_confusion.js
const fs=require('fs'), path=require('path');
const CONLLU=path.join(__dirname,'..','data_local','ud_fr_gsd-train.conllu');
if(!fs.existsSync(CONLLU)){ console.error('UD absent (data_local/). JSON non régénéré (l\'existant reste valable).'); process.exit(2); }
const WIN=4, LAMBDA=0.5, MINF=4, TESTFRAC=0.25, SEEDS=[1,2,3,12345], TOPK=40, MIN_CTX_CNT=3, HEADROOM=1.0;
const PAIRS=[['père','paire'],['moi','mois']];   // les 2 qui tiennent FP=0 avec marge
const isWord = w => /[a-zà-öù-ÿœæ]/i.test(w) && /^[a-zà-öù-ÿœæ'’-]+$/i.test(w);  // alphabétique (élide la ponctuation)

const sents=[]; let cur=[];
for(const line of fs.readFileSync(CONLLU,'utf8').split('\n')){
  if(line===''){ if(cur.length){sents.push(cur);cur=[];} continue; }
  if(line[0]==='#') continue;
  const c=line.split('\t'); if(c.length<5||c[0].includes('-')||c[0].includes('.')) continue;
  cur.push(c[1].toLowerCase());
}
if(cur.length)sents.push(cur);
function shuffle(a,seed){ a=a.slice(); let r=seed>>>0; for(let i=a.length-1;i>0;i--){ r=(r*1664525+1013904223)>>>0; const j=r%(i+1); const t=a[i];a[i]=a[j];a[j]=t;} return a; }
const allc=new Set(); PAIRS.forEach(p=>p.forEach(c=>allc.add(c)));

// entraîne un modèle LLR (prior+llr top-K) sur un sous-corpus
function trainLLR(corpus){
  const freq=new Map(), ctx=new Map(), tot=new Map(), V=new Set();
  for(const s of corpus){ for(let i=0;i<s.length;i++){ const w=s[i];
    if(allc.has(w)){ freq.set(w,(freq.get(w)||0)+1); if(!ctx.has(w))ctx.set(w,new Map()); const cm=ctx.get(w); let t=0;
      for(let j=Math.max(0,i-WIN);j<=Math.min(s.length-1,i+WIN);j++){ if(j===i)continue; const cw=s[j]; if(!isWord(cw))continue; cm.set(cw,(cm.get(cw)||0)+1); V.add(cw); t++; } tot.set(w,(tot.get(w)||0)+t); } } }
  const Vn=V.size; const models={};
  for(const [X,Y] of PAIRS){
    const cmX=ctx.get(X)||new Map(), cmY=ctx.get(Y)||new Map(), tX=tot.get(X)||0, tY=tot.get(Y)||0;
    const words=new Set([...cmX.keys(),...cmY.keys()]); const llrAll={};
    for(const w of words){ const cX=cmX.get(w)||0, cY=cmY.get(w)||0; if(cX+cY<MIN_CTX_CNT)continue;
      llrAll[w]=Math.log((cY+LAMBDA)/(tY+LAMBDA*Vn)) - Math.log((cX+LAMBDA)/(tX+LAMBDA*Vn)); }
    const top=Object.entries(llrAll).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,TOPK);
    models[X+'/'+Y]={x:X,y:Y,prior:Math.log(((freq.get(Y)||0)+LAMBDA)/((freq.get(X)||0)+LAMBDA)),
                     llr:Object.fromEntries(top.map(([w,v])=>[w,+v.toFixed(4)])), freqX:freq.get(X)||0, freqY:freq.get(Y)||0};
  }
  return models;
}
function lo(m,context){ let s=m.prior; for(const w of context) if(m.llr[w]!==undefined) s+=m.llr[w]; return s; }
function evalFold(model, test){  // -> {maxFP, atT:fn}
  const res={}; for(const k in model){ res[k]={maxFP:0, forces:[], inj:0}; }
  for(const s of test){ for(let i=0;i<s.length;i++){ const z=s[i];
    for(const k in model){ const m=model[k]; if(z!==m.x&&z!==m.y)continue;
      const context=[]; for(let j=Math.max(0,i-WIN);j<=Math.min(s.length-1,i+WIN);j++){ if(j!==i&&isWord(s[j]))context.push(s[j]); }
      if(context.length<2)continue;
      const v=lo(m,context), pred=v>0?m.y:m.x, f=Math.abs(v);
      if(pred!==z && f>res[k].maxFP) res[k].maxFP=f;
      res[k].inj++; res[k].forces.push({pred,z,f});
    } } }
  return res;
}
// CALIBRATION 3-fold+ CV (pire cas) : T = max sur les folds du maxFP held-out + HEADROOM
const worstMaxFP={}, recAtT={}; PAIRS.forEach(([X,Y])=>{worstMaxFP[X+'/'+Y]=0;});
const foldRec={};
for(const seed of SEEDS){
  const sh=shuffle(sents,seed); const nt=Math.floor(sh.length*TESTFRAC); const test=sh.slice(0,nt), train=sh.slice(nt);
  const m=trainLLR(train); const r=evalFold(m,test);
  for(const k in r){ if(r[k].maxFP>worstMaxFP[k]) worstMaxFP[k]=r[k].maxFP; (foldRec[k]=foldRec[k]||[]).push(r); }
}
// modèle FINAL = entraîné sur TOUT le corpus (meilleures estimations) ; T = worstMaxFP + headroom
const finalM=trainLLR(sents);
const out={win:WIN, note:'logodds(z,ctx)=prior+Σllr(w); flag l\'AUTRE si force≥T (homophone vrai → contexte seul tranche). FP=0 calibré CV pire-cas + marge, held-out UD. build: dictee/build_lexical_confusion.js', pairs:[]};
for(const [X,Y] of PAIRS){ const k=X+'/'+Y; const m=finalM[k];
  const T=+(worstMaxFP[k]+HEADROOM).toFixed(4);
  // recall CV moyen à ce T (sur les folds)
  let inj=0, caught=0; for(const r of foldRec[k]){ const rr=r[k]; inj+=rr.inj; caught+=rr.forces.filter(o=>o.pred===o.z&&o.f>=T).length; }
  const recall=inj?(100*caught/inj).toFixed(1):'0';
  out.pairs.push({x:X,y:Y,prior:+m.prior.toFixed(4),T,llr:m.llr});
  console.error(`  ${X}/${Y} : T=${T} (worstMaxFP=${worstMaxFP[k].toFixed(2)} +${HEADROOM}) · recall CV@T≈${recall}% · ${Object.keys(m.llr).length} discriminants · freq ${X}:${m.freqX} ${Y}:${m.freqY}`);
}
const dst=path.join(__dirname,'lexical_confusion.json');
fs.writeFileSync(dst, JSON.stringify(out,null,1));
console.error(`  → écrit ${dst}`);
