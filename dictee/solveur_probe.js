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
let jeuResume = '(jeu non mesuré)';
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

/* ── ⑧ LE JEU (26/09/2026, demande de Rem : « il aurait été préférable de lui rattacher un vrai
 *    jeu pendu difficile »). Le réservoir de mots est tiré des MÊMES seaux et de la MÊME mesure ;
 *    ce banc vérifie que la recette de la page est bien celle qu'elle annonce, et que ce qu'elle
 *    en dit reste vrai.
 *
 *    ⚠️ CE QUI A FORCÉ LA CALIBRATION. Première version : « les 60 mots les plus durs ». Le
 *    réservoir tournait à un coût moyen de 15,4 alors que le coût MÉDIAN d'un mot courant est de
 *    8 à 9 — le dernier décile, et « CHERRY » (rang 1 904) pouvait sortir au tirage. La bande
 *    p70–p90 le remplace, recalculée pour chaque longueur. */
const mGame = {
  fenetre: src.match(/i < mots\.length && i < (\d+); i\+\+/),
  bas: src.match(/croissant\.length \* (0\.\d+)\)\];\s*\n\s*var haut/),
  haut: src.match(/var haut = croissant\[Math\.floor\(croissant\.length \* (0\.\d+)\)\]/),
  parFin: src.match(/if \(\(fins\[fin2\] \|\| 0\) >= (\d+)\) continue/),
  vies: src.match(/var VIES_MAX = (\d+)/),
};
for (const [nom, m] of Object.entries(mGame)) {
  if (!m) rouges.push(`la recette du jeu a changé : « ${nom} » est introuvable dans la page`);
}
if (!rouges.length) {
  const FENETRE = +mGame.fenetre[1], BAS = +mGame.bas[1], HAUT = +mGame.haut[1];
  const PAR_FIN = +mGame.parFin[1], VIES_MAX = +mGame.vies[1];

  /* ⚠️ 26/09/2026 — CE BANC SUIVAIT LA PAGE AU LIEU DE LA CONTRAINDRE. Falsifié : en portant le
     plafond de diversité de 3 à 99 dans la page, la règle lisait 99 et ne rougissait pas ; en
     retirant les filtres « prénom » et « W/K », le banc recalculait le réservoir avec SES propres
     filtres et ne voyait rien. Une garde qui recopie ce qu'elle doit vérifier ne vérifie rien.
     Les trois sont maintenant des BORNES et des PRÉSENCES, lues dans la page. */
  if (PAR_FIN > 3) {
    rouges.push(`le jeu autorise ${PAR_FIN} mots partageant les deux dernières lettres (plafond 3) ` +
                '— le réservoir se saturerait de formes en « -ez »');
  }
  const recette = src.slice(src.indexOf('function lesDurs'), src.indexOf('function potence'));
  if (!/pren\[w\]/.test(recette)) {
    rouges.push("le jeu n’écarte plus les prénoms : il pourrait tirer un nom de personne");
  }
  if (!/indexOf\('W'\)/.test(recette) || !/indexOf\('K'\)/.test(recette)) {
    rouges.push("le jeu n’écarte plus les mots à W ou K — deux lettres qui n’apparaissent presque " +
                "qu’en emprunts et en noms propres, que le lexique ne sait pas distinguer");
  }

  /* les prénoms publiés, que le jeu écarte */
  const zlib2 = require('zlib');
  let pren = new Set();
  const fPren = path.join(RACINE, 'extension/assets/prenoms.tsv.gz');
  if (fs.existsSync(fPren)) {
    pren = new Set(zlib2.gunzipSync(fs.readFileSync(fPren)).toString('utf8').split('\n')
      .map((l) => l.split('\t')[0]).filter(Boolean)
      .map((p) => p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()));
  } else {
    rouges.push('extension/assets/prenoms.tsv.gz absent — le jeu ne pourrait pas écarter les prénoms');
  }

  const FR = {E:14.7,A:7.6,I:7.5,S:7.9,N:7.1,R:6.6,T:7.2,O:5.4,L:5.5,U:6.3,D:3.7,C:3.3,P:3.0,
              M:3.0,V:1.6,Q:1.4,F:1.1,B:0.9,G:0.9,H:0.7,J:0.5,X:0.4,Y:0.3,Z:0.1,K:0.05,W:0.04};
  const ORD = Object.keys(FR).sort((a, b) => FR[b] - FR[a]);
  const RG = {}; ORD.forEach((l, i) => { RG[l] = i; });
  const cout = (m) => { const v = new Set(); let x = 0;
    for (const L of m) { if (!v.has(L)) { v.add(L); if (RG[L] > x) x = RG[L]; } } return x + 1 - v.size; };

  let poolsVus = 0, pire = 0, coutTotal = 0, nTotal = 0;
  for (const n of [6, 7, 8, 9, 10, 11]) {
    const sn = seau(n);
    if (!sn) { rouges.push(`le jeu tire des mots de ${n} lettres et le seau manque`); continue; }
    const cand = sn.mots.slice(0, FENETRE)
      .filter((w) => w.length === n && !pren.has(w) && !w.includes('W') && !w.includes('K'))
      .map((w) => [cout(w), w]);
    const cs = cand.map((c) => c[0]).sort((a, b) => a - b);
    const bas = cs[Math.floor(cs.length * BAS)], haut = cs[Math.floor(cs.length * HAUT)];
    const bande = cand.filter((c) => c[0] >= bas && c[0] <= haut)
      .sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : 1));
    const fins = {}, pool = [];
    for (const c of bande) {
      const f = c[1].slice(-2);
      if ((fins[f] || 0) >= PAR_FIN) continue;
      fins[f] = (fins[f] || 0) + 1; pool.push(c);
    }
    if (pool.length < 20) { rouges.push(`le réservoir du jeu ne contient que ${pool.length} mots de ${n} lettres`); continue; }
    poolsVus++;
    /* ⓐ aucun prénom, aucun W ni K */
    const sale = pool.find((c) => pren.has(c[1]) || c[1].includes('W') || c[1].includes('K'));
    if (sale) rouges.push(`le jeu peut tirer « ${sale[1]} » (${n} lettres) — prénom ou lettre d'emprunt`);
    /* ⓑ la bande est bien celle qui est annoncée : pas la queue */
    const max = cs[cs.length - 1];
    if (haut >= max) rouges.push(`à ${n} lettres, la bande du jeu monte jusqu'au mot le plus dur (${haut}) — la queue n'est plus écartée`);
    const median = cs[Math.floor(cs.length * 0.5)];
    if (bas <= median) rouges.push(`à ${n} lettres, la bande du jeu descend à la médiane (${bas} ≤ ${median}) — ce n'est plus « dur »`);
    /* ⓒ la diversité des fins tient */
    const compte = {};
    for (const c of pool) { const f = c[1].slice(-2); compte[f] = (compte[f] || 0) + 1; }
    const trop = Object.entries(compte).find(([, v]) => v > PAR_FIN);
    if (trop) rouges.push(`le réservoir du jeu porte ${trop[1]} mots en « -${trop[0]} » à ${n} lettres (plafond ${PAR_FIN})`);
    if (pool.length > pire) pire = pool.length;
    pool.forEach((c) => { coutTotal += c[0]; nTotal++; });
  }
  if (poolsVus < 6) rouges.push(`seulement ${poolsVus} longueurs jouables sur 6`);
  if (VIES_MAX !== 6) rouges.push(`le jeu donne ${VIES_MAX} vies ; un pendu en donne six`);
  /* ⓓ ce que la page ÉCRIT sur sa difficulté doit rester vrai */
  const pctBande = Math.round((HAUT - BAS) * 100);
  if (!prose.includes(`${Math.round((1 - BAS) * 100)} % les plus durs`)) {
    rouges.push(`la page tire dans les ${Math.round((1 - BAS) * 100)} % les plus durs et ne l'écrit pas`);
  }
  if (!prose.includes('six lettres sur dix')) {
    rouges.push("la page n'annonce plus ce que valent les huit premières lettres jouées");
  }
  /* ── ⑨ LE PONT ENTRE LA PARTIE ET L'AIDE (26/09/2026, demande de Rem : « fusionner ce nouveau
   *    jeu du pendu et l'aide au pendu, au lieu de devoir descendre dans la page »).
   *    C'est ce qui fait la page : l'aide LIT la partie au lieu d'attendre qu'on la recopie. Si le
   *    pont saute, tout reste vert — la partie se joue, l'aide répond — et plus rien ne les relie.
   *    On exige donc que chaque morceau soit là, nommément. */
  const pont = [
    [/function pousser\s*\(/, "le jeu ne pousse plus son état vers l'aide"],

    [/var prog = false, detache = false;/, 'le drapeau qui sépare l\u2019écriture du programme de celle de ' +
     'l\u2019humain a disparu : chaque coup du jeu détacherait l\u2019aide'],
    [/classList\.toggle\('suit'/, 'la lettre proposée ne se signale plus jouable'],

  ];
  for (const [re, quoi] of pont) {
    const n = (src.match(re) || []).length;
    if (!n) rouges.push(`PONT rompu : ${quoi}`);
  }
  /* ⚠️ LA POUSSÉE, DANS CHACUN DES TROIS MOMENTS — et non « au moins trois appels quelque part ».
     Falsifié : il y a QUATRE appels (tirage, coup, fin, retour à la partie) ; en retirer un
     laissait le compte à 3 et la règle passait. Un seuil recopié sur l'existant ne garde rien. */
  const moments = [
    ['function jouer', 'après chaque coup joué'],
    ['function nouvelle', 'au tirage du mot'],
    ['function terminer', 'à la fin de la partie'],
  ];
  for (const [entree, quand] of moments) {
    /* ⚠ LE CORPS EXACT, PAS UNE FENÊTRE. Falsifié : une fenêtre de 1 400 caractères débordait
       sur la fonction suivante, qui porte sa propre poussée — retirer celle de `jouer` restait vert.
       On réutilise le découpage par accolades déjà écrit plus haut. */
    const suite = decouper(entree.replace('function ', ''));
    if (suite === null) { continue; }
    if (!/pousser\(\);/.test(suite)) {
      rouges.push(`PONT : l'aide n'est plus rafraîchie ${quand}`);
    }
  }
  /* le retour à la partie : l'identifiant vit DEUX fois (le lien écrit, et sa reprise). Exiger la
     seule présence laissait passer le renommage de l'un des deux. */
  const resuivre = (src.match(/slv-resuivre/g) || []).length;
  if (resuivre < 2) {
    rouges.push(`PONT : « slv-resuivre » n'apparaît que ${resuivre} fois — le retour à la partie ` +
                'est écrit sans être repris, ou repris sans être écrit');
  }
  if (!prose.includes("L'aide, elle, suit la partie toute seule")) {
    rouges.push("la page n'explique plus que l'aide suit la partie");
  }

  jeuResume = `réservoir du jeu : ${poolsVus} longueurs, coût moyen ${(coutTotal / nTotal).toFixed(1)} ` +
              `(médiane du lexique : 8-9), bande p${Math.round(BAS * 100)}–p${Math.round(HAUT * 100)}, ` +
              `${VIES_MAX} vies`;
}

sortir();
const plusLourd = longueurs.reduce((a, b) =>
  index.longueurs[String(b)].octets > index.longueurs[String(a)].octets ? b : a);
log(`✓ solveur : ${TEMOINS.length} mots témoins tous retrouvés, ${casVus} situations exercées — ` +
    `lettres révélées jamais dans une case vide, absentes jamais dans un candidat, lettre proposée ` +
    `recomptée à l'identique ; ${total.toLocaleString('fr-FR')} formes en ${longueurs.length} seaux ` +
    `(le plus lourd, ${plusLourd} lettres, ${Math.round(index.longueurs[String(plusLourd)].octets / 1024)} Ko) ; ` +
`les chiffres de la page == le lexique livré.\n  ` + jeuResume + '.');
