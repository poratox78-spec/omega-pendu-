// aide.js — le mode d'emploi suit les réglages du panneau : taille du texte (omSize) et mode sombre (omDark),
// mêmes clés chrome.storage que sidepanel.js et la bulle. Réglé dans le panneau pendant que le guide est ouvert → il suit.
(function () {
  'use strict';
  var FS = { p: '17px', m: '19.5px', g: '22px' };   // un cran au-dessus du panneau (15 / 17,5 / 20) : une page à lire, pas une barre d'outils
  function applique(sz, dk) {
    document.documentElement.style.setProperty('--fs', FS[sz] || FS.p);
    document.body.classList.toggle('dark', !!dk);
  }
  var etat = { sz: 'p', dk: false };
  try {
    chrome.storage.local.get(['omSize', 'omDark'], function (o) {
      etat.sz = (o && o.omSize) || 'p'; etat.dk = !!(o && o.omDark); applique(etat.sz, etat.dk);
    });
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area !== 'local') return;
      if (ch.omSize) etat.sz = ch.omSize.newValue || 'p';
      if (ch.omDark) etat.dk = !!ch.omDark.newValue;
      if (ch.omSize || ch.omDark) applique(etat.sz, etat.dk);
    });
  } catch (e) {}   // hors extension (fichier ouvert à la main) : le guide reste lisible en clair, taille normale
})();
