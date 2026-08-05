#!/usr/bin/env node
/**
 * proso_probe.js — GARDE CI DE LA PONCTUATION VOCALE (site + extension)
 *
 * POURQUOI CE FICHIER EXISTE, ET POURQUOI IL EST ÉCRIT COMME ÇA
 * ------------------------------------------------------------
 * Trois fautes de méthode payées le 2026-08-04 sont encodées ici comme contraintes :
 *
 *  ① UN BANC QUI RÉ-IMPLÉMENTE LA RÈGLE NE TESTE PAS LA LIVRAISON. On a écrit deux fois
 *     une copie « équivalente » de la règle dans le banc — elle passait pendant que le
 *     fichier livré, lui, était faux. Ici on EXTRAIT le code source des deux fichiers
 *     livrés et on l'évalue. Si la livraison change, le banc change avec elle.
 *
 *  ② UNE SONDE QUI LIT DU CODE PAR REGEX ATTRAPE SES PROPRES COMMENTAIRES. Trois fois une
 *     sonde a lu la valeur DOCUMENTÉE au lieu de la valeur du CODE (`quality`,
 *     `maxAlternatives`, `PERIOD_MS`). Ici on ne cherche aucune constante par regex : on
 *     fait TOURNER la fonction et on regarde le TEXTE qu'elle produit.
 *
 *  ③ UN BANC DONT J'ÉCRIS L'ENTRÉE *ET* L'ATTENDU NE TESTE RIEN. Les attendus ci-dessous
 *     viennent de SOURCES : le BDL/OQLF pour les règles de ponctuation, et les phrases
 *     réellement dictées par Rem pour les régressions. Chaque cas cite sa source.
 *
 * L'audio est SYNTHÉTIQUE, aux silences CONNUS : on sait donc exactement ce qui doit sortir.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SITE = path.join(RACINE, 'saisie-vocale.html');
const EXT = path.join(RACINE, 'extension', 'sidepanel.js');

/* ⭐ LE TAGGER, VRAI. Depuis le 2026-08-05 la détection de question passe par les PARTIES DU
   DISCOURS (`DC.posTags` / `DC.toks`). Une sonde qui ne fournirait PAS le tagger ne testerait que
   la voie dégradée — c'est-à-dire rien de ce qui vient d'être ajouté, tout en restant verte.
   On charge donc dys-core et le modèle HMM comme le fait parity_pos.js, et on l'injecte dans le
   bac à sable où la fonction extraite est évaluée. */
require(path.join(RACINE, 'extension', 'dys-core.js'));
const DC = global.DYSCORE;
DC.setPosHmm(JSON.parse(fs.readFileSync(path.join(RACINE, 'dictee', 'pos_hmm.json'), 'utf8')));
/* ⭐ ET LE CANAL TEXTE DE LA PONCTUATION. Même leçon que pour le tagger : une sonde qui ne le
   charge PAS ne teste que la voie dégradée — elle resterait verte en ne mesurant rien de ce qui
   vient d'être ajouté. On décompresse l'asset livré et on l'injecte. */
DC.setPonctLm(JSON.parse(require('zlib').gunzipSync(
  fs.readFileSync(path.join(RACINE, 'extension', 'assets', 'ponct-lm.json.gz'))).toString('utf8')));

/* ── EXTRACTION : on prend le code du fichier LIVRÉ, par équilibrage d'accolades. ───────── */
function bloc(src, entete) {
  const i = src.indexOf(entete);
  if (i < 0) throw new Error('introuvable dans la livraison : ' + entete);
  let j = src.indexOf('{', i), p = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') p++;
    else if (src[k] === '}') { p--; if (!p) return src.slice(i, k + 1); }
  }
  throw new Error('accolades non fermées : ' + entete);
}
function ligneVar(src, nom) {
  // « var X=/…/i; » ou « var X={}; » : on prend jusqu'au ';' de fin de ligne logique
  const re = new RegExp('\\bvar\\s+' + nom + '\\s*=', 'g');
  const m = re.exec(src);
  if (!m) throw new Error('introuvable dans la livraison : var ' + nom);
  const fin = src.indexOf(';', m.index);
  return src.slice(m.index, fin + 1);
}

function charge(fichier, nomProso) {
  const src = fs.readFileSync(fichier, 'utf8');
  const morceaux = [
    ligneVar(src, '_MAJOUTIL'),
    ligneVar(src, '_NOMPROPRE'),
    bloc(src, 'function normMajInterne('),
    ligneVar(src, '_SALUT'),
    ligneVar(src, '_GOUVERNE'),
    bloc(src, 'function teteHorsPhrase('),
    ligneVar(src, '_PASAPRES'),
    /* ⭐ LE SEUIL DE REFUS DE L'ANCRE, extrait NOMMÉMENT du fichier livré : s'il disparaît ou
       change de nom, la sonde casse au lieu de mesurer autre chose que ce qui est publié. */
    ligneVar(src, 'PONCT_ANCRE_TAU'),
    bloc(src, 'function _avantTiret('),
    bloc(src, 'function _poseMarques('),
    bloc(src, 'function _seuilSilence('),
    bloc(src, 'function silBetween('),
    bloc(src, 'function riseEndingAt('),
    bloc(src, 'function ' + nomProso + '('),
  ];
  // la capitalisation s'appelle capitalize() sur le site, capV() dans l'extension
  morceaux.push(src.includes('function capitalize(') ? bloc(src, 'function capitalize(')
                                                     : bloc(src, 'function capV('));
  const code = morceaux.join('\n') + '\nreturn ' + nomProso + ';';
  return new Function('DC', code)(DC);   // DC = le moteur RÉEL, tagger compris (cf. en-tête)
}

/* ── AUDIO SYNTHÉTIQUE : une timeline 30 ms dont on CHOISIT les silences. ───────────────── */
// pauses = [{apres: <ms depuis le début>, duree: <ms>}] ; le reste est de la parole.
function timeline(dureeMs, pauses, pitchFin) {
  const tl = [];
  for (let t = 0; t < dureeMs; t += 30) {
    const mute = pauses.some(p => t >= p.apres && t < p.apres + p.duree);
    // f = pitch (Hz) ; on ne fait monter la fin que si le cas le demande
    const versLaFin = t > dureeMs - 500;
    tl.push({ t, r: mute ? 0.001 : 0.20, f: mute ? 0 : (versLaFin && pitchFin ? 260 : 200) });
  }
  return { tl, maxr: 0.20 };
}
function etat(segments, ftimes, pauses, opts) {
  opts = opts || {};
  const finals = {}, ft = {};
  segments.forEach((s, i) => { finals[i] = s; ft[i] = ftimes[i]; });
  const duree = Math.max.apply(null, ftimes) + 400;
  return {
    finals, ftimes: ft, base: '',
    au: opts.sansAudio ? null : timeline(duree, pauses || [], opts.pitchFin),
  };
}

/* ── LES CAS. Chacun porte SA SOURCE. ──────────────────────────────────────────────────── */
const CAS = [];
const cas = (nom, source, state, attendu) => CAS.push({ nom, source, state, attendu });

/* ①  LE PLANCHER À 190 ms — sous le plancher, AUCUNE marque.
 *    Source : calibration d'origine de la voie A (commit 32ba743, COMMA=190).
 *    Régression réelle : perdu en PR#311 côté site, et TOUJOURS absent côté extension
 *    jusqu'au 2026-08-04 (`sil>=600?'.':','` donnait une virgule même à 0 ms). */
cas('plancher 190 : 90 ms de silence -> AUCUNE marque',
    'voie A 32ba743 (COMMA=190)',
    etat(['il fait beau', 'je sors'], [1000, 2000], [{ apres: 1050, duree: 90 }]),
    'Il fait beau je sors.');
cas('bande virgule : 300 ms -> virgule',
    'voie A 32ba743 (190 <= x < 600)',
    etat(['il fait beau', 'je sors'], [1000, 2000], [{ apres: 1050, duree: 300 }]),
    'Il fait beau, je sors.');
cas('bande point : 900 ms -> point',
    'voie A 32ba743 (PERIOD=600)',
    etat(['il fait beau', 'je sors'], [1000, 2000], [{ apres: 1050, duree: 900 }]),
    'Il fait beau. Je sors.');

/* ②  PAS DE VIRGULE DEVANT « et / ou / ni ».
 *    Source : BDL/OQLF « La virgule avec la conjonction ET » — « On ne met habituellement
 *    pas de virgule devant et après la conjonction de coordination et. » (idem OU, NI).
 *    On ne RÉTROGRADE que la virgule : un vrai point reste un point. */
cas('virgule devant « et » -> supprimée',
    'BDL, virgule avec la conjonction ET',
    etat(['il fait beau', 'et je sors'], [1000, 2000], [{ apres: 1050, duree: 300 }]),
    'Il fait beau et je sors.');
cas('virgule devant « ou » -> supprimée',
    'BDL, virgule avec la conjonction OU',
    etat(['on reste ici', 'ou on rentre'], [1000, 2000], [{ apres: 1050, duree: 300 }]),
    'On reste ici ou on rentre.');
cas('POINT devant « et » -> CONSERVÉ (on ne rétrograde que la virgule)',
    'BDL : « Et » en tête de phrase est attesté',
    etat(['il fait beau', 'et je sors'], [1000, 2000], [{ apres: 1050, duree: 900 }]),
    'Il fait beau. Et je sors.');
cas('« mais » garde sa virgule (la règle ne vise QUE et/ou/ni)',
    'BDL : la virgule est usuelle devant MAIS',
    etat(['il fait beau', 'mais je reste'], [1000, 2000], [{ apres: 1050, duree: 300 }]),
    'Il fait beau, mais je reste.');

/* ③  LE MOT DE TÊTE HORS PHRASE.
 *    Source : BDL/OQLF « La virgule avec les apostrophes » — en tête de phrase, la première
 *    virgule est omise, la seconde reste. Mesuré : 0 contre-exemple structurel sur les
 *    53 cas non séparés relevés dans 694 949 phrases (Wiktionnaire FR + UD FR GSD). */
cas('« bonjour tout le monde » -> virgule après la salutation',
    'BDL, virgule avec les apostrophes',
    etat(['bonjour tout le monde'], [1500], []),
    'Bonjour, tout le monde.');
cas('« salut les filles » -> virgule',
    'BDL, virgule avec les apostrophes',
    etat(['salut les filles'], [1500], []),
    'Salut, les filles.');
cas('GARDE : « bonjour à tous » -> le mot GOUVERNE, aucune virgule',
    'mesuré : la préposition qui suit prouve le gouvernement',
    etat(['bonjour à tous'], [1500], []),
    'Bonjour à tous.');
cas('GARDE : « salut bien monsieur » -> « salut bien » gouverne',
    'seul vrai contre-exemple des 53 cas relus',
    etat(['salut bien monsieur'], [1500], []),
    'Salut bien monsieur.');
cas('GARDE : « merci » n\'est PAS dans la liste (mesuré 48,2 %)',
    'mesuré : « merci bien », « merci beaucoup » gouvernent',
    etat(['merci beaucoup'], [1500], []),
    'Merci beaucoup.');
/* ⚠️⚠️ ATTENDU MIS À JOUR LE 2026-08-06 — et il faut dire pourquoi plutôt que de le changer en
 * douce. Ce cas vérifiait que `teteHorsPhrase` ne s'applique qu'au PREMIER segment : c'est
 * toujours vrai et toujours vérifié (la fonction n'est appelée que si s===0). Mais l'attendu
 * portait AUSSI l'absence de virgule après « bonjour » dans le SECOND segment, et cette absence
 * n'était pas une exigence : c'était le constat qu'AUCUNE couche ne savait la poser là.
 * L'ancre + le canal texte la posent désormais, et le BDL leur donne raison — « Bonjour les
 * amis » est une APOSTROPHE, et le commentaire de `teteHorsPhrase` dit lui-même que les 53 cas
 * non séparés relevés dans le corpus « sont TOUS des apostrophes, où le BDL PRESCRIT la
 * virgule … c'est du relâchement d'écriture, exactement ce qu'on est là pour réparer ».
 * On corrige donc l'attendu vers le FRANÇAIS, pas vers le comportement du code. */
cas('la salutation ne s\'applique qu\'au PREMIER segment (mais l\'apostrophe est séparée)',
    'règle : élément hors phrase EN TÊTE · BDL : apostrophe -> virgule',
    etat(['je passe demain', 'bonjour les amis'], [1000, 2000], [{ apres: 1050, duree: 900 }]),
    'Je passe demain. Bonjour, les amis.');

/* ③bis  LA MAJUSCULE INTERNE DE GOOGLE. Trouvée en rejouant la prise LIBRE de Rem : Google
 *       rend « bonjour Qu'est-ce que je fais » — la majuscule est au MILIEU du segment. Sans
 *       normalisation, la règle ③ produisait « Bonjour, Qu'est-ce que… ». */
cas('⭐ majuscule interne de Google après la virgule de salutation',
    'prise libre de Rem : segment « bonjour Qu\'est-ce que je fais aujourd\'hui »',
    etat(['bonjour Qu\'est-ce que je fais aujourd\'hui'], [2000], []),
    'Bonjour, qu\'est-ce que je fais aujourd\'hui.');
cas('GARDE nom propre : « La Rochelle » n\'est PAS démajusculé',
    'la liste fermée ne doit pas manger les noms propres composés',
    etat(['je pars à La Rochelle'], [1500], []),
    'Je pars à La Rochelle.');
cas('GARDE nom propre : « Paris » intact (hors liste fermée)',
    'seuls des mots-outils sont démajusculés',
    etat(['je vais à Paris demain'], [1500], []),
    'Je vais à Paris demain.');

/* ④  LA DÉTECTION DE QUESTION — les familles de FAUX POSITIFS mesurées (45,5 % -> 100 %).
 *    Source : mesure sur 48 653 phrases réelles (UD FR GSD + WiCoPaCo + GEC) pour les
 *    familles, et BDL « Phrase interrogative » pour l'interrogation indirecte. */
cas('question RÉELLE : « est-ce que » -> ? avec espace avant',
    'BDL : locution est-ce que + Lexique de l\'Imprimerie nationale (espace avant ?)',
    etat(['est-ce que tu viens demain'], [1500], []),
    'Est-ce que tu viens demain ?');
cas('question RÉELLE : interrogatif + inversion',
    'BDL : inversion sujet-verbe',
    etat(['où en sommes-nous'], [1500], []),
    'Où en sommes-nous ?');
/* ⚠️⚠️ ATTENDU MIS À JOUR LE 2026-08-05, et il faut dire pourquoi plutôt que de le changer en
 * douce. Ce cas vérifie que « quand » SUBORDONNANT ne déclenche PAS de « ? » — c'est toujours
 * son objet, et c'est toujours vérifié. Mais l'attendu portait AUSSI l'absence de virgule, et
 * cette absence n'était pas une exigence : c'était le constat qu'AUCUNE couche ne savait la
 * poser. Le canal texte la pose désormais, et le BDL lui donne raison — une subordonnée
 * ANTÉPOSÉE se sépare par une virgule (« Quand ils reviennent, ils tentent… »).
 * On corrige donc l'attendu vers le FRANÇAIS, pas vers le comportement du code. */
cas('FP « quand » SUBORDONNANT -> point (et virgule de subordonnée antéposée)',
    'mesuré : famille de faux positifs n°1 · BDL : subordonnée antéposée -> virgule',
    etat(['quand ils reviennent ils tentent de recommencer'], [1500], []),
    'Quand ils reviennent, ils tentent de recommencer.');
cas('FP « quelle » EXCLAMATIF -> point',
    'mesuré : famille de faux positifs n°2',
    etat(['quelle jolie décoration'], [1500], []),
    'Quelle jolie décoration.');
cas('FP « où » RELATIF -> point',
    'mesuré : famille n°3 (un segment peut commencer au milieu d\'une phrase)',
    etat(['où v est la vitesse du point considéré'], [1500], []),
    'Où v est la vitesse du point considéré.');
cas('⭐ FP INTERROGATION INDIRECTE -> point (phrase réellement dictée par Rem)',
    'BDL : « Je me demande si… » prend le point, pas le point d\'interrogation',
    etat(['mais je me demande à quelle heure'], [1500], []),
    'Mais je me demande à quelle heure.');
// ⚠️ LE cas qui fait vraiment mal, et que le précédent ne couvre PAS : la règle s'ancre sur la
// TÊTE du segment, or Google coupe AU MILIEU de l'énoncé. Une subordonnée devient alors un
// segment à part entière, avec l'interrogatif en tête. L'ancienne règle y posait un « ? ».
cas('⭐ FP subordonnée coupée par Google : « quelle heure il est » -> point',
    'BDL (interrogation indirecte) + segmentation Web Speech mesurée',
    etat(['quelle heure il est'], [1500], []),
    'Quelle heure il est.');
cas('mais la vraie question directe passe toujours : « quelle heure est-il »',
    'BDL : inversion sujet-verbe après interrogatif',
    etat(['quelle heure est-il'], [1500], []),
    'Quelle heure est-il ?');
/* ④bis  LES FORMES QUE LA LISTE DE MOTS NE VOYAIT PAS — c'est Rem qui les a nommées, et la
 *       détection par PARTIES DU DISCOURS est là pour elles. Sans le tagger injecté en tête de
 *       ce fichier, ces cas passeraient en silence par la voie dégradée. */
cas('⭐ INTERRO-NÉGATIVE avec inversion',
    'BDL : inversion sujet-verbe ; forme nommée par Rem, ratée par la liste de mots',
    etat(['ne viens-tu pas avec nous'], [1500], []),
    'Ne viens-tu pas avec nous ?');
cas('⭐ INTERRO-NÉGATIVE élidée',
    'idem, avec élision',
    etat(["n'as-tu pas vu le film"], [1500], []),
    "N'as-tu pas vu le film ?");
cas('⭐ question-tag « n\'est-ce pas » en fin',
    'expression figée, aucune ambiguïté',
    etat(['tu viens demain n\'est-ce pas'], [1500], []),
    'Tu viens demain n\'est-ce pas ?');
cas('⭐ INVERSION NUE (refusée en lexical à 69,4 %, rendue sûre par le tagger)',
    'le tagger confirme VERB avant le clitique postposé',
    etat(['viens-tu demain'], [1500], []),
    'Viens-tu demain ?');
cas('⭐ INVERSION NUE 3e personne',
    'idem',
    etat(['est-il déjà parti'], [1500], []),
    'Est-il déjà parti ?');
cas('GARDE IMPÉRATIF : « abonnez-vous » n\'est PAS une question',
    'mesuré : nous/vous sont exclus de l\'inversion nue (l\'impératif les prend)',
    etat(['abonnez-vous dès maintenant'], [1500], []),
    'Abonnez-vous dès maintenant.');
cas('GARDE INCISE EN TÊTE : « disent-ils, … » n\'est PAS une question',
    'faux positif mesuré sur fragment : la virgule referme l\'incise',
    etat(['disent-ils peuvent jouer un rôle'], [1500], []),
    'Disent-ils peuvent jouer un rôle.');
cas('GARDE : interrogation INDIRECTE avec « est-ce que » enchâssé',
    'BDL + faux positif mesuré : « est-ce que » doit être EN TÊTE',
    etat(['il se demande quand est-ce qu\'il va sortir'], [1500], []),
    'Il se demande quand est-ce qu\'il va sortir.');
cas('GARDE : « comment » + GROUPE NOMINAL = interrogation indirecte',
    'faux positif mesuré, fermé par le DET que voit le tagger',
    etat(['comment une personne obtient chacun des points'], [1500], []),
    'Comment une personne obtient chacun des points.');

cas('FP inversion STYLISTIQUE sans interrogatif -> point',
    'mesuré : l\'inversion seule ne fait que 69,4 %',
    etat(['peut-être est-elle déjà partie'], [1500], []),
    'Peut-être est-elle déjà partie.');
cas('FP phrase LONGUE avec interrogatif en tête -> point (garde des 12 mots)',
    'mesuré : titres et sous-phrases longues',
    etat(['comment réussir en amour et en affaires est un film de deux mille douze'], [1500], []),
    'Comment réussir en amour et en affaires est un film de deux mille douze.');

/* ⑤  RÉGRESSIONS RÉELLES : les 3 phrases que Rem a dictées et qui ont fait retirer les
 *    marques INTRA-SEGMENT. Le silence intra-segment est DÉLIBÉRÉMENT présent dans l'audio :
 *    il doit être IGNORÉ. Une virgule entre un déterminant et son nom est inacceptable. */
cas('RÉGRESSION Rem : pas de « à la, plage » malgré un silence dans le segment',
    'dicté par Rem, PR#380 (mesuré-réfuté)',
    etat(['est-ce que je vais à la plage aujourd\'hui'], [3000], [{ apres: 1500, duree: 700 }]),
    'Est-ce que je vais à la plage aujourd\'hui ?');
cas('RÉGRESSION Rem : pas de « Dessine-moi, un mouton »',
    'dicté par Rem, PR#380 (mesuré-réfuté)',
    etat(['dessine-moi un mouton'], [2500], [{ apres: 1200, duree: 700 }]),
    'Dessine-moi un mouton.');
cas('RÉGRESSION Rem : pas de « manger, du, chocolat »',
    'dicté par Rem, PR#380 (mesuré-réfuté)',
    etat(['je veux manger du chocolat'], [2500], [{ apres: 1200, duree: 800 }]),
    'Je veux manger du chocolat.');
/* ⚠️⚠️ ATTENDU MIS À JOUR LE 2026-08-06, même discipline. Ce que ce cas GARDE — et qu'il garde
 * toujours — c'est la régression que Rem a signalée : SIX POINTS dans un segment de 7,9 s
 * (score de placement 2/10). Aucun POINT interne ne doit sortir ici, et il n'en sort aucun.
 * Mais l'attendu exigeait AUSSI zéro virgule, ce qui n'était pas la régression : c'était l'état
 * d'un moteur incapable de rien poser à l'intérieur. Les deux pauses de 800 et 900 ms sont dans
 * l'audio du cas, donc RÉELLES ; les ignorer, ce serait jeter la seule information qu'on ait.
 * ⭐ Et c'est ici que se voit la correction de fond du 2026-08-06 : le TYPE de la marque vient
 * désormais du canal TEXTE et non d'une falaise à 600 ms. Une pause de 900 ms donne une VIRGULE
 * parce que la grammaire dit virgule — mesuré sur la voix de Rem, qui se tait 1530 ms là où il
 * écrit une virgule. La falaise valait pour du discours lu, pas pour la dictée dys. */
cas('RÉGRESSION prise libre : un segment long ne reçoit AUCUN POINT interne',
    'prise libre de Rem : 6 points posés dans un segment de 7,9 s, score 2/10',
    etat(['alors demain je ne sais pas encore on va aller au marché'], [7900],
         [{ apres: 2000, duree: 800 }, { apres: 4000, duree: 900 }]),
    'Alors demain, je ne sais pas encore, on va aller au marché.');

/* ⑥  SANS AUDIO (getUserMedia refusé) : la chaîne doit dégrader, pas planter. */
cas('sans audio : repli sur les règles lexicales',
    'dégradation douce (getUserMedia peut échouer)',
    etat(['il fait beau', 'mais je reste'], [1000, 2000], null, { sansAudio: true }),
    'Il fait beau, mais je reste.');
cas('sans audio : « et » ne prend toujours pas de virgule',
    'BDL + dégradation douce',
    etat(['il fait beau', 'et je sors'], [1000, 2000], null, { sansAudio: true }),
    'Il fait beau et je sors.');

/* ── EXÉCUTION SUR LES DEUX SURFACES ───────────────────────────────────────────────────── */
const surfaces = [
  { nom: 'site  saisie-vocale.html', f: charge(SITE, 'prosodyText') },
  { nom: 'ext.  sidepanel.js', f: charge(EXT, 'prosodyText') },
];

let ko = 0, total = 0;
for (const s of surfaces) {
  for (const c of CAS) {
    total++;
    let obtenu;
    try { obtenu = s.f(JSON.parse(JSON.stringify(c.state))); }
    catch (e) { obtenu = 'ERREUR ' + e.message; }
    if (obtenu !== c.attendu) {
      ko++;
      console.log('✗ [' + s.nom + '] ' + c.nom);
      console.log('    source  : ' + c.source);
      console.log('    attendu : ' + JSON.stringify(c.attendu));
      console.log('    obtenu  : ' + JSON.stringify(obtenu));
    }
  }
}

/* ── PARITÉ : les deux surfaces doivent produire EXACTEMENT le même texte. ──────────────── */
let divergences = 0;
for (const c of CAS) {
  const r = surfaces.map(s => {
    try { return s.f(JSON.parse(JSON.stringify(c.state))); } catch (e) { return 'ERREUR'; }
  });
  if (r[0] !== r[1]) {
    divergences++;
    console.log('✗ PARITÉ : ' + c.nom);
    console.log('    site : ' + JSON.stringify(r[0]));
    console.log('    ext. : ' + JSON.stringify(r[1]));
  }
}

console.log('');
console.log('proso_probe : ' + (total - ko) + '/' + total + ' cas · ' +
            (divergences ? divergences + ' DIVERGENCE(S) de parité' : 'parité 2 surfaces OK'));
if (ko || divergences) process.exit(1);
