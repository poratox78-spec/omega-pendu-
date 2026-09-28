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

/* valeur → { nom, pages: { fichier: occurrences minimales }, sonde: PROVENANCE }.
 *
 * PROVENANCE (reconnaissance Lissenne §2.2, 2026-08-19 — l'idée, réimplémentée maison) : un
 * chiffre affiché sans savoir QUELLE sonde le reproduit est une donnée orpheline — le même
 * défaut que la dérive entre pages, un cran plus profond. Trois portées :
 *   'ci'      → la sonde re-vérifie le chiffre À CHAQUE CI (fichier présent ET branché dev.sh —
 *               ci_parity_probe garde le miroir ci.yml) ;
 *   'locale'  → mesure REPRODUCTIBLE en local par cette sonde (corpus sous data_local, gitignoré
 *               pour licence — le fichier de sonde, lui, doit exister dans le dépôt) ;
 *   'constat' → mesuré une fois, daté, documenté dans le fichier cité (ou nulle part :
 *               fichier null → AVERTISSEMENT « sans sonde vivante », pas un échec).
 * Un fichier nommé mais ABSENT = rouge : une provenance affichée doit être résolvable. */
const REGISTRE = {
  694949: { nom: 'prior de ponctuation — phrases FR du modèle texte (PR#399)',
            pages: { 'saisie-vocale.html': 1 },
            sonde: { fichier: 'dictee/ponct_prior_dictee_probe.js', portee: 'locale' } },
  48653:  { nom: 'mesure du « ? » texte-seul — 145 marques dont 79 fausses (PR#403)',
            pages: { 'saisie-vocale.html': 1 },
            sonde: { fichier: 'dictee/proso_probe.js', portee: 'constat',
                     note: 'mesuré une fois (PR#403), documenté dans la garde CI de la prosodie' } },
  27897:  { nom: 'anglais écrit UD (GUM + EWT + PUD) — règles de la saisie vocale anglaise (commandes, mot de tête, question, « jamais de marque après »)',
            pages: { 'en/saisie-vocale.html': 1 },
            sonde: { fichier: 'dictee/voix_en_probe.js', portee: 'locale',
                     note: 'PUD (1 000 phrases, committé) est rejoué en CI ; GUM + EWT (26 897) sous data_local' } },
  15353:  { nom: 'flood EN édité PUD+GUM — règles anglaises (REGLES_EN)',
            pages: { 'en/correcteur-outil.html': 1 },      // 3 jusqu'au 17/09/2026 : deux commentaires de règles ont suivi la chaîne des décisions dans le moteur (analyzeText)
            sonde: { fichier: 'dictee/fp_en_propre_probe.js', portee: 'locale' } },
  14450:  { nom: 'UD FR complet (14 450 phrases correctes) — FP=0 du correcteur',
            pages: { 'correcteur.html': 1, 'recherche.html': 1, 'saisie-vocale.html': 1 },
            sonde: { fichier: 'dictee/fp_scale_probe.py', portee: 'locale',
                     note: 'corpus COMPLET sous data_local ; la CI n en rejoue que l echantillon 2 500' } },
  11304:  { nom: 'phrases écrites par des humains — précision/rappel du speller',
            pages: { 'recherche.html': 1, 'saisie-vocale.html': 1 },
            sonde: { fichier: 'dictee/ponct_double_route_probe.js', portee: 'locale',
                     note: 'meme banc 11 304 ; le volet SPELLER (precision/rappel) n a plus de sonde dediee' } },
  2500:   { nom: 'UD 2 500 (échantillon encyclopédique) — FP à l\'échelle + tagger',
            pages: { 'arbitrage.html': 1, 'recherche.html': 3, 'toile.html': 2, 'correcteur.html': 1 },
            sonde: { fichier: 'dictee/fp_scale_probe.py', portee: 'ci' } },
  630500: { nom: 'corpus d\'entraînement du corps mou B2 (UD + exemples Wiktionnaire, held-out fp_scale exclu)',
            pages: { 'recherche.html': 1 },
            sonde: { fichier: 'dictee/b2_data.py', portee: 'locale',
                     note: 'reproductible : python dictee/b2_data.py imprime « train 630500 phrases » (sources sous data_local)' } },
  18556:  { nom: 'banc FP de la greffe sait/s\'est — phrases correctes UD 14 450 + held-out 4 106 (cadre : 1 seule occurrence)',
            pages: { 'recherche.html': 1 },
            sonde: { fichier: 'dictee/greffe_sais_probe.py', portee: 'locale' } },
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

/* ③ provenance : chaque sonde citée doit être RÉSOLVABLE */
const devsh = fs.readFileSync(path.join(R, 'dev.sh'), 'utf8');
const orphelins = [];
for (const v of Object.keys(REGISTRE)) {
  const sd = REGISTRE[v].sonde;
  if (!sd) { ko(v + " : entrée sans bloc de provenance (sonde) — le registre l'exige"); continue; }
  if (sd.fichier) {
    if (!fs.existsSync(path.join(R, sd.fichier)))
      ko(v + ' : la sonde citée ' + sd.fichier + " N'EXISTE PLUS — provenance irrésolvable, corrige le registre");
    else if (sd.portee === 'ci' && devsh.indexOf(sd.fichier) < 0)
      ko(v + ' : ' + sd.fichier + " est déclarée portée « ci » mais n'est PAS branchée dans dev.sh — un chiffre « re-vérifié à chaque CI » doit l'être vraiment");
  } else orphelins.push(v + ' (' + REGISTRE[v].nom + ') — ' + (sd.note || 'sans note'));
}
/* ④ TAILLES MESURÉES SUR LE FICHIER LIVRÉ (28/09/2026). Le dictionnaire du correcteur et le poids du fichier hors-ligne ne sont
 * pas des « N phrases » : rien ne les gardait, et correcteur.html annonçait encore « ≈ 10 Mo · dictionnaire de 211 000 mots »
 * quand app/omega-pendu.html pesait 14 Mo et embarquait 705 653 formes — même dérive sur confidentialite.html (« plus de
 * 200 000 formes »), la toile (SP.WORDS « 214 685 mots connus »), les pages Évolution (« moteur ~11 Mo ») et le paquet de
 * lexiques de donnees.html (« ~4,4 Mo » pour 4 530 775 octets). Ici le chiffre
 * attendu n'est pas écrit à la main : il est CALCULÉ sur le fichier livré, arrondi comme les pages l'écrivent (au millier de
 * formes, au Mo), exigé dans chaque page qui en parle, et tout AUTRE chiffre posé au même endroit est refusé. Le lexique du
 * PENDU (OMEGA_LEX4, 155 493 mots) est un autre objet : il n'entre pas ici. */
const zlib = require('zlib');
const APP = fs.readFileSync(path.join(R, 'app', 'omega-pendu.html'));
const lignes = (buf) => zlib.gunzipSync(buf).toString('utf8').split('\n').filter(l => l.trim()).length;
const blocDico = APP.toString('utf8').match(/<script[^>]*id="speller-lex-gz"[^>]*>([\s\S]*?)<\/script>/);
const nApp = blocDico ? lignes(Buffer.from(blocDico[1].replace(/\s+/g, ''), 'base64')) : 0;
const nExt = lignes(fs.readFileSync(path.join(R, 'extension', 'assets', 'speller.tsv.gz')));
if (!nApp) ko('app/omega-pendu.html : bloc « speller-lex-gz » introuvable — la taille du dictionnaire ne se mesure plus');
else if (nApp !== nExt) ko('dictionnaire du correcteur : ' + nApp + ' formes dans l\'app ≠ ' + nExt + ' dans l\'extension — ils doivent livrer le même');
const plat = s => s.replace(/&nbsp;|&#8239;|&thinsp;|[   ]/g, ' ');
const TAILLES = [
  { nom: 'dictionnaire du correcteur (formes embarquées, arrondi au millier)', attendu: Math.round(nApp / 1000) * 1000, unite: 'formes',
    pages: { 'correcteur.html': 1, 'confidentialite.html': 1, 'donnees.html': 3, 'toile.html': 1 },
    re: /(\d{1,3}(?: \d{3})+)\s*(?:mots|formes)/g, pres: /dictionnaire|lexique orthographique|SP\.WORDS|formes connues/i, fr: true },
  { nom: 'poids de app/omega-pendu.html (téléchargement hors-ligne, moteur chargé par Évolution), arrondi au Mo', attendu: Math.round(APP.length / 1e6), unite: 'Mo',
    pages: { 'correcteur.html': 1, 'evolution.html': 3, 'en/evolution.html': 3 },
    re: /(\d{1,3})\s*(?:Mo|MB)\b/g, pres: /hors-ligne\)|chargement du moteur|charge PAS les|loading the engine/i },
  { nom: 'poids du paquet de lexiques ouverts (omega-lexiques.zip), arrondi au dixième de Mo', unite: 'Mo',
    attendu: Math.round(fs.statSync(path.join(R, 'omega-lexiques.zip')).size / 1e5) / 10, pages: { 'donnees.html': 1 },
    re: /(\d{1,2}(?:,\d)?)\s*(?:Mo|MB)\b/g, pres: /paquet \(\.zip|package \(\.zip/i },
];
for (const t of TAILLES) {
  const cible = t.attendu.toLocaleString('fr-FR').replace(/[  ]/g, ' ');
  for (const p of pages) {
    if (t.fr && p.startsWith('en/')) continue;                       // le lexique anglais est un autre dictionnaire
    const s = plat(fs.readFileSync(path.join(R, p), 'utf8'));
    let m, n = 0; t.re.lastIndex = 0;
    while ((m = t.re.exec(s))) {
      const v = parseFloat(m[1].replace(/ /g, '').replace(',', '.'));
      if (v === t.attendu) { n++; continue; }                         // présence : le bon chiffre compte où qu'il soit
      const autour = s.slice(Math.max(0, m.index - 120), m.index + m[0].length + 30);
      if (t.pres.test(autour)) ko(p + ' affiche « ' + m[0].trim() + ' » pour ' + t.nom + ' — mesuré sur le fichier livré : ' + cible + ' ' + t.unite +
              '. Corrige la page (et les autres pages listées dans ④ de dictee/metriques_probe.js).');
    }
    if (t.pages[p] && n < t.pages[p]) ko(p + ' : ' + t.nom + ' — « ' + cible + ' ' + t.unite + ' » attendu ×' + t.pages[p] + ', trouvé ×' + n);
  }
}

if (err) { console.log('metriques_probe : ' + err + ' incohérence(s)'); process.exit(1); }
const tot = Object.keys(REGISTRE).length;
orphelins.forEach(o => console.log('  ⚠️ SANS SONDE VIVANTE : ' + o));
const nCi = Object.keys(REGISTRE).filter(v => REGISTRE[v].sonde.portee === 'ci').length;
const nLoc = Object.keys(REGISTRE).filter(v => REGISTRE[v].sonde.portee === 'locale').length;
console.log('metriques_probe : ' + tot + ' métriques épinglées · ' + pages.length + ' pages balayées · 0 chiffre hors registre · provenance ' + nCi + ' ci / ' + nLoc + ' locales / ' + orphelins.length + ' sans sonde vivante');
console.log('  tailles mesurées sur le fichier livré : dictionnaire du correcteur ' + nApp + ' formes (affiché ~' + TAILLES[0].attendu.toLocaleString('fr-FR').replace(/[  ]/g, ' ') +
            ') · app/omega-pendu.html ' + APP.length + ' octets (affiché ≈ ' + TAILLES[1].attendu + ' Mo) · omega-lexiques.zip (affiché ~' +
            TAILLES[2].attendu.toLocaleString('fr-FR') + ' Mo)');
