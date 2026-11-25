// ===== OMEGA Dys Word — annotation des mots les plus fréquents (ligne 137, 21/10/2026) =====
// La police « OMEGA Dys Word » marque d'elle-même, dans Word, les lettres MUETTES et une syllabe sur deux : ses règles OpenType
// (GSUB, contexte = le mot entier) remplacent la lettre par une variante marquée. Word applique ces règles mais n'affiche pas les
// couleurs d'une police (essai de Rem) : les marques sont donc dessinées en noir. Ce script calcule, mot par mot, ce que la
// police doit marquer, avec LE MÊME moteur que la police de son du site et de l'extension (g2p de l'app + police/son_core.js).
// Sortie : police/mots_word.json — { "mots": [[mot, codes], ...] } ; un code par lettre : '.' rien, 'm' muette, 's' syllabe
// soulignée (2e, 4e… syllabe), 'b' les deux. Les mots sans aucune marque ne sont pas écrits (aucune règle utile).
//   node police/annoter_mots_word.js [N=20000]
//   node police/annoter_mots_word.js --check     → sort 1 si police/mots_word.json n'est plus celui que le moteur actuel calcule
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const R = path.join(__dirname, '..');
vm.runInThisContext(fs.readFileSync(path.join(R, 'extension', 'assets', 'g2p.js'), 'utf8'));   // définit _DECL2 (g2p du moteur)
const core = require('./son_core.js');
const CHECK = process.argv.includes('--check');
const N = +process.argv.filter((a) => /^\d+$/.test(a))[0] || 20000;
const MOT = /^[a-zàâäéèêëîïôöùûüÿç]{2,}$/;
const lex = zlib.gunzipSync(fs.readFileSync(path.join(R, 'extension', 'assets', 'speller.tsv.gz'))).toString('utf8').split('\n')
  .map((l) => l.split('\t')).filter((p) => p.length >= 2 && MOT.test(p[0])).map((p) => [p[0], +p[1] || 0]);
lex.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
const out = []; let sansMarque = 0;
for (const [w] of lex.slice(0, N)) {
  const segs = core.wordSegments(w, _DECL2.g2p), idx = core.syllableIndex(segs);
  if (segs.map((s) => s.g).join('') !== w) { sansMarque++; continue; }   // garde : le découpage doit redonner le mot
  let codes = '';
  segs.forEach((s, k) => { const mu = s.cls === 'mute', sy = idx[k] % 2 === 1; for (let c = 0; c < s.g.length; c++) codes += mu && sy ? 'b' : mu ? 'm' : sy ? 's' : '.'; });
  if (/^\.+$/.test(codes)) { sansMarque++; continue; }
  out.push([w, codes]);
}
const TEXTE = JSON.stringify({ source: 'speller.tsv.gz, ' + N + ' mots les plus fréquents', mots: out }) + '\n';
if (CHECK) {   // ⭐ 25/11/2026 (liste n° 674) : le g2p avait été corrigé (liste n° 669) et la police Word marquait encore 149 mots avec l'ancien — rien ne comparait
  const livre = fs.readFileSync(path.join(__dirname, 'mots_word.json'), 'utf8').replace(/\r\n/g, '\n');
  if (livre !== TEXTE) { console.log('✗ POLICE WORD PAS FRAÎCHE — police/mots_word.json ne suit plus le moteur de son. Refaire : node police/annoter_mots_word.js && python3 police/build_font_word.py && python3 police/build_pack.py'); process.exit(1); }
  console.log('✓ mots de la police OMEGA Dys Word == le moteur de son actuel (' + out.length + ' mots annotés)'); process.exit(0);
}
fs.writeFileSync(path.join(__dirname, 'mots_word.json'), TEXTE);
console.log('mots annotés : ' + out.length + ' (sans marque ou non découpables : ' + sansMarque + ')');
