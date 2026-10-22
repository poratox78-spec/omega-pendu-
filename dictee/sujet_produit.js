// ===== Sonde SUJET : les réponses du PRODUIT (ligne 25b, étape 7, 22/10/2026) =====
// Appelé par `python3 dictee/sujet_probe.py --produit` : la sonde lit l'or UD (outil de mesure) et pose ici les MÊMES questions
// qu'au moteur Python, au moteur du produit (dys-core + assets, extension/charger_node.js), par ses primitives exposées en lecture
// seule (DYSCORE._sonde) — les mêmes que celles des règles d'accord :
//   sujet         : svSubject (route pronom, clitiques sautés) sinon _npSubject (route nominale) — miroir de engine_subject ;
//   verbe-présence : _clauseNoFiniteVerb depuis un voisin dont la fenêtre de proposition CONTIENT le verbe — miroir de _window.
// Même pose que la sonde Python : bornes de l'auteur (_segInfo) seules, étiquettes du tagger du produit.
// Entrée (stdin, JSON) : [[texte, tokens, [index des verbes finis], [sujet or présent ?]], …]
// Sortie (stdout, JSON) : par phrase, par verbe, [verbe-présence : null | true | false, 'pron' | 'nom' | null, index | null]
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = require(path.join(ROOT, 'extension', 'charger_node.js'))({ ext: path.join(ROOT, 'extension') });
const P = D._sonde;
const lo = (w) => D.deacc(String(w).toLowerCase());
function fenetre(i, n, seg) {   // miroir de _window (sujet_probe.py)
  let a = 0, b = n;
  if (seg) {
    for (let j = i; j > 0; j--) if (j < seg.bb.length && seg.bb[j]) { a = j; break; }
    for (let j = i + 1; j < n; j++) if (j < seg.bb.length && seg.bb[j]) { b = j; break; }
  }
  return [a, b];
}
function sujet(T, tg, tv) {   // miroir de engine_subject (sujet_probe.py)
  if (P.svSubject(T, tv) != null) {
    let j = tv - 1, st = 0;
    while (j >= 0 && st < 3 && P.clitic(lo(T[j]))) { j--; st++; }
    return ['pron', j];
  }
  let vs = tv;
  while (vs - 1 >= 0 && P.clitic(lo(T[vs - 1]))) vs--;
  const s = tg ? P.npSubject(T, tg, vs) : null;
  return s ? ['nom', s.idx] : [null, null];
}
let entree = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { entree += c; });
process.stdin.on('end', () => {
  const out = [];
  for (const [texte, T, verbes, avecSujet] of JSON.parse(entree)) {
    const seg = P.seg(texte), tg = D.posTags(T);
    out.push(verbes.map((tv, k) => {
      let vp = null;
      for (const i of [tv - 1, tv + 1]) {
        if (i >= 0 && i < T.length) {
          const [a, b] = fenetre(i, T.length, seg);
          if (a <= tv && tv < b) { vp = P.clauseNoFiniteVerb(T, i) === false; break; }
        }
      }
      const [mode, idx] = avecSujet[k] ? sujet(T, tg, tv) : [null, null];
      return [vp, mode, idx];
    }));
  }
  process.stdout.write(JSON.stringify(out));
});
