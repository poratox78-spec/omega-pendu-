// Test du correcteur ORTHOGRAPHIQUE de l'extension (dys-core.js) — chargé avec les assets extraits.
// (A) Batterie d'assertions = comportement vérifié de l'app (miroir dictee/test_speller_app.js) : AUTO/FLAG,
//     FP=0, hybride (accord du contexte), désambiguïsation d'accent par POS, élision-espace.
// (B) Parité directe : dys-core.spell() ⊆ app.spellText() sur une batterie orthographique (aucun FP propre).
//   node extension/test_speller.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const HERE = __dirname, ROOT = path.join(HERE, '..');

// ---- (1) moteur extension + assets ----
// chargeur partiel voulu : banc de l'orthographe d'abord ; l'étiqueteur et le genre accentué sont chargés en fin de banc (testListe12) (extension/chargeur_probe.js ; le produit complet : extension/charger_node.js)
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
// ⭐ 13/10/2026 — LISTE N° 1 : « Séléction » partait en « S'élection » (rouge). ① Le MOT ENTIER d'abord : séléction → sélection, demission →
// démission, mêtres → mètres ; les vraies élisions collées restent coupées (lévier → l'évier, lécole → l'école). ② Le présent après un pronom
// sujet, même d'un verbe RARE : « il selectionne » → sélectionne (le moteur rendait « sélectionné » en rouge), « tu » + -es, « l'a » n'est pas
// « la ». ③ ACCENT IMPOSSIBLE (é devant ct, consonne doublée ; ç devant e/i) : séléctionnable → sélectionnable, pas « sélectionnables ».
// Phrases inventées ; chacune échoue sur le moteur d'avant.
for (const [t, w, s, tier] of [['Il faut une séléction de fruits.', 'séléction', 'sélection', 'auto'], ['Séléction de fruits.', 'Séléction', 'Sélection', 'auto'],
    ['Il a donné sa demission hier.', 'demission', 'démission', 'auto'], ['Il a decrit la scène.', 'decrit', 'décrit', 'auto'], ['Une règle legale.', 'legale', 'légale', 'auto'],
    ['Il court trois mêtres.', 'mêtres', 'mètres', 'auto'], ['Il lave lévier.', 'lévier', "l'évier", 'flag'], ['Il va à lécole.', 'lécole', "l'école", 'flag'],
    ['Il selectionne les fruits.', 'selectionne', 'sélectionne', 'auto'], ['Tu selectionnes les fruits.', 'selectionnes', 'sélectionnes', 'auto'],
    ["Il l'a decide hier.", 'decide', 'décidé', 'flag'], ['Elle congele la viande.', 'congele', 'congèle', 'auto'], ['Il commençe le travail.', 'commençe', 'commence', 'auto'],
    ['Une option séléctionnable.', 'séléctionnable', 'sélectionnable', 'vigilance'], ['La rue est désservie.', 'désservie', 'desservie', 'vigilance'],
    ['Un outil façilitant la vie.', 'façilitant', 'facilitant', 'vigilance']]) {
  const f = DC.spell(t).find(x => x.word === w);
  if (!f || f.sugg !== s || f.tier !== tier) fail.push('liste n° 1 « ' + w + ' » : attendu « ' + s + ' » (' + tier + '), eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
// ⭐ 13/10/2026 — LISTES N° 2 ET 3 : un mot à MAJUSCULE peut être un nom. « OMEGA », « Omega » ne deviennent plus « Oméga » ; un mot tout en
// capitales garde ses capitales (ÉTUDES) et reste en orange ; un accent rétabli au milieu d'un mot à majuscule n'est plus appliqué en
// silence (rouge) ; un nom à accent étranger n'est pas touché. Témoins : la capitale initiale seule (École), l'accent impossible (Sélection),
// l'élidé en minuscule (L'hôtel) restent comme avant, le nom à accent étranger aussi. Phrases inventées ; six cas échouent sur le moteur d'avant.
for (const [t, w, s, tier] of [['OMEGA aide les élèves.', 'OMEGA', null, null], ['Omega corrige les textes.', 'Omega', null, null],
    ['ETUDES ET CARRIERE', 'ETUDES', 'ÉTUDES', 'vigilance'], ['ETUDES ET CARRIERE', 'CARRIERE', 'CARRIÈRE', 'vigilance'],
    ['Il lit METEO DU JOUR.', 'METEO', 'MÉTÉO', 'vigilance'], ['Apres le repas, il dort.', 'Apres', 'Après', 'flag'], ['Begoña est venue hier.', 'Begoña', null, null],
    ['Ecole fermée demain.', 'Ecole', 'École', 'auto'], ['Séléction de fruits.', 'Séléction', 'Sélection', 'auto'], ["L'hotel est loin.", "L'hotel", "L'hôtel", 'auto']]) {
  const f = DC.spell(t).find(x => x.word === w && x.name === 'orthographe');
  if (s === null ? !!f : (!f || f.sugg !== s || f.tier !== tier)) fail.push('listes n° 2-3 « ' + w + ' » : attendu ' + (s === null ? 'rien' : '« ' + s + ' » (' + tier + ')') + ', eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
// ⭐ 13/10/2026 — LISTE N° 1b : après un pronom sujet, la route « consonne doublée » proposait un mot sans lecture verbale (« il bele »
// → belle, « elle cele » → celle) : le verbe rétabli l'emporte. Témoin : sans pronom sujet, le doublement reste (pome → pomme).
// LISTE N° 5 : une consonne à redoubler et un seul mot qui le permet → rouge même rare (personnalisé : 0,6 par million) ; la forme écrite est gardée (personnalisée).
for (const [t, w, s, tier] of [['Il bele sans arrêt.', 'bele', 'bêle', 'auto'], ['Elle cele la vérité.', 'cele', 'cèle', 'auto'], ['Je mange une pome.', 'pome', 'pomme', 'flag'],
    ['Un service personalisé.', 'personalisé', 'personnalisé', 'flag'], ['Une offre personalisée.', 'personalisée', 'personnalisée', 'flag'], ['Un ton impersonel.', 'impersonel', 'impersonnel', 'flag']]) {
  const f = DC.spell(t).find(x => x.word === w);
  if (!f || f.sugg !== s || f.tier !== tier) fail.push('listes n° 1b-5 « ' + w + ' » : attendu « ' + s + ' » (' + tier + '), eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
// ⭐ 14/10/2026 — LISTE N° 6 : des verbes VALIDES étaient soulignés (« ils outillent » → outils, « indexent » → indécent, « prototyper »).
// Le lot conj_lex_fr.tsv (table de conjugaison → dictionnaire) et, pour les présents qui ne diffèrent d'un mot connu que par l'accent,
// le contexte verbal (_presentRegulier). Témoins : l'accent oublié reste corrigé hors contexte (entrecoupés), le radical à alternance
// aussi (lève). Phrases inventées ; les cinq premières échouent sur le moteur et le dictionnaire d'avant.
for (const [t, w, s, tier] of [['Elles outillent leurs ateliers.', 'outillent', null, null], ['Il outille son garage.', 'outille', null, null],
    ['Le service fiabilise ses chiffres.', 'fiabilise', null, null], ['Les robots indexent le site.', 'indexent', null, null],
    ['Elle aime prototyper des jeux.', 'prototyper', null, null],
    ['Des branches entrecoupes de lumière.', 'entrecoupes', 'entrecoupés', 'vigilance'], ['Il leve la main.', 'leve', 'lève', 'auto']]) {
  const f = DC.spell(t).find(x => x.word === w);
  if (s === null ? !!f : (!f || f.sugg !== s || f.tier !== tier)) fail.push('liste n° 6 « ' + w + ' » : attendu ' + (s === null ? 'rien' : '« ' + s + ' » (' + tier + ')') + ', eu ' + JSON.stringify(f && [f.sugg, f.tier, f.name])); }
// ⭐ 14/10/2026 — LISTE N° 13 : « jusqu'a », « jusqu'ou » n'existent pas (rouge). Phrases inventées ; les trois échouent sur le moteur d'avant.
for (const [t, w, s, tier] of [["Jusqu'a demain soir.", "Jusqu'a", "Jusqu'à", 'flag'], ["Il lit jusqu'a minuit.", "jusqu'a", "jusqu'à", 'flag'], ["Va jusqu'ou tu peux.", "jusqu'ou", "jusqu'où", 'flag']]) {
  const f = DC.spell(t).find(x => x.word === w);
  if (!f || f.sugg !== s || f.tier !== tier) fail.push('liste n° 13 « ' + w + ' » : attendu « ' + s + ' » (' + tier + '), eu ' + JSON.stringify(f && [f.sugg, f.tier])); }
// ⭐ 14/10/2026 — LISTE N° 16 : noms de lieu composés et marques en minuscule (grammaire, famille « majuscule »). Phrases inventées ; les cinq
// premières échouent sur le moteur d'avant (« aix en provence » y recevait « ai » en rouge). Témoin : la graphie officielle reste muette.
for (const [t, w, s] of [['Elle vit dans le val de marne.', 'val', 'Val-de-Marne'], ['Il part à aix en provence demain.', 'aix', 'Aix-en-Provence'],
    ['Il habite en Seine Saint Denis.', 'Seine', 'Seine-Saint-Denis'], ['Il ouvre le navigateur chrome.', 'chrome', 'Chrome'], ['Il navigue avec firefox.', 'firefox', 'Firefox'],
    ['Elle vit dans le Val-de-Marne.', 'Val', null], ['Les jantes en chrome brillent.', 'chrome', null]]) {   // ⭐ 14/10/2026 (liste n° 1c) : « chroment » était appliqué en silence
  const fl = DC.diagnoseAll(t).flags, f = fl.find(x => x.word === w);
  if (s === null ? !!f : (!f || f.sugg !== s)) fail.push('liste n° 16 « ' + t + ' » : attendu ' + (s === null ? 'rien' : '« ' + s + ' »') + ', eu ' + JSON.stringify(fl.map(x => [x.word, x.sugg, x.name, x.tier])));
  if (s && fl.some(x => x !== f && x.i > f.i && x.i < f.i + (f.span || 1))) fail.push('liste n° 16 « ' + t + ' » : un mot du nom composé garde sa propre marque ' + JSON.stringify(fl.map(x => [x.word, x.sugg]))); }
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
// ⭐ 11/10/2026 — QUANTIFIEUR PLURIEL MAL ÉCRIT (lot 4 des mots faux) : le quantifieur de même son au pluriel (orange) et le nom qui suit
// au pluriel ; « un certin âge » → certain (adjectif) ; « nonbre » reste « nombre » ; « certin de » → certain. Vu ROUGE sur l'ancien moteur.
for (const [t, w, s] of [['Il range certin livres dans le salon.', 'certin', 'certains'], ['Elle lit sertin journaux le soir.', 'sertin', 'certains'],
    ['Elle a vu serten maisons anciennes.', 'serten', 'certaines'], ['Il vend diver objets au marché.', 'diver', 'divers'],
    ['Certin enfants jouent dehors.', 'certin', 'Certains'], ['Il a un certin âge.', 'certin', 'certain'], ['Elle cite plusier modéle.', 'plusier', 'plusieurs'],
    ['Elle cite plusier modéle.', 'modéle', 'modèles'], ['Il a un nonbre de points.', 'nonbre', 'nombre'], ['Il reste certin de gagner.', 'certin', 'certain']]) {
  const r = find(t, w); if (!r || r.sugg !== s) fail.push('quantifieur mal écrit « ' + t + ' » : ' + w + ' → ' + s + ' attendu, eu ' + JSON.stringify(r && [r.sugg, r.tier]));
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

// ⭐ 14/10/2026 — LISTE N° 12 : l'adjectif COORDONNÉ (« une voiture rapide et puissant ») n'était jamais vérifié. Phrases inventées ; les cinq
// premières échouent sur le moteur d'avant. Témoins muets : couleur composée, locution invariable, participe après « avoir », nom coordonné.
// ⭐ 14/10/2026 — LISTE N° 12 (suite) : la règle lit l'ÉTIQUETEUR et le genre accentué — chargés ICI, en fin de banc, pour ne rien changer
// aux blocs précédents (ils tournent sans étiqueteur depuis toujours).
function testListe12() {
  const A = (f) => zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'assets', f))).toString('utf8');
  DC.setNounPost(A('noun-post.txt.gz')); DC.setPosHmm(JSON.parse(A('pos-hmm.json.gz'))); DC.setGaccLex(A('gender-acc.json.gz'));
  for (const [t, w, s] of [['Une voiture rapide et puissant passe devant nous.', 'puissant', 'puissante'], ['Une équipe soudée et motivé gagne souvent.', 'motivé', 'motivée'],
      ['Des femmes grandes et forts traversent la place.', 'forts', 'fortes'], ['La porte ouverte et fermé claque.', 'fermé', 'fermée'], ['Des salles propres et rangé attendent.', 'rangé', 'rangées'],
      ['Il a les yeux bleus et vert foncé.', 'vert', null], ['Des produits frais et bon marché attendent sur l\'étal.', 'bon', null],
      ['J\'ai acheté une robe neuve et payé comptant.', 'payé', null], ['La militante écologiste et fondateur du club parle.', 'fondateur', null],
      // la TABLE des adjectifs à masculin en -s (mauvais, gris, précis, français : paire jamais construite) — échouent sur les assets d'avant
      ['Elle a des idées claires et précis.', 'précis', 'précises'], ['Il conduit une voiture français.', 'français', 'française'], ['Elle porte une robe gris.', 'gris', 'grise'],
      ['Il a les ailes gris argenté.', 'gris', null], ['Le directeur précise sa pensée.', 'précise', null], ['Il envoie une lettre exprès.', 'exprès', null],
      // ⭐ LISTE N° 17 : verbes absents de la table de conjugaison — le dictionnaire note « procrastine » NOM (Lexique 4), et la table était en
      // retard sur son script (« pétarde »). Échouent sur la table d'avant ; témoins : le singulier juste, le nom « timbre ».
      ['Les voisins de mon oncle procrastine.', 'procrastine', 'procrastinent'], ['Mes cousins procrastine souvent.', 'procrastine', 'procrastinent'],
      ['Les enfants pétarde dans la cour.', 'pétarde', 'pétardent'], ['Elle procrastine encore.', 'procrastine', null], ['Le timbre coûte cher.', 'timbre', null],
      // ⭐ LISTE N° 18 : le déterminant pluriel ÉLIDÉ (« d'autres », « d'énormes ») n'était lu par personne. Échouent sur le moteur d'avant ;
      // témoins : « d'autres » pronom, « d'autre » singulier.
      ['D\'autres chemin mènent à la ville.', 'chemin', 'chemins'], ['Elle cherche d\'autres solution.', 'solution', 'solutions'],
      ['D\'énormes vague frappent la digue.', 'vague', 'vagues'], ['D\'autres chemins mène à la ville.', 'mène', 'mènent'],
      ['D\'autres pensent le contraire.', 'pensent', null], ['Il parle d\'autre chose.', 'chose', null]]) {
    const fl = DC.diagnoseAll(t).flags, f = fl.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s)) fail.push('listes n° 12, 17 et 18 « ' + t + ' » : attendu ' + (s === null ? 'rien' : '« ' + s + ' »') + ', eu ' + JSON.stringify(fl.map(x => [x.word, x.sugg, x.name, x.tier]))); }
}
// ⭐ 14/10/2026 — LISTE N° 19 : « point final » n'est proposé qu'à une PHRASE (verbe conjugué sur la dernière ligne). L'extension analyse
// chaque bloc d'un CV à part : titre, téléphone, puce, ligne de dates recevaient chacun un point. Les quatre premiers échouent sur le
// moteur d'avant ; les trois derniers sont des témoins (phrase sans ponctuation, et verbe avant des initiales à point).
function testListe19() {
  for (const [t, attendu] of [['Technicienne de maintenance', false], ['06 12 34 56 78', false], ['- Accueil des clients', false],
      ['Esprit d\'équipe, soudure, mécanique de précision', false], ['le chat mange la souris', true], ['je vais bien tu viens demain', true],
      ['Il a rencontré J. K. Martin hier soir', true], ['Téléphone : 07 11 22 33 44', false]]) {   // ⭐ liste n° 23 : une ligne-étiquette n'a pas de verbe
    const pf = DC.diagnoseAll(t).flags.some(f => f.name === 'point final');
    if (pf !== attendu) fail.push('liste n° 19 « ' + t + ' » : point final ' + (attendu ? 'attendu' : 'NON attendu') + ', eu ' + (pf ? 'proposé' : 'rien')); }
}
// ⭐ 14/10/2026 — LISTE N° 20 : pluriels absurdes sur des fragments (CV, listes). Le pluriel d'un groupe ne traverse plus « : », un retour à la
// ligne, une fin de phrase, ni une virgule suivie d'un nouveau nom ; « les pages produit » n'est plus lu sujet + verbe. Les quatre premiers
// échouent sur le moteur d'avant ; témoins : l'adjectif après une virgule, le vrai verbe avec complément, le verbe sans lecture nom.
// ⭐ 14/10/2026 — LISTE N° 23 : texte espacé (PDF) — « espace double » n'est plus corrigé d'office ENTRE DEUX CHIFFRES (numéro groupé par
// paires). Le premier échoue sur le moteur d'avant ; témoin : entre deux mots, toujours corrigé.
function testListe23() {
  for (const [t, attendu] of [['Tél : 0 7  1 1  2 2  3 3', false], ['Il  mange une pomme.', true]]) {
    const ed = DC.diagnoseAll(t).flags.some(f => f.name === 'espace double');
    if (ed !== attendu) fail.push('liste n° 23 « ' + t + ' » : espace double ' + (attendu ? 'attendu' : 'NON attendu') + ', eu ' + (ed ? 'corrigé' : 'rien')); }
}
// ⭐ 14/10/2026 — LISTE N° 26 : la voie nouvelle a/à (devant un infinitif), mesurée 27 justes sur 27, passe au ROUGE. Échoue sur le moteur
// d'avant (orange) ; témoin : « il a mangé » reste muet.
function testListe26() {
  for (const [t, w, tier] of [['Il n\'y a plus rien a faire ici.', 'a', 'auto'], ['Il a mangé.', 'a', null]]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (tier === null ? !!f : (!f || f.tier !== tier || f.sugg !== 'à')) fail.push('liste n° 26 « ' + t + ' » : attendu ' + (tier ? 'à en ' + tier : 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
// ⭐ LISTE N° 5b : l'accent écrit n'est plus écrasé (« Elève » → Élevé, « Etonnés » → Étonnes) et un nom de métier après « est » n'est plus
// un participe (« il est juge » → jugé EN ROUGE). Les six premiers échouent sur le moteur d'avant ; témoins : l'accent exact peut être la
// faute (« posséde » → possède, « méme » → même), le participe après un auxiliaire reste (« il a visitè » → visité, « il est tombe » → tombé).
// Puis : « aimè », « donnè »… étaient des ENTRÉES du dictionnaire (coquilles de la source, jumeau en « é » présent) — le correcteur se taisait.
// ⭐ LISTE N° 32 : « que » RELATIF + semi-auxiliaire (« la liste que tu fais traîne ») — le semi-auxiliaire ferme la relative, le mot
// suivant est le verbe de la principale, pas un infinitif. Les deux premiers échouent sur le moteur d'avant ; témoins : « que » conjonction
// (« je crois que je vais mange », « il dit qu'il va mange ») garde son orange.
function testListe32() {
  for (const [t, w, s] of [['La liste des courses que tu fais traîne sur la table.', 'traîne', null], ["Tout ce qu'il fait tombe à l'eau.", 'tombe', null],
      ['Je crois que je vais mange.', 'mange', 'manger'], ["Il dit qu'il va mange.", 'mange', 'manger'], ['La lettre que tu veux passé au voisin.', 'passé', 'passer']]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s)) fail.push('liste n° 32 « ' + t + ' » : attendu ' + (s || 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
// ⭐ LISTE N° 33 : « mots faux » connus du speller (#568). Contexte : un déterminant sans genre collé gouverne (« des sines » : plus le
// féminin de « la langue » → signes, pas mines) ; un nom déterminé qui ferme son groupe donne son genre (« mes chansons préférrées. ») ;
// après une préposition, pas de verbe conjugué (« de sonn » → son, pas sont). Les quatre premiers échouent sur le moteur d'avant ;
// témoins : un nom NU ne gouverne pas (« est mois chere » → chère, 23/08), « un film tèrs long » → très. Mesurés et refusés (pertes) :
// l'adjectif collé comme ancre, l'inversion de lettres, « genre ne bat pas un verbe » — « tèrs » seul reste « terre », « êrcite » reste « excité ».
function testListe33() {
  for (const [t, w, s] of [["Elle a appris la langue des sines à l'école.", 'sines', 'signes'], ['Voici mes chansons préférrées.', 'préférrées', 'préférées'],
      ['Loin de sonn corps.', 'sonn', 'son'], ['Il parle de sonn temps libre.', 'sonn', 'son'],
      ['La robe est mois chere.', 'chere', 'chère'], ['Un film tèrs long.', 'tèrs', 'très'], ['Il vient pour achete du pain.', 'achete', 'acheter']]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (!f || f.sugg !== s) fail.push('liste n° 33 « ' + t + ' » : attendu ' + s + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
// ⭐ LISTES N° 7 ET 10 (lot MÉTIER curé, dictee/metier_curated.tsv) : « agentique » recevait « argentique » en orange, « upcyclées » était
// souligné, « une rissole » corrigée en rissolée EN ROUGE. Les trois premiers échouent sur l'ancien dictionnaire ; témoins : le vrai mot voisin
// (« argentique ») reste intact et une vraie faute reste corrigée.
function testListe7() {
  for (const [t, w, s] of [['Une démarche agentique.', 'agentique', null], ['Des chaussures upcyclées.', 'upcyclées', null], ['Une rissole chaude.', 'rissole', null],
      ['Un appareil argentique.', 'argentique', null], ['Une fenetre ouverte.', 'fenetre', 'fenêtre']]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s)) fail.push('liste n° 7/10 « ' + t + ' » : attendu ' + (s || 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
// ⭐ LISTE N° 31 (candidat C) : son/sont — le « sujet pluriel » était décidé par un déterminant pluriel à 8 mots en arrière (le mécanisme de
// l'attraction) : « le chien des voisins son partis » recevait « sont » EN ROUGE. Une tête singulière repérée par le parseur commun l'emporte.
// Le premier échoue sur le moteur d'avant ; témoins : sujet pluriel réel, pronom ils.
function testListe31() {
  for (const [t, w, s] of [['Le chien des voisins son partis en courant.', 'son', null], ['Les voisins son partis.', 'son', 'sont'], ['Ils son contents.', 'son', 'sont']]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w && x.sugg === 'sont');
    if (s === null ? !!f : !f) fail.push('liste n° 31 « ' + t + ' » : attendu ' + (s || 'pas de « sont »') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
// ⭐ LISTE N° 34 : cinq ROUGES sur des mots justes (sonde de précision au produit) — préfixe détaché (« la pré éclampsie »), article
// contracté devant un nom (« au procédé »), « en » devant l'auxiliaire (« s'il en est besoin »), « lé » lu comme le clitique « le »
// (« tu me lé dit »), « sida » invariable. Les cinq premiers échouent sur le moteur d'avant ; témoins : les règles corrigent toujours.
function testListe34() {
  for (const [t, w, s] of [['Le suivi de la pré éclampsie est rapide.', 'la', null], ['Elle tient au procédé ancien.', 'procédé', null],
      ["Il faut agir s'il en est besoin.", 'est', null], ['Tu me lé dit souvent.', 'dit', null], ['Les sida progressent.', 'sida', null],
      ['Elle a une problème.', 'une', 'un'], ['Elle commence à procédé.', 'procédé', 'procéder'], ['Elle est faim.', 'est', 'a'],
      ['Je te le dit.', 'dit', 'dis'], ['Les cancer progressent.', 'cancer', 'cancers']]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s)) fail.push('liste n° 34 « ' + t + ' » : attendu ' + (s || 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
// ⭐ LISTE N° 35 : « Flue de données » — « flue » est au dictionnaire (fluer, 0,003/M) : une forme de verbe rarissime à une PLACE DE NOM
// (déterminant avant, ou « de + nom » après) reçoit en orange le nom courant à une lettre. Les trois premiers échouent sur le moteur
// d'avant ; témoins : « il flue » (place de verbe) et « un flux » restent muets.
function testListe35() {
  for (const [t, w, s] of [['Flue de données.', 'Flue', 'Flux'], ['Le flue continu de la rivière.', 'flue', 'flux'], ['Un gros flue de visiteurs.', 'flue', 'flux'],
      ['Le temps flue lentement.', 'flue', null], ['Un flux de données.', 'flux', null]]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s || f.tier !== 'vigilance')) fail.push('liste n° 35 « ' + t + ' » : attendu ' + (s ? s + ' en vigilance' : 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
// ⭐ LISTE N° 36 (chantier IA n° 2) : LE SON DÉPARTAGE LE PALIER PHONÉTIQUE — quand le tri retient un phonétique (tresses, employeur,
// permettent), le candidat qui se prononce comme le mot écrit (g2p du moteur, assets/g2p.js) gagne, en orange. Les quatre premiers
// échouent sur le moteur d'avant ; témoins : « ddos » (édit à distance 1 : la règle ne touche pas au palier 1), « ccontrôlait »
// (déjà juste, en flag : rien ne bouge). Le g2p doit être chargé ici comme dans le navigateur (dys-core le charge sous Node).
// ⭐ LIGNE 38 : « Elle a mangée » — avec AVOIR le participe ne s'accorde jamais avec le sujet. (1) speller : « mangeé » après « Elle a » donnait
// « mangée » en AUTO (bascule de genre), « mangeèt » donnait « mangée » en rouge (porte contexte-first) → la base masculine ; (2) grammaire :
// la règle « accord du participe après avoir » exigeait un complément après le participe, « Elle a mangée. » était muet → orange sans témoin
// quand le sujet est net ; (3) a/à : « Marie a dormie » et un mot accentué inconnu (« éré ») faisaient basculer « a » en « à » en auto → le mot
// suivant est jugé tel qu'ÉCRIT (participe accordé, inconnu accentué) ; témoins : antécédent (qu'elle a mangée), COD nous, passif (a été
// nommée), « il va a vélo » garde son à. Les huit premiers échouent sur le moteur d'avant.
function testListe38() {
  for (const [t, w, s, tier] of [['Elle a mangeé une pomme.', 'mangeé', 'mangé'], ['Il a mangeèt hier.', 'mangeèt', 'mangé'],
      ['Elle a mangée.', 'mangée', 'mangé', 'vigilance'], ['Nous avons dansées toute la nuit.', 'dansées', 'dansé', 'vigilance'],
      ['Marie a dormie.', 'dormie', 'dormi', 'vigilance'], ['Il va a vélo.', 'a', 'à']]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (!f || f.sugg !== s || (tier && f.tier !== tier)) fail.push('ligne 38 « ' + t + ' » : attendu ' + s + (tier ? ' en ' + tier : '') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
  for (const t of ['Marie a dormie.', 'Mon frère a éré malade.', 'Son discours a sucisté des rires.']) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === 'a' && x.name === 'a/à');
    if (f) fail.push('ligne 38 « ' + t + ' » : a → ' + f.sugg + ' (' + f.tier + ') devant un participe mal écrit ou un inconnu accentué'); }
  for (const t of ['La pomme qu\'elle a mangée était bonne.', 'Ils ne nous ont pas informées.', 'Elle a été nommée.']) {
    const fl = DC.diagnoseAll(t).flags; if (fl.length) fail.push('ligne 38 témoin « ' + t + ' » : attendu rien, eu ' + JSON.stringify(fl.map(x => [x.word, x.sugg, x.name]))); }
}
function testListe43() {   // liste n° 43 : un mot à trait d'union n'est pas jugé morceau par morceau (orthographe : accent seul ; aucun accord)
  for (const t of ['Nous partons en week-end chez ma tante.', 'Le physicien range deux électro-aimants dans le tiroir.', 'Le chasse-neige dégage la route avant l\'aube.',
      'Ces porte-monnaie sont trop petits.', 'Les eaux s\'écoulent-elles vers la mer ?', 'Ceux-ci restent dans la cour.', 'Il y a un sous-affluent.']) {
    const fl = DC.diagnoseAll(t).flags; if (fl.length) fail.push('ligne 43 témoin « ' + t + ' » : attendu rien, eu ' + JSON.stringify(fl.map(x => [x.word, x.sugg, x.name]))); }
  { const f = DC.diagnoseAll('Ma grand-mére tricote un bonnet.').flags.find(x => x.word === 'mére');
    if (!f || f.sugg !== 'mère') fail.push('ligne 43 : « grand-mére » doit garder sa correction d\'accent (mère), eu ' + (f ? f.sugg : 'rien')); }
  { const f = DC.diagnoseAll('Le maison est grande.').flags.find(x => x.word === 'Le');
    if (!f) fail.push('ligne 43 : « Le maison » (hors composé) doit garder sa marque de genre'); }
}
function testListe42() {   // liste n° 42 : préfixes savants détachés → « mot coupé » (rouge si le composé est au lexique, orange avec trait d'union sinon)
  for (const [t, w, s, tier] of [['Cette coopérative agro alimentaire embauche au printemps.', 'agro', 'agroalimentaire', 'flag'],
      ['Le musée expose une chapelle néo gothique très sombre.', 'néo', 'néogothique', 'flag'], ['Il répare un vieux robot électro ménager.', 'électro', 'électroménager', 'flag'],
      ['Son groupe joue du néo métal le samedi.', 'néo', 'néo-métal', 'vigilance'], ['Ce logiciel mono utilisateur suffit pour la maison.', 'mono', 'mono-utilisateur', 'vigilance']]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w && x.name === 'mot coupé');
    if (!f || f.sugg !== s || f.tier !== tier || f.span !== 2) fail.push('ligne 42 « ' + t + ' » : attendu ' + s + ' en ' + tier + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
  for (const t of ['Ma cousine a une gastro depuis lundi.', 'Il fait du cardio chaque matin.', 'Le son passe en mono quand le câble glisse.']) {
    const f = DC.diagnoseAll(t).flags.find(x => x.name === 'mot coupé');
    if (f) fail.push('ligne 42 témoin « ' + t + ' » : attendu rien, eu ' + f.word + ' → ' + f.sugg + ' (' + f.tier + ')'); }
}
function testListe45() {   // liste n° 45 : « faites-le », « dites-moi » ne perdent pas leur s ; « donnes-lui » le perd toujours
  for (const t of ['Faites-le vous-même.', 'Dites-moi la vérité.', 'Faites-moi signe.', 'Refaites-le demain.']) {
    const fl = DC.diagnoseAll(t).flags; if (fl.length) fail.push('ligne 45 témoin « ' + t + ' » : attendu rien, eu ' + JSON.stringify(fl.map(x => [x.word, x.sugg, x.name]))); }
  { const f = DC.diagnoseAll('Donnes-lui le livre.').flags.find(x => x.name === 'impératif');
    if (!f || f.sugg !== 'Donne') fail.push('ligne 45 : « Donnes-lui » doit toujours devenir Donne, eu ' + (f ? f.sugg : 'rien')); }
}
function testListe44() {   // liste n° 44 : après un auxiliaire, la finale de participe ÉCRITE se garde (« éré » → été, « appellé » → appelé)
  for (const [t, w, s, tier] of [['Mon frère a éré malade.', 'éré', 'été', 'vigilance'], ['La rue est appellée la grande allée.', 'appellée', 'appelée', 'flag'],
      ['Ce petit village est appellé le hameau.', 'appellé', 'appelé', 'flag'], ['Les dossiers sont rejettés.', 'rejettés', 'rejetés', 'flag'],
      ['Mes deux tantes sont fort agées.', 'agées', 'âgées', 'auto']]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (!f || f.sugg !== s || f.tier !== tier) fail.push('ligne 44 « ' + t + ' » : attendu ' + s + ' en ' + tier + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
function testListe47() {   // liste n° 47 : « a » qui ne peut pas être avoir → « à », sans réécrire l'infinitif qui suit
  for (const [t, bon] of [['Mon voisin est prêt a me prêter sa voiture.', 'prêter'], ['Bonne soirée a tous.', null], ['C\'est simple a utiliser.', 'utiliser'],
      ['Il est prêt a nous aider.', 'aider'], ['Ce texte est long a lire.', 'lire']]) {
    const fl = DC.diagnoseAll(t).flags, f = fl.find(x => x.word === 'a'), v = bon && fl.find(x => x.word === bon);
    if (!f || f.sugg !== 'à' || f.tier !== 'auto' || v) fail.push('ligne 47 « ' + t + ' » : attendu a → à seul, eu ' + JSON.stringify(fl.map(x => [x.word, x.sugg, x.tier]))); }
  for (const t of ['Le prêt a été accordé.', 'Il a tous les atouts.', 'Ce prêt a un taux bas.']) {   // témoins : avoir
    const f = DC.diagnoseAll(t).flags.find(x => x.word === 'a');
    if (f) fail.push('ligne 47 témoin « ' + t + ' » : attendu rien, eu a → ' + f.sugg); }
}
function testListe46() {   // liste n° 46 : un mot capitalisé en début de phrase, inconnu, qui ne peut pas être un nom propre connu → orange
  for (const [t, w, s] of [['Le train part tard. Ensuitte nous marchons vers le port.', 'Ensuitte', 'Ensuite'],
      ['La réunion finit à midi\nToujorus la même salle au deuxième étage.', 'Toujorus', 'Toujours'], ['Il fait beau ce matin. Pourtnat la route reste glissante.', 'Pourtnat', 'Pourtant'],
      ['Fin du cours. Ensuitte L\'équipe range la salle.', 'Ensuitte', 'Ensuite'],
      // témoins : nom complet, initiale avant, 1re lettre changée, nom propre connu (table du Wiktionnaire) — rien
      ['Le concert commence. George Martin chante le premier titre.', 'George', null], ['Selon A. Henriet, rien ne change cette année.', 'Henriet', null],
      ['Le film sort demain. Camille arrive en retard.', 'Camille', null], ['La séance ouvre. Forbes publie son classement annuel.', 'Forbes', null],
      ['Le jury délibère. Holmes attend la réponse.', 'Holmes', null]]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s || f.tier !== 'vigilance'))
      fail.push('ligne 46 « ' + t + ' » : attendu ' + (s ? s + ' en vigilance' : 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
function testListe48() {   // liste n° 48 : mots réels mis pour un homophone (des/dès, prés/près, -ient/-ien, tan/tant, coli/colis)
  for (const [t, w, s, tier] of [['Les inscriptions ouvrent des le premier lundi du mois.', 'des', 'dès', 'auto'], ['Des lors, le projet avance vite.', 'Des', 'Dès', 'auto'],
      ['La gare est prés du centre.', 'prés', 'près', 'vigilance'], ['Nous attendons un entretient avec la directrice.', 'entretient', 'entretien', 'vigilance'],
      ['Le facteur a laissé un coli devant la porte.', 'coli', 'colis', 'vigilance'], ['Il reste tan de travail.', 'tan', 'tant', 'vigilance'],
      // témoins : le nom « prés », la couleur « tan », la bactérie, le verbe après un pronom — rien
      ['Les prés de la ferme sont verts.', 'prés', null], ['Il porte un pull tan.', 'tan', null], ['La bactérie E. coli se développe.', 'coli', null],
      ['Il le soutient chaque jour.', 'soutient', null]]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s || f.tier !== tier))
      fail.push('ligne 48 « ' + t + ' » : attendu ' + (s ? s + ' en ' + tier : 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
function testListe49() {   // liste n° 49 : participe écrit pour l'infinitif après « j'aime » (pronom élidé) ou un conditionnel de souhait
  for (const [t, w, s] of [["J'aime cuisiné pour mes amis.", 'cuisiné', 'cuisiner'], ['Je souhaiterais participé au projet.', 'participé', 'participer'],
      ['Elle voudrait visité le musée.', 'visité', 'visiter'], ["J'aime le travail bien fait.", 'fait', null], ['Je voudrais un café sucré.', 'sucré', null]]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s || f.tier !== 'auto'))
      fail.push('ligne 49 « ' + t + ' » : attendu ' + (s ? s + ' en auto' : 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
function testListe50() {   // liste n° 50 : impératif écrit à la 3e personne avant un pronom (« Dit-moi si tu… », « Sort-le »)
  for (const [t, w, s] of [['Dit-moi si tu viens ce soir.', 'Dit', 'Dis'], ['Sort-le de la boîte.', 'Sort', 'Sors'], ['Dit-il si tu viens ?', 'Dit', null]]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s || f.tier !== 'vigilance'))
      fail.push('ligne 50 « ' + t + ' » : attendu ' + (s ? s + ' en vigilance' : 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
function testListe51() {   // liste n° 51 : accents faux entrés dans le lexique (« aprés », « déja ») — plus jamais acceptés comme des mots
  for (const [t, w, s] of [['Nous partirons aprés le déjeuner.', 'aprés', 'après'], ['Elle est déja arrivée au bureau.', 'déja', 'déjà'],
      ['Il faut refléchir avant de signer.', 'refléchir', 'réfléchir'], ["Le livre parle d'une écriture genrée.", 'genrée', null]]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s || f.tier !== 'auto'))
      fail.push('ligne 51 « ' + t + ' » : attendu ' + (s ? s + ' en auto' : 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
function testListe53() {   // listes n° 53 à 62 (sauf 59) : 2e tour des textes de genre réel
  for (const [t, w, s, tier] of [["Il faut d'abort lire la notice.", "d'abort", "d'abord", 'flag'], ["D'acord, je viens.", "D'acord", "D'accord", 'flag'],
      ['Je commence le moi prochain.', 'moi', 'mois', 'vigilance'], ["Je n'est reçu aucun courrier.", "n'est", "n'ai", 'auto'],
      ["Je n'est pas content.", "n'est", 'ne suis', 'auto'], ['Nous partons cette été.', 'cette', 'cet', 'auto'], ['Cette homme parle fort.', 'Cette', 'Cet', 'vigilance'],
      ['Il fait ses devoir le soir.', 'devoir', 'devoirs', 'auto'], ['La fête aura lieux samedi.', 'lieux', 'lieu', 'vigilance'],
      ['Merci beaucoup est bonne soirée.', 'est', 'et', 'vigilance'], ['Il viendra te cherché à la gare.', 'cherché', 'chercher', 'auto'],
      ['Dis-moi ou en est le projet.', 'ou', 'où', 'vigilance'],
      // témoins : rien
      ['Le moi profond de chacun.', 'moi', null], ['Ce héros parle fort.', 'Ce', null], ['Il faut les savoir par cœur.', 'savoir', null],
      ['Il a visité les lieux hier.', 'lieux', null], ['Le repas est bon.', 'est', null], ['Il est malade ou en voyage.', 'ou', null]]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s || f.tier !== tier))
      fail.push('lignes 53-62 « ' + t + ' » : attendu ' + (s ? s + ' en ' + tier : 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
  const fi = DC.diagnoseAll('Je pars le moi prochain.').flags.find(x => x.name === 'impératif (pronom)');
  if (fi) fail.push('ligne 54 : « Je pars le moi prochain » ne doit pas devenir un impératif, eu ' + fi.sugg);
}
function testListe63() {   // listes n° 63 à 72 (sauf 64 et 71) : 3e tour des textes de genre réel
  for (const [t, w, s, tier] of [["Faite chauffer l'eau dans une casserole.", 'Faite', 'Faites', 'vigilance'],
      ["Le repas est bon, mes l'addition est salée.", 'mes', 'mais', 'auto'], ['Le garage ma rendu la voiture hier.', 'ma rendu', "m'a rendu", 'vigilance'],
      ["Avec ma sœur, on a fini en moin d'une semaine.", 'moin', 'moins', 'flag'], ['Je la recommende à mes voisins.', 'recommende', 'recommande', 'vigilance'],
      ["Personne n'ai venu ce matin.", "n'ai", "n'est", 'auto'], ["Dommage que le magasin n'ai pas ouvert.", "n'ai", "n'ait", 'auto'],
      ['Petit a petit, la neige fond.', 'a', 'à', 'auto'], ['Laissez cuir le riz dix minutes.', 'cuir', 'cuire', 'vigilance'],
      // témoins : rien
      ['Lui a lui aussi répondu.', 'a', null], ['Une porte en bois peinte.', 'peinte', null], ['Il a un menu varié.', 'menu', null]]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s || f.tier !== tier))
      fail.push('lignes 63-72 « ' + t + ' » : attendu ' + (s ? s + ' en ' + tier : 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
function testListe52() {   // liste n° 52 : coquilles entrées dans le lexique (« jammais », « avie ») — plus acceptées comme des mots
  for (const [t, w, s] of [['Il ne vient jammais le lundi.', 'jammais', 'jamais'], ['Je ne sais pas commant ouvrir la boîte.', 'commant', 'comment'],
      ['Il a reçu un avie favorable.', 'avie', 'avis'], ['Les iels de la classe votent.', 'iels', null]]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s))
      fail.push('ligne 52 « ' + t + ' » : attendu ' + (s || 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
function testListe73() {   // listes n° 73 à 76 : 4e tour des textes de genre réel
  for (const [t, w, s, tier] of [['Il aide sa tante a ranger le garage.', 'a', 'à', 'auto'], ['Nous avons hâte de te voire bientôt.', 'voire', 'voir', 'vigilance'],
      ["L'accueille de l'hôtel était parfait.", "L'accueille", "L'accueil", 'vigilance'], ['Elle a surtout aimer la fin du film.', 'aimer', 'aimé', 'auto'],
      // témoins : rien
      ["Ce qu'il a appris a changé sa vie.", 'a', null], ["Le roi l'accueille chez lui.", "l'accueille", null], ['Il viendra, voire plus tard.', 'voire', null]]) {
    const fl = DC.diagnoseAll(t).flags, f = fl.find(x => x.word === w && (s === null || x.sugg === s)) || fl.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s || f.tier !== tier))
      fail.push('lignes 73-76 « ' + t + ' » : attendu ' + (s ? s + ' en ' + tier : 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
  const fp = DC.diagnoseAll('Il aide sa tante a ranger le garage.').flags.find(x => x.word === 'ranger');
  if (fp) fail.push('ligne 73 : « ranger » (infinitif juste) ne doit plus être réécrit, eu ' + fp.sugg + ' en ' + fp.tier);
}
function testListe64() {   // liste n° 64 : « et » entre deux propositions — le sujet nominal après « et » est lu
  for (const [t, w, s] of [['Il pleut fort et le colis étais trempé.', 'étais', 'était'], ['Le vent souffle et les arbres plie.', 'plie', 'plient'],
      ['Le chat et le chien mangent.', 'mangent', null], ['La chanteuse et son fils chantent ensemble.', 'chantent', null]]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s || f.tier !== 'vigilance'))
      fail.push('ligne 64 « ' + t + ' » : attendu ' + (s ? s + ' en vigilance' : 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
function testListe78() {   // listes n° 78 à 83 (sauf 80 et 82) : 5e tour des textes de genre réel
  for (const [t, w, s, tier] of [['Excusez-nous pour la gène occasionnée.', 'gène', 'gêne', 'vigilance'], ["Si besoin, n'hésiter pas à nous écrire.", "n'hésiter", "n'hésitez", 'vigilance'],
      ["Je t'appel demain matin.", "t'appel", "t'appelle", 'vigilance'],
      ['Un vieil homme qui les aides souvent.', 'aides', 'aide', 'auto'],
      // témoins : rien
      ['Ce gène est rare.', 'gène', null], ['Il préfère ne pas hésiter.', 'hésiter', null], ["Je t'appelle demain matin.", "t'appelle", null]]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s || f.tier !== tier))
      fail.push('lignes 78-83 « ' + t + ' » : attendu ' + (s ? s + ' en ' + tier : 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
function testListe84() {   // liste n° 84 : participe d'un verbe sans complément d'objet direct — jamais accordé avec le « que » qui précède (avoir)
  for (const [t, w, s] of [["La plateforme qu'ils ont accédé hier est fermée.", 'accédé', null], ["La route qu'ils ont abouti était longue.", 'abouti', null],
      // témoin : un verbe transitif direct garde son accord
      ["La lettre qu'il a écrit hier est arrivée.", 'écrit', 'écrite']]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w && x.name === 'accord participe (COD avoir)');
    if (s === null ? !!f : (!f || f.sugg !== s))
      fail.push('ligne 84 « ' + t + ' » : attendu ' + (s ? s : 'aucun accord') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
function testListe85() {   // liste n° 85 : retomber, provenir, advenir ne se conjuguent qu'avec être
  for (const [t, w, s] of [['Il a retombé dans ses vieilles habitudes.', 'a', 'est'], ['Il est retombé dans ses vieilles habitudes.', 'est', null]]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s))
      fail.push('ligne 85 « ' + t + ' » : attendu ' + (s ? s : 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
function testListe82() {   // liste n° 82 : « sa meilleur amie » — un nom aussi adjectif (amie, voisine) manquait au genre pur
  for (const [t, w, s] of [["C'est sa meilleur amie depuis l'école.", 'meilleur', 'meilleure'], ['Elle passe la soirée chez sa grand voisine.', 'grand', 'grande'],
      // témoins : rien
      ["C'est sa meilleure amie depuis l'école.", 'meilleure', null], ['Une nation amie nous aide.', 'amie', null]]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s))
      fail.push('ligne 82 « ' + t + ' » : attendu ' + (s ? s : 'rien') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
function testListe36() {
  if (typeof _DECL2 === 'undefined' || !_DECL2.g2p) fail.push('liste n° 36 : assets/g2p.js non chargé sous Node — la règle du son serait muette et ce banc vert par omission');
  for (const [t, w, s, tier] of [['Il a ttreize ans.', 'ttreize', 'treize', 'vigilance'], ['Elle a treizze ans.', 'treizze', 'treize', 'vigilance'],
      ['Je vais empployer ce mot.', 'empployer', 'employer', 'vigilance'], ['Un outil permettan de lire.', 'permettan', 'permettant', 'vigilance'],
      ['Il a mal au ddos.', 'ddos', 'dos', 'vigilance'], ['Il ccontrôlait tout.', 'ccontrôlait', 'contrôlait', 'flag']]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (!f || f.sugg !== s || f.tier !== tier) fail.push('liste n° 36 « ' + t + ' » : attendu ' + s + ' en ' + tier + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
function testListe5b() {
  for (const [t, w, s, tier] of [['Elève de troisième.', 'Elève', 'Élève'], ['Etonnés par la nouvelle.', 'Etonnés', 'Étonnés', 'vigilance'],
      ['Il est juge.', 'juge', null], ['Elle est élève.', 'élève', null], ['Il est guide de montagne.', 'guide', null], ['Elle est interprète.', 'interprète', null],
      ['Elle a aimè ce livre.', 'aimè', 'aimé'], ['Il a donnè sa parole.', 'donnè', 'donné'],
      ['Il posséde une maison.', 'posséde', 'possède'], ['Il vient méme demain.', 'méme', 'même'], ['Il a visitè Rome.', 'visitè', 'visité'], ['Il est tombe.', 'tombe', 'tombé']]) {
    const f = DC.diagnoseAll(t).flags.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s || (tier && f.tier !== tier)))
      fail.push('liste n° 5b « ' + t + ' » : attendu ' + (s || 'rien') + (tier ? ' en ' + tier : '') + ', eu ' + (f ? f.sugg + ' en ' + f.tier : 'rien')); }
}
function testListe20() {
  for (const [t, w, s] of [['Des stages : avr. 2021', 'avr', null], ['Des équipes motivées, organisation opérationnelle', 'organisation', null],
      ['Les pages produit', 'produit', null], ['Les photos produit et service se renouvellent.', 'renouvellent', null],
      ['Des pommes rouges, juteuse et sucrées.', 'juteuse', 'juteuses'], ['Les usines produit des voitures.', 'produit', 'produisent'],
      ['Les équipes travaille.', 'travaille', 'travaillent'],
      // ⭐ LISTE N° 1d : deux rouges contradictoires — le verbe coordonné s'accordait sur un premier verbe lui-même fautif. Les deux premiers
      // échouent sur le moteur d'avant ; témoins : premier verbe juste (pronom, sujet nominal).
      ['Les enfants mange et dorment.', 'dorment', null], ['Les chats miaule et ronronnent.', 'ronronnent', null],
      ['Il chante et dansent.', 'dansent', 'danse'], ['Les enfants mangent et dort.', 'dort', 'dorment'],
      // ⭐ LISTE N° 21 : anglicismes de métier pris pour des fautes (picking → packing, dev → devez, process → proces EN ROUGE, une start-up → un).
      // Les six premiers échouent sur le moteur d'avant ; témoin : le genre d'un composé français (« une chou-fleur ») reste vérifié.
      ['Elle prépare les colis au picking.', 'picking', null], ['Il code comme dev web.', 'dev', null], ['Nos apps tournent bien.', 'apps', null],
      ['Le chatbot répond vite.', 'chatbot', null], ['Un process simple aide l\'équipe.', 'process', null], ['Elle fonde une start-up.', 'une', null],
      ['Elle mange une chou-fleur.', 'une', 'un'],
      // ⭐ LISTE N° 22 : les mots d'un courriel, d'un lien ou d'un nom de site ne sont plus corrigés (« velo » → vélo EN ROUGE dans un lien).
      // Les trois premiers échouent sur le moteur d'avant ; témoin : la faute de la phrase autour reste corrigée.
      ['Écrivez à lea.durand@gmail.com demain.', 'gmail', null], ['Site : www.atelier-velo-exemple.fr', 'velo', null],
      ['Mon adresse marcvelo@hotmail.fr est valide.', 'hotmail', null], ['Les enfant joue au parc.', 'enfant', 'enfants'],
      // ⭐ LISTE N° 24 : le contexte de nombre de l'orthographe ne traverse plus une préposition ni « qui » ; « d'une » se lit « une ».
      // Les deux premiers échouent sur le moteur d'avant ; témoins (pertes vues en mesurant les variantes) : la copule porte le nombre,
      // « qui » appelle un verbe conjugué.
      ['Les deux voleurs finirent en priosn.', 'priosn', 'prison'], ['C\'est le début d\'une guerre civille.', 'civille', 'civile'],
      ['Les étoiles qui sont visiblse brillent.', 'visiblse', 'visibles'], ['Le bouton qui délenche l\'alarme.', 'délenche', 'déclenche']]) {
    const fl = DC.diagnoseAll(t).flags, f = fl.find(x => x.word === w);
    if (s === null ? !!f : (!f || f.sugg !== s)) fail.push('listes n° 20, 1d, 21, 22 et 24 « ' + t + ' » : attendu ' + (s === null ? 'rien' : '« ' + s + ' »') + ', eu ' + JSON.stringify(fl.map(x => [x.word, x.sugg, x.name]))); }
}
function finish(parityKO) {
  testListe12();
  testListe19();
  testListe20();
  testListe23();
  testListe26();
  testListe5b();
  testListe35();
  testListe36();
  testListe38();
  testListe43();
  testListe45();
  testListe48();
  testListe49();
  testListe50();
  testListe53();
  testListe63();
  testListe73();
  testListe78();
  testListe82();
  testListe84();
  testListe85();
  testListe52();
  testListe64();
  testListe47();
  testListe51();
  testListe42();
  testListe44();
  testListe46();
  testListe34();
  testListe32();
  testListe7();
  testListe33();
  testListe31();
  gardeIndexRare().catch(e => fail.push('repli phonétique : garde en erreur — ' + e.message)).then(() => conclure(parityKO));
}
function conclure(parityKO) {
  if (fail.length) { console.error('✗ ÉCHEC (comportement) :\n  ' + fail.join('\n  ')); process.exit(1); }
  if (parityKO) { console.error('✗ PARITÉ KO : ' + parityKO + ' input(s) où ext ≠ app'); process.exit(1); }
  console.log('✓ OK : speller extension — AUTO FP=0, hybride (fote→faute, premiere→premier), accent-POS (élève/élevé), élision, 📗 du dictionnaire (offert là où il fait taire le signalement), repli phonétique bâti en tâche de fond, ET parité directe ext ≡ app.');
  process.exit(0);
}
