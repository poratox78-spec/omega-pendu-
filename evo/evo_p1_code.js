'use strict';
// EVO P1 — PIVOT VERS LE CODE. Le mot a caractérisé le substrat ; le but est de COPIER du code.
// Équivalent phon/ortho du code (Rem) :
//   ORTHO = surface (caractères exacts)   |   PHON = structure (CLASSE syntaxique de la position : ident/op/délim/num/…)
// On encode 2 routes (surface char⊗pos, structure classe⊗pos) sur le substrat HDC, et on compare 3 décodeurs :
//   (1) surface seule  (2) surface × structure = MULTIPLY (conjonction = jointe, pour la copie fidèle)
//   (3) surface + structure = ADD (mélange = OS-arb, repli si une route ne sait pas)
// Primitives RÉELLES (randomHRR, circularShift/Inverse, cosineSim, SDIM). OFF-inerte, déterministe.
// Usage : node evo/evo_p1_code.js [seed]
const { loadEngine } = require('./fitness_harness.js');

(async () => {
  const seed=+(process.argv[2]||12345);
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn;
  ev('M_VOIE_PHON_ENABLED=true;M_SUBSTRAT_ORTHO_PURE_ENABLED=true;');
  ev(`_omegaSeed=${seed};_omegaRng=makeMulberry32(${seed});initOmegaGlobals();`);
  if(ev("!(typeof randomHRR==='function' && typeof circularShift==='function' && typeof circularShiftInverse==='function' && typeof cosineSim==='function' && typeof SDIM!=='undefined')"))
    { console.error('ERR primitives HDC non dispo'); process.exit(1); }

  // vraies lignes de code style-moteur (« OMEGA se copie ») — longueurs variées
  const CORPUS = [
    "var i = 0;",
    "M3_d.output = null;",
    "if (idx < 0 || idx >= 26) continue;",
    "const c = new Float64Array(SDIM);",
    "for (let k = 0; k < n; k++) { sum += a[k]; }",
    "return dn > 1e-12 ? Math.sqrt(en/dn) : -1;",
    "while (gameActive && sf-- > 0) omegaStep();",
    "letterVecs[l][i] = letterVecsSDIM[l][i];",
    "function step(w) { return w.length; }",
    "globalThis.__rec = function() { return M3_d; };",
    "for (let p = 0; p < word.length; p++) { const idx = word.charCodeAt(p) - 65; if (idx < 0) continue; sum += w[idx]; }",
    "function _emrg_bind(word, mask) { const c = new Float64Array(SDIM); for (let i = 0; i < SDIM; i++) c[i] = 0; return c; }",
    "if (M_BPC_M3D_ENABLED && M3_d && M3_d.bpcW) { M3_d.output = computeConcept(M1_d.output, N_CONCEPT_CELLS); }",
    "const recM = recN ? recSum / recN : -1; console.log('reconstruction relative = ' + recM.toFixed(3) + ' ok');",
    "while (gameActive && safety-- > 0) { omegaStep(); const s = snapshot(); if (s) { last = s; total += s.err; } }",
  ];

  // classe syntaxique d'un caractère = le « phon » du code
  const classOf = (ch) => {
    if (/[ \t\n]/.test(ch)) return 'WS';
    if (/[0-9]/.test(ch)) return 'NUM';
    if (/[A-Za-z_$]/.test(ch)) return 'IDENT';
    if (/[()\[\]{}]/.test(ch)) return 'BRACKET';
    if (/[+\-*/=<>!&|%^~]/.test(ch)) return 'OP';
    if (/[;:,.?]/.test(ch)) return 'PUNCT';
    if (/['"`]/.test(ch)) return 'QUOTE';
    return 'OTHER';
  };
  const CLASSES = ['WS','NUM','IDENT','BRACKET','OP','PUNCT','QUOTE','OTHER'];

  // codebook HDC : 1 hypervecteur randomHRR par symbole distinct + par classe (déterministe, seedé)
  ev('globalThis.__newvec=function(){return randomHRR(SDIM);};');
  ev('globalThis.__shift=function(v,s){return circularShift(v,((s)%SDIM+SDIM)%SDIM);};');
  ev('globalThis.__ishift=function(v,s){return circularShiftInverse(v,((s)%SDIM+SDIM)%SDIM);};');
  ev('globalThis.__cos=function(a,b){return cosineSim(a,b);};');
  const sdim = ev('SDIM');

  const symVec = {}; const alphabet = [];
  for (const line of CORPUS) for (const ch of line) if (!(ch in symVec)) { symVec[ch] = global.__newvec(); alphabet.push(ch); }
  const clsVec = {}; for (const cl of CLASSES) clsVec[cl] = global.__newvec();

  const bundle = (line, vecOf) => {
    const c = new Float64Array(sdim);
    for (let p=0;p<line.length;p++){ const sv = global.__shift(vecOf(line[p]), p+1); for (let i=0;i<sdim;i++) c[i]+=sv[i]; }
    let n=0; for (let i=0;i<sdim;i++) n+=c[i]*c[i]; n=Math.sqrt(n)||1; for (let i=0;i<sdim;i++) c[i]/=n; return c;
  };
  const softmax = (scores, B) => { let m=-Infinity; for (const k in scores) if (scores[k]>m) m=scores[k]; let z=0; const o={}; for (const k in scores){ const e=Math.exp(B*(scores[k]-m)); o[k]=e; z+=e; } for (const k in o) o[k]/=z; return o; };
  const B=8;

  function decode(line) {
    const surf = bundle(line, ch=>symVec[ch]);
    const strc = bundle(line, ch=>clsVec[classOf(ch)]);
    let r1='', rx='', ra='';
    for (let p=0;p<line.length;p++){
      const uS = global.__ishift(surf, p+1), uC = global.__ishift(strc, p+1);
      const sSurf={}; for (const ch of alphabet) sSurf[ch]=global.__cos(uS, symVec[ch]);
      const sCls={};  for (const cl of CLASSES) sCls[cl]=global.__cos(uC, clsVec[cl]);
      const pSurf=softmax(sSurf,B), pCls=softmax(sCls,B);
      let b1=-1,c1='', bx=-1,cx='', ba=-1,ca='';
      for (const ch of alphabet){
        const ps=pSurf[ch], pc=pCls[classOf(ch)];
        if (ps>b1){b1=ps;c1=ch;}                 // surface seule
        const mul=ps*pc;        if (mul>bx){bx=mul;cx=ch;}   // MULTIPLY (conjonction)
        const add=ps+pc;        if (add>ba){ba=add;ca=ch;}   // ADD (mélange)
      }
      r1+=c1; rx+=cx; ra+=ca;
    }
    return {r1,rx,ra};
  }

  let n=0, c1=0, cx=0, ca=0, w1=0, wx=0, wa=0;
  const pad=(s,w)=>String(s).padStart(w);
  console.log(`\n=== EVO P1 — COPIE DE CODE · surface(ortho) × structure(phon) · SDIM=${sdim} · seed ${seed} ===`);
  console.log(`décodeurs : (1) surface seule · (2) surface×structure MULTIPLY (jointe) · (3) surface+structure ADD (mélange)\n`);
  console.log(`  len │ surf seule │ × MULTIPLY │ + ADD   │ extrait`);
  console.log(`  ────┼────────────┼────────────┼─────────┼────────`);
  for (const line of CORPUS){
    const {r1,rx,ra}=decode(line); const L=line.length;
    let o1=0,ox=0,oa=0; for (let i=0;i<L;i++){ if(r1[i]===line[i])o1++; if(rx[i]===line[i])ox++; if(ra[i]===line[i])oa++; }
    n+=L; c1+=o1; cx+=ox; ca+=oa; if(r1===line)w1++; if(rx===line)wx++; if(ra===line)wa++;
    console.log(`  ${pad(L,3)} │   ${pad((100*o1/L).toFixed(0),3)} %    │   ${pad((100*ox/L).toFixed(0),3)} %    │  ${pad((100*oa/L).toFixed(0),3)} %  │ ${JSON.stringify(line.slice(0,22))}`);
  }
  console.log(`  ────┴────────────┴────────────┴─────────┴────────`);
  console.log(`  caractères exacts : surface ${(100*c1/n).toFixed(1)}% · MULTIPLY ${(100*cx/n).toFixed(1)}% · ADD ${(100*ca/n).toFixed(1)}%`);
  console.log(`  LIGNES exactes /${CORPUS.length} : surface ${w1} · MULTIPLY ${wx} · ADD ${wa}`);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
