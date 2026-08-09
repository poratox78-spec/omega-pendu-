#!/usr/bin/env node
/* LES RÈGLES DU MOTEUR ARRIVENT-ELLES JUSQU'À L'UTILISATEUR ?
 *
 * POURQUOI CE CHECK EXISTE — IL RÉPARE UNE CLASSE DE BUG, PAS UN BUG.
 * Le 2026-08-09, huit règles anglaises ont été écrites, mesurées sur 177 748 tokens de texte édité
 * et sur JFLEG… et AUCUNE n'était appelée par `en/correcteur-outil.html`. Elles vivaient dans le
 * moteur, les sondes les mesuraient, et l'utilisateur n'en voyait RIEN. Aucun test ne pouvait le
 * dire : les sondes appellent le moteur directement, jamais la page.
 * ⇒ **Une règle non branchée vaut zéro, quels que soient ses chiffres.** Ce check ferme la porte.
 *
 * CE QU'IL VÉRIFIE, ET SES LIMITES. Il regarde si chaque fonction de DÉCISION exportée par
 * `corrector_en.js` est mentionnée dans la page. C'est grossier — il ne prouve pas que l'appel est
 * au bon endroit ni que le résultat est affiché — mais il attrape le cas qui s'est produit :
 * l'oubli pur et simple. Un test plus fin devrait piloter un navigateur ; celui-ci coûte 20 ms.
 * ⚠️ Si une règle est volontairement HORS de la page, l'inscrire dans `_HORS_PAGE` avec sa raison.
 * Une exception silencieuse rendrait ce check inutile.
 *
 *   node dictee/en_page_wiring_probe.js       # code de sortie ≠ 0 si une règle manque
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.dirname(__dirname);
const PAGE = path.join(RACINE, 'en', 'correcteur-outil.html');
const MOTEUR = path.join(RACINE, 'dictee', 'corrector_en.js');

/* Fonctions exportées qui ne sont PAS des règles de décision : outils, chargeurs, masques.
   On ne leur demande pas d'être appelées par la page. */
const _NON_REGLE = new Set(['deacc', 'phonKey', 'edits1', 'buildPhonIndex', 'tokenize', 'urlMask',
  'adjMask', 'hyphMask', 'parseLexText', 'loadLexNode', 'loadLexB64', 'tagSentence', 'setPosModel',
  'loadPosModel', 'buildPastPart', 'buildNumber', 'buildConfuseSlot', 'buildConfuseVig']);

/* Règles volontairement absentes de la page — avec la RAISON, sinon ce check ne sert à rien. */
const _HORS_PAGE = {};

const page = fs.readFileSync(PAGE, 'utf8');
const moteur = fs.readFileSync(MOTEUR, 'utf8');

const m = /const _API = \{([\s\S]*?)\};/.exec(moteur);
if (!m) { console.log('✗ bloc _API introuvable dans corrector_en.js'); process.exit(1); }
const exports_ = m[1].split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean);
const regles = exports_.filter(x => !_NON_REGLE.has(x));

const manquantes = regles.filter(r => !_HORS_PAGE[r] && page.indexOf('C.' + r) < 0);
const exemptees = regles.filter(r => _HORS_PAGE[r]);

console.log('CÂBLAGE DES RÈGLES ANGLAISES — moteur -> page\n');
console.log('  ' + regles.length + ' règles de décision exportées · '
            + (regles.length - manquantes.length - exemptees.length) + ' branchées'
            + (exemptees.length ? ' · ' + exemptees.length + ' exemptées' : ''));
for (const r of exemptees) console.log('    – ' + r + ' (hors page : ' + _HORS_PAGE[r] + ')');

/* Le TOKENISEUR doit être le MÊME des deux côtés. La page en garde des copies littérales (analyse,
   rendu, clic) : des découpages différents décalent les INDICES que les masques renvoient, et les
   règles visent alors le mauvais mot — silencieusement. Bug réel, corrigé le 2026-08-09. */
const motifMoteur = (/function tokenize\(text\)\{ return text\.match\((\/[^\/]+\/g)\)/.exec(moteur) || [])[1];
const copiesPage = (page.match(/\/\[A-Za-z[^\/]*\/g/g) || []);
const divergentes = motifMoteur ? copiesPage.filter(c => c !== motifMoteur) : [];

if (manquantes.length) {
  console.log('\n  ✗ RÈGLES NON BRANCHÉES DANS LA PAGE : ' + manquantes.join(', '));
  console.log('    Une règle non branchée vaut zéro. La brancher, ou l\'inscrire dans _HORS_PAGE');
  console.log('    de cette sonde AVEC SA RAISON.');
}
if (divergentes.length) {
  console.log('\n  ✗ TOKENISEUR DIVERGENT — la page découpe autrement que le moteur :');
  console.log('    moteur : ' + motifMoteur);
  divergentes.forEach(c => console.log('    page   : ' + c));
  console.log('    Les masques rendent des INDICES : un découpage différent fait viser le mauvais mot.');
}
if (manquantes.length || divergentes.length) process.exit(1);
console.log('  ✓ toutes les règles sont appelées par la page · tokeniseur identique');
