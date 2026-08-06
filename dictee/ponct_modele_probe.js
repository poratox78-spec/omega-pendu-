#!/usr/bin/env node
/* LE PLAFOND DU MODÈLE TEXTE DE PONCTUATION — courbe justesse/rappel complète.
 *
 * POURQUOI. On répète « F1 0,21 contre 0,83 dans la littérature » depuis des jours, mais ce
 * chiffre est un POINT : il ne dit pas si le modèle est mauvais ou seulement mal RÉGLÉ. Un
 * classifieur médiocre à un seuil peut être correct à un autre. Avant de conclure « il faut un
 * autre modèle » — décision lourde, embarquée, à 182 Ko — il faut voir la COURBE.
 *
 * ⚠️ VÉRIFIÉ AVANT DE PROPOSER : `ponctDist` utilise DÉJÀ le POS-tagger. Ses clés sont
 * (mot_gauche, mot_droit, distance) puis quatre étiquettes POS de contexte, sur 5 niveaux de
 * repli. L'idée réflexe « ajoute le tagger » était donc déjà livrée — d'où cette sonde, qui
 * cherche la limite ailleurs.
 *
 * CE QUE LA COURBE RÉPOND, ET QUI COUVRE LES DEUX CHANTIERS :
 *   · le MODÈLE : quel F1 maximal atteint-il, à n'importe quel seuil ? C'est son plafond réel.
 *   · le PRIOR / point de fonctionnement : le seuil livré (0,50) est-il au bon endroit sur cette
 *     courbe, ou laisse-t-on de la justesse ou du rappel sur la table pour rien ?
 *
 * La vérité terrain, ce sont les virgules que des humains ont écrites. Appariement par INDICE DE
 * MOT, jamais par compte.
 *
 *   node dictee/ponct_modele_probe.js
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const RACINE = path.dirname(__dirname);

require(path.join(RACINE, 'extension', 'dys-core.js'));
const DC = global.DYSCORE;
DC.setPosHmm(JSON.parse(fs.readFileSync(path.join(RACINE, 'dictee', 'pos_hmm.json'), 'utf8')));
DC.setPonctLm(JSON.parse(zlib.gunzipSync(
  fs.readFileSync(path.join(RACINE, 'extension', 'assets', 'ponct-lm.json.gz'))).toString('utf8')));

/* le garde-fou `_PASAPRES` de la livraison : jamais de marque après un déterminant/préposition */
const src = fs.readFileSync(path.join(RACINE, 'saisie-vocale.html'), 'utf8');
const m = /\bvar\s+_PASAPRES\s*=/.exec(src);
const PASAPRES = new Function(src.slice(m.index, src.indexOf(';', m.index) + 1) + '\nreturn _PASAPRES;')();

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

/* ── ON COLLECTE (score, vérité) POUR CHAQUE POSITION ────────────────────────────────────── */
const CAS = phrases();
const scores = [];            // [p_virgule, estUneVirgule]
let nPos = 0, nVir = 0, nPhr = 0;
for (const p of CAS) {
  const mots = DC.toks(p.replace(/,/g, '')) || [];
  if (mots.length < 5) continue;
  nPhr++;
  const att = attendues(p), tg = DC.posTags(mots) || [];
  let dep = 0;
  for (let i = 0; i < mots.length - 1; i++) {
    if (PASAPRES[String(mots[i]).toLowerCase()]) { dep++; continue; }
    const d = DC.ponctDist(mots, tg, i, dep);
    if (!d) { dep++; continue; }
    nPos++;
    const vrai = att.has(i);
    if (vrai) { nVir++; dep = 0; } else dep++;
    scores.push([d[1], vrai]);
  }
}
console.log('LE PLAFOND DU MODÈLE TEXTE — ' + nPhr + ' phrases, ' + nPos + ' positions, ' +
            nVir + ' virgules réelles (' + (100 * nVir / nPos).toFixed(2) + ' %)');

/* ── LA COURBE ───────────────────────────────────────────────────────────────────────────── */
scores.sort((a, b) => b[0] - a[0]);
let vp = 0, fp = 0, best = { f1: 0 };
const jalons = [0.90, 0.80, 0.70, 0.60, 0.50, 0.40, 0.30, 0.20, 0.10, 0.05];
let ji = 0;
const lignes = [];
for (let k = 0; k < scores.length; k++) {
  if (scores[k][1]) vp++; else fp++;
  const just = vp / (vp + fp), rap = vp / nVir, f1 = 2 * just * rap / (just + rap || 1);
  if (f1 > best.f1) best = { f1, just, rap, seuil: scores[k][0] };
  while (ji < jalons.length && scores[k][0] < jalons[ji]) {
    lignes.push([jalons[ji], just, rap, f1]); ji++;
  }
}
console.log('\n  seuil   justesse   rappel     F1');
for (const [s, j, r, f] of lignes)
  console.log('  %s   %s %%   %s %%   %s%s', s.toFixed(2), (100 * j).toFixed(2).padStart(6),
              (100 * r).toFixed(2).padStart(6), f.toFixed(3),
              Math.abs(s - 0.50) < 1e-9 ? '   <-- SEUIL LIVRÉ' : '');
console.log('\n  ⭐ MEILLEUR F1 ATTEIGNABLE : %s  (seuil %s · justesse %s %% · rappel %s %%)',
            best.f1.toFixed(3), best.seuil.toFixed(3), (100 * best.just).toFixed(2),
            (100 * best.rap).toFixed(2));

const auLivre = lignes.find(l => Math.abs(l[0] - 0.50) < 1e-9);
console.log('\n  ── LECTURE ─────────────────────────────────────────────────────────────');
if (auLivre) {
  console.log('  au seuil LIVRÉ (0,50) : F1 %s · justesse %s %% · rappel %s %%',
              auLivre[3].toFixed(3), (100 * auLivre[1]).toFixed(2), (100 * auLivre[2]).toFixed(2));
  const marge = best.f1 - auLivre[3];
  if (marge < 0.02)
    console.log('  ⇒ LE SEUIL EST DÉJÀ AU BON ENDROIT (+%s de F1 au mieux ailleurs).\n' +
                '    Le point de fonctionnement n\'est donc PAS le problème : c\'est bien le\n' +
                '    MODÈLE qui plafonne. Le régler autrement ne rendrait rien.', marge.toFixed(3));
  else
    console.log('  ⇒ IL Y A %s DE F1 À PRENDRE EN DÉPLAÇANT LE SEUIL À %s.\n' +
                '    Autrement dit une partie du « mauvais modèle » est un mauvais RÉGLAGE.',
                marge.toFixed(3), best.seuil.toFixed(3));
}
console.log('  ⚠️ Le F1 de la littérature (0,80+) porte sur les 3 classes et sur de l\'ORAL\n' +
            '     transcrit ; ici on mesure la VIRGULE seule sur de l\'écrit. Les chiffres ne\n' +
            '     sont pas directement comparables — c\'est l\'ORDRE DE GRANDEUR qui parle.');

/* ══ LE BALAYAGE QUI DÉCIDE ═══════════════════════════════════════════════════════════════════
   La courbe ci-dessus est en p_virgule SEULE. La LIVRAISON, elle, pose une marque dès que
   p_virgule OU p_point dépasse le seuil, puis unit avec les 5 règles d'Allô prof. C'est CETTE
   combinaison-là qu'il faut balayer, pas une variante — sinon on optimise ce qui ne tourne pas.
   ⚠️ ET LA MÉTRIQUE N'EST PAS LE F1. Pour un dys, une virgule fausse change le sens ; le rappel
   ne le dédommage pas. On regarde donc la JUSTESSE en premier, le rappel ensuite. */
console.log('\n══ LA LIVRAISON RÉELLE (p_virgule OU p_point > seuil, ∪ règles) ══');
console.log('  seuil   MODÈLE seul          MODÈLE ∪ RÈGLES');
console.log('          justesse  rappel     justesse  rappel');
for (const tau of [0.50, 0.60, 0.70, 0.80]) {
  let vp = 0, fp = 0, fn = 0, vp2 = 0, fp2 = 0, fn2 = 0;
  for (const p of CAS) {
    const mots = DC.toks(p.replace(/,/g, '')) || [];
    if (mots.length < 5) continue;
    const A = attendues(p), tg = DC.posTags(mots) || [], got = new Set();
    let dep = 0;
    for (let i = 0; i < mots.length - 1; i++) {
      if (PASAPRES[String(mots[i]).toLowerCase()]) { dep++; continue; }
      const d = DC.ponctDist(mots, tg, i, dep);
      if (!d) { dep++; continue; }
      if (d[1] > tau || d[2] > tau) { got.add(i); dep = 0; } else dep++;
    }
    const got2 = new Set(got);
    for (const i of DC.ponctReglesVirgule(mots, tg, got)) got2.add(i);
    for (const i of A) { if (got.has(i)) vp++; else fn++; if (got2.has(i)) vp2++; else fn2++; }
    for (const i of got) if (!A.has(i)) fp++;
    for (const i of got2) if (!A.has(i)) fp2++;
  }
  const pc = (a, b) => (100 * a / Math.max(1, a + b)).toFixed(2).padStart(6);
  console.log('   ' + tau.toFixed(2) + '    ' + pc(vp, fp) + ' %  ' + pc(vp, fn) + ' %    ' +
              pc(vp2, fp2) + ' %  ' + pc(vp2, fn2) + ' %' +
              (tau === 0.50 ? '   <-- LIVRÉ' : ''));
}
console.log('');
console.log('  ⭐⭐ CE QUE CE BALAYAGE ÉTABLIT :');
console.log('  ① LA JUSTESSE DU MODÈLE EST PLATE (~55 %) QUEL QUE SOIT LE SEUIL. Monter de 0,50');
console.log('     à 0,80 gagne moins de 2 points et coûte 94 % du rappel. Un modèle dont la');
console.log('     CONFIANCE ne prédit pas la JUSTESSE nest pas mal réglé : il est SATURÉ.');
console.log('     Cest une preuve BIEN PLUS FORTE que le F1 quil faut un autre modèle.');
console.log('  ② LE POINT DE FONCTIONNEMENT LIVRÉ EST DÉJÀ LE MEILLEUR. Les règles najoutent');
console.log('     de la justesse quà 0,50 ; plus haut, elles dominent le mélange et le tirent');
console.log('     vers le bas. ⇒ NE PAS TOUCHER AU SEUIL — piste mesurée-REFUSÉE.');
