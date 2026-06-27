'use strict';
// EVO O2 / SENS — un AVANT-GOÛT de sémantique, MESURÉ, et son PLAFOND. Désambiguïsation d'homophones par le CONTEXTE,
// méthode conforme à la littérature (Golding & Roth 1999) : classifieur Naïve Bayes par confusion-set qui COMBINE
// prior × contexte, avec LISSAGE add-λ (Levy & Goldberg 2015 : ne pas négliger le lissage), sur un SPLIT train/test
// (pas de fuite), moyenné sur 3 graines. Corpus : UD French-GSD (réel, POS gold).
//   score(c) = log P(c) + Σ_{w∈contexte} log P(w|c) ;  P(w|c) = (count_train(w près de c)+λ)/(total_c+λ·V).
//
// RÉSULTAT (held-out 20 %, 3 graines) : le contexte aide SURTOUT les homophones GRAMMATICAUX (son/sont 55→88,
// on/ont 57→87, ce/se 53→76, et/est 60→77, a/à 82→87 ; agrégé 68→81, +14 pts) plus que sémantiques (mer/mère 65→88,
// le reste plafonné par le prior ; agrégé +3). MAIS précision ~77-88 % = LOIN du FP=0 → signal de RÉ-ORDONNANCEMENT
// utile, PAS un correcteur clé-en-main : ça VALIDE l'abstention (« se taire plutôt qu'un faux positif »). Et c'est de la
// COLLOCATION, pas de la COMPRÉHENSION (= LLM, autre projet, hors doctrine).
// NOTE MÉTHODO : un 1er jet (cosinus d'embeddings PPMI SEUL, sans prior, avec fuite) régressait sur a/à (−8) ; corrigé
// ici par prior×contexte + lissage + held-out. Le contrôle littérature a attrapé l'erreur.
//
// CORPUS (hors-repo, 25 Mo, CC BY-SA 4.0) — re-télécharger si absent :
//   curl -L https://raw.githubusercontent.com/UniversalDependencies/UD_French-GSD/master/fr_gsd-ud-train.conllu \
//        -o data_local/ud_fr_gsd-train.conllu
//   Usage : node evo/evo_o2_homophone_context.js
const fs=require('fs'), path=require('path');
const CONLLU=path.join(__dirname,'..','data_local','ud_fr_gsd-train.conllu');
const WIN=4, LAMBDA=0.5, MINF=4, SEEDS=[1,2,3], TESTFRAC=0.2;

if(!fs.existsSync(CONLLU)){ console.error('Corpus UD absent. Télécharge-le (cf. en-tête) dans data_local/ud_fr_gsd-train.conllu'); process.exit(2); }

const sents=[]; let cur=[];
for(const line of fs.readFileSync(CONLLU,'utf8').split('\n')){
  if(line===''){ if(cur.length){sents.push(cur);cur=[];} continue; }
  if(line[0]==='#') continue;
  const c=line.split('\t'); if(c.length<5||c[0].includes('-')||c[0].includes('.')) continue;
  cur.push(c[1].toLowerCase());
}
if(cur.length)sents.push(cur);
console.log(`corpus UD : ${sents.length} phrases · ${sents.reduce((s,x)=>s+x.length,0)} tokens`);

const GROUPS=[
  {kind:'sémantique', c:['cours','court']}, {kind:'sémantique', c:['mer','mère']},
  {kind:'sémantique', c:['verre','vert','vers']}, {kind:'sémantique', c:['sang','cent','sans']},
  {kind:'sémantique', c:['conte','compte','comte']},
  {kind:'grammatical', c:['et','est']}, {kind:'grammatical', c:['ce','se']},
  {kind:'grammatical', c:['a','à']}, {kind:'grammatical', c:['ou','où']},
  {kind:'grammatical', c:['son','sont']}, {kind:'grammatical', c:['ces','ses']}, {kind:'grammatical', c:['on','ont']},
];
function shuffle(a,seed){ a=a.slice(); let r=seed>>>0; for(let i=a.length-1;i>0;i--){ r=(r*1664525+1013904223)>>>0; const j=r%(i+1); const t=a[i];a[i]=a[j];a[j]=t;} return a; }

const G=GROUPS.map(g=>({...g, n:0, base:0, nb:0, tested:false}));
for(const seed of SEEDS){
  const sh=shuffle(sents,seed); const ntest=Math.floor(sh.length*TESTFRAC);
  const test=sh.slice(0,ntest), train=sh.slice(ntest);
  const allCands=new Set(); for(const g of GROUPS)for(const c of g.c)allCands.add(c);
  const freq=new Map(), ctx=new Map(), tot=new Map(); const ctxVocab=new Set();
  for(const s of train){ for(let i=0;i<s.length;i++){ const w=s[i];
    if(allCands.has(w)){ freq.set(w,(freq.get(w)||0)+1); if(!ctx.has(w))ctx.set(w,new Map());
      const cm=ctx.get(w); let t=0;
      for(let j=Math.max(0,i-WIN);j<=Math.min(s.length-1,i+WIN);j++){ if(j===i)continue; const cw=s[j]; cm.set(cw,(cm.get(cw)||0)+1); ctxVocab.add(cw); t++; }
      tot.set(w,(tot.get(w)||0)+t);
    } } }
  const V=ctxVocab.size;
  for(let gi=0; gi<GROUPS.length; gi++){ const g=GROUPS[gi];
    const cands=g.c.filter(c=>(freq.get(c)||0)>=MINF); if(cands.length<2)continue; G[gi].tested=true;
    const top=cands.reduce((m,c)=>(freq.get(c)||0)>(freq.get(m)||0)?c:m,cands[0]);
    const totFreq=cands.reduce((s,c)=>s+(freq.get(c)||0),0);
    for(const s of test){ for(let i=0;i<s.length;i++){ const tw=s[i]; if(!cands.includes(tw))continue;
      const context=[]; for(let j=Math.max(0,i-WIN);j<=Math.min(s.length-1,i+WIN);j++){ if(j!==i)context.push(s[j]); }
      if(context.length<2)continue;
      G[gi].n++; if(top===tw)G[gi].base++;
      let best=cands[0],bs=-Infinity;
      for(const c of cands){ let sc=Math.log((freq.get(c)||0)/totFreq); const cm=ctx.get(c)||new Map(), tc=tot.get(c)||0;
        for(const cw of context) sc+=Math.log(((cm.get(cw)||0)+LAMBDA)/(tc+LAMBDA*V));
        if(sc>bs){bs=sc;best=c;} }
      if(best===tw)G[gi].nb++;
    } }
  }
}
console.log(`\n=== homophones : prior seul vs prior×contexte (Naïve Bayes, lissé, held-out ${TESTFRAC*100}%, ${SEEDS.length} graines) ===`);
console.log(`  groupe                type         n     prior   +contexte   gain`);
const agg={'sémantique':{n:0,b:0,e:0},'grammatical':{n:0,b:0,e:0}};
for(const g of G){ if(!g.tested||g.n<30){ console.log(`  ${g.c.join('/').padEnd(20)} ${g.kind.padEnd(12)} (sauté : rare)`); continue; }
  const bp=100*g.base/g.n, ep=100*g.nb/g.n; agg[g.kind].n+=g.n; agg[g.kind].b+=g.base; agg[g.kind].e+=g.nb;
  console.log(`  ${g.c.join('/').padEnd(20)} ${g.kind.padEnd(12)} ${String(g.n).padStart(5)}   ${(bp.toFixed(0)+'%').padStart(5)}    ${(ep.toFixed(0)+'%').padStart(6)}     ${(ep-bp>=0?'+':'')}${(ep-bp).toFixed(0)}`); }
console.log(`\n  === AGRÉGÉ ===`);
for(const k of ['sémantique','grammatical']){ const a=agg[k]; if(!a.n)continue; const bp=100*a.b/a.n, ep=100*a.e/a.n;
  console.log(`  ${k.padEnd(12)} (n=${a.n}) : prior ${bp.toFixed(0)}% → +contexte ${ep.toFixed(0)}%   gain ${(ep-bp>=0?'+':'')}${(ep-bp).toFixed(0)} pts`); }
console.log(`\n  >>> utile (surtout grammatical), mais précision ~77-88 % LOIN du FP=0 → ré-ordonnancement, pas correcteur ; valide l'abstention.`);
console.log(`      collocation, PAS compréhension. Méthode : Golding&Roth 1999 (prior×contexte) + Levy&Goldberg 2015 (lissage) + held-out.`);
