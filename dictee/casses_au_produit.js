/* LES CASSÉS, REJOUÉS AU PRODUIT — la référence Python n'est pas le moteur livré.
 *
 * POURQUOI (07/09/2026). `dys_pipeline_probe` juge la RÉFÉRENCE PYTHON. Avant de « corriger une
 * faute » qu'elle signale, il faut savoir si l'extension (le produit) la commet aussi : le projet
 * a déjà mesuré des divergences réelles entre les deux (parity_speller, 12 divergences ancrées ;
 * la clé phonétique diverge sur le -x final, où le JS a le correctif et Python non). Corriger côté
 * Python une faute que le produit ne commet PAS, c'est déplacer la parité au lieu du produit.
 *
 * Entrée  : data_local/casses_contexte.json  (mot, sortie_py, gold, raw, fixed)
 * Sortie  : la même liste, avec ce que l'extension fait RÉELLEMENT du même mot dans la même phrase.
 *   node dictee/casses_au_produit.js [--json chemin]
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..'), EXT = path.join(ROOT, 'extension');
const SRC = path.join(ROOT, 'data_local', 'casses_contexte.json');

if (!fs.existsSync(SRC)) { console.log('· CASSÉS AU PRODUIT : ' + SRC + ' absent — sauté'); process.exit(0); }
// ⭐ 14/10/2026 (liste n° 25) : le CHARGEUR UNIQUE — avant, ce banc « au produit » chargeait le moteur sans le genre accentué ni le modèle OS.
const DC = require(path.join(EXT, 'charger_node.js'))({ ext: EXT });
if (!DC.spellerReady()) { console.error('lexique speller non chargé'); process.exit(2); }

const cas = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const out = [];
let idem = 0, innocent = 0, autre = 0;
for (const c of cas) {
  // le PRODUIT, c'est la pyramide entière (ortho + grammaire), pas le seul speller
  let flags = [];
  try { flags = DC.diagnoseAll ? (DC.diagnoseAll(c.raw).flags || DC.diagnoseAll(c.raw) || []) : DC.spellText(c.raw, true); }
  catch (e) { flags = []; }
  if (!Array.isArray(flags)) flags = [];
  const T = DC.toks(c.raw);
  const f = flags.find(x => {
    const w = x.word || (x.i !== undefined ? T[x.i] : '');
    return (w || '').toLowerCase() === (c.mot || '').toLowerCase();
  });
  const sugg = f ? (f.sugg || '') : '';
  const tier = f ? (f.tier || '') : '';
  // le produit n'APPLIQUE que hors vigilance : un orange ne casse rien tout seul
  const applique = f && tier !== 'vigilance' ? sugg : '';
  let verdict;
  if (!applique) { verdict = 'PRODUIT INNOCENT (rien appliqué)'; innocent++; }
  else if (applique.toLowerCase() === (c.sortie_py || '').toLowerCase()) { verdict = 'MÊME FAUTE'; idem++; }
  else { verdict = 'AUTRE SORTIE'; autre++; }
  out.push(Object.assign({}, c, { sortie_ext: applique, tier_ext: tier, verdict: verdict }));
}
const dst = path.join(ROOT, 'data_local', 'casses_au_produit.json');
fs.writeFileSync(dst, JSON.stringify(out, null, 1), 'utf8');
console.log('· %d cassés rejoués au produit : %d MÊME FAUTE · %d produit innocent · %d autre sortie',
            cas.length, idem, innocent, autre);
console.log('  → ' + dst);
for (const o of out.filter(x => x.verdict === 'MÊME FAUTE').slice(0, 25))
  console.log('   [' + o.corpus + '] ' + String(o.mot).padEnd(16) + ' → ' + String(o.sortie_ext).padEnd(16) + ' (gold ' + o.gold + ')');   // console.log ne connaît pas « %-16s » (format Python) : il l'imprimait tel quel
