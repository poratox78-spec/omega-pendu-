#!/usr/bin/env node
/* a11y_probe.js — ACCESSIBILITÉ de l'app dans un VRAI Chrome (les 3 trous du plan du 24/08, comblés par d83d972).
 *
 * Pourquoi un banc NAVIGATEUR et pas un grep : compter des attributs dans la source mesure la syntaxe,
 * pas l'accessibilité (leçon écrite dans le commit d83d972 lui-même). Ici Chrome ouvre la page, une
 * correction est RENDUE, et on vérifie ce qu'un lecteur d'écran et un clavier verraient :
 *   ① #vdd-fb (retour dictée) et #vdk-prev (aperçu décompose) portent aria-live="polite" ;
 *   ② chaque [data-key] rendu (saisie, cadre corrigé, cartes) porte tabindex="0" + role="button" ;
 *   ③ Entrée ET Espace sur un [data-key] ouvrent la carte (#vdc-cardpop) — même carte que le CLIC
 *     (témoin : le clic est vérifié aussi ; si lui non plus n'ouvre rien, le banc est invalide, pas vert) ;
 *   ④ un souligné INFORMATIF sans data-key (run-on « Ponctuation manquante ? ») n'est PAS focusable —
 *     le rendre tabbable créerait des arrêts de tabulation qui ne font rien (le piège de l'audit de juin,
 *     qui visait « .vdc-bad » alors que seule l'ÉMISSION de data-key est actionnable).
 *     Le motif est validé sur un POSITIF : le span doit EXISTER avant qu'on teste l'absence d'attribut.
 *
 * Harnais : réutilise extension/cdp_chrome.js (trouverChrome/CDP — extrait PR#632) ; le serveur statique
 * est local car celui du helper sert une page en conserve pour l'extension, pas le dépôt.
 *
 *   node dictee/a11y_probe.js            # verbeux
 *   node dictee/a11y_probe.js --check    # CI : silencieux si vert, sort 1 si rouge
 *   CHROME="/chemin/chrome" node dictee/a11y_probe.js --tete   # fenêtre visible
 */
'use strict';
const { trouverChrome, attendre, lirePortDevTools, connecter, onglet, spawn, fs, path, os } =
  require('../extension/cdp_chrome.js');
const http = require('http');

const RACINE = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const TETE = process.argv.includes('--tete');
const log = (...a) => { if (!CHECK) console.log(...a); };

/* serveur statique du dépôt (les blobs du moteur se chargent par fetch : file:// ne suffit pas) */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.gz': 'application/gzip',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
function servirDepot() {
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

/* Le script tourne DANS la page : mêmes idiomes que b2_web_probe (jusqua, InputEvent bubbles). */
const SCRIPT = `(async () => {
  const attendre = (ms) => new Promise(r => setTimeout(r, ms));
  const jusqua = async (quoi, f, ms) => { const t0 = Date.now();
    while (Date.now() - t0 < ms) { const v = f(); if (v) return v; await attendre(200); }
    throw new Error('délai : ' + quoi); };
  const echecs = [];
  try {
    /* ① régions vivantes — présentes dès le chargement (les panneaux s'injectent à l'IIFE) */
    const fb = document.getElementById('vdd-fb'), kp = document.getElementById('vdk-prev');
    if (!fb) echecs.push('#vdd-fb ABSENT du DOM');
    else if (fb.getAttribute('aria-live') !== 'polite')
      echecs.push('#vdd-fb sans aria-live="polite" — le retour de dictée est MUET au lecteur d\\'écran');
    if (!kp) echecs.push('#vdk-prev ABSENT du DOM');
    else if (kp.getAttribute('aria-live') !== 'polite')
      echecs.push('#vdk-prev sans aria-live="polite" — l\\'aperçu décompose est muet');
    /* ② une correction RENDUE : fenetre→fenêtre (auto) + run-on « mange il dort » dans la même phrase */
    const b = await jusqua('bouton correcteur',
      () => [...document.querySelectorAll('button')].find(x => /🩹/.test(x.textContent || '')), 30000);
    b.click();
    const zone = await jusqua('zone vdc-in', () => document.getElementById('vdc-in'), 30000);
    await jusqua('lexiques (fenetre→fenêtre)', () => {
      zone.textContent = 'Je mange il dort la fenetre est ouverte';
      zone.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return [...document.querySelectorAll('.vdc-on')].some(e => e.textContent === 'fenêtre');
    }, 60000);
    /* le pipeline re-rend APRÈS le premier vert (passe grammaire asynchrone, ré-habillage 300 ms) :
       un span capturé trop tôt est DÉTACHÉ au moment du geste — son clic ne bulle plus (vécu ici même,
       témoin-clic rouge par flakiness, pas par défaut). On laisse retomber, puis on requête À FRAIS. */
    await attendre(1200);
    const aKeys = [...document.querySelectorAll('#vdc-in [data-key],#vdc-out [data-key],#vdc-result [data-key]')];
    if (!aKeys.length) echecs.push('aucun [data-key] rendu — le banc ne peut rien prouver');
    const sansTab = aKeys.filter(s => s.getAttribute('tabindex') !== '0');
    const sansRole = aKeys.filter(s => s.getAttribute('role') !== 'button');
    if (sansTab.length) echecs.push(sansTab.length + '/' + aKeys.length +
      ' [data-key] SANS tabindex="0" — correction inatteignable au clavier (ex. « ' + sansTab[0].textContent + ' »)');
    if (sansRole.length) echecs.push(sansRole.length + '/' + aKeys.length +
      ' [data-key] SANS role="button" (ex. « ' + sansRole[0].textContent + ' »)');
    /* ③ Entrée / Espace = même carte que le clic — span requêté À FRAIS avant chaque geste (cf. ci-dessus) */
    const carte = document.getElementById('vdc-cardpop');
    const cle0 = document.querySelector('#vdc-result [data-key]');
    if (!carte) echecs.push('#vdc-cardpop ABSENT');
    if (!cle0) echecs.push('aucun [data-key] dans le cadre corrigé (#vdc-result)');
    let parEntree = '', parClic = '';
    if (carte && cle0) {
      const K = cle0.getAttribute('data-key');
      const frais = () => document.querySelector('#vdc-result [data-key="' + CSS.escape(K) + '"]');
      carte.style.display = 'none';
      frais().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await attendre(150);
      if (carte.style.display !== 'block')
        echecs.push('Entrée sur un [data-key] n\\'ouvre PAS la carte — l\\'action reste à la souris seule');
      else parEntree = carte.innerHTML;
      carte.style.display = 'none';
      frais().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await attendre(150);
      if (carte.style.display !== 'block') echecs.push('Espace sur un [data-key] n\\'ouvre PAS la carte');
      carte.style.display = 'none';
      frais().click();
      await attendre(150);
      if (carte.style.display !== 'block') echecs.push('TÉMOIN invalide : le CLIC lui-même n\\'ouvre pas la carte');
      else parClic = carte.innerHTML;
      if (parEntree && parClic && parEntree !== parClic)
        echecs.push('la carte ouverte par Entrée DIFFÈRE de celle du clic');
      carte.style.display = 'none';
    }
    /* ④ souligné informatif SANS data-key : existe (positif) puis PAS focusable */
    const vig = [...document.querySelectorAll('#vdc-in .vdc-vig,#vdc-result .vdc-vig')]
      .find(s => !s.hasAttribute('data-key'));
    if (!vig) echecs.push('aucun souligné informatif sans data-key rendu (run-on attendu sur « il ») — le banc ne prouve pas ④');
    else {
      if (vig.hasAttribute('tabindex'))
        echecs.push('souligné informatif SANS data-key rendu FOCUSABLE (arrêt de tabulation qui ne fait rien) : « ' + vig.textContent + ' »');
      if (vig.getAttribute('role') === 'button')
        echecs.push('souligné informatif SANS data-key annoncé comme bouton : « ' + vig.textContent + ' »');
    }
    return { echecs, nKeys: aKeys.length, vig: vig ? vig.textContent : null };
  } catch (e) { return { echecs, fatal: e.message }; }
})()`;

async function main() {
  const chrome = trouverChrome();
  if (!chrome) {
    console.error('✗ A11Y : aucun Chrome trouvé (installer Chrome ou donner CHROME=…)');
    process.exit(1);
  }
  const { srv, port } = await servirDepot();
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-a11y-'));
  const args = ['--remote-debugging-port=0', '--user-data-dir=' + profil, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--disable-background-networking',
    '--disable-gpu', 'about:blank'];
  if (!TETE) args.unshift('--headless=new');
  const proc = spawn(chrome, args, { stdio: 'ignore' });
  let sess = null, code = 0;
  try {
    const url = 'http://127.0.0.1:' + port + '/app/omega-pendu.html';
    log('Chrome : ' + chrome + '\npage   : ' + url + (TETE ? '  (fenêtre visible)' : '  (headless)'));
    /* onglet vide d'abord, navigation ensuite (sinon « Execution context was destroyed » — vécu, cf. navigateur_probe) */
    const dbg = await lirePortDevTools(profil, 60000);
    sess = await connecter(await onglet(dbg, 'about:blank'));
    await sess.envoyer('Page.enable'); await sess.envoyer('Runtime.enable');
    await sess.envoyer('Page.navigate', { url });
    let pret = false;
    for (let i = 0; i < 300 && !pret; i++) {
      try {
        const q = await sess.envoyer('Runtime.evaluate',
          { expression: '(document.readyState === "complete") && location.pathname.indexOf("omega-pendu") >= 0', returnByValue: true });
        pret = q.result.value === true;
      } catch (e) {}
      if (!pret) await attendre(200);
    }
    if (!pret) throw new Error('app non chargée en 60 s');
    const r = await sess.envoyer('Runtime.evaluate',
      { expression: SCRIPT, awaitPromise: true, returnByValue: true, timeout: 180000 });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception || {}).description || 'exception page');
    const v = r.result.value || {};
    const echecs = (v.echecs || []).slice();
    if (v.fatal) echecs.push('fatal : ' + v.fatal);
    if (echecs.length) {
      console.error('✗ A11Y — ' + echecs.length + ' échec(s) :\n  ' + echecs.join('\n  '));
      code = 1;
    } else {
      const msg = '✓ A11Y app réelle : aria-live (#vdd-fb, #vdk-prev) · ' + v.nKeys +
        ' [data-key] tabbables role=button · Entrée/Espace = la carte du clic · informatif « ' +
        v.vig + ' » non focusable';
      if (CHECK) console.log(msg); else log('\n' + msg);
    }
  } catch (e) { console.error('✗ A11Y : ' + e.message); code = 1; }
  finally {
    try { sess && sess.fermer(); } catch (e) {}
    try { proc.kill(); } catch (e) {}
    try { srv.close(); } catch (e) {}
    try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) {}
  }
  process.exit(code);
}
main();
