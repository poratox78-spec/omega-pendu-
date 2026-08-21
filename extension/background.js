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

// clic sur l'icône de l'extension → ouvre le PANNEAU LATÉRAL (le correcteur "surface propre", F12-style)
try { chrome.sidePanel && chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function () {}); } catch (e) {}

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

// MIROIR FIDÈLE (Rem, 2026-08-21) : autre onglet activé ou navigation de l'onglet actif → le panneau (s'il est en
// miroir) se vide : il n'affirme jamais un texte que la page n'a plus. Pas de permission « tabs » requise
// (onActivated/onUpdated ne livrent ici que des identifiants et un statut).
function preventPanneau() { try { chrome.runtime.sendMessage({ type: 'omdys-tab' }, function () { void chrome.runtime.lastError; }); } catch (e) {} }
try { chrome.tabs.onActivated.addListener(function () { preventPanneau(); }); } catch (e) {}
try { chrome.tabs.onUpdated.addListener(function (id, ch, tab) { if (ch && ch.status === 'loading' && tab && tab.active) preventPanneau(); }); } catch (e) {}
