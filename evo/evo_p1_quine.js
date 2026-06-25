'use strict';
// EVO P1 — JALON QUINE. OMEGA lit le source de ses propres fonctions (toString), les RECOPIE par codage
// prédictif (descendant prédit / on stocke l'erreur), les RÉ-INSTANCIE (eval) et VÉRIFIE :
//   (1) reconstruction byte-exacte    (2) COMPORTEMENT identique sur entrées aléatoires (« ça tourne »).
// Grammaire (descendant) apprise sur le propre code evo/ ; cibles = vraies fonctions du moteur. Hors M3_d.
// Usage : node evo/evo_p1_quine.js
const { loadEngine } = require('./fitness_harness.js');
const fs=require('fs'), path=require('path');

const dir=__dirname;
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.js') && !f.startsWith('evo_p1_') && !f.includes('_tmp'));
let corpus=''; for(const f of files) corpus+='\n'+fs.readFileSync(path.join(dir,f),'utf8');
const RE=/[A-Za-z_$][A-Za-z0-9_$]*|[0-9]+\.?[0-9]*|"[^"\n]*"|'[^'\n]*'|`[^`]*`|\s+|[^\sA-Za-z0-9_$]/g;
const tk=s=>s.match(RE)||[];
const ORDER=6;
function buildModel(toks){ const M=new Map(); for(let i=ORDER;i<toks.length;i++){ const c=toks.slice(i-ORDER,i).join('\x01'); let m=M.get(c); if(!m){m=new Map();M.set(c,m);} m.set(toks[i],(m.get(toks[i])||0)+1);} return M; }
function top1(M,c){ const m=M.get(c); if(!m)return null; let b=null,bc=-1; for(const[t,n]of m){if(n>bc){bc=n;b=t;}} return b; }

// codage prédictif : encode (miss only) + decode + vérif exacte
function selfCopy(M, src){ const toks=tk(src); const hit=new Uint8Array(toks.length), resid=[];
  for(let i=ORDER;i<toks.length;i++){ const p=top1(M,toks.slice(i-ORDER,i).join('\x01')); if(p===toks[i])hit[i]=1; else resid.push(toks[i]); }
  const out=toks.slice(0,ORDER); let ri=0;
  for(let i=ORDER;i<toks.length;i++){ const p=top1(M,out.slice(i-ORDER,i).join('\x01')); out.push(hit[i]===1?p:resid[ri++]); }
  return { rebuilt: out.join(''), exact: out.join('\x01')===toks.join('\x01'), resid: resid.length, total: toks.length-ORDER }; }

const rndVec=n=>Array.from({length:n},()=>Math.random()*2-1);
const eq=(a,b)=>{ if(Array.isArray(a)||ArrayBuffer.isView(a)){ if(a.length!==b.length)return false; for(let i=0;i<a.length;i++) if(Math.abs(a[i]-b[i])>1e-9)return false; return true; } return Math.abs(a-b)<1e-9; };
function behavior(nm, orig, copy){
  try{ for(let t=0;t<25;t++){ let ro,rc;
    if(nm==='cosineSim'){ const a=rndVec(48),b=rndVec(48); ro=orig(a,b); rc=copy(a,b); }
    else if(nm==='normalize'){ const a=rndVec(48); ro=orig(a.slice()); rc=copy(a.slice()); }
    else if(nm==='circularShift'||nm==='circularShiftInverse'){ const a=rndVec(48),s=Math.floor(Math.random()*48); ro=orig(a,s); rc=copy(a,s); }
    else return 'non-testé';
    if(!eq(ro,rc)) return 'DIFFÈRE'; }
    return 'identique'; }catch(e){ return 'ERR:'+e.message; }
}

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn;
  const M=buildModel(tk(corpus));
  // clôture de dépendances : dep d'abord (circularShiftInPlace ← circularShift ← circularShiftInverse)
  const closure=['circularShiftInPlace','cosineSim','normalize','circularShift','circularShiftInverse'];
  const tests  =['cosineSim','normalize','circularShift','circularShiftInverse'];
  console.log(`\n=== EVO P1 — JALON QUINE (bPC ordre-${ORDER}, grammaire = propre code evo/) ===`);
  console.log(`OMEGA lit ses fonctions (+ leur clôture de dépendances) → recopie par prédiction+erreur → ré-instancie → vérifie\n`);
  let allByteOK=true; const rebuilts=[];
  for(const nm of closure){
    const src=ev(`(typeof ${nm}==='function')?${nm}.toString():null`);
    if(!src){ console.log(`  ${nm.padEnd(22)} introuvable`); allByteOK=false; continue; }
    const r=selfCopy(M, src); allByteOK = allByteOK && r.exact;
    rebuilts.push(r.rebuilt);
    console.log(`  ${nm.padEnd(22)} byte-exact ${r.exact?'✅':'❌'} · résidu ${String(r.resid).padStart(3)}/${String(r.total).padStart(3)} régénéré ${(100*(1-r.resid/r.total)).toFixed(0)}%`);
  }
  // ré-instancie TOUTE la clôture dans une portée partagée → les dépendances se résolvent
  let fns=null, factErr=null;
  // variables LIBRES de la clôture (au-delà des fonctions) : flags + buffers d'état. Fournies depuis le moteur.
  const ENV={ DEBUG: ev('typeof DEBUG!=="undefined"?DEBUG:false'),
              _shiftBuf: ev('typeof _shiftBuf!=="undefined"?_shiftBuf:null'),
              SDIM: ev('typeof SDIM!=="undefined"?SDIM:1024') };
  try{ fns=new Function('DEBUG','_shiftBuf','SDIM', rebuilts.join('\n')+'\n; return {'+closure.join(',')+'};')(ENV.DEBUG, ENV._shiftBuf, ENV.SDIM); }
  catch(e){ factErr=e.message; }
  const selfContained=['cosineSim','normalize'];
  console.log('');
  let coreOK=true, closOK=true;
  if(factErr){ console.log(`  ré-instanciation : ❌ ${factErr}`); coreOK=false; closOK=false; }
  else for(const nm of tests){
    const b=behavior(nm, ev(nm), fns[nm]); const ok=(b==='identique');
    if(selfContained.includes(nm)) coreOK=coreOK&&ok; else closOK=closOK&&ok;
    console.log(`  ${nm.padEnd(22)} comportement ${b.padEnd(12)} ${ok?'✅':'⚠️'}`);
  }
  const quineOK=allByteOK&&coreOK;
  console.log(`\n  reconstruction bPC byte-exacte : ${allByteOK?'✅ les 5 fonctions':'❌'}`);
  console.log(`  ${quineOK?'✅ QUINE VÉRIFIÉ':'❌ échec'} : fonctions auto-contenues recopiées par bPC ET tournent à l'identique (cosineSim, normalize).`);
  const closMsg = closOK ? '✅ tournent aussi (env fourni)' : '⚠️ exigent leur clôture complète (deps + globals + état) = la pyramide du graphe appel';
  console.log(`  clôture (circularShift…) : ${closMsg}.`);
  console.log(`  → reconstruction = prédiction+erreur (lossless, hors M3_d) ; une fonction runnable = un NŒUD + sa clôture, pas une ligne.`);
  process.exit(quineOK?0:1);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
