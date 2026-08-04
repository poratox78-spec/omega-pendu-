// sens_probe.js — GARDE DU JEU « Double-Sens » : la règle d'équité et la table de définitions.
//
// POURQUOI ELLE EXÉCUTE LE CODE LIVRÉ, ET PAS UNE COPIE. Mon premier banc ré-implémentait la règle
// à côté ; il est donc resté vert quand j'ai ajouté la garde « autre mot du jeu » — il testait ma
// copie, pas la page. Ici on EXTRAIT les fonctions de `double-sens.html` et on les exécute telles
// quelles, avec le vrai `phonKey` de `dys-core.js` (qui tourne sous Node : aucun DOM requis).
//
// CE QU'ELLE VÉRIFIE
//   ① la règle d'équité : le bon mot mal orthographié est ACCEPTÉ, un autre mot est REFUSÉ ;
//   ② la garde mesurée : un essai qui est lui-même un autre mot du jeu, et qui ne sonne pas comme
//     la cible, est refusé (« prive » n'est pas une façon d'écrire « prise ») ;
//   ③ la table : les invariants qui rendent le jeu jouable — sinon un mauvais rebuild passe.
//
//   node dictee/sens_probe.js        ·        node dictee/sens_probe.js --check
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const R = path.join(__dirname, '..');
global.self = global;
require(path.join(R, 'extension', 'dys-core.js'));
const DC = global.DYSCORE;

const PAGE = fs.readFileSync(path.join(R, 'double-sens.html'), 'utf8');
const echecs = [];
const dit = (ok, quoi, detail) => {
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + (quoi + ' ').padEnd(44, '·') + ' ' + (detail || ''));
  if (!ok) echecs.push(quoi);
};

// ---- extraire les fonctions LIVRÉES (pas une copie écrite à la main)
function corps(nom) {
  const i = PAGE.indexOf('function ' + nom + '(');
  if (i < 0) return null;
  const j = PAGE.indexOf('\n  }', i);
  return j < 0 ? null : PAGE.slice(i, j + 4);
}
const NOMS = ['tolerance', 'deac', 'lev', 'juge'];
const src = NOMS.map(corps);
if (src.some(x => !x)) {
  console.log('❌ extraction impossible : ' + NOMS.filter((_, i) => !src[i]).join(', '));
  process.exit(1);
}
// `juge` lit `DC` et `AUTRES` dans la portée de la page — on les fournit à l'identique.
const AUTRES = {};
const juge = new Function('DC', 'AUTRES', src.join('\n') + '\nreturn juge;')(DC, AUTRES);

// ---- ③ la table
const brut = zlib.gunzipSync(fs.readFileSync(path.join(R, 'extension', 'assets', 'sens.json.gz')));
const T = JSON.parse(brut.toString('utf8'));
for (const e of T) AUTRES[e.m.toLowerCase()] = 1;

dit(T.length >= 4000, 'assez de mots pour jouer', T.length + ' définitions');
dit(T.every(e => e.m && e.d && typeof e.f === 'number'), 'chaque entrée est complète');
dit(T.every((e, i) => i === 0 || T[i - 1].f >= e.f), 'triée du plus courant au plus rare',
  'les niveaux de difficulté en dépendent');
const livre = T.filter(e => e.d.toLowerCase().includes(e.m.toLowerCase().slice(0, Math.max(4, e.m.length - 2))));
dit(!livre.length, 'aucune définition ne livre son mot',
  livre.length ? livre.slice(0, 3).map(e => e.m).join(', ') : '');
const longue = T.filter(e => e.d.length > 80 || e.d.length < 14);
dit(!longue.length, 'définitions lisibles (14–80 caractères)', longue.length ? longue.length + ' hors bornes' : '');
const sale = T.filter(e => /#[0-9A-Fa-f]{6}|\[\d+\]|^\s*\(/.test(e.d));
dit(!sale.length, 'aucune salissure de mise en forme',
  sale.length ? sale.slice(0, 3).map(e => e.d.slice(0, 24)).join(' | ') : '');
// le filtre de contenu a-t-il bien tenu ? (échantillon de termes qui ne doivent PAS apparaître)
const interdits = ['sexe', 'sexuel', 'prostituée', 'meurtre', 'torture', 'suicide', 'cocaïne'];
const passe = T.filter(e => interdits.some(t =>
  new RegExp('(?<![a-zà-ÿ])' + t + '(?![a-zà-ÿ])', 'i').test(e.m + ' ' + e.d)));
dit(!passe.length, 'filtre de contenu tenu',
  passe.length ? passe.slice(0, 3).map(e => e.m).join(', ') : 'aucun terme sensible');

// ---- ① et ② la règle d'équité, sur le code livré
console.log('\n  ── règle d\'équité (fonctions extraites de double-sens.html) ──');
const CAS = [
  ['avenir', 'avenir', 'exact', 'écrit juste'],
  ['aveunir', 'avenir', 'ortho', 'faute phonétique -> ACCEPTÉE'],
  ['umidité', 'humidité', 'ortho', 'h muet oublié -> ACCEPTÉE'],
  ['amertune', 'amertume', 'ortho', 'm écrit n -> ACCEPTÉE'],
  ['charcutrie', 'charcuterie', 'ortho', 'syllabe sautée -> ACCEPTÉE'],
  ['humidite', 'humidité', 'ortho', 'accents seuls -> ACCEPTÉE'],
  ['bonjour', 'avenir', 'non', 'mot sans rapport -> refusé'],
  ['maison', 'oubli', 'non', 'mot sans rapport -> refusé'],
  // ⭐ ② la garde : « prise » est dans la table, ce n'est donc pas une graphie de « prime »
  ['prise', 'prime', 'non', 'autre mot de la table -> refusé (garde)'],
  ['', 'avenir', 'rien', 'champ vide'],
];
let ok = 0;
for (const [essai, cible, attendu, quoi] of CAS) {
  const r = juge(essai, cible);
  const bon = r === attendu;
  ok += bon;
  console.log('    ' + (bon ? '✓' : '✗') + ' « ' + (essai || '(vide)') + ' » pour « ' + cible +
    ' » -> ' + r + (bon ? '   ' + quoi : '   ATTENDU ' + attendu));
}
if (ok !== CAS.length) echecs.push('règle d\'équité (' + ok + '/' + CAS.length + ')');

console.log(echecs.length
  ? '\n❌ Double-Sens : ' + echecs.length + ' problème(s) — ' + echecs.join(', ')
  : '\n✅ Double-Sens : table saine (' + T.length + ' définitions) + règle d\'équité ' +
    ok + '/' + CAS.length);
if (echecs.length && process.argv.includes('--check')) process.exit(1);
