// Test headless de la couche VERTE : extrait renderCorr() + les helpers _vig* du monolithe, stubbe le DOM + le bloc
// vdc-confusables, et vérifie que les confusables sont soulignés (vdc-vig) avec une infobulle sensée. Lancer : node evo/vig_render_test.js
const fs=require('fs'), path=require('path');
const HTML=path.join(__dirname,'..','app','omega-pendu.html');
const html=fs.readFileSync(HTML,'utf8');
const conf=(html.match(/<script type="application\/json" id="vdc-confusables">([\s\S]*?)<\/script>/)||[])[1]||'{}';
const start=html.indexOf('(function(){',html.indexOf('mode PHRASES'));
const END='o+=esc(text.slice(last));return o;}';
const rcEnd=html.indexOf(END,start)+END.length;
if(start<0||rcEnd<END.length){console.error('extraction KO');process.exit(2);}
const code=html.slice(start,rcEnd)+';globalThis.__rc=renderCorr;})();';
const el=()=>new Proxy(function(){},{get(t,k){if(k==='textContent'||k==='innerHTML'||k==='value')return t['_'+k]||'';if(k==='style')return{};if(k==='classList')return{add(){},remove(){},toggle(){},contains(){return false;}};if(k===Symbol.toPrimitive)return()=>'';return el();},set(t,k,v){t['_'+k]=v;return true;},apply(){return el();}});
global.document={getElementById:(id)=>id==='vdc-confusables'?{textContent:conf}:(id==='vdc-lex'?{textContent:'{}'}:el()),createElement:()=>el(),body:el(),head:el(),addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
global.window=el();global.navigator={userAgent:''};global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};global.speechSynthesis={speak(){},cancel(){},getVoices:()=>[]};global.SpeechSynthesisUtterance=function(){return el();};
try{(0,eval)(code);}catch(e){console.error('exec KO :',e.message);process.exit(2);}
const rc=globalThis.__rc;
console.log('confusables embarqués : '+(conf.length)+' o\n');
const tests=['il porte une paire de lunettes','il parle à son père','un verre de vin','la mer est calme',
             'le compte est bon','un conte pour enfants','rien à signaler dans cette phrase'];
let tot=0;
for(const t of tests){ const out=rc(t,[]); const n=(out.match(/class="vdc-vig"/g)||[]).length; tot+=n;
  const titles=[...out.matchAll(/class="vdc-vig" title="([^"]*)"/g)].map(m=>m[1]);
  console.log(`"${t}"  → ${n} 🟢`); titles.forEach(x=>console.log('     '+x)); }
console.log(`\n${tot} soulignements verts au total · exécution sans crash ✓`);
