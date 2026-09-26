#!/usr/bin/env node
/* /pendable RACONTE SA MÉCANIQUE — et la mécanique peut changer sans que le texte suive.
 *
 * NÉ D'UNE ERREUR RÉELLE (26/09/2026). En étoffant la page (218 → 670 mots), j'ai écrit une prose
 * plausible AVANT de lire le code. Cinq affirmations étaient fausses :
 *   · « tu en as six [vies] »        → BASE_LIVES = {facile:7, moyen:6, dur:6} ;
 *   · « un mot difficile est un mot dont les lettres fréquentes ne suffisent pas »
 *                                     → le jeu ne choisit pas un MOT, il calibre une GRILLE ;
 *   · « le tirage évite les mots où la partie se joue à la première lettre » → PURE INVENTION ;
 *   · l'ordre des lettres, « E, A, S… » au lieu de « E, S, A… » (FREQ met S avant A) ;
 *   · « un mot entièrement révélé paie son bonus » → seulement s'il couvre une case « mot ».
 *
 * Le texte est exact aujourd'hui. Rien ne le maintiendra exact : prose et moteur cohabitent dans
 * un seul fichier, et un réglage d'équilibrage — une vie de plus en Facile, une cible déplacée —
 * laisserait la page mentir sans que rien ne rougisse.
 *
 * CE BANC LIT LES DEUX ET EXIGE QU'ILS CONCORDENT :
 *   ① la suite ordonnée des vies (BASE_LIVES) est écrite en toutes lettres dans le texte ;
 *   ② chaque niveau est cité à côté de sa cible de lettres perdues (BASE_W) ;
 *   ③ les taux du texte ET ceux des BOUTONS == WR arrondi à 5 points ;
 *   ④ l'ordre des lettres cité == FREQ trié par fréquence décroissante ;
 *   ⑤ le plafond d'escalade et le taux qu'il laisse == min(8,…) et WR[8] ;
 *   ⑥ le nombre de mots annoncé == la taille réelle du BLOB embarqué (la promesse « hors ligne ») ;
 *   ⑦ le premier multiplicateur de combo == 1 + le pas du code.
 *
 * ⚠️ PLUSIEURS CONTRÔLES CHERCHENT UNE SUITE ORDONNÉE (« sept, six et six », « 90 %, 75 % et
 * 50 % »). C'est délibéré : un chiffre isolé quelque part dans la page ne prouve rien, la suite
 * si. Reformuler le texte est permis — garder la suite lisible est la condition pour qu'un
 * mensonge reste détectable.
 *
 * IL NE VÉRIFIE PAS que la page est jolie ni que le jeu est amusant : seulement qu'elle ne MENT
 * pas sur ce que le joueur va vivre.
 *
 *   node dictee/pendable_probe.js            # verbeux
 *   node dictee/pendable_probe.js --check    # CI : silencieux si vert, sort 1 si rouge
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CHECK = process.argv.includes('--check');
const P = path.join(__dirname, '..', 'pendable.html');
const rouges = [];
const rouge = (m) => rouges.push(m);
const log = (...a) => { if (!CHECK) console.log(...a); };

if (!fs.existsSync(P)) {
  console.log('✗ PENDABLE : pendable.html introuvable — ce banc ne mesure rien');
  process.exit(1);
}
const src = fs.readFileSync(P, 'utf8');

/* ── LE MOTEUR : ce que le code fait ────────────────────────────────────────────────────────── */
function saisir(re, quoi) {
  const m = src.match(re);
  if (!m) rouge(`${quoi} introuvable dans le code — la mécanique a changé, ce banc est aveugle`);
  return m;
}
const mW = saisir(/const BASE_W=\{facile:(\d+),moyen:(\d+),dur:(\d+)\}/, 'BASE_W');
const mL = saisir(/BASE_LIVES=\{facile:(\d+),moyen:(\d+),dur:(\d+)\}/, 'BASE_LIVES');
const mWR = saisir(/WR=\{([^}]*)\}/, 'WR');
const mFREQ = saisir(/const FREQ=\{([^}]*)\}/, 'FREQ');
const mBLOB = saisir(/const BLOB="([^"]*)"/, 'le BLOB de mots');
const mCombo = saisir(/combo-1\)\*([\d.]+)/, 'la formule du combo');
const mCap = saisir(/W=Math\.min\((\d+),BASE_W\[tier\]\+round\)/, "le plafond d'escalade");
if (rouges.length) { console.log('✗ PENDABLE :'); rouges.forEach((r) => console.log('  ' + r)); process.exit(1); }

const NIVEAUX = ['facile', 'moyen', 'dur'];
const BASE_W = { facile: +mW[1], moyen: +mW[2], dur: +mW[3] };
const LIVES = { facile: +mL[1], moyen: +mL[2], dur: +mL[3] };
const WR = {}; mWR[1].split(',').forEach((p) => { const [k, v] = p.split(':'); WR[+k] = +v; });
const FREQ = {}; mFREQ[1].split(',').forEach((p) => { const [k, v] = p.split(':'); FREQ[k] = +v; });
const ORDRE = Object.keys(FREQ).sort((a, b) => FREQ[b] - FREQ[a]);
const MOTS = mBLOB[1].split('|').length;
const PAS = +mCombo[1];
const PLAFOND = +mCap[1];

const CHIFFRE = { un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };
const enLettres = (n) => Object.keys(CHIFFRE).find((k) => CHIFFRE[k] === n) || String(n);
const arrondi5 = (n) => Math.round(n / 5) * 5;
const label = (n) => n[0].toUpperCase() + n.slice(1);

/* ── LA PROSE : ce que la page raconte ──────────────────────────────────────────────────────── */
/* on ne lit QUE le texte visible : ni le script, ni le style, ni les attributs. */
let prose = src.slice(src.indexOf('<body'));
prose = prose.replace(/<(script|style|svg|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
prose = prose.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
/* ⚠️ en JavaScript, \s AVALE l'espace insécable (U+00A0). Après cette ligne il n'en reste aucune :
   chercher « 90 % » plus bas ne trouverait jamais rien. Tout est espace simple. */
prose = prose.replace(/[\s ]+/g, ' ');

const motsVisibles = prose.trim().split(' ').filter((w) => w.length > 1).length;
if (motsVisibles < 400) {
  rouge(`la page ne porte plus que ${motsVisibles} mots visibles — elle a été vidée de son contenu ` +
        '(218 avant le 26/09/2026, ce qui la classait 13,9 pour 99 impressions)');
}

/* ① LES VIES, en suite ordonnée facile/moyen/dur. */
const suiteVies = NIVEAUX.map((n) => enLettres(LIVES[n]));
const reVies = new RegExp(`${suiteVies[0]}, ${suiteVies[1]} et ${suiteVies[2]}`, 'i');
if (!reVies.test(prose)) {
  rouge(`les vies sont ${suiteVies.join('/')} (BASE_LIVES) — le texte ne porte pas la suite ` +
        `« ${suiteVies.join(', ').replace(/, ([^,]*)$/, ' et $1')} »`);
}
if (!new RegExp(`${enLettres(LIVES.facile)} en Facile`, 'i').test(prose)) {
  rouge(`Facile donne ${LIVES.facile} vies — le texte ne l'écrit pas (« ${enLettres(LIVES.facile)} en Facile »)`);
}

/* ② CHAQUE NIVEAU À CÔTÉ DE SA CIBLE de lettres perdues. */
for (const niv of NIVEAUX) {
  const mot = enLettres(BASE_W[niv]);
  const lbl = label(niv);
  if (!new RegExp(`${lbl}[^.]{0,40}\\b${mot}\\b|\\b${mot}\\b[^.]{0,40}${lbl}`, 'i').test(prose)) {
    rouge(`${lbl} vise ${BASE_W[niv]} lettres perdues (BASE_W) — le texte ne l'annonce pas ` +
          `(« ${mot} » devrait suivre « ${lbl} »)`);
  }
}

/* ③ LES TAUX : dans le texte ET sous les boutons, == WR arrondi à 5 points. */
const attendus = NIVEAUX.map((n) => WR[BASE_W[n]]);
if (attendus.some((t) => t === undefined)) {
  rouge(`WR n'a pas d'entrée pour une des cibles ${NIVEAUX.map((n) => BASE_W[n]).join('/')}`);
} else {
  const a5 = attendus.map(arrondi5);
  if (!new RegExp(`${a5[0]} %, ${a5[1]} % et ${a5[2]} %`).test(prose)) {
    rouge(`les niveaux gagnent ${attendus.join('/')} % des manches (WR) — le texte ne porte pas la ` +
          `suite « ${a5[0]} %, ${a5[1]} % et ${a5[2]} % »`);
  }
  for (let k = 0; k < NIVEAUX.length; k++) {
    const b = src.match(new RegExp(`data-d="${NIVEAUX[k]}"[^>]*>[^<]*<small>[^<]*?~\\s*(\\d+)\\s*%`));
    if (!b) { rouge(`le bouton « ${label(NIVEAUX[k])} » n'annonce plus de taux de départ`); continue; }
    if (+b[1] !== a5[k]) {
      rouge(`le bouton « ${label(NIVEAUX[k])} » annonce ~${b[1]} % ; WR[${BASE_W[NIVEAUX[k]]}] = ` +
            `${attendus[k]} %, soit ~${a5[k]} %`);
    }
  }
}

/* ④ L'ORDRE DES LETTRES — l'inversion qu'un lecteur dys repère la première. */
const citee = prose.match(/— ((?:[A-Z], ){4,}[A-Z])…/);
if (!citee) {
  rouge("le texte ne cite plus l'ordre de fréquence des lettres — c'est ce qui explique le niveau");
} else {
  const lettres = citee[1].split(',').map((x) => x.trim());
  const attendu = ORDRE.slice(0, lettres.length);
  if (lettres.join('') !== attendu.join('')) {
    rouge(`le texte cite l'ordre « ${lettres.join(', ')} » ; FREQ donne « ${attendu.join(', ')} »`);
  }
}

/* ⑤ LE PLAFOND et ce qu'il laisse. */
if (!new RegExp(`\\b${enLettres(PLAFOND)}\\b`, 'i').test(prose)) {
  rouge(`l'escalade plafonne à ${PLAFOND} lettres perdues — le texte ne le dit pas`);
}
if (WR[PLAFOND] !== undefined && !new RegExp(`\\b${WR[PLAFOND]} ?%`).test(prose)) {
  rouge(`au plafond il reste ${WR[PLAFOND]} % de chances (WR[${PLAFOND}]) — le texte annonce autre chose`);
}

/* ⑥ LE NOMBRE DE MOTS EMBARQUÉS : c'est la promesse « hors ligne ». */
const annonce = [...prose.matchAll(/(\d{2}) ?(\d{3})\b/g)].map((m) => +(m[1] + m[2]));
if (!annonce.includes(MOTS)) {
  rouge(`la page embarque ${MOTS.toLocaleString('fr-FR')} mots ; le texte annonce ` +
        `${annonce.length ? annonce.map((n) => n.toLocaleString('fr-FR')).join(', ') : 'aucun nombre'}`);
}

/* ⑦ LES TROIS PREMIERS MULTIPLICATEURS DE COMBO, en suite.
   ⚠️ ne PAS tester le premier seul : « ×1,5 » est déjà le deuxième de la série actuelle, donc un
   pas doublé (0,25 → 0,5) passerait au travers. C'est la suite qui est falsifiable. */
const mult = (k) => '×' + String(+(1 + k * PAS).toFixed(2)).replace('.', ',');
const serie = [1, 2, 3].map(mult);
if (!prose.includes(serie.join(', '))) {
  rouge(`le combo ajoute ${PAS} par cran, donc la série commence par « ${serie.join(', ')} » — ` +
        'le texte annonce autre chose');
}
const premier = serie[0];

/* ── VERDICT ────────────────────────────────────────────────────────────────────────────────── */
if (rouges.length) {
  console.log('✗ PENDABLE : la page ne dit plus ce que le jeu fait —');
  rouges.forEach((r) => console.log('  ' + r));
  console.log('  (corriger la PROSE de pendable.html, pas ce banc : le code fait foi)');
  process.exit(1);
}
log(`✓ pendable : la page dit ce que le jeu fait — ${motsVisibles} mots visibles ; vies ` +
    `${NIVEAUX.map((n) => LIVES[n]).join('/')} ; cibles ${NIVEAUX.map((n) => BASE_W[n]).join('/')} ` +
    `lettres perdues pour ${NIVEAUX.map((n) => WR[BASE_W[n]]).join('/')} % (boutons compris) ; ordre ` +
    `${ORDRE.slice(0, 6).join(', ')} ; plafond ${PLAFOND} (${WR[PLAFOND]} %) ; ` +
    `${MOTS.toLocaleString('fr-FR')} mots embarqués ; combo ${premier}.`);
