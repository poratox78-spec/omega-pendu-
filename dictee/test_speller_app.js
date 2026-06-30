// Test headless du correcteur ORTHOGRAPHIQUE de l'app : extrait l'IIFE dictée jusqu'à spellText,
// décompresse le lexique embarqué (speller-lex-gz), et exécute spellText sur des phrases.
const fs = require('fs'), path = require('path');
const HTML = path.join(__dirname, '..', 'app', 'omega-pendu.html');
const html = fs.readFileSync(HTML, 'utf8');

const i0 = html.indexOf('mode PHRASES');
const start = html.indexOf('(function(){', i0);
const spIdx = html.indexOf('function spellText', start);
const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
if (start < 0 || spIdx < 0 || cut < 0) { console.error('extraction échouée'); process.exit(2); }
const code = html.slice(start, cut) + ';globalThis.__sp={load:loadSpellerLex,spell:spellText,ready:()=>SP.ready,nwords:()=>SP.WORDS&&SP.WORDS.size};})();';

const vdc = (html.match(/<script type="application\/json" id="vdc-lex">([\s\S]*?)<\/script>/) || [])[1] || '{}';
const spl = (html.match(/<script type="text\/plain" id="speller-lex-gz">([^<]*)<\/script>/) || [])[1] || '';

const stub = new Proxy(function(){}, { get(t,k){ if(k==='style')return {}; if(k==='classList')return {add(){},remove(){},toggle(){},contains:()=>false}; return stub; }, set:()=>true, apply:()=>stub });
global.document = { getElementById:(id)=> id==='vdc-lex' ? {textContent:vdc} : id==='speller-lex-gz' ? {textContent:spl} : stub,
  createElement:()=>stub, body:stub, head:stub, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] };
global.window = global; global.navigator = { userAgent:'node' };
global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
global.speechSynthesis = { speak(){}, cancel(){}, getVoices:()=>[] };
global.SpeechSynthesisUtterance = function(){ return stub; };

try { (0, eval)(code); } catch (e) { console.error('IIFE eval échoué :', e.message); process.exit(2); }
const SP = globalThis.__sp;

(async () => {
  await SP.load();
  console.log('lexique speller chargé :', SP.nwords(), 'mots | ready=', SP.ready());
  const tests = [
    'Le chat a mangé la leson daujourdhui',
    'une grosse fote dortografe',
    'la fenetre est ouverte le matin',
    'Lannée derniere il a achete une voiture',
    'il a manjé son gato au téléfone',
    'le maron sone faux',
    // HYBRIDE : la grammaire désambiguïse le candidat (genre du contexte)
    'il a une grosse fote', 'le premiere pays', 'une voiture blanch',
    // ne doit RIEN toucher (phrase correcte)
    'Le petit garçon mange une pomme rouge dans le jardin.'
  ];
  for (const t of tests) {
    const f = SP.spell(t);
    console.log('\n» ' + t);
    f.forEach(x => console.log('    [' + x.tier + '] ' + x.word + ' → ' + x.sugg));
    if (!f.length) console.log('    (rien)');
  }
  // assertions (CI) — non-régression
  const fail = [];
  if (!SP.ready() || SP.nwords() < 50000) fail.push('lexique speller non chargé (' + SP.nwords() + ')');
  const correct = SP.spell('Le petit garçon mange une pomme rouge dans le jardin.');
  if (correct.length) fail.push('FP sur phrase correcte : ' + JSON.stringify(correct));
  if (SP.spell('un œuf et du bœuf').length) fail.push('FP ligature œuf/bœuf');
  if (SP.spell('Nathalie habite à Bordeaux.').length) fail.push('FP nom propre en début de phrase (Nathalie)');
  const fen = SP.spell('la fenetre est ouverte').find(x => x.word.toLowerCase() === 'fenetre');
  if (!fen || fen.sugg !== 'fenêtre' || fen.tier !== 'auto') fail.push('fenetre→fenêtre (auto) attendu, eu ' + JSON.stringify(fen));
  const les = SP.spell('la leson du jour').find(x => x.word.toLowerCase() === 'leson');
  if (!les || les.sugg !== 'leçon') fail.push('leson→leçon attendu, eu ' + JSON.stringify(les));
  // hybride : accord du contexte
  const fau = SP.spell('il a une grosse fote').find(x => x.word.toLowerCase() === 'fote');
  if (!fau || fau.sugg !== 'faute') fail.push('fote→faute (genre contexte) attendu, eu ' + JSON.stringify(fau));
  const pre = SP.spell('le premiere pays').find(x => x.word.toLowerCase() === 'premiere');
  if (!pre || pre.sugg !== 'premier') fail.push('premiere→premier (bascule paire) attendu, eu ' + JSON.stringify(pre));
  // désambiguïsation d'accent par POS du contexte
  const el1 = SP.spell('un eleve serieux').find(x => x.word.toLowerCase() === 'eleve');
  if (!el1 || el1.sugg !== 'élève') fail.push('un eleve→élève (nom après dét.) attendu, eu ' + JSON.stringify(el1));
  const el2 = SP.spell('le niveau est tres eleve').find(x => x.word.toLowerCase() === 'eleve');
  if (!el2 || el2.sugg !== 'élevé') fail.push('tres eleve→élevé (adj après adverbe) attendu, eu ' + JSON.stringify(el2));
  // élision-espace (fusion de 2 tokens)
  const ce = SP.spell('c est très bien').find(x => x.name === 'élision');
  if (!ce || ce.sugg !== "c'est" || ce.span !== 2) fail.push("c est→c'est (élision merge) attendu, eu " + JSON.stringify(ce));
  if (SP.spell('il est très content').some(x => x.name === 'élision')) fail.push('FP élision sur texte correct');
  // ÉLONGATION (collapse des runs ≥3) — AUTO si candidat unique ; gardes acronyme/chiffre romain/double-lettre valide
  const elg = SP.spell('il est trèèès content').find(x => x.word.toLowerCase() === 'trèèès');
  if (!elg || elg.sugg !== 'très' || elg.tier !== 'auto') fail.push('trèèès→très (auto) attendu, eu ' + JSON.stringify(elg));
  const elg2 = SP.spell('ouiii je viens').find(x => x.word.toLowerCase() === 'ouiii');
  if (!elg2 || elg2.sugg !== 'oui') fail.push('ouiii→oui attendu, eu ' + JSON.stringify(elg2));
  if (SP.spell('au VIIIe siècle').length) fail.push('FP chiffre romain VIIIe');
  if (SP.spell('la note AAA est haute').length) fail.push('FP acronyme AAA');
  if (SP.spell('une pomme immense').length) fail.push('FP double-lettre valide (pomme/immense)');
  if (fail.length) { console.error('\n✗ ÉCHEC :\n  ' + fail.join('\n  ')); process.exit(1); }
  console.log('\n✓ OK : lexique chargé, AUTO FP=0, fenetre→fenêtre (auto), leson→leçon, + hybride (fote→faute, premiere→premier).');
})().catch(e => { console.error(e); process.exit(1); });
