'use strict';
// EVO O1 (bonus) — JOUER EN CASCADE : les agents en CHAÎNE de priorité, chacun joue S'IL EST CONFIANT, sinon il cède
// au suivant. C'est le mécanisme natif d'OMEGA (la "cascade des declares" : priorité fixe, le 1er confiant tranche).
// Ici : le FINISSEUR (cohorte) joue si la cohorte pointe nettement une lettre (fraction du top ≥ τ) ; sinon il CÈDE à
// l'OUVREUR (positionnel/fréquence). La division par phase émerge de la CONFIANCE — sans seuil K câblé ni apprentissage.
// On balaye τ. Comparaison : monolithe / routeur câblé (72,5%) / coordinateur appris (72,5%). Solveur cheat-free, lexique réel.
const { loadEngine } = require('./fitness_harness.js');

(async()=>{
  const O=loadEngine(); await O.loadLex(); const W=O.evalIn('OMEGA_LEX4').words; const A=26;
  const gc=new Array(A).fill(0); const pf=Array.from({length:7},()=>new Array(A).fill(0));
  let words7=[]; for(let i=0;i<W.length;i++){ const m=W[i]&&W[i].m; if(!m||!/^[A-Z]+$/.test(m)||m.length!==7)continue; words7.push(m);
    for(let pos=0;pos<7;pos++){ const k=m.charCodeAt(pos)-65; if(k>=0&&k<A){ gc[k]++; pf[pos][k]++; } } }
  const gcMax=Math.max(...gc)||1, pfMax=pf.map(r=>Math.max(...r)||1);
  let r=12345; const rnd0=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  for(let i=words7.length-1;i>0;i--){const j=Math.floor(rnd0()*(i+1));const t=words7[i];words7[i]=words7[j];words7[j]=t;}
  const test=words7.slice(0,80), cohortPool=words7.slice(0,2200);

  function step(rev,n,g){
    const revSet=new Set(); for(let i=0;i<n;i++)if(rev[i]!=null)revSet.add(rev[i]);
    const wrongL=[]; for(const L of g){const ch=String.fromCharCode(65+L); if(!revSet.has(ch))wrongL.push(ch);}
    const cc=new Array(A).fill(0); let consist=0;
    for(const w of cohortPool){ let ok=true; for(let i=0;i<n;i++){if(rev[i]!=null&&w[i]!==rev[i]){ok=false;break;}}
      if(ok)for(const wc of wrongL){if(w.indexOf(wc)>=0){ok=false;break;}}
      if(ok){consist++; const seen=new Set(); for(let i=0;i<n;i++){if(rev[i]==null){const k=w.charCodeAt(i)-65;if(k>=0&&k<A&&!seen.has(k)){seen.add(k);cc[k]++;}}}} }
    const cz=consist||1; const F=new Array(A);
    for(let L=0;L<A;L++){let p=0,cn=0;for(let i=0;i<n;i++){if(rev[i]!=null)continue;cn++;p+=pf[i][L]/pfMax[i];}F[L]={f:gc[L]/gcMax,p:cn?p/cn:0,c:cc[L]/cz};}
    return F;
  }
  function play(word,decide){const n=word.length,rev=new Array(n).fill(null),g=new Set();let wrong=0;
    while(wrong<3 && rev.includes(null)){const F=step(rev,n,g);const cand=[];for(let L=0;L<A;L++)if(!g.has(L))cand.push(L);const L=decide(cand,F);g.add(L);const ch=String.fromCharCode(65+L);if(word.indexOf(ch)>=0){for(let i=0;i<n;i++)if(word[i]===ch)rev[i]=ch;}else wrong++;}
    return !rev.includes(null)&&wrong<3;}
  const wr=decide=>{let w=0;for(const word of test)if(play(word,decide))w++;return +(100*w/test.length).toFixed(1);};
  const argmax=score=>(cand,F)=>{let bL=cand[0],bS=-1e18;for(const L of cand){const s=score(F[L]);if(s>bS){bS=s;bL=L;}}return bL;};

  const monoCoh=wr(argmax(ft=>ft.c));   // monolithe cohorte (référence)

  // CASCADE : finisseur (cohorte) si confiant (top fraction ≥ τ), sinon ouvreur (positionnel/fréquence)
  function cascade(tau){ return (cand,F)=>{
    let topL=cand[0], topC=-1, top2=-1; for(const L of cand){ const c=F[L].c; if(c>topC){top2=topC;topC=c;topL=L;} else if(c>top2)top2=c; }
    if(topC>=tau) return topL;                                   // finisseur CONFIANT → il tranche
    let oL=cand[0], oS=-1e18; for(const L of cand){ const s=F[L].p+0.5*F[L].f; if(s>oS){oS=s;oL=L;} } return oL;   // cède à l'ouvreur
  }; }
  const taus=[0.30,0.40,0.50,0.60,0.70]; const casc=taus.map(t=>({t,wr:wr(cascade(t))}));
  const best=casc.reduce((m,x)=>x.wr>m.wr?x:m,casc[0]);

  console.log(`\n=== EVO O1 (bonus) — JOUER EN CASCADE (chaîne de confiance, façon "cascade des declares" d'OMEGA) · ${test.length} mots len-7 ===\n`);
  console.log(`  référence — monolithe cohorte : ${monoCoh.toFixed(1)} %`);
  console.log(`  repères   — routeur câblé ≈ 72,5 %  ·  coordinateur appris (reward-partie) ≈ 72,5 %\n`);
  console.log(`  CASCADE [cohorte si top-fraction ≥ τ, sinon ouvreur] — balayage de τ :`);
  for(const c of casc) console.log(`    τ=${c.t.toFixed(2)} (le finisseur tranche s'il met ≥${(c.t*100).toFixed(0)}% de la cohorte sur une lettre) : ${c.wr.toFixed(1)} %`);
  console.log(`    → meilleure cascade : ${best.wr.toFixed(1)} % (τ=${best.t.toFixed(2)})`);
  console.log(`\n  ⚠️ RÉSULTAT HONNÊTE : la cascade par CONFIANCE (top-fraction) NE bat PAS le monolithe (${best.wr.toFixed(1)} % vs ${monoCoh.toFixed(1)} %), et empire quand τ monte.`);
  console.log(`  → POURQUOI : elle cède à l'ouvreur dès que la cohorte n'est pas nette — or l'ouvreur n'est bon QUE très tôt (cohorte énorme),`);
  console.log(`     pas en milieu de partie (où la top-fraction est AUSSI basse, mais où l'ouvreur est mauvais). La confiance par top-fraction n'isole pas le bon régime.`);
  console.log(`  → Le bon signal de « pas sûr », c'est la TAILLE de cohorte (= le routeur câblé, 72,5 %) ou l'ISSUE DE PARTIE (= le coordinateur appris, 72,5 %).`);
  console.log(`  → LEÇON : la cascade (mécanisme natif d'OMEGA, « le 1er confiant parle ») est saine, mais elle vaut ce que vaut son SIGNAL de confiance — ici, le mauvais.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
