'use strict';
/* ⭐ 08/11/2026 (liste n° 457) — CONTRÔLE COMPLET DES PARTICIPES, au PRODUIT (juge chargé), par FAMILLE et non par tournure.
   Voulu par Rem (08/11) : plus aucune faute tolérée sur le participe après avoir, une table et un contrôle complet, être
   vérifié en même temps. Phrases inventées par gabarit : chaque forme JUSTE (aucune marque attendue) et chaque forme FAUTIVE (la bonne
   attendue), dans chaque contexte :
     ancien contrôle (ligne 345) — être passif / pronom / nom, sujets coordonnés, pronominal, avoir + le / la / les, avoir + que,
       épithète, a été ; 41 verbes transitifs (6 du 3e groupe ajoutés à la ligne 460), 14 verbes à être, 10 pronominaux ;
       la ligne 460 (participe accordé avec le NOM qui le commande) se lit dans les contextes être, a été, avoir + que,
       avoir + le/la/les et épithète ;
     famille « pronom personne » (ligne 457) — pour chaque participe de la table de valence (dictee/valence_table.json, D / I / DI) :
       A. avoir + me / nous devant (« Le guide nous a aidés. »)       D → accord (nous : pluriel, genre libre) ; I → invariable
       B. avoir + me / nous + complément après (« … nous a montré la route. ») → invariable
       C. être pronominal (« Elles se sont aidées. » D ; « Elles se sont parlé. » « se » indirect sûr) — DI : pas d'attente
       D. être pronominal + complément après (« Elle s'est lavé les mains. ») → invariable
   Résultat par contexte × classe × faute : ok / MARQUE FAUSSE (forme juste) ; rouge juste / orange juste / muet / mauvais mot /
   ROUGE mauvais mot (forme fautive).
     node dictee/participes_probe.js            tableau complet (≈ 21 000 phrases, ≈ 4 min)
     node dictee/participes_probe.js --check    une phrase sur deux, contre dictee/participes_ref.json : aucun contexte ne recule
                                                 (plus de marques fausses, de rouges au mauvais mot, de mauvais mots ou de muets) ;
                                                 et la table recopiée dans le moteur (_VAL457) == dictee/valence_table.json
     node dictee/participes_probe.js --fix      réécrit la référence (après un progrès vérifié) */
const path = require('path'), fs = require('fs');
const RACINE = path.join(__dirname, '..');
const MODE = process.argv.includes('--check') ? 'check' : process.argv.includes('--fix') ? 'fix' : 'voir';
const REF = path.join(__dirname, 'participes_ref.json');
const TAB = JSON.parse(fs.readFileSync(path.join(__dirname, 'valence_table.json'), 'utf8'));
const deacc = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
let bad = 0;
// 1. la table recopiée dans le moteur == le fichier de la table
{
  const core = fs.readFileSync(path.join(RACINE, 'extension', 'dys-core.js'), 'utf8'), m = {};
  const re = /'([a-z ]+)'\.split\(' '\)\.forEach\(function\(w\)\{_VAL457\[w\]='(D|I|DI)';\}\)/g; let x;
  while ((x = re.exec(core))) for (const w of x[1].split(' ')) m[w] = x[2];
  const t = {}; for (const [w, c] of Object.entries(TAB)) t[deacc(w)] = c;
  const diff = [...new Set([...Object.keys(m), ...Object.keys(t)])].filter((w) => m[w] !== t[w]);
  if (!Object.keys(m).length) { console.log('✗ table _VAL457 introuvable dans extension/dys-core.js'); bad++; }
  else if (diff.length) { console.log('✗ table du moteur ≠ dictee/valence_table.json :', diff.slice(0, 12).join(', ')); bad++; }
  else console.log('✓ table de valence : moteur == dictee/valence_table.json (' + Object.keys(t).length + ' participes)');
}
// 2. les phrases
const P = [];   // {t, w, ok:[formes justes], ctx, err}
const formes = (ms) => (ms === 'dû' ? { ms: 'dû', fs: 'due', mp: 'dus', fp: 'dues' } : { ms, fs: ms + 'e', mp: /[sx]$/.test(ms) ? ms : ms + 's', fp: ms + 'es' });
const INF = (ms) => (/é$/.test(ms) ? ms.slice(0, -1) + 'er' : null);
function ajoute(ctx, ms, okKeys, gab) {   // la forme juste (une ou plusieurs) et chaque mauvaise forme, avec le nom de la faute
  const F = formes(ms), ok = [...new Set(okKeys.map((k) => F[k]))];
  for (const w of ok) P.push({ t: gab(w), w, ok, ctx, err: 'juste' });
  const vus = new Set(ok);
  for (const k of ['ms', 'fs', 'mp', 'fp']) {
    const w = F[k]; if (vus.has(w)) continue; vus.add(w);
    const g = okKeys.some((o) => o[0] === k[0]) ? '' : (k[0] === 'f' ? 'féminin en trop' : 'féminin manquant');
    const n = okKeys.some((o) => o[1] === k[1]) ? '' : (k[1] === 'p' ? 'pluriel en trop' : 'pluriel manquant');
    P.push({ t: gab(w), w, ok, ctx, err: [g, n].filter(Boolean).join(' + ') || 'accord faux' });
  }
  const inf = INF(ms); if (inf) P.push({ t: gab(inf), w: inf, ok, ctx, err: 'infinitif' });
}
// 2a. ancien contrôle (ligne 345) : [infinitif, participe m.s., nom m.s., nom f.s., nom m.p., nom f.p.]
const TR = [
  ['fermer', 'fermé', 'volet', 'porte', 'volets', 'fenêtres'], ['ouvrir', 'ouvert', 'carton', 'boîte', 'cartons', 'boîtes'],
  ['peindre', 'peint', 'mur', 'chambre', 'murs', 'portes'], ['écrire', 'écrit', 'message', 'lettre', 'messages', 'lettres'],
  ['lire', 'lu', 'livre', 'lettre', 'livres', 'lettres'], ['prendre', 'pris', 'gâteau', 'photo', 'gâteaux', 'photos'],
  ['mettre', 'mis', 'gant', 'robe', 'gants', 'chaussures'], ['faire', 'fait', 'gâteau', 'tarte', 'gâteaux', 'crêpes'],
  ['vendre', 'vendu', 'vélo', 'maison', 'vélos', 'voitures'], ['perdre', 'perdu', 'gant', 'clé', 'gants', 'clés'],
  ['finir', 'fini', 'devoir', 'soupe', 'devoirs', 'tartes'], ['choisir', 'choisi', 'livre', 'robe', 'livres', 'couleurs'],
  ['acheter', 'acheté', 'livre', 'voiture', 'livres', 'pommes'], ['manger', 'mangé', 'gâteau', 'pomme', 'gâteaux', 'pommes'],
  ['laver', 'lavé', 'verre', 'voiture', 'verres', 'assiettes'], ['réparer', 'réparé', 'vélo', 'voiture', 'vélos', 'chaises'],
  ['préparer', 'préparé', 'repas', 'soupe', 'plats', 'salades'], ['ranger', 'rangé', 'jouet', 'chambre', 'jouets', 'chemises'],
  ['couper', 'coupé', 'pain', 'corde', 'arbres', 'fleurs'], ['construire', 'construit', 'mur', 'maison', 'murs', 'maisons'],
  ['éteindre', 'éteint', 'feu', 'lampe', 'feux', 'lampes'], ['offrir', 'offert', 'cadeau', 'montre', 'cadeaux', 'fleurs'],
  ['recevoir', 'reçu', 'cadeau', 'lettre', 'cadeaux', 'lettres'], ['voir', 'vu', 'film', 'pièce', 'films', 'photos'],
  ['cuire', 'cuit', 'gâteau', 'tarte', 'gâteaux', 'tartes'], ['apprendre', 'appris', 'poème', 'leçon', 'poèmes', 'leçons'],
  ['comprendre', 'compris', 'texte', 'règle', 'textes', 'règles'], ['servir', 'servi', 'plat', 'soupe', 'plats', 'boissons'],
  ['remplir', 'rempli', 'verre', 'bouteille', 'verres', 'bouteilles'], ['couvrir', 'couvert', 'livre', 'table', 'livres', 'tables'],
  ['traduire', 'traduit', 'texte', 'lettre', 'textes', 'lettres'], ['battre', 'battu', 'record', 'équipe', 'records', 'équipes'],
  ['tenir', 'tenu', 'livre', 'promesse', 'livres', 'promesses'], ['devoir', 'dû', 'loyer', 'somme', 'loyers', 'sommes'],
  ['conduire', 'conduit', 'camion', 'voiture', 'camions', 'voitures'],
  // ligne 460 : participes du 3e groupe hors des tables du moteur (lus par l'infinitif refait)
  ['inscrire', 'inscrit', 'nom', 'date', 'noms', 'dates'], ['décrire', 'décrit', 'paysage', 'scène', 'paysages', 'scènes'],
  ['joindre', 'joint', 'fichier', 'pièce', 'fichiers', 'pièces'], ['découvrir', 'découvert', 'trésor', 'grotte', 'trésors', 'grottes'],
  ['produire', 'produit', 'film', 'série', 'films', 'séries'], ['repeindre', 'repeint', 'banc', 'grille', 'bancs', 'grilles'],
];
const ETRE = [['partir', 'parti'], ['venir', 'venu'], ['arriver', 'arrivé'], ['tomber', 'tombé'], ['rester', 'resté'], ['sortir', 'sorti'],
  ['rentrer', 'rentré'], ['naître', 'né'], ['mourir', 'mort'], ['monter', 'monté'], ['descendre', 'descendu'], ['entrer', 'entré'], ['retourner', 'retourné'], ['passer', 'passé']];
const PRON = [['laver', 'lavé'], ['cacher', 'caché'], ['coucher', 'couché'], ['lever', 'levé'], ['promener', 'promené'], ['habiller', 'habillé'],
  ['perdre', 'perdu'], ['asseoir', 'assis'], ['réveiller', 'réveillé'], ['préparer', 'préparé']];
const det = { ms: 'Le', fs: 'La', mp: 'Les', fp: 'Les' }, ce = { ms: 'Ce', fs: 'Cette', mp: 'Ces', fp: 'Ces' }, est = { ms: 'est', fs: 'est', mp: 'sont', fp: 'sont' };
for (const [, ms, Nms, Nfs, Nmp, Nfp] of TR) {
  const N = { ms: Nms, fs: Nfs, mp: Nmp, fp: Nfp };
  for (const c of ['ms', 'fs', 'mp', 'fp']) {
    ajoute('être (passif)', ms, [c], (x) => `${det[c]} ${N[c]} ${est[c]} ${x} depuis ce matin.`);
    ajoute('avoir + le/la/les avant', ms, [c], (x) => `${ce[c]} ${N[c]}, je ${c[1] === 'p' ? 'les ' : "l'"}ai ${x} hier.`);
    ajoute('avoir + que avant', ms, [c], (x) => `${det[c]} ${N[c]} que j'ai ${x} ${est[c]} là.`);
    ajoute('épithète', ms, [c], (x) => `${det[c]} ${N[c]} ${x} ${est[c]} là.`);
    if (c !== 'ms') ajoute('a été', ms, [c], (x) => `${det[c]} ${N[c]} ${c[1] === 'p' ? 'ont' : 'a'} été ${x} hier.`);
  }
  ajoute('avoir sans accord', ms, ['ms'], (x) => `Elle a ${x} la ${Nfs} hier.`);
  ajoute('avoir sans accord', ms, ['ms'], (x) => `Mes sœurs ont ${x} les ${Nmp} hier.`);
}
const SUJ = { ms: ['Il', 'Mon frère'], fs: ['Elle', 'Ma sœur'], mp: ['Ils', 'Mes frères'], fp: ['Elles', 'Mes sœurs'] };
for (const [, ms] of ETRE) for (const c of ['ms', 'fs', 'mp', 'fp']) {
  ajoute('être (pronom)', ms, [c], (x) => `${SUJ[c][0]} ${est[c]} ${x} hier.`);
  ajoute('être (nom)', ms, [c], (x) => `${SUJ[c][1]} ${est[c]} ${x} hier.`);
  if (c === 'mp') ajoute('sujets coordonnés', ms, [c], (x) => `Paul et Marie sont ${x} hier.`);
  if (c === 'fp') ajoute('sujets coordonnés', ms, [c], (x) => `Marie et Julie sont ${x} hier.`);
}
for (const [, ms] of PRON) for (const c of ['ms', 'fs', 'mp', 'fp'])
  ajoute('pronominal', ms, [c], (x) => `${SUJ[c][0]} ${c[1] === 'p' ? 'se sont' : "s'est"} ${x} tôt.`);
// 2b. famille « pronom personne » (ligne 457)
const PRON_I = new Set('parlé téléphoné plu déplu souri menti nui succédé ressemblé'.split(' '));   // « se » indirect SÛR : pas de lecture passive (« les lettres se sont écrites » : s'écrire reste ambigu, témoin de la ligne 93)
const SUJ_AV = [['Le guide', 'a'], ['Ma voisine', 'a']], SUJ_PR = [['Il', "s'est", 'ms'], ['Elle', "s'est", 'fs'], ['Ils', 'se sont', 'mp'], ['Elles', 'se sont', 'fp']];
const elid = (pr, next) => (/^[aeiouyhéèêâîôû]/i.test(next) && pr === 'me' ? "m'" : pr + ' ');
for (const [ms, cl] of Object.entries(TAB)) {
  for (const pr of ['me', 'nous']) for (const [s, aux] of SUJ_AV) {
    const pre = (x) => `${s} ${elid(pr, aux)}${aux} ${x}`, ctxA = 'A avoir + pronom ' + cl, ctxB = 'B avoir + pronom + complément ' + cl;
    if (cl === 'D') ajoute(ctxA, ms, pr === 'nous' ? ['mp', 'fp'] : ['ms', 'fs'], (x) => pre(x) + ' hier.');
    else if (cl === 'I') ajoute(ctxA, ms, ['ms'], (x) => pre(x) + ' hier.');
    else { const F = formes(ms); for (const w of new Set([F.ms, pr === 'nous' ? F.mp : F.fs])) P.push({ t: pre(w) + ' hier.', w, ok: [w], ctx: ctxA, err: 'juste' }); }
    ajoute(ctxB, ms, ['ms'], (x) => pre(x) + ' la route.');
  }
  for (const [s, aux, c] of SUJ_PR) {
    if (cl === 'D') ajoute('C être pronominal D', ms, [c], (x) => `${s} ${aux} ${x} hier.`);
    else if (PRON_I.has(ms)) ajoute('C être pronominal I', ms, ['ms'], (x) => `${s} ${aux} ${x} hier.`);
    ajoute('D être pronominal + complément ' + cl, ms, ['ms'], (x) => `${s} ${aux} ${x} la route.`);
  }
}
// 3. le produit
const L = MODE === 'voir' ? P : P.filter((p, k) => k % 2 === 0);
const D = require(path.join(RACINE, 'extension', 'charger_node.js'))({ ext: path.join(RACINE, 'extension'), juge: true });
const lo = (s) => String(s || '').toLowerCase(), T = {};
for (const p of L) {
  D.jugeAnalyseSync(p.t);
  const fl = (D.diagnoseAll(p.t).flags || []).filter((x) => lo(x.word) === lo(p.w) && !x.typo);
  let r;
  if (p.err === 'juste') r = fl.length ? 'MARQUE FAUSSE' : 'ok';
  else if (!fl.length) r = 'muet';
  else { const b = fl.find((x) => p.ok.includes(lo(x.sugg))); r = b ? (b.tier === 'vigilance' ? 'orange juste' : 'rouge juste') : (fl.some((x) => x.tier !== 'vigilance') ? 'ROUGE mauvais mot' : 'mauvais mot'); }
  const k = p.ctx + ' | ' + p.err; T[k] = T[k] || { n: 0 }; T[k].n++; T[k][r] = (T[k][r] || 0) + 1;
}
const MAUVAIS = ['MARQUE FAUSSE', 'ROUGE mauvais mot', 'mauvais mot', 'muet'];
const tot = {}; for (const v of Object.values(T)) for (const [a, b] of Object.entries(v)) if (a !== 'n') tot[a] = (tot[a] || 0) + b;
const justes = L.filter((p) => p.err === 'juste').length, fautes = L.length - justes;
console.log(`PARTICIPES — ${L.length} phrases (${justes} justes, ${fautes} fautives)${MODE === 'voir' ? '' : ', une sur deux'}`);
console.log(`  justes sans marque ${tot.ok || 0} / ${justes} · fautes trouvées ${(tot['rouge juste'] || 0) + (tot['orange juste'] || 0)} / ${fautes} · muettes ${tot.muet || 0} · mauvais mot ${tot['mauvais mot'] || 0} · ROUGE au mauvais mot ${tot['ROUGE mauvais mot'] || 0} · MARQUES FAUSSES ${tot['MARQUE FAUSSE'] || 0}`);
if (MODE === 'voir') for (const k of Object.keys(T).sort()) { const v = T[k]; console.log('  ' + k.padEnd(62), String(v.n).padStart(5), Object.entries(v).filter(([a]) => a !== 'n').map(([a, b]) => a + ' ' + b).join(' · ')); }
if (MODE === 'fix') { fs.writeFileSync(REF, JSON.stringify(T, Object.keys(T).sort().concat(['n', 'ok', 'MARQUE FAUSSE', 'rouge juste', 'orange juste', 'muet', 'mauvais mot', 'ROUGE mauvais mot']), 1) + '\n'); console.log('✓ référence réécrite : dictee/participes_ref.json'); }
if (MODE === 'check') {
  const R = JSON.parse(fs.readFileSync(REF, 'utf8')), rec = [];
  for (const k of new Set([...Object.keys(R), ...Object.keys(T)])) for (const m of MAUVAIS) {
    const a = (R[k] || {})[m] || 0, b = (T[k] || {})[m] || 0; if (b > a) rec.push(`${k} : ${m} ${a} → ${b}`);
  }
  if (rec.length) { console.log('✗ PARTICIPES : recul\n    ' + rec.slice(0, 20).join('\n    ')); bad++; }
  else console.log('✓ PARTICIPES : aucun contexte ne recule (marques fausses, rouges au mauvais mot, mauvais mots, muets)');
}
process.exit(bad ? 1 : 0);
