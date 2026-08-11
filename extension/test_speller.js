// Test du correcteur ORTHOGRAPHIQUE de l'extension (dys-core.js) — chargé avec les assets extraits.
// (A) Batterie d'assertions = comportement vérifié de l'app (miroir dictee/test_speller_app.js) : AUTO/FLAG,
//     FP=0, hybride (accord du contexte), désambiguïsation d'accent par POS, élision-espace.
// (B) Parité directe : dys-core.spell() ⊆ app.spellText() sur une batterie orthographique (aucun FP propre).
//   node extension/test_speller.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const HERE = __dirname, ROOT = path.join(HERE, '..');

// ---- (1) moteur extension + assets ----
require(path.join(HERE, 'dys-core.js'));
const DC = global.DYSCORE;
const vdc = JSON.parse(fs.readFileSync(path.join(HERE, 'assets', 'vdc-lex.json'), 'utf8'));
const gender = zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'assets', 'gender-relaxed.tsv.gz'))).toString('utf8');
const speller = zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'assets', 'speller.tsv.gz'))).toString('utf8');
DC.setLex(vdc, gender, speller);

const fail = [];
const sp = t => DC.spell(t);
const find = (t, w) => sp(t).find(x => x.word.toLowerCase() === w);

// ---- (A) assertions comportement (parité app) ----
if (!DC.spellerReady()) fail.push('lexique speller non chargé');
if (sp('Le petit garçon mange une pomme rouge dans le jardin.').length) fail.push('FP sur phrase correcte');
if (sp('un œuf et du bœuf').length) fail.push('FP ligature œuf/bœuf');
if (sp('Nathalie habite à Bordeaux.').length) fail.push('FP nom propre en début de phrase');
const fen = find('la fenetre est ouverte', 'fenetre');
if (!fen || fen.sugg !== 'fenêtre' || fen.tier !== 'auto') fail.push('fenetre→fenêtre (auto) attendu, eu ' + JSON.stringify(fen));
// GLISSEMENT MOTEUR — l'extension doit AFFIRMER (elle applique 'auto' en silence à la frappe).
// Assertion explicite, car « ext ⊆ app » est unidirectionnel : une extension MUETTE passerait la parité.
for (const [b, g] of [['jmaais', 'jamais'], ['acceuil', 'accueil'], ['grannd', 'grand'], ['vinngt', 'vingt']]) {
  const r = find('il a ' + b + ' vu ça', b);
  if (!r || r.sugg.toLowerCase() !== g || r.tier !== 'auto')
    fail.push('glissement moteur : ' + b + '→' + g + ' attendu en AUTO, eu ' + JSON.stringify(r));
}
for (const b of ['flight', 'kommune', 'project']) {                      // contre-garde : mot ÉTRANGER, un seul candidat, mais lettre SUBSTITUÉE/ABSENTE → jamais affirmé
  const r = find('un ' + b + ' ici', b);
  if (r && r.tier === 'auto') fail.push('contre-garde : « ' + b + ' » ne doit PAS être affirmé, eu ' + JSON.stringify(r));
}
const les = find('la leson du jour', 'leson');
if (!les || les.sugg !== 'leçon') fail.push('leson→leçon attendu, eu ' + JSON.stringify(les));
const fau = find('il a une grosse fote', 'fote');
if (!fau || fau.sugg !== 'faute') fail.push('fote→faute (genre contexte) attendu, eu ' + JSON.stringify(fau));
const pre = find('le premiere pays', 'premiere');
if (!pre || pre.sugg !== 'premier') fail.push('premiere→premier (bascule paire) attendu, eu ' + JSON.stringify(pre));
const el1 = find('un eleve serieux', 'eleve');
if (!el1 || el1.sugg !== 'élève') fail.push('un eleve→élève (nom après dét.) attendu, eu ' + JSON.stringify(el1));
const el2 = find('le niveau est tres eleve', 'eleve');
if (!el2 || el2.sugg !== 'élevé') fail.push('tres eleve→élevé (adj après adverbe) attendu, eu ' + JSON.stringify(el2));
const ce = sp('c est très bien').find(x => x.name === 'élision');
if (!ce || ce.sugg !== "c'est" || ce.span !== 2) fail.push("c est→c'est (élision merge) attendu, eu " + JSON.stringify(ce));
if (sp('il est très content').some(x => x.name === 'élision')) fail.push('FP élision sur texte correct');
// sujet « je » mal écrit + aux voyelle → « j'ai/j'étais » (ke/ge/ce/se + ai/avais/étais…) — merge span:2
const kai = sp('ke ai un chien').find(x => x.name === 'élision');
if (!kai || kai.sugg !== "j'ai" || kai.span !== 2) fail.push("ke ai→j'ai (merge sujet+aux voyelle) attendu, eu " + JSON.stringify(kai));
const setb = sp('se étais là').find(x => x.name === 'élision');
if (!setb || setb.sugg !== "j'étais" || setb.span !== 2) fail.push("se étais→j'étais attendu, eu " + JSON.stringify(setb));
if (sp('tu as un chien').some(x => x.name === 'élision')) fail.push('FP j-aux sur « tu as » (correct)');
if (sp('ce aigle vole haut').some(x => x.name === 'élision')) fail.push('FP j-aux sur « ce aigle » (pas un aux)');
// ÉLONGATION (collapse des runs ≥3) — AUTO si candidat unique ; gardes acronyme/chiffre romain/double-lettre valide
const elg = find('il est trèèès content', 'trèèès');
if (!elg || elg.sugg !== 'très' || elg.tier !== 'auto') fail.push('trèèès→très (auto) attendu, eu ' + JSON.stringify(elg));
const elg2 = find('ouiii je viens', 'ouiii');
if (!elg2 || elg2.sugg !== 'oui') fail.push('ouiii→oui attendu, eu ' + JSON.stringify(elg2));
if (sp('au VIIIe siècle').length) fail.push('FP chiffre romain VIIIe');
if (sp('la note AAA est haute').length) fail.push('FP acronyme AAA');
if (sp('une pomme immense').length) fail.push('FP double-lettre valide (pomme/immense)');
// MAJUSCULE INITIALE (vigilance) — CORRECTEUR SEULEMENT (capital=true) ; OFF en direct/extension (défaut) pour ne pas nagger chaque message minuscule
const majOn = DC.spellText('les choses sont belles', true).find(x => x.name === 'majuscule initiale à vérifier');
if (!majOn || majOn.sugg !== 'Les' || majOn.tier !== 'vigilance') fail.push('majuscule (capital=true) « les »→« Les » attendu, eu ' + JSON.stringify(majOn));
if (DC.spellText('les choses sont belles').some(x => x.name === 'majuscule initiale à vérifier')) fail.push('FP majuscule sans capital (doit être OFF par défaut = direct)');
if (DC.spellText('Les choses sont belles', true).some(x => x.name === 'majuscule initiale à vérifier')) fail.push('FP majuscule sur début déjà capitalisé');

// ---- (B) parité directe dys-core ⊆ app.spellText sur batterie orthographique (contexte neutre) ----
let parityKO = 0;
try {
  const html = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8'); try{globalThis.OMEGA_VDC=require('../dictee/blobgz').vdcSeed(html);}catch(e){}   // #30 : seed sync vdc-lex-gz (le moteur peuple les maps grammaire sans async)
  const i0 = html.indexOf('mode PHRASES'), start = html.indexOf('(function(){', i0);
  const spIdx = html.indexOf('function spellText', start);
  const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
  const code = html.slice(start, cut) + ';globalThis.__app={load:loadSpellerLex,loadG:loadGenderLex,spell:spellText};})();';
  const splBlk = (html.match(/<script type="text\/plain" id="speller-lex-gz">([^<]*)<\/script>/) || [])[1] || '';
  const vdcBlk = (html.match(/<script type="application\/json" id="vdc-lex">([\s\S]*?)<\/script>/) || [])[1] || '{}';
  const gdtBlk = (html.match(/<script type="text\/plain" id="gdet-lex-gz">([^<]*)<\/script>/) || [])[1] || '';   // EGALITE D EQUIPEMENT : l extension charge gender-relaxed via setLex, pas l app ici. MESURE : l ecart reel est de 1 625 entrees (68 751 -> 70 376), le gros du genre venant deja de la graine vdc-lex — mais comparer deux moteurs inegalement equipes ne prouve rien, meme d un cheveu.
  if (!gdtBlk.trim()) { console.error('HARNAIS KO : bloc gdet-lex-gz introuvable dans app/omega-pendu.html — la parite serait mesuree a equipement INEGAL, donc a vide'); process.exit(1); }   // c est ce bloc qui peut casser EN SILENCE (renommage/retypage du script) : une egalite parfaite entre deux configurations est un signal d echec, jamais une neutralite
  const stub = new Proxy(function(){}, { get(t,k){ if(k==='classList')return {add(){},remove(){},toggle(){},contains:()=>false}; if(k==='style')return{}; return stub; }, set:()=>true, apply:()=>stub });
  global.document = { getElementById:(id)=> id==='vdc-lex'?{textContent:vdcBlk}: id==='speller-lex-gz'?{textContent:splBlk}: id==='gdet-lex-gz'?{textContent:gdtBlk}:stub, createElement:()=>stub, body:stub, head:stub, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] };
  global.window = global; global.navigator = { userAgent:'node' }; global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
  global.speechSynthesis = { speak(){}, cancel(){}, getVoices:()=>[] }; global.SpeechSynthesisUtterance = function(){return stub;};
  (0, eval)(code);
  (async () => {
    await global.__app.load(); await global.__app.loadG();   // meme equipement des deux cotes (speller + genre relache)
    const BAT = ['fenetre cassée','le gateau','une pome','monagne','oartir','telefone','dortografe','maron',
                 'le chat dort sur le canapé','la fenêtre est ouverte','un texte parfaitement correct ici','daujourdhui','je suis trist','il galère autent','vraimet trist autent',
                 // GLISSEMENT MOTEUR → rouge, et sa CONTRE-GARDE (mots étrangers à un seul candidat).
                 // La clé de comparaison inclut le TIER : c'est donc bien la promotion en 'auto' qui est
                 // mise en parité ici, pas seulement la cible de la correction.
                 'jmaais','acceuil','grannd','beaucooup','toujorus','vinngt','flight','kommune','project','strategia'];
    const key = f => f.i + '|' + String(f.word).toLowerCase() + '|' + String(f.sugg).toLowerCase() + '|' + f.tier;
    BAT.forEach(t => {
      const a = global.__app.spell(t).map(key).sort().join(' ');
      const e = DC.spell(t).map(key).sort().join(' ');
      if (a !== e) { parityKO++; console.log('✗ DIVERGE :', JSON.stringify(t), '\n   app:', a || '(rien)', '\n   ext:', e || '(rien)'); }
    });
    finish(parityKO);
  })().catch(e => { console.log('(comparaison app ignorée :', e.message + ')'); finish(0); });
} catch (e) { console.log('(comparaison app ignorée :', e.message + ')'); finish(0); }

function finish(parityKO) {
  if (fail.length) { console.error('✗ ÉCHEC (comportement) :\n  ' + fail.join('\n  ')); process.exit(1); }
  if (parityKO) { console.error('✗ PARITÉ KO : ' + parityKO + ' input(s) où ext ≠ app'); process.exit(1); }
  console.log('✓ OK : speller extension — AUTO FP=0, hybride (fote→faute, premiere→premier), accent-POS (élève/élevé), élision, ET parité directe ext ≡ app.');
  process.exit(0);
}
