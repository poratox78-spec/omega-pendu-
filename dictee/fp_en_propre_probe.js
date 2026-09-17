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
const CONF = JSON.parse(fs.readFileSync(path.join(RACINE,'dictee','confusables_en.json'),'utf8'));
const CONFG = Array.isArray(CONF)?CONF:(CONF.groupes||[]);

const DIR = path.join(RACINE, 'data_local', 'en');
const PUD = path.join(DIR, 'en_pud-ud-test.conllu');
if (!fs.existsSync(PUD)) {
  console.log('corpus propre absent (data_local/en) — sonde locale seulement.');
  console.log('  PUD : https://github.com/UniversalDependencies/UD_English-PUD  (CC BY-SA 3.0)');
  console.log('  GUM : https://github.com/UniversalDependencies/UD_English-GUM  (CC BY-NC-SA 4.0)');
  process.exit(0);
}

/* ⭐ 17/09/2026 — LE PIPELINE DU PRODUIT, pas une copie. Ce banc rejouait SA chaîne de règles : sans les contractions, la
   forme de base, « i » -> I, les mots collés, le double comparatif, la répétition… et dans un AUTRE ordre que la page (les
   oranges « nombre » et « confusables » passaient AVANT le speller). Il appelle désormais C.analyzeText avec tous les actifs
   (C.loadAllNode) : ce qu'il compte est ce que l'utilisateur voit. Les chiffres d'avant ne sont donc pas comparables un à un
   (changement d'INSTRUMENT, pas de moteur) : 11 rouges / 534 oranges avec l'ancienne chaîne, le même jour. */
const { lex, ctx } = C.loadAllNode(path.join(RACINE, 'dictee'));

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
let toks = 0, rouge = 0, orange = 0;
const fam = new Map(), ex = [], orRegle = new Map();
for (const t of PHR) {
  const a = C.analyzeText(lex, t, ctx);
  toks += a.toks.length;
  a.marks.forEach((mk, i) => {
    if (!mk) return;
    if (mk.cls === 'red') {
      rouge++;
      const k = '[' + mk.rule + '] ' + a.toks[i] + '→' + (mk.sugg || '∅');
      fam.set(k, (fam.get(k) || 0) + 1);
      if (ex.length < 14) ex.push(k.padEnd(34) + '| ' + t.slice(0, 62));
    } else { orange++; orRegle.set(mk.rule, (orRegle.get(mk.rule) || 0) + 1); }
  });
}

console.log('FP ANGLAIS SUR TEXTE ÉDITÉ (PUD + GUM genres édités)');
console.log('  %d phrases · %d tokens', PHR.length, toks);
console.log('  ROUGES : %d  (%s %%)', rouge, (100 * rouge / toks).toFixed(4));
console.log('  orange : %d  (%s %%)   par règle : %s', orange, (100 * orange / toks).toFixed(2),
            [...orRegle.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' · '));
console.log('\n  par famille :');
[...fam.entries()].sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log('    ' + String(v).padStart(3) + '  ' + k));
console.log('\n  ⚠️ ET MÊME ICI, TOUS LES ROUGES NE SONT PAS DES FAUX POSITIFS : GUM contient des');
console.log('     sections rédigées par des étudiants, où `experiance`, `collasped`, `posession`');
console.log('     sont de VRAIES fautes correctement corrigées. Lire avant de conclure —');
console.log('     c\'est exactement l\'erreur qui a fait vivre le banc EWT trop longtemps.');
if (ex.length) { console.log('\n  échantillon :'); ex.forEach(x => console.log('    ' + x)); }
