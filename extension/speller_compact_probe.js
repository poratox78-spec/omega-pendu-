#!/usr/bin/env node
/* DICTIONNAIRE COMPACT : ZÉRO PERTE, MOT PAR MOT (13/10/2026 — Rem : « le pire ce serait des pertes, mets des gardes »).
 *
 * Le dictionnaire d'orthographe (710 872 mots) est passé de trois objets à 700 000 clés + un Set (193 Mo) à une Map d'index et des
 * tableaux numériques (59 Mo). Ce banc RECONSTRUIT ici l'ANCIEN rangement, ligne pour ligne comme l'ancien _applySpellerTSV
 * (WORDS, FREQ, POS, D2A trié par fréquence, les 6 mots valides ajoutés), et exige que le moteur réponde EXACTEMENT pareil :
 *   ① chaque mot : connu ? (WORDS.has) · fréquence (spF) · nature (spP) — mêmes valeurs, au bit près ;
 *   ② chaque clé sans accent : mêmes formes, dans le MÊME ORDRE (spD) — et aucune clé en plus ;
 *   ③ des mots ABSENTS restent absents (fautes, mots inventés, pièges d'objet JS : constructor, __proto__) ;
 *   ④ statique : aucune lecture SP.FREQ[…] / SP.POS[…] / SP.D2A[…] dans dys-core.js ni dans l'app (une Map ne répond pas aux
 *      crochets : une telle lecture rendrait « inconnu » EN SILENCE) ; les fonctions du rangement sont identiques des deux côtés.
 *   node extension/speller_compact_probe.js        (sortie 1 = une perte)
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const H = __dirname, ROOT = path.join(H, '..');
const txt = zlib.gunzipSync(fs.readFileSync(path.join(H, 'assets', 'speller.tsv.gz'))).toString('utf8');
// chargeur partiel voulu : garde du rangement du dictionnaire (orthographe seule) (extension/chargeur_probe.js ; le produit complet : extension/charger_node.js)
require(path.join(H, 'dys-core.js'));
const D = global.DYSCORE;
D.setLex({ v: [] }, null, txt);
const L = D._spLire, echecs = [];
const ech = (m) => { if (echecs.length < 30) echecs.push(m); else if (echecs.length === 30) echecs.push('…'); };
// ANCIEN rangement (copie de l'ancien _applySpellerTSV, sans PHON / RARE / ANAL qui n'ont pas changé)
function deaccS(s) { return s.replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
const WORDS = new Set(), FREQ = Object.create(null), POS = Object.create(null), D2A = Object.create(null);
for (const ln of txt.split('\n')) { if (!ln) continue; const pr = ln.split('\t'); if (pr.length < 2) continue;
  const w = pr[0], fr = parseInt(pr[1], 10) / 1000; WORDS.add(w); FREQ[w] = fr; if (pr[2]) POS[w] = pr[2];
  if (fr > 0) { const d = deaccS(w); (D2A[d] || (D2A[d] = [])).push(w); } }
['postulée', 'postulées', 'entretint', 'entretinrent', 'armet', 'armets'].forEach((w) => WORDS.add(w));
// ⭐ 15/10/2026 (liste n° 5b) — RETRAIT VOULU : une forme en « -è » final dont le jumeau en « -é » existe est une coquille de la source
// (aimè, donnè… : le correcteur se taisait dessus) — sauf burkinabè. Le banc reproduit ce retrait et vérifie que lui seul a changé : ces formes, aucune autre.
const RETIRES = [...WORDS].filter((w) => w.endsWith('è') && WORDS.has(w.slice(0, -1) + 'é') && w !== 'burkinabè');
for (const w of RETIRES) { WORDS.delete(w); const d = deaccS(w); if (D2A[d]) { D2A[d] = D2A[d].filter((x) => x !== w); if (!D2A[d].length) delete D2A[d]; } delete FREQ[w]; delete POS[w]; }
if (RETIRES.length !== 88) ech('⑤ ' + RETIRES.length + ' coquilles en « -è » retirées, 88 attendues (relevé du 15/10/2026 ; +1 le 18/10, liste n° 108 : « gravillonné » entré, son jumeau « gravillonnè » est retiré)');
for (const w of RETIRES) if (L.W(w)) ech('⑤ « ' + w + ' » : coquille en « -è », encore connue du moteur');
if (!L.W('burkinabè')) ech('⑤ « burkinabè » (vrai mot) n\'est plus connu');
// ⭐ 17/10/2026 (liste n° 52) — RETRAIT VOULU : coquilles entrées dans le lexique (avie, jammais, commant…), liste lue dans dys-core (_LEX_COQ52).
const _src52 = require('fs').readFileSync(require('path').join(__dirname, 'dys-core.js'), 'utf8');
const _m52 = /var _LEX_COQ52=\{([^}]*)\}/.exec(_src52);
const COQ52 = _m52 ? [..._m52[1].matchAll(/"([^"]+)":1/g)].map((m) => m[1]) : [];
if (COQ52.length !== 82) ech('⑥ ' + COQ52.length + ' coquilles _LEX_COQ52 lues dans dys-core, 82 attendues (relevé du 17/10/2026)');
for (const w of COQ52) { if (!WORDS.has(w)) continue; WORDS.delete(w); const d = deaccS(w); if (D2A[d]) { D2A[d] = D2A[d].filter((x) => x !== w); if (!D2A[d].length) delete D2A[d]; } delete FREQ[w]; delete POS[w]; }
for (const w of COQ52) if (L.W(w)) ech('⑥ « ' + w + ' » : coquille du lexique, encore connue du moteur');
if (!L.W('iels')) ech('⑥ « iels » (gardé : pronom) n\'est plus connu');
const sf = (a, b) => FREQ[b] - FREQ[a];
for (const d in D2A) D2A[d].sort(sf);
// ① chaque mot
let n1 = 0;
for (const w of WORDS) { n1++;
  if (!L.W(w)) ech('① « ' + w + ' » n\'est plus connu');
  const f0 = FREQ[w], f1 = L.F(w); if (!Object.is(f0, f1)) ech('① « ' + w + ' » fréquence ' + f0 + ' → ' + f1);
  const p0 = POS[w], p1 = L.P(w); if (p0 !== p1) ech('① « ' + w + ' » nature ' + p0 + ' → ' + p1); }
// ② chaque clé sans accent, dans le même ordre, et aucune clé en plus
let n2 = 0;
for (const d in D2A) { n2++; const a = D2A[d], b = L.D(d) || [];
  if (a.length !== b.length || a.some((x, k) => x !== b[k])) ech('② « ' + d + ' » : ' + JSON.stringify(a) + ' → ' + JSON.stringify(b)); }
const k1 = L.cles(); if (k1.length !== n2) ech('② ' + k1.length + ' clés sans accent dans le moteur, ' + n2 + ' attendues');
// ③ des absents restent absents
for (const w of ['fenetre', 'jappons', 'constructor', '__proto__', 'tostring', 'hasownproperty', 'zzqx', ''])
  if (!WORDS.has(w) && (L.W(w) || L.F(w) !== undefined || L.P(w) !== undefined)) ech('③ « ' + w + ' » absent du fichier mais connu du moteur');
// ④ statique
const SRC = { 'dys-core.js': fs.readFileSync(path.join(H, 'dys-core.js'), 'utf8'), 'app/omega-pendu.html': fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8') };
for (const [n, s] of Object.entries(SRC)) {
  const m = s.match(/SP\.(?:FREQ|POS|D2A)\s*\[|in SP\.(?:FREQ|POS|D2A)\b|Object\.keys\(SP\.(?:FREQ|POS|D2A)\)/g);
  if (m) ech('④ ' + n + ' lit encore l\'ancien rangement : ' + m.slice(0, 5).join(' · '));
}
const bloc = (s) => { const a = s.indexOf('  var _SPN='), b = s.indexOf('  function spD('); return a < 0 || b < 0 ? null : s.slice(a, s.indexOf('\n', b)); };
if (!bloc(SRC['dys-core.js']) || bloc(SRC['dys-core.js']) !== bloc(SRC['app/omega-pendu.html'])) ech('④ les fonctions du rangement compact diffèrent entre dys-core.js et l\'app');
if (echecs.length) { console.log('✗ DICTIONNAIRE COMPACT — PERTE :\n  ' + echecs.join('\n  ')); process.exit(1); }
console.log('✓ dictionnaire compact : ' + n1 + ' mots (connu, fréquence, nature) et ' + n2 + ' clés sans accent (formes ET ordre) identiques à l\'ancien rangement ; aucune lecture à l\'ancienne ; app ≡ extension');
