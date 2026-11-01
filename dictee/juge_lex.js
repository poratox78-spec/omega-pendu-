// Juge léger : lexique du produit, candidats d'un mot, traits (écrit, candidat). Partagé par la fabrique d'entraînement et les bancs.
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
module.exports = function (R) {
  const D = require(path.join(R, 'extension', 'charger_node.js'))({ ext: path.join(R, 'extension') });
  const son = D.sonKey, ph = D.phonKey, dec = D.deacc;
  const low = (s) => String(s || '').toLowerCase().replace(/[’ʼ]/g, "'");
  const F = new Map();
  for (const l of zlib.gunzipSync(fs.readFileSync(path.join(R, 'extension', 'assets', 'speller.tsv.gz'))).toString('utf8').split('\n')) { const p = l.split('\t'); if (p.length >= 2) { const f = +p[1]; if (f >= 1) F.set(p[0], f); } }
  const parPh = new Map(), parDebut = new Map(), parLen = new Map(), add = (m, k, w) => { const a = m.get(k); if (a) a.push(w); else m.set(k, [w]); };
  for (const w of F.keys()) { const d = dec(w); add(parPh, ph(w), w); add(parDebut, d.slice(0, Math.min(4, d.length)), w); add(parLen, d.length + ':' + d[0], w); }
  function lev(a, b, max) { const n = a.length, m = b.length; if (Math.abs(n - m) > max) return max + 1; let p = Array(m + 1).fill(0).map((_, j) => j); for (let i = 1; i <= n; i++) { const c = [i]; let best = i; for (let j = 1; j <= m; j++) { c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (c[j] < best) best = c[j]; } if (best > max) return max + 1; p = c; } return p[m]; }
  const GR = [["a", "à"], ["et", "est", "es"], ["ou", "où"], ["son", "sont"], ["ces", "ses", "c'est", "s'est"], ["ce", "se"], ["la", "là", "l'a"], ["ma", "m'a"], ["ta", "t'a"], ["sa", "ça"], ["on", "ont"], ["mes", "mais", "met"], ["du", "dû"], ["leur", "leurs"], ["ni", "n'y"], ["si", "s'y"], ["soi", "soit"], ["dont", "donc"], ["tout", "tous"], ["peu", "peut", "peux"], ["par", "part"], ["sur", "sûr"], ["quand", "quant"], ["qu'elle", "quelle", "quel"], ["sans", "sens", "cent"], ["dans", "en"], ["en", "an"]];
  const GRP = new Map(); for (const g of GR) for (const x of g) GRP.set(x, (GRP.get(x) || []).concat(g));
  const connu = (w) => F.has(w) || F.has(w.split("'").pop());
  function cands(w0, max = 16) {
    const w = low(w0), m = /^([a-zà-ÿ]{1,3}')(.+)$/.exec(w), pre = m ? m[1] : '', nu = m ? m[2] : w, d = dec(nu), S = new Map();
    const ajoute = (c) => { if (c !== nu && !S.has(c)) S.set(c, F.get(c) || 0); };
    (GRP.get(w) || []).forEach((c) => { if (c !== w) S.set(c, 1e9); });
    if (nu.length >= 2) {
      (parPh.get(ph(nu)) || []).forEach(ajoute);
      if (d.length >= 4) (parDebut.get(d.slice(0, 4)) || []).forEach((c) => { if (lev(dec(c), d, 3) <= 3) ajoute(c); });
      for (let n = d.length - 1; n <= d.length + 1; n++) for (const c of (parLen.get(n + ':' + d[0]) || [])) { if (lev(dec(c), d, 1) <= 1) ajoute(c); }
      if (!connu(nu) && d.length >= 3) for (let n = d.length - 2; n <= d.length + 2; n++) for (const c of (parLen.get(n + ':' + d[0]) || [])) { if (lev(dec(c), d, 2) <= 2) ajoute(c); }
    }
    return Array.from(S.entries()).sort((a, b) => b[1] - a[1]).slice(0, max).map((x) => (x[1] === 1e9 ? x[0] : pre + x[0]));
  }
  // Traits d'une paire (écrit w, candidat c) : même son large, même son strict, distance, accent seul, fréquence du candidat (log).
  function traits(w0, c0) {
    const w = low(w0), c = low(c0), a = w.split("'").pop(), b = c.split("'").pop();
    return [ph(a) === ph(b) ? 1 : 0, son(a) === son(b) ? 1 : 0, Math.min(3, lev(dec(a), dec(b), 3)), dec(a) === dec(b) ? 1 : 0, Math.round(Math.log2(1 + (F.get(b) || 0)))];
  }
  return { D, F, low, dec, ph, son, lev, GR, GRP, connu, cands, traits };
};
