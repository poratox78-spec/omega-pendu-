#!/usr/bin/env node
/* b2_web_probe.js — PARITÉ Python ↔ NAVIGATEUR du juge B2 (WebGPU maison).
 *
 * Clone du mécanisme de navigateur_probe.js (61ᵉ check) : serveur http natif + CDP brut sur le
 * WebSocket de Node, la page se démarre SEULE et on LIT ses marques. Différences délibérées :
 *   · PAS de --disable-gpu (WebGPU en a besoin) ; headless d'abord, fenêtre visible en repli
 *     (le WebGPU headless peut manquer selon le pilote) ;
 *   · OUTIL LOCAL, hors batterie : exige data_local/b2_web.bin (gitignoré) + un GPU. Si le
 *     modèle manque → SAUTÉ (sortie 0 explicite), jamais un rouge menteur en CI.
 * Verdict : |score_web − score_py| ≤ 0.005 sur chaque référence ET les préférences des paires
 * sait/s'est conservées (réfs 0-1 : le candidat corrigé doit gagner ; réfs 2-3 : l'écrit correct).
 *   node dictee/b2_web_probe.js [--tete]
 */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawn } = require('child_process');

const RACINE = path.join(__dirname, '..');
const TETE = process.argv.includes('--tete');
const TOL = 0.005;

function trouverChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const c = [];
  if (process.platform === 'win32') {
    for (const b of [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env['LOCALAPPDATA']])
      if (b) c.push(path.join(b, 'Google', 'Chrome', 'Application', 'chrome.exe'),
                   path.join(b, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  } else if (process.platform === 'darwin') {
    c.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  } else {
    c.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  }
  return c.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } }) || null;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.bin': 'application/octet-stream' };
function servir() {
  return new Promise((res) => {
    const srv = http.createServer((req, rep) => {
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      const f = path.join(RACINE, url.replace(/^\/+/, ''));
      if (!f.startsWith(RACINE)) { rep.writeHead(403).end(); return; }
      fs.readFile(f, (e, buf) => {
        if (e) { rep.writeHead(404).end('404'); return; }
        rep.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream',
                             'Cache-Control': 'no-store' });
        rep.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}

function attendre(ms) { return new Promise(r => setTimeout(r, ms)); }
function lirePortDevTools(profil, ms) {
  const t0 = Date.now(), f = path.join(profil, 'DevToolsActivePort');
  return new Promise((res, rej) => { (function boucle() {
    try { const p = parseInt(fs.readFileSync(f, 'utf8').split('\n')[0].trim(), 10); if (p > 0) return res(p); } catch (e) {}
    if (Date.now() - t0 > ms) return rej(new Error('port CDP jamais ouvert'));
    setTimeout(boucle, 200); })(); });
}
async function cible(port, url) {
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch (e) {}
    await attendre(200);
  }
  throw new Error('le port CDP ne répond pas');
}
function connecter(ws) {
  return new Promise((res, rej) => {
    const s = new WebSocket(ws); let id = 0; const attente = new Map();
    s.onopen = () => res({
      envoyer(method, params) {
        return new Promise((ok, ko) => { const n = ++id; attente.set(n, { ok, ko });
          s.send(JSON.stringify({ id: n, method, params: params || {} })); });
      },
      fermer() { try { s.close(); } catch (e) {} },
    });
    s.onerror = (e) => rej(new Error('WebSocket CDP : ' + (e.message || 'échec')));
    s.onmessage = (m) => { const d = JSON.parse(m.data); const a = attente.get(d.id);
      if (!a) return; attente.delete(d.id);
      d.error ? a.ko(new Error(d.error.message)) : a.ok(d.result); };
  });
}

/* Phase 2 — BOUT-EN-BOUT dans la VRAIE app : opt-in coché, phrase ASEI tapée, l'orange
 * « sait/s'est à vérifier (juge) » doit proposer « s'est mariée » (span 2, jamais imposée).
 * Utilise app/b2_web.bin (le fichier COMMITTÉ, celui que Cloudflare servira). */
async function boutEnBout(sess, port) {
  await sess.envoyer('Page.navigate', { url: 'http://127.0.0.1:' + port + '/app/omega-pendu.html' });
  let pret = false;
  for (let i = 0; i < 300 && !pret; i++) {
    try {
      const q = await sess.envoyer('Runtime.evaluate',
        { expression: '(document.readyState === "complete") && location.pathname.indexOf("omega-pendu") >= 0', returnByValue: true });
      pret = q.result.value === true;
    } catch (e) {}
    if (!pret) await attendre(200);
  }
  if (!pret) return { fatal: 'app non chargée' };
  const r = await sess.envoyer('Runtime.evaluate', { expression: `(async () => {
    const attendre = (ms) => new Promise(r => setTimeout(r, ms));
    const jusqua = async (quoi, f, ms) => { const t0 = Date.now();
      while (Date.now() - t0 < ms) { const v = f(); if (v) return v; await attendre(200); }
      throw new Error('délai : ' + quoi); };
    try {
      try { localStorage.removeItem('vdc_b2'); } catch (e) {}
      const b = await jusqua('bouton correcteur',
        () => [...document.querySelectorAll('button')].find(x => /🩹/.test(x.textContent || '')), 30000);
      b.click();
      const zone = await jusqua('zone vdc-in', () => document.getElementById('vdc-in'), 30000);
      await jusqua('lexiques (fenetre→fenêtre)', () => {
        zone.textContent = 'la fenetre est ouverte';
        zone.dispatchEvent(new InputEvent('input', { bubbles: true }));
        return [...document.querySelectorAll('.vdc-on')].some(e => e.textContent === 'fenêtre');
      }, 60000);
      const bb = document.getElementById('vdc-b2-on');
      if (!bb) return { fatal: 'toggle vdc-b2-on absent' };
      bb.click();                                                    // opt-in → chargement au prochain runCorr
      zone.textContent = "elle sais marier a l'age de vingt ans";
      zone.dispatchEvent(new InputEvent('input', { bubbles: true }));
      const etat = document.getElementById('vdc-b2-etat');
      await jusqua('juge prêt', () => (etat.textContent || '').indexOf('✓') >= 0, 60000);
      zone.dispatchEvent(new InputEvent('input', { bubbles: true }));  // re-passe avec juge prêt
      await jusqua('orange du juge', () => (document.getElementById('vdc-out').textContent || '').indexOf("s'est mariée") >= 0, 30000);
      const chips = document.getElementById('vdc-out').textContent;
      const applique = [...document.querySelectorAll('.vdc-on')].map(e => e.textContent);
      /* ── ARBITRE : sur une phrase CORRECTE, l'orange fatigue « août→aoûts » (accord pluriel)
         doit APPARAÎTRE (pipeline sync) puis SE TAIRE (le juge la dément, Δ=−0.14 mesuré). */
      zone.textContent = 'La chapelle sert à célébrer le souvenir de saint Louis tous les ans, le 25 août.';
      zone.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await jusqua('orange fatigue presente (aouts)', () => (document.getElementById('vdc-out').textContent || '').indexOf('aoûts') >= 0, 20000);
      await jusqua('arbitre : orange tue (aouts)', () => (document.getElementById('vdc-out').textContent || '').indexOf('aoûts') < 0, 20000);
      return { ok: true, juge: chips.indexOf('(juge)') >= 0,
               nonImpose: applique.every(a => a.indexOf("s'est") < 0),
               arbitre: true, etat: etat.textContent };
    } catch (e) { return { fatal: e.message }; }
  })()`, awaitPromise: true, returnByValue: true, timeout: 180000 });
  if (r.exceptionDetails) return { fatal: (r.exceptionDetails.exception || {}).description };
  return r.result.value || { fatal: 'réponse vide' };
}

async function tenter(chrome, port, visible) {
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-b2gpu-'));
  const args = ['--remote-debugging-port=0', '--user-data-dir=' + profil, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--disable-background-networking',
    '--enable-unsafe-webgpu', 'about:blank'];                 // PAS de --disable-gpu : WebGPU
  if (!visible) args.unshift('--headless=new');
  const proc = spawn(chrome, args, { stdio: 'ignore' });
  let sess = null;
  try {
    const dbg = await lirePortDevTools(profil, 60000);
    sess = await connecter(await cible(dbg, 'about:blank'));
    await sess.envoyer('Page.enable'); await sess.envoyer('Runtime.enable');
    await sess.envoyer('Page.navigate', { url: 'http://127.0.0.1:' + port + '/dictee/b2_web/test.html' });
    let res = null;
    for (let i = 0; i < 600 && !res; i++) {                   // 2 min : poids 15 Mo + forwards
      try {
        const q = await sess.envoyer('Runtime.evaluate', { expression: 'window.__B2RES ? JSON.stringify(window.__B2RES) : null', returnByValue: true });
        if (q.result.value) res = JSON.parse(q.result.value);
      } catch (e) {}
      if (!res) await attendre(200);
    }
    if (res && res.pret) res.app = await boutEnBout(sess, port);   // phase 2 dans le MÊME Chrome
    return res || { pret: false, raison: 'délai (page muette en 2 min)' };
  } finally {
    try { sess && sess.fermer(); } catch (e) {}
    try { proc.kill(); } catch (e) {}
    try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) {}
  }
}

async function main() {
  if (!fs.existsSync(path.join(RACINE, 'data_local', 'b2_web.bin')) ||
      !fs.existsSync(path.join(RACINE, 'data_local', 'b2_web_refs.json'))) {
    console.log('· B2 WEB : SAUTÉ (data_local/b2_web.bin absent — outil local, lancer b2_export_web.py --check)');
    process.exit(0);
  }
  const chrome = trouverChrome();
  if (!chrome) { console.error('✗ B2 WEB : aucun Chrome/Edge trouvé'); process.exit(1); }
  const { srv, port } = await servir();
  let code = 0;
  try {
    let r = await tenter(chrome, port, TETE);
    if (!r.pret && String(r.raison || '').indexOf('webgpu') >= 0 && !TETE) {
      console.log('· WebGPU absent en headless → nouvel essai fenêtre visible');
      r = await tenter(chrome, port, true);
    }
    if (!r.pret) { console.error('✗ B2 WEB : ' + r.raison); code = 1; }
    else {
      let pire = 0; const echecs = [];
      r.lignes.forEach((l) => {
        const d = Math.abs(l.web - l.py); if (d > pire) pire = d;
        console.log('  ' + (d <= TOL ? '✓' : '✗') + ' |Δ|=' + d.toFixed(5) + '  web ' + l.web.toFixed(4) +
          '  py ' + l.py.toFixed(4) + '  ' + l.ms + ' ms  « ' + l.s.slice(0, 55) + ' »');
        if (d > TOL) echecs.push('écart ' + d.toFixed(5) + ' sur « ' + l.s.slice(0, 60) + ' »');
      });
      const L = r.lignes;
      if (L.length >= 4) {                                     // les préférences des paires sait/s'est
        if (!(L[1].web > L[0].web)) echecs.push('paire RÉELLE : le candidat « s\'est mariée » doit gagner au web');
        if (!(L[2].web > L[3].web)) echecs.push('paire PIÈGE : « sait marier les saveurs » doit rester préféré au web');
      }
      const app = r.app || { fatal: 'phase bout-en-bout jamais lancée' };
      if (app.fatal) echecs.push('bout-en-bout app : ' + app.fatal);
      else {
        if (!app.juge) echecs.push('bout-en-bout : l\'orange doit être étiquetée « (juge) »');
        if (!app.nonImpose) echecs.push('bout-en-bout : l\'orange du juge a été APPLIQUÉE — elle doit rester proposée (vigilance)');
        if (!app.arbitre) echecs.push('bout-en-bout : l\'arbitre doit taire l\'orange fatigue « aoûts » sur phrase correcte');
        console.log('  ' + (app.juge && app.nonImpose && app.arbitre ? '✓' : '✗') +
          ' app réelle : « s\'est mariée » proposée jamais imposée + orange fatigue « aoûts » tue par l\'arbitre (' + app.etat + ')');
      }
      const ms = L.reduce((a, l) => a + l.ms, 0) / Math.max(L.length, 1);
      if (echecs.length) { console.error('\n✗ B2 WEB — ' + echecs.length + ' échec(s) :\n  ' + echecs.join('\n  ')); code = 1; }
      else console.log('✓ B2 WEB : parité navigateur (pire |Δ|=' + pire.toFixed(5) + ' ≤ ' + TOL +
        ', préférences conservées, charge ' + r.chargeMs + ' ms, ' + ms.toFixed(0) + ' ms/score) + greffe app bout-en-bout');
    }
  } catch (e) { console.error('✗ B2 WEB : ' + e.message); code = 1; }
  srv.close();
  process.exit(code);
}
main();
