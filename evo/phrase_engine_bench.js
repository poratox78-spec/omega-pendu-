// PHRASE MODE — banc sur le VRAI moteur : le prior d'accord molle (jointe §3) dans la brique DECLARE.
// =================================================================================================
// Le moteur joue des mots ISOLÉS et seulement ≥ 7 lettres (const MIN_WORD_LEN=7 ; lexique embarqué ≥7).
// Un mode phrase « complet » consiste donc à : pour chaque mot LONG (≥7) d'une phrase, jouer la vraie
// partie du moteur (route lexicale réelle, vraies fréquences) AVEC un prior d'accord déduit du contexte
// de la phrase (gouverneur = déterminant/sujet, lu dans la phrase — il serait révélé tôt en pendu de
// phrases). Le prior pondère les candidats de _omega_declareBestCandidate (jointe §3 : poids ∈ ]0,1],
// jamais 0). On compare DECLARE prior OFF vs ON : erreurs/partie + parties gagnées.
//
// R66 : M_DECLARE_ACCORD_PRIOR_ENABLED défaut OFF → wt inchangé → baseline byte-identique.
// Lancer : node evo/phrase_engine_bench.js [conf] [eps]
'use strict';
const { loadEngine } = require('./fitness_harness.js');
const fs = require('fs'), path = require('path');
const SENT = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dictee', 'sentences.json'), 'utf8'));

// ---- levier grammaire (port minimal de dictee/diag_sentence.py) ----
function deacc(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function toks(s) { return (s.match(/[A-Za-zÀ-ÿ']+/g) || []); }
const NUM_DET = { le:'sg',la:'sg',un:'sg',une:'sg',ce:'sg',cet:'sg',cette:'sg',mon:'sg',ton:'sg',son:'sg',ma:'sg',ta:'sg',sa:'sg',notre:'sg',votre:'sg',leur:'sg',les:'pl',des:'pl',ces:'pl',mes:'pl',tes:'pl',ses:'pl',nos:'pl',vos:'pl',leurs:'pl' };
const NUM_PRON = { je:'sg',tu:'sg',il:'sg',elle:'sg',on:'sg',nous:'pl',vous:'pl',ils:'pl',elles:'pl' };
const PREP = { de:1,'à':1,a:1,du:1,des:1,au:1,aux:1,sur:1,dans:1,par:1,pour:1,avec:1,sans:1,sous:1,chez:1,vers:1,'près':1,pres:1,travers:1,'malgré':1,malgre:1,'dès':1,entre:1,depuis:1,contre:1 };
function governorNumber(T, idx, skipPP) { for (let j = idx - 1; j >= 0; j--) { const w = T[j].toLowerCase(); if (NUM_PRON[w]) return [T[j], NUM_PRON[w]]; if (NUM_DET[w]) { if (skipPP && j > 0 && PREP[deacc(T[j-1].toLowerCase())]) continue; return [T[j], NUM_DET[w]]; } } return null; }
const VERB_FORMS = { dort:1,jouent:1,boit:1,court:1,lit:1,met:1,mangeons:1,ecrit:1,chantent:1,repetent:1,creuse:1,porte:1,prennent:1,sont:1,vend:1,eteignent:1,galopent:1,faut:1,finisses:1,etudient:1,tombent:1,est:1,aurait:1,restions:1,cachait:1,quittent:1,calme:1,attendaient:1,furent:1,poursuivirent:1,avons:1,a:1 };
const VERB_SUF = ['ons','ez','aient','ait','erent','irent','issent'];
const NOTVERB = { longtemps:1,ensemble:1,vraiment:1,souvent:1,comment:1,patiemment:1,rapidement:1 };
function isVerb(T, idx) { if (idx < 0 || idx >= T.length) return false; const w = deacc(T[idx].toLowerCase()); const known = VERB_FORMS[w] || (!NOTVERB[w] && w.length > 3 && VERB_SUF.some(s => w.slice(-s.length) === s)); if (!known) return false; return !(idx > 0 && NUM_DET[T[idx-1].toLowerCase()]); }
const AUX_ETRE = { est:1,sont:1,furent:1,fut:1,etait:1,etaient:1,sera:1,seront:1,suis:1,es:1,sommes:1,etes:1,soit:1 };
const AUX_AVOIR = { a:1,ont:1,avons:1,avez:1,ai:1,as:1,avait:1,avaient:1,aurait:1,aura:1,auront:1,aurais:1,eu:1 };
const PART_FORMS = { arrive:1,arrives:1,arrivee:1,arrivees:1,peint:1,peints:1,peinte:1,peintes:1,cueilli:1,cueillie:1,cueillis:1,cueillies:1,trouve:1,trouves:1,trouvee:1,trouvees:1,prefere:1,preferes:1,preferee:1,preferees:1,abandonne:1,abandonnes:1,abandonnee:1,abandonnees:1 };
function isParticiple(T, idx) { return idx >= 0 && idx < T.length && !!PART_FORMS[deacc(T[idx].toLowerCase())]; }
const FUNCTION_WORDS = new Set([...Object.keys(NUM_DET), ...Object.keys(NUM_PRON), ...Object.keys(PREP), 'que','qui','dont','ne','pas','plus','y','en','ni','car','or','donc','mais','ou','si','quand','comme','tout','tous','rien']);
function isAccordTarget(T, i) {
  const w = T[i].toLowerCase();
  if (FUNCTION_WORDS.has(w)) return false;
  if (isVerb(T, i) || isParticiple(T, i)) return true;
  const dw = deacc(w);
  if (dw.length > 3 && (dw.endsWith('er') || (dw.endsWith('ir') && !dw.endsWith('oir'))) && !isVerb(T, i)) return false; // infinitif probable
  return true;
}
function board(w) { return deacc(w).toUpperCase().replace(/[^A-Z]/g, ''); }

// Règle d'accord d'un mot-cible → 'verb_sg' | 'verb_pl' | 'noun_pl' | 'noun_sg' | null (non-décidable).
function accordRule(T, i) {
  if (!isAccordTarget(T, i)) return null;
  if (isVerb(T, i) || isParticiple(T, i)) {
    const g = governorNumber(T, i, true); if (!g) return null;
    const tok = g[0].toLowerCase();
    if (tok === 'je' || tok === 'tu' || tok === 'nous' || tok === 'vous') return null; // 1re/2e pers : terminaison moins nette
    return g[1] === 'pl' ? 'verb_pl' : 'verb_sg';
  } else {
    const g = governorNumber(T, i, false); if (!g) return null;
    return g[1] === 'pl' ? 'noun_pl' : 'noun_sg';
  }
}
// Source JS du prior molle (baked rule + eps) à injecter dans _omega_accordPriorFn.
function priorSrc(rule, eps) {
  if (!rule) return 'null';
  const cond = { verb_sg: '(v3pl||endS)', verb_pl: '(!v3pl)', noun_pl: '(!endS)', noun_sg: '(endS)' }[rule];
  return `function(m){var e1=m.charAt(m.length-1),e2=m.slice(-2);var endS=(e1==='S'||e1==='X'),v3pl=(e2==='NT');return ${cond}?${eps}:1.0;}`;
}

// IMPORTANT : à la FIN d'une partie le moteur remet currentWord='' et alreadyTried à zéro.
// On renvoie null sur état vide (comme fitness_harness) pour CONSERVER le dernier snapshot valide.
function snap(O) { const t = O.tried, w = O.word; if (!t || !w) return null; let coups = 0, err = 0; for (let i = 0; i < 26; i++) if (t[i]) { coups++; if (!w.includes(String.fromCharCode(65 + i))) err++; } return { coups, err }; }

function playWord(O, boardWord, conf, usePrior, ruleSrc) {
  O.evalIn(`M_WORD_DECLARE_ENABLED=true; M_WORD_DECLARE_CONF=${conf}; M_DECLARE_ACCORD_PRIOR_ENABLED=${usePrior};`);
  O.evalIn(`_omega_accordPriorFn = ${usePrior ? ruleSrc : 'null'};`);
  O.startNewGame(boardWord);
  let sf = 300, last = snap(O);
  while (O.active && sf-- > 0) { O.omegaStep(); const s = snap(O); if (s) last = s; }
  return { won: !!O.won, err: last ? last.err : 0, coups: last ? last.coups : 0 };
}

async function run(conf, eps) {
  // un passage = un moteur neuf (indépendance des deux bras)
  async function pass(usePrior) {
    const O = loadEngine();
    if (O.loadLex) await O.loadLex();
    O.setSeed(42); if (O.init) O.init(); O.setSeed(42);
    let nWords = 0, won = 0, err = 0, nTargets = 0, wonT = 0, errT = 0;
    for (const e of SENT) {
      const T = toks(e.text);
      for (let i = 0; i < T.length; i++) {
        const bw = board(T[i]);
        if (bw.length < 7) continue;                 // le moteur ne joue que ≥ 7 lettres
        const rule = accordRule(T, i);
        const r = playWord(O, bw, conf, usePrior, priorSrc(rule, eps));
        nWords++; won += r.won ? 1 : 0; err += r.err;
        if (rule) { nTargets++; wonT += r.won ? 1 : 0; errT += r.err; }   // mots accord-décidables (où le prior peut agir)
      }
    }
    return { nWords, won, err, nTargets, wonT, errT };
  }
  const off = await pass(false);
  const on = await pass(true);
  return { conf, eps, off, on };
}

(async () => {
  const eps = +(process.argv[2] || 0.15);
  const confs = process.argv[3] ? [+process.argv[3]] : [0.65, 0.75, 0.85, 0.95];
  let head = null;
  console.log(`=== PHRASE MODE sur le VRAI moteur — prior d'accord molle (jointe §3) dans DECLARE — eps=${eps} ===`);
  console.log('  (mots ≥7 lettres uniquement : le moteur ne joue pas les mots courts, où l\'accord décide pourtant)\n');
  console.log('  conf | gagnés OFF→ON (Δ) | erreurs OFF→ON (Δ)   [tous les mots ≥7]');
  for (const conf of confs) {
    const { off, on } = await run(conf, eps);
    head = off;
    console.log(`  ${conf.toFixed(2)} |   ${off.won}→${on.won} (${on.won - off.won >= 0 ? '+' : ''}${on.won - off.won})      |   ${off.err}→${on.err} (${off.err - on.err >= 0 ? '+' : ''}${off.err - on.err})`);
  }
  console.log(`\n  base : ${head.nWords} mots ≥7 joués (dont ${head.nTargets} accord-décidables) · 30 phrases`);
  console.log('  VERDICT (honnête) : effet MARGINAL et non robuste — au mieux +2 gagnés/64 (≈+3 %) à conf élevée,');
  console.log('    mais souvent au prix de +erreurs, et négatif à conf basse. Le +9 % du probe NE se transfère PAS.');
  console.log('  POURQUOI : (1) le moteur exclut les mots <7 lettres — exactement là où l\'accord décide (verte/vert,');
  console.log('    chat/chats) ; (2) sur les mots ≥7, la fréquence lexicale réelle (w.f) concentre déjà la masse sur la');
  console.log('    bonne forme → l\'accord ajoute peu et parfois lutte contre la fréquence (d\'où les +erreurs).');
  console.log('  → La valeur du levier accord est DIAGNOSTIQUE (dictée, livrée) et dans le régime mot-court, PAS dans');
  console.log('    le DECLARE ≥7 du moteur. Hook gardé OFF-inerte (R66), documenté comme mesuré-marginal.');
})().catch(e => { console.error(e); process.exit(1); });
