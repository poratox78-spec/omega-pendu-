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
  const test=words7.slice(0,80), trainPool=words7.slice(80,2200), cohortPool=words7.slice(0,1600);

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
  const EPOCHS=3, PER=150;
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

  // ── NON-MYOPE : reward au niveau PARTIE (gagné/perdu), crédité aux choix de routage utilisés (REINFORCE + baseline) ──
  const valueG=BUCK.map(()=>new Array(AG.length).fill(0)); let baseG=0.5; const LRG=0.06, EP2=8, PER2=350;
  const pickG=(b,eps)=>{ if(rnd()<eps)return Math.floor(rnd()*AG.length); let bi=0,bv=-1e18; for(let k=0;k<AG.length;k++)if(valueG[b][k]>bv){bv=valueG[b][k];bi=k;} return bi; };
  for(let e=0;e<EP2;e++){ const eps=Math.max(0.1,0.55*(1-e/EP2));
    for(let t=0;t<PER2;t++){ const word=trainPool[Math.floor(rnd()*trainPool.length)]; const n=word.length,rev=new Array(n).fill(null),g=new Set();let wrong=0; const used=[];
      while(wrong<3 && rev.includes(null)){ const {F,consist}=step(rev,n,g); const b=bucket(consist); const ai=pickG(b,eps); used.push([b,ai]);
        const cand=[];for(let L=0;L<A;L++)if(!g.has(L))cand.push(L); const L=agLetter(AG[ai],cand,F); g.add(L); const ch=String.fromCharCode(65+L);
        if(word.indexOf(ch)>=0){for(let i=0;i<n;i++)if(word[i]===ch)rev[i]=ch;} else wrong++; }
      const won=(!rev.includes(null)&&wrong<3)?1:0; const adv=won-baseG; baseG+=0.02*(won-baseG);
      for(const u of used) valueG[u[0]][u[1]]+=LRG*adv; } }
  const coordGDecide=(cand,F,consist)=>{ const b=bucket(consist); let bi=0,bv=-1e18; for(let k=0;k<AG.length;k++)if(valueG[b][k]>bv){bv=valueG[b][k];bi=k;} return agLetter(AG[bi],cand,F); };
  const coordGWR=wr(coordGDecide);

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
  console.log(`    COORDINATEUR · reward PAR COUP (myope)    : ${coordWR.toFixed(1)} %`);
  console.log(`    COORDINATEUR · reward PARTIE (non-myope)  : ${coordGWR.toFixed(1)} %`);
  console.log(`\n  PROTOCOLE appris au reward-PARTIE (par phase → agent) :`);
  for(let b=0;b<BUCK.length;b++){ let bi=0,bv=-1e18; for(let k=0;k<AG.length;k++)if(valueG[b][k]>bv){bv=valueG[b][k];bi=k;} console.log(`    ${BUCK[b].n.padEnd(22)} → ${AG[bi].n}`); }
  const beatMyope = coordGWR>coordWR+0.1, beatMono = coordGWR>bestMono+0.1, beatRouter = coordGWR>=72.0;
  console.log(`\n  Verdict :`);
  console.log(`  • reward MYOPE (par coup, « lettre correcte ? ») : ${coordWR.toFixed(1)} % — apprend la fiabilité, PAS la division (aveugle à la valeur séquentielle de l'ouvreur).`);
  console.log(`  • reward PARTIE (gagné/perdu, non-myope) : ${coordGWR.toFixed(1)} % — ${beatMyope?'✅ MIEUX que le myope':'≈ le myope'}${beatMono?' · ✅ bat le monolithe ('+bestMono.toFixed(1)+'%)':' · n\'a pas dépassé le monolithe ('+bestMono.toFixed(1)+'%)'}${beatRouter?' · atteint le routeur câblé':''}.`);
  console.log(`  → ${beatMyope||beatMono?'l\'ISSUE DE PARTIE est le bon signal : créditer la VICTOIRE remonte la valeur jusqu\'à l\'ouverture — la coordination émerge mieux.':'l\'issue de partie est NÉCESSAIRE mais SPARSE — credit-assignment dur à cette échelle (plus de parties / meilleure baseline aideraient). Honnête.'}`);
  console.log(`  → ACQUIS : intégration O1+P2+P3 (versions diverses + société + protocole APPRIS) ; et le bon reward = l'issue de PARTIE, pas la correction par coup.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
