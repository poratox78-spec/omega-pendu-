/* miroir_ponct_probe.js — VERROU DE MIROIR app ↔ extension pour la couche PONCTUATION.
 *
 * POURQUOI CE FICHIER EXISTE
 * --------------------------
 * `app/omega-pendu.html` et `extension/dys-core.js` sont des MIROIRS : on y porte les mêmes blocs à
 * la main. Le 2026-08-24, cinq blocs de ponctuation ont été miroités ainsi (estQuestion et son
 * cluster de constantes, les règles de virgule d'Allô prof, `_questionScan`, `_virguleScan`, la
 * locution à trait d'union) — et AUCUNE garde ne vérifiait qu'ils restent identiques :
 *   · `parity_corr` / `parity_core` comparent `correctText` à Python, et ces règles n'y sont pas
 *     (elles sortent par `diagnoseAll`, en `tier:'flag'`/`span:2` ou par le canal typo) ;
 *   · `typo_probe` ne couvre que `_typoScan`, qui est mécanique donc isolable ;
 *   · le Python de référence n'a PAS la règle de trait d'union (0 occurrence), donc aucune parité
 *     à trois moteurs ne la protège non plus.
 * Une divergence introduite à la main serait partie en production sans un bruit. Même patron que
 * `imp_probe.js` (mover impératif) : on compare les SOURCES LIVRÉES, jamais un comportement
 * re-implémenté dans la sonde.
 *
 * LA COMPARAISON EST UN `===` NU, sans aucune normalisation — voir plus bas pourquoi : la version
 * qui normalisait le nom du paramètre s'est abîmée elle-même deux fois. Les blocs miroités doivent
 * donc être identiques AU CARACTÈRE PRÈS, commentaires compris.
 *
 *   node dictee/miroir_ponct_probe.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8');
const EXT = fs.readFileSync(path.join(ROOT, 'extension', 'dys-core.js'), 'utf8');

/* extrait de `deb` (inclus) jusqu'à `fin` (inclus). Les deux marqueurs sont du code LIVRÉ : s'ils
   disparaissent ou changent de forme, la sonde CASSE au lieu de comparer autre chose que ce qui
   est publié — même discipline que proso_probe et imp_probe. */
function tranche(src, deb, fin, nom) {
  const a = src.indexOf(deb);
  if (a < 0) return { err: 'début introuvable' };
  const b = src.indexOf(fin, a);
  if (b < 0) return { err: 'fin introuvable' };
  return { txt: src.slice(a, b + fin.length) };
}

/* ⚠️ POUR UNE FONCTION, ÉQUILIBRER LES ACCOLADES — ne jamais chercher un marqueur de fin textuel.
   Première version de cette sonde : fin = « return out;} », qui tombait sur le
   `catch(e){return out;}` INTERMÉDIAIRE de `_virguleScan`. Le bloc comparé faisait 9 lignes au lieu
   de 20, et la garde trait d'union — le cœur du correctif — était HORS comparaison. Vérifié en
   introduisant une divergence exprès : la sonde annonçait 5/5. Une garde qui ne peut pas échouer
   ne vaut rien ; celle-ci a été testée en la faisant échouer. */
function fonction(src, entete) {
  const i = src.indexOf(entete);
  if (i < 0) return { err: 'introuvable' };
  let j = src.indexOf('{', i), p = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') p++;
    else if (src[k] === '}') { p--; if (!p) return { txt: src.slice(i, k + 1) }; }
  }
  return { err: 'accolades non fermées' };
}

/* ⚠️ AUCUNE NORMALISATION ICI, ET C'EST VOULU. La première version normalisait le nom du paramètre
   (`_typoScan(t)` côté app, `(text)` côté dys-core) avant de comparer — et s'est abîmée DEUX FOIS
   toute seule : `\b` étant ASCII en JS, `\bt\b` a transformé « plutôt » en « plutô§ » dans un
   commentaire, puis `/[^ \t]/` en `/[^ \§]/`. On a donc SUPPRIMÉ LA DIFFÉRENCE au lieu de la
   contourner : les deux fonctions miroitées prennent le même nom de paramètre des deux côtés, et la
   comparaison est un simple `===` sur la source. Une sonde qui retouche ce qu'elle mesure finit par
   mesurer sa propre retouche. */

const BLOCS = [
  { nom: 'estQuestion (+ constantes Q*)',
    deb: "var QW=/^(est-ce|qu'est", fin: "return tag(1)!=='DET';\n}" },
  { nom: 'règles de virgule (R1-R5 + ponctInterdit)',
    deb: '// ⭐⭐⭐ LES RÈGLES DE VIRGULE — source : Allô prof',
    fin: 'out.forEach(function (i) { if (ponctInterdit(mots, tg, i)) out.delete(i); });\n  return out;\n}' },
  { nom: '_questionScan (« ? » manquant)', fn: 'function _questionScan(' },
  { nom: '_virguleScan (virgule manquante)', fn: 'function _virguleScan(' },
  { nom: "locution à trait d'union (_HYPHLOC + priorité)",
    deb: 'var _HYPHLOC=', fin: 'done[hli]=done[hli+1]=1;}' },
];

let ko = 0;
for (const b of BLOCS) {
  const a = b.fn ? fonction(APP, b.fn) : tranche(APP, b.deb, b.fin, b.nom);
  const e = b.fn ? fonction(EXT, b.fn) : tranche(EXT, b.deb, b.fin, b.nom);
  if (a.err || e.err) {
    console.log('  ✗ ' + b.nom + ' — ' + (a.err ? 'APP: ' + a.err + ' ' : '') + (e.err ? 'EXT: ' + e.err : ''));
    ko++; continue;
  }
  const ta = a.txt, te = e.txt;
  if (ta === te) {
    console.log('  ✓ ' + b.nom + '  (' + ta.split('\n').length + ' lignes identiques)');
  } else {
    ko++;
    const la = ta.split('\n'), le = te.split('\n');
    let i = 0; while (i < la.length && i < le.length && la[i] === le[i]) i++;
    console.log('  ✗ ' + b.nom + ' — DIVERGENCE à la ligne ' + (i + 1) + ' du bloc');
    console.log('      app : ' + String(la[i] === undefined ? '(fin du bloc)' : la[i]).trim().slice(0, 110));
    console.log('      ext : ' + String(le[i] === undefined ? '(fin du bloc)' : le[i]).trim().slice(0, 110));
  }
}
console.log(ko
  ? '\n✗ MIROIR PONCTUATION : ' + ko + ' bloc(s) divergent(s) entre app et extension'
  : '\nmiroir ponctuation : ' + BLOCS.length + '/' + BLOCS.length + ' blocs identiques app ↔ extension');
process.exit(ko ? 1 : 0);
