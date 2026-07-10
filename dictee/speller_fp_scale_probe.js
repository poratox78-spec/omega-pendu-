// speller_fp_scale_probe.js — BANC FP À L'ÉCHELLE POUR LE SPELLER (couche orthographe de l'app).
// `fp_scale_probe.py` mesure les FP de la GRAMMAIRE (règles d'accord/homophone) ; celui-ci mesure les FP du
// SPELLER (spellText → spellToken : accents, non-mots, élision, vigilance) sur 2500 phrases FR globalement
// CORRECTES (UD French-GSD, dictee/fp_scale_corpus.txt). Sur du texte juste, tout flag AFFIRMATIF (tier auto/flag)
// est une fausse alerte du speller — c'est le taux à surveiller AVANT toute modif du classement d'accents
// (doctrine FP=0 / mesure). Les flags VIGILANCE (orange) ne dégradent pas la copie → comptés à part.
// ⚠️ Le corpus UD n'est pas parfait (quelques variantes d'accent/normalisation) → certains « flags » sont de
//    VRAIES prises, pas des FP ; on inspecte la liste. Pour la RÉGRESSION, c'est le DELTA avant/après qui compte.
// Usage : node dictee/speller_fp_scale_probe.js  [--check]   (--check : garde CI, casse si ortho affirmatif > seuil)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CORPUS = path.join(ROOT, 'dictee', 'fp_scale_corpus.txt');
const html = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8');
const i0 = html.indexOf('mode PHRASES'), start = html.indexOf('(function(){', i0);
const spIdx = html.indexOf('function spellText', start);
const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
const code = html.slice(start, cut) + ';globalThis.__C={spell:spellText,toks:toks,setSeg:(s)=>{_SEG=_segInfo(s);},loadSp:loadSpellerLex,loadNP:loadNounPost,loadG:loadGenderLex,loadH:loadPosHmm,ready:()=>SP.ready};})();';
function blob(id){const m=html.match(new RegExp('id="'+id+'">([\\s\\S]*?)</script>'));return m?m[1]:'';}
const B={'vdc-lex':blob('vdc-lex'),'speller-lex-gz':blob('speller-lex-gz'),'noun-post-gz':blob('noun-post-gz'),'pos-hmm-gz':blob('pos-hmm-gz'),'gdet-lex-gz':blob('gdet-lex-gz')};
const stub=new Proxy(function(){},{get(t,k){if(k==='style')return{};if(k==='classList')return{add(){},remove(){},toggle(){},contains:()=>false};return stub;},set:()=>true,apply:()=>stub});
global.document={getElementById:(id)=>B[id]!==undefined&&B[id]!==''?{textContent:B[id]}:stub,createElement:()=>stub,body:stub,head:stub,addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
global.window=global;global.navigator={userAgent:'node'};global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
(0,eval)(code); const C=globalThis.__C;
const CHECK = process.argv.includes('--check');
const RED_ORTHO_MAX = 48;   // BASELINE 2026-07-10 : 45 (après élision #107 + liste blanche #112) → 48 (+3 LÉGITIMES = ligature œ « oeuvre→œuvre »/« voeux→vœux »/« l'Oeuf→l'œuf » du corpus, PR œ-genre). Reste ~21 FP résiduels (étranger the/dirección + coupes trait d'union anglo/1er, laissés sciemment). GARDE ANTI-RÉGRESSION : toute HAUSSE = nouveau FP speller à inspecter (baisser quand on en tue).
(async()=>{
  await C.loadSp(); if(C.loadNP)await C.loadNP(); if(C.loadG)await C.loadG(); if(C.loadH)await C.loadH();
  if(!C.ready()){ console.log('speller non chargé — abandon'); process.exit(2); }
  const lines = fs.readFileSync(CORPUS,'utf8').split('\n').map(s=>s.replace(/\r$/,'')).filter(s=>s.trim());
  let toks=0; const byTier={}, byName={}, red=[], vig=[];
  for(const s of lines){
    toks += (C.toks(s)||[]).length;
    let sf; try{ sf=C.spell(s)||[]; }catch(e){ continue; }
    for(const f of sf){
      const tier=f.tier||'red', name=f.name||'?';
      byTier[tier]=(byTier[tier]||0)+1; byName[name]=(byName[name]||0)+1;
      const rec={word:f.word,sugg:f.sugg,name:name,tier:tier,ctx:s.slice(0,70)};
      (tier==='vigilance'?vig:red).push(rec);   // red = auto/flag = AFFIRMATIF (le FP=0 cardinal) ; vigilance = orange
    }
  }
  const orthoRed = red.filter(f=>f.name==='orthographe');
  console.log('=== Banc FP SPELLER — '+lines.length+' phrases FR (UD French-GSD), '+toks+' tokens ===');
  console.log('  AFFIRMATIF (auto/flag, FP=0 cardinal) : '+red.length+'  ('+(100*red.length/toks).toFixed(3)+'% des tokens)');
  console.log('    dont ORTHOGRAPHE (spellToken, accent-critique) : '+orthoRed.length);
  console.log('  VIGILANCE (orange, non dégradant)     : '+vig.length+'  ('+(100*vig.length/toks).toFixed(3)+'%)');
  console.log('  par tier : '+JSON.stringify(byTier));
  console.log('  par type : '+JSON.stringify(byName));
  if(orthoRed.length){
    console.log('  --- ortho AFFIRMATIFS (à inspecter : vrai flag vs FP) ---');
    orthoRed.slice(0,40).forEach(f=>console.log('    '+f.word+'→'+f.sugg+' ['+f.tier+']  « '+f.ctx+' »'));
    if(orthoRed.length>40) console.log('    … +'+(orthoRed.length-40)+' autres');
  }
  const vigOrtho = vig.filter(f=>f.name==='orthographe');
  if(vigOrtho.length){
    console.log('  --- ortho VIGILANCE (orange, échantillon) ---');
    vigOrtho.slice(0,30).forEach(f=>console.log('    '+f.word+'→'+f.sugg+'  « '+f.ctx+' »'));
    if(vigOrtho.length>30) console.log('    … +'+(vigOrtho.length-30)+' autres');
  }
  if(CHECK){
    if(orthoRed.length > RED_ORTHO_MAX){ console.log('✗ ortho affirmatif '+orthoRed.length+' > seuil '+RED_ORTHO_MAX); process.exit(1); }
    console.log('✓ ortho affirmatif '+orthoRed.length+' ≤ seuil '+RED_ORTHO_MAX);
  }
})().catch(e=>{ console.log('ERR', e.message, e.stack); process.exit(2); });
