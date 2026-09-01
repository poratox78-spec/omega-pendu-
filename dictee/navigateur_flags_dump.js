/* ORACLE DE FLAGS PRIS DANS UN VRAI CHROME — pour que la table de précision par famille cesse
 * d'être une mesure du HARNAIS PYTHON.
 *
 * Pourquoi ce fichier existe (01/09/2026) :
 *   `dictee/dys_precision_probe.py` juge « le moteur de référence (grammaire correcteur_probe +
 *   speller speller_probe) ». Ce n'est PAS le produit. Le produit, c'est `diagnoseAll` : pyramide
 *   (l'ortho nettoie les tokens avant la grammaire), CASCADE (la grammaire retourne sur ses propres
 *   corrections jusqu'au point fixe), arbitrage span/tier, couverture d'élision. La référence Python
 *   appelle grammaire et speller SÉPARÉMENT et ne modélise rien de tout ça.
 *   Le prix de cette confusion est documenté : sur « élision fusionnée », le harnais Python annonçait
 *   3 justes / 17 fausses ; le vrai Chrome a dit 2 justes / 1 fausse, et le correctif qui en découlait
 *   faisait PERDRE « l'eau » et « j'ai ». Il a fallu le reverter.
 *
 * Ce script ne juge rien : il rend les flags BRUTS du moteur réel, à charge pour la sonde Python de
 * les confronter au gold avec son alignement habituel.
 *
 *   node dictee/navigateur_flags_dump.js <entree.json> <sortie.json>
 *     entree.json : ["phrase brute", ...]
 *     sortie.json : [{ toks:[...], flags:[{i,word,sugg,name,tier}] }, ...]  (même ordre)
 */
'use strict';
const H = require(require('path').join(__dirname, '..', 'extension', 'cdp_chrome.js'));
const { fs, path, os, spawn } = H;
const RACINE = path.join(__dirname, '..');
const EXT = path.join(RACINE, 'extension').split(String.fromCharCode(92)).join('/');   // ⚠️ barres OBLIQUES (piège ①)

const [ENTREE, SORTIE] = process.argv.slice(2);
if (!ENTREE || !SORTIE) { console.error('usage : node dictee/navigateur_flags_dump.js <entree.json> <sortie.json>'); process.exit(2); }
const PHRASES = JSON.parse(fs.readFileSync(ENTREE, 'utf8'));
const PAQUET = 40;   // on interroge par paquets : un seul Runtime.evaluate par phrase = 72 allers-retours

(async () => {
  const chrome = H.trouverChrome();
  if (!chrome) { console.error('✗ aucun Chrome trouvé (CHROME=/chemin pour le désigner)'); process.exit(1); }
  const { srv, port: portPage } = await H.servir();
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-flags-'));
  const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profil,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-gpu',
    '--enable-unsafe-extension-debugging', 'about:blank'], { stdio: 'ignore' });
  let nav = null, pg = null;
  const nettoyer = () => { for (const s of [nav, pg]) { try { s && s.fermer(); } catch (e) {} }
    try { proc.kill(); } catch (e) {} try { srv.close(); } catch (e) {}
    try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) {} };
  try {
    const dp = await H.lirePortDevTools(profil, 60000);
    const ver = await (await fetch('http://127.0.0.1:' + dp + '/json/version')).json();
    nav = await H.connecter(ver.webSocketDebuggerUrl);
    try { await nav.envoyer('Extensions.loadUnpacked', { path: EXT }); }
    catch (e) {
      const m = String((e && e.message) || e);
      if (/wasn't found|not found|not implemented|Protocol error/i.test(m)) {
        console.error("✗ ce Chrome ne connaît pas Extensions.loadUnpacked (" + ver.Browser + ") — impossible de mesurer le PRODUIT.");
        nettoyer(); process.exit(3);
      }
      throw e;
    }
    let ctx = 0;
    pg = await H.connecter(await H.onglet(dp, 'about:blank'), (d) => {
      if (d.method === 'Runtime.executionContextCreated' && (d.params.context.auxData || {}).type === 'isolated')
        ctx = d.params.context.id; });
    await pg.envoyer('Runtime.enable'); await pg.envoyer('Page.enable');
    await pg.envoyer('Page.navigate', { url: 'http://127.0.0.1:' + portPage + '/' });
    for (let i = 0; i < 120 && !ctx; i++) await H.attendre(250);
    if (!ctx) throw new Error("le monde isolé du script de contenu n'est jamais apparu");
    // ④ isReady() est FAUX ~3 s (décompression des assets) : on attend un ÉTAT, pas une présence.
    let pret = false;
    for (let i = 0; i < 120 && !pret; i++) {
      const q = await pg.envoyer('Runtime.evaluate', { contextId: ctx, returnByValue: true,
        expression: "(typeof DYSCORE!=='undefined' && DYSCORE.isReady) ? !!DYSCORE.isReady() : false" });
      pret = !!(q.result && q.result.value); if (!pret) await H.attendre(250);
    }
    if (!pret) throw new Error("DYSCORE.isReady() est resté FAUX 30 s — les assets ne se chargent pas");
    console.error('moteur prêt dans ' + ver.Browser + ' — ' + PHRASES.length + ' phrases');

    const out = [];
    for (let k = 0; k < PHRASES.length; k += PAQUET) {
      const lot = PHRASES.slice(k, k + PAQUET);
      const expr = '(() => JSON.stringify(' + JSON.stringify(lot) + '.map(t => {'
        + ' const d = DYSCORE.diagnoseAll(t) || {};'
        + ' const fl = (d.flags || []).map(f => ({ i: f.i, word: f.word, sugg: f.sugg,'
        + '   name: (f.name == null ? null : f.name), tier: (f.tier == null ? null : f.tier),'
        + '   span: (f.span == null ? null : f.span) }));'
        + ' return { toks: DYSCORE.toks(t), flags: fl };'
        + ' })))()';
      const r = await pg.envoyer('Runtime.evaluate', { contextId: ctx, returnByValue: true, expression: expr, timeout: 120000 });
      if (r.exceptionDetails) throw new Error('évaluation : ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
      const v = JSON.parse(r.result.value);
      if (v.length !== lot.length) throw new Error('le moteur a rendu ' + v.length + ' résultats pour ' + lot.length + ' phrases');
      out.push(...v);
      console.error('  ' + Math.min(k + PAQUET, PHRASES.length) + '/' + PHRASES.length);
    }
    fs.writeFileSync(SORTIE, JSON.stringify(out), 'utf8');
    console.error('écrit : ' + SORTIE);
    nettoyer(); process.exit(0);
  } catch (e) {
    console.error('✗ ' + (e && e.message ? e.message : e));
    nettoyer(); process.exit(1);
  }
})();
