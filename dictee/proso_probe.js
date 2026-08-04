// proso_probe.js — LA PONCTUATION PROSODIQUE, sur le code LIVRÉ des DEUX surfaces vocales.
//
// POURQUOI CE FICHIER EXISTE (2026-08-04). Rem, en usage réel : « ça fait des choses étranges…
// les formes interrogatives, la règle de virgule… ça marchait mieux avant ». Rien n'avait été
// supprimé : ce qu'on avait pris de la VOIE B (dictee/asr_voix.py) avait été transcrit
// INFIDÈLEMENT. Quatre écarts, tous poussant dans le même sens (trop de points, aux mauvais
// endroits, donc de faux « ? ») :
//
//   ① SEUIL DU POINT : 600 ms au lieu de PERIOD_MS=750. Le commentaire de la voie B dit pourquoi
//     750 : « au-dessus de 750 pour ne PAS couper sur une respiration intra-phrase ~500 ms qui
//     ferait un faux "?" ». À 600 il ne restait que 100 ms de marge.
//   ② PLANCHER DE LA VIRGULE : COMMA_MS=190 n'avait pas été repris. Sans lui, TOUTE frontière de
//     segment recevait une marque, même une micro-hésitation.
//   ③ FENÊTRE DE MESURE : silBetween prend le MAXIMUM d'une fenêtre qui allait jusqu'à la FIN du
//     segment suivant — elle pouvait donc renvoyer la pause qui TERMINE ce segment. Toujours par
//     excès. -> silAfter : la PREMIÈRE plage de silence, celle qui sépare vraiment les deux.
//   ④ GRAIN : la voie B posait les virgules ENTRE LES MOTS ; la voie A ne marquait qu'entre les
//     segments de Google, donc JAMAIS à l'intérieur d'une phrase. Le signal était pourtant déjà
//     là (`au.tl`, une mesure toutes les 30 ms) — il manquait l'ALIGNEMENT, que les interims
//     donnent. La double captation du micro n'était pas le problème : c'était la ressource
//     qu'on payait sans s'en servir.
//
// + typographie : « ? » prend une ESPACE AVANT en français ; on sortait « Tu viens? » (règle
//   anglaise). Espace normale et non insécable fine : la destination est un chat.
//
// LE BANC. Timeline audio SYNTHÉTIQUE aux silences CONNUS -> on sait ce qui DOIT sortir. Les
// fonctions sont EXTRAITES des fichiers livrés (pas recopiées : un banc qui ré-implémente la règle
// ne teste pas la livraison — leçon déjà payée deux fois le même jour).
//
//   node dictee/proso_probe.js            (les deux surfaces)
//   node dictee/proso_probe.js --check    (garde CI)
const fs = require('fs');
const CIBLE = process.argv.includes('ext') ? 'ext' : 'site';
const path = require('path'), R = path.join(__dirname, '..');
const SRC = CIBLE === 'ext' ? path.join(R,'extension','sidepanel.js') : path.join(R,'saisie-vocale.html');
const P = fs.readFileSync(SRC,'utf8');
console.log('== ' + (CIBLE==='ext' ? 'EXTENSION (sidepanel.js)' : 'SITE (saisie-vocale.html)') + ' ==');
function fonc(nom){ const i=P.indexOf('function '+nom+'('); const j=P.indexOf('{',i); let d=0;
  for(let k=j;k<P.length;k++){ if(P[k]==='{')d++; else if(P[k]==='}'){ d--; if(!d) return P.slice(i,k+1); } } }
const src = [CIBLE==='ext'?'capV':'capitalize','silBetween','silAfter','virgulesInternes','prosodyText'].map(fonc).join(String.fromCharCode(10));
const M = new Function('riseEndingAt', src +
  '\nreturn {prosodyText:prosodyText, silAfter:silAfter, virgulesInternes:virgulesInternes};')(()=>0);

// timeline : parole (r=0.5) sauf pendant les silences déclarés [début,fin] en ms
function tl(dur, silences){
  const a=[]; for(let t=0;t<dur;t+=30){
    const mute = silences.some(([x,y])=>t>=x&&t<y);
    a.push({t, r: mute?0.001:0.5, f:0});
  } return a;
}
const AU = s => ({tl: tl(s.dur, s.sil), maxr: 0.5});
let ok=0, tot=0;
function cas(nom, state, attendu){
  tot++; const got = M.prosodyText(state);
  const bon = got === attendu; if(bon) ok++;
  console.log('  '+(bon?'✓':'✗')+' '+nom);
  console.log('        obtenu  : ' + JSON.stringify(got));
  if(!bon) console.log('        attendu : ' + JSON.stringify(attendu));
}

console.log('── SEUILS (voie B : virgule 190, point 750) ──');
// une pause de 300 ms entre deux segments -> VIRGULE (>=190, <750)
cas('pause 300 ms entre segments -> virgule',
 {base:'', finals:{0:'je viens demain',1:'on se voit'}, ftimes:{0:1000,1:2500}, wtimes:{},
  au:AU({dur:4000, sil:[[1000,1300]]})},
 'Je viens demain, on se voit.');
// une pause de 900 ms -> POINT
cas('pause 900 ms entre segments -> point',
 {base:'', finals:{0:'je viens demain',1:'on se voit'}, ftimes:{0:1000,1:2500}, wtimes:{},
  au:AU({dur:4000, sil:[[1000,1900]]})},
 'Je viens demain. On se voit.');
// une pause de 120 ms -> RIEN (plancher 190 de la voie B)
cas('pause 120 ms -> aucune marque (plancher 190)',
 {base:'', finals:{0:'je viens',1:'demain matin'}, ftimes:{0:1000,1:2500}, wtimes:{},
  au:AU({dur:4000, sil:[[1000,1120]]})},
 'Je viens demain matin.');
// ⭐ la respiration de 620 ms : coupait la phrase AVANT (seuil 600), plus maintenant
cas('respiration 620 ms -> virgule, PAS un point (c\'était le bug)',
 {base:'', finals:{0:'je pense que ça marche',1:'on verra bien'}, ftimes:{0:1000,1:3000}, wtimes:{},
  au:AU({dur:5000, sil:[[1000,1620]]})},
 'Je pense que ça marche, on verra bien.');

console.log('\n── GRAIN MOT (virgules DANS le segment, comme la voie B) ──');
cas('silence de 400 ms entre deux mots -> virgule interne',
 {base:'', finals:{0:'alors voilà je pars demain'}, ftimes:{0:3000},
  wtimes:{0:[100, 500, 900, 1300, 1700]},          // « alors voilà je pars demain »
  au:AU({dur:4000, sil:[[500,900]]})},              // silence 400 ms entre « voilà » et « je »
 'Alors voilà, je pars demain.');
cas('aucun silence interne -> aucune virgule',
 {base:'', finals:{0:'je pars demain matin tôt'}, ftimes:{0:3000},
  wtimes:{0:[100, 400, 700, 1000, 1300]},
  au:AU({dur:4000, sil:[]})},
 'Je pars demain matin tôt.');
cas('interims en RAFALE (mots datés à la même ms) -> on s\'abstient',
 {base:'', finals:{0:'je pars demain matin tôt'}, ftimes:{0:3000},
  wtimes:{0:[100, 100, 100, 100, 100]},
  au:AU({dur:4000, sil:[[200,900]]})},
 'Je pars demain matin tôt.');

console.log('');
console.log('-- TYPOGRAPHIE FRANCAISE : espace AVANT le « ? » --');
cas('question par cue lexical', {base:'', finals:{0:'est-ce que tu viens'}, ftimes:{0:2000}, wtimes:{},
  au:AU({dur:3000, sil:[]})}, 'Est-ce que tu viens ?');
cas('question en MILIEU + suite', {base:'', finals:{0:'pourquoi tu pars',1:'je ne sais pas'},
  ftimes:{0:1000,1:3000}, wtimes:{}, au:AU({dur:4000, sil:[[1000,1900]]})},
  'Pourquoi tu pars ? Je ne sais pas.');
cas('affirmation : point COLLE', {base:'', finals:{0:'je pars demain'}, ftimes:{0:2000},
  wtimes:{}, au:AU({dur:3000, sil:[]})}, 'Je pars demain.');

console.log('');
console.log('-- DETECTION DE QUESTION : les pieges MESURES (48 653 phrases + 12 345 fragments) --');
// L'ancienne règle (« un mot interrogatif en tête ») marquait 145 phrases dont 79 FAUSSES = 45,5 %
// de précision. La nouvelle est mesurée à 100 % (0 faux). Ces cas sont les familles de faux
// positifs qu'elle éliminait — ils restent ici pour qu'on ne les réintroduise pas.
const SIL = {dur:3000, sil:[]};
cas('« quand » SUBORDONNANT, pas interrogatif',
 {base:'', finals:{0:'quand ils reviennent, ils tentent d\'enseigner'}, ftimes:{0:2000}, wtimes:{}, au:AU(SIL)},
 "Quand ils reviennent, ils tentent d'enseigner.");
cas('« quelle » EXCLAMATIF, pas interrogatif',
 {base:'', finals:{0:'quelle jolie décoration'}, ftimes:{0:2000}, wtimes:{}, au:AU(SIL)},
 'Quelle jolie décoration.');
cas('« où » RELATIF (un segment peut débuter en milieu de phrase)',
 {base:'', finals:{0:'où v est la vitesse du point'}, ftimes:{0:2000}, wtimes:{}, au:AU(SIL)},
 'Où v est la vitesse du point.');
cas('« où » + INVERSION = vraie question',
 {base:'', finals:{0:'où en sommes-nous'}, ftimes:{0:2000}, wtimes:{}, au:AU(SIL)},
 'Où en sommes-nous ?');
cas('« est-ce que » = vraie question',
 {base:'', finals:{0:'est-ce que tu viens ce soir'}, ftimes:{0:2000}, wtimes:{}, au:AU(SIL)},
 'Est-ce que tu viens ce soir ?');
cas('phrase LONGUE en « comment » : on s\'abstient (>12 mots)',
 {base:'', finals:{0:'comment réussir en amour sans se fatiguer est un film américain de 1967'},
  ftimes:{0:2000}, wtimes:{}, au:AU(SIL)},
 'Comment réussir en amour sans se fatiguer est un film américain de 1967.');

console.log('');
console.log('-- LE MOTEUR A DEJA PONCTUE (trouve par l\'audit, pas par un test qui passait) --');
// `unspokenPunctuation` vaut false (mesuré) : le moteur n'invente pas de ponctuation, mais il
// transcrit celle qu'on DIT (« virgule », « point ») et rend parfois un « ? ». Notre couche décide
// la ponctuation elle-même -> on retire celle du moteur en FIN de segment, sinon on sortait
// « je viens demain.. » et « ça va ?. ». Et on ne double pas une virgule déjà posée à l'intérieur.
cas('ponctuation du moteur en fin de segment', {base:'', finals:{0:'bonjour ça va ?',1:'je viens demain.'},
  ftimes:{0:1000,1:3000}, wtimes:{}, au:AU({dur:4000, sil:[[1000,1300]]})},
  'Bonjour ça va, je viens demain.');
cas('virgule déjà posée par le moteur -> pas de doublon', {base:'', finals:{0:'alors voilà, je pars demain'},
  ftimes:{0:3000}, wtimes:{0:[100,500,900,1300,1700]}, au:AU({dur:4000, sil:[[500,900]]})},
  'Alors voilà, je pars demain.');

// ── FIDÉLITÉ AUX CONSTANTES DE LA VOIE B ──
// ⚠️ TROIS FOIS dans la même journée une sonde a crié sur SA PROPRE DOCUMENTATION : les commentaires
// citent les valeurs (« COMMA_MS, PERIOD_MS = 190, 750 ») et la regex les attrapait avant le vrai
// code. On DÉPOUILLE donc les commentaires avant de lire une valeur. Règle générale : vérifier par
// le COMPORTEMENT quand c'est possible (tous les cas ci-dessus), et sinon lire du code SANS
// commentaires — jamais une regex naïve sur un fichier qui se raconte lui-même.
(function () {
  const sansCom = s => s.replace(new RegExp('//[^\\n]*', 'g'), '');
  const nu = sansCom(P);
  const vb = fs.readFileSync(path.join(R, 'dictee', 'asr_voix.py'), 'utf8')
               .replace(new RegExp('#[^\\n]*', 'g'), '');
  const ref = vb.match(/COMMA_MS,\s*PERIOD_MS\s*=\s*(\d+),\s*(\d+)/);
  const got = [(nu.match(/COMMA_MS\s*=\s*(\d+)/) || [])[1],
               (nu.match(/PERIOD_MS\s*=\s*(\d+)/) || [])[1]];
  console.log('');
  console.log('-- FIDELITE VOIE B (dictee/asr_voix.py, source des seuils) --');
  const bon = !!ref && got[0] === ref[1] && got[1] === ref[2];
  tot++; if (bon) ok++;
  console.log('  ' + (bon ? '✓' : '✗') + " seuils repris à l'identique    voie B = " +
    (ref ? ref[1] + '/' + ref[2] : '?') + '    ici = ' + got[0] + '/' + got[1]);
})();

console.log('\n  ' + ok + '/' + tot + (ok===tot?'  ✅':'  ❌'));

if (!process.argv.includes('ext')) {           // la 1re passe relance la 2e : une seule commande
  const r = require('child_process').spawnSync(process.execPath,
    [__filename, 'ext'].concat(process.argv.includes('--check') ? ['--check'] : []),
    { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  const ko = (ok !== tot) || r.status !== 0;
  console.log(ko ? '❌ ponctuation prosodique : site et/ou extension en échec'
                 : '✅ ponctuation prosodique : site ≡ extension, ' + tot + ' cas chacun');
  if (ko && process.argv.includes('--check')) process.exit(1);
  process.exit(0);
}
process.exit(ok === tot ? 0 : 1);
