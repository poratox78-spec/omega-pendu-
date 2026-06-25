'use strict';
// EVO P1 — RÉGÉNÉRATEUR par CODAGE PRÉDICTIF (bPC fait correctement). Doc COGNITION_DESIGN §3 (Rao&Ballard,
// Friston) : descendant = PRÉDICTIONS, montant = ERREUR résiduelle. La doc dit aussi : M3_d = spoke pauvre
// (longueur), winrate-inerte, « ni construire dessus ni le laisser décider » → on N'utilise PAS M3_d.
// Ici : prédicteur CONTEXTUEL (ordre-k, le « descendant » riche que la doc prescrit) ; on n'encode que les MISS
// (l'irrégulier) ; on RECONSTRUIT et on VÉRIFIE l'identité exacte (copie lossless = se copier pour de vrai).
// Pas besoin du moteur. Usage : node evo/evo_p1_predcode.js
const fs=require('fs'), path=require('path'), zlib=require('zlib');
const dir=__dirname;
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.js') && !f.startsWith('evo_p1_') && !f.includes('_tmp'));
let code=''; for(const f of files) code+='\n'+fs.readFileSync(path.join(dir,f),'utf8');
const toks=code.match(/[A-Za-z_$][A-Za-z0-9_$]*|[0-9]+\.?[0-9]*|"[^"\n]*"|'[^'\n]*'|`[^`]*`|\s+|[^\sA-Za-z0-9_$]/g)||[];
const SEP='';

function model(order){ const M=new Map();
  for(let i=order;i<toks.length;i++){ const ctx=toks.slice(i-order,i).join(SEP); let m=M.get(ctx); if(!m){m=new Map();M.set(ctx,m);} m.set(toks[i],(m.get(toks[i])||0)+1); }
  return M; }
function top1(M,ctx){ const m=M.get(ctx); if(!m)return null; let bt=null,bc=-1; for(const[t,c]of m){if(c>bc){bc=c;bt=t;}} return bt; }

function predcode(order){
  const M=model(order);
  // ENCODE : descendant prédit, on ne garde que les MISS (montant = erreur)
  const hitStream=new Uint8Array(toks.length); const resid=[];
  for(let i=order;i<toks.length;i++){ const p=top1(M, toks.slice(i-order,i).join(SEP));
    if(p===toks[i]) hitStream[i]=1; else resid.push(toks[i]); }
  // DECODE : on rejoue le prédicteur, on n'injecte le résidu qu'aux miss → reconstruction
  const out=toks.slice(0,order); let ri=0;
  for(let i=order;i<toks.length;i++){ const p=top1(M, out.slice(i-order,i).join(SEP));
    out.push(hitStream[i]===1 ? p : resid[ri++]); }
  const ok = out.length===toks.length && out.join(SEP)===toks.join(SEP);   // VÉRIF identité exacte
  const hits=hitStream.reduce((a,b)=>a+b,0)-0;
  const residStr=resid.join('');
  return { order, hits, total: toks.length-order, resid: resid.length,
           residGz: zlib.gzipSync(Buffer.from(residStr)).length, contexts: M.size, ok };
}

const rawGz=zlib.gzipSync(Buffer.from(code)).length, rawB=Buffer.byteLength(code);
console.log(`\n=== EVO P1 — régénérateur par CODAGE PRÉDICTIF (bPC) sur le propre code d'OMEGA ===`);
console.log(`corpus ${files.length} fichiers · ${toks.length} tokens · ${(rawB/1024).toFixed(1)} Ko (gzip ${(rawGz/1024).toFixed(1)} Ko = ${(rawB/rawGz).toFixed(1)}×)`);
console.log(`descendant = prédicteur contextuel ordre-k ; on ne stocke que l'ERREUR (miss). Reconstruction VÉRIFIÉE exacte.\n`);
console.log(`  ordre │ régénéré (hit) │ résidu (miss) │ résidu gzip │ contextes │ exact ?`);
console.log(`  ──────┼────────────────┼───────────────┼─────────────┼───────────┼────────`);
for(const k of [2,3,4,5]){
  const r=predcode(k);
  console.log(`    ${k}   │    ${(100*r.hits/r.total).toFixed(1).padStart(5)} %    │  ${String(r.resid).padStart(5)} (${(100*r.resid/r.total).toFixed(1)}%) │  ${(r.residGz/1024).toFixed(1).padStart(5)} Ko │  ${String(r.contexts).padStart(6)}  │  ${r.ok?'✅ OUI':'❌ NON'}`);
}
console.log(`\n  → le descendant régénère l'essentiel ; on ne stocke que le résidu (l'irrégulier). Reconstruction LOSSLESS vérifiée`);
console.log(`    = OMEGA se copie pour de vrai par prédiction+erreur (bPC), PAS en stockant la ligne, PAS via M3_d.`);
console.log(`  ⚠️ honnêteté : le prédicteur (contextes) est lui-même un coût (la « grammaire ») ; ordre↑ = moins de résidu`);
console.log(`    mais plus de contextes. Le bon point = minimiser (résidu + grammaire), c'est le MDL (garde §3 du moteur).`);
