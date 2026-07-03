// Verrou CI du moteur PLATEAU de Scrabidon : extrait le bloc pur (DICT_BLOB → tryPlace) de scrabidon.html,
// et vérifie que les MOTS CROISÉS sont balayés sur le BON axe (audit 07/2026 : les branches du sélecteur
// d'axe étaient inversées → le croisé n'était jamais vu/scoré et des coups légaux étaient rejetés).
// Lancer : node dictee/scrabidon_probe.js
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'scrabidon.html'), 'utf8');
const a = html.indexOf('const DICT_BLOB=');
const b = html.indexOf('function rebuildDict');
if (a < 0 || b < 0) { console.error('extraction scrabidon échouée'); process.exit(2); }
const code = html.slice(a, b) + ';globalThis.__S={solveBoard,makeScorers,DICT,N};';
try { (0, eval)(code); } catch (e) { console.error('eval échoué :', e.message); process.exit(2); }
const S = globalThis.__S, N = S.N;
const fail = [];

// plateau : 'A' au centre (7,7)
const board = new Array(N * N).fill(''); const blank = new Array(N * N).fill(false);
board[7 * N + 7] = 'A';

// 1) cross() : 'A' en (7,7), on pose 'S' en (8,7) dans un mot HORIZONTAL (dir=0) → le croisé
//    VERTICAL réel est « AS » (A au-dessus). Avant le fix : balayage même-axe → null.
const h = S.makeScorers(board, blank);
const cw = h.cross(8, 7, 0, 'S');
if (!cw || cw.word !== 'AS') fail.push('cross(8,7,dir=H,S) doit voir le croisé vertical « AS », eu ' + JSON.stringify(cw));

// 2) solveBoard : rack CHTS + 'A' au centre → CHATS (traverse le A) et CHAT doivent être proposés
//    (avant le fix : rejetés, car le faux balayage testait la sous-chaîne interne « AT » au dico).
const moves = S.solveBoard(board, blank, 'CHTS');
const words = new Set(moves.map(m => m.word));
if (!S.DICT.has('CHATS')) fail.push('sanité : CHATS absent du dico embarqué ?');
if (!words.has('CHATS')) fail.push('solveBoard(A central, rack CHTS) doit proposer CHATS');
if (!words.has('CHAT')) fail.push('solveBoard(A central, rack CHTS) doit proposer CHAT');

// 3) pose ADJACENTE-PARALLÈLE (bi-mots) acceptée ET croisé SCORÉ : « OS » horizontal en (8,6)-(8,7),
//    sous le A → mot principal « OS » + croisé vertical « AS » (via le S). Score attendu : O sur (8,6)=DL → 2,
//    S=1 → main 3 ; croisé A(1)+S(1)=2 ; total 5. Avant le fix : pose introuvable (touches jamais via croisé).
const mv2 = S.solveBoard(board, blank, 'OS').filter(m => m.word === 'OS' && m.dir === 0 && m.r === 8 && m.c === 6);
if (!mv2.length) fail.push('pose adjacente-parallèle « OS » en (8,6)H (croisé « AS ») doit être proposée');
else if (mv2[0].score !== 5) fail.push('score « OS »+croisé « AS » attendu 5 (3+2), eu ' + mv2[0].score);

if (fail.length) { console.error('✗ SCRABIDON KO :\n  ' + fail.join('\n  ')); process.exit(1); }
console.log('✓ scrabidon : croisés balayés sur le bon axe (AS vu), CHATS/CHAT proposés (' + moves.length + ' coups), pose bi-mots légale.');
