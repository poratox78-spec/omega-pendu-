#!/usr/bin/env node
/* L'ORDRE DE CHARGEMENT — « si l'extension est chargée après la page, ça marche pas » (Rem, 19/09/2026).
 *
 * LE DÉFAUT, REPRODUIT. Un `content_scripts` déclaratif ne s'injecte JAMAIS rétroactivement : après une
 * installation ou une mise à jour, tous les onglets ouverts AVANT n'ont pas le script. La recopie ne
 * marchait donc pas, et le panneau restait vide SANS RIEN DIRE — le pire cas pour un lecteur dys, qui
 * ne peut pas deviner que la panne est dans l'ordre de chargement et croit que le correcteur est cassé.
 *
 * POURQUOI UN BANC À PART, et pas une garde de plus dans `navigateur_ext_probe.js`. Ce banc-là charge
 * l'extension PUIS ouvre la page — c'est sa prémisse, et toutes ses gardes en dépendent. Ici le sujet
 * EST l'ordre inverse : il faut un Chrome dont la page précède l'extension. Le replier dans l'autre
 * aurait demandé un second navigateur à l'intérieur, donc deux fois son coût, pour une question qui n'a
 * rien à voir avec les assets. Celui-ci ne charge aucun lexique et ne réveille aucun moteur : il ouvre,
 * il demande, il ferme.
 *
 * CE QU'IL GARDE, et c'est exactement ce que le produit demande :
 *   ① page ouverte AVANT l'extension  → le service worker répond `branche:false` (le panneau prévient) ;
 *   ② onglet ouvert APRÈS             → `branche:true` (le panneau se tait).
 * La question posée est le message RÉEL du panneau (`omdys-branche?`), pas une reconstitution : si
 * quelqu'un renomme le message, débranche le listener de `content.js` ou casse la réponse du service
 * worker, ce banc rougit. Falsifié dans les deux sens avant d'être commité.
 *
 * ⚠️ MESURÉ, PAS SUPPOSÉ. Les deux états se distinguent parce que Chrome rend deux erreurs différentes :
 * sans script de contenu, « Could not establish connection. Receiving end does not exist. » ; avec un
 * script qui ne répond pas, « The message port closed before a response was received. ». C'est pour
 * cela que `content.js` RÉPOND au ping au lieu de l'ignorer — sans réponse, les deux cas se ressemblent.
 * Vérifié aussi : `chrome.tabs.reload` ne réclame AUCUNE permission (erreur nulle), donc le bouton du
 * panneau n'alourdit pas la revue du Store.
 *
 *   node extension/ordre_chargement_probe.js            # verbeux
 *   node extension/ordre_chargement_probe.js --check    # CI : silencieux si vert, sort 1 si rouge
 */
'use strict';
const path = require('path');
const H = require(path.join(__dirname, 'cdp_chrome.js'));
const { trouverChrome, servir, attendre, lirePortDevTools, connecter, onglet, verifierDossierExtension, spawn, fs, os } = H;

const EXT = __dirname.replace(/\\/g, '/');
const CHECK = process.argv.includes('--check');
const TETE = process.argv.includes('--tete');
const log = (...a) => { if (!CHECK) console.log(...a); };

(async () => {
  verifierDossierExtension(EXT);
  const chrome = trouverChrome();
  if (!chrome) {
    // ⚠️ JAMAIS de saut silencieux : un banc qui se tait quand il ne peut rien mesurer est un faux vert.
    console.log('✗ ORDRE DE CHARGEMENT : aucun Chrome trouvé (CHROME=/chemin pour le désigner).');
    process.exit(1);
  }
  const { srv, port: portPage } = await servir();
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-ordre-'));
  const args = ['--remote-debugging-port=0', '--user-data-dir=' + profil, '--no-first-run',
    '--no-default-browser-check', '--disable-background-networking', '--disable-gpu',
    '--enable-unsafe-extension-debugging', 'about:blank'];
  if (!TETE) args.unshift('--headless=new');
  const proc = spawn(chrome, args, { stdio: 'ignore' });
  let nav = null, pgA = null, pgB = null, sw = null;
  const nettoyer = () => {
    for (const s of [nav, pgA, pgB, sw]) { try { s && s.fermer(); } catch (e) {} }
    try { proc.kill(); } catch (e) {} try { srv.close(); } catch (e) {}
    try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) {}
  };
  const fail = [];

  try {
    const dp = await lirePortDevTools(profil, 60000);
    const ver = await (await fetch('http://127.0.0.1:' + dp + '/json/version')).json();
    log('Chrome : ' + ver.Browser);

    nav = await connecter(ver.webSocketDebuggerUrl);

    // ① LA PAGE D'ABORD — c'est tout le scénario rapporté
    pgA = await connecter(await onglet(dp, 'about:blank'));
    await pgA.envoyer('Page.enable');
    await pgA.envoyer('Page.navigate', { url: 'http://127.0.0.1:' + portPage + '/' });
    await attendre(1200);
    log('① page ouverte AVANT l\'extension');

    // ② l'extension ensuite
    let r0 = null;
    try { r0 = await nav.envoyer('Extensions.loadUnpacked', { path: EXT }); }
    catch (e) {
      const m = String((e && e.message) || e);
      if (/wasn't found|not found|not implemented|Protocol error/i.test(m)) {
        console.log("· ORDRE DE CHARGEMENT : SAUTÉ — ce navigateur ne connaît pas "
                    + "Extensions.loadUnpacked (" + ver.Browser + ") ; garde locale.");
        nettoyer(); process.exit(0);
      }
      throw e;
    }
    if (!r0 || !r0.id) throw new Error("Extensions.loadUnpacked n'a pas rendu d'identifiant");
    log('② extension chargée : ' + r0.id);

    /* ③ OUVRIR LE VRAI PANNEAU, et lire CE QU'IL MONTRE.
       ⚠️ Premier essai jeté : j'interrogeais le service worker par `chrome.runtime.sendMessage`. Il a
       rendu `null` deux fois — un contexte d'extension ne reçoit PAS ses propres messages, et le
       service worker est justement celui qui répond. La question doit venir d'ailleurs ; autant qu'elle
       vienne du panneau lui-même, et qu'on lise son AFFICHAGE plutôt que la réponse brute. */
    sw = await connecter(await onglet(dp, 'chrome-extension://' + r0.id + '/sidepanel.html'));
    await sw.envoyer('Runtime.enable'); await sw.envoyer('Page.enable');
    for (let i = 0; i < 40; i++) {
      const q = await sw.envoyer('Runtime.evaluate', { returnByValue: true,
        expression: "!!document.getElementById('omdys-nobranch')" });
      if (q.result && q.result.value) break;
      await attendre(300);
    }
    log('③ panneau ouvert');

    /* Le panneau interroge l'onglet ACTIF. On active donc l'onglet d'avant : cela déclenche
       `chrome.tabs.onActivated` → le service worker diffuse « omdys-tab » → le panneau revérifie.
       C'est le chemin RÉEL, pas un raccourci de banc. */
    const message = async () => {
      const q = await sw.envoyer('Runtime.evaluate', { returnByValue: true,
        expression: "(function(){var n=document.getElementById('omdys-nobranch');return n?(n.hidden?'cache':'MONTRE'):'absent';})()" });
      return q && q.result ? q.result.value : 'absent';
    };
    const attendreMessage = async (vise) => {
      let v = null;
      for (let i = 0; i < 30; i++) { v = await message(); if (v === vise) return v; await attendre(400); }
      return v;
    };

    await pgA.envoyer('Page.bringToFront');
    const a = await attendreMessage('MONTRE');
    log("   onglet ouvert AVANT l'extension → le panneau : " + a);
    if (a !== 'MONTRE') {
      fail.push("page ouverte AVANT l'extension : le panneau aurait dû MONTRER pourquoi il ne voit rien, "
                + "il est resté « " + a + " » — l'utilisateur dys reste devant un panneau vide sans explication");
    }

    // ④ un onglet ouvert APRÈS : le script de contenu s'y injecte, le panneau doit se TAIRE
    pgB = await connecter(await onglet(dp, 'about:blank'));
    await pgB.envoyer('Page.enable');
    await pgB.envoyer('Page.navigate', { url: 'http://127.0.0.1:' + portPage + '/' });
    await pgB.envoyer('Page.bringToFront');
    const b = await attendreMessage('cache');
    log("   onglet ouvert APRÈS l'extension → le panneau : " + b);
    if (b !== 'cache') {
      fail.push("onglet ouvert APRÈS l'extension : le panneau aurait dû se TAIRE, il affiche « " + b
                + " » — il crierait au loup sur une page parfaitement branchée");
    }

    if (fail.length) { fail.forEach(f => console.log('  ✗ ' + f)); nettoyer(); process.exit(1); }
    log('');
    log('✓ ORDRE DE CHARGEMENT : page ouverte AVANT → le panneau MONTRE pourquoi il ne voit rien ; onglet ouvert APRÈS → il se tait.');
    nettoyer(); process.exit(0);
  } catch (e) {
    console.log('✗ ORDRE DE CHARGEMENT : ' + ((e && e.message) || e));
    nettoyer(); process.exit(1);
  }
})();
