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
  'Marie est gentille', 'Dans ses carnets on voit bien',
  // « a » devant NOM NU (31/08) : cibles + gardes idiomes/latins/anglais/chiffres
  'il va au travail a vélo', 'un cours a domicile pour tous', 'ma soeur va a pied au marché',
  // ⭐ a/à : le garde d'INVERSION ne vérifiait pas ce qu'il nommait (un verbe en i-2 suffisait, sans
  // exiger un PRONOM en i-1) et l'ancre AVANT ne voyait pas à travers une élision. Résultat : la règle
  // se taisait sur tout « VERBE + nom + a ». Cibles + les deux gardes qui doivent RESTER muettes.
  "Mon collègue modifierait l'article a reception de la commande",
  "il est rentré de l'école a vélo", "elle a rangé l'assiette a table",
  'Avait il a manger ce soir', 'A-t-il a manger ce soir',
  'la réunion a lieu demain', 'il a besoin de toi', 'a priori tout va bien',
  'Requiem for a Dream le film', 'de 35 a 40 ans', 'le chien a soif ce soir',
  // ⭐ 28/09/2026 — quatre rouges/oranges FAUX de l'accord après « être », vus en cherchant les pièges de « sont + adjectif » :
  // « du » article (→ dus), « partie prenante » (→ parties), couleur invariable (→ oranges), « se » complément indirect (→ succédés).
  // Les deux moteurs doivent se taire ; les contrôles juste après doivent, eux, continuer de corriger.
  'Ils sont du côté des perdants.', 'Elles sont du même avis.', 'Elles sont partie prenante du projet.',
  'Les rideaux sont orange.', 'Elle porte des chemises orange.', 'Les enfants se sont succédé.',
  'Ils sont parti hier.', 'Les enfants se sont lavé.', 'Les rideaux sont vert.',
  // ⭐ 28/09/2026 — « participe après avoir » étendue : consonne finale muette échangée (fais → fait, mit → mis, prit → pris…),
  // « était » → été, l'infinitif « avoir »/« ayant » ; eux/prix en ORANGE (palier) ; pièges : relative, sigle, participe accordé.
  'Les élèves ont prit le bus.', 'Ils ont fais leurs devoirs.', 'Les enfants ont mit leurs bottes.', 'Ils ont écris une lettre.',
  'Ils ont dut partir tôt.', 'La fête a était réussie.', "Merci d'avoir fais le ménage.", 'Ayant mit son manteau, elle sortit.',
  "Nous avons prix le train de nuit.", 'Nous avons eux de la chance.', 'Elle a eux une bonne note.',
  "Tout ce qu'il a était à elle.", 'Ils ont eux aussi des droits.', "C'est a eux de jouer.", 'La C2A était riche.',
  'Les tableaux que tu as vus sont célèbres.', "Les pommes qu'il a prises sont mûres.", 'Il a dit bonjour.',
  // ⭐ 29/09/2026 — catalogue des muets, lot A : cibles et pièges (élision n', cher/chez, « il été » orange, lieux en minuscule).
  'On na jamais compris.', 'Ce né pas grave.', 'Tu né plus prêt.', "Il est né pas loin d'ici.", 'Je rentre cher moi ce soir.',
  'Mon cher, moi je reste.', 'Un cadeau cher le jour de Noël.', 'Il été content de venir.', "J'été fatigué hier.",
  'Laquelle a-t-elle été ?', 'Ça été une belle fête.', 'Je pars au japon cet été.', "Elle aime l'europe.", 'Le franc suisse monte.'
];
PHRASES.push(...fs.readFileSync(path.join(ROOT, 'dictee', 'phrases_courantes.txt'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && s[0] !== '#'));   // ⭐ 13/09/2026 : phrases courantes 1re/2e personne — « Je ne peux pas. » → *puis* en rouge du 07 au 13/09, vu par aucun corpus
PHRASES.push("Il refuse de nous aidé cette fois.", "Elle a fini par se levé très tard.", "Il doit m'aidé demain.", "Il vient la récupéré ce soir.", "Une fois rentrer à la maison, elle lit.", "Tout en étant fatiguer, il travaille.", "La facture a tout de même doubler.", "La facture a beaucoup doubler.", "Ce sera difficile à réparé.", "Le Nasdaq a quant à lui cédé 8 %.", "Les coureurs sont partis sur le tracé du circuit.", "Les chiffres sont dans l'encadré ci-contre.", "Il compte sur la facilité du parcours.", "Le pouvoir délégué aux régions est limité.", "Il à mangé une pomme.", "C'est bien manger.");   // ⭐ 03/10/2026 : lot « forme du verbe » (ext ⊆ Python sur ces phrases inventées)
PHRASES.push("Le chevalier porte d'lourde armure.", "Elle s'mariée l'an dernier.", "Ils s'mariés en mai.", "Il va s'marier en mai.", "Ils s'disputent souvent.", "J'sais pas.", "Une barre d'fer.", "Il vend de l'pétrole.", "Le stade Ben M'barek est plein.", "Une maison d'du bois.", "J'mangé une pomme.", "Il est parti d'bonne heure.", "Il faut s'marié jeune.", "Elle va s'mariée en mai.");   // ⭐ 13/09/2026 : élision inversée — rouge sûr, orange avec le mot manquant, nom propre muet (paliers comparés)

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

/* GARDE « GENRE DU NOM PERDU PAR LA DÉSACCENTUATION » (18/09/2026 — cas de Rem : « le marché provençale », muet au produit).
   Les deux règles d'accord de l'adjectif épithète (rouge rAdjEpithet, orange genreAdjVig) lisaient GENDER_PURE seule : table
   DÉSACCENTUÉE, où « marché » (m) et « marche » (f) partagent une clé et disparaissent tous les deux. Elles lisent maintenant
   d'abord la table des COLLISIONS D'ACCENT (_GCOLL, celle de rDetGenre). « ext ⊆ Python » ne peut pas garder ça : l'orange
   « accord genre à vérifier » n'a pas de jumelle Python, et un moteur muet passe la parité — on EXIGE donc la sortie.
   ⚠️ LE PIÈGE EST AUSSI IMPORTANT QUE LES CIBLES : le premier jet lisait la table accentuée BRUTE (_GACC), qui donne « f » aux
   noms épicènes (peintre, architecte, ministre). Mesuré sur 14 450 phrases UD correctes : 8 ROUGES faux, tous du type
   « un peintre italien » → italienne. Avec _GCOLL : 0 marque nouvelle, 0 perdue. */
const _GCOLL_OUI = [["Le marché provençale est ouvert.", 'provençale', 'provençal', 'accord genre à vérifier', 'vigilance'],
                    ["J'adore le marché provençale du samedi.", 'provençale', 'provençal', 'accord genre à vérifier', 'vigilance'],
                    ['Le côté droite est libre.', 'droite', 'droit', 'accord genre à vérifier', 'vigilance'],
                    ['Nous allons au marché provençale.', 'provençale', 'provençal', 'accord genre à vérifier', 'vigilance'],   // l'article contracté « au » manquait à la table de la règle orange
                    ['La pêche miraculeux a eu lieu.', 'miraculeux', 'miraculeuse', 'accord adjectif épithète', 'auto']];
const _GCOLL_NON = ["C'est un peintre italien baroque.", 'La femme du diplomate américain est venue.', "C'est le ministre marocain des Affaires étrangères.",
                    'Le marché provençal est ouvert.', 'La pêche miraculeuse a eu lieu.'];
let _gcoll = 0;
for (const [ph, mot, att, nom, palier] of _GCOLL_OUI) {
  const f = (DYSCORE.diagnoseAll(ph).flags || []).find(x => x.word === mot);
  if (!f || String(f.sugg).toLowerCase() !== att || f.name !== nom || f.tier !== palier) { _gcoll++;
    console.log('✗ GENRE (collision d\'accent) : ' + JSON.stringify(ph) + ' doit donner « ' + mot + ' » → « ' + att + ' » [' + nom + ', ' + palier + '], eu ' + JSON.stringify(f || null)); }
}
for (const ph of _GCOLL_NON) {
  const f = (DYSCORE.diagnoseAll(ph).flags || []).filter(x => x.name === 'accord adjectif épithète' || x.name === 'accord genre à vérifier');
  if (f.length) { _gcoll++; console.log('✗ GENRE (collision d\'accent) : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(f.map(x => x.word + '->' + x.sugg + '[' + x.tier + ']'))); }
}
if (_gcoll) { console.log('PARITÉ KO — ' + _gcoll + ' cas « genre du nom perdu par la désaccentuation ».'); process.exit(1); }
console.log('  ✓ genre par collision d\'accent : ' + _GCOLL_OUI.length + ' corrections exigées, ' + _GCOLL_NON.length + ' pièges muets');

/* GARDE « UN NOM ÉPICÈNE NE TRANCHE AUCUN ACCORD » (18/09/2026). La table de genre ACCENTUÉE déclarait
   FÉMININS des noms qui ont les deux genres — peintre, ministre, architecte, diplomate, astronaute — parce
   que le signal d'ambiguïté de kaikki+Lexique4 se perdait avant l'ajout Morphalou (cf.
   dictee/build_gacc_epicene_excl.py). Au produit, ça faisait des ROUGES sur du français JUSTE, par la route
   ATTRIBUT et par la route PARTICIPE (`_nounGender` consulte `_GACC` en premier, inconditionnellement).
   Ces phrases sont CORRECTES : toute marque d'accord y est un faux positif. Falsifiable en une ligne :
   rendre les 793 entrées au blob (build_gacc_js.py) et les six tirent à nouveau. */
const _EPI_MUET = ['Le peintre est italien.', 'Le ministre est content.', 'Ce diplomate est américain.',
                   'Le cinéaste était présent.', 'Le peintre est parti hier.', "L'architecte est venu."];
let _epi = 0;
for (const ph of _EPI_MUET) {
  const f = (DYSCORE.diagnoseAll(ph).flags || []).filter((x) => /accord|genre/.test(x.name || ''));
  if (f.length) { _epi++; console.log('✗ ÉPICÈNE : ' + JSON.stringify(ph) + ' est du français JUSTE, eu ' + JSON.stringify(f.map((x) => x.word + '->' + x.sugg + '[' + x.tier + ']'))); }
}
if (_epi) { console.log('PARITÉ KO — ' + _epi + ' phrase(s) correcte(s) marquée(s) sur un nom épicène.'); process.exit(1); }
console.log('  ✓ noms épicènes : ' + _EPI_MUET.length + ' phrases correctes sans une seule marque d\'accord');


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

/* ⭐ VIGILANCE (11/09/2026, chantier « parity_corr découpe la source à correctText ») — les règles ORANGE de la couche
   spellText n'étaient JAMAIS exercées par la parité : correctText ne les appelle pas, et « ext ⊆ Python » n'était démontré
   que sur CRULES. Quatre ont une jumelle Python (« conjugaison après je » — j' + infinitif — est propre au JS ; « infinitif
   après pronom sujet » est une règle CRULES déjà en parité) ; on compare leurs flags par libellé apparié, sur la batterie ET sur des
   phrases ciblées, via le PIPELINE RÉEL (diagnoseAll → spellText). Invariant : aucune orange propre au JS ; couverture
   affichée ; EXIGENCE : chaque règle appariée tire au moins une fois des DEUX côtés (une règle qui ne tourne pas dans le
   harnais vaut zéro — piège du 2026-08-11). « accord participe à vérifier » reste hors périmètre : le JS y fond deux règles
   (sestPpVig, participeEtreVig) et le Python n'a pas la couche vigilance speller (#121). */
const VIG_MAP = { 'accord du verbe au sujet nominal à vérifier': 'accord du verbe au sujet nominal à vérifier',
  'personne du verbe à vérifier': 'personne du verbe à vérifier',
  'on/ont après un sujet pluriel à vérifier': 'on/ont après un sujet pluriel à vérifier',
  'infinitif après semi-auxiliaire à vérifier': 'infinitif après semi-auxiliaire à vérifier',
  'nombre du déterminant à vérifier': 'nombre du déterminant à vérifier',
  "j'est/j'ai à vérifier": "j'est/j'ai à vérifier",
  'accord du participe après avoir à vérifier': 'accord du participe après avoir à vérifier',
  'auxiliaire manquant à vérifier': 'auxiliaire manquant à vérifier',
  "c'est/ces à vérifier": "c'est/ces à vérifier",
  'pluriel par le son à vérifier': 'pluriel par le son à vérifier' };   // ⭐ 28/09/2026 : le son donne le mot quand la grammaire exige le pluriel   // ⭐ 12/09/2026 : règle neuve orange   // ⭐ 12/09/2026 : jumelle orange de j'est/j'ai
const VIG_PY = new Set(Object.values(VIG_MAP));
const VIG_PHRASES = PHRASES.concat([
  'les petits chats manges la soupe.', 'le chien mangeons.', 'Les impudents est le premier roman.',   // sujet NOMINAL (orange) ; titre = silence (lot 2)
  'je fini mon travail.', 'tu a raison.',                                                             // personne du verbe
  'les enfants on mange leur soupe.', 'mes amis on chante.', 'les chats on dort.',                    // on/ont après sujet pluriel (orange) ; « on dort » = rouge on/ont, pas ici
  'je vais mange.', 'il veut mange.',                                                                 // infinitif après semi-auxiliaire
  'je manger des fraises.', "J'aimer les fraises.",                                                   // infinitif après pronom sujet (CRULES) ; j'+inf (JS seul)
  'le maçons ont du mal à élever les murs.', 'la maison ont brûlé.',                                // nombre du déterminant (orange) ; contrôle : nom singulier → rien
  "j'est dans ma chambre.", "j'est descendu.", "j'est descendu l'escalier.", "j'est de Paris.", "j'est entendu le tonnerre.", "j'est fatigué.",   // j'est/j'ai : orange (dans, mouvement nu) + rouges (de + nom propre, participe irrégulier, état)
  "ceux qui sont dégoûtés du système partent.", "les amis du voisin partent.",   // contrôles : contracté du/des derrière un participe/nom = complément → silence des deux côtés (12/09)
  "La température la plus froide a été enregistrée hier.",   // contrôle : tête superlative « la plus froide » → silence des deux côtés (12/09, UD 2134)
  "ils ce sont déroulés hier.", "ce sont des amis.",   // ce/se + auxiliaire : le participe tranche (12/09) ; contrôle : groupe nominal → silence
  "Tu n'as pas a te plaindre.", 'Elle continu a avancer.', 'Elle a de la peine a chanter.', "Je m'occupe a nettoyer.", 'On a oublier la clé.', "L'expulsé a droit au pouvoir.",   // a + infinitif (29/09/2026) : « à » orange là où « a » ne peut pas être l'auxiliaire ; contrôles : avoir juste après le sujet (laissé), l'expulsé
  'Le chat et parti ce matin.', 'Le repas et fini depuis une heure.', "Il est tombé dans l'eau est voilà.", 'Nous avons parlé est aussi elle a ri.', 'Un ami et associé de longue date.', 'Né à Lyon le 3 mai 1900 et mort à Paris.', 'Un étage et un grenier et fait cent mètres.',   // et/est (29/09/2026) : sujet nominal + et + participe → est (orange) ; « est voilà », « est aussi » + pronom + verbe → et ; contrôles : nom coordonné, date, verbe conjugué
  'Boeing a signés un contrat.', 'ils ont vue leur médecin.', 'Je les ai vues la semaine dernière.',   // accord surnuméraire après avoir (orange) ; contrôle : clitique COD → silence
  'Hier je noté le numéro.', 'quand je retourné à la maison.', 'je fatigué ce soir.', 'Ai-je noté le numéro ?', 'Demain je noté le numéro.',   // auxiliaire manquant (orange) ; contrôles : inversion, futur (rouge ailleurs)
  "C'est chiens sont âgés de trois ans.", "leur mère parle à c'est parents de sortir.", "c'est gens-là.", "C'est les vacances.",   // c'est/ces (orange) ; contrôles : nom propre/trait d'union, déterminant
  'Nous avons acheté des plante vertes.', 'Il range ces produit dans le placard.', 'Elle ouvre les porte du garage.',   // pluriel par le son (orange) : homographes d'un verbe
  'Dans les mure de la ville.', 'Il y a des hais autour du jardin.', "J'ouvre les porte du garage.",                        // … mauvais homophone (mure → murs) ; « les » après un verbe élidé
  'Le vent les porte loin.', 'Il faut les faire.', 'Les quatre amis sont là.', 'On a vu les new Warriors.', 'Le colis part dès réception de la commande.',              // contrôles : « les » pronom, infinitif, nombre, nom propre → silence
  'les enfants dorment.', 'il est parti hier.', 'nous mangeons la soupe.']);                          // contrôles : rien
const pyV = cp.spawnSync('python3', ['-c', `
import sys, json
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'dictee'))})
import correcteur_probe as C
ph = json.loads(sys.stdin.read())
print(json.dumps([[(i, w, s, n) for (i, w, s, n, t) in C.correct_tiered(p)] for p in ph]))
`], { input: JSON.stringify(VIG_PHRASES), encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });
if (pyV.status !== 0) { console.error('probe Python (vigilance) échoué :', pyV.stderr); process.exit(2); }
const pyVig = JSON.parse(pyV.stdout);
let _vKo = 0, _vGap = 0; const _vHitJs = {}, _vHitPy = {};
VIG_PHRASES.forEach((p, k) => {
  const js = (DYSCORE.diagnoseAll(p).flags || []).filter(f => f.tier === 'vigilance' && VIG_MAP[f.name]).map(f => [f.i, f.word, f.sugg, VIG_MAP[f.name]]);
  const pf = pyVig[k].filter(x => VIG_PY.has(x[3]));
  const pset = new Set(pf.map(key)), jset = new Set(js.map(key));
  js.forEach(x => { _vHitJs[x[3]] = (_vHitJs[x[3]] || 0) + 1; });
  pf.forEach(x => { _vHitPy[x[3]] = (_vHitPy[x[3]] || 0) + 1; });
  const extra = js.filter(x => !pset.has(key(x)));
  if (extra.length) { _vKo++; console.log('✗ VIGILANCE : EXT marque une orange que PY ne marque pas :', JSON.stringify(p), JSON.stringify(extra)); }
  const miss = pf.filter(x => !jset.has(key(x)));
  if (miss.length) { _vGap++; console.log('  (couverture vigilance) PY > EXT :', JSON.stringify(p), JSON.stringify(miss)); }
});
const _vMuet = Array.from(VIG_PY).filter(n => !_vHitJs[n] || !_vHitPy[n]);
if (_vMuet.length) { console.log('PARITÉ KO — règle(s) de vigilance jamais exercée(s) par le harnais : ' + JSON.stringify(_vMuet) + ' ext=' + JSON.stringify(_vHitJs) + ' py=' + JSON.stringify(_vHitPy)); process.exit(1); }
if (_vKo) { console.log('PARITÉ KO — ' + _vKo + ' phrase(s) où l\'extension marque une ORANGE hors Python.'); process.exit(1); }
console.log('  ✓ vigilance : ' + Object.keys(VIG_MAP).length + ' règles orange appariées, ext ⊆ Python sur ' + VIG_PHRASES.length + ' phrases (écarts de couverture : ' + _vGap + ')');

// ⭐ 29/09/2026 — LE VOISIN ORANGE (catalogue des muets, lot B1) : diagnoseAll relit la phrase avec les corrections ORANGE de
// l'orthographe ; ce que a/à, ou/où, élision fusionnée, -er/-é y trouvent EN PLUS est proposé en orange, et le rouge -er → -é qui
// lisait « a » comme avoir redevient orange. Miroir de mesure : dys_pipeline_probe.pyramide (même étape).
{
  const fl = (s) => (DYSCORE.diagnoseAll(s).flags || []).filter(f => typeof f.i === 'number');
  let _vo = 0;
  const f1 = fl('Il commanse a pleurer.'), fa = f1.find(f => f.word === 'a'), fp = f1.find(f => f.word === 'pleurer');
  if (!fa || fa.sugg !== 'à' || fa.tier !== 'vigilance') { _vo++; console.log('  ✗ voisin orange : « commanse a pleurer » → a/à orange attendu, obtenu ' + JSON.stringify(fa || null)); }
  if (fp && fp.tier !== 'vigilance') { _vo++; console.log('  ✗ voisin orange : le rouge « pleuré » (a lu comme avoir) devait passer en orange : ' + JSON.stringify(fp)); }
  const f2 = fl('Elle commence à avancer doucement.');
  if (f2.length) { _vo++; console.log('  ✗ voisin orange : phrase correcte marquée ' + JSON.stringify(f2.map(f => [f.word, f.sugg, f.name]))); }
  // ⭐ 03/10/2026 : le voisin dit « à » → le -er → -é d'à côté (qui lisait « a » comme avoir) se RETIRE ; « à » + « parlé » se contredisaient
  const f3 = fl('Il éprouve une dificultée a parler.'), fa3 = f3.find(f => f.word === 'a'), fp3 = f3.find(f => f.word === 'parler');
  if (!fa3 || fa3.sugg !== 'à' || fa3.tier !== 'vigilance') { _vo++; console.log('  ✗ voisin orange : « dificultée a parler » → a/à orange attendu, obtenu ' + JSON.stringify(fa3 || null)); }
  if (fp3) { _vo++; console.log('  ✗ voisin orange : « parler » ne doit plus rien porter quand le voisin dit « à » : ' + JSON.stringify(fp3)); }
  const f4 = fl('Il éprouve une difficulté à parler.');
  if (f4.length) { _vo++; console.log('  ✗ voisin orange : phrase correcte marquée ' + JSON.stringify(f4.map(f => [f.word, f.sugg, f.name]))); }
  if (_vo) { console.log('PARITÉ KO — voisin orange : ' + _vo + ' attente(s) non tenue(s).'); process.exit(1); }
  console.log('  ✓ voisin orange : « commanse a pleurer » → à ? (orange) ; « dificultée a parler » → à ? sans « parlé » contradictoire ; phrases correctes muettes');
}

// ⭐ 30/09/2026 — GENRE DU DÉTERMINANT CONTREDIT PAR L'ORANGE DU NOM : « la foret » → le (le foret, l'outil) alors que l'orthographe
// propose au même endroit « forêt », féminin — la marque du déterminant se retire ; un nom JUSTE garde la sienne (« le maison » → la).
// Miroir de mesure : dys_pipeline_probe.pyramide (même étape).
{
  const fl = (s) => (DYSCORE.diagnoseAll(s).flags || []).filter(f => typeof f.i === 'number');
  let _gd = 0;
  for (const [s, nom, sg] of [['Il habite près de la foret.', 'foret', 'forêt'], ['Le pole est froid.', 'pole', 'pôle']]) {
    const f = fl(s), d = f.find(x => x.name === 'genre déterminant'), n = f.find(x => x.word === nom);
    if (d) { _gd++; console.log('  ✗ genre contredit : « ' + s + ' » garde la marque du déterminant ' + JSON.stringify(d)); }
    if (!n || n.sugg !== sg) { _gd++; console.log('  ✗ genre contredit : « ' + s + ' » → « ' + sg + ' » attendu sur le nom, obtenu ' + JSON.stringify(n || null)); }
  }
  const d3 = fl('Le maison est grande.').find(x => x.name === 'genre déterminant');
  if (!d3 || d3.sugg !== 'La') { _gd++; console.log('  ✗ genre contredit : « Le maison » (nom juste) doit garder « La », obtenu ' + JSON.stringify(d3 || null)); }
  if (_gd) { console.log('PARITÉ KO — genre du déterminant contredit : ' + _gd + ' attente(s) non tenue(s).'); process.exit(1); }
  console.log('  ✓ genre contredit : pas de marque du déterminant devant « foret » ni devant « pole » (forêt, pôle proposés) ; « le maison » → La gardé');
}

// ⭐ 30/09/2026 — GÉRONDIF « en + -ent » EN MILIEU DE PHRASE : « en chantent » recevait « chante » (sujet-verbe, ROUGE faux) ; le
// participe se forme sur le radical du « nous » (mangeant, commençant — plus « mangant ») ; témoins : clitique, inversion, nombre,
// adjectif, locution — aucun gérondif. Miroir Python : correcteur_probe._gerondif (garde des règles sujet-verbe).
{
  const fl = (s) => (DYSCORE.diagnoseAll(s).flags || []).filter(f => typeof f.i === 'number');
  let _ge = 0;
  for (const [s, w, sg] of [['Le garçon court dans le parc en chantent.', 'chantent', 'chantant'], ['Il a quitté la salle en disent merci.', 'disent', 'disant'],
                            ['En mangent vite, il a fini.', 'mangent', 'mangeant'], ['Tout en commencent le travail, il chantait.', 'commencent', 'commençant']]) {
    const f = fl(s), m = f.find(x => x.word === w);
    if (!m || m.sugg !== sg || m.tier !== 'vigilance') { _ge++; console.log('  ✗ gérondif : « ' + s + ' » → « ' + sg + ' » (orange) attendu, obtenu ' + JSON.stringify(m || null)); }
    if (f.some(x => /sujet/.test(x.name))) { _ge++; console.log('  ✗ gérondif : « ' + s + ' » porte encore un accord sujet-verbe ' + JSON.stringify(f.filter(x => /sujet/.test(x.name)))); }
  }
  for (const s of ['Les voisins en parlent souvent.', 'Pourquoi en parlent-ils autant ?', 'Les trois en parlent.', 'La voiture est en excellent état.', 'Ils voyagent en différent groupes.', 'En fait, il pleut.']) {
    const g = fl(s).filter(x => /participe présent/.test(x.name));
    if (g.length) { _ge++; console.log('  ✗ gérondif : témoin « ' + s + ' » marqué ' + JSON.stringify(g)); }
  }
  if (_ge) { console.log('PARITÉ KO — gérondif : ' + _ge + ' attente(s) non tenue(s).'); process.exit(1); }
  console.log('  ✓ gérondif : chantent → chantant, disent → disant, mangent → mangeant, commencent → commençant (orange, plus d’accord sujet-verbe) ; 6 témoins muets');
}

// ⭐ 30/09/2026 — « CES/SES » POUR « C'EST » : devant un déterminant, une préposition, un infinitif, ou un adjectif seul suivi d'un
// non-nom → c'est (orange) ; derrière ce « ces », l'adjectif antéposé (rouge) et les oranges de pluriel se taisent. Témoins : groupe
// nominal normal, trait d'union, composé sans trait d'union, adjectif devant un nom (rouge gardé). Miroir Python _ces_cest.
{
  const fl = (s) => (DYSCORE.diagnoseAll(s).flags || []).filter(f => typeof f.i === 'number');
  let _cc = 0;
  for (const [s, w] of [['Le plus dur ces de commencer.', 'ces'], ['Mon idée ses dans la boîte.', 'ses'], ['Le secret ces une bonne recette.', 'ces'],
                        ['Ces vrai que tu viens ?', 'Ces'], ['Ses fini pour aujourd’hui.', 'Ses']]) {
    const f = fl(s), m = f.find(x => x.word === w);
    if (!m || m.sugg.toLowerCase() !== "c'est" || m.tier !== 'vigilance') { _cc++; console.log('  ✗ c’est : « ' + s + ' » → « c’est » (orange) attendu, obtenu ' + JSON.stringify(m || null)); }
    const pl = f.filter(x => x.i === (m ? m.i + 1 : -1) && /pluriel|antéposé/.test(x.name));
    if (pl.length) { _cc++; console.log('  ✗ c’est : « ' + s + ' » garde un accord de pluriel contradictoire ' + JSON.stringify(pl)); }
  }
  for (const s of ['Ces enfants jouent.', 'Il range ses affaires.', 'Ses après-midi sont longs.', 'Il faut un nom pour ces sous groupes.']) {
    const g = fl(s).filter(x => x.name === "c'est/ces à vérifier");
    if (g.length) { _cc++; console.log('  ✗ c’est : témoin « ' + s + ' » marqué ' + JSON.stringify(g)); }
  }
  const r = fl('Ces vrai amis sont là.').find(x => x.word === 'vrai');
  if (!r || r.sugg !== 'vrais' || r.tier !== 'auto') { _cc++; console.log('  ✗ c’est : « Ces vrai amis » doit garder le rouge « vrais », obtenu ' + JSON.stringify(r || null)); }
  if (_cc) { console.log('PARITÉ KO — ces/ses → c’est : ' + _cc + ' attente(s) non tenue(s).'); process.exit(1); }
  console.log('  ✓ c’est : 5 « ces/ses » → c’est (orange, sans accord de pluriel contradictoire) ; 4 témoins muets ; « Ces vrai amis » garde « vrais »');
}

// ⭐ 30/09/2026 — « ma/ta/jais » + participe → m'a/t'a/j'ai (élision-espace) : un participe qui est aussi un nom (P(NOM) ≥ 0,3, table
// NOUN_POST — absente des harnais du seul correcteur d'orthographe) ne déclenche rien : « raconter ma mort » (vu sur UD).
{ const g = (DYSCORE.diagnoseAll('Je veux vous raconter ma mort.').flags || []).filter(f => f.name === 'élision');
  const h = (DYSCORE.diagnoseAll('Il ta donné un livre.').flags || []).find(f => f.name === 'élision');
  if (g.length || !h || h.sugg !== "t'a donné") { console.log('PARITÉ KO — ma/ta/jais : « ma mort » ' + JSON.stringify(g) + ' / « ta donné » ' + JSON.stringify(h || null)); process.exit(1); }
  console.log('  ✓ ma/ta/jais : « ta donné » → t’a donné ; « raconter ma mort » muet (participe qui est aussi un nom)'); }

// ⭐ 30/09/2026 — HOMOPHONES NOM / VERBE : « le travaille » → travail, « je travail » → travaille (orange) ; témoins : « le » pronom
// (« je le conseille », « le roi le renvoie », « Paul le rappelle ») et phrases justes muettes.
{ const fl = (s) => (DYSCORE.diagnoseAll(s).flags || []).filter(f => f.name === 'homophone à vérifier');
  let _nv = 0;
  for (const [s, w, sg] of [['Mon travaille est fini.', 'travaille', 'travail'], ['Je travail dans un bureau.', 'travail', 'travaille'], ['Je me réveil tôt.', 'réveil', 'réveille'],
                            ['Il rappel son ami.', 'rappel', 'rappelle'], ['Tu travail trop.', 'travail', 'travailles']]) {
    const m = fl(s).find(x => x.word === w);
    if (!m || m.sugg !== sg || m.tier !== 'vigilance') { _nv++; console.log('  ✗ nom/verbe : « ' + s + ' » → « ' + sg + ' » attendu, obtenu ' + JSON.stringify(m || null)); }
  }
  for (const s of ['Je le conseille vivement.', 'Le roi le renvoie chez lui.', 'Paul le rappelle demain.', 'Il travaille bien.', 'Mon travail est fini.']) {
    if (fl(s).length) { _nv++; console.log('  ✗ nom/verbe : témoin « ' + s + ' » marqué ' + JSON.stringify(fl(s))); }
  }
  if (_nv) { console.log('PARITÉ KO — nom/verbe : ' + _nv + ' attente(s) non tenue(s).'); process.exit(1); }
  console.log('  ✓ nom/verbe : 5 homophones proposés (orange) ; 5 témoins muets (le pronom, phrases justes)'); }

// ⭐ 30/09/2026 — RÈGLES EXISTANTES TROP GARDÉES : « se qu'elle » → ce (élidé en un jeton) ; « se sont nos » → ce ; « à tout les » → tous.
{ const fl = (s) => (DYSCORE.diagnoseAll(s).flags || []).filter(f => typeof f.i === 'number');
  let _ga = 0;
  for (const [s, w, sg] of [['Dis-moi se qu\'elle dessine.', 'se', 'ce'], ['Là-bas, se sont nos voisins.', 'se', 'ce'], ['Il pense à tout les enfants.', 'tout', 'tous']]) {
    const m = fl(s).find(x => x.word === w);
    if (!m || m.sugg !== sg) { _ga++; console.log('  ✗ gardes : « ' + s + ' » → « ' + sg + ' » attendu, obtenu ' + JSON.stringify(m || null)); }
  }
  for (const s of ['Ils se sont levés tôt.', 'Il pense à tout le monde.', 'Après tout, les enfants sont là.']) {
    const m = fl(s).filter(x => x.name === 'ce/se' || x.name === 'accord tout');
    if (m.length) { _ga++; console.log('  ✗ gardes : témoin « ' + s + ' » marqué ' + JSON.stringify(m)); }
  }
  if (_ga) { console.log('PARITÉ KO — gardes des règles existantes : ' + _ga + ' attente(s) non tenue(s).'); process.exit(1); }
  console.log('  ✓ gardes : se qu’elle → ce, se sont nos → ce, à tout les → tous ; 3 témoins muets'); }

// ⭐ 30/09/2026 — LOCUTIONS PRÉPOSITIVES (a → à, orange) : à cause du, suite à, à qui, à ne jamais, grâce à, à partir du ; 2 témoins avoir.
{ const fl = (s) => (DYSCORE.diagnoseAll(s).flags || []).filter(f => typeof f.i === 'number');
  let _lo = 0;
  for (const s of ['Il est rentré tôt a cause du vent.', 'Suite a cette réunion, tout a changé.', 'Voici le voisin a qui il a prêté son vélo.',
                   'Il s\'applique a ne jamais trembler.', 'Il a réussi grâce a son travail.', 'Les cours a partir du mois prochain seront en ligne.']) {
    const m = fl(s).filter(x => x.word === 'a');
    if (m.length !== 1 || m[0].name !== 'a/à' || m[0].sugg !== 'à' || m[0].tier !== 'vigilance') { _lo++; console.log('  ✗ locutions : « ' + s + ' » → « à » orange attendu, obtenu ' + JSON.stringify(m)); }
  }
  for (const s of ['Il y en a qui pensent le contraire.', 'La suite a montré qu\'il avait raison.']) {
    const m = fl(s).filter(x => x.name === 'a/à');
    if (m.length) { _lo++; console.log('  ✗ locutions : témoin « ' + s + ' » marqué ' + JSON.stringify(m)); }
  }
  if (_lo) { console.log('PARITÉ KO — locutions prépositives : ' + _lo + ' attente(s) non tenue(s).'); process.exit(1); }
  console.log('  ✓ locutions : 6 « à » proposés (orange) ; 2 témoins avoir muets'); }

// ⭐ 30/09/2026 — PEU/PEUT + DEUX ROUGES FAUX CONSTRUITS : « ça / cela peu » + infinitif → peut (aussi derrière « cela » mal écrit, voisin
// orange) ; « ça peu » lu « sa/son » + nom (→ Son) ; « ne » sans accent lu « né » après avoir (→ est).
{ const fl = (s) => (DYSCORE.diagnoseAll(s).flags || []).filter(f => typeof f.i === 'number');
  let _rf = 0;
  for (const [s, w, sg, tier] of [['Ça peu attendre demain.', 'peu', 'peut', 'auto'], ['Cela peu durer longtemps.', 'peu', 'peut', 'auto'],
                                  ['Et ca peu changer demain.', 'peu', 'peut', 'auto'], ['Je crois que selà peu durer.', 'peu', 'peut', 'vigilance'],
                                  ['Il a ne en hiver.', 'a', 'est', 'auto']]) {
    const m = fl(s).find(x => x.word === w);
    if (!m || m.sugg !== sg || m.tier !== tier) { _rf++; console.log('  ✗ peu/rouges faux : « ' + s + ' » → « ' + sg + ' » (' + tier + ') attendu, obtenu ' + JSON.stringify(m || null)); }
  }
  for (const s of ['Ça peu d\'importance.', 'Et ca peu changer demain.', 'Ce qu\'il a ne regarde que lui.', 'Ce qu\'elle a ne se voit pas.']) {
    const m = fl(s).filter(x => x.name === 'ça/sa' || x.name === 'usage être/avoir' || x.word === 'ne');
    if (m.length) { _rf++; console.log('  ✗ peu/rouges faux : témoin « ' + s + ' » marqué ' + JSON.stringify(m)); }
  }
  if (_rf) { console.log('PARITÉ KO — peu/peut et rouges faux construits : ' + _rf + ' attente(s) non tenue(s).'); process.exit(1); }
  console.log('  ✓ peu/peut : ça, cela + infinitif → peut (orange derrière « cela » mal écrit) ; « il a ne en » → est gardé ; 4 témoins sans ça/sa ni « est »'); }

// ⭐ 30/09/2026 — a → à : VERBE + ADVERBE + « a », INTERVALLE « de 10 … a 20 » (orange) ; témoins : relative sujet, participe, âge, « de 1995 a été ».
{ const fl = (s) => (DYSCORE.diagnoseAll(s).flags || []).filter(f => typeof f.i === 'number');
  let _av = 0;
  for (const s of ['Il parle souvent a ses amis.', 'Elle pense toujours a son chien.', 'Il donne tout a son frère.', 'Il est encore a la gare.',
                   'Les fermes passent de 10 hectares a 20 hectares cette année.', 'Le prix passe de 5 a 8 euros.']) {
    const m = fl(s).filter(x => x.word === 'a');
    if (m.length !== 1 || m[0].name !== 'a/à' || m[0].sugg !== 'à' || m[0].tier !== 'vigilance') { _av++; console.log('  ✗ adverbe/intervalle : « ' + s + ' » → « à » orange attendu, obtenu ' + JSON.stringify(m)); }
  }
  for (const s of ['Ce qu\'il fait souvent a des effets.', 'Celui qui parle trop a tort.', 'Le train qui roule lentement a longtemps été critiqué.',
                   'Il a 35 ans.', 'La loi de 1995 a été modifiée.']) {
    const m = fl(s).filter(x => x.name === 'a/à');
    if (m.length) { _av++; console.log('  ✗ adverbe/intervalle : témoin « ' + s + ' » marqué ' + JSON.stringify(m)); }
  }
  if (_av) { console.log('PARITÉ KO — verbe + adverbe + a, intervalle : ' + _av + ' attente(s) non tenue(s).'); process.exit(1); }
  console.log('  ✓ adverbe : 4 « à » ; intervalle : 2 « à » (orange) ; 5 témoins avoir muets (relative sujet, participe, âge, loi de 1995)'); }

// ⭐ 30/09/2026 — MARQUES ET SIGLES en minuscule → capitale (liste fermée) ; témoins : internet, usa (user), la marque proche de « sont » entre deux pluriels.
{ const fl = (s) => (DYSCORE.diagnoseAll(s).flags || []).filter(f => typeof f.i === 'number');
  let _mq = 0;
  for (const [s, w, sg] of [['J\'ai une console xbox et un jeu nintendo.', 'xbox', 'Xbox'], ['J\'ai une console xbox et un jeu nintendo.', 'nintendo', 'Nintendo'],
                            ['Les ogm posent question.', 'ogm', 'OGM'], ['Elle regarde une série sur netflix.', 'netflix', 'Netflix']]) {
    const m = fl(s).find(x => x.word === w);
    if (!m || m.sugg !== sg || m.name !== 'majuscule') { _mq++; console.log('  ✗ marques : « ' + s + ' » → « ' + sg + ' » attendu, obtenu ' + JSON.stringify(m || null)); }
  }
  for (const s of ['Il utilise internet tous les jours.', 'Il usa de son charme.', 'Les enfants sony contents.']) {
    const m = fl(s).filter(x => x.name === 'majuscule');
    if (m.length) { _mq++; console.log('  ✗ marques : témoin « ' + s + ' » marqué ' + JSON.stringify(m)); }
  }
  if (_mq) { console.log('PARITÉ KO — marques et sigles : ' + _mq + ' attente(s) non tenue(s).'); process.exit(1); }
  console.log('  ✓ marques : Xbox, Nintendo, OGM, Netflix ; 3 témoins (internet, usa, la marque proche de « sont » entre deux pluriels)'); }

// ⭐ 30/09/2026 — « lé enfants » : l'accord singulier lisait « lé » comme « le » et rendait « enfant » en ROUGE ; « lé » → les (orange).
{ const fl = (s) => (DYSCORE.diagnoseAll(s).flags || []).filter(f => typeof f.i === 'number');
  const m = fl('Je vois lé enfants.');
  const bad = m.filter(x => x.name === 'accord singulier nom'), ok = m.find(x => x.word === 'lé' && x.sugg === 'les');
  if (bad.length || !ok) { console.log('PARITÉ KO — déterminant écrit avec é : ' + JSON.stringify(m)); process.exit(1); }
  console.log('  ✓ déterminant écrit avec é : « lé enfants » → les (orange), plus d’« enfant » rouge'); }

// ⭐ 01/10/2026 — RÉGLAGE « J'ÉCRIS AU FÉMININ / AU MASCULIN » (genre de la personne qui écrit, décidé par Rem). Sans réglage : aucune marque
// « auteur ». Réglé : le mot du cadre « je (ne) (me) + être » prend le genre du réglage, en ORANGE ; silences voulus (« je me suis
// demandé », complément d'objet après, guillemets, dialogue, adjectif suivi d'un nom, factitif, adverbe, ponctuation entre « je » et le mot).
// Attentes sur le PRODUIT (diagnoseAll) + PARITÉ avec la référence Python (dys_pipeline_probe.pyramide, positions changées par le réglage).
{ const CAS = [   // [phrase, marques « auteur » attendues au féminin, au masculin] — phrases inventées, vérifiées hors du gold
    ['Hier je suis allé au marché.', { 'allé': 'allée' }, {}], ['Je suis allée au marché.', {}, { 'allée': 'allé' }],
    ['Je me suis trompé de chemin.', { 'trompé': 'trompée' }, {}], ['Je suis contente de te voir.', {}, { 'contente': 'content' }],
    ["J'étais parti tôt.", { 'parti': 'partie' }, {}], ['Je ne suis pas venu hier.', { 'venu': 'venue' }, {}],
    ["J'ai été surpris par la pluie.", { 'surpris': 'surprise' }, {}], ['Je suis rester à la maison.', { 'rester': 'restée' }, {}],
    ['Je suis né en mai.', { 'né': 'née' }, {}], ['Je suis sûr de moi.', { 'sûr': 'sûre' }, {}], ["Je m'étais levé tôt.", { 'levé': 'levée' }, {}],
    ['Je suis très heureux.', { 'heureux': 'heureuse' }, {}], ["Je me suis dépêché j'avais un train à prendre.", { 'dépêché': 'dépêchée' }, {}],
    ["Je n'ai jamais été aussi mal reçu.", { 'reçu': 'reçue' }, {}], ['Je suis fort content.', { 'content': 'contente' }, {}],
    ['Je me suis demandé pourquoi.', {}, {}], ['Je me suis coupé le doigt.', {}, {}], ["Je me suis rendu compte de l'erreur.", {}, {}],
    ['Il a dit : « Je suis prêt. »', {}, {}], ['— Je suis fatigué, dit le garçon.', {}, {}], ['Je suis grand fan de ce groupe.', {}, {}],
    ['Je me suis fait couper les cheveux.', {}, {}], ['Le mot « je suis » seul est court.', {}, {}], ['Elle est allée au marché.', {}, {}]];
  const vus = (s) => (DYSCORE.diagnoseAll(s).flags || []).filter(f => typeof f.i === 'number' && f.auteur);
  let _ga = 0; const js = { f: [], m: [] };
  DYSCORE.setAuteur(null);
  for (const [s] of CAS) { const m = vus(s); if (m.length) { _ga++; console.log('  ✗ genre de l’auteur : sans réglage, « ' + s + ' » marqué ' + JSON.stringify(m)); } }
  for (const g of ['f', 'm']) {
    DYSCORE.setAuteur(g);
    for (const [s, af, am] of CAS) {
      const m = vus(s), att = g === 'f' ? af : am, obt = {};
      m.forEach(f => { obt[f.word] = f.sugg; if (f.tier !== 'vigilance') { _ga++; console.log('  ✗ genre de l’auteur : marque non orange ' + JSON.stringify(f)); } });
      if (JSON.stringify(obt, Object.keys(obt).sort()) !== JSON.stringify(att, Object.keys(att).sort())) { _ga++; console.log('  ✗ genre de l’auteur (' + g + ') : « ' + s + ' » → ' + JSON.stringify(att) + ' attendu, obtenu ' + JSON.stringify(obt)); }
      js[g].push(m.map(f => [f.i, f.sugg]).sort((a, b) => a[0] - b[0]));
    }
  }
  DYSCORE.setAuteur(null);
  const pyA = cp.spawnSync('python3', ['-c', `
import sys, json
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'dictee'))})
import correcteur_probe as CP
try:
    import dys_pipeline_probe as DPP
except FileNotFoundError as e:   # la CI n'a pas Lexique4 : le Speller de référence ne se construit pas → SAUTÉ, dit, jamais muet
    if 'Lexique4' not in str(e): raise
    print(json.dumps({'saute': 'Lexique4 absent'})); sys.exit(0)
ph = json.loads(sys.stdin.read()); out = {}
for g in ('f', 'm'):
    res = []
    for s in ph:
        CP.set_auteur(None); T0, o0, c0, or0, s0 = DPP.pyramide(s)
        CP.set_auteur(g); T1, o1, c1, or1, s1 = DPP.pyramide(s)
        ch = []
        for i in range(len(T1)):
            a = or1[i][0] if or1.get(i) else None
            b = or0[i][0] if or0.get(i) else None
            if a != b or o1[i] != o0[i]: ch.append([i, a if a else o1[i]])
        res.append(sorted(ch))
    out[g] = res
CP.set_auteur(None)
print(json.dumps(out))
`], { input: JSON.stringify(CAS.map(c => c[0])), encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });
  if (pyA.status !== 0) { console.error('probe Python (genre de l’auteur) échoué :', pyA.stderr); process.exit(2); }
  const pyG = JSON.parse(pyA.stdout);
  if (pyG.saute) console.log('  · genre de l’auteur : parité Python SAUTÉE (' + pyG.saute + ', comme en CI) — les attentes du produit, elles, sont vérifiées');
  else for (const g of ['f', 'm']) CAS.forEach(([s], k) => {
    if (JSON.stringify(js[g][k]) !== JSON.stringify(pyG[g][k])) { _ga++; console.log('  ✗ genre de l’auteur : parité (' + g + ') « ' + s + ' » EXT ' + JSON.stringify(js[g][k]) + ' · PY ' + JSON.stringify(pyG[g][k])); }
  });
  if (_ga) { console.log('PARITÉ KO — réglage « j’écris au féminin / au masculin » : ' + _ga + ' attente(s) non tenue(s).'); process.exit(1); }
  const _n = (k) => CAS.reduce((s, c) => s + Object.keys(c[k]).length, 0), _sil = CAS.filter(c => !Object.keys(c[1]).length && !Object.keys(c[2]).length).length;
  console.log('  ✓ genre de l’auteur : sans réglage rien ; au féminin ' + _n(1) + ' marques, au masculin ' + _n(2) + ', toutes orange ; ' + _sil + ' silences voulus' + (pyG.saute ? '' : ' ; parité Python sur ' + CAS.length + ' phrases × 2 réglages')); }

// ⭐ 03/10/2026 — LOT « FORME DU VERBE » (catalogue des muets) : la règle -er/-é enjambe les pronoms (préposition qui gouverne un infinitif
// ou modal + pronoms + participe → infinitif), lit « étant » / « une fois » / l'auxiliaire avoir suivi d'adverbes (→ participe), et
// « difficile à réparé » ne transforme plus « à » en « a ». Silences voulus : locutions, déterminants, noms, « c'est bien manger ».
{ const fl = (s) => (DYSCORE.diagnoseAll(s).flags || []).filter(f => typeof f.i === 'number');
  let _vb = 0;
  for (const [s, w, sg] of [['Il refuse de nous aidé cette fois.', 'aidé', 'aider'], ['Elle a fini par se levé très tard.', 'levé', 'lever'],
                            ["Il doit m'aidé demain.", "m'aidé", "m'aider"], ['Il vient la récupéré ce soir.', 'récupéré', 'récupérer'],
                            ['Une fois rentrer à la maison, elle lit.', 'rentrer', 'rentré'], ['Tout en étant fatiguer, il travaille.', 'fatiguer', 'fatigué'],
                            ['La facture a tout de même doubler.', 'doubler', 'doublé'], ['La facture a beaucoup doubler.', 'doubler', 'doublé'],
                            ['Ce sera difficile à réparé.', 'réparé', 'réparer'], ['Il à mangé une pomme.', 'à', 'a']]) {
    const m = fl(s).find(x => x.word === w);
    if (!m || m.sugg !== sg) { _vb++; console.log('  ✗ forme du verbe : « ' + s + ' » → « ' + sg + ' » attendu, obtenu ' + JSON.stringify(m || null)); }
  }
  if (fl('Ce sera difficile à réparé.').some(x => x.word === 'à')) { _vb++; console.log('  ✗ forme du verbe : « difficile à réparé » touche encore « à »'); }
  for (const [s, w] of [['Le Nasdaq a quant à lui cédé 8 %.', 'cédé'], ['Les coureurs sont partis sur le tracé du circuit.', 'tracé'],
                        ["Les chiffres sont dans l'encadré ci-contre.", "l'encadré"], ['Il compte sur la facilité du parcours.', 'facilité'],
                        ['Le pouvoir délégué aux régions est limité.', 'délégué'], ["C'est bien manger.", 'manger']]) {
    const m = fl(s).filter(x => x.word === w);
    if (m.length) { _vb++; console.log('  ✗ forme du verbe : témoin « ' + s + ' » marqué ' + JSON.stringify(m)); }
  }
  if (_vb) { console.log('PARITÉ KO — forme du verbe : ' + _vb + ' attente(s) non tenue(s).'); process.exit(1); }
  console.log('  ✓ forme du verbe : 9 corrections (pronoms enjambés, étant, une fois, avoir + adverbes, difficile à) ; « il à mangé » → a gardé ; 6 témoins muets'); }

console.log(appOnly === 0
  ? `PARITÉ OK — dys-core ⊆ Python sur ${PHRASES.length} phrases (aucun FP propre extension). Écarts de couverture : ${gap}.`
  : `PARITÉ KO — ${appOnly} phrase(s) où l'extension flague hors Python.`);
process.exit(appOnly === 0 ? 0 : 1);
