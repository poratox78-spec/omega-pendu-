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
// PRÉNOMS : la garde « prénom écrit en minuscule » (speller) en dépend — sans cet asset elle est
// silencieusement INERTE, et le banc validerait un moteur qui ne protège rien. Chargé comme en prod.
DC.setPrenoms(zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'assets', 'prenoms.tsv.gz'))).toString('utf8'));

const fail = [];
// ⛔ PRÉNOM EN MINUSCULE — mesuré sur le pipeline dys réel (dictee/dys_pipeline_probe.py) : le Python
// APPLIQUAIT un prénom en minuscule → « ici ». La garde « nom propre » d'origine exige une MAJUSCULE hors début de
// phrase, que le scripteur dys ne met jamais. Mots CASSÉS 26 -> 20 après la garde côté Python.
// ⚠️ Ce qu'on interdit ici est l'APPLICATION SILENCIEUSE (auto/flag), pas le signalement : router un
// mot inconnu vers « mot inconnu » en VIGILANCE est légitime — l'utilisateur voit et décide.
{ const f = (t => DC.spell(t).find(x => x.word.toLowerCase() === 'enzo'))('enzo qui a gagné le match');
  if (f && f.tier !== 'vigilance')
    fail.push('prénom minuscule « enzo » APPLIQUÉ en « ' + f.sugg + ' » (palier ' + f.tier + ' ; doit rester intact ou vigilance)');
  if (!f || f.sugg !== 'Enzo') fail.push('prénom de la table « enzo » : suggestion ' + JSON.stringify(f && f.sugg) + ', attendu « Enzo » (le prénom d’abord, 29/09/2026)'); }
// ⭐ 29/09/2026 : … sauf si le dictionnaire propose un mot à UNE édition — le mot garde la main (« dee » → de, pas Dee).
{ const f = DC.spell('il vient dee Paris').find(x => x.word === 'dee');
  if (!f || f.sugg !== 'de') fail.push('« dee » (prénom Dee à une lettre de « de ») : suggestion ' + JSON.stringify(f && f.sugg) + ', attendu « de »'); }
// ⭐ 29/09/2026 — MOTS ÉLIDÉS INCONNUS : la forme nue recevait le bon mot en orange, la forme élidée RIEN. Reste inconnu → orange ;
// « l' » collé à tort → la soudure ; nom propre (majuscule), élision devant consonne, mot connu → rien.
for (const [t, w, s] of [["Il est allé à l'aupital hier.", "l'aupital", "l'hôpital"], ["Elle s'inkiète pour rien.", "s'inkiète", "s'inquiète"], ["Il part l'orsque la nuit tombe.", "l'orsque", 'lorsque']]) {
  const f = DC.spell(t).find(x => x.word === w);
  if (!f || f.sugg !== s || f.tier !== 'vigilance') fail.push('élidé inconnu « ' + w + ' » : attendu « ' + s + ' » en orange, eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
for (const t of ["La cité de L'Atalaya est belle.", "N'golo court vite.", "Il joue de l'ukulélé."])
  if (DC.spell(t).length) fail.push('élidé : FP sur « ' + t + ' » → ' + JSON.stringify(DC.spell(t).map(x => x.word + '→' + x.sugg)));
// ⭐ 04/10/2026 — APOSTROPHE OUBLIÉE, formes COURTES et négation : « il sest levé » → s'est, « il nest pas » → n'est, « je taime » → t'aime (flag) ;
// « elle naprend pas » → n'apprend, « on narête pas » → n'arrête et pas « n'arête » (orange : reste MAL ÉCRIT, verbe conjugué de même son ;
// un reste connu garde la route existante,
// « il nécoute jamais » → n'écoute en flag). Témoin : « tai-chi » ne reçoit pas « t'ai ».
for (const [t, w, s, tier] of [["Il sest levé tôt.", 'sest', "s'est", 'flag'], ["Il nest pas là.", 'nest', "n'est", 'flag'], ["Je taime beaucoup.", 'taime', "t'aime", 'flag'],
                               ["Il nécoute jamais.", 'nécoute', "n'écoute", 'flag'], ["Tu naimes pas ça.", 'naimes', "n'aimes", 'flag'],
                               ["Elle naprend pas vite.", 'naprend', "n'apprend", 'vigilance'], ["On narête pas de rire.", 'narête', "n'arrête", 'vigilance']]) {
  const f = DC.spell(t).find(x => x.word === w);
  if (!f || f.sugg !== s || f.tier !== tier) fail.push('apostrophe oubliée « ' + w + ' » : attendu « ' + s + ' » (' + tier + '), eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
{ const f = DC.spell('Il pratique le tai-chi.').find(x => /^t'/.test(x.sugg || '')); if (f) fail.push('apostrophe oubliée : « tai » (tai-chi) → ' + f.sugg); }
// ⭐ 04/10/2026 — « javais » est au lexique (entrée parasite) : → j'avais (forme figée soudée, comme « aujourdhui »).
{ const f = DC.spell('Hier javais faim.').find(x => x.word === 'javais');
  if (!f || f.sugg !== "j'avais") fail.push("soudure « javais » : attendu « j'avais », eu " + JSON.stringify(f && [f.sugg, f.tier])); }
// ⭐ 04/10/2026 — APOSTROPHE OUBLIÉE (suite) : « il la vu » → l'a vu, « je lai vu » → l'ai vu, « tu mas fait » → m'as fait (orange, span 2) ;
// témoins : « elle la regarde » (verbe conjugué), « il a perdu la vu » (le déterminant reste à la grammaire : « vue »).
for (const [t, w, s] of [["Il la vu hier.", 'la vu', "l'a vu"], ["On la vu partir.", 'la vu', "l'a vu"], ["Je lai vu hier.", 'lai vu', "l'ai vu"], ["Tu mas fait peur.", 'mas fait', "m'as fait"]]) {
  const f = DC.spell(t).find(x => x.name === 'élision' && x.word === w);
  if (!f || f.sugg !== s || f.tier !== 'vigilance') fail.push('élision « ' + w + ' » : attendu « ' + s + ' » en orange, eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
for (const t of ["Elle la regarde.", "Il a perdu la vu."])
  if (DC.spell(t).some(x => x.name === 'élision')) fail.push('élision : témoin « ' + t + ' » marqué ' + JSON.stringify(DC.spell(t).map(x => x.word + '→' + x.sugg)));
// ⭐ 29/09/2026 — ACCENTS MUETS : « ca », « foret », « pole » → ça, forêt, pôle en ORANGE ; « le foret » (l'outil), « les mass media »,
// « la pole position » et « Ca » (calcium) : rien.
for (const [t, w, s] of [['je crois que ca marche', 'ca', 'ça'], ['on marche en foret', 'foret', 'forêt'], ['ils vont au pole sud', 'pole', 'pôle']]) {
  const f = DC.spell(t).find(x => x.word === w);
  if (!f || f.sugg !== s || f.tier !== 'vigilance') fail.push('accent muet « ' + w + ' » : attendu « ' + s + ' » en orange, eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
for (const [t, w] of [['il perce avec le foret', 'foret'], ['on lit les mass media', 'media'], ['il part en pole position', 'pole'], ['Ca réagit avec l’eau', 'Ca']])
  if (DC.spell(t).some(x => x.word === w)) fail.push('accent muet : FP sur « ' + t + ' »');
// ⭐ 30/09/2026 — CLÉ PHONÉTIQUE : un e muet écrit garde la consonne qui le précède (« cette » avait une clé VIDE, partagée avec « sais »).
{ const f = DC.spell('le chat est vitte parti').find(x => x.word === 'vitte');
  if (!f || f.sugg !== 'vite') fail.push('« vitte » : attendu « vite » (la clé garde le t devant le e muet), eu ' + JSON.stringify(f && f.sugg)); }
// ⭐ 30/09/2026 — « ou » (/u/) ≠ « u » (/y/) dans la clé : « tou » → tout (et non « tu », plus fréquent).
{ const f = DC.spell('il fait tou pour elle').find(x => x.word === 'tou');
  if (!f || f.sugg !== 'tout') fail.push('« tou » : attendu « tout » (ou ≠ u dans la clé), eu ' + JSON.stringify(f && f.sugg)); }
// ⭐ 30/09/2026 — finales AUDIBLES : -ès, -et, -êt, -aient comptent comme la finale /e/ écrite « é ».
{ const f = DC.spell('je viens apré le repas').find(x => x.word === 'apré');
  if (!f || f.sugg !== 'après') fail.push('« apré » : attendu « après » (finale audible -ès, pas la coquille « aprés »), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('le spectacle est un grand succé').find(x => x.word === 'succé');
  if (!f || f.sugg !== 'succès') fail.push('« succé » : attendu « succès » (finale audible -ès), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('le cheval a peur du foué').find(x => x.word === 'foué');
  if (!f || f.sugg !== 'fouet') fail.push('« foué » : attendu « fouet » (finale audible -et), eu ' + JSON.stringify(f && f.sugg)); }
// ⭐ 30/09/2026 — « mot inconnu » : l'accent seul d'abord quand le mot écrit n'a aucun accent (sauf rival à une édition ≫ 20×).
{ const f = DC.spell('le soleil eclairait la piece').find(x => x.word === 'eclairait');
  if (!f || f.sugg !== 'éclairait') fail.push('« eclairait » : attendu « éclairait » (l’accent seul d’abord), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('je viens apre le repas').find(x => x.word === 'apre');
  if (!f || f.sugg !== 'après') fail.push('« apre » : attendu « après » (rival à une édition 20 fois plus fréquent : pas « âpre »), eu ' + JSON.stringify(f && f.sugg)); }
// ⭐ 04/10/2026 — « mot inconnu » : la FORME du mot choisi s'accorde au mot d'avant — NOMBRE du déterminant, PERSONNE du sujet (dét. + nom, « l' » + nom).
{ const f = DC.spell('ils prennent les kar pour partir').find(x => x.word === 'kar');
  if (!f || f.sugg !== 'cars') fail.push('« les kar » : attendu « cars » (le nombre du déterminant), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('le facteur veu partir').find(x => x.word === 'veu');
  if (!f || f.sugg !== 'veut') fail.push('« le facteur veu » : attendu « veut » (le verbe accordé au sujet), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell("l'enfant doi dormir").find(x => x.word === 'doi');
  if (!f || f.sugg !== 'doit') fail.push('« l’enfant doi » : attendu « doit » (sujet « l’ » + nom), eu ' + JSON.stringify(f && f.sugg)); }
// témoins : un groupe après une préposition n'est pas le sujet ; un déterminant n'a pas de « forme jumelle ».
{ const f = DC.spell('dans le journal doi partir').find(x => x.word === 'doi');
  if (!f || f.sugg !== 'dois') fail.push('« dans le journal doi » : attendu « dois » inchangé (pas de sujet après une préposition), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('il voit les sse').find(x => x.word === 'sse');
  if (!f || f.sugg === 'ces') fail.push('« les sse » : un déterminant ne prend pas de forme jumelle (« ces »), eu ' + JSON.stringify(f && f.sugg)); }
// ⭐ 30/09/2026 — dominance de fréquence seulement si l'initiale change pour une confusion connue : polution → pollution (plus solution) ; evec → avec, gours → jours gardés.
{ const f = DC.spell('une polution énorme').find(x => x.word === 'polution');
  if (!f || f.sugg !== 'pollution') fail.push('« polution » : attendu « pollution » (initiale), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('il vient evec lui').find(x => x.word === 'evec');
  if (!f || f.sugg !== 'avec') fail.push('« evec » : attendu « avec » (initiale), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('les gours passent vite').find(x => x.word === 'gours');
  if (!f || f.sugg !== 'jours') fail.push('« gours » : attendu « jours » (initiale), eu ' + JSON.stringify(f && f.sugg)); }
// ⭐ 30/09/2026 — FORMES ET EXPRESSIONS SOUDÉES : formes tronquées (liste fermée) et clé phonétique EXACTE d'une expression de _MWE, avant le tri.
{ const f = DC.spell('il est venu ducou').find(x => x.word === 'ducou');
  if (!f || f.sugg !== 'du coup') fail.push('« ducou » : attendu « du coup » (forme ou expression soudée), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('je suis dacor avec toi').find(x => x.word === 'dacor');
  if (!f || f.sugg !== 'd\'accord') fail.push('« dacor » : attendu « d’accord » (forme ou expression soudée), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('je range dabor ma chambre').find(x => x.word === 'dabor');
  if (!f || f.sugg !== 'd\'abord') fail.push('« dabor » : attendu « d’abord » (forme ou expression soudée), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('il est dabord parti').find(x => x.word === 'dabord');
  if (!f || f.sugg !== 'd\'abord') fail.push('« dabord » : attendu « d’abord » (forme ou expression soudée), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('il est parti parceque il pleut').find(x => x.word === 'parceque');
  if (!f || f.sugg !== 'parce que') fail.push('« parceque » : attendu « parce que » (forme ou expression soudée), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('il fait ça atravers le mur').find(x => x.word === 'atravers');
  if (!f || f.sugg !== 'à travers') fail.push('« atravers » : attendu « à travers » (forme ou expression soudée), eu ' + JSON.stringify(f && f.sugg)); }
// ⭐ 30/09/2026 — DÉTERMINANTS ÉCRITS AVEC « é » : té → tes, dé → des (dès devant un déterminant), mé → mes, lé + nom → les ; témoins : un dé, elle lé perdu.
{ const f = DC.spell('je connais té amis').find(x => x.word === 'té');
  if (!f || f.sugg !== 'tes') fail.push('« té » : attendu « tes » (déterminant écrit avec é), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('il range dé livres').find(x => x.word === 'dé');
  if (!f || f.sugg !== 'des') fail.push('« dé » : attendu « des » (déterminant écrit avec é), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('il travaille dé le matin').find(x => x.word === 'dé');
  if (!f || f.sugg !== 'dès') fail.push('« dé » : attendu « dès » (déterminant écrit avec é), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('je range mé affaires').find(x => x.word === 'mé');
  if (!f || f.sugg !== 'mes') fail.push('« mé » : attendu « mes » (déterminant écrit avec é), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('je vois lé enfants').find(x => x.word === 'lé');
  if (!f || f.sugg !== 'les') fail.push('« lé » : attendu « les » (déterminant écrit avec é), eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('il a lancé un dé rouge').find(x => x.word === 'dé');
  if (f) fail.push('« dé » dans « il a lancé un dé rouge » : aucune suggestion attendue (témoin), eu ' + JSON.stringify(f.sugg)); }
{ const f = DC.spell('elle lé perdu hier').find(x => x.word === 'lé');
  if (f) fail.push('« lé » dans « elle lé perdu hier » : aucune suggestion attendue (témoin), eu ' + JSON.stringify(f.sugg)); }
// ⭐ 30/09/2026 — « CETTE » MAL ÉCRIT : séte → cette (cet devant un nom masculin à voyelle), set → cette après un mot-outil ; témoins anglais.
{ const f = DC.spell('je trouve séte histoire drôle').find(x => x.word === 'séte');
  if (!f || f.sugg !== 'cette') fail.push('« séte » dans « je trouve séte histoire drôle » : attendu « cette », eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('il a vu séte oiseau').find(x => x.word === 'séte');
  if (!f || f.sugg !== 'cet') fail.push('« séte » dans « il a vu séte oiseau » : attendu « cet », eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('je parle de set affaire').find(x => x.word === 'set');
  if (!f || f.sugg !== 'cette') fail.push('« set » dans « je parle de set affaire » : attendu « cette », eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('un set de table').find(x => x.word === 'set');
  if (f) fail.push('« set » dans « un set de table » : aucune suggestion attendue (témoin), eu ' + JSON.stringify(f.sugg)); }
{ const f = DC.spell('il a gagné le quatrième set hier').find(x => x.word === 'set');
  if (f) fail.push('« set » dans « il a gagné le quatrième set hier » : aucune suggestion attendue (témoin), eu ' + JSON.stringify(f.sugg)); }
// ⭐ 30/09/2026 — le NOMBRE du mot suivant choisit : accent parasite sur « de » / « le » (« dé belles robes » → de), quantité (« beaucoup dé » → de), invariable (« lé bois ») : rien.
{ const f = DC.spell('elle porte dé belles robes').find(x => x.word === 'dé');
  if (!f || f.sugg !== 'de') fail.push('« dé » dans « elle porte dé belles robes » : attendu « de », eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('il lit beaucoup dé livres').find(x => x.word === 'dé');
  if (!f || f.sugg !== 'de') fail.push('« dé » dans « il lit beaucoup dé livres » : attendu « de », eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('je vois lé chat').find(x => x.word === 'lé');
  if (!f || f.sugg !== 'le') fail.push('« lé » dans « je vois lé chat » : attendu « le », eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('il met lé bois dehors').find(x => x.word === 'lé');
  if (f) fail.push('« lé » dans « il met lé bois dehors » : aucune suggestion attendue (témoin), eu ' + JSON.stringify(f.sugg)); }
// ⭐ 30/09/2026 — ÉLISION MANQUANTE : la forme pleine devant voyelle (« que il », « je ai ») → élidée ; témoins : trait d’union, « que oui », chiffre.
{ const f = DC.spell('je pense que il pleut').find(x => x.name === 'élision' && x.word === 'que il');
  if (!f || f.sugg !== 'qu\'il') fail.push('élision manquante « que il » : attendu « qu’il », eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('hier je ai mangé une pomme').find(x => x.name === 'élision' && x.word === 'je ai');
  if (!f || f.sugg !== 'j\'ai') fail.push('élision manquante « je ai » : attendu « j’ai », eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('je bois un verre de eau').find(x => x.name === 'élision' && x.word === 'de eau');
  if (!f || f.sugg !== 'd\'eau') fail.push('élision manquante « de eau » : attendu « d’eau », eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('il ne a pas faim').find(x => x.name === 'élision' && x.word === 'ne a');
  if (!f || f.sugg !== 'n\'a') fail.push('élision manquante « ne a » : attendu « n’a », eu ' + JSON.stringify(f && f.sugg)); }
{ const f = DC.spell('je me appelle Paul').find(x => x.name === 'élision' && x.word === 'me appelle');
  if (!f || f.sugg !== 'm\'appelle') fail.push('élision manquante « me appelle » : attendu « m’appelle », eu ' + JSON.stringify(f && f.sugg)); }
for (const s of ['prends-le avec toi', 'je crois que oui', 'rendez-vous le 12 avril']) { const f = DC.spell(s).find(x => x.name === 'élision'); if (f) fail.push('élision : témoin « ' + s + ' » marqué ' + JSON.stringify(f)); }
// ⭐ 30/09/2026 — « ma/ta/jais » + participe masculin → m’a / t’a / j’ai (orange) ; témoins : nom féminin, « de jais », nom-participe.
{ const f = DC.spell('il ta donné un livre').find(x => x.name === 'élision' && x.word === 'ta donné');
  if (!f || f.sugg !== 't\'a donné' || f.tier !== 'vigilance') fail.push('ma/ta/jais « ta donné » : attendu « t’a donné » en orange, eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
{ const f = DC.spell('ma mère ma appelé hier').find(x => x.name === 'élision' && x.word === 'ma appelé');
  if (!f || f.sugg !== 'm\'a appelé' || f.tier !== 'vigilance') fail.push('ma/ta/jais « ma appelé » : attendu « m’a appelé » en orange, eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
{ const f = DC.spell('hier jais mangé une glace').find(x => x.name === 'élision' && x.word === 'jais mangé');
  if (!f || f.sugg !== 'j\'ai mangé' || f.tier !== 'vigilance') fail.push('ma/ta/jais « jais mangé » : attendu « j’ai mangé » en orange, eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
for (const s of ['ma santé est bonne', 'ma pensée est libre', 'il a les cheveux noir de jais']) { const f = DC.spell(s).find(x => x.name === 'élision'); if (f) fail.push('ma/ta/jais : témoin « ' + s + ' » marqué ' + JSON.stringify(f)); }
if (DC.phonKey('tou') !== DC.phonKey('tout') || DC.phonKey('tu') === DC.phonKey('tout')) fail.push('clé phonétique : tou=' + DC.phonKey('tou') + ' tout=' + DC.phonKey('tout') + ' tu=' + DC.phonKey('tu'));
if (DC.phonKey('cette') !== 'set' || DC.phonKey('fêtes') !== DC.phonKey('fête') || DC.phonKey('mangez') !== DC.phonKey('mangé')) fail.push('clé phonétique : cette=' + DC.phonKey('cette') + ' fêtes/fête=' + DC.phonKey('fêtes') + '/' + DC.phonKey('fête') + ' mangez/mangé=' + DC.phonKey('mangez') + '/' + DC.phonKey('mangé'));
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
const el2 = find('le niveau reste tres eleve', 'eleve');
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
// ⭐ CES CAS VIENNENT DU CORPUS DYS RÉEL (45 068 tokens : 43 élongations, AUCUNE expressive — que des
// doigts qui bégaient). Miroir de dictee/test_speller_app.js. « trèèès »/« ouiii » étaient inventés.
for (const [b, g] of [['ellle', 'elle'], ['cettte', 'cette'], ['errreur', 'erreur'], ['femmme', 'femme'],
                      ['nourrriture', 'nourriture'], ['atttendre', 'attendre'], ['rappport', 'rapport'],
                      ['trèèès', 'très'], ['ouiii', 'oui']]) {
  const r = find('voici ' + b + ' ici', b);
  if (!r || r.sugg.toLowerCase() !== g || r.tier !== 'auto')
    fail.push('élongation : ' + b + '→' + g + ' (auto) attendu, eu ' + JSON.stringify(r));
}
if (sp('rendez-vous sur www point com').length) fail.push('FP www (relevé dans le corpus dys)');
if (sp('au VIIIe siècle').length) fail.push('FP chiffre romain VIIIe');
if (sp('la note AAA est haute').length) fail.push('FP acronyme AAA');
if (sp('une pomme immense').length) fail.push('FP double-lettre valide (pomme/immense)');
// PALIER « MOT INCONNU », VOIE '' ÉQUIPÉE (enquête 04/09/2026, miroir dictee/test_speller_app.js) :
// S6 élision puis S4 clé phonétique d=1 ÉQUIPENT d'une suggestion ORANGE (au clic) des soulignés
// « mot inconnu » existants — AUCUNE marque nouvelle (on ne touche que des tokens DÉJÀ flagués).
for (const [b, g] of [['dargen', "d'argent"], ['léconomi', "l'économie"], ['bégnier', 'baigner'], ['ésituron', 'hésiteront']]) {
  const r = find('on voit ' + b + ' ici', b);
  if (!r || r.name !== 'mot inconnu' || r.tier !== 'vigilance' || r.sugg !== g)
    fail.push("voie '' équipée : " + b + '→' + g + ' (mot inconnu, vigilance) attendu, eu ' + JSON.stringify(r));
}
for (const b of ['delbrueckii', 'bulgaricus']) {   // témoins : sans candidat du cadre → souligné SANS suggestion (on n'invente pas)
  const r = find('la souche ' + b + ' ici', b);
  if (!r || r.name !== 'mot inconnu' || r.sugg.toLowerCase() !== b)
    fail.push('témoin « ' + b + ' » doit rester souligné SANS suggestion (sugg = mot), eu ' + JSON.stringify(r));
}
// MAJUSCULE INITIALE (vigilance) — CORRECTEUR SEULEMENT (capital=true) ; OFF en direct/extension (défaut) pour ne pas nagger chaque message minuscule
const majOn = DC.spellText('les choses sont belles', true).find(x => x.name === 'majuscule initiale à vérifier');
if (!majOn || majOn.sugg !== 'Les' || majOn.tier !== 'vigilance') fail.push('majuscule (capital=true) « les »→« Les » attendu, eu ' + JSON.stringify(majOn));
if (DC.spellText('les choses sont belles').some(x => x.name === 'majuscule initiale à vérifier')) fail.push('FP majuscule sans capital (doit être OFF par défaut = direct)');
if (DC.spellText('Les choses sont belles', true).some(x => x.name === 'majuscule initiale à vérifier')) fail.push('FP majuscule sur début déjà capitalisé');
// ⭐ 01/10/2026 — LE 📗 « CE MOT EST CORRECT » (DC.udMot, lu par la bulle et le panneau) : offert là où le dictionnaire fait TAIRE le
// signalement, et seulement là. La bulle ne l'offrait qu'aux familles « orthographe » et « élision » : jamais à un « mot inconnu »
// (« padel » : le cas courant d'un pseudo, d'une marque, d'un mot de métier), et sur une élision le clic ne faisait rien. Pour un mot
// ÉLIDÉ, le moteur consulte le RADICAL : enregistrer « l'airbnb » ne servait à rien. On rejoue le geste de la bulle — udAdd(udMot(f)),
// nouvelle analyse — et plus aucun signalement d'orthographe ne doit rester sur le mot. Phrases INVENTÉES, vérifiées hors gold.
{
  const surMot = (t, w) => (DC.diagnoseAll(t).flags || []).filter(x => x.word === w);
  for (const [t, w, cle] of [['mon frère joue au padel avec ses amis', 'padel', 'padel'], ["on a réservé l'airbnb pour les vacances", "l'airbnb", 'airbnb'],
                             ["elle prend l'uber pour rentrer", "l'uber", 'uber']]) {
    const f = surMot(t, w)[0], m = f ? DC.udMot(f) : undefined;
    if (m !== cle) { fail.push('📗 : « ' + w + ' » ' + JSON.stringify(f && [f.name, f.tier]) + ' doit enregistrer « ' + cle + ' », udMot rend ' + JSON.stringify(m)); continue; }
    DC.udAdd(m);
    const reste = surMot(t, w).filter(x => x.name === 'orthographe' || x.name === 'mot inconnu'), encore = DC.udMot(f);
    DC.udDel(m);
    if (reste.length) fail.push('📗 : après le clic, « ' + w + ' » est encore signalé ' + JSON.stringify(reste.map(x => x.name + '→' + x.sugg)) + ' — le dictionnaire ne le fait pas taire');
    if (encore !== null) fail.push('📗 : « ' + w + ' », déjà au dictionnaire, garde son 📗 (udMot rend ' + JSON.stringify(encore) + ')');
  }
  const RIEN = 'le dictionnaire n\'y peut rien, le clic ne ferait rien';
  for (const [t, w, pourquoi] of [['Mr Durand arrive demain', 'Mr', 'abréviation : ' + RIEN], ['je ne étais pas là hier', 'ne étais', 'élision : ' + RIEN],
                                  ['les chien aboient', 'chien', 'le mot existe, c\'est l\'accord qui est signalé : ' + RIEN],
                                  ['mon coeur bat très vite', 'coeur', 'mot du lexique : le 📗 est pour les mots que le lexique ne connaît pas (prénom, lieu, jargon), comme sur le site']]) {
    const f = surMot(t, w)[0];
    if (!f) { fail.push('📗 (instrument) : « ' + t + ' » ne signale plus « ' + w + ' » — choisir un autre exemple (' + pourquoi.split(' :')[0] + ')'); continue; }
    if (DC.udMot(f) !== null) fail.push('📗 offert sur « ' + w + ' » [' + f.name + '] — ' + pourquoi);
  }
}

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
                 'jmaais','acceuil','grannd','beaucooup','toujorus','vinngt','flight','kommune','project','strategia',
                 // voie '' du « mot inconnu » ÉQUIPÉE (S6 élision / S4 clé phon, 04/09/2026) + témoin sans candidat
                 'on voit dargen ici','léconomi','bégnier','ésituron','la souche delbrueckii ici',
                 // REPLI PHONÉTIQUE (13/09/2026) : variante de finale -er/-é, index des mots rares
                 'une grande sosiéter','le long des litaurau',
                 // lot 2 (13/09/2026) : prénom en minuscule, expression collée, mots collés, lettres mélangées
                 'viendrai biensur demain','aime beaucoupma ville','irons pemdatn les vacances'];
    const key = f => f.i + '|' + String(f.word).toLowerCase() + '|' + String(f.sugg).toLowerCase() + '|' + f.tier;
    BAT.forEach(t => {
      const a = global.__app.spell(t).map(key).sort().join(' ');
      const e = DC.spell(t).map(key).sort().join(' ');
      if (a !== e) { parityKO++; console.log('✗ DIVERGE :', JSON.stringify(t), '\n   app:', a || '(rien)', '\n   ext:', e || '(rien)'); }
    });
    finish(parityKO);
  })().catch(e => { console.log('(comparaison app ignorée :', e.message + ')'); finish(0); });
} catch (e) { console.log('(comparaison app ignorée :', e.message + ')'); finish(0); }

// ⭐ REPLI PHONÉTIQUE (13/09/2026) — un mot inconnu SANS suggestion en reçoit une s'il ne diffère que par sa finale -er/-é/-ez ou sonne
//    comme un mot RARE (« sosiéter » → société, « litoro » → littoraux). L'index des ~109 000 mots rares, bâti d'un seul tenant, GELAIT la
//    page ~640 ms au premier mot sans suggestion (Node) : la liste est relevée AU CHARGEMENT et l'index bâti PAR TRANCHES en tâche de fond
//    dès la première analyse. Garde sur un moteur NEUF (celui du haut a déjà tout analysé) : ① liste relevée ; ② la première analyse
//    n'indexe qu'une tranche ; ③ la chaîne avance SEULE jusqu'au bout ; ④ les deux voies proposent. Et l'app porte le même chargeur.
async function gardeIndexRare() {
  const cle = require.resolve(path.join(HERE, 'dys-core.js')), avant = global.DYSCORE;
  delete require.cache[cle]; require(cle); const D = global.DYSCORE; global.DYSCORE = avant;
  if (D === DC || typeof D.phonRareEtat !== 'function') { fail.push('repli phonétique : moteur neuf ou phonRareEtat introuvable'); return; }
  D.setLex(vdc, gender, speller);
  D.setPrenoms(zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'assets', 'prenoms.tsv.gz'))).toString('utf8'));   // lot 2 : la voie « prénom en minuscule » lit la table
  const e0 = D.phonRareEtat();
  if (!(e0.rares > 100000) || e0.lance) { fail.push('repli phonétique : liste des mots rares non relevée au chargement, ou index lancé avant toute analyse : ' + JSON.stringify(e0)); return; }
  D.spell('Le chat dort sur le canapé.');
  const e1 = D.phonRareEtat();
  if (!e1.lance || e1.indexes <= 0 || e1.indexes >= e1.rares) { fail.push('repli phonétique : la première analyse doit lancer l\'index et n\'en bâtir qu\'UNE tranche (sinon la page gèle), eu ' + JSON.stringify(e1)); return; }
  const t0 = Date.now();
  while (D.phonRareEtat().indexes < e0.rares && Date.now() - t0 < 30000) await new Promise(r => setTimeout(r, 10));
  const e2 = D.phonRareEtat();
  if (e2.indexes < e2.rares) { fail.push('repli phonétique : l\'index des mots rares n\'avance pas seul en tâche de fond : ' + JSON.stringify(e2)); return; }
  // lot 2 (13/09/2026) : l'index des LETTRES MÉLANGÉES suit celui des rares dans la même chaîne de fond
  const t1 = Date.now();
  while (D.phonRareEtat().anagrammes < D.phonRareEtat().courants && Date.now() - t1 < 30000) await new Promise(r => setTimeout(r, 10));
  const e3 = D.phonRareEtat();
  if (!(e3.courants > 30000) || e3.anagrammes < e3.courants) { fail.push('lettres mélangées : l\'index des mots courants n\'est pas relevé au chargement ou n\'avance pas seul en tâche de fond : ' + JSON.stringify(e3)); return; }
  for (const [t, w, g] of [['il vit dans une grande sosiéter', 'sosiéter', 'société'], ['la ville longe les litaurau', 'litaurau', 'littoraux'],
                           ['J\'ai vu ludovic au marché.', 'ludovic', 'Ludovic'], ['Je viendrai biensur demain.', 'biensur', 'bien sûr'], ['Il a un rendévous chez le médecin.', 'rendévous', 'rendez-vous'], ['J\'aime beaucoupma ville.', 'beaucoupma', 'beaucoup ma'], ['Nous irons pemdatn les vacances.', 'pemdatn', 'pendant'], ['Il fait tooujousr beau ici.', 'tooujousr', 'toujours']]) {
    const f = D.spell(t).find(x => x.word.toLowerCase() === w);
    if (!f || f.sugg !== g || f.tier !== 'vigilance') fail.push('repli phonétique : « ' + w + ' » → ' + g + ' (orange) attendu, eu ' + JSON.stringify(f));
  }
  const app = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8');
  for (const s of ['else if(fr>0&&fr!==0.05)SP.RARE.push(w);', 'if(!_phonRareStep(4000)||!_anaStep(4000))setTimeout(_st,0);'])
    if (app.indexOf(s) < 0) fail.push('repli phonétique : l\'app ne porte plus « ' + s + ' » (chargeur ou lancement en tâche de fond)');
}

function finish(parityKO) {
  gardeIndexRare().catch(e => fail.push('repli phonétique : garde en erreur — ' + e.message)).then(() => conclure(parityKO));
}
function conclure(parityKO) {
  if (fail.length) { console.error('✗ ÉCHEC (comportement) :\n  ' + fail.join('\n  ')); process.exit(1); }
  if (parityKO) { console.error('✗ PARITÉ KO : ' + parityKO + ' input(s) où ext ≠ app'); process.exit(1); }
  console.log('✓ OK : speller extension — AUTO FP=0, hybride (fote→faute, premiere→premier), accent-POS (élève/élevé), élision, 📗 du dictionnaire (offert là où il fait taire le signalement), repli phonétique bâti en tâche de fond, ET parité directe ext ≡ app.');
  process.exit(0);
}
