// recall_en_ctx_probe.js — BANC CONTEXTUEL du speller ANGLAIS (2026-08-03).
// POURQUOI : le banc existant (recall_en_probe.py) est en mots ISOLÉS. Il ne peut donc pas mesurer un
// classement par CONTEXTE, et surtout il compte CHAQUE faute une fois — y compris des mots rares que
// personne n'écrit. Résultat : il est aveugle aux gains sur les mots FRÉQUENTS, qui sont justement ceux
// qu'on tape. Mesuré : le passage au score combiné n'y bouge RIEN (WRONG 409) alors qu'il divise par
// deux les mauvaises cibles ici (11,0 % -> 5,6 %).
// PRINCIPE : vraies phrases (UD English-EWT) x vraies fautes (Wikipédia common misspellings). On injecte
// une faute attestée à la place du mot correct DANS sa phrase, et on regarde la cible proposée en tête.
// Les deux corpus sont LOCAUX (non commités) -> le probe se saute proprement s'ils manquent.
//   node dictee/recall_en_ctx_probe.js
const path=require('path'); const R=path.join(__dirname,'..')+path.sep;
const fs=require('fs'), C=require(path.join(__dirname,'corrector_en.js'));
for(const f of ['data_local/en/wiki_misspell.txt','data_local/en_ewt-ud-train.conllu','dictee/pos_hmm_en.json'])
  if(!fs.existsSync(R+f)){ console.log('[SKIP] '+f+' absent (banc local)'); process.exit(0); }
C.setPosModel(JSON.parse(fs.readFileSync(R+'dictee/pos_hmm_en.json','utf8')));
const lex=C.loadLexNode(R+'dictee/lex_en.tsv.gz');
// gold -> [typos]
const M=new Map();
for(const l of fs.readFileSync(R+'data_local/en/wiki_misspell.txt','utf8').split('\n')){
  const m=l.match(/^\* \{\{search link\|"?([a-z]+)"?\|[^}]*\}\} \(\[?\[?([a-zA-Z]+)\]?\]?\)/);
  if(!m) continue; const typo=m[1].toLowerCase(), gold=m[2].toLowerCase();
  if(typo===gold) continue; if(!M.has(gold)) M.set(gold,[]); M.get(gold).push(typo);
}
// phrases EWT
let cur=[],sents=[];
for(const l of fs.readFileSync(R+'data_local/en_ewt-ud-train.conllu','utf8').split('\n')){
  if(l.startsWith('#'))continue;
  if(!l.trim()){ if(cur.length)sents.push(cur); cur=[]; continue; }
  const c=l.split('\t'); if(c.length<4||c[0].includes('-')||c[0].includes('.'))continue; cur.push(c[1]);
}
let n=0,top=0,wrong=0,none=0; const ex=[];
for(const T of sents){
  for(let i=0;i<T.length;i++){
    const gold=T[i].toLowerCase(); const ts=M.get(gold); if(!ts) continue;
    if(T[i][0]!==T[i][0].toLowerCase()) continue;             // le speller saute les capitalisés
    const typo=ts[0]; const S=T.slice(); S[i]=typo;
    const [sug]=C.spellSuggest(lex,typo);
    n++; if(sug===gold)top++; else if(sug)  {wrong++; if(ex.length<8)ex.push(typo+' -> '+sug+'  (attendu '+gold+')  « '+S.slice(Math.max(0,i-3),i+4).join(' ')+' »');}
    else none++;
    break;                                                    // une injection par phrase
  }
}
console.log('BANC CONTEXTUEL — %d phrases exploitables', n);
console.log('  en TÊTE (bonne cible)  : %d  (%s%%)', top, (100*top/Math.max(1,n)).toFixed(1));
console.log('  mauvaise cible          : %d  (%s%%)', wrong, (100*wrong/Math.max(1,n)).toFixed(1));
console.log('  rien proposé            : %d  (%s%%)', none, (100*none/Math.max(1,n)).toFixed(1));
console.log('\n  exemples de mauvaise cible :'); for(const e of ex) console.log('    '+e);
