#!/usr/bin/env node
/* CHUNKER DE GROUPE NOMINAL ANGLAIS — la brique qui manque sous TOUTES les règles d'accord.
 *
 * POURQUOI ELLE EST NÉCESSAIRE, ET CE N'EST PAS UNE INTUITION. Trois règles d'accord anglaises ont
 * été construites, mesurées et RÉFUTÉES le 2026-08-08, et les trois ont buté sur LA MÊME chose :
 *   · accord en NOMBRE déterminant-nom -> « these plant families » : la règle lisait `plant` comme
 *     tête alors que la tête est `families`. En anglais un nom en modifie un autre, et c'est le
 *     DERNIER du composé qui porte l'accord.
 *   · discriminateur ADP/SCONJ -> pour savoir si une préposition introduit un GN ou une proposition,
 *     il faut savoir où le GN FINIT.
 *   · accord sujet-verbe sur BE -> marche avec un sujet pronominal, mais les erreurs réelles de
 *     JFLEG ont des sujets NOMINAUX ; sans la tête du GN, rappel NUL.
 * ⇒ Le tagger (90,7 %) n'est plus le facteur limitant. C'est l'absence de chunker nominal.
 *
 * CE QUE FAIT LE CHUNKER, ET RIEN DE PLUS. Il ne construit pas d'arbre. Il répond à UNE question :
 * **pour chaque mot, quelle est la TÊTE de son groupe nominal ?** C'est tout ce dont les règles
 * d'accord ont besoin. Patron classique, sur les tags seuls :
 *     (DET | NUM | ADJ | NOUN | PROPN)+   ->   tête = le DERNIER NOUN/PROPN du groupe
 *
 * LE GOLD, ET POURQUOI IL EST HONNÊTE. UD annote la relation `det` : elle pointe du DÉTERMINANT
 * vers SON nom-tête. On mesure donc exactement ce qui nous intéresse — « ce déterminant, à quel nom
 * se rattache-t-il ? » — sans avoir à inventer une notion de chunk. Idem `amod` (adjectif->nom) et
 * `compound` (nom modifieur -> nom-tête), qui testent le piège du nom épithète.
 * ⚠️ On tague avec NOTRE tagger (pas les tags gold) : on mesure la chaîne TELLE QU'ELLE TOURNERA,
 * erreurs de tagging comprises. Un score obtenu sur des tags parfaits serait un mirage.
 *
 *   node dictee/np_chunk_en_probe.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.dirname(__dirname);
const C = require(path.join(RACINE, 'dictee', 'corrector_en.js'));

const P = path.join(RACINE, 'data_local', 'en', 'en_pud-ud-test.conllu');
if (!fs.existsSync(P)) {
  console.log('UD English-PUD absent (data_local/en) — sonde locale seulement.');
  process.exit(0);
}
const M = JSON.parse(fs.readFileSync(path.join(RACINE, 'dictee', 'pos_hmm_en.json'), 'utf8'));
C.setPosModel(M);

/* LE CHUNKER. Renvoie un tableau `tete` : tete[i] = index de la tête du GN de i, ou -1.
   ⚠️ `NUM` est INCLUS dans le groupe (« two feature films ») mais ne peut pas être tête.
   ⚠️ Un PRONOM coupe le groupe : « we the people » n'est pas un GN unique. */
const _NP_IN = new Set(['DET', 'NUM', 'ADJ', 'NOUN', 'PROPN']);
const _NP_HEAD = new Set(['NOUN', 'PROPN']);
function npChunk(tags) {
  const tete = new Array(tags.length).fill(-1);
  let i = 0;
  while (i < tags.length) {
    if (!_NP_IN.has(tags[i])) { i++; continue; }
    let j = i;
    while (j + 1 < tags.length && _NP_IN.has(tags[j + 1])) j++;
    let h = -1;
    for (let k = j; k >= i; k--) if (_NP_HEAD.has(tags[k])) { h = k; break; }
    if (h >= 0) for (let k = i; k <= j; k++) tete[k] = h;
    i = j + 1;
  }
  return tete;
}

let mots = [], gold = [], head = [], rel = [];
const stat = new Map();
function fin() {
  if (!mots.length) return;
  const t = C.tagSentence(mots, M);
  const te = npChunk(t);
  for (let i = 0; i < mots.length; i++) {
    const r = rel[i];
    if (r !== 'det' && r !== 'amod' && r !== 'compound') continue;
    if (!stat.has(r)) stat.set(r, [0, 0, []]);
    const s = stat.get(r);
    s[1]++;
    if (te[i] === head[i]) s[0]++;
    else if (s[2].length < 3)
      s[2].push(mots[i] + ' -> ' + (te[i] >= 0 ? mots[te[i]] : '∅') + ' (gold : ' + mots[head[i]] + ')');
  }
  mots = []; gold = []; head = []; rel = [];
}

for (const l of fs.readFileSync(P, 'utf8').split('\n')) {
  if (!l.trim()) { fin(); continue; }
  if (l[0] === '#') continue;
  const c = l.split('\t');
  if (c.length < 8 || c[0].includes('-')) continue;
  mots.push(c[1]); gold.push(c[3]); head.push(parseInt(c[6], 10) - 1); rel.push(c[7]);
}
fin();

console.log('CHUNKER DE GN ANGLAIS — le rattachement est-il le bon ?\n');
console.log('  (tagué par NOTRE tagger, erreurs comprises — pas par les tags gold)\n');
let tot = 0, ok = 0;
console.log('  ' + 'relation'.padEnd(12) + 'n'.padStart(7) + 'juste'.padStart(9));
for (const [r, s] of [...stat.entries()].sort((a, b) => b[1][1] - a[1][1])) {
  tot += s[1]; ok += s[0];
  console.log('  ' + r.padEnd(12) + String(s[1]).padStart(7) + (100 * s[0] / s[1]).toFixed(1).padStart(8) + ' %');
}
console.log('  ' + 'TOTAL'.padEnd(12) + String(tot).padStart(7) + (100 * ok / tot).toFixed(1).padStart(8) + ' %');
console.log('\n  erreurs de rattachement (échantillon, à LIRE avant de conclure) :');
for (const [r, s] of stat) s[2].forEach(x => console.log('    ' + r + ' : ' + x));
