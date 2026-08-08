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

// CONTEXTE ANGLAIS = le MOT-OUTIL précédent (miroir speller_en_probe.py). ⚠️ Ne PAS transposer la
// méthode FR : là-bas l'ancre est le DÉTERMINANT audible (les/des portent le pluriel, la marque du nom
// est muette) ; en anglais « the » ne dit rien du nombre et le -s vit SUR LE NOM. Ici l'ancre est le
// mot-outil : « to/will » ouvre un slot VERBE, « the/a/of » un slot NOM. Mesuré : le contexte à la
// française (transitions POS du tagger) DÉGRADE — le Viterbi les a déjà consommées. Le slot GAGNE.
const VERB_SLOT_W = new Set(['to','will','would','can','could','may','might','must','should','shall','let',
  'please',"n't",'not','also','never','often','always','really','just','then','who','they','we','i',
  'you','he','she','it']);
const NOUN_SLOT_W = new Set(['the','a','an','this','that','my','your','his','her','our','their','its','some',
  'any','no','of','in','on','at','for','with','from','about','into','more','most','one','two','three',
  'every','each','both','all','such','other','another']);
function slotBonus(lex, prev, x){
  if(!prev) return 0;
  const P = lex.POS.get(x); if(!P) return 0;
  if(VERB_SLOT_W.has(prev) && P.has('VERB')) return 1;
  if(NOUN_SLOT_W.has(prev) && (P.has('NOUN') || P.has('ADJ'))) return 1;
  return 0;
}
function spellSuggest(lex, w, prev){          // prev = mot précédent en minuscules ; absent -> pas de bonus
  const low = deacc(w.toLowerCase());
  if(!low || low.length < 2 || /[^a-z]/.test(low)) return [null, 'OK'];  // lettre seule (a, I) / non a-z
  if(lex.KNOWN.has(low)) return [null, 'OK'];
  if(w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase()) return [null, 'OK']; // capitalisé = nom propre probable
  const cands = new Map(); // cand -> tier
  for(const e of edits1(low)){ if(lex.KNOWN.has(e) && /^[a-z]+$/.test(e)) cands.set(e, 1); }
  const pk = phonKey(low);
  const neigh = lex.PHON.get(pk) || [];
  for(let i = 0; i < Math.min(12, neigh.length); i++){ const x = neigh[i]; if(x !== low && !cands.has(x) && /^[a-z]+$/.test(x)) cands.set(x, 0); }  // ASCII-seul : ne JAMAIS suggérer un accent (EN sans accents ; emprunts café/résumé restent connus mais pas proposés)
  // plancher d'attestation (miroir speller_en_probe.py) : kaikki contient des non-mots (« acros » freq 0).
  // On ne les retire pas de KNOWN — on refuse seulement de les PROPOSER. Gain mesuré petit mais gratuit ;
  // au-dessus de 1 ça dégrade (balayage 0/1/5/20/50).
  { const keep = new Map(); for(const [x, t] of cands){ if((lex.FREQ.get(x)||0) >= 1) keep.set(x, t); }
    if(keep.size) { cands.clear(); for(const [x, t] of keep) cands.set(x, t); } }
  if(!cands.size) return [null, 'OK'];                                  // inconnu sans candidat → ne pas harceler
  // SCORE COMBINÉ (miroir speller_en_probe.py) : W*tier + log(1+freq), W=6 calibré par balayage sur le
  // banc contextuel. Le classement lexicographique faisait gagner « ahem » (edit-1, rarissime) contre
  // « have » (phonétique, très fréquent) — 82 % des mauvaises cibles venaient de là.
  let best = null, bestScore = -1e18;
  // + bonus ANAGRAMME (mêmes lettres, ordre faux) = 2, calibré par balayage : l'inversion est le typo
  // le plus probable, et sans ce bonus « inot »->« not » l'emporte sur « into ». Miroir Python.
  const _sorted = low.split('').sort().join('');
  for(const [x, tier] of cands){
    const ana = (x.length === low.length && x.split('').sort().join('') === _sorted);
    const sc = 6 * tier + Math.log(1 + (lex.FREQ.get(x)||0)) + (ana ? 2 : 0) + 2 * slotBonus(lex, prev, x);
    if(sc > bestScore){ best = x; bestScore = sc; } }
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

/* `adj` = masque d'adjacence RÉELLE dans le texte (cf. adjMask). OPTIONNEL : absent, on suppose
   l'adjacence — c'est le comportement historique, donc tous les appels à 3 arguments restent
   intacts. Seules les règles qui EXIGENT que deux mots se touchent le consultent. */
function homoDecide(lex, T, i, adj){
  const w = T[i], lw = w.toLowerCase();
  const nx = i+1 < T.length ? T[i+1].toLowerCase() : '';
  const nx2 = i+2 < T.length ? T[i+2].toLowerCase() : '';
  const nxRaw = i+1 < T.length ? T[i+1] : '';
  const pv = i > 0 ? T[i-1].toLowerCase() : '';
  /* « of » après un modal -> « have », SAUF la locution « of course » (« would of course be »),
     qui est du bon anglais et sortait en rouge sur GUM. */
  if(lw === 'of' && MODALS.has(pv) && nx !== 'course') return ['have', 'RED'];
  // « a » + son voyelle du mot suivant (IPA) -> « an ». FP=0 : mot suivant en minuscules (exclut US/UN/August) ;
  // « A » capital = article seulement en début de phrase (sinon étiquette : Party A). an->a abandonné.
  if(lw === 'a' && (w === 'a' || i === 0)
      && /^\p{L}+$/u.test(nxRaw) && nxRaw === nxRaw.toLowerCase() && nxRaw !== nxRaw.toUpperCase()
      && vowelStart(lex, nx) === true
      /* ⭐ ADJACENCE RÉELLE EXIGÉE. « hit a .322 average » donne les tokens `hit a average` :
         `tokenize` jette les chiffres et la ponctuation, donc « a » PARAÎT coller à « average ».
         8 des 17 rouges restants sur texte ÉDITÉ (GUM+PUD) venaient de là. */
      && (!adj || adj.has(i)))
    return ['an', 'RED'];
  if(lw === 'then' && (COMPAR.has(pv) || (pv.endsWith('er') && isAdj(lex, pv)))){
    if(THAN_OBJ.has(nx) || (nx && (isNoun(lex, nx) || isAdj(lex, nx)) && !isVerb(lex, nx))) return ['than', 'RED'];
    return ['than', 'ORANGE'];
  }
  // --- familles ajoutées : le discriminateur est STRUCTUREL (mot voisin), donc mesurable à FP=0 sur EWT ---
  // WHERE/WERE : un pronom sujet ne peut pas être suivi de « where » (« they where happy »). On EXIGE le
  // pronom, pas un nom : « the place where he lives » serait un FP (nom + where est parfaitement correct).
  /* ⚠️ GARDE AJOUTÉE APRÈS MESURE SUR TEXTE ÉDITÉ (GUM+PUD) : « they have to tell you where it is ».
     Ici « you » n'est PAS le sujet de « where » — c'est le COMPLÉMENT de « tell », et « where »
     ouvre une vraie subordonnée. Le discriminateur est ce qui SUIT : une subordonnée en « where »
     est suivie d'un SUJET puis d'un VERBE (« where it is », « where you are »), alors que le vrai
     « were » est suivi d'un attribut (« they where happy »). 2 des 12 rouges restants. */
  /* ⚠️ VERB **OU AUX** : « where it IS », « where you ARE ». La première version ne testait que
     VERB, et le tagger étiquette `is`/`are` en AUX — la garde ne pouvait donc jamais se déclencher.
     Lire ce que le tagger REND, pas ce qu'on croit qu'il rend. */
  if(lw === 'where' && SUBJ_PRON.has(pv)
     && !(SUBJ_PRON.has(nx) && i + 2 < T.length && /^(VERB|AUX)$/.test(ctxPos(T, i + 2))))
    return ['were', 'RED'];
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
  /* ⚠️ DEUX GARDES AJOUTÉES APRÈS MESURE SUR TEXTE ÉDITÉ (3 des 12 rouges restants) :
     ① « Two » CAPITALISÉ hors début de phrase est un mot de titre (« Ways of Two Hypnotizing »),
       pas le chiffre — même remède que pour l'article « A » et le pronom « You » ;
     ② un GÉRONDIF ne suit jamais « to » infinitif : « series two working so far » est un groupe
       nominal (saison 2), pas « to working ». Le tagger dit VERB pour un -ing, d'où le piège. */
  if(lw === 'two' && !DET_BEFORE.has(pv) && nx && ctxPos(T, i+1) === 'VERB'
     && (i === 0 || T[i] === T[i].toLowerCase())
     && !/ing$/.test(nx))
    return ['to', 'RED'];   // le test lexical !isNoun bloquait tout : « go » EST aussi un nom au lexique
  // --- PARONYMES nom/verbe : la paire ne s'entend pas, mais la POSITION tranche. Un déterminant appelle
  // un NOM, un modal/« to » appelle un VERBE. Même patron pour les 4 paires, donc une seule garde à tenir.
  if(VERB_SLOT.has(pv)){                                   // to/will/can/should… -> il faut le VERBE
    if(lw === 'advice') return ['advise', 'RED'];
    if(lw === 'breath') return ['breathe', 'RED'];
    if(lw === 'chose') return ['choose', 'RED'];
    /* ⭐ MÊME PATRON, PAIRES AJOUTÉES LE 2026-08-07 : la forme en -e est le VERBE, l'autre le NOM
       (ou l'adjectif pour `loath`). Aucun code nouveau — c'est la table qui s'allonge, ce qui est
       précisément l'intérêt d'avoir un patron. `loath` est un ADJECTIF (« loath to admit »), donc
       seule la direction VERBE est sûre : on ne fait pas l'inverse plus bas. */
    if(lw === 'cloth') return ['clothe', 'RED'];
    if(lw === 'loath') return ['loathe', 'RED'];
    if(lw === 'device') return ['devise', 'RED'];
    if(lw === 'prophecy') return ['prophesy', 'RED'];
    // « to effect change » EXISTE (= réaliser) : on n'affirme que si un DÉTERMINANT suit (« will effect the
    // outcome »), là où l'idiome valide n'en a pas.
    // « to effect the change » (= réaliser) est valide : la paire est VRAIMENT ambiguë ici, donc ORANGE.
    // On signale sans trancher — priver d'une alerte vaut moins qu'un « à vérifier ».
    if(lw === 'effect' && DET_AFTER.has(nx)) return ['affect', 'ORANGE'];
  }
  if(NOUN_SLOT.has(pv)){                                   // the/a/this/my… -> il faut le NOM
    if(lw === 'advise') return ['advice', 'RED'];
    if(lw === 'breathe') return ['breath', 'RED'];
    /* ⭐ Direction NOM des paires ajoutées. `loathe` n'y est PAS : son partenaire `loath` est un
       ADJECTIF, pas un nom — « the loath » n'existe pas, donc la règle inverse n'a pas de sens.
       Une paire n'est pas forcément symétrique : ne pas la retourner par réflexe. */
    if(lw === 'clothe') return ['cloth', 'RED'];
    if(lw === 'devise') return ['device', 'RED'];
    if(lw === 'prophesy') return ['prophecy', 'RED'];
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
  /* you/we/they was -> were.
     ⚠️ GARDE AJOUTÉE APRÈS MESURE : « Really Really Love You was released in August ». « You » y est
     un mot de TITRE, pas un pronom sujet. Même remède que pour l'article « A » : un pronom
     capitalisé AILLEURS qu'en tête de phrase n'est pas un pronom, c'est un nom propre ou un titre. */
  /* ⚠️ ET LE PRONOM DOIT ÊTRE SUJET, PAS COMPLÉMENT : « part OF you was … » est correct — le sujet
     y est « part », et « you » dépend de la préposition. Une préposition juste avant le pronom
     suffit à l'écarter. */
  if(lw === 'was' && WAS_WRONG.has(pv)
     && (i - 1 === 0 || T[i-1] === T[i-1].toLowerCase())
     && !(i >= 2 && _PREP_AVANT.has(String(T[i-2]).toLowerCase())))
    return ['were', 'RED'];
  if(lw === 'loose' && LOOSE_TRIG.has(pv) && (i < 2 || !LOOSE_IDIOM.has(T[i-2].toLowerCase()))) return ['lose', 'ORANGE'];
  // verbe irrégulier RÉGULARISÉ (runned->ran, goed->went, teached->taught) — RED FP=0 (forme nonstandard)
  const _vm = lex.VERBMORPH && lex.VERBMORPH[lw];
  if(_vm) return [PP_AUX.has(pv) ? _vm[1] : _vm[0], 'RED'];
  return [null, null];
}


/* ⭐⭐ PARTICIPE APRÈS L'AUXILIAIRE « HAVE » — « has went » -> « has gone ».
   POURQUOI CETTE FAMILLE, ET POURQUOI ELLE MANQUAIT. `verbmorph_en.json` couvrait déjà la
   SUR-RÉGULARISATION (« beared » -> bore/borne) : la faute où l'on ajoute -ed à un irrégulier.
   L'autre direction — employer le PRÉTÉRIT là où il faut le PARTICIPE — est plus fréquente en
   anglais réel et n'était pas traitée. Elle est pourtant plus SÛRE : après « have/has/had », la
   grammaire n'admet QUE le participe. Aucun jugement, une clôture de paradigme.

   MESURÉ (EWT, 176 137 tokens de texte correct) : 2 déclenchements — et les DEUX sont de vraies
   fautes du corpus (« the owner has already ran », « I have ate here 3 times »). FP=0 réel.
   Rappel : 6/6 sur fautes construites (went/ate/drank/broke/took/fell).

   ⚠️ TROIS FILTRES, CHACUN EXIGÉ PAR LA MESURE — la version sans filtres faisait 8 déclenchements :
   ① LES FORMES DE « BE » SONT EXCLUES. `verbmorph` donne « was/were », qui n'est PAS une paire
     prétérit/participe mais une alternance de NOMBRE (le participe de be est « been »). Sans ce
     filtre, « the only difference we had was… » devenait « …had were ». 5 des 6 faux positifs.
   ② PARTICIPE ATTESTÉ (freq >= 10). « bidden » est archaïque : on n'ose pas l'imposer.
   ③ LES URL SONT PROTÉGÉES (cf. urlMask).
   ⚠️ Et on saute les ADVERBES intercalés (« has already ran »), sinon la règle ne voit rien. */
/* prépositions : un pronom qui les suit est COMPLÉMENT, pas sujet (« part of you was »). */
const _PREP_AVANT = new Set(['of','to','with','for','at','from','about','between','among','like',
  'without','against','upon','than','as','on','in','by','near','behind','beside','toward','towards']);
const _BE_FORMS = new Set(['was','were','been','is','are','am','be']);
const _PP_AUX = new Set(['have','has','had','having']);
const _PP_ADV = new Set(['already','just','never','always','recently','also','probably','actually',
  'ever','not','only','still','often','clearly','apparently','once','twice','long','since']);
/* ⭐⭐ ACCORD EN NOMBRE DÉTERMINANT ↔ NOM — en **ORANGE**, et c'est tout l'intérêt.
   « many student » -> students · « a cars » -> car · « these car » -> cars.

   POURQUOI ORANGE ET PAS ROUGE — LE CHEMIN COMPLET, POUR NE PAS LE REFAIRE.
   Cette famille a été construite DEUX FOIS en rouge et mesurée DEUX FOIS négative :
     ① gardes strictes (déterminant COLLÉ au nom) : +5 FP pour +7 justes ;
     ② gardes relâchées, en empruntant le discriminateur de LanguageTool (sauter les ADJ) :
        +11 FP pour +7 justes — PIRE.
   Et la comparaison à LanguageTool (API publique, phrases de JFLEG) a montré POURQUOI eux y
   arrivent : ils TOLÈRENT les faux positifs. Mesuré chez eux au passage, « We was late » -> ils
   proposent « are », ce qui change le TEMPS et est faux. Leur barre n'est pas la nôtre.

   ⇒ Le rouge est hors d'atteinte sans analyse syntaxique. Mais la DOCTRINE ORANGE dit exactement
   quoi faire de ce cas : **doute -> orange, jamais silence**. Priver un dys d'un signalement parce
   qu'on n'est pas sûr de la correction, c'est le laisser sans rien. L'orange dit « à vérifier »,
   il ne tranche pas, et il ne peut donc pas DÉGRADER la copie.
   C'est la même réponse qu'en français au même mur — jamais essayée en anglais jusqu'ici.

   LES GARDES RESTENT, elles : un signalement absurde use la confiance autant qu'une fausse
   correction. On garde donc la tête de groupe, le trait d'union, les invariables, les massifs,
   les pluriels irréguliers et le plancher d'attestation. */
const _DET_SG = new Set(['a','an','this','each','every','one','another']);
const _DET_PL = new Set(['these','those','many','several','both','few','various','numerous',
                         'two','three','four','five','six','seven','eight','nine','ten']);
const _NUM_INVAR = new Set(['series','species','means','news','mathematics','physics','politics',
  'economics','ethics','statistics','crossroads','headquarters','barracks','works','goods','odds',
  'thanks','clothes','glasses','scissors','premises','savings','stairs','outskirts','surroundings',
  'people','police','staff','data','media','criteria','phenomena','offspring','sheep','deer','fish',
  'aircraft','salmon','trout','swine','bison','moose','corps','gallows','innings']);
const _NUM_MASS = new Set(['information','advice','research','knowledge','evidence','equipment',
  'furniture','luggage','baggage','homework','housework','money','music','progress','traffic',
  'weather','work','bread','water','air','electricity','happiness','health','help','time',
  'education','experience','training','transportation','pollution','vocabulary']);
const _PL_IRREG = new Set(['children','men','women','feet','teeth','mice','geese','oxen','lice',
  'people','police','cattle','dice','pence','alumni','fungi','cacti','nuclei','stimuli','radii',
  'bacteria','curricula','memoranda','strata','indices','matrices','vertices','appendices',
  'analyses','bases','crises','diagnoses','hypotheses','parentheses','theses','axes','oases']);
const _NUM_UNIT = new Set(['percent','cent','hundred','thousand','million','billion','dozen','score',
  'stone','head','pound','degree']);

function buildNumber(lex){
  const m = new Map();
  for(const w of lex.KNOWN){
    if(w.length < 3 || !isNoun(lex, w)) continue;
    if(_NUM_INVAR.has(w) || _NUM_MASS.has(w) || _PL_IRREG.has(w) || _NUM_UNIT.has(w)) continue;
    let pl;
    if(/[^aeiou]y$/.test(w))          pl = w.slice(0, -1) + 'ies';
    else if(/(s|x|z|ch|sh)$/.test(w)) pl = w + 'es';
    else                              pl = w + 's';
    if(!lex.KNOWN.has(pl) || !isNoun(lex, pl) || _NUM_INVAR.has(pl)) continue;
    if((lex.FREQ.get(pl) || 0) < 10) continue;          // forme proposée ATTESTÉE
    if(!m.has(w))  m.set(w,  [w, pl]);
    if(!m.has(pl)) m.set(pl, [w, pl]);
  }
  return m;
}

function numberDecide(lex, T, i, adj, hyph){
  if(!lex._NUM) lex._NUM = buildNumber(lex);
  const brut = String(T[i] || '');
  if(i < 1 || (brut !== brut.toLowerCase())) return [null, null];     // majuscule -> nom propre/titre
  const w = brut.toLowerCase();
  const paire = lex._NUM.get(w);
  if(!paire) return [null, null];
  if(_NUM_INVAR.has(w) || _NUM_MASS.has(w) || _PL_IRREG.has(w) || _NUM_UNIT.has(w)) return [null, null];
  if(hyph && (hyph.has(i) || hyph.has(i - 1))) return [null, null];   // « moon-cursed » : composé soudé
  if(ctxPos(T, i) !== 'NOUN') return [null, null];                    // le TAGGER tranche
  // LE NOM DOIT ÊTRE LA TÊTE : si un nom (ou un possessif) suit, l'accord porte sur LUI.
  // « these plant families » est CORRECT — c'est le DERNIER nom du composé qui s'accorde.
  if(i + 1 < T.length){
    const suiv = String(T[i + 1] || '');
    if(/^['’]/.test(suiv)) return [null, null];
    if(ctxPos(T, i + 1) === 'NOUN' || isNoun(lex, suiv.toLowerCase())) return [null, null];
    const sl = suiv.toLowerCase();
    if(_DET_SG.has(sl) || _DET_PL.has(sl) || sl === 'the') return [null, null];
  }
  // Remonter au déterminant en sautant ADJECTIFS et NUMÉRAUX (« many good student »).
  let j = i - 1, saut = 0;
  while(j >= 0 && saut < 3){
    if(adj && !adj.has(j)) return [null, null];                       // adjacence RÉELLE à chaque pas
    const p = ctxPos(T, j), pl = String(T[j] || '').toLowerCase();
    if(_DET_SG.has(pl) || _DET_PL.has(pl)) break;
    if(p !== 'ADJ' && p !== 'NUM') return [null, null];
    j--; saut++;
  }
  if(j < 0 || saut >= 3) return [null, null];
  const det = String(T[j] || '').toLowerCase();
  const veutPl = _DET_PL.has(det), veutSg = _DET_SG.has(det);
  if(!veutPl && !veutSg) return [null, null];
  const [sg, pl2] = paire;
  if(veutPl && w === sg) return [pl2, 'ORANGE'];
  if(veutSg && w === pl2) return [sg, 'ORANGE'];
  return [null, null];
}

function buildPastPart(lex){
  /* prétérit -> participe, UNIQUEMENT là où ils diffèrent : ailleurs il n'y a rien à corriger. */
  const m = new Map(), V = lex.VERBMORPH || {};
  for(const k of Object.keys(V)){
    const v = V[k];
    if(!Array.isArray(v) || v.length < 2) continue;
    const pt = v[0], pp = v[1];
    if(!pt || !pp || pt === pp) continue;
    if(_BE_FORMS.has(pt) || _BE_FORMS.has(pp)) continue;      // ① cf. en-tête
    if((lex.FREQ.get(pp) || 0) < 10) continue;                // ②
    if(!m.has(pt)) m.set(pt, pp);
  }
  return m;
}
function pastPartDecide(lex, T, i){
  if(!lex._P2P) lex._P2P = buildPastPart(lex);
  const w = String(T[i] || '').toLowerCase();
  const pp = lex._P2P.get(w);
  if(!pp) return [null, null];
  let j = i - 1;
  while(j > 0 && _PP_ADV.has(String(T[j] || '').toLowerCase())) j--;   // « has already ran »
  if(j < 0 || !_PP_AUX.has(String(T[j] || '').toLowerCase())) return [null, null];
  return [pp, 'RED'];
}


/* ⭐⭐ CE QUI SÉPARE DEUX TOKENS — l'équivalent anglais de `_seg_info` côté français.
   LE BUG QU'ELLE RÉPARE, ET IL EST STRUCTUREL. `tokenize` ne garde que les lettres : dans
   « hit a .322 average », les tokens sont `hit a average`. La règle a/an voit donc « a » suivi
   d'« average » (voyelle) et corrige — alors que dans le TEXTE, « a » est suivi de « .322 ».
   ADJACENT DANS LA LISTE ≠ ADJACENT DANS LE TEXTE. C'était 8 des 17 rouges restants sur du
   texte édité (GUM+PUD), et ça touche TOUTE règle de contexte, pas seulement a/an.
   `adjMask(text)` rend l'ensemble des indices i tels que le token i+1 suit le token i en n'étant
   séparé QUE par des espaces. Une règle qui exige l'adjacence consulte ce masque.
   ⚠️ DIRECTION SÛRE : consulter ce masque ne fait qu'ABSTENIR ; il ne peut pas créer de faute. */
function adjMask(text){
  const adj = new Set();
  const re = /[A-Za-z]+(?:'[A-Za-z]+)*/g;
  let m, prevEnd = -1, i = -1;
  while((m = re.exec(text))){
    i++;
    if(prevEnd >= 0 && /^[ 	]*$/.test(text.slice(prevEnd, m.index))) adj.add(i - 1);
    prevEnd = m.index + m[0].length;
  }
  return adj;
}

/* Le COUSIN du masque d'adjacence : le TRAIT D'UNION. « those moon-cursed waters » se tokenise en
   `those moon cursed` — une règle de nombre y lisait un déterminant pluriel suivi d'un nom singulier
   et signalait « moon » -> « moons ». Or `moon-cursed` est un composé soudé : le nom n'y est pas
   tête. Mesuré : c'était un rouge réel sur texte édité. Comme `adjMask`, ce masque ne fait
   qu'ABSTENIR — il ne peut pas créer de faute. */
function hyphMask(text){
  const h = new Set();
  const re = /[A-Za-z]+(?:'[A-Za-z]+)*/g;
  let m, prevEnd = -1, i = -1;
  while((m = re.exec(text))){
    i++;
    if(prevEnd >= 0 && /^[-‐‑–]$/.test(text.slice(prevEnd, m.index))) h.add(i - 1);
    prevEnd = m.index + m[0].length;
  }
  return h;
}

function tokenize(text){ return text.match(/[A-Za-z]+(?:'[A-Za-z]+)*/g) || []; }

/* ⭐ LES MOTS QUI VIVENT DANS UNE URL, UNE ADRESSE OU UN CHEMIN — à ne jamais corriger.
   D'OÙ ÇA VIENT : relecture des 55 rouges du speller sur EWT (2026-08-06). 52 étaient de VRAIES
   fautes ; l'un des trois ratés était `liberta -> liberty` À L'INTÉRIEUR d'une URL de catalogue
   (…/abode-large-metal-cage-liberta-free-de…). `Liberta` y est un nom de produit.
   L'EXPOSITION EST MESURÉE, pas supposée : 1 616 tokens d'EWT sur 176 137 (0,92 %) vivent dans
   une URL ou une adresse, et le moteur anglais n'avait AUCUNE garde. Un mot dans une URL n'est
   pas du langage — c'est un identifiant, et le corriger casse le lien.
   ⚠️ ON TESTE LE MOT ENTIER (la suite non-espacée qui contient le token), pas une fenêtre de N
   caractères : la même faute avait été commise côté français, où une fenêtre trop courte ratait
   « https://exemple.fr/a,b » parce que le schéma est 20 caractères plus loin.
   ⚠️ DIRECTION SÛRE : cette garde ne fait qu'ABSTENIR. Elle ne peut pas créer de faute. */
function urlMask(text){
  const proteges = new Set();
  const re = /[A-Za-z]+(?:'[A-Za-z]+)*/g;
  let m, i = 0;
  while((m = re.exec(text))){
    let a = m.index, b = m.index + m[0].length;
    while(a > 0 && !/\s/.test(text[a - 1])) a--;
    while(b < text.length && !/\s/.test(text[b])) b++;
    const mot = text.slice(a, b);
    if(/https?:|www\.|@|[\\/]|\.(?:com|org|net|edu|gov|co|io|fr|uk|de)\b/i.test(mot)) proteges.add(i);
    i++;
  }
  return proteges;
}

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
  return _ambPass(words, _thatPass(words, _propnPass(words, seq.reverse())));
}

/* ⭐⭐ POST-PASSE PROPN — la MAJUSCULE, que le modèle jette.
   LA CAUSE, TROUVÉE EN LISANT `le()` : la table d'émission `em` est indexée en MINUSCULES. Pour un
   mot CONNU, « Apple » est donc tagué avec la distribution de « apple » — la majuscule n'entre pas
   dans la décision. Le petit bonus PROPN (log 1.1 / log 3.0) ne s'applique qu'au repli par suffixe
   et au prior, c'est-à-dire aux mots INCONNUS. D'où PROPN à 59,2 % : le plus mauvais score du
   tagger portait sur l'indice le plus simple de l'anglais écrit.

   MESURÉ sur UD English-PUD — majuscule en position INTERNE (2 013 tokens) : 74,3 % sont PROPN en
   gold (le reste : ADJ 231 « American », NOUN 206, PRON 22). On ne bascule donc QUE depuis NOUN ou
   ADJ, et seulement là où le tagger hésitait déjà entre nominal et adjectival.
   ⇒ **exactitude globale 89,30 % -> 90,49 %, +1,19 pt** — dix fois le gain de la post-passe `that`.

   ⚠️ TROIS GARDES, chacune pour une raison :
     · i >= 1 : le mot initial est capitalisé par convention, la majuscule n'y dit RIEN ;
     · `[A-Z][a-z]` : écarte les ACRONYMES tout en capitales (NASA, USA), qui ont leur propre régime ;
     · pas après `. ! ? : ;` : c'est un début de phrase, même règle que le mot initial.
   ⚠️ Cette passe tourne AVANT `_thatPass`, qui lit les tags voisins : l'ordre compte. */
function _propnPass(words, seq){
  for(let i = 1; i < words.length; i++){
    const w = String(words[i] || '');
    if(!/^[A-Z][a-z]/.test(w)) continue;
    if(/^[.!?:;]$/.test(String(words[i-1] || ''))) continue;
    if(seq[i] === 'NOUN' || seq[i] === 'ADJ') seq[i] = 'PROPN';
  }
  return seq;
}

/* ⭐ POST-PASSE « that » — le mot le plus mal tagué de l'anglais chez nous.
   MESURÉ (UD English-PUD, gold) : `that` s'y répartit SCONJ 75 · PRON 75 · DET 15, et le Viterbi
   n'en a que 63,6 %. Ce n'est pas un détail de comptage : `that` COMPLÉTIF ouvre une proposition,
   `that` RELATIF en ouvre une autre, `that` DÉTERMINANT n'en ouvre aucune. Tout ce qui a besoin
   d'une frontière de proposition — au premier chef une future détection du SUJET — bute dessus.

   POURQUOI UNE POST-PASSE ET PAS UN MEILLEUR MODÈLE. Le HMM décide sur un bigramme de TAGS ; or
   ici l'information discriminante est la paire (tag à gauche, tag à droite) DU MOT LUI-MÊME, que
   le Viterbi ne peut pas consulter en avant. La post-passe lit ce que le modèle vient de produire.

   ⚠️ LA TABLE EST APPRISE SUR GUM UNIQUEMENT, jamais sur PUD — c'est ce qui permet à PUD de rester
   un test HONNÊTE. Mesure en hold-out : **63,6 % -> 79,4 % sur `that`** (163/165 contextes couverts).
   Un premier « plafond » de 87,9 % avait été calculé sur PUD lui-même : il était OPTIMISTE, la
   majorité étant ajustée sur le test. Ne pas citer ce chiffre-là.

   ⚠️ DEUX GARDES DANS LA CONSTRUCTION DE LA TABLE, pour ne pas inventer :
     · contexte vu moins de 4 fois -> écarté (trop rare pour trancher) ;
     · majorité sous 70 % -> écarté (le contexte n'est pas discriminant).
   Il reste 61 contextes sur 169. Les autres laissent le Viterbi décider — abstention, pas pari.
   ⚠️ CE QUE LE BIGRAMME POS NE POURRA JAMAIS FAIRE : `VERB→NOUN` est SCONJ 6 fois et DET 5 fois
   dans PUD (« said that people… » contre « bought that book »). Le plafond de cette approche est
   structurel ; le dépasser demanderait de savoir où finit le groupe nominal. */
const _AMB_W = new Set(['of','as','after','for','by','in','than','since','until','while','before','with','on','about','so','though','although','because','if','when','once','unless','whether']);
const _AMB_CTX = {"of|PROPN|PROPN":"ADP","of|NOUN|ADJ":"ADP","on|VERB|PUNCT":"ADP","on|NOUN|ADV":"ADP","of|NOUN|NOUN":"ADP","of|NOUN|ADV":"ADP","about|VERB|PRON":"ADP","on|VERB|DET":"ADP","of|NOUN|DET":"ADP","in|VERB|NOUN":"ADP","in|NOUN|NOUN":"ADP","while|<s>|NOUN":"SCONJ","on|VERB|ADJ":"ADP","in|<s>|DET":"ADP","on|NOUN|DET":"ADP","on|NOUN|PROPN":"ADP","in|NOUN|PROPN":"ADP","as|NOUN|ADV":"ADV","as|NOUN|DET":"ADP","of|NOUN|PRON":"ADP","of|PROPN|DET":"ADP","when|<s>|VERB":"ADV","by|VERB|ADJ":"ADP","by|VERB|DET":"ADP","in|NOUN|DET":"ADP","for|VERB|NOUN":"ADP","of|NOUN|PROPN":"ADP","on|AUX|NOUN":"ADP","for|PROPN|ADP":"ADP","of|ADJ|PRON":"ADP","of|PUNCT|PRON":"ADP","by|NOUN|PROPN":"ADP","of|NOUN|PUNCT":"ADP","in|NOUN|PRON":"ADP","in|NOUN|ADJ":"ADP","on|NOUN|NOUN":"ADP","in|NOUN|VERB":"SCONJ","of|DET|DET":"ADP","as|<s>|DET":"ADP","by|PUNCT|VERB":"SCONJ","with|NOUN|ADJ":"ADP","in|ADJ|ADJ":"ADP","about|NOUN|DET":"ADP","in|ADV|DET":"ADP","for|<s>|ADJ":"ADP","for|NOUN|NOUN":"ADP","for|<s>|NOUN":"ADP","on|PUNCT|DET":"ADP","as|ADJ|NOUN":"ADP","for|NOUN|ADJ":"ADP","although|<s>|ADJ":"SCONJ","of|NUM|DET":"ADP","by|PUNCT|NOUN":"ADP","of|NOUN|NUM":"ADP","on|NOUN|ADJ":"ADP","in|ADJ|NOUN":"ADP","in|<s>|NOUN":"ADP","on|ADJ|DET":"ADP","for|VERB|ADJ":"ADP","of|ADJ|NOUN":"ADP","for|NOUN|DET":"ADP","in|NOUN|ADV":"ADP","by|<s>|VERB":"SCONJ","by|NOUN|DET":"ADP","on|VERB|NOUN":"ADP","for|ADJ|VERB":"SCONJ","in|<s>|ADJ":"ADP","by|VERB|VERB":"SCONJ","in|VERB|NUM":"ADP","by|VERB|PRON":"ADP","in|PROPN|PROPN":"ADP","by|VERB|PROPN":"ADP","for|<s>|PRON":"ADP","of|<s>|NOUN":"ADP","for|ADV|ADJ":"ADP","if|<s>|PRON":"SCONJ","on|<s>|DET":"ADP","in|VERB|DET":"ADP","if|PUNCT|ADJ":"SCONJ","for|NOUN|PRON":"ADP","because|NOUN|PRON":"SCONJ","in|PRON|NOUN":"ADP","as|PUNCT|AUX":"SCONJ","by|ADV|DET":"ADP","for|CCONJ|VERB":"SCONJ","if|PRON|PRON":"SCONJ","if|<s>|DET":"SCONJ","in|PUNCT|PRON":"ADP","in|VERB|ADJ":"ADP","as|VERB|DET":"ADP","as|PUNCT|VERB":"SCONJ","of|ADV|PROPN":"ADP","of|AUX|DET":"ADP","of|CCONJ|PRON":"ADP","in|VERB|PROPN":"ADP","when|NOUN|DET":"ADV","in|<s>|PROPN":"ADP","by|NOUN|ADJ":"ADP","for|NUM|DET":"ADP","for|PUNCT|DET":"ADP","for|PUNCT|NOUN":"ADP","on|VERB|PROPN":"ADP","if|PUNCT|VERB":"SCONJ","for|ADV|NOUN":"ADP","on|PUNCT|PROPN":"ADP","on|PUNCT|ADJ":"ADP","in|PUNCT|PROPN":"ADP","as|PUNCT|ADV":"ADV","for|ADJ|DET":"ADP","if|ADV|DET":"SCONJ","in|ADP|DET":"ADP","so|NOUN|ADV":"ADV","if|<s>|NOUN":"SCONJ","by|VERB|NOUN":"ADP","for|PRON|NOUN":"ADP","with|ADV|DET":"ADP","with|PRON|DET":"ADP","for|VERB|DET":"ADP","when|PUNCT|VERB":"ADV","in|NOUN|NUM":"ADP","although|PUNCT|DET":"SCONJ","with|PUNCT|DET":"ADP","than|NOUN|DET":"ADP","with|PROPN|DET":"ADP","when|<s>|DET":"ADV","for|PRON|DET":"ADP","of|ADJ|DET":"ADP","for|CCONJ|DET":"ADP","with|NOUN|NOUN":"ADP","of|VERB|NOUN":"ADP","on|VERB|PRON":"ADP","with|NOUN|DET":"ADP","for|<s>|DET":"ADP","while|PUNCT|VERB":"SCONJ","since|PUNCT|PRON":"SCONJ","with|<s>|NOUN":"ADP","on|NOUN|VERB":"SCONJ","on|CCONJ|DET":"ADP","than|ADV|NUM":"ADP","of|SCONJ|PRON":"ADP","in|ADV|NOUN":"ADP","of|ADJ|ADJ":"ADP","of|PUNCT|DET":"ADP","as|ADV|NOUN":"ADP","with|VERB|DET":"ADP","after|CCONJ|DET":"ADP","of|PROPN|NOUN":"ADP","of|VERB|NUM":"ADP","before|NOUN|CCONJ":"ADP","by|VERB|NUM":"ADP","while|PUNCT|DET":"SCONJ","after|NOUN|DET":"ADP","in|CCONJ|DET":"ADP","by|PART|DET":"ADP","by|PROPN|PROPN":"ADP","by|PROPN|NOUN":"ADP","while|<s>|DET":"SCONJ","of|VERB|ADV":"ADP","than|NOUN|NOUN":"ADP","about|AUX|DET":"ADV","as|ADJ|DET":"ADP","of|NOUN|AUX":"SCONJ","in|PUNCT|NOUN":"ADP","in|PUNCT|ADJ":"ADP","so|AUX|ADJ":"ADV","in|ADJ|DET":"ADP","by|CCONJ|DET":"ADP","with|ADV|ADJ":"ADP","so|VERB|ADV":"ADV","as|CCONJ|DET":"ADP","in|PUNCT|DET":"ADP","by|<s>|NOUN":"ADP","in|PRON|NUM":"ADP","about|VERB|DET":"ADP","by|ADV|NOUN":"ADP","in|CCONJ|NOUN":"ADP","with|PUNCT|ADJ":"ADP","as|VERB|SCONJ":"SCONJ","in|VERB|PRON":"ADP","of|ADV|NUM":"ADP","because|VERB|PRON":"SCONJ","as|ADJ|PRON":"SCONJ","in|AUX|DET":"ADP","when|VERB|VERB":"ADV","for|ADV|DET":"ADP","with|VERB|NOUN":"ADP","in|NUM|DET":"ADP","with|VERB|ADJ":"ADP","than|ADJ|NUM":"ADP","in|NUM|NOUN":"ADP","as|ADJ|PROPN":"ADP","as|<s>|ADP":"ADP","for|VERB|PROPN":"ADP","as|NOUN|VERB":"SCONJ","of|SYM|DET":"ADP","of|DET|PRON":"ADP","of|ADV|DET":"ADP","for|VERB|PRON":"ADP","than|ADV|ADJ":"ADP","when|<s>|NOUN":"ADV","of|VERB|PUNCT":"ADP","as|NOUN|NOUN":"ADP","about|NOUN|NOUN":"ADP","for|PROPN|PROPN":"ADP","for|NOUN|PROPN":"ADP","for|NOUN|VERB":"SCONJ","of|NOUN|ADP":"ADP","on|ADP|NOUN":"ADP","so|PUNCT|PRON":"ADV","when|NOUN|VERB":"ADV","as|ADV|PART":"ADP","for|PROPN|DET":"ADP","for|NOUN|NUM":"ADP","of|PUNCT|NOUN":"ADP","as|PUNCT|PRON":"SCONJ","as|VERB|NOUN":"ADP","of|VERB|DET":"ADP","on|CCONJ|PRON":"ADP","for|ADJ|PROPN":"ADP","with|ADV|NOUN":"ADP","by|PUNCT|DET":"ADP","about|ADP|NUM":"ADV","for|ADJ|ADJ":"ADP","of|VERB|PROPN":"ADP","by|NOUN|VERB":"SCONJ","whether|PUNCT|DET":"SCONJ","for|ADV|PROPN":"ADP","with|ADJ|DET":"ADP","than|ADJ|NOUN":"ADP","of|ADJ|PROPN":"ADP","because|<s>|PRON":"SCONJ","if|NOUN|DET":"SCONJ","than|NOUN|ADP":"SCONJ","because|NOUN|ADP":"ADP","of|ADP|ADJ":"ADP","in|ADV|ADJ":"ADP","in|<s>|PRON":"ADP","while|NOUN|VERB":"SCONJ","than|ADV|ADP":"ADP","in|ADJ|VERB":"SCONJ","than|ADV|ADV":"ADP","with|VERB|PRON":"ADP","for|<s>|PROPN":"ADP","of|AUX|ADJ":"ADP","as|NOUN|PRON":"SCONJ","with|NOUN|PROPN":"ADP","in|PRON|VERB":"SCONJ","by|ADJ|DET":"ADP","of|AUX|NOUN":"ADP","for|CCONJ|PRON":"ADP","after|<s>|DET":"ADP","of|PUNCT|PROPN":"ADP","with|NOUN|PRON":"ADP","in|PROPN|PRON":"ADP","until|NOUN|PRON":"SCONJ","because|PUNCT|PRON":"SCONJ","in|VERB|ADP":"ADP","in|PROPN|NOUN":"ADP","in|PROPN|NUM":"ADP","with|NUM|DET":"ADP","for|ADP|DET":"ADP","so|VERB|SCONJ":"SCONJ","on|ADV|NOUN":"ADP","in|PUNCT|NUM":"ADP","when|NOUN|PRON":"ADV","in|PRON|DET":"ADP","with|PROPN|NOUN":"ADP","as|VERB|PROPN":"ADP","of|VERB|PRON":"ADP","than|ADV|DET":"ADP","by|ADV|PROPN":"ADP","with|VERB|PROPN":"ADP","in|<s>|NUM":"ADP","in|ADV|NUM":"ADP","for|ADV|PRON":"ADP","of|VERB|ADJ":"ADP","with|PROPN|PROPN":"ADP","in|ADV|PRON":"ADP","on|PROPN|PROPN":"ADP","in|PROPN|DET":"ADP","on|PROPN|DET":"ADP","when|PROPN|PRON":"ADV","while|<s>|PRON":"SCONJ","when|VERB|DET":"ADV","in|AUX|PROPN":"ADP","of|ADJ|NUM":"ADP","in|ADV|PROPN":"ADP","so|CCONJ|ADP":"ADV","on|ADV|PUNCT":"ADV","while|PUNCT|ADV":"SCONJ","of|NUM|PROPN":"ADP","with|PUNCT|PROPN":"ADP","as|VERB|NUM":"ADP","by|PUNCT|PROPN":"ADP","after|<s>|NUM":"ADP","of|ADV|PRON":"ADP","after|NOUN|PRON":"SCONJ","although|PUNCT|PRON":"SCONJ","while|<s>|PROPN":"SCONJ","on|VERB|NUM":"ADP","on|NOUN|NUM":"ADP","as|NOUN|ADP":"ADP","before|NOUN|PRON":"SCONJ","on|PRON|PRON":"ADP","if|VERB|PRON":"SCONJ","if|CCONJ|PRON":"SCONJ","after|PUNCT|VERB":"SCONJ","for|PUNCT|PRON":"ADP","as|NOUN|PROPN":"ADP","as|<s>|ADV":"ADV","since|PROPN|NUM":"ADP","in|NUM|PROPN":"ADP","in|PRON|ADJ":"ADP","in|PROPN|ADJ":"ADP","in|CCONJ|NUM":"ADP","in|PRON|PROPN":"ADP","in|ADP|PROPN":"ADP","with|CCONJ|DET":"ADP","for|AUX|DET":"ADP","with|AUX|PRON":"ADP","when|PRON|PRON":"ADV","as|ADV|PRON":"SCONJ","as|PROPN|DET":"ADP","as|NOUN|PUNCT":"ADP","as|PRON|DET":"ADP","about|VERB|ADJ":"ADP","on|AUX|DET":"ADP","when|<s>|PRON":"ADV","with|PRON|NOUN":"ADP","if|PUNCT|NOUN":"SCONJ","when|ADV|VERB":"ADV","with|<s>|DET":"ADP","as|<s>|PRON":"SCONJ","of|NUM|PRON":"ADP","of|ADP|NOUN":"ADP","while|<s>|ADV":"SCONJ","in|VERB|CCONJ":"ADP","for|ADP|NOUN":"ADP","after|<s>|VERB":"SCONJ","with|NOUN|NUM":"ADP","with|PROPN|NUM":"ADP","on|<s>|PROPN":"ADP","after|PROPN|VERB":"SCONJ","in|NUM|NUM":"ADP","so|NOUN|ADJ":"ADV","in|ADJ|PRON":"ADP","with|ADV|PROPN":"ADP","for|PUNCT|PROPN":"ADP","on|ADP|PROPN":"ADP","by|<s>|DET":"ADP","of|PROPN|NUM":"ADP","by|PROPN|DET":"ADP","of|AUX|PROPN":"ADP","when|PUNCT|PRON":"ADV","with|PROPN|PRON":"ADP","as|VERB|PRON":"SCONJ","though|PUNCT|ADV":"ADV","on|VERB|ADV":"ADP","of|PRON|DET":"ADP","with|PUNCT|PRON":"ADP","on|NOUN|PRON":"ADP","about|ADV|NUM":"ADV","on|ADP|DET":"ADP","than|ADJ|ADV":"ADP","in|AUX|NOUN":"ADP","because|ADV|PRON":"SCONJ","of|ADP|PROPN":"ADP","about|VERB|NUM":"ADV","with|ADJ|PRON":"ADP","as|PROPN|NOUN":"ADP","of|CCONJ|NOUN":"ADP","after|PUNCT|NUM":"ADP","before|NOUN|DET":"ADP","on|VERB|ADP":"ADP","as|PROPN|PRON":"ADP","for|ADJ|PRON":"ADP","though|PUNCT|PRON":"SCONJ","of|CCONJ|DET":"ADP","for|PUNCT|ADJ":"ADP","in|CCONJ|ADJ":"ADP","while|SCONJ|PRON":"SCONJ","after|NOUN|VERB":"SCONJ","as|PROPN|ADV":"ADV","while|PUNCT|PRON":"SCONJ","although|<s>|PRON":"SCONJ","than|ADJ|PROPN":"ADP","for|PROPN|ADJ":"ADP","when|ADP|PRON":"ADV","though|PUNCT|DET":"SCONJ","for|NOUN|ADV":"ADP","about|PUNCT|NUM":"ADV","in|PUNCT|PUNCT":"ADP","so|CCONJ|PRON":"ADV","on|ADV|PROPN":"ADP","in|ADJ|PROPN":"ADP","about|AUX|PUNCT":"ADP","in|AUX|PRON":"ADP","as|PRON|PRON":"SCONJ","about|PRON|DET":"ADP","of|ADV|NOUN":"ADP","with|ADJ|NOUN":"ADP","in|PRON|PUNCT":"ADP","so|CCONJ|PUNCT":"ADV","when|VERB|PRON":"ADV","in|VERB|ADV":"ADP","if|PUNCT|PRON":"SCONJ","so|VERB|ADJ":"ADV","as|PART|ADJ":"ADV","as|PUNCT|SCONJ":"SCONJ","for|PRON|NUM":"ADP","in|ADP|PRON":"ADP","by|VERB|PUNCT":"ADP","for|PUNCT|ADP":"ADP","with|ADP|DET":"ADP","of|ADP|PRON":"ADP","as|AUX|ADV":"ADV","in|ADJ|ADV":"ADP","for|PRON|ADP":"ADP","on|ADJ|PRON":"ADP","on|PUNCT|PRON":"ADP","about|VERB|PUNCT":"ADP","on|NOUN|ADP":"ADP","so|<s>|ADJ":"ADV","in|PART|DET":"ADP","for|VERB|PUNCT":"ADP","in|CCONJ|PROPN":"ADP","though|NOUN|PUNCT":"ADV","as|AUX|ADJ":"ADV","as|CCONJ|PRON":"SCONJ","when|PUNCT|DET":"ADV","so|PUNCT|ADV":"ADV","when|AUX|PRON":"ADV","if|ADV|PRON":"SCONJ","about|PRON|PRON":"ADP","by|NOUN|NUM":"ADP","about|NOUN|PROPN":"ADP","so|AUX|VERB":"ADV","until|VERB|PRON":"SCONJ","about|PRON|NOUN":"ADP","for|ADJ|NOUN":"ADP","for|VERB|NUM":"ADP","of|PUNCT|PUNCT":"ADP","with|<s>|PRON":"ADP","with|VERB|PUNCT":"ADP","about|VERB|NOUN":"ADP","so|PUNCT|ADJ":"ADV","for|PRON|ADV":"ADP","with|PRON|PRON":"ADP","with|ADV|PRON":"ADP","on|ADV|PRON":"ADP","so|<s>|AUX":"ADV","unless|PUNCT|PRON":"SCONJ","on|AUX|PRON":"ADP","with|<s>|PROPN":"ADP","of|ADJ|ADP":"ADP","on|PRON|DET":"ADP","on|NOUN|PUNCT":"ADP","so|PUNCT|PUNCT":"ADV","since|ADV|PRON":"SCONJ","so|PUNCT|PART":"ADV","about|AUX|NUM":"ADV","so|ADV|ADV":"ADV","about|VERB|ADP":"ADP","since|<s>|PRON":"SCONJ","on|NUM|DET":"ADP","as|PRON|ADV":"ADV","on|CCONJ|NOUN":"ADP","as|<s>|PROPN":"SCONJ","after|ADV|DET":"ADP","about|ADV|PRON":"ADP","before|PUNCT|PRON":"SCONJ","for|VERB|ADP":"ADP","as|PUNCT|ADP":"ADP","so|AUX|ADP":"ADV","when|ADV|PRON":"ADV","of|ADV|ADV":"ADP","of|ADV|ADJ":"ADP","because|NOUN|ADV":"SCONJ","because|NOUN|PUNCT":"SCONJ","because|NOUN|PROPN":"SCONJ","because|PUNCT|ADV":"SCONJ","of|PUNCT|ADJ":"ADP","because|ADJ|PUNCT":"SCONJ","on|ADV|DET":"ADP","because|SCONJ|PRON":"SCONJ","so|CCONJ|DET":"ADV","when|CCONJ|PRON":"ADV","in|AUX|ADJ":"ADP","on|PROPN|NOUN":"ADP","of|ADP|NUM":"ADP","about|NOUN|SCONJ":"SCONJ","whether|PUNCT|PRON":"SCONJ","of|ADP|DET":"ADP","with|PUNCT|NOUN":"ADP","on|AUX|PROPN":"ADP","because|AUX|PRON":"SCONJ","of|ADV|VERB":"ADP","because|ADJ|DET":"SCONJ","for|PRON|ADJ":"ADP","by|ADV|VERB":"SCONJ","although|<s>|DET":"SCONJ","so|VERB|ADP":"ADV","on|PRON|NOUN":"ADP","because|ADJ|PRON":"SCONJ","about|NOUN|PUNCT":"ADP","as|ADJ|PUNCT":"ADP","about|NOUN|PRON":"ADP","on|ADP|PRON":"ADP","because|PUNCT|DET":"SCONJ","whether|AUX|PRON":"SCONJ","so|PRON|PRON":"ADV","about|ADJ|DET":"ADP","because|NOUN|DET":"SCONJ","after|NOUN|NOUN":"ADP","on|PRON|PROPN":"ADP","so|<s>|SCONJ":"ADV","so|VERB|PUNCT":"ADV","whether|VERB|DET":"SCONJ","as|ADV|ADP":"ADP","if|PUNCT|DET":"SCONJ","because|ADV|DET":"SCONJ","in|AUX|VERB":"ADP","though|PUNCT|PUNCT":"ADV","if|NOUN|PRON":"SCONJ","by|ADJ|NOUN":"ADP","until|PUNCT|PRON":"SCONJ","as|SCONJ|DET":"ADP","of|PRON|NOUN":"ADP","because|PUNCT|ADP":"ADP","in|SCONJ|DET":"ADP","by|<s>|PROPN":"ADP","by|NOUN|PUNCT":"PROPN","while|ADV|PRON":"SCONJ","with|ADP|NOUN":"ADP","than|ADV|NOUN":"ADP","of|SCONJ|NOUN":"ADP","about|NOUN|ADV":"ADP","in|PRON|PRON":"ADP","in|ADP|NOUN":"ADP","than|ADJ|DET":"ADP","because|AUX|DET":"SCONJ","while|DET|ADP":"NOUN","of|NOUN|SYM":"ADP","so|ADP|ADJ":"ADV","after|VERB|DET":"ADP","about|VERB|PROPN":"ADP","for|PROPN|VERB":"SCONJ","after|VERB|PROPN":"ADP","when|ADJ|PRON":"ADV","of|SCONJ|DET":"ADP","because|AUX|NOUN":"SCONJ","in|ADP|ADJ":"ADP","with|PRON|ADJ":"ADP","about|VERB|VERB":"SCONJ","though|ADV|PRON":"SCONJ","when|<s>|PROPN":"ADV","when|PUNCT|PROPN":"ADV","with|NOUN|ADV":"ADP","as|CCONJ|ADV":"ADV","of|ADJ|ADV":"ADP","while|DET|PUNCT":"NOUN","before|NOUN|VERB":"SCONJ","in|PRON|ADP":"ADP","before|PROPN|PUNCT":"ADV","with|NOUN|VERB":"ADP","for|PUNCT|ADV":"SCONJ","when|CCONJ|DET":"ADV","of|PRON|PRON":"ADP","so|AUX|ADV":"ADV","before|VERB|PUNCT":"ADV","as|NOUN|SCONJ":"SCONJ","with|CCONJ|NOUN":"ADP","while|NOUN|DET":"SCONJ","before|PRON|PUNCT":"ADV","once|<s>|PRON":"SCONJ","so|ADV|SCONJ":"SCONJ","when|ADV|DET":"ADV","with|VERB|ADV":"ADP","because|PUNCT|PROPN":"SCONJ","than|ADJ|ADJ":"ADP","so|PRON|ADV":"ADV","with|NOUN|PUNCT":"ADP","so|PUNCT|VERB":"ADV","when|<s>|AUX":"ADV","for|ADV|NUM":"ADP","for|CCONJ|NOUN":"ADP","when|SCONJ|PRON":"ADV","whether|VERB|PRON":"SCONJ","so|PUNCT|NUM":"INTJ","if|VERB|DET":"SCONJ","on|VERB|VERB":"SCONJ","than|ADV|VERB":"ADP","of|NUM|NUM":"ADP","because|ADV|ADP":"ADP","as|ADJ|AUX":"ADP","with|ADJ|PROPN":"ADP","for|PRON|PRON":"ADP","so|PRON|ADJ":"ADV","of|PROPN|PRON":"ADP","as|VERB|PUNCT":"ADP","on|ADV|ADJ":"ADP","for|PRON|PROPN":"ADP","in|ADV|PUNCT":"ADP","so|NOUN|SCONJ":"SCONJ","by|NOUN|PRON":"ADP","in|CCONJ|VERB":"SCONJ","of|PROPN|ADJ":"ADP","of|DET|PROPN":"ADP","for|VERB|ADV":"ADP","about|NOUN|ADJ":"ADP","so|ADV|ADJ":"ADV","if|ADJ|PRON":"SCONJ","for|VERB|CCONJ":"ADP","as|ADP|DET":"ADP","so|CCONJ|ADV":"ADV","for|NOUN|PUNCT":"ADP","by|ADP|DET":"ADP","after|ADV|VERB":"SCONJ","because|PRON|PRON":"SCONJ","about|ADJ|PRON":"ADP","because|VERB|ADP":"ADP","of|VERB|ADP":"ADP","for|NOUN|ADP":"ADP","because|<s>|NOUN":"SCONJ","once|PUNCT|PRON":"SCONJ","if|CCONJ|NOUN":"SCONJ","as|ADJ|NUM":"ADP","on|<s>|PRON":"ADP","so|PUNCT|AUX":"ADV","on|NOUN|CCONJ":"ADP","so|INTJ|PRON":"INTJ","so|ADJ|PRON":"ADV","as|ADP|ADJ":"ADV","in|VERB|</s>":"ADV","if|<s>|VERB":"SCONJ","once|NOUN|PRON":"SCONJ","as|PUNCT|PUNCT":"ADP","once|<s>|DET":"SCONJ"};
function _ambPass(words, seq){
  for(let i = 0; i < words.length; i++){
    const w = String(words[i] || '').toLowerCase();
    if(!_AMB_W.has(w)) continue;
    const k = w + '|' + (i > 0 ? seq[i-1] : '<s>') + '|' + (i+1 < words.length ? seq[i+1] : '</s>');
    const t = _AMB_CTX[k];
    if(t) seq[i] = t;
  }
  return seq;
}
const _THAT_CTX = {"<s>|AUX":"PRON","<s>|NOUN":"DET","<s>|VERB":"PRON","ADJ|ADJ":"SCONJ","ADJ|ADV":"SCONJ","ADJ|AUX":"PRON","ADJ|DET":"SCONJ","ADJ|PRON":"SCONJ","ADP|ADJ":"DET","ADP|ADP":"PRON","ADP|ADV":"PRON","ADP|AUX":"PRON","ADP|NOUN":"DET","ADP|PUNCT":"PRON","ADV|ADJ":"ADV","ADV|ADV":"SCONJ","ADV|AUX":"PRON","ADV|DET":"SCONJ","ADV|NOUN":"DET","ADV|PRON":"SCONJ","ADV|PUNCT":"PRON","ADV|VERB":"PRON","AUX|ADV":"PRON","AUX|AUX":"PRON","AUX|DET":"SCONJ","AUX|PRON":"SCONJ","AUX|PUNCT":"PRON","AUX|VERB":"PRON","CCONJ|ADV":"SCONJ","CCONJ|AUX":"PRON","CCONJ|DET":"SCONJ","CCONJ|PRON":"SCONJ","CCONJ|VERB":"PRON","INTJ|AUX":"PRON","NOUN|ADP":"SCONJ","NOUN|ADV":"PRON","NOUN|AUX":"PRON","NOUN|PART":"PRON","NOUN|VERB":"PRON","NUM|AUX":"PRON","PRON|AUX":"PRON","PRON|DET":"SCONJ","PRON|VERB":"PRON","PROPN|AUX":"PRON","PROPN|VERB":"PRON","PUNCT|ADV":"PRON","PUNCT|AUX":"PRON","PUNCT|DET":"SCONJ","PUNCT|PRON":"SCONJ","PUNCT|VERB":"PRON","SCONJ|AUX":"PRON","SCONJ|NOUN":"DET","SCONJ|PUNCT":"PRON","SCONJ|VERB":"PRON","VERB|AUX":"PRON","VERB|DET":"SCONJ","VERB|NUM":"SCONJ","VERB|PRON":"SCONJ","VERB|PROPN":"SCONJ","VERB|PUNCT":"PRON","VERB|SCONJ":"SCONJ"};
function _thatPass(words, seq){
  for(let i = 0; i < words.length; i++){
    if(String(words[i] || '').toLowerCase() !== 'that') continue;
    const k = (i > 0 ? seq[i-1] : '<s>') + '|' + (i+1 < words.length ? seq[i+1] : '</s>');
    const t = _THAT_CTX[k];
    if(t) seq[i] = t;
  }
  return seq;
}
// navigateur : charge le modèle gzippé (même schéma que lex_en.tsv.gz)
async function loadPosModel(url){
  const r = await fetch(url || '../dictee/pos_hmm_en.json.gz');
  if(!r.ok) throw new Error('http ' + r.status);
  const ds = r.body.pipeThrough(new DecompressionStream('gzip'));
  return setPosModel(JSON.parse(await new Response(ds).text()));
}

const _API = { deacc, phonKey, edits1, buildPhonIndex, spellSuggest, homoDecide, tokenize, urlMask, adjMask, hyphMask,
               pastPartDecide, buildPastPart, numberDecide, buildNumber,
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
  /* ⭐ PARTICIPE APRÈS « HAVE » — positifs ET négatifs. Les négatifs sont la moitié qui compte :
     la règle est ROUGE, donc appliquée seule. « the difference we had was » est le faux positif
     exact que la mesure sur EWT avait sorti (5 fois) avant le filtre sur les formes de « be ». */
  const PP_OUI = [['I have went there','went','gone'], ['she has ate already','ate','eaten'],
                  ['they had drank it all','drank','drunk'], ['he has broke the vase','broke','broken'],
                  ['we have took the bus','took','taken'], ['it has fell down','fell','fallen']];
  const PP_NON = ['the only difference we had was for package V02', 'he has run fast every day',
                  'I have read the book twice', 'the water had cost too much', 'she has left already'];
  let ppOk = 0, ppKo = 0;
  for(const [txt, mot, att] of PP_OUI){ const T = tokenize(txt); let vu = null;
    for(let k = 1; k < T.length; k++){ const d = pastPartDecide(lex, T, k);
      if(d[1] === 'RED' && T[k].toLowerCase() === mot) vu = d[0]; }
    if(vu === att) ppOk++; else { ppKo++; console.log('  PP MISS %s : %s -> %s (attendu %s)', txt, mot, vu, att); } }
  for(const txt of PP_NON){ const T = tokenize(txt);
    for(let k = 1; k < T.length; k++){ const d = pastPartDecide(lex, T, k);
      if(d[1] === 'RED'){ ppKo++; console.log('  PP FAUX POSITIF : %s -> %s   | %s', T[k], d[0], txt); } } }
  console.log('participe apres have: %d/%d positifs, %d faux positifs', ppOk, PP_OUI.length, ppKo - (PP_OUI.length - ppOk));
  /* ⭐ PARONYMES NOM/VERBE — paires ajoutées le 2026-08-07 au patron existant. Positifs ET
     négatifs : la règle est ROUGE, et `loath` est un ADJECTIF donc sa direction inverse n'existe
     pas (« the loath » n'est pas de l'anglais) — une paire n'est pas forcément symétrique. */
  const PN = [['I need to cloth the children', 'clothe'], ['you should loath that idea', 'loathe'],
              ['they will device a plan', 'devise'], ['we must prophecy the future', 'prophesy'],
              ['he was loath to admit it', null], ['buy the cloth today', null],
              ['a new device arrived', null], ['the prophecy came true', null]];
  let pnOk = 0;
  for(const [txt, att] of PN){ const T = tokenize(txt), A = adjMask(txt); let vu = null;
    for(let k = 0; k < T.length; k++){ const d = homoDecide(lex, T, k, A); if(d[1] === 'RED') vu = d[0]; }
    if(vu === att) pnOk++; else console.log('  PARONYME MISS : %s -> %s (attendu %s)', txt, vu, att); }
  console.log('paronymes nom/verbe: %d/%d', pnOk, PN.length);
  console.log('homophone: %d/%d', hok, HP.length);
  if(process.argv.includes('--check')){                    // garde CI : parité CASES (auto+flag ≥ 10 typos clairs, homophones tous)
    const ok = (auto + flag >= 10) && (hok === HP.length);
    console.log('[check] %s — speller %d, homophone %d/%d', ok ? 'OK' : 'ÉCHEC', auto + flag, hok, HP.length);
    if(!ok) process.exit(1);
  }
}
