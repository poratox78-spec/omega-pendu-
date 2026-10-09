#!/usr/bin/env node
/* dysfont_probe.js — le bouton « Aa OMEGA Dys » de l'en-tête, dans un VRAI Chrome (10/10/2026).
 *
 * Demande de Rem : « un bouton dans l'en-tête, à côté du thème ; il passe tout le site dans notre police avec un espacement large,
 * et le choix est retenu d'une page à l'autre — on laisse la personne décider ». Un grep prouverait que le code est ÉCRIT, pas qu'il
 * MARCHE : ici Chrome ouvre les pages et on vérifie ce qu'un visiteur verrait.
 *   ① défaut : OFF (aucune page ne change de police sans qu'on le demande) ;
 *   ② clic → html[data-dysfont], la police OMEGA Dys est réellement CHARGÉE (document.fonts), le corps l'utilise, l'espacement
 *     s'élargit, le bouton dit son état (aria-pressed) — et le TEXTE de la page ne change pas ;
 *   ③ autre page (/correcteur) : le choix est RETENU, et l'app intégrée dans le cadre le suit (police « OMEGA Dys Site » chargée) ;
 *   ④ second clic : OFF partout, y compris dans le cadre (événement storage) — sans recharger.
 *
 *   node dictee/dysfont_probe.js            # verbeux
 *   node dictee/dysfont_probe.js --check    # CI : silencieux si vert, sort 1 si rouge
 */
'use strict';
const { trouverChrome, attendre, lirePortDevTools, connecter, onglet, spawn, fs, path, os } =
  require('../extension/cdp_chrome.js');
const http = require('http');

const RACINE = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const TETE = process.argv.includes('--tete');
const log = (...a) => { if (!CHECK) console.log(...a); };

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.gz': 'application/gzip', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
function servirDepot() {
  return new Promise((res) => {
    const srv = http.createServer((req, rep) => {
      let url = decodeURIComponent((req.url || '/').split('?')[0]);
      if (url.endsWith('/')) url += 'index.html';
      let f = path.join(RACINE, url.replace(/^\/+/, ''));
      if (!f.startsWith(RACINE)) { rep.writeHead(403).end(); return; }
      if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';   // liens sans .html (comme Cloudflare)
      fs.readFile(f, (e, buf) => {
        if (e) { rep.writeHead(404).end('404'); return; }
        rep.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        rep.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}

const PAGE_INDEX = `(async () => {
  const attendre = (ms) => new Promise(r => setTimeout(r, ms));
  const jusqua = async (quoi, f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = f(); if (v) return v; await attendre(100); } throw new Error('délai : ' + quoi); };
  const echecs = [];
  try {
    const b = await jusqua('bouton Aa', () => document.querySelector('.a11y-dys'), 15000);
    const root = document.documentElement, body = document.body;
    if (root.hasAttribute('data-dysfont')) echecs.push('① le site est en OMEGA Dys SANS qu on l ait demandé (défaut attendu : OFF)');
    if (b.textContent.trim() !== 'Aa') echecs.push('libellé du bouton : « ' + b.textContent + ' » au lieu de « Aa »');
    const voisin = b.previousElementSibling;
    if (!voisin || !/☀️|🌙/.test(voisin.textContent)) echecs.push('le bouton n est pas À CÔTÉ du thème (voisin : « ' + (voisin ? voisin.textContent : '∅') + ' »)');
    const texte0 = body.innerText, esp0 = getComputedStyle(body).letterSpacing;
    b.click();
    await attendre(100);
    if (root.getAttribute('data-dysfont') !== '1') echecs.push('② clic : html[data-dysfont] absent');
    if (b.getAttribute('aria-pressed') !== 'true') echecs.push('② le bouton ne dit pas son état (aria-pressed)');
    await document.fonts.ready;
    await jusqua('police OMEGA Dys chargée', () => document.fonts.check('16px "OMEGA Dys"') && [...document.fonts].some(f => f.family.replace(/"/g, '') === 'OMEGA Dys' && f.status === 'loaded'), 15000).catch(() => echecs.push('② la police OMEGA Dys n est PAS chargée (fichier /police/OmegaDys-Regular.ttf ?)'));
    const ff = getComputedStyle(body).fontFamily, esp1 = getComputedStyle(body).letterSpacing;
    if (!/^"?OMEGA Dys"?/.test(ff)) echecs.push('② le corps n utilise pas OMEGA Dys : ' + ff);
    const h = document.querySelector('h1,h2');
    if (h && !/OMEGA Dys/.test(getComputedStyle(h).fontFamily)) echecs.push('② les titres gardent leur police : ' + getComputedStyle(h).fontFamily);
    if (!(parseFloat(esp1) > (parseFloat(esp0) || 0))) echecs.push('② espacement non élargi (' + esp0 + ' → ' + esp1 + ')');
    if (body.innerText !== texte0) echecs.push('② le TEXTE de la page a changé (la police est un habillage, pas une réécriture)');
    let cle = null; try { cle = localStorage.getItem('omega_dysfont'); } catch (e) {}
    if (cle !== '1') echecs.push('② choix non retenu (omega_dysfont = ' + cle + ')');
    return { echecs, ff };
  } catch (e) { return { echecs, fatal: e.message }; }
})()`;

const PAGE_CORRECTEUR = `(async () => {
  const attendre = (ms) => new Promise(r => setTimeout(r, ms));
  const jusqua = async (quoi, f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = f(); if (v) return v; await attendre(150); } throw new Error('délai : ' + quoi); };
  const echecs = [];
  try {
    const b = await jusqua('bouton Aa', () => document.querySelector('.a11y-dys'), 15000);
    if (document.documentElement.getAttribute('data-dysfont') !== '1') echecs.push('③ choix NON retenu en changeant de page');
    const fr = await jusqua('cadre de l app', () => document.querySelector('iframe'), 15000);
    const d = await jusqua('app chargée dans le cadre', () => { try { return fr.contentDocument && fr.contentDocument.getElementById('omegadys-b64-regular') ? fr.contentDocument : null; } catch (e) { return null; } }, 90000);
    if (d.documentElement.getAttribute('data-dysfont') !== '1') echecs.push('③ l app intégrée ne suit pas le choix (html[data-dysfont] absent dans le cadre)');
    await jusqua('police OMEGA Dys Site chargée dans le cadre', () => [...d.fonts].some(f => f.family.replace(/"/g, '') === 'OMEGA Dys Site' && f.status === 'loaded'), 20000).catch(() => echecs.push('③ police non chargée dans l app (bloc base64 omegadys-b64-regular ?)'));
    const ffa = d.defaultView.getComputedStyle(d.body).fontFamily;
    if (!/OMEGA Dys Site/.test(ffa)) echecs.push('③ le corps de l app n utilise pas la police : ' + ffa);
    b.click();
    await attendre(150);
    if (document.documentElement.hasAttribute('data-dysfont')) echecs.push('④ second clic : la page reste en OMEGA Dys');
    await jusqua('le cadre suit l arrêt', () => !d.documentElement.hasAttribute('data-dysfont'), 5000).catch(() => echecs.push('④ le cadre reste en OMEGA Dys après l arrêt (événement storage)'));
    return { echecs, ffa };
  } catch (e) { return { echecs, fatal: e.message }; }
})()`;

async function evalPage(sess, url, script, marque) {
  await sess.envoyer('Page.navigate', { url });
  let pret = false;
  for (let i = 0; i < 300 && !pret; i++) {
    try {
      const q = await sess.envoyer('Runtime.evaluate', { expression: '(document.readyState === "complete") && location.pathname.indexOf(' + JSON.stringify(marque) + ') >= 0', returnByValue: true });
      pret = q.result.value === true;
    } catch (e) {}
    if (!pret) await attendre(200);
  }
  if (!pret) throw new Error(url + ' non chargée en 60 s');
  const r = await sess.envoyer('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true, timeout: 180000 });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception || {}).description || 'exception page');
  return r.result.value || {};
}

async function main() {
  const chrome = trouverChrome();
  if (!chrome) { console.error('✗ AA OMEGA DYS : aucun Chrome trouvé (installer Chrome ou donner CHROME=…)'); process.exit(1); }
  const { srv, port } = await servirDepot();
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-dysfont-'));
  const args = ['--remote-debugging-port=0', '--user-data-dir=' + profil, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--disable-gpu', 'about:blank'];
  if (!TETE) args.unshift('--headless=new');
  const proc = spawn(chrome, args, { stdio: 'ignore' });
  let sess = null, code = 0;
  try {
    const base = 'http://127.0.0.1:' + port;
    const dbg = await lirePortDevTools(profil, 60000);
    sess = await connecter(await onglet(dbg, 'about:blank'));
    await sess.envoyer('Page.enable'); await sess.envoyer('Runtime.enable');
    const a = await evalPage(sess, base + '/index.html', PAGE_INDEX, 'index');
    const b = await evalPage(sess, base + '/correcteur.html', PAGE_CORRECTEUR, 'correcteur');
    const echecs = [].concat(a.echecs || [], b.echecs || []);
    if (a.fatal) echecs.push('accueil : ' + a.fatal);
    if (b.fatal) echecs.push('correcteur : ' + b.fatal);
    if (echecs.length) { console.error('✗ AA OMEGA DYS — ' + echecs.length + ' échec(s) :\n  ' + echecs.join('\n  ')); code = 1; }
    else {
      const msg = '✓ Aa OMEGA Dys : OFF par défaut · clic → police chargée (' + a.ff.split(',')[0] + '), titres + espacement, texte intact · retenu sur /correcteur · l app intégrée suit (police embarquée) · second clic → OFF partout';
      if (CHECK) console.log(msg); else log(msg);
    }
  } catch (e) { console.error('✗ AA OMEGA DYS : ' + e.message); code = 1; }
  finally {
    try { sess && sess.fermer(); } catch (e) {}
    try { proc.kill(); } catch (e) {}
    try { srv.close(); } catch (e) {}
    try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) {}
  }
  process.exit(code);
}
main();
