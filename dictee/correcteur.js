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
const fs = require('fs'), path = require('path');
const APP_DEFAULT = path.join(__dirname, '..', 'app', 'omega-pendu.html');

function _extract(html) {
  const start = html.indexOf('(function(){', html.indexOf('mode PHRASES'));
  const spIdx = html.indexOf('function spellText', start);
  const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
  if (start < 0 || spIdx < 0 || cut < 0) throw new Error('correcteur.js : extraction du moteur échouée');
  const code = html.slice(start, cut) +
    ';globalThis.__corrEngine={correctText:correctText,spellText:spellText,loadSpellerLex:loadSpellerLex,ready:function(){return SP.ready;}};})();';
  const vdc = (html.match(/<script type="application\/json" id="vdc-lex">([\s\S]*?)<\/script>/) || [])[1] || '{}';
  const spl = (html.match(/<script type="text\/plain" id="speller-lex-gz">([^<]*)<\/script>/) || [])[1] || '';
  return { code, vdc, spl };
}

function _domShim(vdc, spl) {
  if (typeof document !== 'undefined' && document.getElementById) return; // navigateur réel : rien à bouchonner
  const stub = new Proxy(function () {}, { get(t, k) { if (k === 'style') return {}; if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains: () => false }; return stub; }, set: () => true, apply: () => stub });
  const set = (k, v) => { try { global[k] = v; } catch (e) {} };   // certains globals (navigator) sont en lecture seule en Node récent
  set('document', { getElementById: (id) => id === 'vdc-lex' ? { textContent: vdc } : id === 'speller-lex-gz' ? { textContent: spl } : stub, createElement: () => stub, body: stub, head: stub, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] });
  set('window', global); set('navigator', { userAgent: 'node' });
  set('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  set('speechSynthesis', { speak() {}, cancel() {}, getVoices: () => [] });
  set('SpeechSynthesisUtterance', function () { return stub; });
}

async function create(opts = {}) {
  const html = fs.readFileSync(opts.appHtml || APP_DEFAULT, 'utf8');
  const { code, vdc, spl } = _extract(html);
  _domShim(vdc, spl);
  (0, eval)(code);
  const E = globalThis.__corrEngine;
  if (!E) throw new Error('correcteur.js : moteur non exposé');
  await E.loadSpellerLex();                       // décompresse le lexique orthographique embarqué
  const api = {
    ready: () => E.ready(),
    grammar: (text) => E.correctText(text),       // règles grammaticales seules
    spell: (text) => E.spellText(text),           // orthographe (non-mots) seule
    // fusion : grammaire prioritaire par token, orthographe sur le reste (AUTO/FLAG)
    correct: (text) => {
      const gf = E.correctText(text), sf = E.ready() ? E.spellText(text) : [];
      const byTok = {}; gf.forEach(f => { byTok[f.i] = f; }); sf.forEach(f => { if (byTok[f.i] == null) byTok[f.i] = f; });
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
    if (c.correct('Le petit garçon mange une pomme rouge.').length) fail.push('FP sur phrase correcte');
    if (fail.length) { console.error('\n✗ ' + fail.join(' ; ')); process.exit(1); }
    console.log('\n✓ moteur standalone OK (sans UI/DOM) : grammaire + orthographe + hybride.');
  })().catch(e => { console.error(e); process.exit(1); });
}
