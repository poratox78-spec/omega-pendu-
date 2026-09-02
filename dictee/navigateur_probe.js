#!/usr/bin/env node
/* navigateur_probe.js — LA BATTERIE QUI TOURNE DANS UN VRAI CHROME.
 *
 * POURQUOI CE FICHIER EXISTE (demande de Rem, 2026-08-11) :
 *   « tu ne peux pas savoir si c'est réel sans test en dur dans le navigateur utilisé par
 *     l'utilisateur — je préconise une batterie de tests dans mon Chrome »
 *
 * Il avait raison, et ça nous a coûté une demi-journée. Tous les autres bancs du dépôt extraient la
 * tranche moteur du HTML et la ré-exécutent sous Node avec un bouchon DOM. Ça mesure vite et à
 * l'échelle, mais ça REPRODUIT le démarrage de l'app au lieu de l'OBSERVER — et le jour où le
 * démarrage reproduit est faux, tous les chiffres le sont sans que rien ne le signale :
 *   · `dictee/correcteur.js` (moteur LIVRÉ) n'appelait que `loadSpellerLex()` -> grammaire du
 *     NOMBRE et du GENRE muette ; mes sondes recopiaient ce loader et concluaient « le moteur ne
 *     tire pas » sur des règles simplement pas chargées ;
 *   · le bouchon DOM répondait un `stub` à tout id inconnu, donc la table NOUN_POST était VIDE mais
 *     NON NULLE : la garde « est-elle chargée ? » répondait OUI sur du vide.
 * Ici, rien n'est reproduit : Chrome ouvre `app/omega-pendu.html`, la page se démarre TOUTE SEULE
 * avec ses vrais lexiques, et on lit ce que l'UTILISATEUR verrait — les marques posées dans le DOM.
 *
 * ZÉRO DÉPENDANCE, c'est délibéré (le dépôt n'a pas de package.json) :
 *   serveur statique = `http` de Node · pilotage = CDP brut sur le `WebSocket` natif de Node 22+.
 *
 *   node dictee/navigateur_probe.js            # verbeux
 *   node dictee/navigateur_probe.js --check    # CI : silencieux si vert, sort 1 si rouge
 *   CHROME="/chemin/chrome" node dictee/navigateur_probe.js --tete   # --tete = fenêtre visible
 */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawn } = require('child_process');

const RACINE = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const TETE = process.argv.includes('--tete');
const log = (...a) => { if (!CHECK) console.log(...a); };

/* ---------- 1. trouver le Chrome de l'UTILISATEUR ---------- */
function trouverChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const c = [];
  if (process.platform === 'win32') {
    for (const b of [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env['LOCALAPPDATA']])
      if (b) c.push(path.join(b, 'Google', 'Chrome', 'Application', 'chrome.exe'),
                   path.join(b, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  } else if (process.platform === 'darwin') {
    c.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
           '/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else {
    c.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
           '/usr/bin/chromium-browser', '/snap/bin/chromium');
  }
  return c.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } }) || null;
}

/* ---------- 2. servir le dépôt (le moteur charge ses blobs par fetch : file:// ne suffit pas) ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.gz': 'application/gzip',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
function servir() {
  return new Promise((res) => {
    const srv = http.createServer((req, rep) => {
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      const f = path.join(RACINE, url.replace(/^\/+/, ''));
      if (!f.startsWith(RACINE)) { rep.writeHead(403).end(); return; }                 // pas de remontée hors dépôt
      fs.readFile(f, (e, buf) => {
        if (e) { rep.writeHead(404).end('404'); return; }
        rep.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream',
                             'Cache-Control': 'no-store' });                            // jamais de cache : on teste le build COURANT
        rep.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}

/* ---------- 3. CDP brut ---------- */
function attendre(ms) { return new Promise(r => setTimeout(r, ms)); }
/* ⚠️ PORT DE DÉBOGAGE : choisi par CHROME, pas par nous (corrigé après une CI rouge le 2026-08-11).
   La 1re version calculait `9222 + pid % 500` et attendait 10 s : sur le runner GitHub, Chrome a mis
   plus de 10 s à démarrer → « n'a pas ouvert son port » → CI rouge, alors que le même banc passait
   en local. Et un port calculé peut COLLISIONNER avec un autre processus. La voie canonique :
   `--remote-debugging-port=0` laisse Chrome choisir, et il écrit le port réel dans le fichier
   `DevToolsActivePort` du profil. On lit ce fichier (60 s), puis on interroge le port. */
function lirePortDevTools(profil, ms) {
  const t0 = Date.now(), f = path.join(profil, 'DevToolsActivePort');
  return new Promise((res, rej) => { (function boucle() {
    try { const l = fs.readFileSync(f, 'utf8').split('\n')[0].trim();
      const p = parseInt(l, 10); if (p > 0) return res(p); } catch (e) { /* pas encore écrit */ }
    if (Date.now() - t0 > ms) return rej(new Error('Chrome n\'a pas ouvert son port de débogage (' + ms + ' ms)'));
    setTimeout(boucle, 200); })(); });
}
async function cible(port, url) {                                    // ouvre un onglet, rend son WS
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch (e) { /* Chrome pas encore prêt */ }
    await attendre(200);
  }
  throw new Error('le port de débogage ne répond pas');
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

/* ---------- 4. LA BATTERIE — ce que l'utilisateur VOIT dans la page ----------
 * `attendu`  : remplacements qui doivent être COCHÉS (classe vdc-on = appliqué par défaut)
 * `interdit` : remplacements qui ne doivent PAS apparaître
 * `rien`     : la phrase est correcte -> aucune correction cochée
 */
const CAS = [
  // ① le moteur est-il VRAIMENT équipé ? on teste un COMPORTEMENT, pas une présence de table.
  //    Ces deux-là ne passent que si NOUN_POST est chargé — le trou qui a rendu le moteur livré muet.
  { txt: 'je vais bien tu viens demain', rien: true, pourquoi: 'point final MANQUANT proposé en orange : marque d’insertion, texte intact' },
  { txt: 'est-ce que tu viens demain', rien: true, pourquoi: '« ? » MANQUANT proposé en orange : marque d’insertion, texte intact' },
  { txt: 'est-ce que tu viens demain', rien: true, appliquer: 'est-ce que tu viens demain ?', pourquoi: 'le « ? » proposé s’APPLIQUE depuis la carte (chemin complet)' },
  { txt: 'je vais bien tu viens demain', rien: true, appliquer: 'je vais bien tu viens demain.', pourquoi: 'le point final proposé s’APPLIQUE depuis la carte' },
  /* ⭐ INVERSION SANS TRAIT D'UNION (02/09/2026, rapport de Rem : « la ponctuation ne marche pas en forme
     interrogative »). Le scripteur dys n'écrit pas le trait d'union : « veux tu », « qu'allons nous ».
     Avant : aucune question vue, et le correcteur proposait un POINT au bout. Gardé : le « ? » est proposé,
     et le point ne l'est PAS. */
  { txt: 'veux tu venir demain', rien: true, propose: ' ?', pourquoi: 'inversion sans trait d’union : le « ? » est proposé' },
  { txt: "qu'allons nous faire demain", rien: true, propose: ' ?', pourquoi: '« qu’ » + inversion sans trait : « ? » proposé, pas un point' },
  { txt: 'est ce que tu viens demain', rien: true, propose: ' ?', pourquoi: '« est ce que » sans trait d’union' },
  { txt: 'je pense tu as raison', rien: true, propose: '.', pourquoi: 'CONTRE-GARDE : « pense tu » ne s’accorde pas, ce n’est pas une question → point final' },
  /* ⭐ ACCORD VERBE À VÉRIFIER — LA RELATIVE EN « qui » (03/09/2026, mesuré dans Chrome sur le corpus dys : +1 juste,
     −10 inutiles, 0 fausse). Le sujet du verbe après une relative est l'ANTÉCÉDENT, pas le dernier nom de la relative.
     Gardé ici comme COMPORTEMENT (Rem : « il me faut des exemples réels testés dans le vrai moteur dans Chrome »). */
  { txt: 'les villages qui composent la commune sont petits', rien: true, orangeInterdit: 'sont', pourquoi: 'antécédent « villages » : « sont » est juste, plus d’orange « est »' },
  { txt: 'un groupe de chercheurs qui traquent des trésors', rien: true, orangeInterdit: 'traquent', pourquoi: '« de chercheurs » lu pluriel : « traquent » est juste' },
  { txt: 'les haies qui délimite les champs', corrigeAttendu: ['délimite', 'délimitent'], pourquoi: 'la seule utile du corpus : « délimite » → délimitent (rouge si le sujet en tête se lit, orange OS sinon — l’un ou l’autre, jamais rien)' },
  { txt: 'les chien aboient', attendu: ['chiens'], pourquoi: 'accord pluriel du nom (NOUN_POST chargé)' },
  { txt: 'des oiseau dans le ciel', attendu: ['oiseaux'], pourquoi: 'pluriel en -x (NOUN_POST chargé)' },
  // ② conflit de direction déterminant/nom : UN SEUL sens par désaccord (PR#467)
  { txt: 'la nourriture de leurs tige', attendu: ['tiges'], interdit: ['leur'],
    pourquoi: 'deux rouges contradictoires fabriquaient « leur tiges »' },
  { txt: 'il range leurs livre', attendu: ['leur'], pourquoi: 'repli : « livre » ambigu verbe -> le déterminant reprend la main' },
  { txt: 'il a ouvert leur volets', attendu: ['leurs'], pourquoi: 'sens miroir intact' },
  // ③ glissement moteur -> ROUGE (PR#464)
  { txt: 'il a jmaais vu ça', attendu: ['jamais'], pourquoi: 'transposition, un seul candidat' },
  { txt: 'un grannd bateau', attendu: ['grand'], pourquoi: 'redoublement, un seul candidat' },
  // ④ élongation — cas RELEVÉS dans le corpus dys réel, pas inventés (PR#466)
  { txt: 'ellle est venue', attendu: ['elle'], pourquoi: 'élongation réelle du corpus dys' },
  { txt: 'une errreur de frappe', attendu: ['erreur'], pourquoi: 'élongation réelle du corpus dys' },
  // ⑤ prénoms -> accord (PR#460)
  { txt: 'Marie est venu.', attendu: ['venue'], pourquoi: 'genre du prénom (table prenoms-gz chargée)' },
  // ⑥ accent = la route affirmative historique
  { txt: 'la fenetre est ouverte', attendu: ['fenêtre'], pourquoi: 'restauration d\'accent' },
  // ⑦ INFINITIF DE BUT — la phrase que Rem a tapée, et les pièges qui ont dicté la forme de la règle
  { txt: 'Je suis allé à la plage mangé des champignons.', attendu: ['manger'],
    pourquoi: 'infinitif de but séparé du verbe de mouvement par la destination' },
  { txt: 'Je suis allé chez lui cherché mes affaires.', attendu: ['chercher'], pourquoi: 'même motif, autre préposition' },
  { txt: 'Je suis rentré à la maison épuisé.', rien: true, pourquoi: 'participe ADJECTIVAL : « épuisé » n\'est pas « épuiser »' },
  { txt: 'Il est allé à la fête déguisé en pirate.', rien: true, pourquoi: 'participe ADJECTIVAL' },
  // ⑧ TYPOGRAPHIE — signalée par Rem sur « Je suis allé à la plage␣␣mangé » : le double espace était
  //    bien VU (« 1 sûre ») mais jamais APPLIQUÉ, l'écran se contredisant lui-même. Ces cas ne
  //    passent que dans un vrai navigateur : ils portent sur des CARACTÈRES, pas sur des tokens.
  { txt: 'Il fait  beau.', typoAppliquee: 1, pourquoi: 'espace double appliqué (et non plus seulement signalé)' },
  { txt: 'il est parti,Paul est resté', typoAppliquee: 1, pourquoi: 'espace manquant après la virgule' },
  { txt: 'attends ... je viens', typoAppliquee: 0, pourquoi: 'les « … » restent une PRÉFÉRENCE : vigilance, jamais imposée' },
  // ⑨ UNE GARDE PAR TABLE DE LEXIQUE — chaque cas MEURT si sa table n'est pas chargée.
  //   Établi par ABLATION sur le moteur réel (bake reconstruit sans une table à la fois, puis
  //   interrogé), pas au jugé : une première carte bâtie sur des phrases INVENTÉES concluait à tort
  //   « os-lm : aucun effet » — elles ne déclenchaient simplement pas le parseur de sujet.
  //   Le motif vient de la GARDE PRÉNOMS de parity_corr.js, qui l'avait posé pour UNE table après
  //   avoir constaté qu'en neutralisant le seed la parité restait « OK ». Ici on le généralise.
  //   ⚠️ TROIS tables n'ont PAS de garde ici, et il faut le dire plutôt que d'en inventer une :
  //   · `gdet-lex-gz` et `gacc-lex-gz` : aucun déclencheur trouvé, ni sur phrases construites ni sur
  //     300 phrases dys réelles. Absence de cas trouvé ≠ table inutile — question ouverte.
  //   · `os-lm-gz` : le seul cas trouvé (« le nombre de visiteurs augmentent ») vient du SPELLER,
  //     pas de la grammaire, et sort en VIGILANCE — donc jamais appliqué : impossible à exiger ici.
  //     J'ai failli le poser étiqueté « os-lm » ; grammar() rend [] sur cette phrase, spell() rend
  //     la correction. Une garde mal étiquetée est pire qu'une garde absente : elle rassure à tort.
  { txt: 'la liste des courses sont longue', attendu: ['est'],
    pourquoi: 'pos-hmm : sujet éloigné du verbe — muet sans le tagger' },
  { txt: 'le chien de mes voisins aboient', attendu: ['aboie'],
    pourquoi: 'pos-hmm : le complément pluriel ne doit pas voler le sujet' },
  { txt: 'la plupart des élèves comprend la leçon', attendu: ['comprennent'],
    pourquoi: 'pos-hmm : quantifieur — muet sans le tagger' },

  // ⑧ CONTRE-GARDES : du texte CORRECT ne doit rien déclencher
  { txt: 'Le petit garçon mange une pomme rouge.', rien: true, pourquoi: 'FP=0 sur phrase correcte' },
  { txt: 'Nathalie habite à Bordeaux.', rien: true, pourquoi: 'noms propres non touchés' },
  { txt: 'un œuf et du bœuf', rien: true, pourquoi: 'ligature œ' },
  { txt: "Les girolles qu'elle avait cueillies sont bonnes.", rien: true,
    pourquoi: "pronom élidé : « qu'elle » n'est pas un nom à accorder avec « les girolles »" },
  // ⑨ chantier REGLES_FR 1-8 (2026-08-12) : les nouveaux rouges dans le VRAI navigateur
  { txt: 'on a pas le temps', attendu: ["n'a"], pourquoi: 'négation « n\' » manquante (rouge, cadre fermé)' },
  { txt: "c'est pas grave", attendu: ["ce n'est"], pourquoi: 'négation sur forme élidée (dé-élision + n\')' },
  { txt: "si j'aurais su, tant pis", attendu: ["j'avais"], pourquoi: 'si + conditionnel → imparfait (rouge)' },
  { txt: "l'usine emploie deux cent salariés", attendu: ['cents'], pourquoi: 'vingt/cent multiplié + nom pluriel (rouge)' },
  { txt: "j'ai pas mal de travail", rien: true, pourquoi: 'PIÈGE : « pas mal de » = locution sans ne' },
  { txt: 'je ne sais pas si je serais capable', rien: true, pourquoi: 'PIÈGE : interrogation indirecte, conditionnel légitime' },
];

/* ⭐ FP=0 PRODUIT — la règle n° 1 du projet, enfin gardée LÀ OÙ L'ÉLÈVE LA SUBIT.
 *
 * Le contrôle qui s'appelle « correcteur (batterie FP=0) » (dev.sh:45, dictee/correcteur_probe.py)
 * ne contient AUCUN sys.exit : il compte les faux positifs, imprime chacun d'eux
 * (« ⚠️ flague « X »→« Y » »), puis conclut par une phrase de LECTURE — « faux positifs ≈ 0 =
 * on ne corrige pas du texte juste ». Une narration, pas un verdict. C'est par ce chemin exact que
 * « La foule attendait »→« attendaient » est resté imprimé des mois sans être vu (PR#619/620).
 *
 * Et même branché, un exit côté Python garderait la RÉFÉRENCE, pas le PRODUIT : mesuré le
 * 01/09/2026, correcteur_probe.py rend « c'ete » en palier auto là où la vraie page rend « cette ».
 * La référence ne reproduit pas l'arbitrage speller/grammaire de l'app. Donc on juge ICI, dans Chrome.
 *
 * Corpus : dictee/sentences.json — le MÊME que celui de la batterie FP=0 (chargé, pas recopié :
 * il ne peut pas dériver). Mesuré à la pose : 333/333 intactes, ZERO faux positif produit.
 * Falsifié : « les chien aboient » injectée avec rien:true → échec + exit 1 (« eu [chiens, chien] »).
 * Muettes quand elles passent (333 lignes de ✓ noieraient le reste) ; un échec est TOUJOURS montré. */
for (const e of JSON.parse(fs.readFileSync(path.join(__dirname, 'sentences.json'), 'utf8')))
  CAS.push({ txt: e.text, rien: true, muet: true,
            pourquoi: 'FP=0 PRODUIT : phrase CORRECTE du corpus, elle ne doit RIEN déclencher dans la page' });

/* le script évalué DANS la page : écrit dans la vraie zone, lit les vraies marques */
const SCRIPT = (cas) => `(async () => {
  const attendre = (ms) => new Promise(r => setTimeout(r, ms));
  /* ATTENDRE UNE DISPONIBILITÉ RÉELLE, jamais un délai fixe : l'app fait 10 Mo et décompresse ses
     lexiques en différé. On attend (a) le bouton, (b) la zone, puis (c) une CORRECTION CONNUE —
     c'est le seul signal qui prouve que les lexiques sont là, pas seulement le DOM. */
  const jusqua = async (quoi, f, ms) => { const t0 = Date.now();
    while (Date.now() - t0 < ms) { const v = f(); if (v) return v; await attendre(150); }
    throw new Error('délai dépassé en attendant : ' + quoi); };
  try {
    const b = await jusqua('le bouton Correcteur',
      () => [...document.querySelectorAll('button')].find(x => /🩹/.test(x.textContent || '')), 30000);
    b.click();
    const zone = await jusqua('la zone de saisie vdc-in', () => document.getElementById('vdc-in'), 30000);
    /* ⭐ ATTENDRE LE RENDU, pas un délai fixe (02/09/2026). Mesuré dans Chrome : le premier rendu de
       « est ce que tu viens demain » prend 1 663 ms (un chargement paresseux), les suivants ~400 ms.
       Avec 500 ms fixes, la sonde lisait l'état d'AVANT et rendait un verdict faux (« ? » vu comme
       appliqué : c'était le résultat du cas précédent). Attendre que la ZONE ne bouge plus ne suffit pas :
       sur un texte sans faute elle ne bouge jamais, et la liste du bas (#vdc-out, #vdc-result) arrive après.
       ⇒ SENTINELLE : un enfant posé dans #vdc-out AVANT l'input ; runCorr réécrit son innerHTML à chaque
       rendu (texte fautif ou non), la sentinelle disparaît = le rendu a eu lieu. Puis 200 ms de calme. */
    const rendu = async () => { const out = document.getElementById('vdc-out'); const s = document.createElement('i'); s.className = 'sonde-sentinelle';
      if (out) out.appendChild(s); return async () => { const t0 = Date.now();
        while (out && out.contains(s) && Date.now() - t0 < 4000) await attendre(50);
        let last = zone.innerHTML, since = Date.now();
        for (;;) { await attendre(50); const h = zone.innerHTML;
          if (h !== last) { last = h; since = Date.now(); } else if (Date.now() - since >= 200) return;
          if (Date.now() - t0 > 5000) return; } }; };
    const passe = async (txt, appl) => { zone.textContent = txt;
      let fini = await rendu(); zone.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await fini();
      const bar = (document.body.innerText.match(/\\((\\d+) appliqu/) || [])[1];   // \\ doublés : on est dans un gabarit JS
      const texte = zone.textContent;   // ⭐ INVARIANT : le rendu ne doit JAMAIS changer le texte saisi
      fini = await rendu(); zone.dispatchEvent(new InputEvent('input', { bubbles: true })); await fini();
      const texte2 = zone.textContent;  // ce que le moteur RELIT au tour suivant
      let carte = null; const sp = zone.querySelector('[data-key]');
      if (sp) { sp.dispatchEvent(new MouseEvent('click', { bubbles: true })); await attendre(150);
        const c = document.getElementById('vdc-cardpop'); carte = !!(c && c.style.display === 'block' && (c.textContent || '').trim().length > 10); }
      // L'etat AFFIRMATIF (applique / marques) est capture AVANT le geste « appliquer » : le verdict « rien »
      // porte sur ce que le moteur a fait SEUL, pas sur ce que l'utilisateur vient de lui demander.
      const applique0 = [...document.querySelectorAll('.vdc-on')].map(e => e.textContent);
      const marque0 = [...document.querySelectorAll('.vdc-bad')].map(e => ({ t: e.textContent, vig: /vdc-vig/.test(e.className), sugg: e.getAttribute('data-sugg'), key: e.getAttribute('data-key') }));
      /* ⭐ LA MARQUE SE CLIQUE (02/09/2026, Rem : « le ? je ne sais pas comment bien faire, je te laisse faire »).
         Mesuré dans Chrome AVANT : boîte de 0 × 3 px (width:0 + glyphe absolu), seul un halo de ±5 px répondait.
         APRÈS : le glyphe est dans le flux, 16 × 32 px, et le point central de la boîte touche bien la marque. */
      const boite = (() => { const m = zone.querySelector('[data-sugg]'); if (!m) return null; const r = m.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), vise: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === m }; })();
      let corrige = null;   // le texte CORRIGE (#vdc-result) : le modele est NON DESTRUCTIF, la zone du haut reste le texte saisi (PR#52)
      if (appl) { await attendre(700); const sp2 = zone.querySelector('[data-sugg]') || zone.querySelector('[data-key]');   // la MARQUE D'INSERTION (« ? », « . »), pas la première faute venue
        if (sp2) { sp2.dispatchEvent(new MouseEvent('click', { bubbles: true })); await attendre(150);
          const bt = document.querySelector('#vdc-cardpop .vcap'); if (bt) { bt.click(); await attendre(600); }
          const rz = document.getElementById('vdc-result'); corrige = rz ? rz.textContent.trim() : null; } }
      return { nApplique: bar == null ? null : +bar, texte, texte2, carte, corrige, boite,
               applique: applique0,
               /* on garde la CLASSE : « vdc-vig » = vigilance orange, proposée et jamais appliquée.
                  La confondre avec une vraie marque rend le test faux — « un œuf et du bœuf »
                  déclenche la vigilance MAJUSCULE (la phrase commence en minuscule), ce qui est le
                  comportement voulu, pas un faux positif. */
               marque: marque0 }; };
    await jusqua('le chargement des lexiques (fenetre→fenêtre)', () => {
      zone.textContent = 'la fenetre est ouverte';
      zone.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return [...document.querySelectorAll('.vdc-on')].some(e => e.textContent === 'fenêtre');
    }, 60000);
    const out = [];
    for (const c of ${JSON.stringify(cas)}) out.push(Object.assign({ txt: c.txt }, await passe(c.txt, !!c.appliquer)));
    return { out };
  } catch (e) { return { fatal: e.message }; }
})()`;

async function main() {
  const chrome = trouverChrome();
  if (!chrome) {
    console.error('✗ NAVIGATEUR ABSENT — aucun Chrome/Edge/Chromium trouvé. Ce banc doit tourner dans un VRAI\n' +
                  '  navigateur : c\'est tout son intérêt. Installer Chrome, ou donner le chemin via CHROME=…');
    process.exit(1);
  }
  const { srv, port } = await servir();
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-chrome-'));
  const args = ['--remote-debugging-port=0', '--user-data-dir=' + profil, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--disable-background-networking',
    '--disable-gpu', '--autoplay-policy=no-user-gesture-required',   // read-along : un clic CDP n'est pas un « geste utilisateur » — speak() rendait not-allowed → onerror → stop immédiat (témoins : attache=1, clics=2, kara=0)
    'about:blank'];
  if (!TETE) args.unshift('--headless=new');
  const proc = spawn(chrome, args, { stdio: 'ignore' });
  let sess = null, code = 0;
  const nettoyer = () => { try { sess && sess.fermer(); } catch (e) {} try { proc.kill(); } catch (e) {}
    try { srv.close(); } catch (e) {} try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) {} };

  try {
    const url = 'http://127.0.0.1:' + port + '/app/omega-pendu.html';
    log('Chrome  : ' + chrome);
    log('page    : ' + url + (TETE ? '  (fenêtre visible)' : '  (headless)') + '\n');
    /* On ouvre un onglet VIDE, on s'y attache, PUIS on navigue. Créer l'onglet directement sur l'URL
       fait courir la navigation contre l'attachement : l'évaluation part alors dans un contexte que
       la navigation détruit, et Chrome répond « Execution context was destroyed » — vu une fois. */
    const dbg = await lirePortDevTools(profil, 60000);   // le port RÉEL, écrit par Chrome lui-même
    log('port CDP : ' + dbg);
    sess = await connecter(await cible(dbg, 'about:blank'));
    await sess.envoyer('Page.enable');
    await sess.envoyer('Runtime.enable');
    await sess.envoyer('Page.navigate', { url });
    let pret = false;
    for (let i = 0; i < 300 && !pret; i++) {
      try {
        const q = await sess.envoyer('Runtime.evaluate',
          { expression: '(document.readyState === "complete") && /omega-pendu\\.html$/.test(location.pathname)',
            returnByValue: true });
        pret = q.result.value === true;
      } catch (e) { /* contexte en cours de remplacement : on repasse */ }
      if (!pret) await attendre(200);
    }
    if (!pret) throw new Error('la page ne s\'est pas chargée dans le délai imparti');
    const r = await sess.envoyer('Runtime.evaluate',
      { expression: SCRIPT(CAS.map(c => ({ txt: c.txt, appliquer: !!c.appliquer }))) /* le drapeau DOIT passer : sans lui la page ne teste jamais « appliquer » */, awaitPromise: true, returnByValue: true, timeout: 180000 });
    if (r.exceptionDetails) throw new Error('page : ' + (r.exceptionDetails.exception || {}).description);
    const val = r.result.value || {};
    if (val.fatal) throw new Error(val.fatal);

    const echecs = [];
    let muets = 0;   // contre-gardes FP=0 passées : comptées, pas déroulées
    val.out.forEach((got, k) => {
      const c = CAS[k], app = got.applique.map(s => s.toLowerCase());
      // « rien » porte sur la couche AFFIRMATIVE : rien d'appliqué, et aucune marque non-vigilance.
      // La vigilance orange est proposée, jamais imposée — la compter ici ferait échouer des phrases
      // parfaitement correctes (majuscule initiale absente) et rendrait le banc menteur.
      /* ⭐ LE RENDU NE MODIFIE JAMAIS LE TEXTE SAISI (02/09). Les propositions de ponctuation (« . », « ? »)
         étaient rendues comme du CONTENU du contenteditable : « est-ce que tu viens demain » (26 car.) relu
         à 28 au tour suivant, curseur restauré sur un texte plus long, clic et sélection à côté (rapport de Rem).
         Gardé sur CHAQUE cas, après le rendu ET après un second événement input. */
      if (got.texte !== c.txt || got.texte2 !== c.txt)
        echecs.push(`« ${c.txt} » : le RENDU a modifié le texte saisi → ${JSON.stringify(got.texte)} puis ${JSON.stringify(got.texte2)}`);
      /* ⭐ LE CLIC SUR UNE FAUTE DE LA ZONE DE SAISIE OUVRE LA CARTE (règle + appliquer). Retiré par 6567363
         sans que Rem l'ait demandé (« je n'ai jamais demandé ça ») : gardé dès qu'une faute est marquée. */
      /* ⭐ LE CHEMIN COMPLET « proposer → cliquer → APPLIQUER » (Rem : la ponctuation « ne marche pas en forme
         interrogative » à l'usage, alors que le moteur PROPOSE le « ? »). On applique depuis la carte et on relit le texte. */
      if (c.appliquer && got.corrige !== c.appliquer)
        echecs.push(`« ${c.txt} » : appliquer depuis la carte devait donner ${JSON.stringify(c.appliquer)} dans le texte CORRIGÉ, eu ${JSON.stringify(got.corrige)}`);
      if (c.propose) { const props = got.marque.map(m => m.sugg).filter(x => x != null);
        if (props.indexOf(c.propose) < 0) echecs.push(`« ${c.txt} » : devait PROPOSER ${JSON.stringify(c.propose)} (${c.pourquoi}), marques ${JSON.stringify(props)}`);
        if (c.propose === ' ?' && props.indexOf('.') >= 0) echecs.push(`« ${c.txt} » : propose un POINT au bout d'une question`); }
      if (c.propose || c.appliquer) { const b = got.boite;
        if (!b || b.w < 8 || b.h < 16 || !b.vise) echecs.push(`« ${c.txt} » : la marque d'insertion n'est pas CLIQUABLE (boîte ${JSON.stringify(b)} ; attendu ≥ 8 × 16 px et visée au centre)`); }
      if (c.orangeInterdit) { const mauvais = got.marque.filter(m => m.vig && m.t.trim().toLowerCase() === c.orangeInterdit.toLowerCase());
        if (mauvais.length) echecs.push(`« ${c.txt} » : « ${c.orangeInterdit} » ne devait PAS être marqué (${c.pourquoi}), marques ${JSON.stringify(mauvais.map(m => m.key))}`); }
      if (c.corrigeAttendu) { const cible = c.corrigeAttendu[1].toLowerCase(), ok = got.marque.some(m => (m.key || '').toLowerCase().endsWith('|' + cible)) || got.applique.some(a => a.toLowerCase() === cible);
        if (!ok) echecs.push(`« ${c.txt} » : « ${c.corrigeAttendu[0]} » devait être corrigé ou proposé en « ${c.corrigeAttendu[1]} » (${c.pourquoi}), marques ${JSON.stringify(got.marque.map(m => m.key))}, appliqué ${JSON.stringify(got.applique)}`); }
      if (got.carte === false)
        echecs.push(`« ${c.txt} » : le clic sur la faute dans la ZONE DE SAISIE n'ouvre pas la carte`);
      if (c.rien) { const dur = got.marque.filter(m => !m.vig).map(m => m.t);
        if (app.length || dur.length) echecs.push(`« ${c.txt} » ne devrait RIEN appliquer (${c.pourquoi}), eu ${JSON.stringify(app.concat(dur))}`); }
      for (const a of (c.attendu || [])) if (!app.includes(a.toLowerCase()))
        echecs.push(`« ${c.txt} » doit appliquer « ${a} » (${c.pourquoi}), eu ${JSON.stringify(got.applique)}`);
      for (const i of (c.interdit || [])) if (app.includes(i.toLowerCase()))
        echecs.push(`« ${c.txt} » ne doit PAS appliquer « ${i} » (${c.pourquoi})`);
      // La typographie est ancrée CARACTÈRE : elle n'a pas de span de mot, on lit donc le compteur
      // « (N appliquée) » de la barre — exactement le chiffre que l'utilisateur a sous les yeux.
      if (c.typoAppliquee != null && got.nApplique !== c.typoAppliquee)
        echecs.push(`« ${c.txt} » doit montrer ${c.typoAppliquee} correction(s) APPLIQUÉE(S) (${c.pourquoi}), la barre dit ${got.nApplique}`);
      const rate = echecs.length && echecs[echecs.length - 1].includes(c.txt);
      if (c.muet && !rate) { muets++; return; }   // vert et muet : on ne déroule pas
      log('  ' + (rate ? '✗' : '✓') + ' ' +
          c.txt.padEnd(38) + (got.applique.length ? '→ ' + got.applique.join(' · ') : '(rien)'));
    });
    if (muets) log('  ✓ FP=0 PRODUIT : ' + muets + ' phrases CORRECTES traversées sans une seule correction appliquée');
    /* ── DICTÉE : répétition espacée (chantier ③) — une vraie boucle dans le DOM.
       On répond FAUX à une dictée réelle : les mots substitués doivent entrer en boîte 1 (vdd_srs,
       échéance FUTURE), l'encart 🔁 doit apparaître dans le feedback, et le chip #vdd-srs se peupler. */
    const rs = await sess.envoyer('Runtime.evaluate', { expression: `(async () => {
      const attendre = (ms) => new Promise(r => setTimeout(r, ms));
      try { localStorage.removeItem('vdd_srs'); } catch (e) {}
      const btn = document.getElementById('vdd-btn'); if (!btn) return { fatal: 'bouton dictée absent' };
      btn.click(); await attendre(500);
      const ans = document.getElementById('vdd-ans'); if (!ans) return { fatal: 'zone dictée absente' };
      ans.value = 'zzz zzz'; document.getElementById('vdd-check').click(); await attendre(700);
      let S = {}; try { S = JSON.parse(localStorage.getItem('vdd_srs') || '{}'); } catch (e) {}
      const mots = Object.keys(S), now = Date.now();
      const out = { mots: mots,
        b1: mots.every(w => S[w].b === 1), futur: mots.every(w => S[w].due > now),
        encart: (document.getElementById('vdd-fb').textContent || '').indexOf('Révision espacée') >= 0,
        chip: (document.getElementById('vdd-srs').textContent || '').indexOf('en apprentissage') >= 0 };
      try { localStorage.removeItem('vdd_srs'); } catch (e) {}
      return out;
    })()`, awaitPromise: true, returnByValue: true, timeout: 30000 });
    if (rs.exceptionDetails) throw new Error('dictée : ' + (rs.exceptionDetails.exception || {}).description);
    const sv = rs.result.value || {};
    if (sv.fatal) echecs.push('dictée SRS : ' + sv.fatal);
    else {
      if (!sv.mots || !sv.mots.length) echecs.push('dictée SRS : répondre faux doit inscrire au moins un mot en révision (vdd_srs vide)');
      else if (!(sv.b1 && sv.futur)) echecs.push('dictée SRS : les mots inscrits doivent être en boîte 1 avec une échéance future');
      if (!sv.encart) echecs.push('dictée SRS : l\'encart « 🔁 Révision espacée » doit apparaître dans le feedback');
      if (!sv.chip) echecs.push('dictée SRS : le chip #vdd-srs doit annoncer les mots en apprentissage');
      log('  ' + (sv.mots && sv.mots.length && sv.b1 && sv.futur && sv.encart && sv.chip ? '✓' : '✗')
        + ' dictée : répétition espacée (' + (sv.mots || []).join(' · ') + ')');
    }

    /* ── READ-ALONG (chantier 2026-08-13) : le karaoké se construit AVANT la voix (déterministe
       même sans voix installée) ; l'arrêt RESTAURE le rendu par instantané. */
    const rl = await sess.envoyer('Runtime.evaluate', { expression: `(async () => {
      const attendre = (ms) => new Promise(r => setTimeout(r, ms));
      const br = document.getElementById('vdc-lire');
      if (!br) return { fatal: 'bouton 🔊 Lire absent' };
      const z = document.getElementById('vdc-in'), res = document.getElementById('vdc-result');
      z.textContent = 'la fenetre est ouverte';
      z.dispatchEvent(new Event('input', { bubbles: true }));
      await attendre(900);
      const avantHtml = res.innerHTML;
      br.click(); await attendre(500);
      const kara = res.querySelectorAll('.vdc-kara').length;
      const stopTxt = br.textContent;
      br.click(); await attendre(300);
      const restaure = res.innerHTML === avantHtml;
      return { kara, stopTxt, restaure };
    })()`, awaitPromise: true, returnByValue: true, timeout: 30000 });
    if (rl.exceptionDetails) throw new Error('read-along : ' + (rl.exceptionDetails.exception || {}).description);
    const rv = rl.result.value || {};
    if (rv.fatal) echecs.push('read-along : ' + rv.fatal);
    else {
      if (!(rv.kara >= 4)) echecs.push('read-along : le karaoké doit découper le texte en mots (.vdc-kara), eu ' + rv.kara);
      if (rv.stopTxt && rv.stopTxt.indexOf('Stop') < 0) echecs.push('read-along : pendant la lecture le bouton doit dire Stop, eu « ' + rv.stopTxt + ' »');
      if (!rv.restaure) echecs.push('read-along : l\'arrêt doit RESTAURER le rendu corrigé (instantané)');
      log('  ' + (rv.kara >= 4 && rv.restaure ? '✓' : '✗') + ' lecture read-along (karaoké ' + rv.kara + ' mots, restauration ' + (rv.restaure ? 'OK' : 'KO') + ')');
    }

    /* ── CRIBLE DES EXPLICATIONS (demande de Rem, 2026-08-26 : « on se doit, c'est un impératif,
       de bien expliquer les fautes — il va falloir repasser nos règles avec nos exemples au crible »).
       On ne lit pas le code : on CLIQUE chaque correction et on lit la carte que l'utilisateur voit.
       Mesuré ce jour-là AVANT correctif : 3 explications sur 16 (19 %) — et les 3 étaient des accords,
       parce que `_accHint` existait. Tout le versant orthographe rendait « même son, orthographe
       corrigée », qui ne dit pas CE QUI a changé. Le crible a aussi révélé qu'une correction
       d'ESPACEMENT recevait un conseil d'homophone (« remplace par a→avait ») : `_corrFam` la faisait
       tomber dans son `else` attrape-tout.
       ⚠️ MISE EN CHAUFFE OBLIGATOIRE : le lexique du speller charge en différé. Mesurer trop tôt
       conclut « rien détecté » sur les 7 cas orthographiques — piège tombé dedans en direct. */
    const CRIB = [
      // `dys` = famille qui DOIT porter le conseil ancré sur le mot (🛠️). La ponctuation, elle,
      // s'explique par sa RÈGLE (« après une virgule, une espace ») : citer le mot n'y ajoute rien.
      ['orthographe', 'Il ouvre la fenetre du salon.', 1],
      ['orthographe', 'Elle est ellle partie tot.', 1],
      ['orthographe', 'Je vois une grosse fote ici.', 1],
      ['orthographe', 'Il marche dehor sans manteau.', 1],
      ['graphème',    'Je mange une pome sucree.', 1],
      ['élision',     'Je pense que c est fini.', 1],
      ['homophone',   'Il a manger une pomme et il est partie.', 1],
      ['homophone',   'Sa mere et partie hier.', 1],
      ['accord',      'Les chat dorme dans le jardin.', 1],
      ['accord',      'La voiture est bleu.', 1],
      ['majuscule',   'elle arrive demain matin.', 1],
      ['ponctuation', 'Il arrive ,puis il repart .', 0],
      // élargissement 26/08/2026 (demande de Rem) : la CONJUGAISON manquait au crible, et les
      // trois trous que le crible avait lui-même trouvés y entrent comme garde de non-retour.
      ['conjugaison', 'Je fini mon travail ce soir.', 1],
      ['conjugaison', 'Il faut que tu fini ton travail.', 1],
      ['conjugaison', 'Je vais mange en ville demain.', 1],
      ['homophone',   'Les enfants on mange leur soupe.', 1],
      ['participe',   'Il a remplit un sceau tout neuf.', 1],
    ];
    /* Contre-épreuve : ces phrases sont CORRECTES et ne doivent produire AUCUNE correction.
       « Dans ses statistiques on voit bien. » était corrigé D'OFFICE en « ont » sur la production du
       26/08/2026 — un FP ROUGE, donc une violation du FP=0, trouvé en élargissant le crible. */
    const CRIB_NOFIRE = [
      'Dans ses statistiques on voit bien.',
      'Les enfants, on mange !',
      'Le chat on le voit souvent.',
      'Je lui parle souvent.',
      'Je vais manger en ville.',
      'Il faut que tu manges ta soupe.',
    ];
    const cr = await sess.envoyer('Runtime.evaluate', { expression: `(async () => {
      const attendre = (ms) => new Promise(r => setTimeout(r, ms));
      const NOFIRE = ${JSON.stringify(CRIB_NOFIRE)};
      const inp = document.getElementById('vdc-in'), out = document.getElementById('vdc-out');
      if (!inp || !out) return { fatal: 'correcteur absent' };
      const corriger = () => [].slice.call(document.querySelectorAll('button'))
        .filter(b => (b.textContent || '').trim() === 'Corriger')[0];
      async function passe(txt) {
        inp.value = txt; inp.dispatchEvent(new Event('input', { bubbles: true }));
        const b = corriger(); if (!b) return null; b.click(); await attendre(600);
        return [].slice.call(out.querySelectorAll('[data-key]'));
      }
      // chauffe : le speller charge en différé — on attend qu'une faute LEXICALE sorte
      let chaud = false;
      for (let t = 0; t < 25 && !chaud; t++) { const c = await passe('Il ouvre la fenetre du salon.'); chaud = !!(c && c.length); }
      if (!chaud) return { fatal: 'speller jamais chargé (25 essais)' };
      const res = [];
      for (const [fam, txt, dys] of ${JSON.stringify(CRIB)}) {
        const chips = await passe(txt);
        if (!chips || !chips.length) { res.push({ fam, txt, dys, muet: true, items: [] }); continue; }
        const items = [];
        for (const ch of chips) {
          ch.click(); await attendre(150);
          const card = document.getElementById('vdc-cardpop');
          const vis = card && card.style.display !== 'none';
          const t = vis ? (card.innerText || '').replace(/\s+/g, ' ') : '';
          // NE PAS accepter « Pourquoi » : c'est le TITRE de la carte, donc toujours present.
          // Teste le 26/08/2026 : avec lui, couper le fil du conseil laissait la sonde VERTE.
          // Les trois marqueurs retenus sont ancres sur le mot par construction.
          items.push({ chip: (ch.innerText || '').replace(/\s+/g, ' ').trim(),
                       ancre: !!(t && (t.indexOf('\u{1F6E0}') >= 0 || /Astuce|commande/.test(t))),
                       raison: (function(){ if(!t) return false;
                         var i = t.indexOf('Pourquoi'); if (i < 0) return false;
                         return t.slice(i + 8).replace(/\s+/g,' ').trim().length >= 25; })(),
                       vide: !vis });
          if (card) card.style.display = 'none';
        }
        res.push({ fam, txt, dys, muet: false, items });
      }
      const nofire = [];
      for (const txt of ${JSON.stringify([])}.concat(NOFIRE)) {
        const chips = await passe(txt);
        if (chips && chips.length) nofire.push({ txt, vus: chips.map(c => (c.innerText || '').replace(/\s+/g, ' ').trim()) });
      }
      return { res, nofire };
    })()`, awaitPromise: true, returnByValue: true, timeout: 240000 });
    if (cr.exceptionDetails) throw new Error('crible : ' + (cr.exceptionDetails.exception || {}).description);
    const cv2 = cr.result.value || {};
    if (cv2.fatal) echecs.push('crible explications : ' + cv2.fatal);
    else {
      let tot = 0, avec = 0, sansCarte = 0;
      const muets = [];
      for (const r of cv2.res) {
        if (r.muet) { muets.push(r.fam + ' « ' + r.txt + ' »'); continue; }
        for (const it of r.items) { tot++; if (it.raison) avec++; if (it.vide) sansCarte++;
          if (!it.raison) echecs.push('crible : « ' + it.chip + ' » (' + r.fam + ') ne donne AUCUNE raison — la carte ne dit pas pourquoi');
          // exigence FORTE sur les familles dys : le conseil doit citer CE mot, pas réciter une règle
          if (r.dys && !it.ancre) echecs.push('crible : « ' + it.chip + ' » (' + r.fam + ') sans conseil ANCRÉ sur le mot — phrase de manuel'); }
      }
      // PLANCHER : aucune correction ne doit être sans raison, et le corpus doit rester détecté.
      // Le 26/08/2026 : 18/18 après correctif (19 % avant). Un rouge ici = une régression d'explication.
      for (const nf of (cv2.nofire || []))
        echecs.push('crible NOFIRE : « ' + nf.txt +' » est CORRECT et ne doit rien produire — eu ' + JSON.stringify(nf.vus));
      if (sansCarte) echecs.push('crible : ' + sansCarte + ' correction(s) sans carte au clic');
      if (muets.length > 2) echecs.push('crible : ' + muets.length + ' phrase(s) sans aucune détection — ' + muets.join(' · '));
      let ancres = 0, dysTot = 0;   // ce compte est REPORTÉ dans le verdict final, y compris en --check
      for (const r of cv2.res) if (!r.muet && r.dys) for (const it of r.items) { dysTot++; if (it.ancre) ancres++; }
      log('  ' + (avec === tot && ancres === dysTot && tot >= 12 ? '✓' : '✗') + ' crible des explications : ' +
          avec + '/' + tot + ' donnent une RAISON · ' + ancres + '/' + dysTot + ' un conseil ANCRÉ sur le mot' +
          (muets.length ? ' · ' + muets.length + ' phrase(s) non détectée(s)' : ''));
      global.__CRIBLE_RES = avec + '/' + tot + ' raison · ' + ancres + '/' + dysTot + ' ancré';
    }

    /* ── 🎯 REPÈRE LA FAUTE (audit 2026-08-13) : une vraie boucle — phrase affichée en mots
       cliquables, réponse, feedback avec score. Déterministe : cliquer un mot produit TOUJOURS
       un verdict (Exact / ailleurs / était correcte) + le bouton « Phrase suivante ». */
    const rp = await sess.envoyer('Runtime.evaluate', { expression: `(async () => {
      const attendre = (ms) => new Promise(r => setTimeout(r, ms));
      const bd = document.getElementById('vdd-btn'); if (!bd) return { fatal: 'dictée absente' };
      bd.click(); await attendre(400);
      const brp = document.getElementById('vdd-repere'); if (!brp) return { fatal: 'bouton 🎯 absent' };
      brp.click(); await attendre(400);
      const mots = document.querySelectorAll('.vdd-rmot');
      if (mots.length < 3) return { fatal: 'phrase non affichée (' + mots.length + ' mots)' };
      mots[0].click(); await attendre(400);
      const fb = (document.getElementById('vdd-fb').textContent || '');
      return { nMots: mots.length,
        verdict: fb.indexOf('Exact') >= 0 || fb.indexOf('ailleurs') >= 0 || fb.indexOf('correcte.') >= 0,
        score: /Score repère : \\d+ \\/ \\d+/.test(fb),
        suivant: !!document.getElementById('vdd-rnext') };
    })()`, awaitPromise: true, returnByValue: true, timeout: 30000 });
    if (rp.exceptionDetails) throw new Error('repère : ' + (rp.exceptionDetails.exception || {}).description);
    const pv = rp.result.value || {};
    if (pv.fatal) echecs.push('repère la faute : ' + pv.fatal);
    else {
      if (!pv.verdict) echecs.push('repère la faute : cliquer un mot doit produire un verdict');
      if (!pv.score) echecs.push('repère la faute : le score « Score repère : N / M » doit s\'afficher');
      if (!pv.suivant) echecs.push('repère la faute : le bouton « Phrase suivante » doit exister');
      log('  ' + (pv.verdict && pv.score && pv.suivant ? '✓' : '✗') + ' 🎯 repère la faute (' + pv.nMots + ' mots cliquables, verdict+score+suivant)');
    }

    /* ── ✍️ CONJUGUE (2026-08-19) : écouter → ÉCRIRE la forme du verbe (production, pas
       reconnaissance). Déterministe : une réponse fausse (« zzzz ») produit TOUJOURS un verdict
       (« Forme attendue » / « Presque » / « Bon verbe ») + le score + « Phrase suivante ». La
       lecture vocale est lancée mais pas attendue (flag autoplay du banc). */
    const cj = await sess.envoyer('Runtime.evaluate', { expression: `(async () => {
      const attendre = (ms) => new Promise(r => setTimeout(r, ms));
      const bc = document.getElementById('vdd-conj'); if (!bc) return { fatal: 'bouton ✍️ absent' };
      bc.click(); await attendre(500);
      const inp = document.getElementById('vdd-cin');
      if (!inp) return { fatal: 'trou de conjugaison non affiché' };
      inp.value = 'zzzz';
      document.getElementById('vdd-cok').click(); await attendre(400);
      const fb = (document.getElementById('vdd-fb').textContent || '');
      return { verdict: fb.indexOf('Forme attendue') >= 0 || fb.indexOf('Presque') >= 0 || fb.indexOf('Bon verbe') >= 0,
        score: /Score conjugaison : \\d+ \\/ \\d+/.test(fb),
        srs: fb.indexOf('à revoir dans') >= 0,
        suivant: !!document.getElementById('vdd-cnext') };
    })()`, awaitPromise: true, returnByValue: true, timeout: 30000 });
    /* v2 — TRANSFORMATION 3s↔3p : proposée quand la lecture du verbe est en 3e personne et que
       CONJ_C connaît la forme jumelle. Les verbes en 3e personne dominent le pool : on relance
       jusqu'à la voir (15 tours max), puis on répond FAUX → le verdict « On écrit : … » doit
       tomber. Ne jamais la trouver en 15 tours = elle est morte → échec explicite. */
    const ct = await sess.envoyer('Runtime.evaluate', { expression: `(async () => {
      const attendre = (ms) => new Promise(r => setTimeout(r, ms));
      for (let tour = 0; tour < 15; tour++) {
        const inp2 = document.getElementById('vdd-ctin');
        if (inp2 && !inp2.disabled) {
          inp2.value = 'zzz';
          document.getElementById('vdd-ctok').click(); await attendre(300);
          const f2 = (document.getElementById('vdd-ctfb').textContent || '');
          return { tours: tour, verdict: f2.indexOf('On écrit') >= 0, score2: /Score conjugaison : \\d+ \\/ \\d+/.test(document.getElementById('vdd-cscore2').textContent || '') };
        }
        const nx = document.getElementById('vdd-cnext'); if (!nx) return { fatal: 'ni transformation ni « Phrase suivante »' };
        nx.click(); await attendre(450);
        const i1 = document.getElementById('vdd-cin'); if (!i1) return { fatal: 'trou absent au tour ' + tour };
        i1.value = 'zzzz'; document.getElementById('vdd-cok').click(); await attendre(350);
      }
      return { fatal: 'transformation jamais proposée en 15 tours' };
    })()`, awaitPromise: true, returnByValue: true, timeout: 60000 });
    if (ct.exceptionDetails) throw new Error('transformation : ' + (ct.exceptionDetails.exception || {}).description);
    const tv = ct.result.value || {};
    if (tv.fatal) echecs.push('conjugue v2 : ' + tv.fatal);
    else {
      if (!tv.verdict) echecs.push('conjugue v2 : une forme fausse doit produire « On écrit : … »');
      if (!tv.score2) echecs.push('conjugue v2 : le score doit se mettre à jour après la transformation');
      log('  ' + (tv.verdict && tv.score2 ? '✓' : '✗') + ' ✍️ conjugue v2 (transformation 3s↔3p au tour ' + tv.tours + ')');
    }
    if (cj.exceptionDetails) throw new Error('conjugue : ' + (cj.exceptionDetails.exception || {}).description);
    const cv = cj.result.value || {};
    if (cv.fatal) echecs.push('conjugue : ' + cv.fatal);
    else {
      if (!cv.verdict) echecs.push('conjugue : une réponse fausse doit produire un verdict avec la forme attendue');
      if (!cv.score) echecs.push('conjugue : le score « Score conjugaison : N / M » doit s afficher');
      if (!cv.suivant) echecs.push('conjugue : le bouton « Phrase suivante » doit exister');
      log('  ' + (cv.verdict && cv.score && cv.suivant ? '✓' : '✗') + ' ✍️ conjugue (verdict+score+suivant, SRS ' + (cv.srs ? 'nourri' : 'déjà connu') + ')');
    }

    /* ── CHEMIN FRAIS (bug du 2026-08-19) : page NEUVE → dictée → ✍️ Conjugue, SANS ouvrir le
       correcteur. CONJ_F se charge en async à l'ouverture du CORRECTEUR : le premier jour, ce
       chemin — celui de Rem — donnait « Pas de verbe conjugable » à CHAQUE clic, et le banc ne
       le voyait pas parce que ses cas correcteur précédents avaient déjà chargé les tables.
       Onglet neuf : le mode doit charger LUI-MÊME (⏳) puis afficher le trou. */
    let sess2 = null;
    try {
      sess2 = await connecter(await cible(dbg, 'about:blank'));
      await sess2.envoyer('Page.enable'); await sess2.envoyer('Runtime.enable');
      await sess2.envoyer('Page.navigate', { url });
      let pret2 = false;
      for (let i2 = 0; i2 < 300 && !pret2; i2++) {
        try { const q2 = await sess2.envoyer('Runtime.evaluate',
          { expression: '(document.readyState === "complete") && location.pathname.indexOf("omega-pendu") >= 0', returnByValue: true });
          pret2 = q2.result.value === true; } catch (e) {}
        if (!pret2) await attendre(200);
      }
      if (!pret2) throw new Error('onglet frais : page non chargée');
      const fr = await sess2.envoyer('Runtime.evaluate', { expression: `(async () => {
        const attendre = (ms) => new Promise(r => setTimeout(r, ms));
        const bd = document.getElementById('vdd-btn'); if (!bd) return { fatal: 'dictée absente' };
        bd.click(); await attendre(400);
        const bc = document.getElementById('vdd-conj'); if (!bc) return { fatal: 'bouton ✍️ absent' };
        bc.click();
        const t0 = Date.now(); let charge = false;
        while (Date.now() - t0 < 25000) {
          if (document.getElementById('vdd-cin')) { charge = true; break; }
          const fb = (document.getElementById('vdd-fb').textContent || '');
          if (fb.indexOf('pas pu se charger') >= 0) return { fatal: 'chargement des conjugaisons en échec' };
          if (fb.indexOf('Pas de verbe conjugable') >= 0) return { fatal: 'régression : « Pas de verbe conjugable » sur page fraîche' };
          await attendre(300);
        }
        if (!charge) return { fatal: 'trou jamais affiché en 25 s (chargement async mort)' };
        document.getElementById('vdd-cin').value = 'zzzz';
        document.getElementById('vdd-cok').click(); await attendre(400);
        const fb2 = (document.getElementById('vdd-fb').textContent || '');
        return { verdict: fb2.indexOf('Forme attendue') >= 0 || fb2.indexOf('Presque') >= 0 || fb2.indexOf('Bon verbe') >= 0, ms: Date.now() - t0 };
      })()`, awaitPromise: true, returnByValue: true, timeout: 40000 });
      if (fr.exceptionDetails) throw new Error((fr.exceptionDetails.exception || {}).description);
      const fv = fr.result.value || {};
      if (fv.fatal) echecs.push('conjugue chemin frais : ' + fv.fatal);
      else if (!fv.verdict) echecs.push('conjugue chemin frais : pas de verdict après réponse fausse');
      else log('  ✓ ✍️ conjugue sur PAGE FRAÎCHE (conjugaisons auto-chargées en ' + fv.ms + ' ms)');
    } catch (e) { echecs.push('conjugue chemin frais : ' + e.message); }
    finally { if (sess2) sess2.fermer(); }

    if (echecs.length) { console.error('\n✗ NAVIGATEUR RÉEL — ' + echecs.length + ' échec(s) :\n  ' + echecs.join('\n  ')); code = 1; }
    else console.log('✓ NAVIGATEUR RÉEL : ' + CAS.length + ' cas + révision espacée + read-along, vérifiés dans Chrome (DOM et localStorage lus) · crible explications ' + (global.__CRIBLE_RES || 'n/a') + '.');
  } catch (e) {
    console.error('✗ NAVIGATEUR RÉEL : ' + e.message); code = 1;
  }
  nettoyer();
  process.exit(code);
}
main();
