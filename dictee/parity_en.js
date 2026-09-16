// Garde de PARITÉ Python↔JS du correcteur anglais — PAR TOKEN, sur un corpus COMMITTÉ (+ EWT en local).
//
// CE QU'ELLE COMPARE, mot à mot, entre corrector_en.js (le moteur servi par en/correcteur-outil.html) et les
// références Python (speller_en_probe.py, homophone_en_probe.py) :
//   · la TOKENISATION (même motif : apostrophe typographique, lettres accentuées — sinon tous les index divergent) ;
//   · le SPELLER : suggestion + mode (OK / AUTO rouge / FLAG orange), avec le mot-outil précédent en contexte ;
//   · les HOMOPHONES : suggestion + niveau (RED / ORANGE), AVEC le masque d'adjacence réelle, comme la page.
// Le POS-tagger a sa propre garde par token : parity_pos_en.js.
//
// POURQUOI PAR TOKEN ET SUR UN CORPUS COMMITTÉ. L'ancienne version comparait deux TOTAUX (« AUTO 69 vs 68 »)
// sur EWT, absent de la CI : elle n'a donc jamais tourné en CI, et entre le 08/08 et le 16/09/2026 le Python a
// pris cinq semaines de retard sur le JS (post-passes du tagger, familles where/were, whose, led, passed, two,
// paronymes, accord 3sg, gardes was->were, an->a, « of course », adjacence) sans qu'aucune garde ne rougisse.
// Deux totaux égaux peuvent d'ailleurs cacher deux erreurs qui se compensent ; deux listes par token, non.
//
// CORPUS : dictee/parity_en_cases.txt = phrases INVENTÉES, une par famille de règle et son piège (un corpus réel n'exerce
// pas tout : retirer « of course » d'un seul moteur restait vert sur 13 544 phrases réelles) ; plus
// dictee/parity_en_corpus.txt = les 1 000 phrases d'UD English-PUD (CC BY-SA 3.0, traducteurs
// professionnels ; même licence et même usage que fp_scale_corpus.txt côté français). En local, si
// data_local/en_ewt-ud-train.conllu est présent, ses 12 544 phrases s'ajoutent (le web, avec ses fautes : c'est
// là que les règles tirent le plus, donc là que la parité se vérifie le mieux).
//
//   node dictee/parity_en.js        → exit 1 à la première divergence (toujours strict, comme parity_pos.js FR)
'use strict';
const path = require('path'), fs = require('fs'), cp = require('child_process');
const HERE = __dirname;
const ce = require('./corrector_en.js');

const lex = ce.loadLexNode(path.join(HERE, 'lex_en.tsv.gz'));
// modèle POS : le Python le charge tout seul (pos_en.load_model) ; sans lui côté JS, les règles à POS
// contextuel (there+NOM -> their, whose+VERB…) s'abstiendraient d'un côté seulement → fausse divergence.
const _pm = path.join(HERE, 'pos_hmm_en.json');
if(fs.existsSync(_pm)) ce.setPosModel(JSON.parse(fs.readFileSync(_pm, 'utf8')));

const textes = [];
const cases = path.join(HERE, 'parity_en_cases.txt');
if(!fs.existsSync(cases)){ console.error('❌ phrases de garde absentes : ' + cases); process.exit(1); }
for(const l of fs.readFileSync(cases, 'utf8').split('\n')) if(l.trim() && !l.startsWith('#')) textes.push(['CAS', l]);
const nCas = textes.length;
if(nCas < 40){ console.error('❌ phrases de garde : ' + nCas + ' lues, au moins 40 attendues (fichier tronqué ?)'); process.exit(1); }
const corpus = path.join(HERE, 'parity_en_corpus.txt');
if(!fs.existsSync(corpus)){ console.error('❌ corpus committé absent : ' + corpus); process.exit(1); }
for(const l of fs.readFileSync(corpus, 'utf8').split('\n')) if(l.trim()) textes.push(['PUD', l]);
const nPud = textes.length - nCas;
const EWT = path.join(HERE, '..', 'data_local', 'en_ewt-ud-train.conllu');
if(fs.existsSync(EWT)) for(const l of fs.readFileSync(EWT, 'utf8').split('\n')) if(l.startsWith('# text = ')) textes.push(['EWT', l.slice(9)]);

// --- côté JS : la page tokenise avec ce.tokenize, passe le mot-outil précédent au speller et le masque au canal homophone
const JS = textes.map(([, t]) => {
  const T = ce.tokenize(t), adj = ce.adjMask(t);
  return { tok: T,
           sp: T.map((w, i) => { const r = ce.spellSuggest(lex, w, i > 0 ? T[i-1].toLowerCase() : ''); return [r[0], r[1]]; }),
           ho: T.map((w, i) => { const r = ce.homoDecide(lex, T, i, adj); return [r[0], r[1]]; }) };
});

// --- côté Python : un seul processus, JSON entrant (textes) / sortant (décisions par token)
const py = cp.spawnSync('python', ['-c', `
import sys, json, os
sys.path.insert(0, ${JSON.stringify(HERE)})
import speller_en_probe as S, homophone_en_probe as H
sp = S.SpellerEN()
out = []
for t in json.loads(sys.stdin.read()):
    T = H._tok(t); adj = H.adj_mask(t)
    out.append({'tok': T,
                'sp': [list(sp.suggest(w, T[i-1].lower() if i > 0 else '')) for i, w in enumerate(T)],
                'ho': [list(H.decide(T, i, adj)) for i in range(len(T))]})
sys.stdout.write(json.dumps(out, ensure_ascii=False))
`], { input: JSON.stringify(textes.map(x => x[1])), encoding: 'utf8', maxBuffer: 1 << 28,
      env: Object.assign({}, process.env, { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }) });
if(py.status !== 0){ console.error('[python KO]', (py.stderr || '').slice(0, 1500)); process.exit(1); }
const PY = JSON.parse(py.stdout);

const eq = (a, b) => String(a[0] == null ? '' : a[0]) === String(b[0] == null ? '' : b[0]) && String(a[1] == null ? '' : a[1]) === String(b[1] == null ? '' : b[1]);
const div = { tokenisation: [], speller: [], homophone: [] };
let toks = 0;
for(let k = 0; k < textes.length; k++){
  const src = textes[k][0], J = JS[k], P = PY[k];
  if(J.tok.join('\u0001') !== P.tok.join('\u0001')){ div.tokenisation.push(`${src} JS ${J.tok.length} tokens vs PY ${P.tok.length} : « ${textes[k][1].slice(0, 100)} »`); continue; }
  for(let i = 0; i < J.tok.length; i++){
    toks++;
    const ctx = `${src} « ${J.tok.slice(Math.max(0, i - 3), i + 4).join(' ')} »`;
    if(!eq(J.sp[i], P.sp[i])) div.speller.push(`${J.tok[i]} : JS ${J.sp[i][1]}/${J.sp[i][0]} vs PY ${P.sp[i][1]}/${P.sp[i][0]}  ${ctx}`);
    if(!eq(J.ho[i], P.ho[i])) div.homophone.push(`${J.tok[i]} : JS ${J.ho[i][1]}/${J.ho[i][0]} vs PY ${P.ho[i][1]}/${P.ho[i][0]}  ${ctx}`);
  }
}
let total = 0;
for(const [k, v] of Object.entries(div)){
  total += v.length;
  if(v.length){ console.log(`  ✗ ${k} : ${v.length} divergence(s)`); for(const l of v.slice(0, 10)) console.log('     ' + l.slice(0, 220)); }
}
if(total){ console.error(`❌ PARITÉ EN ROMPUE : ${total} divergence(s) JS ≠ Python sur ${toks} tokens`); process.exit(1); }
console.log(`✅ PARITÉ EN OK — ${textes.length} phrases (${nCas} de garde + PUD ${nPud}${textes.length > nCas + nPud ? ' + EWT ' + (textes.length - nCas - nPud) : ''}), ${toks} tokens : tokenisation, speller, homophones identiques JS == Python`);
