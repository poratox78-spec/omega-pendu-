// Verrou CI du SERVICE WORKER (invariant hors-ligne) — sw.js n'avait AUCUNE couverture alors qu'il change
// à chaque déploiement (audit 07/2026). Vérifie les invariants STATIQUES qui protègent de la page blanche :
//  1. syntaxe valide ; 2. version au format omega-vNNN ; 3. précache CORE = liste blanche de ressources
//  non redirigées ; 4. TOUTE mise en cache passe par la garde anti-redirection (reshape) ;
//  5. l'activation purge les vieux caches.  Lancer : node dictee/sw_probe.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const fail = [];

try { new Function(src); } catch (e) { fail.push('syntaxe sw.js : ' + e.message); }

const v = src.match(/const V\s*=\s*'([^']+)'/);
if (!v || !/^omega-v\d+$/.test(v[1])) fail.push('version V introuvable ou format inattendu (omega-vNNN) : ' + (v && v[1]));

const core = src.match(/const CORE\s*=\s*\[([^\]]*)\]/);
// liste blanche du précache : les petites pages du site + assets. Les LOURDS (app 11 Mo, pendable, scrabidon)
// sont volontairement exclus (cachés à la visite) — les précacher re-téléchargerait ~13 Mo à CHAQUE bump de version.
const WHITELIST = new Set(['./', './index.html', './correcteur.html', './correcteur-outil.html', './dictee.html',
  './omega-key.html', './recherche.html', './evolution.html', './site.css', './manifest.json', './icon.svg']);
if (!core) fail.push('CORE introuvable');
else for (const it of core[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean)) {
  if (!WHITELIST.has(it)) fail.push('CORE contient une entrée hors liste blanche (risque 308 → cache empoisonné) : ' + it);
}

// toute ligne cache.put doit mettre une réponse passée par la garde redirection (reshape/clean/redirected)
for (const line of src.split('\n')) {
  if (line.indexOf('cache.put(') >= 0 && !/reshape|clean|redirected/.test(line)) {
    fail.push('cache.put sans garde anti-redirection : ' + line.trim());
  }
}
if (!/caches\.delete/.test(src)) fail.push("l'activation ne purge pas les anciens caches (caches.delete absent)");
if (!/skipWaiting/.test(src)) fail.push('skipWaiting absent (les clients resteraient sur la vieille version)');

if (fail.length) { console.error('✗ SW KO :\n  ' + fail.join('\n  ')); process.exit(1); }
console.log('✓ sw.js : syntaxe, version ' + v[1] + ', précache liste blanche, garde anti-redirection sur chaque cache.put, purge des vieux caches.');
