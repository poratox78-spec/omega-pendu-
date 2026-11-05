'use strict';
/* ⭐ 03/11/2026 (liste n° 357) — CONTRÔLE PAR L'USAGE, au PRODUIT (juge chargé). La méthode qui a trouvé le plus de défauts
   (Rem, 17/10, redit le 03/11) : écrire des textes complets d'un vrai genre (mail, lettre, recette, avis, compte rendu…),
   les passer dans le correcteur et lire chaque marque et chaque silence. Les corpus ne voient que leurs propres phrases ;
   un texte entier a des fautes voisines, des listes, des titres, des formules — c'est là que les règles se taisent.
   Textes : dictee/usage_textes.txt (inventés, fautes balisées {écrit|attendu|domaine|autres bonnes réponses}).
   Pour chaque faute : rouge juste / orange juste / mauvais mot / muette ; et les marques posées sur les mots justes, dans
   le texte fautif (corrections qui cassent) et dans le texte juste (fausses alertes).
     node dictee/usage_probe.js            tableau par domaine + chaque faute manquée + chaque fausse marque
     node dictee/usage_probe.js --check    garde : aucun domaine ne perd de bonne réponse, aucune fausse marque de plus
     node dictee/usage_probe.js --fix      réécrit la référence dictee/usage_ref.json (après un progrès vérifié) */
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const REF = path.join(__dirname, 'usage_ref.json');
const MODE = process.argv.includes('--check') ? 'check' : process.argv.includes('--fix') ? 'fix' : 'voir';
const D = require(path.join(RACINE, 'extension', 'charger_node.js'))({ ext: path.join(RACINE, 'extension'), juge: true });
const NOMS = { O: 'orthographe', G: 'grammaire', C: 'conjugaison', P: 'ponctuation', N: 'pluriels' };
const TOK = /[A-Za-zÀ-ÿœŒ'’ʼ]+/g;   // le découpage du produit (dys-core toks)
const norm = (s) => s.replace(/[\s  ]+/g, ' ').replace(/ ([?!;:])/g, '$1').replace(/[’ʼ]/g, "'");

function construire(src) {
  let F = '', J = '', last = 0, m; const errs = [], re = /\{([^|{}]*)\|([^|{}]*)\|([OGCPN])(?:\|([^{}]*))?\}/g;
  while ((m = re.exec(src))) {
    const pre = src.slice(last, m.index); F += pre; J += pre;
    errs.push({ s: F.length, e: F.length + m[1].length, faux: m[1], justes: [m[2]].concat(m[4] ? m[4].split(';') : []), d: m[3] });
    F += m[1]; J += m[2]; last = re.lastIndex;
  }
  F += src.slice(last); J += src.slice(last); return { F, J, errs };
}
// Les marques du produit, ramenées à des plages de caractères [fs, fe) et un remplacement r.
function marques(t) {
  D.jugeAnalyseSync(t); const fl = D.diagnoseAll(t).flags || [], tk = []; let m; TOK.lastIndex = 0;
  while ((m = TOK.exec(t))) tk.push([m.index, m.index + m[0].length]);
  return fl.map((f) => {
    let a, b;
    if (typeof f.cs === 'number') { a = f.cs; b = f.ce; }
    else if (typeof f.i === 'number' && tk[f.i]) { const k = f.i + Math.max(1, f.span || 1) - 1; a = tk[f.i][0]; b = (tk[k] || tk[f.i])[1]; }
    else return null;
    return { fs: a, fe: b, r: typeof f.sugg === 'string' ? f.sugg : '', tier: f.tier, name: f.name, typo: !!f.typo, juge: !!f.juge };
  }).filter(Boolean);
}
const rouge = (z) => z.tier !== 'vigilance';
const ctx = (t, a, b) => t.slice(Math.max(0, a - 28), b + 22).replace(/\n/g, ' / ');

const textes = fs.readFileSync(path.join(__dirname, 'usage_textes.txt'), 'utf8').replace(/^(#.*\n)+/, '').split(/^=== /m).filter((b) => b.trim());
const fautes = [], casses = [], fausses = [];
for (const b of textes) {
  const nl = b.indexOf('\n'), code = b.slice(0, nl).trim().split(' ')[0], { F, J, errs } = construire(b.slice(nl + 1));
  const zf = marques(F), prises = new Set();
  errs.forEach((e, k) => {
    const ins = e.s === e.e;
    const ov = zf.filter((z) => ins ? (z.fs <= e.s && z.fe >= e.s && (z.typo || /[^A-Za-zÀ-ÿœŒ']/.test(z.r)))
      : (z.fs < e.e && z.fe > e.s) || (z.fs === z.fe && z.fs >= e.s && z.fs <= e.e && /[^A-Za-zÀ-ÿœŒ' ]/.test(e.justes[0])));
    ov.forEach((z) => prises.add(z));
    const bon = ov.filter((z) => { const lo = Math.min(e.s, z.fs), hi = Math.max(e.e, z.fe), avant = F.slice(lo, e.s), apres = F.slice(e.e, hi);
      return e.justes.some((j) => norm(F.slice(lo, z.fs) + z.r + F.slice(z.fe, hi)) === norm(avant + j + apres)); });
    // ⭐ 05/11/2026 (liste n° 377) : une faute que DEUX marques réparent ensemble (« mes beau-parent » → beaux + parents) était comptée
    // « mauvais mot » : chaque marque seule ne donne pas le mot juste. Si aucune ne suffit seule, on les applique toutes (sans chevauchement).
    let ens = false;
    if (!bon.length && ov.length > 1) { const zs = ov.slice().sort((a, b) => a.fs - b.fs);
      if (zs.every((z, q) => !q || zs[q - 1].fe <= z.fs)) { const lo = Math.min(e.s, zs[0].fs), hi = Math.max(e.e, zs[zs.length - 1].fe); let s = '', p = lo;
        for (const z of zs) { s += F.slice(p, z.fs) + z.r; p = z.fe; } s += F.slice(p, hi);
        ens = e.justes.some((j) => norm(s) === norm(F.slice(lo, e.s) + j + F.slice(e.e, hi))); } }
    const v = bon.some(rouge) ? 'rouge juste' : bon.length ? 'orange juste' : ens ? (ov.every(rouge) ? 'rouge juste' : 'orange juste') : ov.length ? 'mauvais mot' : 'muette';
    fautes.push({ id: code + '#' + k, d: NOMS[e.d], faux: e.faux, juste: e.justes[0], v, marques: ov.map((z) => z.name + ' → ' + z.r + ' (' + z.tier + ')'), ctx: ctx(F, e.s, e.e) });
  });
  for (const z of zf) if (!prises.has(z)) casses.push({ t: code, mot: F.slice(z.fs, z.fe), r: z.r, name: z.name, tier: z.tier, ctx: ctx(F, z.fs, z.fe) });
  for (const z of marques(J)) fausses.push({ t: code, mot: J.slice(z.fs, z.fe), r: z.r, name: z.name, tier: z.tier, ctx: ctx(J, z.fs, z.fe) });
}

const tab = {};
for (const f of fautes) { const t = tab[f.d] = tab[f.d] || { total: 0, bon: 0, 'rouge juste': 0, 'orange juste': 0, 'mauvais mot': 0, muette: 0 }; t.total++; t[f.v]++; if (/juste$/.test(f.v)) t.bon++; }
const res = { domaines: tab, cassesRouge: casses.filter(rouge).length, cassesOrange: casses.filter((z) => !rouge(z)).length,
  faussesRouge: fausses.filter(rouge).length, faussesOrange: fausses.filter((z) => !rouge(z)).length,
  verdicts: Object.fromEntries(fautes.map((f) => [f.id, f.v])) };

console.log('CONTRÔLE PAR L\'USAGE — ' + textes.length + ' textes inventés, ' + fautes.length + ' fautes, produit avec le juge');
for (const [k, t] of Object.entries(tab)) console.log('  ' + k.padEnd(12) + ' bon mot ' + String(t.bon).padStart(3) + ' / ' + String(t.total).padStart(3) + ' (' + (100 * t.bon / t.total).toFixed(0).padStart(3) + ' %)  rouge ' + t['rouge juste'] + ', orange ' + t['orange juste'] + ', mauvais mot ' + t['mauvais mot'] + ', muettes ' + t.muette);
console.log('  marques sur des mots justes — texte fautif : ' + res.cassesRouge + ' rouge(s), ' + res.cassesOrange + ' orange(s) ; texte juste : ' + res.faussesRouge + ' rouge(s), ' + res.faussesOrange + ' orange(s)');

if (MODE === 'voir') {
  for (const f of fautes) if (!/juste$/.test(f.v)) console.log('  ' + f.v.padEnd(11) + ' ' + f.id.padEnd(6) + ' ' + f.d.padEnd(12) + ' « ' + f.faux + ' » → « ' + f.juste + ' »' + (f.marques.length ? '  [' + f.marques.join(' ; ') + ']' : '') + '   …' + f.ctx + '…');
  for (const z of casses) console.log('  CASSE ' + z.tier.padEnd(9) + ' ' + z.t + ' « ' + z.mot + ' » → « ' + z.r + ' » (' + z.name + ')   …' + z.ctx + '…');
  for (const z of fausses) console.log('  FAUSSE ' + z.tier.padEnd(9) + ' ' + z.t + ' « ' + z.mot + ' » → « ' + z.r + ' » (' + z.name + ')   …' + z.ctx + '…');
}
if (MODE === 'fix') { fs.writeFileSync(REF, JSON.stringify(res, null, 1) + '\n'); console.log('✓ référence réécrite : dictee/usage_ref.json'); }
if (MODE === 'check') {
  const ref = JSON.parse(fs.readFileSync(REF, 'utf8')), mal = [];
  for (const [k, t] of Object.entries(ref.domaines)) { const n = tab[k] ? tab[k].bon : 0; if (n < t.bon) mal.push(k + ' : ' + t.bon + ' → ' + n + ' bonnes réponses'); }
  for (const k of ['cassesRouge', 'cassesOrange', 'faussesRouge', 'faussesOrange']) if (res[k] > ref[k]) mal.push(k + ' : ' + ref[k] + ' → ' + res[k]);
  const rang = { 'rouge juste': 3, 'orange juste': 2, 'mauvais mot': 1, muette: 0 };
  for (const [id, v] of Object.entries(res.verdicts)) { const a = ref.verdicts[id]; if (a && a !== v) console.log('  ' + (rang[v] > rang[a] ? 'gagnée' : 'PERDUE') + ' ' + id + ' : ' + a + ' → ' + v); }
  if (mal.length) { console.log('✗ USAGE : recul sur les textes inventés :'); mal.forEach((m) => console.log('    ' + m)); console.log('  (détail : node dictee/usage_probe.js ; après un progrès vérifié : --fix)'); process.exitCode = 1; }
  else console.log('✓ USAGE : aucun domaine en recul, aucune fausse marque de plus');
}
