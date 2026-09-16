#!/usr/bin/env node
/* GARDE du décomposeur phonique anglais (dictee/phonics_en.js + en/decompose-outil.html).
 *
 * CE QU'ELLE VÉRIFIE, et pourquoi (16/09/2026) :
 *   ① les 8 mots irréguliers qui ont révélé le défaut (la page devinait la prononciation et ignorait le dictionnaire :
 *      « said » -> /seɪd/) sortent désormais avec les phonèmes du DICTIONNAIRE — chacun attendu explicitement ;
 *   ② un mot absent du dictionnaire est dit « predicted » (jamais présenté comme une prononciation) ;
 *   ③ l'alignement lettres <-> sons est une BIJECTION monotone : les groupes de lettres recollés redonnent le mot, les
 *      sons recollés redonnent les phonèmes du dictionnaire — sur les 20 000 mots les plus fréquents, ≥ 99,9 % alignés ;
 *   ④ les lignes « unusual » restent RARES sur du vocabulaire courant (plafond 10 % des mots ; mesuré 7,3 %) : c'est le
 *      signal « lettre muette / orthographe irrégulière », il ne doit pas revenir au bruit d'avant (27 % puis 41 %) ;
 *   ⑤ la page charge le module partagé et lui délègue (plus de g2p local, plus de prédiction présentée comme vérité), et
 *      elle charge bien le dictionnaire ; ses actifs sont nommés en cas d'échec.
 *   node dictee/phonics_en_probe.js        (OMEGA_DICTEE / OMEGA_PAGE : répertoires de remplacement pour un essai hors dépôt)
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const HERE = __dirname;
const DICTEE = process.env.OMEGA_DICTEE || HERE;
const PAGE = process.env.OMEGA_PAGE || path.join(HERE, '..', 'en', 'decompose-outil.html');
const P = require(path.join(HERE, 'phonics_en.js'));
const T = JSON.parse(fs.readFileSync(path.join(DICTEE, 'g2p_en.json'), 'utf8'));
const raw = zlib.gunzipSync(fs.readFileSync(path.join(DICTEE, 'lex_en.tsv.gz'))).toString('utf8');
const IPA = P.parseIpaText(raw);
const ipaOf = (w) => IPA.get(w) || null;
let rouge = 0;
const fail = (m) => { rouge++; console.log('  ✗ ' + m); };

// ① les 8 mots du défaut, phonèmes attendus (canoniques GA) — invariants, pas des exemples
const ATTENDUS = { said: 's ɛ d', enough: 'ɪ n ʌ f', friend: 'f ɹ ɛ n d', women: 'w ɪ m ɪ n', island: 'aɪ l ə n d',
                   choir: 'k w aɪ ɹ', yacht: 'j ɑ t', colonel: 'k ɚ n l',
                   // notations mêlées du dictionnaire, canonisées : « so » y est britannique (/səʊ/ -> oʊ), « care » rhotique (ɛɚ -> ɛɹ)
                   so: 's oʊ', old: 'oʊ l d', care: 'k ɛ ɹ' };
for(const [w, exp] of Object.entries(ATTENDUS)){
  const d = P.decompose(T, w, ipaOf);
  if(!d || d.source !== 'dictionary') fail(`${w} : source ${d && d.source} (attendu dictionary)`);
  else if(d.phonemes.join(' ') !== exp) fail(`${w} : phonèmes [${d.phonemes.join(' ')}] (attendu [${exp}])`);
  else if(d.aligned && d.rows.map(r => r.g).join('') !== w) fail(`${w} : les groupes de lettres ne redonnent pas le mot`);
}
// les lettres muettes qui doivent être NOMMÉES (le cœur pédagogique)
for(const [w, g] of [['island', 's'], ['castle', 't'], ['two', 'w'], ['listen', 't'], ['sword', 'w'], ['honest', 'h']]){
  const d = P.decompose(T, w, ipaOf);
  const row = d.rows.find(r => r.g === g && r.phs.length === 0);
  if(!row) fail(`${w} : la lettre muette « ${g} » n'est pas signalée`);
}
// « said » : ai -> ɛ est une lecture connue (pas « unusual ») ; « enough » : ough -> ʌf idem ; « yacht » : ch muet est unusual
const chk = (w, g, kindAttendu) => { const r = P.decompose(T, w, ipaOf).rows.find(x => x.g === g); if(!r || r.kind !== kindAttendu) fail(`${w} : ligne « ${g} » = ${r && r.kind} (attendu ${kindAttendu})`); };
chk('said', 'ai', 'regular'); chk('enough', 'ough', 'regular'); chk('yacht', 'ch', 'silent-unusual'); chk('knight', 'kn', 'regular');

// ② mot absent -> predicted, et la prédiction reste celle du g2p
{ const d = P.decompose(T, 'zxqvblorp', ipaOf);
  if(!d || d.source !== 'predicted') fail('mot inconnu : source ' + (d && d.source) + ' (attendu predicted)');
  if(d && d.rows.some(r => r.kind === 'unusual')) fail('mot inconnu : une ligne « unusual » sans dictionnaire — la prédiction ne peut pas se contredire elle-même'); }

// ③④ invariants sur les 20 000 mots les plus fréquents (dictionnaire committé : mesure reproductible en CI)
const freq = raw.split('\n').slice(1).map(l => l.split('\t')).filter(c => c.length >= 7 && c[2] && /^[a-z]+$/.test(c[0]))
  .map(c => [c[0], c[2], parseInt(c[6] || 0, 10)]).sort((a, b) => b[2] - a[2]).slice(0, 20000);
let n = 0, alignes = 0, bij = 0, unusual = 0;
for(const [w] of freq){
  const d = P.decompose(T, w, ipaOf); if(!d || d.source !== 'dictionary') continue;
  n++;
  if(!d.aligned) continue;
  alignes++;
  const lettres = d.rows.map(r => r.g).join(''), sons = d.rows.flatMap(r => r.phs).join(' ');
  if(lettres === w && sons === d.phonemes.join(' ')) bij++;
  if(d.unusual) unusual++;
}
if(n < 19000) fail(`seulement ${n} mots fréquents au dictionnaire (attendu ≥ 19 000) — le dictionnaire a-t-il changé de forme ?`);
if(alignes / n < 0.999) fail(`alignés ${alignes}/${n} = ${(100 * alignes / n).toFixed(2)} % (plancher 99,9 %)`);
if(bij !== alignes) fail(`${alignes - bij} alignement(s) qui ne redonnent pas le mot ou les phonèmes`);
if(unusual / alignes > 0.10) fail(`lignes « unusual » sur ${(100 * unusual / alignes).toFixed(1)} % des mots courants (plafond 10 %) — les coûts de l'alignement ont dérivé`);

// ⑤ la page : module chargé, décomposition déléguée, dictionnaire chargé, prédiction locale retirée
const page = fs.readFileSync(PAGE, 'utf8');
for(const x of ['src="../dictee/phonics_en.js"', 'PhonicsEN', 'P.decompose(', "fetch('../dictee/lex_en.tsv.gz')", "fetch('../dictee/g2p_en.json')", 'P.parseIpaText(']) if(page.indexOf(x) < 0) fail('page : « ' + x + ' » absent');
if(/function g2pSteps\(/.test(page)) fail('page : elle porte encore sa propre prédiction g2p (g2pSteps) au lieu du module');
// le script de la page (pas l'enregistrement du service worker, dont l'échec silencieux est voulu) : chaque fetch a un catch qui NOMME l'actif
const i0 = page.indexOf('window.PhonicsEN'), bloc = i0 < 0 ? '' : page.slice(i0, page.indexOf('</script>', i0));
if(/\.catch\(function\([a-z]*\)\{\s*\}\)/.test(bloc)) fail('page : un échec de chargement avalé en silence');
if((bloc.match(/Could not load/g) || []).length < 2) fail('page : les deux actifs (modèle, dictionnaire) ne sont pas nommés en cas d\'échec');
if(!/not in the dictionary/.test(page)) fail('page : le repli « predicted » n\'est pas annoncé au lecteur');

if(rouge){ console.log(`\nPHONICS EN : ${rouge} attente(s) non tenue(s)`); process.exit(1); }
console.log(`  ✓ phonics EN : 8 mots irréguliers lus au dictionnaire, lettres muettes nommées ; ${n} mots courants : ${(100 * alignes / n).toFixed(2)} % alignés, ${(100 * unusual / alignes).toFixed(1)} % avec une lecture inhabituelle ; page branchée sur le module`);
process.exit(0);
