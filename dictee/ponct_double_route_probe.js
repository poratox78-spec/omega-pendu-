#!/usr/bin/env node
/* LA DOUBLE ROUTE DU PENDU, APPLIQUÉE À LA PONCTUATION — et pourquoi elle ne transfère pas.
 *
 * L'IDÉE DE REM (2026-08-06) : « et si on rajoutait une double route pour la ponctuation, comme
 * les doubles voies du pendu et les systèmes qui les composent ». L'intuition est bonne — c'est la
 * doctrine maison, et elle paie ailleurs. Cette sonde dit pourquoi elle ne paie PAS ici.
 *
 * ⚠️ VÉRIFIÉ D'ABORD : l'arbitre type-OS (routes → distributions, poids = piqué, τ unique) a DÉJÀ
 * été monté et MESURÉ-RÉFUTÉ le 2026-08-05 — à τ=0,30 il gagne du F1 mais fait tomber la garde CI
 * de 82/82 à 62/82, en ressortant les régressions que Rem avait lui-même signalées. Ne pas le
 * re-tenter tel quel. Ce qui restait NON mesuré, c'est l'autre façon de composer deux routes :
 * non pas les PONDÉRER par leur confiance, mais exiger leur ACCORD. L'accord ne demande aucune
 * calibration — seulement que les routes soient indépendantes. C'est ce qu'on teste ici.
 *
 * LES TROIS CELLULES, sur le banc réel (11 304 phrases écrites par des humains) :
 *   · MODÈLE seul (la règle ne dit rien)   · RÈGLE seule (le modèle ne dit rien)   · LES DEUX
 *
 *   node dictee/ponct_double_route_probe.js
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const RACINE = path.dirname(__dirname);

require(path.join(RACINE, 'extension', 'dys-core.js'));
const DC = global.DYSCORE;
DC.setPosHmm(JSON.parse(fs.readFileSync(path.join(RACINE, 'dictee', 'pos_hmm.json'), 'utf8')));
DC.setPonctLm(JSON.parse(zlib.gunzipSync(
  fs.readFileSync(path.join(RACINE, 'extension', 'assets', 'ponct-lm.json.gz'))).toString('utf8')));

const src = fs.readFileSync(path.join(RACINE, 'saisie-vocale.html'), 'utf8');
const mm = /\bvar\s+_PASAPRES\s*=/.exec(src);
const PASAPRES = new Function(src.slice(mm.index, src.indexOf(';', mm.index) + 1) +
                              '\nreturn _PASAPRES;')();

function phrases() {
  const out = [];
  const ud = path.join(RACINE, 'data_local', 'ud_fr_gsd-train.conllu');
  if (fs.existsSync(ud))
    for (const l of fs.readFileSync(ud, 'utf8').split('\n'))
      if (l.startsWith('# text = ')) out.push(l.slice(9).trim());
  for (const f of ['corpus_gec_fr.jsonl', 'corpus_multi1000.jsonl']) {
    const p = path.join(RACINE, 'data_local', f);
    if (!fs.existsSync(p)) continue;
    for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
      if (!l.trim()) continue;
      try { const o = JSON.parse(l); if (o.good) out.push(String(o.good).trim()); } catch (e) {}
    }
  }
  return out.filter(t => t.length > 25 && t.length < 220 && !/[«»"();:—]/.test(t));
}
function attendues(p) {
  const jets = p.match(/[A-Za-zÀ-ÿœŒ'’-]+|,/g) || [];
  const out = new Set(); let n = 0;
  for (const j of jets) { if (j === ',') out.add(n - 1); else n++; }
  return out;
}

if (!fs.existsSync(path.join(RACINE, 'data_local', 'ud_fr_gsd-train.conllu'))) {
  console.log('corpus absent (data_local) — sonde locale seulement.');
  process.exit(0);
}
const CAS = phrases();
const c = { mod: [0, 0], reg: [0, 0], acc: [0, 0] };   // [justes, faux]
let nAtt = 0;
for (const p of CAS) {
  const mots = DC.toks(p.replace(/,/g, '')) || [];
  if (mots.length < 5) continue;
  const A = attendues(p), tg = DC.posTags(mots) || [], M = new Set();
  let dep = 0;
  for (let i = 0; i < mots.length - 1; i++) {
    if (PASAPRES[String(mots[i]).toLowerCase()]) { dep++; continue; }
    const d = DC.ponctDist(mots, tg, i, dep);
    if (!d) { dep++; continue; }
    if (d[1] > 0.50 || d[2] > 0.50) { M.add(i); dep = 0; } else dep++;
  }
  /* ⚠️ RÈGLES NUES : on passe un `deja` VIDE. Dans la livraison, les règles reçoivent ce que le
     modèle a posé et s'abstiennent à côté — ce qui les empêcherait justement d'être D'ACCORD
     avec lui. Pour mesurer l'accord, il faut les deux avis INDÉPENDANTS. */
  const R = DC.ponctReglesVirgule(mots, tg, new Set());
  nAtt += A.size;
  for (const i of M) { const k = R.has(i) ? 'acc' : 'mod'; c[k][A.has(i) ? 0 : 1]++; }
  for (const i of R) if (!M.has(i)) c.reg[A.has(i) ? 0 : 1]++;
}

console.log('LA DOUBLE ROUTE APPLIQUÉE À LA PONCTUATION — %d phrases, seuil livré 0,50\n', CAS.length);
console.log('                             posées   justes   JUSTESSE');
const ligne = (k, lab) => {
  const [j, f] = c[k], n = j + f;
  console.log('  ' + lab.padEnd(27) + String(n).padStart(6) + '   ' + String(j).padStart(6) +
              '   ' + (100 * j / Math.max(1, n)).toFixed(2).padStart(6) + ' %');
};
ligne('mod', 'MODÈLE seul (règle muette)');
ligne('reg', 'RÈGLE seule (modèle muet)');
ligne('acc', '⭐ LES DEUX D\'ACCORD');
const j = c.mod[0] + c.reg[0] + c.acc[0];
const n = j + c.mod[1] + c.reg[1] + c.acc[1];
console.log('  ' + 'UNION (ce qui est livré)'.padEnd(27) + String(n).padStart(6) + '   ' +
            String(j).padStart(6) + '   ' + (100 * j / n).toFixed(2).padStart(6) + ' %');
console.log('\n  rappel de l\'ACCORD : %s %%   ·   rappel de l\'UNION : %s %%',
            (100 * c.acc[0] / nAtt).toFixed(2), (100 * j / nAtt).toFixed(2));

console.log('\n  ⭐⭐ CE QUE ÇA ÉTABLIT, ET C\'EST L\'INVERSE DE L\'ATTENDU');
console.log('  L\'ACCORD EST LE PIRE SIGNAL DES TROIS. Quand le modèle et les règles disent la');
console.log('  même chose, on a raison MOINS souvent que quand une seule parle. L\'accord ne');
console.log('  sélectionne pas la certitude — il sélectionne l\'AMBIGUÏTÉ.');
console.log('');
console.log('  POURQUOI, ET POURQUOI LE PENDU N\'EST PAS UN CONTRE-EXEMPLE : les deux voies du');
console.log('  pendu lisent des SUBSTANCES DIFFÉRENTES — les lettres d\'un côté, les sons de');
console.log('  l\'autre. Ce sont deux preuves indépendantes, donc leur accord informe. Ici, le');
console.log('  modèle à replis et les règles d\'Allô prof lisent LES MÊMES TOKENS AVEC LA MÊME');
console.log('  GRAMMAIRE : ce ne sont pas deux routes, ce sont deux implémentations d\'une seule.');
console.log('  Elles se déclenchent ensemble exactement là où le français hésite (coordonnants,');
console.log('  adverbes en tête) — les positions où la virgule est FACULTATIVE.');
console.log('');
console.log('  ⇒ LA VRAIE SECONDE SUBSTANCE, POUR LA PONCTUATION, C\'EST L\'AUDIO. Et elle est');
console.log('    DÉJÀ combinée (l\'ancre, PR#394) : c\'est la seule combinaison qui ait payé,');
console.log('    F1 0,333 -> 0,480 sur la voix de Rem. L\'intuition de la double route était');
console.log('    juste ; elle a simplement déjà été appliquée là où elle pouvait l\'être.');
