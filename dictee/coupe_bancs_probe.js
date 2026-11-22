// ===== GARDE « aucun banc ne coupe le moteur de l'app avant ce que ses règles lisent » (liste n° 597, audit du 22/11/2026) =====
// Les bancs Node de l'app n'exécutent pas la page : ils extraient l'IIFE du correcteur du monolithe (app/omega-pendu.html) et la
// referment eux-mêmes. Beaucoup la tranchent à un repère de texte (« return out;} » après une ancre : spellText, osProbe…). Le
// harnais de parité, lui, s'arrêtait au premier « return out;} » après correctText : 2 083 lignes avant la fin du moteur. Une règle
// placée avant la coupe appelait une fonction définie après (l'accord de l'adjectif en genre) : le banc plantait sur la première
// phrase qui l'atteignait, et toute lecture gardée par `typeof` rendait autre chose que la vraie page. Aucun contrôle ne le disait.
//
// Ce que vérifie la garde, pour chaque fichier de dictee/ et d'extension/ qui tranche le monolithe :
//   · s'il prend l'IIFE entière (jusqu'à « })(); » avant la fin du script) : rien à craindre ;
//   · sinon, pour chaque ancre de coupe : l'ancre et son « return out;} » existent, et aucune FONCTION ni TABLE du moteur définie
//     après la coupe n'est lue avant elle — hors de la liste AFFICHAGE ci-dessous (interface : conseils, complétion, profil), que
//     les règles et le dictionnaire n'atteignent pas.
// Un banc qui coupe trop tôt, ou une règle neuve qui appelle une fonction placée après une coupe, fait échouer la garde.
//   node dictee/coupe_bancs_probe.js            (sortie 1 si un banc coupe avant ce qu'il lit)
//   node dictee/coupe_bancs_probe.js --banc F   (ajoute un fichier à contrôler : pour falsifier la garde)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8');
const start = html.indexOf('(function(){', html.indexOf('mode PHRASES'));
const fin = html.lastIndexOf('})();', html.indexOf('</script>', start));
if (start < 0 || fin < start) { console.error('✗ IIFE du correcteur introuvable dans app/omega-pendu.html'); process.exit(1); }
const ligne = (p) => html.slice(0, p).split('\n').length;

// Interface seulement : définis en fin de moteur, lus par les conseils et la complétion, jamais par une règle ni par le dictionnaire.
const AFFICHAGE = { __proto__: null, _tokPos: 1, _suggVerbNum: 1, _erHint: 1, _ctxHint: 1, runComplete: 1, runCorr: 1, DysProfile: 1, _TORIG: 1, _CARD_PL: 1 };

const esc = (n) => n.replace(/[$]/g, '\\$');
function manquants(cut) {
  const avant = html.slice(start, cut), apres = html.slice(cut, fin);
  const noms = new Set(); let m;
  const rf = /(?:^|\n)\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g; while ((m = rf.exec(apres))) noms.add('f:' + m[1]);
  const rv = /(?:^|\n) {2}var\s+([A-Za-z_$][\w$]*)\s*=/g; while ((m = rv.exec(apres))) noms.add('v:' + m[1]);
  const dejaF = new Set(); const rd = /(?:^|\n)\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g; while ((m = rd.exec(avant))) dejaF.add(m[1]);
  const out = [];
  for (const k of noms) {
    const n = k.slice(2); if (n.length < 4 || AFFICHAGE[n] || dejaF.has(n)) continue;
    const re = k[0] === 'f' ? new RegExp('(?<![\\w$.])' + esc(n) + '\\s*\\(') : new RegExp('(?<![\\w$.\'"])' + esc(n) + '(?![\\w$])');
    if (re.test(avant)) out.push(n);
  }
  return out;
}

const fichiers = [];
for (const d of ['dictee', 'extension']) for (const f of fs.readdirSync(path.join(ROOT, d)).sort()) if (f.endsWith('.js') && f !== path.basename(__filename)) fichiers.push(path.join(d, f));
const ib = process.argv.indexOf('--banc'); if (ib >= 0) fichiers.push(process.argv[ib + 1]);
const bad = []; let entiers = 0, tranches = 0;
for (const f of fichiers) {
  const p = path.isAbsolute(f) ? f : path.join(ROOT, f);
  const src = fs.readFileSync(p, 'utf8');
  if (src.indexOf('mode PHRASES') < 0) continue;                              // ne tranche pas le monolithe
  const ancres = {}; let m;
  const ra = /(\w+)\s*=\s*\w+\.indexOf\('(function [A-Za-z_$][\w$]*)',\s*start\)/g; while ((m = ra.exec(src))) ancres[m[1]] = m[2];
  const coupes = []; const rc = /indexOf\('return out;\}',\s*(\w+)\)/g; while ((m = rc.exec(src))) if (ancres[m[1]]) coupes.push(ancres[m[1]]);
  if (!coupes.length) { if (src.indexOf("lastIndexOf('})();'") >= 0) entiers++; continue; }
  tranches++;
  for (const a of coupes) {
    const i = html.indexOf(a, start), c = i < 0 ? -1 : html.indexOf('return out;}', i);
    if (i < 0 || c < 0 || c > fin) { bad.push(`${f} : repère introuvable dans le monolithe (« ${a} » ou son « return out;} »)`); continue; }
    const mq = manquants(c + 'return out;}'.length);
    if (mq.length) bad.push(`${f} : coupe à la ligne ${ligne(c)} (après « ${a} »), AVANT ${mq.length} nom(s) que le moteur lit : ${mq.slice(0, 12).join(', ')}`);
  }
}
if (bad.length) { console.error('✗ bancs qui coupent le moteur de l\'app trop tôt :\n    ' + bad.join('\n    ') + '\n  → prendre l\'IIFE entière (lastIndexOf(\'})();\') avant </script>), comme dictee/parity_corr.js'); process.exit(1); }
console.log(`✓ bancs de l'app : ${entiers} prennent le moteur entier, ${tranches} le tranchent après tout ce que règles et dictionnaire lisent (moteur : lignes ${ligne(start)} à ${ligne(fin)})`);
