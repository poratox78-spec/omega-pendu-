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

(async () => {
  await C.loadSp(); if (C.loadNP) await C.loadNP(); if (C.loadG) await C.loadG(); if (C.loadH) await C.loadH();
  console.log('speller ready =', C.ready());
  const norm = w => w.toLowerCase().replace(/[^a-zà-ÿ']/gi, '');
  let expTot = 0, caught = 0, fp = 0;
  for (const [s, exp] of CORPUS) {
    const gf = C.corr(s), sf = C.ready() ? C.spell(s) : [];
    const flags = {}; gf.forEach(f => flags[norm(f.word)] = f.sugg); sf.forEach(f => { if (!flags[norm(f.word)]) flags[norm(f.word)] = f.sugg; });
    const expSet = new Set(exp.map(e => norm(e[0])));
    const hits = exp.filter(([bad, good]) => flags[norm(bad)] && norm(flags[norm(bad)]) === norm(good));
    const got = Object.keys(flags);
    const falsePos = got.filter(w => !expSet.has(w));   // corrections sur des mots hors de la liste attendue (approx FP)
    expTot += exp.length; caught += hits.length; fp += falsePos.length;
    console.log("\n« " + s + " »");
    console.log("  attrapé " + hits.length + "/" + exp.length + " : " + (hits.map(h=>h[0]+'→'+flags[norm(h[0])]).join(', ') || '—'));
    const missed = exp.filter(([bad]) => !flags[norm(bad)] || norm(flags[norm(bad)]) !== norm(exp.find(e=>e[0]===bad)[1]));
    if (missed.length) console.log("  RATÉ : " + missed.map(m=>m[0]+'→'+m[1]).join(', '));
    if (falsePos.length) console.log("  FP?  : " + falsePos.map(w=>w+'→'+flags[w]).join(', '));
  }
  console.log("\n=== BASELINE : " + caught + "/" + expTot + " fautes attrapées (" + (100*caught/expTot).toFixed(0) + "%), " + fp + " corrections hors-liste ===");
})().catch(e => console.log('ERR', e.message, e.stack));
