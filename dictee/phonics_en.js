/* PHONICS ANGLAIS — le module partagé de en/decompose-outil.html (navigateur) et de dictee/phonics_en_probe.js (Node).
   POURQUOI CE MODULE (16/09/2026). La page « Decompose » devinait la prononciation à partir de l'orthographe
   (g2p prédit) et IGNORAIT le dictionnaire : colonel, yacht, women, choir, island, said, friend, enough — 8 mots
   irréguliers sur 8 lus faux (« said » -> /seɪd/), alors que lex_en porte la bonne IPA des 8. Pour un dys, la
   prononciation JUSTE est l'information ; la prédiction ne sert qu'à montrer OÙ l'orthographe est irrégulière.
   Désormais : la prononciation vient du DICTIONNAIRE quand le mot y est ; les phonèmes sont ALIGNÉS sur les groupes de
   lettres (programmation dynamique ; coût = ce que le modèle g2p prédit ici, ce qu'il connaît pour ces lettres, et les
   lectures CLASSIQUES de la phonics anglaise) ; chaque ligne dit le vrai son, et « unusual » seulement quand ce son
   n'est aucune lecture connue de ces lettres. Mot absent du dictionnaire -> prédiction, dite comme telle. */
(function(root){
'use strict';

// ---- 1) IPA du dictionnaire (kaikki/CMU, notations mêlées) -> phonèmes canoniques GA (40), MIROIR de build_g2p_en.py
//  (+ « ə|ʊ » : la diphtongue BRITANNIQUE de « so » /səʊ/, présente dans le dictionnaire, lue comme oʊ)
const STRIP = new Set("ˈˌ.ˑ|‖/[]() ​'ʼ‿-"), LONG = 'ː', TIES = new Set('͜͡');
const MERGE2 = new Set(['a|ɪ','a|ʊ','ɔ|ɪ','o|ʊ','e|ɪ','ə|ɹ','ə|r','t|ʃ','d|ʒ','ə|ʊ']);
const EN_PHON = new Set(['i','ɪ','ɛ','æ','ɑ','ɔ','ʊ','u','ʌ','ə','ɚ','eɪ','aɪ','ɔɪ','oʊ','aʊ',
  'p','b','t','d','k','ɡ','tʃ','dʒ','f','v','θ','ð','s','z','ʃ','ʒ','h','m','n','ŋ','l','ɹ','j','w']);
const NORM = {'əɹ':'ɚ','ər':'ɚ','ɝ':'ɚ','ɜ':'ɚ','ɾ':'t','ʔ':'t','ɫ':'l','g':'ɡ','r':'ɹ','ɒ':'ɑ','ä':'ɑ',
  'ɐ':'ʌ','ɘ':'ə','ɵ':'oʊ','o':'oʊ','e':'ɛ','ɨ':'ɪ','ᵻ':'ɪ','ʉ':'u','ʍ':'w','ʋ':'v','ç':'h',
  'ɦ':'h','x':'k','q':'k','ʈ':'t','ɖ':'d','y':'i','ø':'ə','ā':'eɪ','ē':'i','ī':'aɪ','ō':'oʊ',
  'ū':'u','əʊ':'oʊ','ɪə':'ɪ','ɛə':'ɛ','ʊə':'ʊ'};
/* Le modèle g2p note un groupe à PLUSIEURS sons par une chaîne collée (« ks » pour x, « ʃən » pour tion) : on la
   redécoupe en phonèmes canoniques (les diphtongues et affriquées font deux caractères). */
const PH2 = ['eɪ','aɪ','ɔɪ','oʊ','aʊ','tʃ','dʒ'];
function splitPh(s){ const out = []; let i = 0; while(i < s.length){ const two = s.slice(i, i + 2); if(PH2.includes(two)){ out.push(two); i += 2; } else { out.push(s[i]); i += 1; } } return out; }
const isMn = (ch) => /\p{Mn}/u.test(ch);
const bare = (x) => [...x].filter(c => !isMn(c) && c !== LONG).join('');
function segIpa(s){
  const out = []; let cur = '', mergeNext = false;
  for(const ch of s){
    if(STRIP.has(ch)){ if(cur){ out.push(cur); cur = ''; } mergeNext = false; continue; }
    if(TIES.has(ch)){ cur += ch; mergeNext = true; continue; }
    if(isMn(ch) || ch === LONG){ cur += ch; continue; }
    if(cur === '') cur = ch;
    else if(mergeNext){ cur += ch; mergeNext = false; }
    else { out.push(cur); cur = ch; }
  }
  if(cur) out.push(cur);
  const merged = []; let i = 0;
  while(i < out.length){
    if(i + 1 < out.length && MERGE2.has(bare(out[i]) + '|' + bare(out[i+1]))){ merged.push(out[i] + out[i+1]); i += 2; }
    else { merged.push(out[i]); i += 1; }
  }
  return merged;
}
function canon(p){
  const b = [...p].filter(c => !/\p{Mn}|\p{Lm}|\p{Sk}/u.test(c) && !'ː:~ˑ'.includes(c)).join('');
  if(!b) return null;
  if(EN_PHON.has(b)) return b;
  return Object.prototype.hasOwnProperty.call(NORM, b) ? NORM[b] : null;
}
/* Deux notations d'un même son, mêlées dans le dictionnaire ET dans le modèle : « care » s'écrit /kɛɚ/ ou /kɛɹ/,
   « hire » /haɪɚ/ ou /haɪɹ/. Après une voyelle, ɚ n'est qu'un ɹ : on l'écrit ɹ des deux côtés avant de comparer.
   (« sugar » /ʃʊɡɚ/ garde son ɚ : il suit une consonne, c'est une voyelle syllabique.) */
const VOW_SET = new Set(['i','ɪ','ɛ','æ','ɑ','ɔ','ʊ','u','ʌ','ə','eɪ','aɪ','ɔɪ','oʊ','aʊ']);
function normSeq(phs){ return phs.map((p, k) => (p === 'ɚ' && k > 0 && VOW_SET.has(phs[k-1])) ? 'ɹ' : p); }
/* Une entrée kaikki peut porter plusieurs transcriptions séparées par « , » ou « ; » : on prend la première. */
function dictPhonemes(ipa){
  if(!ipa) return null;
  const first = String(ipa).split(/[,;]/)[0];
  const ph = normSeq(segIpa(first).map(canon).filter(Boolean));
  return ph.length ? ph : null;
}

// ---- 2) prédiction g2p (mêmes tables que le pendu EN : SEG longest-match + COND contextuel) -> [{g, ph}]
function g2pSteps(T, word){
  const SEG = T.SEG, COND = T.COND, DBL = T.DBLset || (T.DBLset = new Set(T.DBL));
  const w = (word || '').toLowerCase().replace(/[^a-z]/g, ''); const steps = []; let i = 0;
  while(i < w.length){
    let g = null;
    for(let s = 0; s < SEG.length; s++){ if(w.substr(i, SEG[s].length) === SEG[s]){ g = SEG[s]; break; } }
    if(!g) g = w.charAt(i);
    const nxt = (i + g.length < w.length) ? w.charAt(i + g.length) : '#';
    let ph;
    if(DBL.has(g) && COND[g.charAt(0)]){ const e0 = COND[g.charAt(0)]['_']; ph = e0 ? e0[0] : g.charAt(0); }
    else { const t = COND[g]; const e = t ? (t[nxt] || t['_']) : null; ph = e ? e[0] : ''; }
    if(ph === '∅') ph = '';
    steps.push({ g: g, ph: ph });
    i += g.length;
  }
  return steps;
}
/* Tous les sons que le modèle a déjà vus pour ce groupe de lettres (tous contextes) : les lectures « connues ». */
const normKey = (s) => normSeq(splitPh(s)).join('');
function knownSounds(T, g){
  const t = T.COND[g] || (T.DBLset && T.DBLset.has(g) ? T.COND[g.charAt(0)] : null);
  const s = new Set();
  if(t) for(const k of Object.keys(t)){ const e = t[k]; if(e && e[0] && e[0] !== '∅') s.add(normKey(e[0])); }
  return s;
}
/* Les lectures CLASSIQUES de la phonics anglaise (manuels de lecture, pas une intuition) : ce qu'un lecteur apprend
   pour chaque lettre ou groupe. Le modèle g2p ne retient qu'un son par contexte droit ; sans cette table, « want »
   (a -> ɑ), « come » (o -> ʌ), « christmas » (ch -> k) ressortaient « unusual » — mesuré sur les 20 000 mots les
   plus fréquents : 27 % des mots avaient une ligne « unusual », la moitié pour ces lectures-là. */
const CLASSIC_SRC = { a:'æ eɪ ɑ ə ɔ ɪ', e:'ɛ i ə ɪ', i:'ɪ aɪ i ə j', o:'ɑ oʊ ʌ ə ɔ u ʊ', u:'ʌ u ʊ ə ɪ ju', y:'i aɪ ɪ j',
  b:'b', c:'k s ʃ', d:'d t dʒ', f:'f', g:'ɡ dʒ ʒ', h:'h', j:'dʒ', k:'k', l:'l', m:'m', n:'n ŋ', p:'p', q:'k', r:'ɹ ɚ',
  s:'s z ʃ ʒ', t:'t tʃ ʃ', v:'v', w:'w', x:'ks z ɡz', z:'z',
  ch:'tʃ k ʃ', sh:'ʃ', th:'θ ð', ph:'f', wh:'w h', gh:'f', ck:'k', kn:'n', gn:'n ɡn', wr:'ɹ', mb:'m mb', ng:'ŋ ŋɡ ndʒ',
  dge:'dʒ', tch:'tʃ', qu:'kw k', sch:'sk ʃ', rh:'ɹ', ps:'s',
  ai:'eɪ ɛ', ay:'eɪ', ea:'i ɛ eɪ', ee:'i ɪ', ei:'eɪ i aɪ', ey:'i eɪ', ie:'i aɪ ɛ', oa:'oʊ', oe:'oʊ u', oo:'u ʊ ʌ',
  ou:'aʊ u ʌ oʊ ʊ ə', ow:'aʊ oʊ', ue:'u ju', ui:'u ɪ', ew:'u ju', au:'ɔ ɑ', aw:'ɔ',
  ar:'ɑɹ ɚ ɛɹ ɔɹ æɹ ɑ', er:'ɚ ɛɹ ɪɹ ɹ', ir:'ɚ aɪɹ ɪɹ', or:'ɔɹ ɚ oʊɹ ɔ ɹ', ur:'ɚ ʊɹ jʊɹ', oi:'ɔɪ oʊɪ', oy:'ɔɪ',
  igh:'aɪ', eigh:'eɪ aɪ', ough:'ɔ oʊ ʌf ɑf u aʊ ʌ', augh:'ɔ æf', tion:'ʃən ʃn tʃən', sion:'ʒən ʃən ʒn ʃn',
  bb:'b', cc:'k ks', dd:'d', ff:'f', gg:'ɡ', ll:'l', mm:'m', nn:'n', pp:'p', rr:'ɹ', ss:'s z ʃ', tt:'t', zz:'z' };
const CLASSIC = {}; for(const g of Object.keys(CLASSIC_SRC)) CLASSIC[g] = new Set(CLASSIC_SRC[g].split(' '));
const VOWPH = new Set(['i','ɪ','ɛ','æ','ɑ','ɔ','ʊ','u','ʌ','ə','ɚ','eɪ','aɪ','ɔɪ','oʊ','aʊ']);
const GLIDE = new Set(['j','w']), PALATAL = new Set(['ʃ','ʒ','tʃ','dʒ']);
const hasVowelLetter = (g) => /[aeiouy]/.test(g), hasConsLetter = (g) => /[bcdfghjklmnpqrstvwxz]/.test(g);

/* Coût d'un mouvement : le groupe de lettres g rend les phonèmes phs (0, 1, 2 ou 3 sons).
   0 = exactement ce que le modèle prédit ici · ≤ 1 = une lecture connue (modèle ou phonics classique) · ≤ 1,5 = régulier
   par une règle générale (schwa, glide + voyelle, consonne syllabique, palatalisation, -ed -> t, r non prononcé) ·
   3 et plus = inhabituel · 4 et plus = quasi impossible (consonne écrite -> voyelle, voyelle écrite -> consonne). */
function moveCost(g, pred, phs, known, prevG){
  const k = phs.length, key = phs.join('');
  if(k === 0){
    if(pred === '') return 0.5;
    if(g.includes('r') && !hasVowelLetter(g)) return 0.5;                          // transcription non rhotique (yourself)
    if(g === 'i' && /^(c|t|s|ss)$/.test(prevG)) return 0.5;                         // special, nation, mission
    if(g === 'u' && /^(g|q)$/.test(prevG)) return 0.5;                              // guard, guest
    if(g === 'e') return 1;                                                         // e muet médian (something) : fréquent, dit quand même
    return 1.5;
  }
  if(key === normKey(pred)) return 0;
  const cls = CLASSIC[g];
  if(known.has(key) || (cls && cls.has(key))) return k === 1 ? 1 : 0.5;
  if(k === 1){
    const p = phs[0];
    if(p === 'ɚ' && g.includes('r')) return 1;
    if(p === 'ə' && hasVowelLetter(g)) return 1;                                     // la réduction en schwa est la règle
    if(PALATAL.has(p) && /^(c|t|s|d|z|x|g|ss|tt)$/.test(g)) return 1;                // palatalisation devant i/u (actual, measure)
    if(g === 'd' && p === 't') return 1;                                            // -ed assourdi (asked)
    const gV = hasVowelLetter(g), pV = VOWPH.has(p);
    if(!gV && pV && !/^(r|w|y)$/.test(g)) return 4;
    if(gV && !hasConsLetter(g) && !pV && !GLIDE.has(p)) return 4;
    return 3;
  }
  if(k === 2){
    const [p1, p2] = phs;
    if(hasVowelLetter(g) && GLIDE.has(p1) && VOWPH.has(p2)) return 1.5;             // one, once, european, union
    if(/^(l|n|m|le|el)$/.test(g) && p1 === 'ə' && p2 === g.charAt(0)) return 0.5;    // castle, button, rhythm
    if(known.has(p1) && VOWPH.has(p2)) return 2.5;
    return 3.5;
  }
  return 4.5;
}

// ---- 3) alignement phonèmes du dictionnaire <-> groupes de lettres (monotone, programmation dynamique)
function align(T, steps, ph){
  const n = steps.length, m = ph.length, INF = 1e9;
  const D = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF));
  const B = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
  D[0][0] = 0;
  for(let i = 0; i < n; i++){
    const g = steps[i].g, pred = steps[i].ph, known = knownSounds(T, g), prevG = i > 0 ? steps[i-1].g : '';
    for(let j = 0; j <= m; j++){
      if(D[i][j] >= INF) continue;
      // ordre = préférence à coût égal : un son, deux, trois, puis muette (« women » : w->w + o->ɪ, pas w muet + o->wɪ)
      for(const k of [1, 2, 3, 0]){
        if(j + k > m) continue;
        const c = D[i][j] + moveCost(g, pred, ph.slice(j, j + k), known, prevG);
        if(c < D[i+1][j+k]){ D[i+1][j+k] = c; B[i+1][j+k] = [i, j, k]; }
      }
    }
  }
  if(D[n][m] >= INF) return null;
  const out = []; let i = n, j = m;
  while(i > 0){
    const [pi, pj, k] = B[i][j], g = steps[pi].g, pred = steps[pi].ph, known = knownSounds(T, g), prevG = pi > 0 ? steps[pi-1].g : '';
    const phs = ph.slice(pj, pj + k), c = moveCost(g, pred, phs, known, prevG);
    const kind = k === 0 ? (c <= 1 ? 'silent' : 'silent-unusual') : (c <= 1.5 ? 'regular' : 'unusual');
    out.push({ g: g, phs: phs, ph: phs.join(''), pred: pred, predPhs: splitPh(pred), kind: kind });
    i = pi; j = pj;
  }
  return { rows: out.reverse(), cost: D[n][m] };
}

// ---- 4) syllabes et structure CV sur les PHONÈMES, remappées aux groupes de lettres
const SYLLABIC = new Set(['l','ɹ','m','n']), LIQ = new Set(['l','ɹ','w','j']);
function legalOnset(ps){
  if(ps.length <= 1) return true;
  if(ps.length === 2) return ps[0] === 's' || LIQ.has(ps[1]);
  if(ps.length === 3) return ps[0] === 's' && LIQ.has(ps[2]);
  return false;
}
/* Unités = un son chacune (un groupe à plusieurs sons est dédoublé, ses lettres portées par la première unité). */
function units(rows){
  const U = [];
  for(const r of rows){
    if(!r.phs || !r.phs.length){ U.push({ g: r.g, ph: '' }); continue; }
    r.phs.forEach((p, k) => U.push({ g: k === 0 ? r.g : '', ph: p }));
  }
  return U;
}
function syllables(rows){
  const U = units(rows);
  const nuc = [];
  for(let i = 0; i < U.length; i++){
    const ph = U[i].ph; if(!ph) continue;
    if(VOWPH.has(ph)){ nuc.push(i); continue; }
    if(SYLLABIC.has(ph)){
      let prevV = false; for(let a = i - 1; a >= 0; a--){ if(U[a].ph){ prevV = VOWPH.has(U[a].ph); break; } }
      let nextC = true; for(let b = i + 1; b < U.length; b++){ if(U[b].ph){ nextC = !VOWPH.has(U[b].ph); break; } }
      if(!prevV && nextC) nuc.push(i);
    }
  }
  if(nuc.length < 2) return [U.map(u => u.g).join('')];
  const cuts = [0];
  for(let k = 0; k < nuc.length - 1; k++){
    const A = nuc[k], Bn = nuc[k+1], inter = U.slice(A + 1, Bn); let cut = Bn;
    for(let L = Math.min(3, inter.length); L >= 0; L--){
      const tail = []; for(let x = inter.length - L; x < inter.length; x++){ if(inter[x].ph) tail.push(inter[x].ph); }
      if(L === 0 || legalOnset(tail)){ cut = Bn - L; break; }
    }
    cuts.push(cut);
  }
  cuts.push(U.length);
  const out = [];
  for(let c = 0; c < cuts.length - 1; c++){ let seg = ''; for(let j = cuts[c]; j < cuts[c+1]; j++) seg += U[j].g; if(seg) out.push(seg); }
  return out;
}
function cvOf(phs){ return phs.map(p => VOWPH.has(p) ? 'V' : (LIQ.has(p) && !SYLLABIC.has(p) ? 'G' : 'C')).join(''); }

// ---- 5) l'entrée unique de la page : décomposer un mot.  T = tables g2p ; ipaOf(word) -> IPA du dictionnaire ou null
function decompose(T, word, ipaOf){
  const w = (word || '').toLowerCase().replace(/[^a-z]/g, '');
  if(!w) return null;
  const steps = g2pSteps(T, w);
  const predicted = steps.map(s => s.ph);
  const ipaRaw = ipaOf ? ipaOf(w) : null;
  const ph = dictPhonemes(ipaRaw);
  const asPred = () => steps.map(s => ({ g: s.g, phs: splitPh(s.ph), ph: s.ph, pred: s.ph, predPhs: splitPh(s.ph), kind: s.ph ? 'regular' : 'silent' }));
  let rows, source, aligned = true;
  if(ph){
    const a = align(T, steps, ph);
    if(a){ rows = a.rows; source = 'dictionary'; }
    else { rows = asPred(); source = 'dictionary'; aligned = false; }
  } else { rows = asPred(); source = 'predicted'; }
  const phons = ph || predicted.filter(Boolean).flatMap(splitPh);
  return { word: w, source: source, aligned: aligned, ipa: ipaRaw ? String(ipaRaw).split(/[,;]/)[0].trim() : null,
           phonemes: phons, predicted: predicted.join(''), rows: rows, syllables: syllables(rows), cv: cvOf(phons),
           unusual: rows.filter(r => r.kind === 'unusual' || r.kind === 'silent-unusual').length };
}

// ---- 6) lecture du dictionnaire : colonne IPA de lex_en.tsv (surface \t pos \t ipa …)
function parseIpaText(raw){
  const m = new Map(); const lines = raw.split('\n');
  for(let i = 1; i < lines.length; i++){ const c = lines[i].split('\t'); if(c.length > 2 && c[0] && c[2]) m.set(c[0], c[2]); }
  return m;
}

const API = { segIpa, canon, splitPh, dictPhonemes, g2pSteps, knownSounds, moveCost, align, syllables, cvOf, decompose, parseIpaText, VOWPH, EN_PHON, CLASSIC };
if(typeof module !== 'undefined' && module.exports) module.exports = API;
if(root) root.PhonicsEN = API;
})(typeof window !== 'undefined' ? window : null);
