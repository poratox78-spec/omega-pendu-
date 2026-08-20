/* AUDIT RAPPEL DYS — étage JS : le correcteur COMPLET (pipeline runCorr : ortho → applique →
 * grammaire en cascade) sur les textes BRUTS du corpus dys réel. Sortie JSON par texte :
 * [{i, tok, sugg, tier}] sur la suite de tokens du texte brut. Le chargeur et runCorrLike sont
 * ceux de messy_probe (le banc CI) — on mesure le MOTEUR réel, pas une recomposition. */
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(REPO, 'app', 'omega-pendu.html'), 'utf8');
try { globalThis.OMEGA_VDC = require(path.join(REPO, 'dictee', 'blobgz')).vdcSeed(html); } catch (e) {}

const i0 = html.indexOf('mode PHRASES'), start = html.indexOf('(function(){', i0);
const spIdx = html.indexOf('function spellText', start);
const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
const code = html.slice(start, cut) + ';globalThis.__C={corr:correctText,corrTok:correctTokens,toks:toks,segInfo:_segInfo,setSeg:(s)=>{_SEG=_segInfo(s);},spell:spellText,loadSp:loadSpellerLex,loadNP:loadNounPost,loadG:loadGenderLex,loadH:loadPosHmm,ready:()=>SP.ready};})();';

function blob(id) { const m = html.match(new RegExp('id="' + id + '">([\\s\\S]*?)</script>')); return m ? m[1] : ''; }
const B = { 'vdc-lex': blob('vdc-lex'), 'speller-lex-gz': blob('speller-lex-gz'), 'noun-post-gz': blob('noun-post-gz'),
            'pos-hmm-gz': blob('pos-hmm-gz'), 'gdet-lex-gz': blob('gdet-lex-gz') };
const stub = new Proxy(function(){}, { get(t,k){ if(k==='style')return{}; if(k==='classList')return{add(){},remove(){},toggle(){},contains:()=>false}; return stub; }, set:()=>true, apply:()=>stub });
global.document = { getElementById:(id)=> B[id]!==undefined && B[id]!=='' ? {textContent:B[id]} : stub, createElement:()=>stub, body:stub, head:stub, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] };
global.window = global; try { global.navigator = { userAgent:'node' }; } catch (e) { Object.defineProperty(global, 'navigator', { value: { userAgent:'node' }, configurable: true }); } global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
(0, eval)(code);
const C = globalThis.__C;

/* runCorrLike de messy_probe, mais qui REND la position + le tier (rouge appliqué / vigilance) */
function corrDetail(s) {
  const sf = C.ready() ? C.spell(s) : [];
  C.setSeg(s); const T = C.toks(s), Tc = T.slice();
  const out = [];
  sf.forEach(f => { const j = f.i;
    out.push({ i: j, tok: T[j], sugg: f.sugg, tier: f.tier || 'ortho', couche: 'speller', span: f.span || 1 });
    if (f.span !== 2 && f.tier !== 'vigilance' && f.sugg && /^[A-Za-zÀ-ÿ']+$/.test(f.sugg)) Tc[j] = f.sugg; });   // fidélité _computeCorrs : la VIGILANCE n'est jamais appliquée (elle masquait « ces »→s'est au juge)
  const cur = Tc.slice(), gbt = {};
  for (let it = 0; it < 4; it++) { const g2 = C.corrTok(cur); let add = false;
    for (const g of g2) { if (gbt[g.i] != null) continue; gbt[g.i] = g; add = true;
      if ((g.span == null || g.span < 2) && g.tier !== 'vigilance' && g.sugg && /^[A-Za-zÀ-ÿ']+$/.test(g.sugg)) cur[g.i] = g.sugg; }
    if (!add) break; }
  for (const k of Object.keys(gbt)) { const g = gbt[k];
    out.push({ i: g.i, tok: T[g.i], sugg: g.sugg, tier: g.tier || 'rouge', couche: 'grammaire', span: g.span || 1 }); }
  return { tokens: T, flags: out };
}

(async () => {
  await C.loadSp(); if (C.loadNP) await C.loadNP(); if (C.loadG) await C.loadG(); if (C.loadH) await C.loadH();
  const src = process.argv[2] || path.join(REPO, 'data_local', 'dys_reel', 'dictees_gold.jsonl');
  if (!fs.existsSync(src)) { console.log('(corpus dys réel absent de data_local — sonde locale, rien à mesurer ici)'); return; }
  const lignes = fs.readFileSync(src, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  const res = [];
  for (const l of lignes) { const c = corrDetail(l.raw); c.tokensFixed = C.toks(l.fixed); res.push({ src: l.src, raw: l.raw, fixed: l.fixed, corr: c }); }
  const dst = process.argv[3] || path.join(REPO, 'data_local', 'dys_reel', 'audit_corr_dump.json');
  fs.writeFileSync(dst, JSON.stringify(res));
  console.log('dump : ' + res.length + ' textes → ' + dst + ' (speller ' + (C.ready() ? 'chargé' : 'ABSENT') + ')');
})();
