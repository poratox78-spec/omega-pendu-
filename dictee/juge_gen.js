// Fabrique l'entraînement à partir du corpus PUBLIC (UD + exemples du Wiktionnaire, data_local/b2_train.txt ; phrases du quotidien de Tatoeba, data_local/tatoeba/phrases.txt) : chaque phrase correcte reçoit
// des fautes tirées au sort. Le corpus privé n'entre jamais ici.
//   node dictee/juge_gen.js <racine> <sortie.jsonl> <memo.json> [nb_phrases] [versions]   (MEMO_ANCIEN=<memo.json> : relit les candidats déjà calculés ; GRAINE ; VR : fautes de verbes plus fréquentes ; VF : part de ces fautes tirée dans les formes du même verbe)
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
const ANCIEN = process.env.MEMO_ANCIEN ? JSON.parse(fs.readFileSync(process.env.MEMO_ANCIEN, 'utf8')) : {};
const eclate = (w) => { const m = /^([a-zà-ÿ]{1,3}')(.+)$/.exec(w); return m ? [m[1], m[2]] : ['', w]; };
for (const w in ANCIEN) { const [pre, n] = eclate(w), v = []; for (const c of fins(n).map((x) => pre + x).concat(ANCIEN[w].slice(1).map((x) => x[0]))) if (!v.includes(c)) v.push(c); memoC.set(w, v.slice(0, 16)); }
(async () => {
  const flux = fs.createWriteStream(OUT, { encoding: 'utf8' }); const nb = +(NB || 1e9), vers = +(VERS || 1);
  async function* lignes() { for (const f of ['b2_train.txt', 'tatoeba/phrases.txt']) for await (const l of readline.createInterface({ input: fs.createReadStream(require('path').join(R, 'data_local', f), { encoding: 'utf8' }), crlfDelay: Infinity })) yield l; }
  let n = 0, mots = 0, t0 = Date.now(); const vu = new Set();
  for await (const l of lignes()) {
    if (n >= nb) break; const s = l.trim(); if (s.length < 12) continue; n++;
    const toks = s.match(TOK); if (!toks || toks.length > 72) continue;
    for (let v = 0; v < vers; v++) {
      const r = pick([0.03, 0.08, 0.15, 0.25]), x = [], y = [];
      for (const tk of toks) {
        const est = /[A-Za-zÀ-ÿœŒ]/.test(tk), lo = low(tk);
        if (!est || tk[0] !== tk[0].toLowerCase() || rnd() >= (estV(lo) && !GRP.has(lo) ? Math.min(0.5, r * VR) : r)) { x.push(tk); y.push(lo); continue; }
        const w = faute(lo); x.push(w); y.push(lo);
      }
      for (const w of x) { const lo = low(w); if (/[a-zà-ÿœ]/.test(lo)) vu.add(lo); } mots += x.length;
      if (rnd() < 0.3) { const k = x.map((w) => (/^[.,;:!?…]$/.test(w) && rnd() < 0.6 ? null : w)), keep = []; const yy = []; k.forEach((w, i) => { if (w !== null) { keep.push(w); yy.push(y[i]); } }); flux.write(JSON.stringify([keep, yy]) + '\n'); }
      else flux.write(JSON.stringify([x, y]) + '\n');
    }
    if (n % 50000 === 0) console.log(n, 'phrases', mots, 'mots', vu.size, 'formes écrites', Math.round((Date.now() - t0) / 1000) + ' s');
  }
  flux.end();
  console.log('phrases', n, 'mots', mots, 'formes écrites', vu.size, 'fautes de verbes', nV, 'autres', nA);
  const memo = {}; let k = 0;
  for (const w of vu) { const old = new Map((ANCIEN[w] || [0]).slice(1).map((x) => [x[0], x])), fi = new Set(fins(eclate(w)[1])); memo[w] = parentC(w).map((c) => { const o = old.get(c); if (!o) return [c].concat(traits(w, c)); const r = o.slice(); if (fi.has(c.split("'").pop())) r[2] = 1; return r; }); memo[w].unshift(L.connu(w) ? 1 : 0); if (++k % 100000 === 0) console.log('candidats', k, Math.round((Date.now() - t0) / 1000) + ' s'); }
  fs.writeFileSync(MEMO, JSON.stringify(memo));
  console.log('fini', Math.round((Date.now() - t0) / 1000) + ' s');
})();
