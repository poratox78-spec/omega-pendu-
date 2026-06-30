'use strict';
// SONDE (NÉGATIF) — le modèle de forme-de-mot du pendu peut-il aider le correcteur à distinguer vrai-mot vs typo ?
// Vrai moteur (config optimale cheat-free + gap-aware + NEO), score CONTINU = nb de mauvaises lettres au pendu,
// ROC valide-OOV minuscule vs typo (noms propres exclus de fait : mots communs du lexique), lexique amputé.
// Résultat 2026-06-30 : AUC 0,627 = trop faible pour câbler. Voir evo/WORDSHAPE_CORRECTOR_PROBE.md.
//   node evo/wordshape_corrector_probe.js     (nécessite data_local/ud_fr_gsd-train.conllu)
const fs = require('fs'), path = require('path');
const { loadEngine } = require('./fitness_harness.js');
const UD = path.join(__dirname, '..', 'data_local', 'ud_fr_gsd-train.conllu');

function snap(O){ const t=O.tried,w=O.word; if(!t||!w)return null; let e=0;
  for(let i=0;i<26;i++){ if(t[i]&&!w.includes(String.fromCharCode(65+i)))e++; } return e; }
function playErr(O,w){ O.startNewGame(w); let sf=300,last=0,s; while(O.active&&sf-->0){ O.omegaStep(); s=snap(O); if(s!=null)last=s; } return last; }

(async()=>{
  if(!fs.existsSync(UD)){ console.log('SKIP — data_local/ud_fr_gsd-train.conllu absent (sonde dev, comme speller_probe/Lexique4).'); return; }
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn;
  ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`);
  const W=ev('OMEGA_LEX4.words'); const idx={},cand=[];
  for(let i=0;i<W.length;i++){ const m=W[i]&&W[i].m; if(m&&/^[A-Z]+$/.test(m)&&m.length>=7&&m.length<=12){ idx[m]=i; cand.push(m); } }
  let r=98765>>>0; const rnd=()=>{ r=(r*1664525+1013904223)>>>0; return r/4294967296; };
  for(let i=cand.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const t=cand[i]; cand[i]=cand[j]; cand[j]=t; }
  const N=120, AZ='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const valid=cand.slice(0,N), typoSrc=cand.slice(N,4*N);
  function mk(w){ const a=w.split(''); const op=Math.floor(rnd()*4),i=Math.floor(rnd()*a.length);
    if(op===0)a[i]=AZ[Math.floor(rnd()*26)]; else if(op===1&&a.length>3)a.splice(i,1);
    else if(op===2)a.splice(i,0,AZ[Math.floor(rnd()*26)]); else if(i<a.length-1){ const t=a[i];a[i]=a[i+1];a[i+1]=t; } return a.join(''); }
  const typos=[]; for(const w of typoSrc){ const t=mk(w); if(!idx[t]&&t.length>=7&&t.length<=12&&/^[A-Z]+$/.test(t))typos.push(t); if(typos.length>=N)break; }
  const rm=new Set([...valid.map(w=>idx[w]),...typoSrc.map(w=>idx[w])]);
  ev(`globalThis.__rm=${JSON.stringify([...rm])};(function(){const s=new Set(__rm),LI=OMEGA_LEX4.len_index;const f={};for(const k in LI)f[k]=LI[k].filter(id=>!s.has(id));OMEGA_LEX4.__filt=f;})();`);
  ev(`(function(seed){_omegaSeed=seed;_omegaRng=makeMulberry32(seed);initOmegaGlobals();if(typeof _omega_OSL_reset==='function')_omega_OSL_reset();if(typeof M_OS_v07!=='undefined'&&M_OS_v07){M_OS_v07.alpha=1;M_OS_v07.beta=1;}
    L01_A4_M4M_DECOMP_ENABLED=true;L01_A5_M2M_POSITIONAL_ENABLED=true;L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true;L01_B2_MOBIUS_ENABLED=true;M_OS_V07_ENABLED=true;M_SUBSTRAT_ORTHO_PURE_ENABLED=true;M_BPC_M3D_ENABLED=true;M_BPC_READOUT_COUPLE_ENABLED=true;M_OS_LEARNING_ONLINE_ENABLED=true;M_OS_LEARNING_GUARD_1_BOUNDED=true;M_OS_LEARNING_GUARD_2_ANALYTIC_AUDIT=true;M_OS_LEARNING_GUARD_3_MDL_REGUL=true;M_OS_LEARNING_GUARD_4_COHERENCE=true;
    M_VOIE_PHON_ENABLED=false;M4_PHON_USE_P_ENABLED=false;M_PHON_FEEDBACK_ENABLED=false;M_PHON_READOUT_COUPLE_ENABLED=false;M_PHON_CONCEPT_BIND_ENABLED=false;
    M_DECLARE_NEO_ENABLED=true;M_NEO_RECALL_ENABLED=true;M_NEO_ASSEMBLED_ENABLED=true;M_NEO_COHORT_ENABLED=true;M_NEO_PHON_COHORT_ENABLED=false;M_NEO_MUTE_ENABLED=false;M_NEO_TRIGGER_ENABLED=false;M_EMERGENT_DECLARE_ENABLED=true;
    M_NEO_LETTER_NGRAM=false;M_NEO_OS_ARB=true;M_NEO_OS_ARB_NGRAM=true;M_NEO_NGRAM_GAP=true;if(typeof M_DECLARE_NEO_CONF!=='undefined')M_DECLARE_NEO_CONF=0.6;})(12345); OMEGA_LEX4.len_index=OMEGA_LEX4.__filt;`);
  const ev_v=valid.map(w=>playErr(O,w)), ev_t=typos.map(w=>playErr(O,w));
  const med=a=>{ const b=a.slice().sort((x,y)=>x-y); return b[b.length>>1]; };
  let c=0,tot=ev_v.length*ev_t.length; for(const p of ev_t)for(const n of ev_v){ if(p>n)c++; else if(p===n)c+=0.5; }
  console.log('=== ROC : err(mauvaises lettres) — valide-OOV vs typo (vrai moteur, config optimale, lexique amputé) ===');
  console.log('  valide-OOV  n='+ev_v.length+'  err médian='+med(ev_v)+'  moy='+(ev_v.reduce((a,b)=>a+b,0)/ev_v.length).toFixed(2));
  console.log('  typo        n='+ev_t.length+'  err médian='+med(ev_t)+'  moy='+(ev_t.reduce((a,b)=>a+b,0)/ev_t.length).toFixed(2));
  console.log('  AUC (P[err_typo > err_valide]) = '+(c/tot).toFixed(3)+'   (0,5=nul · 1,0=parfait) → 0,63 = trop faible, NÉGATIF');
})().catch(e=>{ console.error('ERR',e.message); process.exit(1); });
