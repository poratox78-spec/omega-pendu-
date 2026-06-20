// Mesure le winrate du moteur PAR TRANCHE DE LONGUEUR, pour un lexique donné.
// But : voir l'effet d'embarquer TOUS les mots (mots courts ajoutés) — séparé par longueur
// (doctrine §1 : ne pas noyer le régime court dans l'agrégat).
//
//   node evo/measure_lex_bylen.js <app|/chemin/full.b64> [K=150] [seed=777]
//
// 'app' = lexique embarqué actuel (7-15). Un chemin .b64 = lexique injecté (ex. complet).
// Config de référence appliquée (cohorte/declares ON) — sinon le lexique ne pèse pas.
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app', 'omega-pendu.html');

function loadEngine(lexB64) {
  const html = fs.readFileSync(APP, 'utf8');
  const parts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  let js = '', lex = '';
  for (const m of parts) {
    if (/lex4-data-gz/.test(m[1])) lex = m[2];
    else if (/application\/json/.test(m[1])) continue;
    else js += '\n;\n' + m[2];
  }
  if (lexB64) lex = lexB64;   // INJECTION
  const stub = new Proxy(function(){}, { get:(t,p)=>{ if(p==='style')return {}; if(p==='textContent')return ''; if(p==='classList')return {add(){},remove(){},toggle(){},contains:()=>false}; if(p==='getContext')return ()=>stub; return stub; }, set:()=>true, apply:()=>stub, construct:()=>stub });
  global.document = { getElementById:(id)=> id==='lex4-data-gz' ? {textContent:lex} : stub, head:stub, querySelector:()=>stub, querySelectorAll:()=>[], createElement:()=>stub, addEventListener(){}, body:stub, documentElement:stub, getElementsByTagName:()=>[] };
  global.addEventListener=()=>{}; global.removeEventListener=()=>{}; global.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
  global.getComputedStyle=()=>({getPropertyValue:()=>''}); global.AudioContext=function(){return stub;}; global.webkitAudioContext=global.AudioContext;
  global.window=global; global.requestAnimationFrame=()=>0; global.cancelAnimationFrame=()=>{};
  global.setTimeout=()=>0; global.setInterval=()=>0; global.clearTimeout=()=>{}; global.clearInterval=()=>{};
  global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  global.performance={now:()=>Number(process.hrtime.bigint())/1e6}; try{global.navigator={userAgent:'node'};}catch(e){} global.alert=()=>{};
  const exp = `;globalThis.__O={
    loadLex:(typeof loadOmegaLex4!=='undefined')?loadOmegaLex4:null,
    init:(typeof initOmegaGlobals!=='undefined')?initOmegaGlobals:null,
    startNewGame:(typeof startNewGame!=='undefined')?startNewGame:null,
    omegaStep:(typeof omegaStep!=='undefined')?omegaStep:null,
    setSeed:(s)=>{ try{ _omegaSeed=s; if(typeof makeMulberry32!=='undefined')_omegaRng=makeMulberry32(s);}catch(e){} },
    ref:()=>{ try{ return (typeof applyReferenceConfig!=='undefined')?applyReferenceConfig():'no-ref'; }catch(e){ return 'ERR '+e.message; } },
    get active(){return (typeof gameActive!=='undefined')?gameActive:undefined},
    get won(){return (typeof lastGameWon!=='undefined')?lastGameWon:undefined},
    get word(){return (typeof currentWord!=='undefined')?currentWord:undefined},
    get tried(){return (typeof alreadyTried!=='undefined')?alreadyTried:undefined},
    evalIn:(c)=>eval(c) };`;
  eval(js + exp);
  return globalThis.__O;
}
function snap(O){ const t=O.tried,w=O.word; if(!t||!w)return null; let coups=0,err=0; for(let i=0;i<26;i++){ if(t[i]){coups++; if(!w.includes(String.fromCharCode(65+i)))err++;} } return {coups,err}; }
function playOne(O,w){ O.startNewGame(w); let sf=300,last=snap(O); while(O.active&&sf-->0){ O.omegaStep(); const s=snap(O); if(s)last=s; } return {won:!!O.won, err:last?last.err:0}; }
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

(async () => {
  const arg = process.argv[2] || 'app';
  const K = +(process.argv[3] || 150);
  const seed = +(process.argv[4] || 777);
  const lexB64 = (arg === 'app') ? null : fs.readFileSync(arg, 'utf8').trim();
  const O = loadEngine(lexB64);
  if (O.loadLex) await O.loadLex();
  const refRes = O.ref();
  const nW = O.evalIn('OMEGA_LEX4 && OMEGA_LEX4.n_words');
  console.log(`lexique=${arg}  n_words=${nW}  ref=${refRes}  K=${K}  seed=${seed}`);
  // Le pendu ne joue que 7-15 (pickWords + MIN/MAX_WORD_LEN). On mesure CES bandes
  // (régression cohorte avec la base complète). Les mots courts servent correcteur/dictée, pas le pendu.
  const bands = [[7,7],[8,9],[10,12],[13,15]];
  for (const [lo,hi] of bands) {
    const FMIN = +(process.argv[5] || 0);   // filtre fréquence du pool (mime la règle de pioche du pendu)
    let pool = [];
    for (let L=lo; L<=hi; L++) {
      const arr = O.evalIn(`(OMEGA_LEX4.len_index["${L}"]||[]).filter(function(i){return (OMEGA_LEX4.words[i].f||0) >= ${FMIN};}).map(function(i){return OMEGA_LEX4.words[i].m;})`);
      if (arr && arr.length) pool = pool.concat(arr);
    }
    if (!pool.length) { console.log(`  [${lo}-${hi}] vide`); continue; }
    const rng = mulberry32(seed + lo*131 + hi);
    const used = new Set(), sample = [];
    for (let i=0; i<K && used.size<pool.length; i++) { let idx; do { idx=Math.floor(rng()*pool.length); } while(used.has(idx)); used.add(idx); sample.push(pool[idx]); }
    let won=0, errSum=0;
    for (const w of sample) { const x=playOne(O,w); if(x.won)won++; errSum+=x.err; }
    console.log(`  [${lo}-${hi}]  n=${sample.length}  winrate=${(100*won/sample.length).toFixed(1)}%  err/partie=${(errSum/sample.length).toFixed(2)}  (pool=${pool.length})`);
  }
})().catch(e => { console.error(e); process.exit(1); });
