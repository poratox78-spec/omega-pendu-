// ===== Batterie du correcteur, rejouée sur le PRODUIT (ligne 25b, 22/10/2026) =====
// Retrait progressif du moteur Python (accord de Rem : le débrancher sans perte, sans le supprimer). Cette sonde rejoue la batterie
// de dictee/correcteur_probe.py — mêmes trois volets, mêmes verdicts — sur le moteur du PRODUIT (extension/dys-core.js + assets,
// chargés par extension/charger_node.js), à partir de dictee/sentences.json et dictee/batterie_correcteur.json
// (export_batterie.py : le JSON suit le Python tant qu'il reste).
//   [1] phrases correctes : AUCUNE marque (FP=0, zéro dur) ;
//   [2] témoins : la forme juste ne déclenche rien ; la faute injectée est REPÉRÉE puis CORRIGÉE (planchers) ;
//   [3] silences attendus : rien ne parle (« rouge » : seul le rouge est interdit ; 4e champ : seul CE mot doit se taire).
// Mesuré à la pose : même verdict que le Python sur les 333 témoins (320 repérés, 320 corrigés), 0 marque sur les 333 phrases.
// Une seule tolérance, propre au produit : un témoin écrit SANS accent (« Ce systeme fonctionne », voulu, pour tester la règle sur
// un mot non accentué) — le produit rétablit en plus l'accent (« système ») ; ce n'est ni une fausse alerte ni un raté.
//   node dictee/batterie_produit.js
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = require(path.join(ROOT, 'extension', 'charger_node.js'))({ ext: path.join(ROOT, 'extension') });
const SENT = require('./sentences.json');
const B = require('./batterie_correcteur.json');
const PLANCHER = 320;   // détection ET correction mesurées à la pose (22/10/2026) — monter avec les cas ajoutés, jamais descendre
const deacc = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const lo = (s) => deacc(s.toLowerCase());
const marques = (t) => D.diagnoseAll(t).flags.filter((x) => x.name !== 'point final');
const accentSeul = (f, sansAccent) => sansAccent && lo(f.sugg) === lo(f.word);   // le produit rétablit l'accent d'un témoin écrit sans

const err = [];
// [1]
const fpCorpus = [];
for (const e of SENT) for (const f of marques(e.text)) fpCorpus.push(`« ${f.word} »→« ${f.sugg} » [${f.name}] dans : ${e.text}`);
console.log(`  [1] Faux positifs sur ${SENT.length} phrases CORRECTES : ${fpCorpus.length}`);
fpCorpus.forEach((x) => console.log('        ⚠️ ' + x));
if (fpCorpus.length) err.push(`${fpCorpus.length} FAUX POSITIF(S) sur texte CORRECT — FP=0 est un zéro DUR`);
// [2]
let fpCases = 0, det = 0, corr = 0;
const rates = [];
for (const [good, trig, wrong, name] of B.cases) {
  const sansAccent = deacc(trig) === trig;
  if (marques(good).some((f) => lo(f.word) === lo(trig) && !accentSeul(f, sansAccent))) { fpCases++; rates.push(`fp : ${good} [${name}]`); }
  const bad = D.toks(good).map((t) => (lo(t) === lo(trig) ? wrong : t)).join(' ');
  const h = marques(bad).find((f) => lo(f.word) === lo(wrong));
  if (h) {
    det++;
    if (h.sugg.toLowerCase() === trig.toLowerCase() || (sansAccent && lo(h.sugg) === trig.toLowerCase())) corr++;
    else rates.push(`correction : ${bad} → ${h.sugg} (attendu ${trig}) [${name}]`);
  }
}
const n = B.cases.length;
console.log(`  [2] Témoins (${n}) : faux positifs ${fpCases} · DÉTECTION ${det} · CORRECTION ${corr} (plancher ${PLANCHER})`);
rates.forEach((x) => console.log('        · ' + x));
if (fpCases) err.push(`${fpCases} faux positif(s) sur les témoins (attendu 0)`);
if (det < PLANCHER) err.push(`DÉTECTION ${det}/${n} < plancher ${PLANCHER}`);
if (corr < PLANCHER) err.push(`CORRECTION ${corr}/${n} < plancher ${PLANCHER}`);
// [3]
const parlent = [];
for (const e of B.muets) {
  let f = marques(e[0]);
  if (e.length > 3 && e[3]) f = f.filter((x) => lo(x.word) === lo(e[3]));
  if (e.length > 2 && e[2] === 'rouge') f = f.filter((x) => x.tier === 'auto' || x.tier === 'flag');
  if (f.length) parlent.push(`${e[0]} — ${f.map((x) => x.word + '→' + x.sugg + ' [' + x.tier + ']').join(' · ')}`);
}
console.log(`  [3] Silences ATTENDUS (${B.muets.length}) : ${B.muets.length - parlent.length}/${B.muets.length} muets`);
parlent.forEach((x) => console.log('        ⚠️ PARLE : ' + x));
if (parlent.length) err.push(`${parlent.length} silence(s) attendu(s) rompu(s) — un piège muet PARLE`);
if (err.length) { console.error('✗ BATTERIE AU PRODUIT : régression :\n    ' + err.join('\n    ')); process.exit(1); }
console.log(`✓ batterie du correcteur AU PRODUIT : 0 FP sur ${SENT.length} phrases, témoins ${det}/${corr} sur ${n}, ${B.muets.length} silences tenus`);
