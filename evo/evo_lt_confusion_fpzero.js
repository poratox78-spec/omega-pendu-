'use strict';
// EVO / SENS × LanguageTool — les 17 confusion sets LEXICAUX de LT passent-ils le portier FP=0 d'OMEGA ?
// Question (cf. comparaison LanguageTool) : LT active ces paires lexicales (bon/bond, vin/vingt…) avec FA/10k≈0
// via un gros facteur. Le moteur « sens » d'OMEGA (Naïve Bayes prior×contexte, Golding&Roth 1999 + lissage,
// held-out) peut-il les flaguer SANS jamais toucher du texte correct (FP=0) — et avec quel recall restant ?
//   FP = sur du texte CORRECT, le modèle propose confidemment l'autre mot (flag à tort).
//   TP = sur une faute injectée (on remplace par l'homophone), le modèle propose confidemment la bonne forme.
// On balaie le seuil de confiance → pour CHAQUE paire : maxFP, puis recall au seuil strictement > maxFP (= FP=0).
// Méthode IDENTIQUE à evo/evo_o2_sense_fpzero.js (mais PAR PAIRE, sur la liste LT, pas les grammaticaux).
//
// CORPUS UD hors-repo (data_local/, cf. evo/evo_o2_homophone_context.js).   Usage : node evo/evo_lt_confusion_fpzero.js
const fs=require('fs'), path=require('path');
const CONLLU=path.join(__dirname,'..','data_local','ud_fr_gsd-train.conllu');
if(!fs.existsSync(CONLLU)){ console.error('UD absent (data_local/) — cf. evo/evo_o2_homophone_context.js'); process.exit(2); }
const WIN=4, LAMBDA=0.5, MINF=4, TESTFRAC=0.25, SEEDS=[1,2,3], MIN_N=20;

const sents=[]; let cur=[];
for(const line of fs.readFileSync(CONLLU,'utf8').split('\n')){
  if(line===''){ if(cur.length){sents.push(cur);cur=[];} continue; }
  if(line[0]==='#') continue;
  const c=line.split('\t'); if(c.length<5||c[0].includes('-')||c[0].includes('.')) continue;
  cur.push(c[1].toLowerCase());
}
if(cur.length)sents.push(cur);
function shuffle(a,seed){ a=a.slice(); let r=seed>>>0; for(let i=a.length-1;i>0;i--){ r=(r*1664525+1013904223)>>>0; const j=r%(i+1); const t=a[i];a[i]=a[j];a[j]=t;} return a; }

// Les 17 confusions LEXICALES ACTIVES de LanguageTool (fr/confusion_sets.txt)
const GROUPS=[
  ['bon','bond'],['dans','dent'],['don','donc'],['moi','mois'],['notre','nôtre'],
  ['pain','pin'],['père','paire'],['peau','pot'],['prix','pris'],['tante','tente'],
  ['toi','toit'],['très','trait'],['vain','vin','vingt'],['verre','vert','vers'],
];
const allc=new Set(); GROUPS.forEach(g=>g.forEach(c=>allc.add(c)));

// stats par groupe, accumulées sur les graines
const ST=GROUPS.map(()=>({FP:[],TP:[],nInj:0,n:0,freq:{}}));

for(const seed of SEEDS){
  const sh=shuffle(sents,seed); const ntest=Math.floor(sh.length*TESTFRAC);
  const test=sh.slice(0,ntest), train=sh.slice(ntest);
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
  for(let gi=0; gi<GROUPS.length; gi++){ const g=GROUPS[gi];
    const cands=g.filter(c=>(freq.get(c)||0)>=MINF);
    for(const c of g) ST[gi].freq[c]=(ST[gi].freq[c]||0)+(freq.get(c)||0);
    if(cands.length<2) continue;
    for(const s of test){ for(let i=0;i<s.length;i++){ const w=s[i]; if(!cands.includes(w))continue;
      const context=[]; for(let j=Math.max(0,i-WIN);j<=Math.min(s.length-1,i+WIN);j++){ if(j!==i)context.push(s[j]); }
      if(context.length<2)continue;
      const p=predict(cands, context);
      ST[gi].n++;
      if(p.top!==w) ST[gi].FP.push(p.conf);
      for(const wrong of cands){ if(wrong===w)continue; ST[gi].nInj++; if(p.top===w) ST[gi].TP.push(p.conf); }
    }}
  }
}

console.log(`UD French-GSD · ${sents.length} phrases · NB prior×contexte, held-out ${TESTFRAC*100}% × ${SEEDS.length} graines`);
console.log(`(LT = les 17 confusion sets lexicaux activés ; verdict = passe FP=0 sur UD ?)\n`);
console.log(`  paire (LT)            n     inj   flags-FP   maxFP-conf   recall@FP=0   verdict`);
let nPass=0, nRare=0, nFail=0;
for(let gi=0; gi<GROUPS.length; gi++){ const st=ST[gi], g=GROUPS[gi];
  const label=g.join('/');
  if(st.n<MIN_N){ nRare++; const fr=g.map(c=>`${c}:${st.freq[c]||0}`).join(' '); console.log(`  ${label.padEnd(20)} ${String(st.n).padStart(4)}   — trop rare dans UD (${fr})`); continue; }
  const maxFP = st.FP.length? Math.max(...st.FP) : 0;
  const recZero = 100*st.TP.filter(c=>c>maxFP).length/st.nInj;
  const pass = recZero>=3;  // un filet utile laisse au moins ~quelques % de recall à FP=0
  if(pass)nPass++; else nFail++;
  console.log(`  ${label.padEnd(20)} ${String(st.n).padStart(4)}  ${String(st.nInj).padStart(4)}   ${String(st.FP.length).padStart(6)}     ${maxFP.toFixed(4).padStart(8)}     ${(recZero.toFixed(1)+'%').padStart(8)}     ${pass?'✅ passe FP=0':'⚠️ recalé'}`);
}
console.log(`\n  === BILAN : ${nPass} passe(nt) FP=0 · ${nFail} recalé(s) · ${nRare} trop rare(s) pour mesurer (sur ${GROUPS.length}) ===`);
console.log(`  Note : "trop rare" = OMEGA ne peut même pas VALIDER la paire sur UD → ne pas brancher à l'aveugle.`);
console.log(`  Rappel grammaticaux (evo_o2_sense_fpzero.js) : FP=0 → recall ~1,6% (recalé). Ici on teste le LEXICAL de LT.`);
