// Test headless de la VIGILANCE accord sujet-verbe (orange « à vérifier ») de l'app.
// Le ROUGE (rAccordSVnoun) se limite au sujet EN TÊTE de proposition (FP=0). L'ORANGE = le même
// détecteur SANS cette garde clause-init → couvre le sujet MID-phrase que le rouge doit abstenir.
// DOCTRINE : doute → orange, jamais silence (ne pas priver le dys d'un signal parce qu'on n'est pas sûr à 100 %).
// Flood mesuré : 0,235 %/phrase de faux sur UD (relatives/coordination/titres résiduels) — non-affirmatif.
// Charge le stack complet (vdc-lex→CONJ_C, speller-lex, pos-hmm→tagger, noun-post, gdet) et exécute spellText.
const fs = require('fs'), path = require('path');
const HTML = path.join(__dirname, '..', 'app', 'omega-pendu.html');
const html = fs.readFileSync(HTML, 'utf8');
const i0 = html.indexOf('mode PHRASES'), start = html.indexOf('(function(){', i0);
const spIdx = html.indexOf('function spellText', start);
const cut = html.indexOf('return out;}', spIdx) + 'return out;}'.length;
if (start < 0 || spIdx < 0 || cut < 0) { console.error('extraction échouée'); process.exit(2); }
const code = html.slice(start, cut) + ';globalThis.__C={spell:spellText,setSeg:(s)=>{_SEG=_segInfo(s);},loadSp:loadSpellerLex,loadNP:loadNounPost,loadG:loadGenderLex,loadH:loadPosHmm,ready:()=>SP.ready};})();';
function blob(id){ const m = html.match(new RegExp('id="'+id+'">([\\s\\S]*?)</script>')); return m ? m[1] : ''; }
const B = {'vdc-lex':blob('vdc-lex'),'speller-lex-gz':blob('speller-lex-gz'),'noun-post-gz':blob('noun-post-gz'),'pos-hmm-gz':blob('pos-hmm-gz'),'gdet-lex-gz':blob('gdet-lex-gz')};
const stub = new Proxy(function(){}, { get(t,k){ if(k==='style')return {}; if(k==='classList')return {add(){},remove(){},toggle(){},contains:()=>false}; return stub; }, set:()=>true, apply:()=>stub });
global.document = { getElementById:(id)=> (B[id]!==undefined && B[id]!=='') ? {textContent:B[id]} : stub, createElement:()=>stub, body:stub, head:stub, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] };
global.window = global; global.navigator = { userAgent:'node' };
global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
try { (0, eval)(code); } catch (e) { console.error('IIFE eval échoué :', e.message); process.exit(2); }
const C = globalThis.__C;

(async () => {
  await C.loadSp(); if (C.loadNP) await C.loadNP(); if (C.loadG) await C.loadG(); if (C.loadH) await C.loadH();
  if (!C.ready()) { console.error('speller non chargé — abandon'); process.exit(2); }
  const sv = (s) => { C.setSeg(s); return (C.spell(s) || []).filter(f => f.name === 'accord sujet-verbe à vérifier'); };
  // [phrase, doit-déclencher, suggestion attendue si oui]
  const CASES = [
    // FIRE : désaccord sujet-verbe où le sujet N'EST PAS en tête (le rouge abstient) → orange
    ['Je pense que les enfants joue dehors', true, 'jouent'],
    ['Les voitures roule vite',              true, 'roulent'],
    ['Il dit que les voisins parle fort',    true, 'parlent'],
    ['Je pense que les soldats devint courageux', true, 'devinrent'],   // passé simple PUR (devint) : gaté en ROUGE → surgit en ORANGE
    // NO-FIRE : texte correct (aucune fausse vigilance)
    ['Les enfants jouent dehors',            false, null],
    ['Il devint plus fort avec le temps',    false, null],             // PS correct (il+devint 3s) → aucune fausse vigilance ; « fut/dit/mis » homographes exclus du lexique PS → pas de flood
    ['Je pense que le chien dort',           false, null],
    ['Le chat mange sa croquette',           false, null],
    ['Les élèves de la classe travaillent',  false, null],
  ];
  const fail = [];
  for (const [s, expect, sugg] of CASES) {
    const r = sv(s), got = r.length > 0;
    if (got !== expect) fail.push(`[${s}] → ${got ? JSON.stringify(r[0].sugg) : 'aucun'} (attendu ${expect ? sugg : 'aucun'})`);
    else if (expect && (r[0].sugg || '').toLowerCase() !== sugg) fail.push(`[${s}] → sugg ${r[0].sugg} ≠ ${sugg}`);
  }
  // ACCORD PARTICIPE après être 3pl (« les élèves sont arrivé »→arrivés) — orange, FP=0 (seul flag UD = vraie faute « sont remplacé »)
  const pe = (s) => { C.setSeg(s); return (C.spell(s) || []).filter(f => f.name === 'accord participe à vérifier'); };
  const PE = [
    ['les élèves sont arrivé', true, 'arrivés'],
    ['les travaux sont terminé', true, 'terminés'],
    ['les élèves sont arrivés', false, null],   // déjà accordé
    ['il est arrivé hier', false, null],         // singulier (est) hors 3pl
    ['ils se sont succédé', false, null],        // pronominal → participe invariable
  ];
  for (const [s, expect, sugg] of PE) {
    const r = pe(s), got = r.length > 0;
    if (got !== expect) fail.push(`[participe ${s}] → ${got ? JSON.stringify(r[0].sugg) : 'aucun'} (attendu ${expect ? sugg : 'aucun'})`);
    else if (expect && (r[0].sugg || '') !== sugg) fail.push(`[participe ${s}] → sugg ${r[0].sugg} ≠ ${sugg}`);
  }
  if (fail.length) { console.error('✗ ÉCHEC vigilance sujet-verbe / participe :\n  ' + fail.join('\n  ')); process.exit(1); }
  console.log(`✓ OK : vigilance accord sujet-verbe + participe (orange) — ${CASES.filter(c=>c[1]).length + PE.filter(c=>c[1]).length} déclenchements, ${CASES.filter(c=>!c[1]).length + PE.filter(c=>!c[1]).length} textes corrects sans fausse alerte.`);
})();
