'use strict';
// GARDE — le bouton 🎯 Trexquant (hors lexique) allume le n-gram de NEO et le rend en s'éteignant (Rem, 19/10/2026).
//
// Mesuré (10 graines × 350 mots inconnus, appariés, placebo +0,1 pt) : préréglage 21,5 % → + n-gram arbitré 56,1 % →
// + gap-aware 57,4 % ; dans le lexique ils n'apportent rien (−0,1 / −0,3) et restent OFF dans le préréglage de base.
//   ① le préréglage : Trexquant et n-grams OFF ;
//   ② le VRAI gestionnaire du bouton (ui_toggle) : Trexquant ON → n-gram arbitré + gap-aware ON ; OFF → rendus OFF ;
//   ③ un n-gram allumé à la main AVANT reste allumé après l'aller-retour (état d'avant rendu, pas écrasé) ;
//   ④ le préréglage pendant Trexquant remet tout à OFF et oublie l'état d'avant ;
//   ⑤ en jeu, mode Trexquant (le mot tiré retiré du lexique, comme ui_startGame) : le bouton gagne nettement plus de mots
//      hors lexique que le même mode sans n-gram — sinon la synchro ne servirait à rien ;
//   ⑥ auto-falsification : sans l'appel dans ui_toggle (gestionnaire d'origine rejoué), ② doit échouer.
//     node evo/trexquant_ngram_probe.js
const { loadEngine } = require('./fitness_harness.js');
const KO = []; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) KO.push(m); };
(async () => {
  const O = loadEngine(); await O.loadLex(); const ev = O.evalIn;
  ev('_omegaSeed=12345;_omegaRng=makeMulberry32(12345);applyReferenceConfig();');
  const etat = () => ev('({t:M_TREXQUANT_MODE_ENABLED,a:M_NEO_OS_ARB_NGRAM,g:M_NEO_NGRAM_GAP})');
  ev('globalThis.__bouton={dataset:{toggle:"M_TREXQUANT_MODE_ENABLED"},classList:{add(){},remove(){},toggle(){}},setAttribute(){}};');
  const clic = () => ev('ui_toggle(__bouton)');
  let e = etat(); ok(!e.t && !e.a && !e.g, `① préréglage : Trexquant ${e.t}, n-gram arbitré ${e.a}, gap-aware ${e.g} (tous OFF attendus)`);
  clic(); e = etat(); ok(e.t && e.a && e.g, `② Trexquant ON → n-gram arbitré ${e.a}, gap-aware ${e.g}`);
  clic(); e = etat(); ok(!e.t && !e.a && !e.g, `② Trexquant OFF → n-gram arbitré ${e.a}, gap-aware ${e.g} (rendus OFF)`);
  ev('M_NEO_OS_ARB_NGRAM=true;'); clic(); clic(); e = etat();
  ok(!e.t && e.a && !e.g, `③ n-gram arbitré allumé à la main avant : après l'aller-retour ${e.a} (gardé), gap-aware ${e.g}`);
  ev('M_NEO_OS_ARB_NGRAM=false;'); clic(); ev('applyReferenceConfig();'); e = etat();
  ok(!e.t && !e.a && !e.g && ev('_trexqNgramAvant') == null, `④ préréglage pendant Trexquant : tout OFF, état d'avant oublié`);
  clic(); clic(); e = etat(); ok(!e.t && !e.a && !e.g, '④ puis un aller-retour du bouton : tout OFF');

  // ⑤ en jeu : mêmes mots, mode Trexquant, avec le bouton (n-gram) contre sans
  const W = ev('OMEGA_LEX4').words, mots = [];
  for (let i = 0; i < W.length && mots.length < 60; i += 1999) { const m = W[i] && W[i].m; if (m && m.length >= 7 && m.length <= 12 && /^[A-Z]+$/.test(m)) mots.push(m); }
  ev('globalThis.__jouer=function(w){_trexq_restore();_trexq_removeWord(w);startNewGame(w);var sf=300;while(gameActive&&sf-->0)omegaStep();var g=!!lastGameWon;_trexq_restore();return g;};');
  const partie = (avecBouton) => { ev('_omegaSeed=12345;_omegaRng=makeMulberry32(12345);applyReferenceConfig();');
    if (avecBouton) clic(); else ev('M_TREXQUANT_MODE_ENABLED=true;');
    let g = 0; for (const w of mots) g += global.__jouer(w) ? 1 : 0; ev('applyReferenceConfig();'); return g; };
  const sans = partie(false), avec = partie(true);
  ok(avec >= sans + mots.length * 0.15, `⑤ hors lexique, ${mots.length} mots : bouton Trexquant ${avec} gagnés, même mode sans n-gram ${sans} (au moins +15 pt attendus)`);

  // ⑥ auto-falsification : le gestionnaire SANS l'appel de synchro ne doit pas allumer le n-gram
  const src = ev('ui_toggle.toString()'), A = '    _trexqSyncNgram(newValue);\n';
  ok(src.split(A).length === 2, '⑥ ui_toggle appelle _trexqSyncNgram (une fois)');
  ev('globalThis.__uiT=ui_toggle; ui_toggle = ' + src.replace(A, '') + ';');
  ev('applyReferenceConfig();'); clic(); e = etat(); ev('ui_toggle=__uiT; applyReferenceConfig();');
  ok(e.t && !e.a && !e.g, `⑥ sans l'appel, Trexquant ON laisse le n-gram ${e.a ? 'ALLUMÉ (la garde ne verrait rien)' : 'éteint'} — la garde ② sait échouer`);
  if (KO.length) { console.error('[trexquant_ngram_probe] ÉCHEC : ' + KO.length + ' contrôle(s)'); process.exit(1); }
  console.log('[trexquant_ngram_probe] OK — le bouton Trexquant allume le n-gram de NEO et le rend en s\'éteignant');
})().catch((e) => { console.error(e); process.exit(1); });
