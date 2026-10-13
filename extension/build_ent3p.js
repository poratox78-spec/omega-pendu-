#!/usr/bin/env node
/* LA TABLE DE PHONOLOGIE DES « -ENT » — tirée du MOTEUR, pas écrite à part (13/10/2026, demande de Rem : « les tables doivent
 * correspondre, la phonologie… »).
 *
 * La police de son (g2p) se demande, pour chaque mot en « -ent » : est-ce une 3e personne du pluriel (« -ent » muet : ils mangent)
 * ou un nom / adverbe (« -ent » prononcé : le moment, souvent) ? Avec le moteur chargé, elle lit la table de conjugaison complète
 * (_entVerbe : l'index des lectures + les cases 3e pluriel). Sans le moteur — une page simplement LUE quand le moteur n'est chargé
 * qu'à la demande, ou les pages du site (bouton 🔡) — elle retombait sur une liste de 582 mots.
 *
 * Ce script charge le moteur comme le produit (dys-core + vdc-lex.json), calcule EXACTEMENT l'ensemble des mots en « -ent » que
 * _entVerbe déclarerait verbaux, et l'écrit dans assets/ent-3p.txt.gz (91 174 formes, ~0,2 Mo). La police de son le lit quand le
 * moteur n'est pas là : même réponse, quelques Mo de mémoire au lieu de ~300.
 *   node extension/build_ent3p.js            # régénère l'asset
 *   node extension/build_ent3p.js --check    # l'asset commité == le moteur d'aujourd'hui (sortie 1 sinon)
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const EXT = __dirname, OUT = path.join(EXT, 'assets', 'ent-3p.txt.gz');
global.self = globalThis;                                  // dys-core publie self.__OMEGA_CJ (lu par la police de son)
require(path.join(EXT, 'dys-core.js'));
global.DYSCORE.setLex(JSON.parse(fs.readFileSync(path.join(EXT, 'assets', 'vdc-lex.json'), 'utf8')));
const CJ = self.__OMEGA_CJ, S = new Set();
// ① les cases 3e pluriel de la table (_build3P de la police de son)
for (const l in CJ.c) for (const m in CJ.c[l]) { const f = CJ.c[l][m] && CJ.c[l][m]['3p'];
  for (const x of (Array.isArray(f) ? f : [f])) if (typeof x === 'string' && /ent$/.test(x)) S.add(x); }
// ② l'index des lectures : une lecture « ;3;p » (_entVerbe lit CONJ_F[mot])
for (const k in CJ.f) if (/ent$/.test(k) && String(CJ.f[k]).split('|').some(t => t.endsWith(';3;p'))) S.add(k);
const txt = [...S].sort().join('\n') + '\n';
const gz = zlib.gzipSync(Buffer.from(txt, 'utf8'), { level: 9 });
if (process.argv.includes('--check')) {
  let vieux = null; try { vieux = zlib.gunzipSync(fs.readFileSync(OUT)).toString('utf8'); } catch (e) {}
  if (vieux !== txt) { console.log('✗ ent-3p.txt.gz RASSIS — la police de son lirait une autre table que le moteur. Régénérer : node extension/build_ent3p.js'); process.exit(1); }
  console.log('✓ ent-3p.txt.gz == le moteur (' + S.size + ' formes en « -ent » lues 3e pluriel)'); process.exit(0);
}
fs.writeFileSync(OUT, gz);
console.log('ent-3p.txt.gz : ' + S.size + ' formes, ' + (gz.length / 1024).toFixed(0) + ' Ko');
