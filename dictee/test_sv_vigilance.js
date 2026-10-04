// Test headless de la VIGILANCE accord sujet-verbe (orange « à vérifier ») de l'app.
// Le ROUGE (rAccordSVnoun) se limite au sujet EN TÊTE de proposition (FP=0). L'ORANGE = le même
// détecteur SANS cette garde clause-init → couvre le sujet MID-phrase que le rouge doit abstenir.
// DOCTRINE : doute → orange, jamais silence (ne pas priver le dys d'un signal parce qu'on n'est pas sûr à 100 %).
// Flood mesuré : 0,235 %/phrase de faux sur UD (relatives/coordination/titres résiduels) — non-affirmatif.
// Charge le stack complet (vdc-lex→CONJ_C, speller-lex, pos-hmm→tagger, noun-post, gdet) et exécute spellText.
const fs = require('fs'), path = require('path');
const HTML = path.join(__dirname, '..', 'app', 'omega-pendu.html');
const html = fs.readFileSync(HTML, 'utf8'); try{globalThis.OMEGA_VDC=require('./blobgz').vdcSeed(html);}catch(e){}   // #30 : seed sync vdc-lex-gz (le moteur peuple les maps grammaire sans async)
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
  // ⭐ 28/09/2026 — « SONT + ADJECTIF » (attributPlVig) : après sont/étaient/furent/seront, un ADJECTIF ou un participe IRRÉGULIER
  // sans marque du pluriel → la marque du nombre (orange), genre écrit gardé. [phrase, nom de règle attendu | null, suggestion]
  const AD_NOMS = { adj: 'accord adjectif à vérifier', pp: 'accord participe à vérifier' };
  const ad = (s) => { C.setSeg(s); return (C.spell(s) || []).filter(f => f.name === AD_NOMS.adj || f.name === AD_NOMS.pp); };
  const AD = [
    ['les résultats sont exploitable', 'adj', 'exploitables'],   // épicène (hors paire de genre)
    ['les voisins étaient insolent', 'adj', 'insolents'],       // lu VERBE par le tagger
    ['les données sont disponible en ligne', 'adj', 'disponibles'],
    ['les décisions sont prise trop vite', 'pp', 'prises'],      // participe irrégulier, genre écrit gardé
    ['les sommes sont due à la banque', 'pp', 'dues'],
    ['les retards sont due à la neige', null, null],            // sujet masculin + forme féminine : genre en conflit → rien (pas « dues »)
    ['ils sont bien sûr partis', null, null],                   // « bien sûr » : locution
    ['ils sont mal à l\'aise', null, null],                     // « mal » adverbe
    ['ils sont juste là', null, null],                          // « juste » adverbe
    ['les chemises sont orange', null, null],                   // couleur invariable
    ['vous êtes prêt', null, null],                             // vous de politesse : « êtes » hors cadre
    ['ils sont heureuse', null, null],                          // genre en conflit avec « ils » : rien
    ['les enfants se sont succédé', null, null],                // pronominal (« se » complément indirect) : invariable
    ['les murs sont blanc cassé', null, null],                  // couleur composée
  ];
  for (const [s, kind, sugg] of AD) {
    const r = ad(s), got = r.length > 0;
    if (got !== !!kind) fail.push(`[attribut ${s}] → ${got ? JSON.stringify(r[0].sugg) + ' ' + r[0].name : 'aucun'} (attendu ${kind ? sugg : 'aucun'})`);
    else if (kind && ((r[0].sugg || '') !== sugg || r[0].name !== AD_NOMS[kind])) fail.push(`[attribut ${s}] → ${r[0].sugg} [${r[0].name}] ≠ ${sugg} [${AD_NOMS[kind]}]`);
  }
  // ⭐ 29/09/2026 — orange de pluriel : jamais sur un INFINITIF (ni l'adverbe qui suit) derrière les/ces/ses — « les » pronom, « ces » pour « se ».
  const pv = (s) => { C.setSeg(s); return (C.spell(s) || []).filter(f => f.name === 'accord pluriel à vérifier'); };
  for (const s of ['Il faudra les vendre en ville.', 'Tu dois ces reposer calmement.']) {
    const r = pv(s); if (r.length) fail.push(`[pluriel ${s}] → ${r.map(f => f.word + '→' + f.sugg).join(', ')} (attendu aucun)`);
  }
  // ⭐ 29/09/2026 — un nombre EN CHIFFRES ≥ 2 joue le rôle du cardinal (orange) ; jamais une année, une date, une adresse, une unité, un numéro.
  for (const [s, w, sg] of [['Nous avons planté 40 pommier.', 'pommier', 'pommiers'], ['Elle a 3 frère et 2 sœur.', 'frère', 'frères'],
                            // ⭐ 04/10/2026 : nom tagué PROPN (le chiffre n'est pas un mot), lecture verbale (minute), « il MESURE 2 mètre », silencieux appris contourné
                            ['Il y en a pour 5 euro.', 'euro', 'euros'], ['Une ferme de 20 hectare.', 'hectare', 'hectares'], ['On a 10 minute.', 'minute', 'minutes'],
                            ['Il mesure 2 mètre.', 'mètre', 'mètres']]) {
    const r = pv(s).filter(f => f.word === w); if (!r.length || r[0].sugg !== sg) fail.push(`[chiffres ${s}] → ${r.length ? r[0].sugg : 'aucun'} (attendu ${sg})`);
  }
  for (const s of ['Il habite au 42 boulevard Voltaire.', 'La saison 5 épisode 8 commence.', 'Il est né en 2012 dans le Nord.', 'Le 25 mars il pleut.', 'Il court 4 min par jour.', 'Il a 1 frère.',
                   'Il a 512 kilo-octets de mémoire.', 'Le 25 maie il pleut.', 'Vers 450 grâce au roi, la ville grandit.']) {   // ⭐ 04/10/2026 : composé, date (mois mal écrit), année + locution
    const r = pv(s); if (r.length) fail.push(`[chiffres ${s}] → ${r.map(f => f.word + '→' + f.sugg).join(', ')} (attendu aucun)`);
  }
  // ⭐ 29/09/2026 — « infinitif après semi-auxiliaire » : les prises restent (suggestion accentuée), 4 faux positifs mesurés tombent.
  const si = (s) => { C.setSeg(s); return (C.spell(s) || []).filter(f => f.name === 'infinitif après semi-auxiliaire à vérifier'); };
  for (const [s, w, sg] of [['Elle ne peut plus marche.', 'marche', 'marcher'], ['On pouvait regardé la mer.', 'regardé', 'regarder'], ['Il se fit renversé par un vélo.', 'renversé', 'renverser'],
                           ['Vous faites mange le chien.', 'mange', 'manger'], ['Il va réussi son examen.', 'réussi', 'réussir'], ['Il doit été là.', 'été', 'être']]) {
    const r = si(s).filter(f => f.word === w); if (!r.length || r[0].sugg !== sg) fail.push(`[semi-aux ${s}] → ${r.length ? r[0].sugg : 'aucun'} (attendu ${sg})`);
  }
  for (const s of ["Les photos que j'ai faites ont été publiées.", "C'est tout à fait différent.", 'Ils sont en fait utilisés partout.', "L'éponge de ce fait absorbe l'eau.",
                   'Ce fait pourrait tout changer.', 'Il va en prison.', 'On doit la série à sa sœur.', 'Le satellite IRAS avait photographié la galaxie.']) {
    const r = si(s); if (r.length) fail.push(`[semi-aux ${s}] → ${r.map(f => f.word + '→' + f.sugg).join(', ')} (attendu aucun)`);
  }
  if (fail.length) { console.error('✗ ÉCHEC vigilance sujet-verbe / participe / attribut :\n  ' + fail.join('\n  ')); process.exit(1); }
  console.log(`✓ OK : vigilance accord sujet-verbe + participe + attribut après « sont » (orange) — ${CASES.filter(c=>c[1]).length + PE.filter(c=>c[1]).length + AD.filter(c=>c[1]).length} déclenchements, ${CASES.filter(c=>!c[1]).length + PE.filter(c=>!c[1]).length + AD.filter(c=>!c[1]).length} textes corrects sans fausse alerte.`);
})();
