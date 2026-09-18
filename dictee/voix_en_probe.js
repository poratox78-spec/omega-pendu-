#!/usr/bin/env node
/* LA SAISIE VOCALE ANGLAISE — garde CI de en/saisie-vocale.html (18/09/2026).
 *
 * MÊMES CONTRAINTES que proso_probe.js (la sonde de la page française), payées là-bas :
 *  ① on EXTRAIT le code du fichier LIVRÉ (équilibrage d'accolades) et on le fait TOURNER — aucune copie de règle ici ;
 *  ② on ne lit aucune constante par regex : on regarde le TEXTE que les fonctions produisent ;
 *  ③ les attendus viennent de SOURCES : les commandes annoncées par la page elle-même, et les mesures sur de l'anglais écrit
 *     par des humains (UD English-PUD, committé : dictee/parity_en_corpus.txt — 1 000 phrases ; GUM + EWT en local, informatif).
 * L'audio est SYNTHÉTIQUE, aux silences CONNUS : on sait exactement ce qui doit sortir.
 * ⚠️ CE QUE CETTE SONDE NE PEUT PAS DIRE : si les seuils de silence (190 / 600 ms) et la montée de hauteur (+4 demi-tons),
 * repris de la page française, conviennent à de l'anglais PARLÉ. Aucune prise anglaise n'existe : à valider au micro.
 *
 *   node dictee/voix_en_probe.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const PAGE = path.join(RACINE, 'en', 'saisie-vocale.html');
const src = fs.readFileSync(PAGE, 'utf8');
const bad = []; let nTests = 0;
const ok = (cond, msg) => { nTests++; if (!cond) bad.push(msg); };

function bloc(entete) {
  const i = src.indexOf(entete); if (i < 0) throw new Error('introuvable dans la livraison : ' + entete);
  let j = src.indexOf('{', i), p = 0;
  for (let k = j; k < src.length; k++) { if (src[k] === '{') p++; else if (src[k] === '}') { p--; if (!p) return src.slice(i, k + 1); } }
  throw new Error('accolades non fermées : ' + entete);
}
function ligneVar(nom) {
  const m = new RegExp('\\bvar\\s+' + nom + '\\s*=').exec(src); if (!m) throw new Error('introuvable dans la livraison : var ' + nom);
  const f = /;[ \t]*(?:\/\/[^\n]*)?\r?\n/.exec(src.slice(m.index));           // le « ; » qui TERMINE la ligne (un commentaire peut le suivre)
  if (!f) throw new Error('fin de déclaration introuvable : var ' + nom);
  return src.slice(m.index, m.index + f.index + 1);
}
const code = [
  bloc('function capitalize('),
  ligneVar('_PERIOD_AVANT'), bloc('function _commandesVocales('),
  ligneVar('_TETE'), ligneVar('_TETE_PRON'), ligneVar('_GOUVERNE'), ligneVar('_SUJET'), bloc('function teteHorsPhrase('),
  ligneVar('_MAJOUTIL'), ligneVar('_NOMPROPRE'), bloc('function normMajInterne('), bloc('function _dedoubleMarques('),
  ligneVar('_Q_AUXW'), ligneVar('_Q1'), ligneVar('_Q2'), bloc('function estQuestion('),
  ligneVar('_PASAPRES'), src.slice(src.indexOf("('the a an this that"), src.indexOf("_PASAPRES[w]=1; });") + "_PASAPRES[w]=1; });".length),
  ligneVar('_CONT'), ligneVar('_CONT_VIRGULE'),
  bloc('function _dedupFinals('), bloc('function _dedupFinalsSur('), bloc('function _dernierMot('),
  bloc('function _seuilSilence('), bloc('function silBetween('), bloc('function riseEndingAt('),
  bloc('function prosodyText('),
].join('\n') + '\nreturn { capitalize, _commandesVocales, teteHorsPhrase, normMajInterne, _dedoubleMarques, estQuestion, _dedupFinals, prosodyText };';
const F = new Function(code)();

/* ── AUDIO SYNTHÉTIQUE : une image toutes les 30 ms ; `pauses` = [{apres, duree, monte}] ; `monte` fait monter la mélodie sur les
   180 ms avant la pause (riseEndingAt compare la queue de sa fenêtre à son corps : une montée plus longue ne se verrait pas). */
function timeline(dureeMs, pauses, monteFin, finParole) {
  const tl = [];
  for (let t = 0; t < dureeMs; t += 30) {
    const mute = pauses.some(p => t >= p.apres && t < p.apres + p.duree) || t >= finParole;
    const monte = pauses.some(p => p.monte && t >= p.apres - 180 && t < p.apres) || (monteFin && t >= finParole - 180 && t < finParole);
    tl.push({ t, r: mute ? 0.001 : 0.05, f: mute ? 0 : (monte ? 190 : 120) });
  }
  return tl;
}
/* Une dictée = des segments [texte, fin de parole en ms] ; la pause suit chaque segment sauf le dernier. */
function dictee(segs, pausesMs, opt) {
  opt = opt || {};
  const finals = {}, ftimes = {}; let t = 0; const pauses = [];
  segs.forEach((s, i) => { t += 1200; finals[i] = s; ftimes[i] = t + 50;
    if (i < segs.length - 1) { pauses.push({ apres: t, duree: pausesMs[i], monte: opt.monte && opt.monte[i] }); t += pausesMs[i]; } });
  return { base: opt.base || '', t0: 0, finals, ftimes, pt: [], tEnd: t, au: opt.sansAudio ? null : { tl: timeline(t + 200, pauses, opt.monteFin, t), maxr: 0.05 } };
}
const P = (segs, pauses, opt) => F.prosodyText(dictee(segs, pauses, opt));

// ── ① COMMANDES DICTÉES : la liste est celle que la page ANNONCE à l'utilisateur ──
const annonce = /Say <b>comma<\/b>[^<]*<b>full stop<\/b> or <b>period<\/b>[\s\S]*?<b>new paragraph<\/b>/.test(src);
ok(annonce, 'la page n\'annonce plus la liste des commandes dictées (comma · full stop or period · … · new paragraph)');
[['hello comma how are you question mark', 'hello, how are you?'],
 ['that is great exclamation mark', 'that is great!'], ['that is great exclamation point', 'that is great!'],
 ['I need three things colon eggs comma milk semicolon bread', 'I need three things: eggs, milk; bread'],
 ['see you tomorrow full stop', 'see you tomorrow.'], ['see you tomorrow period', 'see you tomorrow.'],
 ['first line new line second line', 'first line\nsecond line'], ['end of part one new paragraph part two', 'end of part one\n\npart two'],
 // « period » reste un MOT : déterminant, possessif, qualificatif devant ; of / in / during derrière (2,34 / 10 000 en anglais écrit)
 ['it lasted a period of two years', 'it lasted a period of two years'], ['during the same period we moved', 'during the same period we moved'],
 ['there is a waiting period', 'there is a waiting period'], ['the colonial period in India', 'the colonial period in India'],
 ['it dates from the Qing period', 'it dates from the Qing period'],                                  // nom propre devant : un mot
 ['I am fine period how are you', 'I am fine period how are you'],                                    // en milieu de segment « period » reste un mot (limite assumée : « full stop » est libre partout)
 ['I am fine full stop how are you', 'I am fine. how are you'],
 ['cancer of the colon', 'cancer of the colon'], ['colon cancer is common', 'colon cancer is common'],
].forEach(([e, att]) => ok(F._commandesVocales(e) === att, 'commande : « ' + e + ' » → « ' + F._commandesVocales(e) + ' » (attendu « ' + att + ' »)'));

// ── ② MOT DE TÊTE HORS PHRASE ──
[['however I think it works', 7], ['meanwhile the others left', 9], ['yes he was there', 3], ['hello everyone and welcome', 5], ['okay so this is it', 4],
 ['well I am not sure', 4], ['no I did not say that', 2],
 // … et ce qui GOUVERNE sa suite, ou n'est pas dans la liste (mesuré : so 16 %, then 23 %, now 36 %, thanks 2 %)
 ['however hard he tried', 0], ['ok to book for two', 0], ['hello to everyone', 0], ['again and again it failed', 0], ['well before that he left', 0],
 ['no longer a problem', 0], ['no one came', 0], ['so it is wonderful', 0], ['then the show ends', 0], ['now let me see', 0], ['thanks for the money', 0], ['however', 0],
].forEach(([e, att]) => ok(F.teteHorsPhrase(e) === att, 'mot de tête : « ' + e + ' » → ' + F.teteHorsPhrase(e) + ' (attendu ' + att + ')'));

// ── ③ QUESTION PAR LA TÊTE ──
[['do you know the way', true], ['can I come with you', true], ["isn't it strange", true], ['what is your name', true], ['how do you do that', true],
 ['where are they going', true], ['you know the way', false], ['when I was young we moved', false], ['which was very expensive', false],
 ['what she said is true', false], ['the dog is here', false], ['may the best team win', false],
].forEach(([e, att]) => ok(F.estQuestion(e) === att, 'question : « ' + e + ' » → ' + F.estQuestion(e) + ' (attendu ' + att + ')'));

// ── ④ MAJUSCULES ET MARQUES DOUBLÉES ──
[['i think i\'m late. and you', "I think I'm late. And you"], ['hello\nthis is new', 'Hello\nThis is new']]
  .forEach(([e, att]) => ok(F.capitalize(e) === att, 'capitalize : « ' + e + ' » → « ' + F.capitalize(e) + ' »'));
[['We went home, And then we slept', 'We went home, and then we slept'], ['I saw it In London', 'I saw it In London'],          // « In London » : un mot capitalisé derrière, titre possible
 ['He said That it was fine', 'He said that it was fine'], ['It ended. The day was over', 'It ended. The day was over'], ['Then I left', 'Then I left'],
].forEach(([e, att]) => ok(F.normMajInterne(e) === att, 'majuscule interne : « ' + e + ' » → « ' + F.normMajInterne(e) + ' »'));
[['yes,, I know', 'yes, I know'], ['really,?', 'really?'], ['done,.', 'done.']]
  .forEach(([e, att]) => ok(F._dedoubleMarques(e) === att, 'marques doublées : « ' + e + ' » → « ' + F._dedoubleMarques(e) + ' »'));

// ── ⑤ LA PONCTUATION PAR LES SILENCES, audio synthétique ──
[[['we went to the market', 'we bought some apples'], [300], null, 'We went to the market, we bought some apples.', 'silence 300 ms → virgule'],
 [['we went to the market', 'the weather was nice'], [800], null, 'We went to the market. The weather was nice.', 'silence 800 ms → point + majuscule'],
 [['we went to the market', 'near the river'], [100], null, 'We went to the market near the river.', 'silence 100 ms → rien (plancher 190 ms)'],
 [['we went to the market', 'and we bought apples'], [900], null, 'We went to the market, and we bought apples.', '900 ms mais « and » derrière : la phrase continue → virgule, pas point'],
 [['we went to the', 'market yesterday'], [900], null, 'We went to the market yesterday.', 'jamais de marque après un déterminant, même à 900 ms'],
 [['I want to', 'go home now'], [400], null, 'I want to go home now.', 'jamais de marque après « to »'],
 [['do you know the way', 'I am lost'], [300], null, 'Do you know the way? I am lost.', 'question par la tête → « ? » à la frontière'],
 [['you are coming tonight', 'I need to know'], [700], { monte: [true] }, 'You are coming tonight? I need to know.', 'la hauteur monte avant la pause → « ? »'],
 [['what is your name'], [], null, 'What is your name?', 'question finale par la tête'],
 [['you are coming'], [], { monteFin: true }, 'You are coming?', 'question finale par la montée de hauteur'],
 [['however I think it works', 'we should try'], [800], null, 'However, I think it works. We should try.', 'mot de tête + point'],
 [['hello comma how are you question mark', 'i am fine period'], [700], null, 'Hello, how are you? I am fine.', 'les commandes donnent la certitude, aucune marque doublée'],
 [['first point new line', 'second point'], [700], null, 'First point\nSecond point.', 'new line : pas de marque ni d\'espace parasites'],
 [['we went home', 'but it was late'], [0], { sansAudio: true }, 'We went home, but it was late.', 'sans seconde écoute (téléphone) : seule la virgule devant but/so/because'],
 [['we went home', 'it was late'], [0], { sansAudio: true }, 'We went home it was late.', 'sans seconde écoute : aucune durée connue → on n\'affirme rien'],
 [['and then we left'], [], { base: 'We ate.' }, 'We ate. And then we left.', 'le texte déjà présent est gardé'],
 [['we visited the museum', 'London is a big city'], [300], null, 'We visited the museum, London is a big city.', 'un NOM PROPRE en tête de segment garde sa majuscule après une virgule'],
 [['we went home', 'And then we slept'], [300], null, 'We went home, and then we slept.', 'la majuscule que la reconnaissance colle à un MOT-OUTIL en tête de segment est retirée'],
 [['we went home', 'do you know the way'], [0], { sansAudio: true }, 'We went home. Do you know the way?', 'sans seconde écoute : une question reconnue à sa tête ouvre une phrase → point devant elle'],
 [['we went home', 'what is your name'], [300], null, 'We went home. What is your name?', '300 ms + question derrière → point, pas virgule'],
 [['I asked him', 'what is your name'], [100], null, 'I asked him what is your name.', 'sous 190 ms, même devant une question : rien (pas de pause entendue) — et la phrase entière, jugée à sa tête, reste une affirmation'],
].forEach(([segs, pauses, opt, att, quoi]) => { const r = P(segs, pauses, opt); ok(r === att, 'ponctuation (' + quoi + ') : « ' + String(r).replace(/\n/g, '⏎') + ' » (attendu « ' + att.replace(/\n/g, '⏎') + ' »)'); });

// ── ⑥ FINALS CUMULATIFS D'ANDROID ──
{ const d = F._dedupFinals({ 0: 'we went home', 1: 'we went home it was late', 2: 'it was late' });
  ok(Object.keys(d).length === 2 && d[0] === 'we went home' && d[1] === 'it was late', 'finals cumulatifs : ' + JSON.stringify(d)); }

// ── ⑦ LA PAGE : langue, moteur, et TOUS les actifs du correcteur (un moteur à moitié chargé se tait sans le dire) ──
ok(/rec\.lang\s*=\s*'en-US'/.test(src), 'rec.lang n\'est plus en-US');
ok(/<script src="\.\.\/dictee\/corrector_en\.js"><\/script>/.test(src), 'le moteur anglais n\'est plus chargé');
const corr = fs.readFileSync(path.join(RACINE, 'en', 'correcteur-outil.html'), 'utf8');
const actifs = [...corr.matchAll(/['"](\.\.\/dictee\/[a-z_]+_en[a-z_.]*\.(?:tsv\.gz|json|tsv))['"]/g)].map(m => m[1]);
ok(actifs.length >= 6, 'actifs du correcteur anglais introuvables dans en/correcteur-outil.html (' + actifs.length + ')');
for (const a of new Set(actifs)) ok(src.includes("'" + a + "'"), 'actif du correcteur non demandé par la page vocale : ' + a);
ok(/C\.analyzeText\(/.test(src), 'la page n\'appelle plus le pipeline du produit (C.analyzeText)');
ok(/two things<\/b> listen to your microphone/.test(src) && /neither recorded nor sent/.test(src), 'la note de confidentialité ne décrit plus les DEUX écoutes du micro');

/* ── ⑦ bis APPLIQUER UNE SUGGESTION (18/09/2026) : diagnose + _applique EXTRAITS de la page, avec le vrai moteur. « with out » -> without
   est une marque de DEUX mots (span:2) : la page remplaçait « with » seul et écrivait « without out ». */
{ const CE = require(path.join(__dirname, 'corrector_en.js')), AE = CE.loadAllNode(__dirname);
  const G = new Function('ready', 'C', 'LEX', 'CONFUS', 'BASEMAP', bloc('function diagnose(') + '\n' + bloc('function _applique(') + '\nreturn { diagnose, _applique };')(true, CE, AE.lex, AE.ctx.confus, AE.ctx.basemap);
  const fixAll = (t) => { G.diagnose(t).filter(m => m.red).sort((a, b) => b.d - a.d).forEach(m => { t = G._applique(t, m); }); return t; };
  ok(fixAll('She left with out a word.') === 'She left without a word.', 'Fix all : « with out » -> ' + JSON.stringify(fixAll('She left with out a word.')) + ' (attendu « without », sans « out » orphelin)');
  ok(fixAll('Their is more better news.') === 'There is better news.', 'Fix all : remplacement à la casse du mot + mot en trop retiré avec son espace — ' + JSON.stringify(fixAll('Their is more better news.'))); }

// ── ⑧ MESURES sur de l'anglais ÉCRIT PAR DES HUMAINS (PUD committé ; GUM + EWT en local) ──
function mesure(nom, phrases) {
  let perOrd = 0, perConv = 0, qTir = 0, qJuste = 0, tTir = 0, tVirg = 0; const exP = [], exQ = [];
  for (const t of phrases) {
    const sansPonct = t.replace(/[.?!]+\s*$/, '');
    const nPer = (sansPonct.match(/\bperiod\b/gi) || []).length;                 // la phrase entière joue le rôle d'un segment
    if (nPer) { perOrd += nPer; const reste = (F._commandesVocales(sansPonct).match(/\bperiod\b/gi) || []).length;
      if (reste < nPer) { perConv += nPer - reste; if (exP.length < 6) exP.push(sansPonct.slice(-60)); } }
    const nu = t.replace(/^["“‘'(]+/, '');
    if (F.estQuestion(nu)) { qTir++; if (/\?["”’')]*\s*$/.test(t)) qJuste++; else if (exQ.length < 5) exQ.push(t.slice(0, 60)); }
    const n = F.teteHorsPhrase(nu.replace(/,/, ' ')); if (n && /^[A-Za-z]+,?\s/.test(nu)) { tTir++; if (nu.charAt(n) === ',') tVirg++; }
  }
  console.log('  %s (%d phrases) : « period » mot ordinaire %d, converti à tort %d%s · question par la tête %d tirs, %d justes (%s %%) · mot de tête %d tirs, %d avec virgule dans le texte',
    nom, phrases.length, perOrd, perConv, exP.length ? ' [' + exP.join(' ‖ ') + ']' : '', qTir, qJuste, qTir ? (100 * qJuste / qTir).toFixed(0) : '–', tTir, tVirg);
  if (exQ.length) console.log('      tirs « question » sans « ? » : ' + exQ.join(' ‖ '));
  return { perOrd, perConv, qTir, qJuste };
}
console.log('SAISIE VOCALE ANGLAISE — fonctions extraites de en/saisie-vocale.html\n');
const pud = fs.readFileSync(path.join(__dirname, 'parity_en_corpus.txt'), 'utf8').split('\n').filter(l => l.trim() && l[0] !== '#');
ok(pud.length >= 900, 'corpus PUD committé tronqué : ' + pud.length + ' phrases');
const mP = mesure('PUD committé', pud);
ok(mP.perConv === 0, '« period » mot ordinaire converti en point sur PUD : ' + mP.perConv + ' fois');
ok(mP.qTir === 0 || mP.qJuste / mP.qTir >= 0.8, 'question par la tête : précision ' + mP.qJuste + '/' + mP.qTir + ' < 80 % sur PUD');
const loc = [];
for (const f of ['en/en_gum-ud-train.conllu', 'en/en_gum-ud-dev.conllu', 'en/en_gum-ud-test.conllu', 'en_ewt-ud-train.conllu']) {
  const p = path.join(RACINE, 'data_local', f); if (fs.existsSync(p)) for (const l of fs.readFileSync(p, 'utf8').split('\n')) if (l.startsWith('# text = ')) loc.push(l.slice(9).trim()); }
if (loc.length) mesure('GUM + EWT (local, informatif)', loc);

console.log('');
bad.forEach(b => console.log('  ✗ ' + b));
console.log(bad.length ? '✗ saisie vocale anglaise : ' + bad.length + ' défaut(s) sur ' + nTests + ' contrôles'
  : '✓ saisie vocale anglaise : ' + nTests + ' contrôles — commandes, mot de tête, question, majuscules, ponctuation par silences (audio synthétique), finals Android, actifs du correcteur, promesse de la page');
process.exit(bad.length ? 1 : 0);
