#!/usr/bin/env node
/* LE RAPPEL ANGLAIS SUR DES FAUTES RÉELLES, EN CONTEXTE — et chaque rouge faux, nommé.
 *
 * POURQUOI. Le banc de texte édité dit ce qu'on abîme ; la liste de Wikipédia dit si le speller vise le bon mot, hors
 * contexte. Il manquait le rappel du PRODUIT ENTIER sur des fautes que des gens ont vraiment faites, dans leur phrase.
 * UD English-EWT annote ses propres fautes (Typo=Yes) avec la bonne forme (CorrectForm) : `dictee/ewt_typos_en.tsv`
 * (bâti par build_ewt_typos_en.py, CC BY-SA 4.0). La réponse vient des annotateurs d'Universal Dependencies — vérifiable
 * SANS savoir l'anglais. ⛔ Ce n'est PAS un rappel dys : ce sont des fautes de scripteurs du web (CHANTIER_ANGLAIS §5).
 *
 * CE QU'IL GARDE (--check), dans l'esprit du plancher de rappel français (FP=0 seul récompense le silence) :
 *   · un PLANCHER de fautes bien corrigées (rouge juste, et rouge + orange juste) — le rappel ne peut que monter ;
 *   · un PLAFOND de rouges FAUX sur une faute annotée — il ne peut que descendre ; chacun est imprimé.
 * Le pipeline est celui de la page : C.analyzeText, avec tous les actifs (C.loadAllNode).
 *
 *   node dictee/ewt_typos_en_probe.js [--check]
 */
'use strict';
const fs = require('fs'), path = require('path');
const C = require(path.join(__dirname, 'corrector_en.js'));
const PLANCHER_ROUGE_JUSTE = 88, PLANCHER_JUSTE = 248, PLAFOND_ROUGE_FAUX = 3;      // mesurés : 90 rouges justes ; 231 puis 251 bien corrigées et 4 puis 3 rouges faux avec les règles de vrai mot (17/09/2026) — cliquet

const src = path.join(__dirname, 'ewt_typos_en.tsv');
const lignes = fs.readFileSync(src, 'utf8').split('\n').filter(l => l && !l.startsWith('#'));
if (lignes.length < 400) { console.log('✗ banc tronqué : ' + lignes.length + ' phrases'); process.exit(1); }
const { lex, ctx } = C.loadAllNode(__dirname);
const cat = new Map(), ex = new Map(), parRegle = new Map(), faux = []; let n = 0;
const bump = (M, k) => M.set(k, (M.get(k) || 0) + 1);
for (const l of lignes) {
  const [text, ann] = l.split('\t');
  const a = C.analyzeText(lex, text, ctx);
  for (const s of ann.split(' | ')) {
    const m = /^(\d+):(\d+):(.+)$/.exec(s); if (!m) continue;
    const deb = +m[1], fin = +m[2], gold = m[3].toLowerCase().replace(/[’ʼ]/g, "'");
    const j = a.pos.findIndex((p, k) => p === deb && p + a.toks[k].length === fin);
    if (j < 0) continue;
    n++;
    const mk = a.marks[j], forme = a.toks[j]; let k;
    if (!mk) k = lex.KNOWN.has(forme.toLowerCase()) ? 'muet — la graphie est un mot réel' : 'muet — non-mot sans proposition';
    else if (mk.info) k = 'orange « souvent confondu »' + (String(mk.sugg).toLowerCase().split(/\s*\/\s*/).includes(gold) ? ' (la bonne forme est dans la liste)' : ' (autre liste)');
    else if (String(mk.sugg).toLowerCase() === gold) k = mk.cls === 'red' ? 'ROUGE juste' : 'orange juste';
    else k = mk.cls === 'red' ? 'ROUGE FAUX' : 'orange, autre cible';
    bump(cat, k); if (mk) bump(parRegle, mk.rule + ' — ' + k);
    if (!ex.has(k)) ex.set(k, []);
    if (ex.get(k).length < 10) ex.get(k).push(forme + '→' + m[3] + (mk && !/juste/.test(k) ? ' (moteur : ' + (mk.sugg || '∅') + ')' : ''));
    if (k === 'ROUGE FAUX') faux.push(forme + ' → ' + (mk.sugg || '∅') + ' [' + mk.rule + '], attendu ' + m[3] + '   | ' + text.slice(Math.max(0, deb - 40), fin + 30));
  }
}
const g = k => cat.get(k) || 0;
console.log('FAUTES RÉELLES EN CONTEXTE (UD English-EWT, annotées Typo=Yes / CorrectForm) — %d phrases, %d fautes\n', lignes.length, n);
for (const [k, v] of [...cat.entries()].sort((x, y) => y[1] - x[1])) {
  console.log('  %s %s  %s', String(v).padStart(4), ('(' + (100 * v / n).toFixed(1) + ' %)').padEnd(9), k);
  console.log('            ' + ex.get(k).join(' · '));
}
console.log('\n  par règle : ' + [...parRegle.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => k + ' ' + v).join(' | '));
if (faux.length) { console.log('\n  ROUGES FAUX — chacun à lire :'); faux.forEach(f => console.log('    ' + f)); }
const juste = g('ROUGE juste') + g('orange juste');
console.log('\n  bien corrigées : %d / %d (%s %%) dont rouge %d · rouges faux : %d', juste, n, (100 * juste / n).toFixed(1), g('ROUGE juste'), g('ROUGE FAUX'));
if (process.argv.includes('--check')) {
  const bad = [];
  if (g('ROUGE juste') < PLANCHER_ROUGE_JUSTE) bad.push('rouges justes ' + g('ROUGE juste') + ' < plancher ' + PLANCHER_ROUGE_JUSTE);
  if (juste < PLANCHER_JUSTE) bad.push('fautes bien corrigées ' + juste + ' < plancher ' + PLANCHER_JUSTE);
  if (g('ROUGE FAUX') > PLAFOND_ROUGE_FAUX) bad.push('rouges FAUX ' + g('ROUGE FAUX') + ' > plafond ' + PLAFOND_ROUGE_FAUX);
  console.log('[check] %s — plancher rouge juste %d, plancher bien corrigées %d, plafond rouges faux %d%s',
              bad.length ? 'ÉCHEC' : 'OK', PLANCHER_ROUGE_JUSTE, PLANCHER_JUSTE, PLAFOND_ROUGE_FAUX, bad.length ? ' : ' + bad.join(' ; ') : '');
  if (bad.length) process.exit(1);
}
