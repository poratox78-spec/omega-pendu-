#!/usr/bin/env node
/* PENDU SANS LONGUEUR — sonde de faisabilité (03/11/2026, demande de Rem).
 *
 * POURQUOI : nouveau mode visé (bâti sur une copie, FUSIONNÉ dans l'app le 05/11/2026) : la machine joue
 * SANS connaître la longueur du mot. Mode NORMAL (mot in-lexique), pas OOV. Avant de câbler quoi
 * que ce soit dans le moteur, on mesure ce que coûte la perte de la longueur, avec un résolveur
 * de référence IDENTIQUE dans les deux mondes — seule la connaissance de la longueur change.
 *
 * ⚠️ CE RÉSOLVEUR EST UN ORACLE LEXICAL, PAS LE PENDU (rappel de Rem, 03/11/2026) : il scanne le
 * lexique pour filtrer les candidats compatibles — l'équivalent généralisé de WORD_DECLARE. Le
 * moteur, lui, NE CONNAÎT PAS LE MOT et joue par cognition (« cognition > oracle », cheat-free).
 * Cette sonde mesure l'INFORMATION contenue dans le feedback (le mode est-il gagnable en principe,
 * et à quel prix), JAMAIS le niveau attendu de la machinerie. Toute mesure du mode sur le moteur
 * passe par la config de référence + protocole ci_smoke — voir AUDIT_SANS_LONGUEUR.md.
 *
 * MODÈLE DE FEEDBACK (fixé par Rem, ex. INFLAMMABLE) : chaque lettre proposée révèle TOUTES ses
 * occurrences, mais en POSITIONS RELATIVES : la machine connaît le schéma entre la première et la
 * dernière lettre révélée (après A puis E : « A??A??E »), jamais la longueur du préfixe/suffixe
 * cachés. Contrainte induite : aucune case inconnue (intérieure OU aux bords) ne contient une
 * lettre déjà proposée — sinon elle aurait été révélée.
 *
 * COMMENT : candidats = mots du lexique moteur (OMEGA_LEX4 via le harnais, réutilisé) où le schéma
 * se pose à AU MOINS un décalage valide. Filtrage INCRÉMENTAL — correct car les contraintes ne font
 * que se resserrer : un mot compatible à t+1 l'était à t (G grandit, le schéma de t est une fenêtre
 * du schéma de t+1). Choix de lettre = présence max parmi les candidats, même heuristique dans les
 * deux mondes. Perdu à 6 erreurs (= penduEvaluate de l'app). Les demandes de Rem — nombre de mots
 * ayant la configuration, distribution des LONGUEURS possibles, lettres probables autour du schéma —
 * se lisent dans la trace (--mot). Les bi/trigrammes n'entrent pas ici : en in-lexique le comptage
 * exact de candidats les subsume ; ils deviendront la voie d'approximation pour l'OOV (hors périmètre).
 *
 *   node evo/pendu_sans_longueur_probe.js [seed] [n]          # bench : sans-longueur VS avec-longueur
 *   node evo/pendu_sans_longueur_probe.js --mot INFLAMMABLE   # trace détaillée d'une partie
 */
'use strict';
const { loadEngine } = require('./fitness_harness.js');

const BUDGET = 6;   // = penduEvaluate : lost = wrongCount >= 6
const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/* Schéma relatif du mot pour les lettres proposées G (côté JEU, qui connaît le mot). */
function schemaDe(word, G) {
  let first = -1, last = -1;
  for (let i = 0; i < word.length; i++) if (G.has(word[i])) { if (first < 0) first = i; last = i; }
  if (first < 0) return '';
  let s = '';
  for (let i = first; i <= last; i++) s += G.has(word[i]) ? word[i] : '?';
  return s;
}

/* Monde SANS longueur : v est-il compatible avec (schéma, lettres proposées G) ?
 * ∃ un décalage o où le schéma colle ET aucune lettre de G hors de la fenêtre
 * (toute occurrence d'une lettre proposée serait révélée, donc dans le schéma). */
function compatible(v, schema, G) {
  if (!schema) { for (const c of G) if (v.includes(c)) return false; return true; }
  const L = schema.length;
  outer:
  for (let o = 0; o + L <= v.length; o++) {
    for (let i = 0; i < L; i++) {
      const s = schema[i], c = v[o + i];
      if (s === '?') { if (G.has(c)) continue outer; }
      else if (c !== s) continue outer;
    }
    for (let j = 0; j < o; j++) if (G.has(v[j])) continue outer;
    for (let j = o + L; j < v.length; j++) if (G.has(v[j])) continue outer;
    return true;
  }
  return false;
}

/* Monde AVEC longueur (contrôle) : positions absolues connues, pendu classique. */
function compatibleAbs(v, word, G) {
  if (v.length !== word.length) return false;
  for (let i = 0; i < v.length; i++) {
    if (G.has(word[i])) { if (v[i] !== word[i]) return false; }
    else if (G.has(v[i])) return false;
  }
  return true;
}

/* Lettre suivante = présente dans le plus de candidats (présence, pas occurrences). */
function lettreSuivante(cands, G) {
  const cnt = new Array(26).fill(0);
  for (const v of cands) {
    let seen = 0;
    for (let i = 0; i < v.length; i++) { const x = v.charCodeAt(i) - 65; if (!(seen & (1 << x))) { seen |= 1 << x; cnt[x]++; } }
  }
  let best = -1, bestN = -1;
  for (let x = 0; x < 26; x++) { if (G.has(AZ[x])) continue; if (cnt[x] > bestN) { bestN = cnt[x]; best = x; } }
  return best < 0 ? null : AZ[best];
}

function distLongueurs(cands) {
  const d = new Map();
  for (const v of cands) d.set(v.length, (d.get(v.length) || 0) + 1);
  return [...d.entries()].sort((a, b) => a[0] - b[0]).map(([l, n]) => l + ':' + n).join(' ');
}

function jouer(word, WORDS, sansLongueur, trace) {
  const G = new Set();
  let cands = sansLongueur ? WORDS : WORDS.filter(v => v.length === word.length);
  let err = 0, coups = 0;
  while (coups < 26) {
    let done = true;
    for (const c of word) if (!G.has(c)) { done = false; break; }
    if (done) { if (trace) console.log('→ GAGNÉ en ' + coups + ' coups, ' + err + ' erreur(s)'); return { won: true, err, coups }; }
    if (err >= BUDGET) { if (trace) console.log('→ PERDU (6 erreurs) — le mot était ' + word); return { won: false, err, coups }; }
    const l = lettreSuivante(cands, G);
    if (!l) { if (trace) console.log('→ plus de lettre à proposer'); return { won: false, err, coups }; }
    G.add(l); coups++;
    const hit = word.includes(l);
    if (!hit) {
      err++;
      cands = cands.filter(v => !v.includes(l));
    } else if (sansLongueur) {
      const s = schemaDe(word, G);
      cands = cands.filter(v => compatible(v, s, G));
    } else {
      cands = cands.filter(v => compatibleAbs(v, word, G));
    }
    if (trace) {
      const s = sansLongueur ? (schemaDe(word, G) || '(rien de révélé)') : word.split('').map(c => G.has(c) ? c : '_').join('');
      console.log('coup ' + String(coups).padStart(2) + '  ' + l + ' ' + (hit ? '✓' : '✗') + '  schéma ' + s
        + '  candidats ' + cands.length + (cands.length <= 8 ? ' [' + cands.join(' ') + ']' : '')
        + '  longueurs ' + distLongueurs(cands));
    }
  }
  return { won: false, err, coups };
}

async function main() {
  const args = process.argv.slice(2);
  const O = loadEngine();
  await O.loadLex();
  const WORDS = O.evalIn('OMEGA_LEX4.words.map(function(w){return w.m;})')
    .filter(m => m && /^[A-Z]+$/.test(m));
  const mi = args.indexOf('--mot');
  if (mi >= 0) {
    const w = (args[mi + 1] || '').toUpperCase();
    if (!/^[A-Z]{2,}$/.test(w)) { console.error('--mot attend un mot A-Z'); process.exit(2); }
    if (!WORDS.includes(w)) console.log('⚠ ' + w + ' n\'est PAS dans le lexique moteur (mode normal = in-lexique) — partie jouée quand même');
    console.log('=== trace SANS longueur — mot secret : ' + w + ' (lexique ' + WORDS.length + ' mots) ===');
    jouer(w, WORDS, true, true);
    return;
  }
  const seed = +(args[0] || 12345), n = +(args[1] || 300);
  O.setSeed(seed);
  const words = (O.pick ? O.pick(n, seed) : []).filter(Boolean);
  console.log('=== pendu sans longueur VS avec longueur — résolveur de référence identique ===');
  console.log('lexique ' + WORDS.length + ' mots · seed ' + seed + ' · ' + words.length + ' parties · budget ' + BUDGET + ' erreurs');
  for (const sans of [false, true]) {
    const t0 = Date.now();
    let W = 0, E = 0, C = 0;
    for (const w of words) { const r = jouer(w, WORDS, sans, false); if (r.won) W++; E += r.err; C += r.coups; }
    const m = words.length || 1;
    console.log((sans ? 'SANS longueur' : 'AVEC longueur') + ' : win ' + (100 * W / m).toFixed(1) + ' %'
      + ' · erreurs/partie ' + (E / m).toFixed(2) + ' · coups/partie ' + (C / m).toFixed(2)
      + ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
