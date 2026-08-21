#!/usr/bin/env node
/* verif_enquete_navigateur.js — VÉRIFICATION DANS LE VRAI CHROME DE REM (demande 2026-08-21 :
 * « une batterie de test sur le correcteur site ET extension sur mon navigateur pour vérifier
 * que rien n'est perdu »).
 *
 * Trois surfaces, une fenêtre VISIBLE (le Chrome de l'utilisateur, profil temporaire) :
 *   1. SITE EN PRODUCTION (https://omegapendu.com — ce que les utilisateurs ont, pas le build local)
 *      a. les 8 réparables de l'enquête des 22 (rouges appliqués / oranges proposées) ;
 *      b. les contre-gardes (du correct qui doit rester muet) ;
 *      c. un échantillon des cas historiques du 61ᵉ check (non-régression) ;
 *      d. les 6 DICTÉES DYS RÉELLES : chaque rouge que le BANC MOTEUR a mesuré (dump
 *         audit_corr_dump.json) doit être APPLIQUÉ dans la page — le navigateur fait ce que la
 *         mesure dit, ou le banc est menteur.
 *   2. EXTENSION chargée depuis le dépôt (--load-extension) : mêmes cas dans le side panel,
 *      et PARITÉ site ≡ extension sur chaque suggestion.
 * Mécanique = clone du 61ᵉ check (serveur http natif inutile ici : prod + chrome-extension://).
 *   node dictee/verif_enquete_navigateur.js            # fenêtre visible, prod
 *   node dictee/verif_enquete_navigateur.js --local    # build local servi (avant déploiement)
 */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawn } = require('child_process');
const RACINE = path.join(__dirname, '..');
const LOCAL = process.argv.includes('--local');
const EXT_SEUL = process.argv.includes('--ext-seul');   // itérer vite sur la phase extension

function trouverChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const c = [];
  for (const b of [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env['LOCALAPPDATA']])
    if (b) c.push(path.join(b, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  return c.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } }) || null;
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.bin': 'application/octet-stream' };
function servir() {
  return new Promise((res) => {
    const srv = http.createServer((req, rep) => {
      const f = path.join(RACINE, decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, ''));
      if (!f.startsWith(RACINE)) { rep.writeHead(403).end(); return; }
      fs.readFile(f, (e, buf) => { if (e) { rep.writeHead(404).end('404'); return; }
        rep.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); rep.end(buf); });
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}
function attendre(ms) { return new Promise(r => setTimeout(r, ms)); }
function lirePortDevTools(profil, ms) {
  const t0 = Date.now(), f = path.join(profil, 'DevToolsActivePort');
  return new Promise((res, rej) => { (function boucle() {
    try { const p = parseInt(fs.readFileSync(f, 'utf8').split('\n')[0].trim(), 10); if (p > 0) return res(p); } catch (e) {}
    if (Date.now() - t0 > ms) return rej(new Error('port CDP jamais ouvert')); setTimeout(boucle, 200); })(); });
}
async function cible(port, url) {
  for (let i = 0; i < 150; i++) {
    try { const r = await fetch('http://127.0.0.1:' + port + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
      if (r.ok) return (await r.json()).webSocketDebuggerUrl; } catch (e) {}
    await attendre(200);
  }
  throw new Error('le port CDP ne répond pas');
}
/* DÉLAIS PARTOUT (2026-08-22 : le passage complet est resté bloqué 1 h 40 dans la phase extension — aucune promesse CDP
   n'avait de délai ; une réponse qui ne vient jamais = attente infinie, Edge orphelin). Ouverture : 15 s ; chaque
   envoi : (timeout de la commande ou 120 s) + 10 s ; socket fermée = toutes les attentes rejetées. */
function connecter(ws) {
  return new Promise((res, rej) => {
    const s = new WebSocket(ws); let id = 0; const attente = new Map();
    const tOpen = setTimeout(() => { try { s.close(); } catch (e) {} rej(new Error('WebSocket CDP : pas ouverte en 15 s (' + ws.slice(0, 60) + ')')); }, 15000);
    s.onopen = () => { clearTimeout(tOpen); res({
      envoyer(method, params) { return new Promise((ok, ko) => {
        const n = ++id, lim = (((params || {}).timeout) || 120000) + 10000;
        const t = setTimeout(() => { if (attente.delete(n)) ko(new Error('CDP ' + method + ' : pas de réponse en ' + Math.round(lim / 1000) + ' s')); }, lim);
        attente.set(n, { ok: (v) => { clearTimeout(t); ok(v); }, ko: (e) => { clearTimeout(t); ko(e); } });
        try { s.send(JSON.stringify({ id: n, method, params: params || {} })); } catch (e) { attente.delete(n); clearTimeout(t); ko(e); }
      }); },
      fermer() { try { s.close(); } catch (e) {} } }); };
    s.onerror = (e) => { clearTimeout(tOpen); rej(new Error('WebSocket CDP : ' + (e.message || 'échec'))); };
    s.onclose = () => { clearTimeout(tOpen); for (const a of attente.values()) a.ko(new Error('WebSocket CDP fermée')); attente.clear(); };
    s.onmessage = (m) => { const d = JSON.parse(m.data); const a = attente.get(d.id); if (!a) return; attente.delete(d.id); d.error ? a.ko(new Error(d.error.message)) : a.ok(d.result); };
  });
}
async function pagePrete(sess, test) {
  for (let i = 0; i < 300; i++) {
    try { const q = await sess.envoyer('Runtime.evaluate', { expression: test, returnByValue: true }); if (q.result.value === true) return true; } catch (e) {}
    await attendre(200);
  }
  return false;
}

/* ID d'une extension DÉPLIÉE = SHA256(chemin absolu en UTF-16LE)[:32] translittéré a-p — déterministe :
   on l'essaie EN PREMIER (Edge charge 6 extensions internes dont la sonde s'épuisait avant la nôtre). */
function idExtensionDepliee(dir) {
  const hex = require('crypto').createHash('sha256').update(Buffer.from(dir, 'utf16le')).digest('hex').slice(0, 32);
  return hex.split('').map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');
}
async function trouverOmega(dbg) {
  const liste = await (await fetch('http://127.0.0.1:' + dbg + '/json/list')).json();
  const ids = [...new Set(liste.map(t => (t.url || '').match(/^chrome-extension:\/\/([a-p]{32})/)).filter(Boolean).map(m => m[1]))];
  const attendu = idExtensionDepliee(path.join(RACINE, 'extension'));
  /* L'ID attendu est essayé MÊME s'il n'est pas listé : après une longue phase site, le service worker MV3 s'endort
     et n'apparaît plus dans /json/list → l'ID n'était jamais tenté (« non chargée » sur le passage complet, vert en
     --ext-seul, 2026-08-21). sidepanel.html s'ouvre indépendamment de l'état du SW. */
  if (!ids.includes(attendu)) ids.unshift(attendu); else ids.sort((x, y) => (x === attendu ? -1 : 0) - (y === attendu ? -1 : 0));
  for (const id of ids) {
    let s = null;
    try {
      s = await connecter(await cible(dbg, 'chrome-extension://' + id + '/sidepanel.html'));
      await s.envoyer('Page.enable'); await s.envoyer('Runtime.enable');
      let ok = false;
      for (let i = 0; i < 40 && !ok; i++) {                       // sonde COURTE (8 s) : une page d'erreur est « complete » sans jamais avoir #omdys-ta
        try { const q = await s.envoyer('Runtime.evaluate', { expression: '/^chrome-error/.test(location.href) ? "ERR" : (document.readyState==="complete"&&!!document.getElementById("omdys-ta"))', returnByValue: true });
          if (q.result.value === 'ERR') break; ok = q.result.value === true; } catch (e) {}
        if (!ok) await attendre(200);
      }
      if (ok) return { id, sess: s };
      s.fermer();
    } catch (e) { try { s && s.fermer(); } catch (e2) {} }
  }
  return null;
}
/* ── LES CAS ─────────────────────────────────────────────────────────────────
 * rouge   : suggestions qui doivent être APPLIQUÉES (site : .vdc-on ; extension : item non-vigilance)
 * orange  : suggestions qui doivent être PROPOSÉES (site : chip « À vérifier » ; ext : item .tvig)
 * rien    : aucun rouge (contre-garde) ; interdit : suggestion qui ne doit pas apparaître */
const CAS = [
  // ① les 8 réparables de l'enquête des 22
  { txt: 'comme par de petit tuyaux souterrain, tous les sucs', rouge: ['petits', 'souterrains'], pourquoi: 'adj ↔ nom pluriel en -aux (texte1 réel)' },
  { txt: 'elle a grandi pendant la guère et la famine', rouge: ['guerre'], pourquoi: 'DET + guère → guerre (texte2 réel)' },
  { txt: "c'était une femme cultivé et bien veillante, toujours de bonne humeur", rouge: ['cultivée'], pourquoi: 'coordination « et » levée par la sœur féminine (texte3 réel)' },
  { txt: 'Elle a fini sa vit dans une maison de retraite', rouge: ['vie'], pourquoi: 'sa + vit → vie (texte5 réel)' },
  { txt: "et elle s'est marié à l'âge de vingt ans", orange: ['mariée'], pourquoi: "accord après s'est, pronominal = orange (texte3 réel)" },
  { txt: "J'aimer beaucoup ma grand-mère.", orange: ["j'aime"], pourquoi: "j' + infinitif = orange, temps inconnu (texte6 réel)" },
  { txt: 'Elle àeu trois enfants qui vivent en France', orange: ['a eu'], pourquoi: 'soudure à+verbe (texte3 réel)' },
  { txt: 'dans uen maison de retraite', orange: ['une'], interdit: ['un'], pourquoi: 'le genre du nom suivant domine la fréquence (texte6 réel)' },
  // ①bis les réparables du croisement Excuse My French (2026-08-21)
  { txt: 'hier il mangeai une pomme', rouge: ['mangeait'], pourquoi: 'EMF : il/elle/on + -ai → -ait' },
  { txt: "le film qui j'ai vu était long", rouge: ['que'], pourquoi: 'EMF : qui + pronom sujet → que' },
  { txt: 'je vais jamais au cinéma', rouge: ['ne vais'], pourquoi: 'EMF : négation sans ne, verbe fini' },
  { txt: 'je mange de le pain', orange: ['du'], pourquoi: 'EMF : contraction de le → du (fusion proposée)' },
  { txt: 'le film qui il a vu', orange: ["qu'il"], pourquoi: "EMF : qui il → qu'il (fusion proposée)" },
  { txt: "l'homme avec qui je parle souvent", rien: true, interdit: ['que'], pourquoi: 'EMF contre-garde : préposition + qui' },
  { txt: 'il a décidé de le faire demain', rien: true, interdit: ['du'], pourquoi: 'EMF contre-garde : de le + infinitif' },
  // ② contre-gardes : du correct qui doit rester muet (les FP lus au flood différentiel)
  { txt: 'Le nombre de niveaux total est connu de tous.', rien: true, interdit: ['totals', 'totaux'], pourquoi: "l'adjectif modifie la tête à gauche du « de »" },
  { txt: 'une jupe bleu et vert avec des motifs', rien: true, interdit: ['bleue'], pourquoi: 'couleurs composées invariables (coordination protégée)' },
  { txt: 'le taux global reste stable cette année', rien: true, interdit: ['globaux', 'globals'], pourquoi: 'taux = singulier en -aux' },
  { txt: 'il la vit partir au loin', rien: true, interdit: ['vie'], pourquoi: 'la + vit = pronom objet + passé simple' },
  { txt: "Elle s'est donné jusqu'à mi-août pour y réfléchir.", rien: true, interdit: ['donnée'], pourquoi: 'se donner : COD postposé, invariable' },
  { txt: 'uen homme est venu ce matin', orange: ['un'], interdit: ['une'], pourquoi: 'contrôle masculin : le genre du nom suivant' },
  { txt: 'Le petit garçon mange une pomme rouge dans le jardin.', rien: true, pourquoi: 'FP=0 sur phrase correcte' },
  // ③ échantillon des cas HISTORIQUES du 61ᵉ check — non-régression
  { txt: 'les chien aboient', rouge: ['chiens'], pourquoi: 'historique : accord pluriel du nom' },
  { txt: 'la nourriture de leurs tige', rouge: ['tiges'], interdit: ['leur'], pourquoi: 'historique : un seul sens par désaccord' },
  { txt: 'il a jmaais vu ça', rouge: ['jamais'], pourquoi: 'historique : glissement moteur' },
  { txt: 'Marie est venu.', rouge: ['venue'], pourquoi: 'historique : genre du prénom' },
  { txt: 'Je suis allé à la plage mangé des champignons.', rouge: ['manger'], pourquoi: 'historique : infinitif de but' },
  { txt: 'on a pas le temps', rouge: ["n'a"], pourquoi: 'historique : négation n\'' },
  { txt: "si j'aurais su, tant pis", rouge: ["j'avais"], pourquoi: 'historique : si + conditionnel' },
  { txt: "l'usine emploie deux cent salariés", rouge: ['cents'], pourquoi: 'historique : vingt/cent' },
  { txt: 'Je suis rentré à la maison épuisé.', rien: true, pourquoi: 'historique : participe adjectival intact' },
  { txt: "Les girolles qu'elle avait cueillies sont bonnes.", rien: true, pourquoi: 'historique : pronom élidé non accordé' },
];

/* script SITE : écrit dans la zone réelle, lit les marques réelles */
const SCRIPT_SITE = (cas, dictees) => `(async () => {
  const attendre = (ms) => new Promise(r => setTimeout(r, ms));
  const jusqua = async (quoi, f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = f(); if (v) return v; await attendre(150); } throw new Error('délai : ' + quoi); };
  try {
    const b = await jusqua('bouton Correcteur', () => [...document.querySelectorAll('button')].find(x => /🩹/.test(x.textContent || '')), 30000);
    b.click();
    const zone = await jusqua('zone vdc-in', () => document.getElementById('vdc-in'), 30000);
    const passe = async (txt, ms) => { zone.textContent = txt; zone.dispatchEvent(new InputEvent('input', { bubbles: true })); await attendre(ms || 700);
      return { applique: [...document.querySelectorAll('.vdc-on')].map(e => e.textContent),
               chips: (document.getElementById('vdc-out') || {}).textContent || '',
               oranges: [...document.querySelectorAll('#vdc-out span[data-key]')].map(e => e.textContent) }; };
    await jusqua('lexiques (fenetre→fenêtre)', () => { zone.textContent = 'la fenetre est ouverte'; zone.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return [...document.querySelectorAll('.vdc-on')].some(e => e.textContent === 'fenêtre'); }, 90000);
    const out = [];
    for (const c of ${JSON.stringify(cas)}) out.push(Object.assign({ txt: c.txt }, await passe(c.txt)));
    const dic = [];
    for (const d of ${JSON.stringify(dictees)}) dic.push(Object.assign({ src: d.src }, await passe(d.raw, 1500)));
    return { out, dic };
  } catch (e) { return { fatal: e.message }; }
})()`;

/* script EXTENSION : le side panel, textarea + liste d'items */
const SCRIPT_EXT = (cas) => `(async () => {
  const attendre = (ms) => new Promise(r => setTimeout(r, ms));
  const jusqua = async (quoi, f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = f(); if (v) return v; await attendre(150); } throw new Error('délai : ' + quoi); };
  try {
    const ta = await jusqua('textarea omdys-ta', () => document.getElementById('omdys-ta'), 30000);
    const lire = () => [...document.querySelectorAll('#omdys-corr .item')].map(e => {
      const m = (e.textContent || '').match(/«\\s*(.+?)\\s*»\\s*→\\s*«\\s*(.+?)\\s*»/);
      return { word: m ? m[1] : '', sugg: m ? m[2] : '', vig: /tvig/.test(e.className) }; });
    /* ATTENDRE SANS HARCELER : re-déclencher « input » toutes les 150 ms relance le debounce du
       panneau à chaque tour et il ne rend JAMAIS (vécu : « venue » invisible alors que le moteur
       répondait). Une frappe, puis on observe ; on re-frappe toutes les 3 s au plus. */
    const attendreSugg = async (quoi, txt, sugg, ms) => { const t0 = Date.now(); let tf = 0;
      while (Date.now() - t0 < ms) { if (Date.now() - tf > 3000) { ta.value = txt; ta.dispatchEvent(new Event('input', { bubbles: true })); tf = Date.now(); }
        await attendre(200); if (lire().some(i => i.sugg === sugg)) return true; }
      throw new Error('délai : ' + quoi); };
    await attendreSugg('moteur extension prêt (fenetre→fenêtre)', 'la fenetre est ouverte', 'fenêtre', 90000);
    /* la table des PRÉNOMS (8 729 entrées) se charge en fire-and-forget à l'init : on attend
       qu'elle RÉPONDE (Marie est venu → venue), sinon le banc tape trop tôt et invente un écart. */
    await attendreSugg('table des prénoms (Marie est venu→venue)', 'Marie est venu.', 'venue', 60000);
    const out = [];
    for (const c of ${JSON.stringify(cas)}) { ta.value = c.txt; ta.dispatchEvent(new Event('input', { bubbles: true })); await attendre(800); out.push({ txt: c.txt, items: lire() }); }
    return { out };
  } catch (e) { return { fatal: e.message }; }
})()`;

async function main() {
  const chrome = trouverChrome();
  if (!chrome) { console.error('✗ aucun Chrome trouvé'); process.exit(1); }
  let srv = null, base = 'https://omegapendu.com';
  if (LOCAL) { const s = await servir(); srv = s.srv; base = 'http://127.0.0.1:' + s.port; }
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-verif-'));
  const extDir = path.join(RACINE, 'extension');
  const args = ['--remote-debugging-port=0', '--user-data-dir=' + profil, '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--load-extension=' + extDir, '--window-size=1280,960', 'about:blank'];   // VISIBLE : c'est le but
  const proc = spawn(chrome, args, { stdio: 'ignore' });
  let sess = null, sess2 = null, code = 0;
  const nettoyer = () => { try { sess && sess.fermer(); } catch (e) {} try { sess2 && sess2.fermer(); } catch (e) {} try { proc.kill(); } catch (e) {} try { srv && srv.close(); } catch (e) {} try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) {} };
  const GARDE_MS = 12 * 60 * 1000;   // garde-fou GLOBAL : au-delà, on dit où ça bloque et on sort (1) — jamais d'attente infinie
  const garde = setTimeout(() => { console.log('\n✗ DÉLAI GLOBAL (' + (GARDE_MS / 60000) + ' min) — le banc est resté bloqué ; processus nettoyés.'); nettoyer(); process.exit(1); }, GARDE_MS);
  if (garde.unref) garde.unref();

  // dictées réelles + attendu moteur (dump du banc), si présents en local
  let dictees = [], attenduDic = {};
  const gold = path.join(RACINE, 'data_local', 'dys_reel', 'dictees_gold.jsonl');
  const dump = path.join(RACINE, 'data_local', 'dys_reel', 'audit_corr_dump.json');
  if (fs.existsSync(gold) && fs.existsSync(dump)) {
    dictees = fs.readFileSync(gold, 'utf8').split('\n').filter(Boolean).map(JSON.parse).map(d => ({ src: d.src, raw: d.raw }));
    for (const t of JSON.parse(fs.readFileSync(dump, 'utf8')))
      { const parTok = {}; for (const f of t.corr.flags) if (f.tier === 'auto' && f.sugg && /^[A-Za-zÀ-ÿœŒ']+$/.test(f.sugg)) (parTok[f.i] = parTok[f.i] || []).push(f.sugg);
        attenduDic[t.src] = Object.values(parTok); }   // [[suggs du token i], …] : un token corrigé par l'une de ses suggestions suffit (speller c'étais vs grammaire c'était : la page applique le meilleur)
  }

  const echecs = [];
  try {
    const dbg = await lirePortDevTools(profil, 60000);
    console.log('Chrome : ' + chrome + '\nCDP    : ' + dbg + '\nsite   : ' + base + (LOCAL ? ' (build local)' : ' (PRODUCTION)') + '\n');

    /* ── 1. SITE ── */
    if (EXT_SEUL) throw new Error('__EXT_SEUL__');
    sess = await connecter(await cible(dbg, 'about:blank'));
    await sess.envoyer('Page.enable'); await sess.envoyer('Runtime.enable');
    await sess.envoyer('Page.navigate', { url: base + '/app/omega-pendu.html' });
    if (!await pagePrete(sess, '(document.readyState==="complete")&&location.pathname.indexOf("omega-pendu")>=0')) throw new Error('site non chargé');
    const r = await sess.envoyer('Runtime.evaluate', { expression: SCRIPT_SITE(CAS.map(c => ({ txt: c.txt })), dictees), awaitPromise: true, returnByValue: true, timeout: 300000 });
    if (r.exceptionDetails) throw new Error('site : ' + (r.exceptionDetails.exception || {}).description);
    const S = r.result.value || {}; if (S.fatal) throw new Error('site : ' + S.fatal);
    console.log('══ SITE ' + (LOCAL ? 'local' : 'PRODUCTION') + ' — correcteur ══');
    const siteSugg = {};
    S.out.forEach((got, k) => {
      const c = CAS[k], app = got.applique.map(s => s.toLowerCase()), ch = got.chips.toLowerCase();
      siteSugg[c.txt] = { app, chips: ch };
      const e0 = echecs.length;
      for (const a of (c.rouge || [])) if (!app.includes(a.toLowerCase())) echecs.push('SITE « ' + c.txt + ' » doit APPLIQUER « ' + a + ' » (' + c.pourquoi + '), eu ' + JSON.stringify(got.applique));
      for (const o of (c.orange || [])) if (ch.indexOf(o.toLowerCase()) < 0) echecs.push('SITE « ' + c.txt + ' » doit PROPOSER « ' + o + ' » (' + c.pourquoi + ')');
      for (const i of (c.interdit || [])) if (app.includes(i.toLowerCase()) || new RegExp('→\\s*' + i.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(ch)) echecs.push('SITE « ' + c.txt + ' » ne doit PAS suggérer « ' + i + ' » (' + c.pourquoi + ')');
      if (c.rien && app.length) echecs.push('SITE « ' + c.txt + ' » ne devrait RIEN appliquer (' + c.pourquoi + '), eu ' + JSON.stringify(got.applique));
      console.log('  ' + (echecs.length === e0 ? '✓' : '✗') + ' ' + c.txt.slice(0, 52).padEnd(54) + (got.applique.length ? '→ ' + got.applique.join(' · ') : '(rien appliqué)'));
    });
    if (S.dic && S.dic.length) {
      console.log('\n══ SITE — les 6 dictées dys RÉELLES : chaque rouge du BANC est-il appliqué dans la page ? ══');
      S.dic.forEach(d => {
        const app = d.applique.map(s => s.toLowerCase()), att = (attenduDic[d.src] || []);
        const manquants = att.filter(alts => !alts.some(a => app.includes(a.toLowerCase()))).map(alts => alts.join('/'));
        if (manquants.length) echecs.push('DICTÉE ' + d.src + ' : rouges du banc NON appliqués dans la page : ' + manquants.join(', '));
        console.log('  ' + (manquants.length ? '✗' : '✓') + ' ' + d.src.padEnd(22) + att.length + ' rouges attendus · ' + app.length + ' appliqués' + (manquants.length ? ' · MANQUE ' + manquants.join(', ') : ''));
      });
    } else console.log('\n(dictées réelles absentes de data_local — phase sautée)');

    /* ── 2. EXTENSION ── */
    /* DÉTECTION AVEC REPRISE : après la longue phase site, le side panel n'est pas toujours listable du premier
       coup (vu 2026-08-21 : « non chargée » sur le passage complet, vert en --ext-seul). 10 essais espacés d'1 s. */
    let om = null;
    for (let k = 0; k < 10 && !om; k++) { om = await trouverOmega(dbg); if (!om) await attendre(1000); }
    if (!om) throw new Error('extension OMEGA non chargée (Chrome ≥137 refuse --load-extension sur la version officielle ; essayer CHROME=msedge.exe)');
    const extId = om.id; sess2 = om.sess;
    const r2 = await sess2.envoyer('Runtime.evaluate', { expression: SCRIPT_EXT(CAS.map(c => ({ txt: c.txt }))), awaitPromise: true, returnByValue: true, timeout: 300000 });
    if (r2.exceptionDetails) throw new Error('extension : ' + (r2.exceptionDetails.exception || {}).description);
    const X = r2.result.value || {}; if (X.fatal) throw new Error('extension : ' + X.fatal);
    console.log('\n══ EXTENSION (chargée depuis le dépôt, id ' + extId.slice(0, 8) + '…) — side panel ══');
    X.out.forEach((got, k) => {
      const c = CAS[k]; const reds = got.items.filter(i => !i.vig).map(i => i.sugg.toLowerCase()), vigs = got.items.filter(i => i.vig).map(i => i.sugg.toLowerCase());
      const e0 = echecs.length;
      for (const a of (c.rouge || [])) if (!reds.includes(a.toLowerCase())) echecs.push('EXT « ' + c.txt + ' » doit corriger « ' + a + ' » (' + c.pourquoi + '), eu ' + JSON.stringify(reds));
      for (const o of (c.orange || [])) if (!vigs.includes(o.toLowerCase()) && !reds.includes(o.toLowerCase())) echecs.push('EXT « ' + c.txt + ' » doit proposer « ' + o + ' » (' + c.pourquoi + '), eu ' + JSON.stringify(vigs));
      for (const i of (c.interdit || [])) if (reds.includes(i.toLowerCase()) || vigs.includes(i.toLowerCase())) echecs.push('EXT « ' + c.txt + ' » ne doit PAS suggérer « ' + i + ' »');
      if (c.rien && reds.length) echecs.push('EXT « ' + c.txt + ' » ne devrait RIEN corriger (' + c.pourquoi + '), eu ' + JSON.stringify(reds));
      // PARITÉ site ≡ extension sur les rouges attendus
      const s = siteSugg[c.txt] || { app: [] };
      for (const a of (c.rouge || [])) if (s.app.includes(a.toLowerCase()) !== reds.includes(a.toLowerCase())) echecs.push('PARITÉ site≠ext sur « ' + a + ' » (' + c.txt + ')');
      console.log('  ' + (echecs.length === e0 ? '✓' : '✗') + ' ' + c.txt.slice(0, 52).padEnd(54) + (got.items.length ? '→ ' + got.items.map(i => i.sugg + (i.vig ? '?' : '')).join(' · ') : '(rien)'));
    });
  } catch (e) { if (e.message !== '__EXT_SEUL__') echecs.push(e.message); }
  if (EXT_SEUL) {
    try {
      const dbg = await lirePortDevTools(profil, 60000);
      const om = await trouverOmega(dbg);
      console.log('extension OMEGA : ' + (om ? 'TROUVÉE id ' + om.id : 'ABSENTE'));
      if (om) { sess2 = om.sess;
        const q = await sess2.envoyer('Runtime.evaluate', { expression: `(async () => { const DC = self.DYSCORE || window.DYSCORE; const keys = Object.keys(DC || {});
          const st = await fetch(chrome.runtime.getURL('assets/prenoms.tsv.gz')).then(r => r.status).catch(e => 'ERR ' + e.message);
          await new Promise(r => setTimeout(r, 4000));
          const c = DC.correctText ? JSON.stringify(DC.correctText('Marie est venu.')) : 'pas de correctText';
          const c2 = DC.correct ? JSON.stringify(DC.correct('Marie est venu.')) : 'pas de correct';
          return 'keys=' + keys.length + ' fetch prenoms=' + st + ' | correctText: ' + c + ' | correct: ' + c2; })()`, awaitPromise: true, returnByValue: true, timeout: 30000 });
        console.log('diag : ' + q.result.value); }
    } catch (e) { echecs.push('ext-seul : ' + e.message); }
  }

  console.log('');
  if (echecs.length) { console.error('✗ VÉRIFICATION NAVIGATEUR — ' + echecs.length + ' échec(s) :\n  ' + echecs.join('\n  ')); code = 1; }
  else console.log('✓ VÉRIFICATION NAVIGATEUR : ' + CAS.length + ' cas × (site ' + (LOCAL ? 'local' : 'PROD') + ' + extension) + ' + (dictees.length || 0) + ' dictées réelles — tout ce que le banc mesure, la page le fait.');
  await attendre(2500);   // laisser la fenêtre visible un instant
  nettoyer();
  process.exit(code);
}
main();
