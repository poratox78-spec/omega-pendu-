'use strict';
// UNE PARTIE JOUÉE = UNE PARTIE COMPTÉE (garde, 27/09/2026).
//
// Rapport de Rem : « depuis notre changement de formation de la grille, les parties sont comptées 2 pour 1 ».
// Mesuré dans la vraie page : une partie jouée par le bouton Start affichait « 2 ». Cause : depuis le 04/07,
// initOmegaGlobals() rebranche lui-même le compteur de fin de partie (ui_attachGameEndSub), et applyReferenceConfig()
// appelle initOmegaGlobals() PUIS le rebranchait encore ; depuis le 24/09 (config optimale au chargement, commit
// « …la grille réorganisée »), c'est le cas dès l'ouverture : 2 abonnés sur OS_game_end, et subscribe() ne
// dédoublonne pas. Touchés : nombre de parties, de victoires, lignes du journal (les pourcentages restaient justes).
// Correctif : le compteur se branche une fois PAR CANAL (la marque vit sur le canal, que chaque init recrée).
//
// La garde rejoue l'ordre du chargement de la page (initOmegaGlobals → ui_init → applyReferenceConfig), puis les
// chemins qui réinitialisent et rebranchent (bouton de config, init + rebranchement), et compte.
//   node evo/compteur_parties_probe.js
const { loadEngine } = require('./fitness_harness.js');

(async () => {
  const O = loadEngine(); await O.loadLex();
  const r = O.evalIn(`(function(){
    _omegaSeed=12345; _omegaRng=makeMulberry32(12345);
    initOmegaGlobals(); ui_init(); applyReferenceConfig();             // l'ordre du chargement de la page
    const abonnes = () => OS.channels.get('OS_game_end').subscribers.length;
    function partie(w){ startNewGame(w); let s=300; while(gameActive && s-->0) omegaStep(); }
    const c0 = _ui_gameCount, a0 = abonnes();
    for (const w of ['CHOCOLAT', 'ORDINATEUR', 'BIBLIOTHEQUE']) partie(w);
    const c1 = _ui_gameCount - c0;
    applyReferenceConfig();                                             // le bouton « config optimale »
    initOmegaGlobals(); ui_attachGameEndSub();                          // la bascule de la voie phon, la remise à zéro
    const a1 = abonnes();
    partie('CHOCOLAT');
    return { a0, c1, a1, c2: _ui_gameCount - c0 };
  })()`);
  const rouges = [];
  if (r.a0 !== 1) rouges.push(`au chargement : ${r.a0} compteurs branchés sur la fin de partie (attendu : 1)`);
  if (r.c1 !== 3) rouges.push(`3 parties jouées, ${r.c1} comptées`);
  if (r.a1 !== 1) rouges.push(`après le bouton de config et une réinitialisation : ${r.a1} compteurs (attendu : 1)`);
  if (r.c2 !== 4) rouges.push(`4 parties jouées au total, ${r.c2} comptées`);
  if (rouges.length) {
    console.log('✗ COMPTEUR DE PARTIES — une partie jouée doit compter une fois :');
    rouges.forEach((x) => console.log('  ' + x));
    process.exit(1);
  }
  console.log('✓ compteur de parties : 1 compteur branché (chargement, bouton de config, réinitialisation), 4 parties jouées = 4 comptées');
})().catch((e) => { console.error('✗ compteur_parties_probe :', e && e.stack || e); process.exit(1); });
