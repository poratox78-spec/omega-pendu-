#!/usr/bin/env node
/* GARDE « asset LIVRÉ mais JAMAIS CHARGÉ » (2026-08-21). Deux fois dans l'histoire du projet un
 * asset présent dans extension/assets/ n'était câblé dans aucune surface (HMM en 07/2026, puis
 * PRÉNOMS : « Marie est venu » corrigé sur le site, MUET dans l'extension — trouvé au banc
 * navigateur réel de Rem, jamais par la CI). Ici : chaque asset doit être RÉFÉRENCÉ par
 * sidepanel.js ET par content.js (les deux surfaces du correcteur), sinon rouge. Statique,
 * zéro dépendance. Les exemptions sont NOMMÉES et justifiées, jamais implicites. */
'use strict';
const fs = require('fs'), path = require('path');
const H = __dirname;
const assets = fs.readdirSync(path.join(H, 'assets')).filter(f => !f.startsWith('.'));
const surfaces = ['sidepanel.js', 'content.js'].map(f => ({ f, src: fs.readFileSync(path.join(H, f), 'utf8') }));
surfaces[0].src += fs.readFileSync(path.join(H, 'son_panel.js'), 'utf8');   // le panneau = sidepanel.js + son_panel.js (police de son, chargée paresseusement par ce dernier)
const OPTIONNELS = new Set(['sens.json.gz']);                                  // chargé à la demande (jeu Double-Sens), pas par le correcteur
surfaces[1].src += fs.readFileSync(path.join(H, 'son_pages.js'), 'utf8');   // ⭐ 13/10/2026 : les scripts de contenu = content.js + son_pages.js (couleurs sur les sites)
const PAR_SURFACE = { 'content.js': new Set(['ponct-lm.json.gz',                  // la ponctuation VOCALE vit dans le panneau (micro), pas dans la bulle de page
  'g2p.js', 'son_core.js', 'OmegaDys-Regular.ttf', 'OmegaDys-Light.ttf', 'OmegaDys-Heavy.ttf']),   // POLICE DE SON : surface PANNEAU seulement (on n'habille jamais un champ de site tiers)
  'sidepanel.js': new Set(['ent-3p.txt.gz']) };   // ⭐ 13/10/2026 : la table des « -ent » sert la police de son SANS moteur (page lue) ; le panneau charge le moteur complet, qui la contient
const echecs = [];
let verifies = 0;
for (const a of assets) {
  if (OPTIONNELS.has(a)) continue;
  for (const s of surfaces) {
    if ((PAR_SURFACE[s.f] || new Set()).has(a)) continue;
    verifies++;
    if (s.src.indexOf('assets/' + a) < 0) echecs.push(a + " n'est pas câblé dans " + s.f);
  }
}
if (echecs.length) { console.error('✗ ASSETS EXTENSION — livrés mais jamais chargés :\n  ' + echecs.join('\n  ')); process.exit(1); }
console.log('✓ assets extension : ' + verifies + ' câblages vérifiés (sidepanel.js + content.js), aucun asset livré-mais-muet.');

/* ⭐ 16/10/2026 — LE G2P SUIT LE MOTEUR. Le speller lit `_DECL2.g2p` (liste n° 36 : le son départage le palier 0) ; une surface qui
 * charge dys-core.js sans assets/g2p.js a une règle MUETTE sans aucun message (« c'est pas branché »). Statique : chaque page HTML
 * (extension + site) qui référence dys-core.js doit référencer g2p.js ; le manifest (scripts de contenu) aussi ; le bake autonome
 * et la CLI (dictee/build_correcteur.js, dictee/correcteur.js) doivent lire assets/g2p.js ; dys-core.js le charge lui-même sous Node. */
const ROOT = path.join(H, '..');
const pages = [].concat(fs.readdirSync(H).filter(f => f.endsWith('.html')).map(f => path.join(H, f)), fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).map(f => path.join(ROOT, f)));
const sans = [];
for (const p of pages) { const s = fs.readFileSync(p, 'utf8'); if (/<script[^>]*dys-core\.js/.test(s) && !/<script[^>]*g2p\.js/.test(s)) sans.push(path.relative(ROOT, p)); }
const man = JSON.parse(fs.readFileSync(path.join(H, 'manifest.json'), 'utf8'));
for (const cs of man.content_scripts || []) if ((cs.js || []).indexOf('dys-core.js') >= 0 && (cs.js || []).indexOf('assets/g2p.js') < 0) sans.push('manifest.json (content_scripts sans assets/g2p.js)');
for (const f of ['build_correcteur.js', 'correcteur.js']) if (fs.readFileSync(path.join(ROOT, 'dictee', f), 'utf8').indexOf('g2p.js') < 0) sans.push('dictee/' + f);
if (fs.readFileSync(path.join(H, 'dys-core.js'), 'utf8').indexOf("'assets','g2p.js'") < 0) sans.push('dys-core.js (chargement Node du g2p)');
if (sans.length) { console.error('✗ G2P NON CÂBLÉ (le speller lit _DECL2.g2p, liste n° 36) :\n  ' + sans.join('\n  ')); process.exit(1); }
console.log('✓ g2p câblé partout où dys-core tourne : ' + pages.length + ' pages lues, manifest, bake, CLI, Node.');
