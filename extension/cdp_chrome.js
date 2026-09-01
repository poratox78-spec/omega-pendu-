/* HARNAIS CHROME PARTAGÉ (CDP, zéro dépendance).
 *
 * Extrait de `extension/navigateur_ext_probe.js` (PR#632) pour qu'un SECOND banc puisse piloter un
 * Chrome réel sans recopier 150 lignes — la recopie est justement le motif qui a laissé deux
 * chargeurs de moteur diverger pendant des mois (cf. moteur-a-moitié-chargé).
 *
 * Pièges conservés du banc d'origine :
 *  ① `Extensions.loadUnpacked` exige des barres OBLIQUES dans le chemin, même sous Windows.
 *  ② `--load-extension` ne charge plus rien depuis Chrome 152 ; il faut la commande CDP.
 *  ③ Le script de contenu ne s'injecte pas sur file:// → on sert une page http locale.
 *  ④ Le moteur s'appelle `DYSCORE` dans le monde ISOLÉ (`DC` n'est qu'un alias de content.js).
 */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawn } = require('child_process');

function trouverChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const c = [];
  if (process.platform === 'win32') {
    for (const b of [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env['LOCALAPPDATA']])
      if (b) c.push(path.join(b, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  } else if (process.platform === 'darwin') {
    c.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
           '/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else {
    c.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
           '/usr/bin/chromium-browser', '/snap/bin/chromium');
  }
  return c.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } }) || null;
}

/* le script de contenu s'injecte sur <all_urls> mais pas sur file:// : on sert une page http */
function servir() {
  return new Promise(res => {
    const srv = http.createServer((req, rep) => {
      rep.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      rep.end('<!doctype html><meta charset="utf-8"><title>essai</title><textarea id="z"></textarea>');
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}

function attendre(ms) { return new Promise(r => setTimeout(r, ms)); }
function lirePortDevTools(profil, ms) {
  const t0 = Date.now(), f = path.join(profil, 'DevToolsActivePort');
  return new Promise((res, rej) => { (function boucle() {
    try { const p = parseInt(fs.readFileSync(f, 'utf8').split('\n')[0].trim(), 10);
      if (p > 0) return res(p); } catch (e) { /* pas encore écrit */ }
    if (Date.now() - t0 > ms) return rej(new Error("Chrome n'a pas ouvert son port de débogage (" + ms + ' ms)'));
    setTimeout(boucle, 200); })(); });
}
/* client CDP minimal — il doit aussi ÉCOUTER les événements : c'est ainsi qu'on apprend l'existence
   du monde isolé du script de contenu (`Runtime.executionContextCreated`). */
function connecter(wsUrl, surEvenement) {
  return new Promise((res, rej) => {
    const s = new WebSocket(wsUrl); let id = 0; const attente = new Map();
    s.onopen = () => res({
      envoyer(method, params) {
        return new Promise((ok, ko) => { const n = ++id; attente.set(n, { ok, ko });
          s.send(JSON.stringify({ id: n, method, params: params || {} })); });
      },
      fermer() { try { s.close(); } catch (e) {} },
    });
    s.onerror = (e) => rej(new Error('WebSocket CDP : ' + (e.message || 'échec')));
    s.onmessage = (m) => { const d = JSON.parse(m.data);
      if (d.method && surEvenement) surEvenement(d);
      const a = attente.get(d.id); if (!a) return; attente.delete(d.id);
      d.error ? a.ko(new Error(d.error.message)) : a.ok(d.result); };
  });
}
async function onglet(port, url) {
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch (e) { /* pas encore prêt */ }
    await attendre(200);
  }
  throw new Error('le port de débogage ne répond pas');
}

async function onglet(port, url) {
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch (e) { /* pas encore prêt */ }
    await attendre(200);
  }
  throw new Error('le port de débogage ne répond pas');
}

module.exports = { trouverChrome, servir, attendre, lirePortDevTools, connecter, onglet, spawn, fs, path, os };
