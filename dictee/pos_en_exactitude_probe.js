#!/usr/bin/env node
/* CE QUE VAUT LE TAGGER ANGLAIS — mesuré contre du GOLD, pour la première fois.
 *
 * POURQUOI ÇA VIENT AVANT TOUT LE RESTE. Le mur anglais est le CONTEXTE, pas le lexique : kaikki
 * sur-verbifie (presque tout nom anglais est aussi un verbe), donc l'appartenance lexicale ne
 * tranche rien et c'est le TAGGER qui décide. `homoDecide`, `pastPartDecide`, et toute future
 * règle de sujet ou d'accord s'appuient sur lui. Son exactitude est donc le PLAFOND de tout ce
 * qu'on pourra construire au-dessus — et personne ne l'avait chiffrée.
 * `parity_pos_en.js` vérifiait la PARITÉ entre moteurs (ils disent la même chose), jamais la
 * JUSTESSE (ce qu'ils disent est-il vrai). Deux questions différentes.
 *
 * LE GOLD : UD English-PUD (CC BY-SA 3.0, 1 000 phrases, traducteurs professionnels), colonne 4 =
 * UPOS annoté à la main. La ponctuation et les symboles sont exclus : les tagger dessus est trivial
 * et gonflerait le score de plusieurs points.
 *
 *   node dictee/pos_en_exactitude_probe.js
 *
 * MESURÉ (2026-08-08) — 18 693 tokens, exactitude 89,2 % (le FR est à ~95 %) :
 *   DET 98,6 · AUX 98,8 · CCONJ 98,8 · ADP 95,7 · PRON 94,7 · NUM 93,3 · NOUN 92,4
 *   PART 90,0 · ADJ 87,8 · VERB 86,6 · ADV 85,7 · PROPN 59,2 · SCONJ 58,8
 *
 * ⭐ LES DEUX POINTS FAIBLES, ET ILS N'ONT PAS LE MÊME COÛT :
 *   · PROPN 59,2 % (558 lus NOUN) — le plus gros volume, mais le MOINS grave : les deux sont
 *     nominaux, et les règles qui distinguent le nom propre le font déjà par la MAJUSCULE, pas par
 *     le tag. À surveiller, pas à traiter en premier.
 *   · SCONJ 58,8 % (84 lus ADP) — le plus PÉNALISANT. Une conjonction de subordination MARQUE UNE
 *     FRONTIÈRE DE PROPOSITION. La confondre avec une préposition, c'est perdre la frontière — et
 *     toute détection de SUJET a besoin de savoir où commence et finit la proposition.
 *     ⇒ **Avant de construire un parseur de sujet anglais, c'est ici qu'il faut regarder.**
 *     C'est le pendant anglais du « mur du sujet » français, mais un cran plus bas : là-bas le
 *     tagger est bon et c'est la syntaxe qui bloque ; ici le tagger lui-même laisse filer la
 *     frontière.
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.dirname(__dirname);
const C = require(path.join(RACINE, 'dictee', 'corrector_en.js'));

const P = path.join(RACINE, 'data_local', 'en', 'en_pud-ud-test.conllu');
if (!fs.existsSync(P)) {
  console.log('UD English-PUD absent (data_local/en) — sonde locale seulement.');
  console.log('  https://github.com/UniversalDependencies/UD_English-PUD  (CC BY-SA 3.0)');
  process.exit(0);
}
const M = JSON.parse(fs.readFileSync(path.join(RACINE, 'dictee', 'pos_hmm_en.json'), 'utf8'));
C.setPosModel(M);

let mots = [], gold = [], ok = 0, tot = 0;
const conf = new Map(), parClasse = new Map();

function finPhrase() {
  if (!mots.length) return;
  const t = C.tagSentence(mots, M);
  for (let i = 0; i < mots.length; i++) {
    const g = gold[i];
    if (g === 'PUNCT' || g === 'SYM') continue;      // trivial à taguer -> gonflerait le score
    tot++;
    const p = t[i];
    if (!parClasse.has(g)) parClasse.set(g, [0, 0]);
    parClasse.get(g)[1]++;
    if (p === g) { ok++; parClasse.get(g)[0]++; }
    else { const k = g + ' lu ' + p; conf.set(k, (conf.get(k) || 0) + 1); }
  }
  mots = []; gold = [];
}

for (const l of fs.readFileSync(P, 'utf8').split('\n')) {
  if (!l.trim()) { finPhrase(); continue; }
  if (l[0] === '#') continue;
  const c = l.split('\t');
  if (c.length < 5 || c[0].includes('-')) continue;   // lignes de tokens composés (don't -> do n't)
  mots.push(c[1]); gold.push(c[3]);
}
finPhrase();

console.log('EXACTITUDE DU TAGGER ANGLAIS — UD English-PUD (gold annoté main, ponctuation exclue)\n');
console.log('  ' + tot + ' tokens · exactitude ' + (100 * ok / tot).toFixed(1) + ' %'
            + '   (référence : le tagger FR est à ~95 %)');
console.log('\n  par classe :');
[...parClasse.entries()].sort((a, b) => b[1][1] - a[1][1]).forEach(([k, v]) =>
  console.log('    ' + k.padEnd(7) + String(v[1]).padStart(6) + '   ' + (100 * v[0] / v[1]).toFixed(1) + ' %'));
console.log('\n  confusions principales :');
[...conf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, v]) =>
  console.log('    ' + String(v).padStart(4) + '  ' + k));
console.log('\n  ⚠️ SCONJ (58,8 %) est le point faible qui COÛTE : une conjonction de subordination');
console.log('     marque une FRONTIÈRE DE PROPOSITION. La lire comme une préposition, c\'est perdre');
console.log('     la frontière — et toute détection de SUJET en a besoin. PROPN (59,2 %) est plus');
console.log('     gros en volume mais moins grave : NOUN et PROPN sont tous deux nominaux.');
