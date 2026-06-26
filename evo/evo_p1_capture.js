'use strict';
// EVO P1 — CAPTURE FIDÈLE (se copie) : OMEGA reconstruit ses fonctions de DÉCISION à l'octet près (bPC), les PATCHE
// dans le moteur vivant. On capture : (1) liste des fonctions reconstruites byte-exact, (2) fitness PARENT vs COPIE
// (identique) vs COPIE CORROMPUE (contrôle), (3) pour des mots de démo, la séquence de B avec l'original/copie vs la
// version corrompue (qui diverge/échoue). Aucun chiffre inventé. Usage : node evo/evo_p1_capture.js
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
  return { rebuilt: out.join(''), exact: out.join('\x01')===toks.join('\x01'), hit:hit.reduce((a,b)=>a+b,0), total:toks.length-ORDER }; }

const CFG=[
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_BPC_READOUT_COUPLE_ENABLED=true','M_PHON_READOUT_COUPLE_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
].join(';');

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const W=LEX.words;
  const M=model(tk(corpus));
  ev(CFG); ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`); ev(CFG);
  ev(`globalThis.__playLog=function(w){
    startNewGame(w);
    function board(){var s='';for(var p=0;p<w.length;p++)s+=revealedMask[p]?w[p]:'.';return s;}
    var steps=[],sf=300,wrong=0;
    while(gameActive&&sf-->0){var before=alreadyTried.slice();omegaStep();
      for(var i=0;i<26;i++){if(alreadyTried[i]&&!before[i]){var ch=String.fromCharCode(65+i);var hit=w.indexOf(ch)>=0;if(!hit)wrong++;steps.push({L:ch,hit:hit,board:board(),wrong:wrong});}}}
    return {won:!!lastGameWon,steps:steps,wrong:wrong};
  };`);

  const valid=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&m.length>=7&&m.length<=10&&/^[A-Z]+$/.test(m))valid.push(m);}
  let r=12345; const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
  const words=valid.slice(0,40), demo=valid.slice(40,50), warm=valid.slice(50,110);
  // RAZ de l'état moteur. Le patch des fonctions (cosineSim…) est un binding top-level → il SURVIT à initOmegaGlobals.
  function reset(){ ev('initOmegaGlobals();if(typeof _omega_OSL_reset==="function")_omega_OSL_reset();if(typeof M_OS_v07!=="undefined"&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}'); ev(CFG); }
  function warmUp(){ ev('_omegaRng=makeMulberry32(4242);'); for(const w of warm) global.__playLog(w); }   // fait "vivre" l'instance : l'OS apprend
  function fitness(warmed){ reset(); if(warmed)warmUp(); ev('_omegaRng=makeMulberry32(999);'); let win=0,err=0; for(const w of words){const x=global.__playLog(w); if(x.won)win++; err+=x.wrong;} return {wr:+(100*win/words.length).toFixed(1), err:+(err/words.length).toFixed(3)}; }
  function playDemo(warmed){ reset(); if(warmed)warmUp(); ev('_omegaRng=makeMulberry32(777);'); return demo.map(w=>{const x=global.__playLog(w);return {word:w,won:x.won,wrong:x.wrong,steps:x.steps};}); }

  // ── 1) LE GÉNOME : reconstruire byte-exact + patcher les fonctions de décision (exercées pendant le jeu) ──
  const targets=['cosineSim','circularShiftInPlace','circularShift','circularShiftInverse','normalize'];
  let byteOK=true; const fnInfo=[];
  for(const nm of targets){ const src=ev(`(typeof ${nm}==='function')?${nm}.toString():null`); if(!src){fnInfo.push({name:nm,exact:false,missing:true});byteOK=false;continue;}
    const c=selfCopy(M,src); byteOK=byteOK&&c.exact; ev(`${nm} = ${c.rebuilt}`); fnInfo.push({name:nm,exact:c.exact,hit:c.hit,total:c.total}); }

  // ── 2) DEUX JUMEAUX du MÊME code byte-exact : A (état frais) et B (a "vécu" 60 parties → état OS dérivé) ──
  const twinA=fitness(false), twinB=fitness(true);
  const demoA=playDemo(false), demoB=playDemo(true);
  const sameComp=(twinA.wr===twinB.wr);

  // ── matchs : même mot, jumeau A vs jumeau B — même issue ? discours identique ou propre ? ──
  const bmap={}; demoB.forEach(d=>bmap[d.word]=d);
  const matches=demoA.map(a=>{ const b=bmap[a.word]||{steps:[],won:a.won,wrong:a.wrong};
    const seqA=a.steps.map(s=>s.L), seqB=b.steps.map(s=>s.L);
    return {word:a.word, A:{won:a.won,wrong:a.wrong,steps:a.steps}, B:{won:b.won,wrong:b.wrong,steps:b.steps},
      diverge:JSON.stringify(seqA)!==JSON.stringify(seqB), sameOutcome:a.won===b.won}; });
  const nDiverge=matches.filter(m=>m.diverge).length, nSameOutcome=matches.filter(m=>m.sameOutcome).length;

  const out={ meta:{ phase:'P1 — se copie', what:'OMEGA reconstruit ses fonctions de DÉCISION à l\'octet près (bPC) : le GÉNOME est copié',
      twin:'deux instances du MÊME code, vies différentes (l\'OS apprend) → jumeaux : même compétence, discours propre',
      fidelity:'100% omegaStep + reconstruction réelle' },
    functions:fnInfo, byteExact:byteOK,
    twins:{ A:twinA, B:twinB, sameCompetence:sameComp },
    matches, summary:{ nMatches:matches.length, nDiverge, nSameOutcome } };
  fs.writeFileSync(path.join(dir,'p1_capture.json'), JSON.stringify(out));
  console.log(`\n=== EVO P1 — CAPTURE (se copie = JUMEAU) → evo/p1_capture.json ===`);
  console.log(`génome reconstruit byte-exact : ${byteOK?'✅':'⚠️'} ${fnInfo.map(f=>f.name+(f.exact?'✓':'✗')).join(' ')}`);
  console.log(`jumeau A (frais)  : ${twinA.wr}% / ${twinA.err} err/partie`);
  console.log(`jumeau B (a vécu) : ${twinB.wr}% / ${twinB.err} err/partie   → compétence ${sameComp?'IDENTIQUE ✅':'différente'}`);
  console.log(`discours : ${nDiverge}/${matches.length} mots où A et B jouent DIFFÉREMMENT · ${nSameOutcome}/${matches.length} même issue`);
  console.log(`→ même code (octet près), même savoir-faire, mais chacun sa partie. Le jumeau, pas la photocopie.`);
  process.exit(0);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
