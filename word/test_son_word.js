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

// glue Office SIMULÉE, calquée sur taskpane.js (13/09/2026) : getTextRanges([' '], true) rend des MOTS sans blancs ; chaque mot est
// remplacé (Replace) puis complété (After) ; les blancs entre les mots — espaces, tabulations, fins de paragraphe — ne sont JAMAIS touchés.
function fakeWord(text) {
  const parts = text.split(/([ \n\t\r]+)/);              // alternance mot / blancs, dans l'ordre du document
  const out = [];
  for (const part of parts) {
    if (!part || /^[ \n\t\r]+$/.test(part)) { out.push(part); continue; }   // blanc : laissé en place
    const p = planner.plan(part, DECL2.g2p, core, {syllabes: true});
    if (!p.length || planner.rebuild(p) !== part) { out.push(part); continue; }   // même garde que taskpane.js : mot laissé tel quel
    out.push(...p.map(x => x.text));                         // Replace puis After, dans l'ordre
  }
  return out.join('');
}
for (const ph of phrases.concat(['Premier paragraphe.\r\rSecond paragraphe, après une ligne vide.\r', 'fin\tde\tligne\n'])) {
  if (fakeWord(ph) !== ph) fail.push('glue simulée : texte altéré pour ' + JSON.stringify(ph));
}
const glue = fs.readFileSync(path.join(H, 'taskpane.js'), 'utf8');
if (glue.indexOf("getTextRanges([' '], true)") < 0) fail.push("taskpane.js : la découpe doit être getTextRanges([' '], true) — sinon Word remplace aussi les blancs et les fins de paragraphe");

// MANIFESTE (13/09/2026) : Cloudflare Pages redirige (308) toute URL en .html vers sa forme sans extension — le volet doit être
// désigné par son URL CANONIQUE ; et chaque fichier que le volet charge en relatif doit exister dans le dépôt.
const man = fs.readFileSync(path.join(H, 'manifest.xml'), 'utf8');
const src = (man.match(/<SourceLocation DefaultValue="([^"]+)"/) || [])[1] || '';
if (!/^https:\/\/omega-pendu\.pages\.dev\/word\/taskpane$/.test(src)) fail.push('manifest.xml : SourceLocation attendue https://omega-pendu.pages.dev/word/taskpane (sans .html, redirigé 308), eu ' + JSON.stringify(src));
if (!/<Id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}<\/Id>/.test(man)) fail.push('manifest.xml : <Id> doit être un GUID');
const pane = fs.readFileSync(path.join(H, 'taskpane.html'), 'utf8');
for (const m of pane.matchAll(/(?:src|url)\(?=?['"]?([.]{1,2}\/[^'")]+|[a-z_]+\.js)['")]/g)) {
  const rel = m[1], cible = path.join(H, rel);
  if (!fs.existsSync(cible)) fail.push('taskpane.html charge ' + rel + ' — absent du dépôt (' + cible + ')');
}

if (fail.length) { console.error('COMPLÉMENT WORD — ÉCHEC :'); fail.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
console.log('COMPLÉMENT WORD — OK : ' + pieces + ' morceaux planifiés, texte identique partout, ancres poison/poisson/chats, glue simulée intacte');
