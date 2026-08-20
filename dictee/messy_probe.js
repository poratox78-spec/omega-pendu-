// messy_probe.js — BENCHMARK RÉEL : le correcteur COMPLET (grammaire correctText + orthographe spellText, comme runCorr
// sur le site) sur des phrases dys MULTI-FAUTES réalistes (le vrai cas d'usage, pas l'injection 1-faute dans du propre).
// Mesure : fautes attrapées / fautes attendues, + FP (corrections sur des mots corrects). Baseline pour la refonte pyramidale.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8'); try{globalThis.OMEGA_VDC=require('./blobgz').vdcSeed(html);}catch(e){}   // #30 : seed sync vdc-lex-gz (le moteur peuple les maps grammaire sans async)

// --- extraire l'IIFE dictée jusqu'à spellText (inclut correctText + posTags + spellText) ---
const i0 = html.indexOf('mode PHRASES'), start = html.indexOf('(function(){', i0);
const spIdx = html.indexOf('function spellText', start);
const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
const code = html.slice(start, cut) + ';globalThis.__C={corr:correctText,corrTok:correctTokens,toks:toks,segInfo:_segInfo,setSeg:(s)=>{_SEG=_segInfo(s);},spell:spellText,loadSp:loadSpellerLex,loadNP:loadNounPost,loadG:loadGenderLex,loadH:loadPosHmm,ready:()=>SP.ready};})();';

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
function runCorrLike(s) {   // mime le NOUVEAU runCorr : ortho → applique 1:1 → grammaire sur tokens nettoyés
  const sf = C.ready() ? C.spell(s) : [];
  C.setSeg(s); const T = C.toks(s), Tc = T.slice();
  sf.forEach(f => { const j = f.i; if (f.span !== 2 && f.tier !== 'vigilance' && f.sugg && /^[A-Za-zÀ-ÿ']+$/.test(f.sugg)) Tc[j] = f.sugg; });   // fidélité _computeCorrs (site) : la VIGILANCE n'est JAMAIS appliquée — l'appliquer ici faisait diverger le banc du pipeline réel (leçon PR#471)
  // CASCADE (miroir de _computeCorrs) : re-tourner la grammaire sur ses PROPRES corrections jusqu'à point fixe (propage le ROUGE span1)
  const cur = Tc.slice(), gbt = {};
  for (let it = 0; it < 4; it++) { const g2 = C.corrTok(cur); let add = false;
    for (const g of g2) { if (gbt[g.i] != null) continue; gbt[g.i] = g; add = true;
      if ((g.span == null || g.span < 2) && g.tier !== 'vigilance' && g.sugg && /^[A-Za-zÀ-ÿ']+$/.test(g.sugg)) cur[g.i] = g.sugg; }
    if (!add) break; }
  const gf = Object.keys(gbt).map(k => gbt[k]);
  const fl = {}; gf.forEach(f => fl[norm(T[f.i])] = f.sugg); sf.forEach(f => { if (!fl[norm(f.word)]) fl[norm(f.word)] = f.sugg; });
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
// corpus CORRECT (phrases justes, dont mots courts/valides pièges) — le correcteur ne doit RIEN flaguer (FP=0)
const CORRECT = [
  "je suis allé à la plage pour ça, j'ai pris le train en marche.",
  "un élève travaille dans la classe et ses amis lisent un livre.",
  "il pleut souvent en automne mais le soleil revient vite.",
  "elle a pris son sac puis elle est partie très tôt ce matin.",
  "les fleurs sont belles et le chat dort sur le canapé.",
  "nous avons vu un film et bu un café après le repas.",
  "ce livre raconte une belle histoire que j'ai beaucoup aimée.",
  "le prix du pain a augmenté mais la qualité reste bonne.",
  "mon frère et ma sœur vont au marché tous les samedis.",
  "quand il fait beau, on va se promener dans le parc.",
];
// MAUVAISES CORRECTIONS : sur une phrase fautive, un flag sur un mot-faute connu dont la suggestion ≠ gold =
// correction FAUSSE qui DÉGRADE la copie (ex. « von »→« vos » au lieu de « vont »). C'est le risque le + nuisible
// pour un dys, et il n'était gardé par AUCUN test (audit structurel, axe 4). On le mesure et on le plafonne.
function wrongCount(fn) {
  let wrong = 0; const ex = [];
  for (const [s, exp] of CORPUS) {
    const fl = fn(s), goldOf = {}; exp.forEach(([b, g]) => goldOf[norm(b)] = norm(g));
    for (const k in fl) if (goldOf[k] !== undefined && norm(fl[k]) !== goldOf[k]) { wrong++; ex.push(k + '→' + fl[k] + ' (gold ' + goldOf[k] + ')'); }
  }
  return { wrong, ex };
}
const RECALL_FLOOR = 45, FP_MAX = 0, WRONG_MAX = 3;   // planchers/plafonds CI (marge sous le mesuré ; resserrer avec les gains) — 45 après la CASCADE (mesuré 50%)
(async () => {
  await C.loadSp(); if (C.loadNP) await C.loadNP(); if (C.loadG) await C.loadG(); if (C.loadH) await C.loadH();
  const check = process.argv.includes('--check');
  if (!check) console.log('speller ready =', C.ready(), '\n');
  if (!check) { score('FLAT (ancien)   ', flatCorr); score('PYRAMIDE (itère)', pyramidCorr); }
  let expTot = 0; for (const [, e] of CORPUS) expTot += e.length;
  const caught = score('runCorr RÉEL (1 passe ortho→gram)', runCorrLike);
  const recall = 100 * caught / expTot;
  let fp = 0; const fpEx = [];
  for (const s of CORRECT) { const fl = runCorrLike(s), ks = Object.keys(fl); if (ks.length) { fp += ks.length; fpEx.push('« ' + s.slice(0,40) + '… » → ' + ks.map(k=>k+'→'+fl[k]).join(', ')); } }
  const { wrong, ex } = wrongCount(runCorrLike);
  console.log("\nFP sur corpus CORRECT (" + CORRECT.length + " ph) : " + fp); fpEx.forEach(e => console.log('  FP: ' + e));
  console.log("Mauvaises corrections (mot-faute → ≠ gold) : " + wrong); ex.forEach(e => console.log('  WRONG: ' + e));
  if (check) {
    const fail = [];
    if (recall < RECALL_FLOOR) fail.push("rappel " + recall.toFixed(0) + "% < plancher " + RECALL_FLOOR + "%");
    if (fp > FP_MAX) fail.push("FP " + fp + " > " + FP_MAX + " sur corpus correct");
    if (wrong > WRONG_MAX) fail.push("mauvaises corrections " + wrong + " > " + WRONG_MAX);
    if (fail.length) { console.error("\n✗ messy_probe : " + fail.join(" ; ")); process.exit(1); }
    console.log("\n✓ messy_probe : rappel " + recall.toFixed(0) + "% ≥ " + RECALL_FLOOR + "%, FP=" + fp + ", mauvaises corr.=" + wrong + " ≤ " + WRONG_MAX);
  }
})().catch(e => { console.log('ERR', e.message, e.stack); process.exit(1); });
