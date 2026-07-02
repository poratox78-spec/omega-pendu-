// battery.js — AUDIT de couverture : passe le moteur COMPLET de l'app (speller + grammaire + mover impératif)
// sur TOUS les corpus fournis (data_local/*), par catégorie. Métrique = phrase ENTIÈREMENT corrigée (corrigé==attendu)
// + dégradations (token introduit faux). Révèle d'un coup ce qui est couvert / raté. Local (corpus gitignorés).
// Usage : node dictee/battery.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8');
const i0 = html.indexOf('mode PHRASES'), start = html.indexOf('(function(){', i0);
const spIdx = html.indexOf('function spellText', start);
const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
const code = html.slice(start, cut) + ';globalThis.__C={spell:spellText,gram:correctText,setSeg:function(s){_SEG=_segInfo(s);},loadSp:loadSpellerLex,loadG:loadGenderLex,loadNP:loadNounPost,loadH:loadPosHmm,ready:()=>SP.ready};})();';
function blob(id){const key='id="'+id+'">';const a=html.indexOf(key);if(a<0)return '';const s=a+key.length;const e=html.indexOf('</script>',s);return e<0?'':html.slice(s,e);}
const B={'vdc-lex':blob('vdc-lex'),'speller-lex-gz':blob('speller-lex-gz'),'noun-post-gz':blob('noun-post-gz'),'pos-hmm-gz':blob('pos-hmm-gz'),'gdet-lex-gz':blob('gdet-lex-gz')};
const stub=new Proxy(function(){},{get(t,k){if(k==='style')return{};if(k==='classList')return{add(){},remove(){},toggle(){},contains:()=>false};return stub;},set:()=>true,apply:()=>stub});
global.document={getElementById:(id)=>B[id]!==undefined&&B[id]!==''?{textContent:B[id]}:stub,createElement:()=>stub,body:stub,head:stub,addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
global.window=global;global.navigator={userAgent:'node'};global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
(0,eval)(code); const C=globalThis.__C;
const RE=/[A-Za-zÀ-ÿœŒ']+/g;
function pos(t){const P=[];let m;while((m=RE.exec(t)))P.push([m.index,m.index+m[0].length]);return P;}
const norm=w=>w.toLowerCase().replace(/[^a-zà-ÿœ' -]/gi,'').trim();
function toksN(s){return (s.match(RE)||[]).map(x=>x.toLowerCase()).filter(Boolean);}
function correctAll(text){
  C.setSeg(text); const P=pos(text);
  const sf=C.spell(text), gf=C.gram(text), reps=[];
  gf.forEach(f=>{ if(f.sugg&&P[f.i]) reps.push([P[f.i][0],P[f.i][1],f.sugg,2]); });
  sf.forEach(f=>{ if(f.tier==='vigilance')return; const sp=f.span||1; if(!P[f.i]||!P[f.i+sp-1])return; if(f.sugg) reps.push([P[f.i][0],P[f.i+sp-1][1],f.sugg, f.name==='impératif (pronom)'?3:1]); });
  reps.sort((a,b)=> a[0]-b[0] || b[3]-a[3]);
  const chosen=[]; let last=-1;
  for(const r of reps){ if(r[0]>=last){ chosen.push(r); last=r[1]; } }
  chosen.sort((a,b)=>b[0]-a[0]);
  let t=text; for(const r of chosen) t=t.slice(0,r[0])+r[2]+t.slice(r[1]);
  return t;
}
function eqTokens(a,b){const A=toksN(a),Bb=toksN(b);if(A.length!==Bb.length)return false;for(let i=0;i<A.length;i++)if(norm(A[i])!==norm(Bb[i]))return false;return true;}
const CORPORA=[
  ['dys_corpus_rem.jsonl','src'],['corpus_gec_fr.jsonl','src'],['corpus_gec100.jsonl','src'],
  ['corpus_multi1000.jsonl',null],['corpus_er_e_ez_ai.jsonl','src'],['corpus_imperatif.jsonl','src']
];
(async()=>{
  await C.loadSp(); await C.loadG(); await C.loadNP(); await C.loadH();
  console.log('MOTEUR COMPLET (speller+grammaire+mover) — phrase ENTIÈREMENT corrigée par corpus/catégorie\n');
  let gTot=0,gFix=0,gDeg=0;
  for(const [file,catKey] of CORPORA){
    const p=path.join(ROOT,'data_local',file); if(!fs.existsSync(p)){console.log(file,'(absent)');continue;}
    const rows=fs.readFileSync(p,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
    const cat={};
    for(const o of rows){
      const bad=o.bad!=null?o.bad:o.raw, good=o.good!=null?o.good:o.fixed; if(bad==null||good==null)continue;
      const c=catKey&&o[catKey]?o[catKey]:'(tout)';
      cat[c]=cat[c]||{n:0,fix:0,deg:0};
      const got=correctAll(bad), fixed=eqTokens(got,good);
      cat[c].n++; if(fixed)cat[c].fix++;
      if(!fixed){const gs=new Set(toksN(good)),bs=new Set(toksN(bad));if(toksN(got).some(t=>!gs.has(t)&&!bs.has(t)))cat[c].deg++;}
      gTot++; if(fixed)gFix++;
    }
    let ct=0,cf=0,cd=0; const lines=[];
    for(const c of Object.keys(cat).sort()){const v=cat[c];ct+=v.n;cf+=v.fix;cd+=v.deg;lines.push('    '+c.padEnd(22)+' '+String(v.fix).padStart(4)+'/'+String(v.n).padEnd(4)+' ('+Math.round(100*v.fix/v.n)+'%)'+(v.deg?'  ⚠dégrade '+v.deg:''));}
    console.log('══ '+file+' : '+cf+'/'+ct+' ('+Math.round(100*cf/ct)+'%) entièrement corrigées'+(cd?'  ⚠'+cd+' dégradées':''));
    lines.forEach(l=>console.log(l)); console.log(''); gDeg+=cd;
  }
  console.log('═══ GLOBAL : '+gFix+'/'+gTot+' ('+Math.round(100*gFix/gTot)+'%) phrases entièrement corrigées, '+gDeg+' dégradées ═══');
})().catch(e=>console.log('ERR',e.message,e.stack));
