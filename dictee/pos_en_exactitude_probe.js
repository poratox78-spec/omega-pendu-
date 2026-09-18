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
 *   node dictee/pos_en_exactitude_probe.js [--check]      (--check : plancher d'exactitude, CI ; l'or est COMMITTÉ, pos_en_gold.tsv)
 *
 * 18/09/2026 — **91,6 %** : table d'émission « avec majuscule » (le mot capitalisé en milieu de phrase a sa distribution :
 *   American ADJ, Court PROPN — la post-passe PROPN ne force plus les mots que le modèle a vus ainsi) + post-passes be/have
 *   (existentiel « there is » = VERB, possession « has a » = VERB), more/most, préposition + gérondif = SCONJ, chiffres romains.
 *   Ce qui reste : NOUN↔PROPN (convention entre corpus : EWT tague « the Court », « President » PROPN, PUD NOUN) et VERB↔NOUN
 *   (plafond du bigramme). Perceptron moyenné mesuré : 93,2 % pour ~2 Mo de poids et un double portage — pas maintenant.
 *   L'or vit désormais dans le dépôt (dictee/pos_en_gold.tsv, CC BY-SA 3.0, bâti par build_pos_gold_en.py) : le plancher
 *   rougit en CI si le modèle ou une post-passe régresse.
 *
 * MESURÉ (2026-08-08, APRÈS les post-passes PROPN et `that`) — 18 693 tokens, **90,5 %** :
 *   DET 98,6 · AUX 98,8 · CCONJ 98,8 · ADP 95,7 · PRON 94,7 · PROPN 93,5 · NUM 93,3
 *   PART 90,0 · ADJ 87,8 · VERB 86,6 · ADV 85,7 · SCONJ 58,8
 *
 * ⭐ PROPN EST RÉPARÉ (59,2 -> 93,5 %, +1,19 pt d'exactitude GLOBALE à lui seul). La cause était
 *   dans `le()` : la table d'émission est indexée en MINUSCULES, donc pour un mot CONNU la
 *   MAJUSCULE ne pesait rien — le bonus PROPN ne s'appliquait qu'aux mots inconnus. `_propnPass`
 *   la rend au tagger. Le plus mauvais score portait sur l'indice le plus simple de l'écrit anglais.
 *
 * ⭐ IL RESTE SCONJ, et c'est le plus PÉNALISANT :
 *   · SCONJ 58,8 % (84 lus ADP) — une conjonction de subordination MARQUE UNE
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

const PLANCHER = 91.5;                                  // cliquet — 90,7 % jusqu'au 18/09/2026, 91,65 % depuis (table majuscule + post-passes) ; retirer les post-passes rend 91,24, la table 91,07
const P = path.join(RACINE, 'dictee', 'pos_en_gold.tsv');   // or COMMITTÉ (UD English-PUD, CC BY-SA 3.0) — la sonde ne peut plus sauter
if (!fs.existsSync(P)) { console.log('✗ dictee/pos_en_gold.tsv absent (bâti par build_pos_gold_en.py) — la mesure serait MUETTE'); process.exit(1); }
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
  if (c.length !== 2) continue;
  mots.push(c[0]); gold.push(c[1]);
}
finPhrase();
if (tot < 18000) { console.log('✗ or tronqué : ' + tot + ' tokens'); process.exit(1); }

console.log('EXACTITUDE DU TAGGER ANGLAIS — UD English-PUD (gold annoté main, ponctuation exclue)\n');
console.log('  ' + tot + ' tokens · exactitude ' + (100 * ok / tot).toFixed(1) + ' %'
            + '   (référence : le tagger FR est à ~95 %)');
console.log('\n  par classe :');
[...parClasse.entries()].sort((a, b) => b[1][1] - a[1][1]).forEach(([k, v]) =>
  console.log('    ' + k.padEnd(7) + String(v[1]).padStart(6) + '   ' + (100 * v[0] / v[1]).toFixed(1) + ' %'));
console.log('\n  confusions principales :');
[...conf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, v]) =>
  console.log('    ' + String(v).padStart(4) + '  ' + k));
console.log('\n  Note : SCONJ (60,2 %) reste le point faible qui COÛTE : une conjonction de subordination');
console.log('     marque une FRONTIÈRE DE PROPOSITION. La lire comme une préposition, c\'est perdre');
console.log('     la frontière — et toute détection de SUJET en a besoin. un discriminateur naïf ADP->SCONJ a été');
console.log('     TESTÉ ET RÉFUTÉ (-0,25 pt) : il faut savoir où finit le groupe nominal, donc parser.');
if (process.argv.includes('--check')) {
  const ex = 100 * ok / tot, ok2 = ex >= PLANCHER;
  console.log('[check] %s — exactitude %s %% (plancher %s %%) sur %d tokens', ok2 ? 'OK' : 'ÉCHEC', ex.toFixed(2), PLANCHER, tot);
  if (!ok2) process.exit(1);
}
