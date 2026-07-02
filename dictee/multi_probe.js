// multi_probe.js — mesure le correcteur COMPLET (runCorr) sur un corpus multi-fautes ÉTIQUETÉ PAR TYPE
// (data_local/phrases_multi_fautes_1000.json, gitignoré). Chaque faute a {type, detail} avec la substitution
// « correct -> faute ». On attribue chaque faute à son type et on mesure : corrigé (rouge) / signalé (vigilance) /
// raté / MAUVAISE correction, par type. Usage : node dictee/multi_probe.js [chemin.json]
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const CORPUS=process.argv[2]?path.resolve(process.argv[2]):path.join(ROOT,'data_local','phrases_multi_fautes_1000.json');
if(!fs.existsSync(CORPUS)){console.log('(corpus multi absent)');process.exit(0);}
const html=fs.readFileSync(path.join(ROOT,'app','omega-pendu.html'),'utf8');
const i0=html.indexOf('mode PHRASES'),start=html.indexOf('(function(){',i0);
const spIdx=html.indexOf('function spellText',start);const cut=html.indexOf('return out;}',spIdx)+'return out;}'.length;
const code=html.slice(start,cut)+';globalThis.__C={corr:correctText,corrTok:correctTokens,toks:toks,setSeg:(s)=>{_SEG=_segInfo(s);},spell:spellText,loadSp:loadSpellerLex,loadNP:loadNounPost,loadG:loadGenderLex,loadH:loadPosHmm,ready:()=>SP.ready};})();';
function blob(id){const m=html.match(new RegExp('id="'+id+'">([\\s\\S]*?)</script>'));return m?m[1]:'';}
const B={'vdc-lex':blob('vdc-lex'),'speller-lex-gz':blob('speller-lex-gz'),'noun-post-gz':blob('noun-post-gz'),'pos-hmm-gz':blob('pos-hmm-gz'),'gdet-lex-gz':blob('gdet-lex-gz')};
const stub=new Proxy(function(){},{get(t,k){if(k==='style')return{};if(k==='classList')return{add(){},remove(){},toggle(){},contains:()=>false};return stub;},set:()=>true,apply:()=>stub});
global.document={getElementById:(id)=>B[id]!==undefined&&B[id]!==''?{textContent:B[id]}:stub,createElement:()=>stub,body:stub,head:stub,addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
global.window=global;global.navigator={userAgent:'node'};global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
(0,eval)(code);const C=globalThis.__C;
const norm=w=>w.toLowerCase().replace(/[^a-zà-ÿ']/gi,'');
function runCorrLike(s){const sf=C.ready()?C.spell(s):[];C.setSeg(s);const T=C.toks(s),Tc=T.slice();
  sf.forEach(f=>{if(f.span!==2&&f.sugg&&f.tier!=='vigilance'&&/^[A-Za-zÀ-ÿ']+$/.test(f.sugg))Tc[f.i]=f.sugg;});
  const gf=C.corrTok(Tc);const fl={};gf.forEach(f=>fl[norm(T[f.i])]={sugg:f.sugg,tier:'red'});
  sf.forEach(f=>{const k=norm(f.word);if(fl[k]==null)fl[k]={sugg:f.sugg,tier:f.tier==='vigilance'?'vig':'red'};});
  return fl;}
(async()=>{
  await C.loadSp();if(C.loadNP)await C.loadNP();if(C.loadG)await C.loadG();if(C.loadH)await C.loadH();
  const arr=JSON.parse(fs.readFileSync(CORPUS,'utf8'));
  const agg={};const T=()=>({red:0,vig:0,miss:0,wrong:0,nonword:0});
  for(const o of arr){
    const fl=runCorrLike(o.faute), goodToks=new Set(C.toks(o.correcte).map(norm));
    for(const flt of (o.fautes||[])){
      const ty=flt.type||'?';(agg[ty]=agg[ty]||T());
      const m=/(\S+)\s*->\s*(\S+?)[\s.]*$/.exec(flt.detail||'');
      if(!m){agg[ty].nonword++;continue;}   // « espace avant le point » etc. : pas attribuable au mot
      const correctW=norm(m[1]),fauteW=norm(m[2]);
      if(!fauteW){agg[ty].nonword++;continue;}
      const f=fl[fauteW];
      if(!f){agg[ty].miss++;continue;}
      const okSugg=String(f.sugg).split(/\s+/).some(x=>norm(x)===correctW)||goodToks.has(norm(f.sugg));
      if(f.tier==='vig')agg[ty].vig++;
      else if(okSugg)agg[ty].red++;
      else agg[ty].wrong++;
    }
  }
  const P=(s,n)=>String(s).padStart(n);
  console.log('\n'+'type'.padEnd(13)+P('✅rge',6)+P('🟠vig',6)+P('∅raté',7)+P('❌faux',7)+P('(nw)',6)+P('traité%',9));
  let TR=0,TT=0;
  for(const ty of Object.keys(agg).sort()){const v=agg[ty];const den=v.red+v.vig+v.miss+v.wrong;const tr=v.red+v.vig;TR+=tr;TT+=den;
    console.log(ty.padEnd(13)+P(v.red,6)+P(v.vig,6)+P(v.miss,7)+P(v.wrong,7)+P(v.nonword,6)+P(Math.round(100*tr/Math.max(1,den))+'%',9));}
  console.log('TOTAL'.padEnd(13)+' traité '+TR+'/'+TT+' = '+Math.round(100*TR/Math.max(1,TT))+'% (hors fautes non attribuables au mot)');
})().catch(e=>console.log('ERR',e.message,e.stack));
