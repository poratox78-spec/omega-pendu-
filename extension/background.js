// background.js — service worker (MV3) : menu contextuel « corriger ce mot » au CLIC DROIT sur un champ éditable.
// Le content script calcule la correction du mot sous le curseur et pousse le libellé ; ce SW ne fait que
// (re)créer l'entrée de menu, la mettre à jour, et renvoyer le clic au content script qui applique.
function createMenu() {
  try {
    chrome.contextMenus.removeAll(function () {
      void chrome.runtime.lastError;
      chrome.contextMenus.create({ id: 'omdys-fix', title: '🩹 Correcteur dys', contexts: ['editable'] }, function () { void chrome.runtime.lastError; });
    });
  } catch (e) {}
}
chrome.runtime.onInstalled.addListener(createMenu);
chrome.runtime.onStartup.addListener(createMenu);

// le content script (contextmenu) pousse le libellé du mot sous le curseur (« 🩹 « von » → « vont » ») + activé/grisé
chrome.runtime.onMessage.addListener(function (msg) {
  if (msg && msg.type === 'omdys-menu') {
    try { chrome.contextMenus.update('omdys-fix', { title: msg.title || '🩹 Correcteur dys', enabled: msg.enabled !== false }); } catch (e) {}
  }
});

// clic sur l'entrée → renvoie au content script de l'onglet, qui applique la correction mémorisée
chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === 'omdys-fix' && tab && tab.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: 'omdys-apply-rc' }, function () { void chrome.runtime.lastError; });
  }
});
