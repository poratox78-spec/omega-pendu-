#!/usr/bin/env node
/* LE BANC DE RAPPEL ANGLAIS — sur du texte FAUTIF avec ses corrections GOLD.
 *
 * POURQUOI IL MANQUAIT, ET POURQUOI IL COMPTE AUTANT QUE LE BANC DE FP.
 * `fp_en_propre_probe.js` mesure ce qu'on abîme sur du texte correct. Il ne dit RIEN de ce qu'on
 * attrape. Jusqu'ici le rappel anglais se mesurait sur 13 cas écrits à la main — c'est-à-dire
 * qu'on écrivait l'entrée ET l'attendu, la faute de méthode que ce projet combat partout ailleurs.
 *
 * ⚠️ CE QUE LES PISTES « CORPUS DE FAUTES » NE DONNENT PAS. Sous-titres, journaux d'école, forums :
 * ce sont des textes FAUTIFS, mais SANS CORRECTION. Or sans la bonne réponse, on ne peut pas
 * mesurer un rappel — seulement compter des déclenchements, ce qui ne prouve rien. Il faut du
 * texte fautif APPARIÉ à sa version corrigée.
 *
 * JFLEG (Napoles, Sakaguchi & Tetreault) — 1 501 phrases d'APPRENANTS, chacune avec QUATRE
 * corrections indépendantes. Quatre références plutôt qu'une, c'est ce qui rend la mesure juste :
 * une correction peut être bonne sans être celle qu'un annotateur a choisie.
 * <https://github.com/keisks/jfleg>
 * ⚠️ LICENCE CC BY-NC-SA 4.0 -> **NON COMMERCIAL** : reste dans `data_local/` (gitignoré), JAMAIS
 * commité. Même règle que GUM et l'OQLF. Le site est public.
 *
 * LA MÉTRIQUE : une correction rouge est CONFIRMÉE si au moins une des quatre références contient
 * le mot proposé. C'est volontairement indulgent sur la forme et strict sur le fond — on demande
 * « quelqu'un a-t-il écrit ce mot-là en corrigeant ? », pas « la phrase entière coïncide-t-elle ».
 *
 *   node dictee/jfleg_en_probe.js
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
let nPhr = 0, propose = 0, confirme = 0;
const fam = new Map(), rates = [];

for (const set of ['dev', 'test']) {
  const src = lignes(set + '.src');
  const refs = [0, 1, 2, 3].map(k => lignes(set + '.ref' + k));
  for (let s = 0; s < src.length; s++) {
    const t = src[s];
    if (!t || !t.trim()) continue;
    nPhr++;
    const gold = refs.map(r => ' ' + (r[s] || '').toLowerCase() + ' ');
    const T = C.tokenize(t), prot = C.urlMask(t), adj = C.adjMask(t);
    for (let i = 0; i < T.length; i++) {
      if (prot.has(i)) continue;
      let sugg = null, canal = null;
      const ax = C.auxAgree ? C.auxAgree(lex, T, i, adj) : [null,null];
      if (ax[1] === 'RED') { sugg = ax[0]; canal = 'aux'; }
      const iq = C.interroDecide ? C.interroDecide(lex, T, i, adj) : [null,null];
      if (iq[1] === 'RED') { sugg = iq[0]; canal = 'interro'; }
      const v3 = C.verb3Decide ? C.verb3Decide(lex, T, i, adj) : [null,null];
      if (v3[1] === 'RED') { sugg = v3[0]; canal = 'verbe-3sg'; }
      const pp = C.pastPartDecide(lex, T, i);
      if (pp[1]) { sugg = pp[0]; canal = 'participe'; }
      else {
        const h = C.homoDecide(lex, T, i, adj);
        if (h[1] === 'RED') { sugg = h[0]; canal = 'homophone'; }
        else {
          const sp = C.spellSuggest(lex, T[i], i > 0 ? T[i - 1].toLowerCase() : '');
          if (sp[1] === 'AUTO') { sugg = sp[0]; canal = 'speller'; }
        }
      }
      if (!sugg) continue;
      propose++;
      const cible = String(sugg).toLowerCase();
      const ok = gold.some(g => g.includes(' ' + cible + ' '));
      const k = canal + (ok ? ' ✓' : ' ✗');
      fam.set(k, (fam.get(k) || 0) + 1);
      if (ok) confirme++;
      else if (rates.length < 10) rates.push(canal + ' : ' + T[i] + ' -> ' + sugg + '   | ' + t.slice(0, 60));
    }
  }
}

console.log('RAPPEL ANGLAIS SUR JFLEG — texte d\'apprenants, 4 corrections gold par phrase\n');
console.log('  %d phrases · %d corrections ROUGES proposées', nPhr, propose);
console.log('  CONFIRMÉES par au moins une référence : %d  (%s %%)',
            confirme, (100 * confirme / Math.max(1, propose)).toFixed(1));
console.log('  non confirmées : %d', propose - confirme);
console.log('\n  par canal : ' + [...fam.entries()].sort().map(([k, v]) => k + ' ' + v).join(' · '));
if (rates.length) {
  console.log('\n  non confirmées (échantillon) — À LIRE, pas à corriger d\'office :');
  rates.forEach(x => console.log('    ' + x));
  console.log('    ⚠️ « non confirmée » ne veut pas dire FAUSSE : les 4 annotateurs ont pu');
  console.log('       reformuler autrement, ou juger la faute acceptable. Lire avant de conclure.');
}
