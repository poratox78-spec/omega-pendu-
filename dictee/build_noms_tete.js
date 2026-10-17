'use strict';
/* ⭐ 17/10/2026 (liste n° 46) — LA TABLE DES NOMS PROPRES DU DÉBUT DE PHRASE.

POURQUOI. Un mot capitalisé en début de phrase (après . ! ? …, après un saut de ligne) inconnu du dictionnaire peut être une faute
(« Ensuitte » → Ensuite) ou un nom propre (« Forbes » → Forces, « Holmes » → Hommes). Le moteur ne lui donne qu'une ORANGE, et
à condition de ne pas être un nom propre CONNU : prénom (prenoms_genre.tsv), lieu (_LIEUX)… et cette table-ci.

CE QU'ELLE CONTIENT, par construction : les noms propres d'un mot (≥ 6 lettres) du Wiktionnaire FRANÇAIS que le PRODUIT marquerait
en début de phrase sans elle — et que la table fait taire. Deux passes : ① table vide → les noms marqués ; ② table = ces noms →
ceux qui restent marqués viennent d'une AUTRE étape du moteur (la table est sans effet sur eux) et sortent de la table. Rien d'autre n'y entre.

SOURCE : Wiktionnaire via kaikki.org (`data_local/fr/kaikki-frwikt.jsonl`, `pos=name`), CC BY-SA = notre licence, comme
build_prenoms.py. ⚠️ Le dump reste dans `data_local/` (gitignoré) : seule la table extraite est commitée. La CI ne peut donc pas
reconstruire la table ; elle vérifie que ses TROIS copies sont identiques (dictee/prenoms_probe.py) : `dictee/noms_tete.txt`
(moteur Python), le littéral NP46 de `extension/dys-core.js` et celui de `app/omega-pendu.html`.

    node dictee/build_noms_tete.js            # reconstruit la table et réécrit les deux littéraux
    node dictee/build_noms_tete.js --check    # code ≠ 0 si la table n'est plus celle que produit ce script (saute sans le dump)

À relancer quand l'orthographe change beaucoup (un nom peut se mettre à ressembler à un mot fréquent). */
const fs = require('fs'), path = require('path'), readline = require('readline');
const RACINE = path.resolve(__dirname, '..');
const DUMP = path.join(RACINE, 'data_local', 'fr', 'kaikki-frwikt.jsonl');
const SORTIE = path.join(__dirname, 'noms_tete.txt');
const CIBLES = [path.join(RACINE, 'extension', 'dys-core.js'), path.join(RACINE, 'app', 'omega-pendu.html')];
const CHECK = process.argv.includes('--check');
const RE_LIT = /\/\*NP46<\*\/'[^']*'\/\*>NP46\*\//;

async function nomsDuDump() {
  const vus = new Set();
  const rl = readline.createInterface({ input: fs.createReadStream(DUMP, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const l of rl) {
    if (l.indexOf('"pos": "name"') < 0 && l.indexOf('"pos":"name"') < 0) continue;
    let d; try { d = JSON.parse(l); } catch (e) { continue; }
    if (d.pos !== 'name') continue;
    const w = d.word || '';
    if (/^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]{5,}$/.test(w)) vus.add(w);   // un mot, ≥ 6 lettres, une seule majuscule
  }
  return [...vus].sort();
}

function marques(D, liste) {   // le nom, en début de phrase (pas 1er mot du texte), reçoit-il une marque ?
  const s = new Set();
  for (const w of liste) if ((D.spellText('Il part. ' + w + ' vient.') || []).some((x) => x.word === w)) s.add(w);
  return s;
}

(async () => {
  if (!fs.existsSync(DUMP)) {
    console.log('  ⚠ dump Wiktionnaire absent (' + DUMP + ') — data_local/ est gitignoré : table NON vérifiée ici');
    process.exit(CHECK ? 0 : 1);
  }
  const liste = await nomsDuDump();
  const D = require(path.join(RACINE, 'extension', 'charger_node.js'))({ ext: path.join(RACINE, 'extension') });
  D.setNomsTete('');
  const A = marques(D, liste);
  D.setNomsTete([...A].join('\n'));
  const B = marques(D, [...A]);
  const table = [...A].filter((w) => !B.has(w)).sort();
  const txt = table.join('\n') + '\n';
  if (CHECK) {
    const cur = fs.existsSync(SORTIE) ? fs.readFileSync(SORTIE, 'utf8') : '';
    if (cur === txt) { console.log('  ✓ table des noms du début de phrase FRAÎCHE : ' + table.length + ' noms'); process.exit(0); }
    console.log('  ✗ TABLE DES NOMS PÉRIMÉE : dictee/noms_tete.txt ≠ build_noms_tete.js — relancer node dictee/build_noms_tete.js');
    process.exit(1);
  }
  fs.writeFileSync(SORTIE, txt);
  const lit = "/*NP46<*/'" + table.join(' ') + "'/*>NP46*/";
  for (const f of CIBLES) {
    const t = fs.readFileSync(f, 'utf8');
    if (!RE_LIT.test(t)) throw new Error('marqueur NP46 absent : ' + f);
    fs.writeFileSync(f, t.replace(RE_LIT, () => lit));
  }
  console.log('  noms propres du Wiktionnaire (un mot, ≥ 6 lettres) : ' + liste.length);
  console.log('  marqués en début de phrase sans la table : ' + A.size + ' · encore marqués avec (autre étape) : ' + B.size);
  console.log('  → table : ' + table.length + ' noms, écrite dans dictee/noms_tete.txt et les deux littéraux NP46');
})();
