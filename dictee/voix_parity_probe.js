// voix_parity_probe.js — LES DEUX SURFACES VOCALES DOIVENT DIRE LA MÊME CHOSE À L'API.
//
// POURQUOI CE FICHIER EXISTE. On a DEUX surfaces qui parlent au même Web Speech : le site
// (`saisie-vocale.html`) et l'extension (`extension/sidepanel.js`). Rem l'a dit : « je pense surtout
// que les deux surfaces sont identiques ». Elles doivent l'être — mais rien ne le vérifiait, et la
// journée du 2026-08-03 a montré ce que ça coûte :
//
//   · `quality='dictation'` CASSE la reconnaissance sur l'appareil (« language-not-supported »).
//     Livré, puis réparé (PR#370/371/372) — sur UNE surface d'abord, l'autre traînant derrière.
//   · deux options qui se croisent font QUATRE cas, pas deux. Une seule avait été testée.
//
// Ce que la garde vérifie, et RIEN de plus (elle ne juge pas l'UI, qui diffère légitimement) :
//   ① même nombre d'hypothèses demandées — c'est ce qui alimente l'arbitrage ;
//   ② l'arbitrage existe des deux côtés et y est LOGIQUEMENT identique (comparaison après
//     normalisation des espaces et des noms, pas octet à octet : les styles de code diffèrent) ;
//   ③ le résultat final passe bien PAR l'arbitrage — pas par `r[0]` en douce ;
//   ④ `quality` reste gardé par `processLocally` (la régression déjà payée une fois).
//
//   node dictee/voix_parity_probe.js        · ... --check   (sortie non nulle si divergence)
const fs = require('fs'), path = require('path');

const R = path.join(__dirname, '..');
const SITE = fs.readFileSync(path.join(R, 'saisie-vocale.html'), 'utf8');
const EXT = fs.readFileSync(path.join(R, 'extension', 'sidepanel.js'), 'utf8');

const ecarts = [];
const dit = (ok, quoi, detail) => {
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + (quoi + ' ').padEnd(46, '·') + ' ' + (detail || ''));
  if (!ok) ecarts.push(quoi);
};

// ① combien d'hypothèses on demande
const nAlt = s => (s.match(/maxAlternatives\s*=\s*(\d+)/) || [])[1];
const [a, b] = [nAlt(SITE), nAlt(EXT)];
dit(a && a === b, 'même maxAlternatives', 'site=' + a + ' ext=' + b);
dit(Number(a) >= 2, 'N-best réellement demandé', a + ' hypothèses (1 = pas d\'arbitrage possible)');

// ② l'arbitrage, logiquement identique des deux côtés
function corps(src, nom) {
  const i = src.indexOf('function ' + nom + '(r)');
  if (i < 0) return null;
  const j = src.indexOf('\n  }', i);
  return j < 0 ? null : src.slice(i, j + 4);
}
const cs = corps(SITE, '_arbitre'), ce = corps(EXT, 'arbitre');
dit(!!cs && !!ce, 'arbitrage présent des deux côtés', cs && ce ? '' : 'manquant : ' + (cs ? 'extension' : 'site'));
if (cs && ce) {
  // On normalise ce qui a le DROIT de différer : commentaires, nom de la fonction, et TOUS les
  // blancs — les deux fichiers ont des styles distincts (`for(var` vs `for (var`), et une garde qui
  // crie sur de la mise en forme au lieu de crier sur de la logique finit par être ignorée.
  const norm = t => t.replace(/\/\/[^\n]*/g, '').replace(/\b_arbitre\b/g, 'arbitre').replace(/\s+/g, '');
  const [ns, ne] = [norm(cs), norm(ce)];
  dit(ns === ne, 'arbitrage LOGIQUEMENT identique',
    ns === ne ? (ns.length + ' car. normalisés') : 'les deux surfaces n\'arbitrent plus pareil');
}

// ③ le texte retenu passe bien par l'arbitrage (et pas par r[0] resté en place)
dit(/isFinal[^\n]*_arbitre\(r\)/.test(SITE), 'site : le final vient de l\'arbitrage');
dit(/isFinal[^\n]*arbitre\(r\)/.test(EXT), 'extension : le final vient de l\'arbitrage');

// ④ la régression déjà payée : quality='dictation' tue la reconnaissance SUR L'APPAREIL
for (const [nom, src] of [['site', SITE], ['extension', EXT]]) {
  // ⚠️ les deux fichiers PARLENT de `quality='dictation'` en commentaire (le récit de la régression
  // est écrit juste au-dessus) : chercher la première ligne qui contient la chaîne attrape le
  // COMMENTAIRE, jamais gardé — la sonde criait sur sa propre documentation.
  const lignes = src.split('\n').filter(l => /quality\s*=\s*['"]dictation['"]/.test(l) && !/^\s*(\/\/|\*)/.test(l));
  const ligne = lignes[0] || '';
  // Les deux surfaces expriment la même garde AUTREMENT, et les deux sont valables : l'extension
  // teste `!rec.processLocally`, le site teste la CASE qui pilote `processLocally`. Ce qu'on exige
  // ici, c'est qu'une garde EXISTE sur cette ligne — pas qu'elle soit écrite d'une façon précise.
  const garde = /!\s*[\w.]*processLocally|!\s*\(?\s*loc\b|checked/.test(ligne);
  dit(!ligne || garde, nom + " : quality='dictation' gardé (mode local)",
    !ligne ? 'non utilisé' : (garde ? ligne.trim().slice(0, 58) : 'NON GARDÉ — casse la reconnaissance locale'));
}

// ⑤ symétrique de ④ : `phrases` est refusé par le CLOUD (« phrases-not-supported » au start(),
// mesuré sur les 4 combinaisons) et accepté SUR L'APPAREIL (3/3). Une affectation non gardée casse
// donc la dictée cloud — c'est-à-dire le mode par défaut. Même piège que `quality`, en miroir.
for (const [nom, src] of [['site', SITE], ['extension', EXT]]) {
  // ⚠️ la garde vit sur le `if` ENGLOBANT, pas sur la ligne d'affectation : on regarde donc les
  // ~400 caractères qui précèdent, pas la ligne seule (première version : faux positif immédiat).
  const re = /[\w.]+\.phrases\s*=/g;
  const nu = [];
  let m, vus = 0;
  while ((m = re.exec(src))) {
    const ligne = src.slice(src.lastIndexOf('\n', m.index) + 1, m.index);
    if (/^\s*(\/\/|\*)/.test(ligne)) continue;                      // simple mention en commentaire
    vus++;
    const amont = src.slice(Math.max(0, m.index - 400), m.index).replace(/\/\/[^\n]*/g, '');
    if (!/processLocally|\bloc\b[^\n]*checked|\.checked/.test(amont)) nu.push(m.index);
  }
  dit(!nu.length, nom + " : `phrases` gardé (sur l'appareil seulement)",
    !vus ? 'non utilisé' : (nu.length ? 'NON GARDÉ — casse la dictée cloud' : vus + ' affectation(s) sous garde locale'));
}

console.log(ecarts.length
  ? '❌ surfaces vocales : ' + ecarts.length + ' divergence(s) — ' + ecarts.join(', ')
  : '✅ surfaces vocales : site ≡ extension (N-best, arbitrage, garde quality)');
if (ecarts.length && process.argv.includes('--check')) process.exit(1);
