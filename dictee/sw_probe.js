// Verrou CI du SERVICE WORKER (invariant hors-ligne) — sw.js n'avait AUCUNE couverture alors qu'il change
// à chaque déploiement (audit 07/2026). Vérifie les invariants STATIQUES qui protègent de la page blanche :
//  1. syntaxe valide ; 2. version au format omega-vNNN ; 3. précache CORE = liste blanche de ressources
//  non redirigées ; 4. TOUTE mise en cache passe par la garde anti-redirection (reshape) ;
//  5. l'activation purge les vieux caches.  Lancer : node dictee/sw_probe.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const fail = [];

try { new Function(src); } catch (e) { fail.push('syntaxe sw.js : ' + e.message); }

// VERSION = numéro + EMPREINTE DU CONTENU (omega-vNNN-xxxxxxxx). Avant, V était un simple numéro « à incrémenter
// à CHAQUE déploiement » : MESURÉ, il n'a pas bougé pendant 70 commits touchant le site (dernier bump 2026-07-05)
// → les clients gardaient un cache figé, seul Ctrl+Shift+R montrait le site réel. Une consigne en commentaire ne
// tient pas ; l'empreinte, si. Si le site change et que V ne suit pas, CE CHECK ÉCHOUE et donne la valeur à poser.
// Régénérer : node dictee/sw_probe.js --fix
// Périmètre = les fichiers PRÉCACHÉS (CORE), pas l'app 11 Mo : c'est là que la péremption mord (ils sont figés au
// moment de l'install et n'en bougent qu'au changement de V). L'app est cachée à la visite et se rafraîchit par
// revalidation (ETag → 304) ; l'inclure ici coupleraît sw.js à CHAQUE injection de lexique — conflit dans toutes
// les PR pour un bump dont l'app n'a pas besoin.
const HASHED = ['index.html', 'correcteur.html', 'correcteur-outil.html', 'dictee.html', 'dictee-outil.html', 'saisie-vocale.html', 'omega-key.html',
                'recherche.html', 'toile.html', 'arbitrage.html', 'evolution.html', 'site.css', 'manifest.json', 'icon.svg'];
// ⚠️ NORMALISER LES FINS DE LIGNE AVANT DE HACHER, sinon l'empreinte dépend de l'OS et la CI diverge du poste :
// le dépôt a des fins de ligne MIXTES en base (index.html/site.css en LF, mais dictee.html/omega-key.html/
// evolution.html en CRLF), et sans .gitattributes un checkout Windows convertit encore. Mesuré : disque Windows
// a599b4ee vs Linux/CI a69a31f5 sur des fichiers pourtant identiques. CRLF→LF des deux côtés ⇒ même empreinte.
const crypto = require('crypto');
const h = crypto.createHash('sha256');
for (const f of HASHED) {
  const p = path.join(__dirname, '..', f);
  if (fs.existsSync(p)) h.update(Buffer.from(fs.readFileSync(p, 'latin1').replace(/\r\n/g, '\n'), 'latin1'));
}
const SITE_HASH = h.digest('hex').slice(0, 8);

const v = src.match(/const V\s*=\s*'([^']+)'/);
if (!v || !/^omega-v\d+(-[0-9a-f]{8})?$/.test(v[1])) {
  fail.push('version V introuvable ou format inattendu (omega-vNNN-xxxxxxxx) : ' + (v && v[1]));
} else if (v[1].split('-')[2] !== SITE_HASH) {                 // absente (ancien format) ou périmée
  const next = 'omega-v' + (parseInt(v[1].match(/v(\d+)/)[1], 10) + 1) + '-' + SITE_HASH;
  if (process.argv.includes('--fix')) {
    fs.writeFileSync(path.join(__dirname, '..', 'sw.js'), src.replace(/const V\s*=\s*'[^']+'/, "const V = '" + next + "'"));
    console.log('✓ sw.js : V régénéré → ' + next + ' (le site avait changé)');
    process.exit(0);
  }
  fail.push('le SITE a changé mais V ne suit pas → les clients garderaient le vieux cache.\n    ' +
            'attendu : ' + next + '   (corriger : node dictee/sw_probe.js --fix)');
}

const core = src.match(/const CORE\s*=\s*\[([^\]]*)\]/);
// liste blanche du précache : les petites pages du site + assets. Les LOURDS (app 11 Mo, pendable, scrabidon)
// sont volontairement exclus (cachés à la visite) — les précacher re-téléchargerait ~13 Mo à CHAQUE bump de version.
const WHITELIST = new Set(['./', './index.html', './correcteur.html', './correcteur-outil.html', './dictee.html', './dictee-outil.html',
  './saisie-vocale.html', './omega-key.html', './recherche.html', './toile.html', './arbitrage.html', './evolution.html', './site.css', './manifest.json', './icon.svg']);
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
