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
    const passe = async (txt) => { zone.textContent = txt;
      zone.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await attendre(500);
      const bar = (document.body.innerText.match(/\\((\\d+) appliqu/) || [])[1];   // \\ doublés : on est dans un gabarit JS
      return { nApplique: bar == null ? null : +bar,
               applique: [...document.querySelectorAll('.vdc-on')].map(e => e.textContent),
               /* on garde la CLASSE : « vdc-vig » = vigilance orange, proposée et jamais appliquée.
                  La confondre avec une vraie marque rend le test faux — « un œuf et du bœuf »
                  déclenche la vigilance MAJUSCULE (la phrase commence en minuscule), ce qui est le
                  comportement voulu, pas un faux positif. */
               marque: [...document.querySelectorAll('.vdc-bad')].map(e => ({ t: e.textContent, vig: /vdc-vig/.test(e.className) })) }; };
    await jusqua('le chargement des lexiques (fenetre→fenêtre)', () => {
      zone.textContent = 'la fenetre est ouverte';
      zone.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return [...document.querySelectorAll('.vdc-on')].some(e => e.textContent === 'fenêtre');
    }, 60000);
    const out = [];
    for (const c of ${JSON.stringify(cas)}) out.push(Object.assign({ txt: c.txt }, await passe(c.txt)));
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
      { expression: SCRIPT(CAS.map(c => ({ txt: c.txt }))), awaitPromise: true, returnByValue: true, timeout: 180000 });
    if (r.exceptionDetails) throw new Error('page : ' + (r.exceptionDetails.exception || {}).description);
    const val = r.result.value || {};
    if (val.fatal) throw new Error(val.fatal);

    const echecs = [];
    val.out.forEach((got, k) => {
      const c = CAS[k], app = got.applique.map(s => s.toLowerCase());
      // « rien » porte sur la couche AFFIRMATIVE : rien d'appliqué, et aucune marque non-vigilance.
      // La vigilance orange est proposée, jamais imposée — la compter ici ferait échouer des phrases
      // parfaitement correctes (majuscule initiale absente) et rendrait le banc menteur.
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
      log('  ' + (echecs.length && echecs[echecs.length - 1].includes(c.txt) ? '✗' : '✓') + ' ' +
          c.txt.padEnd(38) + (got.applique.length ? '→ ' + got.applique.join(' · ') : '(rien)'));
    });
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

    if (echecs.length) { console.error('\n✗ NAVIGATEUR RÉEL — ' + echecs.length + ' échec(s) :\n  ' + echecs.join('\n  ')); code = 1; }
    else console.log('✓ NAVIGATEUR RÉEL : ' + CAS.length + ' cas + révision espacée + read-along, vérifiés dans Chrome (DOM et localStorage lus).');
  } catch (e) {
    console.error('✗ NAVIGATEUR RÉEL : ' + e.message); code = 1;
  }
  nettoyer();
  process.exit(code);
}
main();
