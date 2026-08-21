/* ARBITRE DES VIGILANCES — étage JS : dumper TOUTES les oranges du pipeline RÉEL (runCorrLike de
 * dys_rappel_dump, même fidélité _computeCorrs) sur (a) le corpus CORRECT (fp_scale 2 500 + UD
 * 14 450 — toute orange y est par définition de la fatigue) et (b) les dictées dys réelles (gold
 * apparié — une orange peut y être juste, pointeuse ou fatigue). Le juge B2 lira ce dump côté
 * Python (arbitre_vig_probe.py) pour mesurer : combien de fatigue il peut TAIRE sans perdre une
 * seule orange JUSTE. Sortie : data_local/arbitre_vig_dump.json */
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(REPO, 'app', 'omega-pendu.html'), 'utf8');
try { globalThis.OMEGA_VDC = require(path.join(REPO, 'dictee', 'blobgz')).vdcSeed(html); } catch (e) {}

const i0 = html.indexOf('mode PHRASES'), start = html.indexOf('(function(){', i0);
const spIdx = html.indexOf('function spellText', start);
const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
const code = html.slice(start, cut) + ';globalThis.__C={corrTok:correctTokens,toks:toks,setSeg:(s)=>{_SEG=_segInfo(s);},spell:spellText,loadSp:loadSpellerLex,loadNP:loadNounPost,loadG:loadGenderLex,loadH:loadPosHmm,ready:()=>SP.ready};})();';

function blob(id) { const m = html.match(new RegExp('id="' + id + '">([\\s\\S]*?)</script>')); return m ? m[1] : ''; }
const B = { 'vdc-lex': blob('vdc-lex'), 'speller-lex-gz': blob('speller-lex-gz'), 'noun-post-gz': blob('noun-post-gz'),
            'pos-hmm-gz': blob('pos-hmm-gz'), 'gdet-lex-gz': blob('gdet-lex-gz') };
const stub = new Proxy(function(){}, { get(t,k){ if(k==='style')return{}; if(k==='classList')return{add(){},remove(){},toggle(){},contains:()=>false}; return stub; }, set:()=>true, apply:()=>stub });
global.document = { getElementById:(id)=> B[id]!==undefined && B[id]!=='' ? {textContent:B[id]} : stub, createElement:()=>stub, body:stub, head:stub, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] };
global.window = global; try { global.navigator = { userAgent:'node' }; } catch (e) { Object.defineProperty(global, 'navigator', { value: { userAgent:'node' }, configurable: true }); } global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
(0, eval)(code);
const C = globalThis.__C;

/* runCorrLike (fidélité _computeCorrs : vigilance JAMAIS appliquée) — garde le NOM de la règle */
function corrDetail(s) {
  const sf = C.ready() ? C.spell(s) : [];
  C.setSeg(s); const T = C.toks(s), Tc = T.slice();
  const out = [];
  sf.forEach(f => { const j = f.i;
    out.push({ i: j, tok: T[j], sugg: f.sugg, tier: f.tier || 'ortho', couche: 'speller', span: f.span || 1, name: f.name || '' });
    if (f.span !== 2 && f.tier !== 'vigilance' && f.sugg && /^[A-Za-zÀ-ÿ']+$/.test(f.sugg)) Tc[j] = f.sugg; });
  const cur = Tc.slice(), gbt = {};
  for (let it = 0; it < 4; it++) { const g2 = C.corrTok(cur); let add = false;
    for (const g of g2) { if (gbt[g.i] != null) continue; gbt[g.i] = g; add = true;
      if ((g.span == null || g.span < 2) && g.tier !== 'vigilance' && g.sugg && /^[A-Za-zÀ-ÿ']+$/.test(g.sugg)) cur[g.i] = g.sugg; }
    if (!add) break; }
  for (const k of Object.keys(gbt)) { const g = gbt[k];
    out.push({ i: g.i, tok: T[g.i], sugg: g.sugg, tier: g.tier || 'rouge', couche: 'grammaire', span: g.span || 1, name: g.name || '' }); }
  return { tokens: T, flags: out };
}

(async () => {
  await C.loadSp(); if (C.loadNP) await C.loadNP(); if (C.loadG) await C.loadG(); if (C.loadH) await C.loadH();
  const corrects = [];
  for (const l of fs.readFileSync(path.join(__dirname, 'fp_scale_corpus.txt'), 'utf8').split('\n')) if (l.trim()) corrects.push(l.trim());
  const ud = path.join(REPO, 'data_local', 'ud_fr_gsd-train.conllu');
  if (fs.existsSync(ud))
    for (const l of fs.readFileSync(ud, 'utf8').split('\n')) if (l.startsWith('# text =')) corrects.push(l.slice(8).trim());
  const outCorrect = [];
  let nVig = 0;
  for (const s of corrects) {
    const c = corrDetail(s);
    const vig = c.flags.filter(f => f.tier === 'vigilance');
    if (vig.length) { outCorrect.push({ s: s, flags: vig }); nVig += vig.length; }
  }
  const dys = [];
  for (const fn of ['dictees_gold.jsonl', 'faiblesses.jsonl']) {          // 6 dictées + 1 600 paires appariées
    const p = path.join(REPO, 'data_local', 'dys_reel', fn);
    if (!fs.existsSync(p)) continue;
    for (const l of fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)) {
      const t = JSON.parse(l);
      const c = corrDetail(t.raw);
      const vig = c.flags.filter(f => f.tier === 'vigilance');
      if (vig.length) dys.push({ src: t.src, raw: t.raw, tokens: c.tokens, tokensFixed: C.toks(t.fixed), flags: vig });
    }
  }
  const dst = path.join(REPO, 'data_local', 'arbitre_vig_dump.json');
  fs.writeFileSync(dst, JSON.stringify({ nCorrects: corrects.length, correct: outCorrect, dys: dys }));
  console.log('dump : ' + corrects.length + ' phrases correctes → ' + outCorrect.length + ' avec orange (' + nVig +
    ' oranges) · dys : ' + dys.length + ' textes → ' + dst);
})();
