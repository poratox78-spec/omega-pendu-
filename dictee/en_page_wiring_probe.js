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
  'loadPosModel', 'buildPastPart', 'buildNumber', 'buildConfuseSlot', 'buildConfuseVig', 'setAttested',
  'analyzeText', 'loadAllNode', 'buildBaseMap', 'buildCompSets']);

/* Règles de TEXTE (pas de MOT) : elles réparent la ponctuation d'un bloc entier derrière un bouton de la page — hors du
   pipeline des mots par nature, donc appelées EN DIRECT par la page, et c'est ce qu'on exige d'elles. */
const _REGLES_TEXTE = { typoScanEn: 'bouton « Fix punctuation » : espaces et doublons de ponctuation sur tout le texte' };

/* Les ACTIFS que le moteur attend : la page doit demander chacun, et poser celui qui se pose par un appel
   (une table jamais chargée = des règles muettes, sans aucun symptôme — cf. PR#443, le modèle POS oublié). */
const _ACTIFS = { 'lex_en.tsv.gz': 'C.parseLexText', 'verbmorph_en.json': 'VERBMORPH', 'pos_hmm_en.json': 'C.setPosModel',
                  'confusables_en.json': 'CONFUS', 'forms_en.tsv.gz': 'C.buildBaseMap', 'misspell_en.tsv': 'C.setAttested' };

/* ⭐ 17/09/2026 — LE PIPELINE VIT DANS LE MOTEUR. La chaîne des décisions a quitté la page pour `analyzeText` : la page et
   les bancs appellent la MÊME fonction. Ce check suit : une règle est « branchée » si `analyzeText` l'APPELLE, la page doit
   appeler `C.analyzeText`, et elle ne doit plus appeler une règle en direct (un second pipeline qui repousserait à côté).
   Règles volontairement hors du pipeline — avec la RAISON, sinon ce check ne sert à rien. */
const _HORS_PAGE = {};

const page = fs.readFileSync(PAGE, 'utf8');
const moteur = fs.readFileSync(MOTEUR, 'utf8');

const m = /const _API = \{([\s\S]*?)\};/.exec(moteur);
if (!m) { console.log('✗ bloc _API introuvable dans corrector_en.js'); process.exit(1); }
const exports_ = m[1].split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean);
const regles = exports_.filter(x => !_NON_REGLE.has(x) && !_REGLES_TEXTE[x]);
const texteOubliees = Object.keys(_REGLES_TEXTE).filter(r => exports_.includes(r) && page.indexOf('C.' + r + '(') < 0);

const iA = moteur.indexOf('function analyzeText(');
const corpsAnalyze = iA < 0 ? '' : moteur.slice(iA, moteur.indexOf('\n}\n', iA));
const manquantes = regles.filter(r => !_HORS_PAGE[r] && !new RegExp('\\b' + r + '\\(').test(corpsAnalyze));
const pageAppelle = page.indexOf('C.analyzeText(') >= 0;
const enDirect = regles.filter(r => page.indexOf('C.' + r + '(') >= 0);
const exemptees = regles.filter(r => _HORS_PAGE[r]);

console.log('CÂBLAGE DES RÈGLES ANGLAISES — moteur (analyzeText) -> page\n');
console.log('  ' + regles.length + ' règles de décision exportées · '
            + (regles.length - manquantes.length - exemptees.length) + ' branchées'
            + (exemptees.length ? ' · ' + exemptees.length + ' exemptées' : ''));
for (const r of exemptees) console.log('    – ' + r + ' (hors page : ' + _HORS_PAGE[r] + ')');

/* Le TOKENISEUR doit être le MÊME des deux côtés. La page en garde des copies littérales (analyse,
   rendu, clic) : des découpages différents décalent les INDICES que les masques renvoient, et les
   règles visent alors le mauvais mot — silencieusement. Bug réel, corrigé le 2026-08-09. */
const motifMoteur = (/function tokenize\(text\)\{ return text\.match\((\/[^\/]+\/g)\)/.exec(moteur) || [])[1];
const copiesPage = (page.match(/\/\[A-Za-z[^\/]*\/g/g) || []);
const copiesAnalyze = (corpsAnalyze.match(/\/\[A-Za-z[^\/]*\/g/g) || []);     // analyzeText garde les POSITIONS : il a sa copie du motif
const divergentes = motifMoteur ? copiesPage.concat(copiesAnalyze).filter(c => c !== motifMoteur) : [];
if (!copiesAnalyze.length) { console.log('  ✗ motif de découpage introuvable dans analyzeText (la comparaison serait MUETTE)'); process.exitCode = 1; }

const actifsOublies = Object.keys(_ACTIFS).filter(a => page.indexOf(a) < 0 || page.indexOf(_ACTIFS[a]) < 0);
if (actifsOublies.length) {
  console.log('\n  ✗ ACTIFS DU MOTEUR NON CHARGÉS PAR LA PAGE : ' + actifsOublies.join(', '));
  process.exitCode = 1;
} else console.log('  ' + Object.keys(_ACTIFS).length + ' actifs du moteur demandés et posés par la page (' + Object.keys(_ACTIFS).join(', ') + ')');
if (manquantes.length) {
  console.log('\n  ✗ RÈGLES EXPORTÉES QUE analyzeText N\'APPELLE PAS : ' + manquantes.join(', '));
  console.log('    Une règle non branchée vaut zéro. La brancher, ou l\'inscrire dans _HORS_PAGE');
  console.log('    de cette sonde AVEC SA RAISON.');
}
if (texteOubliees.length) console.log('\n  ✗ RÈGLES DE TEXTE QUE LA PAGE N\'APPELLE PAS : ' + texteOubliees.join(', '));
if (!pageAppelle) console.log('\n  ✗ LA PAGE N\'APPELLE PAS C.analyzeText — elle n\'exécute donc pas le pipeline du moteur');
if (enDirect.length) console.log('\n  ✗ LA PAGE APPELLE DES RÈGLES EN DIRECT (second pipeline) : ' + enDirect.join(', '));
if (divergentes.length) {
  console.log('\n  ✗ TOKENISEUR DIVERGENT — la page découpe autrement que le moteur :');
  console.log('    moteur : ' + motifMoteur);
  divergentes.forEach(c => console.log('    page   : ' + c));
  console.log('    Les masques rendent des INDICES : un découpage différent fait viser le mauvais mot.');
}
if (manquantes.length || divergentes.length || !pageAppelle || enDirect.length || texteOubliees.length) process.exit(1);
if (process.exitCode) process.exit(process.exitCode);
console.log('  ✓ toutes les règles sont appelées par analyzeText, que la page appelle · aucun appel en direct · tokeniseur identique');
