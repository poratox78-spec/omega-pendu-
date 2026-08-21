// taskpane.js — glue Office.js du complément Word « police de son » (OMEGA Dys).
// Tout le calcul est dans son_word.js (planificateur pur, testé sous node) ; ici on ne fait que :
//   1) lire les mots de la sélection (ou du document), 2) les ré-insérer caractère pour caractère
//   en runs stylés (police OMEGA Dys Regular/Light/Heavy, couleur des muettes/syllabes).
// Prérequis côté utilisateur : les 3 polices OMEGA Dys INSTALLÉES (pack omega-police-dys.zip) —
// sinon Word substitue une police par défaut (le texte reste intact, seule la graisse ne suit pas).
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function say(msg, ok) { var s = $('st'); s.textContent = msg; s.className = ok === false ? 'err' : (ok ? 'ok' : ''); }
  var g2p = (typeof _DECL2 !== 'undefined' && _DECL2 && _DECL2.g2p) || null;
  var core = (typeof OmegaDysSonCore !== 'undefined') ? OmegaDysSonCore : null;
  var planner = (typeof OmegaDysSonWord !== 'undefined') ? OmegaDysSonWord : null;
  if (!g2p || !core || !planner) { say('moteur introuvable (g2p / cœur) — recharge le complément', false); return; }

  // aperçu dans le volet (mêmes règles, polices via @font-face)
  function apercu() {
    var host = $('apercu'), syl = $('syl').checked; host.textContent = '';
    planner.plan('poison · poisson · les petits chats blancs · un gâteau', g2p, core, {syllabes: syl}).forEach(function (p) {
      var sp = document.createElement('span'); sp.textContent = p.text; sp.style.fontFamily = "'" + p.font + "'"; sp.style.color = p.color; host.appendChild(sp);
    });
  }
  $('syl').addEventListener('change', apercu);
  apercu();

  var originalFont = null;
  function cible(context) {                                // sélection non vide, sinon tout le corps
    var sel = context.document.getSelection();
    sel.load('text');
    return context.sync().then(function () { return sel.text && sel.text.trim() ? sel : context.document.body.getRange('Whole'); });
  }
  function appliquer(syllabes) {
    if (typeof Word === 'undefined') { say('Office.js absent : ouvre ce volet depuis Word', false); return; }
    say('application…');
    Word.run(function (context) {
      return cible(context).then(function (range) {
        range.font.load('name');
        var mots = range.getTextRanges([' ', '\n', '\t', '\r'], false);   // morceaux séparés par les blancs (ponctuation incluse)
        mots.load('items/text');
        return context.sync().then(function () {
          if (originalFont == null) originalFont = range.font.name || 'Calibri';
          var n = 0;
          mots.items.forEach(function (w) {
            var pieces = planner.plan(w.text, g2p, core, {syllabes: syllabes});
            if (planner.rebuild(pieces) !== w.text) return;  // garde cardinale : jamais un texte différent
            var r = w.insertText(pieces[0].text, 'Replace');
            r.font.name = pieces[0].font; r.font.color = pieces[0].color;
            for (var i = 1; i < pieces.length; i++) {
              r = r.insertText(pieces[i].text, 'After');
              r.font.name = pieces[i].font; r.font.color = pieces[i].color;
            }
            n++;
          });
          return context.sync().then(function () { say('✓ police de son appliquée sur ' + n + ' mot' + (n > 1 ? 's' : ''), true); });
        });
      });
    }).catch(function (e) { say('erreur Word : ' + (e && e.message ? e.message : e), false); });
  }
  function policeSeule() {                                 // la police OMEGA Dys telle quelle (voisement par lettre), sans runs
    if (typeof Word === 'undefined') { say('Office.js absent : ouvre ce volet depuis Word', false); return; }
    Word.run(function (context) {
      return cible(context).then(function (range) {
        range.font.load('name');
        return context.sync().then(function () {
          if (originalFont == null) originalFont = range.font.name || 'Calibri';
          range.font.name = 'OMEGA Dys';
          return context.sync().then(function () { say('✓ police OMEGA Dys appliquée', true); });
        });
      });
    }).catch(function (e) { say('erreur Word : ' + (e && e.message ? e.message : e), false); });
  }
  function retirer() {                                     // remet la police d'origine (mémorisée à la 1re application) et la couleur noire
    if (typeof Word === 'undefined') { say('Office.js absent : ouvre ce volet depuis Word', false); return; }
    Word.run(function (context) {
      return cible(context).then(function (range) {
        range.font.name = originalFont || 'Calibri'; range.font.color = '#000000';
        return context.sync().then(function () { say('✓ police d’origine rétablie (' + (originalFont || 'Calibri') + ')', true); });
      });
    }).catch(function (e) { say('erreur Word : ' + (e && e.message ? e.message : e), false); });
  }
  $('go').addEventListener('click', function () { appliquer($('syl').checked); });
  $('seule').addEventListener('click', policeSeule);
  $('undo').addEventListener('click', retirer);
  if (typeof Office !== 'undefined' && Office.onReady) Office.onReady(function () { say('prêt — sélectionne du texte (ou rien = tout le document)', true); });
  else say('hors Word : aperçu seulement');
})();
