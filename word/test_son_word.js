// test_son_word.js — garde CI du complément Word : avec le g2p RÉEL (extrait de l'app) et le cœur
// partagé, le planificateur rend toujours un texte IDENTIQUE (caractère pour caractère), des polices
// connues, et une glue Office simulée ré-insère bien le texte sans l'altérer.
'use strict';
const fs = require('fs'), path = require('path');
const H = __dirname, R = path.join(H, '..');
const html = fs.readFileSync(path.join(R, 'app', 'omega-pendu.html'), 'utf8');
const i0 = html.indexOf('var _DECL2 = (function () {'), iR = html.indexOf('return { g2p: g2p,', i0), iE = html.indexOf('})()', iR) + 4;
const DECL2 = (0, eval)(html.slice(i0 + 'var _DECL2 = '.length, iE));
const core = require(path.join(R, 'police', 'son_core.js'));
const planner = require(path.join(H, 'son_word.js'));
const FONTS = new Set(Object.values(planner.FONT));
const fail = [];

const phrases = ['Le poison et le poisson ne se ressemblent pas.', 'Les petits chats blancs jouent dans le jardin !',
  "L'école, c'est aujourd'hui — à 8 h 30 (ou 9 h ?) : « super »…", 'ÉCRIT EN CAPITALES, avec œuf et Ægide.', '   espaces   multiples \t tab'];
let pieces = 0;
for (const ph of phrases) {
  for (const syl of [false, true]) {
    const mots = ph.split(/(?<=[ \n\t\r])|(?=[ \n\t\r])/);   // même découpage que getTextRanges (blancs)
    for (const w of mots) {
      const p = planner.plan(w, DECL2.g2p, core, {syllabes: syl});
      pieces += p.length;
      if (planner.rebuild(p) !== w) fail.push('texte altéré : ' + JSON.stringify(w) + ' → ' + JSON.stringify(planner.rebuild(p)));
      for (const x of p) { if (!FONTS.has(x.font)) fail.push('police inconnue ' + x.font); if (!/^#[0-9a-f]{6}$/.test(x.color)) fail.push('couleur ' + x.color); }
    }
  }
}
// ancres
const pz = planner.plan('poison', DECL2.g2p, core, {}), ps = planner.plan('poisson', DECL2.g2p, core, {});
if (!pz.some(x => x.text === 's' && x.font === 'OMEGA Dys Heavy')) fail.push('poison : s attendu en Heavy, eu ' + JSON.stringify(pz));
if (!ps.some(x => x.text === 'ss' && x.font === 'OMEGA Dys Light')) fail.push('poisson : ss attendu en Light, eu ' + JSON.stringify(ps));
const pc = planner.plan('chats', DECL2.g2p, core, {});
if (!(pc[pc.length - 1].color === planner.COL.mute && pc[pc.length - 1].text === 'ts')) fail.push('chats : « ts » final attendu muet, eu ' + JSON.stringify(pc));

// glue Office SIMULÉE : un range Word factice qui ne sait faire que insertText Replace/After
function fakeWord(text) {
  const doc = {runs: [{text, font: 'Calibri', color: '#000000'}]};
  const ranges = text.split(/(?<=[ \n\t\r])|(?=[ \n\t\r])/).map((t, k) => ({text: t, k}));
  let rebuilt = [];
  for (const w of ranges) {
    const p = planner.plan(w.text, DECL2.g2p, core, {syllabes: true});
    if (planner.rebuild(p) !== w.text) continue;            // même garde que taskpane.js
    rebuilt.push(...p.map(x => x.text));                     // Replace puis After, dans l'ordre
  }
  return rebuilt.join('');
}
for (const ph of phrases) if (fakeWord(ph) !== ph) fail.push('glue simulée : texte altéré pour ' + JSON.stringify(ph));

if (fail.length) { console.error('COMPLÉMENT WORD — ÉCHEC :'); fail.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
console.log('COMPLÉMENT WORD — OK : ' + pieces + ' morceaux planifiés, texte identique partout, ancres poison/poisson/chats, glue simulée intacte');
