// son_word.js — PLANIFICATEUR pur (sans Office.js) du complément Word « police de son ».
// Entrée : le texte d'un mot (ou d'un fragment), le g2p du moteur et le cœur OmegaDysSonCore.
// Sortie : une liste de MORCEAUX {text, font, color, syl} dont la concaténation est EXACTEMENT le
// texte d'entrée (principe cardinal : le texte ne change jamais — Word ne fait que ré-insérer
// les mêmes caractères en plusieurs runs stylés). Testé sous node (word/test_son_word.js) avec
// le g2p réel extrait de l'app : c'est la garantie que Word recevra toujours un texte identique.
var OmegaDysSonWord = (function () {
  'use strict';
  var FONT = {voi: 'OMEGA Dys Heavy', srd: 'OMEGA Dys Light', n: 'OMEGA Dys', mute: 'OMEGA Dys'};
  var COL = {ink: '#1c2431', mute: '#a34700', syl: '#0072b2'};     // fond clair (document Word)
  function plan(text, g2p, core, opts) {
    opts = opts || {};
    var out = [];
    core.sentenceSegments(text, g2p).forEach(function (m) {
      if (m.raw !== undefined) { out.push({text: m.raw, font: FONT.n, color: COL.ink}); return; }
      var segs = m.segs, idx = opts.syllabes ? core.syllableIndex(segs) : null;
      segs.forEach(function (seg, i) {
        var odd = idx && (idx[i] % 2 === 1);
        out.push({text: seg.g, font: FONT[seg.cls] || FONT.n,
                  color: seg.cls === 'mute' ? COL.mute : (odd ? COL.syl : COL.ink), syl: idx ? idx[i] : 0});
      });
    });
    // fusion des morceaux voisins identiques (moins de runs Word, même rendu)
    var merged = [];
    out.forEach(function (p) {
      var last = merged[merged.length - 1];
      if (last && last.font === p.font && last.color === p.color) last.text += p.text; else merged.push({text: p.text, font: p.font, color: p.color});
    });
    return merged;
  }
  function rebuild(pieces) { return pieces.map(function (p) { return p.text; }).join(''); }
  return {plan: plan, rebuild: rebuild, FONT: FONT, COL: COL};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = OmegaDysSonWord;
