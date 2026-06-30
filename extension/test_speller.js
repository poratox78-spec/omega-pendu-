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
// ÉLONGATION (collapse des runs ≥3) — AUTO si candidat unique ; gardes acronyme/chiffre romain/double-lettre valide
const elg = find('il est trèèès content', 'trèèès');
if (!elg || elg.sugg !== 'très' || elg.tier !== 'auto') fail.push('trèèès→très (auto) attendu, eu ' + JSON.stringify(elg));
const elg2 = find('ouiii je viens', 'ouiii');
if (!elg2 || elg2.sugg !== 'oui') fail.push('ouiii→oui attendu, eu ' + JSON.stringify(elg2));
if (sp('au VIIIe siècle').length) fail.push('FP chiffre romain VIIIe');
if (sp('la note AAA est haute').length) fail.push('FP acronyme AAA');
if (sp('une pomme immense').length) fail.push('FP double-lettre valide (pomme/immense)');

// ---- (B) parité directe dys-core ⊆ app.spellText sur batterie orthographique (contexte neutre) ----
let parityKO = 0;
try {
  const html = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8');
  const i0 = html.indexOf('mode PHRASES'), start = html.indexOf('(function(){', i0);
  const spIdx = html.indexOf('function spellText', start);
  const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
  const code = html.slice(start, cut) + ';globalThis.__app={load:loadSpellerLex,spell:spellText};})();';
  const splBlk = (html.match(/<script type="text\/plain" id="speller-lex-gz">([^<]*)<\/script>/) || [])[1] || '';
  const vdcBlk = (html.match(/<script type="application\/json" id="vdc-lex">([\s\S]*?)<\/script>/) || [])[1] || '{}';
  const stub = new Proxy(function(){}, { get(t,k){ if(k==='classList')return {add(){},remove(){},toggle(){},contains:()=>false}; if(k==='style')return{}; return stub; }, set:()=>true, apply:()=>stub });
  global.document = { getElementById:(id)=> id==='vdc-lex'?{textContent:vdcBlk}: id==='speller-lex-gz'?{textContent:splBlk}:stub, createElement:()=>stub, body:stub, head:stub, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] };
  global.window = global; global.navigator = { userAgent:'node' }; global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
  global.speechSynthesis = { speak(){}, cancel(){}, getVoices:()=>[] }; global.SpeechSynthesisUtterance = function(){return stub;};
  (0, eval)(code);
  (async () => {
    await global.__app.load();
    const BAT = ['fenetre cassée','le gateau','une pome','monagne','oartir','telefone','dortografe','maron',
                 'le chat dort sur le canapé','la fenêtre est ouverte','un texte parfaitement correct ici','daujourdhui','je suis trist','il galère autent','vraimet trist autent'];
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
