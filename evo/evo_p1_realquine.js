'use strict';
// EVO P1 — QUINE GRANDEUR RÉELLE : OMEGA recopie des fonctions de DÉCISION (exercées pendant le pendu) par codage
// prédictif, les PATCHE dans le moteur vivant, et on vérifie que le pendu rejoue à FITNESS ≥ PARENT.
// Contrôle de FALSIFICATION : une version corrompue d'une de ces fonctions doit CHANGER le fitness (sinon test vide).
// Reconstruction byte-exacte (bPC, hors M3_d) ⇒ comportement identique ⇒ fitness préservé. Usage : node evo/evo_p1_realquine.js
const { loadEngine } = require('./fitness_harness.js');
const fs=require('fs'), path=require('path');

const dir=__dirname;
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.js') && !f.startsWith('evo_p1_') && !f.includes('_tmp'));
let corpus=''; for(const f of files) corpus+='\n'+fs.readFileSync(path.join(dir,f),'utf8');
const RE=/[A-Za-z_$][A-Za-z0-9_$]*|[0-9]+\.?[0-9]*|"[^"\n]*"|'[^'\n]*'|`[^`]*`|\s+|[^\sA-Za-z0-9_$]/g;
const tk=s=>s.match(RE)||[]; const ORDER=6;
function model(toks){ const M=new Map(); for(let i=ORDER;i<toks.length;i++){ const c=toks.slice(i-ORDER,i).join('\x01'); let m=M.get(c); if(!m){m=new Map();M.set(c,m);} m.set(toks[i],(m.get(toks[i])||0)+1);} return M; }
function top1(M,c){ const m=M.get(c); if(!m)return null; let b=null,bc=-1; for(const[t,n]of m){if(n>bc){bc=n;b=t;}} return b; }
function selfCopy(M, src){ const toks=tk(src); const hit=new Uint8Array(toks.length), resid=[];
  for(let i=ORDER;i<toks.length;i++){ const p=top1(M,toks.slice(i-ORDER,i).join('\x01')); if(p===toks[i])hit[i]=1; else resid.push(toks[i]); }
  const out=toks.slice(0,ORDER); let ri=0;
  for(let i=ORDER;i<toks.length;i++){ const p=top1(M,out.slice(i-ORDER,i).join('\x01')); out.push(hit[i]===1?p:resid[ri++]); }
  return { rebuilt: out.join(''), exact: out.join('\x01')===toks.join('\x01') }; }

const CFG=[
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_BPC_READOUT_COUPLE_ENABLED=true','M_PHON_READOUT_COUPLE_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
].join(';');

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const W=LEX.words;
  const M=model(tk(corpus));
  ev(CFG); ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`); ev(CFG);
  ev('globalThis.__play=function(w){try{startNewGame(w);}catch(e){return{won:false,er:6};}var sf=300;while(gameActive&&sf-->0){try{omegaStep();}catch(e){break;}}var t=alreadyTried,wd=currentWord||"",co=0,er=0;for(var i=0;i<26;i++){if(t&&t[i]){co++;if(wd.indexOf(String.fromCharCode(65+i))<0)er++;}}return{won:!!lastGameWon,er:er};};');

  const valid=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&m.length>=7&&m.length<=12&&/^[A-Z]+$/.test(m))valid.push(m);}
  let r=12345; const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
  const words=valid.slice(0,60);
  function fitness(){ ev('_omegaRng=makeMulberry32(999);'); let win=0,err=0; for(const w of words){const x=global.__play(w); if(x.won)win++; err+=x.er;} return {wr:+(100*win/words.length).toFixed(1), err:+(err/words.length).toFixed(3)}; }

  const parent=fitness();

  // 1) reconstruire + PATCHER les fonctions de décision (exercées : concept-bind/readout utilisent circularShift/cosineSim)
  const targets=['cosineSim','circularShiftInPlace','circularShift','circularShiftInverse','normalize'];
  let byteOK=true; const residInfo=[];
  for(const nm of targets){ const src=ev(`(typeof ${nm}==='function')?${nm}.toString():null`); if(!src){byteOK=false;continue;}
    const c=selfCopy(M,src); byteOK=byteOK&&c.exact; ev(`${nm} = ${c.rebuilt}`); residInfo.push(`${nm}${c.exact?'✅':'❌'}`); }
  const candExact=fitness();

  // 2) FALSIFICATION : corrompre cosineSim (négation du résultat) → le fitness DOIT changer si la fonction est sur le chemin
  let corruptOK=false, candCorrupt=null;
  try{ const cs=ev('cosineSim.toString()'); const bad=cs.replace(/return\s+/, 'return -1.0* '); ev('cosineSim = '+bad);
       candCorrupt=fitness(); corruptOK=(candCorrupt.wr!==parent.wr || candCorrupt.err!==parent.err); }
  catch(e){ corruptOK=true; candCorrupt={wr:'throw',err:e.message.slice(0,20)}; }
  ev('cosineSim = '+ev('cosineSim.toString()'));  // (laisse l'état corrompu ; le process se termine)

  const exactPreserved = (candExact.wr===parent.wr && candExact.err===parent.err);
  console.log(`\n=== EVO P1 — QUINE GRANDEUR RÉELLE (recopie de fonctions de décision dans le pendu vivant) ===`);
  console.log(`grammaire bPC = propre code evo/ · ${words.length} mots seedés · config substrat actif\n`);
  console.log(`  reconstruction byte-exacte : ${byteOK?'✅ '+targets.length+' fonctions':'❌'}  [${residInfo.join(' ')}]`);
  console.log(`  fitness PARENT (original)      : winrate ${parent.wr}% · err/partie ${parent.err}`);
  console.log(`  fitness COPIE EXACTE (patchée) : winrate ${candExact.wr}% · err/partie ${candExact.err}  → ${exactPreserved?'✅ IDENTIQUE (fitness préservé)':'❌ diffère'}`);
  console.log(`  fitness COPIE CORROMPUE (ctrl) : winrate ${candCorrupt.wr}% · err/partie ${candCorrupt.err}  → ${corruptOK?'✅ CHANGE (donc la fonction est bien sur le chemin de décision)':'⚠️ inchangé (fonction non pivot dans cette config)'}`);
  const ok = byteOK && exactPreserved && corruptOK;
  console.log(`\n  ${ok?'✅ QUINE GRANDEUR RÉELLE VÉRIFIÉ':'❌ échec'} : OMEGA recopie son code de DÉCISION par bPC, le pendu rejoue à fitness identique ;`);
  console.log(`    le contrôle corrompu prouve que le test n'est pas vide (le code recopié est réellement exécuté pendant le jeu).`);
  process.exit(ok?0:1);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
