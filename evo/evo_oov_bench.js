'use strict';
// EVO — VÉRITÉ TERRAIN OOV : appelle le bench NATIF du moteur (_omega_trexquant_bench) en headless, même seed/warmup/testN
// que ma sonde, pour savoir ce que vaut RÉELLEMENT l'OOV ici (et caler ma réplication : 52,9 % vs ~64 % attendu ?).
// On redirige _logOut → console pour capter la sortie. Usage : node evo/evo_oov_bench.js
const { loadEngine } = require('./fitness_harness.js');

(async()=>{
  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn;
  ev('_omegaSeed=12345;_omegaRng=makeMulberry32(12345);initOmegaGlobals();');
  ev('globalThis._logOut=function(id,m){ if(m!=null) console.log("  [bench] "+String(m)); };');
  console.log('\n=== VÉRITÉ TERRAIN — bench natif moteur (_omega_trexquant_bench), seed 12345, warmup 250, test 70 ===');
  ev('_omega_trexquant_bench(70,250,12345);');
  console.log('=== fin bench natif ===');
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
