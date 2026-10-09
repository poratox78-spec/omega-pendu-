#!/usr/bin/env node
/* sonsite_probe.js — le bouton « 🔡 » de l'en-tête : la police de son sur TOUTES les pages, dans un VRAI Chrome (09/10/2026).
 *
 * Demande de Rem : les couleurs des syllabes et des sons sur tout le site, puis dans l'extension, rendu vérifié à l'œil.
 * Un grep prouverait que le code est ÉCRIT ; ici Chrome ouvre les pages et on vérifie ce qu'un visiteur verrait.
 *   ① défaut : OFF — aucune page n'est habillée sans qu'on le demande ; le bouton est juste après « Aa » ;
 *   ② clic → les blocs à l'écran s'habillent (habillage paresseux), puis toute la page : polices de son CHARGÉES (Heavy/Light),
 *      voisé en Heavy, muette en vermillon, syllabes alternées ; le TEXTE de la page est identique au caractère près ;
 *      en-tête, code, boutons, champs : jamais touchés ;
 *   ③ /correcteur : le choix est RETENU, et l'app dans le cadre l'a pris (mêmes clés vdd_son / vdd_syl) ;
 *   ④ second clic : la page redevient elle-même (texte identique), le cadre s'éteint SANS recharger ;
 *   ⑤ sens inverse : le bouton « Police de son » du correcteur rallume l'en-tête et la page, sans recharger ;
 *   ⑥ /en/ : pas de bouton (le g2p est français).
 *
 *   node dictee/sonsite_probe.js            # verbeux
 *   node dictee/sonsite_probe.js --check    # CI : silencieux si vert, sort 1 si rouge
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

const OUTILS = `
  const attendre = (ms) => new Promise(r => setTimeout(r, ms));
  const jusqua = async (quoi, f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = f(); if (v) return v; await attendre(120); } throw new Error('délai : ' + quoi); };
  const rgb = (h) => 'rgb(' + parseInt(h.slice(0, 2), 16) + ', ' + parseInt(h.slice(2, 4), 16) + ', ' + parseInt(h.slice(4, 6), 16) + ')';
`;

const PAGE_RECHERCHE = `(async () => {${OUTILS}
  const echecs = [];
  try {
    const b = await jusqua('bouton 🔡', () => document.querySelector('.a11y-son'), 15000);
    const main = document.querySelector('main') || document.body;
    if (document.querySelector('.son-txt')) echecs.push('① la page est habillée SANS qu on l ait demandé (défaut attendu : OFF)');
    if (b.getAttribute('aria-pressed') !== 'false') echecs.push('① le bouton ne dit pas qu il est éteint (aria-pressed)');
    const voisin = b.previousElementSibling;
    if (!voisin || !voisin.classList.contains('a11y-dys')) echecs.push('① le bouton n est pas juste après « Aa »');
    const texte0 = main.textContent, tete0 = document.querySelector('header.top').textContent;
    b.click();
    await jusqua('habillage des blocs à l écran', () => document.querySelector('main .son-txt'), 20000)
      .catch(() => echecs.push('② clic : rien ne s habille à l écran (scripts /police/son_core.js, g2p.js, son_site.js ?)'));
    if (b.getAttribute('aria-pressed') !== 'true') echecs.push('② le bouton ne dit pas son état (aria-pressed)');
    if (typeof OmegaSonSite === 'undefined') return { echecs, fatal: 'OmegaSonSite absent' };
    OmegaSonSite.tout();
    await document.fonts.ready;
    for (const fam of ['OMEGA Dys Heavy', 'OMEGA Dys Light'])
      await jusqua('police ' + fam, () => [...document.fonts].some(f => f.family.replace(/"/g, '') === fam && f.status === 'loaded'), 15000)
        .catch(() => echecs.push('② police ' + fam + ' NON chargée (/police/*.ttf ?)'));
    const nSeg = document.querySelectorAll('.son-seg').length;
    if (nSeg < 5000) echecs.push('② page à moitié habillée : ' + nSeg + ' segments (attendu > 5 000 sur /recherche)');
    if (main.textContent !== texte0) echecs.push('② le TEXTE de la page a changé (l habillage ne doit rien réécrire)');
    if (document.querySelector('header.top').textContent !== tete0 || document.querySelector('header.top .son-txt')) echecs.push('② l en-tête a été habillé');
    const interdits = document.querySelectorAll('code .son-txt, pre .son-txt, button .son-txt, textarea .son-txt, svg .son-txt, [contenteditable] .son-txt').length;
    if (interdits) echecs.push('② ' + interdits + ' habillage(s) dans du code, un bouton ou un champ');
    const voi = document.querySelector('.son-seg[data-son="voi"]'), mute = document.querySelector('.son-seg.son-mute:not(.son-syl)');
    if (!voi || !/OMEGA Dys Heavy/.test(getComputedStyle(voi).fontFamily)) echecs.push('② le voisé n est pas en Heavy : ' + (voi ? getComputedStyle(voi).fontFamily : '∅'));
    const sombre = document.documentElement.getAttribute('data-theme') === 'dark';
    if (!mute || getComputedStyle(mute).color !== rgb(sombre ? 'f0a04b' : 'a34700')) echecs.push('② la muette n est pas en vermillon (' + (mute ? getComputedStyle(mute).color : '∅') + ', thème ' + (sombre ? 'sombre' : 'clair') + ')');
    if (!document.querySelector('.son-seg.son-syl')) echecs.push('② aucune syllabe colorée (vdd_syl)');
    let k = null, s = null; try { k = localStorage.getItem('vdd_son'); s = localStorage.getItem('vdd_syl'); } catch (e) {}
    if (k !== '1' || s !== '1') echecs.push('② choix non retenu (vdd_son = ' + k + ', vdd_syl = ' + s + ')');
    return { echecs, nSeg };
  } catch (e) { return { echecs, fatal: e.message }; }
})()`;

const PAGE_CORRECTEUR = `(async () => {${OUTILS}
  const echecs = [];
  try {
    const b = await jusqua('bouton 🔡', () => document.querySelector('.a11y-son'), 15000);
    if (b.getAttribute('aria-pressed') !== 'true') echecs.push('③ choix NON retenu en changeant de page');
    const fr = await jusqua('cadre de l app', () => document.querySelector('iframe'), 15000);
    const d = await jusqua('app chargée dans le cadre', () => { try { return fr.contentDocument && fr.contentDocument.getElementById('vdc-son') ? fr.contentDocument : null; } catch (e) { return null; } }, 90000);
    const bc = d.getElementById('vdc-son');
    if (bc.getAttribute('aria-pressed') !== 'true' || !d.body.classList.contains('son-actif')) echecs.push('③ l app intégrée n a pas pris le choix de l en-tête');
    await jusqua('page habillée', () => document.querySelector('main .son-txt'), 20000).catch(() => echecs.push('③ la page /correcteur n est pas habillée'));
    OmegaSonSite.tout();
    const main = document.querySelector('main') || document.body;
    b.click();
    await attendre(200);
    if (document.querySelector('.son-txt')) echecs.push('④ second clic : la page reste habillée');
    const texteOff = main.textContent;
    await jusqua('le cadre s éteint', () => !d.body.classList.contains('son-actif') && bc.getAttribute('aria-pressed') === 'false', 5000)
      .catch(() => echecs.push('④ le cadre reste en police de son après l arrêt (événement storage)'));
    bc.click();
    await jusqua('l en-tête suit le correcteur', () => b.getAttribute('aria-pressed') === 'true', 5000)
      .catch(() => echecs.push('⑤ le bouton du correcteur ne rallume pas l en-tête (événement storage)'));
    await jusqua('la page suit le correcteur', () => document.querySelector('main .son-txt'), 10000)
      .catch(() => echecs.push('⑤ la page ne se rhabille pas quand le correcteur rallume la police de son'));
    bc.click();
    await jusqua('l en-tête suit l arrêt', () => b.getAttribute('aria-pressed') === 'false' && !document.querySelector('.son-txt'), 5000)
      .catch(() => echecs.push('⑤ l arrêt depuis le correcteur ne déshabille pas la page'));
    if (main.textContent !== texteOff) echecs.push('④ le texte de la page n est pas revenu à l identique');
    return { echecs };
  } catch (e) { return { echecs, fatal: e.message }; }
})()`;

const PAGE_EN = `(async () => {${OUTILS}
  await jusqua('barre a11y', () => document.querySelector('.a11y-dys'), 15000);
  return { echecs: document.querySelector('.a11y-son') ? ['⑥ /en/ : bouton 🔡 présent (le g2p est français)'] : [] };
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
  if (!chrome) { console.error('✗ POLICE DE SON (site) : aucun Chrome trouvé (installer Chrome ou donner CHROME=…)'); process.exit(1); }
  const { srv, port } = await servirDepot();
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-sonsite-'));
  const args = ['--remote-debugging-port=0', '--user-data-dir=' + profil, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--disable-gpu', '--window-size=1200,900', 'about:blank'];
  if (!TETE) args.unshift('--headless=new');
  const proc = spawn(chrome, args, { stdio: 'ignore' });
  let sess = null, code = 0;
  try {
    const base = 'http://127.0.0.1:' + port;
    const dbg = await lirePortDevTools(profil, 60000);
    sess = await connecter(await onglet(dbg, 'about:blank'));
    await sess.envoyer('Page.enable'); await sess.envoyer('Runtime.enable');
    try { await sess.envoyer('Emulation.setFocusEmulationEnabled', { enabled: true }); } catch (e) {}
    const a = await evalPage(sess, base + '/recherche.html', PAGE_RECHERCHE, 'recherche');
    const b = await evalPage(sess, base + '/correcteur.html', PAGE_CORRECTEUR, 'correcteur');
    const c = await evalPage(sess, base + '/en/recherche.html', PAGE_EN, 'en/recherche');
    const echecs = [].concat(a.echecs || [], b.echecs || [], c.echecs || []);
    if (a.fatal) echecs.push('recherche : ' + a.fatal);
    if (b.fatal) echecs.push('correcteur : ' + b.fatal);
    if (echecs.length) { console.error('✗ POLICE DE SON (site) — ' + echecs.length + ' échec(s) :\n  ' + echecs.join('\n  ')); code = 1; }
    else {
      const msg = '✓ 🔡 police de son du site : OFF par défaut · clic → ' + a.nSeg + ' segments sur /recherche, polices chargées, voisé Heavy, muette vermillon, syllabes, texte intact, en-tête et code épargnés · retenu sur /correcteur, l app suit · arrêt et rallumage dans les deux sens sans recharger · pas de bouton en /en/';
      if (CHECK) console.log(msg); else log(msg);
    }
  } catch (e) { console.error('✗ POLICE DE SON (site) : ' + e.message); code = 1; }
  finally {
    try { sess && sess.fermer(); } catch (e) {}
    try { proc.kill(); } catch (e) {}
    try { srv.close(); } catch (e) {}
    try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) {}
  }
  process.exit(code);
}
main();
