// imp_probe.js — VERROU CI du MOVER impératif (placement des pronoms clitiques).
//  1) parité JS : le bloc _impMoves de l'app == celui de l'extension (source identique).
//  2) correction : app _impMoves applique EXACTEMENT les cas attendus (dictee/imp_cases.json).
//  3) FP=0 : les phrases « nofire » (français correct) ne déclenchent AUCUN move.
// Usage : node dictee/imp_probe.js [--check]   (--check → exit 1 si échec, pour la CI)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const html = fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8');
const ext = fs.readFileSync(path.join(ROOT, 'extension', 'dys-core.js'), 'utf8');

function impBlock(src) {           // extrait le bloc _impMoves (helpers inclus) : de « var _IMPVOW= » à la fin de _impMoves
  const a = src.indexOf('var _IMPVOW=');
  const e = src.indexOf('return out;}', src.indexOf('function _impMoves'));
  return a >= 0 && e >= 0 ? src.slice(a, e + 'return out;}'.length) : '';
}
const fails = [];
const ba = impBlock(html), be = impBlock(ext);
if (!ba) fails.push('bloc _impMoves introuvable dans l\'app');
if (ba && be && ba !== be) fails.push('PARITÉ : le mover app ≠ extension (source divergente)');

// charge l'app (blobs) → _impMoves avec le VRAI COMMON_VERBS
const i0 = html.indexOf('mode PHRASES'), start = html.indexOf('(function(){', i0);
const spIdx = html.indexOf('function spellText', start);
const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
const code = html.slice(start, cut) + ';globalThis.__M=_impMoves;})();';
function blob(id){const key='id="'+id+'">';const a=html.indexOf(key);if(a<0)return '';const s=a+key.length;const e=html.indexOf('</script>',s);return e<0?'':html.slice(s,e);}
const B={'vdc-lex':blob('vdc-lex'),'speller-lex-gz':blob('speller-lex-gz'),'noun-post-gz':blob('noun-post-gz'),'pos-hmm-gz':blob('pos-hmm-gz'),'gdet-lex-gz':blob('gdet-lex-gz')};
const stub=new Proxy(function(){},{get(t,k){if(k==='style')return{};if(k==='classList')return{add(){},remove(){},toggle(){},contains:()=>false};return stub;},set:()=>true,apply:()=>stub});
global.document={getElementById:(id)=>B[id]!==undefined&&B[id]!==''?{textContent:B[id]}:stub,createElement:()=>stub,body:stub,head:stub,addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
global.window=global;global.navigator={userAgent:'node'};global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
(0,eval)(code);
const move = globalThis.__M;
function apply(text){const ms=move(text).slice().sort((a,b)=>b[0]-a[0]);let t=text;for(const m of ms)t=t.slice(0,m[0])+m[2]+t.slice(m[1]);return t;}

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'imp_cases.json'), 'utf8'));
let okT=0;
for (const [bad, good] of cases.transform) {
  const got = apply(bad);
  if (got === good) okT++; else fails.push('TRANSFORM « '+bad+' » → attendu « '+good+' » | obtenu « '+got+' »');
}
let okN=0;
for (const s of cases.nofire) {
  const ms = move(s);
  if (ms.length === 0) okN++; else fails.push('NO-FIRE « '+s+' » a déclenché : '+JSON.stringify(ms));
}
console.log('mover impératif — parité app==ext : '+(ba&&be&&ba===be?'OK':'ÉCHEC')+
            ' | transform '+okT+'/'+cases.transform.length+' | no-fire '+okN+'/'+cases.nofire.length);
if (fails.length) { fails.forEach(f=>console.log('  ✗ '+f)); if (CHECK) process.exit(1); }
else console.log('  ✅ mover impératif verrouillé (parité + '+cases.transform.length+' corrections + FP=0).');
