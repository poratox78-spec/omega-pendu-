/* CAPTURES DE LA FICHE CHROME WEB STORE (STORE.md §6 : 1280×800, PNG 24 bits SANS canal alpha) — l'extension RÉELLE (ce dossier)
 * chargée dans un Chrome sans fenêtre (CDP, Extensions.loadUnpacked, cf. cdp_chrome.js), son panneau ouvert comme un onglet
 * (sidepanel.html). Textes INVENTÉS. Chaque scène = une page d'écriture neutre (860×800) + le panneau réel (420×800), assemblés par
 * captures_store.py ; le mode d'emploi (aide.html) est capturé seul à 1280×800.
 *   node extension/captures_store.js && python extension/captures_store.py   → data_local/store/captures/*.png (non commité)
 * La case « Recopier ce que je tape sur la page » est décochée pour écrire dans le panneau, puis remontrée cochée sur l'image :
 * c'est son état par défaut, et le texte de la page y est justement recopié.
 */
'use strict';
const H = require('./cdp_chrome.js');
const { fs, path, os } = H;
const RACINE = path.join(__dirname, '..');
const EXT = path.join(RACINE, 'extension').replace(/\\/g, '/');
const BRUT = path.join(RACINE, 'data_local', 'store', 'captures', 'brut');
fs.mkdirSync(BRUT, { recursive: true });
const TEXTE = "Hier, les enfant joue dans le jardin. Ils ramassent des plante le long des mure. Il est rentré tôt a cause du vent, mais séte histoire est drôle.";
const PAGE = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Mon cahier</title><style>
body{margin:0;font-family:"Segoe UI",Arial,sans-serif;background:#eef2f6;color:#1d2733}
.bar{height:56px;background:#fff;border-bottom:1px solid #d9e1ea;display:flex;align-items:center;padding:0 28px;font-weight:600;font-size:17px;color:#2d4256}
.bar span{margin-left:auto;font-weight:400;font-size:14px;color:#6b7c8d}
.card{margin:34px auto;width:740px;background:#fff;border:1px solid #d9e1ea;border-radius:12px;padding:26px 28px}
label{display:block;font-size:13px;letter-spacing:.02em;color:#5a6b7c;margin:0 0 6px}
.in{border:1px solid #cdd7e2;border-radius:8px;padding:11px 13px;font-size:16px;margin-bottom:18px;background:#fbfcfd}
.ta{min-height:300px;line-height:1.65;font-size:18px;outline:2px solid #2f6fb3;outline-offset:-1px}
.btn{display:inline-block;background:#2f6fb3;color:#fff;border-radius:8px;padding:10px 20px;font-weight:600;font-size:15px}
</style><div class="bar">Mon cahier — rédaction<span>brouillon enregistré</span></div>
<div class="card"><label>Titre</label><div class="in">Une journée au jardin</div><label>Texte</label><div class="in ta">${TEXTE}</div><span class="btn">Enregistrer</span></div></html>`;

(async () => {
  const chrome = H.trouverChrome(); if (!chrome) { console.error('Chrome introuvable'); process.exit(2); }
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-store-'));
  const proc = H.spawn(chrome, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profil, '--no-first-run',
    '--window-size=1280,800', '--hide-scrollbars', '--force-device-scale-factor=1', '--mute-audio', '--enable-unsafe-extension-debugging'], { stdio: 'ignore' });
  const ouverts = [];
  try {
    const dp = await H.lirePortDevTools(profil, 60000);
    const ver = await (await fetch('http://127.0.0.1:' + dp + '/json/version')).json();
    const nav = await H.connecter(ver.webSocketDebuggerUrl); ouverts.push(nav);
    const r0 = await nav.envoyer('Extensions.loadUnpacked', { path: EXT });
    console.log('extension :', r0.id);
    const tab = async (url, w, h) => { const c = await H.connecter(await H.onglet(dp, url)); ouverts.push(c);
      await c.envoyer('Runtime.enable'); await c.envoyer('Page.enable');
      await c.envoyer('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      c.js = async (expr) => { const r = await c.envoyer('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout: 120000 });
        if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
      c.photo = async (nom) => { try { await c.envoyer('Runtime.evaluate', { expression: "(() => { const m = document.getElementById('omdys-mirror'); if (m) m.checked = true; })()" }); } catch (e) {}
        const r = await c.envoyer('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(BRUT, nom), Buffer.from(r.data, 'base64')); console.log('✓', nom); };
      return c; };
    const AIDE = `const w = (ms) => new Promise(r => setTimeout(r, ms));
      const until = async (f, ms) => { const t0 = Date.now(); for (;;) { let v = null; try { v = f(); } catch (e) {} if (v) return v; if (Date.now() - t0 > ms) return null; await w(150); } };
      const caseTexte = (re) => { const l = Array.from(document.querySelectorAll('label')).find(x => re.test(x.textContent || '')); return l ? (l.querySelector('input') || document.getElementById(l.htmlFor)) : null; };`;

    // la page d'écriture (gauche)
    const pg = await tab('data:text/html;charset=utf-8,' + encodeURIComponent(PAGE), 860, 800);
    await H.attendre(800); await pg.photo('page.png');

    // le panneau (droite)
    const pp = await tab('chrome-extension://' + r0.id + '/sidepanel.html', 420, 800);
    console.log('panneau :', await pp.js(`(async () => { ${AIDE}
      const ta = await until(() => document.getElementById('omdys-ta'), 20000); if (!ta) return 'zone absente';
      const st = document.getElementById('omdys-st'); const pret = await until(() => st && /pr[êe]t/i.test(st.textContent || ''), 30000); if (!pret) return 'pas prêt';
      const mir = document.getElementById('omdys-mirror'); if (mir && mir.checked) { mir.checked = false; mir.dispatchEvent(new Event('change', { bubbles: true })); }
      ta.focus(); ta.value = ${JSON.stringify(TEXTE)}; ta.dispatchEvent(new Event('input', { bubbles: true }));
      await until(() => document.querySelectorAll('#omdys-corr .item').length > 0, 30000); await w(1500); ta.blur();
      return document.querySelectorAll('#omdys-corr .item').length + ' corrections'; })()`));
    // ① le panneau en action
    await pp.js('window.scrollTo(0, 0)'); await H.attendre(300); await pp.photo('p1-panneau.png');
    // ② le pourquoi : les 💡 de « joue → jouent » et de « a → à » dépliés
    console.log('astuces :', await pp.js(`(async () => { ${AIDE}
      const its = Array.from(document.querySelectorAll('#omdys-corr .item')); const out = [];
      for (const it of its) { if (/« joue »|« a »/.test(it.textContent || '')) { const b = it.querySelector('button.why'); if (b) { b.click(); await w(400); }
        const a = it.querySelector('.astuce'); out.push(a && !a.hidden ? a.textContent.slice(0, 90) : '(fermée)'); } }
      const premier = its.find(it => /« enfant »/.test(it.textContent || '')); if (premier) premier.scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); await w(400);
      return out.join(' | '); })()`));
    await pp.photo('p2-pourquoi.png');
    // ③ la police de son (+ syllabes)
    console.log('police :', await pp.js(`(async () => { ${AIDE}
      document.querySelectorAll('.astuce').forEach(a => { a.hidden = true; });
      const ps = caseTexte(/Police de son/i), sy = caseTexte(/Syllabes/i);
      for (const c of [ps, sy]) if (c && !c.checked) { c.click(); await w(1500); }
      window.scrollTo(0, 0); await w(800); return 'police=' + (ps && ps.checked) + ' syllabes=' + (sy && sy.checked); })()`));
    await pp.photo('p3-police-de-son.png');
    console.log('police off :', await pp.js(`(async () => { ${AIDE}
      const ps = caseTexte(/Police de son/i), sy = caseTexte(/Syllabes/i);
      for (const c of [sy, ps]) if (c && c.checked) { c.click(); await w(1200); }
      return 'ok'; })()`));
    // ④ l'aide au nombre
    console.log('nombre :', await pp.js(`(async () => { ${AIDE}
      const t = Array.from(document.querySelectorAll('summary, button, h2, h3, div')).find(x => /Aide au nombre/.test(x.textContent || '') && x.children.length <= 3);
      if (t) { t.click(); await w(800); }
      const champ = Array.from(document.querySelectorAll('input, textarea')).find(x => x.offsetParent && x.id !== 'omdys-ta' && (x.type === 'text' || x.tagName === 'TEXTAREA' || x.type === 'search'));
      if (champ) { champ.focus(); champ.value = '1 234 567 + 305'; champ.dispatchEvent(new Event('input', { bubbles: true })); await w(1500); champ.blur(); }
      const zone = t ? (t.closest('details') || t.parentElement) : null; if (zone) zone.scrollIntoView({ block: 'start' }); await w(500);
      return (t ? 'titre ok' : 'titre absent') + ' / champ ' + (champ ? (champ.id || champ.className || champ.tagName) : 'absent'); })()`));
    await pp.photo('p4-nombre.png');
    // ⑤ le mode d'emploi, seul
    const pa = await tab('chrome-extension://' + r0.id + '/aide.html', 1280, 800);
    await H.attendre(1500); await pa.photo('p5-mode-emploi.png');
  } catch (e) { console.error('✗', e && e.message || e); process.exitCode = 1; }
  finally { for (const s of ouverts) { try { s.fermer(); } catch (e) {} } try { proc.kill(); } catch (e) {} }
})();
