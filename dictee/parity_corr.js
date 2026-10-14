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
   (WORDS + POS + FREQ : depuis le 10/09/2026 la grammaire lit AUSSI SP.FREQ — rule_sujet_flexion s'abstient sur une
   cible RARE à une lettre d'un auxiliaire. Sans FREQ ici, SP.ready était vrai et la table VIDE : « Nous êtes là » se
   taisait dans ce harnais alors que le produit corrige. Mesurer un moteur amputé, ce n'est pas mesurer le produit.)
   ⭐ 09/10/2026 : + D2A (clé sans accent → formes, fréquence > 0, comme setLex) — _lemFreq en dépend : sans lui, « inconnu »
   partout, et la garde « verbe courant » du passé simple se taisait ici sur « nous mangeames » que le produit corrige. */
const code = html.slice(start, Math.max(ctEnd, ptEnd)) +
  ';globalThis.__corr=correctText;globalThis.__vig={persVig:persVig,sujFlexNom:sujFlexNom,onOntVig:onOntVig,semiInfVig:semiInfVig,rDetNumber:rDetNumber,jestVig:jestVig,ppAvoirSurnumVig:ppAvoirSurnumVig,auxManquantVig:auxManquantVig,cestCesVig:cestCesVig};globalThis.__toks=toks;globalThis.__segOn=function(t){_SEG=_segInfo(t);};globalThis.__seedSP=function(t){var L=t.split(String.fromCharCode(10)).filter(function(l){return l&&l.split(String.fromCharCode(9)).length>=2;});_spReset(L.length);L.forEach(function(l){' +
  /* ⭐ 13/10/2026 — dictionnaire COMPACT : l'amorce passe par les fonctions MÊMES du produit (_spReset / _spAdd, puis le tri par
     fréquence de la construction) au lieu d'écrire SP.FREQ[…] à la main — l'ancien format, que le moteur ne lit plus. */
  'var q=l.split(String.fromCharCode(9));_spAdd(q[0],parseInt(q[1],10),q[2]);});var sf=function(a,b){return spF(b)-spF(a);};SP.D2M.forEach(function(v){if(typeof v!=="string")v.sort(sf);});SP.ready=true;};})();';

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
  // COQUILLE DE LA SOURCE (Lexique 4) : « soulais » y est déclaré imparfait de VOULOIR. Le Python répare la
  // TABLE au chargement ; le JS ne le faisait que dans une règle, donc rAccordSV écrivait le non-mot en ROUGE.
  // La sonde savait voir (sa clé contient la SUGGESTION) — il lui manquait la phrase.
  'Ce que je vouliez.', 'Il faut que je vouliez souvent.',
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
  'Mon collègue vérifiais les comptes', 'Le technicien réparais la machine', 'Je gardais le secret', 'Tu regardais la télévision', 'Les responsables installais tout',
  // PRONOM ÉLIDÉ (_prevPron, 30/08/2026) : ces cas n'étaient exercés par AUCUNE sonde de parité (enquête
  // détection-du-sujet). Cibles (5 règles rataient l'élidé) + gardes (français CORRECT : « et lorsqu'elle
  // dort » cassé en dorment par rAccordVerbCoord avant le correctif — les moteurs doivent rester muets).
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
  'la réunion a lieu demain', 'il a besoin de toi', 'a priori tout va bien',
  'Requiem for a Dream le film', 'de 35 a 40 ans', 'le chien a soif ce soir',
  // ⭐ a/à : le garde d'INVERSION ne vérifiait pas ce qu'il nommait (un verbe en i-2 suffisait, sans
  // exiger un PRONOM en i-1) et l'ancre AVANT ne voyait pas à travers une élision. Résultat : la règle
  // se taisait sur tout « VERBE + nom + a ». Cibles + les deux gardes qui doivent RESTER muettes.
  "Mon collègue modifierait l'article a reception de la commande",
  "il est rentré de l'école a vélo", "elle a rangé l'assiette a table",
  'Avait il a manger ce soir', 'A-t-il a manger ce soir',
];
PHRASES.push(...fs.readFileSync(path.join(HERE, 'phrases_courantes.txt'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && s[0] !== '#'));   // ⭐ 13/09/2026 : phrases courantes 1re/2e personne — « Je ne peux pas. » → *puis* en rouge du 07 au 13/09, vu par aucun corpus
PHRASES.push("Les décisions prises hier sont bonnes.", "Les promesses faites aux électeurs.", "Des photos prises au hasard.", "Une sélection de produits mises en avant.", "Il bele sans arrêt.");   // ⭐ 13/10/2026 : listes n° 4 et 1b
PHRASES.push("Le chevalier porte d'lourde armure.", "Elle s'mariée l'an dernier.", "Ils s'mariés en mai.", "Il va s'marier en mai.", "Ils s'disputent souvent.", "J'sais pas.", "Une barre d'fer.", "Il vend de l'pétrole.", "Le stade Ben M'barek est plein.", "Une maison d'du bois.", "J'mangé une pomme.", "Il est parti d'bonne heure.", "Il faut s'marié jeune.", "Elle va s'mariée en mai.");   // ⭐ 13/09/2026 : élision inversée — rouge sûr, orange avec le mot manquant, nom propre muet (paliers comparés)

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


/* GARDE « PERSONNE DU VERBE » (2026-09-15) — LE RAPPEL, pas seulement l'absence de FP.
   « app ⊆ Python » est unidirectionnel : un moteur MUET passe la parité. C'est exactement ce qui est arrivé
   au #699 : « Nous allez au parc » corrigé par la référence, MUET dans le produit pendant un jour, parce que
   la garde des modaux avait été portée avec un autre test (« le mot suivant n'a aucune lecture conjuguée »,
   vrai de « au »). Rem l'a vu dans son Chrome ; aucune sonde ne pouvait le dire. Même parade que pour les
   prénoms et l'infinitif de but : on EXIGE la sortie, et on garde les pièges à côté.
   Les pièges comptent autant que les cibles : la garde des modaux doit continuer de taire « je vais MANGER ». */
const _CONJ_OUI = [['Nous allez au parc.', 'allons'], ['Nous êtes là.', 'sommes'],
                   ['Nous iriez au cinéma.', 'irions'], ['Nous mangeames bien.', 'mangeâmes'],
                   ['Vous mangeates bien.', 'mangeâtes'], ['Ils mangerent bien.', 'mangèrent']];
const _CONJ_NON = ['Je vais manger des pommes.', 'Nous allons manger.', 'Vous allez partir bientôt.',
                   'Il peut venir demain.', 'Nous primes le train.', 'Nous mangeâmes bien.',
                   'On sent que vous maitrisez votre sujet.'];
let _conj = 0;
for (const [ph, att] of _CONJ_OUI) {
  const got = corr(ph).map(f => String(f.sugg).toLowerCase());
  if (!got.includes(att)) { _conj++; console.log('✗ PERSONNE DU VERBE : ' + JSON.stringify(ph) + ' doit donner « ' + att + ' », eu ' + JSON.stringify(got)); }
}
for (const ph of _CONJ_NON) {
  const got = corr(ph).filter(f => f.name === 'personne du verbe');
  if (got.length) { _conj++; console.log('✗ PIÈGE CONJUGAISON : ' + JSON.stringify(ph) + ' ne doit RIEN donner, eu ' + JSON.stringify(got.map(f => f.word + '->' + f.sugg))); }
}
if (_conj) { console.log('PARITÉ KO — ' + _conj + ' cas « personne du verbe ».'); process.exit(1); }


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

/* ⭐ 11/10/2026 — lot 6 : « a » écrit pour « à » (orange) — autres locutions (par rapport à, à travers, à la fois, à condition de, à
   nouveau), avoir droit à, un LIEU après « a », une ville après une durée ; silences : pronom sujet devant, « il y a », « a force de
   loi », nom sujet après un déterminant (« la face a été »). Python : même liste (_aa_locution). */
{ let _k6 = 0;
  const aa = (ph) => corr(ph).filter(f => String(f.word).toLowerCase() === 'a' && f.sugg === 'à');
  for (const ph of ["Il va voir son papi a l'hôpital.", 'Il part une semaine a Paris.', "Par rapport a la France, c'est petit.", 'Il a droit a un contrat.',
                    'Il travaille a la fois vite et bien.', 'Il marche a travers la forêt.', 'Elle vient a condition de payer.', 'Il recommence a nouveau.']) {
    if (aa(ph).length !== 1) { _k6++; console.log('✗ a/à : ' + JSON.stringify(ph) + ' doit donner un seul « à », eu ' + aa(ph).length); } }
  for (const ph of ['Nous avons gagné, on a la piscine pour nous.', 'Il y a la mer.', 'Cette loi a force de loi.', 'La face a été repeinte.']) {
    if (aa(ph).length) { _k6++; console.log('✗ a/à : ' + JSON.stringify(ph) + ' doit rester muet'); } }
  if (_k6) { console.log('PARITÉ KO — ' + _k6 + ' cas « a / à ».'); process.exit(1); } }

/* ⭐ 11/10/2026 — infinitif attendu (lot 3), côté ROUGE : la ponctuation de l'AUTEUR sépare le gouverneur du mot (« il doit, épuisé,
   s'arrêter » recevait « épuiser », « il va, pressé, vers la gare » → presser) ; « facile a réparer » garde son infinitif (la faute est
   le « a », il devenait « réparé ») ; « s'il vous plaît, cherché » → cherchez reste corrigé. Python : mêmes gardes (rule_e_er, rule_flexion_er). */
{ let _k3 = 0;
  for (const [ph, w] of [["Il doit, épuisé, s'arrêter.", 'épuisé'], ['Il va, pressé, vers la gare.', 'pressé'], ["C'est facile a réparer.", 'réparer'], ['Ce meuble est difficile a ranger.', 'ranger']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _k3++; console.log('✗ infinitif attendu : ' + JSON.stringify(ph) + ' doit laisser « ' + w + ' », eu ' + JSON.stringify(got.map(f => f.word + '->' + f.sugg + '[' + f.name + ']'))); } }
  { const got = corr("S'il vous plaît, cherché la clé.").filter(f => f.word === 'cherché');
    if (!got.length || got[0].sugg !== 'cherchez') { _k3++; console.log('✗ infinitif attendu : « cherché » doit donner « cherchez », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  if (_k3) { console.log('PARITÉ KO — ' + _k3 + ' cas « infinitif attendu ».'); process.exit(1); } }

/* ⭐ 13/10/2026 — TABLE COMPACTE (dictee/conj_io.py) : les fichiers ne portent plus l'index `f` en clair, il se recalcule depuis `c`.
   _cjR = le recalcul du PRODUIT (dys-core), utilisé ici pour lire les tables comme le moteur les lit. */
const _cjR = (() => { const prev = global.DYSCORE; require(path.join(__dirname, '..', 'extension', 'dys-core.js')); const f = global.DYSCORE.cjRebuild; global.DYSCORE = prev; return f; })();

/* ⭐ 13/10/2026 — conjugaison 14 : la table COMPLÈTE (Rem : un verbe est un verbe, un temps est un temps) — tous les verbes de Morphalou,
   le passé simple à toutes les personnes, le subjonctif imparfait, l'impératif ; ce qui n'entre pas, et pourquoi : une forme que l'usage ne
   lit jamais comme verbe (piétons, habitat), le futur d'ouïr (« orrai » sonne « aurai »). Python : dictee/complete_conj_morphalou.py. */
{ let _kc14 = 0;
  for (const fn of ['cgram_conj.json', 'cgram_hf.json']) {
    let J = JSON.parse(fs.readFileSync(path.join(__dirname, fn), 'utf8')); if (J.cj) J = J.cj; J = _cjR(J);
    const C = J.c, F = J.f, cel = (l, t, s) => ((C[l] || {})[t] || {})[s];
    if (Object.keys(C).length < 12000) { _kc14++; console.log('✗ conjugaison 14 : ' + fn + ' — ' + Object.keys(C).length + ' verbes seulement (tous ceux de Morphalou attendus)'); }
    for (const [l, t, s, f] of [['rissoler', 'ind:pre', '1p', 'rissolons'], ['manger', 'ind:pas', '2p', 'mangeâtes'], ['venir', 'sub:imp', '1p', 'vinssions'], ['manger', 'imp:pre', '2s', 'mange']])
      if (cel(l, t, s) !== f) { _kc14++; console.log('✗ conjugaison 14 : ' + fn + ' — ' + l + ' ' + t + ' ' + s + ' = ' + JSON.stringify(cel(l, t, s)) + ', attendu ' + f); }
    for (const k of ['pietons', 'habitat', 'contrat', 'orrai'])
      if (F[k] && /pieter|habiter|contrer|ouir/.test(F[k])) { _kc14++; console.log('✗ conjugaison 14 : ' + fn + ' — « ' + k + ' » porte une lecture verbale (' + F[k] + ')'); } }
  { // TABLE COMPACTE : le recalcul de `f` est le MÊME en Python (conj_io.reconstruire) et dans le produit (dys-core _cjRebuild)
    const crypto = require('crypto'), cp = require('child_process');
    const h = (F) => crypto.createHash('sha1').update(JSON.stringify(Object.keys(F).sort().map(k => [k, F[k]]))).digest('hex');
    for (const fn of ['cgram_conj.json', 'cgram_hf.json']) {
      let J = JSON.parse(fs.readFileSync(path.join(__dirname, fn), 'utf8')); if (J.cj) J = J.cj;
      if (J.f) { _kc14++; console.log('✗ table compacte : ' + fn + " porte encore l'index `f` en clair (plus de 25 Mio : le site ne se déploie plus)"); continue; }
      const py = cp.execFileSync('python3', ['-c', "import sys,json,hashlib;sys.path.insert(0,sys.argv[1]);import conj_io;d=conj_io.charger(sys.argv[2]);F=(d['cj'] if 'cj' in d else d)['f'];"
        + "print(hashlib.sha1(json.dumps([[k,F[k]] for k in sorted(F)],ensure_ascii=False,separators=(',',':')).encode('utf-8')).hexdigest())", __dirname, path.join(__dirname, fn)],
        { encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) }).trim();
      if (h(_cjR(J).f) !== py) { _kc14++; console.log('✗ table compacte : ' + fn + ' — le recalcul de `f` diffère entre Python (conj_io) et le produit (dys-core)'); } } }
  for (const [ph, w, sg] of [['Nous rissolent les pommes de terre.', 'rissolent', 'rissolons'], ['Ils procrastine toujours devant leurs devoirs.', 'procrastine', 'procrastinent'],
                             ['Il fallait que nous vinssent plus tôt.', 'vinssent', 'vinssions']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _kc14++; console.log('✗ conjugaison 14 : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [['Les piétons traversent la place.', 'piétons'], ['Allez vite découvrir ce joli coin.', 'vite'],
                         ["Sa réussite rapide dés septembre suscita l'envie.", 'septembre'], ["Sa réussite rapide dés septembre suscita l'envie.", 'suscita'],
                         ['Il est parti dés lundi matin.', 'lundi'], ['Il est parti dés lundi matin.', 'matin']]) {   // « dés » accentué n'est jamais l'article « des »
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _kc14++; console.log('✗ conjugaison 14 : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_kc14) { console.log('PARITÉ KO — ' + _kc14 + ' cas « conjugaison 14 ».'); process.exit(1); } }

/* ⭐ 13/10/2026 — conjugaison 15 : une case REMPLIE de la table reçoit sa lecture. Le passé simple au pluriel (« accusâmes »,
   « accusèrent ») était dans `c` depuis le 08/09 mais absent de `f` : 13 555 lectures que svReads ne lisait pas.
   Python : lire_cases() dans dictee/complete_conj_morphalou.py. */
{ let _kc15 = 0;
  for (const fn of ['cgram_conj.json', 'cgram_hf.json']) {
    let J = JSON.parse(fs.readFileSync(path.join(__dirname, fn), 'utf8')); if (J.cj) J = J.cj; J = _cjR(J);
    for (const [k, r] of [['accuserent', 'accuser;ind:pas;3;p'], ['accusames', 'accuser;ind:pas;1;p'], ['accusates', 'accuser;ind:pas;2;p'], ['donnerent', 'donner;ind:pas;3;p']])
      if (!String(J.f[k] || '').split('|').includes(r)) { _kc15++; console.log('✗ conjugaison 15 : ' + fn + ' — « ' + k + ' » sans la lecture ' + r); } }
  for (const [ph, w] of [['Ils accusèrent le voisin à tort.', 'accusèrent'], ['Nous accusâmes le voisin à tort.', 'accusâmes']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _kc15++; console.log('✗ conjugaison 15 : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_kc15) { console.log('PARITÉ KO — ' + _kc15 + ' cas « conjugaison 15 ».'); process.exit(1); } }

/* ⭐ 13/10/2026 — conjugaison 13 : le clitique ÉLIDÉ collé au verbe (« les pompiers n'arrive pas » → n'arrivent, « les rideaux l'abrite » →
   l'abritent, « les cahiers s'entasse » → s'entassent) — l'accord sujet-verbe à sujet nominal sautait tout mot à apostrophe. Python :
   rule_accord_sv_noun_elid. */
{ let _kc13 = 0;
  for (const [ph, w, sg] of [["Les pompiers n'arrive pas à temps.", "n'arrive", "n'arrivent"], ["Les rideaux l'abrite du soleil.", "l'abrite", "l'abritent"],
                             ["Les cahiers s'entasse sur le bureau.", "s'entasse", "s'entassent"]]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _kc13++; console.log('✗ conjugaison 13 : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [["Le pompier n'arrive pas à temps.", "n'arrive"], ["Les rideaux l'abritent du soleil.", "l'abritent"], ["La maîtresse l'écoute en silence.", "l'écoute"]]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _kc13++; console.log('✗ conjugaison 13 : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_kc13) { console.log('PARITÉ KO — ' + _kc13 + ' cas « conjugaison 13 ».'); process.exit(1); } }

/* ⭐ 13/10/2026 — conjugaison 12 : l'impératif sans trait d'union (« impératif à vérifier ») — verbe en tête, sans sujet, avec un indice de
   la 2e personne (ton, ta, tes, vos…) ; « vas » sans « -y ». Silences : sujet inversé (« vient ensuite ton cousin »), « vas-y », forme
   juste, inversion interrogative, « soit » mathématique, sujet présent. Python : rule_imperatif_seul. */
{ let _kc12 = 0;
  for (const [ph, w, sg] of [['Prend ton sac de sport.', 'Prend', 'Prends'], ['Finit ton goûter avant de jouer.', 'Finit', 'Finis'],
                             ['Rangé vos jouets avant le dîner.', 'Rangé', 'Rangez'], ['Vas chercher le pain.', 'Vas', 'Va'],
                             ['Manges tes légumes verts.', 'Manges', 'Mange'], ['Soit gentil avec ta cousine.', 'Soit', 'Sois']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _kc12++; console.log('✗ conjugaison 12 : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [['Vient ensuite ton cousin.', 'Vient'], ['Vas-y doucement.', 'Vas'], ['Prends ton sac de sport.', 'Prends'],
                         ['Dit-il toujours la vérité ?', 'Dit'], ['Soit un carré ABCD.', 'Soit'], ['Tu prends ton sac.', 'prends']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _kc12++; console.log('✗ conjugaison 12 : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_kc12) { console.log('PARITÉ KO — ' + _kc12 + ' cas « conjugaison 12 ».'); process.exit(1); } }

/* ⭐ 12/10/2026 — conjugaison 10 : le temps de la protase (« temps du verbe à vérifier ») — « si » en tête + futur → présent ; « quand /
   lorsque » + conditionnel avec une principale au futur → futur ; et le sujet NOMINAL d'avant le mot de liaison (« le facteur passe et nous
   partiront » → partirons) ; « la voisine nous appelle et nous invite » n'est plus réécrit (rouge faux depuis la conjugaison 7).
   Silences : concordance au conditionnel, interrogation indirecte. Python : rule_temps_protase, _ellipse_accorde. */
{ let _kc10 = 0;
  for (const [ph, w, sg] of [['Quand je serais plus grand, je serai vétérinaire.', 'serais', 'serai'], ['Si tu viendras samedi, nous irons à la piscine.', 'viendras', 'viens'],
                             ['Lorsque nous aurions mangé, nous partirons.', 'aurions', 'aurons'], ['Le facteur passe et nous partiront ensuite.', 'partiront', 'partirons']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _kc10++; console.log('✗ conjugaison 10 : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [['Il disait que, quand il serait grand, il serait marin.', 'serait'], ['Je me demande si tu viendras samedi.', 'viendras'],
                         ['Si tu viens samedi, nous irons à la piscine.', 'irons'], ['La voisine nous appelle et nous invite.', 'invite']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _kc10++; console.log('✗ conjugaison 10 : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_kc10) { console.log('PARITÉ KO — ' + _kc10 + ' cas « conjugaison 10 ».'); process.exit(1); } }

/* ⭐ 12/10/2026 — conjugaison 9 : un pronom RÉFLÉCHI complément INDIRECT (« nous nous sommes parlé », « ils se sont téléphoné »)
   laisse le participe invariable — l'accord du participe après être ne le réaccorde plus. Python : _REFL_COI dans rule_pp_etre. */
{ let _kc9 = 0;
  for (const [ph, w] of [['Nous nous sommes parlé hier soir.', 'parlé'], ['Ils se sont téléphoné hier soir.', 'téléphoné'],
                         ['Ils se sont succédé au pouvoir.', 'succédé'], ['Elles se sont lavé les mains.', 'lavé']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _kc9++; console.log('✗ conjugaison 9 : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  { const got = corr('Elle est parti tôt.').filter(f => f.word === 'parti');
    if (!got.length || got[0].sugg !== 'partie') { _kc9++; console.log('✗ conjugaison 9 : « elle est parti » doit rester corrigé, eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  if (_kc9) { console.log('PARITÉ KO — ' + _kc9 + ' cas « conjugaison 9 ».'); process.exit(1); } }

/* ⭐ 12/10/2026 — conjugaison 8 : les lectures FANTÔMES retirées de la table (dictee/complete_conj_morphalou.py, fantomes) — « vus » ne
   se lit plus « voir, présent je / tu », « dit » plus futur, « suis » plus « être, tu », « as » plus « avoir, je » (Python et table embarquée) ;
   « j'as », « j'a » → j'ai. Python : rule_jest. */
{ let _kc8 = 0;
  for (const fn of ['cgram_conj.json', 'cgram_hf.json']) {
    let J = JSON.parse(fs.readFileSync(path.join(__dirname, fn), 'utf8')); if (J.cj) J = J.cj; J = _cjR(J);
    for (const [k, r] of [['vus', 'voir;ind:pre;1;s'], ['vus', 'voir;ind:pre;2;s'], ['dit', 'dire;ind:fut;3;s'], ['suis', 'etre;ind:pre;2;s'], ['as', 'avoir;ind:pre;1;s']])
      if (String(J.f[k] || '').split('|').includes(r)) { _kc8++; console.log('✗ conjugaison 8 : ' + fn + ' porte encore la lecture fantôme ' + k + ' = ' + r); }
    for (const [k, r] of [['vois', 'voir;ind:pre;1;s'], ['dit', 'dire;ind:pre;3;s'], ['suis', 'etre;ind:pre;1;s'], ['as', 'avoir;ind:pre;2;s'], ['sortais', 'sortir;ind:imp;1;s']])
      if (!String(J.f[k] || '').split('|').includes(r)) { _kc8++; console.log('✗ conjugaison 8 : ' + fn + ' a perdu la lecture juste ' + k + ' = ' + r); } }
  for (const [ph, w, sg] of [["J'as froid ce matin.", "J'as", "J'ai"], ["J'a perdu mon stylo bleu.", "J'a", "J'ai"]]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _kc8++; console.log('✗ conjugaison 8 : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [['Elles on vus la mer hier.', 'vus'], ['Tu suis le sentier du bois.', 'suis'], ['Je garde le chat du voisin.', 'garde']]) {
    const got = corr(ph).filter(f => f.word === w && f.name === 'accord sujet-verbe');
    if (got.length) { _kc8++; console.log('✗ conjugaison 8 : ' + JSON.stringify(ph) + ' : « ' + w + ' » ne doit pas être réaccordé, eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  if (_kc8) { console.log('PARITÉ KO — ' + _kc8 + ' cas « conjugaison 8 ».'); process.exit(1); } }

/* ⭐ 12/10/2026 — conjugaison 7 : « nous » / « vous » sujets après et, puis, mais… (« puis nous mangeront » → mangerons), « elles en on » → ont — sauf
   quand la forme écrite s'accorde avec le sujet pronom d'avant (« il nous salue et nous embrasse » : sujet sous-entendu) ou que le
   sujet d'avant est un nom. Python : _ellipse_accorde. */
{ let _kc7 = 0;
  for (const [ph, w, sg] of [['Je range la cuisine puis nous mangeront dehors.', 'mangeront', 'mangerons'],
                             ['Tu lis un livre mais vous jouerai aux cartes.', 'jouerai', 'jouerez'], ['Elles en on assez de la pluie.', 'on', 'ont']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _kc7++; console.log('✗ conjugaison 7 : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [['Il nous salue et nous embrasse.', 'embrasse'], ['Elle vous attend puis vous accompagne.', 'accompagne'],
                         ['Les cousins partent et nous rejoindront plus tard.', 'rejoindront'], ['Ils nous regardent et nous sourient.', 'sourient']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _kc7++; console.log('✗ conjugaison 7 : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_kc7) { console.log('PARITÉ KO — ' + _kc7 + ' cas « conjugaison 7 ».'); process.exit(1); } }

/* ⭐ 12/10/2026 — conjugaison 6 : les auxiliaires et l'antécédent que la règle ne voyait pas — « des » article devant l'antécédent de
   « qui » (après il y a, voici, un verbe), « ne son » / « n'on » / « son » + adverbe + adjectif pluriel, « nous saura » (homographe d'un
   verbe rare), « vous faite / disez ». Silences : « des » après un nom, « un des … qui », « vous contredisez », « nous » complément,
   « son » possessif après la négation. Python : _des_article, rule_son_sont, rule_on_ont, _ps_rare, rule_vous_irr. */
{ let _kc6 = 0;
  for (const [ph, w, sg] of [['Il y a des lutins qui danse dans la clairière.', 'danse', 'dansent'], ['Je vois des oiseaux qui chante sur la branche.', 'chante', 'chantent'],
                             ['Voici des cousins qui arrive de Lille.', 'arrive', 'arrivent'], ['Les lapins ne son jamais rentrés tôt.', 'son', 'sont'],
                             ['Les deux valises son presque pareilles.', 'son', 'sont'], ["Mes voisins n'on pas de jardin.", "n'on", "n'ont"],
                             ['Nous saura la réponse demain soir.', 'saura', 'saurons'], ['Vous faite trop de bruit le soir.', 'faite', 'faites'],
                             ['Vous disez toujours la même chose.', 'disez', 'dites']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _kc6++; console.log('✗ conjugaison 6 : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [['La saison des pluies qui durera longtemps commence.', 'durera'], ['Elle parle à un des élèves qui est arrivé hier.', 'est'],
                         ['Vous contredisez votre frère sans cesse.', 'contredisez'], ['Elle nous saura gré de cette aide.', 'saura'],
                         ['Il ne perd jamais son calme.', 'son']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _kc6++; console.log('✗ conjugaison 6 : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_kc6) { console.log('PARITÉ KO — ' + _kc6 + ' cas « conjugaison 6 ».'); process.exit(1); } }

/* ⭐ 12/10/2026 — conjugaison 5 : le conditionnel attendu (« conditionnel à vérifier ») — après « si » + imparfait, la principale au
   conditionnel ; « je voudrai un café » → voudrais. Silences : « si » + présent (futur juste), conditionnel déjà juste, « quand » + futur,
   « je voudrai partir » (vrai futur possible), interrogation indirecte. Python : rule_cond_si. */
{ let _kc5 = 0;
  for (const [ph, w, sg] of [["Si j'avais de l'argent, j'achèterai une voiture.", "j'achèterai", "j'achèterais"], ['Si tu venais, nous irons au parc.', 'irons', 'irions'],
                             ["S'il pleuvait, il restera à la maison.", 'restera', 'resterait'], ["Je voudrai un café, s'il vous plaît.", 'voudrai', 'voudrais']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _kc5++; console.log('✗ conjugaison 5 : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [["Si j'ai de l'argent, j'achèterai une voiture.", "j'achèterai"], ['Si tu viens, nous irons au parc.', 'irons'],
                         ["Si j'avais de l'argent, j'achèterais une voiture.", "j'achèterais"], ['Quand je serai grand, je voudrai partir.', 'voudrai'],
                         ['Je voudrai partir demain.', 'voudrai'], ['Je me demande si tu venais, mais tu viendras.', 'viendras']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _kc5++; console.log('✗ conjugaison 5 : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_kc5) { console.log('PARITÉ KO — ' + _kc5 + ' cas « conjugaison 5 ».'); process.exit(1); } }

/* ⭐ 12/10/2026 — conjugaison 4 : le MODE du verbe — subjonctif après un déclencheur certain (« subjonctif à vérifier ») et « si » +
   conditionnel → imparfait pour tous les verbes. Silences : subjonctif déjà juste, « je pense que » (indicatif), « il sait bien que »,
   « après que », interrogation indirecte. Python : rule_subjonctif, rule_si_cond. */
{ let _kc4 = 0;
  for (const [ph, w, sg] of [['Il faut que tu viens demain.', 'viens', 'viennes'], ['Il faut que je fais mes devoirs.', 'fais', 'fasse'],
                             ["Bien qu'il est malade, il travaille.", 'est', 'soit'], ["Pour que tu peux venir, je t'attends.", 'peux', 'puisses'],
                             ['Il faut que nous mangeons tôt.', 'mangeons', 'mangions'], ['Si tu viendrais, on irait au parc.', 'viendrais', 'venais']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _kc4++; console.log('✗ conjugaison 4 : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [['Il faut que tu viennes demain.', 'viennes'], ["Je pense qu'il vient demain.", 'vient'], ['Il sait bien que tu es là.', 'es'],
                         ["Après qu'il est parti, on a mangé.", 'est'], ['Il demande si tu viendrais.', 'viendrais']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _kc4++; console.log('✗ conjugaison 4 : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_kc4) { console.log('PARITÉ KO — ' + _kc4 + ' cas « conjugaison 4 ».'); process.exit(1); } }

/* ⭐ 12/10/2026 — conjugaison 3 : le passé simple d'être et d'avoir dans la table (fus, fut, furent, eut, eurent). Prises : « ils fut » →
   furent, « il eurent » → eut. Python : rule_sujet_flexion (+ garde des titres). */
{ let _kc3 = 0;
  for (const fn of ['cgram_conj.json', 'cgram_hf.json']) {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, fn), 'utf8')), C = (fn === 'cgram_hf.json' ? d.cj : d).c;
    for (const [l, pn, f] of [['etre', '3s', 'fut'], ['etre', '3p', 'furent'], ['avoir', '3s', 'eut'], ['avoir', '3p', 'eurent']])
      if ((((C[l] || {})['ind:pas']) || {})[pn] !== f) { _kc3++; console.log('✗ conjugaison 3 : ' + fn + ' — ' + l + ' passé simple ' + pn + ' ≠ « ' + f + ' » — relancer dictee/complete_conj_morphalou.py'); } }
  for (const [ph, w, sg] of [['Ils fut contents.', 'fut', 'furent'], ['Il eurent peur.', 'eurent', 'eut']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _kc3++; console.log('✗ conjugaison 3 : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  if (_kc3) { console.log('PARITÉ KO — ' + _kc3 + ' cas « conjugaison 3 ».'); process.exit(1); } }

/* ⭐ 12/10/2026 — conjugaison 2 : + subjonctif et passé simple (je / il / ils, verbes courants) dans la table, et gardes dans la règle
   de la personne. Prises : « il apercut » → aperçut, « elle révèla » → révéla (accent seul : ORANGE), « ils construisit » →
   construisirent, « il faut que nous parte » → partions ; silences : nom propre au milieu de la phrase (« Marguerite Duras écrit »),
   passé simple juste. Garde de remplissage : subjonctif et passé simple. Python : rule_sujet_flexion, tier_of. */
{ let _kc2 = 0;
  for (const fn of ['cgram_conj.json', 'cgram_hf.json']) {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, fn), 'utf8')), C = (fn === 'cgram_hf.json' ? d.cj : d).c, L = Object.keys(C);
    for (const [t, min] of [['sub:pre', 31000], ['ind:pas', 16000]]) {   // ⭐ 13/10/2026 (conjugaison 14) : en CASES, plus en % — la table complète a doublé le nombre de verbes (les rares ont des formes incomplètes), le % baissait alors que les cases doublaient
      let n = 0; for (const l of L) n += Object.keys(C[l][t] || {}).length;
      if (n < min) { _kc2++; console.log('✗ conjugaison 2 : ' + fn + ' ' + t + ' : ' + n + ' cases (< ' + min + ') — relancer dictee/complete_conj_morphalou.py'); } } }
  for (const [ph, w, sg] of [['Il apercut la mer.', 'apercut', 'aperçut'], ['Elle révèla le secret.', 'révèla', 'révéla'],
                             ['Ils construisit une maison.', 'construisit', 'construisirent'], ['Il faut que nous parte demain.', 'parte', 'partions']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _kc2++; console.log('✗ conjugaison 2 : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [['Marguerite Duras écrit un roman.', 'Duras'], ['Il construisit une maison.', 'construisit']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _kc2++; console.log('✗ conjugaison 2 : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_kc2) { console.log('PARITÉ KO — ' + _kc2 + ' cas « conjugaison 2 ».'); process.exit(1); } }

/* ⭐ 12/10/2026 — conjugaison 1 : la table des règles complétée par Morphalou (présent, imparfait, futur, conditionnel ;
   dictee/complete_conj_morphalou.py). Une case vide faisait taire la règle de la personne : « nous expliquerait » restait sans
   « expliquerions ». Garde de REMPLISSAGE (les deux tables : référence Python et embarquée) + prises + silences. */
{ let _kc = 0;
  for (const fn of ['cgram_conj.json', 'cgram_hf.json']) {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, fn), 'utf8')), C = (fn === 'cgram_hf.json' ? d.cj : d).c, L = Object.keys(C);
    for (const [t, min] of [['ind:pre', 34000], ['ind:imp', 32000], ['ind:fut', 33000], ['cnd:pre', 33000]]) {   // ⭐ 13/10/2026 (conjugaison 14) : en CASES (le % ne se compare plus depuis la table complète)
      let n = 0; for (const l of L) n += Object.keys(C[l][t] || {}).length;
      if (n < min) { _kc++; console.log('✗ conjugaison : ' + fn + ' ' + t + ' : ' + n + ' cases (< ' + min + ') — relancer dictee/complete_conj_morphalou.py'); } } }
  for (const [ph, w, sg] of [['Nous expliquerait tout demain.', 'expliquerait', 'expliquerions'], ['Vous bougeait trop hier.', 'bougeait', 'bougiez'],
                             ['Nous surveillerait la maison.', 'surveillerait', 'surveillerions'], ['Nous convaincrait le jury.', 'convaincrait', 'convaincrions']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _kc++; console.log('✗ conjugaison : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [['Nous expliquerions tout demain.', 'expliquerions'], ['Vous bougiez trop hier.', 'bougiez'], ['Nous surveillerions la maison.', 'surveillerions']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _kc++; console.log('✗ conjugaison : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_kc) { console.log('PARITÉ KO — ' + _kc + ' cas « conjugaison ».'); process.exit(1); } }

/* ⭐ 12/10/2026 — lot 14 : pronom sujet + mes / tes + participe → m'a, t'a, m'as, m'ont (« petit mot après le sujet à vérifier ») ;
   « voire » dans une place d'infinitif → voir (« mot-outil à vérifier ») ; silences : « il mes amis », « il mange mes frites », « voire »
   après une virgule ou un adjectif. Python : _aps_mes_pp, rule_homophone_mo. */
{ let _k14 = 0;
  for (const [ph, w, sg] of [['Elle mes dit de venir.', 'mes', "m'a"], ['Il mes donné un livre.', 'mes', "m'a"], ['Tu mes manqué.', 'mes', "m'as"],
                             ['Ils mes aidé.', 'mes', "m'ont"], ['Elle tes vu hier.', 'tes', "t'a"], ['Il est venu voire sa mère.', 'voire', 'voir'],
                             ['Il veut voire le match.', 'voire', 'voir']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _k14++; console.log('✗ mes / voire : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [['Il mes amis sont là.', 'mes'], ['Il mange mes frites.', 'mes'], ['Plusieurs jours, voire des semaines.', 'voire'], ["C'est rare voire unique.", 'voire']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _k14++; console.log('✗ mes / voire : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_k14) { console.log('PARITÉ KO — ' + _k14 + ' cas « mes / voire ».'); process.exit(1); } }

/* ⭐ 12/10/2026 — lot 13 : forme finie après ÊTRE écrite pour le participe (orange, « participe après être à vérifier ») — il est
   partit → parti, elle est sortit → sortie, ils sont partit → partis, c'est finit → fini, je me suis fais mal → fait, c'est permit →
   permis, il est prit → pris ; silences : « il est déjà nuit » (nom), « le choc est subit » (adjectif), participe déjà juste ou
   accordé (« sont apparus »). Python : rule_etre_fini. */
{ let _k13 = 0;
  for (const [ph, w, sg] of [['Il est partit tôt.', 'partit', 'parti'], ['Elle est sortit hier.', 'sortit', 'sortie'], ['Ils sont partit ensemble.', 'partit', 'partis'],
                             ["C'est finit pour aujourd'hui.", 'finit', 'fini'], ['Je me suis fais mal.', 'fais', 'fait'], ["C'est permit.", 'permit', 'permis'],
                             ['Il est prit au piège.', 'prit', 'pris']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _k13++; console.log('✗ après être : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [['Il est déjà nuit.', 'nuit'], ['Le choc est subit.', 'subit'], ['Elle est partie tôt.', 'partie'], ['Le livre est écrit.', 'écrit'],
                         ['Ils sont apparus hier.', 'apparus'], ['Ce qui est fait est fait.', 'fait']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _k13++; console.log('✗ après être : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_k13) { console.log('PARITÉ KO — ' + _k13 + ' cas « forme finie après être ».'); process.exit(1); } }

/* ⭐ 11/10/2026 — lot 12 : homophones de mots-outils (orange, « mot-outil à vérifier ») — quand à moi → quant, quant il → quand,
   qu'elle heure → quelle, quel viendra → qu'elle, « Peut être qu' » en tête → Peut-être, il est tant de + infinitif → temps ;
   silences : « quant à / au », « qu'elle viendra », « quelle a été », « quel est », « il peut être que », « tant de monde »,
   « Quelle peut être la cause », « plus jeune qu'elle de dix ans » (UD). Python : rule_homophone_mo. */
{ let _k12 = 0;
  for (const [ph, w, sg] of [['Quand à moi, je reste ici.', 'Quand', 'Quant'], ['Quant il pleut, je reste.', 'Quant', 'Quand'],
                             ["Je ne sais pas qu'elle heure il est.", "qu'elle", 'quelle'], ["Qu'elle chance tu as !", "Qu'elle", 'Quelle'],
                             ['Je pense quel viendra demain.', 'quel', "qu'elle"], ['Il faut quelle aille au marché.', 'quelle', "qu'elle"],
                             ["Peut être qu'il viendra.", 'Peut', 'Peut-être'], ['Il est tant de partir.', 'tant', 'temps']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _k12++; console.log('✗ homophone : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [['Quant à moi, je reste.', 'Quant'], ['Quant au reste, on verra.', 'Quant'], ["Je pense qu'elle viendra.", "qu'elle"],
                         ['Quelle a été sa réponse ?', 'Quelle'], ['Quel est ton nom ?', 'Quel'], ['Il peut être que tu as raison.', 'peut'],
                         ['Il y a tant de monde.', 'tant'], ['Quelle peut être la cause ?', 'Quelle'], ["Elle est plus jeune qu'elle de dix ans.", "qu'elle"]]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _k12++; console.log('✗ homophone : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_k12) { console.log('PARITÉ KO — ' + _k12 + ' cas « homophone de mot-outil ».'); process.exit(1); } }

/* ⭐ 11/10/2026 — lot 11 : le petit mot impossible après un pronom sujet, devant un verbe (orange, « petit mot après le sujet à
   vérifier ») — il si est → s'y, il ni a → n'y, il dans mange → en, il cent va → s'en, ils ce sont → se ; silences : « si » adverbe,
   inversion « dit-il si », « dans » + déterminant, « cent ans », « ce matin », ponctuation. Et le sujet COORDONNÉ par un pronom
   tonique (« Lui et elle viennent », « Ni lui ni elle ne viennent ») n'est plus « corrigé » au singulier en rouge ; « il dort et elle
   mangent » l'est toujours. Python : rule_apres_sujet, _coord_tonique. */
{ let _k11 = 0;
  for (const [ph, w, sg] of [['Il si est rendu hier.', 'si', "s'y"], ['Il ni a plus de pain.', 'ni', "n'y"], ['Il dans mange beaucoup.', 'dans', 'en'],
                             ['Il cent va demain.', 'cent', "s'en"], ['Elle cent souvient.', 'cent', "s'en"], ['Ils ce sont battus.', 'ce', 'se'],
                             ['Il dort et elle mangent.', 'mangent', 'mange']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _k11++; console.log('✗ après le sujet : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [['Il est si grand.', 'si'], ['Dit-il si fort ?', 'si'], ['Il dans un souffle répond.', 'dans'], ['Il a cent ans.', 'cent'],
                         ['Il ce matin est parti.', 'ce'], ['Il, si tu veux, viendra.', 'si'], ['Lui et elle viennent.', 'viennent'],
                         ['Ni lui ni elle ne viennent.', 'viennent'], ['Toi et elle venez.', 'venez']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _k11++; console.log('✗ après le sujet : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_k11) { console.log('PARITÉ KO — ' + _k11 + ' cas « après le sujet ».'); process.exit(1); } }

/* ⭐ 11/10/2026 — lot 10 : « sa » écrit pour « ça » devant un verbe (orange, branche de « ça/sa ») — « sa va », « sa fait », « sa
   dépend », « sa tous les jours » ; silences : nom après « sa » (chambre, maison, part, robe), adjectif (nouvelle, propre), mot à la
   fois nom et verbe (marche, passe). Python : _sa_ca_verbe (rule_ca_sa, tier_of). */
{ let _k10 = 0;
  for (const [ph, w] of [['Sa va bien ce matin.', 'Sa'], ['Il fait sa tous les jours.', 'sa'], ["Sa fait longtemps que je t'attends.", 'Sa'],
                         ['Sa dépend de toi.', 'Sa'], ['Sa sert à rien.', 'Sa'], ['Sa suffit maintenant.', 'Sa']]) {
    const got = corr(ph).filter(f => f.word === w), sg = w === 'Sa' ? 'Ça' : 'ça';
    if (!got.length || got[0].sugg !== sg) { _k10++; console.log('✗ sa/ça : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const ph of ['Il regarde si sa marche tient.', 'Elle range sa chambre.', 'Elle aime sa nouvelle maison.', 'Sa propre mère le dit.',
                    'Il vend sa part.', 'Elle porte sa robe.', 'Il garde sa passe pour demain.']) {
    const got = corr(ph).filter(f => /^sa$/i.test(f.word));
    if (got.length) { _k10++; console.log('✗ sa/ça : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_k10) { console.log('PARITÉ KO — ' + _k10 + ' cas « sa / ça ».'); process.exit(1); } }

/* ⭐ 11/10/2026 — lot 9 : expressions figées mal coupées (orange, « expression figée à vérifier ») — comme même → quand même, en faite
   / enfaite → en fait, tous le temps → tout le temps, par(s) que → parce que, entrain de + infinitif → en train de, sur tout pas →
   surtout, temps pis / mieux → tant pis / mieux ; « tout a fait », « au fur et a mesure » → à (a/à). Silences : « comme même un
   enfant », « vous en faites », « ils ont tous le temps », « je pars », « avec entrain », « sur tout le monde », « Tout a fait défaut ».
   Et la garde « nom homographe » de -e/-é (participe) lit le lexique complet comme Python : « a mesure » ne devient plus « mesuré »
   (rouge faux), « elle a mesure la table » le devient toujours. Python : rule_fige, _aa_locution, rule_e_ppl. */
{ let _k9 = 0;
  for (const [ph, w, sg] of [['Il est venu comme même.', 'comme', 'quand'], ['En faite je suis fatigué.', 'faite', 'fait'], ['Il fait beau, enfaite.', 'enfaite', 'en fait'],
                             ['Je joue tous le temps dehors.', 'tous', 'tout'], ['Il est en retard pars que le bus était plein.', 'pars', 'parce'],
                             ["Il est parti par qu'il pleuvait.", 'par', 'parce'], ['Il est entrain de manger.', 'entrain', 'en train'],
                             ['Ne touche sur tout pas au gâteau.', 'sur', 'surtout'], ['Temps pis pour lui.', 'Temps', 'Tant'], ['Il est parti, temps mieux.', 'temps', 'tant'],
                             ["Je suis tout a fait d'accord.", 'a', 'à'], ['Il comprend au fur et a mesure.', 'a', 'à'], ['Elle a mesure la table.', 'mesure', 'mesuré']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _k9++; console.log('✗ figée : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [["C'est facile, comme même un enfant le sait.", 'comme'], ['Vous en faites trop.', 'faites'], ['Ils ont tous le temps de finir.', 'tous'],
                         ['Je pars que demain.', 'pars'], ['Il travaille avec entrain de bon matin.', 'entrain'], ['Il a un avis sur tout le monde.', 'sur'],
                         ['Tout a fait défaut ce jour-là.', 'a'], ['Il y a mesure et mesure.', 'mesure'], ['Il comprend au fur et a mesure.', 'mesure'],
                         ['Il comprend a mesure.', 'mesure']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _k9++; console.log('✗ figée : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_k9) { console.log('PARITÉ KO — ' + _k9 + ' cas « expression figée ».'); process.exit(1); } }

/* ⭐ 11/10/2026 — lot 8 : faux jumeaux soudés (orange, « mot soudé à vérifier ») — par ce que → parce que, quel que + nom → quelque(s),
   quelque fois → quelquefois, aussi tôt + participe → aussitôt, à bien tôt → à bientôt ; silences : « par » appelé par le mot d'avant
   (passif, commencer), « quel que soit », « quelques fois », « aussi tôt que possible », « bien tôt ce matin ». Python : rule_soude. */
{ let _k8 = 0;
  for (const [ph, w, sg] of [['Je reste par ce que je suis malade.', 'par', 'parce'], ["Il est parti par ce qu'il pleuvait.", 'par', 'parce'],
                             ['Par ce que tu es là, je suis content.', 'Par', 'Parce'], ['Il prend quel que temps pour lui.', 'quel', 'quelque'],
                             ['Il part quel que part.', 'quel', 'quelque'], ['Il reste quel que jours.', 'quel', 'quelques'], ['Je viens quelque fois.', 'quelque', 'quelquefois'],
                             ['Aussi tôt arrivé, il dort.', 'Aussi', 'Aussitôt'], ['Je te dis à bien tôt.', 'bien', 'bientôt']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _k8++; console.log('✗ soudé : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [['Je suis touché par ce que tu dis.', 'par'], ['Il commence par ce que tu préfères.', 'par'], ['Il pleut quel que soit le temps.', 'quel'],
                         ['Je viens quelques fois.', 'quelques'], ['Il part aussi tôt que possible.', 'aussi'], ["Il s'est levé bien tôt ce matin.", 'bien']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _k8++; console.log('✗ soudé : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_k8) { console.log('PARITÉ KO — ' + _k8 + ' cas « mot soudé ».'); process.exit(1); } }

/* ⭐ 11/10/2026 — lot 5 : « été » écrit pour était / étais / étaient — sujet NOM et sujet INVERSÉ (orange) ; silences : « été » nom,
   auxiliaire présent, ellipse et incise (UD), complément après une préposition. Python : même règle (rule_aux_misspell, _ete_sujet). */
{ let _k5 = 0;
  for (const [ph, sg] of [['Le chat été content.', 'était'], ['Les enfants été partis.', 'étaient'], ["L'enfant été malade.", 'était'],
                          ['Où été tu hier ?', 'étais'], ['Quand été tu là ?', 'étais']]) {
    const got = corr(ph).filter(f => f.word === 'été');
    if (!got.length || got[0].sugg !== sg) { _k5++; console.log('✗ été : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const ph of ['Le dernier été fut chaud.', 'Cet été tu viens ?', 'Il a été content.', 'Le moteur a été retiré et le réacteur été monté.',
                    'Leur raid a, par la suite, été suivi.', 'Une pièce de la maison été vide.']) {
    const got = corr(ph).filter(f => f.word === 'été');
    if (got.length) { _k5++; console.log('✗ été : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_k5) { console.log('PARITÉ KO — ' + _k5 + ' cas « été ».'); process.exit(1); } }

/* ⭐ 11/10/2026 — lot 7 : faux jumeaux soudés / détachés (orange) — « d'avantage » après un VERBE → davantage ; plutôt / plus tôt dans
   leurs cadres sûrs. Silences : le NOM « avantage » (mot de quantité ou déterminant devant, « il n'y a d'avantage que »), « plus tôt
   que de coutume », « plutôt que » d'opinion. Python : mêmes règles (rule_davantage, rule_plutot). */
{ let _k7 = 0;
  for (const [ph, w, sg] of [["Il travaille d'avantage.", "d'avantage", 'davantage'], ["Il veut en savoir d'avantage là-dessus.", "d'avantage", 'davantage'],
                             ["Elle aide d'avantage les enfants.", "d'avantage", 'davantage'], ["Elle mange d'avantage le soir.", "d'avantage", 'davantage'],
                             ['Viens le plutôt possible.', 'plutôt', 'plus tôt'], ['Il est arrivé plutôt que prévu.', 'plutôt', 'plus tôt'],
                             ['Plus tôt que de partir, il reste.', 'Plus', 'Plutôt'], ["Il préfère rester plus tôt que d'attendre.", 'plus', 'plutôt']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (!got.length || got[0].sugg !== sg) { _k7++; console.log('✗ faux jumeaux : ' + JSON.stringify(ph) + ' doit donner « ' + sg + ' », eu ' + JSON.stringify(got.map(f => f.sugg))); } }
  for (const [ph, w] of [["Ce type d'avantage fiscal compte.", "d'avantage"], ["Elle voit peu d'avantage ici.", "d'avantage"], ["Il n'y a d'avantage que pour lui.", "d'avantage"],
                         ['Il est venu plus tôt que de coutume.', 'plus'], ['Je pense plutôt que tu as raison.', 'plutôt'], ['Il est parti plus tôt ce matin.', 'plus'],
                         ['Il est plutôt content.', 'plutôt']]) {
    const got = corr(ph).filter(f => f.word === w);
    if (got.length) { _k7++; console.log('✗ faux jumeaux : ' + JSON.stringify(ph) + ' doit rester muet, eu ' + JSON.stringify(got.map(f => f.sugg + '[' + f.name + ']'))); } }
  if (_k7) { console.log('PARITÉ KO — ' + _k7 + ' cas « faux jumeaux ».'); process.exit(1); } }

/* ⭐ VIGILANCE (11/09/2026) — même invariant que parity_core, mais la tranche extraite n'a pas diagnoseAll : on appelle les
   QUATRE jumelles orange (toutes définies AVANT correctText, donc dans la tranche) dans l'ordre et avec la règle « première qui
   parle » de spellText — et la PRÉCÉDENCE DU ROUGE : dans le produit une orange ne sort jamais sur un mot que correctText a
   déjà corrigé (le premier tour de l'instrument, sans elle, accusait 10 « oranges hors Python » qui n'existent pas au produit). « accord participe à vérifier » (participeEtreVig, définie APRÈS correctText) reste hors périmètre,
   comme dans parity_core. EXIGENCE : chaque jumelle tire au moins une fois des DEUX côtés. */
const VIG_ORD = [['semiInfVig', 'infinitif après semi-auxiliaire à vérifier'],
  ['persVig', 'personne du verbe à vérifier'], ['sujFlexNom', 'accord du verbe au sujet nominal à vérifier'], ['onOntVig', 'on/ont après un sujet pluriel à vérifier'],
  ['rDetNumber', 'nombre du déterminant à vérifier'], ['jestVig', "j'est/j'ai à vérifier"], ['ppAvoirSurnumVig', 'accord du participe après avoir à vérifier'], ['auxManquantVig', 'auxiliaire manquant à vérifier'], ['cestCesVig', "c'est/ces à vérifier"]];   // ⭐ 12/09/2026 : jumelle orange de j'est/j'ai
const VIG_PY = new Set(VIG_ORD.map(x => x[1]));
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
  'les enfants dorment.', 'il est parti hier.', 'nous mangeons la soupe.']);                          // contrôles : rien
const appVig = p => { const t = String(p).replace(/[’ʼ]/g, "'"); const rouge = new Set(corr(t).map(f => f.i)); globalThis.__segOn(t); const T = globalThis.__toks(t), out = [];
  for (let i = 0; i < T.length; i++) if (!rouge.has(i)) for (const [fn, nom] of VIG_ORD) { const s = globalThis.__vig[fn](T, i); if (s) { out.push([i, T[i], s, nom]); break; } }
  return out; };
const pyV = cp.spawnSync('python3', ['-c', `
import sys, json
sys.path.insert(0, ${JSON.stringify(HERE)})
import correcteur_probe as C
ph = json.loads(sys.stdin.read())
print(json.dumps([[(i, w, s, n) for (i, w, s, n, t) in C.correct_tiered(p)] for p in ph]))
`], { input: JSON.stringify(VIG_PHRASES), encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });
if (pyV.status !== 0) { console.error('probe Python (vigilance) échoué :', pyV.stderr); process.exit(2); }
const pyVig = JSON.parse(pyV.stdout);
let _vKo = 0, _vGap = 0; const _vHitJs = {}, _vHitPy = {};
VIG_PHRASES.forEach((p, k) => {
  const js = appVig(p);
  const pf = pyVig[k].filter(x => VIG_PY.has(x[3]));
  const pset = new Set(pf.map(key)), jset = new Set(js.map(key));
  js.forEach(x => { _vHitJs[x[3]] = (_vHitJs[x[3]] || 0) + 1; });
  pf.forEach(x => { _vHitPy[x[3]] = (_vHitPy[x[3]] || 0) + 1; });
  const extra = js.filter(x => !pset.has(key(x)));
  if (extra.length) { _vKo++; console.log('✗ VIGILANCE : APP marque une orange que PY ne marque pas :', JSON.stringify(p), JSON.stringify(extra)); }
  const miss = pf.filter(x => !jset.has(key(x)));
  if (miss.length) { _vGap++; console.log('  (couverture vigilance) PY > APP :', JSON.stringify(p), JSON.stringify(miss)); }
});
const _vMuet = Array.from(VIG_PY).filter(n => !_vHitJs[n] || !_vHitPy[n]);
if (_vMuet.length) { console.log('PARITÉ KO — règle(s) de vigilance jamais exercée(s) par le harnais : ' + JSON.stringify(_vMuet) + ' app=' + JSON.stringify(_vHitJs) + ' py=' + JSON.stringify(_vHitPy)); process.exit(1); }
if (_vKo) { console.log('PARITÉ KO — ' + _vKo + ' phrase(s) où l\'app marque une ORANGE hors Python.'); process.exit(1); }
console.log('  ✓ vigilance : ' + VIG_ORD.length + ' règles orange appariées, app ⊆ Python sur ' + VIG_PHRASES.length + ' phrases (écarts de couverture : ' + _vGap + ')');

console.log(appOnly === 0
  ? `PARITÉ OK — aucun flag propre à l'app sur ${PHRASES.length} phrases (app ⊆ Python). Écarts de couverture (lexique HF) : ${gap}.`
  : `PARITÉ KO — ${appOnly} phrase(s) où l'app flague hors Python (FP app).`);
process.exit(appOnly === 0 ? 0 : 1);
