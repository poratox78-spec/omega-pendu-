#!/usr/bin/env node
/* AUDIT DE LA VIRGULE contre la source fournie par Rem (Allô prof — « La virgule »).
 *
 * MÉTHODE, identique à celle de l'audit interrogatif : on prend ses exemples EXACTS, on RETIRE
 * les virgules, on fait tourner le moteur LIVRÉ, et on regarde s'il les remet AU BON ENDROIT.
 * Rien n'est corrigé avant d'être mesuré.
 *
 * ⚠️ CE QUI DIFFÈRE DE L'INTERROGATIF, ET QUI CHANGE TOUT. Le « ? » sort de RÈGLES qu'on peut
 * lire et amender une par une. La virgule, elle, sort d'un MODÈLE STATISTIQUE (`ponctDist`,
 * tables à replis apprises sur 694 949 phrases) : il n'y a pas de règle « complément de phrase
 * déplacé » à corriger, il y a une probabilité. Cet audit dit donc quelles FAMILLES d'Allô prof
 * le modèle attrape déjà et lesquelles lui échappent — c'est le préalable pour décider où une
 * règle explicite mérite d'être ajoutée PAR-DESSUS, et où elle ferait doublon.
 *
 * ⚠️ ON MESURE LA POSITION, PAS LE COMPTE. Une virgule au bon endroit et une virgule au hasard
 * font le même total ; seul l'appariement par INDICE DE MOT dit la vérité. (Leçon du 2026-08-06 :
 * le « 86 % de l'ancre » était un recouvrement de COMPTES, et j'en ai tiré une conclusion fausse
 * pendant une journée.)
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const RACINE = path.dirname(__dirname);

require(path.join(RACINE, 'extension', 'dys-core.js'));
const DC = global.DYSCORE;
DC.setPosHmm(JSON.parse(fs.readFileSync(path.join(RACINE, 'dictee', 'pos_hmm.json'), 'utf8')));
DC.setPonctLm(JSON.parse(zlib.gunzipSync(
  fs.readFileSync(path.join(RACINE, 'extension', 'assets', 'ponct-lm.json.gz'))).toString('utf8')));

/* ── LE MOTEUR DE VIRGULE TEL QU'IL EST LIVRÉ, extrait du fichier publié ─────────────────── */
const src = fs.readFileSync(path.join(RACINE, 'saisie-vocale.html'), 'utf8');
function lv(n) { const m = new RegExp('\\bvar\\s+' + n + '\\s*=').exec(src);
  if (!m) throw new Error('introuvable : var ' + n); return src.slice(m.index, src.indexOf(';', m.index) + 1); }
const PASAPRES = new Function(lv('_PASAPRES') + '\nreturn _PASAPRES;')();

/* Reproduit EXACTEMENT la boucle intra-segment de `prosodyText` : mêmes seuils (0,50 virgule /
   0,70 point), même garde `_PASAPRES`, même compteur `_dep` (distance depuis la dernière marque).
   ⚠️ On ne réécrit pas « une version équivalente » — on relit les seuils dans le fichier livré. */
const SEUILS = (() => {
  // ⚠️ on lit les seuils DANS LE FICHIER LIVRÉ et on refuse de tourner s'ils ont bougé de nom :
  // une sonde qui code les siens en dur mesure sa propre copie, pas la livraison.
  const m = /var _seuil = \(_d\w* && _d\w*\[2\]>_d\w*\[1\]\) \? ([0-9.]+) : ([0-9.]+);/.exec(src);
  if (!m) throw new Error('seuils intra-segment introuvables dans la livraison');
  return { point: parseFloat(m[1]), virgule: parseFloat(m[2]) };
})();

/* ⭐ LES REGLES D'ALLO PROF, si elles sont disponibles : le moteur complet = modele UNION regles.
   Chargement paresseux pour eviter la dependance circulaire entre les deux sondes. */
let _regles = null;
function regles(mots, deja) {
  if (_regles === null) { try { _regles = DC.ponctReglesVirgule.bind(DC); }
                          catch (e) { _regles = false; } }
  return _regles ? _regles(mots, null, deja) : new Set();
}
function virgulesPosees(mots) {
  const tg = DC.posTags(mots) || [], out = new Set();
  let dep = 0;
  for (let i = 0; i < mots.length - 1; i++) {
    if (PASAPRES[String(mots[i]).toLowerCase()]) { dep++; continue; }
    const d = DC.ponctDist(mots, tg, i, dep);
    if (!d) { dep++; continue; }
    const s = d[2] > d[1] ? SEUILS.point : SEUILS.virgule;
    if (d[1] > s || d[2] > s) { out.add(i); dep = 0; } else dep++;
  }
  // ⭐ Les regles s'appliquent APRES le modele et RECOIVENT ce qu'il a deja pose (`out`) —
  // exactement comme dans la livraison, ou elles recoivent modele + ancre. Sans ce passage, la
  // sonde mesurerait une variante qui n'est pas celle qui tourne chez Rem.
  if (process.env.OMEGA_REGLES === '1') for (const i of regles(mots, out)) out.add(i);
  return out;
}

/* Exporte le moteur pour que le BANC REEL (virgule_reel_probe.js) mesure EXACTEMENT la meme
   chose : un seul point de verite, jamais deux copies qui derivent. */
module.exports = { moteurVirgule: virgulesPosees, SEUILS };

/* ── LES EXEMPLES D'ALLÔ PROF, VERBATIM ─────────────────────────────────────────────────── */
const REF = [
  ['CP déplacé en tête', 'Tôt le matin, je promène mon chien.'],
  ['CP déplacé au milieu', 'Benito, chaque semaine, visite sa grand-mère.'],
  ['compl. du N — GN', 'Mon meilleur ami, Carl, est dans mon équipe de soccer.'],
  ['compl. du N — GAdj en tête', 'Malicieuse, la sorcière sortit la pomme de son panier.'],
  ['compl. du N — GAdj au milieu', 'Le mont Bélu, haut de 200 mètres, offre plusieurs pistes de ski.'],
  ['apostrophe en tête', 'Les enfants, placez-vous en cercle.'],
  ['apostrophe au milieu', 'Écris-moi, Mathias, quand tu auras le temps.'],
  ['incise', 'J’ai faim, a répété Andrei.'],
  ['incise encadrée', 'Aujourd’hui, confirme l’animateur, nous irons nous promener en forêt.'],
  ['marqueur de relation en tête', 'Par contre, nous devrons être vigilants.'],
  ['organisateur textuel en tête', 'Tout d’abord, il est important de saluer son courage.'],
  ['incidente en tête', 'Selon moi, la présentation ne durera pas très longtemps.'],
  ['incidente au milieu', 'La photographie, il me semble, est un peu floue.'],
  ['emphase — pronom détaché', 'Elle, je la connais depuis plusieurs années.'],
  ['emphase — reprise finale', 'Est-ce que cela te passionne, la robotique ?'],
  ['sub. CP justification', 'Il s’arrête sur le bord de la route, puisque son pneu est crevé.'],
  ['sub. CP conséquence', 'Elle s’exerce souvent, de sorte qu’elle se sent prête pour le concert.'],
  ['sub. CP opposition', 'Le kangourou bondit, alors que le koala dort.'],
  ['sub. CP hypothèse', 'Je te rejoindrai chez toi, à moins que tu ne sois déjà parti.'],
  ['relative EXPLICATIVE encadrée', 'Mon chalet, que j’ai acheté l’année dernière, est situé sur le bord d’un lac.'],
  ['juxtaposition de phrases', 'On achète, on jette, on regrette.'],
  ['juxtaposition de phrases', 'Il s’est levé, a rangé ses livres, est sorti, a claqué la porte.'],
  ['énumération de groupes', 'Tondre la pelouse, arroser le potager et nettoyer la cuisine sont les tâches hebdomadaires de Maxence.'],
  ['énumération simple', 'Laïla pratique la gymnastique, la course et le saut en hauteur.'],
  ['coordination — car (cause)', 'Le chien se repose, car il est épuisé.'],
  ['coordination — donc (conséquence)', 'Théo veut observer des gorilles, donc il ira au zoo.'],
  ['coordination — c’est pourquoi', 'Mikaël est fiévreux, c’est pourquoi il est absent aujourd’hui.'],
  ['coordination — comme (comparaison)', 'La citrouille, comme la courgette, appartient à la famille des cucurbitacés.'],
  ['ni répété plus de deux fois', 'Béatrice ne peut ni parler, ni manger, ni bouger.'],
  ['effacement (ellipse)', 'Pierre préfère les aliments salés et Micheline, la nourriture sucrée.'],
  ['terme répété — accent', 'Cet homme est très, très grand.'],
  ['corrélation autant… autant', 'Autant j’ai envie de faire la fête, autant j’ai besoin de me reposer.'],
  ['corrélation moins… moins', 'Moins je fais de sport, moins j’ai d’énergie.'],
  ['corrélation soit… soit', 'Il faudrait poser ta question soit à un ami, soit à ton enseignant.'],
  ['et — opposition', 'Tu veux que j’arrive à l’heure, et tu es en retard de quinze minutes !'],
  ['et — sujets différents', 'Claire ira au magasin acheter la nourriture, et vous décorerez la salle de réception.'],
  ['par exemple — en tête', 'Par exemple, on porte en moyenne vingt pour cent des vêtements de notre garde-robe.'],
  ['interjection', 'Zut, j’ai encore oublié mes clés !'],
];
/* ⛔ LES NÉGATIFS — « éléments à ne pas séparer ». Une virgule ici est une FAUTE, et c'est la
   moitié la plus importante de l'audit : un moteur qui met des virgules partout aurait 100 % de
   rappel et serait inutilisable. */
const NEG = [
  ['sujet / prédicat', 'La plage est recouverte de déchets.'],
  ['verbe / complément direct', 'La toile présente un ciel étoilé.'],
  ['verbe / complément indirect', 'Emilio doute de sa sincérité.'],
  ['verbe attributif / attribut', 'La poésie demeure ma principale inspiration.'],
  ['CD / attribut du CD', 'Marie-Caroline sentit son cœur battre.'],
  ['pas de virgule devant « et »', 'Laïla pratique la gymnastique et la course.'],
  ['sub. CP en fin (cas ordinaire)', 'Je te préviendrai quand j’aurai fini.'],
];

/* Les indices de mot APRÈS lesquels la référence porte une virgule. */
function attendues(phrase) {
  const jets = phrase.match(/[A-Za-zÀ-ÿœŒ'’-]+|,/g) || [];
  const out = new Set();
  let n = 0;
  for (const j of jets) { if (j === ',') out.add(n - 1); else n++; }
  return out;
}
const sansVirgule = p => p.replace(/,/g, '');

let vp = 0, fp = 0, fn = 0;
const parFam = {};
console.log('AUDIT DE LA VIRGULE — source : Allô prof, exemples verbatim\n');
for (const [fam, phrase] of REF) {
  const att = attendues(phrase), mots = DC.toks(sansVirgule(phrase)) || [];
  const got = virgulesPosees(mots);
  let j = 0, m = 0, t = 0;
  for (const i of att) { if (got.has(i)) j++; else m++; }
  for (const i of got) if (!att.has(i)) t++;
  vp += j; fn += m; fp += t;
  parFam[fam] = (parFam[fam] || 0) + j;
  const etat = m === 0 && t === 0 ? '✓' : (j ? '~' : '✗');
  console.log('  ' + etat + ' ' + String(j + '/' + att.size).padEnd(5) +
              (t ? '(+' + t + ' en trop) ' : '           ') + fam);
}
console.log('\n⛔ NE PAS SÉPARER (une virgule ici est une faute) :');
let negOk = 0;
for (const [fam, phrase] of NEG) {
  const mots = DC.toks(phrase.replace(/,/g, '')) || [];
  const got = virgulesPosees(mots);
  if (!got.size) negOk++;
  console.log('  ' + (got.size ? '✗ ' + got.size + ' virgule(s) ' : '✓ aucune    ') + fam);
}
console.log('\n──────────────────────────────────────────────');
console.log('  virgules attendues trouvées : ' + vp + '/' + (vp + fn) +
            '  (' + (100 * vp / Math.max(1, vp + fn)).toFixed(0) + ' %)');
console.log('  virgules EN TROP            : ' + fp);
console.log('  « ne pas séparer » respecté : ' + negOk + '/' + NEG.length);
