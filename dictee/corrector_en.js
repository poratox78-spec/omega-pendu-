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
  for(let i = 0; i < Math.min(12, neigh.length); i++){ const x = neigh[i]; if(x !== low && !cands.has(x)) cands.set(x, 0); }
  if(!cands.size) return [null, 'OK'];                                  // inconnu sans candidat → ne pas harceler
  let best = null, bestKey = [-1, -1];
  for(const [x, tier] of cands){ const key = [tier, lex.FREQ.get(x)||0];
    if(key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])){ best = x; bestKey = key; } }
  const bt = cands.get(best), bf = lex.FREQ.get(best) || 0;
  let second = 0;
  for(const [x] of cands){ if(x !== best) second = Math.max(second, lex.FREQ.get(x)||0); }
  const phonMatch = phonKey(best) === pk;
  const transp = best.length === low.length && best.split('').sort().join('') === low.split('').sort().join('');
  if(bt === 1 && low.length >= 3 && bf >= 200 && bf >= 20 * Math.max(second, 1) && (phonMatch || transp))
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

function posOf(lex, w){ return lex.POS.get(w.toLowerCase()) || new Set(); }
function isNoun(lex, w){ return posOf(lex, w).has('NOUN'); }
function onlyNoun(lex, w){ const p = posOf(lex, w); return p.size === 1 && p.has('NOUN'); }
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
  if(lw === 'their' && BE_AFTER.has(nx)) return ['there', 'RED'];
  if(lw === 'there' && nx && onlyNoun(lex, nx)) return ['their', 'ORANGE'];
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
  return [null, null];
}

function tokenize(text){ return text.match(/[A-Za-z]+(?:'[A-Za-z]+)*/g) || []; }

// ---------- chargement du lexique ----------
// parseLexText : construit le lexique depuis le TSV décompressé (partagé Node/navigateur).
function parseLexText(raw){
  const lex = { KNOWN: new Set(), FREQ: new Map(), POS: new Map(), IPA: new Map(), PHON: null };
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
  return parseLexText(zlib.gunzipSync(fs.readFileSync(path)).toString('utf8'));
}
// navigateur : décompresse un base64+gzip via DecompressionStream (comme l'app FR).
async function loadLexB64(b64){
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const ds = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
  const raw = await new Response(ds).text();
  return parseLexText(raw);
}

const _API = { deacc, phonKey, edits1, buildPhonIndex, spellSuggest, homoDecide, tokenize,
               parseLexText, loadLexNode, loadLexB64 };
if(typeof module !== 'undefined' && module.exports) module.exports = _API;
if(typeof window !== 'undefined') window.CorrectorEN = _API;

// ---------- auto-test (parité avec les probes Python) ----------
if(typeof require !== 'undefined' && require.main === module){
  const path = require('path');
  const lex = loadLexNode(path.join(__dirname, 'lex_en.tsv.gz'));
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
    ['I saw a apple',2,'an','RED'],['It is a honest mistake',2,'an','RED']];
  let hok=0;
  for(const [txt, idx, exp, lvl] of HP){ const T = tokenize(txt); const [s, l] = homoDecide(lex, T, idx);
    if(s === exp && l === lvl) hok++; else console.log('  HP MISS %s -> %s/%s (attendu %s/%s)', txt, s, l, exp, lvl); }
  console.log('homophone: %d/%d', hok, HP.length);
  if(process.argv.includes('--check')){                    // garde CI : parité CASES (auto+flag ≥ 10 typos clairs, homophones tous)
    const ok = (auto + flag >= 10) && (hok === HP.length);
    console.log('[check] %s — speller %d, homophone %d/%d', ok ? 'OK' : 'ÉCHEC', auto + flag, hok, HP.length);
    if(!ok) process.exit(1);
  }
}
