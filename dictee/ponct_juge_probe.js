#!/usr/bin/env node
/* LE JUGE À TROIS CLASSES DE LA VIRGULE — parce que mesurer contre UD est INVALIDE.
 *
 * POURQUOI CE FICHIER EXISTE (22/08/2026). Toutes nos mesures de virgule comparaient les marques
 * posées aux virgules d'UD, et comptaient FAUX POSITIF tout ce qui n'y était pas. Or la virgule
 * française est très souvent FACULTATIVE : « De plus, l'appartenance… », « …varient beaucoup,
 * mais il faut… » sont du français juste qu'UD n'annote simplement pas.
 * Vérifié à l'œil sur 40 tirs des règles : **32 étaient corrects**. La « justesse » mesurée contre
 * UD est donc un plancher très bas, et surtout elle ne dit RIEN de ce qui compte pour un dys.
 *
 * CE QUI COMPTE, LUI, EST ASYMÉTRIQUE : une virgule MANQUANTE se lit ; une virgule INTERDITE
 * (« manger du, chocolat ») casse la phrase. On juge donc en TROIS classes, jamais en deux :
 *   · OBLIGATOIRE — la grammaire l'exige (banc Allô prof, 50 exemples cités)          → RAPPEL
 *   · INTERDITE   — la grammaire l'interdit (7 configurations Allô prof + structure)  → LA FAUTE
 *   · FACULTATIVE — ni l'un ni l'autre : le scripteur a le droit                      → NEUTRE
 *
 * ⚠️ SEULES LES INTERDITES SONT DES FAUTES. C'est la seule métrique qui doit piloter un palier
 * rouge. Le reste est du confort, et se juge en orange.
 *
 * DÉTECTION DE L'INTERDIT (conservatrice, structure seulement — jamais du sens) :
 *   ① après un DÉTERMINANT ou une PRÉPOSITION (liste `_PASAPRES` déjà livrée dans la saisie
 *      vocale : c'est elle qui refuse « à la, plage ») ;
 *   ② entre un AUXILIAIRE et son PARTICIPE (« il a, mangé ») ;
 *   ③ entre un PRONOM SUJET et son VERBE (« il, mange ») ;
 *   ④ devant « et / ou / ni » (règle Allô prof citée) ;
 *   ⑤ devant un token collé par un TRAIT D'UNION (« Dessine-,moi ») ;
 *   ⑥ en toute dernière position (une virgule ne finit pas une phrase).
 * Tout le reste est déclaré FACULTATIF — on n'invente pas d'interdit qu'on ne sait pas prouver.
 *
 *   node dictee/ponct_juge_probe.js [nb_phrases]
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const RACINE = path.dirname(__dirname);

require(path.join(RACINE, 'extension', 'dys-core.js'));
const DC = global.DYSCORE;
DC.setPosHmm(JSON.parse(fs.readFileSync(path.join(RACINE, 'dictee', 'pos_hmm.json'), 'utf8')));
const LM = path.join(RACINE, 'extension', 'assets', 'ponct-lm.json.gz');
if (fs.existsSync(LM)) DC.setPonctLm(JSON.parse(zlib.gunzipSync(fs.readFileSync(LM)).toString('utf8')));

/* ── la liste livrée dans la saisie vocale : jamais de virgule après ces mots ─────────────── */
const PASAPRES = new Set(
  ("le la les un une des du de d au aux a en dans sur sous par pour avec sans chez vers depuis " +
   "pendant selon entre mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs ce cet " +
   "cette ces chaque aucun aucune plusieurs quel quelle quels quelles").split(' '));
const AVANT_INTERDIT = new Set(['et', 'ou', 'ni']);
const norm = w => String(w || '').toLowerCase().replace(/[’ʼ]/g, "'");

/* ⚠️ UNE SEULE DÉFINITION DE L'INTERDIT — celle qui est LIVRÉE (`DC.ponctInterdit`, dys-core).
   Si le banc en réimplémentait une copie « équivalente », il testerait sa copie, pas la livraison
   (la faute de méthode déjà payée et encodée dans `proso_probe.js`). */
const interdite = (mots, tg, i) => DC.ponctInterdit(mots, tg, i);

function attendues(phrase) {
  const jets = phrase.match(/[A-Za-zÀ-ÿœŒ'’-]+|,/g) || [];
  const out = new Set(); let n = 0;
  for (const j of jets) { if (j === ',') out.add(n - 1); else n++; }
  return out;
}

const MAX = parseInt(process.argv[2] || '2500', 10);
const ud = path.join(RACINE, 'data_local', 'ud_fr_gsd-train.conllu');
if (!fs.existsSync(ud)) { console.log('ponct_juge_probe : UD absent (data_local/) → sonde SAUTÉE.'); process.exit(0); }

const variantes = [
  ['règles SEULES', (m, tg) => new Set(DC.ponctReglesVirgule(m, tg, new Set()) || [])],
];
if (DC.ponctReady && DC.ponctReady()) {
  // ⚠️ DEUX variantes du modèle, et l'écart entre elles EST le résultat : le brut montre ce que le
  // modèle veut faire, le gardé montre ce qui est réellement LIVRÉ dans la saisie vocale (seuil
  // 0,50 + refus après déterminant/préposition + refus devant un trait d'union).
  const brut = (m, tg) => {
    const o = new Set();
    for (let z = 0; z < m.length - 1; z++) {
      const d = DC.ponctDist(m, tg, z, 0);
      if (d && d[1] > 0.50 && d[1] > d[2]) o.add(z);
    }
    return o;
  };
  variantes.unshift(['modèle + gardes LIVRÉES', (m, tg) => {
    const o = new Set();
    for (const i of brut(m, tg)) if (!DC.ponctInterdit(m, tg, i)) o.add(i);   // = ce que pose la saisie vocale
    return o;
  }]);
  variantes.unshift(['modèle BRUT (sans gardes)', brut]);
}

console.log('\nJUGE À TROIS CLASSES — obligatoire / facultative / INTERDITE');
console.log('⚠️ seules les INTERDITES sont des fautes ; les facultatives sont un droit du scripteur.\n');

for (const [nom, poser] of variantes) {
  let obl = 0, fac = 0, inter = 0, n = 0;
  const motifs = {}, ex = [];
  const lignes = fs.readFileSync(ud, 'utf8').split('\n');
  for (const L of lignes) {
    if (!L.startsWith('# text = ')) continue;
    const p = L.slice(9).trim();
    if (p.length < 25) continue;
    if (++n > MAX) break;
    const mots = p.match(/[A-Za-zÀ-ÿœŒ'’-]+/g) || [];
    if (mots.length < 4) continue;
    const tg = DC.posTags(mots) || [], att = attendues(p);
    let got;
    try { got = poser(mots, tg); } catch (e) { continue; }
    for (const i of got) {
      if (att.has(i)) { obl++; continue; }
      const m = interdite(mots, tg, i);
      if (m) {
        inter++; motifs[m] = (motifs[m] || 0) + 1;
        if (ex.length < 6) ex.push(mots.slice(Math.max(0, i - 4), i + 1).join(' ') + ' ⟨,⟩ ' + mots.slice(i + 1, i + 4).join(' ') + '   [' + m + ']');
      } else fac++;
    }
  }
  const tot = obl + fac + inter;
  console.log('  ' + nom);
  console.log('    virgules posées      : ' + tot);
  console.log('    · dans le gold UD    : ' + obl + '  (' + (100 * obl / Math.max(1, tot)).toFixed(1) + ' %)');
  console.log('    · FACULTATIVES       : ' + fac + '  (' + (100 * fac / Math.max(1, tot)).toFixed(1) + ' %)  ← pas des fautes');
  console.log('    · ⛔ INTERDITES      : ' + inter + '  (' + (100 * inter / Math.max(1, tot)).toFixed(1) + ' %)  ← LA métrique');
  for (const k of Object.keys(motifs).sort((a, b) => motifs[b] - motifs[a])) console.log('        ' + String(motifs[k]).padStart(4) + '  ' + k);
  ex.forEach(x => console.log('        ✗ ' + x));
  console.log('');
}
