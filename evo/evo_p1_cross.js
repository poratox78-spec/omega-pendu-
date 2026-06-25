'use strict';
// EVO P1 (b-ter) — le CROISEMENT, pas l'addition (Rem : « OMEGA est un ensemble, ni addition ni
// multiplication, c'est un croisement »). Le bundle _emrg_bind est une ADDITION (superposition) → d'où le
// crosstalk. On teste la doctrine « jointe » : décoder DEUX routes de liage indépendantes, puis CROISER leurs
// posteriors par position (conjonction = intersection des contraintes), au lieu d'une seule route.
//   route A = circularShift(letterVec, (p+1)*1)   |  route B = circularShift(letterVec, (p+1)*7)
//   croisement = softmax(A) × softmax(B) par lettre, argmax (les pics de crosstalk diffèrent entre routes → s'annulent).
// Primitives RÉELLES (circularShift/Inverse, cosineSim, letterVecsSDIM). OFF-inerte, déterministe.
// Usage : node evo/evo_p1_cross.js [perLen] [seed]
const { loadEngine } = require('./fitness_harness.js');

const CFG = [
  'L01_A4_M4M_DECOMP_ENABLED=true','L01_A5_M2M_POSITIONAL_ENABLED=true','L01_A6_OS_CONCEPT_ARBITRAGE_ENABLED=true',
  'M_VOIE_PHON_ENABLED=true','M_OS_V07_ENABLED=true','M4_PHON_USE_P_ENABLED=true','M_SUBSTRAT_ORTHO_PURE_ENABLED=true','M_PHON_FEEDBACK_ENABLED=true',
  'M_BPC_M3D_ENABLED=true','M_PHON_CONCEPT_BIND_ENABLED=true',
].join(';');

(async () => {
  const perLen=+(process.argv[2]||60), seed=+(process.argv[3]||12345);
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn; const LEX=ev('OMEGA_LEX4'); const W=LEX.words;

  ev(CFG);
  ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();`);
  ev(CFG);
  if(ev("!(typeof letterVecsSDIM!=='undefined' && letterVecsSDIM && typeof circularShift==='function' && typeof circularShiftInverse==='function' && typeof cosineSim==='function')"))
    { console.error('ERR primitives VSA non dispo'); process.exit(1); }

  ev('globalThis.__bindMul=function(w,mul){var c=new Float64Array(SDIM);for(var p=0;p<w.length;p++){var idx=w.charCodeAt(p)-65;if(idx<0||idx>=26)continue;var sv=circularShift(letterVecsSDIM[idx],((p+1)*mul)%SDIM);for(var i=0;i<SDIM;i++)c[i]+=sv[i];}var n=0;for(var i=0;i<SDIM;i++)n+=c[i]*c[i];n=Math.sqrt(n)||1;for(var i=0;i<SDIM;i++)c[i]/=n;return c;};');
  // décodage UNE route (cleanup cosine, argmax)
  ev('globalThis.__decode1=function(c,len,mul){var out="";for(var p=0;p<len;p++){var u=circularShiftInverse(c,((p+1)*mul)%SDIM),bi=0,bv=-2;for(var l=0;l<26;l++){var d=cosineSim(u,letterVecsSDIM[l]);if(d>bv){bv=d;bi=l;}}out+=String.fromCharCode(65+bi);}return out;};');
  // décodage CROISÉ deux routes : softmax(A)×softmax(B) par lettre (conjonction), argmax
  ev('globalThis.__decodeX=function(cA,cB,len){var B=8,out="";for(var p=0;p<len;p++){var uA=circularShiftInverse(cA,((p+1)*1)%SDIM),uB=circularShiftInverse(cB,((p+1)*7)%SDIM);var sa=[],sb=[],ma=-2,mb=-2;for(var l=0;l<26;l++){var da=cosineSim(uA,letterVecsSDIM[l]),db=cosineSim(uB,letterVecsSDIM[l]);sa.push(da);sb.push(db);if(da>ma)ma=da;if(db>mb)mb=db;}var za=0,zb=0,ea=[],eb=[];for(var l=0;l<26;l++){var va=Math.exp(B*(sa[l]-ma)),vb=Math.exp(B*(sb[l]-mb));ea.push(va);eb.push(vb);za+=va;zb+=vb;}var bi=0,bv=-1;for(var l=0;l<26;l++){var cr=(ea[l]/za)*(eb[l]/zb);if(cr>bv){bv=cr;bi=l;}}out+=String.fromCharCode(65+bi);}return out;};');

  const LENS=[7,9,11,12,13,15,18,22];
  const pool={}; for(const L of LENS) pool[L]=[];
  for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&/^[A-Z]+$/.test(m)&&pool[m.length]) pool[m.length].push(m);}
  let r=(seed>>>0); const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  const shuf=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}return a;};

  const pl=(s,n)=>String(s).padStart(n);
  console.log(`\n=== EVO P1 — CROISEMENT vs route unique · copie sur substrat VSA 1024D · ${perLen}/len · seed ${seed} ===`);
  console.log(`route unique = bundle _emrg_bind (addition) ; croisé = 2 routes de liage décodées puis conjuguées\n`);
  console.log(`          │   1 route (addition)   │     2 routes CROISÉES    `);
  console.log(`  len (n) │  lettres OK · mot exact │   lettres OK · mot exact `);
  console.log(`  ────────┼─────────────────────────┼──────────────────────────`);
  let aggS=[0,0,0], aggX=[0,0,0];
  for(const L of LENS){
    const ws=shuf(pool[L].slice()).slice(0,perLen); if(!ws.length)continue;
    let s_p=0,s_t=0,s_w=0, x_p=0,x_t=0,x_w=0;
    for(const w of ws){
      const cA=global.__bindMul(w,1), cB=global.__bindMul(w,7);
      const r1=global.__decode1(cA,w.length,1), rx=global.__decodeX(cA,cB,w.length);
      let o1=0,ox=0; for(let i=0;i<w.length;i++){ if(r1[i]===w[i])o1++; if(rx[i]===w[i])ox++; }
      s_p+=o1; s_t+=w.length; if(r1===w)s_w++; x_p+=ox; if(rx===w)x_w++;
    }
    const sp=100*s_p/s_t, sw=100*s_w/ws.length, xp=100*x_p/s_t, xw=100*x_w/ws.length;
    aggS[0]+=s_p;aggS[1]+=s_t;aggS[2]+=s_w; aggX[0]+=x_p;aggX[2]+=x_w; aggX[1]=aggS[1];
    console.log(`  ${pl(L,3)} (${pl(ws.length,3)})│   ${pl(sp.toFixed(1),5)} %  ·  ${pl(sw.toFixed(1),5)} % │    ${pl(xp.toFixed(1),5)} %  ·  ${pl(xw.toFixed(1),5)} %`);
  }
  console.log(`  ────────┴─────────────────────────┴──────────────────────────`);
  console.log(`  → la route unique (addition) plafonne sur le MOT exact (crosstalk) ; le croisement le relève si les routes sont indépendantes.`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
