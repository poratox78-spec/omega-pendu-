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
const _E2 = new Map();                        // mémo des candidats à 2 éditions (cf. spellSuggest)
function spellSuggest(lex, w, prev){          // prev = mot précédent en minuscules ; absent -> pas de bonus
  const low = deacc(w.toLowerCase());
  if(!low || low.length < 2 || /[^a-z]/.test(low)) return [null, 'OK'];  // lettre seule (a, I) / non a-z
  if(lex.KNOWN.has(low)) return [null, 'OK'];
  /* ⭐ ORTHOGRAPHE BRITANNIQUE — notre lexique est biaisé AMÉRICAIN (kaikki + SUBTLEX US), donc
     `iodised`, `sanitisers`, `organise`, `colour`, `centre` étaient signalés comme des fautes.
     Trouvé en LISANT le résidu du flood orange : après réparation du tokeniseur, les têtes de liste
     étaient `iodised`(9) et `sanitisers`(2) — de l'anglais parfaitement correct.
     ⚠️ ON NE GROSSIT PAS L'ASSET : on DÉRIVE la variante américaine et on interroge le lexique
     qu'on a déjà. Zéro octet de plus, et ça couvre toute la famille d'un coup plutôt que mot à mot
     ([[completude-lexiques-doctrine]] : compléter la RÈGLE, pas patcher les cas).
     ⚠️ Direction unique : UK -> US pour INTERROGER. On ne PROPOSE jamais de réécrire l'un en
     l'autre — les deux orthographes sont correctes, et « corriger » colour->color serait imposer
     une variété de l'anglais à qui écrit l'autre. */
  const _us = low
    .replace(/isation\b/, 'ization').replace(/isations\b/, 'izations')
    .replace(/isers\b/, 'izers').replace(/iser\b/, 'izer').replace(/isable\b/, 'izable')
    .replace(/ise\b/, 'ize').replace(/ised\b/, 'ized').replace(/ises\b/, 'izes').replace(/ising\b/, 'izing')
    .replace(/yse\b/, 'yze').replace(/ysed\b/, 'yzed').replace(/yses\b/, 'yzes').replace(/ysing\b/, 'yzing')
    .replace(/our\b/, 'or').replace(/ours\b/, 'ors').replace(/oured\b/, 'ored').replace(/ouring\b/, 'oring')
    .replace(/logue\b/, 'log').replace(/logues\b/, 'logs')
    .replace(/^(.*[bcdfghjklmnpqrstvwxz])re\b/, '$1er');
  if(_us !== low && lex.KNOWN.has(_us)) return [null, 'OK'];
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
  /* ⭐ DISTANCE 2 EN SECOURS — seulement quand la distance 1 ne rend RIEN, et sur ≤12 lettres.
     Le mur mesuré n'était pas le classement mais la GÉNÉRATION : sur 1006 mots inconnus de JFLEG,
     le bon mot est absent des candidats 309 fois, contre 83 fois présent mais mal classé. Aucun
     réglage de score ne rattrape un mot qu'on ne propose jamais.

     TROIS VARIANTES MESURÉES, une seule tient :
       distance 2 TOUJOURS   626/1006 — mais 45 RÉGRESSIONS (« maind » -> and au lieu de mind) :
                             les candidats à 2 éditions volent des cas que la distance 1 gagnait.
       distance 2 EN SECOURS 648/1006 (61,0 % -> 64,4 %) et ZÉRO régression, par construction :
                             elle ne s'active que là où l'on ne disait rien du tout.
       + filtre phonétique   614/1006 — RÉFUTÉ, et c'est instructif : `cands` intègre DÉJÀ les
                             voisins phonétiques, donc filtrer par le son ne peut rendre que ce
                             qu'on avait déjà. La voie phonétique est saturée en amont.

     PLAFOND DE 12 LETTRES, mesuré, pas choisi : ≤8 rend 618, ≤10 rend 634, ≤12 rend 648… et
     au-delà de 12 le rappel n'augmente PLUS D'UN SEUL CAS pour le double du temps (38 ms -> 70 ms).
     Les mots très longs qui échouent en distance 1 sont à distance 3+ (« nonfluoridated »), donc
     hors d'atteinte de toute façon.

     ⚠️ NE PEUT JAMAIS PRODUIRE UN ROUGE, et ce n'est pas une promesse mais une conséquence : le
     tier vaut 0,5, or l'affirmation exige `bt === 1`. Ces candidats sortent donc toujours en
     ORANGE — « mot inconnu, vouliez-vous dire… ». Prix mesuré sur 15 353 phrases éditées :
     56 mots rares de plus reçoivent une suggestion au lieu du silence (`warwick` -> `warlock`),
     soit 0,36 % — sous notre plafond de flood français (0,70 %). Face à un dys qui a écrit
     `trasisional`, le choix n'est pas « bonne suggestion ou mauvaise » mais « une suggestion ou
     RIEN » : [[orange-doctrine]] tranche pour l'orange. */
  if(!cands.size && low.length <= 12){
    /* MÉMORISÉ, et ce n'est pas du confort : 38 ms par mot, c'est 13,5 s sur un texte de 160 mots
       inconnus — un gel. Le calcul ne dépend que du mot (pas du contexte), donc il se mémorise
       exactement. Les mots se répètent dans un vrai texte, et un dys refait la MÊME faute : le
       coût réel s'effondre. Mémo déterministe ⇒ la parité avec le Python reste vraie.
       MESURÉ (Node) : texte dys réaliste de 22 mots dont 8 fautes -> 2 ms · 160 mots inconnus
       répétés -> 279 ms puis 11 ms · 120 mots inconnus TOUS DISTINCTS -> 2,2 s.
       ⚠️ Ce dernier cas reste lent et on l'assume : c'est un collage de charabia ou de texte
       étranger, pas de l'anglais fautif. Un plafond de sécurité serait un état partagé, donc une
       divergence possible entre les deux moteurs — on préfère la lenteur rare à la parité cassée. */
    let e2s = _E2.get(low);
    if(!e2s){
      e2s = [];
      for(const a of edits1(low)) for(const b of edits1(a))
        if(lex.KNOWN.has(b) && /^[a-z]+$/.test(b) && (lex.FREQ.get(b)||0) >= 1) e2s.push(b);
      if(_E2.size > 4000) _E2.clear();                 // borne mémoire, pas une politique de cache
      _E2.set(low, e2s);
    }
    for(const b of e2s) cands.set(b, 0.5);
  }
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
  /* GLISSEMENT MOTEUR — port de la règle française (miroir speller_en_probe.py).
     Quand le lexique n'offre qu'UN SEUL candidat ET que l'écart n'est qu'un ORDRE de lettres ou un
     REDOUBLEMENT, le mot visé n'est pas en doute : un doigt a glissé. On affirme, SANS exiger la
     dominance de fréquence ci-dessus — c'est justement ce que cette règle apporte, puisque les
     mots concernés sont souvent longs et peu fréquents (advertisemnets, carbohydarte, preferrences).
     Le REDOUBLEMENT était complètement absent de l'anglais, qui ne connaissait que `transp`, alors
     que c'est la faute la plus courante de la langue (occuring, comunities, stressfull, filmaking).
     MESURÉ sur JFLEG (1 501 phrases d'apprenants, 4 références) : 16 corrections promues au rouge,
     14 confirmées par au moins une référence ; les 2 autres (talkkative→talkative, bycicle→bicycle)
     sont visiblement justes, les annotateurs ont reformulé.
     FP sur le banc officiel (10 137 phrases ÉDITÉES, PUD + genres édités de GUM) : **1 seul tir
     ajouté, irregardles→irregardless, une vraie faute** ⇒ FP = 0.
     ⚠️ LIMITE CONNUE ET MESURÉE : hors banc officiel, « saltiness » → « saltines ». Ce n'est PAS la
     règle qui fautive, c'est le LEXIQUE : « saltiness » y est absent (comme « juiciness »). La
     dérivation mécanique -y→-iness a été essayée et RÉFUTÉE : la marque ADJ de kaikki est polluée
     (money, today, turkey, honey sont ADJ) et on fabriquerait « moneiness », « turkeiness ». Ça
     relève du chantier de complétude lexicale, pas d'un correctif ici. */
  const _dbl = (a, b) => { if(Math.abs(a.length - b.length) !== 1) return false;
    const L = a.length > b.length ? a : b, S = a.length > b.length ? b : a;
    for(let k = 0; k < L.length; k++) if(L.slice(0, k) + L.slice(k + 1) === S && (L[k] === L[k - 1] || L[k] === L[k + 1])) return true;
    return false; };
  if(cands.size === 1 && low.length >= 4 && (transp || _dbl(low, best))) return [best, 'AUTO'];
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
  /* ⚠️ LES PARENTHÈSES AUSSI. 132 entrées notent une accentuation facultative en tête :
     « amen = (ˌ)ɑːˈmɛn ». Sans les retirer, le premier « son » lu est « ( », donc jamais une
     voyelle : le mot était silencieusement classé comme commençant par une consonne. Inoffensif
     tant qu'on ne faisait que a->an (on ratait), dangereux dès qu'on fait an->a (on affirme). */
  ip = ip.replace(/^[\/\[\]()ˈˌˑ.\s]+/, '');
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
  /* ⭐ LA DIRECTION INVERSE — « an user » -> « a ». Elle avait été abandonnée ; elle est REPRISE
     parce que les gardes qui manquaient alors existent maintenant (adjacence réelle, exclusion des
     majuscules). REMESURÉ sur 15 353 phrases d'anglais édité (GUM + PUD) : **1 déclenchement**, et
     c'est une vraie faute du corpus (« where an voluntary iodisation »). Soit FP=0.

     C'est le miroir exact de la règle du dessus, et c'est la faute d'école : on applique « an devant
     une voyelle » à la LETTRE au lieu du SON. « an user », « an useful », « an unicorn », « an one »
     s'écrivent avec une voyelle et se prononcent avec une consonne (/j/, /w/). L'IPA tranche seule ;
     symétriquement, « an hour » et « an honest » restent muets parce que leur IPA commence par une
     voyelle. Aucune liste d'exceptions n'est nécessaire.

     ⚠️ SAUF LA CLASSE « h- » ASPIRÉ, exclue exprès. « an historic », « an hotel », « an herb » sont
     un usage BRITANNIQUE admis, pas une faute : signaler du registre en ROUGE serait faux. Or c'est
     précisément et uniquement le h- aspiré qui est en jeu — « an hour »/« an honest » ont un h muet,
     donc une IPA vocalique, donc ils ne passaient déjà pas par ici. L'exclusion est chirurgicale.

     RAPPEL : JFLEG contient 3 cas où l'annotateur remplace « an X » par « a X ». La règle les
     attrape TOUS LES TROIS (3/3).
     ⚠️ Un premier passage avait conclu « 0 cas, rappel non prouvé » : la sonde cherchait les
     fichiers dans `jfleg/dev/dev.src` alors qu'ils sont à plat dans `jfleg/dev.src`, et lisait
     donc le vide. Un corpus muet et un corpus absent rendent le même chiffre — vérifier qu'un
     banc a bien été LU avant de conclure qu'il ne dit rien. */
  if(lw === 'an' && (w === 'an' || i === 0)
      && /^\p{L}+$/u.test(nxRaw) && nxRaw === nxRaw.toLowerCase() && nxRaw !== nxRaw.toUpperCase()
      && !/^h/.test(nx)                                   // registre britannique, pas une faute
      && vowelStart(lex, nx) === false                    // null (mot hors IPA) => on s'abstient
      && (!adj || adj.has(i)))
    return ['a', 'RED'];
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
    /* ⚠️ LE TAGGER TRANCHE, PAS LE LEXIQUE. La 1ʳᵉ version ajoutait « || isNoun(lex, suiv) » en
       ceinture-et-bretelles — mais kaikki donne une lecture NOMINALE à presque tout, y compris à
       « in » (« the ins and outs »). Résultat : « many student in my class » s'abstenait, parce que
       le lexique voyait un nom là où le tagger voit une préposition. La ceinture bloquait la règle.
       C'est le principe posé partout ici : sur l'anglais, le mur est le CONTEXTE. */
    if(ctxPos(T, i + 1) === 'NOUN' || ctxPos(T, i + 1) === 'PROPN') return [null, null];
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

/* ⭐ ACCORD DU VERBE À LA 3ᵉ PERSONNE — « he go » -> goes · « they goes » -> go.
   Mesuré sur JFLEG : LanguageTool l'attrape (HE_VERB_AGR), nous non. C'est la famille qui restait
   la plus décidable : avec un sujet PRONOMINAL, la personne et le nombre sont LEXICAUX — pas
   besoin de la tête d'un groupe nominal, le mur où trois familles ont déjà échoué.

   ⚠️ SUJETS PRONOMINAUX SEULEMENT, et ni « this/that » ni « these/those » : comme relatifs ils
   héritent du nombre de leur ANTÉCÉDENT (leçon payée sur l'accord de BE, où les y laisser avait
   fait passer les rouges de 5 à 60).

   ⚠️ LES GARDES, CHACUNE POUR UN CAS RÉEL :
   ① SUBJONCTIF — « I suggest he go », « we demand she leave » : la base est CORRECTE et soignée.
      Déclencheur (suggest/demand/insist/recommend/propose/require/ask/essential/important) à
      gauche -> abstention. Même garde que pour le subjonctif de BE.
   ② MODAUX et « to » — « he can go », « to go » : le mot à gauche du verbe n'est alors PAS le
      pronom, donc le patron ne s'applique pas de lui-même. On n'ajoute rien.
   ③ NÉGATION CONTRACTÉE — « he doesn't go » : `n't` s'intercale, même raison.
   ④ Le tagger doit dire VERB. `go`, `study`, `watch` sont aussi des NOMS — c'est le CONTEXTE qui
      tranche, jamais l'appartenance lexicale (le mur anglais).
   ⑤ Les deux formes doivent être CONNUES et la forme proposée ATTESTÉE (freq >= 10).

   ⚠️ ORANGE, pas rouge : on n'a pas encore de scan qui prouve le FP=0 sur cette famille, et la
   doctrine dit que le doute se signale plutôt qu'il ne tranche. */
const _V3_SG = new Set(['he','she','it','someone','somebody','everyone','everybody','nobody',
                        'anyone','anybody','something','nothing','everything']);
const _V3_PL = new Set(['they','we','you','i']);
const _V3_SUBJ = new Set(['suggest','suggests','suggested','demand','demands','demanded','insist',
  'insists','insisted','recommend','recommends','recommended','propose','proposes','proposed',
  'require','requires','required','ask','asks','asked','requiring','suggesting','demanding','insisting','recommending','proposing','asking','essential','important','vital','necessary',
  'lest','if','unless','whether','wish','wishes','wished']);
// Ne JAMAIS toucher : auxiliaires et modaux ont leur propre régime, et « be » est traité ailleurs.
const _V3_STOP = new Set(['be','is','are','was','were','been','being','am','have','has','had',
  'do','does','did','can','could','will','would','shall','should','may','might','must','ought','need','dare']);

/* ⚠️⚠️ LE PASSÉ — trouvé en LISANT les 72 signalements sur texte édité, pas en relisant le code.
   La quasi-totalité étaient `he met`->mets · `he saw`->saws · `he left`->lefts · `she spoke`->spokes
   · `it cost`->costs · `he thought`->thoughts. Ce sont des PRÉTÉRITS, et **un prétérit ne prend pas
   de -s** : « he met » est parfaitement correct. La règle ne regardait que la PERSONNE, jamais le
   TEMPS. C'est le genre de trou qu'aucune batterie de cas inventés n'aurait montré, parce qu'on
   écrit spontanément ses tests au présent.
   TROIS SOURCES pour l'écarter : les formes irrégulières de `verbmorph_en.json` (ses VALEURS sont
   les prétérits et participes), le suffixe -ed, et la liste fermée des verbes INVARIANTS dont la
   base EST le prétérit (set/cost/put/cut…), pour lesquels on ne peut pas trancher -> abstention. */
const _V3_INVAR = new Set(['set','cost','put','cut','hit','let','shut','spread','hurt','burst',
  'cast','quit','bet','split','shed','rid','thrust','upset','broadcast','forecast','offset','preset',
  'read','beat','bid','wed']);
function _v3Passe(lex, w){
  if(/ed$/.test(w)) return true;
  if(_V3_INVAR.has(w)) return true;
  if(!lex._V3PAST){
    const s = new Set(), V = lex.VERBMORPH || {};
    for(const k of Object.keys(V)){ const v = V[k]; if(Array.isArray(v)) v.forEach(x => x && s.add(String(x).toLowerCase())); }
    // Irréguliers très fréquents que `verbmorph` (795 entrées, orienté sur-régularisation) ne couvre pas.
    ['met','saw','left','spoke','thought','drove','went','took','made','came','said','got','knew',
     'found','told','became','felt','brought','began','kept','held','wrote','stood','heard','led',
     'ran','paid','sat','spent','grew','lost','sent','built','fell','won','taught','caught','bought',
     'sold','flew','chose','rose','drew','broke','wore','tore','swore','bore','gave','ate','saw',
     'lay','laid','shook','struck','stuck','hung','dug','swam','sang','rang','drank','sank','began'
    ].forEach(x => s.add(x));
    lex._V3PAST = s;
  }
  return lex._V3PAST.has(w);
}

function _v3sg(lex, base){
  if(/(s|x|z|ch|sh|o)$/.test(base)) return base + 'es';
  if(/[^aeiou]y$/.test(base))       return base.slice(0, -1) + 'ies';
  return base + 's';
}

function verb3Decide(lex, T, i, adj){
  const w = String(T[i] || '');
  if(i < 1 || w !== w.toLowerCase()) return [null, null];
  const lw = w.toLowerCase();
  if(_V3_STOP.has(lw)) return [null, null];                          // auxiliaires/modaux : hors sujet
  if(adj && !adj.has(i - 1)) return [null, null];                    // adjacence RÉELLE
  const s = String(T[i - 1] || '').toLowerCase();
  const sg = _V3_SG.has(s), pl = _V3_PL.has(s);
  if(!sg && !pl) return [null, null];                                // sujet non pronominal -> abstention
  if(ctxPos(T, i) !== 'VERB') return [null, null];                   // ④ le tagger tranche
  for(let j = i - 2; j >= 0 && j >= i - 6; j--)                      // ① subjonctif
    if(_V3_SUBJ.has(String(T[j] || '').toLowerCase())) return [null, null];
  if(_v3Passe(lex, lw)) return [null, null];                         // PRÉTÉRIT : pas de -s
  /* ⚠️ DEUX AUTRES FAMILLES LUES DANS LE RÉSIDU (35 signalements sur texte édité) :
     ⑥ `like` — 7 des 35. « took it like a man », « something like that » : c'est une PRÉPOSITION,
        que le tagger lit VERB. Mot unique, écarté nommément plutôt que par une heuristique floue.
     ⑦ MODAL/AUXILIAIRE AVANT LE PRONOM — « how long will it take », « let it go », « did it work ».
        Le sujet est alors ENTRE l'auxiliaire et le verbe (inversion interrogative), ou le verbe est
        à l'infinitif nu après let/make/help/see/hear/watch. Dans les deux cas la BASE est correcte.
        Le patron « pronom + verbe » est vrai en surface et faux en structure : il faut regarder
        UN CRAN PLUS À GAUCHE. */
  if(lw === 'like') return [null, null];                             // ⑥ préposition lue VERB
  /* ⑧ GÉRONDIF / PARTICIPE PRÉSENT — « Everyone going to floor ten », « everyone leaving ».
     Une forme en -ing n'est jamais un présent conjugué : elle ne prend PAS de -s. */
  if(/ing$/.test(lw)) return [null, null];
  /* ⑨ LE PRONOM N'EST PAS LE SUJET — trois des cinq derniers signalements venaient de là :
        « the occupants of it rise » · « heard of it suppose » · « left it chock full ».
        Le pronom y est COMPLÉMENT (objet d'une préposition ou d'un verbe), et le vrai sujet est
        ailleurs, souvent au pluriel. Le patron « pronom + verbe » est vrai en surface, faux en
        structure. Même discriminateur que celui déjà connu pour was->were.
        ⚠️ C'est la garde la plus COÛTEUSE en rappel : on renonce à tout sujet précédé d'un verbe
        ou d'une préposition. On l'assume — un rouge faux coûte plus qu'un rappel manqué. */
  if(i >= 2){
    const p2 = ctxPos(T, i - 2);
    if(p2 === 'ADP' || p2 === 'VERB') return [null, null];
  }
  if(i >= 2){                                                        // ⑦ inversion / infinitif nu
    const av = String(T[i - 2] || '').toLowerCase().replace(/[’ʼ]/g, "'");
    /* ⚠️ LES NÉGATIONS CONTRACTÉES comptent comme auxiliaires — « Doesn't it make… »,
       « Wouldn't it want… » sont des INVERSIONS interrogatives, donc la base est correcte.
       Le tokeniseur réparé rend `doesn't` en UN token, il fallait donc les lister explicitement :
       la liste `_V3_STOP` ne connaissait que `does`, pas `doesn't`. */
    if(_V3_STOP.has(av) || /^(?:do|does|did|is|are|was|were|has|have|had|can|could|will|would|shall|should|must|might|ai)n't$/.test(av))
      return [null, null];
    /* Infinitif NU après un verbe de perception ou de causation : « I felt somebody touch me ».
       `feel/felt` manquait — trouvé en lisant le résidu, comme les autres. */
    if(['let','lets','make','makes','made','help','helps','helped','see','sees','saw','seen',
        'hear','hears','heard','watch','watches','watched','feel','feels','felt','notice',
        'notices','noticed','have','has','had'].includes(av)) return [null, null];
  }
  if(sg){                                                            // « he go » -> goes
    const f = _v3sg(lex, lw);
    if(f === lw || !lex.KNOWN.has(f) || (lex.FREQ.get(f) || 0) < 10) return [null, null];
    if(!lex.KNOWN.has(lw)) return [null, null];
    // si le mot EST déjà une 3ᵉ personne, rien à faire (« he goes »)
    if(/(?:es|s)$/.test(lw) && lex.KNOWN.has(lw.replace(/(?:es|s)$/, ''))) return [null, null];
    return [f, 'RED'];
  }
  // « they goes » -> go : on ne défait QUE si la base existe et que la forme est bien un -s de verbe
  if(!/(?:ies|es|s)$/.test(lw)) return [null, null];
  let base = /ies$/.test(lw) ? lw.slice(0, -3) + 'y'
           : (/(?:ses|xes|zes|ches|shes|oes)$/.test(lw) ? lw.slice(0, -2) : lw.slice(0, -1));
  if(!lex.KNOWN.has(base) || (lex.FREQ.get(base) || 0) < 10) return [null, null];
  if(_v3sg(lex, base) !== lw) return [null, null];                   // aller-retour cohérent
  return [base, 'RED'];
}

/* ⭐ FORME INTERROGATIVE — « Does he goes ? » -> go · « Did he went ? » -> go · « Do he go ? » -> Does.
   Rem : « t'as tous les temps et leur forme interrogative ? ». Non — et pire, la garde ⑦ de
   `verb3Decide` s'ABSTIENT dès qu'un auxiliaire précède le pronom (pour ne pas casser sur
   « how long will it take »). L'interrogatif n'était donc pas raté par accident : la porte avait
   été fermée. On la rouvre ici, avec un patron PROPRE.

   POURQUOI C'EST PLUS FACILE QUE LE RESTE : la structure est FERMÉE — auxiliaire + pronom + verbe.
   Pas de mur du sujet, pas de tête de groupe nominal à trouver : le sujet est le pronom, il est
   entre les deux, et sa personne est lexicale. C'est le cas le plus décidable de la conjugaison.

   ⭐⭐ PRÉCISION GAGNÉE PAR UNE RÉFUTATION (2026-08-09) — « FERMÉE » NE VEUT PAS DIRE « APRÈS UN
   AUXILIAIRE ». Ce qui ferme une structure, c'est que l'auxiliaire CONTRAINE LA CATÉGORIE de ce
   qui suit : `do/does/did` imposent la base verbale, `have` impose le participe. On peut donc
   affirmer sans rien savoir du sens.
   **`be` NE CONTRAINT RIEN** : il accepte un adjectif (`is open`), un nom (`is water`), un groupe
   prépositionnel (`is in bed`), un participe, un gérondif. Son complément est l'un des créneaux
   les plus OUVERTS de l'anglais — l'exact contraire des trois autres.
   Mesuré en voulant écrire « be + forme nue du verbe -> participe » (`he is concern` -> concerned) :
   492 FP sur texte édité, ramenés à 100 par le tagger puis à 39 en s'abstenant sur toute lecture
   adjectivale… et sur JFLEG, **21 des 35 déclenchements sont des phrases que l'annotateur N'A PAS
   TOUCHÉES** (précision 8/35 = 23 %, direction elle-même partagée : 8 en -ed contre 2 en -ing).
   ⛔ NE PAS RETENTER. C'est la même racine que l'échec de la copule (`they is happy`) : le problème
   n'est jamais `be` lui-même, c'est que son complément est ouvert.

   DEUX DIRECTIONS, toutes deux sans ambiguïté :
   ① APRÈS do/does/did, LE VERBE EST À LA BASE. « Does he goes » et « Did he went » sont faux quel
      que soit le contexte — l'auxiliaire porte déjà le temps et la personne.
   ② L'AUXILIAIRE S'ACCORDE avec le pronom : « Do he go » -> Does · « Does they go » -> Do.
      (`did` est invariable, on n'y touche jamais.)

   ⚠️ GARDES : le pronom doit être un vrai pronom SUJET ; l'emphatique déclaratif « He does go »
   ne matche pas (l'ordre y est pronom+auxiliaire) ; et on exige l'adjacence RÉELLE des trois
   tokens, sinon « does he really goes » et « do the dishes » entreraient à tort. */
const _Q_AUX = new Set(['do', 'does', 'did']);
const _Q_SG  = new Set(['he', 'she', 'it']);
const _Q_PL  = new Set(['i', 'you', 'we', 'they']);

function interroDecide(lex, T, i, adj){
  const w = String(T[i] || ''), lw = w.toLowerCase();
  // ---- ② l'AUXILIAIRE lui-même : do/does mal accordé avec le pronom qui suit ----
  if(_Q_AUX.has(lw) && lw !== 'did' && i + 1 < T.length){
    if(adj && !adj.has(i)) return [null, null];
    /* ⚠️ IL FAUT UNE VRAIE QUESTION, PAS SEULEMENT « do » SUIVI D'UN PRONOM. Mesuré : la première
       version produisait 15 rouges sur texte édité, TOUS de la forme « do it » où `do` est le VERBE
       PRINCIPAL et `it` son OBJET — « to do the job », « how I do it », « can do it every day ».
       La structure interrogative exige deux choses de plus :
         · l'auxiliaire OUVRE la question — en tête de phrase, ou juste après un mot en wh- ;
         · un VERBE suit le pronom (« Do he go ? »), sinon le pronom est un objet.
       Sans ces deux conditions on lit une question là où il y a une proposition ordinaire. */
    const enTete = (i === 0) || /^[.!?;:]$/.test(String(T[i - 1] || ''));
    const apresWh = i >= 1 && ['why','how','where','when','what','who','whom','whose','which']
                      .includes(String(T[i - 1] || '').toLowerCase());
    if(!enTete && !apresWh) return [null, null];
    const s = String(T[i + 1] || '').toLowerCase();
    if(!_Q_SG.has(s) && !_Q_PL.has(s)) return [null, null];
    if(i + 2 >= T.length || ctxPos(T, i + 2) !== 'VERB') return [null, null];   // « Do he GO ? »
    if(_Q_SG.has(s) && lw === 'do')   return [_keepCaseEn(w, 'does'), 'RED'];
    if(_Q_PL.has(s) && lw === 'does') return [_keepCaseEn(w, 'do'), 'RED'];
    return [null, null];
  }
  /* ---- ③ INTERROGATIF avec BE et HAVE — « Are he going ? » -> Is · « Have he gone ? » -> Has ·
     « Were he going ? » -> Was · « Is they going ? » -> Are.
     Complète la couverture : do/does/did ne couvre que le présent et le prétérit simples ; le
     continu et le perfect s'interrogent en inversant BE ou HAVE. Mêmes deux conditions que pour
     do/does : l'auxiliaire OUVRE la question, et le mot après le pronom confirme le cadre
     (gérondif après BE, participe après HAVE). Sans elles on lirait « is it going to rain » comme
     une erreur, ou pire on toucherait à une copule. */
  if(i + 2 < T.length && ['is','are','was','were','have','has'].includes(lw)){
    const enTete2 = (i === 0) || /^[.!?;:]$/.test(String(T[i - 1] || ''));
    const apresWh2 = i >= 1 && ['why','how','where','when','what','who','whom','whose','which']
                       .includes(String(T[i - 1] || '').toLowerCase());
    if((enTete2 || apresWh2) && (!adj || (adj.has(i) && adj.has(i + 1)))){
      const s2 = String(T[i + 1] || '').toLowerCase();
      const nx2 = String(T[i + 2] || '').toLowerCase();
      const sg2 = _Q_SG.has(s2), pl2 = _Q_PL.has(s2);
      const beQ = ['is','are','was','were'].includes(lw), hvQ = !beQ;
      const cadreOk = beQ ? (/ing$/.test(nx2) && nx2.length >= 5)
                          : (nx2 === 'been' || /(?:ed|en)$/.test(nx2) || _v3Passe(lex, nx2));
      if((sg2 || pl2) && cadreOk && !(pl2 && s2 === 'i')){
        const bon = hvQ ? (sg2 ? 'has' : 'have')
                        : (['was','were'].includes(lw) ? (sg2 ? 'was' : 'were') : (sg2 ? 'is' : 'are'));
        if(bon !== lw) return [_keepCaseEn(w, bon), 'RED'];
        return [null, null];
      }
    }
  }
  // ---- ① le VERBE après auxiliaire + pronom : doit être à la BASE ----
  if(i < 2) return [null, null];
  if(adj && (!adj.has(i - 1) || !adj.has(i - 2))) return [null, null];   // les 3 tokens collés
  const aux = String(T[i - 2] || '').toLowerCase();
  const pron = String(T[i - 1] || '').toLowerCase();
  if(!_Q_AUX.has(aux)) return [null, null];
  if(!_Q_SG.has(pron) && !_Q_PL.has(pron)) return [null, null];
  if(ctxPos(T, i) !== 'VERB') return [null, null];
  if(_V3_STOP.has(lw)) return [null, null];                              // « does he have » : laissé
  if(/ing$/.test(lw)) return [null, null];                               // « does he going » : autre faute
  // la base : soit on retire le -s de 3ᵉ personne, soit on remonte du prétérit
  let base = null;
  if(/(?:ies|es|s)$/.test(lw)){
    const b = /ies$/.test(lw) ? lw.slice(0, -3) + 'y'
            : (/(?:ses|xes|zes|ches|shes|oes)$/.test(lw) ? lw.slice(0, -2) : lw.slice(0, -1));
    if(lex.KNOWN.has(b) && _v3sg(lex, b) === lw) base = b;
  }
  if(!base && _v3Passe(lex, lw)){
    const V = lex.VERBMORPH || {};
    for(const k of Object.keys(V)){ const v = V[k];
      if(Array.isArray(v) && v.indexOf(lw) >= 0){ const b = k.replace(/ed$/, ''); if(lex.KNOWN.has(b)) { base = b; break; } } }
    if(!base && /ed$/.test(lw)){
      const b = lw.replace(/ied$/, 'y').replace(/ed$/, '');
      if(lex.KNOWN.has(b)) base = b;
    }
  }
  if(!base || base === lw || (lex.FREQ.get(base) || 0) < 10) return [null, null];
  return [_keepCaseEn(w, base), 'RED'];
}
function _keepCaseEn(src, cible){
  return (src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase())
    ? cible[0].toUpperCase() + cible.slice(1) : cible;
}

/* ⭐ ACCORD DE L'AUXILIAIRE — présent continu et present perfect.
   « he are going » -> is · « they is going » -> are · « he have gone » -> has · « she have been » -> has.

   POURQUOI CELLE-CI PASSE ALORS QUE L'ACCORD DE *BE* SEUL AVAIT ÉCHOUÉ. La tentative précédente
   (« they is happy ») marchait sur pronom mais avait un rappel NUL sur données réelles, et faisait
   exploser les rouges dès qu'on élargissait les sujets. Ici le cadre est plus étroit et donc plus
   sûr : **le mot qui SUIT désambiguïse**. Un gérondif après BE, un participe après HAVE — on est
   alors certain d'être dans une construction AUXILIAIRE, pas devant une copule ou un verbe plein.
   C'est le même principe que l'interrogatif : ce sont les structures FERMÉES qui sont décidables.

   ⚠️ SUJETS PRONOMINAUX SEULEMENT, et ni this/that ni these/those — comme relatifs ils héritent du
   nombre de leur antécédent. Leçon payée : les y laisser avait fait passer les rouges de 5 à 60.
   ⚠️ SUBJONCTIF et INVERSION gardés comme ailleurs ; et si une préposition ou un verbe précède le
   pronom, le pronom est un COMPLÉMENT et non le sujet (« the occupants of it… »). */
const _AUX_BE_SG = { is: 1 }, _AUX_BE_PL = { are: 1 };
function auxAgree(lex, T, i, adj){
  const w = String(T[i] || ''), lw = w.toLowerCase();
  /* PASSÉ CONTINU ajouté ici : « he were going » -> was · « they was going » -> were.
     Même cadre fermé que le présent continu — c'est le GÉRONDIF qui suit qui garantit qu'on est
     devant un auxiliaire et pas devant une copule (« they was happy » n'est PAS traité : sans
     gérondif on retombe sur l'accord de BE seul, qui a été mesuré et réfuté).
     ⚠️ Le subjonctif (« if he were going ») est déjà couvert par la garde `_V3_SUBJ` plus bas. */
  const estBE = (lw === 'is' || lw === 'are' || lw === 'was' || lw === 'were');
  const passe = (lw === 'was' || lw === 'were');
  const estHV = (lw === 'have' || lw === 'has');
  if(!estBE && !estHV) return [null, null];
  if(i < 1 || i + 1 >= T.length) return [null, null];
  if(adj && (!adj.has(i - 1) || !adj.has(i))) return [null, null];
  const s = String(T[i - 1] || '').toLowerCase();
  const sg = _V3_SG.has(s), pl = _V3_PL.has(s);
  if(!sg && !pl) return [null, null];
  if(pl && s === 'i' && estHV) return [null, null];                  // « I have » : correct, jamais « has »
  // le mot SUIVANT doit confirmer le cadre auxiliaire
  const nx = String(T[i + 1] || '').toLowerCase();
  if(estBE && !/ing$/.test(nx)) return [null, null];                 // présent continu seulement
  if(estHV && !(_v3Passe(lex, nx) || /(?:ed|en)$/.test(nx) || nx === 'been')) return [null, null];
  if(/ing$/.test(nx) && nx.length < 5) return [null, null];          // « thing », « king » : pas des gérondifs
  // le pronom doit être SUJET, pas complément (même discriminateur que verb3Decide)
  if(i >= 2){
    const p2 = ctxPos(T, i - 2);
    if(p2 === 'ADP' || p2 === 'VERB') return [null, null];
    const av = String(T[i - 2] || '').toLowerCase().replace(/[’ʼ]/g, "'");
    if(_V3_STOP.has(av) || /n't$/.test(av)) return [null, null];     // inversion : « does he have… »
  }
  for(let j = i - 2; j >= 0 && j >= i - 6; j--)                      // subjonctif
    if(_V3_SUBJ.has(String(T[j] || '').toLowerCase())) return [null, null];
  if(estBE){
    if(pl && s === 'i') return [null, null];                         // « I was » : correct
    const bon = passe ? (sg ? 'was' : 'were') : (sg ? 'is' : 'are');
    return lw === bon ? [null, null] : [_keepCaseEn(w, bon), 'RED'];
  }
  return sg ? (lw === 'has' ? [null, null] : [_keepCaseEn(w, 'has'), 'RED'])
            : (lw === 'have' ? [null, null] : [_keepCaseEn(w, 'have'), 'RED']);
}

/* ⭐ ARTICLE DEVANT UN INDÉNOMBRABLE — « a information » -> information · « an advice » -> advice.
   POURQUOI CE SOUS-CAS ET PAS LES ARTICLES EN GÉNÉRAL. Les articles sont la 2ᵉ famille la plus
   ratée de JFLEG (423), mais choisir `a` ou `the` demande la DÉFINITUDE — donc de savoir si le
   référent est déjà connu du lecteur, c'est-à-dire du DISCOURS. Structure ouverte : hors
   d'atteinte, et on n'essaie pas.
   MAIS un sous-ensemble est FERMÉ : `a/an` devant un nom indénombrable est faux QUEL QUE SOIT le
   contexte — « an information », « a advice », « a homework » n'existent pas, il n'y a rien à
   arbitrer. C'est le filtre qu'on s'est donné après 3 échecs et 5 réussites : agir là où la
   structure est fermée, s'abstenir ailleurs.
   ⚠️ LA CORRECTION EST LA SUPPRESSION DE L'ARTICLE, pas un remplacement — on rend donc le NOM SEUL
   comme suggestion sur l'article, et l'interface remplace « a information » par « information ».
   ⚠️ `_NUM_MASS` est réutilisée telle quelle : une seule liste pour deux règles, pas deux listes
   qui divergeront. */
/* ⚠️⚠️ DEUX LISTES, ET C'EST VOULU. `_NUM_MASS` sert à une règle qui S'ABSTIENT : elle peut donc
   être large, une abstention de trop ne coûte qu'un rappel. `_ART_MASS` sert à une règle qui AGIT :
   elle doit être ÉTROITE, une action de trop abîme la copie.
   Mesuré : réutiliser `_NUM_MASS` telle quelle produisait 53 rouges, dont **34 sur `time` seul**
   (« a long time », « a good time » sont corrects) puis health/air/education/work/experience/water
   — tous DÉNOMBRABLES dans un sens courant. On ne garde ici que ce qui n'est JAMAIS précédé de
   a/an en anglais moderne.
   ⭐ RÈGLE GÉNÉRALE À RETENIR : **une liste d'abstention et une liste d'action ne sont pas la même
   liste**, même quand elles portent le même nom de concept. */
const _ART_MASS = new Set(['information','advice','homework','housework','luggage','baggage',
  'equipment','furniture','evidence','traffic','weather','progress','pollution','vocabulary',
  'feedback','software','hardware','machinery','jewellery','jewelry','stationery','cutlery',
  'scenery','accommodation','money','knowledge','laughter','applause','courage','patience',
  'permission','proof','publicity','rubbish','garbage','safety','shopping','sunshine','thunder',
  'violence','wealth','wisdom','clothing','nonsense','fun']);

function articleMassDecide(lex, T, i, adj, hyph){
  const w = String(T[i] || ''), lw = w.toLowerCase();
  if(lw !== 'a' && lw !== 'an') return [null, null];
  if(i + 1 >= T.length) return [null, null];
  if(adj && !adj.has(i)) return [null, null];
  // On saute les adjectifs : « a useful information » est fautif de la même façon.
  let j = i + 1, saut = 0;
  while(j < T.length && saut < 3 && ctxPos(T, j) === 'ADJ'){ if(adj && !adj.has(j - 1)) return [null, null]; j++; saut++; }
  if(j >= T.length) return [null, null];
  const nom = String(T[j] || '').toLowerCase();
  if(!_ART_MASS.has(nom)) return [null, null];
  /* ⚠️ TRAIT D'UNION — « a knowledge-based economy » : le tokeniseur coupe sur le tiret, donc
      +  ressemble à un article devant un indénombrable. Or  est un
     ADJECTIF composé et la tête est . C'était le DERNIER faux positif de cette règle.
     3ᵉ fois que ce masque sauve une règle : à brancher SYSTÉMATIQUEMENT sur toute règle de contexte. */
  if(hyph && hyph.has(j)) return [null, null];
  if(ctxPos(T, j) !== 'NOUN') return [null, null];
  /* ⚠️ CONTRÔLE DE TÊTE — « a health issue », « a research paper », « a work permit » sont
     CORRECTS : l'indénombrable y est MODIFIEUR, et la tête est le nom qui suit (qui, lui, est
     dénombrable). Même piège que pour l'accord en nombre, et même remède : si un nom suit,
     on s'abstient. C'était 8 des 53 rouges du premier jet. */
  if(j + 1 < T.length && (ctxPos(T, j + 1) === 'NOUN' || ctxPos(T, j + 1) === 'PROPN'))
    return [null, null];   // le TAGGER tranche, pas le lexique — même correctif que numberDecide
  /* ⚠️ EXCEPTION RÉELLE : un indénombrable REDEVIENT dénombrable quand il est qualifié en « unité »
     — « a piece of advice », « a work of art », « a time to remember ». Le signal est le « of »
     qui suit, ou une relative. On s'abstient dans ce cas plutôt que de trancher. */
  if(j + 1 < T.length && String(T[j + 1] || '').toLowerCase() === 'of') return [null, null];
  return [String(T[j]), 'RED'];
}

/* ⭐⭐ TYPOGRAPHIE DE LA PONCTUATION — la couche portée du FRANÇAIS, et l'anglais y est PLUS SIMPLE.
   Rem : « le trait d'union, peut faire un tour sur la ponctuation, on a bossé le sujet en français,
   regarder ce qu'on peut piquer ».

   CE QU'ON PIQUE, ET POURQUOI C'EST LÉGITIME DE LE FAIRE ICI ALORS QUE LA VIRGULE SYNTAXIQUE NON.
   Côté français on a mesuré la frontière : « OÙ faut-il une virgule » est un JUGEMENT (51,98 % de
   justesse sur 11 304 phrases humaines — aucun réglage n'en fera du FP=0), tandis que « l'espace
   autour de la virgule QUI EST LÀ est-il bien placé » est MÉCANIQUE : décidable sur la chaîne
   seule, sans grammaire ni contexte. C'est la seule couche de ponctuation qui atteint FP=0, et
   elle l'atteint. La frontière se transpose telle quelle.

   ⭐ ET L'ANGLAIS EST PLUS FACILE QUE LE FRANÇAIS ICI. Le français exige une espace AVANT « ; : ! ? »
   et les usages divergent (France/Québec), donc la règle FR se limite à « , » et « . ».
   L'anglais n'en met JAMAIS avant AUCUNE marque : la règle peut donc couvrir , . ; : ! ? d'un coup.
   C'est un cas rare où la version anglaise est plus LARGE que l'originale française.

   ⚠️ LES GARDES, toutes tirées de l'expérience française :
   · les NOMBRES : « 1 . 5 », « 3 , 000 » ne sont pas de la ponctuation de phrase ;
   · les POINTS DE SUSPENSION et les abréviations « e.g. », « U.S. » ;
   · les URL, via `urlMask` en amont dans l'appelant.
   ⚠️ On ne rend QUE des remplacements de chaîne (cs/ce), jamais un mot : cette couche ne connaît
   pas les tokens, elle travaille sur le TEXTE. */
function typoScanEn(text){
  const out = [];
  let m;
  // ① ESPACE AVANT UNE PONCTUATION — jamais en anglais, quelle que soit la marque.
  const re1 = /([A-Za-z0-9\)\]"'])[ \t]+([,.;:!?])(?![.\d])/g;
  while((m = re1.exec(text))){
    out.push({ cs: m.index, ce: m.index + m[0].length, from: m[0], sugg: m[1] + m[2],
               name: 'space before punctuation', tier: 'red' });
  }
  // ② ESPACE MANQUANTE APRÈS — « word,word ». On exige une LETTRE des deux côtés : « 3,000 » et
  //    « e.g. » sont ainsi épargnés sans liste d'exceptions.
  const re2 = /([A-Za-z]{2,})([,;:])([a-z]{2,})/g;
  while((m = re2.exec(text))){
    if(/^(?:e|i|etc|vs|ie|eg)$/i.test(m[1])) continue;
    // « JPC:dn » — en-tête de lettre (initiales de dactylographie). Un SIGLE tout en majuscules
    // à gauche n'est pas un mot ordinaire : on s'abstient. Trouvé sur texte édité.
    if(m[1] === m[1].toUpperCase()) continue;
    out.push({ cs: m.index, ce: m.index + m[0].length, from: m[0], sugg: m[1] + m[2] + ' ' + m[3],
               name: 'missing space after punctuation', tier: 'red' });
  }
  /* ③ MARQUE DOUBLÉE — « ,, » « ;; » « :: » : impossible en anglais écrit.
     ⚠️ « ! » et « ? » sont EXCLUS : « Yeah!!! », « What??? », « ?! » sont de l'EMPHASE légitime et
     très courante, pas des fautes. Mesuré : c'étaient les 2 seuls faux positifs de cette couche
     sur 10 137 phrases éditées. Le français n'avait pas ce cas parce qu'il ne traitait que « , ». */
  const re3 = /([,;:])\1+/g;
  while((m = re3.exec(text))){
    out.push({ cs: m.index, ce: m.index + m[0].length, from: m[0], sugg: m[1],
               name: 'doubled punctuation', tier: 'red' });
  }
  // ④ DOUBLE ESPACE entre deux mots. (Après un point, la double espace est un usage typographique
  //    ancien mais LÉGITIME — on ne la touche pas, on ne corrige qu'entre deux lettres.)
  const re4 = /([A-Za-z,;:])[ ]{2,}([A-Za-z])/g;
  while((m = re4.exec(text))){
    out.push({ cs: m.index, ce: m.index + m[0].length, from: m[0], sugg: m[1] + ' ' + m[2],
               name: 'double space', tier: 'red' });
  }
  /* ⑤ ESPACE MANQUANTE APRÈS UN POINT — « dollars.Then ». La règle ② ne couvrait que « , ; : » ;
     le POINT est le cas le plus fréquent à la frappe et il manquait. Il est aussi le plus PIÉGÉ :
     domaines, adresses e-mail, noms de fichiers, sigles et décimales sont tous « mot.mot ».

     ⭐ CE QUI TRANCHE, C'EST LA MAJUSCULE — et c'est mesuré, pas supposé. Sur 15 353 phrases
     d'anglais ÉDITÉ (GUM + PUD), où tout déclenchement est par construction un faux positif :
       – variante MAJUSCULE après le point  ->  **0 FP**
       – variante minuscule après le point  ->  48 FP, dont 100 % des URLs et e-mails
         (« gmail.com », « thierry.poibeau@ens.fr », « www.wikihow.com »)
     La minuscule est donc RÉFUTÉE : on ne la livre pas, même masquée, parce que « node.js » et
     « file.txt » resteraient. La majuscule après un point ne se produit pas dans une adresse.

     Les bornes font le reste : ≥2 lettres à gauche épargne les initiales (« J.Smith », « U.S.Army »)
     et ≥3 après la majuscule épargne les sigles pointés (« Ph.D »). */
  const re5 = /([A-Za-z]{2,})\.([A-Z][a-z]{2,})/g;
  while((m = re5.exec(text))){
    out.push({ cs: m.index, ce: m.index + m[0].length, from: m[0], sugg: m[1] + '. ' + m[2],
               name: 'missing space after period', tier: 'red' });
  }
  /* ⚠️ PLAGES QUI SE CHEVAUCHENT — sinon on CORROMPT le texte au lieu de le réparer.
     Chaque règle capture le contexte autour de la marque, donc deux règles voisines peuvent se
     recouvrir : « ab,cd.Ef » -> ② prend « ab,cd » [0,5[ et ⑤ prend « cd.Ef » [3,8[. Qui applique
     ces deux remplacements sur la même chaîne perd des caractères, quel que soit l'ordre.
     On ne garde donc qu'une plage par zone (la plus à gauche). Ce n'est pas une perte : l'autre
     faute redevient visible au passage suivant, une fois la première réparée — c'est précisément
     ce que fait la boucle d'application. */
  out.sort((a, b) => a.cs - b.cs || a.ce - b.ce);
  const propres = [];
  for(const t of out) if(!propres.length || t.cs >= propres[propres.length - 1].ce) propres.push(t);
  return propres;
}

/* ⭐ CONFUSABLES PAR CRÉNEAU — « I can here you » -> hear · « to allowed » -> aloud…
   88 des 111 groupes curés n'ont AUCUNE règle : ils délimitent un périmètre et ne signalent rien.
   Les écrire un par un serait 88 fois le même travail ; on cherche donc UNE règle qui en couvre
   beaucoup, et le filtre « structure fermée » dit laquelle.

   POURQUOI PAS LA SÉPARABILITÉ LEXICALE. Mesuré : avec le critère strict « aucune classe partagée »,
   seuls **7 groupes sur 88** passent. La raison est connue — kaikki SUR-VERBIFIE, presque tout nom
   anglais a aussi une lecture VERB, donc les ensembles de classes se recouvrent presque toujours.
   Le lexique ne sépare pas.

   ⭐ CE QUI SÉPARE, C'EST LE CRÉNEAU. Après « to », « can », « will », « must », le contexte OUVRE
   une place de VERBE. Si le mot écrit n'a AUCUNE lecture verbale et qu'exactement UN de ses
   confusables en a une, la substitution est forcée — sans sémantique, sans savoir de quoi on parle.
   Mesuré : l'axe VERBE discrimine **30 groupes sur 88** à lui seul (et 58 en cumulant tous les axes,
   piste ouverte pour la suite).
   C'est le même principe que l'interrogatif et les auxiliaires : on n'agit que là où la STRUCTURE
   décide à la place du sens.

   ⚠️ On n'utilise QUE les groupes SANS règle : ceux qui en ont une sont déjà traités, et deux
   couches sur le même mot se contrediraient. */
let _CONF_SLOT = null;
function buildConfuseSlot(lex, groupes){
  const m = new Map();
  for(const g of (groupes || [])){
    if(!g || g.regle || !Array.isArray(g.mots) || g.mots.length < 2) continue;
    for(const w of g.mots){
      const lw = String(w).toLowerCase();
      /* ⚠️ UN MODAL N'APPELLE PAS QUE DES VERBES. Mesuré : la 1ʳᵉ version exigeait seulement
         « pas de lecture VERB » et produisait 22 rouges — « can some of you », « to which »,
         « can very well », tous corrects. Après un modal on trouve aussi des ADVERBES
         (« can very well know »), des DÉTERMINANTS et des PRONOMS (« can some », « to which »).
         Le créneau n'est donc FORCÉ que si le mot écrit ne peut être RIEN de tout ça : on exige
         que ses seules lectures soient NOM ou ADJECTIF. C'est plus étroit, mais c'est la seule
         version où la structure décide vraiment à la place du sens. */
      const p = [...(lex.POS.get(lw) || [])];
      if(!p.length) continue;
      if(p.some(x => ['VERB','ADV','DET','PRON','ADP','CONJ','PREP','INTJ','NUM'].includes(x))) continue;
      const cibles = g.mots.filter(x => {
        const lx = String(x).toLowerCase();
        return lx !== lw && [...(lex.POS.get(lx) || [])].includes('VERB')
               && (lex.FREQ.get(lx) || 0) >= 10;
      });
      if(cibles.length === 1) m.set(lw, String(cibles[0]).toLowerCase());
    }
  }
  return m;
}
function confuseSlotDecide(lex, T, i, adj, hyph, groupes){
  if(!_CONF_SLOT) _CONF_SLOT = buildConfuseSlot(lex, groupes);
  const w = String(T[i] || '');
  if(i < 1 || w !== w.toLowerCase()) return [null, null];
  const cible = _CONF_SLOT.get(w.toLowerCase());
  if(!cible) return [null, null];
  if(adj && !adj.has(i - 1)) return [null, null];
  if(hyph && (hyph.has(i) || hyph.has(i - 1))) return [null, null];
  /* Le créneau doit être ouvert par un mot-outil qui appelle un VERBE, et par LUI SEUL —
     `VERB_SLOT_W` contient aussi des pronoms (« I », « they »), qui ouvrent bien un verbe mais
     dont le voisinage est trop lâche pour un rouge. On se limite aux modaux et à « to ». */
  const ouvre = new Set(['to','will','would','can','could','may','might','must','should','shall',
                         'let','please',"don't","doesn't","didn't",'cannot']);
  if(!ouvre.has(String(T[i - 1] || '').toLowerCase())) return [null, null];
  /* « to » est ambigu : préposition (« to school ») ou infinitif (« to hear »). On ne tranche que
     si le mot écrit ne peut PAS être un nom non plus — sinon « to here » pourrait être un lieu. */
  if(String(T[i - 1] || '').toLowerCase() === 'to'){
    const p = [...(lex.POS.get(w.toLowerCase()) || [])];
    if(p.includes('NOUN') || p.includes('PROPN')) return [null, null];
  }
  return [cible, 'RED'];
}

/* ⭐ VIGILANCE ORANGE SUR LES CONFUSABLES INDÉCIDABLES — l'application de la doctrine ORANGE.
   68 groupes restent hors d'atteinte du rouge parce que leurs membres partagent la même classe de
   mot (desert/dessert, discreet/discrete, complement/compliment) : les séparer demande le SENS.
   La doctrine dit quoi en faire — **doute -> orange, jamais silence**. Priver un dys d'un
   signalement parce qu'on ne sait pas trancher, c'est le laisser sans rien.

   ⚠️ MAIS L'ORANGE A UN PRIX, ET IL SE MESURE. Signaler TOUS les membres des 68 groupes donne
   **2,88 % de flood** — 4× le seuil toléré côté français (~0,70 %). Réfuté tel quel : les têtes
   sont des mots-outils très fréquents (which 497, one 468, so 430, our 422, would 377).

   ⭐ CE QUI SAUVE LA FAMILLE, C'EST L'ASYMÉTRIE. Dans une paire, celui qu'on écrit par erreur est
   presque toujours le RARE : on écrit `witch` en pensant `which`, pas l'inverse. On ne signale donc
   QUE le membre dont la fréquence est au plus la MOITIÉ du maximum de son groupe.
   BALAYAGE MESURÉ, et le genou est franc :
       r=1 -> 2,88 %  ·  **r=2 -> 0,17 %**  ·  r=5 -> 0,12 %  ·  r=10 -> 0,06 %
   Un facteur 17 gagné entre r=1 et r=2. On prend r=2 : le flood reste sous le seuil et on garde
   60 mots, là où r=10 n'en garderait plus que 35 pour 0,06 % — l'écart de flood ne vaut pas
   l'écart de couverture.
   C'est le même raisonnement que la curation par SÉPARABILITÉ de la liste, appliqué au signalement. */
const _CONF_VIG_R = 2;
let _CONF_VIG = null;
function buildConfuseVig(lex, groupes, dejaRouge){
  const m = new Map();
  for(const g of (groupes || [])){
    if(!g || g.regle || !Array.isArray(g.mots) || g.mots.length < 2) continue;
    const ms = g.mots.map(w => String(w).toLowerCase());
    if(ms.some(w => dejaRouge && dejaRouge.has(w))) continue;      // déjà traité en ROUGE ailleurs
    const fr = ms.map(w => lex.FREQ.get(w) || 0);
    const mx = Math.max.apply(null, fr);
    if(!mx) continue;
    ms.forEach((w, k) => {
      if(fr[k] * _CONF_VIG_R <= mx) m.set(w, ms.filter(x => x !== w));
    });
  }
  return m;
}
function confuseVigDecide(lex, T, i, adj, groupes){
  if(!_CONF_VIG){
    const rouge = buildConfuseSlot(lex, groupes);
    _CONF_VIG = buildConfuseVig(lex, groupes, new Set(rouge.keys()));
  }
  const w = String(T[i] || '');
  if(w !== w.toLowerCase()) return [null, null];                   // majuscule -> nom propre probable
  const part = _CONF_VIG.get(w.toLowerCase());
  if(!part) return [null, null];
  return [part.join(' / '), 'ORANGE'];
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
  const re = /[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’ʼ][A-Za-zÀ-ÖØ-öø-ÿ]+)*/g;   // MÊME motif que tokenize : sinon les index divergent
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
  const re = /[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’ʼ][A-Za-zÀ-ÖØ-öø-ÿ]+)*/g;   // MÊME motif que tokenize : sinon les index divergent
  let m, prevEnd = -1, i = -1;
  while((m = re.exec(text))){
    i++;
    if(prevEnd >= 0 && /^[-‐‑–]$/.test(text.slice(prevEnd, m.index))) h.add(i - 1);
    prevEnd = m.index + m[0].length;
  }
  return h;
}

/* ⚠️ LE TOKENISEUR COUPAIT DEUX CHOSES QU'IL NE DEVAIT PAS — trouvé en LISANT le flood orange,
   pas en relisant le code. Sur 373 signalements orange du speller (texte édité), les têtes de liste
   étaient `didn`(20) `isn`(11) `wasn`(5) `doesn`(4) `shouldn`(4) `couldn`(3) puis `rida`(10)
   `xico`(2) `nguez`(2) `rebro`(3) `fianc`(2). Ce ne sont pas des mots : ce sont des DÉBRIS.
   ① L'APOSTROPHE TYPOGRAPHIQUE ’ n'était pas acceptée — `didn’t` se coupait en `didn` + `t`, et
      les corpus édités (PUD, GUM) l'emploient partout. Exactement le même bug qu'en français, où
      il avait fait compter des corrections JUSTES comme des dégradations.
   ② LES LETTRES ACCENTUÉES cassaient le mot : `México` -> `M` + `xico`, `Domínguez` -> `Dom` +
      `nguez`, `fiancé` -> `fianc`. L'anglais n'a pas d'accents mais l'anglais ÉCRIT en est plein
      (noms propres, emprunts).
   Un débris est INCONNU du lexique, donc il déclenche un orange — le flood était surtout ça, pas
   un manque de vocabulaire. ⚠️ ON NE GROSSIT PAS LE LEXIQUE POUR MASQUER UN BUG DE DÉCOUPAGE. */
function tokenize(text){ return text.match(/[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’ʼ][A-Za-zÀ-ÖØ-öø-ÿ]+)*/g) || []; }

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
  const re = /[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’ʼ][A-Za-zÀ-ÖØ-öø-ÿ]+)*/g;   // MÊME motif que tokenize : sinon les index divergent
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

/* ---------- CONTRACTIONS SANS APOSTROPHE (chantier REGLES_EN n°1, 2026-08-12) ----------
   L'apostrophe est INAUDIBLE : le dys écrit ce qu'il entend — « dont », « im », « its », « cant ».
   AVANT cette règle, le moteur rendait le SILENCE (theyre, im, thats, arent : kaikki contient les
   graphies eye-dialect, le speller les croit correctes) ou une FAUSSE DIRECTION (dont→don,
   youre→your, ive→give, isnt→ist). Mesuré (proto, chaque tir LU) : 3 tirs sur 15 353 phrases
   ÉDITÉES (PUD+GUM), TOUS de vraies fautes (youll ×2, « Theres [sic] » — le corpus se marque
   lui-même) ; rappel indicatif EWT (web) : 119, échantillon relu = 100 % de vraies fautes.
   Deux régimes :
   · ROUGE DIRECT : formes JAMAIS correctes en anglais édité (non-mots ET eye-dialect) ;
   · CONTEXTE ÉTROIT : homographes réels — cant/wont + verbe BASE (« thieves' cant is » exclu par
     la liste d'aux fléchis), its + {a an the been being not} (« its very nature », « its loading
     environment » ont tué very et -ing au proto), lets en TÊTE + verbe (« she lets him play »).
   EXCLUS v1, documenté REGLES_EN.md : were(=we're), hes, shes, id, ill, shell, hell, shed, wed —
   homographes massifs, le contexte sûr n'existe pas encore. URL protégées par urlMask EN AMONT. */
var _CONTR_RED = { isnt: "isn't", wasnt: "wasn't", werent: "weren't", dont: "don't", doesnt: "doesn't",
  didnt: "didn't", hasnt: "hasn't", havent: "haven't", hadnt: "hadn't", couldnt: "couldn't",
  wouldnt: "wouldn't", shouldnt: "shouldn't", mustnt: "mustn't", neednt: "needn't", arent: "aren't",
  ive: "I've", im: "I'm", youre: "you're", youve: "you've", theyre: "they're", theyve: "they've",
  weve: "we've", youll: "you'll", theyll: "they'll", youd: "you'd",
  thats: "that's", theres: "there's", heres: "here's", whats: "what's", whos: "who's" };
var _CONTR_AUXNEXT = { is: 1, are: 1, was: 1, were: 1, has: 1, have: 1, had: 1, does: 1, did: 1, be: 1, been: 1 };
var _CONTR_ITSNEXT = { a: 1, an: 1, the: 1, been: 1, being: 1, not: 1 };
function contractionDecide(lex, T, i, adj){
  const w = T[i], lw = w.toLowerCase();
  if(w === w.toUpperCase() && w.length > 1) return [null, null];         // sigles : IM, DONT (acronymes)
  if(lw in _CONTR_RED){
    if(lw === 'im' && w === 'Im' && i + 1 < T.length && /^[A-Z]/.test(T[i + 1])) return [null, null];   // « Im Yoon-ah » (patronyme coréen)
    return [_keepCaseEn(w, _CONTR_RED[lw]), 'RED'];
  }
  const nx = (i + 1 < T.length && (!adj || adj.has(i))) ? T[i + 1].toLowerCase() : null;
  if(lw === 'cant' || lw === 'wont'){
    if(nx && nx !== 'to' && posOf(lex, nx).has('VERB') && !_CONTR_AUXNEXT[nx]) return [_keepCaseEn(w, lw === 'cant' ? "can't" : "won't"), 'RED'];   // « he is wont TO argue » : l'archaïsme vit pile sur « to » (que kaikki croit verbe)
    return [null, null];
  }
  if(lw === 'its') return (nx && _CONTR_ITSNEXT[nx]) ? [_keepCaseEn(w, "it's"), 'RED'] : [null, null];
  if(lw === 'lets'){
    if(i === 0 && nx && posOf(lex, nx).has('VERB') && !_CONTR_AUXNEXT[nx]) return [_keepCaseEn(w, "let's"), 'RED'];
    return [null, null];
  }
  return [null, null];
}

/* ---------- MODAL / TO / DO + FORME FLÉCHIE → BASE (chantier REGLES_EN n°2, 2026-08-12) ----------
   Trois CLÔTURES DE PARADIGME (le patron gagnant : l'auxiliaire contraint la catégorie) :
   modal → base (« she can sings », « he will came ») · to infinitival → base (« have to reduced »)
   · do/does/did déclaratif → base (« she did went », « didn't went »).
   Discriminant central (né de la lecture des 24 tirs du proto) : la forme visée n'est PAS
   elle-même une base verbale — exclut d'office « will saw », « to found », « can lay », corrects.
   Gardes payées une à une : les formes de BE exclues (« all we did was » = pseudo-clivée ;
   « free will is ») · les modaux exclus comme cible (would = past AGID de will) · to exige un
   GOUVERNEUR INFINITIVAL fermé adjacent (« leads to reduced activity », « thanks to dedicated
   people » = to prépositionnel + participe adjectival, 12 des 24 tirs du proto) · to/do : PAST
   seulement (les -s sont des pluriels nominaux : « did wonders », « to games ») · jamais de -ing
   (« look forward to going » correct) ni de participe pur (« should gone » = have manquant) ·
   préposition avant un modal = pas un modal (« knowledge on may subjects » = many) · trigger
   minuscule et jamais en tête (inversion « Can fishing be fun », prénoms Will/May).
   MESURÉ : flood 1 / 15 353 phrases éditées (et c'est une vraie faute de GUM : « payments could
   wired ») · JFLEG 5 propositions / 5 confirmées gold. Données : forms_en.tsv.gz (AGID/kaikki)
   via buildBaseMap — la page le charge en actif nommé (« verb bases »). */
var _BF_MODAL = { can: 1, could: 1, will: 1, would: 1, shall: 1, should: 1, may: 1, might: 1, must: 1,
  cannot: 1, "can't": 1, "won't": 1, "couldn't": 1, "wouldn't": 1, "shouldn't": 1, "mustn't": 1, "shan't": 1, "mightn't": 1 };
var _BF_DO = { do: 1, does: 1, did: 1, "don't": 1, "doesn't": 1, "didn't": 1 };
var _BF_ADV = { not: 1, probably: 1, really: 1, just: 1, never: 1, always: 1, often: 1, actually: 1,
  even: 1, still: 1, also: 1, usually: 1, certainly: 1, definitely: 1, simply: 1, only: 1, sometimes: 1, all: 1 };
var _BF_PREV = { the: 1, a: 1, an: 1, this: 1, that: 1, these: 1, those: 1, my: 1, your: 1, his: 1,
  her: 1, its: 1, our: 1, their: 1, no: 1, any: 1, some: 1, of: 1, and: 1, or: 1,
  on: 1, in: 1, at: 1, by: 1, for: 1, with: 1, from: 1, about: 1, against: 1, between: 1, during: 1, per: 1 };
var _BF_BE = { be: 1, is: 1, are: 1, was: 1, were: 1, been: 1, being: 1, am: 1 };
var _BF_GOUV_TO = {};
'have has had want wants wanted need needs needed going used able unable how try tries tried trying decide decides decided plan plans planned hope hopes hoped wish wishes wished ought refuse refused fail failed tend tends tended like likes liked love loves loved begin began begun start started continue continued learn learned forget forgot remember remembered choose chose chosen expect expected agree agreed promise promised ask asked help helps helped easy hard difficult important possible impossible way order time best'.split(' ').forEach(function(w){ _BF_GOUV_TO[w] = 1; });
function buildBaseMap(raw, lex){
  const bases = new Set(), pre = new Map();
  for(const l of raw.split('\n')){
    const p = l.split('\t');
    if(p.length < 3 || p[1] !== 'VERB') continue;
    const base = p[0];
    if(!/^[a-z]+$/.test(base)) continue;
    bases.add(base);
    for(const fm of p[2].split(',')){
      const ix = fm.indexOf(':'); if(ix < 0) continue;
      const forme = fm.slice(0, ix), types = fm.slice(ix + 1);
      if(!forme || forme === base || !/^[a-z]+$/.test(forme) || /ing$/.test(forme)) continue;
      let e = pre.get(forme);
      if(!e){ e = { b: new Set(), past: false, sg: false, part: false }; pre.set(forme, e); }
      e.b.add(base);
      for(const t of types.split('|')){ if(t === 'past') e.past = true; else if(t === 'singular') e.sg = true; else if(t === 'participle') e.part = true; }
    }
  }
  const M = new Map();                                       // ne garder que l'utilisable : base UNIQUE ou DOMINANTE, pas une base, pas participe pur
  for(const [forme, e] of pre){
    if(bases.has(forme)) continue;
    if(e.part && !e.past && !e.sg) continue;
    let cand = [...e.b];
    if(cand.length > 1){                                     // « went » = past de go ET de wend (AGID) : la FRÉQUENCE lève l'ambiguïté (≥20×, le seuil maison)
      if(!lex || !lex.FREQ){ continue; }
      cand.sort(function(a, b){ return (lex.FREQ.get(b) || 0) - (lex.FREQ.get(a) || 0); });
      const f1 = lex.FREQ.get(cand[0]) || 0, f2 = lex.FREQ.get(cand[1]) || 0;
      if(!(f1 >= 20 && f1 >= 20 * Math.max(1, f2))) continue;
    }
    M.set(forme, { b: cand[0], past: e.past, sg: e.sg });
  }
  return M;
}
function baseFormDecide(lex, T, i, adj, BM){
  if(!BM) return [null, null];
  const v = T[i], vl = v.toLowerCase();
  if(v !== vl) return [null, null];                          // cible capitalisée = nom propre
  if(_BF_BE[vl] || _BF_MODAL[vl] || _BF_DO[vl]) return [null, null];
  const e = BM.get(vl);
  if(!e) return [null, null];
  let k = i - 1;
  while(k > 0 && _BF_ADV[T[k].toLowerCase()] && (!adj || adj.has(k))) k--;
  if(k < 0 || (adj && !adj.has(k))) return [null, null];     // adjacence RÉELLE trigger→cible (« the watering can, boxes »)
  const tw = T[k], tl = tw.toLowerCase();
  if(tw !== tl) return [null, null];                         // « Will/May/Did » capitalisés : prénom, mois, inversion
  if(k === 0) return [null, null];                           // inversion en tête (« Can fishing be fun ? »)
  let kind = null;
  if(_BF_MODAL[tl]) kind = 'modal'; else if(_BF_DO[tl]) kind = 'do'; else if(tl === 'to') kind = 'to';
  if(!kind) return [null, null];
  if(kind !== 'to' && _BF_PREV[T[k - 1].toLowerCase()]) return [null, null];   // « the can », « free will », « on may »
  if(kind === 'to'){
    if(!_BF_GOUV_TO[T[k - 1].toLowerCase()]) return [null, null];
    if(adj && !adj.has(k - 1)) return [null, null];
  }
  if(kind === 'modal' ? !(e.past || e.sg) : !e.past) return [null, null];      // to/do : PAST seulement
  return [e.b, 'RED'];
}

/* ---------- REGLES_EN ③④⑤⑥ (2026-08-12) — quatre règles mesurées d'un bloc ----------
   ③ RÉPÉTITION DE MOT (the the) — ORANGE, pas rouge comme en FR : les genres court/speech de GUM
     transcrivent les disfluences verbatim (« the the appellants », « we we don't ») → 24 tirs sur
     10 137 phrases éditées, tous dans ces genres. L'oral transcrit est structurellement hostile ;
     on signale, on ne tranche pas. Rappel web (EWT) : 17.
   ④ « i » → I — cadre SÛR : i + VERBE/AUX au tagger (« i think », « i am »). Le naïf était RÉFUTÉ
     par la mesure : i mathématique (« i square root of two » ×8), hawaïen, troncatures orales
     « i- ». Après cadre + garde « the i » (LE JOURNAL britannique *i*) : 1 tir / 10 137 = vraie
     faute. Rappel web : 194. ROUGE.
   ⑤ MOTS COLLÉS FIGÉS (alot, aswell, infact…) — jamais corrects. 0 tir / 10 137. ROUGE.
   ⑥ DOUBLE COMPARATIF (more better, most easiest) — comparatifs RÉELS de forms_en (2 359/2 397,
     donc « more clever » et « most honest » sûrs par construction). 0 tir / 10 137. ROUGE (le
     more/most est SUPPRIMÉ). */
var _REP_OK = { had: 1, that: 1, very: 1, really: 1, so: 1, no: 1, many: 1, long: 1, far: 1, bye: 1, blah: 1, is: 1, do: 1 };
function repetitionDecide(lex, T, i, adj, hyph){
  if(i < 1) return [null, null];
  const a = T[i - 1].toLowerCase(), b = T[i].toLowerCase();
  if(a !== b || a.length < 2) return [null, null];
  if(adj && !adj.has(i - 1)) return [null, null];                      // virgule/point entre = pas une répétition
  if(hyph && hyph.has(i)) return [null, null];                         // bye-bye, so-so
  if(_REP_OK[a]) return [null, null];
  if(/^[A-Z]/.test(T[i])) return [null, null];                         // Duran Duran, New York New York
  return ['', 'DEL'];                                                  // orange : supprimer le doublon (proposé, jamais imposé)
}
var _CAPI_ROM = { part: 1, section: 1, chapter: 1, war: 1, phase: 1, type: 1, class: 1, stage: 1,
  appendix: 1, article: 1, item: 1, level: 1, volume: 1, book: 1, act: 1, scene: 1, title: 1, schedule: 1, the: 1 };
function capIDecide(lex, T, i, adj, hyph){
  if(T[i] !== 'i' || i + 1 >= T.length) return [null, null];
  if(T[i + 1].toLowerCase() === 'e') return [null, null];              // i.e.
  if(i > 0 && _CAPI_ROM[T[i - 1].toLowerCase()]) return [null, null];  // chiffre romain (« part i ») + « the i » (le journal)
  if(hyph && (hyph.has(i) || hyph.has(i + 1))) return [null, null];    // « i- » troncature orale
  if(adj && !adj.has(i)) return [null, null];
  const nx = ctxPos(T, i + 1);                                         // cadre : i + VERBE/AUX — tue le i mathématique et les citations étrangères
  if(nx !== 'VERB' && nx !== 'AUX') return [null, null];
  return ['I', 'RED'];
}
var _MERGED = { alot: 'a lot', aswell: 'as well', infact: 'in fact', incase: 'in case',
  atleast: 'at least', eachother: 'each other', infront: 'in front', alittle: 'a little',
  abit: 'a bit', aslong: 'as long', inspite: 'in spite', upto: 'up to', ontop: 'on top',
  nevermind: 'never mind' };                                           // alright ABSENT : graphie acceptée
function mergedDecide(lex, T, i, adj){
  const w = T[i], lw = w.toLowerCase();
  const c = _MERGED[lw];
  if(!c) return [null, null];
  if(w === w.toUpperCase() && w.length > 1) return [null, null];       // sigles
  if(w !== lw && i > 0) return [null, null];                           // « Alot » (toponyme) hors tête de phrase
  return [_keepCaseEn(w, c), 'RED'];
}
var _COMP_SET = null, _SUP_SET = null;
function buildCompSets(raw){
  _COMP_SET = new Set(); _SUP_SET = new Set();
  for(const l of raw.split('\n')){
    const p = l.split('\t');
    if(p.length < 3 || (p[1] !== 'ADJ' && p[1] !== 'ADV')) continue;
    for(const fm of p[2].split(',')){
      const ix = fm.indexOf(':'); if(ix < 0) continue;
      const forme = fm.slice(0, ix), types = fm.slice(ix + 1);
      if(!/^[a-z]+$/.test(forme)) continue;
      if(types.indexOf('comparative') >= 0) _COMP_SET.add(forme);
      if(types.indexOf('superlative') >= 0) _SUP_SET.add(forme);
    }
  }
  return { comp: _COMP_SET.size, sup: _SUP_SET.size };
}
function doubleCompDecide(lex, T, i, adj){
  if(!_COMP_SET) return [null, null];
  const lw = T[i].toLowerCase();
  if(lw !== 'more' && lw !== 'most') return [null, null];
  if(i + 1 >= T.length) return [null, null];
  if(adj && !adj.has(i)) return [null, null];
  const nx = T[i + 1].toLowerCase();
  if(lw === 'more' ? !_COMP_SET.has(nx) : !_SUP_SET.has(nx)) return [null, null];
  return ['', 'DEL-RED'];                                              // supprimer more/most (« more better » → « better »)
}

/* ---------- REGLES_EN ⑧a/⑧b (2026-08-12) — deux ORANGES mesurés ; ⑦ et ⑧c REPORTÉS chiffrés ----------
   ⑧a PLURIEL IRRÉGULIER + s (childrens, mens…) 🟠 : ambigu possessif (« childrens clothes » =
     children's) → on propose la base, l'infobulle mentionne le possessif. 0 tir/10 137 édité ;
     1 vraie faute web (« the best baby and childrens clothes »). « mens rea » (latin juridique) exclu.
   ⑧b JOURS/MOIS MINUSCULES 🟠 : convention stricte EN (≠ FR). may/march/august EXCLUS — homographes
     (modal, marche, adjectif auguste). 1 tir/10 137 = vraie anomalie (« January-june ») ; rappel web 10.
   ⑦ it's→its inverse : REPORTÉ CHIFFRÉ — le cadre sûr (it's+NOM+VERBE fini, sujet possessif) a un
     rappel MESURÉ NUL (0 flood ET 0 rappel sur 22 681 phrases réelles) ; la vraie faute native vit en
     position OBJET (« wagged it's tail »), indiscernable en surface des complétives (« said it's time »).
   ⑧c « to » manquant : REPORTÉ CHIFFRÉ — les 3 seuls tirs réels étaient tous mauvais : « the Court
     need reach » (need SEMI-MODAL juridique correct), « wanted win in 48 hours » (win = typo de
     within → fausse direction), « want want » (répétition). 0 vrai positif. */
var _IRRPL = { childrens: 'children', mens: 'men', womens: 'women', teeths: 'teeth',
  feets: 'feet', mices: 'mice', geeses: 'geese', oxens: 'oxen', sheeps: 'sheep', childs: 'children' };
function irregPluralDecide(lex, T, i, adj){
  const w = T[i], lw = w.toLowerCase();
  const c = _IRRPL[lw];
  if(!c) return [null, null];
  if(w === w.toUpperCase() && w.length > 1) return [null, null];       // sigles
  if(lw === 'mens' && i + 1 < T.length && T[i + 1].toLowerCase() === 'rea') return [null, null];   // « mens rea »
  return [_keepCaseEn(w, c), 'ORANGE'];
}
var _CALW = { monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1, sunday: 1,
  january: 1, february: 1, april: 1, june: 1, july: 1, september: 1, october: 1, november: 1, december: 1 };
function calendarCapDecide(lex, T, i, adj){
  const w = T[i];
  if(w !== w.toLowerCase() || !_CALW[w]) return [null, null];
  return [w[0].toUpperCase() + w.slice(1), 'ORANGE'];
}

const _API = { deacc, phonKey, edits1, buildPhonIndex, spellSuggest, homoDecide, tokenize, urlMask, adjMask, hyphMask,
               pastPartDecide, buildPastPart, contractionDecide, buildBaseMap, baseFormDecide, repetitionDecide, capIDecide, mergedDecide, buildCompSets, doubleCompDecide, irregPluralDecide, calendarCapDecide, numberDecide, buildNumber, verb3Decide, interroDecide, auxAgree, articleMassDecide, typoScanEn, confuseSlotDecide, buildConfuseSlot, confuseVigDecide, buildConfuseVig,
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
  /* GLISSEMENT MOTEUR → ROUGE (miroir speller_en_probe.py). Un seul candidat au lexique ET l'écart
     n'est qu'un ORDRE de lettres ou un REDOUBLEMENT. Le redoublement était TOTALEMENT absent de
     l'anglais alors que c'est sa faute la plus courante. Mesuré : +16 rouges sur JFLEG (14/16
     confirmés par les références), et sur EWT les 14 rouges ajoutés sont TOUS de vraies fautes
     (tupperwear, accomodating, flexibiltiy, windsheild, lisenced…). */
  let slipKO = 0;
  for(const [bad, good] of [['occuring','occurring'],['comunities','communities'],['stressfull','stressful'],
                            ['filmaking','filmmaking'],['advertisemnets','advertisements'],['exapmles','examples']]){
    const [s, m] = spellSuggest(lex, bad);
    if(s !== good || m !== 'AUTO'){ slipKO++; console.log('  GLISSEMENT MISS %s -> %s/%s (attendu %s/AUTO)', bad, s, m, good); } }
  /* ⚠️ CONTRE-GARDE — c'est l'INTERSECTION qui est sûre, pas le glissement seul. Ces quatre-là SONT
     des glissements moteurs (thier/their, littel/little = transpositions ; beleive/believe idem ;
     harrass/harass = redoublement) mais le lexique leur oppose PLUSIEURS candidats : le choix
     redevient un pari, ils doivent rester ORANGE. Sans cette contre-garde, retirer la condition
     « un seul candidat » passerait inaperçu en CI. Puissance vérifiée : les 4 tirent bien, en orange. */
  for(const bad of ['beleive','thier','littel','harrass']){
    const [s, m] = spellSuggest(lex, bad);
    if(m === 'AUTO'){ slipKO++; console.log('  CONTRE-GARDE : %s -> %s ne doit PAS être affirmé (candidats concurrents)', bad, s); } }
  if(slipKO) console.log('  ✗ %d cas de glissement moteur en défaut', slipKO);
  // homophone CASES
  const HP = [['I could of done it',2,'have','RED'],['It is bigger then mine',3,'than','RED'],
    ['Their is a problem',0,'there','RED'],['its a good idea',0,"it's",'RED'],
    ['your gonna love it',0,"you're",'RED'],['there car is red',0,'their','ORANGE'],
    ['its not fair',0,"it's",'ORANGE'],['your welcome to stay',0,"you're",'ORANGE'],
    ['I saw a apple',2,'an','RED'],['It is a honest mistake',2,'an','RED'],
    /* an -> a : le SON décide, pas la lettre. Positifs = voyelle écrite, consonne prononcée ;
       négatifs = les pièges qui doivent rester muets (h muet, sigle, registre britannique). */
    ['he is an user of the site',2,'a','RED'],['that is an unicorn',2,'a','RED'],
    ['an one time offer',0,'a','RED'],['an useful tool here',0,'a','RED'],
    ['I waited an hour today',2,null,null],['it was an honest mistake',2,null,null],
    ['she has an MBA degree',2,null,null],['an heir to the throne',0,null,null],
    ['an historic moment happened',0,null,null],['an umbrella is useful',0,null,null],
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
  /* ⭐ TYPOGRAPHIE — CAS FIGÉS. La mesure de référence vit hors CI : GUM+PUD sont **CC BY-NC-SA**,
     donc jamais commités ; le scan local (15 353 phrases d'anglais édité) rend **1 déclenchement**,
     et c'en est une vraie faute du corpus (« follo,wers » est écrit ainsi dans GUM) — soit FP=0 réel.
     Ce que la CI peut garder, ce sont les FAMILLES : chaque négatif ci-dessous représente une classe
     de piège que le scan a effectivement rencontrée (adresses, sigles pointés, emphase). */
  const TY_OUI = [['Hello ,how are you ?',          'Hello, how are you?'],
                  ['It cost 5 dollars .Then he left', 'It cost 5 dollars. Then he left'],
                  ['I said ,,no way',               'I said, no way'],
                  ['Two  spaces here',              'Two spaces here'],
                  // celui-ci a besoin de 3 PASSES (4 puis 2 puis 1 remplacements) : il verrouille
                  // la boucle, qu'un plafond trop bas casserait en silence.
                  ['Hello ,how are you ? I said ,,no. Two  spaces here.',
                   'Hello, how are you? I said, no. Two spaces here.']];
  const TY_NON = ['Send it to john.smith@ens.fr or see www.wikihow.com today.',  // adresses : « mot.mot »
                  'He got his Ph.D at the U.S.Army base, e.g. in 1999.',         // sigles pointés, initiales
                  'Yeah!!! What??? Really?!',                                    // emphase LÉGITIME, pas une faute
                  'The price is 3,000 and pi is 3.14.'];                         // chiffres groupés, décimales
  const applique = (v) => { for(let p = 0; p < 8; p++){ const t = typoScanEn(v); if(!t.length) break;
    t.sort((a, b) => b.cs - a.cs); const av = v;                       // de la FIN au DÉBUT : les plages se décalent
    for(const h of t) v = v.slice(0, h.cs) + h.sugg + v.slice(h.ce); if(v === av) break; } return v; };
  let tyOk = 0, tyKo = 0;
  for(const [txt, att] of TY_OUI){ const r = applique(txt);
    if(r === att) tyOk++; else { tyKo++; console.log('  TYPO MISS : %s -> %s (attendu %s)', txt, r, att); } }
  for(const txt of TY_NON){ const t = typoScanEn(txt);
    if(t.length){ tyKo++; console.log('  TYPO FAUX POSITIF : %s   | %s', t.map(x => x.from).join(' · '), txt); } }
  /* Les plages NE DOIVENT PAS se chevaucher : « ab,cd.Ef » est vu par deux règles à la fois, et
     appliquer les deux sur la même chaîne mange des caractères au lieu de réparer. */
  for(const txt of ['ab,cd.Ef gh', 'end ,next.Word here', 'a,bc.De,fg.Hi']){
    const t = typoScanEn(txt);
    for(let i = 1; i < t.length; i++) if(t[i].cs < t[i - 1].ce){
      tyKo++; console.log('  TYPO PLAGES QUI SE CHEVAUCHENT : %s   | %s', t[i - 1].from + ' / ' + t[i].from, txt); } }
  console.log('typographie: %d/%d corrections, %d anomalie(s)', tyOk, TY_OUI.length, tyKo);
  /* CONTRACTIONS — rappel ET pièges (les deux sens, garde vérifiée en la cassant au proto :
     sans la garde -ing, « its loading environment » tirait ; sans la garde aux, « cant is » tirait). */
  const CT_OUI = [
    [['dont', 'worry', 'about', 'it'], 0, "don't"],
    [['Im', 'going', 'home'], 0, "I'm"],
    [['ive', 'seen', 'it'], 0, "I've"],
    [['isnt', 'it', 'lovely'], 0, "isn't"],
    [['theyre', 'already', 'here'], 0, "they're"],
    [['thats', 'the', 'choice'], 0, "that's"],
    [['youre', 'very', 'kind'], 0, "you're"],
    [['I', 'cant', 'go', 'tonight'], 1, "can't"],
    [['he', 'wont', 'listen'], 1, "won't"],
    [['its', 'not', 'far'], 0, "it's"],
    [['its', 'the', 'best'], 0, "it's"],
    [['Lets', 'go', 'now'], 0, "Let's"],
  ];
  const CT_NON = [
    [['the', 'dog', 'wagged', 'its', 'tail'], 3],                     // possessif légitime
    [['its', 'meaning', 'is', 'unknown'], 0],                         // possessif + nom
    [['its', 'very', 'nature'], 0],                                   // very a tué la liste large au proto
    [['its', 'loading', 'environment'], 0],                           // participe-adjectif (-ing tué au proto)
    [['the', 'thieves', 'cant', 'is', 'a', 'jargon'], 2],             // cant nom + aux fléchi
    [['he', 'is', 'wont', 'to', 'argue'], 2],                         // wont adjectif (archaïque)
    [['she', 'lets', 'him', 'play'], 1],                              // lets = 3sg de let (pas en tête)
    [['Im', 'Yoon', 'ah'], 0],                                        // patronyme coréen (capitale derrière)
    [['IM', 'me', 'later'], 0],                                       // sigle
  ];
  let ctOk = 0, ctKo = 0;
  for(const [T, i, att] of CT_OUI){ const r = contractionDecide(lex, T, i, null);
    if(r[1] === 'RED' && r[0] === att) ctOk++; else { ctKo++; console.log('  CONTR MISS %s[%d] -> %s (attendu %s)', T.join(' '), i, r[0], att); } }
  for(const [T, i] of CT_NON){ const r = contractionDecide(lex, T, i, null);
    if(r[1]){ ctKo++; console.log('  CONTR FAUX POSITIF %s[%d] -> %s', T.join(' '), i, r[0]); } }
  console.log('contractions: %d/%d rappel, %d anomalie(s)', ctOk, CT_OUI.length, ctKo);
  /* MODAL/TO/DO → BASE — rappel + pièges (chaque garde cassée une fois). */
  const BM = buildBaseMap(require('zlib').gunzipSync(require('fs').readFileSync(path.join(__dirname, 'forms_en.tsv.gz'))).toString('utf8'), lex);
  const BF_OUI = [
    [['she', 'can', 'sings', 'well'], 2, 'sing'],
    [['he', 'will', 'came', 'tomorrow'], 2, 'come'],
    [['they', 'could', 'lost', 'it'], 2, 'lose'],
    [['we', 'have', 'to', 'reduced', 'sulfur'], 3, 'reduce'],
    [['she', 'did', 'went', 'home'], 2, 'go'],
    [['she', "didn't", 'went', 'home'], 2, 'go'],
    [['it', 'will', 'causes', 'heat'], 2, 'cause'],
    [['you', 'must', 'never', 'went', 'there'], 3, 'go'],
  ];
  const BF_NON = [
    [['the', 'can', 'rusted', 'away'], 2],
    [['free', 'will', 'is', 'nothing'], 2],
    [['all', 'we', 'did', 'was', 'fun'], 3],
    [['he', 'will', 'saw', 'the', 'plank'], 2],
    [['they', 'plan', 'to', 'found', 'a', 'company'], 3],
    [['knowledge', 'on', 'may', 'subjects'], 3],
    [['thanks', 'to', 'dedicated', 'people'], 2],
    [['it', 'leads', 'to', 'reduced', 'activity'], 3],
    [['Can', 'fishing', 'be', 'fun'], 1],
    [['look', 'forward', 'to', 'going', 'home'], 3],
  ];
  let bfOk = 0, bfKo = 0;
  for(const [T, i, att] of BF_OUI){ const r = baseFormDecide(lex, T, i, null, BM);
    if(r[1] === 'RED' && r[0] === att) bfOk++; else { bfKo++; console.log('  BASE MISS %s[%d] -> %s (attendu %s)', T.join(' '), i, r[0], att); } }
  for(const [T, i] of BF_NON){ const r = baseFormDecide(lex, T, i, null, BM);
    if(r[1]){ bfKo++; console.log('  BASE FAUX POSITIF %s[%d] -> %s', T.join(' '), i, r[0]); } }
  console.log('modal/to/do -> base: %d/%d rappel, %d anomalie(s)', bfOk, BF_OUI.length, bfKo);
  /* REGLES_EN ③④⑤⑥ — rappel + pièges. */
  buildCompSets(require('zlib').gunzipSync(require('fs').readFileSync(path.join(__dirname, 'forms_en.tsv.gz'))).toString('utf8'));
  const Q_OUI = [
    ['rep', ['I', 'saw', 'the', 'the', 'dog'], 3, ''],
    ['capi', ['yesterday', 'i', 'went', 'home'], 1, 'I'],
    ['capi', ['i', 'think', 'so'], 0, 'I'],
    ['merged', ['alot', 'of', 'people'], 0, 'a lot'],
    ['merged', ['we', 'went', 'aswell'], 2, 'as well'],
    ['merged', ['infact', 'it', 'works'], 0, 'in fact'],
    ['dbl', ['this', 'is', 'more', 'better'], 2, ''],
    ['dbl', ['the', 'most', 'easiest', 'test'], 1, ''],
  ];
  const Q_NON = [
    ['rep', ['he', 'had', 'had', 'enough'], 2],
    ['rep', ['it', 'was', 'very', 'very', 'good'], 3],
    ['rep', ['visit', 'Duran', 'Duran', 'tonight'], 2],
    ['capi', ['the', 'i', 'reporting', 'news'], 1],
    ['capi', ['part', 'i', 'was', 'long'], 1],
    ['capi', ['i', 'e', 'the', 'rest'], 0],
    ['merged', ['it', 'is', 'alright'], 2],
    ['dbl', ['she', 'is', 'more', 'clever'], 2],
    ['dbl', ['the', 'most', 'honest', 'people'], 1],
    ['dbl', ['the', 'more', 'the', 'better'], 1],
  ];
  const QFN = { rep: (T, i) => repetitionDecide(lex, T, i, null, null), capi: (T, i) => capIDecide(lex, T, i, null, null),
    merged: (T, i) => mergedDecide(lex, T, i, null), dbl: (T, i) => doubleCompDecide(lex, T, i, null) };
  let qOk = 0, qKo = 0;
  for(const [k, T, i, att] of Q_OUI){ const r = QFN[k](T, i);
    if(r[1] && r[0] === att) qOk++; else { qKo++; console.log('  Q MISS [%s] %s[%d] -> %s (attendu %s)', k, T.join(' '), i, r[0], att); } }
  for(const [k, T, i] of Q_NON){ const r = QFN[k](T, i);
    if(r[1]){ qKo++; console.log('  Q FAUX POSITIF [%s] %s[%d] -> %s/%s', k, T.join(' '), i, r[0], r[1]); } }
  /* ⑧a/⑧b — rappel + pièges */
  const H_OUI = [
    ['irr', ['the', 'childrens', 'clothes'], 1, 'children'],
    ['irr', ['two', 'mens', 'shirts'], 1, 'men'],
    ['cal', ['see', 'you', 'monday', 'morning'], 2, 'Monday'],
    ['cal', ['born', 'in', 'january'], 2, 'January'],
  ];
  const H_NON = [
    ['irr', ['the', 'mens', 'rea', 'element'], 1],
    ['irr', ['visit', 'MENS', 'store'], 1],
    ['cal', ['he', 'may', 'come'], 1],
    ['cal', ['the', 'march', 'was', 'long'], 1],
    ['cal', ['an', 'august', 'assembly'], 1],
    ['cal', ['born', 'in', 'January'], 2],
  ];
  const HFN = { irr: (T, i) => irregPluralDecide(lex, T, i, null), cal: (T, i) => calendarCapDecide(lex, T, i, null) };
  let hOk2 = 0, hKo2 = 0;
  for(const [k, T, i, att] of H_OUI){ const r = HFN[k](T, i);
    if(r[1] === 'ORANGE' && r[0] === att) hOk2++; else { hKo2++; console.log('  H MISS [%s] %s[%d] -> %s (attendu %s)', k, T.join(' '), i, r[0], att); } }
  for(const [k, T, i] of H_NON){ const r = HFN[k](T, i);
    if(r[1]){ hKo2++; console.log('  H FAUX POSITIF [%s] %s[%d] -> %s', k, T.join(' '), i, r[0]); } }
  console.log('règles ⑧ab: %d/%d rappel, %d anomalie(s)', hOk2, H_OUI.length, hKo2);
  console.log('règles ③④⑤⑥: %d/%d rappel, %d anomalie(s)', qOk, Q_OUI.length, qKo);
  if(process.argv.includes('--check')){                    // garde CI : parité CASES (auto+flag ≥ 10 typos clairs, homophones tous)
    const ok = (auto + flag >= 10) && (hok === HP.length) && (tyOk === TY_OUI.length) && (tyKo === 0) && (slipKO === 0) && (ctOk === CT_OUI.length) && (ctKo === 0) && (bfOk === BF_OUI.length) && (bfKo === 0) && (qOk === Q_OUI.length) && (qKo === 0) && (hOk2 === H_OUI.length) && (hKo2 === 0);
    console.log('[check] %s — speller %d, glissement moteur %s, homophone %d/%d, typo %d/%d (%d anomalies), contractions %d/%d (%d anomalies), base %d/%d (%d anomalies), q3456 %d/%d (%d anomalies)',
                ok ? 'OK' : 'ÉCHEC', auto + flag, slipKO ? 'KO(' + slipKO + ')' : 'OK', hok, HP.length, tyOk, TY_OUI.length, tyKo, ctOk, CT_OUI.length, ctKo, bfOk, BF_OUI.length, bfKo, qOk, Q_OUI.length, qKo);
    if(!ok) process.exit(1);
  }
}
