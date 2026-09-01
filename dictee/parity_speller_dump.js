/* PARITÉ SPELLER — étage JS. Dumpe les flags du speller RÉEL de l'app (tous paliers, vigilance
 * comprise) sur des corpus COMMITTÉS, pour que `parity_speller.py` compare la SUGGESTION du moteur
 * livré à celle de sa référence Python (`speller_probe.py`, qui se déclare « Miroir JS »).
 *
 * ⭐ LE TROU QUE CETTE SONDE FERME. La batterie gardait déjà :
 *     · `speller ext ≡ app (vigilance comprise)`  → JS ↔ JS
 *     · `parity_corr`                             → GRAMMAIRE Python ↔ JS
 *   mais RIEN ne comparait le SPELLER Python ↔ JS. Les deux moteurs JS s'accordaient donc
 *   entre eux sur des suggestions FAUSSES que la référence Python donnait JUSTES, sans un signal.
 *   Mesuré à la pose : `priosn`→prions (réf : prison), `séris`→sérieux (réf : série),
 *   `sonn`→sont (réf : son) — trois mots du corpus dys réel, moteur de PRODUCTION faux les trois fois.
 *
 * Corpus : `fp_scale_corpus.txt` (2 500 phrases CORRECTES) + `corpus_gec_fr.jsonl` (98 phrases
 * fautives — le corpus de mesure du speller lui-même). Tous deux COMMITTÉS : la sonde tourne en CI.
 * Sortie : data_local/parity_speller_dump.json
 * Chargeur : copié d'`arbitre_vig_dump.js` (fidélité _computeCorrs), on n'en garde que le speller. */
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(REPO, 'app', 'omega-pendu.html'), 'utf8');
try { globalThis.OMEGA_VDC = require(path.join(REPO, 'dictee', 'blobgz')).vdcSeed(html); } catch (e) {}

const i0 = html.indexOf('mode PHRASES'), start = html.indexOf('(function(){', i0);
const spIdx = html.indexOf('function spellText', start);
const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
if (start < 0 || spIdx < 0 || cut < 0) { console.error('extraction échouée'); process.exit(2); }
const code = html.slice(start, cut) + ';globalThis.__C={toks:toks,setSeg:(s)=>{_SEG=_segInfo(s);},spell:spellText,loadSp:loadSpellerLex,loadNP:loadNounPost,loadG:loadGenderLex,loadH:loadPosHmm,ready:()=>SP.ready};})();';

function blob(id) { const m = html.match(new RegExp('id="' + id + '">([^]*?)</script>')); return m ? m[1] : ''; }
const B = { 'vdc-lex': blob('vdc-lex'), 'speller-lex-gz': blob('speller-lex-gz'), 'noun-post-gz': blob('noun-post-gz'),
            'pos-hmm-gz': blob('pos-hmm-gz'), 'gdet-lex-gz': blob('gdet-lex-gz') };
const stub = new Proxy(function(){}, { get(t,k){ if(k==='style')return{}; if(k==='classList')return{add(){},remove(){},toggle(){},contains:()=>false}; return stub; }, set:()=>true, apply:()=>stub });
global.document = { getElementById:(id)=> B[id]!==undefined && B[id]!=='' ? {textContent:B[id]} : stub, createElement:()=>stub, body:stub, head:stub, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] };
global.window = global; try { global.navigator = { userAgent:'node' }; } catch (e) { Object.defineProperty(global, 'navigator', { value: { userAgent:'node' }, configurable: true }); } global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
(0, eval)(code);
const C = globalThis.__C;

(async () => {
  await C.loadSp(); if (C.loadNP) await C.loadNP(); if (C.loadG) await C.loadG(); if (C.loadH) await C.loadH();
  const phrases = [];
  for (const l of fs.readFileSync(path.join(__dirname, 'fp_scale_corpus.txt'), 'utf8').split('\n')) if (l.trim()) phrases.push(l.trim());
  for (const l of fs.readFileSync(path.join(__dirname, 'corpus_gec_fr.jsonl'), 'utf8').split('\n')) {
    if (!l.trim()) continue; try { const o = JSON.parse(l); if (o.bad) phrases.push(o.bad); } catch (e) {} }

  const out = [];
  for (const s of phrases) {
    const sf = C.ready() ? C.spell(s, true) : [];
    C.setSeg(s); const T = C.toks(s);
    const flags = [];
    // span 2 = règle à deux mots : la référence Python travaille token à token, on ne la compare pas là-dessus.
    sf.forEach(f => { if ((f.span || 1) !== 1) return;
      flags.push({ i: f.i, tok: T[f.i], sugg: f.sugg, tier: f.tier || 'ortho', name: f.name || '' }); });
    if (flags.length) out.push({ tokens: T, flags: flags });
  }
  const dst = path.join(REPO, 'data_local', 'parity_speller_dump.json');
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, JSON.stringify({ phrases: phrases.length, dump: out }), 'utf8');
  console.log('dump speller : %d phrases, %d porteuses de flags', phrases.length, out.length);
})();
