// LE JUGE LÉGER (liste n° 332) — la garde. Son calcul est à part (jugeAnalyse) : les autres bancs mesurent les règles seules, celui-ci mesure le juge au produit.
//   node dictee/juge_probe.js
// ① même fichier dans l'app et l'extension, et il reste léger ; ② sans modèle chargé, aucune marque ;
// ③ le moteur du navigateur note comme le modèle entraîné ; ④ phrases inventées : il parle où les règles se taisent, se tait sur du français correct,
// ne touche jamais un mot déjà marqué ; ⑤ plafond de fausses alertes sur 2 500 phrases de français public (une partie de ces marques sont de vraies fautes du corpus) ;
// ⑥ ponctuation (liste n° 333) : virgule, point et « ? » sur des phrases inventées, silence sur des phrases justes, plafond à part ; ⑦ les fins de mots (liste n° 337) sont parmi les candidats.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), EXT = path.join(ROOT, 'extension'), err = [];
const C = require(path.join(EXT, 'charger_node.js'));
const a = fs.readFileSync(path.join(EXT, 'assets', 'juge-mini.bin')), b = fs.readFileSync(path.join(ROOT, 'app', 'juge-mini.bin'));
if (!a.equals(b)) err.push('app/juge-mini.bin ≠ extension/assets/juge-mini.bin');
if (a.length > 4e6) err.push('le juge n\'est plus léger : ' + a.length + ' octets');

const D0 = C({ ext: EXT }), T0 = 'Le chat de mes voisins mange sont poisson.';
if (D0._juge.m) err.push('le chargeur des bancs a chargé le juge sans qu\'on le demande');
if (D0.jugeAnalyse(T0, [], null) !== false) err.push('sans modèle, jugeAnalyse doit se taire');
if (D0.diagnoseAll(T0).flags.some((f) => f.juge)) err.push('sans modèle, une marque du juge est sortie');

const D = C({ ext: EXT, juge: true });
if (!D._juge.m) err.push('modèle non chargé');
const low = (s) => s.toLowerCase().replace(/[’ʼ]/g, "'");
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'juge_refs.json'), 'utf8'));
let pire = 0; const memo = new Map();
for (const r of R) {
  const cle = r.t.join(' '); let h = memo.get(cle); if (!h) { h = D._juge.m.lire(r.t.map(low), r.fl); memo.set(cle, h); }
  D._juge.m.noter(h, r.i, r.c[0], r.c.map((m, k) => ({ m, tr: r.tr[k] }))).forEach((v, k) => { pire = Math.max(pire, Math.abs(v - r.sc[k])); });
  D._juge.m.ponct(h, r.i, r.t.length).forEach((v, k) => { pire = Math.max(pire, Math.abs(v - r.pc[k])); });
}
if (!(pire < 2e-3)) err.push('parité navigateur / modèle entraîné : écart ' + pire);

const marques = (t) => { D.jugeAnalyseSync(t); return D.diagnoseAll(t).flags; }, deMot = (x) => x.juge && !x.typo;
for (const [t, w, s] of [['Le chat de mes voisins mange sont poisson.', 'sont', 'son'], ['La voiture de mon père et garée devant la maison.', 'et', 'est'], ['Sa sœur à un nouveau travail dans une grande ville.', 'à', 'a'], ['La pane du moteur nous a arrêtés.', 'pane', 'panne']]) {
  const f = marques(t).filter(deMot); if (!f.some((x) => x.word === w && x.sugg === s && x.tier === 'vigilance')) err.push('« ' + t + ' » : attendu ' + w + ' → ' + s + ', rendu ' + JSON.stringify(f.map((x) => x.word + '→' + x.sugg)));
}
for (const t of ['Quand il arrive ce soir, nous mangerons ensemble.', 'Tu pourrais prendre le pain en rentrant du travail.', 'Les fleurs du jardin sentent très bon après la pluie.', 'La porte de la grange est restée ouverte toute la nuit.', 'Ces petits gâteaux sont vraiment délicieux avec du thé.', 'Mon cousin travaille dans une boulangerie près de la gare.']) {
  const f = marques(t).filter(deMot); if (f.length) err.push('« ' + t + ' » : fausse alerte ' + JSON.stringify(f.map((x) => x.word + '→' + x.sugg)));
}
{ const f = marques('Mes parents on une petite maison près du canal.'), n = f.filter((x) => x.word === 'on'); if (n.length !== 1 || n[0].juge) err.push('un mot déjà marqué par une règle doit le rester, sans le juge'); }

for (const [t, nom] of [['Quand le soleil se couche sur la colline les enfants rentrent à la maison.', 'virgule'], ['Mon frère range son vélo dans le garage Il prépare ensuite le repas du soir.', 'point final'], ['Tu viens avec nous au marché demain matin', "point d'interrogation"], ['Pourquoi les oiseaux partent vers le sud en hiver', "point d'interrogation"]]) {
  const f = marques(t).filter((x) => x.juge && x.typo); if (!f.some((x) => x.name === nom && x.tier === 'vigilance')) err.push('« ' + t + ' » : attendu ' + nom + ', rendu ' + JSON.stringify(f.map((x) => x.name)));
}
for (const t of ['Il regarde par la fenêtre pendant que sa fille dessine un bateau.', 'Nous mangerons des crêpes samedi soir chez ma tante']) { const f = marques(t).filter((x) => x.juge && x.typo); if (f.length) err.push('« ' + t + ' » : fausse ponctuation ' + JSON.stringify(f.map((x) => x.name))); }
for (const [w, ms] of [['parle', ['parlé', 'parlent']], ['parlé', ['parler', 'parlez']]]) { const c = D._juge.cands(w).map((x) => x.m); for (const m of ms) if (!c.includes(m)) err.push('candidats de « ' + w + ' » : ' + m + ' manque'); }

const PLAFOND = 32, PLAFOND_P = 30; let n = 0, ph = 0, np = 0;
const L = fs.readFileSync(path.join(__dirname, 'fp_scale_corpus.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
for (const l of L) { const fl = marques(l), k = fl.filter(deMot).length; n += k; ph += k ? 1 : 0; np += fl.filter((x) => x.juge && x.typo).length; }
console.log('français public : ' + n + ' marques sur ' + L.length + ' phrases (' + (100 * ph / L.length).toFixed(1) + ' %), plafond ' + PLAFOND + ' ; ponctuation ' + np + ', plafond ' + PLAFOND_P + ' ; parité ' + pire.toFixed(5) + ' ; fichier ' + (a.length / 1e6).toFixed(2) + ' Mo');
if (n > PLAFOND) err.push('fausses alertes sur français public : ' + n + ' > ' + PLAFOND);
if (np > PLAFOND_P) err.push('ponctuation ajoutée au français public : ' + np + ' > ' + PLAFOND_P);

if (err.length) { console.error('JUGE LÉGER :\n  ' + err.join('\n  ')); process.exit(1); }
console.log('juge léger OK');
