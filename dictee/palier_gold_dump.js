/* ACCORD DE PALIER produit ↔ référence — étage JS. Charge le moteur de l'EXTENSION (`dys-core.js`)
 * équipé de ses assets, exactement comme `extension/parity_core.js` (le harnais du produit), et
 * dumpe les flags du SPELLER (`spellText`, famille `orthographe` paliers auto / flag / vigilance, et famille « mot inconnu » = palier `inconnu`)
 * sur les textes qu'on lui passe — le gold dys LOCAL, jamais committé.
 *
 *   node dictee/palier_gold_dump.js entree.json sortie.json
 *     entree.json : ["texte brut", ...]
 *     sortie.json : [{ toks:[...], flags:[{i, word, sugg, tier}] }, ...]  (même ordre)
 *
 * ⭐ Pourquoi `spellText` et non `diagnoseAll` : la garde mesure le PALIER que le SPELLER rend, face
 *   à `speller_probe.correct_text` (la référence appelle le speller seul). `diagnoseAll` empile
 *   pyramide + cascade grammaticale + arbitrage : une autre question, déjà couverte par
 *   `dys_precision_probe --navigateur`. Un flag ortho de `spellText` qui survit ou non à l'arbitrage
 *   ne change pas le palier que le speller lui a donné — et c'est ce palier qui a fait mentir la
 *   mesure Python le 05/09/2026 (#667 → #670).
 * ⭐ Équiper le moteur COMME LE PRODUIT (leçon parity_core du 2026-08-11) : sans le speller.tsv,
 *   `SP.ready` est faux et `spellText` rend [] — vert par omission. */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const EXT = path.join(__dirname, '..', 'extension');
const [fin, fout] = process.argv.slice(2);
if (!fin || !fout) { console.error('usage : node dictee/palier_gold_dump.js entree.json sortie.json'); process.exit(2); }

require(path.join(EXT, 'dys-core.js'));
const D = global.DYSCORE, A = p => path.join(EXT, 'assets', p), gz = p => zlib.gunzipSync(fs.readFileSync(A(p))).toString('utf8');
D.setLex(JSON.parse(fs.readFileSync(A('vdc-lex.json'), 'utf8')), gz('gender-relaxed.tsv.gz'), gz('speller.tsv.gz'));
D.setNounPost(gz('noun-post.txt.gz'));
D.setPosHmm(JSON.parse(gz('pos-hmm.json.gz')));
D.setPrenoms(gz('prenoms.tsv.gz'));
D.setGaccLex(gz('gender-acc.json.gz'));
if (!D.spellerReady()) { console.error('speller NON prêt : le moteur n’est pas équipé comme le produit'); process.exit(3); }

const textes = JSON.parse(fs.readFileSync(fin, 'utf8'));
const out = textes.map(t => {
  const flags = [];
  for (const f of D.spellText(t)) {
    if ((f.span || 1) !== 1) continue;   // span 2 = règle à deux mots : la référence travaille token à token
    if (f.name === 'orthographe') flags.push({ i: f.i, word: f.word, sugg: f.sugg, tier: f.tier });
    // ⭐ 07/09/2026 : le palier « mot inconnu » (spellUnknown, orange) entre dans la comparaison — 5 des 8 « référence
    //   seule » du 07/09 étaient en fait CETTE famille côté produit. sugg === mot = souligné SANS suggestion → ''.
    else if (f.name === 'mot inconnu') flags.push({ i: f.i, word: f.word, tier: 'inconnu',
      sugg: (f.sugg && f.sugg.toLowerCase() !== f.word.toLowerCase()) ? f.sugg : '' });
  }
  return { toks: D.toks(String(t).replace(/[’ʼ]/g, "'")), flags };
});
fs.writeFileSync(fout, JSON.stringify(out), 'utf8');
console.log('dump palier : %d textes, %d flags orthographe', textes.length, out.reduce((n, o) => n + o.flags.length, 0));
