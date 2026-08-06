#!/usr/bin/env node
/* GARDE DE LA COUCHE TYPOGRAPHIQUE (`_typoScan`) — app ET extension, avec parité.
 *
 * POURQUOI ELLE ARRIVE MAINTENANT. `_typoScan` existait depuis longtemps mais ne portait que de
 * l'ORANGE (… et « »), et rien ne le testait. Il porte désormais les DEUX PREMIÈRES RÈGLES
 * ROUGES DE PONCTUATION du correcteur — donc des corrections appliquées par défaut, sur le texte
 * de quelqu'un. Une règle rouge sans garde n'a rien à faire en production.
 *
 * ⭐ LA DISTINCTION QUI AUTORISE LE ROUGE ICI, et qui vaut d'être répétée : « où faut-il une
 * virgule ? » est un JUGEMENT — on l'a mesuré à 51,98 % de justesse sur 11 304 phrases humaines,
 * et la source (Allô prof) écrit elle-même « on place GÉNÉRALEMENT une virgule ». Aucun réglage
 * n'en fera du FP=0. « L'espace autour de la virgule QUI EST DÉJÀ LÀ est-il bien placé ? » est
 * une question MÉCANIQUE, décidable sur la chaîne seule. C'est la seule couche de ponctuation
 * qui peut atteindre FP=0 — mesuré : 2 déclenchements sur 14 450 phrases UD correctes, et les
 * DEUX sont de vraies fautes de typo du corpus (« Warner Bros . La », « Dorra Zarrouk,née »).
 *
 * ⚠️ ON EXTRAIT LA FONCTION DES FICHIERS LIVRÉS, on ne la réécrit pas : une garde qui teste sa
 * propre copie ne garde rien.
 *
 *   node dictee/typo_probe.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.dirname(__dirname);

function charge(fichier) {
  const src = fs.readFileSync(path.join(RACINE, fichier), 'utf8');
  const i = src.indexOf('function _typoScan(');
  if (i < 0) throw new Error('_typoScan introuvable dans ' + fichier);
  const j = src.indexOf('return out;}', i) + 'return out;}'.length;
  return new Function(src.slice(i, j) + '; return _typoScan;')();
}

const SURFACES = [
  ['app  omega-pendu.html', charge('app/omega-pendu.html')],
  ['ext. dys-core.js', charge('extension/dys-core.js')],
];

/* rouge = tier 'auto' (appliqué par défaut) · orange = 'vigilance' (proposé, OFF par défaut) */
const rouges = (f, t) => f(t).filter(r => r.tier === 'auto');

/* ── LES CAS QUI DOIVENT DÉCLENCHER (rouge) ──────────────────────────────────────────────── */
const OUI = [
  ['espace parasite avant le point', 'le film était produit par Warner Bros . La musique suit',
   's .', 's.'],
  ['espace parasite avant la virgule', 'je viens demain , et toi tu restes ici', 'n ,', 'n,'],
  ['espace manquant après la virgule', 'Dorra Zarrouk,née le 13 octobre 1980 à Tunis', 'k,n', 'k, n'],
  ['espace manquant, mot suivant en majuscule', 'il est parti,Paul est resté', 'i,P', 'i, P'],
];
/* ── ⛔ LES CAS QUI NE DOIVENT RIEN DÉCLENCHER EN ROUGE ───────────────────────────────────
   C'est la moitié qui compte : une règle typographique qui mord du texte correct est pire que
   pas de règle du tout, puisqu'elle s'applique TOUTE SEULE. */
const NON = [
  ['virgule DÉCIMALE', 'il mesure 1,5 mètre de haut et pèse 2,25 kilos'],
  ['deux virgules décimales collées à des chiffres', 'le taux passe de 3,14 à 2,71 cette année'],
  ['URL avec virgule', 'va voir https://exemple.fr/a,b pour le détail complet'],
  ['adresse e-mail', 'écris à jean,paul@exemple.fr si tu veux une réponse'],
  ['espace française AVANT deux-points et point-virgule', 'il a dit : viens ; puis il est parti'],
  ['guillemets français fermants', 'il a dit « oui ». Puis il est parti sans rien ajouter'],
  ['points de suspension (orange, pas rouge)', 'attends ... je vais arriver dans une minute'],
  ['sigle en majuscules', 'les options A,B et C sont toutes valables ici'],
  ['ponctuation normale', 'Bonjour, je viens demain. Il fera beau, je crois.'],
];

let ko = 0, total = 0;
console.log('GARDE TYPOGRAPHIE — _typoScan, deux surfaces\n');
for (const [nom, f] of SURFACES) {
  for (const [fam, texte, from, sugg] of OUI) {
    total++;
    const r = rouges(f, texte);
    const ok = r.length === 1 && r[0].from === from && r[0].sugg === sugg;
    if (!ok) { ko++;
      console.log('✗ [' + nom + '] ' + fam);
      console.log('    attendu : ' + JSON.stringify(from) + ' -> ' + JSON.stringify(sugg));
      console.log('    obtenu  : ' + (r.length ? r.map(x => JSON.stringify(x.from) + ' -> ' +
                  JSON.stringify(x.sugg)).join(' | ') : 'RIEN'));
      console.log('    texte   : ' + texte);
    }
  }
  for (const [fam, texte] of NON) {
    total++;
    const r = rouges(f, texte);
    if (r.length) { ko++;
      console.log('✗ [' + nom + '] ⛔ ' + fam + ' — ' + r.length + ' rouge(s) EN TROP');
      console.log('    ' + r.map(x => JSON.stringify(x.from) + ' -> ' + JSON.stringify(x.sugg)).join(' | '));
      console.log('    texte   : ' + texte);
    }
  }
}

/* ── PARITÉ : les deux surfaces doivent rendre EXACTEMENT la même chose ──────────────────── */
let div = 0;
for (const [, texte] of OUI.map(x => [x[0], x[1]]).concat(NON)) {
  const a = JSON.stringify(SURFACES[0][1](texte)), b = JSON.stringify(SURFACES[1][1](texte));
  if (a !== b) { div++; console.log('✗ PARITÉ app≠ext : ' + texte); }
}

console.log('\ntypo_probe : ' + (total - ko) + '/' + total + ' cas · ' +
            (div ? div + ' DIVERGENCE(S) de parité' : 'parité 2 surfaces OK'));
if (ko || div) process.exit(1);
