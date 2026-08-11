// Parité APP↔Python du correcteur : extrait correctText() de l'IIFE dictée du monolithe, l'exécute headless
// (DOM bouchonné), et compare ses flags à ceux du probe Python (correcteur_probe.py) sur une batterie de phrases.
// Garantit que la règle d'accord sujet-verbe (et les 8 homophones) se comportent pareil dans l'app et le probe.
// Lancer : node dictee/parity_corr.js
const fs = require('fs'), path = require('path'), cp = require('child_process'), zlib = require('zlib');
const HERE = __dirname, HTML = path.join(HERE, '..', 'app', 'omega-pendu.html');
const html = fs.readFileSync(HTML, 'utf8'); try{globalThis.OMEGA_VDC=require('./blobgz').vdcSeed(html);}catch(e){}   // #30 : seed sync vdc-lex-gz (le moteur peuple les maps grammaire sans async)

// charge le gros lexique embarqué (OMEGA_LEX4) : posOf() en a besoin pour la garde genre
const _lx = (html.match(/<script type="text\/plain" id="lex4-data-gz">([^<]*)<\/script>/) || [])[1] || '';
if (_lx) { try { globalThis.OMEGA_LEX4 = JSON.parse(zlib.gunzipSync(Buffer.from(_lx.replace(/\s/g, ''), 'base64')).toString('utf8')); } catch (e) {} }

// POSTERIOR §3 du pluriel (bloc noun-post-gz) : seed le global OMEGA_NOUN_POST (l'app le lit comme NOUN_POST) → teste rNounPlural en parité
const _np = (html.match(/<script type="text\/plain" id="noun-post-gz">([^<]*)<\/script>/) || [])[1] || '';
if (_np) { try { globalThis.OMEGA_NOUN_POST = {}; zlib.gunzipSync(Buffer.from(_np.replace(/\s/g, ''), 'base64')).toString('utf8').split('\n').forEach(l => { const p = l.split('\t'); if (p.length >= 3) globalThis.OMEGA_NOUN_POST[p[0]] = [+p[1], +p[2]]; }); } catch (e) {} }

// POS-tagger HMM (bloc pos-hmm-gz) : seed le global OMEGA_POS_HMM (l'app le lit comme _HMM) → teste posTags en parité
const _hm = (html.match(/<script type="text\/plain" id="pos-hmm-gz">([^<]*)<\/script>/) || [])[1] || '';
if (_hm) { try { globalThis.OMEGA_POS_HMM = JSON.parse(zlib.gunzipSync(Buffer.from(_hm.replace(/\s/g, ''), 'base64')).toString('utf8')); } catch (e) {} }

/* ⚠️ GENRE RELÂCHÉ (bloc gdet-lex-gz) — IL MANQUAIT, ET CE N'ÉTAIT PAS ANODIN.
   L'app charge DEUX tables de genre : `vdc-lex.gn` (68 746, sync) et `gdet-lex-gz` (46 432, async,
   fusionnées dans GENDER_PURE par loadGenderLex). Ce harnais n'amorçait que la PREMIÈRE : il testait
   donc une app AFFAIBLIE, avec 70 374 -> 68 746 entrées de genre. Deux conséquences :
     · un écart de couverture FANTÔME était rapporté (« le poisse »→la, que la vraie app corrige) ;
     · surtout, tout FAUX POSITIF qui n'apparaît qu'une fois cette table chargée était INVISIBLE
       en CI — l'invariant « app ⊆ Python » était vérifié sur un moteur que personne n'utilise.
   Mesurer un moteur amputé, ce n'est pas mesurer le produit. */
const _gd = (html.match(/<script type="text\/plain" id="gdet-lex-gz">([^<]*)<\/script>/) || [])[1] || '';
if (_gd) { try { globalThis.OMEGA_GDET = {};
  zlib.gunzipSync(Buffer.from(_gd.replace(/\s/g, ''), 'base64')).toString('utf8').split('\n').forEach(l => {
    const p = l.split('\t'); if (p.length >= 2) globalThis.OMEGA_GDET[p[0]] = (p[1] === '1' ? 'f' : 'm'); }); } catch (e) {} }

/* PRÉNOMS (bloc prenoms-gz) — MÊME raison que le genre relâché juste au-dessus : sans ce seed,
   l'app testée n'aurait AUCUN prénom, la branche « sujet = prénom nu » ne se déclencherait jamais,
   et la parité serait verte sur une règle qui ne tourne pas. Une règle non branchée vaut zéro. */
const _pn = (html.match(/<script type="text\/plain" id="prenoms-gz">([^<]*)<\/script>/) || [])[1] || '';
if (_pn) { try { globalThis.OMEGA_PRENOMS = {};
  zlib.gunzipSync(Buffer.from(_pn.replace(/\s/g, ''), 'base64')).toString('utf8').split(/\r?\n/).forEach(l => {
    const p = l.split('\t'); if (p.length >= 3) globalThis.OMEGA_PRENOMS[p[0]] = [p[1], p[2] === '1']; }); } catch (e) {} }

// 1) extraire l'IIFE jusqu'à correctText, refermer en exposant correctText
const start = html.indexOf('(function(){', html.indexOf('mode PHRASES'));
const ctIdx = html.indexOf('function correctText', start);
const ctEnd = html.indexOf('return out;}', ctIdx) + 'return out;}'.length;
if (start < 0 || ctIdx < 0 || ctEnd < 0) { console.error('extraction IIFE échouée'); process.exit(2); }
// étendre l'extraction pour inclure posTags/_HMM/loadPosHmm (définis APRÈS correctText) — rCe/rSon les appellent (contexte tagger)
const ptIdx = html.indexOf('function posTags(T){', start);
const ptEnd = ptIdx >= 0 ? html.indexOf('}', html.indexOf('return seq.reverse();', ptIdx)) + 1 : ctEnd;
/* ⚠️ AMORCE DU LEXIQUE SPELLER. La grammaire n'est pas seule : `rInfBut` (infinitif de but) lit
   SP.POS pour savoir si un mot en -é est un VERBE PUR, et sort sur `if(!SP.ready)`. Ce harnais
   n'extrait la tranche que jusqu'à correctText/posTags — donc SP est déclaré mais VIDE, et la règle
   serait MUETTE ici : verte par omission, le piège exact du 2026-08-11. On amorce donc SP à la main
   (WORDS + POS suffisent ; on ne charge pas tout le speller, ce harnais ne teste que la grammaire). */
const code = html.slice(start, Math.max(ctEnd, ptEnd)) +
  ';globalThis.__corr=correctText;globalThis.__seedSP=function(t){if(!SP.WORDS)SP.WORDS=new Set();if(!SP.POS)SP.POS={};t.split(String.fromCharCode(10)).forEach(function(l){' +
  'var q=l.split(String.fromCharCode(9));if(q[0]){SP.WORDS.add(q[0]);if(q[2])SP.POS[q[0]]=q[2];}});SP.ready=true;};})();';

// 2) embed vdc-lex pour getElementById
const m = html.match(/<script type="application\/json" id="vdc-lex">([\s\S]*?)<\/script>/);
const EMBED = m ? m[1] : '{}';

// 3) DOM bouchon minimal (le panneau dictée se construit avant correctText)
const el = () => new Proxy(function () {}, {
  get(t, k) { if (k === 'textContent' || k === 'innerHTML' || k === 'value') return t['_' + k] || '';
    if (k === 'style') return {}; if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
    if (k === Symbol.toPrimitive) return () => ''; return el(); },
  set(t, k, v) { t['_' + k] = v; return true; }, apply() { return el(); }
});
global.document = { getElementById: (id) => id === 'vdc-lex' ? { textContent: EMBED, addEventListener() {}, value: '' } : el(),
  createElement: () => el(), body: el(), head: el(), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
global.window = el(); global.navigator = { userAgent: '' };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.speechSynthesis = { speak() {}, cancel() {}, getVoices: () => [] };
global.SpeechSynthesisUtterance = function () { return el(); };

try { (0, eval)(code); } catch (e) { console.error('exécution IIFE échouée :', e.message); process.exit(2); }
try {                                            // amorce SP (cf. le commentaire de l'extraction)
  const _sp = require('zlib').gunzipSync(require('fs').readFileSync(
    require('path').join(__dirname, '..', 'extension', 'assets', 'speller.tsv.gz'))).toString('utf8');
  globalThis.__seedSP(_sp);
} catch (e) { console.error('amorce speller échouée :', e.message); process.exit(2); }
const corr = globalThis.__corr;
if (typeof corr !== 'function') { console.error('correctText non exposé'); process.exit(2); }

// 4) batterie : doit DÉTECTER / ne doit RIEN flaguer
const PHRASES = [
  // INFINITIF DE BUT (PR en cours) — cibles ET pièges du participe ADJECTIVAL, qui est ce qui décide
  // de la forme de la règle. Les pièges comptent autant que les cibles : « épuisé » ne doit JAMAIS
  // devenir « épuiser ».
  'Je suis allé à la plage mangé des champignons.', 'Il est parti au marché acheté du pain.',
  'Je suis allé chez lui cherché mes affaires.', 'Elle est allée à la boulangerie acheté une baguette.',
  'Je suis rentré à la maison épuisé.', 'Il est allé à la fête déguisé en pirate.',
  'Elle est venue à la maison fatiguée hier.', 'Ils sont partis sur le tracé du circuit.',
  // son/sont — la branche « prédicat » ne tirait QUE si le tagger se TROMPAIT sur le participe
  // (audit 2026-08-11) : « partis »→NOUN tirait, « venus »→VERB abstenait. Les 4 formes ici.
  'les chats son venus.', 'les enfants son venus.', 'les chats son partis.',
  'les poules son dans le jardin.', 'le son de la cloche résonne.', 'son ancienne équipe a gagné.',
  // PRÉNOMS — la branche « sujet = prénom nu » DOIT être exercée ici, sinon la parité serait verte
  // sur une règle que le harnais ne déclenche jamais. Fautes ET phrases correctes (contrôle FP),
  // plus les deux gardes : coordination (sujet réel PLURIEL) et tête de proposition (majuscule ambiguë).
  'Marie est venu.', 'Julie est parti.', 'Sophie est content.', 'Léa est arrivé.',
  'ma soeur Julie est parti.', 'Marie est venue.', 'Julie est partie.',
  'Le charme et le sourire d’Helène et Olivier ont fini de nous conquérir.',
  'Pierre est venue.', 'Avril est arrivé.', 'Rose est fanée.',
  'Les enfant joue dans le jardin et il sont content. Je doit manger. On ont gagné. à mon avis.',
  'Je doit partir', 'Tu doit venir', 'Il ont faim', 'Elles a faim', 'On ont gagné', 'Ils doit manger',
  'Je peux venir', 'Tu manges bien', 'Il nous voit', 'Nous mangeons', 'Ils peut-être là', 'Vous êtes prêts',
  'Il y a un chat', 'je suis content', 'tu es gentil', 'ils doivent partir', 'il faut', 'elle veut partir',
  'on peut essayer', 'je vais bien', 'Il a mangé la soupe', 'Il veut manger la soupe', 'Les enfants sont contents',
  'Elle a trouvé un trésor', 'Elle va à Paris', 'Il prend ce livre', 'Le chat se trouve là', 'Je leur parle souvent',
  // accord sujet-verbe à sujet NOM (déterminant pluriel) + gardes FP
  'les enfants joue dans le jardin et ils ont content', 'Les oiseaux chante le matin', 'Les voitures roule vite',
  'les chats mange', 'Les chevaux galopent à travers les champs', 'Mon frère et ma sœur sont arrivés',
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
  'le chat les regarde', 'la préparation des plats est longue', 'Les enfants jouent dehors',
  // accord GENRE déterminant→nom : détection (un/une, le/la) + abstention (nom ambigu/homographe) + non-FP
  'Il a une chien', 'Elle ouvre un maison', 'la fondateur', 'un mer de nuages', 'le montagne',
  'Il a un chien', 'Elle habite une maison', 'Le jardin est vert', 'il prend la porte', 'je le vois partir',
  'un livre intéressant', 'la tour est haute',
  // mais/mes : détection (mais + nom genré) + abstention adversariale (prép / verbe-homographe / pronom)
  'et j\'ai bouliées mais lunettes', 'mais voiture est rouge', 'il dort mais porte un sac', 'il lit mais marche vite',
  'Mais sous la table', 'mais je viens', 'il rit mais pleure souvent', 'mais place est prise', 'mais cause des ennuis',
  // j'est/j'ai : détection devant déterminant (→ j'ai) + abstention ambiguë (adj/participe = aux → LLM) + non-FP
  'j\'est le poisse de oartir à la monagne', 'j\'est un chien', 'J\'est la chance', 'j\'est content', 'j\'est allé à Paris',
  'j\'est de la peine', 'j\'est du mal', 'j\'est venu hier', 'j\'est de Paris', 'j\'est entendu le tonnerre', 'j\'est de tomates fraiche',
  "j'sais que c'est vrai", "Personne n'sait où il est", "qu'tu viennes", "l'homme est là", "j'aime ça", "d'abord",
  "Ils détestons les épinards", "Ils réunissons les gens", "Vous chantez bien", "Ils chantent faux", "je sui content", "je sui allez à la plage",
  'c\'est bien', 'qu\'est-ce que tu fais', 'j\'ai un chien',
  // accord pluriel du nom (déterminant pluriel + nom singulier) : cibles + pièges (homographe/composé/pronom)
  'les enfant joue', 'des oiseau dans le ciel', 'les cheval galopent', 'il a des difficulté', 'des journal locaux',
  'les département français', 'des hit parades', 'il les porte', 'il les livre à domicile', 'les rouge vif',
  'les enfants sont là', 'je les vois', 'des chat noirs',
  // accord pluriel du nom via CARDINAL ≥2 (« cinq kilo »→kilos) — ROUGE FP=0 par l'ANCRE : cibles + pièges (invariable/nombre/composé/déjà pluriel/élision)
  'cinq kilo', 'trois chat', 'quatre journal', 'cinq cheval', 'soixante mètre',
  'cinq minima', 'cinq maxima', 'cent trente', 'deux mille', 'cinq euros', 'dix-septième arrondissement', 'vingt pour cent', 'cinq chats', 'trois cents personnes', "quatre d'entre eux",
  // pluriels SUPPLÉTIFS (morpho impossible → liste close _PL_SUPPL) — ROUGE FP=0 : cibles + pièges (déjà pluriel / propre)
  'des oeil', 'les oeil', 'cinq monsieur', 'des madame', 'trois mademoiselle', 'les bonhomme', 'des gentilhomme', 'cinq bail', 'des travail',
  'des yeux', 'les messieurs', 'des chevaux',
  // ligature œ (NOUN_POST/gardes clavés en 'oe' → normalisation œ→oe) : cibles + contrôles
  'des œil', 'des œuvre', 'des cœur', 'les sœur', 'des bœuf', 'des œuvres', 'un œil',
  // accord SV « récupéré » : ils/elles + verbe mal conjugué absent du lexique (radical+ent = 3p) + non-FP
  'elles sente bon', 'ils parte demain', 'elles mette la table', 'ils dorme bien', 'elles sentent bon', 'ils partent demain',
  'ils tienne bon', 'elles prenne le train', 'ils finisse tard', 'elles viennent ce soir', 'elles vies', 'elles vie',
  'ils ne sont pas transformé', 'elles sont allé', 'ils sont partis',
  "Personne n'sait où il est", "Ils m'détestons", "je ai entendu l'tonnerre", "une œuvre d'art", "qu'elles viennent",
  // accord SINGULIER du nom (déterminant singulier + nom pluriel → sing.) : cibles + pièges (invariant / nombre-écran / verbe / composé)
  'Le camps est installé', 'Un soucis de simplification', 'Chaque jours compte', 'La voitures rouge passe', 'Ce systemes marche',
  'Le fils de Paul', 'Un temps magnifique', 'La paix règne', 'Le savons est bon', 'Il est né le 25 mars 1957', 'un des systèmes',
  // FP homophones corrigés par WiCoPaCo (verrou anti-régression) : on/ont tête-de-proposition & relative/coordonné, a/à participe -ée, genre son après article
  'On dit que le ciel est bleu', 'Le Ba fait souffrir ceux qui ont commis le mal', "L'état et le gouvernement ont investit",
  'Ils ont une vie à durée limitée', 'Le chipset offre un son stéréo', 'Ils on grandi vite',
  // accord PARTICIPE après être à sujet NOM (branche _np_subject) : cibles + pièges (inversion / pronom élidé / sujet loin)
  'Le niveau de la population est estimée à trente pour cent', 'La biologie est apparu au vingtième siècle',
  'Le Brésil est composés de régions', 'La Bulgarie est connues pour ses monastères', 'Une partie du cours fut modifié',
  'Le chat est noir', 'Elle est venue hier', 'La reprise est annoncée', 'Les plats sont bons',
  // PP perception/factitif + INFINITIF = INVARIABLE (piège Voltaire, FP cru trouvé par Rem) : cibles invariables + contrôles (accord normal SANS infinitif)
  'ma belle-mère se les était vu confisquer à la douane', "les gens que j'ai fait venir", "elle s'est fait avoir", "elle s'est laissé tomber", "les airs que j'ai entendu jouer",
  "les erreurs que j'ai fait", "les fleurs que j'ai cueilli", 'elle est venu hier',
  // terminaison -er/-é : gouverneur être (« a été fabriquer »), clitique réfléchi (« veut se séparé »), causatif (« fait déclaré »)
  'Il a été fabriquer par un dieu', 'Le pays veut se séparé du groupe', 'On va faire évolué le code',
  'Il fait déclaré la guerre', 'Il ne faut pas utilisé de câble', 'Les origines de la cité remontent', 'Un fait divers tragique',
  // accord adjectif ÉPITHÈTE (article + nom + adj) : cibles + pièges (invariant / propre / coordination / épicène)
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

// flags Python via un petit pont
const py = cp.spawnSync('python3', ['-c', `
import sys, json
sys.path.insert(0, ${JSON.stringify(HERE)})
import correcteur_probe as C
ph = json.loads(sys.stdin.read())
print(json.dumps([[(i, w, s, n) for (i, w, s, n) in C.correct(p)] for p in ph]))
`], { input: JSON.stringify(PHRASES), encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });   // Windows : stdin cp1252 → mojibake → faux KO (audit)
if (py.status !== 0) { console.error('probe Python échoué :', py.stderr); process.exit(2); }
const pyflags = JSON.parse(py.stdout);

// Invariant : flags APP ⊆ flags Python. L'app ne doit JAMAIS flaguer ce que Python ne flague pas (= pas de
// faux positif propre à l'app) ; elle peut en flaguer MOINS (lexique embarqué HF compressé → s'abstient sur les
// verbes rares, FP-safe). Un flag JS absent de PY = divergence réelle (échec) ; PY > JS = écart de couverture (info).
let appOnly = 0, gap = 0;
const key = x => x[0] + '|' + String(x[1]).toLowerCase() + '|' + String(x[2]).toLowerCase();
PHRASES.forEach((p, k) => {
  const js = corr(p).map(f => [f.i, f.word, f.sugg, f.name]);
  const pf = pyflags[k];
  const pset = new Set(pf.map(key));
  const extra = js.filter(x => !pset.has(key(x)));      // flags présents dans l'app mais PAS dans Python = FP propre app
  if (extra.length) { appOnly++; console.log('✗ APP flague ce que PY ne flague pas :', JSON.stringify(p), JSON.stringify(extra)); }
  if (js.length < pf.length) { gap++; console.log('  (couverture) PY > APP sur :', JSON.stringify(p), '| PY=' + JSON.stringify(pf) + ' APP=' + JSON.stringify(js)); }
});
/* ⚠️ GARDE TIER — le rouge de la grammaire est PORTÉ par le flag depuis l'audit 2026-08-11.
   Sans lui, `content.js` (extension) n'applique que `tier==='auto'` et la grammaire n'est JAMAIS
   corrigée dans l'extension, alors que l'app la coche par défaut : même texte, deux comportements.
   On exige donc que toute correction de grammaire sorte avec un tier ('auto' ou 'vigilance'). */
const _SANS_TIER = [];
for (const ph of ['les enfant joue.', 'Marie est venu.', 'il a allé au cinéma.', 'les chats son venus.']) {
  for (const f of corr(ph)) if (f.tier !== 'auto' && f.tier !== 'vigilance') _SANS_TIER.push(ph + ' : ' + f.word + '→' + f.sugg + ' tier=' + f.tier);
}
if (_SANS_TIER.length) { console.log("PARITÉ KO — grammaire SANS TIER (l'extension ne l'appliquerait pas) :"); for (const x of _SANS_TIER) console.log('   ' + x); process.exit(1); }

/* ⚠️ GARDE PRÉNOMS — « app ⊆ Python » est UNIDIRECTIONNEL : si l'app cessait de charger la table
   des prénoms, elle n'émettrait plus rien et la parité resterait VERTE (les écarts de couverture
   ne sont qu'affichés). Vérifié en neutralisant le seed : 5 écarts apparaissent, mais le verdict
   restait « PARITÉ OK ». On exige donc EXPLICITEMENT que l'app produise ces corrections. */
const _ATTENDU = [['Marie est venu.', 'venue'], ['Julie est parti.', 'partie'],
                  ['Sophie est content.', 'contente'], ['Léa est arrivé.', 'arrivée'],
                  ['ma soeur Julie est parti.', 'partie']];
let _pren = 0;
for (const [ph, att] of _ATTENDU) {
  const got = corr(ph).map(f => String(f.sugg).toLowerCase());
  if (!got.includes(att)) { _pren++; console.log("✗ PRÉNOMS : l'app ne corrige plus", JSON.stringify(ph), '→', att, '(eu ' + JSON.stringify(got) + ') — table prenoms-gz chargée ?'); }
}
if (_pren) { console.log("PARITÉ KO — " + _pren + " cas prénom non corrigés par l'app."); process.exit(1); }


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
  const got = corr(ph).map(f => String(f.sugg).toLowerCase());
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
  const got = corr(ph).map(f => String(f.sugg).toLowerCase());
  if (!got.includes(att)) { _but++; console.log('✗ INFINITIF DE BUT : ' + JSON.stringify(ph) + ' doit donner « ' + att + ' », eu ' + JSON.stringify(got)); }
}
for (const ph of _BUT_NON) {
  const got = corr(ph).filter(f => f.name === 'infinitif de but');
  if (got.length) { _but++; console.log('✗ PIÈGE ADJECTIVAL : ' + JSON.stringify(ph) + ' ne doit RIEN donner, eu ' + JSON.stringify(got.map(f => f.word + '->' + f.sugg))); }
}
if (_but) { console.log('PARITÉ KO — ' + _but + ' cas « infinitif de but ».'); process.exit(1); }


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
  const all = corr(ph), got = all.filter(f => f.name === nom);
  const hit = got.find(f => String(f.sugg).toLowerCase().startsWith(att));
  if (!hit) { _r8++; console.log('✗ R8 rappel : ' + JSON.stringify(ph) + ' doit donner « ' + att + ' » [' + nom + '], eu ' + JSON.stringify(all.map(f => f.word + '->' + f.sugg))); }
  else if (hit.tier !== tier) { _r8++; console.log('✗ R8 tier : ' + JSON.stringify(ph) + ' — « ' + att + ' » doit être ' + tier + ', eu ' + hit.tier); }
}
for (const ph of _R8_NON) {
  const got = corr(ph).filter(f => _R8N.has(f.name));
  if (got.length) { _r8++; console.log('✗ R8 piège : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.word + '->' + f.sugg + '[' + f.name + ']'))); }
}
if (_r8) { console.log('PARITÉ KO — ' + _r8 + ' cas « REGLES_FR 1-8 ».'); process.exit(1); }

console.log(appOnly === 0
  ? `PARITÉ OK — aucun flag propre à l'app sur ${PHRASES.length} phrases (app ⊆ Python). Écarts de couverture (lexique HF) : ${gap}.`
  : `PARITÉ KO — ${appOnly} phrase(s) où l'app flague hors Python (FP app).`);
process.exit(appOnly === 0 ? 0 : 1);
