#!/usr/bin/env node
/* LE BANC RÉEL DE LA VIRGULE — celui qui dira le prix de chaque règle.
 *
 * POURQUOI IL EST INDISPENSABLE, ET POURQUOI IL EST SÉPARÉ DE L'AUDIT ALLÔ PROF.
 * `virgule_alloprof_probe.js` mesure la CONFORMITÉ À LA SOURCE : est-ce qu'on sait faire ce que
 * la grammaire décrit ? Il ne dit RIEN du coût. Une règle qui met une virgule devant tous les
 * « donc » aurait 100 % sur les exemples d'Allô prof et saccagerait du français réel.
 * Ce banc-ci mesure le PRIX : sur des phrases écrites par des humains, où sont leurs virgules,
 * et où mettons-nous les nôtres ?
 *
 * C'est la même paire que pour l'interrogative (source ↔ corpus), et c'est elle qui a permis de
 * REFUSER « À quoi sert cet outil ? » : 32/32 chez Allô prof, mais 79 % de précision sur le réel.
 *
 * L'UNITÉ, la même que partout : justesse = virgules posées qui sont à la bonne place ·
 * rappel = virgules attendues qu'on retrouve. Appariement par INDICE DE MOT, jamais par compte.
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const RACINE = path.dirname(__dirname);

require(path.join(RACINE, 'extension', 'dys-core.js'));
const DC = global.DYSCORE;
DC.setPosHmm(JSON.parse(fs.readFileSync(path.join(RACINE, 'dictee', 'pos_hmm.json'), 'utf8')));
DC.setPonctLm(JSON.parse(zlib.gunzipSync(
  fs.readFileSync(path.join(RACINE, 'extension', 'assets', 'ponct-lm.json.gz'))).toString('utf8')));

const { moteurVirgule } = require(path.join(RACINE, 'dictee', 'virgule_alloprof_probe.js'));

/* ── LE CORPUS : du français écrit par des humains, avec LEURS virgules ──────────────────── */
function phrases(limite) {
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
  // ⚠️ On ne garde QUE des phrases à la ponctuation nette : pas de guillemets, pas de
  // parenthèses, pas de points-virgules. Sinon on mesurerait notre incapacité à reproduire une
  // typographie qu'on ne prétend pas produire.
  return out.filter(t => t.length > 25 && t.length < 220 && !/[«»"();:—]/.test(t))
            .slice(0, limite || 20000);
}

function attendues(phrase) {
  const jets = phrase.match(/[A-Za-zÀ-ÿœŒ'’-]+|,/g) || [];
  const out = new Set(); let n = 0;
  for (const j of jets) { if (j === ',') out.add(n - 1); else n++; }
  return out;
}

const CAS = phrases();
let vp = 0, fp = 0, fn = 0, nPh = 0;
const exFP = [];
for (const p of CAS) {
  const mots = DC.toks(p.replace(/,/g, '')) || [];
  if (mots.length < 5) continue;
  nPh++;
  const att = attendues(p), got = moteurVirgule(mots);
  for (const i of att) { if (got.has(i)) vp++; else fn++; }
  for (const i of got) if (!att.has(i)) {
    fp++;
    if (exFP.length < 10) exFP.push(mots.slice(Math.max(0, i - 4), i + 1).join(' ') + ' ⟨,⟩ ' +
                                    mots.slice(i + 1, i + 5).join(' '));
  }
}
console.log('BANC RÉEL DE LA VIRGULE — %d phrases écrites par des humains', nPh);
console.log('  virgules attendues : %d', vp + fn);
console.log('  JUSTESSE %s %%   (%d bien placées sur %d posées)',
            (100 * vp / Math.max(1, vp + fp)).toFixed(2), vp, vp + fp);
console.log('  RAPPEL   %s %%   (%d retrouvées sur %d)',
            (100 * vp / Math.max(1, vp + fn)).toFixed(2), vp, vp + fn);
if (exFP.length) { console.log('\n  virgules EN TROP (échantillon) :'); exFP.forEach(x => console.log('    ' + x)); }
