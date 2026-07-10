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
  // PARTICIPE APRÈS AUXILIAIRE : le dys écrit le présent (-e) là où l'aux impose le participe (-é) du même verbe
  const mj = SP.spell('il a manje une pomme').find(x => x.word.toLowerCase() === 'manje');
  if (!mj || mj.sugg !== 'mangé') fail.push('il a manje→mangé (participe après aux) attendu, eu ' + JSON.stringify(mj));
  const mjc = SP.spell('je manje une pomme').find(x => x.word.toLowerCase() === 'manje');   // CONTRÔLE hors-aux : présent, PAS participe
  if (mjc && mjc.sugg === 'mangé') fail.push('je manje NE doit PAS devenir mangé (hors auxiliaire), eu ' + JSON.stringify(mjc));
  const pri = SP.spell("j'ai pri le train").find(x => x.word.toLowerCase() === 'pri');   // GARDE anti-régression : irrégulier -s, pas -é
  const ouv = SP.spell('il sait ou je vais').find(x => x.name === 'ou/où à vérifier');   // ou + pronom sujet → où (vigilance orange)
  if (!ouv || ouv.sugg !== 'où') fail.push('il sait ou je vais → ou/où vigilance attendue, eu ' + JSON.stringify(ouv));
  if (SP.spell('un café ou un thé').some(x => x.name === 'ou/où à vérifier')) fail.push('FP ou/où sur conjonction correcte (café ou thé)');
  if (pri && pri.sugg === 'prié') fail.push("j'ai pri ne doit PAS devenir prié (participe irrégulier = pris), eu " + JSON.stringify(pri));
  // élision-espace (fusion de 2 tokens)
  const ce = SP.spell('c est très bien').find(x => x.name === 'élision');
  if (!ce || ce.sugg !== "c'est" || ce.span !== 2) fail.push("c est→c'est (élision merge) attendu, eu " + JSON.stringify(ce));
  if (SP.spell('il est très content').some(x => x.name === 'élision')) fail.push('FP élision sur texte correct');
  // sujet « je » mal écrit + aux voyelle → « j'ai/j'étais » (ke/ge/ce/se + ai/avais/étais…) — merge span:2
  const kai = SP.spell('ke ai un chien').find(x => x.name === 'élision');
  if (!kai || kai.sugg !== "j'ai" || kai.span !== 2) fail.push("ke ai→j'ai (merge sujet+aux voyelle) attendu, eu " + JSON.stringify(kai));
  const set = SP.spell('se étais là').find(x => x.name === 'élision');
  if (!set || set.sugg !== "j'étais" || set.span !== 2) fail.push("se étais→j'étais attendu, eu " + JSON.stringify(set));
  if (SP.spell('tu as un chien').some(x => x.name === 'élision')) fail.push('FP j-aux sur « tu as » (correct)');
  if (SP.spell('ce aigle vole haut').some(x => x.name === 'élision')) fail.push('FP j-aux sur « ce aigle » (pas un aux)');
  // RÉPÉTITION de mot (« le le »→« le », span:2) — FP=0 (0/2500 UD) : denylist doublements légitimes + nom propre redoublé exclus
  const rp = SP.spell('le le chat dort').find(x => x.name === 'répétition');
  if (!rp || rp.sugg !== 'le' || rp.span !== 2) fail.push("le le→le (répétition span:2) attendu, eu " + JSON.stringify(rp));
  if (!SP.spell('je pense que que tu viens').some(x => x.name === 'répétition')) fail.push('répétition « que que » attendue');
  if (SP.spell('nous nous lavons les mains').some(x => x.name === 'répétition')) fail.push('FP répétition « nous nous » (réfléchi légitime)');
  if (SP.spell('il va à Bora Bora').some(x => x.name === 'répétition')) fail.push('FP répétition « Bora Bora » (nom propre redoublé)');
  if (SP.spell('très très bien joué').some(x => x.name === 'répétition')) fail.push('FP répétition « très très » (intensif légitime)');
  // ESPACEMENT français : mots collés par ponctuation → espace(s). FP=0 (0/2500 UD). Point « . » exclu (URLs), chiffres saufs (non capturés par le regex-mot).
  const sp1 = SP.spell('bonjour,je vais').find(x => x.name === 'espacement');
  if (!sp1 || sp1.sugg !== 'bonjour, je' || sp1.span !== 2) fail.push("bonjour,je→bonjour, je (espacement) attendu, eu " + JSON.stringify(sp1));
  const sp2 = SP.spell('Ça va?Il part').find(x => x.name === 'espacement');
  if (!sp2 || sp2.sugg !== 'va ? Il') fail.push("va?Il→va ? Il attendu, eu " + JSON.stringify(sp2));
  if (SP.spell('visite Zappos.com souvent').some(x => x.name === 'espacement')) fail.push('FP espacement sur URL (point « . » exclu)');
  if (SP.spell('à 17:30 précises').some(x => x.name === 'espacement')) fail.push('FP espacement sur heure (chiffres)');
  if (SP.spell('ok, très bien').some(x => x.name === 'espacement')) fail.push('FP espacement sur texte déjà espacé');
  // ÉLONGATION (collapse des runs ≥3) — AUTO si candidat unique ; gardes acronyme/chiffre romain/double-lettre valide
  const elg = SP.spell('il est trèèès content').find(x => x.word.toLowerCase() === 'trèèès');
  if (!elg || elg.sugg !== 'très' || elg.tier !== 'auto') fail.push('trèèès→très (auto) attendu, eu ' + JSON.stringify(elg));
  const elg2 = SP.spell('ouiii je viens').find(x => x.word.toLowerCase() === 'ouiii');
  if (!elg2 || elg2.sugg !== 'oui') fail.push('ouiii→oui attendu, eu ' + JSON.stringify(elg2));
  if (SP.spell('au VIIIe siècle').length) fail.push('FP chiffre romain VIIIe');
  if (SP.spell('la note AAA est haute').length) fail.push('FP acronyme AAA');
  if (SP.spell('une pomme immense').length) fail.push('FP double-lettre valide (pomme/immense)');
  // VIGILANCE : mot inconnu du dico → souligné (tier vigilance), SANS FP sur texte correct ni noms propres
  const vig = SP.spell('je voudrais en reamné demain').find(x => x.tier === 'vigilance');
  if (!vig || vig.word.toLowerCase() !== 'reamné') fail.push('vigilance « reamné » (mot inconnu) attendu, eu ' + JSON.stringify(vig));
  if (SP.spell('Le petit garçon mange une pomme rouge dans le jardin.').some(x => x.tier === 'vigilance')) fail.push('FP vigilance sur phrase correcte');
  if (SP.spell('Nathalie habite à Bordeaux.').some(x => x.tier === 'vigilance')) fail.push('FP vigilance sur nom propre');
  // VIGILANCE homophone (contexte serré) : « ma mer »→mère, sans firer sur « la mer » / « le fer »
  const hm = SP.spell('je ne sais pa comment fer à ma mer').filter(x => x.name === 'homophone à vérifier').map(x => x.word + '→' + x.sugg).sort().join(',');
  if (hm !== 'fer→faire,mer→mère,pa→pas') fail.push('vigilance homophone attendue (pa/fer/mer), eu ' + hm);
  if (SP.spell('la mer est belle et le fer est chaud').some(x => x.name === 'homophone à vérifier')) fail.push('FP vigilance homophone sur « la mer »/« le fer »');
  // QUALITÉ DES REMPLACEMENTS (audit 07/2026) : le bonus POS/genre ne doit pas promouvoir une graphie polluée du
  // lexique (« trés » N 18/M) contre un rival ≫20× plus fréquent (« très » 1435/M) — ni « jamal » contre « jamais ».
  const tr1 = SP.spell('une tres bonne note').find(x => x.word.toLowerCase() === 'tres');
  if (!tr1 || tr1.sugg !== 'très') fail.push('tres→très (garde dominance vs « trés » pollué) attendu, eu ' + JSON.stringify(tr1));
  const ch1 = SP.spell('ma tres chere amie').find(x => x.word.toLowerCase() === 'chere');
  if (!ch1 || ch1.sugg !== 'chère') fail.push('chere→chère (le token fautif « tres » ne doit plus ancrer un genre masculin) attendu, eu ' + JSON.stringify(ch1));
  const jm1 = SP.spell('il ne la jamai vu').find(x => x.word.toLowerCase() === 'jamai');
  if (jm1 && jm1.sugg === 'jamal') fail.push('jamai ne doit JAMAIS proposer « jamal » (prénom, 340× plus rare que jamais), eu ' + JSON.stringify(jm1));
  // MAJUSCULE PRÉSERVÉE : la correction d'un mot capitalisé garde sa majuscule (« Ecole »→« École », « Lannée »→« L\'année »)
  const ec1 = SP.spell('Ecole primaire.').find(x => x.word === 'Ecole');
  if (!ec1 || ec1.sugg !== 'École') fail.push('Ecole→École (majuscule préservée) attendu, eu ' + JSON.stringify(ec1));
  const la1 = SP.spell('Lannée passée').find(x => x.word === 'Lannée');
  if (!la1 || la1.sugg !== "L'année") fail.push("Lannée→L'année (majuscule préservée) attendu, eu " + JSON.stringify(la1));
  // APOSTROPHE TYPOGRAPHIQUE ’ (claviers mobiles) ≡ ' : une phrase correcte avec ’ ne doit produire AUCUNE fausse faute
  if (SP.spell('j’ai visité l’école aujourd’hui avec l’ami d’enfance').length) fail.push('FP apostrophe typographique ’ (phrase correcte flaguée)');
  const ap1 = SP.spell('j’ai vu la fenetre').find(x => x.word.toLowerCase() === 'fenetre');
  if (!ap1 || ap1.sugg !== 'fenêtre') fail.push('fenetre→fenêtre avec ’ dans le contexte attendu, eu ' + JSON.stringify(ap1));
  if (fail.length) { console.error('\n✗ ÉCHEC :\n  ' + fail.join('\n  ')); process.exit(1); }
  console.log('\n✓ OK : lexique chargé, AUTO FP=0, fenetre→fenêtre (auto), leson→leçon, + hybride (fote→faute, premiere→premier).');
})().catch(e => { console.error(e); process.exit(1); });
