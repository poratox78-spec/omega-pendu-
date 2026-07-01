// messy_probe.js — BENCHMARK RÉEL : le correcteur COMPLET (grammaire correctText + orthographe spellText, comme runCorr
// sur le site) sur des phrases dys MULTI-FAUTES réalistes (le vrai cas d'usage, pas l'injection 1-faute dans du propre).
// Mesure : fautes attrapées / fautes attendues, + FP (corrections sur des mots corrects). Baseline pour la refonte pyramidale.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8');

// --- extraire l'IIFE dictée jusqu'à spellText (inclut correctText + posTags + spellText) ---
const i0 = html.indexOf('mode PHRASES'), start = html.indexOf('(function(){', i0);
const spIdx = html.indexOf('function spellText', start);
const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
const code = html.slice(start, cut) + ';globalThis.__C={corr:correctText,spell:spellText,loadSp:loadSpellerLex,loadNP:loadNounPost,loadG:loadGenderLex,loadH:loadPosHmm,ready:()=>SP.ready};})();';

function blob(id) { const m = html.match(new RegExp('id="' + id + '">([\\s\\S]*?)</script>')); return m ? m[1] : ''; }
const B = { 'vdc-lex': blob('vdc-lex'), 'speller-lex-gz': blob('speller-lex-gz'), 'noun-post-gz': blob('noun-post-gz'),
            'pos-hmm-gz': blob('pos-hmm-gz'), 'gdet-lex-gz': blob('gdet-lex-gz') };
const stub = new Proxy(function(){}, { get(t,k){ if(k==='style')return{}; if(k==='classList')return{add(){},remove(){},toggle(){},contains:()=>false}; return stub; }, set:()=>true, apply:()=>stub });
global.document = { getElementById:(id)=> B[id]!==undefined && B[id]!=='' ? {textContent:B[id]} : stub, createElement:()=>stub, body:stub, head:stub, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] };
global.window = global; global.navigator = { userAgent:'node' }; global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
(0, eval)(code);
const C = globalThis.__C;

// corpus messy : phrase, [ (mot_fautif, correction_attendue) ... ]  (les fautes qu'un bon correcteur DOIT viser)
const CORPUS = [
  ["je sui allez à la plage pour sa j'est pri le train", [['sui','suis'],['allez','allé'],['sa','ça'],["j'est","j'ai"],['pri','pris']]],
  ["ma sœur ce lave les main puis elle mange sont repas", [['ce','se'],['main','mains'],['sont','son']]],
  ["je pense que se livre et tres interessant", [['se','ce'],['et','est'],['interessant','intéressant']]],
  ["quand il pleu les gens reste chez eux", [['pleu','pleut'],['reste','restent']]],
  ["les enfant von a l ecole et il son content", [['enfant','enfants'],['von','vont'],['a','à'],['son','sont']]],
  ["elle a manger une pomme et bu du lait", [['manger','mangé']]],
  ["nous somme aller au marché se matin", [['somme','sommes'],['aller','allés'],['se','ce']]],
  ["il faut que tu vien avec moi demain matin", [['vien','viennes']]],
];

const norm = w => w.toLowerCase().replace(/[^a-zà-ÿ']/gi, '');
function applyFlags(s, flags) {   // remplace chaque mot fautif par sa suggestion (pour la couche suivante)
  return s.replace(/[A-Za-zÀ-ÿ']+/g, w => (flags[norm(w)] && /^[a-zà-ÿ']+$/i.test(flags[norm(w)])) ? flags[norm(w)] : w);
}
function flatCorr(s) {   // ACTUEL (plat) : grammaire ∥ orthographe sur le même texte
  const gf = C.corr(s), sf = C.ready() ? C.spell(s) : [];
  const fl = {}; gf.forEach(f => fl[norm(f.word)] = f.sugg); sf.forEach(f => { if (!fl[norm(f.word)]) fl[norm(f.word)] = f.sugg; });
  return fl;
}
function pyramidCorr(s) {   // PYRAMIDE : orthographe → applique → grammaire sur le nettoyé → itère (2 passes)
  const fl = {};
  let cur = s;
  for (let pass = 0; pass < 3; pass++) {
    const sf = C.ready() ? C.spell(cur) : [];
    sf.forEach(f => { if (!fl[norm(f.word)]) fl[norm(f.word)] = f.sugg; });
    const cleaned = applyFlags(cur, fl);
    const gf = C.corr(cleaned);
    let changed = false;
    gf.forEach(f => { if (!fl[norm(f.word)]) { fl[norm(f.word)] = f.sugg; changed = true; } });
    if (cleaned === cur && !changed) break;
    cur = cleaned;
  }
  return fl;
}
function score(mode, fn) {
  let expTot = 0, caught = 0;
  for (const [s, exp] of CORPUS) {
    const flags = fn(s);
    const hits = exp.filter(([bad, good]) => flags[norm(bad)] && norm(flags[norm(bad)]) === norm(good));
    expTot += exp.length; caught += hits.length;
  }
  console.log(mode + " : " + caught + "/" + expTot + " = " + (100*caught/expTot).toFixed(0) + "%");
  return caught;
}
(async () => {
  await C.loadSp(); if (C.loadNP) await C.loadNP(); if (C.loadG) await C.loadG(); if (C.loadH) await C.loadH();
  console.log('speller ready =', C.ready(), '\n');
  score('FLAT (actuel)   ', flatCorr);
  score('PYRAMIDE (ortho→gram→itère)', pyramidCorr);
})().catch(e => console.log('ERR', e.message, e.stack));
