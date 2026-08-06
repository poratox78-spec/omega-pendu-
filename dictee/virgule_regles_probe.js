#!/usr/bin/env node
/* LES RÈGLES DE VIRGULE D'ALLÔ PROF — écrites, puis MESURÉES AVANT d'être livrées.
 *
 * D'OÙ ELLES VIENNENT. Rem a fourni deux fiches (« La virgule », « Le coordonnant ») qui donnent
 * ce qui manquait : des LISTES FERMÉES. Deux règles en sortent, littéralement citables :
 *   R1 — « On place généralement une virgule AVANT le coordonnant, à l'exception de et, ou, ni. »
 *   R2 — « Lorsqu'un coordonnant est au début d'une phrase graphique, il faut habituellement
 *         placer une virgule APRÈS celui-ci. »   (« Ensuite, dépose le bouquet. »)
 *
 * POURQUOI DES RÈGLES ET PAS UN MEILLEUR MODÈLE. Mesuré : le moteur actuel (statistique) trouve
 * 3 virgules sur les 50 des exemples d'Allô prof — il ne connaît aucune des familles. Et son
 * plafond n'est pas un réglage : F1 0,21 contre 0,83 pour la littérature. Une règle explicite
 * par-dessus est le seul levier qui tienne dans ce qu'on embarque.
 *
 * ⚠️ LA GARDE QUI DÉCIDE DE TOUT : un coordonnant COORDONNE. « Il est AUSSI grand » n'est pas
 * une coordination, « alors QUE le koala dort » est une SUBORDINATION. Une règle qui poserait une
 * virgule devant chaque « donc / aussi / ainsi » saccagerait du français réel. On exige donc un
 * VERBE CONJUGUÉ de part et d'autre — c'est ce que le tagger sait faire, et c'est ce qui
 * distingue « deux phrases coordonnées » de « un adverbe dans un groupe ».
 *
 * ⚠️ ON MESURE SUR LES DEUX BANCS, et c'est le second qui a le dernier mot :
 *   · Allô prof  = sait-on faire ce que la grammaire décrit ?
 *   · corpus réel = à quel prix ? (C'est ce banc-là qui a fait REFUSER « À quoi sert cet outil ? »)
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const RACINE = path.dirname(__dirname);

require(path.join(RACINE, 'extension', 'dys-core.js'));
const DC = global.DYSCORE;
DC.setPosHmm(JSON.parse(fs.readFileSync(path.join(RACINE, 'dictee', 'pos_hmm.json'), 'utf8')));
DC.setPonctLm(JSON.parse(zlib.gunzipSync(
  fs.readFileSync(path.join(RACINE, 'extension', 'assets', 'ponct-lm.json.gz'))).toString('utf8')));

const A = require(path.join(RACINE, 'dictee', 'virgule_alloprof_probe.js'));

const reglesVirgule = (m, deja) => DC.ponctReglesVirgule(m, null, deja);   // UNE SEULE implementation : celle de dys-core, qui est livree

/* ── MESURE ─────────────────────────────────────────────────────────────────────────────── */
function attendues(phrase) {
  const jets = phrase.match(/[A-Za-zÀ-ÿœŒ'’-]+|,/g) || [];
  const out = new Set(); let n = 0;
  for (const j of jets) { if (j === ',') out.add(n - 1); else n++; }
  return out;
}
function union(a, b) { const o = new Set(a); for (const x of b) o.add(x); return o; }

function surCorpus(f) {
  const ud = path.join(RACINE, 'data_local', 'ud_fr_gsd-train.conllu');
  let vp = 0, fp = 0, fn = 0, n = 0;
  const ex = [];
  const lignes = fs.existsSync(ud) ? fs.readFileSync(ud, 'utf8').split('\n') : [];
  const phr = [];
  for (const l of lignes) if (l.startsWith('# text = ')) phr.push(l.slice(9).trim());
  for (const f2 of ['corpus_gec_fr.jsonl', 'corpus_multi1000.jsonl']) {
    const p = path.join(RACINE, 'data_local', f2);
    if (!fs.existsSync(p)) continue;
    for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
      if (!l.trim()) continue;
      try { const o = JSON.parse(l); if (o.good) phr.push(String(o.good).trim()); } catch (e) {}
    }
  }
  for (const p of phr) {
    if (p.length < 25 || p.length > 220 || /[«»"();:—]/.test(p)) continue;
    const mots = DC.toks(p.replace(/,/g, '')) || [];
    if (mots.length < 5) continue;
    n++;
    const att = attendues(p), got = f(mots);
    for (const i of att) { if (got.has(i)) vp++; else fn++; }
    for (const i of got) if (!att.has(i)) { fp++; if (ex.length < 8)
      ex.push(mots.slice(Math.max(0, i - 4), i + 1).join(' ') + ' ⟨,⟩ ' + mots.slice(i + 1, i + 4).join(' ')); }
  }
  return { n, vp, fp, fn, ex,
           just: 100 * vp / Math.max(1, vp + fp), rap: 100 * vp / Math.max(1, vp + fn) };
}

const VARIANTES = [
  ['modèle SEUL (livré)', m => A.moteurVirgule(m)],
  ['règles SEULES', reglesVirgule],
  ['modèle + règles', m => { const d = A.moteurVirgule(m); return union(d, reglesVirgule(m, d)); }],
];
console.log('BANC RÉEL — le prix de chaque variante\n');
for (const [nom, f] of VARIANTES) {
  const r = surCorpus(f);
  console.log('  ' + nom.padEnd(22) + ' justesse ' + r.just.toFixed(2) + ' % (' + r.vp + '/' + (r.vp + r.fp) +
              ')   rappel ' + r.rap.toFixed(2) + ' % (' + r.vp + '/' + (r.vp + r.fn) + ')');
  if (nom === 'règles SEULES' && r.ex.length) {
    console.log('     virgules EN TROP des règles :');
    r.ex.forEach(x => console.log('       ' + x));
  }
}
