'use strict';
// EVO O1 (point 2) — RÔLES / DIVISION DU TRAVAIL. Des agents se SPÉCIALISENT par phase de jeu, un ROUTEUR confie
// chaque coup au bon spécialiste. Si l'équipe (spécialistes + routeur) bat le meilleur MONOLITHE (une stratégie unique
// partout), la division paie. Phase = taille de la cohorte compatible : grande (tôt, board masqué) → l'OUVREUR
// (positionnel/fréquence) ; petite (tard, board contraint) → le FINISSEUR (cohorte). Solveur cheat-free, lexique réel.
// Honnête : la cohorte d'OMEGA est déjà adaptative — possible qu'elle soit dure à battre. On mesure. Usage : node evo/evo_o1_roles.js
const { loadEngine } = require('./fitness_harness.js');

(async()=>{
  const O=loadEngine(); await O.loadLex(); const W=O.evalIn('OMEGA_LEX4').words; const A=26;
  const gc=new Array(A).fill(0); const pf=Array.from({length:7},()=>new Array(A).fill(0));
  let words7=[]; for(let i=0;i<W.length;i++){ const m=W[i]&&W[i].m; if(!m||!/^[A-Z]+$/.test(m)||m.length!==7)continue; words7.push(m);
    for(let pos=0;pos<7;pos++){ const k=m.charCodeAt(pos)-65; if(k>=0&&k<A){ gc[k]++; pf[pos][k]++; } } }
  const gcMax=Math.max(...gc)||1, pfMax=pf.map(r=>Math.max(...r)||1), vowel=l=>'AEIOUY'.includes(String.fromCharCode(65+l))?1:0;
  let r=12345; const rnd0=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=words7.length-1;i>0;i--){const j=Math.floor(rnd0()*(i+1));const t=words7[i];words7[i]=words7[j];words7[j]=t;}
  const test=words7.slice(0,80), cohortPool=words7.slice(0,2200);

  function step(rev,n,g){
    const revSet=new Set(); for(let i=0;i<n;i++)if(rev[i]!=null)revSet.add(rev[i]);
    const wrongL=[]; for(const L of g){const ch=String.fromCharCode(65+L); if(!revSet.has(ch))wrongL.push(ch);}
    const cc=new Array(A).fill(0); let consist=0;
    for(const w of cohortPool){ let ok=true; for(let i=0;i<n;i++){if(rev[i]!=null&&w[i]!==rev[i]){ok=false;break;}}
      if(ok)for(const wc of wrongL){if(w.indexOf(wc)>=0){ok=false;break;}}
      if(ok){consist++; const seen=new Set(); for(let i=0;i<n;i++){if(rev[i]==null){const k=w.charCodeAt(i)-65; if(k>=0&&k<A&&!seen.has(k)){seen.add(k);cc[k]++;}}}} }
    const cz=consist||1; const F=new Array(A);
    for(let L=0;L<A;L++){ let p=0,cn=0; for(let i=0;i<n;i++){if(rev[i]!=null)continue;cn++;p+=pf[i][L]/pfMax[i];}
      F[L]={f:gc[L]/gcMax,p:cn?p/cn:0,v:vowel(L),c:cc[L]/cz}; }
    return {F,consist};
  }
  function play(word, decide){ const n=word.length, rev=new Array(n).fill(null), g=new Set(); let wrong=0;
    while(wrong<3 && rev.includes(null)){ const {F,consist}=step(rev,n,g); const cand=[]; for(let L=0;L<A;L++)if(!g.has(L))cand.push(L);
      const L=decide(cand,F,consist); g.add(L); const ch=String.fromCharCode(65+L); if(word.indexOf(ch)>=0){for(let i=0;i<n;i++)if(word[i]===ch)rev[i]=ch;} else wrong++; }
    return !rev.includes(null)&&wrong<3; }
  const argmax=score=>(cand,F)=>{let bL=cand[0],bS=-1e18;for(const L of cand){const s=score(F[L]);if(s>bS){bS=s;bL=L;}}return bL;};
  const wr=decide=>{let w=0;for(const word of test)if(play(word,decide))w++;return +(100*w/test.length).toFixed(1);};

  // spécialistes + monolithes
  const sOuvreur =ft=>ft.p+0.5*ft.f;     // ouvreur : positionnel + fréquence (bon quand board masqué)
  const sFinisseur=ft=>ft.c;             // finisseur : cohorte (bon quand board contraint)
  const sCohPos  =ft=>ft.c+0.4*ft.p;     // monolithe fort de référence

  const monoCoh=wr(argmax(sFinisseur)), monoCohPos=wr(argmax(sCohPos)), monoOuv=wr(argmax(sOuvreur));
  const bestMono=Math.max(monoCoh,monoCohPos,monoOuv);

  // ÉQUIPE : routeur par taille de cohorte (K). On balaye K pour trouver le bon seuil de bascule.
  function team(K){ return (cand,F,consist)=>{ const score = consist>K ? sOuvreur : sFinisseur; let bL=cand[0],bS=-1e18; for(const L of cand){const s=score(F[L]);if(s>bS){bS=s;bL=L;}} return bL; }; }
  const Ks=[20,40,80,150,300]; const teamRes=Ks.map(K=>({K,wr:wr(team(K))}));
  const bestTeam=teamRes.reduce((m,x)=>x.wr>m.wr?x:m,teamRes[0]);

  console.log(`\n=== EVO O1 (point 2) — RÔLES / DIVISION DU TRAVAIL (équipe spécialistes+routeur vs monolithe) · ${test.length} mots len-7 ===\n`);
  console.log(`  MONOLITHES (une stratégie partout) :`);
  console.log(`    cohorte (finisseur seul)   : ${monoCoh.toFixed(1)} %`);
  console.log(`    cohorte+pos                : ${monoCohPos.toFixed(1)} %`);
  console.log(`    ouvreur seul (pos+freq)    : ${monoOuv.toFixed(1)} %`);
  console.log(`    → meilleur monolithe : ${bestMono.toFixed(1)} %`);
  console.log(`\n  ÉQUIPE (ouvreur si cohorte large, finisseur si cohorte serrée) — balayage du seuil K :`);
  for(const t of teamRes) console.log(`    K=${String(t.K).padStart(3)} (bascule à ${t.K} mots compatibles) : ${t.wr.toFixed(1)} %`);
  console.log(`    → meilleure équipe : ${bestTeam.wr.toFixed(1)} % (K=${bestTeam.K})`);
  const wins = bestTeam.wr > bestMono + 0.1;
  console.log(`\n  ${wins?'✅ LA DIVISION PAIE':'⚠️ pas de gain de division ici'} : ${wins?'l\'équipe (ouvreur tôt, finisseur tard) bat le meilleur monolithe — chaque rôle couvre une phase que l\'autre rate.':'le monolithe cohorte est déjà un bon GÉNÉRALISTE (sa cohorte s\'adapte seule) → se spécialiser n\'ajoute rien sur cette tâche. Finding honnête.'}`);
  console.log(`  → ${wins?'le vrai travail de groupe émerge. Reste O1 : vraies versions OMEGA comme agents + langage P2 comme canal.':'pour que la division paie, il faut une tâche plus HÉTÉROGÈNE (où aucune stratégie unique n\'est bonne partout). À explorer.'}`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
