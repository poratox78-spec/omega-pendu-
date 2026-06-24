// evo/saisie_oracle.js — ORACLE DE SAISIE (aide à la frappe / correction de typo dys) bâti sur le PENDU.
// Architecture = la DOUBLE VOIE arbitrée d'OMEGA (mémoire §4.2, Leçon 79 : la force vient de l'ENSEMBLE,
// pas d'une voie isolée), appliquée à la saisie. Réutilise le lexique embarqué OMEGA_LEX4 (155k, +phon .p) du
// moteur — §5 : pas de réinvention.
//   • Voie LEXICALE   (régime in-lexique) : cohorte (phon-clé ∪ edit-1) du lexique, classée DISTANCE-au-typo
//                       puis fréquence. Mesuré ~87 % top-1 sur typos variés (transpo/omission/doublement/phon).
//   • Voie SUBLEXICALE (régime OOV / mot novel) : trigrammes de caractères appris du MÊME lexique (la voie qui
//                       généralise hors-lexique) → vraisemblance orthographique. Faible seule, mais SEULE voie
//                       sur l'OOV (la lexicale y rend 0) — d'où la double voie. (Swap futur : `_neoLetterNgramDist`
//                       gap-aware du moteur — même idée, déjà câblée OFF-inerte.)
//   • ARBITRAGE par FIABILITÉ : voie lexicale si CONFIANTE (distance≤2 ∧ candidat dominant) ; sinon sublexicale.
//                       Bascule auto par régime, comme l'OS du moteur (M_NEO_OS_ARB).
//
// Usage :  const {makeOracle} = require('./evo/saisie_oracle.js'); const o = await makeOracle(); o.suggest("qiu");
//          node evo/saisie_oracle.js --measure
'use strict';
const { loadEngine } = require('./fitness_harness.js');

const ALPHA = 'abcdefghijklmnopqrstuvwxyz';
const da = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function phonKey(s) {                                  // clé phonétique FR approx (miroir de speller_probe.phon_key)
  s = da(s.toLowerCase()).replace(/ç/g, 's');
  s = s.replace(/ph/g, 'f').replace(/th/g, 't').replace(/ch/g, '§').replace(/qu/g, 'k').replace(/gu/g, 'g')
       .replace(/eau|aux|au/g, 'o').replace(/ou/g, 'u').replace(/ai|ei|ay/g, 'e').replace(/oi/g, 'wa');
  let r = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i], n = s[i + 1] || '';
    if (c === 'c') r += (/[eiy§]/.test(n) ? 's' : 'k');
    else if (c === 'g') r += (/[eiy]/.test(n) ? 'j' : 'g');
    else if (c === 'h') continue;
    else if (c === 'x') r += 'ks'; else if ('zs'.includes(c)) r += 's';
    else if (c === 'y') r += 'i'; else if (c === 'w') r += 'v'; else r += c;
  }
  let o = ''; for (const c of r) if (o[o.length - 1] !== c) o += c;
  while (o && 'est'.includes(o[o.length - 1])) o = o.slice(0, -1);
  return o;
}

function lev(a, b) {                                   // Levenshtein (déaccentué)
  a = da(a); b = da(b); const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => { const r = new Array(n + 1).fill(0); r[0] = i; return r; });
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);   // DAMERAU : transposition adjacente = 1 (qiu↔qui)
  }
  return d[m][n];
}

function edits1(d) {                                   // delete / transpose / replace / insert
  const r = new Set();
  for (let i = 0; i <= d.length; i++) {
    const a = d.slice(0, i), b = d.slice(i);
    if (b) r.add(a + b.slice(1));
    if (b.length > 1) r.add(a + b[1] + b[0] + b.slice(2));
    for (const c of ALPHA) { r.add(a + c + b); if (b) r.add(a + c + b.slice(1)); }
  }
  return r;
}

async function makeOracle(O) {
  O = O || loadEngine(); if (O.loadLex) await O.loadLex();
  const lex = O.evalIn(`OMEGA_LEX4.words.map(w=>[w.m.toLowerCase(), w.f||0])`);
  const F = Object.create(null), D2A = Object.create(null), PHON = Object.create(null);
  const TRI = Object.create(null), TRItot = Object.create(null);   // trigrammes de caractères (voie sublexicale)
  for (const [m, f] of lex) {
    if (!/^[a-zàâäéèêëîïôöùûüÿç]+$/.test(m)) continue;
    if (!(m in F) || f > F[m]) F[m] = f;
    const d = da(m); (D2A[d] || (D2A[d] = [])).push(m);
    const k = phonKey(m); (PHON[k] || (PHON[k] = [])).push(m);
    const g = '^^' + d + '$';                                       // trigrammes pondérés fréquence (lissés)
    for (let i = 0; i < g.length - 2; i++) {
      const t = g.slice(i, i + 3), c = t.slice(0, 2);
      TRI[t] = (TRI[t] || 0) + 1; TRItot[c] = (TRItot[c] || 0) + 1;
    }
  }
  const triLP = s => {                                              // log-vraisemblance orthographique d'une chaîne
    const g = '^^' + da(s) + '$'; let lp = 0;
    for (let i = 0; i < g.length - 2; i++) {
      const t = g.slice(i, i + 3), c = t.slice(0, 2);
      lp += Math.log(((TRI[t] || 0) + 0.5) / ((TRItot[c] || 0) + 0.5 * 26));
    }
    return lp / (g.length - 2);
  };

  function lexicale(token) {                                        // voie LEXICALE : cohorte phon∪edit, classée distance+freq
    const low = token.toLowerCase(), d = da(low);
    const C = new Set(PHON[phonKey(low)] || []);
    for (const e of edits1(d)) for (const w of (D2A[e] || [])) C.add(w);
    const cands = [...C].filter(w => w !== low);
    if (!cands.length) return null;
    const dk = d.split('').sort().join(''), ana = w => (da(w).split('').sort().join('') === dk ? 1 : 0);   // même multiset = transposition (candidat fort, n'affecte pas les omissions)
    cands.sort((x, y) => (lev(d, da(x)) - lev(d, da(y))) || (ana(y) - ana(x)) || (F[y] - F[x]));   // distance → anagramme (qiu→qui, pas qu) → freq
    const best = cands[0], bd = lev(d, da(best));
    const f2 = cands[1] ? F[cands[1]] : 0;
    const close = (bd <= 2 || phonKey(low) === phonKey(best)) ? 1 : 0;   // proche orthographe OU même son (ortografe→orthographe = phon identique, dist 3)
    const conf = close * (F[best] >= 1 ? 1 : 0) * (f2 === 0 || F[best] >= 3 * f2 ? 1 : 0.6);
    return { sugg: best, dist: bd, conf, route: 'lexicale', alts: cands.slice(0, 5) };
  }

  function sublexicale(token) {                                     // voie SUBLEXICALE (OOV) : meilleure graphie par trigrammes
    const d = da(token.toLowerCase());
    let best = null, bl = -Infinity;
    for (const e of edits1(d)) {                                    // graphies voisines (vraies OU non) scorées orthographe
      const s = triLP(e); if (s > bl) { bl = s; best = e; }
    }
    return { sugg: best, conf: 0.3, route: 'sublexicale', score: bl };
  }

  function suggest(token) {                                         // ARBITRAGE par fiabilité (in-lex ⟶ lexicale ; OOV ⟶ sublexicale)
    if (token.toLowerCase() in F) return null;                     // déjà un vrai mot → rien (la couche grammaire gère)
    const L = lexicale(token);
    if (L && L.conf >= 1) return L;                                 // voie lexicale confiante
    const S = sublexicale(token);
    if (L) return (L.conf >= 0.6) ? L : { ...L, route: 'lexicale(incertain)', sublex: S.sugg };   // lexicale faible : on garde mais on signale
    return S;                                                      // aucun candidat lexical → voie sublexicale (régime OOV)
  }

  return { suggest, lexicale, sublexicale, F, _evalEngine: O.evalIn };
}

module.exports = { makeOracle, phonKey, lev, edits1 };

if (require.main === module) (async () => {
  const o = await makeOracle();
  if (process.argv.includes('--measure')) {
    // jeu de typos variés sur des mots fréquents (cible IN-lexique → voie lexicale)
    const words = Object.keys(o.F).filter(w => o.F[w] >= 5 && w.length >= 5 && /^[a-zàâäéèêëîïôöùûüç]+$/.test(w))
                        .sort((a, b) => o.F[b] - o.F[a]).slice(0, 500);
    const mk = t => { const a = da(t).split(''); const j = 2 + Math.floor((a.length - 3) / 2); const k = t.length % 4;
      if (k === 0)[a[j], a[j - 1]] = [a[j - 1], a[j]]; else if (k === 1) a.splice(j, 1);
      else if (k === 2) a.splice(j, 0, a[j]); else a[j] = ({ f: 'ph', t: 'th', k: 'qu', s: 'c', o: 'au' })[a[j]] || a[j] + a[j];
      return a.join(''); };
    let n = 0, top1 = 0, byRoute = {};
    for (const t of words) { const ty = mk(t); if (ty in o.F) continue; n++;
      const r = o.suggest(ty); const ok = r && da(r.sugg) === da(t); if (ok) top1++;
      const rt = r ? r.route : 'rien'; byRoute[rt] = byRoute[rt] || [0, 0]; byRoute[rt][0]++; if (ok) byRoute[rt][1]++;
    }
    console.log(`=== ORACLE SAISIE — typos variés (cible in-lexique) n=${n} ===`);
    console.log(`  top-1 GLOBAL : ${(100 * top1 / n).toFixed(0)} %`);
    for (const rt in byRoute) console.log(`    voie ${rt.padEnd(20)} : ${byRoute[rt][1]}/${byRoute[rt][0]} (${(100 * byRoute[rt][1] / byRoute[rt][0]).toFixed(0)} %)`);
    // démo OOV : mot retiré du lexique → la voie lexicale échoue, la sublexicale propose
    console.log('  démo : qiu->', JSON.stringify(o.suggest('qiu')), ' | ortografe->', JSON.stringify(o.suggest('ortografe')).slice(0, 80));
  } else {
    for (const t of (process.argv.slice(2).length ? process.argv.slice(2) : ['qiu', 'ortografe', 'fenetr', 'maintnant']))
      console.log(t, '->', JSON.stringify(o.suggest(t)));
  }
})().catch(e => { console.error(e); process.exit(1); });
