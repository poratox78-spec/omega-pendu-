'use strict';
// GARDE — l'exercice ✍️ CONJUGUE de la dictée affiche le temps et la personne DE LA PHRASE (18/10/2026).
//
// Le défaut qu'elle ferme : l'étiquette lisait la première lecture de CONJ_F, dont la clé est SANS accent. Un participe
// en -é passait pour le présent du même verbe (« présent, avec je ») et un verbe en -e après « il » ou « elle » s'affichait
// « avec je » : 71 étiquettes de personne fausses sur les 279 trous possibles des 333 phrases, en place depuis août ; et
// le subjonctif imparfait, entré avec la table complète (12/10), s'affichait par sa clé brute.
//
// Ce qu'elle rejoue : le bloc « choix du trou » de app/omega-pendu.html, EXTRAIT TEL QUEL (entre ses marqueurs) et exécuté
// sur les tables de l'app (bloc vdc-lex, reconstruit par les fonctions de l'app), sur les 333 phrases et sur des phrases
// témoins inventées.
//   ① chaque trou : la forme conjuguée de la lecture choisie, accents compris, EST le mot écrit ;
//   ② après un pronom sujet (clitiques sautés), la personne affichée est la sienne ;
//   ③ aucune clé brute dans l'étiquette ;
//   ④ témoins : participe pas en trou, « il achète » → il, temps ambigu dit en entier, subjonctif après « que », nom après
//     un déterminant, forme de deux verbes à deux temps (« étaient ») pas en trou… ;
//   ⑤ l'exercice reste nourri : au moins 200 trous possibles sur les 333 phrases ;
//   ⑥ auto-falsification : l'ANCIENNE règle (première lecture) rejouée sur les mêmes phrases doit échouer à ① ou ②.
//     node dictee/conjugue_probe.js
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const APP = path.join(__dirname, '..', 'app', 'omega-pendu.html');
const s = fs.readFileSync(APP, 'utf8');
const KO = [];
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) KO.push(m); };

// ── tables de l'app ──────────────────────────────────────────────────────────────────────────────────────────────
const fn = (nom) => { const k = s.indexOf('function ' + nom + '('); if (k < 0) throw new Error('fonction absente : ' + nom);
  let d = 0; for (let q = s.indexOf('{', k); q < s.length; q++) { if (s[q] === '{') d++; else if (s[q] === '}' && !--d) return s.slice(k, q + 1); } };
const bloc = (id) => { const i = s.indexOf('id="' + id + '"'), a = s.indexOf('>', i) + 1, b = s.indexOf('</script>', a);
  return JSON.parse(zlib.gunzipSync(Buffer.from(s.slice(a, b).trim(), 'base64')).toString('utf8')); };
const VDC = bloc('vdc-lex-gz'), HMM = bloc('pos-hmm-gz');   // conjugaisons + étiqueteur : le mode attend les deux
const fix = s.match(/var _CONJ_FIX=(\{[^}]*\})/), elid = s.match(/var _ELID_DET=(\/[^\n]*?\/i)/);
const ctx = { Object, Array, String, Promise, setTimeout, JSON, Math, Set };
vm.createContext(ctx);
vm.runInContext([fn('deacc'), 'var _CONJ_FIX=' + (fix ? fix[1] : '{}') + ';', fn('_cjPas'), fn('_cjFin'), fn('_cjRebuild'), fn('_fillReg3pl'), fn('svReads'),
  fn('_tokPos'), fn('posTags'), 'var _tgCache=null;var _ELID_DET=' + elid[1] + ';var _HMM=' + JSON.stringify(HMM) + ';'].join('\n'), ctx);
vm.runInContext(`var _cj=_cjRebuild(${JSON.stringify(VDC.cj)});var CONJ_F=_cj.f,CONJ_C=_cj.c;_fillReg3pl(CONJ_C,CONJ_F);
  var GENDER_MAP=${JSON.stringify(VDC.g || {})},GENDER_PURE=${JSON.stringify(VDC.gn || {})},ADJP=${JSON.stringify(VDC.a || {})},NOUN_PLURAL={};
  (${JSON.stringify(VDC.gp || [])}).forEach(function(w){NOUN_PLURAL[w]=1;});`, ctx);

// ── le bloc « choix du trou », tel quel ─────────────────────────────────────────────────────────────────────────
const D1 = '/* ── CONJUGUE : choix du trou', D2 = '/* ── fin du choix du trou ── */';
const k1 = s.indexOf(D1), k2 = s.indexOf(D2);
if (k1 < 0 || k2 < k1) { console.error('[conjugue_probe] ÉCHEC : bloc « choix du trou » introuvable dans l\'app'); process.exit(1); }
vm.runInContext(s.slice(k1, k2) + '\nglobalThis.__cands=_cCands;globalThis.__CTEMPS=CTEMPS;globalThis.__CPERS=CPERS;globalThis.__CSUJ=_CSUJ;globalThis.__CCLIT=_CCLIT;', ctx);
const cands = ctx.__cands, CT = ctx.__CTEMPS, CP = ctx.__CPERS;
// l'ANCIENNE règle (avant le 18/10), pour ⑥
const anciens = (txt) => { const re = /[A-Za-zÀ-ÿœŒ]+/g; let m; const out = [];
  while ((m = re.exec(txt))) { const w = m[0], lw = w.toLowerCase(), d = ctx.deacc(lw);
    if (w !== lw || w.length < 3) continue; const rd = ctx.svReads(lw); if (!rd.length) continue;
    if (ctx.GENDER_MAP[d] || ctx.GENDER_PURE[d] || ctx.ADJP[d] || ctx.NOUN_PLURAL[d]) continue;
    out.push({ a: m.index, w, rd: rd[0], quoi: CT[rd[0][1]] || rd[0][1], qui: CP[rd[0][2] + rd[0][3]] || '' }); }
  return out; };

// ── juges ①②③ ──────────────────────────────────────────────────────────────────────────────────────────────────
const formes = (r) => { const sl = ((ctx.CONJ_C[r[0]] || {})[r[1]] || {})[r[2] + r[3]]; return sl == null ? [] : (Array.isArray(sl) ? sl : [sl]); };
function sujet(txt, a) {                                       // pronom sujet en tête de la chaîne de clitiques juste avant
  const av = txt.slice(0, a).toLowerCase().replace(/[’ʼ]/g, "'").match(/[a-zà-ÿœæ]+'?/g) || [];
  let j = av.length - 1, suj = null;
  while (j >= 0 && (ctx.__CCLIT[av[j]] || ctx.__CSUJ[av[j]])) { if (ctx.__CSUJ[av[j]]) suj = av[j]; j--; }
  return suj ? ctx.__CSUJ[suj] : null;
}
function juger(phrases, choix) {
  let n = 0, formeFausse = 0, persFausse = 0, brute = 0; const ex = [];
  for (const t of phrases) for (const c of choix(t)) {
    n++;
    if (!formes(c.rd).some((f) => String(f).toLowerCase() === c.w)) { formeFausse++; if (ex.length < 3) ex.push(c.w + ' lu ' + c.rd.join(';')); }
    const p = sujet(t, c.a);
    if (p && c.qui !== CP[p]) { persFausse++; if (ex.length < 3) ex.push(c.w + ' : « avec ' + c.qui + ' » au lieu de ' + CP[p]); }
    if (/[a-z]{3}:[a-z]{3}/.test(c.quoi)) brute++;
  }
  return { n, formeFausse, persFausse, brute, ex };
}

const L = s.split('\n'); const kS = L.findIndex((l) => /^\s*var SENT = \[/.test(l)); let kE = kS + 1; while (!/^\];/.test(L[kE])) kE++;
const SENT = JSON.parse('[' + L.slice(kS + 1, kE).join('\n') + ']').map((x) => x.text);
console.log('[conjugue_probe] ' + SENT.length + ' phrases de la dictée, tables de l\'app (' + Object.keys(ctx.CONJ_C).length + ' verbes)');
const J = juger(SENT, cands);
ok(J.formeFausse === 0, `① forme : ${J.formeFausse} trou(s) dont la lecture n'est pas le mot écrit ${J.ex.join(' · ')}`);
ok(J.persFausse === 0, `② personne : ${J.persFausse} étiquette(s) contraire(s) au pronom sujet`);
ok(J.brute === 0, `③ aucune clé brute (${J.brute})`);
ok(J.n >= 200, `⑤ l'exercice reste nourri : ${J.n} trous possibles (≥ 200)`);

// ── ④ témoins inventés ──────────────────────────────────────────────────────────────────────────────────────────
const T = [
  ['Il a mangé une pomme verte.', 'mangé', null],
  ['Il achète du pain chaud.', 'achète', ['présent', 'il·elle·on']],
  ['Il fallait que nous restions.', 'restions', ['imparfait ou subjonctif présent', 'nous']],
  ['Il faut que tu chantes fort.', 'chantes', ['présent ou subjonctif présent', 'tu']],
  ['Je ne le mange jamais.', 'mange', ['présent', 'je']],
  ['Les voisins nous regardent.', 'regardent', null],
  ['Elle se réveille tard.', 'réveille', ['présent', 'il·elle·on']],
  ['Ils observèrent une éclipse.', 'éclipse', null],
  ['Ils étaient contents.', 'étaient', null],
  ['Nous chantons ensemble.', 'chantons', ['présent', 'nous']],
  ['Ils partirent tôt.', 'partirent', ['passé simple', 'ils·elles']],
  ["Il fallait qu'il chantât.", 'chantât', ['subjonctif imparfait', 'il·elle·on']],
];
for (const [t, w, att] of T) {
  const c = cands(t).find((x) => x.w === w);
  if (!att) ok(!c, `④ « ${t} » : « ${w} » n'est pas mis en trou${c ? ' (affiché « ' + c.quoi + ', avec ' + c.qui + ' »)' : ''}`);
  else ok(c && c.quoi === att[0] && c.qui === att[1], `④ « ${t} » : « ${w} » → « ${att[0]}, avec ${att[1]} »${c ? '' : ' (pas de trou)'}${c && (c.quoi !== att[0] || c.qui !== att[1]) ? ' — affiché « ' + c.quoi + ', avec ' + c.qui + ' »' : ''}`);
}

// ── ⑥ auto-falsification ────────────────────────────────────────────────────────────────────────────────────────
const A = juger(SENT.concat(T.map((x) => x[0])), anciens);
ok(A.formeFausse > 0 && A.persFausse > 0, `⑥ l'ancienne règle échoue bien : ${A.formeFausse} forme(s) fausse(s), ${A.persFausse} personne(s) fausse(s) sur ${A.n} trous`);

if (KO.length) { console.error('[conjugue_probe] ÉCHEC : ' + KO.length + ' contrôle(s)'); process.exit(1); }
console.log('[conjugue_probe] OK — ' + J.n + ' trous possibles, étiquettes conformes à la phrase');
