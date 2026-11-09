// Liste n° 480 (09/11/2026) — un mot qui porte le nom d'une propriété de TOUT objet JavaScript ne doit rien casser.
// Le mot anglais « constructor » (courant dans un texte technique ou une page Wikipédia) faisait lire, dans 324 tables de
// dys-core, la fonction héritée Object au lieu de « absent » : le moteur la prenait pour une entrée (préposition,
// conjugaison, suggestion…) et plantait ; dans l'extension, content.js perdait alors TOUTE correction du champ.
// Remède : tables sans prototype (« __proto__:null » écrit en dur, garde statique tools/sans_proto.py --verifier ;
// _sansProto() pour les tables chargées d'un fichier). Deux mesures ici, sur des phrases INVENTÉES :
//   ① aucune exception, à chaque point d'entrée du moteur ;
//   ② aucune LECTURE de Object.prototype.constructor par le moteur (mode diagnostic : un accesseur compte chaque lecture
//      et rend « absent », comme une table sans prototype) — attrape aussi les tables qui donnaient un résultat faux sans planter.
// Le moteur de la page (app/omega-pendu.html) a la même garde dans dictee/parity_corr.js.
//   node extension/proto_probe.js        (code 1 si une erreur ou une lecture)
'use strict';
const path = require('path');
const D = require(path.join(__dirname, 'charger_node.js'))({ ext: __dirname, juge: true });

const MOTS = ['constructor', 'Constructor', 'CONSTRUCTOR'];
const CADRES = ['Le X de la maison est venu hier.', 'X est un mot anglais.', 'Ils X les murs.', 'Je X.', 'Elle a X la table.',
  'Les X sont là.', 'Un X rouge passe.', 'Il est X.', "C'est le X.", "Elle voit l'X.", 'Nous avons vu le mot X, et il est resté.',
  'Tu X vite', 'On X demain ?', 'Il faut X le mur.', 'Les murs X et tombent.', 'la X', 'X', 'une X verte', 'Ils ont X', 'je les X'];
const ENTREES = {
  diagnoseAll: (t) => D.diagnoseAll(t), juge: (t) => { D.jugeAnalyseSync(t); return D.diagnoseAll(t); }, correctText: (t) => D.correctText(t),
  diagnose: (t) => D.diagnose(t), spellText: (t) => D.spellText(t), vigText: (t) => D.vigText(t), runonText: (t) => D.runonText(t),
  posTags: (t) => D.posTags(D.toks(t)), estQuestion: (t) => D.estQuestion(t),
  complete: (t, m) => D.complete(m), completeDebut: (t, m) => D.complete(m.slice(0, 7)), sonKey: (t, m) => D.sonKey(m), phonKey: (t, m) => D.phonKey(m),
};

const NATIF = Object.getOwnPropertyDescriptor(Object.prototype, 'constructor');
const sites = new Map(); let actif = false;
Object.defineProperty(Object.prototype, 'constructor', {
  configurable: true,
  get() {
    if (!actif) return Array.isArray(this) ? Array : Object;
    const l = (new Error().stack.split('\n')[2] || '').trim(), m = /([^\\/()]+):(\d+):\d+\)?$/.exec(l);
    const k = m ? m[1] + ':' + m[2] + ' ' + (l.split(' ')[1] || '') : l;
    sites.set(k, (sites.get(k) || 0) + 1); return undefined;
  },
  set(v) { Object.defineProperty(this, 'constructor', { value: v, writable: true, configurable: true, enumerable: false }); },
});
const err = new Map(); let n = 0;
for (const m of MOTS) for (const c of CADRES) {
  const t = c.replace('X', m);
  for (const [nom, f] of Object.entries(ENTREES)) {
    for (const diag of [false, true]) {   // sans puis avec l'accesseur de diagnostic : un plantage ne doit pas dépendre de lui
      n++; actif = diag;
      try { f(t, m); } catch (e) { const k = nom + ' | ' + e.message + ' | ' + (e.stack.split('\n')[1] || '').trim().replace(/\(.*[\\/]/, '('); if (!err.has(k)) err.set(k, t); }
      actif = false;
    }
  }
}
Object.defineProperty(Object.prototype, 'constructor', NATIF);
console.log('appels', n, '| erreurs distinctes', err.size, '| lectures du prototype par le moteur', sites.size);
for (const [k, t] of err) console.log('  ✗ ERREUR', k, '←', t);
for (const [k, v] of [...sites].sort()) console.log('  ✗ LECTURE ×' + v, k);
if (err.size || sites.size) { console.log('✗ un mot nommé comme une propriété d\'objet JavaScript casse le moteur (liste n° 480) : table avec prototype ?'); process.exit(1); }
console.log('✓ « constructor » ne casse rien et n\'est lu dans aucune table (' + Object.keys(ENTREES).length + ' points d\'entrée, ' + MOTS.length * CADRES.length + ' phrases)');
