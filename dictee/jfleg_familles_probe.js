#!/usr/bin/env node
/* QUELLES FAMILLES DE FAUTES ANGLAISES RATONS-NOUS ? — choisir la prochaine règle par la MESURE.
 *
 * POURQUOI CETTE SONDE. Le correcteur anglais est PRÉCIS et ÉTROIT : 0,0028 % de FP sur texte
 * édité, 94,5 % de justesse sur ce qu'il propose — mais ~8 familles de règles contre ~52 en
 * français. La question n'est donc pas « est-il juste » (oui) mais « que ne voit-il pas ».
 * Choisir la famille suivante à l'intuition serait la faute de méthode que ce projet combat :
 * on la choisit sur du fautif RÉEL APPARIÉ.
 *
 * LA SOURCE. JFLEG (Napoles, Sakaguchi & Tetreault) : 1 501 phrases d'apprenants, QUATRE
 * corrections indépendantes chacune. <https://github.com/keisks/jfleg>
 * ⚠️ CC BY-NC-SA 4.0 -> reste dans `data_local/`, JAMAIS commité (comme GUM et l'OQLF).
 *
 * MÉTHODE. Pour chaque phrase on aligne la version fautive et UNE référence (mot à mot, DP), on
 * extrait les corrections que les annotateurs ont faites, et on regarde lesquelles le correcteur
 * NE propose PAS. Ces ratés sont classés par famille grammaticale. Le classement qui en sort est
 * la liste de travail, ordonnée par fréquence RÉELLE et non par facilité.
 *
 * ⚠️ CE QUE ÇA NE DIT PAS. Une famille fréquente n'est pas forcément traitable à FP=0 : JFLEG dit
 * ce que les apprenants ratent, pas ce que le tagger sait trancher. Le classement est une liste de
 * CANDIDATS ; chacun demandera sa mesure de FP sur texte édité avant d'être écrit.
 * ⚠️ Et JFLEG est de l'écrit d'APPRENANTS de l'anglais, pas de dyslexiques anglophones — les deux
 * populations partagent beaucoup (morphologie, accord) mais pas tout. À lire comme une
 * approximation honnête, la meilleure qu'on ait tant qu'on n'a pas de corpus dys anglais apparié.
 *
 *   node dictee/jfleg_familles_probe.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.dirname(__dirname);
const C = require(path.join(RACINE, 'dictee', 'corrector_en.js'));

const DIR = path.join(RACINE, 'data_local', 'en', 'jfleg');
if (!fs.existsSync(path.join(DIR, 'dev.src'))) {
  console.log('JFLEG absent (data_local/en/jfleg) — sonde locale seulement.');
  console.log('  https://github.com/keisks/jfleg  (CC BY-NC-SA 4.0 — ne pas commiter)');
  process.exit(0);
}

const lex = C.loadLexNode(path.join(RACINE, 'dictee', 'lex_en.tsv.gz'));
try {
  const mp = path.join(RACINE, 'dictee', 'pos_hmm_en.json');
  if (fs.existsSync(mp)) C.setPosModel(JSON.parse(fs.readFileSync(mp, 'utf8')));
} catch (e) {}

const lignes = f => fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
const mots = s => (s.match(/[A-Za-z]+(?:'[A-Za-z]+)*/g) || []);

// ---------- alignement mot à mot (DP) ----------
function align(a, b) {
  const n = a.length, m = b.length;
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => i === 0 ? j : (j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const c = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
  }
  const ops = []; let i = n, j = m;
  while (i > 0 || j > 0) {
    const c = (i > 0 && j > 0 && a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) ? 0 : 1;
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + c) { ops.push([c ? 'sub' : '=', a[i - 1], b[j - 1]]); i--; j--; }
    else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { ops.push(['del', a[i - 1], null]); i--; }
    else { ops.push(['ins', null, b[j - 1]]); j--; }
  }
  return ops.reverse();
}

// ---------- classement en FAMILLES grammaticales ----------
const ART = new Set(['a', 'an', 'the']);
const PREP = new Set(['of', 'to', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'about', 'into', 'over', 'after', 'as']);
const BE = new Set(['is', 'are', 'was', 'were', 'be', 'been', 'am', 'being']);
const AUX = new Set(['do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must']);

function famille(bad, good) {
  const b = (bad || '').toLowerCase(), g = (good || '').toLowerCase();
  if (!b) return ART.has(g) ? 'article OUBLIÉ' : (PREP.has(g) ? 'préposition OUBLIÉE' : 'mot oublié');
  if (!g) return ART.has(b) ? 'article EN TROP' : (PREP.has(b) ? 'préposition EN TROP' : 'mot en trop');
  if (ART.has(b) && ART.has(g)) return 'article (a/an/the)';
  if (PREP.has(b) && PREP.has(g)) return 'préposition (choix)';
  if (BE.has(b) && BE.has(g)) return 'accord/temps de BE';
  if (AUX.has(b) && AUX.has(g)) return 'auxiliaire';
  // morphologie sur le MÊME radical
  const rac = (w) => w.replace(/(ies|es|s|ing|ed|d)$/, '');
  if (rac(b) === rac(g) && rac(b).length >= 3) {
    const suf = (w) => (w.match(/(ies|es|s|ing|ed|d)$/) || [''])[0];
    const sb = suf(b), sg = suf(g);
    if ((sb === 's' || sb === 'es' || sb === 'ies' || sb === '') && (sg === 's' || sg === 'es' || sg === 'ies' || sg === ''))
      return 'nombre / accord 3sg (-s)';
    if (sb === 'ing' || sg === 'ing') return '-ing / forme verbale';
    if (sb === 'ed' || sg === 'ed' || sb === 'd' || sg === 'd') return '-ed / prétérit-participe';
    return 'morphologie (autre suffixe)';
  }
  if (b.length > 2 && g.length > 2 && b[0] === g[0]) {
    let diff = 0, L = Math.max(b.length, g.length);
    for (let k = 0; k < L; k++) if (b[k] !== g[k]) diff++;
    if (diff <= 2 && Math.abs(b.length - g.length) <= 2) return 'orthographe (proche)';
  }
  return 'lexique / reformulation';
}

/* ---------- ce que le correcteur propose sur un token ----------
   ⭐ REND AUSSI LE NIVEAU, et c'est une CORRECTION DE MESURE, pas un enrichissement cosmétique.
   La version précédente ne rendait que le ROUGE : tout ce que le correcteur signale en ORANGE
   tombait dans la colonne « RATÉ ». Or l'orange EST livré à l'utilisateur — c'est même la réponse
   au doute chez nous, pas un demi-silence. Mesuré sur la seule famille « orthographe (proche) » :
   73 rouges, mais 120 oranges JUSTES en plus, comptés comme des échecs. Le tableau sous-estimait
   donc massivement ce qui arrive à l'écran, et pointait l'effort vers des familles déjà couvertes.
   Trois colonnes désormais : ROUGE (affirmé) · orange (signalé) · raté (rien). */
function propose(T, i, prot, adj) {
  if (prot.has(i)) return [null, null];
  const pp = C.pastPartDecide(lex, T, i);
  if (pp[1]) return [pp[0], pp[1]];
  const h = C.homoDecide(lex, T, i, adj);
  if (h[1]) return [h[0], h[1]];
  const sp = C.spellSuggest(lex, T[i], i > 0 ? T[i - 1].toLowerCase() : '');
  if (sp[1] === 'AUTO') return [sp[0], 'RED'];
  if (sp[1] === 'FLAG') return [sp[0], 'ORANGE'];
  return [null, null];
}

const attrape = new Map(), orange = new Map(), rate = new Map(), ex = new Map();
let nCorr = 0, nAttr = 0, nOr = 0;

for (const set of ['dev', 'test']) {
  const src = lignes(set + '.src'), ref = lignes(set + '.ref0');
  for (let s = 0; s < src.length; s++) {
    const t = src[s], r = ref[s];
    if (!t || !t.trim() || !r || !r.trim()) continue;
    const a = mots(t), b = mots(r);
    if (!a.length || Math.abs(a.length - b.length) > 8) continue;   // reformulation lourde : alignement peu fiable
    const T = C.tokenize(t), prot = C.urlMask(t), adj = C.adjMask(t);
    const ops = align(a, b);
    let ia = 0;
    for (const [op, x, y] of ops) {
      if (op === '=') { ia++; continue; }
      nCorr++;
      const f = famille(x, y);
      const [sugg, tier] = (op !== 'ins' && ia < T.length) ? propose(T, ia, prot, adj) : [null, null];
      const ok = sugg && String(sugg).toLowerCase() === String(y || '').toLowerCase();
      if (ok && tier === 'RED') { nAttr++; attrape.set(f, (attrape.get(f) || 0) + 1); }
      else if (ok) { nOr++; orange.set(f, (orange.get(f) || 0) + 1); }
      else {
        rate.set(f, (rate.get(f) || 0) + 1);
        if (!ex.has(f)) ex.set(f, []);
        if (ex.get(f).length < 4) ex.get(f).push((x || '∅') + ' -> ' + (y || '∅'));
      }
      if (op !== 'ins') ia++;
    }
  }
}

console.log('FAMILLES DE FAUTES ANGLAISES — ce que le correcteur attrape et ce qu\'il rate\n');
// ⚠️ Node ne gère PAS les largeurs de champ façon printf (« %-30s ») : il les imprime telles
// quelles. D'où padEnd/padStart explicites — la première version rendait le tableau illisible.
const pad = (s, n) => String(s).padEnd(n), num = (s, n) => String(s).padStart(n);
const pc = (k) => (100 * k / Math.max(1, nCorr)).toFixed(1);
console.log('  JFLEG dev+test · ' + nCorr + ' corrections d\'annotateurs alignées'
            + '\n    ROUGE (affirmé)  ' + num(nAttr, 5) + '  (' + pc(nAttr) + ' %)'
            + '\n    orange (signalé) ' + num(nOr, 5) + '  (' + pc(nOr) + ' %)'
            + '\n    → vu par l\'utilisateur ' + num(nAttr + nOr, 5) + '  (' + pc(nAttr + nOr) + ' %)\n');
const toutes = [...new Set([...attrape.keys(), ...orange.keys(), ...rate.keys()])];
toutes.sort((x, y) => (rate.get(y) || 0) - (rate.get(x) || 0));
console.log('  ' + pad('famille', 30) + num('RATÉ', 7) + num('ROUGE', 7) + num('orange', 8) + '   exemples');
for (const f of toutes) {
  const r = rate.get(f) || 0, at = attrape.get(f) || 0, or = orange.get(f) || 0;
  console.log('  ' + pad(f, 30) + num(r, 7) + num(at, 7) + num(or, 8) + '   ' + (ex.get(f) || []).slice(0, 3).join(' · '));
}
console.log('\n  ⚠️ Fréquent ≠ traitable à FP=0. Ce classement donne des CANDIDATS ; chacun demande');
console.log('     sa mesure de FP sur texte ÉDITÉ (fp_en_propre_probe.js) avant d\'être écrit.');
console.log('  ⚠️ RATÉ ne veut pas dire « pas de règle » : « mot en trop », « mot oublié » et les');
console.log('     prépositions sont à 0 parce qu\'on ne fait PAS d\'insertion ni de suppression —');
console.log('     c\'est un choix, pas un trou. Ne pas lire ces lignes comme un retard à rattraper.');
