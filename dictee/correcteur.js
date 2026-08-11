// dictee/correcteur.js — MOTEUR de correction (grammaire + orthographe) SANS UI ni DOM.
//
// But : intégrer le correcteur ailleurs (Node, service, autre front) sans embarquer le jeu ni l'UI.
// Réutilise le moteur du monolithe `app/omega-pendu.html` comme SOURCE UNIQUE (pas de copie → pas de drift) :
// extrait la tranche moteur de l'IIFE (jusqu'à spellText), l'exécute avec un bouchon DOM minimal, et n'expose
// que l'API de correction. Aucune construction d'UI.
//
//   const { create } = require('./dictee/correcteur.js');
//   const c = await create();                      // charge moteur + lexiques embarqués
//   c.correct("une grosse fote dortografe");        // -> [{i,word,sugg,name,tier}, ...]
//   c.grammar(txt)  // règles seules   ·   c.spell(txt)  // orthographe seule
//
// (Pour un livrable 100 % indépendant du HTML, il suffit de figer la tranche extraite dans un fichier ; ici on la
//  lit à la volée pour rester synchrone avec l'app — la parité est garantie par construction.)
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const APP_DEFAULT = path.join(__dirname, '..', 'app', 'omega-pendu.html');

function _extract(html) {
  const start = html.indexOf('(function(){', html.indexOf('mode PHRASES'));
  const spIdx = html.indexOf('function spellText', start);
  const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
  if (start < 0 || spIdx < 0 || cut < 0) throw new Error('correcteur.js : extraction du moteur échouée');
  const code = html.slice(start, cut) +
    ';globalThis.__corrEngine={correctText:correctText,correctTokens:correctTokens,toks:toks,setSeg:function(s){_SEG=_segInfo(s);},spellText:spellText,loadSpellerLex:loadSpellerLex,' +
    'loadNounPost:loadNounPost,loadGenderLex:loadGenderLex,loadPosHmm:loadPosHmm,loadPrenoms:loadPrenoms,' +
    'equipe:function(){return !!(SP.ready&&NOUN_POST);},ready:function(){return SP.ready;}};})();';
  /* ⚠️ SERVIR **TOUS** LES BLOBS, pas seulement l'orthographe. Un id absent retombait sur le `stub`
     du bouchon DOM, dont `.textContent` est un Proxy : `loadNounPost` construisait alors une table
     VIDE mais NON NULLE — donc la garde « NOUN_POST est-il chargé ? » répondait oui sur du vide.
     ⭐ Un bouchon qui répond à TOUT ne peut pas signaler ce qui manque : il faut une liste EXPLICITE
     et une erreur sur ce qui n'y est pas. */
  const blob = (id) => { const m = html.match(new RegExp('id="' + id + '">([\\s\\S]*?)</script>')); return m ? m[1] : ''; };
  const B = {};
  for (const id of ['vdc-lex', 'speller-lex-gz', 'noun-post-gz', 'pos-hmm-gz', 'gdet-lex-gz', 'prenoms-gz', 'lex4-data-gz'])
    B[id] = blob(id);
  return { code, B, lex: B['lex4-data-gz'] };
}

function _domShim(B) {
  if (typeof document !== 'undefined' && document.getElementById) return; // navigateur réel : rien à bouchonner
  const stub = new Proxy(function () {}, { get(t, k) { if (k === 'style') return {}; if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains: () => false }; return stub; }, set: () => true, apply: () => stub });
  const set = (k, v) => { try { global[k] = v; } catch (e) {} };   // certains globals (navigator) sont en lecture seule en Node récent
  set('document', { getElementById: (id) => (B[id] !== undefined && B[id] !== '') ? { textContent: B[id] } : stub, createElement: () => stub, body: stub, head: stub, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] });
  set('window', global); set('navigator', { userAgent: 'node' });
  set('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  set('speechSynthesis', { speak() {}, cancel() {}, getVoices: () => [] });
  set('SpeechSynthesisUtterance', function () { return stub; });
}

async function create(opts = {}) {
  const html = fs.readFileSync(opts.appHtml || APP_DEFAULT, 'utf8'); try{globalThis.OMEGA_VDC=require('./blobgz').vdcSeed(html);}catch(e){}   // #30 : seed sync vdc-lex-gz (le moteur peuple les maps grammaire sans async)
  const { code, B, lex } = _extract(html);
  _domShim(B);
  if (lex) {                                        // RÉUTILISE le gros lexique du pendu : OMEGA_LEX4 (POS 155k) pour le guard genre — parité avec l'app
    try { globalThis.OMEGA_LEX4 = JSON.parse(zlib.gunzipSync(Buffer.from(lex.replace(/\s/g, ''), 'base64')).toString('utf8')); }
    catch (e) { /* POS indisponible → le guard POS se replie (abstention seulement via DET_SKIP/capitalisé) */ }
  }
  (0, eval)(code);
  const E = globalThis.__corrEngine;
  if (!E) throw new Error('correcteur.js : moteur non exposé');
  /* ⚠️ CHARGER TOUT LE MOTEUR, PAS SEULEMENT L'ORTHOGRAPHE (corrigé le 2026-08-11).
     Ce fichier n'appelait que loadSpellerLex(), donc l'intégrateur recevait un correcteur dont la
     grammaire de NOMBRE et de GENRE était MUETTE : `rule_noun_plural` et `rule_det_gender` sortent
     tout de suite sur `if(!NOUN_POST)`, et les règles qui interrogent le POS-tagger se repliaient.
     Mesuré AVANT le correctif — et vérifié dans le vrai navigateur, où le site les corrige bien :
        « les chien aboient »        -> []   (site : chien->chiens, ROUGE)
        « des oiseau dans le ciel »  -> []   (site : oiseau->oiseaux, ROUGE)
     ⭐ Le piège n'était pas seulement produit : mes propres sondes de mesure copiaient CE loader,
     et concluaient « le moteur est muet » sur des règles simplement pas chargées. Un moteur
     partiellement équipé ne se signale pas — d'où la garde `equipe()` et le contrôle ci-dessous. */
  await E.loadSpellerLex();                       // orthographe (non-mots, accents)
  await E.loadNounPost();                         // posterior NOM/VERBE : accord pluriel/singulier du nom, genre du déterminant
  await E.loadGenderLex();                        // genre relâché (âme/amé, affaire/affairé)
  await E.loadPosHmm();                           // POS-tagger HMM : son/sont sujet-nom, whose+gérondif…
  try { await E.loadPrenoms(); } catch (e) { /* table optionnelle : accord « Marie est venu »→venue */ }
  const api = {
    ready: () => E.ready(),
    equipe: () => E.equipe(),                     // moteur COMPLET (ortho + posterior nom/verbe) — voir la garde du bloc de chargement
    grammar: (text) => E.correctText(text),       // règles grammaticales seules
    spell: (text) => E.spellText(text),           // orthographe (non-mots) seule
    /* fusion : grammaire prioritaire par token, orthographe sur le reste (AUTO/FLAG).
       ⚠️ LA PYRAMIDE MANQUAIT ICI AUSSI (corrigé le 2026-08-11). Cette API lançait `correctText`
       sur le texte BRUT ; le site, lui, applique d'abord l'ORTHOGRAPHE aux tokens puis fait tourner
       la grammaire sur les tokens NETTOYÉS, en cascade jusqu'au point fixe. Sans ça la grammaire
       s'applique au mot MAL ORTHOGRAPHIÉ et rend une faute :
          « contre les vènt » → « vènts »  au lieu de « vents »
          « La tigés »        → « tigé »   au lieu de « tige »
       Trois consommateurs, trois pipelines : seul `_computeCorrs` du site avait la pyramide.
       ⭐ La parité 3 moteurs ne pouvait pas le voir : elle compare le REGISTRE de règles, pas le
       PIPELINE. Mêmes règles ≠ mêmes corrections. */
    correct: (text) => {
      const sf = E.ready() ? E.spellText(text) : [];
      E.setSeg(text);
      const T = E.toks(text), Tc = T.slice();
      sf.forEach(f => { if (f.span !== 2 && f.tier !== 'vigilance' && f.sugg && /^[A-Za-zÀ-ÿ']+$/.test(f.sugg)) Tc[f.i] = f.sugg; });
      const cur = Tc.slice(), gbt = {};
      for (let it = 0; it < 4; it++) {                       // cascade : la grammaire re-tourne sur ses propres corrections
        const g2 = E.correctTokens(cur); let add = false;
        for (const g of g2) { if (gbt[g.i] != null) continue; gbt[g.i] = g; add = true;
          if ((g.span == null || g.span < 2) && g.tier !== 'vigilance' && g.sugg && /^[A-Za-zÀ-ÿ']+$/.test(g.sugg)) cur[g.i] = g.sugg; }
        if (!add) break;
      }
      const byTok = {};
      Object.keys(gbt).forEach(k => { const f = gbt[k]; f.word = T[f.i]; byTok[f.i] = f; });   // le mot affiché reste celui de l'utilisateur
      sf.forEach(f => { if (byTok[f.i] == null) byTok[f.i] = f; });
      return Object.keys(byTok).map(k => byTok[k]).sort((a, b) => a.i - b.i);
    },
  };
  return api;
}

module.exports = { create };

// auto-test : node dictee/correcteur.js
if (require.main === module) {
  (async () => {
    const c = await create();
    console.log('moteur prêt (orthographe ' + (c.ready() ? 'chargée' : 'absente') + ')\n');
    const tests = [
      'une grosse fote dortografe',           // orthographe + hybride genre
      'Les enfant joue et il sont content',   // grammaire (accord)
      'la fenetre est ouverte',               // accent AUTO
      'Le petit garçon mange une pomme rouge.' // correct → rien
    ];
    for (const t of tests) {
      const f = c.correct(t);
      console.log('» ' + t);
      f.forEach(x => console.log('    [' + (x.tier || x.name) + '] ' + x.word + ' → ' + x.sugg + (x.name ? '  (' + x.name + ')' : '')));
      if (!f.length) console.log('    (rien)');
    }
    // assertions
    const fail = [];
    const f1 = c.correct('une grosse fote');
    if (!f1.find(x => x.word.toLowerCase() === 'fote' && x.sugg === 'faute')) fail.push('fote→faute attendu');
    // ⚠️ GARDE D'ÉQUIPEMENT — un moteur à moitié chargé ne se signale pas : il se tait, et un
    // intégrateur croit que la règle n'existe pas. Ces deux cas ne passent QUE si NOUN_POST est là.
    if (!c.equipe()) fail.push('moteur incomplet : NOUN_POST non chargé (grammaire du nombre MUETTE)');
    for (const [ph, mot, att] of [['les chien aboient', 'chien', 'chiens'],
                                  ['des oiseau dans le ciel', 'oiseau', 'oiseaux'],
                                  ['la boites est ouverte', 'boites', 'boite']]) {
      const g = c.correct(ph).find(x => x.word.toLowerCase() === mot);
      if (!g || g.sugg.toLowerCase() !== att) fail.push('accord du nom : ' + mot + '→' + att + ' attendu, eu ' + JSON.stringify(g));
    }
    if (c.correct('Le petit garçon mange une pomme rouge.').length) fail.push('FP sur phrase correcte');
    if (c.correct('Il préfère le café au thé le matin.').length) fail.push('FP « thé »→« ther » (-é/-er sans verbe)');
    if (fail.length) { console.error('\n✗ ' + fail.join(' ; ')); process.exit(1); }
    console.log('\n✓ moteur standalone OK (sans UI/DOM) : grammaire + orthographe + hybride.');
  })().catch(e => { console.error(e); process.exit(1); });
}
