// (entete moteur repris de battery.js) : passe le moteur COMPLET de l'app (speller + grammaire + mover impératif)
// sur TOUS les corpus fournis (data_local/*), par catégorie. Métrique = phrase ENTIÈREMENT corrigée (corrigé==attendu)
// + dégradations (token introduit faux). Révèle d'un coup ce qui est couvert / raté. Local (corpus gitignorés).
// Usage : node dictee/battery.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8'); try{globalThis.OMEGA_VDC=require('./blobgz').vdcSeed(html);}catch(e){}   // #30 : seed sync vdc-lex-gz (le moteur peuple les maps grammaire sans async)
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
const RE=/[A-Za-zÀ-ÿœŒ'’ʼ]+/g;
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
// residual_audit.js — AUDIT DES RESIDUS : ce que le moteur COMPLET rate ou corrige MAL, groupe par famille.
// Complement de battery.js : la batterie donne un TAUX, celui-ci donne la LISTE des familles a attaquer,
// triee par frequence. C'est lui qui a exhibe « ont -> on (gold a) » 40 fois — un francais impossible que
// l'agregat de la batterie noyait dans « 91 degradees ».
//   node dictee/residual_audit.js
// Corpus locaux (data_local/, gitignores) ; sortie : RATES (silence) puis MAL CORRIGES (erreur active).
const path2=require('path');
const RE2=/[A-Za-zÀ-ÿœŒ'’ʼ]+/g, tk=s=>(s.match(RE2)||[]).map(x=>x.toLowerCase());
(async()=>{ await C.loadSp(); await C.loadG(); await C.loadNP(); await C.loadH();
  const RATE={}, MAL={}, CASSE={};
  for(const f of ['dys_corpus_rem.jsonl','corpus_gec_fr.jsonl','corpus_gec100.jsonl','corpus_multi1000.jsonl']){
    const p=path2.join(ROOT,'data_local',f); if(!fs.existsSync(p))continue;
    for(const l of fs.readFileSync(p,'utf8').split('\n').filter(Boolean)){
      const o=JSON.parse(l); const bad=o.bad!=null?o.bad:o.raw, good=o.good!=null?o.good:o.fixed;
      if(bad==null||good==null)continue;
      const B=tk(bad),G=tk(good),O=tk(correctAll(bad));
      if(B.length!==G.length||O.length!==G.length)continue;      // alignement 1-1 seulement
      for(let i=0;i<G.length;i++){
        if(B[i]===G[i]){                                          // le token etait CORRECT dans la saisie...
          if(O[i]!==G[i]){const ck=B[i]+' -> '+O[i];CASSE[ck]=(CASSE[ck]||0)+1;}   // ...et le moteur l'a CASSE. Angle mort de la v1 : elle n'examinait que les tokens deja FAUTIFS, donc une correction qui detruit du correct AU MILIEU d'une phrase fautive restait invisible — et fp_scale_probe ne la voit pas non plus, il ne tourne que sur du texte 100 % correct. C'est exactement la zone ou vit le texte d'un dys.
          continue;}
        if(O[i]===G[i])continue;                                  // corrigee
        const k=B[i]+' → '+G[i];
        if(O[i]===B[i])RATE[k]=(RATE[k]||0)+1; else MAL[B[i]+' → '+O[i]+' (gold '+G[i]+')']=(MAL[B[i]+' → '+O[i]+' (gold '+G[i]+')']||0)+1;
      }
    }
  }
  const srt=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
  const tot=o=>Object.values(o).reduce((a,b)=>a+b,0);
  console.log('=== RATES (le moteur se TAIT) : '+tot(RATE)+' occurrences, '+Object.keys(RATE).length+' types ===');
  for(const [k,n] of srt(RATE).slice(0,45))console.log('  '+String(n).padStart(4)+'  '+k);
  console.log('\n=== MAL CORRIGES (le moteur se TROMPE) : '+tot(MAL)+' occurrences ===');
  for(const [k,n] of srt(MAL).slice(0,25))console.log('  '+String(n).padStart(4)+'  '+k);
  console.log('\n=== CASSES (le token etait CORRECT, le moteur l a detruit) : '+tot(CASSE)+' occurrences ===');
  for(const [k,n] of srt(CASSE).slice(0,25))console.log('  '+String(n).padStart(4)+'  '+k);
})();
