/* IMAGES PROMOTIONNELLES DE LA FICHE CHROME WEB STORE (STORE.md §6) : petite image 440×280 et image du haut de page 1400×560,
 * PNG 24 bits SANS canal alpha. Rendues par Chrome sans fenêtre (CDP) à partir de deux pages HTML écrites ici, aux couleurs de
 * l'icône (fond nuit, Ω clair, trait orange) et du panneau (vert = sûr, orange = à vérifier). Phrase INVENTÉE (celle des captures).
 *   node extension/promo_store.js && python extension/promo_store.py   → data_local/store/promo/*.png (non commité)
 */
'use strict';
const H = require('./cdp_chrome.js');
const { fs, path, os } = H;
const RACINE = path.join(__dirname, '..');
const BRUT = path.join(RACINE, 'data_local', 'store', 'promo', 'brut');
fs.mkdirSync(BRUT, { recursive: true });

const BASE = `*{box-sizing:border-box}html,body{margin:0;overflow:hidden;background:#0c111a}
  .o{font:400 1em/1 Georgia,"Times New Roman",serif;color:#e6ecf3}
  .bar{background:#e8920c;border-radius:999px}
  body{font-family:"Segoe UI",Arial,sans-serif;color:#e6ecf3}`;

// petite image : lisible réduite de moitié (titre ≥ 22 px à 220×140)
const PETITE = `<!doctype html><html lang="fr"><meta charset="utf-8"><style>${BASE}
  html,body{width:440px;height:280px}
  .o{position:absolute;left:30px;top:52px;width:132px;text-align:center;font-size:132px}
  .bar{position:absolute;left:48px;top:206px;width:96px;height:12px}
  .t{position:absolute;left:186px;top:58px;right:20px}
  .h{font-weight:700;font-size:48px;line-height:1.02;letter-spacing:-.5px}
  .s{margin-top:16px;font-size:20px;line-height:1.3;color:#b9c6d6}
</style><div class="o">Ω</div><div class="bar"></div>
<div class="t"><div class="h">Correcteur<br>dys</div><div class="s">Hors-ligne.<br>Chaque faute expliquée.</div></div></html>`;

// image du haut de page : la promesse à gauche, une phrase corrigée comme dans le panneau à droite
const GRANDE = `<!doctype html><html lang="fr"><meta charset="utf-8"><style>${BASE}
  html,body{width:1400px;height:560px}
  .o{position:absolute;left:92px;top:66px;font-size:124px}
  .bar{position:absolute;left:96px;top:200px;width:92px;height:12px}
  .h{position:absolute;left:236px;top:76px;font-weight:700;font-size:72px;letter-spacing:-1px;line-height:1}
  .tag{position:absolute;left:238px;top:164px;font-size:28px;color:#b9c6d6}
  .pts{position:absolute;left:96px;top:282px;margin:0;padding:0;list-style:none;font-size:31px;line-height:1.75}
  .pts li::before{content:"";display:inline-block;width:15px;height:15px;border-radius:50%;margin-right:20px;vertical-align:3px;background:var(--c)}
  .card{position:absolute;left:800px;top:50%;transform:translateY(-50%);width:528px;background:#fff;border-radius:18px;padding:28px 30px 24px;color:#1a1a1a;
        box-shadow:0 22px 60px rgba(0,0,0,.5)}
  .ph{font-size:29px;line-height:1.55}
  .ph u{text-decoration:none;border-bottom:4px solid var(--c);padding-bottom:1px}
  .it{margin-top:18px;padding:10px 14px;border-radius:9px;font-size:22px;line-height:1.4;border-left:4px solid var(--c);background:var(--f)}
  .it b{font-size:24px}.it .n{color:#5d6b78;font-size:18px}
  .it .astuce{display:block;margin-top:4px;font-size:19px;color:#2a6f97}
</style>
<div class="o">Ω</div><div class="bar"></div>
<div class="h">Correcteur dys</div>
<div class="tag">pour la dyslexie et la dysorthographie</div>
<ul class="pts">
  <li style="--c:#3fae6a">Orthographe et grammaire corrigées</li>
  <li style="--c:#e8920c">Le doute en orange, jamais imposé</li>
  <li style="--c:#6aa9d6">Chaque faute expliquée</li>
  <li style="--c:#e6ecf3">Correction hors-ligne, gratuit, sans publicité</li>
</ul>
<div class="card">
  <div class="ph">Hier, les <u style="--c:#1f7a3d">enfant</u> <u style="--c:#1f7a3d">joue</u> dans le jardin. Ils ramassent des <u style="--c:#e8920c">plante</u>.</div>
  <div class="it" style="--c:#1f7a3d;--f:#eef7f0">« joue » → <b>« jouent »</b> <span class="n">accord sujet-verbe · sûr</span>
    <span class="astuce">💡 C'est « les » qui commande.</span></div>
  <div class="it" style="--c:#e8920c;--f:#fff8ea">« plante » → <b>« plantes »</b> <span class="n">à vérifier</span></div>
</div></html>`;

(async () => {
  const chrome = H.trouverChrome(); if (!chrome) { console.error('Chrome introuvable'); process.exit(2); }
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-promo-'));
  const proc = H.spawn(chrome, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profil, '--no-first-run',
    '--hide-scrollbars', '--force-device-scale-factor=1', '--mute-audio'], { stdio: 'ignore' });
  const ouverts = []; let code = 0;
  try {
    const dp = await H.lirePortDevTools(profil, 60000);
    for (const [nom, html, w, h] of [['petite.png', PETITE, 440, 280], ['grande.png', GRANDE, 1400, 560]]) {
      const c = await H.connecter(await H.onglet(dp, 'data:text/html;charset=utf-8,' + encodeURIComponent(html))); ouverts.push(c);
      await c.envoyer('Page.enable');
      await c.envoyer('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await H.attendre(1200);
      const r = await c.envoyer('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
      fs.writeFileSync(path.join(BRUT, nom), Buffer.from(r.data, 'base64')); console.log('✓', nom);
    }
  } catch (e) { console.error('✗', e && e.message || e); code = 1; }
  finally { for (const s of ouverts) { try { s.fermer(); } catch (e) {} } try { proc.kill(); } catch (e) {} process.exit(code); }
})();
