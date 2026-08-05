#!/usr/bin/env node
/* LA COMBINAISON — l'aligneur DIT OÙ À PEU PRÈS, le canal texte DIT LEQUEL EXACTEMENT.
 *
 * REPROCHE DE REM (2026-08-06) : « tu as mesuré que séparément, or on a toujours trouvé un moyen
 * de combiner ». Fondé. Toute la journée j'ai opposé des routes au lieu de les faire travailler :
 *   · aligneur seul (règle 190/600)       -> 0/12 sur la voix de Rem
 *   · canal texte seul (ce qui est livré) -> 12 marques sur 27
 *   · les deux ensemble                   -> JAMAIS MESURÉ
 *
 * POURQUOI ILS SE COMPLÈTENT, EN CHIFFRES DÉJÀ MESURÉS :
 *   · l'aligneur vise juste à ±1 MOT dans 89 % des cas, mais EXACTEMENT dans 59 % seulement.
 *     Il sait À PEU PRÈS OÙ, et il connaît la DURÉE de la pause — donc le TYPE de la marque.
 *   · le canal texte ignore tout des silences, mais il sait OÙ une marque est GRAMMATICALEMENT
 *     possible : « à la, plage » lui est interdit (garde `_PASAPRES`, 0,32 % de contre-exemples
 *     sur 78 022 virgules), « du pain, du fromage » lui est naturel.
 * Un tireur qui vise à un mot près et un juge qui sait lequel des trois mots est légal : c'est
 * une paire, pas deux concurrents. C'est exactement la forme de l'arbitrage de la maison —
 * chaque route apporte ce qu'elle sait, aucune ne fait le travail de l'autre.
 *
 * LA RÈGLE, EN UNE PHRASE : pour chaque pause détectée à l'indice k, on regarde les candidats
 * {k-1, k, k+1} et on garde celui que le CANAL TEXTE juge le plus probable ; la DURÉE de la pause
 * donne le type. Aucun seuil nouveau, aucun réglage : on réutilise `ponctDist` tel qu'il est livré.
 *
 * ⚠️ On mesure avec le tagger et le modèle RÉELS (ceux de `extension/assets/`), pas une copie.
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const RACINE = path.dirname(__dirname);

require(path.join(RACINE, 'extension', 'dys-core.js'));
const DC = global.DYSCORE;
DC.setPosHmm(JSON.parse(fs.readFileSync(path.join(RACINE, 'dictee', 'pos_hmm.json'), 'utf8')));
DC.setPonctLm(JSON.parse(zlib.gunzipSync(
  fs.readFileSync(path.join(RACINE, 'extension', 'assets', 'ponct-lm.json.gz'))).toString('utf8')));

const DUMP = path.join(RACINE, 'data_local', 'voix', 'combine_dump.json');
if (!fs.existsSync(DUMP)) { console.log('lancer d abord : python dictee/voix_combine_dump.py'); process.exit(1); }
const D = JSON.parse(fs.readFileSync(DUMP, 'utf8'));

const COMMA_MS = 190, PERIOD_MS = 600;
// La garde structurelle du canal texte : jamais de marque après un déterminant ou une préposition.
const PASAPRES = new Set(('le la les un une des du de d au aux a en dans sur sous par pour avec sans chez ' +
  'vers depuis pendant selon entre mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs ce cet ' +
  'cette ces chaque aucun aucune plusieurs quel quelle quels quelles').split(' '));

/* Le canal texte, pour une position : probabilité qu'une marque tombe APRÈS le mot i.
   On somme virgule + point : ici on ne lui demande pas le TYPE (l'audio le sait mieux, il a la
   durée), seulement SI une marque est plausible ici. Chacun sa spécialité. */
function pTexte(mots, tg, i) {
  if (i < 0 || i >= mots.length - 1) return -1;
  if (PASAPRES.has(String(mots[i]).toLowerCase())) return 0;      // interdit structurel
  const d = DC.ponctDist(mots, tg, i, 0);
  return d ? (d[1] + d[2]) : 0;
}

function evalue(clips, mode) {
  let jv = 0, pv = 0, av = 0, jp = 0, pp = 0, ap = 0, dep = 0;
  for (const c of clips) {
    const mots = c.mots, marq = c.marques;
    const tg = DC.posTags(mots) || [];
    for (const m of marq.slice(0, -1)) { if (m === ',') av++; else if (m) ap++; }
    for (const [k0, ms] of (c.coupes || [])) {
      let k = k0;
      if (mode === 'combine') {
        // ⭐ LE RECALAGE : parmi {k-1, k, k+1}, le mot que le canal texte juge le plus probable.
        let best = -1, bp = -1;
        for (const dd of [-1, 0, 1]) {
          const p = pTexte(mots, tg, k0 + dd);
          if (p > bp) { bp = p; best = k0 + dd; }
        }
        if (best >= 0) { if (best !== k0) dep++; k = best; }
      }
      const pred = ms >= PERIOD_MS ? '.' : (ms >= COMMA_MS ? ',' : '');
      if (!pred || k < 0 || k >= marq.length - 1) continue;
      if (pred === ',') { pv++; if (marq[k] === ',') jv++; }
      else { pp++; if (marq[k] === '.') jp++; }
    }
  }
  const j = jv + jp, p = pv + pp, a = av + ap;
  return { j, p, a, jv, pv, av, jp, pp, ap, dep,
           F: (p + a) ? 2 * j / (p + a) : 0 };
}

/* ⭐ LA VRAIE PAIRE A COMPARER — et c'est la remarque de Rem poussee jusqu'au bout.
   Comparer « aligneur seul » a « aligneur x texte » ne dit pas si l'ANCRE AJOUTE quelque chose
   AU PRODUIT : le produit, aujourd'hui, c'est LE CANAL TEXTE. La question utile est donc
   « canal texte SEUL » contre « canal texte PLUS l'ancre ».
   · le canal texte seul = la regle LIVREE : virgule si p>0,50, point si p>0,70, garde _PASAPRES ;
   · l'union = ces marques-la, PLUS celles que l'ancre propose la ou le texte se taisait, une
     fois recalees d'un mot par le texte. L'audio APPORTE une preuve que le texte n'a pas
     (quelqu'un s'est tu) ; le texte APPORTE une legalite que l'audio ignore. Personne ne fait
     le travail de l'autre. */
function texteSeul(mots, tg) {
  const out = new Map();
  let dep = 0;
  for (let i = 0; i < mots.length - 1; i++) {
    if (PASAPRES.has(String(mots[i]).toLowerCase())) { dep++; continue; }
    const d = DC.ponctDist(mots, tg, i, dep);
    if (!d) { dep++; continue; }
    const seuil = d[2] > d[1] ? 0.70 : 0.50;
    if (d[1] > seuil || d[2] > seuil) { out.set(i, d[2] > d[1] ? '.' : ','); dep = 0; }
    else dep++;
  }
  return out;
}

/* ⭐⭐ LE TEXTE NE RECALE PAS SEULEMENT : IL REFUSE.
   C'etait le maillon manquant. L'ancre proposait une marque a CHAQUE pause >= 190 ms, et le texte
   se contentait de choisir lequel des trois mots voisins. Resultat : rappel triple, justesse
   effondree (69 % -> 22 %). Or une pause n'est pas une marque — on l'avait deja mesure ce matin :
   meme avec une ancre PARFAITE, la regle 190/600 ne fait que 21 % de justesse sur ce lit.
   La division du travail correcte est donc :
     · l'AUDIO propose (il sait que quelqu'un s'est tu — le texte l'ignore) ;
     · le TEXTE dispose (il sait si une marque est legale ici — l'audio l'ignore).
   `SEUIL_ANCRE` est le prix d'entree que le texte exige pour accepter une proposition de l'audio.
   Il est BALAYE, pas devine. */
function evalueUnion(clips, avecAncre, SEUIL_ANCRE) {
  let j = 0, p = 0, a = 0, ajout = 0;
  for (const c of clips) {
    const mots = c.mots, marq = c.marques, tg = DC.posTags(mots) || [];
    for (const m of marq.slice(0, -1)) if (m) a++;
    const pose = texteSeul(mots, tg);
    if (avecAncre) {
      for (const [k0, ms] of (c.coupes || [])) {
        let best = -1, bp = -1;
        for (const dd of [-1, 0, 1]) {
          const q = pTexte(mots, tg, k0 + dd);
          if (q > bp) { bp = q; best = k0 + dd; }
        }
        if (best < 0 || best >= marq.length - 1) continue;
        if (pose.has(best)) continue;                 // le texte l'avait deja : rien a ajouter
        if (bp < SEUIL_ANCRE) continue;               // ⭐ LE TEXTE REFUSE : pas de marque legale ici
        const t = ms >= PERIOD_MS ? '.' : (ms >= COMMA_MS ? ',' : '');
        if (t) { pose.set(best, t); ajout++; }
      }
    }
    for (const [i, t] of pose) { p++; if (marq[i] === t) j++; }
  }
  return { j, p, a, ajout, F: (p + a) ? 2 * j / (p + a) : 0, dep: 0 };
}

function ligne(nom, r) {
  console.log('  ' + nom.padEnd(26) +
    ' justes ' + String(r.j).padStart(3) + '/' + String(r.p).padStart(3) +
    ' (' + String((r.p ? 100 * r.j / r.p : 0).toFixed(0)).padStart(3) + ' %)' +
    '   trouvees ' + String(r.j).padStart(3) + '/' + String(r.a).padStart(3) +
    ' (' + String((r.a ? 100 * r.j / r.a : 0).toFixed(0)).padStart(3) + ' %)' +
    '   F1 ' + r.F.toFixed(3) +
    (r.dep ? '   [' + r.dep + ' marques recalees]' : ''));
}

if (D.rem) {
  console.log('\n=== LA VOIX DE REM (vraie dictee, 14 marques attendues) ===');
  ligne('aligneur SEUL', evalue([D.rem], 'seul'));
  ligne('aligneur x CANAL TEXTE', evalue([D.rem], 'combine'));
  const durOnly = { mots: D.rem.mots, marques: D.rem.marques, coupes: D.rem.coupes_duree };
  ligne('(duree seule) SEUL', evalue([durOnly], 'seul'));
  ligne('(duree seule) x TEXTE', evalue([durOnly], 'combine'));
  console.log('  --- LA PAIRE QUI COMPTE ---');
  ligne('CANAL TEXTE seul', evalueUnion([D.rem], false, 0));
  for (const s of [0.20, 0.30, 0.40]) {
    ligne('  + ancre APPRISE, s=' + s.toFixed(2), evalueUnion([D.rem], true, s));
  }
  // ⭐ L'ancre APPRISE (2,9 Ko) est-elle NECESSAIRE, ou la duree seule suffit-elle une fois que le
  // texte filtre ? Si la duree suffit, on n'embarque AUCUN modele : ni poids, ni entrainement.
  const remDur = { mots: D.rem.mots, marques: D.rem.marques, coupes: D.rem.coupes_duree };
  for (const s of [0.20, 0.30, 0.40]) {
    ligne('  + DUREE (lexique), s=' + s.toFixed(2), evalueUnion([remDur], true, s));
  }
  // ⭐ ET AVEC LE COMPTAGE NAIF DES VOYELLES ECRITES : si ca tient, l'aligneur est portable en JS
  // en trois lignes — ni Lexique, ni g2p, ni modele. Rien a embarquer du tout.
  const remNaif = { mots: D.rem.mots, marques: D.rem.marques, coupes: D.rem.coupes_naif };
  for (const s of [0.30]) {
    ligne('  + DUREE (naif), s=' + s.toFixed(2), evalueUnion([remNaif], true, s));
  }
  // ⭐⭐ LE FEU VERT : la meme chaine, mais sur la timeline QUE LE NAVIGATEUR PRODUIT REELLEMENT
  // (un RMS toutes les 30 ms, fenetre de 21 ms, donc 9 ms sur 30 jamais regardees). Si ca
  // s'effondre ici, tout ce qui precede est du laboratoire et n'est pas livrable.
  const remNav = { mots: D.rem.mots, marques: D.rem.marques, coupes: D.rem.coupes_nav };
  for (const s of [0.20, 0.30, 0.40]) {
    ligne('  + NAVIGATEUR 30ms, s=' + s.toFixed(2), evalueUnion([remNav], true, s));
  }
}
if (D.lit && D.lit.length) {
  console.log('\n=== LE LIT (93 clips lus — legitime pour la VIRGULE seulement) ===');
  const a = evalue(D.lit, 'seul'), b = evalue(D.lit, 'combine');
  ligne('aligneur SEUL', a);
  ligne('aligneur x CANAL TEXTE', b);
  console.log('    dont VIRGULE : seul ' + a.jv + '/' + a.pv + '  ->  combine ' + b.jv + '/' + b.pv +
              '   (attendues ' + a.av + ')');
  console.log('  --- LA PAIRE QUI COMPTE ---');
  ligne('CANAL TEXTE seul', evalueUnion(D.lit, false, 0));
  for (const s of [0.20, 0.30, 0.40]) {
    ligne('  + DUREE (lexique), s=' + s.toFixed(2), evalueUnion(D.lit, true, s));
  }
  const litNav = D.lit.map(c => ({ mots: c.mots, marques: c.marques, coupes: c.coupes_nav }));
  for (const s of [0.20, 0.30, 0.40]) {
    ligne('  + NAVIGATEUR 30ms, s=' + s.toFixed(2), evalueUnion(litNav, true, s));
  }
}
