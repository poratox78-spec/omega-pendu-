// popup.js — réglages persistés (chrome.storage.local). Pour l'instant : activer/désactiver le correcteur.
(function () {
  var cb = document.getElementById('om-enabled');
  try {
    chrome.storage.local.get(['enabled'], function (o) {
      cb.checked = !(o && o.enabled === false);
    });
    cb.addEventListener('change', function () {
      chrome.storage.local.set({ enabled: cb.checked });
    });
  } catch (e) {}
})();
