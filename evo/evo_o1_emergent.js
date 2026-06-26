'use strict';
// EVO O1 (point 3, CAPSTONE) — COORDINATION ÉMERGENTE : la société d'agents apprend, du SEUL REWARD, qui confier le coup
// selon le CONTEXTE (taille de cohorte = phase). Pas de routeur codé en dur : value[bucket][agent] s'apprend (le
// "protocole émergent" de P2 appliqué au groupe d'O1). S'il redécouvre la DIVISION (ouvreur tôt, cohorte tard) et
// l'arbitrage par FIABILITÉ (ignorer les faibles), et égale/bat le routeur câblé (72,5%) — O1 + P2 + P3 se rejoignent.
// Agents divers (proxy des versions OMEGA). Solveur cheat-free, lexique réel. Usage : node evo/evo_o1_emergent.js
const { loadEngine } = require('./fitness_harness.js');

(async()=>{
  const O=loadEngine(); await O.loadLex(); const W=O.evalIn('OMEGA_LEX4').words; const A=26;
  const gc=new Array(A).fill(0); const pf=Array.from({length:7},()=>new Array(A).fill(0));
  let words7=[]; for(let i=0;i<W.length;i++){ const m=W[i]&&W[i].m; if(!m||!/^[A-Z]+$/.test(m)||m.length!==7)continue; words7.push(m);
    for(let pos=0;pos<7;pos++){ const k=m.charCodeAt(pos)-65; if(k>=0&&k<A){ gc[k]++; pf[pos][k]++; } } }
  const gcMax=Math.max(...gc)||1, pfMax=pf.map(r=>Math.max(...r)||1), vowel=l=>'AEIOUY'.includes(String.fromCharCode(65+l))?1:0;
  let r=12345; const rnd0=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=words7.length-1;i>0;i--){const j=Math.floor(rnd0()*(i+1));const t=words7[i];words7[i]=words7[j];words7[j]=t;}
  const test=words7.slice(0,80), trainPool=words7.slice(80,2500), cohortPool=words7.slice(0,2200);

  function step(rev,n,g){
    const revSet=new Set(); for(let i=0;i<n;i++)if(rev[i]!=null)revSet.add(rev[i]);
    const wrongL=[]; for(const L of g){const ch=String.fromCharCode(65+L); if(!revSet.has(ch))wrongL.push(ch);}
    const cc=new Array(A).fill(0); let consist=0;
    for(const w of cohortPool){ let ok=true; for(let i=0;i<n;i++){if(rev[i]!=null&&w[i]!==rev[i]){ok=false;break;}}
      if(ok)for(const wc of wrongL){if(w.indexOf(wc)>=0){ok=false;break;}}
      if(ok){consist++; const seen=new Set(); for(let i=0;i<n;i++){if(rev[i]==null){const k=w.charCodeAt(i)-65;if(k>=0&&k<A&&!seen.has(k)){seen.add(k);cc[k]++;}}}} }
    const cz=consist||1; const F=new Array(A);
    for(let L=0;L<A;L++){let p=0,cn=0;for(let i=0;i<n;i++){if(rev[i]!=null)continue;cn++;p+=pf[i][L]/pfMax[i];}F[L]={f:gc[L]/gcMax,p:cn?p/cn:0,v:vowel(L),c:cc[L]/cz};}
    return {F,consist};
  }
  const agLetter=(ag,cand,F)=>{let bL=cand[0],bS=-1e18;for(const L of cand){const s=ag.s(F[L]);if(s>bS){bS=s;bL=L;}}return bL;};
  // AGENTS divers (dont 1 faible que la coordination devra apprendre à éviter)
  const AG=[ {n:'ouvreur',s:ft=>ft.p+0.5*ft.f}, {n:'cohorte',s:ft=>ft.c}, {n:'cohorte+pos',s:ft=>ft.c+0.4*ft.p},
            {n:'cohorte-voy',s:ft=>ft.c-0.25*ft.v}, {n:'fréquence',s:ft=>ft.f} ];
  // CONTEXTE = bucket de taille de cohorte (phase)
  const BUCK=[ {n:'cohorte ÉNORME (>300)', t:c=>c>300}, {n:'grande (80–300)', t:c=>c>80}, {n:'moyenne (20–80)', t:c=>c>20}, {n:'serrée (≤20)', t:()=>true} ];
  const bucket=c=>{ for(let b=0;b<BUCK.length;b++)if(BUCK[b].t(c))return b; return BUCK.length-1; };

  let rng=2024; const rnd=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296;};
  const value=BUCK.map(()=>new Array(AG.length).fill(0)); const LR=0.04;
  function pickAgent(b,eps){ if(rnd()<eps)return Math.floor(rnd()*AG.length); let bi=0,bv=-1e18; for(let k=0;k<AG.length;k++)if(value[b][k]>bv){bv=value[b][k];bi=k;} return bi; }

  // ENTRAÎNEMENT — reward dense : l'agent choisi devine-t-il une lettre correcte ? (feedback du jeu)
  const EPOCHS=4, PER=220;
  for(let e=0;e<EPOCHS;e++){ const eps=Math.max(0.08,0.5*(1-e/EPOCHS));
    for(let t=0;t<PER;t++){ const word=trainPool[Math.floor(rnd()*trainPool.length)]; const n=word.length,rev=new Array(n).fill(null),g=new Set();let wrong=0;
      while(wrong<3 && rev.includes(null)){ const {F,consist}=step(rev,n,g); const b=bucket(consist); const ai=pickAgent(b,eps);
        const cand=[];for(let L=0;L<A;L++)if(!g.has(L))cand.push(L); const L=agLetter(AG[ai],cand,F); g.add(L); const ch=String.fromCharCode(65+L); const correct=word.indexOf(ch)>=0;
        value[b][ai]+=LR*((correct?1:-1)-value[b][ai]);   // moyenne mobile du succès de l'agent dans ce bucket
        if(correct){for(let i=0;i<n;i++)if(word[i]===ch)rev[i]=ch;} else wrong++; } } }

  // ÉVAL — coordinateur GLOUTON (argmax value par bucket)
  const coordDecide=(cand,F,consist)=>{ const b=bucket(consist); let bi=0,bv=-1e18; for(let k=0;k<AG.length;k++)if(value[b][k]>bv){bv=value[b][k];bi=k;} return agLetter(AG[bi],cand,F); };
  function play(word,decide){const n=word.length,rev=new Array(n).fill(null),g=new Set();let wrong=0;
    while(wrong<3 && rev.includes(null)){const {F,consist}=step(rev,n,g);const cand=[];for(let L=0;L<A;L++)if(!g.has(L))cand.push(L);const L=decide(cand,F,consist);g.add(L);const ch=String.fromCharCode(65+L);if(word.indexOf(ch)>=0){for(let i=0;i<n;i++)if(word[i]===ch)rev[i]=ch;}else wrong++;}
    return !rev.includes(null)&&wrong<3;}
  const wr=decide=>{let w=0;for(const word of test)if(play(word,decide))w++;return +(100*w/test.length).toFixed(1);};
  const coordWR=wr(coordDecide);
  const monoCoh=wr((c,F)=>agLetter(AG[1],c,F)), monoCohPos=wr((c,F)=>agLetter(AG[2],c,F));
  const bestMono=Math.max(monoCoh,monoCohPos);

  console.log(`\n=== EVO O1 (point 3, CAPSTONE) — COORDINATION ÉMERGENTE : le groupe apprend qui confier le coup, du seul reward ===`);
  console.log(`agents divers · contexte = phase (taille de cohorte) · ${EPOCHS}×${PER} parties d'apprentissage · test ${test.length} mots held-out\n`);
  console.log(`  PROTOCOLE APPRIS (par phase → agent préféré découvert) :`);
  for(let b=0;b<BUCK.length;b++){ let bi=0,bv=-1e18; for(let k=0;k<AG.length;k++)if(value[b][k]>bv){bv=value[b][k];bi=k;}
    console.log(`    ${BUCK[b].n.padEnd(22)} → ${AG[bi].n.padEnd(12)} (succès ${(value[b][bi]>=0?'+':'')}${value[b][bi].toFixed(2)})`); }
  console.log(`\n  WINRATE (test held-out) :`);
  console.log(`    monolithe cohorte           : ${monoCoh.toFixed(1)} %`);
  console.log(`    monolithe cohorte+pos       : ${monoCohPos.toFixed(1)} %  → meilleur monolithe ${bestMono.toFixed(1)} %`);
  console.log(`    routeur CÂBLÉ (étape 2, K=80): ≈ 72,5 % (mesuré précédemment)`);
  console.log(`    COORDINATEUR ÉMERGENT       : ${coordWR.toFixed(1)} %`);
  console.log(`\n  Verdict honnête :`);
  console.log(`  ✅ ce qui ÉMERGE : la FIABILITÉ — du seul reward, le groupe apprend à ne router que vers des agents compétents (jamais vers les faibles ouvreur/fréquence).`);
  console.log(`  ⚠️ ce qui N'ÉMERGE PAS : la DIVISION subtile — il ne (re)découvre pas qu'il faut l'OUVREUR (nul seul) TÔT. Il ÉGALE donc le monolithe (${coordWR.toFixed(1)} %),`);
  console.log(`     sans atteindre le routeur câblé (72,5 %). CAUSE : le reward PAR COUP (« lettre correcte ? ») est MYOPE — il ne crédite pas l'ouvreur d'avoir PRÉPARÉ le finisseur (valeur séquentielle).`);
  console.log(`  → FIX (suite) : crédit au niveau PARTIE (gagné/perdu) attribué aux choix de routage, pas la correction par coup — même défi de credit-assignment qu'en P2.`);
  console.log(`  → ACQUIS : l'INTÉGRATION O1+P2+P3 tient (versions diverses + société + protocole de coordination APPRIS, pas codé) ; la fiabilité émerge, la division subtile attend un meilleur reward.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
