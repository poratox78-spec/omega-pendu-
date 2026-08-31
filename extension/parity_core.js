// Parité EXTENSION ↔ Python du correcteur : charge dys-core.js (le moteur de l'extension) avec les assets
// extraits, et compare correctText() au probe Python (dictee/correcteur_probe.py) sur la même batterie que
// dictee/parity_corr.js. Garantit que l'extension corrige EXACTEMENT comme la référence (aucun FP propre).
//   node extension/parity_core.js
const fs = require('fs'), path = require('path'), cp = require('child_process'), zlib = require('zlib');
const HERE = __dirname, ROOT = path.join(HERE, '..');

// 1) charger le moteur + injecter les lexiques (assets) — setLex synchrone (pas de fetch en Node)
require(path.join(HERE, 'dys-core.js'));
const DYSCORE = global.DYSCORE;
const vdc = JSON.parse(fs.readFileSync(path.join(HERE, 'assets', 'vdc-lex.json'), 'utf8'));
const grText = zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'assets', 'gender-relaxed.tsv.gz'))).toString('utf8');
/* ⚠️ LE LEXIQUE SPELLER FAIT PARTIE DE L'ÉQUIPEMENT DE LA GRAMMAIRE. Il n'était pas injecté ici, et
   `rInfBut` (infinitif de but) sort tout de suite sur `if(!SP.ready)` : la règle aurait été MUETTE
   dans ce harnais, donc verte par omission — le piège exact du 2026-08-11. Un harnais doit équiper
   le moteur comme le produit, pas moins. */
DYSCORE.setLex(vdc, grText, zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'assets', 'speller.tsv.gz'))).toString('utf8'));
DYSCORE.setNounPost(zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'assets', 'noun-post.txt.gz'))).toString('utf8'));        // posterior §3 (parité genre + accord pluriel du nom)
DYSCORE.setPosHmm(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'assets', 'pos-hmm.json.gz'))).toString('utf8')));   // POS-tagger HMM (parité son/sont sujet-nom via posTags)
DYSCORE.setPrenoms(zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'assets', 'prenoms.tsv.gz'))).toString('utf8'));   // GENRE des PRÉNOMS : sans cette injection l'extension testée n'aurait aucun prénom et la parité serait verte sur une règle qui ne tourne pas.
DYSCORE.setGaccLex(zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'assets', 'gender-acc.json.gz'))).toString('utf8'));   // genre ACCENTUÉ complet (Morphalou 2026-08-24) : même piège que ci-dessus sans cette injection.

// 2) même batterie que dictee/parity_corr.js (homophones + accord + genre + mais/mes + j'est + pluriel du nom)
const PHRASES = [
  // INFINITIF DE BUT (PR en cours) — cibles ET pièges du participe ADJECTIVAL, qui est ce qui décide
  // de la forme de la règle. Les pièges comptent autant que les cibles : « épuisé » ne doit JAMAIS
  // devenir « épuiser ».
  'Je suis allé à la plage mangé des champignons.', 'Il est parti au marché acheté du pain.',
  'Je suis allé chez lui cherché mes affaires.', 'Elle est allée à la boulangerie acheté une baguette.',
  'Je suis rentré à la maison épuisé.', 'Il est allé à la fête déguisé en pirate.',
  'Elle est venue à la maison fatiguée hier.', 'Ils sont partis sur le tracé du circuit.',
  // PRÉNOMS — mêmes cas que dictee/parity_corr.js : fautes, phrases correctes, et les deux gardes
  // (coordination = sujet réel PLURIEL ; tête de proposition = majuscule ambiguë).
  'Marie est venu.', 'Julie est parti.', 'Sophie est content.', 'Léa est arrivé.',
  'ma soeur Julie est parti.', 'Marie est venue.', 'Julie est partie.',
  'Le charme et le sourire d’Helène et Olivier ont fini de nous conquérir.',
  'Pierre est venue.', 'Avril est arrivé.', 'Rose est fanée.',
  'les enfant joue', 'des oiseau dans le ciel', 'les cheval galopent', 'il a des difficulté', 'des journal locaux',
  'les département français', 'des hit parades', 'il les porte', 'il les livre à domicile', 'les rouge vif', 'des chat noirs',
  // accord pluriel du nom via CARDINAL ≥2 (« cinq kilo »→kilos) — ROUGE FP=0 par l'ANCRE : cibles + pièges (invariable/nombre/composé/déjà pluriel/élision)
  'cinq kilo', 'trois chat', 'quatre journal', 'cinq cheval', 'soixante mètre',
  'cinq minima', 'cinq maxima', 'cent trente', 'deux mille', 'cinq euros', 'dix-septième arrondissement', 'vingt pour cent', 'cinq chats', 'trois cents personnes', "quatre d'entre eux",
  // pluriels SUPPLÉTIFS (morpho impossible → liste close _PL_SUPPL) — ROUGE FP=0 : cibles + pièges (déjà pluriel / propre)
  'des oeil', 'les oeil', 'cinq monsieur', 'des madame', 'trois mademoiselle', 'les bonhomme', 'des gentilhomme', 'cinq bail', 'des travail',
  'des yeux', 'les messieurs', 'des chevaux',
  // ligature œ (NOUN_POST/gardes clavés en 'oe' → normalisation œ→oe) : cibles + contrôles
  'des œil', 'des œuvre', 'des cœur', 'les sœur', 'des bœuf', 'des œuvres', 'un œil',
  'Les enfant joue dans le jardin et il sont content. Je doit manger. On ont gagné. à mon avis.',
  'Je doit partir', 'Tu doit venir', 'Il ont faim', 'Elles a faim', 'On ont gagné', 'Ils doit manger',
  'Je peux venir', 'Tu manges bien', 'Il nous voit', 'Nous mangeons', 'Vous êtes prêts', 'Il y a un chat',
  'je suis content', 'ils doivent partir', 'elle veut partir', 'Il a mangé la soupe', 'Les enfants sont contents',
  'Elle a trouvé un trésor', 'Il prend ce livre', 'Le chat se trouve là', 'Je leur parle souvent',
  'les enfants joue dans le jardin et ils ont content', 'Les oiseaux chante le matin', 'Les voitures roule vite',
  'les chats mange', 'Les chevaux galopent à travers les champs', 'le chat les regarde',
  'Sur la table reposait les dossiers', 'Vient ensuite les vérifications', 'Que pense les clients', 'Ici travaille les équipes',
  'Ainsi se termine les négociations', 'Sur la table repose un livre', 'Il a des origines lointaines', 'La commune se situe en Gaume et comprend les villages',
  "Les résultats de l'enquête nous parviendra dans la journée", "L'entreprise contacte les clients", "Le prix de l'essence augmente", 'Les rapports envoyés hier contient une erreur', 'Les voitures garées dans la rue bloque le passage', 'Les livres rangés sur la table sont neufs',
  // accord SV — VERBE homographe raté par l'émission HMM (filet _di ∉ GENDER/ADJP) : cibles + contrôles (nom homographe → abstention)
  'Les problèmes signalés persiste encore', 'Les tuyaux sous la maison fuit', 'Les articles de la loi précise les règles',
  // accord VERBE COORDONNÉ (sujet récupéré du verbe frère, rule_accord_verb_coord) : cibles + contrôles (sujets diff., passé composé, coord nominale)
  'les chats mangent et dort', 'les oiseaux volent et chante', 'les femmes travaillent et parle', 'les moteurs chauffaient et vibrait',
  'il court et saute', 'les filles chantent et ont dansé', 'le chien et le chat dort', 'je lis et tu dort',
  'la bande de gens arrivent', 'le groupe de touristes partent', 'une nuée de moustiques attaquent',   // collectif → accord de sens ambigu → abstention (FP « bande de connards arrivent »→arrive tué)
  'Les cours du soir attirent du monde', 'Le reste du groupe est parti', 'Les parts de marché augmentent', 'Les critiques du film sont sévères',
  // accord via RELATIVE-OBJET « que » (sujet récupéré de l'antécédent, séparé par la relative, rule_accord_rel_obj) : cibles + contrôles (complétif/qui/antécédent sing./subordonnant)
  'les enfants que je vois joue', 'les gens que je connais vient demain', 'les erreurs que le prof corrige persiste', 'les rumeurs que les gens colportent circule',
  'je crois que les chats dorment', 'le livre que je lis est bon', 'dès que les invités arrivent le repas commence', 'les enfants qui jouent sont contents', 'les fleurs que la voisine cultive sentent bon',
  // ancre relative ÉTENDUE à « dont » (de-relatif) + « où » ACCENTUÉ (locatif) — toujours relatifs, jamais complétifs : cibles + contrôles (antécédent sing., de-N complément, 3pl)
  'les sujets dont on parle intéresse', 'les problèmes dont il parle persiste', 'les endroits où on va coûte cher',
  'le sujet dont je parle reste flou', 'le nombre de choses dont on parle augmente', 'la façon dont il parle agace', "l'endroit où les gens vivent est calme", 'les auteurs dont on cite les livres sont morts',
  // accord SV à travers une INCISE (sujet interrompu par une parenthèse à virgules, rule_accord_incise) : cibles + contrôles (énumération, de-N en tête, sujet sing., antéposition locative, incise verbale/pronom)
  'les livres, malgré leur prix, reste chers', 'les élèves, malgré la fatigue, travaille bien', 'les moteurs, sous la pluie, chauffe vite', 'les acteurs, connus du public, joue faux',
  'le prix des vacances, lui, reste élevé', 'le train, les jours de grève, arrive en retard', 'dans les jardins, la fleur pousse', 'les chiens, les chats, les oiseaux vivent ici', 'les prix, semble-t-il, augmente', 'les enfants et les parents, ravis, applaudissent',
  // COULEURS/MATIÈRES invariables (nom/fruit/pierre + composées) : filet SV ne doit PLUS les prendre pour des verbes (_INVAR_COLOR)
  'des gants crème', 'des chemises bleu marine', 'des rideaux émeraude', 'des nappes saumon', 'une écharpe turquoise', 'des reflets cuivre', 'des tons olive', 'des murs ocre',
  // QUANTIFIEUR « la plupart DU/DES » + verbe (nombre du complément) + « nombre de N » nu (pluriel) : cibles + FP tués
  'la plupart des gens pensent le contraire', 'la plupart du temps suffit amplement', 'nombre de spécialistes doutent encore', 'la majorité des élèves réussissent', 'la plupart du gâteau a disparu',
  // filet homographe ÉTENDU aux règles SV sœurs (coord/quant/postpose) + contrôles FP (prép/dét-avant : Entre/un modèle)
  'Les cris et les rires persiste', 'Beaucoup de dossiers empile', 'Ainsi persiste les rumeurs',
  'Entre les deux guerres il enseigne les maths', 'Le consortium veut entretenir un modèle',
  'Il a une chien', 'Elle ouvre un maison', 'la fondateur', 'un mer de nuages', 'le montagne',
  'Il a un chien', 'Le jardin est vert', 'il prend la porte', 'un livre intéressant', 'la tour est haute',
  'et j\'ai bouliées mais lunettes', 'mais voiture est rouge', 'il dort mais porte un sac', 'Mais sous la table',
  'il rit mais pleure souvent', 'mais place est prise',
  'j\'est le poisse de oartir à la monagne', 'j\'est un chien', 'J\'est la chance', 'j\'est content',
  'j\'est allé à Paris', 'j\'est de la peine', 'j\'est du mal', 'j\'est venu hier', 'j\'est de Paris',
  "j'sais que c'est vrai", "Personne n'sait où il est", "qu'tu viennes", "l'homme est là", "d'abord",
  "Ils détestons les épinards", "Ils réunissons les gens", "Ils chantent faux",
  'c\'est bien', 'qu\'est-ce que tu fais', 'j\'ai un chien',
  'elles sente bon', 'ils parte demain', 'elles mette la table', 'elles sentent bon', 'ils tienne bon', 'elles prenne le train', 'elles vies', 'ils ne sont pas transformé', 'elles sont allé',
  // accord SINGULIER du nom (déterminant singulier + nom pluriel → sing.) : cibles + pièges (invariant / nombre-écran / verbe)
  'Le camps est installé', 'Un soucis de simplification', 'Chaque jours compte', 'La voitures rouge passe', 'Ce systemes marche',
  'Le fils de Paul', 'Un temps magnifique', 'La paix règne', 'Le savons est bon', 'Il est né le 25 mars 1957', 'un des systèmes',
  // FP homophones corrigés par WiCoPaCo (verrou anti-régression)
  'On dit que le ciel est bleu', 'Le Ba fait souffrir ceux qui ont commis le mal', "L'état et le gouvernement ont investit",
  'Ils ont une vie à durée limitée', 'Le chipset offre un son stéréo', 'Ils on grandi vite',
  // accord PARTICIPE après être à sujet NOM (branche _np_subject) : cibles + pièges
  'Le niveau de la population est estimée à trente pour cent', 'La biologie est apparu au vingtième siècle',
  'Le Brésil est composés de régions', 'La Bulgarie est connues pour ses monastères', 'Une partie du cours fut modifié',
  'Le chat est noir', 'Elle est venue hier', 'La reprise est annoncée', 'Les plats sont bons',
  // PP perception/factitif + INFINITIF = INVARIABLE (piège Voltaire, FP cru trouvé par Rem) : cibles invariables + contrôles (accord normal SANS infinitif)
  'ma belle-mère se les était vu confisquer à la douane', "les gens que j'ai fait venir", "elle s'est fait avoir", "elle s'est laissé tomber", "les airs que j'ai entendu jouer",
  "les erreurs que j'ai fait", "les fleurs que j'ai cueilli", 'elle est venu hier',
  // terminaison -er/-é : gouverneur être, clitique réfléchi, causatif
  'Il a été fabriquer par un dieu', 'Le pays veut se séparé du groupe', 'On va faire évolué le code',
  'Il fait déclaré la guerre', 'Il ne faut pas utilisé de câble', 'Les origines de la cité remontent', 'Un fait divers tragique',
  // accord adjectif ÉPITHÈTE (article + nom + adj) : cibles + pièges
  'Les domaines industriel progressent', 'Une décision mondial', 'La commission présidentiel est là',
  'Le mois dernier fut chaud', 'Un cursus professionnel', 'La voiture rouge passe', 'Les sites allemand et français',
  // sujet « je » mal écrit devant être 1sg (ke/ge/ce/se + suis/serai/serais) : cibles + pièges (me/te/le valides, être 3sg, réfléchi)
  'ke suis fatigué', 'ce suis venu hier', 'se suis là', 'ge suis content', 'Ke suis pas sûr', 'ke serais content',
  'tu suis le guide', 'je me suis lavé', 'je te suis partout', 'je le suis de près', 'ce serait bien', 'ce sont mes amis', 'il se lave les mains',
  // famille /sɛ/ : je/tu + c'est/ces/ses/sait → sais ; c'est → s'est à travers un adverbe. Pièges : ces/ses corrects, tu sais, c'est vrai
  "je c'est pas", 'tu ces content', 'je sait nager', "elle c'est bien amusée", "il c'est levé",
  'tu sais la réponse', 'ces enfants jouent', 'ses livres sont là', "c'est vrai", "elle s'est bien amusée", "je sais que c'est bon",
  // accord SV vouloir (slot 1s/2s réparé — Lexique mis-étiquetait « veux » pluriel) : cibles + pièges corrects
  'je veut partir', 'tu veut venir', 'il veut partir', 'je veux partir', 'nous voulons partir',
  // -ais→-ait : personne (verbe imparfait 1sg sous sujet-nom 3sg) — cibles + pièges corrects (je/tu, pluriel)
  'Mon collègue vérifiais les comptes', 'Le technicien réparais la machine', 'Je gardais le secret', 'Tu regardais la télévision', 'Les responsables installais tout',
  // son/sont SUJET-NOM (pilote _clauseNoFiniteVerb) — ces 6 cas étaient dans dictee/parity_corr.js mais
  // ABSENTS ici malgré l'en-tête « même batterie » (trou de sonde trouvé par l'enquête détection-du-sujet).
  'les chats son venus.', 'les enfants son venus.', 'les chats son partis.',
  'les poules son dans le jardin.', 'le son de la cloche résonne.', 'son ancienne équipe a gagné.',
  // PRONOM ÉLIDÉ (_prevPron, 30/08/2026) : cibles (5 règles rataient l'élidé) + gardes (français CORRECT :
  // « et lorsqu'elle dort » cassé en dorment par rAccordVerbCoord avant le correctif — rester muet).
  "Lorsqu'il à faim.", "Puisqu'elle c'est levée.", "Puisqu'il ce regarde.", "puisqu'il mangeai une pomme.",
  "Je crois qu'elle est parti.", "Il pense qu'ils son partis.",
  "Les chats mangent et lorsqu'elle dort.", "Ils chantaient et puisqu'elle dansait.", "Les chats mangent et s'il dort.",
  "Lorsqu'il a faim.", "Puisqu'elle s'est levée.", "Je crois qu'elle est partie.", "Les chats mangent et lorsqu'elle dorment.",
  // BORNES PRÉDITES (canal pb, 31/08/2026) : multi-propositions SANS ponctuation — cibles (la garde
  // verbe-présence redevient utilisable) + témoins corrects (doivent rester muets dans les 3 moteurs).
  'les poules son dans le jardin quand il fait beau', 'les enfants son partis quand il a appelé',
  'les chiens son gentils lorsque leur maître arrive', 'ce chien et gentil quand il mange',
  'il mange un peut de pain quand il rentre',
  'le son de la cloche résonne quand il fait beau', 'les poules sont dans le jardin quand il fait beau',
  'son chien dort lorsque la nuit tombe', 'il a peur car son ami est parti',
  // GARDE p3 ASSOUPLIE + IDIOME D'AVOIR (31/08) : cibles (forme 1re/2e sous sujet nominal, prénom inclus)
  // + témoins (épithète homographe-verbe, préposition hors liste, vrais 1re/2e pers.).
  'Marie es gentille', 'La fillette as peur', 'ma soeur vas au marché', 'le train arrivais en retard',
  'Marie chantent bien', 'mes amis on raison',
  'Les articles conformes passent', 'selon les experts on peut venir', 'toi qui as faim', 'tu vas au marché',
  'Marie est gentille', 'Dans ses statistiques on voit bien'
];

// 3) flags Python
const py = cp.spawnSync('python3', ['-c', `
import sys, json
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'dictee'))})
import correcteur_probe as C
ph = json.loads(sys.stdin.read())
print(json.dumps([[(i, w, s, n) for (i, w, s, n) in C.correct(p)] for p in ph]))
`], { input: JSON.stringify(PHRASES), encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });   // Windows : stdin cp1252 → mojibake → faux KO (audit)
if (py.status !== 0) { console.error('probe Python échoué :', py.stderr); process.exit(2); }
const pyflags = JSON.parse(py.stdout);

// 4) invariant : flags EXTENSION ⊆ flags Python (aucun FP propre ; couverture moindre tolérée = lexique HF)
let appOnly = 0, gap = 0;
const key = x => x[0] + '|' + String(x[1]).toLowerCase() + '|' + String(x[2]).toLowerCase();
PHRASES.forEach((p, k) => {
  const js = DYSCORE.correctText(p).map(f => [f.i, f.word, f.sugg, f.name]);
  const pf = pyflags[k];
  const pset = new Set(pf.map(key));
  const extra = js.filter(x => !pset.has(key(x)));
  if (extra.length) { appOnly++; console.log('✗ EXT flague hors Python :', JSON.stringify(p), JSON.stringify(extra)); }
  if (js.length < pf.length) { gap++; console.log('  (couverture) PY > EXT :', JSON.stringify(p), '| PY=' + JSON.stringify(pf) + ' EXT=' + JSON.stringify(js)); }
});
/* PALIERS (2026-08-22) — rouge/orange par SOUS-CAS mesuré sur texte dys (correcteur_probe.tier_of ↔ _tierOf) :
   pour chaque correction émise des DEUX côtés, le palier doit être le MÊME. Un désaccord = une famille
   appliquée d'office d'un côté et au clic de l'autre — le produit ne serait plus le même sur le site et
   dans l'extension. */
const pyT = cp.spawnSync('python3', ['-c', `
import sys, json
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'dictee'))})
import correcteur_probe as C
ph = json.loads(sys.stdin.read())
print(json.dumps([[(i, w, s, n, t) for (i, w, s, n, t) in C.correct_tiered(p)] for p in ph]))
`], { input: JSON.stringify(PHRASES), encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });
if (pyT.status !== 0) { console.error('probe Python (paliers) échoué :', pyT.stderr); process.exit(2); }
const pyTiers = JSON.parse(pyT.stdout);
let _tierKo = 0, _tierCmp = 0;
PHRASES.forEach((p, k) => {
  const byKey = {}; pyTiers[k].forEach(x => { byKey[key(x)] = x[4]; });
  DYSCORE.correctText(p).forEach(f => {
    const kk = key([f.i, f.word, f.sugg]); if (byKey[kk] === undefined) return;
    if (f.vigRule) return;   // orange décidé par la RÈGLE elle-même (homographe ambigu : « Le savons »), logique JS-only déjà couverte par parity_os — hors périmètre des paliers par famille
    _tierCmp++;
    if ((f.tier || 'auto') !== byKey[kk]) { _tierKo++; console.log('✗ PALIER : ' + JSON.stringify(p) + ' « ' + f.word + '→' + f.sugg + ' » ext=' + (f.tier || 'auto') + ' python=' + byKey[kk]); }
  });
});
if (_tierKo) { console.log('PARITÉ KO — ' + _tierKo + ' palier(s) rouge/orange différents ext ↔ Python.'); process.exit(1); }
console.log('  ✓ paliers rouge/orange identiques ext ↔ Python sur ' + _tierCmp + ' corrections');

/* GARDE PRÉNOMS — « ext ⊆ Python » est unidirectionnel : sans table, l'extension n'émettrait rien
   et la parité resterait verte. On exige que l'extension PRODUISE ces corrections (miroir app). */
const _ATT = [['Marie est venu.', 'venue'], ['Julie est parti.', 'partie'],
              ['Sophie est content.', 'contente'], ['Léa est arrivé.', 'arrivée'],
              ['ma soeur Julie est parti.', 'partie']];
let _pren = 0;
for (const [ph, att] of _ATT) {
  const got = DYSCORE.correctText(ph).map(f => String(f.sugg).toLowerCase());
  if (!got.includes(att)) { _pren++; console.log("✗ PRÉNOMS : dys-core ne corrige plus", JSON.stringify(ph), "→", att, "(eu " + JSON.stringify(got) + ")"); }
}
if (_pren) { console.log("PARITÉ KO — " + _pren + " cas prénom non corrigés par l'extension."); process.exit(1); }


/* GARDE « UN SEUL SENS PAR DÉSACCORD » — deux ROUGES ne doivent pas se contredire.
   « leurs tige » : rLeur (rang 15) voulait « leurs »->« leur », rNounPlural (rang 47) voulait
   « tige »->« tiges ». Tokens DIFFÉRENTS => les deux s'appliquaient => « leur tiges », une faute
   FABRIQUÉE. Mesuré sur 99 désaccords appariés : le gold corrige le NOM 59 fois contre 12 le
   déterminant. On exige donc le nom, ET l'absence de la correction du déterminant.
   Le 3e cas est le REPLI : « livre » est ambigu verbe, rNounPlural s'abstient, donc rLeur doit
   reprendre la main — sans lui, on perdrait la correction au lieu de la déplacer. */
const _DESAC = [['la nourriture de leurs tige', 'tiges', 'leur'],
                ['elle aime leurs jardin', 'jardins', 'leur'],
                ['il range leurs livre', 'leur', null]];
let _des = 0;
for (const [ph, exige, interdit] of _DESAC) {
  const got = DYSCORE.correctText(ph).map(f => String(f.sugg).toLowerCase());
  if (!got.includes(exige)) { _des++; console.log('✗ DÉSACCORD : ' + JSON.stringify(ph) + ' doit corriger vers « ' + exige +' », eu ' + JSON.stringify(got)); }
  if (interdit && got.includes(interdit)) { _des++; console.log('✗ DÉSACCORD : ' + JSON.stringify(ph) + ' ne doit PAS proposer « ' + interdit + ' » (deux rouges contradictoires)'); }
}
if (_des) { console.log('PARITÉ KO — ' + _des + ' conflit(s) de direction déterminant/nom.'); process.exit(1); }


/* GARDE « INFINITIF DE BUT » — le rappel ET les pièges.
   « app ⊆ Python » est unidirectionnel : un moteur MUET passerait la parité. On exige donc que la
   correction SORTE, et surtout que le participe ADJECTIVAL ne bouge PAS — c'est lui qui a dicté les
   trois gardes de la règle (verbe pur, objet direct derrière, gouverneur licencié).
   Mesuré : 4 cibles /4, 0 piège /4, et 1 seul tir sur 14 450 phrases UD correctes — « Ran va-t-elle
   épousé le docteur ? », une VRAIE faute du corpus. */
const _BUT_OUI = [['Je suis allé à la plage mangé des champignons.', 'manger'],
                  ['Il est parti au marché acheté du pain.', 'acheter'],
                  ['Je suis allé chez lui cherché mes affaires.', 'chercher']];
const _BUT_NON = ['Je suis rentré à la maison épuisé.', 'Il est allé à la fête déguisé en pirate.',
                  'Elle est venue à la maison fatiguée hier.', 'Ils sont partis sur le tracé du circuit.'];
let _but = 0;
for (const [ph, att] of _BUT_OUI) {
  const got = DYSCORE.correctText(ph).map(f => String(f.sugg).toLowerCase());
  if (!got.includes(att)) { _but++; console.log('✗ INFINITIF DE BUT : ' + JSON.stringify(ph) + ' doit donner « ' + att + ' », eu ' + JSON.stringify(got)); }
}
for (const ph of _BUT_NON) {
  const got = DYSCORE.correctText(ph).filter(f => f.name === 'infinitif de but');
  if (got.length) { _but++; console.log('✗ PIÈGE ADJECTIVAL : ' + JSON.stringify(ph) + ' ne doit RIEN donner, eu ' + JSON.stringify(got.map(f => f.word + '->' + f.sugg))); }
}
if (_but) { console.log('PARITÉ KO — ' + _but + ' cas « infinitif de but ».'); process.exit(1); }


/* GARDE « MÊME PIPELINE QUE LE SITE » — la parité compare le REGISTRE de règles (`correctText`),
   PAS le pipeline. Le 2026-08-11 on a découvert que `diagnoseAll` — la fonction que `content.js`
   appelle vraiment — lançait la grammaire sur le texte BRUT, sans la pyramide ortho→grammaire ni la
   cascade du site. Résultat MESURÉ sur 621 paires : 2 corrections que SEULE l'extension produisait,
   et les DEUX étaient FAUSSES parce que la grammaire s'appliquait au mot mal orthographié.
   Ces deux cas sont donc la garde : ils n'ont de bonne réponse QUE si la pyramide est là. */
const _PYR = [['Leurs racines les défendent contre les vènt et vont chercher', 'vents', 'vènts'],
              ['La tigés elle-même se revêt', 'tige', 'tigé']];
let _pyr = 0;
for (const [ph, exige, interdit] of _PYR) {
  const got = (DYSCORE.diagnoseAll(ph).flags || []).filter(f => f.sugg).map(f => String(f.sugg).toLowerCase());
  if (!got.includes(exige)) { _pyr++; console.log('✗ PIPELINE : ' + JSON.stringify(ph) + ' doit donner « ' + exige + ' » (pyramide ortho→grammaire), eu ' + JSON.stringify(got)); }
  if (got.includes(interdit)) { _pyr++; console.log('✗ PIPELINE : ' + JSON.stringify(ph) + ' ne doit PAS donner « ' + interdit + ' » — la grammaire a vu le mot NON corrigé'); }
}
if (_pyr) { console.log('PARITÉ KO — ' + _pyr + ' écart(s) de PIPELINE avec le site.'); process.exit(1); }


/* GARDE ÉLISION (pluralVig) — « qu'elle », « m'a », « s'en » sont des tokens ÉLIDÉS, jamais des noms
   à accorder avec un déterminant en amont. Avant la garde : 271 tirs orange sur 14 450 phrases UD
   correctes (s'en→s'ens, l'ail→l'ails, n'a→n'as), 0 correction juste dans les corpus appariés. */
const _ELI = ["Les girolles qu'elle avait cueillies", "les livres qu'il m'a rendus", "tout ce qu'il avait fait jusqu'alors"];
let _eli = 0;
for (const ph of _ELI) {
  const got = (DYSCORE.diagnoseAll(ph).flags || []).filter(f => f.sugg && String(f.word).indexOf("'") >= 0 && String(f.sugg).toLowerCase() !== String(f.word).toLowerCase());
  if (got.length) { _eli++; console.log('✗ ÉLISION : ' + JSON.stringify(ph) + ' ne doit pas accorder un token élidé, eu ' + JSON.stringify(got.map(f => f.word + '->' + f.sugg))); }
}
if (_eli) { console.log('PARITÉ KO — ' + _eli + ' accord(s) sur token élidé.'); process.exit(1); }


/* GARDE « REGLES_FR 1-8 » (2026-08-12) — les 9 règles mesurées : rappel, pièges, et le TIER dit vrai.
   Mesuré au moteur : 7 tirs sur 14 450 phrases UD, TOUS de vraies fautes du corpus (négation orale,
   « le plus influant », « deux cent salariés »). La fumée a servi de casse-garde : la branche
   NOM+fin-de-proposition de l'adjectif verbal manquait → le banc l'a montrée KO avant livraison. */
const _R8 = [
  ["on a pas le temps", "n'a", 'auto', 'négation'],
  ["c'est pas grave", "ce n'est", 'auto', 'négation'],
  ["il y a pas de souci", "n'y", 'auto', 'négation'],
  ["si j'aurais su, je ne serais pas venu", "j'avais", 'auto', 'si + conditionnel'],
  ["quelque soit la solution", "quelle que", 'auto', 'quel que soit'],
  ["je ne comprends pas ce qui il veut", "qu'il", 'auto', "qu'il (élision)"],
  ["l'homme qui il a vu hier", "qu'il", 'vigilance', "qu'il (élision)"],
  ["il me faut la chose que j'ai besoin", 'dont', 'vigilance', 'que/dont'],
  ["il est prêt de la sortie", 'près', 'vigilance', 'près/prêt'],
  ["il en veut d'avantage", 'davantage', 'vigilance', 'davantage'],
  ["il est très convainquant", 'convaincant', 'vigilance', 'adjectif en -ant/-ent'],
  ["l'usine emploie deux cent salariés", 'cents', 'auto', 'vingt/cent'],
  ["il a tombé dans l'escalier", 'est', 'auto', 'usage être/avoir'],
  ["ils ont parvenus à un accord", 'sont', 'auto', 'usage être/avoir'],
];
const _R8_NON = [
  "j'ai pas mal de travail", "il est plus grand que moi", "on n'a pas le temps",
  "je ne sais pas si je serais capable", "il se demandait si elle serait là",
  "le film avec qui il a grandi", "je sais qui il est",
  "je crois que j'ai besoin de toi", "la langue qu'il parle est belle",
  "elle prête de l'argent à tous", "il n'y a pas d'avantage fiscal",
  "en le précédant, il ouvre la voie", "l'année précédant la guerre fut rude",
  "en mille neuf cent quatre", "quatre-vingt-dix personnes", "cent personnes sont venues",
  "il a tombé la veste",
];
const _R8N = new Set(['négation', 'si + conditionnel', 'quel que soit', "qu'il (élision)", 'que/dont',
  'près/prêt', 'davantage', 'adjectif en -ant/-ent', 'vingt/cent', 'usage être/avoir']);
let _r8 = 0;
for (const [ph, att, tier, nom] of _R8) {
  const all = DYSCORE.correctText(ph), got = all.filter(f => f.name === nom);
  const hit = got.find(f => String(f.sugg).toLowerCase().startsWith(att));
  if (!hit) { _r8++; console.log('✗ R8 rappel : ' + JSON.stringify(ph) + ' doit donner « ' + att + ' » [' + nom + '], eu ' + JSON.stringify(all.map(f => f.word + '->' + f.sugg))); }
  else if (hit.tier !== tier) { _r8++; console.log('✗ R8 tier : ' + JSON.stringify(ph) + ' — « ' + att + ' » doit être ' + tier + ', eu ' + hit.tier); }
}
for (const ph of _R8_NON) {
  const got = DYSCORE.correctText(ph).filter(f => _R8N.has(f.name));
  if (got.length) { _r8++; console.log('✗ R8 piège : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.word + '->' + f.sugg + '[' + f.name + ']'))); }
}
if (_r8) { console.log('PARITÉ KO — ' + _r8 + ' cas « REGLES_FR 1-8 ».'); process.exit(1); }

/* GARDE GENRE ACCENTUÉ (Morphalou, PR#573→) — « app ⊆ Python » unidirectionnel : sans _GACC câblé,
   les règles qui consultent _nounGender(...,true) resteraient MUETTES sur les mots dont le genre
   n'existe QUE dans gender_acc.json (« lettre » : absent du désaccentué, clé partagée avec « lettré »),
   et la parité resterait verte par omission. Vérifié en direct (navigateur, 2026-08-24) sur
   rPpEpithetFem/rPpEpithetNum ; rPpAvoirCod (COD antéposé, gardes les plus lourdes) n'a pas encore
   d'exemple confirmé — pas d'assertion non vérifiée ici, à ajouter une fois trouvé un cas qui passe
   toutes ses gardes (segmentation/position du « que »). */
const _GACC_T = [["Une lettre rédigé est arrivée hier.", 'rédigée'],
                 ["Les lettres rédigé ont été postées.", 'rédigées'],
                 ["Je cherche la lettre qu'il a envoyé hier.", 'envoyée']];
let _gacc = 0;
for (const [ph, att] of _GACC_T) {
  const got = DYSCORE.correctText(ph).map(f => String(f.sugg).toLowerCase());
  if (!got.includes(att)) { _gacc++; console.log('✗ GENRE ACCENTUÉ : ' + JSON.stringify(ph) + ' doit donner « ' + att + ' », eu ' + JSON.stringify(got)); }
}
if (_gacc) { console.log('PARITÉ KO — ' + _gacc + ' cas « genre accentué » (gender_acc.json/_GACC).'); process.exit(1); }

console.log(appOnly === 0
  ? `PARITÉ OK — dys-core ⊆ Python sur ${PHRASES.length} phrases (aucun FP propre extension). Écarts de couverture : ${gap}.`
  : `PARITÉ KO — ${appOnly} phrase(s) où l'extension flague hors Python.`);
process.exit(appOnly === 0 ? 0 : 1);
