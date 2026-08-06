#!/usr/bin/env node
/* AUDIT STRUCTUREL DU PIPELINE VOCAL — chaînage, chevauchement, conflits.
 *
 * POURQUOI. `proso_probe` vérifie le RÉSULTAT sur 140 cas ; `voix_parite_probe` vérifie que les
 * deux surfaces portent le MÊME CODE. Aucun des deux ne regarde ce qui se passe ENTRE les couches.
 * Or la ponctuation vocale empile désormais QUATRE producteurs de marques sur la même chaîne :
 *   ① le canal TEXTE (`ponctDist`, seuils 0,50 / 0,70)
 *   ② l'ANCRE audio (positions entendues, recalées ±1 mot, refus sous 0,30)
 *   ③ les 5 RÈGLES d'Allô prof (union, avec `deja` pour ne pas empiler)
 *   ④ la JOINTURE entre segments (marque la plus forte) + `_dedoubleMarques`
 * Quatre couches qui écrivent au même endroit, c'est exactement la configuration où naissent les
 * doublons et les corruptions silencieuses — le « ,, » de Rem en était un.
 *
 * CE QU'ON VÉRIFIE, sur des dictées SYNTHÉTIQUES massives (pas 140 cas choisis) :
 *   A. AUCUNE marque doublée ni collée dans la sortie          (`,,`, `, ,`, `.,`, ` ,`)
 *   B. AUCUNE marque posée après un mot-outil interdit         (garde `_PASAPRES`)
 *   C. AUCUNE marque au milieu d'un groupe à trait d'union     (garde `_avantTiret`)
 *   D. LES MOTS SONT INTACTS — la ponctuation n'a rien mangé ni réordonné
 *   E. site ≡ extension sur CHAQUE cas
 *
 * ⚠️ (D) EST LE TEST QUI COMPTE LE PLUS et c'est le plus facile à oublier : une chaîne qui insère
 * des caractères par indice peut corrompre le texte sans jamais lever d'erreur. On compare donc la
 * suite de mots ENTRÉE à la suite de mots SORTIE, token par token.
 *
 *   node dictee/voix_struct_probe.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.dirname(__dirname);
const { charge, DC } = require(path.join(RACINE, 'dictee', 'proso_probe.js'));

/* La liste RÉELLE des mots-outils après lesquels la livraison s'interdit toute marque — extraite
   du fichier publié, jamais retapée. */
const _src = fs.readFileSync(path.join(RACINE, 'saisie-vocale.html'), 'utf8');
const _m = /\bvar\s+_PASAPRES\s*=/.exec(_src);
const PASAPRES = new Function(_src.slice(_m.index, _src.indexOf(';', _m.index) + 1) +
                              '\nreturn _PASAPRES;')();
const MOT_OUTIL = new RegExp('(^|\\s)(' + Object.keys(PASAPRES).join('|') + ')\\s*[,.]', 'i');

const SITE = charge(path.join(RACINE, 'saisie-vocale.html'), 'prosodyText');
const EXT = charge(path.join(RACINE, 'extension', 'sidepanel.js'), 'prosodyText');

/* ── GÉNÉRATEUR DE DICTÉES, déterministe (aucun Math.random : un audit qui ne se rejoue pas à
      l'identique ne sert à rien pour trancher une régression). ─────────────────────────────── */
const MORCEAUX = [
  'il fait beau', 'je sors demain', 'on va aller à la plage', 'est-ce que tu viens',
  'la continuité', 'continuons', 'mais je reste ici', 'et vous décorerez la salle',
  'zut j ai oublié mes clés', 'selon moi la présentation sera courte', 'dessine-moi un mouton',
  'béatrice ne peut ni parler ni manger ni bouger', 'pourquoi', 'où est-il',
  'les fleurs sont-elles chères', 'le chien se repose car il est épuisé',
  'nous irons manger des pommes', 'à la plage', 'de la', 'et', 'bonjour',
  'qu est-ce que la différence', 'moins je dors moins je travaille',
];
function timeline(duree, pauses) {
  const tl = [];
  for (let t = 0; t < duree; t += 30) {
    const mute = pauses.some(p => t >= p.a && t < p.a + p.d);
    tl.push({ t, r: mute ? 0.001 : 0.20, f: mute ? 0 : 200 });
  }
  return { tl, maxr: 0.20 };
}
function cas(n) {
  /* mélange déterministe : un LCG, pas Math.random */
  let s = 1234567 + n * 7919;
  const suiv = (mod) => ((s = (s * 1103515245 + 12345) & 0x7fffffff) % mod);
  const nseg = 2 + suiv(4);
  const segs = [], ft = {}, pauses = [];
  let t = 900;
  for (let i = 0; i < nseg; i++) {
    segs.push(MORCEAUX[suiv(MORCEAUX.length)]);
    ft[i] = t;
    const d = [90, 300, 450, 900, 1600][suiv(5)];   // sous plancher · virgule · point
    pauses.push({ a: t + 50, d });
    t += d + 700 + suiv(600);
  }
  const finals = {};
  segs.forEach((x, i) => { finals[i] = x; });
  return { base: '', finals, ftimes: ft, tEnd: t, au: timeline(t + 400, pauses) };
}

const MOTS = /[A-Za-zÀ-ÿœŒ'’ʼ]+/g;
const suite = s => (String(s).toLowerCase().match(MOTS) || []).join(' ');

let n = 0, ko = 0;
const ecrit = (quoi, i, dedans, dehors) => {
  ko++;
  if (ko <= 12) {
    console.log('✗ ' + quoi + '  (cas ' + i + ')');
    console.log('    entrée : ' + dedans);
    console.log('    sortie : ' + dehors);
  }
};

console.log('AUDIT STRUCTUREL DU PIPELINE VOCAL\n');
for (let i = 0; i < 4000; i++) {
  const etat = cas(i);
  const entree = Object.keys(etat.finals).sort((a, b) => a - b).map(k => etat.finals[k]).join(' ');
  let a, b;
  try { a = SITE(JSON.parse(JSON.stringify(etat))); } catch (e) { ecrit('CRASH site : ' + e.message, i, entree, ''); continue; }
  try { b = EXT(JSON.parse(JSON.stringify(etat))); } catch (e) { ecrit('CRASH ext : ' + e.message, i, entree, ''); continue; }
  n++;
  if (a !== b) ecrit('E. site ≠ extension', i, entree, a + '   ||   ' + b);
  /* A. marques doublées ou collées */
  if (/[,;:]\s*[,;:]/.test(a) || /,\s*[.!?]/.test(a) || /\s+,/.test(a) || /\s+\./.test(a))
    ecrit('A. marque doublée ou espacée à tort', i, entree, a);
  /* D. les mots sont intacts */
  if (suite(a) !== suite(entree)) ecrit('D. LES MOTS ONT CHANGÉ', i, suite(entree), suite(a));
  /* B/C : aucune marque après un mot-outil, ni dans un groupe à trait d'union.
     ⚠️ DEUX CORRECTIONS PAYÉES ICI, et ce sont les fautes classiques d'une sonde :
     ① la première version RÉINVENTAIT la liste des mots-outils, et sortait 707 « anomalies »
        qui n'en étaient pas — la liste livrée n'est pas la mienne. On extrait `_PASAPRES` DU
        FICHIER PUBLIÉ, comme tout le reste de ce harnais ;
     ② elle comptait aussi la marque FINALE de la dictée. Celle-là est posée PAR CONCEPTION,
        quel que soit le dernier mot : une dictée finit par un point. On l'ôte avant de tester. */
  const sansFin = a.replace(/\s*[.!?]\s*$/, '');
  if (MOT_OUTIL.test(sansFin))
    ecrit('B. marque après un mot-outil interdit', i, entree, a);
  if (/-\s*[,.]/.test(a) || /[,.]\s*-/.test(a))
    ecrit('C. marque dans un groupe à trait d\'union', i, entree, a);
}

console.log('\nvoix_struct_probe : ' + n + ' dictées synthétiques · ' +
            (ko ? ko + ' ANOMALIE(S)' : 'aucune anomalie structurelle'));
if (ko) process.exit(1);
