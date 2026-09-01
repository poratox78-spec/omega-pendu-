#!/usr/bin/env node
/* navigateur_ext_probe.js — L'EXTENSION, CHARGÉE POUR DE VRAI DANS CHROME.
 *
 * POURQUOI CE FICHIER EXISTE. Sur les 77 contrôles de la batterie, UN SEUL tournait dans un vrai
 * navigateur (`dictee/navigateur_probe.js`) et il n'ouvrait qu'une page : `app/omega-pendu.html`.
 * L'EXTENSION — le seul artefact que des gens ont réellement installé, publiée au Chrome Web Store —
 * n'était vérifiée que par des bancs Node qui REPRODUISENT son démarrage au lieu de l'OBSERVER :
 *   · `extension/parity_core.js` équipe le moteur À LA MAIN (setLex, setPrenoms, setGaccLex…) et le
 *     dit dans ses propres commentaires — il ne teste donc jamais le chargement réel ;
 *   · `extension/assets_wired_probe.js` fait `indexOf('assets/' + nom)` sur du TEXTE SOURCE. Il
 *     vérifie qu'un asset est MENTIONNÉ, pas qu'il se CHARGE. Or l'incident qu'il commémore
 *     (PRÉNOMS livrés mais jamais chargés : « Marie est venu » corrigé sur le site et MUET dans
 *     l'extension) était précisément une panne de CHARGEMENT — trouvée au banc navigateur, jamais
 *     par la CI. La parade posée n'aurait pas attrapé le bug qu'elle commémore.
 * Le 01/09/2026 le même motif a été retrouvé intact dans le bake autonome, muet sur l'accord depuis
 * des mois (`build_correcteur.js` : 1 lexique baké sur 9, 1 chargeur appelé sur 8) — PR#624.
 *
 * ICI, RIEN N'EST REPRODUIT. Chrome charge le PAQUET, `content.js` s'injecte dans une vraie page,
 * `dys-core.js` va chercher ses assets par `chrome.runtime.getURL` + `DecompressionStream` comme
 * chez l'utilisateur, et on interroge le moteur DANS SON MONDE ISOLÉ — celui de l'extension.
 *
 * CE QU'ON TESTE : un COMPORTEMENT par asset, jamais une présence. Une table vide mais non nulle
 * répond « oui » à une question de présence ; elle ne corrige pas « les chien aboient ».
 *
 * ⚠️ CE QUE CE BANC NE TESTE PAS : l'AFFICHAGE (la barre `.omdys-bar`). Piloter le focus d'un champ
 * en headless ne déclenche pas fiablement la barre, et un banc qui échouerait là-dessus accuserait
 * le produit d'un défaut qui n'existe pas. Le chargement des assets — l'objet de ce banc — est
 * vérifié au niveau du MOTEUR. L'affichage reste à couvrir : c'est écrit, pas escamoté.
 *
 * ⭐ QUATRE PIÈGES PAYÉS EN ÉCRIVANT CE BANC, écrits ici pour qu'ils ne soient pas repayés :
 *  ① `--load-extension` NE CHARGE PLUS RIEN sur Chrome récent (152 ici) : aucun monde isolé n'est
 *     créé, donc aucun script de contenu. La voie actuelle est `Extensions.loadUnpacked` (CDP) avec
 *     `--enable-unsafe-extension-debugging`. ⚠️ Chemin en BARRES OBLIQUES : en barres inverses
 *     Chrome répond « File path cannot be resolved ». L'espace de « OMEGA PENDU » ne pose AUCUN
 *     problème — je l'avais accusé à tort.
 *  ② Le CSS d'un script de contenu n'apparaît PAS dans `document.styleSheets` (feuille utilisateur).
 *     Ma 1re détection cherchait là et concluait « pas injecté » sur une extension bien chargée.
 *     L'instrument juste : les MONDES D'EXÉCUTION — un script de contenu en crée un `isolated`.
 *  ③ Le moteur s'appelle `DYSCORE` dans le monde isolé ; `DC` n'est qu'un alias LOCAL de content.js.
 *     Interroger `DC` répondait « absent » sur un moteur parfaitement chargé.
 *  ④ `DYSCORE.isReady()` est FAUX pendant ~3 s (décompression des assets). On attend donc un ÉTAT,
 *     jamais un délai fixe.
 *
 * ZÉRO DÉPENDANCE : serveur = `http` de Node, pilotage = CDP brut sur le `WebSocket` natif.
 *
 *   node extension/navigateur_ext_probe.js            # verbeux
 *   node extension/navigateur_ext_probe.js --check    # CI : silencieux si vert, sort 1 si rouge
 */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawn } = require('child_process');

const EXT = __dirname.replace(/\\/g, '/');   // ⚠️ barres OBLIQUES : voir piège ① en tête
const CHECK = process.argv.includes('--check');
const TETE = process.argv.includes('--tete');
const log = (...a) => { if (!CHECK) console.log(...a); };

/* ---------- LA BATTERIE : un comportement par ASSET ----------
 * Chaque cas MEURT si son asset n'est pas chargé — établi par ABLATION sur le moteur réel
 * (carte table→comportement, PR#626). */
const CAS = [
  // ⭐ ÉTIQUETTES ÉTABLIES PAR ABLATION SUR L'EXTENSION RÉELLE (asset retiré du paquet, banc relancé),
  //   jamais d'après un commentaire. `dictee/navigateur_probe.js` affirme que « les chien aboient » et
  //   « des oiseau dans le ciel » « ne passent que si NOUN_POST est chargé » : c'est FAUX pour
  //   l'extension — mesuré, ces deux-là survivent à la suppression de noun-post.txt.gz. Une première
  //   version de ce banc les étiquetait « noun-post » et restait VERTE avec l'asset supprimé : elle
  //   ne gardait donc pas ce qu'elle annonçait.
  { txt: 'les enfant joue.', attendu: 'jouent', asset: 'noun-post',
    pourquoi: "accord du verbe via le nom — sans l'asset il ne reste que « enfants »" },
  { txt: 'la pont est longue', attendu: 'le', asset: 'noun-post',
    pourquoi: "genre du nom — sans l'asset : RIEN" },
  { txt: 'Marie est venu.', attendu: 'venue', asset: 'prenoms + pos-hmm',
    pourquoi: 'le bug HISTORIQUE (livré, jamais chargé) — meurt sans PRENOMS *et* sans pos-hmm' },
  { txt: 'la fenetre est ouverte', attendu: 'fenêtre', asset: 'speller',
    pourquoi: "restauration d'accent — le lexique orthographique" },
  { txt: 'la liste des courses sont longue', attendu: 'est', asset: 'pos-hmm',
    pourquoi: 'sujet éloigné du verbe — muet sans le tagger' },
  // ces deux-là n'isolent AUCUN asset (vérifié : ils survivent à chaque suppression). On les garde
  // comme témoins que le moteur tourne du tout dans l'extension, et l'étiquette le DIT.
  { txt: 'les chien aboient', attendu: 'chiens', asset: 'moteur',
    pourquoi: "témoin de vie — n'isole aucun asset" },
  { txt: 'des oiseau dans le ciel', attendu: 'oiseaux', asset: 'moteur',
    pourquoi: "témoin de vie — n'isole aucun asset" },
];

/* ⚠️ ASSETS SANS AUCUNE GARDE, faute de cas trouvé — écrit plutôt qu'escamoté : confusables.json,
   gender-acc.json.gz, gender-relaxed.tsv.gz, os-subj-lm.json.gz, ponct-lm.json.gz, sens.json.gz,
   vdc-lex.json. Aucun des 7 cas ci-dessus ne meurt quand on les retire. Absence de cas trouvé
   ≠ asset inutile (plusieurs servent des surfaces que ce banc ne touche pas : ponctuation vocale,
   jeu Double-Sens, couche verte des confusables). À compléter. */

/* Le harnais CDP (recherche de Chrome, port de débogage, client WebSocket, onglet) vit désormais
   dans `extension/cdp_chrome.js`, partagé avec `dictee/navigateur_flags_dump.js`. Le recopier
   serait exactement le motif qui a laissé deux chargeurs de moteur diverger pendant des mois. */
const H = require(path.join(__dirname, 'cdp_chrome.js'));
const { trouverChrome, servir, attendre, lirePortDevTools, connecter, onglet } = H;

(async () => {
  const chrome = trouverChrome();
  if (!chrome) {
    // ⚠️ JAMAIS de saut silencieux : un banc qui se tait quand il ne peut rien mesurer est un faux vert.
    console.log('✗ EXTENSION DANS CHROME : aucun Chrome trouvé (CHROME=/chemin pour le désigner).');
    process.exit(1);
  }
  const { srv, port: portPage } = await servir();
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-ext-'));
  const args = ['--remote-debugging-port=0', '--user-data-dir=' + profil, '--no-first-run',
    '--no-default-browser-check', '--disable-background-networking', '--disable-gpu',
    '--enable-unsafe-extension-debugging', 'about:blank'];
  if (!TETE) args.unshift('--headless=new');
  const proc = spawn(chrome, args, { stdio: 'ignore' });
  let nav = null, pg = null, code = 0;
  const nettoyer = () => { for (const s of [nav, pg]) { try { s && s.fermer(); } catch (e) {} }
    try { proc.kill(); } catch (e) {} try { srv.close(); } catch (e) {}
    try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) {} };

  try {
    const dp = await lirePortDevTools(profil, 60000);
    const ver = await (await fetch('http://127.0.0.1:' + dp + '/json/version')).json();
    log('Chrome    : ' + ver.Browser);
    log('extension : ' + EXT + (TETE ? '  (fenêtre visible)' : '  (headless)'));

    // ① charger le PAQUET — la commande REND une erreur si elle échoue, contrairement à --load-extension
    nav = await connecter(ver.webSocketDebuggerUrl);
    /* ⚠️ SAUT EXPLICITE SI LE NAVIGATEUR NE SAIT PAS CHARGER D'EXTENSION. `Extensions.loadUnpacked`
       est une commande CDP récente : sur un Chrome plus ancien (ou un Chromium allégé de CI) elle
       n'existe pas. Ce serait alors un échec d'ENVIRONNEMENT, pas de produit — faire rougir la
       batterie pour ça détournerait l'attention du vrai signal. On saute EN LE DISANT : jamais un
       vert muet, c'est le défaut que toute cette série de PR répare. */
    let r0 = null;
    try { r0 = await nav.envoyer('Extensions.loadUnpacked', { path: EXT }); }
    catch (e) {
      const m = String((e && e.message) || e);
      if (/wasn't found|not found|not implemented|Protocol error/i.test(m)) {
        console.log("· EXTENSION DANS CHROME : SAUTÉ — ce navigateur ne connaît pas "
                    + "Extensions.loadUnpacked (" + ver.Browser + ") ; garde locale.");
        nettoyer(); process.exit(0);
      }
      throw e;
    }
    if (!r0 || !r0.id) throw new Error("Extensions.loadUnpacked n'a pas rendu d'identifiant");
    log('chargée   : ' + r0.id);

    // ② ouvrir la page APRÈS le chargement (un script de contenu ne s'injecte pas rétroactivement)
    //    et capter le MONDE ISOLÉ que son injection crée.
    let ctx = 0;
    pg = await connecter(await onglet(dp, 'about:blank'), (d) => {
      if (d.method === 'Runtime.executionContextCreated'
          && (d.params.context.auxData || {}).type === 'isolated') ctx = d.params.context.id;
    });
    await pg.envoyer('Runtime.enable'); await pg.envoyer('Page.enable');
    await pg.envoyer('Page.navigate', { url: 'http://127.0.0.1:' + portPage + '/' });
    for (let i = 0; i < 60 && !ctx; i++) await attendre(250);
    if (!ctx) throw new Error("le script de contenu ne s'est pas injecté (aucun monde isolé) — extension non chargée ?");
    log('injectée  : monde isolé du script de contenu');

    // ③ attendre que le moteur ait DÉCOMPRESSÉ ses assets — un ÉTAT, pas un délai
    let pret = false;
    for (let i = 0; i < 80 && !pret; i++) {
      const q = await pg.envoyer('Runtime.evaluate', { contextId: ctx, returnByValue: true,
        expression: "(typeof DYSCORE!=='undefined' && DYSCORE.isReady) ? !!DYSCORE.isReady() : false" });
      pret = !!(q.result && q.result.value);
      if (!pret) await attendre(250);
    }
    if (!pret) throw new Error("DYSCORE.isReady() est resté FAUX 20 s — les assets ne se chargent pas dans l'extension");
    log('prête     : DYSCORE.isReady() — assets décompressés depuis chrome.runtime.getURL\n');

    // ④ interroger le moteur RÉEL, dans le monde de l'extension
    const r = await pg.envoyer('Runtime.evaluate', { contextId: ctx, returnByValue: true,
      // ⭐ `diagnoseAll` — LA MÊME PORTE QUE LE PRODUIT : c'est ce que content.js:342 appelle pour
      // alimenter la barre (grammaire + orthographe). `correctText` seul est la GRAMMAIRE : l'utiliser
      // faisait échouer le cas `speller` (« la fenetre est ouverte ») et accusait un asset innocent.
      expression: 'JSON.stringify(' + JSON.stringify(CAS.map(c => c.txt))
                + '.map(t => ((DYSCORE.diagnoseAll(t)||{}).flags||[]).map(f => f.word + ">" + f.sugg)))' });
    if (r.exceptionDetails) throw new Error('moteur : ' + ((r.exceptionDetails.exception || {}).description || 'exception'));
    const vus = JSON.parse(r.result.value);

    const echecs = [];
    CAS.forEach((c, k) => {
      const got = vus[k] || [];
      const trouve = got.some(x => x.split('>')[1] === c.attendu);
      log('  ' + (trouve ? '✓' : '✗') + ' [' + (c.asset + '        ').slice(0, 9) + '] '
          + c.txt.padEnd(34) + (got.length ? '→ ' + got.join(' · ') : '(RIEN)'));
      if (!trouve)
        echecs.push('asset « ' + c.asset + " » MUET dans l'extension RÉELLE : « " + c.txt
                    + " » ne donne pas « " + c.attendu + ' » (' + c.pourquoi + ')');
    });

    if (echecs.length) {
      console.log('✗ EXTENSION DANS CHROME — ' + echecs.length + ' échec(s) :');
      echecs.forEach(e => console.log('  ' + e));
      code = 1;
    } else {
      console.log('✓ EXTENSION DANS CHROME : ' + CAS.length + ' comportements vérifiés dans le PAQUET RÉEL '
                  + '(content.js injecté, assets chargés par chrome.runtime.getURL).');
    }
  } catch (e) {
    console.log('✗ EXTENSION DANS CHROME : ' + ((e && e.message) || e));
    code = 1;
  }
  nettoyer();
  process.exit(code);
})();
