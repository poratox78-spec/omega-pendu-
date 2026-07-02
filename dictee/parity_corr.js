// Parité APP↔Python du correcteur : extrait correctText() de l'IIFE dictée du monolithe, l'exécute headless
// (DOM bouchonné), et compare ses flags à ceux du probe Python (correcteur_probe.py) sur une batterie de phrases.
// Garantit que la règle d'accord sujet-verbe (et les 8 homophones) se comportent pareil dans l'app et le probe.
// Lancer : node dictee/parity_corr.js
const fs = require('fs'), path = require('path'), cp = require('child_process'), zlib = require('zlib');
const HERE = __dirname, HTML = path.join(HERE, '..', 'app', 'omega-pendu.html');
const html = fs.readFileSync(HTML, 'utf8');

// charge le gros lexique embarqué (OMEGA_LEX4) : posOf() en a besoin pour la garde genre
const _lx = (html.match(/<script type="text\/plain" id="lex4-data-gz">([^<]*)<\/script>/) || [])[1] || '';
if (_lx) { try { globalThis.OMEGA_LEX4 = JSON.parse(zlib.gunzipSync(Buffer.from(_lx.replace(/\s/g, ''), 'base64')).toString('utf8')); } catch (e) {} }

// POSTERIOR §3 du pluriel (bloc noun-post-gz) : seed le global OMEGA_NOUN_POST (l'app le lit comme NOUN_POST) → teste rNounPlural en parité
const _np = (html.match(/<script type="text\/plain" id="noun-post-gz">([^<]*)<\/script>/) || [])[1] || '';
if (_np) { try { globalThis.OMEGA_NOUN_POST = {}; zlib.gunzipSync(Buffer.from(_np.replace(/\s/g, ''), 'base64')).toString('utf8').split('\n').forEach(l => { const p = l.split('\t'); if (p.length >= 3) globalThis.OMEGA_NOUN_POST[p[0]] = [+p[1], +p[2]]; }); } catch (e) {} }

// POS-tagger HMM (bloc pos-hmm-gz) : seed le global OMEGA_POS_HMM (l'app le lit comme _HMM) → teste posTags en parité
const _hm = (html.match(/<script type="text\/plain" id="pos-hmm-gz">([^<]*)<\/script>/) || [])[1] || '';
if (_hm) { try { globalThis.OMEGA_POS_HMM = JSON.parse(zlib.gunzipSync(Buffer.from(_hm.replace(/\s/g, ''), 'base64')).toString('utf8')); } catch (e) {} }

// 1) extraire l'IIFE jusqu'à correctText, refermer en exposant correctText
const start = html.indexOf('(function(){', html.indexOf('mode PHRASES'));
const ctIdx = html.indexOf('function correctText', start);
const ctEnd = html.indexOf('return out;}', ctIdx) + 'return out;}'.length;
if (start < 0 || ctIdx < 0 || ctEnd < 0) { console.error('extraction IIFE échouée'); process.exit(2); }
// étendre l'extraction pour inclure posTags/_HMM/loadPosHmm (définis APRÈS correctText) — rCe/rSon les appellent (contexte tagger)
const ptIdx = html.indexOf('function posTags(T){', start);
const ptEnd = ptIdx >= 0 ? html.indexOf('}', html.indexOf('return seq.reverse();', ptIdx)) + 1 : ctEnd;
const code = html.slice(start, Math.max(ctEnd, ptEnd)) + ';globalThis.__corr=correctText;})();';

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
const corr = globalThis.__corr;
if (typeof corr !== 'function') { console.error('correctText non exposé'); process.exit(2); }

// 4) batterie : doit DÉTECTER / ne doit RIEN flaguer
const PHRASES = [
  'Les enfant joue dans le jardin et il sont content. Je doit manger. On ont gagné. à mon avis.',
  'Je doit partir', 'Tu doit venir', 'Il ont faim', 'Elles a faim', 'On ont gagné', 'Ils doit manger',
  'Je peux venir', 'Tu manges bien', 'Il nous voit', 'Nous mangeons', 'Ils peut-être là', 'Vous êtes prêts',
  'Il y a un chat', 'je suis content', 'tu es gentil', 'ils doivent partir', 'il faut', 'elle veut partir',
  'on peut essayer', 'je vais bien', 'Il a mangé la soupe', 'Il veut manger la soupe', 'Les enfants sont contents',
  'Elle a trouvé un trésor', 'Elle va à Paris', 'Il prend ce livre', 'Le chat se trouve là', 'Je leur parle souvent',
  // accord sujet-verbe à sujet NOM (déterminant pluriel) + gardes FP
  'les enfants joue dans le jardin et ils ont content', 'Les oiseaux chante le matin', 'Les voitures roule vite',
  'les chats mange', 'Les chevaux galopent à travers les champs', 'Mon frère et ma sœur sont arrivés',
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
  // terminaison -er/-é : gouverneur être (« a été fabriquer »), clitique réfléchi (« veut se séparé »), causatif (« fait déclaré »)
  'Il a été fabriquer par un dieu', 'Le pays veut se séparé du groupe', 'On va faire évolué le code',
  'Il fait déclaré la guerre', 'Il ne faut pas utilisé de câble', 'Les origines de la cité remontent', 'Un fait divers tragique'
];

// flags Python via un petit pont
const py = cp.spawnSync('python3', ['-c', `
import sys, json
sys.path.insert(0, ${JSON.stringify(HERE)})
import correcteur_probe as C
ph = json.loads(sys.stdin.read())
print(json.dumps([[(i, w, s, n) for (i, w, s, n) in C.correct(p)] for p in ph]))
`], { input: JSON.stringify(PHRASES), encoding: 'utf8' });
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
console.log(appOnly === 0
  ? `PARITÉ OK — aucun flag propre à l'app sur ${PHRASES.length} phrases (app ⊆ Python). Écarts de couverture (lexique HF) : ${gap}.`
  : `PARITÉ KO — ${appOnly} phrase(s) où l'app flague hors Python (FP app).`);
process.exit(appOnly === 0 ? 0 : 1);
