'use strict';
// EVO O2 / SENS sous FP=0 — MESURE DE CLÔTURE. Existe-t-il un SEUIL DE CONFIANCE où le signal sens (Naïve Bayes
// prior×contexte, Golding&Roth) atteint PRÉCISION ~100 % (FP=0) sur un sous-ensemble qui catch ENCORE des fautes ?
// FP = sur du texte CORRECT, le modèle propose CONFIDEMMENT un autre homophone que l'auteur (flag à tort).
// TP = sur une faute injectée, le modèle propose CONFIDEMMENT la bonne forme. On balaie le seuil → courbe précision/recall.
// Held-out, UD French-GSD. Focus : homophones GRAMMATICAUX (et/est, ce/se… = là où le correcteur s'ABSTIENT).
//
// RÉSULTAT : NON. Pour FP=0 il faut conf > 0,9999 → recall ≈ 1,6 % (à 99,9 % de conf il reste 8 flags à tort).
// Pas de sous-ensemble FP-safe utilisable. Contraste mesuré : le levier déterminant (lexical, propre) passe FP=0
// naturellement (câblé) ; le signal sens (statistique, bruité) ne le franchit qu'en s'effondrant à ~0 recall → recalé.
// → la frontière est CHIFFRÉE : le sens distributionnel ne passe pas FP=0 ; le vrai sens (comprendre) = LLM, hors-doctrine.
// (Caveat : confiance NB sur-optimiste ; une calibration décalerait à peine la courbe, pas de filet propre depuis de la collocation.)
//
// CORPUS UD hors-repo (data_local/, cf. evo/evo_o2_homophone_context.js).   Usage : node evo/evo_o2_sense_fpzero.js
const fs=require('fs'), path=require('path');
const CONLLU=path.join(__dirname,'..','data_local','ud_fr_gsd-train.conllu');
if(!fs.existsSync(CONLLU)){ console.error('UD absent (data_local/) — cf. evo/evo_o2_homophone_context.js'); process.exit(2); }
const WIN=4, LAMBDA=0.5, MINF=4, TESTFRAC=0.25, SEED=12345;

const sents=[]; let cur=[];
for(const line of fs.readFileSync(CONLLU,'utf8').split('\n')){
  if(line===''){ if(cur.length){sents.push(cur);cur=[];} continue; }
  if(line[0]==='#') continue;
  const c=line.split('\t'); if(c.length<5||c[0].includes('-')||c[0].includes('.')) continue;
  cur.push(c[1].toLowerCase());
}
if(cur.length)sents.push(cur);
function shuffle(a,seed){ a=a.slice(); let r=seed>>>0; for(let i=a.length-1;i>0;i--){ r=(r*1664525+1013904223)>>>0; const j=r%(i+1); const t=a[i];a[i]=a[j];a[j]=t;} return a; }
const sh=shuffle(sents,SEED); const ntest=Math.floor(sh.length*TESTFRAC); const test=sh.slice(0,ntest), train=sh.slice(ntest);

const GROUPS=[['et','est'],['ce','se'],['a','à'],['ou','où'],['son','sont'],['ces','ses'],['on','ont']];
const allc=new Set(); GROUPS.forEach(g=>g.forEach(c=>allc.add(c)));
const freq=new Map(), ctx=new Map(), tot=new Map(); const V=new Set();
for(const s of train){ for(let i=0;i<s.length;i++){ const w=s[i];
  if(allc.has(w)){ freq.set(w,(freq.get(w)||0)+1); if(!ctx.has(w))ctx.set(w,new Map()); const cm=ctx.get(w); let t=0;
    for(let j=Math.max(0,i-WIN);j<=Math.min(s.length-1,i+WIN);j++){ if(j===i)continue; cm.set(s[j],(cm.get(s[j])||0)+1); V.add(s[j]); t++; } tot.set(w,(tot.get(w)||0)+t); } } }
const Vn=V.size;
function predict(cands, context){
  const tf=cands.reduce((s,c)=>s+(freq.get(c)||0),0); const sc={};
  for(const c of cands){ let l=Math.log((freq.get(c)||1e-9)/(tf||1)); const cm=ctx.get(c)||new Map(), tc=tot.get(c)||0;
    for(const cw of context) l+=Math.log(((cm.get(cw)||0)+LAMBDA)/(tc+LAMBDA*Vn)); sc[c]=l; }
  const mx=Math.max(...cands.map(c=>sc[c])); let Z=0; for(const c of cands)Z+=Math.exp(sc[c]-mx);
  let top=cands[0]; for(const c of cands)if(sc[c]>sc[top])top=c;
  return {top, conf: Math.exp(sc[top]-mx)/Z};
}
const FP=[], TP=[]; let nInj=0;
for(const s of test){ for(let i=0;i<s.length;i++){ const w=s[i];
  const g=GROUPS.find(g=>g.includes(w)); if(!g)continue;
  const cands=g.filter(c=>(freq.get(c)||0)>=MINF); if(cands.length<2)continue;
  const context=[]; for(let j=Math.max(0,i-WIN);j<=Math.min(s.length-1,i+WIN);j++){ if(j!==i)context.push(s[j]); }
  if(context.length<2)continue;
  const p=predict(cands, context);
  if(p.top!==w) FP.push(p.conf);
  for(const wrong of cands){ if(wrong===w)continue; nInj++; if(p.top===w) TP.push(p.conf); }
}}
console.log(`UD : ${test.length} phrases test · homophones grammaticaux · NB prior×contexte, held-out ${TESTFRAC*100}%\n`);
console.log(`  flags-sur-correct (FP potentiels) : ${FP.length} · fautes injectées : ${nInj} · rattrapées : ${TP.length}\n`);
console.log(`  seuil conf │ flags FP │ vrais positifs │ précision │ recall`);
for(const tau of [0.5,0.7,0.8,0.9,0.95,0.99,0.999,0.9999]){
  const fp=FP.filter(c=>c>=tau).length, tp=TP.filter(c=>c>=tau).length;
  const prec=(tp+fp)?100*tp/(tp+fp):100, rec=100*tp/nInj;
  console.log(`   ${tau.toString().padEnd(8)} │ ${String(fp).padStart(8)} │ ${String(tp).padStart(8)}       │ ${prec.toFixed(1).padStart(6)}%  │ ${rec.toFixed(1).padStart(5)}%`);
}
const maxFP=FP.length?Math.max(...FP):0, recZero=100*TP.filter(c=>c>maxFP).length/nInj;
console.log(`\n  >>> FP=0 exige conf > ${maxFP.toFixed(4)} → recall restant ${recZero.toFixed(1)} %`);
console.log(`      ${recZero>=3?'✅ filet FP-safe existe':'⚠️ FP=0 ne laisse quasi RIEN → le sens distributionnel ne passe pas le portier FP=0 (sujet clos)'}`);
