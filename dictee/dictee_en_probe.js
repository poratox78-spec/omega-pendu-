#!/usr/bin/env node
/* LES PHRASES DE LA DICTÉE ANGLAISE — chaque phrase, vérifiée par la machine.
 *
 * POURQUOI. La dictée anglaise avait 45 phrases (15 par niveau) contre 333 en français ; elle passe à 300 le 17/09/2026.
 * Rem ne lit pas l'anglais : ce qu'une relecture humaine ferait, ce check le fait à chaque passage, et il COUPLE la dictée au
 * correcteur — une phrase que NOTRE moteur soulignerait n'a rien à faire dans une dictée (ou bien la phrase est fausse, ou bien
 * le moteur a un faux positif : dans les deux cas on veut le savoir).
 *
 * CE QU'IL EXIGE de chaque phrase : majuscule initiale et ponctuation finale ; 4 à 14 mots ; tous les mots au lexique (les
 * contractions sont admises) ; AUCUNE marque du pipeline du produit (C.analyzeText) ; un « focus » dont chaque groupe de mots
 * (their/there, definitely/necessary…) a au moins un membre DANS la phrase ; aucune phrase en double, tous niveaux confondus.
 * Et du fichier : au moins 100 phrases par niveau ; le nombre AFFICHÉ sur en/dictee.html égal au total.
 *
 *   node dictee/dictee_en_probe.js            (OMEGA_DICTEE_EN=<fichier> pour vérifier un brouillon)
 */
'use strict';
const fs = require('fs'), path = require('path');
const DIR = process.env.OMEGA_DICTEE_DIR || __dirname;
const C = require(path.join(DIR, 'corrector_en.js'));
const SRC = process.env.OMEGA_DICTEE_EN || path.join(DIR, 'dictee_en_sentences.json');
const PAGE = process.env.OMEGA_DICTEE_PAGE || path.join(DIR, '..', 'en', 'dictee.html');
const MIN_PAR_NIVEAU = 100;
const { lex, ctx } = C.loadAllNode(DIR);
const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const bad = [], vus = new Map(); let total = 0;
const CATEGORIES = new Set(['base', 'homophone', 'spelling', 'confusion', 'modal', 'contraction']);
for (const niveau of ['easy', 'medium', 'hard']) {
  const L = (data.levels && data.levels[niveau]) || [];
  if (L.length < MIN_PAR_NIVEAU) bad.push(niveau + ' : ' + L.length + ' phrases < ' + MIN_PAR_NIVEAU);
  for (const it of L) {
    total++;
    const t = it.text || '', ou = niveau + ' « ' + t + ' »';
    if (!/^[A-Z]/.test(t) || !/[.?!]$/.test(t)) bad.push(ou + ' : majuscule initiale ou ponctuation finale');
    const a = C.analyzeText(lex, t, ctx), T = a.toks;
    if (T.length < 4 || T.length > 14) bad.push(ou + ' : ' + T.length + ' mots (4 à 14 attendus)');
    const low = T.map(w => w.toLowerCase().replace(/[’ʼ]/g, "'"));
    for (const w of low) if (!w.includes("'") && !lex.KNOWN.has(w) && C.spellSuggest(lex, w, '')[1] !== 'OK') bad.push(ou + ' : mot hors lexique « ' + w + ' »');
    /* Les marques « info » (confuse-vig : « souvent confondu avec… ») ne comptent pas : elles ne proposent rien, elles signalent
       le membre rare d'une paire (hear, sun, won, plain…) — et une dictée d'homophones en est pleine par construction. */
    a.marks.forEach((mk, i) => { if (mk && !mk.info) bad.push(ou + ' : NOTRE moteur y pose une marque — ' + T[i] + ' → ' + (mk.sugg || '∅') + ' [' + mk.rule + ', ' + mk.cls + ']'); });
    const cle = low.join(' ');
    if (vus.has(cle)) bad.push(ou + ' : en double (déjà dans ' + vus.get(cle) + ')'); else vus.set(cle, niveau);
    const focus = String(it.focus || '');
    if (!focus) bad.push(ou + ' : focus manquant');
    for (const bloc of focus.split('·')) {                          // « homophone:their/there » · « spelling:argument/environment »
      const b = bloc.trim(); if (!b || b === 'base') continue;
      const [cat, reste] = b.includes(':') ? [b.slice(0, b.indexOf(':')), b.slice(b.indexOf(':') + 1)] : ['', b];
      if (cat && !CATEGORIES.has(cat)) bad.push(ou + ' : catégorie de focus inconnue « ' + cat + ' »');
      const mots = reste.split('/').map(x => x.trim().toLowerCase().replace(/[’ʼ]/g, "'")).filter(Boolean);
      /* présent = le mot lui-même, une de ses formes fléchies (accepts pour accept), ou la forme développée d'une contraction
         (« They are » pour they're, « it is » pour it's : le piège est justement de savoir laquelle écrire). */
      const DEV = { "they're": 'they are', "it's": 'it is', "you're": 'you are', "we're": 'we are', "who's": 'who is' };
      const phrase = ' ' + low.join(' ') + ' ';
      const present = mots.some(m => low.some(w => w === m || w.replace(/'s$/, '') === m || (m.length >= 4 && w.startsWith(m)))
        || m.split(' ').every(p => low.includes(p)) || (DEV[m] && phrase.includes(' ' + DEV[m] + ' ')));
      if (mots.length && !present) bad.push(ou + ' : aucun mot du focus « ' + b + ' » n\'est dans la phrase');
    }
  }
}
const page = fs.existsSync(PAGE) ? fs.readFileSync(PAGE, 'utf8') : '';
const aff = /<b>(\d+)<\/b><small>graded sentences/.exec(page);
if (!aff) bad.push('en/dictee.html : nombre de phrases affiché introuvable (la comparaison serait MUETTE)');
else if (+aff[1] !== total) bad.push('en/dictee.html affiche ' + aff[1] + ' phrases, le fichier en porte ' + total);
bad.slice(0, 40).forEach(b => console.log('  ✗ ' + b));
if (bad.length > 40) console.log('  … et ' + (bad.length - 40) + ' autres');
console.log(bad.length ? '✗ dictée anglaise : ' + bad.length + ' défaut(s) sur ' + total + ' phrases'
  : '✓ dictée anglaise : ' + total + ' phrases (' + ['easy', 'medium', 'hard'].map(n => n + ' ' + data.levels[n].length).join(' · ')
    + ') — toutes au lexique, aucune marque de notre moteur, focus présent, aucun doublon ; la page affiche ' + total);
process.exit(bad.length ? 1 : 0);
