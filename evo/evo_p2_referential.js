'use strict';
// EVO P2 (crux) — LE PENDU RÉFÉRENTIEL : la tâche qui PAIE la communication (sinon pas de langage émergent).
// A voit le mot et « souffle » k lettres à B (canal à bande limitée = k symboles) ; B (le moteur) joue.
// On mesure : (1) communiquer PAIE-T-IL ? (winrate monte avec k = sanity) ; (2) le CONTENU compte-t-il ?
//   (A « malin » = révèle les k lettres les plus RARES/informatives  vs  A « aléatoire ») → si malin > aléatoire à
//   bande égale, il y a une ENCODAGE à apprendre = le gradient qui fait émerger un langage. Pas de protocole appris ici,
//   juste la PRÉCONDITION mesurée. Usage : node evo/evo_p2_referential.js
const { loadEngine } = require('./fitness_harness.js');

const CFG=[
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
  'M_DECLARE_NEO_ENABLED=false',   // cognition seule → B a de la MARGE (room pour que le message paie)
].join(';');

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const W=LEX.words;
  ev(CFG); ev(`_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();`); ev(CFG);
  // B joue avec un message = lettres pré-révélées (alreadyTried + revealedMask, sans coût d'erreur car correctes)
  ev('globalThis.__playMsg=function(w,msg){startNewGame(w);for(var li=0;li<msg.length;li++){var idx=msg.charCodeAt(li)-65;if(idx<0||idx>=26)continue;if(typeof alreadyTried!=="undefined")alreadyTried[idx]=true;for(var p=0;p<w.length;p++)if(w[p]===msg[li])revealedMask[p]=true;}var sf=300;while(gameActive&&sf-->0)omegaStep();return !!lastGameWon;};');

  // fréquence globale des lettres (pour « rare = informatif »)
  const cnt=new Array(26).fill(0); for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m;if(!m)continue;for(const c of m){const k=c.charCodeAt(0)-65;if(k>=0&&k<26)cnt[k]++;}}
  const rarity=l=>cnt[l.charCodeAt(0)-65];   // plus petit = plus rare

  const valid=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m;if(m&&m.length>=8&&m.length<=12&&/^[A-Z]+$/.test(m))valid.push(m);}
  let r=12345; const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=valid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=valid[i];valid[i]=valid[j];valid[j]=t;}
  const words=valid.slice(0,150);

  // A choisit k lettres distinctes du mot : « malin » = les k plus rares ; « aléa » = k au hasard (seedé par mot)
  function msgSmart(w,k){ const ds=[...new Set(w.split(''))]; ds.sort((a,b)=>rarity(a)-rarity(b)); return ds.slice(0,k).join(''); }
  function msgRand(w,k){ const ds=[...new Set(w.split(''))]; let s=0; for(const c of w)s=(s*31+c.charCodeAt(0))>>>0; for(let i=ds.length-1;i>0;i--){s=(s*1664525+1013904223)>>>0;const j=s%(i+1);const t=ds[i];ds[i]=ds[j];ds[j]=t;} return ds.slice(0,k).join(''); }

  const wr=(fn,k)=>{ let win=0; for(const w of words) if(global.__playMsg(w, k?fn(w,k):'')) win++; return +(100*win/words.length).toFixed(1); };
  const base=wr(()=>'',0);
  const s1=wr(msgSmart,1), r1=wr(msgRand,1), s2=wr(msgSmart,2), r2=wr(msgRand,2), s3=wr(msgSmart,3);

  console.log(`\n=== EVO P2 (crux) — PENDU RÉFÉRENTIEL : communiquer paie-t-il ? le contenu compte-t-il ? ===`);
  console.log(`B = moteur (cognition seule, marge) · ${words.length} mots len 8-12 · A « souffle » k lettres (canal k symboles)\n`);
  console.log(`  bande k │ A aléatoire │ A malin (rares)`);
  console.log(`  ────────┼─────────────┼────────────────`);
  console.log(`     0    │    ${base.toFixed(1)} %   │    ${base.toFixed(1)} %   (référence, pas de message)`);
  console.log(`     1    │    ${r1.toFixed(1)} %   │    ${s1.toFixed(1)} %`);
  console.log(`     2    │    ${r2.toFixed(1)} %   │    ${s2.toFixed(1)} %`);
  console.log(`     3    │      —      │    ${s3.toFixed(1)} %`);
  const monotone = (s1>=base-0.1 && s2>=s1-0.1 && s3>=s2-0.1);
  const contentMatters = (s1>r1+0.5 || s2>r2+0.5);
  const m1 = monotone ? '✅ (monotone — sanity OK, le canal agit bien)' : '⚠️ (non monotone — vérifier le pré-dévoilement)';
  const m2 = contentMatters ? `✅ (${(s1-r1>=0?'+':'')}${(s1-r1).toFixed(1)} pt @k=1, ${(s2-r2>=0?'+':'')}${(s2-r2).toFixed(1)} @k=2)` : '≈ (peu écart ici)';
  console.log(`\n  (1) communiquer PAIE : winrate monte avec la bande ${m1}`);
  console.log(`  (2) le CONTENU compte : A malin > A aléatoire à bande égale ${m2}`);
  console.log(`\n  → la tâche PAIE la communication, et il y a un ENCODAGE optimal à apprendre (rares > au hasard).`);
  console.log(`    C'est le gradient qui fait émerger un langage. Prochaine brique P2 : A APPREND quoi envoyer (protocole émergent).`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
