// popup.js — réglages persistés (chrome.storage.local). Pour l'instant : activer/désactiver le correcteur.
(function () {
  var cb = document.getElementById('om-enabled');
  try {
    chrome.storage.local.get(['enabled'], function (o) {
      cb.checked = !(o && o.enabled === false);
    });
    chrome.storage.local.get(['omdysStatus'], function (o) {   // état du moteur (écrit par content.js au chargement des lexiques)
      var el = document.getElementById('om-status'); if (!el) return;
      var st = o && o.omdysStatus;
      if (!st) el.textContent = 'moteur : pas encore chargé sur un onglet';
      else if (st.error) el.textContent = 'moteur : ERREUR — ' + st.error;
      else el.textContent = st.ready ? ('moteur prêt' + (st.words ? ' · ' + st.words + ' mots' : '')) : 'moteur : lexiques en cours de chargement…';
    });
    cb.addEventListener('change', function () {
      chrome.storage.local.set({ enabled: cb.checked });
    });
    var sz = document.getElementById('om-size'), dk = document.getElementById('om-dark');   // accessibilité : taille de texte + mode sombre de la barre
    chrome.storage.local.get(['omSize', 'omDark'], function (o) { if (sz) sz.value = (o && o.omSize) || 'p'; if (dk) dk.checked = !!(o && o.omDark); });
    if (sz) sz.addEventListener('change', function () { chrome.storage.local.set({ omSize: sz.value }); });
    if (dk) dk.addEventListener('change', function () { chrome.storage.local.set({ omDark: dk.checked }); });
  } catch (e) {}
})();
