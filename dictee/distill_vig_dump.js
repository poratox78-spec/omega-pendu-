/* DISTILLATION INVERSE, récolte MULTI-FAMILLES (généralise distill_pluriel_dump après PR#523) :
 * les oranges du pipeline réel + les JUSTES GÉNÉRÉES par famille, en UNE passe sur le corpus.
 * L'ingrédient prouvé sur pluriel : le correct ne contient pas les fautes → le squelette les
 * FABRIQUE, et chaque corruption n'est retenue comme juste QUE si l'orange re-tire au même
 * token avec la sugg = l'original (auto-validation par le moteur, zéro heuristique de plus).
 * Corrupteurs : SV ±« nt » (mangent↔mange) · genre −e final · ou↔où.
 * Sortie : data_local/distill_vig_dump.json {fam: {oranges:[], justes:[]}}
 *   node dictee/distill_vig_dump.js [nPhrases] */
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

const FAMS = {
  sv:    { nom: 'accord sujet-verbe à vérifier' },
  genre: { nom: 'accord genre à vérifier' },
  ou:    { nom: 'ou/où à vérifier' },
  maj:   { nom: 'majuscule initiale à vérifier' },   // ne tire qu'en capital=true (vue correcteur dédiée) — d'où spell(l,true) plus bas
  ces:   { nom: 'ces/ses à vérifier' },
};

/* corruptions candidates d'un token (t = texte, k = index, T = tokens) — [chaîne corrompue] */
function corruptions(T, k) {
  const w = T[k], lw = w.toLowerCase(), out = [];
  if (/^[a-zà-ÿ]{5,}ent$/.test(lw)) out.push(w.slice(0, -2));              // mangent → mange
  else if (/^[a-zà-ÿ]{4,}e$/.test(lw)) out.push(w + 'nt', w.slice(0, -1)); // mange → mangent · grande → grand
  if (lw === 'où') out.push(w.slice(0, -1) + 'u');                         // où → ou (garde la casse du o)
  else if (lw === 'ou') out.push(w.slice(0, 1) + 'ù');
  if (lw === 'ces') out.push((/^[A-Z]/.test(w) ? 'S' : 's') + w.slice(1)); // ces → ses (garde casse initiale)
  else if (lw === 'ses') out.push((/^[A-Z]/.test(w) ? 'C' : 'c') + w.slice(1));
  return out;
}

(async () => {
  await C.loadSp(); if (C.loadNP) await C.loadNP(); if (C.loadG) await C.loadG(); if (C.loadH) await C.loadH();
  const src = path.join(REPO, 'data_local', 'b2_train.txt');
  if (!fs.existsSync(src)) { console.log('(b2_train absent — lancer b2_data.py)'); return; }
  const N = parseInt(process.argv[2] || '120000', 10);
  const R = {}; for (const f in FAMS) R[f] = { oranges: [], justes: [] };
  const nomVersFam = {}; for (const f in FAMS) nomVersFam[FAMS[f].nom] = f;
  let vus = 0;
  for (const l of fs.readFileSync(src, 'utf8').split('\n')) {
    if (l.length < 30 || l.length > 220) continue;
    if (++vus > N) break;
    const flags = C.ready() ? C.spell(l, true) : [];   // capital=true : sans lui, « majuscule initiale à vérifier » ne tire JAMAIS (voir FAMS.maj)
    for (const f of flags) {
      const fam = f.tier === 'vigilance' ? nomVersFam[f.name] : null;
      if (fam) R[fam].oranges.push({ s: l, i: f.i, tok: C.toks(l)[f.i], sugg: f.sugg });
    }
    /* JUSTES générées : corruption d'UN token → l'orange de la famille doit re-tirer au même
       index avec sugg = l'original. Une par phrase et par famille (diversité). */
    if (vus % 2 === 0) {
      const T = C.toks(l);
      const pris = {};
      for (let k = 1; k < T.length - 1; k++) {
        const cands = corruptions(T, k);
        for (const rep of cands) {
          const pos = l.indexOf(T[k]);
          if (pos < 0) continue;
          /* position exacte du k-ième token : re-scan par regex pour éviter les homonymes */
          let m, rx = /[A-Za-zÀ-ÿœŒ'’ʼ]+/g, idx = -1, a = -1;
          while ((m = rx.exec(l))) { idx++; if (idx === k) { a = m.index; break; } }
          if (a < 0) continue;
          const sfx = l.slice(0, a) + rep + l.slice(a + T[k].length);
          const fl2 = C.spell(sfx, true);
          for (const f2 of fl2) {
            const fam = f2.tier === 'vigilance' ? nomVersFam[f2.name] : null;
            if (fam && !pris[fam] && f2.i === k && (f2.sugg || '').toLowerCase() === T[k].toLowerCase() &&
                R[fam].justes.length < 6000) {
              R[fam].justes.push({ s: sfx, i: k, tok: rep, sugg: f2.sugg });
              pris[fam] = 1;
            }
          }
        }
      }
      /* MAJUSCULE (position 0 seulement, hors boucle générique) : on ne touche QUE le PREMIER
         caractère — la règle reconstruit sa sugg par charAt(0).toUpperCase()+slice(1), donc
         l'auto-validation réussit par construction (même sur un acronyme : ONU→oNU→ONU). */
      if (T.length >= 2 && /^[A-ZÀ-Ý]/.test(T[0]) && l.startsWith(T[0])) {
        const bas = T[0].charAt(0).toLowerCase() + T[0].slice(1);
        const sfxM = bas + l.slice(T[0].length);
        const flM = C.spell(sfxM, true);
        for (const f2 of flM) {
          if (f2.i === 0 && f2.name === FAMS.maj.nom && (f2.sugg || '').toLowerCase() === T[0].toLowerCase() &&
              R.maj.justes.length < 6000) { R.maj.justes.push({ s: sfxM, i: 0, tok: bas, sugg: f2.sugg }); break; }
        }
      }
    }
  }
  const dst = path.join(REPO, 'data_local', 'distill_vig_dump.json');
  fs.writeFileSync(dst, JSON.stringify(R));
  const bilan = Object.keys(R).map(f => f + ' ' + R[f].oranges.length + '+' + R[f].justes.length + 'j').join(' · ');
  console.log('dump : ' + vus + ' phrases → ' + bilan + ' → ' + dst);
})();
