#!/usr/bin/env node
/* PARITÉ OCTET POUR OCTET DU MOTEUR VOCAL — site ↔ extension.
 *
 * POURQUOI EN PLUS DE `proso_probe`. Celui-là vérifie que les deux surfaces produisent le MÊME
 * TEXTE sur 140 cas. C'est la bonne garantie, mais elle est ÉCHANTILLONNÉE : deux implémentations
 * peuvent coïncider sur 140 cas et diverger sur le 141e. Ici on exige que le CODE lui-même soit
 * identique — une garantie de nature différente, qui attrape la dérive AVANT qu'elle produise un
 * cas visible.
 *
 * ⚠️ ON COMPARE HORS COMMENTAIRES, et dans le BON ORDRE : retirer les commentaires D'ABORD, puis
 * normaliser les espaces. L'inverse (collapser puis retirer les `//`) supprime tout ce qui suit le
 * premier `//` de la ligne collapsée — l'audit du 2026-08-06 a d'abord annoncé 14 divergences
 * fantômes à cause de ça. Une sonde qui se trompe d'ordre invente des bugs.
 *
 * ⚠️ SEULES LES FONCTIONS DU MOTEUR SONT ICI. `render`, `applyFlag`, `esc`, `spans` diffèrent
 * légitimement : le site écrit dans un <textarea>, l'extension dans la page hôte. Les inclure
 * rendrait la garde ininterprétable — elle serait rouge en permanence pour de bonnes raisons.
 *
 *   node dictee/voix_parite_probe.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.dirname(__dirname);

/* Les fonctions qui DÉCIDENT de la ponctuation. Si l'une d'elles diverge, les deux surfaces ne
   ponctuent plus pareil — et c'est précisément ce que Rem ne doit jamais avoir à découvrir
   lui-même en testant. */
const MOTEUR = ['_dedupFinals', 'prosodyText', '_poseMarques', '_seuilSilence', 'silBetween', 'riseAt',
                'riseEndingAt', '_txtFrontiere', '_durBiais', '_trancheTexte', '_avantTiret',
                'normMajInterne', 'teteHorsPhrase', '_dedoubleMarques', 'estQuestion', '_f0'];

function sansCommentaires(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')   // le [^:] épargne les « http:// » d'une URL
          .replace(/\s+/g, ' ').trim();
}
function extrait(src, nom) {
  const i = src.indexOf('function ' + nom + '(');
  if (i < 0) return null;
  let j = src.indexOf('{', i), p = 0, k;
  for (k = j; k < src.length; k++) {
    if (src[k] === '{') p++;
    else if (src[k] === '}') { p--; if (!p) break; }
  }
  return src.slice(i, k + 1);
}

const A = fs.readFileSync(path.join(RACINE, 'saisie-vocale.html'), 'utf8');
const B = fs.readFileSync(path.join(RACINE, 'extension', 'sidepanel.js'), 'utf8');

let ko = 0;
console.log('PARITÉ OCTET DU MOTEUR VOCAL — saisie-vocale.html ↔ extension/sidepanel.js\n');
for (const f of MOTEUR) {
  const a = extrait(A, f), b = extrait(B, f);
  if (a === null || b === null) {
    ko++;
    console.log('  ✗ ' + f + ' : absent de ' + (a === null ? 'saisie-vocale.html' : 'sidepanel.js'));
    continue;
  }
  const na = sansCommentaires(a), nb = sansCommentaires(b);
  if (na === nb) { console.log('  ✓ ' + f); continue; }
  ko++;
  let i = 0;
  while (i < Math.min(na.length, nb.length) && na[i] === nb[i]) i++;
  console.log('  ✗ ' + f + ' DIVERGE au caractère ' + i + ' (' + na.length + ' vs ' + nb.length + ')');
  console.log('      site : …' + na.slice(Math.max(0, i - 40), i + 70));
  console.log('      ext  : …' + nb.slice(Math.max(0, i - 40), i + 70));
}
console.log('\nvoix_parite_probe : ' + (MOTEUR.length - ko) + '/' + MOTEUR.length +
            ' fonctions moteur identiques (hors commentaires)');
if (ko) process.exit(1);
