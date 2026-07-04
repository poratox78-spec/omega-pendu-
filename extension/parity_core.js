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
  // terminaison -er/-é : gouverneur être, clitique réfléchi, causatif
  'Il a été fabriquer par un dieu', 'Le pays veut se séparé du groupe', 'On va faire évolué le code',
  'Il fait déclaré la guerre', 'Il ne faut pas utilisé de câble', 'Les origines de la cité remontent', 'Un fait divers tragique',
  // accord adjectif ÉPITHÈTE (article + nom + adj) : cibles + pièges
  'Les domaines industriel progressent', 'Une décision mondial', 'La commission présidentiel est là',
  'Le mois dernier fut chaud', 'Un cursus professionnel', 'La voiture rouge passe', 'Les sites allemand et français'
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
