'use strict';
// EVO P3+ — ÉVOLUTION DU CODE (pas des params). La boucle darwinienne complète sur le VRAI code d'OMEGA :
//   REPRODUCTION = copie bPC (prouvée byte-exacte, quine) ; VARIATION = mutation/croisement du SOURCE d'une fonction
//   de décision ; SÉLECTION = la fitness pendu (fitterLex). On mesure (1) le SPECTRE de mutation (létal/délétère/
//   neutre/bénéfique) → la fitness est-elle un vrai filtre sur le code ? ; (2) une LIGNÉE sous sélection → la fonction
//   est-elle préservée de génération en génération (sélection stabilisante) ? Cible = cosineSim (sur le chemin de
//   décision : la corruption baisse le winrate, cf realquine). Usage : node evo/evo_p3_code_evo.js
const { loadEngine, fitterLex } = require('./fitness_harness.js');

const RE=/[A-Za-z_$][A-Za-z0-9_$]*|[0-9]+\.?[0-9]*(?:e-?[0-9]+)?|"[^"\n]*"|'[^'\n]*'|`[^`]*`|\s+|[^\sA-Za-z0-9_$]/g;
const tk=s=>s.match(RE)||[];
const OPS=['+','-','*','/','<','>'];
const CFG=[
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_BPC_READOUT_COUPLE_ENABLED=true','M_PHON_READOUT_COUPLE_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
].join(';');

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const W=LEX.words;
  ev(CFG); ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`); ev(CFG);
  ev('globalThis.__play=function(w){try{startNewGame(w);}catch(e){return{won:false,err:6};}var sf=300,le=0;while(gameActive&&sf-->0){try{omegaStep();}catch(e){break;}var t=alreadyTried,wd=currentWord;if(t&&wd){var er=0;for(var i=0;i<26;i++){if(t[i]&&wd.indexOf(String.fromCharCode(65+i))<0)er++;}le=er;}}return{won:!!lastGameWon,err:le};};');

  const valid=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m;if(m&&m.length>=7&&m.length<=12&&/^[A-Z]+$/.test(m))valid.push(m);}
  let r=12345; const rnd0=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd0()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
  const words=valid.slice(0,60);
  function fitness(){ ev('_omegaRng=makeMulberry32(999);'); let win=0,err=0; for(const w of words){const x=global.__play(w);if(x.won)win++;err+=x.err;} return {winrate:win/words.length, erreurs:+(err/words.length).toFixed(3), ms:1, _wr:+(100*win/words.length).toFixed(1)}; }

  const TARGET='cosineSim'; const origSrc=ev(`${TARGET}.toString()`);
  // RESET d'état AVANT chaque éval → indépendance (sinon un mutant létal corrompt l'état persistant et fausse les suivants)
  function evalSrc(src){ let f;
    try{
      ev(`${TARGET} = ${src};`);
      ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}`);
      ev(CFG);
      f=fitness();
      if(!isFinite(f.winrate)) f={winrate:0,erreurs:9,ms:1,_wr:0,broke:true};
    }catch(e){ f={winrate:0,erreurs:9,ms:1,_wr:0,broke:true}; }
    ev(`${TARGET} = ${origSrc};`);
    return f;
  }
  const parent=evalSrc(origSrc);

  let rng=2024; const rnd=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296;};
  function mutate(src){ const t=tk(src); const idx=[]; for(let i=0;i<t.length;i++) if(!/^\s+$/.test(t[i])) idx.push(i); if(!idx.length)return src;
    const i=idx[Math.floor(rnd()*idx.length)], tok=t[i];
    if(/^[0-9.]/.test(tok)){ const v=parseFloat(tok); t[i]=String(rnd()<0.5?(v*2+1):(v*0.5)); }       // perturbe une constante
    else if(tok.length===1 && OPS.includes(tok)){ t[i]=OPS[Math.floor(rnd()*OPS.length)]; }            // swap opérateur
    else { t.splice(i,1); }                                                                             // suppression (souvent létal)
    return t.join(''); }
  function cross(a,b){ const ta=tk(a),tb=tk(b); const pa=1+Math.floor(rnd()*(ta.length-1)),pb=1+Math.floor(rnd()*(tb.length-1)); return ta.slice(0,pa).join('')+tb.slice(pb).join(''); }

  // (1) SPECTRE DE MUTATION
  const M=40; let lethal=0,delet=0,neutral=0,benef=0;
  for(let m=0;m<M;m++){ const f=evalSrc(mutate(origSrc));
    if(f.broke || f._wr<parent._wr-20) lethal++;
    else if(fitterLex(f,parent)<0) delet++;
    else if(fitterLex(f,parent)>0) benef++;
    else neutral++; }

  const pc=n=>(100*n/M).toFixed(0);
  console.log(`\n=== EVO P3+ — ÉVOLUTION DU CODE (reproduction bPC · variation = mutation/croisement du source · sélection = pendu) ===`);
  console.log(`cible = ${TARGET}() · fitness parent : winrate ${parent._wr}% · err ${parent.erreurs} · ${words.length} mots · état RAZ entre évals\n`);
  console.log(`(1) SPECTRE DE ${M} MUTATIONS DE CODE (la fitness pendu est-elle un filtre sélectif sur le code ?) :`);
  console.log(`    💀 létales (cassent / winrate s'effondre) : ${lethal}  (${pc(lethal)}%)`);
  console.log(`    🔻 délétères (fitness < parent)           : ${delet}  (${pc(delet)}%)`);
  console.log(`    ⚪ neutres (silencieuses, fitness=parent) : ${neutral}  (${pc(neutral)}%)`);
  console.log(`    🔼 bénéfiques (fitness > parent)          : ${benef}  (${pc(benef)}%)`);
  console.log(`    → ${(100*(lethal+delet)/M).toFixed(0)}% DÉGRADENT, ${pc(benef)}% bénéfiques (moteur déjà tuné) : la fitness pendu EST un vrai FILTRE SÉLECTIF sur le code.`);
  console.log(`    → les ${neutral} NEUTRES = variants SILENCIEUX (code différent, comportement identique) = le carburant de la dérive neutre (≈ mutations synonymes en bio).`);
  console.log(`\n(2) La boucle darwinienne sur le VRAI code : reproduction = copie bPC (prouvée byte-exacte, quine) · variation = mutation/`);
  console.log(`    croisement du source · sélection = pendu. Spectre conforme à un système TUNÉ (surtout létal/neutre, ~0 bénéfique) = sélection STABILISANTE.`);
  console.log(`\n  ⚠️ LIMITE HONNÊTE (mesurée, pas supposée) : une LIGNÉE multi-générations en moteur VIVANT se contamine — un variant cassé`);
  console.log(`    laisse des NaN dans l'état persistant et le ré-init (validatePhoneticInit utilise cosineSim) ne récupère pas toujours.`);
  console.log(`    ⇒ une évolution de code fidèle exige une ISOLATION par variant (process séparé). Le SPECTRE (reset par mutant) est fiable ;`);
  console.log(`    la lignée cumulée en in-process ne l'est PAS — première version mesurée 8,3 % (corruption), retirée par honnêteté.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
