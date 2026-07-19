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
DYSCORE.setLex(vdc, grText);
DYSCORE.setNounPost(zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'assets', 'noun-post.txt.gz'))).toString('utf8'));        // posterior §3 (parité genre + accord pluriel du nom)
DYSCORE.setPosHmm(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'assets', 'pos-hmm.json.gz'))).toString('utf8')));   // POS-tagger HMM (parité son/sont sujet-nom via posTags)

// 2) même batterie que dictee/parity_corr.js (homophones + accord + genre + mais/mes + j'est + pluriel du nom)
const PHRASES = [
  'les enfant joue', 'des oiseau dans le ciel', 'les cheval galopent', 'il a des difficulté', 'des journal locaux',
  'les département français', 'des hit parades', 'il les porte', 'il les livre à domicile', 'les rouge vif', 'des chat noirs',
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
  'Mon collègue vérifiais les comptes', 'Le technicien réparais la machine', 'Je gardais le secret', 'Tu regardais la télévision', 'Les responsables installais tout'
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
console.log(appOnly === 0
  ? `PARITÉ OK — dys-core ⊆ Python sur ${PHRASES.length} phrases (aucun FP propre extension). Écarts de couverture : ${gap}.`
  : `PARITÉ KO — ${appOnly} phrase(s) où l'extension flague hors Python.`);
process.exit(appOnly === 0 ? 0 : 1);
