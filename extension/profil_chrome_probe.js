/* UN PASSAGE DE SONDE NE LAISSE RIEN DANS LE DOSSIER TEMPORAIRE.
 *
 * Vécu le 01/11/2026 : 1 338 dossiers omega-* dans %TEMP%, 31,7 Go en 13 jours, C: tombé à 33 Go libres.
 * Les sondes croyaient faire le ménage : `proc.kill()` puis `rmSync(profil)` dans un try/catch muet. Or
 * kill rend la main AVANT que Chrome ait lâché ses fichiers : 12 effacements immédiats sur 12 en EPERM,
 * invisibles. Le même effacement passe 200 à 360 ms plus tard (10 sur 10, rien ne réapparaît ensuite).
 *
 *  ① STATIQUE : tout script suivi qui lance Chrome sur un profil l'éteint par `eteindreChrome`, et les
 *     scripts Python qui créent un dossier temporaire l'effacent. C'est ce qui empêche la recopie du
 *     vieux motif ; vue ROUGE sur 11 scripts Chrome et 3 Python avant la correction.
 *  ② RÉEL : un vrai Chrome, un onglet ouvert, éteint → le profil est parti, et il ne revient pas.
 *
 * Lancer : node extension/profil_chrome_probe.js
 */
'use strict';
const H = require('./cdp_chrome.js');
const { fs, path, os, spawn } = H;
const { execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const PASSAGES = 3;

function controleStatique() {
  const fautes = [];
  const suivis = execFileSync('git', ['ls-files', '*.js', '*.cjs', '*.mjs', '*.py'], { cwd: RACINE, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  for (const f of suivis) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    if (f.endsWith('.py')) {
      if (src.includes('tempfile.mkdtemp(') && !src.includes('rmtree')) fautes.push(f + ' : mkdtemp jamais effacé (prendre TemporaryDirectory)');
    } else if (src.includes('--user-data-dir')) {
      if (!src.includes('eteindreChrome(')) fautes.push(f + " : lance Chrome sans l'éteindre par eteindreChrome");
      if (/\bproc\.kill\(/.test(src)) fautes.push(f + ' : proc.kill() direct (le profil reste)');
      if (/rmSync\(\s*profil/.test(src)) fautes.push(f + ' : rmSync(profil) direct (échoue tant que Chrome tient ses fichiers)');
    }
  }
  return { fautes, n: suivis.length };
}

async function controleReel() {
  const chrome = H.trouverChrome();
  if (!chrome) throw new Error('aucun Chrome trouvé (installer Chrome ou donner CHROME=…)');
  let pire = 0;
  for (let i = 0; i < PASSAGES; i++) {
    const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-profil-'));
    const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profil, '--no-first-run',
      '--no-default-browser-check', '--disable-background-networking', '--disable-gpu', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    try {
      const dp = await H.lirePortDevTools(profil, 60000);
      const c = await H.connecter(await H.onglet(dp, 'about:blank'));
      await c.envoyer('Runtime.enable');
      await H.attendre(1000);   // le temps que le profil se remplisse, comme pendant une vraie sonde
      c.fermer();
    } finally {
      const t0 = Date.now();
      const efface = H.eteindreChrome(proc, profil);
      pire = Math.max(pire, Date.now() - t0);
      if (!efface) throw new Error('eteindreChrome a renoncé : ' + profil);
    }
    if (fs.existsSync(profil)) throw new Error('le profil existe encore : ' + profil);
    await H.attendre(1500);
    if (fs.existsSync(profil)) throw new Error('le profil est réapparu après coup : ' + profil);
  }
  return pire;
}

(async () => {
  const { fautes, n } = controleStatique();
  fautes.forEach(x => console.error('  ✗ ' + x));
  console.log((fautes.length ? '✗ ' : '✓ ') + n + ' scripts suivis relus : ' + fautes.length + ' laisse(nt) leur dossier temporaire');
  let code = fautes.length ? 1 : 0;
  try {
    const pire = await controleReel();
    console.log('✓ vrai Chrome : profil effacé ' + PASSAGES + ' fois sur ' + PASSAGES + ', il ne revient pas (pire délai ' + pire + ' ms)');
  } catch (e) { console.error('✗ vrai Chrome : ' + e.message); code = 1; }
  process.exit(code);
})();
