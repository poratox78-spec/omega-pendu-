'use strict';
// EVO P1 — LA PYRAMIDE, pas la LIGNE (Rem : « OMEGA n'est pas une ligne c'est une pyramide ; voir dictée »).
// Réflexion de la dictée (DECOMPOSE.md) : décomposer en hiérarchie + DOUBLE VOIE : les RÈGLES (sublexical)
// régénèrent le RÉGULIER, on ne STOCKE que l'IRRÉGULIER (exceptions). Mesuré côté dictée : « 51% des phonos
// in-lexique reconstructibles → ne stocker que les irréguliers », 4,63 bits/phonème, 17× factorisé.
//   => pour la COPIE, ça DISSOUT le mur de capacité (§8.1 K≈N) : mon bundle char⊗position stockait la LIGNE ;
//      la pyramide ne stocke que les exceptions. Première mesure CÔTÉ CODE (le vrai but) : quelle fraction du
//      PROPRE code d'OMEGA est RÉGULIÈRE (régénérée par le contexte) vs IRRÉGULIÈRE (à stocker) ?
//   Méthode dictée : modèle ordre-2 appris sur TRAIN, mesuré HELD-OUT (pas de fuite). Pas besoin du moteur.
const fs=require('fs'), path=require('path');
const dir=__dirname;
// corpus = vrai code OMEGA, DIVERS (on exclut mes probes evo_p1_* répétitives + les _tmp pour ne pas gonfler la régularité)
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.js') && !f.startsWith('evo_p1_') && !f.includes('_tmp'));
let code=''; for(const f of files) code+='\n'+fs.readFileSync(path.join(dir,f),'utf8');
const toks=code.match(/[A-Za-z_$][A-Za-z0-9_$]*|[0-9]+\.?[0-9]*|"[^"\n]*"|'[^'\n]*'|`[^`]*`|\s+|[^\sA-Za-z0-9_$]/g)||[];

const isWS=t=>/^\s+$/.test(t);
const cut=Math.floor(toks.length*0.7);
const train=toks.slice(0,cut), test=toks.slice(cut);
const K=(a,b)=>a+''+b;
const M=new Map();
for(let i=2;i<train.length;i++){ const k=K(train[i-2],train[i-1]); let m=M.get(k); if(!m){m=new Map();M.set(k,m);} m.set(train[i],(m.get(train[i])||0)+1); }
const top1=(a,b)=>{ const m=M.get(K(a,b)); if(!m)return null; let bt=null,bc=-1; for(const [t,c] of m){ if(c>bc){bc=c;bt=t;} } return bt; };

let reg=0,irr=0, bits=0, nb=0;
let a=train[train.length-2], b=train[train.length-1];
for(let i=0;i<test.length;i++){ const tok=test[i];
  if(!isWS(tok)){
    const pred=top1(a,b); if(pred===tok)reg++; else irr++;
    const m=M.get(K(a,b)); let p;
    if(m){ let tot=0; for(const c of m.values())tot+=c; p=((m.get(tok)||0)+0.02)/(tot+0.02*(m.size+1)); } else p=2e-4;
    bits+=-Math.log2(p); nb++;
  }
  a=b; b=tok;
}
const tot=reg+irr||1;
console.log(`\n=== EVO P1 — la PYRAMIDE (réflexion dictée) appliquée au CODE ===`);
console.log(`corpus = propre code evo/ DIVERS : ${files.length} fichiers · ${toks.length} tokens · modèle ordre-2 TRAIN→HELD-OUT (pas de fuite)\n`);
console.log(`  tokens de contenu held-out : ${tot}`);
console.log(`  RÉGULIER  (régénéré par le contexte, top-1) : ${String(reg).padStart(5)} = ${(100*reg/tot).toFixed(1)} %  → à NE PAS stocker`);
console.log(`  IRRÉGULIER (exception, à stocker)           : ${String(irr).padStart(5)} = ${(100*irr/tot).toFixed(1)} %`);
console.log(`  entropie ≈ ${(bits/nb).toFixed(2)} bits/token de contenu (cf. dictée : 4,63 bits/phonème)`);
console.log(`\n  → le mur §8.1 (K≈N) suppose qu'on stocke la LIGNE. La pyramide+double-voie ne stocke que ~${(100*irr/tot).toFixed(0)} % d'exceptions ;`);
console.log(`    les RÈGLES régénèrent le reste. C'est le « 51% reconstructible » de la dictée, transposé au code.`);
console.log(`  ⚠️ ordre-2 = règle GROSSIÈRE (la vraie pyramide = AST/grammaire) → ce % régulier est un PLANCHER.`);
