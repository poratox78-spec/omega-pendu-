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
// fp_scale_full.js — FP de la GRAMMAIRE a la PLUS GRANDE echelle disponible : les 14 450 phrases du
// UD French-GSD train, lues directement du .conllu. C'est 5,8x le corpus de fp_scale_probe.py (2 500).
// POURQUOI : une regle peut afficher FP=0 sur 2 500 phrases simplement parce que son mot-cible n'y
// apparait presque pas. « mai » : 15 occurrences dans les 2 500, 103 dans les 14 450 — et trois
// variantes qui semblaient propres a 2 500 se sont revelees fausses a 14 450.
//   node dictee/fp_scale_full.js            (RULE=mai/mais pour isoler une regle)
// Corpus local (data_local/ud_fr_gsd-train.conllu, gitignore).
const path2 = require('path');
(async () => {
  await C.loadSp(); await C.loadG(); await C.loadNP(); await C.loadH();
  const conllu = path2.join(ROOT, 'data_local', 'ud_fr_gsd-train.conllu');
  if (!fs.existsSync(conllu)) { console.log('(corpus UD absent — sonde ignoree)'); return; }
  const sents = fs.readFileSync(conllu, 'utf8').split(String.fromCharCode(10))
    .filter(l => l.startsWith('# text = ')).map(l => l.slice(9).trim()).filter(Boolean);
  const only = process.env.RULE || null;
  let tot = 0; const by = {};
  for (const s of sents) { C.setSeg(s);
    for (const f of C.gram(s)) { if (only && f.name !== only) continue;
      tot++; by[f.name] = (by[f.name] || 0) + 1; } }
  console.log('=== FP GRAMMAIRE a l echelle — ' + sents.length + ' phrases UD French-GSD (train) ===');
  console.log('  flags sur du texte CORRECT : ' + tot + '  (' + (100 * tot / sents.length).toFixed(2) + '% des phrases)');
  for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1]))
    console.log('    ' + String(v).padStart(5) + '  ' + k);
})();
