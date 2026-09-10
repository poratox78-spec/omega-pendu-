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

/* le script de contenu s'injecte sur <all_urls> mais pas sur file:// : on sert une page http.
   ⭐ 10/09/2026 : deux pages de COUVERTURE en plus de « / » (qui reste la page d'origine) — « /shadow »,
   un champ dans un shadow root ouvert ; « /riche », un éditeur à MODÈLE PROPRE (marqueur de Slate) qui
   porte son oracle : la POSITION du curseur après l'écriture, CALIBRÉE par un contrôle qui rejoue les
   deux écritures possibles (pipeline d'édition vs mutation directe du DOM). Voir navigateur_ext_probe ⑧⑨. */
const PAGES = {
  '/': '<!doctype html><meta charset="utf-8"><title>essai</title><textarea id="z"></textarea>',
  '/shadow': '<!doctype html><meta charset="utf-8"><title>shadow</title><div id="hote"></div>'
    + '<script>document.getElementById("hote").attachShadow({ mode: "open" }).innerHTML = "<textarea id=z rows=3 cols=60></textarea>";</script>',
  '/riche': '<!doctype html><meta charset="utf-8"><title>riche</title>'
    + '<div id="z" data-slate-editor="true" contenteditable="true" style="border:1px solid #888;padding:6px;min-height:40px"></div>'
    + '<script>'
    + 'const z = document.getElementById("z");'
    + 'window.__poser = (t) => { z.textContent = t; };'
    + 'window.__sig = () => { const s = getSelection(); const dedans = !!(s && s.rangeCount && s.anchorNode && (s.anchorNode === z || z.contains(s.anchorNode)));'
    + '  return { dedans, off: dedans ? s.anchorOffset : null, texte: z.textContent }; };'
    + 'window.__ctl = () => { const essai = (mode) => { const d = document.createElement("div"); d.contentEditable = "true"; d.textContent = "les chien aboient"; document.body.appendChild(d);'
    + '  const n = d.firstChild, r = document.createRange(); r.setStart(n, 4); r.setEnd(n, 9); const s = getSelection(); s.removeAllRanges(); s.addRange(r); d.focus();'
    + '  if (mode === "pipeline") { document.execCommand("insertText", false, "chiens"); } else { n.nodeValue = n.nodeValue.slice(0, 4) + "chiens" + n.nodeValue.slice(9); }'
    + '  const s2 = getSelection(); const out = { off: (s2 && s2.rangeCount) ? s2.anchorOffset : null, texte: d.textContent }; d.remove(); return out; };'
    + '  const a = essai("pipeline"), b = essai("mutation"); return { pipeline: a, mutation: b, separe: (a.off !== null && b.off !== null && a.off !== b.off) }; };'
    + '</script>',
};
function servir() {
  return new Promise(res => {
    const srv = http.createServer((req, rep) => {
      const p = (req.url || '/').split('?')[0];
      rep.writeHead(PAGES[p] ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      rep.end(PAGES[p] || 'non');
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

/* ⚠️ CHROME REFUSE UN DOSSIER D'EXTENSION CONTENANT UN NOM COMMENÇANT PAR « _ » (réservé système).
   Le piège vécu le 05/09/2026 : lancer un script Python depuis extension/ y laisse un `__pycache__`
   (gitignoré, donc invisible au diff) et `Extensions.loadUnpacked` échoue. Le coût réel n'est pas
   l'échec — c'est que la sonde de précision AU PRODUIT a alors rendu un CHIFFRE PLAUSIBLE MAIS FAUX
   (54,9 % au lieu de 55,4 %), lu comme une régression pendant une heure. Un instrument doit échouer
   BRUYAMMENT, jamais mentir : on refuse de démarrer et on dit quoi supprimer. */
function verifierDossierExtension(dir) {
  const bloquants = fs.readdirSync(dir).filter(n => n.startsWith('_'));
  if (bloquants.length) {
    console.error("✗ DOSSIER D'EXTENSION IMPROPRE AU CHARGEMENT : Chrome réserve les noms commençant par « _ ».");
    bloquants.forEach(n => console.error('    à supprimer : ' + require('path').join(dir, n)));
    console.error('  (typiquement __pycache__ laissé par un script Python — gitignoré, donc invisible au diff)');
    process.exit(2);
  }
}

module.exports = { trouverChrome, servir, attendre, lirePortDevTools, connecter, onglet, verifierDossierExtension, spawn, fs, path, os };
