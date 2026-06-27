'use strict';
// EVO O2 — GÉNÉRALITÉ HORS-FRANÇAIS : le mécanisme fait-il autre chose que du pendu français, sans le lexique ?
// Le moteur est câblé à Lex4 + phonologie française ; on teste donc proprement son SUBSTRAT — cohorte + n-gram
// positionnel, c.-à-d. exactement ce que le bench attribue à l'OOV (« n-gram d'agrégation ») — réimplémenté domaine-
// agnostique, pointé sur DEUX domaines avec la MÊME tâche (reconstruction façon pendu, held-out) :
//   FR            = mots français (OMEGA_LEX4).
//   CODE          = identifiants extraits des .js du repo (PAS le monolithe .html, PAS Lex4) — « le langage du code ».
//   CODE-brouillé = mêmes identifiants, caractères mélangés par mot → CONTRÔLE (structure de séquence détruite).
// Train égalisé (mêmes tailles) + baseline fréquence-seule. Le JUGE = le GAIN du mécanisme sur sa baseline.
//
// RÉSULTAT (3 graines) : gain FR +5,3 · CODE +4,5 · CODE-brouillé −0,3. Le mécanisme TRANSFÈRE au code presque aussi
// bien qu'au français, et son apport S'EFFONDRE quand la structure est détruite. CONCLUSION :
//   • ce qui généralise hors-français = le SUBSTRAT STATISTIQUE (agrégation de structure de séquence), domaine-agnostique ;
//   • ce qui NE transfère PAS = la cognition FRANÇAISE (double-route phono↔ortho), sans objet sur du code (pas de son).
// Autrement dit : le « cœur général » du mécanisme est un reconstructeur de séquences structurées ; la part proprement
// « cognitive » (phonologie) est un spécialiste français qui ne sort pas du français. (Absolus bas = train réduit +
// substrat simplifié ; seul le gain relatif vs baseline/brouillé est le juge.)   Usage : node evo/evo_o2_crossdomain.js
const fs=require('fs'), path=require('path');
const { loadEngine } = require('./fitness_harness.js');
const ROOT=path.join(__dirname,'..');
const LO=7, HI=12, BUDGET=6, TEST=200;

function buildStats(words){
  const byLen={}, posCount={}, gc=new Array(26).fill(1);
  for(const w of words){ const L=w.length; (byLen[L]=byLen[L]||[]).push(w);
    for(let i=0;i<L;i++){ const c=w.charCodeAt(i)-97; if(c<0||c>25)continue; gc[c]++; const k=L+':'+i; (posCount[k]=posCount[k]||new Array(26).fill(1))[c]++; } }
  return {byLen,posCount,gc};
}
function solve(target, stats, {freqOnly=false}={}){
  const L=target.length, rev=new Array(L).fill(null), wrongSet=new Set(), tried=new Set(); let wrong=0;
  const pool=stats.byLen[L]||[];
  while(wrong<BUDGET && rev.includes(null)){
    const score=new Array(26).fill(0); let cohort=null;
    if(!freqOnly){ cohort=[];
      for(const w of pool){ let ok=true;
        for(let i=0;i<L;i++){ if(rev[i]!=null && w[i]!==rev[i]){ok=false;break;} }
        if(ok){ for(const bad of wrongSet){ if(w.indexOf(bad)>=0){ok=false;break;} } }
        if(ok)cohort.push(w); } }
    if(cohort && cohort.length){
      for(const w of cohort){ const seen=new Set();
        for(let i=0;i<L;i++){ if(rev[i]==null){ const c=w.charCodeAt(i)-97; if(c>=0&&c<26&&!seen.has(c)){seen.add(c);score[c]++;} } } }
    } else {
      for(let i=0;i<L;i++){ if(rev[i]!=null)continue; const pc=stats.posCount[L+':'+i]; if(pc)for(let c=0;c<26;c++)score[c]+=pc[c]; }
      if(freqOnly){ for(let c=0;c<26;c++)score[c]=stats.gc[c]; }
    }
    let bL=-1,bS=-1; for(let c=0;c<26;c++){ const ch=String.fromCharCode(97+c); if(tried.has(ch))continue; if(score[c]>bS){bS=score[c];bL=c;} }
    if(bL<0)break; const ch=String.fromCharCode(97+bL); tried.add(ch);
    if(target.indexOf(ch)>=0){ for(let i=0;i<L;i++)if(target[i]===ch)rev[i]=ch; } else { wrong++; wrongSet.add(ch); }
  }
  return !rev.includes(null) && wrong<BUDGET;
}
function shuffle(a,seed){ a=a.slice(); let r=seed>>>0; for(let i=a.length-1;i>0;i--){ r=(r*1664525+1013904223)>>>0; const j=r%(i+1); const t=a[i];a[i]=a[j];a[j]=t; } return a; }
function scramble(words,seed){ return words.map((w,idx)=>{ const a=w.split(''); let r=(seed^(idx*2654435761))>>>0;
  for(let i=a.length-1;i>0;i--){ r=(r*1664525+1013904223)>>>0; const j=r%(i+1); const t=a[i];a[i]=a[j];a[j]=t; } return a.join(''); }); }
function walk(dir,acc){ for(const e of fs.readdirSync(dir,{withFileTypes:true})){ if(e.name==='node_modules'||e.name==='.git')continue; const p=path.join(dir,e.name); if(e.isDirectory())walk(p,acc); else if(e.name.endsWith('.js'))acc.push(p); } return acc; }

(async()=>{
  const O=loadEngine(); await O.loadLex(); const W=O.evalIn('OMEGA_LEX4').words;
  let fr=[]; const seen=new Set();
  for(let i=0;i<W.length;i++){ const m=W[i]&&W[i].m; if(!m||!/^[A-Z]+$/.test(m))continue; const w=m.toLowerCase(); if(w.length<LO||w.length>HI)continue; if(!seen.has(w)){seen.add(w);fr.push(w);} }
  const codeSet=new Set();
  for(const f of walk(ROOT,[])){ let txt; try{txt=fs.readFileSync(f,'utf8');}catch(e){continue;}
    const mm=txt.match(/[A-Za-z]{7,12}/g)||[]; for(let t of mm){ t=t.toLowerCase(); if(t.length>=LO&&t.length<=HI&&/^[a-z]+$/.test(t))codeSet.add(t); } }
  let code=[...codeSet];
  const N=Math.min(fr.length, code.length);
  console.log(`\n=== O2 — généralité hors-français : MÊME mécanisme (cohorte + n-gram), domaines FR vs CODE ===`);
  console.log(`    FR ${fr.length} mots · CODE ${code.length} identifiants → train égalisé ${N-TEST}, test ${TEST}, long. ${LO}-${HI}, budget ${BUDGET}\n`);

  const SEEDS=[12345,7777,2024];
  function run(words){ let wrs=[],bases=[];
    for(const sd of SEEDS){ const w=shuffle(words.slice(0,N),sd); const test=w.slice(0,TEST), train=w.slice(TEST);
      const stats=buildStats(train); let win=0,base=0;
      for(const t of test){ if(solve(t,stats))win++; if(solve(t,stats,{freqOnly:true}))base++; }
      wrs.push(100*win/test.length); bases.push(100*base/test.length); }
    const mean=a=>a.reduce((s,x)=>s+x,0)/a.length; return {wr:+mean(wrs).toFixed(1), base:+mean(bases).toFixed(1)};
  }
  const rFR=run(fr), rCODE=run(code), rSCR=run(scramble(code,99));
  console.log('  domaine        mécanisme   baseline    gain (ce que le mécanisme AJOUTE)');
  for(const [lab,r] of [['FR',rFR],['CODE',rCODE],['CODE-brouillé',rSCR]]){ const g=r.wr-r.base;
    console.log(`  ${lab.padEnd(14)} ${(r.wr+' %').padStart(8)}   ${(r.base+' %').padStart(8)}    ${(g>=0?'+':'')}${g.toFixed(1)}`); }
  const gCODE=rCODE.wr-rCODE.base, gSCR=rSCR.wr-rSCR.base;
  const ok = gCODE>=2 && gCODE>gSCR+1.5;
  console.log('\n  >>> '+(ok
    ? `✅ TRANSFÈRE au code (gain +${gCODE.toFixed(1)}), gain qui S'EFFONDRE sur le code brouillé (+${gSCR.toFixed(1)}).`
    : `⚠️ transfert ambigu (code +${gCODE.toFixed(1)} vs brouillé +${gSCR.toFixed(1)}).`));
  console.log(`      → généralise = le SUBSTRAT statistique (structure de séquence), domaine-agnostique : aide FR ET code, RIEN sans structure.`);
  console.log(`      → ne transfère pas = la cognition FRANÇAISE (double-route phono↔ortho), sans objet sur du code (pas de son).`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
