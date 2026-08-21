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
const PAR_SURFACE = { 'content.js': new Set(['ponct-lm.json.gz',                  // la ponctuation VOCALE vit dans le panneau (micro), pas dans la bulle de page
  'g2p.js', 'son_core.js', 'OmegaDys-Regular.ttf', 'OmegaDys-Light.ttf', 'OmegaDys-Heavy.ttf']) };   // POLICE DE SON : surface PANNEAU seulement (on n'habille jamais un champ de site tiers)
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
