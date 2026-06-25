// omega-key/test_crypto.js — filet de tests CRYPTO (headless).
// Charge le JS de app/omega-key.html avec un stub DOM minimal + la WebCrypto de Node,
// et vérifie les PROPRIÉTÉS qui fondent la sécurité : entropie des passphrases (exacte,
// sans biais), intégrité des listes (gel du hash), round-trip AES-GCM réel.
// Usage : node omega-key/test_crypto.js
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const crypto = require('crypto');
const APP = path.join(__dirname, 'app', 'omega-key.html');

function load() {
  const html = fs.readFileSync(APP, 'utf8');
  const parts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  let js = '';
  for (const m of parts) {
    if (/\bsrc=/.test(m[1])) continue;
    const tm = m[1].match(/\btype\s*=\s*["']([^"']*)["']/i);
    const type = tm ? tm[1].toLowerCase().trim() : '';
    if (!(type === '' || type === 'text/javascript' || type === 'application/javascript' || type === 'module')) continue;
    js += '\n;\n' + m[2];
  }
  const els = {};
  const stub = new Proxy(function () {}, { get: (t, p) => { if (p === 'getContext') return () => stub; if (p === 'classList') return { add() {}, remove() {}, toggle() {}, contains: () => false }; if (p === 'style') return {}; return stub; }, set: () => true, apply: () => stub, construct: () => stub });
  const noop = () => stub;
  // Élément DOM tolérant : vraies props stockées (value/textContent/checked…), méthode/attribut inconnu → no-op.
  const mkEl = () => new Proxy({ value: '', textContent: '', innerHTML: '', checked: false, className: '', id: '', dataset: {}, style: {}, children: [] }, {
    get: (t, p) => {
      if (typeof p === 'string' && p in t) return t[p];
      if (p === 'classList') return { add() {}, remove() {}, toggle() {}, contains: () => false };
      if (p === 'getContext') return () => stub;
      if (p === 'parentNode' || p === 'firstChild' || p === 'nextSibling') return null;
      return noop;
    }, set: (t, p, v) => { t[p] = v; return true; }
  });
  global.document = { getElementById: (id) => (els[id] || (els[id] = mkEl())), querySelector: () => null, querySelectorAll: () => [], createElement: () => mkEl(), createElementNS: () => mkEl(), addEventListener() {}, head: stub, body: stub, documentElement: stub, getElementsByTagName: () => [] };
  global.window = global; try { global.navigator = { userAgent: 'node' }; } catch (e) {}
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  global.setTimeout = () => 0; global.setInterval = () => 0; global.clearTimeout = () => {}; global.clearInterval = () => {};
  global.requestAnimationFrame = () => 0; global.cancelAnimationFrame = () => {};
  global.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
  global.getComputedStyle = () => ({ getPropertyValue: () => '' });
  global.AudioContext = function () { return stub; }; global.webkitAudioContext = global.AudioContext;
  global.addEventListener = () => {}; global.removeEventListener = () => {}; global.alert = () => {};
  if (!global.crypto) global.crypto = crypto.webcrypto;
  global.__els = els;
  const exp = `;globalThis.__OK={
    WORDLIST_FR:(typeof WORDLIST_FR!=='undefined')?WORDLIST_FR:null,
    SYLL_FR:(typeof SYLL_FR!=='undefined')?SYLL_FR:null,
    SYLL_SAFE:(typeof SYLL_SAFE!=='undefined')?SYLL_SAFE:null,
    genPassphrase:(typeof genPassphrase!=='undefined')?genPassphrase:null,
    genPseudoPassphrase:(typeof genPseudoPassphrase!=='undefined')?genPseudoPassphrase:null,
    deriveCryptoKeys:(typeof deriveCryptoKeys!=='undefined')?deriveCryptoKeys:null,
    getAes:()=>(typeof _aesKey!=='undefined')?_aesKey:null,
    evalIn:(c)=>eval(c)
  };`;
  eval(js + exp);
  return globalThis.__OK;
}

function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }
function isPow2(n) { return n > 0 && (n & (n - 1)) === 0; }

// Hash GELÉS (figés à v0.17) — toute modification de liste DOIT être intentionnelle (ce test casse sinon).
const FROZEN = {
  WORDLIST_FR: '440cf3737964625e9d28c1b5ecd9117dbf0098cb707ebca624bc590d219a7ae1',
  SYLL_FR: '9177fde9ce0596191621a66c26dfff7d5713d91011b83b8f2013512264ae4936',
  SYLL_SAFE: 'c9d6c1dde2a0330e4a709d04a8f8555d88c290f4908ec874e3bfaee185038243',
};

(async () => {
  const O = load();
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } };

  console.log('=== ENTROPIE DES LISTES (fondation du claim "sans biais") ===');
  for (const [name, n] of [['WORDLIST_FR', 4096], ['SYLL_FR', 256], ['SYLL_SAFE', 128]]) {
    const arr = O[name];
    ok(`${name} chargée`, Array.isArray(arr));
    ok(`${name} = ${n} mots`, arr.length === n);
    ok(`${name} = puissance de 2 (bits exacts)`, isPow2(arr.length));
    ok(`${name} sans doublon`, new Set(arr).size === arr.length);
    ok(`${name} préfixes-4 uniques`, new Set(arr.map(w => w.slice(0, 4))).size === arr.length);
  }

  console.log('=== GEL DU HASH (toute modif de liste doit être intentionnelle) ===');
  const freeze = process.argv.includes('--freeze');
  for (const name of ['WORDLIST_FR', 'SYLL_FR', 'SYLL_SAFE']) {
    const h = sha256(O[name].join(' '));
    if (freeze) { console.log(`  ${name}: "${h}"`); }
    else if (FROZEN[name]) ok(`${name} hash inchangé`, h === FROZEN[name]);
    else console.log(`  (${name} non gelé — lancer --freeze puis coller le hash dans FROZEN)`);
  }

  console.log('=== GÉNÉRATEUR DE PASSPHRASE (entropie comptable) ===');
  const g = O.genPassphrase(6);
  ok('genPassphrase(6) → 6 mots', g.words.length === 6);
  ok('genPassphrase bits = 6 × 12 = 72', g.bits === 72);
  ok('tous les mots ∈ WORDLIST_FR', g.words.every(w => O.WORDLIST_FR.includes(w)));
  const g2 = O.genPassphrase(6);
  ok('deux tirages diffèrent (aléa réel)', g.words.join(' ') !== g2.words.join(' '));

  console.log('=== ROUND-TRIP AES-256-GCM (vraie dérivation deriveCryptoKeys) ===');
  await O.deriveCryptoKeys('passphrase-de-test-omega-key');
  const aes = O.getAes();
  ok('clé AES dérivée', !!aes);
  if (aes) {
    const iv = crypto.webcrypto.getRandomValues(new Uint8Array(12));
    const msg = 'message secret éàç ⚡ 42';
    const ct = await crypto.webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(msg));
    const pt = new TextDecoder().decode(await crypto.webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, aes, ct));
    ok('chiffre puis déchiffre = identité', pt === msg);
    // mauvais IV → échec d'auth (tag GCM)
    let auth = false; try { await crypto.webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: crypto.webcrypto.getRandomValues(new Uint8Array(12)) }, aes, ct); } catch (e) { auth = true; }
    ok('IV/altération → rejet (intégrité GCM)', auth);
    // déterminisme : même passphrase → même clé
    await O.deriveCryptoKeys('passphrase-de-test-omega-key');
    const aes2raw = new Uint8Array(await crypto.webcrypto.subtle.exportKey('raw', O.getAes()).catch(() => new ArrayBuffer(0)));
    // (clé non-extractible → on re-chiffre le même IV/msg et compare le ciphertext)
    const ct2 = await crypto.webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, O.getAes(), new TextEncoder().encode(msg));
    ok('même passphrase → même clé (déterministe)', Buffer.from(ct).equals(Buffer.from(ct2)));
  }

  console.log('=== DOUBLE RATCHET — session 2 parties (KAT) ===');
  try {
    const dr = O.evalIn(`(typeof _drEnc!=='undefined') ? ({genDH:_drGenDH, pub:_drPub, initAlice:_drInitAlice, initBob:_drInitBob, enc:_drEnc, dec:_drDec, b2h:_b2h}) : null`);
    if (!dr) { console.log('  (fonctions DR non exposées — KAT sauté)'); }
    else {
      await O.deriveCryptoKeys('passphrase-partagee-DR');
      const SK = O.evalIn('_keyMaterial.aes');
      const aAnchor = await dr.genDH(), bAnchor = await dr.genDH();
      const aPub = await dr.pub(aAnchor), bPub = await dr.pub(bAnchor);
      let alice, bob;   // Alice = initiatrice (a une chaîne d'envoi) ; Bob = répondeur (CKs null tant qu'il n'a pas reçu)
      if (dr.b2h(aPub) < dr.b2h(bPub)) { bob = await dr.initBob(SK, aAnchor); alice = await dr.initAlice(SK, aPub); }
      else { alice = await dr.initAlice(SK, bPub); bob = await dr.initBob(SK, bAnchor); }
      ok('session établie (Alice initiatrice / Bob répondeur)', !!alice && !!bob);
      const m1 = 'salut bob 🔐'; const c1 = await dr.enc(alice, m1);
      ok('Alice→Bob : chiffre/déchiffre', (await dr.dec(bob, c1)) === m1);
      const m2 = 'reçu, je réponds'; const c2 = await dr.enc(bob, m2);
      ok('Bob→Alice : bidirectionnel (ratchet DH)', (await dr.dec(alice, c2)) === m2);
      const a1 = await dr.enc(alice, 'A'), a2 = await dr.enc(alice, 'B'), a3 = await dr.enc(alice, 'C');
      const dC = await dr.dec(bob, a3), dA = await dr.dec(bob, a1), dB = await dr.dec(bob, a2);   // reçus C, A, B (hors-ordre)
      ok('messages hors-ordre / sautés (clés stockées)', dC === 'C' && dA === 'A' && dB === 'B');
      const x1 = await dr.enc(alice, 'meme'), x2 = await dr.enc(alice, 'meme');
      ok('clé éphémère par message (2 chiffrés du même clair diffèrent)', x1 !== x2);
    }
  } catch (e) { ok('DR KAT sans erreur', false); console.log('     ' + e.message); }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERREUR HARNAIS:', e); process.exit(2); });
