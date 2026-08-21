/* DISTILLATION INVERSE mou→squelette, étape 1 : récolter les oranges « accord pluriel à
 * vérifier » du pipeline RÉEL sur un grand corpus (b2_train, lignes 30-220 chars) — le juge B2
 * les étiquettera (tais/garde) côté Python, puis une CARTE légère (façon cesses) apprendra à
 * prédire le verdict du juge : le squelette gagne l'organe SANS le juge (pas d'opt-in, 0 octet).
 * Sortie : data_local/distill_pluriel_dump.json [{s, i, tok, sugg}] */
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(REPO, 'app', 'omega-pendu.html'), 'utf8');
try { globalThis.OMEGA_VDC = require(path.join(REPO, 'dictee', 'blobgz')).vdcSeed(html); } catch (e) {}

const i0 = html.indexOf('mode PHRASES'), start = html.indexOf('(function(){', i0);
const spIdx = html.indexOf('function spellText', start);
const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
const code = html.slice(start, cut) + ';globalThis.__C={toks:toks,setSeg:(s)=>{_SEG=_segInfo(s);},spell:spellText,loadSp:loadSpellerLex,loadNP:loadNounPost,loadG:loadGenderLex,loadH:loadPosHmm,ready:()=>SP.ready};})();';

function blob(id) { const m = html.match(new RegExp('id="' + id + '">([\\s\\S]*?)</script>')); return m ? m[1] : ''; }
const B = { 'vdc-lex': blob('vdc-lex'), 'speller-lex-gz': blob('speller-lex-gz'), 'noun-post-gz': blob('noun-post-gz'),
            'pos-hmm-gz': blob('pos-hmm-gz'), 'gdet-lex-gz': blob('gdet-lex-gz') };
const stub = new Proxy(function(){}, { get(t,k){ if(k==='style')return{}; if(k==='classList')return{add(){},remove(){},toggle(){},contains:()=>false}; return stub; }, set:()=>true, apply:()=>stub });
global.document = { getElementById:(id)=> B[id]!==undefined && B[id]!=='' ? {textContent:B[id]} : stub, createElement:()=>stub, body:stub, head:stub, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] };
global.window = global; try { global.navigator = { userAgent:'node' }; } catch (e) { Object.defineProperty(global, 'navigator', { value: { userAgent:'node' }, configurable: true }); } global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
(0, eval)(code);
const C = globalThis.__C;

(async () => {
  await C.loadSp(); if (C.loadNP) await C.loadNP(); if (C.loadG) await C.loadG(); if (C.loadH) await C.loadH();
  const src = path.join(REPO, 'data_local', 'b2_train.txt');
  if (!fs.existsSync(src)) { console.log('(b2_train absent — lancer b2_data.py)'); return; }
  const N = parseInt(process.argv[2] || '120000', 10);
  const out = [], justes = [];
  const DET_PL = {};'les des ces ses mes tes nos vos leurs aux quelques plusieurs'.split(' ').forEach(w => DET_PL[w] = 1);
  let vus = 0;
  for (const l of fs.readFileSync(src, 'utf8').split('\n')) {
    if (l.length < 30 || l.length > 220) continue;
    if (++vus > N) break;
    /* la couche SPELLER seule suffit : pluralVig y vit (chaîne vigilance de spellText) */
    const flags = C.ready() ? C.spell(l) : [];
    for (const f of flags)
      if (f.tier === 'vigilance' && f.name === 'accord pluriel à vérifier')
        out.push({ s: l, i: f.i, tok: C.toks(l)[f.i], sugg: f.sugg });
    /* JUSTES par construction (la boucle : le squelette GÉNÈRE ce que le correct ne contient
       pas — « les propriétaire ») : DET pluriel + nom pluriel → singularisé ; si l'orange tire
       au même endroit avec la sugg = le pluriel d'origine, c'est une orange JUSTE. */
    if (justes.length < 6000 && vus % 2 === 0) {
      const T = C.toks(l);
      for (let k = 1; k < T.length; k++) {
        const w = T[k];
        if (!DET_PL[T[k - 1].toLowerCase()] || !/^[a-zà-ÿ]{4,}s$/.test(w)) continue;
        const sing = w.slice(0, -1);
        const pos = l.indexOf(T[k - 1] + ' ' + w);
        if (pos < 0) continue;
        const sfx = l.slice(0, pos + T[k - 1].length + 1) + sing + l.slice(pos + T[k - 1].length + 1 + w.length);
        const fl2 = C.spell(sfx);
        for (const f2 of fl2)
          if (f2.tier === 'vigilance' && f2.name === 'accord pluriel à vérifier' && f2.i === k &&
              (f2.sugg || '').toLowerCase() === w.toLowerCase())
            justes.push({ s: sfx, i: k, tok: sing, sugg: f2.sugg });
        break;                                     // un seul cas par phrase (diversité)
      }
    }
  }
  const dst = path.join(REPO, 'data_local', 'distill_pluriel_dump.json');
  fs.writeFileSync(dst, JSON.stringify({ oranges: out, justes: justes }));
  console.log('dump : ' + vus + ' phrases balayées → ' + out.length + ' oranges pluriel + ' + justes.length + ' justes générées → ' + dst);
})();
