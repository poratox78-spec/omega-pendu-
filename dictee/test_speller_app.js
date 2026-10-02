// Test headless du correcteur ORTHOGRAPHIQUE de l'app : extrait l'IIFE dictée jusqu'à spellText,
// décompresse le lexique embarqué (speller-lex-gz), et exécute spellText sur des phrases.
const fs = require('fs'), path = require('path');
const HTML = path.join(__dirname, '..', 'app', 'omega-pendu.html');
const html = fs.readFileSync(HTML, 'utf8'); try{globalThis.OMEGA_VDC=require('./blobgz').vdcSeed(html);}catch(e){}   // #30 : seed sync vdc-lex-gz (le moteur peuple les maps grammaire sans async)

const i0 = html.indexOf('mode PHRASES');
const start = html.indexOf('(function(){', i0);
const spIdx = html.indexOf('function spellText', start);
const cut = html.indexOf('return res;}', spIdx) + 'return res;}'.length;   // jusqu'à la fin de complete() (aide-frappe) pour la garder aussi
if (start < 0 || spIdx < 0 || cut < 0) { console.error('extraction échouée'); process.exit(2); }
const code = html.slice(start, cut) + ';globalThis.__sp={load:loadSpellerLex,spell:spellText,complete:complete,ready:()=>SP.ready,nwords:()=>SP.WORDS&&SP.WORDS.size,ud:{mot:udMot,add:udAdd,del:udDel},REMED:REMED};})();';

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
  const el2 = SP.spell('le niveau reste tres eleve').find(x => x.word.toLowerCase() === 'eleve');
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
  // AUDIBILITÉ : la finale /e/ ÉCRITE (é) est entendue → préférer le candidat à finale audible, PAS le -e muet plus fréquent (piège de fréquence)
  [['manjé', 'mangé'], ['doné', 'donné'], ['apelé', 'appelé'], ['arivé', 'arrivé']].forEach(function (p) {
    const r = SP.spell(p[0]).find(x => x.word.toLowerCase() === p[0]);
    if (!r || r.sugg !== p[1]) fail.push('audibilité ' + p[0] + '→' + p[1] + ' attendu (finale audible), eu ' + JSON.stringify(r));
  });
  // ...ET EN CONTEXTE D'AUXILIAIRE : la ré-sélection context-first ne doit PAS réécraser l'audibilité par la fréquence (mangé 55 < mange 76)
  const mja = SP.spell('il a manjé une pomme').find(x => x.word.toLowerCase() === 'manjé');
  if (!mja || mja.sugg !== 'mangé') fail.push('il a manjé→mangé (audibilité + context-first) attendu, eu ' + JSON.stringify(mja));
  // AUDIBILITÉ ORANGE : non-mot RARE (gold freq<1 → le rouge s'abstient), l'orange « à vérifier » doit proposer l'AUDIBLE, pas le muet plus fréquent (affole 1.4 > affolé 0.7)
  const afo = SP.spell('il a afolé le chien').find(x => x.word.toLowerCase() === 'afolé');
  if (!afo || afo.sugg !== 'affolé') fail.push('afolé → orange audible « affolé » attendu (pas le muet « affole »), eu ' + JSON.stringify(afo));
  // AIDE-FRAPPE — plancher de fréquence (≥1) : ne propose QUE des mots courants. Sur une faute, pas de bruit rare qui CONTREDIT la correction (pome→pomerol vs correction pome→pomme).
  const cpPome = SP.complete('pome'); if (cpPome.some(w => (w || '').toLowerCase() === 'pomerol')) fail.push('aide-frappe: « pome » ne doit PLUS proposer « pomerol » (rare), eu ' + JSON.stringify(cpPome));
  const cpBon = SP.complete('bonjou'); if (!cpBon.includes('bonjour')) fail.push('aide-frappe: « bonjou » doit toujours proposer « bonjour », eu ' + JSON.stringify(cpBon));
  if (!SP.complete('cha').length) fail.push('aide-frappe: « cha » doit proposer des mots courants (chance…), eu []');
  // DOUBLE-CONSONNE simplifiée (faute dys fréquente) : restauration PRIORITAIRE sur l'élision et la fréquence, FP=0
  [['laisé', 'laissé'], ['pome', 'pomme'], ['carote', 'carotte'], ['aporté', 'apporté']].forEach(function (p) {
    var r = SP.spell(p[0]).find(function (x) { return x.word.toLowerCase() === p[0]; });
    if (!r || r.sugg !== p[1]) fail.push('double-consonne ' + p[0] + '→' + p[1] + ' attendu, eu ' + JSON.stringify(r));
  });
  if (SP.spell('lecole').every(function (x) { return x.sugg !== "l'école"; })) fail.push("CONTRÔLE: l'élision réelle lecole→l'école ne doit PAS être cassée par la double-consonne");
  ['tapé', 'trouvé', 'café', 'été'].forEach(function (w) {   // CONTRÔLE : mot VALIDE à finale é → jamais corrigé (FP=0)
    if (SP.spell(w).some(x => x.word.toLowerCase() === w)) fail.push('FP audibilité sur mot valide ' + w);
  });
  // AUDIBILITÉ FINALE MUETTE : le dys écrit ce qu'il ENTEND (« accor » /akɔʁ/), la finale muette -d/-t/-s tombe → restaurer
  // la complétion ≫20× dominante malgré l'asymétrie phon_key (strippe 'est' pas 'd' → « accort »(0) matche, pas « accord »(975)).
  [['un accor de paix', 'accor', 'accord'], ['un gran monsieur', 'gran', 'grand'], ['son regar noir', 'regar', 'regard']].forEach(function (p) {
    const r = SP.spell(p[0]).find(x => x.word.toLowerCase() === p[1]);
    if (!r || r.sugg !== p[2]) fail.push('audibilité finale muette ' + p[1] + '→' + p[2] + ' attendu, eu ' + JSON.stringify(r));
  });
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
  // TRAIT D'UNION locution figée (« au dessus »→« au-dessus ») — FP=0 (liste curée non-ambiguë ; « peut être » verbe EXCLU)
  const th1 = SP.spell('il est au dessus de tout').find(x => x.name === "trait d'union");
  if (!th1 || th1.sugg !== 'au-dessus' || th1.span !== 2) fail.push("au dessus→au-dessus attendu, eu " + JSON.stringify(th1));
  const th2 = SP.spell('regarde la bas là').find(x => x.name === "trait d'union");
  if (!th2 || th2.sugg !== 'là-bas') fail.push("la bas→là-bas attendu, eu " + JSON.stringify(th2));
  if (!SP.spell('ci joint le document').some(x => x.sugg === 'ci-joint')) fail.push('ci joint→ci-joint attendu');
  if (SP.spell('il peut être malade demain').some(x => x.name === "trait d'union")) fail.push("FP trait d'union « peut être » (ambigu = verbe pouvoir+être)");
  // PLÉONASMES / redondances (catégorie Grammalecte) → ORANGE (vigilance), liste close non-ambiguë, jamais de retrait d'office
  const pl1 = SP.spell("il faut prévoir à l'avance").find(x => x.name === 'pléonasme');
  if (!pl1 || pl1.sugg !== 'prévoir' || pl1.span !== 3 || pl1.tier !== 'vigilance') fail.push("prévoir à l'avance→prévoir (pléonasme orange span:3) attendu, eu " + JSON.stringify(pl1));
  const pl2 = SP.spell('ne monte pas monter en haut').find(x => x.name === 'pléonasme');
  if (!pl2 || pl2.sugg !== 'monter') fail.push('monter en haut→monter (pléonasme) attendu, eu ' + JSON.stringify(pl2));
  if (SP.spell('il faut prévoir le budget du mois').some(x => x.name === 'pléonasme')) fail.push('FP pléonasme sur texte sain « prévoir le budget »');
  // ANGLICISMES franglais non-mots → ORANGE, PRIORITÉ sur le speller (sinon « checker » mé-corrigé). Faux-amis homographes exclus (flood).
  const an1 = SP.spell('je vais checker le code').find(x => x.word.toLowerCase() === 'checker');
  if (!an1 || an1.name !== 'anglicisme' || an1.sugg !== 'vérifier' || an1.tier !== 'vigilance') fail.push('checker→vérifier (anglicisme orange, priorité speller) attendu, eu ' + JSON.stringify(an1));
  if (!SP.spell('peux-tu booker la salle').some(x => x.name === 'anglicisme' && x.sugg === 'réserver')) fail.push('booker→réserver (anglicisme) attendu');
  if (SP.spell('je veux vérifier et chercher').some(x => x.name === 'anglicisme')) fail.push('FP anglicisme sur mots FR sains « vérifier/chercher »');
  // ABRÉVIATIONS « Mr/Mrs »→« M./Mme » (title-case exact) + ORDINAUX « 2ème/1ère »→« 2e/1re » (suffixe précédé d'un chiffre) → ORANGE
  const ab1 = SP.spell('Mr Dupont est là').find(x => x.word === 'Mr');
  if (!ab1 || ab1.name !== 'abréviation' || ab1.sugg !== 'M.') fail.push('Mr→M. (abréviation) attendu, eu ' + JSON.stringify(ab1));
  const od1 = SP.spell('la 2ème place').find(x => x.name === 'nombre');
  if (!od1 || od1.sugg !== 'e') fail.push('2ème→2e (ordinal, suffixe→e) attendu, eu ' + JSON.stringify(od1));
  const od2 = SP.spell('la 1ère fois').find(x => x.name === 'nombre');
  if (!od2 || od2.sugg !== 're') fail.push('1ère→1re (ordinal) attendu, eu ' + JSON.stringify(od2));
  if (SP.spell("l'ère glaciaire a duré").some(x => x.name === 'nombre')) fail.push("FP ordinal « l'ère » (nom, pas précédé d'un chiffre)");
  if (SP.spell('il fait de même ici').some(x => x.name === 'nombre')) fail.push('FP ordinal « même » (un seul token)');
  // FAUX-AMI NOM « opportunité de »→« occasion » (gate sur « de/d' » ; les faux-amis VERBES restent hors scope = mur de conjugaison)
  const fa1 = SP.spell('saisir une opportunité de partir').find(x => x.word.toLowerCase() === 'opportunité');
  if (!fa1 || fa1.name !== 'anglicisme' || fa1.sugg !== 'occasion') fail.push('opportunité de→occasion (faux-ami) attendu, eu ' + JSON.stringify(fa1));
  if (SP.spell('une belle opportunité pour lui').some(x => x.name === 'anglicisme')) fail.push("FP faux-ami « opportunité pour » (pas suivi de « de » → pas de gate)");
  // LISTE BLANCHE : mots VALIDES absents du lexique que le speller éditait à tort → protégés (« mauvais candidat sur mot valide »)
  if (SP.spell('cette hypothèse fut postulée').find(x => x.word.toLowerCase() === 'postulée')) fail.push('FP: « postulée » (participe valide) ne doit pas être corrigé');
  if (SP.spell('il entretint la flamme').find(x => x.word.toLowerCase() === 'entretint')) fail.push('FP: « entretint » (passé simple valide) ne doit pas être corrigé');
  if (SP.spell("un armet de chevalier").find(x => x.word.toLowerCase() === 'armet')) fail.push('FP: « armet » (casque, mot valide) ne doit pas être corrigé');
  // LIGATURE œ : « soeur »→« sœur » (liste fermée oe=œ, FP=0) ; garde : pas de re-flag si déjà en œ, pas de faux sur « coexister »
  const oe1 = SP.spell('ma soeur est là').find(x => x.word.toLowerCase() === 'soeur');
  if (!oe1 || oe1.sugg !== 'sœur') fail.push("soeur→sœur (ligature œ) attendu, eu " + JSON.stringify(oe1));
  if (SP.spell('ma sœur est là').some(x => x.name === 'orthographe')) fail.push('FP ligature : « sœur » déjà correct re-flaggé');
  if (SP.spell('ils vont coexister ensemble').some(x => x.name === 'orthographe')) fail.push('FP ligature : « coexister » (pas un mot œ) touché');
  // ÉLONGATION (collapse des runs ≥3) — AUTO si candidat unique ; gardes acronyme/chiffre romain/double-lettre valide.
  // ⭐ CES CAS VIENNENT DU CORPUS DYS RÉEL, pas de mon imagination. Relevé sur 45 068 tokens : 43 tokens
  // à élongation, et AUCUN n'est expressif — ce sont des doigts qui bégaient (ellle, cettte, errreur,
  // femmme, nourrriture, atttendre, rappport). Écrire soi-même l'entrée ET l'attendu est justement la
  // faute de méthode que ce projet combat ailleurs ; « trèèès » et « ouiii » étaient de moi.
  for (const [b, g] of [['ellle', 'elle'], ['cettte', 'cette'], ['errreur', 'erreur'], ['femmme', 'femme'],
                        ['nourrriture', 'nourriture'], ['atttendre', 'attendre'], ['rappport', 'rapport'],
                        ['trèèès', 'très'], ['ouiii', 'oui']]) {
    const r = SP.spell('voici ' + b + ' ici').find(x => x.word.toLowerCase() === b);
    if (!r || r.sugg.toLowerCase() !== g || r.tier !== 'auto')
      fail.push('élongation : ' + b + '→' + g + ' (auto) attendu, eu ' + JSON.stringify(r));
  }
  if (SP.spell('rendez-vous sur www point com').length) fail.push('FP www (relevé dans le corpus dys)');
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
  // ⭐ 29/09/2026 — MOTS ÉLIDÉS INCONNUS : la forme nue recevait le bon mot en orange, la forme élidée RIEN. Reste inconnu → orange ;
  // « l' » collé à tort → la soudure ; nom propre (majuscule), élision devant consonne, mot connu → rien.
  for (const [t, w, s] of [["Il est allé à l'aupital hier.", "l'aupital", "l'hôpital"], ["Elle s'inkiète pour rien.", "s'inkiète", "s'inquiète"], ["Il part l'orsque la nuit tombe.", "l'orsque", 'lorsque']]) {
    const f = SP.spell(t).find(x => x.word === w);
    if (!f || f.sugg !== s || f.tier !== 'vigilance') fail.push('élidé inconnu « ' + w + ' » : attendu « ' + s + ' » en orange, eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
  for (const t of ["La cité de L'Atalaya est belle.", "N'golo court vite.", "Il joue de l'ukulélé."])
    if (SP.spell(t).length) fail.push('élidé : FP sur « ' + t + ' » → ' + JSON.stringify(SP.spell(t).map(x => x.word + '→' + x.sugg)));
  // ⭐ 29/09/2026 — ACCENTS MUETS : « ca », « foret », « pole » → ça, forêt, pôle en ORANGE ; « le foret » (l'outil), « les mass media »,
  // « la pole position » et « Ca » (calcium) : rien.
  for (const [t, w, s] of [['je crois que ca marche', 'ca', 'ça'], ['on marche en foret', 'foret', 'forêt'], ['ils vont au pole sud', 'pole', 'pôle']]) {
    const f = SP.spell(t).find(x => x.word === w);
    if (!f || f.sugg !== s || f.tier !== 'vigilance') fail.push('accent muet « ' + w + ' » : attendu « ' + s + ' » en orange, eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
  for (const [t, w] of [['il perce avec le foret', 'foret'], ['on lit les mass media', 'media'], ['il part en pole position', 'pole'], ['Ca réagit avec l’eau', 'Ca']])
    if (SP.spell(t).some(x => x.word === w)) fail.push('accent muet : FP sur « ' + t + ' »');
  // ⭐ 30/09/2026 — CLÉ PHONÉTIQUE : un e muet écrit garde la consonne qui le précède (« cette » avait une clé VIDE, partagée avec « sais »).
  { const f = SP.spell('le chat est vitte parti').find(x => x.word === 'vitte');
    if (!f || f.sugg !== 'vite') fail.push('« vitte » : attendu « vite » (la clé garde le t devant le e muet), eu ' + JSON.stringify(f && f.sugg)); }
  // ⭐ 30/09/2026 — « ou » (/u/) ≠ « u » (/y/) dans la clé : « tou » → tout (et non « tu », plus fréquent).
  { const f = SP.spell('il fait tou pour elle').find(x => x.word === 'tou');
    if (!f || f.sugg !== 'tout') fail.push('« tou » : attendu « tout » (ou ≠ u dans la clé), eu ' + JSON.stringify(f && f.sugg)); }
  // ⭐ 30/09/2026 — finales AUDIBLES : -ès, -et, -êt, -aient comptent comme la finale /e/ écrite « é ».
  { const f = SP.spell('je viens apré le repas').find(x => x.word === 'apré');
    if (!f || f.sugg !== 'après') fail.push('« apré » : attendu « après » (finale audible -ès, pas la coquille « aprés »), eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('le spectacle est un grand succé').find(x => x.word === 'succé');
    if (!f || f.sugg !== 'succès') fail.push('« succé » : attendu « succès » (finale audible -ès), eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('le cheval a peur du foué').find(x => x.word === 'foué');
    if (!f || f.sugg !== 'fouet') fail.push('« foué » : attendu « fouet » (finale audible -et), eu ' + JSON.stringify(f && f.sugg)); }
  // ⭐ 30/09/2026 — « mot inconnu » : l'accent seul d'abord quand le mot écrit n'a aucun accent (sauf rival à une édition ≫ 20×).
  { const f = SP.spell('le soleil eclairait la piece').find(x => x.word === 'eclairait');
    if (!f || f.sugg !== 'éclairait') fail.push('« eclairait » : attendu « éclairait » (l’accent seul d’abord), eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('je viens apre le repas').find(x => x.word === 'apre');
    if (!f || f.sugg !== 'après') fail.push('« apre » : attendu « après » (rival à une édition 20 fois plus fréquent : pas « âpre »), eu ' + JSON.stringify(f && f.sugg)); }
  // ⭐ 30/09/2026 — dominance de fréquence seulement si l'initiale change pour une confusion connue : polution → pollution (plus solution) ; evec → avec, gours → jours gardés.
  { const f = SP.spell('une polution énorme').find(x => x.word === 'polution');
    if (!f || f.sugg !== 'pollution') fail.push('« polution » : attendu « pollution » (initiale), eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('il vient evec lui').find(x => x.word === 'evec');
    if (!f || f.sugg !== 'avec') fail.push('« evec » : attendu « avec » (initiale), eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('les gours passent vite').find(x => x.word === 'gours');
    if (!f || f.sugg !== 'jours') fail.push('« gours » : attendu « jours » (initiale), eu ' + JSON.stringify(f && f.sugg)); }
  // ⭐ 30/09/2026 — FORMES ET EXPRESSIONS SOUDÉES : formes tronquées (liste fermée) et clé phonétique EXACTE d'une expression de _MWE, avant le tri.
  { const f = SP.spell('il est venu ducou').find(x => x.word === 'ducou');
    if (!f || f.sugg !== 'du coup') fail.push('« ducou » : attendu « du coup » (forme ou expression soudée), eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('je suis dacor avec toi').find(x => x.word === 'dacor');
    if (!f || f.sugg !== 'd\'accord') fail.push('« dacor » : attendu « d’accord » (forme ou expression soudée), eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('je range dabor ma chambre').find(x => x.word === 'dabor');
    if (!f || f.sugg !== 'd\'abord') fail.push('« dabor » : attendu « d’abord » (forme ou expression soudée), eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('il est dabord parti').find(x => x.word === 'dabord');
    if (!f || f.sugg !== 'd\'abord') fail.push('« dabord » : attendu « d’abord » (forme ou expression soudée), eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('il est parti parceque il pleut').find(x => x.word === 'parceque');
    if (!f || f.sugg !== 'parce que') fail.push('« parceque » : attendu « parce que » (forme ou expression soudée), eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('il fait ça atravers le mur').find(x => x.word === 'atravers');
    if (!f || f.sugg !== 'à travers') fail.push('« atravers » : attendu « à travers » (forme ou expression soudée), eu ' + JSON.stringify(f && f.sugg)); }
  // ⭐ 30/09/2026 — DÉTERMINANTS ÉCRITS AVEC « é » : té → tes, dé → des (dès devant un déterminant), mé → mes, lé + nom → les ; témoins : un dé, elle lé perdu.
  { const f = SP.spell('je connais té amis').find(x => x.word === 'té');
    if (!f || f.sugg !== 'tes') fail.push('« té » : attendu « tes » (déterminant écrit avec é), eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('il range dé livres').find(x => x.word === 'dé');
    if (!f || f.sugg !== 'des') fail.push('« dé » : attendu « des » (déterminant écrit avec é), eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('il travaille dé le matin').find(x => x.word === 'dé');
    if (!f || f.sugg !== 'dès') fail.push('« dé » : attendu « dès » (déterminant écrit avec é), eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('je range mé affaires').find(x => x.word === 'mé');
    if (!f || f.sugg !== 'mes') fail.push('« mé » : attendu « mes » (déterminant écrit avec é), eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('je vois lé enfants').find(x => x.word === 'lé');
    if (!f || f.sugg !== 'les') fail.push('« lé » : attendu « les » (déterminant écrit avec é), eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('il a lancé un dé rouge').find(x => x.word === 'dé');
    if (f) fail.push('« dé » dans « il a lancé un dé rouge » : aucune suggestion attendue (témoin), eu ' + JSON.stringify(f.sugg)); }
  { const f = SP.spell('elle lé perdu hier').find(x => x.word === 'lé');
    if (f) fail.push('« lé » dans « elle lé perdu hier » : aucune suggestion attendue (témoin), eu ' + JSON.stringify(f.sugg)); }
  // ⭐ 30/09/2026 — « CETTE » MAL ÉCRIT : séte → cette (cet devant un nom masculin à voyelle), set → cette après un mot-outil ; témoins anglais.
  { const f = SP.spell('je trouve séte histoire drôle').find(x => x.word === 'séte');
    if (!f || f.sugg !== 'cette') fail.push('« séte » dans « je trouve séte histoire drôle » : attendu « cette », eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('il a vu séte oiseau').find(x => x.word === 'séte');
    if (!f || f.sugg !== 'cet') fail.push('« séte » dans « il a vu séte oiseau » : attendu « cet », eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('je parle de set affaire').find(x => x.word === 'set');
    if (!f || f.sugg !== 'cette') fail.push('« set » dans « je parle de set affaire » : attendu « cette », eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('un set de table').find(x => x.word === 'set');
    if (f) fail.push('« set » dans « un set de table » : aucune suggestion attendue (témoin), eu ' + JSON.stringify(f.sugg)); }
  { const f = SP.spell('il a gagné le quatrième set hier').find(x => x.word === 'set');
    if (f) fail.push('« set » dans « il a gagné le quatrième set hier » : aucune suggestion attendue (témoin), eu ' + JSON.stringify(f.sugg)); }
  // ⭐ 30/09/2026 — le NOMBRE du mot suivant choisit : accent parasite sur « de » / « le » (« dé belles robes » → de), quantité (« beaucoup dé » → de), invariable (« lé bois ») : rien.
  { const f = SP.spell('elle porte dé belles robes').find(x => x.word === 'dé');
    if (!f || f.sugg !== 'de') fail.push('« dé » dans « elle porte dé belles robes » : attendu « de », eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('il lit beaucoup dé livres').find(x => x.word === 'dé');
    if (!f || f.sugg !== 'de') fail.push('« dé » dans « il lit beaucoup dé livres » : attendu « de », eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('je vois lé chat').find(x => x.word === 'lé');
    if (!f || f.sugg !== 'le') fail.push('« lé » dans « je vois lé chat » : attendu « le », eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('il met lé bois dehors').find(x => x.word === 'lé');
    if (f) fail.push('« lé » dans « il met lé bois dehors » : aucune suggestion attendue (témoin), eu ' + JSON.stringify(f.sugg)); }
  // ⭐ 30/09/2026 — ÉLISION MANQUANTE : la forme pleine devant voyelle (« que il », « je ai ») → élidée ; témoins : trait d’union, « que oui », chiffre.
  { const f = SP.spell('je pense que il pleut').find(x => x.name === 'élision' && x.word === 'que il');
    if (!f || f.sugg !== 'qu\'il') fail.push('élision manquante « que il » : attendu « qu’il », eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('hier je ai mangé une pomme').find(x => x.name === 'élision' && x.word === 'je ai');
    if (!f || f.sugg !== 'j\'ai') fail.push('élision manquante « je ai » : attendu « j’ai », eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('je bois un verre de eau').find(x => x.name === 'élision' && x.word === 'de eau');
    if (!f || f.sugg !== 'd\'eau') fail.push('élision manquante « de eau » : attendu « d’eau », eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('il ne a pas faim').find(x => x.name === 'élision' && x.word === 'ne a');
    if (!f || f.sugg !== 'n\'a') fail.push('élision manquante « ne a » : attendu « n’a », eu ' + JSON.stringify(f && f.sugg)); }
  { const f = SP.spell('je me appelle Paul').find(x => x.name === 'élision' && x.word === 'me appelle');
    if (!f || f.sugg !== 'm\'appelle') fail.push('élision manquante « me appelle » : attendu « m’appelle », eu ' + JSON.stringify(f && f.sugg)); }
  for (const s of ['prends-le avec toi', 'je crois que oui', 'rendez-vous le 12 avril']) { const f = SP.spell(s).find(x => x.name === 'élision'); if (f) fail.push('élision : témoin « ' + s + ' » marqué ' + JSON.stringify(f)); }
  // ⭐ 30/09/2026 — « ma/ta/jais » + participe masculin → m’a / t’a / j’ai (orange) ; témoins : nom féminin, « de jais », nom-participe.
  { const f = SP.spell('il ta donné un livre').find(x => x.name === 'élision' && x.word === 'ta donné');
    if (!f || f.sugg !== 't\'a donné' || f.tier !== 'vigilance') fail.push('ma/ta/jais « ta donné » : attendu « t’a donné » en orange, eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
  { const f = SP.spell('ma mère ma appelé hier').find(x => x.name === 'élision' && x.word === 'ma appelé');
    if (!f || f.sugg !== 'm\'a appelé' || f.tier !== 'vigilance') fail.push('ma/ta/jais « ma appelé » : attendu « m’a appelé » en orange, eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
  { const f = SP.spell('hier jais mangé une glace').find(x => x.name === 'élision' && x.word === 'jais mangé');
    if (!f || f.sugg !== 'j\'ai mangé' || f.tier !== 'vigilance') fail.push('ma/ta/jais « jais mangé » : attendu « j’ai mangé » en orange, eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
  for (const s of ['ma santé est bonne', 'ma pensée est libre', 'il a les cheveux noir de jais']) { const f = SP.spell(s).find(x => x.name === 'élision'); if (f) fail.push('ma/ta/jais : témoin « ' + s + ' » marqué ' + JSON.stringify(f)); }
  const tr1 = SP.spell('la tres belle note').find(x => x.word.toLowerCase() === 'tres');
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
  // OMISSION — le moteur ne doit pas rendre un mot PLUS COURT que la saisie quand une sur-chaîne
  // strictement plus proche existe (le dys a OMIS des lettres, pas ajouté).
  for (const [b, g] of [['afreuses', 'affreuses'], ['profesionnelles', 'professionnelles'],
                        ['rationelle', 'rationnelle'], ['meurtes', 'meurtres'],
                        ['rélles', 'réelles'], ['anarchist', 'anarchiste']]) {   // « utisateur » retiré : il ne se corrigeait QUE par le secours distance 2, supprimé le 2026-08-11
    const r = SP.spell(b).find(x => x.word.toLowerCase() === b);
    if (!r || r.sugg.toLowerCase() !== g) fail.push('omission : ' + b + '→' + g + ' attendu, eu ' + JSON.stringify(r));
  }
  // ⚠️ CONTRE-GARDES — les 4 cas que la version GOURMANDE de la règle cassait (« prendre la
  // sur-chaîne la plus fréquente » : 108 réparés mais 54 cassés). Elles verrouillent les trois
  // conditions : sous-suite, MÊME initiale (essort→ressort interdit), et strictement plus proche
  // (appeller→appellerai interdit). Sans elles, un futur assouplissement passerait inaperçu.
  for (const [b, g] of [['appeller', 'appeler'], ['vertue', 'vertu'], ['essort', 'essor'], ['language', 'langage']]) {
    const r = SP.spell(b).find(x => x.word.toLowerCase() === b);
    if (!r || r.sugg.toLowerCase() !== g) fail.push('contre-garde omission : ' + b + '→' + g +
      ' attendu (la règle ne doit PAS rallonger ici), eu ' + JSON.stringify(r));
  }
  // GLISSEMENT MOTEUR → ROUGE. Un seul candidat au lexique ET l'écart n'est qu'un ORDRE de lettres
  // ou un REDOUBLEMENT : le mot visé n'est pas en doute, on AFFIRME (tier 'auto', donc appliqué en
  // silence par l'extension). Mesuré : 28 corrections justes ajoutées / 0 fausse sur les corpus dys
  // appariés, et 9 tirs sur 14 450 phrases UD qui sont TOUS de vraies fautes du corpus.
  for (const [b, g] of [['jmaais', 'jamais'], ['acceuil', 'accueil'], ['grannd', 'grand'],
                        ['beaucooup', 'beaucoup'], ['toujorus', 'toujours'], ['vinngt', 'vingt']]) {
    const r = SP.spell(b).find(x => x.word.toLowerCase() === b);
    if (!r || r.sugg.toLowerCase() !== g || r.tier !== 'auto')
      fail.push('glissement moteur : ' + b + '→' + g + ' attendu en AUTO (rouge), eu ' + JSON.stringify(r));
  }
  // ⚠️ CONTRE-GARDE — c'est l'INTERSECTION des deux conditions qui est sûre, pas « un seul candidat ».
  // Seul, ce critère tire 65 fois sur 14 450 phrases correctes et réécrit des mots ÉTRANGERS en
  // silence. Ces quatre-là ont UN SEUL candidat mais diffèrent par une lettre SUBSTITUÉE ou ABSENTE :
  // ils doivent rester ORANGE. Sans cette contre-garde, un futur assouplissement passerait inaperçu.
  for (const b of ['flight', 'kommune', 'project', 'strategia']) {
    const r = SP.spell(b).find(x => x.word.toLowerCase() === b);
    if (r && r.tier === 'auto')
      fail.push('contre-garde glissement : « ' + b + ' » (mot étranger) ne doit PAS être affirmé, eu ' + JSON.stringify(r));
  }

  // PALIER « MOT INCONNU », VOIE '' ÉQUIPÉE (enquête 04/09/2026) : S6 élision puis S4 clé phonétique
  // à distance 1 ÉQUIPENT d'une suggestion ORANGE (au clic) des soulignés « mot inconnu » existants.
  // PROPRIÉTÉ CARDINALE : aucune marque nouvelle — on ne touche que des tokens DÉJÀ flagués.
  for (const [b, g] of [['dargen', "d'argent"], ['léconomi', "l'économie"], ['bégnier', 'baigner'], ['ésituron', 'hésiteront']]) {
    const r = SP.spell('on voit ' + b + ' ici').find(x => x.word.toLowerCase() === b);
    if (!r || r.name !== 'mot inconnu' || r.tier !== 'vigilance' || r.sugg !== g)
      fail.push("voie '' équipée : " + b + '→' + g + ' (mot inconnu, vigilance) attendu, eu ' + JSON.stringify(r));
  }
  // TÉMOINS : un inconnu SANS candidat du cadre reste souligné SANS suggestion (on n'invente pas).
  for (const b of ['delbrueckii', 'bulgaricus']) {
    const r = SP.spell('la souche ' + b + ' ici').find(x => x.word.toLowerCase() === b);
    if (!r || r.name !== 'mot inconnu' || r.sugg.toLowerCase() !== b)
      fail.push('témoin « ' + b + ' » doit rester souligné SANS suggestion (sugg = mot), eu ' + JSON.stringify(r));
  }

  // ⭐ 02/10/2026 — LE « 📗 C’EST UN MOT » DE LA CARTE (udMot, miroir de DYSCORE.udMot de l'extension) : offert là où le dictionnaire
  // fait TAIRE le signalement, et seulement là. L'ancienne règle (_udEligible) l'offrait aussi aux abréviations, aux nombres, aux
  // majuscules… où le clic ne fait rien, et enregistrait le token entier d'un mot élidé (« l'airbnb ») quand le moteur lit le radical.
  // Le geste rejoué comme sur la carte : udAdd(udMot(f)), nouvelle analyse (capital=true, comme _computeCorrs) — plus aucun signalement
  // d'orthographe sur le mot. Phrases INVENTÉES, vérifiées hors gold (les mêmes que extension/test_speller.js).
  {
    const surMot = (t, w) => SP.spell(t, true).filter(x => x.word === w);
    for (const [t, w, cle] of [['mon frère joue au padel avec ses amis', 'padel', 'padel'], ["on a réservé l'airbnb pour les vacances", "l'airbnb", 'airbnb'],
                               ["elle prend l'uber pour rentrer", "l'uber", 'uber']]) {
      const f = surMot(t, w)[0], m = f ? SP.ud.mot(f) : undefined;
      if (m !== cle) { fail.push('📗 : « ' + w + ' » ' + JSON.stringify(f && [f.name, f.tier]) + ' doit enregistrer « ' + cle + ' », udMot rend ' + JSON.stringify(m)); continue; }
      SP.ud.add(m);
      const reste = surMot(t, w).filter(x => x.name === 'orthographe' || x.name === 'mot inconnu'), encore = SP.ud.mot(f);
      SP.ud.del(m);
      if (reste.length) fail.push('📗 : après le clic, « ' + w + ' » est encore signalé ' + JSON.stringify(reste.map(x => x.name + '→' + x.sugg)) + ' — le dictionnaire ne le fait pas taire');
      if (encore !== null) fail.push('📗 : « ' + w + ' », déjà au dictionnaire, garde son 📗 (udMot rend ' + JSON.stringify(encore) + ')');
    }
    const RIEN = 'le dictionnaire n\'y peut rien, le clic ne ferait rien';
    for (const [t, w, pourquoi] of [['Mr Durand arrive demain', 'Mr', 'abréviation : ' + RIEN], ['je ne étais pas là hier', 'ne étais', 'élision : ' + RIEN],
                                    ['mon coeur bat très vite', 'coeur', 'mot du lexique : le 📗 est pour les mots que le lexique ne connaît pas (prénom, lieu, jargon)']]) {
      const f = surMot(t, w)[0];
      if (!f) { fail.push('📗 (instrument) : « ' + t + ' » ne signale plus « ' + w + ' » — choisir un autre exemple (' + pourquoi.split(' :')[0] + ')'); continue; }
      if (SP.ud.mot(f) !== null) fail.push('📗 offert sur « ' + w + ' » [' + f.name + '] — ' + pourquoi);
    }
    // ⭐ 02/10/2026 (Rem : « ajoute le 📗 au conseil du mot inconnu ») — le conseil 🛠️ d'un mot inconnu SANS suggestion nomme le 📗,
    // et seulement quand la carte l'offre (même décision : udMot). Mot inventé, mot élidé, mot du lexique, mot déjà ajouté.
    const C = (w) => SP.REMED.surface(w, w), CLIC = 'clique 📗 sur sa correction';
    for (const w of ['doctolib', "l'airbnb"]) if (C(w).indexOf(CLIC) < 0) fail.push('conseil du mot inconnu « ' + w + ' » : la carte offre le 📗, le conseil ne le nomme pas (« ' + C(w) + ' »)');
    if (C('maison').indexOf('📗') >= 0) fail.push('conseil : le 📗 nommé pour « maison », mot du lexique que la carte n\'offre pas');
    SP.ud.add('doctolib'); const dejA = C('doctolib'); SP.ud.del('doctolib');
    if (dejA.indexOf('📗') >= 0) fail.push('conseil : le 📗 nommé pour « doctolib » déjà au dictionnaire (la carte ne l\'offre plus)');
  }

  // ⚠️ GARDE DE COÛT — le correcteur tourne À LA FRAPPE : tout ce qui alourdit le 1er passage se
  // paie chez l'utilisateur. Vérifiée en la cassant (un plafond de longueur relevé à 12 dans la
  // génération de candidats faisait passer ce même texte de 8 ms à 196 ms → rouge).
  const TXT_DYS = "Je voulai vous dir que la leson daujourdhui etait tres interesante. Le profeseur a explique " +
    "lortografe des mots dificiles et jai fini des note. Demain nous auron un contrôle sur les acord " +
    "du participe passe, ce qui me stress un peu car je fait toujour des faute la dessus.";
  SP.spell('amorce');                                    // 1re invocation = chargement paresseux, hors mesure
  const _t = Date.now(); SP.spell(TXT_DYS); const _ms = Date.now() - _t;
  if (_ms > 120) fail.push('1er passage sur texte dys = ' + _ms + ' ms (plafond 120) — une génération de ' +
                           'candidats a été élargie : le correcteur tourne À LA FRAPPE, ça se sent.');
  else console.log('  coût 1er passage texte dys : ' + _ms + ' ms (plafond de garde 120)');

  if (fail.length) { console.error('\n✗ ÉCHEC :\n  ' + fail.join('\n  ')); process.exit(1); }
  console.log('\n✓ OK : lexique chargé, AUTO FP=0, fenetre→fenêtre (auto), leson→leçon, + hybride (fote→faute, premiere→premier), 📗 de la carte (offert là où il fait taire le signalement), coût du 1er passage.');
})().catch(e => { console.error(e); process.exit(1); });
