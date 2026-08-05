#!/usr/bin/env node
/* LE PRIOR DE LA DICTÉE — mesuré là où il vaut, c'est-à-dire dans de la vraie dictée.
 *
 * POURQUOI CETTE SONDE EXISTE. L'arbitre a d'abord été monté avec le prior du modèle texte
 * (694 949 phrases écrites : 86,1 % rien · 8,2 % virgule · 5,6 % point) appliqué PARTOUT. Le banc
 * l'a puni : sur les prises réelles il tombait de 80 % à 52 % de justesse. La cause est visible
 * d'une ligne — une COUPURE DE GOOGLE n'est pas un interstice au hasard. Web Speech finalise sur
 * une pause longue, et quelqu'un qui dicte se tait entre ses phrases. Le prior y est donc tout
 * autre, et un prior de texte écrit y est simplement faux.
 *
 * CE QU'ON MESURE : sur les prises de Rem, la marque que porte la référence
 *   ① aux frontières de segment de Google   ② à l'intérieur des segments
 * ⚠️ EFFECTIF : trois prises, ~27 marques. C'est peu et on ne le cachera pas. Mais un petit
 * corpus du BON domaine bat un grand corpus du mauvais : le lit parlementaire a 0,4 % de points
 * (clips d'une phrase, pauses d'orateur au milieu des phrases) — il ne peut pas juger une dictée.
 * On lisse fort et on ne se sert de ces chiffres que comme d'un PRIOR, jamais comme d'une règle.
 */
'use strict';
const fs = require('fs'), path = require('path');
const SP = process.argv[2];
if (!SP) { console.log('usage : node ponct_prior_dictee_probe.js <dossier des prises>'); process.exit(1); }

const norm = t => String(t).toLowerCase().replace(/[’]/g, "'");
function motsEtMarques(t) {
  const mots = [], marque = [];
  for (const x of (norm(t).match(/[\wà-ÿ'-]+|[,.;:!?]/g) || [])) {
    if (/^[,.;:!?]$/.test(x)) { if (mots.length) marque[mots.length - 1] = (x === ',' ? ',' : '.'); }
    else { mots.push(x); marque.push(null); }
  }
  return { mots, marque };
}

const front = { '': 0, ',': 0, '.': 0 }, dedans = { '': 0, ',': 0, '.': 0 };
let nFront = 0;
for (const f of ['prise2', 'prise3', 'libre']) {
  const p = path.join(SP, f + '.json');
  if (!fs.existsSync(p)) continue;
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  const REF = (Array.isArray(d.ref) ? d.ref.join(' ') : (d.ref || '')).trim();
  if (!REF) continue;
  const B = motsEtMarques(REF);
  /* Les mots dictés viennent de Google, la référence est ce que Rem voulait écrire : ils ne
     coïncident pas mot pour mot (Google mange des mots). On aligne donc par LCS — la même
     précaution que dans le rejeu, où l'alignement par indice fabriquait de fausses marques. */
  const A = motsEtMarques(d.segs.join(' '));
  const n = A.mots.length, m = B.mots.length;
  const T = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      T[i][j] = A.mots[i] === B.mots[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
  const app = new Map();
  for (let i = 0, j = 0; i < n && j < m;) {
    if (A.mots[i] === B.mots[j]) { app.set(i, j); i++; j++; }
    else if (T[i + 1][j] >= T[i][j + 1]) i++; else j++;
  }
  // indices (dans le flux de mots dictés) qui sont le DERNIER mot d'un segment Google
  const finSeg = new Set();
  let k = 0;
  for (const s of d.segs) { k += (norm(s).match(/[\wà-ÿ'-]+/g) || []).length; finSeg.add(k - 1); }
  for (let i = 0; i < n; i++) {
    if (!app.has(i)) continue;
    const mk = B.marque[app.get(i)] || '';
    const estDernier = i === n - 1;      // la marque finale est ajoutée d'office : hors compte
    if (estDernier) continue;
    if (finSeg.has(i)) { front[mk]++; nFront++; } else { dedans[mk]++; }
  }
}

function ligne(nom, c) {
  const s = c[''] + c[','] + c['.'];
  if (!s) { console.log('  ' + nom + ' : aucun cas'); return null; }
  const pr = [c[''] / s, c[','] / s, c['.'] / s];
  console.log('  ' + nom.padEnd(24) + ' rien ' + (100 * pr[0]).toFixed(0).padStart(3) + ' %  virgule ' +
    (100 * pr[1]).toFixed(0).padStart(3) + ' %  point ' + (100 * pr[2]).toFixed(0).padStart(3) +
    ' %   (n=' + s + ' : ' + c[''] + '/' + c[','] + '/' + c['.'] + ')');
  return pr;
}
console.log('PRIOR MESURE SUR LA VRAIE DICTEE (3 prises de Rem)\n');
const pf = ligne('FRONTIERE de segment', front);
const pd = ligne('INTERIEUR de segment', dedans);
console.log('\n  rappel — prior du modele TEXTE ecrit : rien  86 %  virgule   8 %  point   6 %');
console.log('  rappel — lit PARLEMENTAIRE lu       : rien  92 %  virgule   8 %  point   0 %');
if (pf) {
  console.log('\n=> Une coupure de Google en dictee porte une marque ' +
    (100 * (pf[1] + pf[2])).toFixed(0) + ' % du temps, contre ' +
    '14 % pour une pause longue de discours parlementaire.');
  console.log('   C\'est CE chiffre-la qui manquait a l\'arbitre.');
}
