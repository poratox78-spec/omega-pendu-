// LE JUGE LÉGER (liste n° 332) — la garde. Son calcul est à part (jugeAnalyse) : les autres bancs mesurent les règles seules, celui-ci mesure le juge au produit.
//   node dictee/juge_probe.js
// ① même fichier dans l'app et l'extension, et il reste léger ; ② sans modèle chargé, aucune marque ;
// ③ le moteur du navigateur note comme le modèle entraîné ; ④ phrases inventées : il parle où les règles se taisent, se tait sur du français correct,
// ne touche jamais un mot déjà marqué ; ⑤ plafond de fausses alertes sur 2 500 phrases de français public (une partie de ces marques sont de vraies fautes du corpus) ;
// ⑥ ponctuation (liste n° 333) : virgule, point et « ? » sur des phrases inventées, silence sur des phrases justes, plafond à part ; ⑦ les fins de mots (liste n° 337) sont parmi les candidats ;
// ⑧ arbitre (liste n° 334) : une orange d'accord fausse se tait, les oranges justes restent, et le silence ne relance aucun calcul ;
// ⑨ lettres du milieu mélangées (liste n° 383) : l'anagramme du milieu est parmi les candidats, le juge la choisit quand l'orthographe hésite, et son index se bâtit par tranches.
// ⑩ lettres probables (liste n° 399) : le modèle emporte la table des chances de faute par lettre (WiCoPaCo), le 8e trait a la valeur de l'entraînement, il ne vaut que pour un mot inconnu,
//    l'arbitre ne le lit pas, et le juge choisit le bon mot quand l'orthographe hésite.
// ⑪ point du juge (liste n° 476) : pas de point du juge dans un titre ni après une abréviation.
// ⑫ contrôle réparé (liste n° 477) : le texte d'UD a perdu beaucoup de virgules, donc une virgule ajoutée n'est pas fausse d'office. Chaque ponctuation
//    du juge sur le français public a son verdict lu à la main (juge_ponct_lu.json) ; le plafond porte sur les fausses et les non lues. Le « ? » se mesure
//    au produit (règle + juge) sur 16 questions et 16 phrases affirmatives inventées, et non plus sur deux questions que le juge livré passait de justesse.
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
// liste n° 349 : l'orthographe hésite sur un non-mot (orange) — le juge relit le mot écrit et choisit parmi ses candidats et celui de l'orthographe
{ const f = marques('Il nous rapellerait demain matin.').filter((x) => x.word === 'rapellerait'); if (f.length !== 1 || f[0].sugg !== 'rappellerait' || !f[0].jugeOrtho || f[0].tier !== 'vigilance') err.push('liste n° 349 : « rapellerait » → rappellerait (orange, choisi par le juge), rendu ' + JSON.stringify(f.map((x) => x.sugg + ' ' + x.tier))); }

// liste n° 383 : un mot INCONNU reçoit aussi son anagramme du milieu (1re lettre + milieu trié + dernière, sans accents) avec le 7e trait « mêmes lettres » ;
// le juge la choisit sur une orange de l'orthographe ou un « mot inconnu ». Un mot connu n'en reçoit pas.
if (!D._juge.m.cfg.AN) err.push('liste n° 383 : le modèle livré n\'a pas le trait « mêmes lettres » (cfg.AN)');
if (!D._juge.cands('chaier').some((x) => x.m === 'cahier' && x.tr[6] === 1)) err.push('liste n° 383 : « cahier » (anagramme du milieu, trait 1) manque aux candidats de « chaier »');
if (D._juge.cands('loin').some((x) => x.m === 'lion')) err.push('liste n° 383 : un mot connu ne reçoit pas d\'anagramme (« loin » → lion)');
for (const [t, w, s] of [['Le petit garçon range son chaier dans le tiroir du bureau.', 'chaier', 'cahier'], ['Pour aller au marché, tourne à gauhce après la fontaine.', 'gauhce', 'gauche'], ['Les joueurs ont posé leurs raquetets contre le mur du gymnase.', 'raquetets', 'raquettes'], ['Le chien cahcait ses os sous le vieux banc.', 'cahcait', 'cachait']]) {
  const f = marques(t).filter((x) => x.word === w); if (f.length !== 1 || f[0].sugg !== s || !f[0].jugeOrtho || f[0].tier !== 'vigilance') err.push('liste n° 383 : « ' + t + ' » : attendu ' + w + ' → ' + s + ' (orange, choisi par le juge), rendu ' + JSON.stringify(f.map((x) => x.sugg + ' ' + x.tier)));
}

// liste n° 399 : 8e trait « lettres probables » = la moyenne des chances de faute par lettre (oubliée, ajoutée, mise pour une autre, inversée ; corpus public WiCoPaCo) sur le
// chemin de l'écrit au candidat. Pour un mot écrit INCONNU seulement ; l'arbitre (un accord) ne le lit pas. Valeurs attendues = celles de dictee/juge_lex.js (entraînement).
if (!D._juge.m.cfg.LT || !D._juge.lt) err.push('liste n° 399 : le modèle livré n\'a pas la table des lettres probables (cfg.LT)');
for (const [w, c, v] of [['chevaus', 'chevaux', 1.42], ['abeile', 'abeille', 1.19]]) { const x = D._juge.cands(w).find((y) => y.m === c); if (!x || x.tr[7] !== v) err.push('liste n° 399 : « ' + w + ' » → ' + c + ' : 8e trait ' + v + ' attendu (celui de l\'entraînement), rendu ' + (x && x.tr[7])); }
if (D._juge.cands('parle').some((x) => x.tr[7] !== 0)) err.push('liste n° 399 : un mot connu (« parle ») ne reçoit pas le 8e trait');
for (const [t, w, s] of [['Il a rangé sa chambre rapidemt avant le dîner.', 'rapidemt', 'rapidement'], ['Parle doucemt pour ne pas réveiller le bébé.', 'doucemt', 'doucement']]) {
  const f = marques(t).filter((x) => x.word === w); if (f.length !== 1 || f[0].sugg !== s || !f[0].jugeOrtho || f[0].tier !== 'vigilance') err.push('liste n° 399 : « ' + t + ' » : attendu ' + w + ' → ' + s + ' (orange, choisi par le juge), rendu ' + JSON.stringify(f.map((x) => x.sugg + ' ' + x.tier)));
}

for (const [t, nom] of [['Quand le soleil se couche sur la colline les enfants rentrent à la maison.', 'virgule'], ['Mon frère range son vélo dans le garage Il prépare ensuite le repas du soir.', 'point final']]) {
  const f = marques(t).filter((x) => x.juge && x.typo); if (!f.some((x) => x.name === nom && x.tier === 'vigilance')) err.push('« ' + t + ' » : attendu ' + nom + ', rendu ' + JSON.stringify(f.map((x) => x.name)));
}
// liste n° 477 : le « ? » au produit (règle des questions + juge) ; au moins 8 questions sur 16 (8 le 09/11), aucune phrase affirmative
{ const Q = ['Tu as vu mes clés quelque part', 'Vous venez dîner samedi', 'Où as-tu rangé le parapluie', 'Combien coûte ce vélo rouge', "Pourquoi la boulangerie est fermée aujourd'hui", 'Quand est-ce que le train arrive', 'Tu préfères le thé ou le café', 'Qui a ouvert toutes les fenêtres', 'Est-ce que le magasin ouvre le dimanche', 'On mange quoi ce soir', "Comment s'appelle ton professeur de piano", "Tu peux m'aider à porter ces cartons", 'À quelle heure commence le film', 'Vous avez trouvé la maison facilement', 'On part à quelle heure demain matin', 'Pourquoi les oiseaux partent vers le sud en hiver'];
  const S = ['Le train arrive à huit heures', 'Ma sœur range ses livres dans le salon', 'Nous avons trouvé la maison facilement', 'Le magasin ouvre le dimanche matin', 'Il a ouvert toutes les fenêtres du salon', 'Les enfants jouent dans le jardin', 'Je prends le thé avec du citron', 'Le film commence à neuf heures', "Mon professeur de piano s'appelle Martin", 'On mange des pâtes ce soir', 'Ce vélo rouge coûte deux cents euros', "Tu peux poser les cartons dans l'entrée", 'La boulangerie est fermée le lundi', 'Le parapluie est rangé derrière la porte', 'Mes clés sont sur la table de la cuisine', 'Nous mangerons des crêpes samedi soir chez ma tante'];
  const aQ = (t) => marques(t).some((x) => x.name === "point d'interrogation" || String(x.sugg).indexOf('?') >= 0), nq = Q.filter(aQ).length, fs_ = S.filter(aQ);
  console.log('« ? » au produit : ' + nq + ' questions sur ' + Q.length + ', ' + fs_.length + ' phrase(s) affirmative(s) sur ' + S.length);
  if (nq < 8) err.push('liste n° 477 : « ? » au produit sur ' + nq + ' questions inventées sur ' + Q.length + ' (8 attendues au moins)');
  if (fs_.length) err.push('liste n° 477 : « ? » sur une phrase affirmative : ' + JSON.stringify(fs_));
}
// liste n° 355 : point final quand le texte finit par un retour à la ligne, majuscule après « ! » suivi d'un retour à la ligne, espace remis après la virgule, virgule après « Cependant » en tête de chaque phrase
for (const [t, nom, sg] of [['Le chat dort sur le canapé\n', 'point final', '.'], ['Le repas était bon !\ndemain, nous partons.', 'majuscule', 'Demain'], ['Il pleut ,la route est mouillée.', 'espace avant la ponctuation', 't, l'], ['Il fait beau. Cependant le vent souffle fort.', 'virgule', ', ']]) {
  const f = marques(t); if (!f.some((x) => x.name === nom && x.sugg === sg)) err.push('liste n° 355 : « ' + t + ' » : attendu ' + nom + ' → ' + sg + ', rendu ' + JSON.stringify(f.map((x) => x.name + ' ' + x.sugg)));
}
// liste n° 476 : pas de point du juge au milieu d'une phrase devant un mot qui a déjà sa majuscule (un titre), sauf un pronom sujet,
// ni derrière une abréviation, un sigle ou un mot à point ; le point entre deux phrases sans majuscule reste
for (const t of ['Il a lu pendant les vacances le livre Comment parler aux oiseaux.', 'Le chanteur a enregistré la chanson Où sont les nuages.', 'Le peintre a exposé le tableau Un soir au port.', 'Les horaires sont sur le portail villes.fr qui sera ouvert en juin.']) {
  const f = marques(t).filter((x) => x.juge && x.typo && x.name !== 'virgule'); if (f.length) err.push('liste n° 476 : « ' + t + ' » : point du juge dans un titre ou après une abréviation ' + JSON.stringify(f.map((x) => x.name + ' ' + x.sugg)));
}
if (!marques('Il pleuvait très fort nous sommes restés à la maison.').some((x) => x.juge && x.name === 'point final' && x.sugg === '. N')) err.push('liste n° 476 : « Il pleuvait très fort nous sommes… » : point du juge attendu');
for (const t of ['Ah! comme il est grand.', 'Tu viens ? je pars.']) { if (marques(t).some((x) => x.name === 'majuscule')) err.push('liste n° 355 : « ' + t + ' » : majuscule de trop après « ! » ou « ? » sans retour à la ligne'); }
if (marques('Le café est bon.. enfin un endroit où on respire.').some((x) => x.name === 'virgule' && !x.juge)) err.push('liste n° 355 : virgule après « enfin » derrière des points de suspension');
if (marques('La maison est petite mais très jolie. Il fait beau tous les jours.').some((x) => x.name === 'virgule' && !x.juge)) err.push('liste n° 361 : virgule devant « mais » lue sur la phrase suivante');
// liste n° 376 : la virgule du vocatif — en tête de phrase ou après « : », un mot d'adresse ou un prénom + pronom sujet ; pas quand « nous » est complément
for (const t of ['Papa je rentre tard.', "Levons nos verres : Mamie nous t'aimons."]) if (!marques(t).some((x) => x.name === 'virgule' && !x.juge)) err.push('liste n° 376 : « ' + t + ' » : virgule du vocatif attendue');
for (const t of ['Paul nous a vus hier.', 'Maman nous emmène au parc.']) if (marques(t).some((x) => x.name === 'virgule' && !x.juge)) err.push('liste n° 376 : « ' + t + ' » : « nous » est complément, pas de virgule');
for (const t of ['Il regarde par la fenêtre pendant que sa fille dessine un bateau.', 'Nous mangerons des crêpes samedi soir chez ma tante']) { const f = marques(t).filter((x) => x.juge && x.typo); if (f.length) err.push('« ' + t + ' » : fausse ponctuation ' + JSON.stringify(f.map((x) => x.name))); }
for (const [w, ms] of [['parle', ['parlé', 'parlent']], ['parlé', ['parler', 'parlez']]]) { const c = D._juge.cands(w).map((x) => x.m); for (const m of ms) if (!c.includes(m)) err.push('candidats de « ' + w + ' » : ' + m + ' manque'); }

{ const G = D._juge, T = 'Les fruits que la voisine a cueillis sentent très bon.', tA = G.TA; marques(T);
  G.TA = 1e9; const avant = D.diagnoseAll(T).flags.filter((x) => x.word === 'sentent' && x.tier === 'vigilance').length; G.TA = tA;
  if (!avant) err.push('arbitre : la phrase témoin n\'a plus d\'orange à faire taire, en choisir une autre');
  if (marques(T).some((x) => x.word === 'sentent')) err.push('arbitre : l\'orange fausse « sentent » devait se taire');
  if (D.jugeAnalyseSync(T) !== 0 || D.jugeAnalyse(T, D.diagnoseAll(T).flags, null) !== false) err.push('arbitre : le silence relance un calcul');
  for (const [t, w] of [['Nous avons rencontré des gens très gentil au marché.', 'gentil'], ['Mes amies sont arrivé hier soir par le train.', 'arrivé'], ['Beaucoup de gens pense que la pluie reviendra demain.', 'pense'], ['Elle a acheté quatre belle assiettes au marché.', 'belle']]) if (!marques(t).some((x) => x.word === w && !x.juge)) err.push('arbitre : « ' + t + ' » : l\'orange juste sur « ' + w + ' » devait rester');
}

// liste n° 477 : plafond de ponctuation sur les fausses (lues à la main) et les non lues ; un plafond large sur le total garde contre un flot
const PLAFOND = 32, PLAFOND_PF = 6, PLAFOND_P = 40; let n = 0, ph = 0, np = 0; const PV = { juste: 0, possible: 0, fausse: 0 }, nonLues = [];
const LU = new Map(JSON.parse(fs.readFileSync(path.join(__dirname, 'juge_ponct_lu.json'), 'utf8')).lu.map(([k, cs, nom, v]) => [k + ':' + cs + ':' + nom, v]));
const L = fs.readFileSync(path.join(__dirname, 'fp_scale_corpus.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
L.forEach((l, k) => { const fl = marques(l), m = fl.filter(deMot).length; n += m; ph += m ? 1 : 0;
  for (const x of fl.filter((y) => y.juge && y.typo)) { np++; const v = LU.get(k + ':' + x.cs + ':' + x.name); if (v) PV[v]++; else nonLues.push(k + ':' + x.cs + ' ' + x.name + ' « …' + l.slice(Math.max(0, x.cs - 35), x.cs) + '⟦' + String(x.sugg).trim() + '⟧' + l.slice(x.ce, x.ce + 25) + '… »'); } });
console.log('français public : ' + n + ' marques sur ' + L.length + ' phrases (' + (100 * ph / L.length).toFixed(1) + ' %), plafond ' + PLAFOND + ' ; ponctuation ' + np + ' (lues : ' + PV.juste + ' justes, ' + PV.possible + ' possibles, ' + PV.fausse + ' fausses ; ' + nonLues.length + ' non lues), plafond fausses + non lues ' + PLAFOND_PF + ' ; parité ' + pire.toFixed(5) + ' ; fichier ' + (a.length / 1e6).toFixed(2) + ' Mo');
if (n > PLAFOND) err.push('fausses alertes sur français public : ' + n + ' > ' + PLAFOND);
if (PV.fausse + nonLues.length > PLAFOND_PF) err.push('ponctuation du juge sur le français public : ' + PV.fausse + ' fausses + ' + nonLues.length + ' non lues > ' + PLAFOND_PF + ' (lire chaque nouvelle marque et ajouter son verdict à dictee/juge_ponct_lu.json)' + (nonLues.length ? ' :\n    ' + nonLues.join('\n    ') : ''));
if (np > PLAFOND_P) err.push('ponctuation ajoutée au français public : ' + np + ' > ' + PLAFOND_P + ' (flot)');

// liste n° 383 : en page, jugeAnalyse bâtit l'index des anagrammes par tranches (une par tour) avant la première phrase, puis marque comme le calcul direct
function fin() { if (err.length) { console.error('JUGE LÉGER :\n  ' + err.join('\n  ')); process.exit(1); } console.log('juge léger OK'); }
{ const D3 = C({ ext: EXT, juge: true }), T3 = 'Le petit garçon range son chaier dans le tiroir du bureau.', st = global.setTimeout; let nT = 0;
  global.setTimeout = (f, d) => { nT++; return st(f, d); };
  const lance = D3.jugeAnalyse(T3, D3.diagnoseAll(T3).flags, () => { global.setTimeout = st; const f = D3.diagnoseAll(T3).flags.find((x) => x.word === 'chaier');
    if (!f || f.sugg !== 'cahier') err.push('liste n° 383 : en page (jugeAnalyse), « chaier » → cahier attendu, rendu ' + (f && f.sugg));
    if (nT < 20) err.push('liste n° 383 : l\'index des anagrammes doit se bâtir par tranches (' + nT + ' tours)'); fin(); });
  if (!lance) { global.setTimeout = st; err.push('liste n° 383 : jugeAnalyse ne lance aucun calcul'); fin(); } }
