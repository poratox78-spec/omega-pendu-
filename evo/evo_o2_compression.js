'use strict';
// EVO O2 — COMPRESSION : « retrouver les absents = PRÉDIRE = COMPRESSER » (Shannon). On prend le SUBSTRAT d'OMEGA
// (n-gram de caractères, le moteur OOV) comme MODÈLE PRÉDICTIF et on mesure les BITS/CARACTÈRE sur des séquences
// held-out — c'est la version info-théorique du test pendu : moins de bits que le hasard = plus de structure capturée.
//   FR            = mots français (OMEGA_LEX4).
//   CODE          = identifiants des .js du repo (PAS le monolithe, PAS Lex4).
//   CODE-brouillé = mêmes identifiants, caractères mélangés (CONTRÔLE : structure de séquence détruite).
// Juge = bits/car. du modèle n-gram (ordre 3) vs ordre-0 (fréquence). Le GAIN = structure capturée.
//
// RÉSULTAT (3 graines) : FR 3,99→2,98 b (−1,01) · CODE 4,17→3,08 b (−1,09) · brouillé 4,17→4,42 b (+0,25 = AUCUN gain).
// Le substrat COMPRESSE le code aussi bien (un peu mieux même) que le français, et NE compresse RIEN quand la structure
// est détruite. CONCLUSION (= celle du pendu, en bits) : le cœur transférable du mécanisme est un COMPRESSEUR de
// séquences structurées (capture de structure, domaine-agnostique) — pas une compréhension. « Prédire = compresser ».
//   Usage : node evo/evo_o2_compression.js
const fs=require('fs'), path=require('path');
const { loadEngine } = require('./fitness_harness.js');
const ROOT=path.join(__dirname,'..');
const LO=7, HI=12, TEST=400, ORDER=3;

function buildNG(words, order){
  const counts=[]; for(let k=0;k<=order;k++)counts.push(new Map());
  for(const w of words){ for(let i=0;i<w.length;i++){ const c=w.charCodeAt(i)-97; if(c<0||c>25)continue;
    for(let k=0;k<=order;k++){ if(i-k<0)break; const ctx=w.slice(i-k,i); let a=counts[k].get(ctx); if(!a){a=new Float64Array(26);counts[k].set(ctx,a);} a[c]++; } } }
  return {counts,order};
}
function lambdas(order){ let s=0,l=[]; for(let k=0;k<=order;k++){l.push(k+1);s+=k+1;} return l.map(x=>x/s); }
function dist(model, ctxFull){ const {counts,order}=model, lam=lambdas(order), P=new Array(26).fill(0);
  for(let k=0;k<=order;k++){ const ctx=ctxFull.slice(ctxFull.length-k); const a=counts[k].get(ctx); const loc=new Array(26).fill(1/26);
    if(a){ let t=0; for(let c=0;c<26;c++)t+=a[c]; if(t>0)for(let c=0;c<26;c++)loc[c]=a[c]/t; }
    for(let c=0;c<26;c++)P[c]+=lam[k]*loc[c]; }
  let s=0; for(let c=0;c<26;c++)s+=P[c]; for(let c=0;c<26;c++)P[c]/=s; return P;
}
function bitsPerChar(model, test){ let bits=0,n=0;
  for(const w of test){ for(let i=0;i<w.length;i++){ const c=w.charCodeAt(i)-97; if(c<0||c>25)continue;
    const P=dist(model, w.slice(Math.max(0,i-model.order), i)); bits+=-Math.log2(Math.max(P[c],1e-9)); n++; } }
  return bits/n;
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
  for(const f of walk(ROOT,[])){ let t; try{t=fs.readFileSync(f,'utf8');}catch(e){continue;} const mm=t.match(/[A-Za-z]{7,12}/g)||[];
    for(let x of mm){ x=x.toLowerCase(); if(x.length>=LO&&x.length<=HI&&/^[a-z]+$/.test(x))codeSet.add(x); } }
  const code=[...codeSet]; const N=Math.min(fr.length,code.length);
  console.log(`\n=== O2 — COMPRESSION : substrat (n-gram ordre ${ORDER}) en bits/caractère (held-out) ===`);
  console.log(`    FR ${fr.length} · CODE ${code.length} → train égalisé ${N-TEST}, test ${TEST}, long ${LO}-${HI}\n`);
  const SEEDS=[12345,7777,2024];
  function run(words){ let H0=[],H=[];
    for(const sd of SEEDS){ const w=shuffle(words.slice(0,N),sd); const test=w.slice(0,TEST), train=w.slice(TEST);
      H0.push(bitsPerChar(buildNG(train,0),test)); H.push(bitsPerChar(buildNG(train,ORDER),test)); }
    const mean=a=>a.reduce((s,x)=>s+x,0)/a.length; return {h0:+mean(H0).toFixed(2), h:+mean(H).toFixed(2)};
  }
  const rFR=run(fr), rCODE=run(code), rSCR=run(scramble(code,99));
  console.log('  domaine        ordre-0   modèle n-gram   structure capturée   compression');
  for(const [lab,r] of [['FR',rFR],['CODE',rCODE],['CODE-brouillé',rSCR]]){ const g=r.h0-r.h, ratio=(r.h/Math.log2(26)*100);
    console.log(`  ${lab.padEnd(14)} ${(r.h0+' b').padStart(8)}     ${(r.h+' b').padStart(9)}     ${((g>=0?'-':'+')+Math.abs(g).toFixed(2)+' b/car').padStart(12)}      ${ratio.toFixed(0)}% de log2(26)`); }
  const gFR=rFR.h0-rFR.h, gCODE=rCODE.h0-rCODE.h, gSCR=rSCR.h0-rSCR.h;
  const ok = gCODE>=0.3 && gCODE>gSCR+0.25;
  console.log('\n  >>> '+(ok
    ? `✅ COMPRESSE le code (−${gCODE.toFixed(2)} b/car sous l'ordre-0), gain qui DISPARAÎT sur le brouillé (${gSCR>=0?'−':'+'}${Math.abs(gSCR).toFixed(2)}).`
    : `⚠️ compression du code ambiguë (code ${gCODE.toFixed(2)} vs brouillé ${gSCR.toFixed(2)}).`));
  console.log(`      Prédire = compresser : structure capturée en FR (${gFR.toFixed(2)} b) ET en code (${gCODE.toFixed(2)} b), RIEN sur le brouillé (${gSCR.toFixed(2)} b).`);
  console.log(`      → le cœur transférable du mécanisme est un COMPRESSEUR de séquences structurées (domaine-agnostique), pas une compréhension.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
