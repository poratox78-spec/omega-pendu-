#!/usr/bin/env node
/* LE BANC DE FAUX POSITIFS ANGLAIS — SUR DU TEXTE RÉELLEMENT ÉDITÉ.
 *
 * POURQUOI IL REMPLACE EWT, ET C'EST LE RÉSULTAT LE PLUS IMPORTANT DE LA PASSE ANGLAISE.
 * On mesurait le FP anglais sur UD English-EWT. Or **EWT est du WEB** : avis de clients, e-mails,
 * forums. Relecture faite le 2026-08-06, un par un : **52 des 55 rouges du speller étaient de
 * VRAIES FAUTES** (`seperate`, `definately`, `becuse`, `resturant`, `thouhgt`…), et la quasi-
 * totalité des 23 rouges `a/an` aussi (`a evaluation`, `a hour`, `a answer`).
 * ⇒ Le banc comptait comme FAUX POSITIFS ce qui était du **RAPPEL NON COMPTÉ**. Toute décision
 * prise sur ce chiffre était prise sur un mirage.
 *
 * LES DEUX CORPUS, choisis pour être ÉDITÉS et librement redistribuables :
 *   · **UD English-PUD** — CC BY-SA 3.0, 1 000 phrases, news + Wikipédia, traduites par des
 *     traducteurs PROFESSIONNELS puis corrigées à la main. Le texte anglais le plus propre qu'on
 *     puisse avoir gratuitement.
 *   · **UD English-GUM** — CC BY-NC-SA 4.0, dont on ne garde QUE les genres édités
 *     (news, academic, bio, fiction, voyage, textbook, essay, whow, letter, speech, court, legal).
 *     On ÉCARTE conversation / vlog / podcast / reddit : c'est de l'oral et du web, donc le même
 *     biais qu'EWT.
 * ⚠️ GUM est **NON COMMERCIAL** : il reste dans `data_local/` (gitignoré), JAMAIS commité — même
 * règle que le corpus OQLF. Le site est public.
 *
 *   node dictee/fp_en_propre_probe.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.dirname(__dirname);
const C = require(path.join(RACINE, 'dictee', 'corrector_en.js'));

const DIR = path.join(RACINE, 'data_local', 'en');
const PUD = path.join(DIR, 'en_pud-ud-test.conllu');
if (!fs.existsSync(PUD)) {
  console.log('corpus propre absent (data_local/en) — sonde locale seulement.');
  console.log('  PUD : https://github.com/UniversalDependencies/UD_English-PUD  (CC BY-SA 3.0)');
  console.log('  GUM : https://github.com/UniversalDependencies/UD_English-GUM  (CC BY-NC-SA 4.0)');
  process.exit(0);
}

const lex = C.loadLexNode(path.join(RACINE, 'dictee', 'lex_en.tsv.gz'));
try {
  const mp = path.join(RACINE, 'dictee', 'pos_hmm_en.json');
  if (fs.existsSync(mp)) C.setPosModel(JSON.parse(fs.readFileSync(mp, 'utf8')));
} catch (e) {}

const EDITE = new Set(['news', 'academic', 'bio', 'fiction', 'voyage', 'textbook', 'essay',
                       'whow', 'letter', 'speech', 'court', 'legal']);
function phrases() {
  const out = [];
  for (const l of fs.readFileSync(PUD, 'utf8').split('\n'))
    if (l.startsWith('# text = ')) out.push(l.slice(9).trim());
  let genre = '';
  for (const f of ['train', 'dev', 'test']) {
    const p = path.join(DIR, 'en_gum-ud-' + f + '.conllu');
    if (!fs.existsSync(p)) continue;
    for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
      const g = /^# newdoc id = GUM_([a-z]+)/.exec(l);
      if (g) genre = g[1];
      if (l.startsWith('# text = ') && EDITE.has(genre)) out.push(l.slice(9).trim());
    }
  }
  return out;
}

const PHR = phrases();
let toks = 0, rouge = 0, orange = 0, orNb = 0, orV3 = 0;
const fam = new Map(), ex = [];
for (const t of PHR) {
  const T = C.tokenize(t), prot = C.urlMask(t), adj = C.adjMask(t);
  const hyph = C.hyphMask ? C.hyphMask(t) : null;
  for (let i = 0; i < T.length; i++) {
    toks++;
    if (prot.has(i)) continue;                       // un mot dans une URL n'est pas du langage
    const note = (k, s) => {
      rouge++; fam.set(k, (fam.get(k) || 0) + 1);
      if (ex.length < 14) ex.push(k.padEnd(26) + '| ' + t.slice(0, 62));
    };
    const ax = C.auxAgree ? C.auxAgree(lex, T, i, adj) : [null,null];
    if (ax[1] === 'RED') { note('[aux] ' + T[i] + '→' + ax[0]); continue; }
    const iq = C.interroDecide ? C.interroDecide(lex, T, i, adj) : [null,null];
    if (iq[1] === 'RED') { note('[interro] ' + T[i] + '→' + iq[0]); continue; }
    const v3 = C.verb3Decide ? C.verb3Decide(lex, T, i, adj) : [null,null];
    if (v3[1] === 'RED') { note('[verbe-3sg] ' + T[i] + '→' + v3[0]); continue; }
    const nb = C.numberDecide ? C.numberDecide(lex, T, i, adj, hyph) : [null,null];
    if (nb[1] === 'ORANGE') { orange++; orNb++; continue; }
    const pp = C.pastPartDecide(lex, T, i);
    if (pp[1]) { note('[participe] ' + T[i] + '→' + pp[0]); continue; }
    const h = C.homoDecide(lex, T, i, adj);
    if (h[1] === 'RED') { note(T[i].toLowerCase() + '→' + h[0]); continue; }
    const s = C.spellSuggest(lex, T[i], i > 0 ? T[i - 1].toLowerCase() : '');
    if (s[1] === 'AUTO') note('[speller] ' + T[i] + '→' + s[0]);
    else if (s[1] === 'FLAG' && s[0]) orange++;
  }
}

console.log('FP ANGLAIS SUR TEXTE ÉDITÉ (PUD + GUM genres édités)');
console.log('  %d phrases · %d tokens', PHR.length, toks);
console.log('  ROUGES : %d  (%s %%)', rouge, (100 * rouge / toks).toFixed(4));
console.log('  orange : %d  (%s %%)   dont NOMBRE %d · VERBE-3sg %d', orange, (100 * orange / toks).toFixed(2), orNb, orV3);
console.log('\n  par famille :');
[...fam.entries()].sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log('    ' + String(v).padStart(3) + '  ' + k));
console.log('\n  ⚠️ ET MÊME ICI, TOUS LES ROUGES NE SONT PAS DES FAUX POSITIFS : GUM contient des');
console.log('     sections rédigées par des étudiants, où `experiance`, `collasped`, `posession`');
console.log('     sont de VRAIES fautes correctement corrigées. Lire avant de conclure —');
console.log('     c\'est exactement l\'erreur qui a fait vivre le banc EWT trop longtemps.');
if (ex.length) { console.log('\n  échantillon :'); ex.forEach(x => console.log('    ' + x)); }
