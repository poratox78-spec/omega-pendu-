// Fabrique l'entraînement à partir du corpus PUBLIC (UD + exemples du Wiktionnaire, data_local/b2_train.txt ; phrases du quotidien de Tatoeba, data_local/tatoeba/phrases.txt) : chaque phrase correcte reçoit
// des fautes tirées au sort. Le corpus privé n'entre jamais ici.
//   node dictee/juge_gen.js <racine> <sortie.jsonl> <memo.json> [nb_phrases] [versions]   (MEMO_ANCIEN=<memo.json> : relit les candidats déjà calculés ; GRAINE ; VR : fautes de verbes plus fréquentes ; VF : part de ces fautes tirée dans les formes du même verbe)
// Liste n° 479 (09/11/2026, voulu par Rem) : des fautes plus proches de celles des dys. Sans ces variables, rien ne change.
//   SOURCES=b2_train.txt,tatoeba/phrases.txt,G:/omega-grand/wiki/phrases.txt : fichiers de phrases justes (relatifs à data_local, ou absolus).
//   CIBLE='a / à:5.5;petits mots:7.1;…' : part visée de chaque famille de faute (FAMILLES ci-dessous). Les parts viennent des COMPTES des vrais textes dys
//     (aucune phrase n'en sort ; voulu par Rem). Un essai sur les premières phrases mesure la part que donne le tirage ; ensuite une faute tirée est gardée
//     avec la chance cible / mesurée, et le tirage est relevé d'autant : la densité moyenne ne change pas.
//   TAUX=0.03,0.08,0.15,0.25 : densités de fautes d'une phrase, tirées au sort.
//   WICO=<wicopaco_realword_sents.jsonl> : vraies fautes en contexte (corrections de Wikipédia, CC BY-SA) ; une ligne sur 10 reste à l'écart pour le contrôle.
//   REPRISE=<sortie.jsonl> : phrases déjà écrites ; relit leurs formes et refait seulement les candidats (rien n'est réécrit).
'use strict';
const fs = require('fs'), readline = require('readline');
const [R, OUT, MEMO, NB, VERS] = process.argv.slice(2);
const L = require('./juge_lex.js')(R);
const { F, low, dec, cands, fins, traits, GRP } = L;
let graine = +(process.env.GRAINE || 20261102); const rnd = () => { graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0; return graine / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const TOK = /[A-Za-zÀ-ÿœŒ'’ʼ]+|\d+|[^\sA-Za-zÀ-ÿœŒ'’ʼ\d]/g;
const REC = [[/ph/, 'f'], [/qu/, 'k'], [/eau/, 'o'], [/au/, 'o'], [/ai/, 'é'], [/ei/, 'é'], [/ss/, 's'], [/mm/, 'm'], [/nn/, 'n'], [/tt/, 't'], [/ll/, 'l'], [/pp/, 'p'], [/rr/, 'r'], [/ff/, 'f'], [/ç/, 's'], [/c(?=[ao])/, 'k'], [/g(?=[ei])/, 'j'], [/en/, 'an'], [/an/, 'en'], [/in/, 'ain'], [/ain/, 'in'], [/h/, ''], [/y/, 'i'], [/er$/, 'é'], [/é$/, 'er'], [/ée$/, 'é'], [/és$/, 'é'], [/ez$/, 'é'], [/ait$/, 'é'], [/ais$/, 'é'], [/aient$/, 'ait'], [/ent$/, 'e'], [/es$/, 'e'], [/s$/, ''], [/x$/, ''], [/t$/, ''], [/d$/, ''], [/e$/, ''], [/p$/, '']];
function nonMot(t) {
  for (let essai = 0; essai < 5; essai++) {
    const k = rnd(); let w = t;
    if (k < 0.5) { const [re, s] = pick(REC); w = t.replace(re, s); }
    else if (k < 0.65) { w = dec(t); }
    else if (t.length > 3) { const i = 1 + Math.floor(rnd() * (t.length - 2)), o = rnd(); w = o < 0.4 ? t.slice(0, i) + t.slice(i + 1) : o < 0.7 ? t.slice(0, i) + t[i + 1] + t[i] + t.slice(i + 2) : t.slice(0, i) + t[i] + t.slice(i); }
    if (w !== t && w.length >= 2) return w;
  }
  return t;
}
const nue = (w) => w.split("'").pop();
const racine = (a, b) => { const x = dec(nue(a)), y = dec(nue(b)); let k = 0; while (k < x.length && k < y.length && x[k] === y[k]) k++; return k >= Math.max(3, Math.min(x.length, y.length) - 3); };
const VR = +(process.env.VR || 2.5), VF = +(process.env.VF || 0.85), estV = (w) => (L.D._spLire.P(nue(w)) || '').indexOf('V') >= 0; let nV = 0, nA = 0;
const memoC = new Map(), parentC = (w) => { let v = memoC.get(w); if (!v) { v = cands(w); memoC.set(w, v); } return v; };
function faute(t) {
  const g = GRP.get(t), k = rnd();
  if (g && k < 0.8) { const a = g.filter((x) => x !== t); if (a.length) return pick(a); }
  const c = parentC(t), k2 = rnd();
  if (estV(t) && rnd() < VF) { const a = c.filter((x) => racine(t, x) && estV(x) && (() => { const f = traits(t, x); return f[0] || f[1]; })()); if (a.length) { nV++; return pick(a); } }
  nA++;
  if (k2 < 0.55) { const a = c.filter((x) => racine(t, x)); if (a.length) return pick(a); }
  if (k2 < 0.75) { const a = c.filter((x) => { const f = traits(t, x); return f[0] || f[1]; }); if (a.length) return pick(a); }
  return nonMot(t);
}
// liste n° 479 : familles de fautes (les mêmes que le bilan par famille du grand banc)
const dec0 = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const PETITS = [['a', 'à'], ['et', 'est'], ['on', 'ont'], ['son', 'sont'], ['ce', 'se'], ['ces', 'ses', "c'est", "s'est"], ['la', 'là', "l'a"], ['ou', 'où'], ['mais', 'mes', 'mets'], ['sa', 'ça'], ['peu', 'peut', 'peux'], ['ma', "m'a"], ['ta', "t'a"], ['leur', 'leurs'], ['quel', 'quelle', "qu'elle", 'quelles', 'quels'], ['ni', "n'y"], ['si', "s'y"], ['dans', "d'en"], ['sans', "s'en", 'cent', 'sang'], ['du', 'dû'], ['tous', 'tout', 'toute', 'toutes'], ['quand', 'quant', "qu'en"]];
const VFIN = new Set(['er', 'é', 'ée', 'és', 'ées', 'ez', 'ai', 'ais', 'ait', 'aient', 'e', 'es', 'ent', 'is', 'it', 'ir', 'ie', 'ies', 'u', 'ue', 'us', 'ues', 'ont', 'ons']);
const FAMILLES = ['a / à', 'petits mots', 'accent seul', 'accord (s, e, x)', 'fin de verbe', 'lettres / autre mot'];
function famille(w, c) {
  if ((w === 'a' || w === 'à') && (c === 'a' || c === 'à')) return 'a / à';
  if (PETITS.some((g) => g.includes(w) && g.includes(c))) return 'petits mots';
  if (dec0(w) === dec0(c)) return 'accent seul';
  for (const [x, y] of [[w, c], [c, w]]) if (y === x + 's' || y === x + 'x' || y === x + 'e' || y === x + 'es') return 'accord (s, e, x)';
  let k = 0; while (k < w.length && k < c.length && w[k] === c[k]) k++;
  if (k >= 3 && [k, k - 1].some((kk) => VFIN.has(w.slice(kk)) && VFIN.has(c.slice(kk)))) return 'fin de verbe';
  return 'lettres / autre mot';
}
const CIBLE = process.env.CIBLE ? Object.fromEntries(process.env.CIBLE.split(';').map((s) => { const i = s.lastIndexOf(':'); return [s.slice(0, i).trim(), +s.slice(i + 1)]; })) : null;
if (CIBLE) for (const f of Object.keys(CIBLE)) if (!FAMILLES.includes(f)) throw new Error('famille inconnue dans CIBLE : ' + f);
const TAUX = process.env.TAUX ? process.env.TAUX.split(',').map(Number) : [0.03, 0.08, 0.15, 0.25];
let GARDE = null, RELEVE = 1;   // chance de garder une faute selon sa famille ; relèvement du tirage
const ANCIEN = process.env.MEMO_ANCIEN ? JSON.parse(fs.readFileSync(process.env.MEMO_ANCIEN, 'utf8')) : {};
const eclate = (w) => { const m = /^([a-zà-ÿ]{1,3}')(.+)$/.exec(w); return m ? [m[1], m[2]] : ['', w]; };
for (const w in ANCIEN) { const [pre, n] = eclate(w), v = []; for (const c of fins(n).map((x) => pre + x).concat(ANCIEN[w].slice(1).map((x) => x[0]))) if (!v.includes(c)) v.push(c); memoC.set(w, v.slice(0, 16)); }
// Les candidats de chaque forme écrite. ANCIEN se lit en propriété PROPRE : un mot écrit qui porte le nom d'une propriété de tout objet JavaScript
// (« constructor », présent dans Wikipédia) rendait une fonction au lieu d'une liste et arrêtait tout (liste n° 479).
function ecrireMemo(vu, t0) {
  const memo = {}, ancien = (w) => (Object.prototype.hasOwnProperty.call(ANCIEN, w) ? ANCIEN[w] : [0]); let k = 0;
  for (const w of vu) { const old = new Map(ancien(w).slice(1).map((x) => [x[0], x])), fi = new Set(fins(eclate(w)[1])); memo[w] = parentC(w).map((c) => { const o = old.get(c); if (!o) return [c].concat(traits(w, c)); const r = o.slice(); if (fi.has(c.split("'").pop())) r[2] = 1; return r; }); memo[w].unshift(L.connu(w) ? 1 : 0); if (++k % 100000 === 0) console.log('candidats', k, Math.round((Date.now() - t0) / 1000) + ' s'); }
  fs.writeFileSync(MEMO, JSON.stringify(memo));
  console.log('fini', Math.round((Date.now() - t0) / 1000) + ' s');
}
(async () => {
  if (process.env.REPRISE) {   // liste n° 479 : phrases déjà écrites (REPRISE=<sortie.jsonl>, rien n'est réécrit) : relire leurs formes, refaire seulement les candidats
    const vu = new Set(), t0 = Date.now();
    for await (const l of readline.createInterface({ input: fs.createReadStream(process.env.REPRISE, { encoding: 'utf8' }), crlfDelay: Infinity })) { if (!l.trim()) continue; for (const w of JSON.parse(l)[0]) { const lo = low(w); if (/[a-zà-ÿœ]/.test(lo)) vu.add(lo); } }
    console.log('reprise : formes écrites', vu.size, Math.round((Date.now() - t0) / 1000) + ' s'); return ecrireMemo(vu, t0);
  }
  const flux = fs.createWriteStream(OUT, { encoding: 'utf8' }); const nb = +(NB || 1e9), vers = +(VERS || 1);
  const SRC = process.env.SOURCES ? process.env.SOURCES.split(',') : ['b2_train.txt', 'tatoeba/phrases.txt'], P = require('path');
  async function* lignes() { for (const f of SRC) for await (const l of readline.createInterface({ input: fs.createReadStream(P.isAbsolute(f) ? f : P.join(R, 'data_local', f), { encoding: 'utf8' }), crlfDelay: Infinity })) yield l; }
  let n = 0, mots = 0, t0 = Date.now(); const vu = new Set(), parFam = {};
  if (CIBLE) {   // liste n° 479 : essai sur 20 000 phrases (rien n'est écrit) pour mesurer la part de chaque famille que donne le tirage
    const g0 = graine, cpt = {}; let tot = 0, ne = 0;
    for await (const l of lignes()) { if (++ne > 20000) break; const toks = l.trim().match(TOK) || [];
      for (const tk of toks) { const lo = low(tk); if (!/[A-Za-zÀ-ÿœŒ]/.test(tk) || tk[0] !== tk[0].toLowerCase()) continue; const p = estV(lo) && !GRP.has(lo) ? VR : 1;
        if (rnd() > 0.1) continue; const w = faute(lo); if (w === lo) continue; const f = famille(lo, low(w)); cpt[f] = (cpt[f] || 0) + p; tot += p; } }
    const s = Object.values(CIBLE).reduce((a, b) => a + b, 0); GARDE = {};
    for (const f of FAMILLES) GARDE[f] = (CIBLE[f] || 0) / s / Math.max(1e-6, (cpt[f] || 0) / tot);
    RELEVE = Math.max(...Object.values(GARDE)); for (const f of FAMILLES) GARDE[f] /= RELEVE;
    console.log('essai : parts du tirage', JSON.stringify(Object.fromEntries(FAMILLES.map((f) => [f, +(100 * (cpt[f] || 0) / tot).toFixed(1)]))), 'chances gardées', JSON.stringify(Object.fromEntries(FAMILLES.map((f) => [f, +GARDE[f].toFixed(3)]))), 'relèvement', RELEVE.toFixed(2));
    graine = g0; nV = 0; nA = 0;
  }
  for await (const l of lignes()) {
    if (n >= nb) break; const s = l.trim(); if (s.length < 12) continue; n++;
    const toks = s.match(TOK); if (!toks || toks.length > 72) continue;
    for (let v = 0; v < vers; v++) {
      const r = pick(TAUX), x = [], y = [];
      for (const tk of toks) {
        const est = /[A-Za-zÀ-ÿœŒ]/.test(tk), lo = low(tk);
        if (!est || tk[0] !== tk[0].toLowerCase() || rnd() >= Math.min(0.95, RELEVE * (estV(lo) && !GRP.has(lo) ? Math.min(0.5, r * VR) : r))) { x.push(tk); y.push(lo); continue; }
        const w = faute(lo);
        if (GARDE && w !== lo) { const f = famille(lo, low(w)); if (rnd() >= GARDE[f]) { x.push(tk); y.push(lo); continue; } parFam[f] = (parFam[f] || 0) + 1; }
        x.push(w); y.push(lo);
      }
      for (const w of x) { const lo = low(w); if (/[a-zà-ÿœ]/.test(lo)) vu.add(lo); } mots += x.length;
      if (rnd() < 0.3) { const k = x.map((w) => (/^[.,;:!?…]$/.test(w) && rnd() < 0.6 ? null : w)), keep = []; const yy = []; k.forEach((w, i) => { if (w !== null) { keep.push(w); yy.push(y[i]); } }); flux.write(JSON.stringify([keep, yy]) + '\n'); }
      else flux.write(JSON.stringify([x, y]) + '\n');
    }
    if (n % 50000 === 0) console.log(n, 'phrases', mots, 'mots', vu.size, 'formes écrites', Math.round((Date.now() - t0) / 1000) + ' s');
  }
  if (process.env.WICO) {   // liste n° 479 : vraies fautes en contexte ; une ligne sur 10 reste à l'écart (contrôle)
    let k = 0, pris = 0;
    for await (const l of readline.createInterface({ input: fs.createReadStream(process.env.WICO, { encoding: 'utf8' }), crlfDelay: Infinity })) {
      if (!l.trim() || (k++ % 10) === 0) continue; const j = JSON.parse(l), a = (j.before || '').match(TOK), b = (j.after || '').match(TOK);
      if (!a || !b || a.length !== b.length || a.length > 72) continue; const d = []; a.forEach((t, i) => { if (t !== b[i]) d.push(i); });
      if (d.length !== 1 || low(a[d[0]]) !== low(j.bad) || low(b[d[0]]) !== low(j.good)) continue;
      const y = b.map(low); for (let v = 0; v < vers; v++) flux.write(JSON.stringify([a, y]) + '\n'); for (const w of a) { const lo = low(w); if (/[a-zà-ÿœ]/.test(lo)) vu.add(lo); } pris++;
    }
    console.log('WiCoPaCo : lignes prises', pris);
  }
  flux.end();
  console.log('phrases', n, 'mots', mots, 'formes écrites', vu.size, 'fautes de verbes', nV, 'autres', nA);
  if (GARDE) { const tt = Object.values(parFam).reduce((a, b) => a + b, 0); console.log('parts des fautes écrites', JSON.stringify(Object.fromEntries(FAMILLES.map((f) => [f, +(100 * (parFam[f] || 0) / tt).toFixed(1)])))); }
  ecrireMemo(vu, t0);
})();
