'use strict';
// EVO O1 — ROBUSTESSE : le gain de DIVISION DU TRAVAIL (équipe ouvreur+finisseur via routeur) survit-il à de plus gros
// échantillons et à plusieurs seeds, ou est-ce du bruit ? On fixe la stratégie (K=80, choisie avant) et on la teste
// HORS échantillon de réglage, sur 300 mots × N seeds. ⚠️ Rappel d'honnêteté : O1 est un PROXY (heuristiques score-lettre,
// PAS le vrai omegaStep) — ceci mesure si l'EFFET de coordination tient, pas s'il tient sur le vrai moteur. node evo/evo_o1_robust.js
const { loadEngine } = require('./fitness_harness.js');

(async()=>{
  const O=loadEngine(); await O.loadLex(); const W=O.evalIn('OMEGA_LEX4').words; const A=26;
  const all=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&m.length===7&&/^[A-Z]+$/.test(m))all.push(m);}

  function buildStats(pool){ const gc=new Array(A).fill(0), pf=Array.from({length:7},()=>new Array(A).fill(0));
    for(const m of pool) for(let p=0;p<7;p++){const k=m.charCodeAt(p)-65;if(k>=0&&k<A){gc[k]++;pf[p][k]++;}}
    const gcMax=Math.max(...gc)||1, pfMax=pf.map(r=>Math.max(...r)||1); return {gc,pf,gcMax,pfMax}; }
  function step(rev,n,g,pool,S){ const revSet=new Set(); for(let i=0;i<n;i++)if(rev[i]!=null)revSet.add(rev[i]);
    const wrongL=[]; for(const L of g){const ch=String.fromCharCode(65+L); if(!revSet.has(ch))wrongL.push(ch);}
    const cc=new Array(A).fill(0); let consist=0;
    for(const w of pool){ let ok=true; for(let i=0;i<n;i++){if(rev[i]!=null&&w[i]!==rev[i]){ok=false;break;}}
      if(ok)for(const wc of wrongL){if(w.indexOf(wc)>=0){ok=false;break;}}
      if(ok){consist++; const seen=new Set(); for(let i=0;i<n;i++){if(rev[i]==null){const k=w.charCodeAt(i)-65;if(k>=0&&k<A&&!seen.has(k)){seen.add(k);cc[k]++;}}}} }
    const cz=consist||1; const F=new Array(A);
    for(let L=0;L<A;L++){let p=0,cn=0;for(let i=0;i<n;i++){if(rev[i]!=null)continue;cn++;p+=S.pf[i][L]/S.pfMax[i];}F[L]={f:S.gc[L]/S.gcMax,p:cn?p/cn:0,c:cc[L]/cz};}
    return {F,consist}; }
  function play(word,decide,pool,S){ const n=word.length,rev=new Array(n).fill(null),g=new Set();let wrong=0;
    while(wrong<3 && rev.includes(null)){ const {F,consist}=step(rev,n,g,pool,S); const cand=[];for(let L=0;L<A;L++)if(!g.has(L))cand.push(L);
      const L=decide(cand,F,consist); g.add(L); const ch=String.fromCharCode(65+L); if(word.indexOf(ch)>=0){for(let i=0;i<n;i++)if(word[i]===ch)rev[i]=ch;}else wrong++; }
    return !rev.includes(null)&&wrong<3; }
  const argmax=score=>(cand,F)=>{let bL=cand[0],bS=-1e18;for(const L of cand){const s=score(F[L]);if(s>bS){bS=s;bL=L;}}return bL;};
  const sOuv=ft=>ft.p+0.5*ft.f, sFin=ft=>ft.c, sCohPos=ft=>ft.c+0.4*ft.p;
  const team=K=>(cand,F,consist)=>{const sc=consist>K?sOuv:sFin;let bL=cand[0],bS=-1e18;for(const L of cand){const s=sc(F[L]);if(s>bS){bS=s;bL=L;}}return bL;};

  const seeds=[11,23,37,53,71,97]; const TEST=300, POOL=2000, K=80; const rows=[];
  for(const sd of seeds){ let r=sd>>>0; const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
    const arr=all.slice(); for(let i=arr.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=arr[i];arr[i]=arr[j];arr[j]=t;}
    const test=arr.slice(0,TEST), pool=arr.slice(0,POOL), S=buildStats(pool);
    const wr=dec=>{let w=0;for(const word of test)if(play(word,dec,pool,S))w++;return 100*w/test.length;};
    const mCoh=wr(argmax(sFin)), mCP=wr(argmax(sCohPos)), bestMono=Math.max(mCoh,mCP), tEq=wr(team(K));
    rows.push({sd,bestMono:+bestMono.toFixed(1),team:+tEq.toFixed(1),delta:+(tEq-bestMono).toFixed(1)});
  }
  const deltas=rows.map(r=>r.delta), mean=deltas.reduce((a,b)=>a+b,0)/deltas.length;
  const sd=Math.sqrt(deltas.reduce((a,b)=>a+(b-mean)*(b-mean),0)/deltas.length);
  const wins=rows.filter(r=>r.delta>0.05).length, ties=rows.filter(r=>Math.abs(r.delta)<=0.05).length;

  console.log(`\n=== EVO O1 — ROBUSTESSE de la DIVISION DU TRAVAIL (équipe vs meilleur monolithe) ===`);
  console.log(`stratégie FIXE (routeur K=${K}, choisi avant) testée sur ${TEST} mots × ${seeds.length} seeds · ⚠️ PROXY (pas omegaStep)\n`);
  console.log(`  seed │ meilleur monolithe │ équipe │ Δ`);
  for(const r of rows) console.log(`  ${String(r.sd).padStart(4)} │      ${r.bestMono.toFixed(1)} %       │ ${r.team.toFixed(1)} % │ ${r.delta>=0?'+':''}${r.delta.toFixed(1)}`);
  console.log(`\n  Δ moyen = ${mean>=0?'+':''}${mean.toFixed(2)} pt  (écart-type ${sd.toFixed(2)})  ·  équipe gagne ${wins}/${seeds.length} seeds, nul ${ties}/${seeds.length}`);
  const verdict = mean>2*sd && wins>=seeds.length-1 ? '✅ EFFET ROBUSTE (mais petit, et en PROXY)' : (mean>0 ? '≈ EFFET FAIBLE / dans le bruit (Δ ≲ écart-type)' : '❌ pas d\'effet');
  console.log(`  → ${verdict} : la division du travail ${mean>0?'aide':'n\'aide pas'} en moyenne de ${mean.toFixed(1)} pt (≈ ${Math.round(mean/100*TEST)} mots/${TEST}).`);
  console.log(`  → honnêteté : ceci reste un PROXY (heuristiques, pas le vrai moteur). Mesure l'effet de coordination, pas sa réalité sur OMEGA.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
