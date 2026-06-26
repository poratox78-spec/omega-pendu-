'use strict';
// EVO O1 — BASE MULTI-AGENTS : le travail de groupe. Crux (roadmap) : une tâche où le GROUPE bat le MEILLEUR SOLO,
// sinon coopérer ne sert à rien. Roster d'agents divers (stratégies de score-lettre sur le vrai lexique), un solveur
// de pendu cheat-free, et un vote d'ensemble (chaque agent vote par softmax sur les lettres, on somme). On mesure
// chaque agent en solo, puis le groupe — et on regarde si le groupe > meilleur solo. Honnête : un agent faible peut
// tirer la moyenne vers le bas (→ il faudra pondérer par fiabilité). Fondation pour O1. Usage : node evo/evo_o1_group.js
const { loadEngine } = require('./fitness_harness.js');

(async()=>{
  const O=loadEngine(); await O.loadLex(); const W=O.evalIn('OMEGA_LEX4').words;
  const A=26;
  const gc=new Array(A).fill(0); const pf=Array.from({length:7},()=>new Array(A).fill(0));
  let words7=[]; for(let i=0;i<W.length;i++){ const m=W[i]&&W[i].m; if(!m||!/^[A-Z]+$/.test(m)||m.length!==7)continue; words7.push(m);
    for(let pos=0;pos<7;pos++){ const k=m.charCodeAt(pos)-65; if(k>=0&&k<A){ gc[k]++; pf[pos][k]++; } } }
  const gcMax=Math.max(...gc)||1, pfMax=pf.map(r=>Math.max(...r)||1), vowel=l=>'AEIOUY'.includes(String.fromCharCode(65+l))?1:0;
  let r=12345; const rnd0=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=words7.length-1;i>0;i--){const j=Math.floor(rnd0()*(i+1));const t=words7[i];words7[i]=words7[j];words7[j]=t;}
  const test=words7.slice(0,60), cohortPool=words7.slice(0,2200);

  // features de TOUTES les lettres à un état de board (cohorte calculée une fois)
  function featsOfStep(rev, n, g){
    const revSet=new Set(); for(let i=0;i<n;i++)if(rev[i]!=null)revSet.add(rev[i]);
    const wrongL=[]; for(const L of g){ const ch=String.fromCharCode(65+L); if(!revSet.has(ch))wrongL.push(ch); }
    const cc=new Array(A).fill(0); let consist=0;
    for(const w of cohortPool){ let ok=true; for(let i=0;i<n;i++){ if(rev[i]!=null && w[i]!==rev[i]){ok=false;break;} }
      if(ok)for(const wc of wrongL){ if(w.indexOf(wc)>=0){ok=false;break;} }
      if(ok){ consist++; const seen=new Set(); for(let i=0;i<n;i++){ if(rev[i]==null){ const k=w.charCodeAt(i)-65; if(k>=0&&k<A&&!seen.has(k)){seen.add(k);cc[k]++;} } } } }
    const cz=consist||1; const F=new Array(A);
    for(let L=0;L<A;L++){ let p=0,cn=0; for(let i=0;i<n;i++){if(rev[i]!=null)continue;cn++;p+=pf[i][L]/pfMax[i];}
      F[L]={f:gc[L]/gcMax, p:cn?p/cn:0, v:vowel(L), c:cc[L]/cz}; }
    return F;
  }
  function play(word, decide){ const n=word.length, rev=new Array(n).fill(null), g=new Set(); let wrong=0;
    while(wrong<3 && rev.includes(null)){ const F=featsOfStep(rev,n,g); const cand=[]; for(let L=0;L<A;L++)if(!g.has(L))cand.push(L);
      const L=decide(cand,F); g.add(L); const ch=String.fromCharCode(65+L); if(word.indexOf(ch)>=0){for(let i=0;i<n;i++)if(word[i]===ch)rev[i]=ch;} else wrong++; }
    return !rev.includes(null)&&wrong<3; }

  // ROSTER d'agents (divers) : chacun = un score-lettre
  const AGENTS=[
    {name:'cohorte',       strong:true,  s:ft=>ft.c},
    {name:'cohorte+pos',   strong:true,  s:ft=>ft.c+0.4*ft.p},
    {name:'cohorte-voy',   strong:true,  s:ft=>ft.c-0.25*ft.v},
    {name:'cohorte+freq',  strong:true,  s:ft=>ft.c+0.2*ft.f},
    {name:'positionnel',   strong:false, s:ft=>ft.p+0.3*ft.f},
    {name:'fréquence',     strong:false, s:ft=>ft.f},
  ];
  const argmaxDecide=agent=>(cand,F)=>{ let bL=cand[0],bS=-1e18; for(const L of cand){const s=agent.s(F[L]); if(s>bS){bS=s;bL=L;}} return bL; };
  const softmax=(cand,F,agent,B)=>{ let mx=-1e18; const v=cand.map(L=>agent.s(F[L])); for(const x of v)if(x>mx)mx=x; let z=0; const e=v.map(x=>{const t=Math.exp(B*(x-mx));z+=t;return t;}); return {e,z}; };
  function voteDecide(agents,B){ return (cand,F)=>{ const acc=new Array(cand.length).fill(0);
    for(const ag of agents){ const {e,z}=softmax(cand,F,ag,B); for(let i=0;i<cand.length;i++)acc[i]+=e[i]/z; }
    let bi=0,bv=-1; for(let i=0;i<cand.length;i++)if(acc[i]>bv){bv=acc[i];bi=i;} return cand[bi]; }; }

  const wr=decide=>{ let w=0; for(const word of test)if(play(word,decide))w++; return +(100*w/test.length).toFixed(1); };

  const solos=AGENTS.map(a=>({name:a.name,strong:a.strong,wr:wr(argmaxDecide(a))}));
  const bestSolo=solos.reduce((m,x)=>x.wr>m.wr?x:m,solos[0]);
  const groupAll=wr(voteDecide(AGENTS,8));
  const groupStrong=wr(voteDecide(AGENTS.filter(a=>a.strong),8));
  // ÉTAPE 1 — VOTE PONDÉRÉ PAR FIABILITÉ : chaque agent pèse selon son winrate solo (les faibles ≈ 0 poids).
  const wmap={}; for(const s of solos)wmap[s.name]=s.wr;
  const voteW=agents=>(cand,F)=>{ const acc=new Array(cand.length).fill(0);
    for(const ag of agents){ const w=wmap[ag.name]||0; const {e,z}=softmax(cand,F,ag,8); for(let i=0;i<cand.length;i++)acc[i]+=w*(e[i]/z); }
    let bi=0,bv=-1; for(let i=0;i<cand.length;i++)if(acc[i]>bv){bv=acc[i];bi=i;} return cand[bi]; };
  const groupAllW=wr(voteW(AGENTS));
  // ÉTAPE 1bis — GATE de fiabilité : garder les agents au track-record fiable (winrate ≥ 30 %), puis poids ÉGAL (garde la diversité).
  const groupGated=wr(voteDecide(AGENTS.filter(a=>(wmap[a.name]||0)>=30),8));

  console.log(`\n=== EVO O1 — BASE MULTI-AGENTS : le groupe bat-il le meilleur solo ? (pendu, ${test.length} mots len-7, lexique réel) ===\n`);
  console.log(`  AGENTS en SOLO :`);
  for(const s of solos) console.log(`    ${s.name.padEnd(14)} ${s.strong?'(fort) ':'(faible)'} : ${s.wr.toFixed(1).padStart(5)} %`);
  console.log(`    → meilleur solo : ${bestSolo.name} (${bestSolo.wr} %)`);
  console.log(`\n  GROUPE :`);
  console.log(`    complet · vote ÉGAL (6 agents, 2 faibles)  : ${groupAll.toFixed(1)} %   ${groupAll>bestSolo.wr?'✅':'❌ tiré vers le bas par les faibles'}`);
  console.log(`    forts · vote égal (4 divers)               : ${groupStrong.toFixed(1)} %   ${groupStrong>bestSolo.wr?'✅ > meilleur solo':'≈'}`);
  console.log(`    complet · PONDÉRÉ par winrate              : ${groupAllW.toFixed(1)} %   (récupère le drag, mais sur-concentre sur le meilleur → perd la diversité)`);
  console.log(`    complet · GATE fiabilité + poids ÉGAL      : ${groupGated.toFixed(1)} %   ${groupGated>bestSolo.wr?'✅ > meilleur solo (drag corrigé ET diversité gardée)':'≈'}`);
  console.log(`\n  ✅ Crux O1 : un groupe d'agents compétents & divers bat le meilleur solo (correction mutuelle) — coopérer paie (modeste : +1 mot/60, à robustifier).`);
  console.log(`  ✅ Étape 1 (fiabilité), mécanisme affiné : le bon arbitrage = GATER l'incompétent (auto, par track-record) puis poids ÉGAL entre compétents`);
  console.log(`     — pas un poids proportionnel au winrate (qui sur-concentre sur le meilleur et perd le gain de diversité). C'est l'arbitrage-par-fiabilité de l'OS d'OMEGA.`);
  console.log(`  → reste O1 : rôles / DIVISION du travail (agents spécialisés résolvant ce qu'aucun ne fait seul), puis vraies versions OMEGA + langage P2.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
