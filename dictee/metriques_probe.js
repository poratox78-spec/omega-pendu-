/* metriques_probe.js — LES CHIFFRES DE MESURE AFFICHÉS SUR LE SITE ONT UN REGISTRE UNIQUE.
 *
 * Pourquoi (2026-08-19, reconnaissance French Bites §2.2 — l'idée, réimplémentée maison) : les
 * pages publiques citent des tailles de corpus (« FP=0 mesuré sur 14 450 phrases ») écrites À LA
 * MAIN dans plusieurs fichiers. Aujourd'hui elles sont cohérentes (vérifié : 8 valeurs = 8 corpus
 * distincts). Le jour où une mesure évolue, rien ne force la propagation — c'est exactement le
 * bug de dérive documentaire : « mesuré, pas promis » sapé par un chiffre périmé.
 *
 * Le garde-fou : ce fichier EST le registre. Deux contrôles :
 *   ① chaque valeur enregistrée apparaît bien dans chaque page listée (au moins n fois) ;
 *   ② TOUT « N phrases » (N ≥ 100) trouvé dans une page publique doit être au registre — un
 *      chiffre nouveau ou modifié dans une page sans passer par ici = CI rouge. La propagation
 *      devient structurelle : on ne PEUT pas changer un chiffre à un seul endroit.
 * Les corpus locaux (data_local) ne sont pas lus : on épingle ce que le SITE AFFIRME, pas les
 * données — la vérité des mesures reste portée par les sondes de mesure elles-mêmes.
 */
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');

/* valeur → { nom (provenance de la mesure), pages: { fichier: occurrences minimales } } */
const REGISTRE = {
  694949: { nom: 'prior de ponctuation — phrases FR du modèle texte (PR#399)',
            pages: { 'saisie-vocale.html': 1 } },
  48653:  { nom: 'mesure du « ? » texte-seul — 145 marques dont 79 fausses (PR#403)',
            pages: { 'saisie-vocale.html': 1 } },
  16342:  { nom: 'français encyclopédique réel — taux de fausse alerte du correcteur',
            pages: { 'correcteur.html': 1 } },
  15353:  { nom: 'flood EN édité PUD+GUM — règles anglaises (REGLES_EN)',
            pages: { 'en/correcteur-outil.html': 3 } },
  14450:  { nom: 'UD FR complet (14 450 phrases correctes) — FP=0 du correcteur',
            pages: { 'correcteur.html': 1, 'recherche.html': 1, 'saisie-vocale.html': 1 } },
  11304:  { nom: 'phrases écrites par des humains — précision/rappel du speller',
            pages: { 'recherche.html': 1, 'saisie-vocale.html': 1 } },
  2500:   { nom: 'UD 2 500 (échantillon encyclopédique) — FP à l\'échelle + tagger',
            pages: { 'arbitrage.html': 1, 'recherche.html': 3, 'toile.html': 2 } },
};

const pages = [
  ...fs.readdirSync(R).filter(f => f.endsWith('.html')),
  ...fs.readdirSync(path.join(R, 'en')).map(f => 'en/' + f).filter(f => f.endsWith('.html')),
];

/* « 14&nbsp;450 phrases », « 2 500 phrases », « 15 353 phrases » → valeur normalisée */
const RE = /([0-9](?:[0-9   ]|&nbsp;){0,7}[0-9])\s*(?:&nbsp;)?\s*phrases/gi;

let err = 0;
function ko(msg) { err++; console.log('  ✗ ' + msg); }

/* ② balayage : tout chiffre affiché doit être au registre */
const vus = {};   // valeur → { fichier → count }
for (const p of pages) {
  const s = fs.readFileSync(path.join(R, p), 'utf8');
  let m; RE.lastIndex = 0;
  while ((m = RE.exec(s))) {
    const v = parseInt(m[1].replace(/&nbsp;|[   ]/g, ''), 10);
    if (v < 100) continue;                       // « 82 phrases d'exemple » etc. : hors registre
    (vus[v] = vus[v] || {})[p] = (vus[v][p] || 0) + 1;
    if (!REGISTRE[v]) ko(p + ' affiche « ' + m[1].trim() + ' phrases » — valeur HORS REGISTRE.' +
      ' Nouveau chiffre ou chiffre modifié : enregistre-le dans dictee/metriques_probe.js' +
      ' (et vérifie les AUTRES pages qui citaient l\'ancienne valeur).');
  }
}

/* ① présence : chaque valeur du registre est bien là où elle est déclarée */
for (const v of Object.keys(REGISTRE)) {
  const e = REGISTRE[v];
  for (const p of Object.keys(e.pages)) {
    const n = (vus[v] && vus[v][p]) || 0;
    if (n < e.pages[p]) ko(p + ' : « ' + v + ' phrases » (' + e.nom + ') attendu ×' + e.pages[p] +
      ', trouvé ×' + n + ' — si la mesure a changé, mets à jour le registre ET toutes les pages listées.');
  }
}

if (err) { console.log('metriques_probe : ' + err + ' incohérence(s)'); process.exit(1); }
const tot = Object.keys(REGISTRE).length;
console.log('metriques_probe : ' + tot + ' métriques épinglées · ' + pages.length + ' pages balayées · 0 chiffre hors registre');
