// ===== Le pipeline complet du PRODUIT, pour le juge de dys_pipeline_probe.py (ligne 25b, étape 10, 23/10/2026) =====
// Appelé par `python3 dictee/dys_pipeline_probe.py --produit` : la sonde lit le gold (outil de mesure) et fait corriger chaque texte
// par le moteur du PRODUIT (dys-core + assets, extension/charger_node.js : diagnoseAll, la pyramide orthographe → grammaire et ses
// oranges), au lieu de la pyramide Python, qui n'est plus tenue au pas du produit depuis le débranchement du moteur Python.
// Même lecture des marques que la pyramide Python, pour que le chiffre reste comparable :
//   rouge (palier auto / flag) sur UN mot, suggestion d'un seul mot → APPLIQUÉ ;
//   orange (vigilance) avec une suggestion → PROPOSÉ au clic ; sans suggestion → SOULIGNÉ ;
//   une marque sur PLUSIEURS mots, ou une suggestion à espace : le juge (mot à mot) ne l'applique pas → proposée, et comptée à
//   part (« plusieurs mots ») ; la typographie et le point final ne touchent aucun mot → ignorés.
// Entrée (stdin, JSON) : ["texte brut", …] · Sortie (stdout, JSON) : par texte {T, app:[[i, sugg, règle]], orange:[[i, sugg]], sig:[i], multi}
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = require(path.join(ROOT, 'extension', 'charger_node.js'))({ ext: path.join(ROOT, 'extension') });
const unMot = (s) => /^[A-Za-zÀ-ÖØ-öø-ÿœŒæÆ]+$/.test(String(s).replace(/'/g, ''));   // miroir de _mot (Python) : lettres, apostrophe admise, ni espace ni trait d'union
let entree = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { entree += c; });
process.stdin.on('end', () => {
  const out = JSON.parse(entree).map((texte) => {
    const T = D.toks(texte), app = [], orange = [], sig = [], pris = new Set();
    let multi = 0;
    for (const f of (D.diagnoseAll(texte).flags || [])) {
      if (f.name === 'point final' || f.from !== undefined || typeof f.i !== 'number') continue;
      const rouge = f.tier === 'auto' || f.tier === 'flag';
      const sugg = typeof f.sugg === 'string' ? f.sugg : '';
      const propre = sugg && sugg.toLowerCase() !== String(f.word).toLowerCase();
      if ((f.span || 1) > 1 || (sugg && !unMot(sugg) && propre)) { multi++; if (propre) orange.push([f.i, sugg]); else sig.push(f.i); continue; }
      if (rouge && propre && !pris.has(f.i)) { app.push([f.i, sugg, f.name]); pris.add(f.i); continue; }
      if (propre) orange.push([f.i, sugg]); else sig.push(f.i);
    }
    return { T, app, orange, sig, multi };
  });
  process.stdout.write(JSON.stringify(out), () => process.exit(0));   // sortir APRÈS l'écriture (tube asynchrone sous Linux)
});
