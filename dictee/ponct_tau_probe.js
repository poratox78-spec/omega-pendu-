#!/usr/bin/env node
/* LE BANC DE CALIBRATION DE L'ARBITRE — et l'unité de mesure, enfin dite clairement.
 *
 * L'UNITÉ. Rem, 2026-08-05 : « je vois des pourcentages mais je ne sais pas à quoi ça
 * correspond ». Juste. Ici il n'y en a que deux, et elles se lisent en français :
 *    JUSTESSE = sur 100 marques que le moteur écrit, combien sont à la bonne place ET du bon type
 *    RAPPEL   = sur 100 marques que le texte de référence porte, combien le moteur en trouve
 * Rien d'autre. Pas de F1 sans dénominateur, pas de « 96,2 % » orphelin.
 *
 * LE BANC. 93 clips de VoxPopuli (parlement européen, 47 locuteurs) où l'on connaît À LA FOIS le
 * texte ponctué par des humains ET l'audio. Pour chaque interstice de mot on a le silence vu par
 * EXACTEMENT le détecteur du navigateur (`sil_rms`) — pas la version wav2vec2, qui n'existe pas
 * dans Chrome et ne prouverait donc rien sur ce qu'on livre.
 *
 * ⭐ ON SIMULE GOOGLE, ET C'EST CE QUI REND LE BANC HONNÊTE. Web Speech finalise un segment sur
 * une pause longue : on coupe donc où `sil_rms >= 600`, exactement comme lui. On reconstruit une
 * timeline RMS qui reproduit les silences mesurés, puis on appelle `prosodyText` EXTRAIT DU
 * FICHIER LIVRÉ. C'est le pipeline complet — voie A (segments + mots) × voie B (notre capture) —
 * qui est mesuré, pas une maquette de laboratoire.
 *
 * ⚠️ CE QUE CE BANC N'EST PAS : la garde CI (`proso_probe.js`, 82 cas). Celle-là est écrite à la
 * main pour verrouiller des régressions nommées ; s'en servir pour régler τ serait se calibrer sur
 * ses propres réponses. Ici on règle sur du texte que personne chez nous n'a écrit.
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const RACINE = path.dirname(__dirname);

require(path.join(RACINE, 'extension', 'dys-core.js'));
const DC = global.DYSCORE;
DC.setPosHmm(JSON.parse(fs.readFileSync(path.join(RACINE, 'dictee', 'pos_hmm.json'), 'utf8')));
DC.setPonctLm(JSON.parse(zlib.gunzipSync(
  fs.readFileSync(path.join(RACINE, 'extension', 'assets', 'ponct-lm.json.gz'))).toString('utf8')));

/* ── extraction du code LIVRÉ (mêmes helpers que la garde CI) ───────────────────────────── */
function bloc(src, e) {
  const i = src.indexOf(e); if (i < 0) throw new Error('introuvable : ' + e);
  let j = src.indexOf('{', i), p = 0;
  for (let k = j; k < src.length; k++) { if (src[k] === '{') p++; else if (src[k] === '}') { p--; if (!p) return src.slice(i, k + 1); } }
  throw new Error('accolades : ' + e);
}
function lv(src, n) {
  const m = new RegExp('\\bvar\\s+' + n + '\\s*=').exec(src);
  if (!m) throw new Error('introuvable : var ' + n);
  return src.slice(m.index, src.indexOf(';', m.index) + 1);
}
/* ⭐ LE « AVANT ». Sans lui, une mesure ne dit rien : « justesse 53 % » n'a de sens que comparé à
   ce que le même banc donnait à l'état publié. On extrait donc aussi l'ANCIENNE version, telle
   qu'elle est dans git, et on la fait tourner sur exactement les mêmes 93 clips.
   Elle n'a pas les mêmes noms de blocs (ni arbitre, ni routes) : on la reconnaît à l'absence de
   `R_COUPE` et on lui donne sa propre liste. */
function estAncienne(src) { return src.indexOf('var R_COUPE') < 0; }
function chargeAncienne(src) {
  const m = [lv(src, '_MAJOUTIL'), lv(src, '_NOMPROPRE'), bloc(src, 'function normMajInterne('),
    lv(src, '_SALUT'), lv(src, '_GOUVERNE'), bloc(src, 'function teteHorsPhrase('),
    lv(src, '_PASAPRES'), bloc(src, 'function _avantTiret('),
    bloc(src, 'function _poseMarques('), bloc(src, 'function _seuilSilence('),
    bloc(src, 'function silBetween('), bloc(src, 'function riseEndingAt('),
    bloc(src, 'function capitalize('), bloc(src, 'function prosodyText(')];
  if (src.indexOf('function _trancheTexte(') >= 0) m.splice(8, 0, bloc(src, 'function _trancheTexte('));
  if (src.indexOf('var PONCT_SEUIL_VG') >= 0) m.splice(7, 0, lv(src, 'PONCT_SEUIL_VG'));
  return new Function('DC', m.join('\n') + '\nreturn prosodyText;')(DC);
}

function charge(reglages, fichier) {
  let src = fs.readFileSync(fichier || path.join(RACINE, 'saisie-vocale.html'), 'utf8');
  if (estAncienne(src)) return chargeAncienne(src);
  // Le balayage ne réécrit PAS le fichier : il substitue la ligne de réglage dans la COPIE en
  // mémoire. Le reste du code testé reste bit pour bit celui qui est publié.
  for (const [nom, val] of Object.entries(reglages || {}))
    src = src.replace(new RegExp('\\bvar\\s+' + nom + '\\s*=\\s*[0-9.]+'), 'var ' + nom + ' = ' + val);
  const m = [lv(src, '_MAJOUTIL'), lv(src, '_NOMPROPRE'), bloc(src, 'function normMajInterne('),
    lv(src, '_SALUT'), lv(src, '_GOUVERNE'), bloc(src, 'function teteHorsPhrase('),
    lv(src, '_PASAPRES'), lv(src, 'R_COUPE'), lv(src, 'R_PASCOUPE'), lv(src, 'R_CONT_OUI'),
    lv(src, 'R_CONT_NON'), lv(src, 'R_PASAPRES'), lv(src, 'R_COORD'), lv(src, 'R_QUEST'),
    lv(src, 'PONCT_TAU'), lv(src, 'K_TXT'),
    bloc(src, 'function _avantTiret('), bloc(src, 'function _txtFrontiere('),
    bloc(src, 'function _arb('), bloc(src, 'function _trancheTexte('),
    bloc(src, 'function _poseMarques('), bloc(src, 'function _seuilSilence('),
    bloc(src, 'function silBetween('), bloc(src, 'function riseEndingAt('),
    bloc(src, 'function capitalize('), bloc(src, 'function prosodyText(')];
  return new Function('DC', m.join('\n') + '\nreturn prosodyText;')(DC);
}

/* ── le lit : on rejoue chaque clip comme si Google l'avait dicté ───────────────────────── */
const LIT = path.join(RACINE, 'data_local', 'voix', 'lit_joint.jsonl');
const PAS = 30;          // le pas de la timeline RMS, celui du navigateur
const MOT_MS = 300;      // durée nominale d'un mot ; seuls les SILENCES portent le signal
const CLASSES = { '': 0, ',': 1, '.': 2 };

function clips() {
  const out = [];
  for (const ligne of fs.readFileSync(LIT, 'utf8').split('\n')) {
    if (!ligne.trim()) continue;
    const d = JSON.parse(ligne);
    if (!d.mots || !d.marques || !d.sil_rms) continue;
    if (d.mots.length !== d.marques.length || d.sil_rms.length !== d.mots.length) continue;
    out.push(d);
  }
  return out;
}

/* Construit l'état que reçoit `prosodyText` : segments de Google + timeline RMS.
   ⚠️ `ftimes[i]` doit dater la FIN du segment i sur la même horloge que la timeline, sinon
   `silBetween` regarderait à côté et l'on mesurerait un détecteur qu'on ne livre pas. */
function etat(d) {
  const tl = []; let t = 0;
  const finals = {}, ftimes = {};
  let seg = [], iseg = 0;
  for (let i = 0; i < d.mots.length; i++) {
    for (let k = 0; k < MOT_MS; k += PAS) { tl.push({ t, r: 0.20, f: 200 }); t += PAS; }
    seg.push(d.mots[i]);
    const sil = d.sil_rms[i] || 0;
    // coupure Google : pause longue -> le segment est finalisé
    const coupe = sil >= 600 || i === d.mots.length - 1;
    if (coupe) { finals[iseg] = seg.join(' '); ftimes[iseg] = t; iseg++; seg = []; }
    for (let k = 0; k < sil; k += PAS) { tl.push({ t, r: 0.001, f: 0 }); t += PAS; }
  }
  if (seg.length) { finals[iseg] = seg.join(' '); ftimes[iseg] = t; }
  return { finals, ftimes, base: '', au: { tl, maxr: 0.20 } };
}

/* La sortie est du texte : on la re-tokenise et on relève la marque après chaque mot.
   Alignement par INDICE DE MOT, licite ici (contrairement aux prises de Rem) parce que les mots
   viennent du lit lui-même : aucune reconnaissance ne peut en manger un. */
function marquesDe(txt) {
  const m = [];
  const jets = String(txt).match(/[A-Za-zÀ-ÿœŒ'’-]+|[,.;:!?]/g) || [];
  for (const x of jets) {
    if (/^[,.;:!?]$/.test(x)) { if (m.length) m[m.length - 1] = (x === '!' || x === '?' || x === ';' || x === ':') ? '.' : x; }
    else m.push('');
  }
  return m;
}

function mesure(proso, clipsList) {
  let justes = 0, posees = 0, attendues = 0, typeFaux = 0;
  const parType = { ',': { j: 0, p: 0, a: 0 }, '.': { j: 0, p: 0, a: 0 } };
  /* ⭐ LA FRONTIÈRE À PART — c'est LE seul endroit que l'arbitre gouverne vraiment.
     À l'intérieur d'un segment, le navigateur n'a AUCUNE ancre temporelle (les `ftimes` datent la
     latence de Google, pas la parole ; mesuré-réfuté en juillet) : la virgule y est donc décidée
     par le canal TEXTE seul, et aucune arbitration ne peut ajouter une preuve qui n'existe pas.
     Aux frontières, au contraire, les deux voies parlent — et c'est là que se trouvaient les deux
     falaises 190/600 jamais mesurées. Mélanger les deux zones dans un total noierait l'effet. */
  const front = { j: 0, p: 0, a: 0 };
  for (const d of clipsList) {
    const sortie = proso(etat(d));
    if (!sortie) continue;
    const got = marquesDe(sortie);
    const estFront = d.sil_rms.map(s => s >= 600);
    // dernier interstice exclu : sa marque est le point final, que la dictée ajoute toujours —
    // le compter gonflerait la justesse d'un point gratuit par clip.
    const n = Math.min(got.length, d.mots.length) - 1;
    for (let i = 0; i < n; i++) {
      const brut = d.marques[i];
      const vrai = (brut === ',' ? ',' : (brut ? '.' : ''));
      const pred = got[i] || '';
      if (vrai) { attendues++; parType[vrai].a++; }
      if (pred) { posees++; parType[pred].p++; }
      if (pred && pred === vrai) { justes++; parType[pred].j++; }
      else if (pred && vrai && pred !== vrai) typeFaux++;
      if (estFront[i]) { if (vrai) front.a++; if (pred) front.p++; if (pred && pred === vrai) front.j++; }
    }
  }
  return { justes, posees, attendues, typeFaux, parType, front };
}

/* ── balayage ───────────────────────────────────────────────────────────────────────────── */
const L = clips();
console.log('banc : ' + L.length + ' clips reels (VoxPopuli, 47 locuteurs), audio + texte ponctue par des humains\n');

const arg = process.argv.slice(2);
const iAvant = arg.indexOf('--avant');

/* ⚠️ CE BANC NE JUGE QUE LA VIRGULE, et il faut le dire avant de montrer un chiffre.
   Le lit est fait de clips d'UNE phrase de discours parlementaire : 195 virgules pour 11 points
   internes, soit un taux de point de 0,4 % là où le français écrit en a 5,6 % (prior du modèle,
   694 949 phrases). Un orateur fait des pauses longues AU MILIEU de ses phrases — c'est même sa
   marque de fabrique. Juger le POINT ici reviendrait donc à punir le moteur pour des points que
   ce corpus, par construction, ne contient pas. Le point se juge sur les PRISES DE REM (vraie
   dictée, vrai domaine) et sur la garde CI. On sépare donc les deux colonnes, sans les mélanger
   dans un total qui ne voudrait rien dire. */
function ligne(nom, r) {
  const v = r.parType[','], p = r.parType['.'];
  const jv = v.p ? 100 * v.j / v.p : 0, rv = v.a ? 100 * v.j / v.a : 0;
  console.log('  ' + nom.padEnd(20) +
    ' VIRGULE : juste ' + jv.toFixed(0).padStart(3) + ' % (' + String(v.j).padStart(3) + '/' + String(v.p).padStart(4) + ')' +
    '  trouvee ' + rv.toFixed(0).padStart(3) + ' % (' + String(v.j).padStart(3) + '/' + v.a + ')' +
    '   |  FRONTIERE : juste ' + (r.front.p ? (100 * r.front.j / r.front.p).toFixed(0) : '  0').padStart(3) +
    ' % (' + r.front.j + '/' + String(r.front.p).padStart(3) + ')  trouvee ' +
    (r.front.a ? (100 * r.front.j / r.front.a).toFixed(0) : '0').padStart(3) + ' % (' + r.front.j + '/' + r.front.a + ')');
}

if (iAvant >= 0) {
  const f = arg[iAvant + 1];
  console.log('AVANT (code publie, ' + path.basename(f) + ') :');
  ligne('etat publie', mesure(charge(null, f), L));
  console.log('\nAPRES (arbitre), au reglage livre :');
  ligne('arbitre', mesure(charge(null), L));
} else {
  console.log('BALAYAGE de tau — « on ecrit une marque quand sa probabilite depasse tau » :');
  for (const tau of [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60])
    ligne('tau = ' + tau.toFixed(2), mesure(charge({ PONCT_TAU: tau }), L));
  console.log('\nBALAYAGE du de-poids du canal texte (K_TXT), a tau=0.35 :');
  for (const k of [0.2, 0.4, 0.6, 0.8, 1.0, 1.5, 2.0])
    ligne('K_TXT = ' + k.toFixed(1), mesure(charge({ K_TXT: k, PONCT_TAU: 0.35 }), L));
}
