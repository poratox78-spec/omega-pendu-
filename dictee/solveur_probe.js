#!/usr/bin/env node
/* LE SOLVEUR DE PENDU — mesuré sur les fonctions de la PAGE LIVRÉE et sur le VRAI lexique.
 *
 * POURQUOI CE BANC. /solveur-pendu répond à la seule famille de requêtes qui apporte des clics au
 * site (« solveur pendu », « triche pendu » : 140 impressions, 2 clics, positions 4,7 à 6,0). Un
 * solveur qui se trompe est pire qu'une page absente : on l'a fait venir pour ça.
 *
 * IL NE RÉIMPLÉMENTE RIEN. Les quatre fonctions testées sont DÉCOUPÉES dans `solveur-pendu.html`
 * et évaluées telles quelles. Si l'une est renommée ou retirée, le banc rougit au lieu de mesurer
 * une copie devenue fausse.
 *
 * LA RÈGLE QUE LES SOLVEURS OUBLIENT. Au pendu, une lettre trouvée se révèle PARTOUT à la fois.
 * Donc une case vide ne peut pas porter une lettre déjà affichée ailleurs : sur « _A__ON », aucun
 * mot contenant un second A, O ou N n'est possible. C'est la règle ② ci-dessous, et c'est elle
 * qui fait tomber la liste de plusieurs centaines à cinquante-cinq.
 *
 * LES SIX RÈGLES :
 *   ① le mot cherché est TOUJOURS dans les candidats (aller-retour sur des mots connus) ;
 *   ② une lettre révélée n'apparaît jamais dans une case vide d'un candidat ;
 *   ③ aucune lettre déclarée absente n'apparaît dans un candidat ;
 *   ④ la lettre proposée n'est jamais déjà connue ni déjà tentée ;
 *   ⑤ la lettre proposée est bien la plus fréquente de l'ensemble sur lequel elle est calculée ;
 *   ⑥ les chiffres ÉCRITS sur la page == le lexique réellement livré.
 *
 *   node dictee/solveur_probe.js            # verbeux
 *   node dictee/solveur_probe.js --check    # CI : silencieux si vert, sort 1 si rouge
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CHECK = process.argv.includes('--check');
const RACINE = path.join(__dirname, '..');
const PAGE = path.join(RACINE, 'solveur-pendu.html');
const LEX = path.join(RACINE, 'solveur');
const rouges = [];
const rouge = (m) => rouges.push(m);
const log = (...a) => { if (!CHECK) console.log(...a); };

function sortir() {
  if (rouges.length) {
    console.log('✗ SOLVEUR :');
    rouges.forEach((r) => console.log('  ' + r));
    process.exit(1);
  }
}

if (!fs.existsSync(PAGE)) { console.log('✗ SOLVEUR : solveur-pendu.html introuvable'); process.exit(1); }
if (!fs.existsSync(LEX)) {
  console.log('✗ SOLVEUR : dossier solveur/ absent — lancer python3 dictee/build_solveur_lex.py');
  process.exit(1);
}
const src = fs.readFileSync(PAGE, 'utf8');

/* ── LES FONCTIONS DE LA PAGE, découpées telles quelles ─────────────────────────────────────── */
/* Découpage par comptage d'accolades : on part de `function <nom>(` et on s'arrête à l'accolade
   qui referme. Plus sûr qu'une expression régulière, qui butte sur les accolades internes. */
function decouper(nom) {
  const debut = src.indexOf('function ' + nom + '(');
  if (debut < 0) { rouge(`la fonction \`${nom}\` a disparu de la page — ce banc ne mesure plus rien`); return null; }
  let i = src.indexOf('{', debut), p = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') p++;
    else if (src[i] === '}') { p--; if (p === 0) return src.slice(debut, i + 1); }
  }
  rouge(`la fonction \`${nom}\` n'est pas refermée`);
  return null;
}

const NOMS = ['lireMotif', 'lireLettres', 'filtrer', 'meilleureLettre'];
const morceaux = NOMS.map(decouper);
sortir();
// eslint-disable-next-line no-eval
const F = (0, eval)('(function(){' + morceaux.join('\n') + '\nreturn {' + NOMS.join(',') + '};})()');

/* ── LE VRAI LEXIQUE ────────────────────────────────────────────────────────────────────────── */
const index = JSON.parse(fs.readFileSync(path.join(LEX, 'index.json'), 'utf8'));
const seaux = {};
function seau(n) {
  if (!seaux[n]) {
    const f = path.join(LEX, 'mots-' + n + '.txt.gz');
    if (!fs.existsSync(f)) return null;
    const meta = index.longueurs[String(n)] || { courants: 0 };
    seaux[n] = { mots: zlib.gunzipSync(fs.readFileSync(f)).toString('utf8').split('\n'),
                 courants: meta.courants };
  }
  return seaux[n];
}

/* ── ① ALLER-RETOUR : un mot connu se retrouve toujours ─────────────────────────────────────── */
/* Les mots sont INVENTÉS pour ce banc (aucun corpus privé), choisis longs et variés pour que la
   révélation partielle laisse un vrai travail au filtre. */
const TEMOINS = [
  ['MAISON', 'AO'], ['CHEMISE', 'E'], ['TELEPHONE', 'EO'], ['ANNIVERSAIRE', 'AE'],
  ['POMME', 'PE'], ['ORDINATEUR', 'OR'], ['FENETRE', 'F'], ['PARAPLUIE', 'AI'],
  ['CHOCOLAT', 'CO'], ['BIBLIOTHEQUE', 'BE'], ['ESCALIER', 'ES'], ['MONTAGNE', 'MN'],
];
function motifDe(mot, revelees) {
  return mot.split('').map((c) => (revelees.indexOf(c) >= 0 ? c : '_')).join('');
}
let manquants = [];
for (const [mot, rev] of TEMOINS) {
  const s = seau(mot.length);
  if (!s) { rouge(`aucun seau pour ${mot.length} lettres — le lexique est incomplet`); continue; }
  const motif = motifDe(mot, rev);
  const c = F.filtrer(s, motif, '');
  if (!c.some((x) => x.mot === mot)) manquants.push(`${mot} (motif ${motif})`);
}
if (manquants.length) {
  rouge(`${manquants.length} mot(s) témoin(s) que le solveur ne retrouve pas dans son propre ` +
        `lexique : ${manquants.join(', ')}`);
}

/* ── ②③④⑤ LES INVARIANTS, sur des situations tirées des témoins ─────────────────────────────── */
let casVus = 0, fautes2 = [], fautes3 = [], fautes4 = [], fautes5 = [];
for (const [mot, rev] of TEMOINS) {
  const s = seau(mot.length);
  if (!s) continue;
  const motif = motifDe(mot, rev);
  /* des lettres « absentes » plausibles : présentes dans l'alphabet, pas dans le mot */
  const absentes = 'ZKWXY'.split('').filter((L) => mot.indexOf(L) < 0).slice(0, 3).join('');
  const c = F.filtrer(s, motif, absentes);
  if (!c.length) continue;
  casVus++;

  const connues = {};
  for (let i = 0; i < motif.length; i++) if (motif[i] !== '_') connues[motif[i]] = 1;

  for (const x of c.slice(0, 4000)) {
    for (let i = 0; i < motif.length; i++) {
      if (motif[i] === '_' && connues[x.mot[i]]) {
        fautes2.push(`${x.mot} garde « ${x.mot[i]} » dans une case vide de ${motif}`);
        break;
      }
    }
    for (let j = 0; j < absentes.length; j++) {
      if (x.mot.indexOf(absentes[j]) >= 0) { fautes3.push(`${x.mot} contient « ${absentes[j]} », déclarée absente`); break; }
    }
  }

  const m = F.meilleureLettre(c, motif, absentes);
  if (m) {
    if (connues[m.lettre] || absentes.indexOf(m.lettre) >= 0) {
      fautes4.push(`${motif} → « ${m.lettre} » alors qu'elle est déjà connue ou tentée`);
    }
    /* ⑤ recomptage indépendant sur l'ensemble que la page dit avoir utilisé */
    const base = m.courants ? c.filter((x) => x.courant) : c;
    const compte = {};
    for (const x of base) {
      const vu = {};
      for (const L of x.mot) {
        if (connues[L] || absentes.indexOf(L) >= 0 || vu[L]) continue;
        vu[L] = 1; compte[L] = (compte[L] || 0) + 1;
      }
    }
    let max = 0; for (const L in compte) if (compte[L] > max) max = compte[L];
    if (compte[m.lettre] !== max) {
      fautes5.push(`${motif} → « ${m.lettre} » (${compte[m.lettre] || 0}) alors que le maximum est ${max}`);
    }
    if (Math.abs(m.part - (compte[m.lettre] || 0) / base.length) > 1e-9) {
      fautes5.push(`${motif} → la proportion annoncée (${m.part.toFixed(4)}) ne correspond pas au décompte`);
    }
  }
}
if (casVus < 8) rouge(`seulement ${casVus} situation(s) exercée(s) — le banc ne mesure presque rien`);
if (fautes2.length) rouge(`RÈGLE DES LETTRES RÉVÉLÉES violée ${fautes2.length} fois — au pendu une lettre ` +
                          `trouvée s'affiche PARTOUT : ${fautes2[0]}`);
if (fautes3.length) rouge(`${fautes3.length} candidat(s) contiennent une lettre déclarée absente : ${fautes3[0]}`);
if (fautes4.length) rouge(`lettre proposée déjà connue ou tentée : ${fautes4[0]}`);
if (fautes5.length) rouge(`la lettre proposée n'est pas la plus fréquente : ${fautes5[0]}`);

/* ── LA LECTURE DE LA SAISIE ────────────────────────────────────────────────────────────────── */
for (const [entree, attendu] of [['_a__on', '_A__ON'], ['? a ? ? o n', '_A__ON'],
                                 ['..a', '__A'], ['MAÎTRE', 'MAITRE'], ['ÉLÈVE', 'ELEVE']]) {
  const lu = F.lireMotif(entree);
  if (lu !== attendu) rouge(`la saisie « ${entree} » est lue « ${lu} » au lieu de « ${attendu} »`);
}
if (F.lireLettres('e t e r') !== 'ETR') rouge('les lettres tentées ne sont pas dédoublonnées');

/* ── ⑥ LES CHIFFRES ÉCRITS SUR LA PAGE == LE LEXIQUE LIVRÉ ──────────────────────────────────── */
let prose = src.slice(src.indexOf('<main'));
prose = prose.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
             .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[\s ]+/g, ' ');

const total = index.total;
const groupe = String(total).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
if (prose.indexOf(groupe) < 0) {
  rouge(`la page annonce un nombre de formes qui n'est pas ${groupe} (le lexique livré)`);
}
const longueurs = Object.keys(index.longueurs).map(Number).sort((a, b) => a - b);
const MOTS = { 3: 'trois', 4: 'quatre', 5: 'cinq', 6: 'six', 7: 'sept', 8: 'huit', 9: 'neuf',
               10: 'dix', 11: 'onze', 12: 'douze', 13: 'treize', 14: 'quatorze', 15: 'quinze' };
const bornes = `${MOTS[longueurs[0]]} à ${MOTS[longueurs[longueurs.length - 1]]} lettres`;
if (prose.indexOf(bornes) < 0) {
  rouge(`la page n'annonce pas les bornes réelles du lexique (« ${bornes} »)`);
}
/* l'exemple chiffré de la page doit rester vrai */
const ex = F.filtrer(seau(6), '_A__ON', '');
const mEx = { 55: 'cinquante-cinq', 54: 'cinquante-quatre', 56: 'cinquante-six' }[ex.length];
if (!mEx || prose.indexOf(mEx) < 0) {
  rouge(`la page illustre « _A__ON » par un nombre de mots qui n'est plus ${ex.length}`);
}
/* les bornes utilisées par le code == celles du lexique livré */
const mMin = src.match(/MIN_LEN\s*=\s*(\d+),\s*MAX_LEN\s*=\s*(\d+)/);
if (!mMin) rouge('MIN_LEN / MAX_LEN introuvables dans la page');
else if (+mMin[1] !== longueurs[0] || +mMin[2] !== longueurs[longueurs.length - 1]) {
  rouge(`la page accepte ${mMin[1]}–${mMin[2]} lettres, le lexique en livre ` +
        `${longueurs[0]}–${longueurs[longueurs.length - 1]}`);
}
/* chaque seau déclaré à l'index existe et pèse ce qu'il dit */
for (const n of longueurs) {
  const f = path.join(LEX, 'mots-' + n + '.txt.gz');
  if (!fs.existsSync(f)) { rouge(`mots-${n}.txt.gz manque`); continue; }
  const taille = fs.statSync(f).size;
  if (taille !== index.longueurs[String(n)].octets) {
    rouge(`mots-${n}.txt.gz pèse ${taille} o, l'index en annonce ${index.longueurs[String(n)].octets}`);
  }
}

sortir();
const plusLourd = longueurs.reduce((a, b) =>
  index.longueurs[String(b)].octets > index.longueurs[String(a)].octets ? b : a);
log(`✓ solveur : ${TEMOINS.length} mots témoins tous retrouvés, ${casVus} situations exercées — ` +
    `lettres révélées jamais dans une case vide, absentes jamais dans un candidat, lettre proposée ` +
    `recomptée à l'identique ; ${total.toLocaleString('fr-FR')} formes en ${longueurs.length} seaux ` +
    `(le plus lourd, ${plusLourd} lettres, ${Math.round(index.longueurs[String(plusLourd)].octets / 1024)} Ko) ; ` +
    `les chiffres de la page == le lexique livré.`);
