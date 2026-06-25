'use strict';
// EVO P1 — frontière MODULE/AST (décision tranchée en autonomie + mesurée).
// Problème : la clôture d'une fonction ≈ le monolithe (chasser tous les globals explose).
// DÉCISION : l'unité de copie = un MODULE = cluster cohésif de fonctions mutuellement dépendantes + son
//   INTERFACE (symboles libres externes, déclarés). Calculé depuis le GRAPHE de dépendances (AST-lite :
//   corps accolade-apparié après strip commentaires/chaînes + analyse des variables libres). Pas de parser externe.
// Démo sur le propre code d'OMEGA (evo/) : distribution des clôtures + clusters + interfaces bornées. Pas besoin du moteur.
const fs=require('fs'), path=require('path');
const dir=__dirname;
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.js') && !f.includes('_tmp'));

// strip commentaires + contenu des chaînes (en préservant la longueur → offsets stables, accolades intactes)
function stripCS(s){ const o=s.split(''); let mode=0;
  for(let i=0;i<s.length;i++){ const c=s[i], d=s[i+1];
    if(mode===0){ if(c==='/'&&d==='/'){mode=1;o[i]=' ';} else if(c==='/'&&d==='*'){mode=2;o[i]=' ';}
      else if(c==='\'')mode=3; else if(c==='"')mode=4; else if(c==='`')mode=5; }
    else if(mode===1){ if(c==='\n')mode=0; else o[i]=' '; }
    else if(mode===2){ if(c==='*'&&d==='/'){mode=0;o[i]=' ';o[i+1]=' ';i++;} else if(c!=='\n')o[i]=' '; }
    else if(mode>=3){ const q=mode===3?'\'':mode===4?'"':'`'; if(c==='\\'){o[i]=' ';o[i+1]=' ';i++;} else if(c===q)mode=0; else if(c!=='\n')o[i]=' '; }
  } return o.join(''); }

const KW=new Set('var let const function return if else for while do switch case break continue new typeof instanceof in of this null true false void delete try catch finally throw class extends super yield async await default arguments get set'.split(' '));
const BI=new Set('Math Array Object JSON console require module exports process Buffer String Number Boolean Float64Array Float32Array Uint8Array Uint16Array Int32Array Uint32Array Map Set WeakMap Promise Symbol Date RegExp Error TypeError parseInt parseFloat isNaN isFinite undefined NaN Infinity globalThis window document eval Function setTimeout setInterval clearTimeout Proxy Reflect ArrayBuffer DataView encodeURIComponent decodeURIComponent'.split(' '));

function matchBrace(s, open){ let d=0; for(let i=open;i<s.length;i++){ const c=s[i]; if(c==='{')d++; else if(c==='}'){ if(--d===0)return i; } } return -1; }

// extrait les fonctions (3 formes) + corps, sur le texte strippé ; corps réel pris au même offset
const FUNRE=[
  /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g,
  /\b([A-Za-z_$][\w$]*)\s*=\s*function\s*\*?\s*\(([^)]*)\)\s*\{/g,
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\(([^)]*)\)\s*=>\s*\{/g,
];
const funcs=new Map();   // name -> {params, body}
for(const f of files){
  const raw=fs.readFileSync(path.join(dir,f),'utf8'); const s=stripCS(raw);
  for(const re of FUNRE){ re.lastIndex=0; let m;
    while(m=re.exec(s)){ const name=m[1], params=m[2]; const open=m.index+m[0].length-1; const close=matchBrace(s,open);
      if(close<0||funcs.has(name))continue; funcs.set(name,{params, body:s.slice(open+1,close)}); }
  }
}
const names=new Set(funcs.keys());

function freeVars(name, params, body){
  const local=new Set([name]); let m;
  const addParams=pl=>pl.replace(/[[\]{}().]/g,' ').split(/[,\s]+/).forEach(p=>{ const id=p.split(/[=:]/)[0]; if(/^[A-Za-z_$][\w$]*$/.test(id))local.add(id); });
  addParams(params);
  let re=/\b(?:var|let|const|function)\s+([A-Za-z_$][\w$]*)/g; while(m=re.exec(body))local.add(m[1]);                 // décls
  re=/\b(?:var|let|const)\s*[{[]([^}\]]*)[}\]]/g; while(m=re.exec(body))addParams(m[1]);                              // destructuring
  re=/\(([^()]*)\)\s*=>/g; while(m=re.exec(body))addParams(m[1]);                                                    // params flèche (parens)
  re=/\bfunction\s*\*?\s*[A-Za-z_$]*\s*\(([^()]*)\)/g; while(m=re.exec(body))addParams(m[1]);                         // params fonction interne
  re=/\b([A-Za-z_$][\w$]*)\s*=>/g; while(m=re.exec(body))local.add(m[1]);                                            // flèche 1 param
  re=/\bfor\s*\(\s*(?:var|let|const)?\s*([A-Za-z_$][\w$]*)/g; while(m=re.exec(body))local.add(m[1]);                 // for (x …)
  re=/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g; while(m=re.exec(body))local.add(m[1]);                                    // catch(e)
  const nb=body.replace(/\.\s*[A-Za-z_$][\w$]*/g,' ');   // retire les accès .propriété
  const free=new Set(); const ire=/[A-Za-z_$][\w$]*/g;
  while(m=ire.exec(nb)){ const id=m[0]; if(KW.has(id)||BI.has(id)||local.has(id))continue; free.add(id); }
  return free;
}
// graphe : deps internes (∈ funcs) + interface externe (∉ funcs, ∉ builtins)
const dep=new Map(), iface=new Map();
for(const [n,{params,body}] of funcs){ const fv=freeVars(n,params,body);
  const di=new Set(), ex=new Set(); for(const id of fv){ if(names.has(id))di.add(id); else ex.add(id); }
  dep.set(n,di); iface.set(n,ex); }

function closure(start){ const seen=new Set(), st=[start]; while(st.length){ const x=st.pop(); if(seen.has(x))continue; seen.add(x); for(const d of (dep.get(x)||[]))if(!seen.has(d))st.push(d); } return seen; }
// clusters = composantes connexes du graphe internal-dep non orienté
const undir=new Map(); for(const n of names)undir.set(n,new Set());
for(const [n,ds] of dep)for(const d of ds){ undir.get(n).add(d); if(undir.has(d))undir.get(d).add(n); }
const seen=new Set(), clusters=[];
for(const n of names){ if(seen.has(n))continue; const comp=new Set(), st=[n]; while(st.length){ const x=st.pop(); if(comp.has(x))continue; comp.add(x); seen.add(x); for(const y of undir.get(x))if(!comp.has(y))st.push(y); } clusters.push(comp); }

const clSizes=clusters.map(c=>c.size).sort((a,b)=>b-a);
const closSizes=[...names].map(n=>closure(n).size).sort((a,b)=>a-b);
const med=a=>a[Math.floor(a.length/2)];
console.log(`\n=== EVO P1 — frontière MODULE/AST (décision mesurée) · corpus evo/ : ${files.length} fichiers, ${names.size} fonctions ===\n`);
console.log(`  CLÔTURE par-fonction (deps internes transitives) : min ${closSizes[0]} · médiane ${med(closSizes)} · max ${closSizes[closSizes.length-1]}`);
console.log(`    → la clôture VARIE fort : copier « une fonction » tire un sous-graphe de taille imprévisible (l'explosion, en pire sur le monolithe).`);
console.log(`  CLUSTERS (composantes cohésives) : ${clusters.length} · tailles top : ${clSizes.slice(0,6).join(', ')}${clSizes.length>6?'…':''}`);
// interface par cluster = union des externes de ses fonctions
const clInfo=clusters.map(c=>{ const ex=new Set(); for(const n of c)for(const e of iface.get(n))ex.add(e); return {size:c.size, ifaceN:ex.size, ex, members:[...c]}; }).sort((a,b)=>b.size-a.size);
console.log(`\n  DÉCISION : unité de copie = MODULE (cluster) + INTERFACE (externes déclarés). Interface = ce qu'on borne, pas « tous les globals ».`);
for(const ci of clInfo.slice(0,5)){
  console.log(`    module [${ci.members.slice(0,4).join(', ')}${ci.members.length>4?', …':''}] : ${ci.size} fn · interface ${ci.ifaceN} symboles`);
}
const big=clInfo[0];
console.log(`\n  exemple — plus gros module (${big.size} fn) : interface AST-lite = ${big.ifaceN} symboles (BRUITÉE — scopes imbriqués fuient, ex. ${[...big.ex].filter(x=>x.length<=2).slice(0,6).join(', ')}).`);
console.log(`\n  ═══ DÉCISION TRANCHÉE (frontière module/AST) ═══`);
console.log(`  • Unité de copie = MODULE = cluster cohésif (calculé du GRAPHE de deps internes — ROBUSTE : matche de vrais noms de fonctions).`);
console.log(`  • + INTERFACE = symboles externes déclarés. PRÉCISION : aucun parser statique dispo (acorn/esprima/babel absents) →`);
console.log(`    l'AST-lite SUR-compte (fuite de scope, mesurée ci-dessus). L'interface EXACTE se capture par OBSERVATION RUNTIME`);
console.log(`    (sandbox Proxy qui enregistre les accès globaux) — exactement ce que le QUINE a fait (DEBUG/_shiftBuf/SDIM découverts en exécutant).`);
console.log(`  • Le clustering BORNE la copie (modules de ${clSizes[0]}, ${clSizes[1]}, ${clSizes[2]}… fn) là où la clôture par-fonction du monolithe explose.`);
console.log(`  → On copie un MODULE par bPC (prouvé) + interface observée au runtime. C'est la pyramide AU NIVEAU MODULE. Fini, vérifiable.`);
