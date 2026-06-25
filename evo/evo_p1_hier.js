'use strict';
// EVO P1 — décomposeur HIÉRARCHIQUE (la pyramide, pas la ligne). Double voie de la dictée appliquée au code :
//   SQUELETTE (régulier, régénéré) = grammaire + STRUCTURE de l'arbre (imbrication {}()[]) + TAILLES des nœuds
//      (la « longueur » = l'étage M2 position / M3 longueur). Régénérable → ne pas stocker la valeur, juste la forme.
//   FEUILLES (irrégulier, stocké) = identifiants + littéraux. MAIS double voie : route LEXICALE = un identifiant
//      répété se stocke UNE fois + références (recall) ; seul l'UNIQUE est irréductible.
// On mesure ce que copier OMEGA coûte VRAIMENT (rules+exceptions) vs la ligne brute. Méthode dictée (17× factorisé).
// Pas besoin du moteur. Usage : node evo/evo_p1_hier.js
const fs=require('fs'), path=require('path'), zlib=require('zlib');
const dir=__dirname;
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.js') && !f.startsWith('evo_p1_') && !f.includes('_tmp'));
let code=''; for(const f of files) code+='\n'+fs.readFileSync(path.join(dir,f),'utf8');

const KW=new Set('var let const function return if else for while do switch case break continue new typeof instanceof in of this null true false undefined void delete try catch finally throw class extends super yield async await default'.split(' '));
const toks=code.match(/[A-Za-z_$][A-Za-z0-9_$]*|[0-9]+\.?[0-9]*|"[^"\n]*"|'[^'\n]*'|`[^`]*`|\s+|[^\sA-Za-z0-9_$]/g)||[];

const isWS=t=>/^\s+$/.test(t);
const kind=t=>{
  if(isWS(t)) return 'WS';
  if(/^[A-Za-z_$]/.test(t)) return KW.has(t)?'KW':'IDENT';
  if(/^[0-9]/.test(t)) return 'NUM';
  if(/^["'`]/.test(t)) return 'STR';
  return 'SYM';                       // opérateurs / délimiteurs / brackets
};

let nWS=0,nKW=0,nSYM=0,nIDENT=0,nNUM=0,nSTR=0;
const identCount=new Map(), litCount=new Map();
let depth=0, maxDepth=0; const depthHist={};
for(const t of toks){
  const k=kind(t);
  if(k==='WS'){nWS++;continue;}
  if('([{'.includes(t)){depth++; if(depth>maxDepth)maxDepth=depth;}
  if(')]}'.includes(t)){depth=Math.max(0,depth-1);}
  depthHist[depth]=(depthHist[depth]||0)+1;
  if(k==='KW')nKW++; else if(k==='SYM')nSYM++;
  else if(k==='IDENT'){nIDENT++; identCount.set(t,(identCount.get(t)||0)+1);}
  else if(k==='NUM'){nNUM++; litCount.set(t,(litCount.get(t)||0)+1);}
  else if(k==='STR'){nSTR++; litCount.set(t,(litCount.get(t)||0)+1);}
}
const nContent=toks.length-nWS;
const structTok=nKW+nSYM;                          // squelette grammatical (régulier)
const identUniq=identCount.size, litUniq=litCount.size;
const identOcc=nIDENT, litOcc=nNUM+nSTR;
const irreducible=identUniq+litUniq;               // feuilles UNIQUES = le vrai irréductible (store-once)
const rawBytes=Buffer.byteLength(code);
const gz=zlib.gzipSync(Buffer.from(code),{level:9}).length;

const pc=(a,b)=>(100*a/b).toFixed(1)+' %';
console.log(`\n=== EVO P1 — décomposeur HIÉRARCHIQUE (pyramide + double voie) sur le propre code d'OMEGA ===`);
console.log(`corpus : ${files.length} fichiers · ${toks.length} tokens (${nContent} de contenu) · profondeur max d'arbre ${maxDepth}\n`);
console.log(`  SQUELETTE (régulier, régénéré par la grammaire) :`);
console.log(`    mots-clés + symboles/délimiteurs : ${structTok} = ${pc(structTok,nContent)} des tokens de contenu`);
console.log(`    structure d'arbre : profondeur d'imbrication moyenne portée par {}()[] (l'étage "longueur/taille" = M2/M3)`);
console.log(`  FEUILLES (irrégulier) — double voie :`);
console.log(`    identifiants : ${identOcc} occurrences → ${identUniq} UNIQUES  (route LEXICALE : dédup ${(identOcc/Math.max(1,identUniq)).toFixed(1)}× → stocker 1 fois + références)`);
console.log(`    littéraux    : ${litOcc} occurrences → ${litUniq} uniques`);
console.log(`    => irréductible (feuilles uniques à stocker) : ${irreducible} = ${pc(irreducible,nContent)} des tokens de contenu`);
console.log(`\n  COÛT DE COPIE (rules+exceptions vs la ligne brute) :`);
console.log(`    ligne brute : ${(rawBytes/1024).toFixed(1)} Ko`);
console.log(`    gzip (≈ ce que dédup+règles atteignent automatiquement) : ${(gz/1024).toFixed(1)} Ko = ${(rawBytes/gz).toFixed(1)}×`);
console.log(`\n  → la pyramide ne stocke pas la ligne : ~${pc(structTok,nContent)} est du squelette grammatical (régénéré),`);
console.log(`    et les feuilles se dédupent ${(identOcc/Math.max(1,identUniq)).toFixed(1)}× par recall. Le mur K≈N était l'artefact du stockage plat.`);
console.log(`    (cf. dictée : 51% reconstructible, 17× factorisé — même logique, transposée au code.)`);
