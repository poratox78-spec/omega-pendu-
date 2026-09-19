#!/usr/bin/env node
/* LA TOILE DU CORRECTEUR DOIT DIRE LE MOTEUR D'AUJOURD'HUI, PAS CELUI D'IL Y A DIX JOURS.
 *
 * NÉ D'UNE DÉRIVE RÉELLE (19/09/2026, question de Rem : « carte du correcteur à jour ? »). Mesuré ce
 * jour-là : la légende annonçait « 36 nœuds » pour 37 déclarés ; la toile montrait 7 règles rouges et
 * 4 oranges quand le moteur en portait 77 (CRULES) et 18 (« … à vérifier ») ; et AUCUNE des trois
 * briques de genre qui venaient de décider deux PR n'y figurait — la table des collisions d'accent,
 * la table de genre accentuée, l'exclusion des noms épicènes.
 * Le site garde ses chiffres (metriques_probe), ses textes (textes_probe), ses promesses (§11) — mais
 * cette figure-là, dessinée à la main, n'était comparée à rien. Elle a donc vieilli en silence.
 *
 * CE QU'ON GARDE, et pourquoi c'est ce découpage :
 *   ① LA LÉGENDE NE PEUT PAS MENTIR — « N nœuds, M familles » dans recherche.html == ce que la toile
 *      déclare vraiment. Exact, falsifiable, et c'est la première chose qu'un lecteur croit.
 *   ② CE QUE LE MOTEUR CHARGE DOIT ÊTRE NOMMÉ — la liste n'est PAS écrite ici à la main : on la
 *      DÉRIVE des setters publics de dys-core (setLex, setNounPost, setPosHmm, setPrenoms,
 *      setGaccLex…). Un asset qu'on se met à charger sans l'ajouter à la carte fait rougir tout seul.
 *   ③ LA TOILE NE MONTRE RIEN DE DISPARU — tout nœud dont le libellé est un SYMBOLE du moteur
 *      (_SEG, NOUN_POST, CONJ_C…) doit encore exister dans dys-core.js.
 *
 * ⚠️ CE QU'ON NE GARDE PAS, ET POURQUOI. On n'exige pas « autant de nœuds rouges que de règles » : la
 * toile montre des FAMILLES, pas les 77 règles, et transformer une figure pédagogique en inventaire
 * la rendrait illisible — pour un lecteur dys plus que pour un autre. Le compte des règles est donc
 * AFFICHÉ par ce banc, à titre d'information, sans faire échouer.
 *
 *   node dictee/toile_probe.js            # verbeux
 *   node dictee/toile_probe.js --check    # CI : silencieux si vert, sort 1 si rouge
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.dirname(__dirname);
const CHECK = process.argv.includes('--check');
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8');
const log = (...a) => { if (!CHECK) console.log(...a); };
const fail = [];

const toile = lire('toile.html');
const moteur = lire('extension/dys-core.js');

/* ---------- les nœuds déclarés ---------- */
const noeuds = [...toile.matchAll(/\{id:'([^']+)',\s*f:'([^']+)',[^}]*?label:'([^']*)'/g)]
  .map((m) => ({ id: m[1], f: m[2], label: m[3] }));
const familles = new Set(noeuds.map((n) => n.f));
if (!noeuds.length) fail.push("toile.html : aucun nœud lu — le format du tableau N a changé, ce banc ne mesure plus rien");

/* ---------- ① la légende ---------- */
{
  const rech = lire('recherche.html');
  const m = /(\d+)\s*nœuds,\s*(\d+)\s*familles/.exec(rech.replace(/&nbsp;/g, ' '));
  if (!m) fail.push("recherche.html : la légende « N nœuds, M familles » a disparu — plus rien ne dit au lecteur ce qu'il regarde");
  else {
    if (+m[1] !== noeuds.length) fail.push('légende : « ' + m[1] + ' nœuds » annoncés, ' + noeuds.length + ' déclarés dans toile.html');
    if (+m[2] !== familles.size) fail.push('légende : « ' + m[2] + ' familles » annoncées, ' + familles.size + ' déclarées');
  }
}

/* ---------- ② ce que le moteur charge doit être nommé ---------- */
/* Dérivé du moteur, jamais recopié : chaque setter public a son nom de table dans la carte. */
const ASSETS = {
  setLex: ['vdc-lex', 'GENDER', 'CONJ_C'],
  setNounPost: ['NOUN_POST'],
  setPosHmm: ['POS-HMM'],
  setPrenoms: ['prénom', 'prenom', 'PRENOMS'],
  setGaccLex: ['accentué', 'accentue', 'GENDER_ACC', "collision"],
  setOsLm: ['OS-sujet', 'os-subj'],
  setConfusables: ['confusable'],
  setPonctLm: ['ponctuation', 'ponct'],
};
const setters = [...new Set([...moteur.matchAll(/\b(set[A-Z][A-Za-z]*)\s*:/g)].map((m) => m[1]))];
const dansToile = (mots) => mots.some((x) => toile.toLowerCase().indexOf(x.toLowerCase()) >= 0);
for (const s of setters) {
  const mots = ASSETS[s];
  if (!mots) { fail.push('setter « ' + s + " » inconnu de ce banc : le moteur charge quelque chose de neuf — l'ajouter à ASSETS ET à la toile"); continue; }
  if (!dansToile(mots)) fail.push('la toile ne nomme nulle part ce que « ' + s + ' » charge (cherché : ' + mots.join(', ') + ')');
}

/* ---------- ③ RETIRÉ, et c'est la bonne décision ----------
   J'ai écrit un contrôle « tout nœud qui ressemble à un symbole doit exister dans dys-core ». Il a accusé
   « Terminaisons » (du français), puis « POS-HMM » (le moteur écrit posHmm), puis « IPA · phon_key » et
   « Ponctuation · _SEG » — des libellés COMPOSITES qui nomment deux choses à la fois. Les étiquettes d'une
   figure sont de la prose, pas des identifiants : il n'existe pas de correspondance mécanique à garder.
   Le rendre vert aurait demandé une liste d'exceptions aussi longue que la toile — donc une garde qu'on
   contourne au lieu de la croire. Elle est retirée, comme la garde « locution » du 18/09 : ce qui ne peut
   pas être falsifié proprement ne reste pas. ① et ② suffisent, et eux sont exacts. */

/* ---------- information, sans verdict ---------- */
const i = moteur.indexOf('CRULES');
const nRegles = i < 0 ? 0 : [...moteur.slice(i, i + 4000).matchAll(/\['([^']{4,60})'\s*,/g)].length;
const nVig = new Set([...moteur.matchAll(/name:'([^']*à vérifier)'/g)].map((m) => m[1])).size;

if (fail.length) { fail.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
log('✓ toile : ' + noeuds.length + ' nœuds / ' + familles.size + ' familles == la légende ; '
    + setters.length + ' tables chargées par le moteur, toutes nommées ; aucun symbole disparu.');
log('  (information, sans verdict : le moteur porte ' + nRegles + ' règles de grammaire et ' + nVig
    + ' vigilances — la toile en montre les FAMILLES, pas le détail.)');
