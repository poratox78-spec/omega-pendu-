'use strict';
// ⭐ 14/10/2026 (liste n° 25) — LE CHARGEUR UNIQUE DU PRODUIT POUR NODE.
// Chaque banc chargeait SES tables à la main : l'un sans le modèle OS, l'autre sans le genre accentué ou sans l'étiqueteur. Un banc
// qui dit « au produit » mesurait alors un AUTRE moteur — c'est ainsi qu'une erreur du modèle OS est passée inaperçue (audit du
// 13/10). Ce module charge dys-core.js avec EXACTEMENT les tables que charge l'extension (content.js : loadLex + confusables ;
// sidepanel.js ajoute la ponctuation vocale, option `ponct`). La garde extension/chargeur_probe.js vérifie que la liste ci-dessous
// suit content.js / sidepanel.js, et qu'aucun banc ne charge le moteur à la main sans dire pourquoi.
//   const D = require('../extension/charger_node.js')({ ext, core, ponct });
const fs = require('fs'), path = require('path'), zlib = require('zlib');

// clé de loadLex (content.js) → [fichier d'asset, méthode de dys-core, lecture]
const TABLES = {
  prenoms: ['prenoms.tsv.gz', 'setPrenoms', 'gz'],
  nom: ['noun-post.txt.gz', 'setNounPost', 'gz'],
  hmm: ['pos-hmm.json.gz', 'setPosHmm', 'gzjson'],
  gacc: ['gender-acc.json.gz', 'setGaccLex', 'gz'],
  osLm: ['os-subj-lm.json.gz', 'setOsLm', 'gzjson'],
};
// vdc + genderRelaxed + speller passent ensemble par setLex ; confusables par setConfusables (content.js, chargement séparé).

function chargerProduit(opts) {
  opts = opts || {};
  const EXT = opts.ext || __dirname, core = opts.core || path.join(EXT, 'dys-core.js');
  const lire = (f) => fs.readFileSync(path.join(EXT, 'assets', f));
  const gz = (f) => zlib.gunzipSync(lire(f)).toString('utf8');
  delete global.DYSCORE; delete require.cache[path.resolve(core)];
  require(path.resolve(core));
  const D = global.DYSCORE;
  D.setLex(JSON.parse(lire('vdc-lex.json').toString('utf8')), gz('gender-relaxed.tsv.gz'), gz('speller.tsv.gz'));
  for (const k of Object.keys(TABLES)) {
    const [f, m, mode] = TABLES[k];
    if (typeof D[m] !== 'function') throw new Error('charger_node : dys-core n\'expose plus ' + m + ' (table « ' + k + ' »)');
    D[m](mode === 'gzjson' ? JSON.parse(gz(f)) : gz(f));
  }
  if (D.setConfusables) D.setConfusables(JSON.parse(lire('confusables.json').toString('utf8')));
  if (opts.ponct && D.setPonctLm) D.setPonctLm(JSON.parse(gz('ponct-lm.json.gz')));
  return D;
}
chargerProduit.TABLES = TABLES;
module.exports = chargerProduit;
