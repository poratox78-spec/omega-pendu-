// Moteur correcteur ANGLAIS (JS) — PORT FIDÈLE de speller_en_probe.py + homophone_en_probe.py.
// Discipline française : parité Python↔JS (cf. parity_core.js). Tourne en Node (lex via zlib) et,
// plus tard, en navigateur (le lexique sera fourni décompressé par la page). Aucune logique réécrite :
// mêmes clés phonétiques lossy, mêmes seuils AUTO/FLAG, mêmes règles homophones RED/ORANGE.
'use strict';
const ALPHA = 'abcdefghijklmnopqrstuvwxyz';
function deacc(s){ return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }

// ---------- clé phonétique lossy (port de phon_key) ----------
function phonKey(s){
  s = deacc(s.toLowerCase()).replace(/[^a-z]/g, '');
  if(!s) return '';
  s = s.replace(/^(kn|gn|pn)/, m => m[1]).replace(/^wr/, 'r').replace(/^wh/, 'w').replace(/^x/, 'z');
  s = s.replace(/ough/g, 'o').replace(/augh/g, 'a').replace(/ph/g, 'f').replace(/gh/g, '');
  s = s.replace(/sch/g, 'sk').replace(/tch/g, 'ch').replace(/ck/g, 'k').replace(/dge/g, 'j').replace(/dg/g, 'j');
  s = s.replace(/sh/g, 'S').replace(/ch/g, 'C').replace(/th/g, 'T');
  s = s.replace(/qu/g, 'kw').replace(/q/g, 'k').replace(/x/g, 'ks').replace(/wr/g, 'r').replace(/mb/g, 'm');
  s = s.replace(/eigh/g, 'a').replace(/igh/g, 'i');
  s = s.replace(/(ee|ea|ie|ei|ey)/g, 'i').replace(/(oo|ou|ew|ue|ui)/g, 'u')
       .replace(/(oa|ow|oe)/g, 'o').replace(/(ai|ay|ei)/g, 'a').replace(/(au|aw|augh)/g, 'o');
  let out = [];
  for(let j = 0; j < s.length; j++){
    const ch = s[j], nx = s[j+1] || '';
    if(ch === 'c') out.push('eiy'.includes(nx) ? 's' : 'k');
    else if(ch === 'g') out.push('eiy'.includes(nx) ? 'j' : 'g');
    else if(ch === 'z') out.push('s');
    else if(ch === 'y') out.push('i');
    else if(ch === 'h'){ /* h faible */ }
    else out.push(ch);
  }
  s = out.join('').replace(/e$/, '').replace(/[aeiou]/g, 'a');
  let o2 = [];
  for(const ch of s){ if(!o2.length || o2[o2.length-1] !== ch) o2.push(ch); }
  return o2.join('');
}

function edits1(d){
  const res = new Set();
  for(let i = 0; i <= d.length; i++){
    const a = d.slice(0, i), b = d.slice(i);
    if(b) res.add(a + b.slice(1));
    if(b.length > 1) res.add(a + b[1] + b[0] + b.slice(2));
    for(const c of ALPHA){ res.add(a + c + b); if(b) res.add(a + c + b.slice(1)); }
  }
  return res;
}

// ---------- speller (port de SpellerEN) ----------
// lex = { KNOWN:Set, FREQ:Map, POS:Map, PHON:Map(key->[words triés freq desc]) }
function buildPhonIndex(lex){
  const az = [];
  for(const w of lex.KNOWN){ if(/^[a-z]+$/.test(w)) az.push(w); }
  az.sort((a, b) => (lex.FREQ.get(b)||0) - (lex.FREQ.get(a)||0));
  const PHON = new Map();
  for(const w of az){ const k = phonKey(w); if(!PHON.has(k)) PHON.set(k, []); PHON.get(k).push(w); }
  lex.PHON = PHON;
}

function spellSuggest(lex, w){
  const low = deacc(w.toLowerCase());
  if(!low || low.length < 2 || /[^a-z]/.test(low)) return [null, 'OK'];  // lettre seule (a, I) / non a-z
  if(lex.KNOWN.has(low)) return [null, 'OK'];
  if(w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase()) return [null, 'OK']; // capitalisé = nom propre probable
  const cands = new Map(); // cand -> tier
  for(const e of edits1(low)){ if(lex.KNOWN.has(e) && /^[a-z]+$/.test(e)) cands.set(e, 1); }
  const pk = phonKey(low);
  const neigh = lex.PHON.get(pk) || [];
  for(let i = 0; i < Math.min(12, neigh.length); i++){ const x = neigh[i]; if(x !== low && !cands.has(x) && /^[a-z]+$/.test(x)) cands.set(x, 0); }  // ASCII-seul : ne JAMAIS suggérer un accent (EN sans accents ; emprunts café/résumé restent connus mais pas proposés)
  if(!cands.size) return [null, 'OK'];                                  // inconnu sans candidat → ne pas harceler
  let best = null, bestKey = [-1, -1];
  for(const [x, tier] of cands){ const key = [tier, lex.FREQ.get(x)||0];
    if(key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])){ best = x; bestKey = key; } }
  const bt = cands.get(best), bf = lex.FREQ.get(best) || 0;
  let second = 0;
  for(const [x] of cands){ if(x !== best) second = Math.max(second, lex.FREQ.get(x)||0); }
  const phonMatch = phonKey(best) === pk;
  const transp = best.length === low.length && best.split('').sort().join('') === low.split('').sort().join('');
  // ... et AUCUN rival à ÉGALITÉ (miroir speller_en_probe.py). La fréquence seule ne fait pas un rouge :
  // un autre candidat à la MÊME distance d'édition ET qui sonne pareil rend le choix incertain.
  let rival = false;
  // seuil 20 CALIBRÉ par balayage sur le banc Wikipédia (miroir speller_en_probe.py) : c'est le genou.
  for(const [x, tier] of cands){ if(x !== best && tier === 1 && (phonKey(x) === pk || (lex.FREQ.get(x)||0) >= 20)){ rival = true; break; } }
  if(bt === 1 && low.length >= 3 && bf >= 200 && bf >= 20 * Math.max(second, 1) && (phonMatch || transp) && !rival)
    return [best, 'AUTO'];
  return [best, 'FLAG'];
}

// ---------- homophones (port de decide) ----------
const MODALS = new Set(['could','would','should','must','might','may']);
const COMPAR = new Set(['more','less','better','worse','rather','other','greater','fewer','sooner','bigger',
  'smaller','faster','slower','higher','lower','older','younger','longer','stronger']);
const BE_AFTER = new Set(['is','are','was','were',"isn't","aren't"]);
const THAN_OBJ = new Set(['a','an','the','i','me','you','he','him','she','her','it','we','us','they','them',
  'mine','yours','his','hers','ours','theirs','that','this','these','those','any','ever','usual','before','expected']);
const ITS_RED = new Set(['a','an','the','been']);
const ITS_ORANGE = new Set(['not','going','gonna']);
const YOURE_RED = new Set(['gonna']);
const YOURE_ORANGE = new Set(['welcome','going','doing','being','getting','coming','not','re']);
const TO_MUCH_PREV_STOP = new Set(['','listen','up','close','talk','talking','speak','speaking','refer',
  'referred','according','due','access','attention','related']);
const DEGREE_ADJ = new Set(['late','early','hard','easy','big','small','large','far','fast','slow','high','low',
  'hot','cold','long','short','old','young','soon','tired','busy','expensive','cheap','heavy','light','loud',
  'quiet','tight','weak','strong','difficult','dangerous','scared','afraid','close','deep','wide','narrow',
  'thick','thin','rich','poor','full','empty','bright','dark','sick','tall','nervous','proud','lazy',
  'complicated','painful','risky']);
const TO_INF_GUARD = new Set(['want','wants','wanted','need','needs','needed','like','likes','liked','love',
  'loves','loved','try','tries','tried','going','have','has','had','used','able','wish','hope','hopes','plan',
  'plans','decide','decided','learn','begin','seem','seems','start','started','continue','refuse','offer',
  'manage','tend','get','gets','got','allow','allowed','how','way','ways','time','right','nice','hard','easy']);
const SUBJ_SING3 = new Set(['he','she','it']);
const SUBJ_NON3 = new Set(['i','you','we','they']);
const WAS_WRONG = new Set(['you','we','they']);
const LOOSE_TRIG = new Set(['to','will','would','can','could','might','must','should','may',"don't","doesn't",
  'gonna','cannot',"'ll",'ll',"won't",'wont']);
const LOOSE_IDIOM = new Set(['let','cut','break','set','turn','come','work','hang','shake','get','got','be',
  'been','being','is','are','was','were','on','so','too','very','more']);
const SUBJ_PRON = new Set(['i','we','they','you','he','she','it']);   // pronoms SUJETS uniquement (un NOM avant « where » est correct : « the place where… »)
const VERB_SLOT = new Set(['to','will',"'ll",'would','can','could','may','might','must','shall','should',
  'please','let','helps','help','wanna','gonna']);                       // position qui appelle un VERBE
const NOUN_SLOT = new Set(['the','a','an','this','that','my','your','his','her','our','their','some','any',
  'no','good','bad','best','free','professional','legal','medical','financial','deep','sound']);   // appelle un NOM
const DET_AFTER = new Set(['the','a','an','my','your','his','her','our','their','its']);   // PAS this/that : « effect that change » est l'idiome valide
const AUX_BEFORE = new Set(['does','do','did',"doesn't","didn't","don't",'will','would','can','could','may',
  'might','must','shall','should','to','and','or','not',"won't","can't",'why','how','when','what','that']);
const SUBJUNCTIVE = new Set(['if','as','wish','wishes','wished','whether','though','although','unless','lest','than','suppose','supposing']);
const SUBJ_3SG = new Set(['he','she','it']);                             // pronoms 3e pers. sing. SEULS (un NOM serait ambigu : pluriel invariable, collectif)
const DET_BEFORE = new Set(['the','these','those','his','her','their','our','my','your','its','both','all','other','first','last','only','same','remaining']);
const PERF_AUX = new Set(['have','has','had',"'ve","'s"]);
const PP_AUX = new Set(['have','has','had','having',"'ve","'d",'been','be','is','am','are','was','were',
  'get','gets','got','getting']);   // -> participe passé (have runned -> run) ; sinon passé (I runned -> ran)

function posOf(lex, w){ return lex.POS.get(w.toLowerCase()) || new Set(); }
function isNoun(lex, w){ return posOf(lex, w).has('NOUN'); }
function onlyNoun(lex, w){ const p = posOf(lex, w); return p.size === 1 && p.has('NOUN'); }

// ---- POS CONTEXTUEL : débloque « there + NOM -> their » (MIROIR de homophone_en_probe.py) ----
// `onlyNoun` s'appuie sur le lexique Wiktionary qui SUR-VERBIFIE (house/engine/phone/sister sont tagués
// VERB) → la direction possessive ne passait presque jamais. Le tagger tranche EN CONTEXTE.
// Le tagger tague « there » PRON dans les DEUX cas (l'existentiel EST un PRON en UD) : le discriminant
// est ce qui SUIT — « there is/are » (AUX) = correct, « there house » (NOUN) = possessif mal écrit.
const EXIST_BEFORE = new Set(['is','are','was','were','be','been','being',"isn't","aren't","wasn't","weren't",'there']);
const PLACE_BEFORE = new Set(['over','out','up','down','back','in','from','around','near','right']);
const TIME_NOUNS = new Set(['time','times','yesterday','today','tomorrow','tonight','day','days','week',
  'weeks','month','months','year','years','morning','afternoon','evening','night','hour','hours',
  'minute','minutes','moment','while','once','again']);
let _tagCache = null, _tagCacheKey = null;                 // Viterbi une fois par phrase, pas par token
function ctxPos(T, i){
  if(!_POS) return null;
  const key = T.join('');
  if(_tagCacheKey !== key){ _tagCache = tagSentence(T); _tagCacheKey = key; }
  return (i >= 0 && i < _tagCache.length) ? _tagCache[i] : null;
}
function nextIsNounCtx(T, i){
  const pv = i > 0 ? T[i-1].toLowerCase() : '';
  if(EXIST_BEFORE.has(pv) || PLACE_BEFORE.has(pv)) return false;
  // FP mesurés sur EWT : « there » LOCATIF suivi d'un nom — nom de TEMPS (« went there yesterday »)
  // et « there » POST-NOMINAL (« the people there attempt… »). Aucun vrai positif perdu.
  if(i + 1 < T.length && TIME_NOUNS.has(T[i+1].toLowerCase())) return false;
  if(ctxPos(T, i - 1) === 'NOUN') return false;
  return ctxPos(T, i + 1) === 'NOUN';
}
function isVerb(lex, w){ return posOf(lex, w).has('VERB'); }
function isAdj(lex, w){ return posOf(lex, w).has('ADJ'); }

const VOWEL_IPA = new Set([...'aeiouɑɒɔɛɪʊʌəæɜɚɝɐɘœø']);
function vowelStart(lex, w){                                // 1er son du mot via IPA ; null si inconnue
  let ip = lex.IPA.get(w.toLowerCase());
  if(!ip) return null;
  ip = ip.replace(/^[\/\[\]ˈˌˑ.\s]+/, '');
  return ip ? VOWEL_IPA.has(ip[0]) : null;
}

function homoDecide(lex, T, i){
  const w = T[i], lw = w.toLowerCase();
  const nx = i+1 < T.length ? T[i+1].toLowerCase() : '';
  const nx2 = i+2 < T.length ? T[i+2].toLowerCase() : '';
  const nxRaw = i+1 < T.length ? T[i+1] : '';
  const pv = i > 0 ? T[i-1].toLowerCase() : '';
  if(lw === 'of' && MODALS.has(pv)) return ['have', 'RED'];
  // « a » + son voyelle du mot suivant (IPA) -> « an ». FP=0 : mot suivant en minuscules (exclut US/UN/August) ;
  // « A » capital = article seulement en début de phrase (sinon étiquette : Party A). an->a abandonné.
  if(lw === 'a' && (w === 'a' || i === 0)
      && /^\p{L}+$/u.test(nxRaw) && nxRaw === nxRaw.toLowerCase() && nxRaw !== nxRaw.toUpperCase()
      && vowelStart(lex, nx) === true)
    return ['an', 'RED'];
  if(lw === 'then' && (COMPAR.has(pv) || (pv.endsWith('er') && isAdj(lex, pv)))){
    if(THAN_OBJ.has(nx) || (nx && (isNoun(lex, nx) || isAdj(lex, nx)) && !isVerb(lex, nx))) return ['than', 'RED'];
    return ['than', 'ORANGE'];
  }
  // --- familles ajoutées : le discriminateur est STRUCTUREL (mot voisin), donc mesurable à FP=0 sur EWT ---
  // WHERE/WERE : un pronom sujet ne peut pas être suivi de « where » (« they where happy »). On EXIGE le
  // pronom, pas un nom : « the place where he lives » serait un FP (nom + where est parfaitement correct).
  if(lw === 'where' && SUBJ_PRON.has(pv)) return ['were', 'RED'];
  // WERE/WE'RE : « were » en tête suivi d'un participe présent (« Were going home ») = « We're ».
  // Question inversée (« Were you there? ») exclue : le mot suivant y est un pronom/nom.
  if(lw === 'were' && i === 0 && /ing$/.test(nx) && !SUBJ_PRON.has(nx) && !onlyNoun(lex, nx)) return ["We're", 'ORANGE'];
  // WHO'S/WHOSE : même patron que their/there — c'est la NATURE du mot suivant qui tranche.
  if(lw === "who's" && nx && onlyNoun(lex, nx)) return ['whose', 'ORANGE'];
  // -ing ne suffit PAS : « king », « thing », « something » finissent en -ing sans être des gérondifs
  // (FP mesuré : « the nation whose king Enrique VIII »). On exige que la forme soit un VERBE.
  // -ing ne suffit pas (« king », « thing »), et le LEXIQUE ne tranche pas non plus : kaikki liste « king »
  // comme verbe (sens échiquéen). C'est le TAGGER qui sépare, parce qu'il étiquette EN CONTEXTE —
  // « whose king Enrique » = NOUN (pas de correction), « whose going home » = VERB (-> who's).
  if(lw === 'whose' && (nx === 'been' || nx === 'gonna' || (/ing$/.test(nx) && ctxPos(T, i+1) === 'VERB'))) return ["who's", 'RED'];
  // LEAD/LED : après un auxiliaire du parfait, il faut le PARTICIPE. « has lead to » est toujours faux ;
  // on borne à « to » car « have lead » peut être le NOM (« lead poisoning »).
  if(lw === 'lead' && PERF_AUX.has(pv) && nx === 'to') return ['led', 'RED'];
  // PASSED/PAST : « I past », « we past » n'ont aucune lecture correcte (past = nom/prép/adj, jamais verbe
  // conjugué). Le pronom sujet est la garde : « in the past » a un déterminant, pas un pronom.
  if(lw === 'past' && SUBJ_PRON.has(pv)) return ['passed', 'RED'];
  // TWO/TO : un nombre ne peut pas être suivi d'un verbe seul (« I want two go »).
  // ... sauf après un déterminant, où « two » est un PRONOM et non un nombre (FP mesuré :
  // « The two screamed to frighten » — « the two » = les deux personnes).
  // Le lexique seul ne marche pas ici non plus (« go » y est aussi un nom) : c'est le TAGGER qui dit
  // que « go » est un VERBE dans « I want two go home ». Même remède que « whose king ».
  if(lw === 'two' && !DET_BEFORE.has(pv) && nx && ctxPos(T, i+1) === 'VERB') return ['to', 'RED'];   // le test lexical !isNoun bloquait tout : « go » EST aussi un nom au lexique
  // --- PARONYMES nom/verbe : la paire ne s'entend pas, mais la POSITION tranche. Un déterminant appelle
  // un NOM, un modal/« to » appelle un VERBE. Même patron pour les 4 paires, donc une seule garde à tenir.
  if(VERB_SLOT.has(pv)){                                   // to/will/can/should… -> il faut le VERBE
    if(lw === 'advice') return ['advise', 'RED'];
    if(lw === 'breath') return ['breathe', 'RED'];
    if(lw === 'chose') return ['choose', 'RED'];
    // « to effect change » EXISTE (= réaliser) : on n'affirme que si un DÉTERMINANT suit (« will effect the
    // outcome »), là où l'idiome valide n'en a pas.
    // « to effect the change » (= réaliser) est valide : la paire est VRAIMENT ambiguë ici, donc ORANGE.
    // On signale sans trancher — priver d'une alerte vaut moins qu'un « à vérifier ».
    if(lw === 'effect' && DET_AFTER.has(nx)) return ['affect', 'ORANGE'];
  }
  if(NOUN_SLOT.has(pv)){                                   // the/a/this/my… -> il faut le NOM
    if(lw === 'advise') return ['advice', 'RED'];
    if(lw === 'breathe') return ['breath', 'RED'];
    // « affect » EST un nom en psychologie (« a flat affect ») -> ORANGE, pas rouge : on signale sans trancher.
    if(lw === 'affect') return ['effect', 'ORANGE'];
  }
  // ACCEPT/EXCEPT : « except » est une préposition, elle ne peut pas être le verbe d'un pronom sujet.
  if(lw === 'except' && SUBJ_PRON.has(pv)) return ['accept', 'RED'];
  // ACCORD SUJET-VERBE : le sujet 3e personne du singulier impose -s à l'auxiliaire.
  // ... mais SEULEMENT si le pronom est vraiment le SUJET. Deux pièges mesurés sur EWT :
  //  · « Does she have… », « Could he have had… » -> après un auxiliaire, l'infinitif NU est correct ;
  //  · « if he were to read », « as it were » -> le SUBJONCTIF est correct, et c'est de l'anglais soigné.
  const pv2 = i > 1 ? T[i-2].toLowerCase() : '';
  if(SUBJ_3SG.has(pv) && !AUX_BEFORE.has(pv2)){
    if(lw === 'have') return ['has', 'RED'];
    if(lw === "don't") return ["doesn't", 'ORANGE'];       // ORANGE : « he don't » est attesté à l'oral/en dialecte
    if(lw === 'were' && !SUBJUNCTIVE.has(pv2)) return ['was', 'ORANGE'];
  }
  if(lw === 'their' && BE_AFTER.has(nx)) return ['there', 'RED'];
  if(lw === 'there' && nx && (onlyNoun(lex, nx) || nextIsNounCtx(T, i))) return ['their', 'ORANGE'];
  if(lw === "they're" && nx && onlyNoun(lex, nx)) return ['their', 'ORANGE'];
  if(lw === 'your'){
    if(YOURE_RED.has(nx)) return ["you're", 'RED'];
    if(YOURE_ORANGE.has(nx) || (nx && isVerb(lex, nx) && !isNoun(lex, nx))) return ["you're", 'ORANGE'];
  }
  if(lw === "you're" && nx && onlyNoun(lex, nx)) return ['your', 'ORANGE'];
  if(lw === 'its'){
    if(ITS_RED.has(nx)) return ["it's", 'RED'];
    if(ITS_ORANGE.has(nx)) return ["it's", 'ORANGE'];
  }
  if(lw === "it's" && nx && onlyNoun(lex, nx) && !BE_AFTER.has(nx)) return ['its', 'ORANGE'];
  if(lw === 'to' && (nx === 'much' || nx === 'many') && !TO_MUCH_PREV_STOP.has(pv)) return ['too', 'ORANGE'];
  // « to <adj gradable> to/for » = construction « too … to/for » (RED, FP≈0) : too tired to walk, too big for me.
  if(lw === 'to' && DEGREE_ADJ.has(nx) && (nx2 === 'to' || nx2 === 'for') && !TO_INF_GUARD.has(pv)) return ['too', 'RED'];
  // « weather or not » -> « whether or not » (RED : jamais correct).
  if(lw === 'weather' && nx === 'or' && nx2 === 'not') return ['whether', 'RED'];
  // accord sujet-verbe (RED, FP=0 en anglais standard) + loose->lose (ORANGE)
  if(lw === "don't" && SUBJ_SING3.has(pv)) return ["doesn't", 'RED'];      // he/she/it don't -> doesn't
  if(lw === "doesn't" && SUBJ_NON3.has(pv)) return ["don't", 'RED'];       // I/you/we/they doesn't -> don't
  if(lw === 'was' && WAS_WRONG.has(pv)) return ['were', 'RED'];            // you/we/they was -> were
  if(lw === 'loose' && LOOSE_TRIG.has(pv) && (i < 2 || !LOOSE_IDIOM.has(T[i-2].toLowerCase()))) return ['lose', 'ORANGE'];
  // verbe irrégulier RÉGULARISÉ (runned->ran, goed->went, teached->taught) — RED FP=0 (forme nonstandard)
  const _vm = lex.VERBMORPH && lex.VERBMORPH[lw];
  if(_vm) return [PP_AUX.has(pv) ? _vm[1] : _vm[0], 'RED'];
  return [null, null];
}

function tokenize(text){ return text.match(/[A-Za-z]+(?:'[A-Za-z]+)*/g) || []; }

// ---------- chargement du lexique ----------
// parseLexText : construit le lexique depuis le TSV décompressé (partagé Node/navigateur).
function parseLexText(raw){
  const lex = { KNOWN: new Set(), FREQ: new Map(), POS: new Map(), IPA: new Map(), PHON: null, VERBMORPH: {} };
  const lines = raw.split('\n');
  for(let i = 1; i < lines.length; i++){
    const c = lines[i].split('\t');
    if(c.length < 7 || !c[0]) continue;
    lex.KNOWN.add(c[0]);
    lex.FREQ.set(c[0], parseInt(c[6], 10) || 0);
    if(c[1]) lex.POS.set(c[0], new Set(c[1].split('|')));
    if(c[2]) lex.IPA.set(c[0], c[2]);
  }
  buildPhonIndex(lex);
  return lex;
}
function loadLexNode(path){
  const fs = require('fs'), zlib = require('zlib');
  const lex = parseLexText(zlib.gunzipSync(fs.readFileSync(path)).toString('utf8'));
  try { lex.VERBMORPH = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'verbmorph_en.json'), 'utf8')); } catch (e) {}
  return lex;
}
// navigateur : décompresse un base64+gzip via DecompressionStream (comme l'app FR).
async function loadLexB64(b64){
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const ds = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
  const raw = await new Response(ds).text();
  return parseLexText(raw);
}

// ---------- POS-tagger ANGLAIS (HMM UPOS bigramme, Viterbi) ----------
// MIROIR EXACT de dictee/pos_en.py (référence) : mêmes scores, mêmes décisions → parité vérifiable
// (parity_pos_en.js). Modèle produit par `build_pos_hmm.py --en` depuis UD English-EWT (CC BY-SA 4.0).
// Dégradation douce : sans modèle chargé, tagSentence rend [] et les règles qui en dépendent s'abstiennent.
let _POS = null;
function setPosModel(m){ _POS = m || null; return !!_POS; }
function tagSentence(words, M){
  M = M || _POS;
  if(!M || !words || !words.length) return [];
  const tags = M.tags, tr = M.trans, em = M.emit, suf = M.suf, pri = M.prior, FL = M.floor;
  const lt = (a, b) => { const r = tr[a]; const v = r && r[b]; return (v === undefined) ? FL : v; };
  function le(t, w){
    const lw = w.toLowerCase();
    if((t === 'PUNCT' || t === 'SYM') && /[a-z]/i.test(lw)) return -100.0;   // lettres => jamais ponctuation
    if(Object.prototype.hasOwnProperty.call(em, lw)){ const v = em[lw][t]; return (v === undefined) ? FL : v; }
    for(const k of [4, 3, 2]){                                              // backoff par suffixe (mots rares)
      if(lw.length >= k){ const sf = lw.slice(-k);
        if(Object.prototype.hasOwnProperty.call(suf, sf)){ const d = suf[sf]; const v = d[t];
          return ((v === undefined) ? FL : v) + ((/^[A-Z]/.test(w) && t === 'PROPN') ? Math.log(1.1) : 0); } }
    }
    const p = pri[t];
    return ((p === undefined) ? FL : p) + ((/^[A-Z]/.test(w) && t === 'PROPN') ? Math.log(3.0) : 0);
  }
  const n = words.length, V = [{}], bk = [{}];
  for(const t of tags){ V[0][t] = lt('<s>', t) + le(t, words[0]); bk[0][t] = '<s>'; }
  for(let i = 1; i < n; i++){
    V.push({}); bk.push({});
    for(const t of tags){
      const et = le(t, words[i]); let best = -1e18, bp = null;
      for(const pt of tags){ const sc = V[i-1][pt] + lt(pt, t); if(sc > best){ best = sc; bp = pt; } }
      V[i][t] = best + et; bk[i][t] = bp;
    }
  }
  let best = -1e18, bt = null;
  for(const t of tags){ const sc = V[n-1][t] + lt(t, '</s>'); if(sc > best){ best = sc; bt = t; } }
  const seq = [bt];
  for(let i = n-1; i > 0; i--) seq.push(bk[i][seq[seq.length-1]]);
  return seq.reverse();
}
// navigateur : charge le modèle gzippé (même schéma que lex_en.tsv.gz)
async function loadPosModel(url){
  const r = await fetch(url || '../dictee/pos_hmm_en.json.gz');
  if(!r.ok) throw new Error('http ' + r.status);
  const ds = r.body.pipeThrough(new DecompressionStream('gzip'));
  return setPosModel(JSON.parse(await new Response(ds).text()));
}

const _API = { deacc, phonKey, edits1, buildPhonIndex, spellSuggest, homoDecide, tokenize,
               parseLexText, loadLexNode, loadLexB64, tagSentence, setPosModel, loadPosModel };
if(typeof module !== 'undefined' && module.exports) module.exports = _API;
if(typeof window !== 'undefined') window.CorrectorEN = _API;

// ---------- auto-test (parité avec les probes Python) ----------
if(typeof require !== 'undefined' && require.main === module){
  const path = require('path');
  const lex = loadLexNode(path.join(__dirname, 'lex_en.tsv.gz'));
  // le POS-tagger fait PARTIE du moteur : plusieurs règles (whose+gérondif, two+verbe) ne peuvent trancher
  // sans lui — sans ce chargement l'auto-test les verrait à tort comme muettes.
  try { const mp = path.join(__dirname, 'pos_hmm_en.json');
        if(require('fs').existsSync(mp)) setPosModel(JSON.parse(require('fs').readFileSync(mp, 'utf8'))); } catch (e) {}
  console.log('=== corrector_en.js — %d mots, %d clés phon ===', lex.KNOWN.size, lex.PHON.size);
  // speller CASES (mêmes que speller_en_probe.py)
  const SP = [['recieve','receive'],['seperate','separate'],['definately','definitely'],['occured','occurred'],
    ['teh','the'],['becuase','because'],['wich','which'],['freind','friend'],['calender','calendar'],
    ['wold','would'],['goverment','government'],['succesful','successful'],['peopl','people']];
  let auto=0, flag=0;
  for(const [bad, good] of SP){ const [s, m] = spellSuggest(lex, bad);
    if(s === good && m === 'AUTO') auto++; else if(s === good && m === 'FLAG') flag++;
    else console.log('  SP MISS %s -> %s/%s (attendu %s)', bad, s, m, good); }
  console.log('speller: AUTO %d + FLAG %d sur %d', auto, flag, SP.length);
  // homophone CASES
  const HP = [['I could of done it',2,'have','RED'],['It is bigger then mine',3,'than','RED'],
    ['Their is a problem',0,'there','RED'],['its a good idea',0,"it's",'RED'],
    ['your gonna love it',0,"you're",'RED'],['there car is red',0,'their','ORANGE'],
    ['its not fair',0,"it's",'ORANGE'],['your welcome to stay',0,"you're",'ORANGE'],
    ['I saw a apple',2,'an','RED'],['It is a honest mistake',2,'an','RED'],
    // familles ajoutées 08/2026 — FP=0 vérifié par SCAN EWT (12 544 phrases : 4 déclenchements, 4 vraies fautes)
    ['they where happy',1,'were','RED'],['we where on time',1,'were','RED'],
    ['Were going home now',0,"We're",'ORANGE'],
    ["a friend who's aunt left",2,'whose','ORANGE'],['I know whose going home',2,"who's",'RED'],
    ['it has lead to problems',2,'led','RED'],
    ['I past the test',1,'passed','RED'],['we past by the shop',1,'passed','RED'],
    ['I want two go home',2,'to','RED'],
    // ... et les phrases CORRECTES qui doivent rester INTACTES (les 2 FP mesurés puis corrigés en font partie)
    ['the place where he lives',2,null,null],['Were you there',0,null,null],
    ['the nation whose king ruled',2,null,null],['in the past few years',2,null,null],
    ['The two screamed loudly',1,null,null],['I have lead in my pencil',2,null,null],
    ['whose book is this',0,null,null],['two people came',0,null,null],
    // paronymes nom/verbe + accord sujet-verbe (08/2026) — FP=0 revérifié par SCAN EWT.
    // Les phrases CORRECTES ci-dessous sont exactement les FP que le scan a fait apparaître puis corriger :
    // subjonctif (« if he were »), infinitif nu après auxiliaire (« Does she have »), idiome « to effect ».
    ['I will advice you',2,'advise','RED'],
    ['My advise to all is good',1,'advice','RED'],
    ['you need to breath deeply',3,'breathe','RED'],
    ['take a deep breathe',3,'breath','RED'],
    ['I had to chose one',3,'choose','RED'],
    ['it will effect the outcome',2,'affect','ORANGE'],
    ['the affect of this is big',1,'effect','ORANGE'],
    ['I except your offer',1,'accept','RED'],
    ['he have a car',1,'has','RED'],
    ["he don't know",1,"doesn't",'ORANGE'],
    ['if he were to read',2,null,null],
    ['as it were odd',2,null,null],
    ['Does she have any interest',2,null,null],
    ['Could he have had a blow',2,null,null],
    ['to effect that change',1,null,null],
    ['everyone except me came',1,null,null],
    ['I have a car',1,null,null],
    ['the advice was good',1,null,null],
    ['take a deep breath',3,null,null],
    ['I chose the red one',1,null,null],
    ['the effect was clear',1,null,null],
    ['they have cars',1,null,null]];
  let hok=0;
  for(const [txt, idx, exp, lvl] of HP){ const T = tokenize(txt); const r = homoDecide(lex, T, idx);
    const s = (r && r[0]) || null, l = (r && r[0]) ? r[1] : null;     // homoDecide peut rendre [null,null]
    if(s === exp && l === lvl) hok++; else console.log('  HP MISS %s -> %s/%s (attendu %s/%s)', txt, s, l, exp, lvl); }
  console.log('homophone: %d/%d', hok, HP.length);
  if(process.argv.includes('--check')){                    // garde CI : parité CASES (auto+flag ≥ 10 typos clairs, homophones tous)
    const ok = (auto + flag >= 10) && (hok === HP.length);
    console.log('[check] %s — speller %d, homophone %d/%d', ok ? 'OK' : 'ÉCHEC', auto + flag, hok, HP.length);
    if(!ok) process.exit(1);
  }
}
