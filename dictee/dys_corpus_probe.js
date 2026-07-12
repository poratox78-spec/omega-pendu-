// dys_corpus_probe.js — BENCHMARK sur du VRAI dys : le correcteur complet (runCorr : ortho→grammaire) sur les
// phrases réelles de Rem (dyslexique). Corpus = data_local/dys_corpus_rem.jsonl (GITIGNORÉ, local, jamais expédié :
// le site est public). Chaque ligne : {raw, fixed, src}. Mesure approximative par ensembles de tokens :
//   caught = faute (token de raw absent de fixed) corrigée vers un token de fixed ; wrong = suggestion absente de fixed
//   (le correcteur DÉGRADE) ; missed = faute sans flag. Sert à suivre le rappel réel + les mauvaises corrections.
// Usage : node dictee/dys_corpus_probe.js   (silencieux si le corpus local est absent — pas un check CI).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CORPUS = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'data_local', 'dys_corpus_rem.jsonl');   // défaut = corpus dys de Rem ; argv = autre corpus (ex. GEC {bad,good})
if (!fs.existsSync(CORPUS)) { console.log('(corpus dys local absent — rien à mesurer)'); process.exit(0); }
const html = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8'); try{globalThis.OMEGA_VDC=require('./blobgz').vdcSeed(html);}catch(e){}   // #30 : seed sync vdc-lex-gz (le moteur peuple les maps grammaire sans async)
const i0 = html.indexOf('mode PHRASES'), start = html.indexOf('(function(){', i0);
const spIdx = html.indexOf('function spellText', start);
const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
const code = html.slice(start, cut) + ';globalThis.__C={corr:correctText,corrTok:correctTokens,toks:toks,setSeg:(s)=>{_SEG=_segInfo(s);},spell:spellText,loadSp:loadSpellerLex,loadNP:loadNounPost,loadG:loadGenderLex,loadH:loadPosHmm,ready:()=>SP.ready};})();';
function blob(id){const m=html.match(new RegExp('id="'+id+'">([\\s\\S]*?)</script>'));return m?m[1]:'';}
const B={'vdc-lex':blob('vdc-lex'),'speller-lex-gz':blob('speller-lex-gz'),'noun-post-gz':blob('noun-post-gz'),'pos-hmm-gz':blob('pos-hmm-gz'),'gdet-lex-gz':blob('gdet-lex-gz')};
const stub=new Proxy(function(){},{get(t,k){if(k==='style')return{};if(k==='classList')return{add(){},remove(){},toggle(){},contains:()=>false};return stub;},set:()=>true,apply:()=>stub});
global.document={getElementById:(id)=>B[id]!==undefined&&B[id]!==''?{textContent:B[id]}:stub,createElement:()=>stub,body:stub,head:stub,addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
global.window=global;global.navigator={userAgent:'node'};global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
(0,eval)(code); const C=globalThis.__C;
const norm=w=>w.toLowerCase().replace(/[^a-zà-ÿ']/gi,'');
function toksN(s){return (s.match(/[A-Za-zÀ-ÿ']+/g)||[]).map(norm).filter(Boolean);}
function runCorrLike(s){const sf=C.ready()?C.spell(s):[];C.setSeg(s);const T=C.toks(s),Tc=T.slice();
  sf.forEach(f=>{const j=f.i;if(f.span!==2&&f.sugg&&f.tier!=='vigilance'&&/^[A-Za-zÀ-ÿ']+$/.test(f.sugg))Tc[j]=f.sugg;});
  const cur=Tc.slice(),gbt={};for(let it=0;it<4;it++){const g2=C.corrTok(cur);let add=false;for(const g of g2){if(gbt[g.i]!=null)continue;gbt[g.i]=g;add=true;if((g.span==null||g.span<2)&&g.tier!=='vigilance'&&g.sugg&&/^[A-Za-zÀ-ÿ']+$/.test(g.sugg))cur[g.i]=g.sugg;}if(!add)break;}const gf=Object.keys(gbt).map(k=>gbt[k]);const fl={};gf.forEach(f=>fl[norm(T[f.i])]=f.sugg);
  sf.forEach(f=>{if(fl[norm(f.word)]==null)fl[norm(f.word)]={sugg:f.sugg,tier:f.tier};});
  const out={};for(const k in fl){const v=fl[k];out[k]=(typeof v==='string')?{sugg:v,tier:'red'}:v;}return out;}
(async()=>{
  await C.loadSp(); if(C.loadNP)await C.loadNP(); if(C.loadG)await C.loadG(); if(C.loadH)await C.loadH();
  const lines=fs.readFileSync(CORPUS,'utf8').split('\n').filter(Boolean).map(l=>{const o=JSON.parse(l);return {raw:o.raw!=null?o.raw:o.bad,fixed:o.fixed!=null?o.fixed:o.good,src:o.src||'gec'};});
  let totErr=0,red=0,vig=0,missed=0,wrong=0;
  for(const {raw,fixed,src} of lines){
    const rt=toksN(raw), ft=new Set(toksN(fixed));
    const errs=rt.filter(w=>!ft.has(w));                 // token de raw absent de fixed = faute (approx)
    const fl=runCorrLike(raw);
    const mrk=[];
    for(const e of errs){ totErr++;
      const f=fl[e];
      // sugg peut être multi-mots (dé-élision « n'sait »→« ne sait ») : correcte si TOUS ses mots sont dans la version corrigée
      const okSugg=f&&String(f.sugg).split(/\s+/).every(x=>!norm(x)||ft.has(norm(x)));
      if(!f){missed++;mrk.push(e+'=∅');}
      else if(f.tier==='vigilance'){vig++;mrk.push(e+'→🟠'+(norm(f.sugg)===e?'(à vérifier)':f.sugg));}   // ORANGE non affirmatif : ne dégrade JAMAIS la copie
      else if(okSugg){red++;mrk.push(e+'→✅'+f.sugg);}   // rouge + bonne sugg = corrigé
      else {wrong++;mrk.push(e+'→❌'+f.sugg);}   // ROUGE + mauvaise sugg = DÉGRADE (le seul vrai danger)
    }
    console.log('['+src+'] '+errs.length+' fautes | '+mrk.join('  '));
  }
  const treated=red+vig;
  console.log('\n=== VRAI DYS (Rem) : '+lines.length+' phrases, '+totErr+' fautes ===');
  console.log('  ✅ corrigé (rouge) : '+red+'   🟠 signalé (vigilance) : '+vig+'   → traité : '+treated+'/'+totErr+' = '+(100*treated/totErr).toFixed(0)+'%');
  console.log('  ∅ raté : '+missed+'   ❌ MAUVAISE correction : '+wrong+' (dégrade la copie)');
})().catch(e=>console.log('ERR',e.message,e.stack));
