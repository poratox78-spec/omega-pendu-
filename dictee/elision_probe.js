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
const code = html.slice(start, cut) + ';globalThis.__C={spell:spellText,gram:correctText,setSeg:function(s){_SEG=_segInfo(s);},loadSp:loadSpellerLex,loadG:loadGenderLex,loadNP:loadNounPost,loadH:loadPosHmm,ready:()=>SP.ready,gender:function(w){return GENDER_PURE[deacc(w.toLowerCase())]||null;}};})();';
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

// elision_probe.js — TEST DIFFERENTIEL DE L'ELISION.
//
// POURQUOI. « L'equipe » est UN SEUL token : le determinant y est COLLE, donc invisible pour toute regle
// qui regarde ses voisins. Ce trou a ete trouve et rebouche TROIS fois separement dans la meme session
// (on/ont, mai/mais, _npSubject) -- a chaque fois dans UNE regle. Audit : 47 regles lisent un voisin,
// 21 ne gerent pas du tout l'apostrophe, et 16 % du residuel des corpus a un token elide au contact de
// la faute. Reparer regle par regle est sans fin.
//
// LE TEST. Pour chaque phrase, on fabrique la variante NON ELIDEE (« l'equipe » -> « la equipe ») et on
// compare la DECISION du moteur sur les deux. Le determinant est le meme, le nombre est le meme :
// une regle correcte doit decider PAREIL. Toute divergence est un angle mort d'elision, et elle est
// nommee par sa REGLE -- donc directement actionnable.
//
//   node dictee/elision_probe.js              liste les regles aveugles
//   node dictee/elision_probe.js --check      echoue si le compte depasse le plafond (garde CI)
const path2 = require('path');
const CEILING = Number(process.env.CEILING || 3);   // etat mesure au 2026-07-21 : 3 angles morts (41 avant les primitives d'elision). Ce plafond ne doit que BAISSER.
const RE3 = /[A-Za-zÀ-ÿœŒ'’ʼ]+/g;

(async () => {
  await C.loadSp(); await C.loadG(); await C.loadNP(); await C.loadH();
  const conllu = path2.join(ROOT, 'data_local', 'ud_fr_gsd-train.conllu');
  let sents = [];
  if (fs.existsSync(conllu))
    sents = fs.readFileSync(conllu, 'utf8').split(String.fromCharCode(10))
      .filter(l => l.startsWith('# text = ')).map(l => l.slice(9).trim()).filter(Boolean);
  for (const f of ['corpus_multi1000.jsonl', 'corpus_gec_fr.jsonl', 'corpus_gec100.jsonl']) {
    const p = path2.join(ROOT, 'data_local', f); if (!fs.existsSync(p)) continue;
    for (const l of fs.readFileSync(p, 'utf8').split(String.fromCharCode(10)).filter(Boolean)) {
      const o = JSON.parse(l); const b = o.bad != null ? o.bad : o.raw; if (b) sents.push(b);
    }
  }
  // « l'X » -> « cet X » / « cette X ». PAS « le/la X » : en francais l'elision est OBLIGATOIRE devant
  // voyelle, donc « la ouverture » n'existe pas -- on comparerait une phrase valide a une phrase FAUSSE
  // et la divergence ne dirait plus rien. « cet/cette » est un determinant SEPARE et GRAMMATICAL devant
  // voyelle, de meme nombre : c'est le bon temoin. On saute « l' » devant CONSONNE (« L'preparation »),
  // qui est une faute d'elision inversee traitee par sa propre regle.
  const VOW = 'aeiouyaaaeeeeiioouuuh';
  const unglue = s => s.replace(/([lL])['’](\p{L}+)/gu, (m, l, w) => {
    const w0 = w[0].toLowerCase().normalize('NFD')[0];
    if (!VOW.includes(w0)) return m;
    const g = C.gender ? C.gender(w) : null; if (g !== 'm' && g !== 'f') return m;
    const d = (g === 'f' ? 'cette' : 'cet'); return (l === 'L' ? d[0].toUpperCase() + d.slice(1) : d) + ' ' + w;
  });
  // Le temoin « cet X » remplace UN token par DEUX : tous les index GLISSENT apres chaque remplacement,
  // et les gardes de distance ("sujet trop loin de l'aux") divergent alors LEGITIMEMENT. On compare donc
  // sur des index REMAPPES vers la phrase d'origine, sinon on compte des artefacts de la sonde comme
  // des angles morts du moteur.
  const RTOK = /[A-Za-zÀ-ÿœŒ'’ʼ]+/g;
  const cuts = s => { const t = s.match(RTOK) || []; const c = [];
    t.forEach((w, k) => { if (/^[lL]['’]./.test(w) && unglue(w) !== w) c.push(k); }); return c; };
  const remap = (idx, c) => { let d = 0; for (const k of c) if (idx > k + d) d++; return idx - d; };
  const key = (fl, c) => fl.map(f => remap(f.i, c || []) + ':' + f.name + '>' + f.sugg).sort().join('|');
  const by = {}; let n = 0, tested = 0;
  for (const s of sents) {
    if (!/['’]/.test(s)) continue;
    const u = unglue(s); if (u === s) continue;
    tested++;
    const cc = cuts(s);
    C.setSeg(s); const a = C.gram(s);
    C.setSeg(u); const b = C.gram(u);
    if (key(a, []) === key(b, cc)) continue;
    let vu = false;
    const na = new Set(a.map(f => f.name)), nb = new Set(b.map(f => f.name));
    // Regles dont le DECLENCHEUR EST l'elision : « des l'X »->des accentue n'a pas d'equivalent
    // non elide (« des cette X » n'existe pas). Leur divergence est ATTENDUE, pas un angle mort.
    const PAR_DESIGN = { 'des/dès': 1, 'élision inversée': 1, 'élision': 1 };
    for (const r of new Set([...na, ...nb])) if (!(na.has(r) && nb.has(r)) && !PAR_DESIGN[r]) {
      by[r] = by[r] || { n: 0, ex: null };
      by[r].n++; vu = true; if (!by[r].ex) by[r].ex = s.slice(0, 92);
      if (process.env.RULE === r && by[r].n <= 8) {
        const fa = a.filter(f => f.name === r).map(f => f.word + '>' + f.sugg).join(',') || '(rien)';
        const fb = b.filter(f => f.name === r).map(f => f.word + '>' + f.sugg).join(',') || '(rien)';
        console.log('    elide: ' + fa + '  ||  non-elide: ' + fb);
        console.log('      ' + s.slice(0, 108)); }
    }
    if (vu) n++;
  }
  console.log('=== ELISION : test differentiel (l’X vs cet/cette X) ===');
  console.log('  phrases testables : ' + tested + '  |  decisions DIVERGENTES : ' + n);
  const L = Object.entries(by).sort((x, y) => y[1].n - x[1].n);
  for (const [r, v] of L) { console.log('    ' + String(v.n).padStart(4) + '  ' + r); console.log('           ' + v.ex); }
  if (process.argv.includes('--check')) {
    if (n > CEILING) { console.error('✗ ELISION : ' + n + ' divergences > plafond ' + CEILING); process.exit(1); }
    console.log('✓ elision : ' + n + ' ≤ ' + CEILING);
  }
})();
