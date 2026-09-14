// TEXTES D'EXPLICATION du correcteur — la sonde née de l'AUDIT du 11/09/2026 dans le vrai Chrome
// (dictee/AUDIT_CORRECTEUR_2026-09-11.md, §2). Le moteur y était juste sur 24 phrases ; les TEXTES, non :
// « clé → clés : remplace le verbe par mordre » (un nom), « c'est « ma » (singulier) qui commande → heures »
// (le cardinal « huit » est à côté), « château : é ferme, è ouvre » (un circonflexe), aucun 💡 sur -er/-é,
// c'est/s'est générique, « avont → avons : ce son s'écrit s » (une terminaison), « aujourdhui : les accents
// s'entendent » (une apostrophe manque). Aucun test ne lisait ces textes : ils dérivaient sans témoin.
// ÉLARGIE le 14/09/2026 (rapport de Rem sur « nous ira » : le bloc « Stade » « est là tout le temps, elle veut rien dire ») :
// l'audit de TOUS les conseils, règle par règle, a trouvé une vingtaine de règles dont le conseil ne parlait pas de leur faute.
//
// Ce que la sonde garde, sur le moteur de l'EXTENSION chargé comme le produit (mêmes assets) :
//   1) pour chaque phrase, le 💡 (ctxHint → f.hint) et la ligne « remèdes » (remedTip via diagnoseAll)
//      CONTIENNENT ce qu'ils doivent, et ne contiennent PLUS ce qui était faux ;
//   2) la COUCHE DYS PARTAGÉE (conseils, table des familles, phrases-tests) est la même, octet pour octet, dans l'app et
//      l'extension — et elle n'est définie qu'UNE fois (une 2e définition plus bas l'écraserait en silence) ;
//   3) le ROUTAGE règle → famille est le même des deux côtés : _corrFam de l'app (extrait et exécuté) contre flagsToFacts
//      de l'extension, sur les corrections des phrases inventées ET sur chaque nom de règle du moteur ;
//   4) chaque nom de règle du moteur est classé par son NOM (table ou nom reconnu), jamais par le repli « homophone » —
//      c'est ce repli qui donnait « remplace par a→avait » au point final ;
//   5) le correcteur n'affiche plus de « Stade » (app, panneau, bulle) ; la dictée garde le sien.
//   node dictee/textes_probe.js            (sortie 1 = rouge)
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..'), EXT = path.join(ROOT, 'extension');

require(path.join(EXT, 'dys-core.js'));
const D = global.DYSCORE;
const rd = (f) => fs.readFileSync(path.join(EXT, 'assets', f));
const gz = (f) => zlib.gunzipSync(rd(f)).toString('utf8');
D.setLex(JSON.parse(rd('vdc-lex.json').toString('utf8')), gz('gender-relaxed.tsv.gz'), gz('speller.tsv.gz'));
D.setNounPost(gz('noun-post.txt.gz'));
D.setPosHmm(JSON.parse(gz('pos-hmm.json.gz')));
D.setPrenoms(gz('prenoms.tsv.gz'));
D.setGaccLex(gz('gender-acc.json.gz'));

// Chaque cas : la phrase, puis par mot corrigé ce que le 💡 doit contenir (oui) / ne plus contenir (non),
// et pour la ligne « remèdes » (toutes familles confondues) les mêmes attentes.
const CAS = [
  { t: 'Je fini mon travail.',   // 12/09/2026 : « personne du verbe » ouvre enfin le 💡 au pronom gouverneur
    mots: { fini: { sugg: 'finis', oui: ['« Je »', 'qui commande'] } } },   // le gouverneur cite le mot de la phrase, majuscule comprise
  { t: 'Nous allez au parc.',   // rapport de Rem, 15/09 : le remède citait « il », qui n'est pas dans la phrase
    mots: { allez: { sugg: 'allons' } },
    remed: { oui: ['« nous » ne prend pas la terminaison de « vous »', 'on écrit « nous allons »'], non: ['« il »'] } },
  { t: 'Nous mangeames bien.',   // « là c'est de la conjugaison » (Rem) : le remède était celui des ACCENTS
    mots: { mangeames: { sugg: 'mangeâmes', non: ['qui commande'] } },   // 12/09 : accent seul → pas de 💡 gouverneur (la personne est juste)
    remed: { oui: ['la personne est JUSTE', 'nous mangeâmes'], non: ['Photographie le mot', 'hospital'] } },
  { t: "Je ne sais pas ou j'ai mis mes clé, peut etre dans la cuisine.",
    mots: { 'clé': { sugg: 'clés', oui: ['« mes » (pluriel)'] } },
    remed: { oui: ['clé » → « clés » : il manque le « s » du pluriel'], non: ['mordre'] } },
  { t: 'Ma mere ma dit de rentré avant huit heure.',
    mots: { heure: { sugg: 'heures', oui: ['« huit » (pluriel)'], non: ['« ma »'] },
            'rentré': { sugg: 'rentrer', oui: ['mordre', 'infinitif « rentrer »', 'participe « rentré »'] } } },
  { t: "Je suis allé a la plage et j'ai manger des glace.",
    mots: { manger: { sugg: 'mangé', oui: ['mordu', 'participe « mangé »', 'infinitif « manger »'] } } },
  { t: "Elle c'est trompé de chemin, sa arrive a tout le monde.",
    mots: { "c'est": { sugg: "s'est", oui: ['cela est', "« s'est »"] } },
    remed: { oui: ['cela est'], non: ['a→avait, et→et puis'] } },
  { t: 'On a visiter un chateau tres ancien pendant les vacance.',
    mots: { visiter: { sugg: 'visité', oui: ['mordu', 'participe « visité »'] } },
    remed: { oui: ['chateau » → « château » : a→â', 'circonflexe'], non: ['a→â. Dis-le à voix haute'] } },   // 14/09 : « tres → très » a désormais SA leçon (é ferme, è ouvre) — c'est le circonflexe qui ne doit pas la recevoir
  { t: 'Nous avont marcher longtemps sous la pluit.',
    mots: { marcher: { sugg: 'marché', oui: ['mordu'] } },
    remed: { oui: ['avont » → « avons » : -ons, c’est « nous »', 'marcher » → « marché » : remplace le verbe par « mordre »'],
             non: ['ce son s’écrit « s »', 'forme sûre'] } },
  { t: 'Il fais froid aujourdhui.',
    mots: { aujourdhui: { sugg: "aujourd'hui" } },
    remed: { oui: ['mot figé : il s’écrit toujours avec l’apostrophe'], non: ['accents s’entendent', 'é ferme', 'l’article est élidé'] } },
  // l'inconnu SANS suggestion garde son texte (plan ③ : « aujourdhui » a maintenant une réponse, « xylophonage » non)
  { t: 'Il fais froid, quel xylophonage.',
    mots: { xylophonage: { sugg: 'xylophonage' } },
    remed: { oui: ['« xylophonage » n’est pas dans le dictionnaire'], non: ['accents s’entendent'] } },
  // témoins : ce qui était JUSTE le 11/09 doit le rester
  { t: "Je suis allé a la plage et j'ai manger des glace.",
    mots: { a: { sugg: 'à', oui: ['remplace par « avait »', '« à » (préposition)'] }, glace: { sugg: 'glaces', oui: ['« des » (pluriel)'] } } },
  { t: 'Il faut que tu fait attention.', mots: { fait: { sugg: 'fais', oui: ['« tu » (singulier)'] } } },
  { t: 'Je me suis installe ici.', mots: { installe: { sugg: 'installé', oui: ['PARTICIPE', 'installée'] } } },
  { t: "J'ai commence le travail.", mots: { commence: { sugg: 'commencé' } } },
  { t: 'Ils ont marche longtemps.', mots: { marche: { sugg: 'marché' } } },
  { t: 'Les enfants il reculer pour voir.', mots: { reculer: { sugg: 'reculait', oui: ['jamais à l\'infinitif', 'imparfait', 'présent'] } } },
  { t: 'nous sommes allé au cinéma.', mots: { 'allé': { sugg: 'allés', oui: ['« nous » (pluriel)'] } },
    remed: { oui: ['il manque « s » : le participe s’ACCORDE ici'] } },

  // ===== 14/09/2026 : l'audit de TOUS les conseils (phrases inventées) — « non » = le texte faux d'avant =====
  // le repli homophone « remplace par une forme sûre (a→avait, et→et puis, son→mon) » tombait sur des règles qui n'en sont pas
  { t: 'La fumé sort de la cheminé.', mots: { 'fumé': { sugg: 'fumée' }, 'cheminé': { sugg: 'cheminée' } },
    remed: { oui: ['« fumée » est ici un NOM féminin'], non: ['forme sûre', '« cheminée » est ici'] } },   // une leçon par règle : la 2e faute de la même règle ne la répète pas
  { t: 'Il a deux cent euros.', mots: { cent: { sugg: 'cents' } },
    remed: { oui: ['« cent » prend un -s quand il est multiplié'], non: ['forme sûre'] } },
  { t: "Si j'aurais su, je serais venu.", mots: { "j'aurais": { sugg: "j'avais" } },
    remed: { oui: ['après « si », pas de conditionnel'], non: ['forme sûre'] } },
  { t: 'Il est faim.', mots: { est: { sugg: 'a' } },
    remed: { oui: ['avoir faim', 'verbe AVOIR'], non: ['essaie « était »'] } },
  { t: 'Il a du partir tôt.', mots: { du: { sugg: 'dû' } },
    remed: { oui: ['essaie « de le » à la place', 'c’est « dû »'], non: ['circonflexe', 'lettre disparue'] } },
  { t: 'Je suis sur de moi.', mots: { sur: { sugg: 'sûr' } },
    remed: { oui: ['« sûr » (= certain'], non: ['circonflexe'] } },
  { t: 'La ville ou je suis né est belle.', mots: { ou: { sugg: 'où' } },
    remed: { oui: ['essaie « ou bien » à la place', 'c’est « où »'], non: ['é ferme', 'u→ù'] } },
  // le test de substitution À L'ENVERS : « à » → « avait », « si la phrase ne tient plus, c'est « a » »
  { t: "Lorsqu'il à faim.", mots: { 'à': { sugg: 'a' } },
    remed: { oui: ['si la phrase se dit encore, c’est « a » (verbe avoir)'], non: ['si la phrase ne tient plus, c’est « a »'] } },
  { t: "Puisqu'il ce regarde.", mots: { ce: { sugg: 'se' } },
    remed: { oui: ['essaie « me » à la place de « ce »', 'si la phrase tient, c’est « se »'], non: ['essaie « cela »', 'lui-même'] } },
  { t: 'Ma mer est gentille.', mots: { mer: { sugg: 'mère' } },
    remed: { oui: ['se prononcent pareil mais n’ont pas le même SENS', '« mère »'], non: ['forme sûre'] } },
  { t: 'Il peux venir.', mots: { peux: { sugg: 'peut' } },
    remed: { oui: ['ce verbe finit par -t'], non: ['forme sûre'] } },
  { t: 'Je sait nager.', mots: { sait: { sugg: 'sais' } },
    remed: { oui: ['verbe SAVOIR'], non: ['essaie « savait »'] } },
  { t: 'Il sait trompé de chemin.', mots: { sait: { sugg: "s'est" } },
    remed: { oui: ['devant un participe, c’est « s’est »'] } },
  // « l'article est élidé » partout où une apostrophe apparaissait — « j' », « n' », la négation ne sont pas des articles
  { t: 'Il y a pas de pain.', mots: { y: { sugg: "n'y" } },
    remed: { oui: ['la négation a deux morceaux', '« ne » devient « n’ »'], non: ['l’article est élidé'] } },
  { t: 'Je veux pas partir.', mots: { veux: { sugg: 'ne veux' } },
    remed: { oui: ['il manque « ne »'], non: ['DEUX mots'] } },
  { t: 'jai faim', mots: { jai: { sugg: "j'ai" } },
    remed: { oui: ['« j’ », c’est « je » devant une voyelle'], non: ['l’article est élidé'] } },
  { t: 'Le chevalier porte d\'lourde armure.', mots: { "d'lourde": { sugg: "d'une lourde" } },
    remed: { oui: ['un petit mot manque ici'], non: ['l’article est élidé', 'DEUX mots'] } },
  { t: "j'sais que c'est vrai", mots: { "j'sais": { sugg: 'je sais' } },
    remed: { oui: ['« j’ » ne va que devant une voyelle', 'on écrit « je »'], non: ['DEUX mots'] } },
  { t: 'Quelque soit le temps, on sort.', mots: { Quelque: { sugg: 'Quel que' } },
    remed: { oui: ['« quel que » s’écrit en deux mots devant « soit »'], non: ['DEUX mots, il faut l’espace'] } },
  // « c'est un PARTICIPE : il s'accorde… » sur une forme CONJUGUÉE, une forme en -ant, un infinitif
  { t: 'Il a finit son travail.', mots: { finit: { sugg: 'fini' } },
    remed: { oui: ['mets-le au féminin, « finie »'], non: ['COD placé AVANT'] } },
  { t: "Elle s'est marier hier.", mots: { marier: { sugg: 'mariée' } },
    remed: { oui: ['mordu', 'accordé : « mariée »'], non: ['COD placé AVANT'] } },
  { t: 'Le village était situait près de la mer.', mots: { situait: { sugg: 'situé' } },
    remed: { oui: ['c’est le PARTICIPE « situé », pas l’imparfait'], non: ['COD placé AVANT'] } },
  // « le verbe se conjugue avec SA personne » / « repère qui commande (genre et nombre) » quand la forme dit la leçon
  { t: 'Je doit partir.', mots: { doit: { sugg: 'dois' } },
    remed: { oui: ['avec « je » ou « tu », ce verbe finit par -s'], non: ['en genre et en nombre'] } },
  { t: 'Tu mange une pomme.', mots: { mange: { sugg: 'manges' } },
    remed: { oui: ['avec « tu », le verbe prend un -s'], non: ['du pluriel'] } },
  { t: 'Un enfant dessinaient.', mots: { dessinaient: { sugg: 'dessinait' } },
    remed: { oui: ['-ait, pas -aient'], non: ['en genre et en nombre'] } },
  { t: "C'étais bien.", mots: { "C'étais": { sugg: "C'était" } },
    remed: { oui: ['-ait, pas -ais'], non: ['forme sûre'] } },
  { t: "J'aimer le chocolat.", mots: { "J'aimer": { sugg: "J'aime" } },
    remed: { oui: ['après « je », le verbe se CONJUGUE'], non: ['forme sûre'] } },
  { t: 'Vous ête gentils.', mots: { 'ête': { sugg: 'êtes' } },
    remed: { oui: ['avec « vous », on écrit « êtes »'], non: ['forme sûre'] } },
  { t: 'Il a une chien', mots: { une: { sugg: 'un' } },
    remed: { oui: ['le déterminant prend le GENRE du nom qui le suit : ici masculin'], non: ['en genre et en nombre'] } },
  { t: 'Les cheval galopent.', mots: { cheval: { sugg: 'chevaux' } },
    remed: { oui: ['-al devient ici -aux'] } },
  // l'accent : « é ferme, è ouvre » ne vaut que pour e → é/è/ê — et une leçon par NATURE d'accent
  { t: 'Le garcon est naif.', mots: { garcon: { sugg: 'garçon' }, naif: { sugg: 'naïf' } },
    remed: { oui: ['cédille', 'Le tréma'], non: ['é ferme'] } },
  { t: 'Il vient avéc moi.', mots: { 'avéc': { sugg: 'avec' } },   // un accent RETIRÉ : le son ne tranche pas (le e de « avec » s'entend è)
    remed: { oui: ['Ici, pas d’accent'], non: ['é ferme'] } },
  { t: 'Vous souhaiterai venir.', mots: { souhaiterai: { sugg: 'souhaiterez' } },
    remed: { oui: ['avec « vous », ce verbe finit par -ez'], non: ['en genre et en nombre'] } },
  { t: 'Il y a de lhuile.', mots: { lhuile: { sugg: "l'huile" } },
    remed: { oui: ['devant une voyelle ou un h muet'], non: ['l’article est élidé'] } },
  { t: 'Il mange uen pomme.', mots: { uen: { sugg: 'une' } },
    remed: { oui: ['des lettres ont changé de place'], non: ['/s/ → s, ss, c, ç', 'même son'] } },
  { t: 'Il a vu sa soeur.', mots: { soeur: { sugg: 'sœur' } },
    remed: { oui: ['s’écrivent collés ici : « œ »'], non: ['/s/ → s, ss, c, ç', 'é ferme'] } },
  { t: 'Je parle avec harold demain.', mots: { harold: { sugg: 'Harold' } },
    remed: { oui: ['nom propre : il commence par une capitale'], non: ['n’est pas dans le dictionnaire'] } },
  // le rapport de Rem : un conseil par faute, et plus de « Stade »
  { t: 'nous ira au parc', mots: { ira: { sugg: 'irons' } },
    remed: { oui: ['« nous » ne prend pas la terminaison de « il »'], non: ['Stade', 'le son est juste'] } },
];

let rouge = 0;
const fail = (m) => { rouge++; console.log('  ✗ ' + m); };
const has = (s, x) => String(s || '').indexOf(x) >= 0;

for (const c of CAS) {
  const d = D.diagnoseAll(c.t), flags = d.flags || [];
  console.log('« ' + c.t + ' »');
  for (const w of Object.keys(c.mots)) {
    const att = c.mots[w], f = flags.find((x) => x.word === w);
    if (!f) { fail('aucune correction sur « ' + w + ' »'); continue; }
    if (att.sugg != null && f.sugg !== att.sugg) fail('« ' + w + ' » → « ' + f.sugg + ' » (attendu « ' + att.sugg + ' »)');
    const h = f.hint || '';
    for (const x of att.oui || []) if (!has(h, x)) fail('💡 « ' + w + ' » sans « ' + x + ' » — reçu : ' + (h || '∅'));
    for (const x of att.non || []) if (has(h, x)) fail('💡 « ' + w + ' » contient encore « ' + x + ' » — reçu : ' + h);
    console.log('  ' + w + ' → ' + f.sugg + (h ? '  💡 ' + h : '  💡 ∅'));
  }
  const rem = (d.remed || []).join(' ¶ ');
  if (c.remed) {
    for (const x of c.remed.oui || []) if (!has(rem, x)) fail('remède sans « ' + x + ' » — reçu : ' + (rem || '∅'));
    for (const x of c.remed.non || []) if (has(rem, x)) fail('remède contient encore « ' + x + ' » — reçu : ' + rem);
  }
  if (rem) console.log('  🛠️ ' + rem);
  if ('stade' in d || 'stadeLbl' in d || 'stadeMsg' in d) fail('diagnoseAll rend encore un stade (' + Object.keys(d).join(',') + ')');
}

// SANS nom de règle (la dictée, le correcteur IA) : le test de substitution doit valider la BONNE forme — « à » → « avait »
// disait « si la phrase ne tient plus, c'est « a » », « où » → « à quel endroit » ne marche pas sur le relatif (14/09/2026)
for (const [e, a, oui, non] of [
  ['à', 'a', 'essaie « avait » à la place de « à » — si la phrase tient, c’est « a »', 'ne tient plus, c’est « a »'],
  ['a', 'à', 'essaie « avait » à la place — si la phrase ne tient plus, c’est « à »', null],
  ['où', 'ou', 'essaie « ou bien » à la place de « où » — si la phrase tient, c’est « ou »', 'à quel endroit'],
  ['la', 'là', 'essaie « ici » à la place de « la » — si la phrase tient, c’est « là »', null],
  ['ce', 'se', 'essaie « me » à la place de « ce » — si la phrase tient, c’est « se »', 'lui-même'],
  ['sa', 'ça', 'essaie « ma » à la place — si la phrase ne tient plus, c’est « ça »', 'la sienne'],
  // une paire SANS forme d'épreuve : l'ancien repli « remplace par une forme sûre (a→avait, et→et puis, son→mon) » ne la concernait pas
  ['sé', 'ce', 'c’est la GRAMMAIRE de la phrase qui choisit — ici « ce »', 'forme sûre']]) {
  const s = D.REMED.homophone_gram(e, a);
  if (!has(s, oui) || (non && has(s, non))) fail('homophone sans règle « ' + e + ' → ' + a + ' » : ' + s);
}
console.log('  ✓ tests de substitution sans nom de règle (dictée, IA) : la forme d\'épreuve valide le bon mot');
// une lettre en trop MUETTE (dictée) : « compte les sons » n'y aide pas — la couche est la même dans l'app
{
  const s = D.REMED.ajout('grandit', 'grandi'), s2 = D.REMED.ajout('tabble', 'table');
  if (!has(s, 'ne s’entend pas') || has(s, 'Compte les sons')) fail('ajout muet « grandit → grandi » : ' + s);
  if (!has(s2, 'ne s’entend pas')) fail('ajout muet « tabble → table » : ' + s2);
  console.log('  ✓ lettre en trop muette : ' + s);
}

// 2) app ≡ extension : la COUCHE DYS PARTAGÉE, octet pour octet, définie une seule fois
const norm = (s) => s.replace(/\r\n/g, '\n');
const app = norm(fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8'));
const ext = norm(fs.readFileSync(path.join(EXT, 'dys-core.js'), 'utf8'));
function bloc(src, a, b, nom) {
  const i = src.indexOf(a); if (i < 0) throw new Error('bloc ' + nom + ' introuvable (' + a + ')');
  const j = src.indexOf(b, i); if (j < 0) throw new Error('fin du bloc ' + nom + ' introuvable (' + b + ')');
  return src.slice(i, j + b.length);
}
const COUCHE = ['// ===== COUCHE DYS PARTAGÉE', '// ===== fin de la COUCHE DYS PARTAGÉE ====='];
const coucheApp = bloc(app, COUCHE[0], COUCHE[1], 'COUCHE app'), coucheExt = bloc(ext, COUCHE[0], COUCHE[1], 'COUCHE ext');
if (coucheApp !== coucheExt) { let k = 0; while (k < coucheApp.length && coucheApp[k] === coucheExt[k]) k++; fail('COUCHE DYS PARTAGÉE app ≠ extension au caractère ' + k + ' : app « ' + coucheApp.slice(k, k + 60) + ' » / ext « ' + coucheExt.slice(k, k + 60) + ' »'); }
else console.log('  ✓ COUCHE DYS PARTAGÉE app ≡ extension (' + coucheApp.length + ' c.)');
for (const [nom, src] of [['app', app], ['extension', ext]]) {
  for (const def of ['var _HPROBE=', 'var _HSUB =', 'var REMED=', 'var _RTIP=', 'var _REGLE_FAM=', 'function remedTip(', 'function remedFams(']) {
    const n = src.split(def).length - 1;
    if (n !== 1) fail(nom + ' : « ' + def + ' » défini ' + n + ' fois (une 2e définition écraserait la couche partagée)');
  }
}

// 3) ROUTAGE règle → famille : _corrFam de l'app (extrait, exécuté tel quel) contre flagsToFacts de l'extension
const srcDeacc = (app.match(/function deacc\(s\)\{[^\n]*\n/) || [''])[0] + (app.match(/function deaccS\(s\)\{[^\n]*\n/) || [''])[0];   // les deux, pour qu'un retour à deaccS se lise comme une DIVERGENCE et non comme un plantage
const srcCorrFam = bloc(app, 'function _corrFam(', "return 'homophone';}", '_corrFam');
const sandbox = new Function(srcDeacc + coucheApp + '\n' + srcCorrFam + '\nreturn {corrFam:_corrFam};')();
const STYLE_APP = { typo: 1, nombre: 1, anglicisme: 1, abreviation: 1, pleonasme: 1 };
const famApp = (n, w, s) => { const x = sandbox.corrFam(n, w, s); return x === 'homophone' ? 'homophone_gram' : (STYLE_APP[x] ? 'style' : x); };
const famExt = (n, w, s) => D.flagsToFacts([{ name: n, word: w, sugg: s }])[0].types[0];
// les noms de règle du moteur : CRULES + les littéraux `name:` + l'impératif des pronoms (4e argument de push)
const iC = ext.indexOf('var CRULES=['), jC = ext.indexOf('];', iC);
const NOMS = new Set([...ext.slice(iC, jC).matchAll(/\[(?:'([^']+)'|"([^"]+)"),\s*[A-Za-z_$][\w$]*\]/g)].map((m) => m[1] || m[2]));
for (const m of ext.matchAll(/name:(?:'([^']+)'|"([^"]+)")/g)) NOMS.add(m[1] || m[2]);
if (ext.indexOf("'impératif (pronom)'") >= 0) NOMS.add('impératif (pronom)');
if (NOMS.size < 100) fail('extraction des noms de règle : ' + NOMS.size + ' seulement (le motif ne lit plus le moteur ?)');
const TRIPLES = [];
for (const n of NOMS) TRIPLES.push([n, 'x', 'y'], [n, 'le', 'la'], [n, 'ou', 'où'], [n, 'jai', "j'ai"]);
for (const [w, s] of [['harold', 'Harold'], ['soeur', 'sœur'], ['reception', 'réception'], ['jai', "j'ai"], ['ducou', 'du coup'],
                      ['pome', 'pomme'], ['aujourdhui', 'aujourdhui'], ['aujourdhui', "aujourd'hui"], ['uen', 'une'], ['garcon', 'garçon']])
  for (const n of ['orthographe', 'mot inconnu']) TRIPLES.push([n, w, s]);
for (const s of ["s'est", 'sais']) TRIPLES.push(['sais/sait', 'sait', s]);
// …et chaque correction réellement produite sur les phrases inventées commitées
const PHR = CAS.map((c) => c.t);
{ const s = fs.readFileSync(path.join(EXT, 'parity_core.js'), 'utf8'), i = s.indexOf('const PHRASES = ['), j = s.indexOf('\n];', i);
  try { PHR.push(...eval(s.slice(i + 'const PHRASES = '.length, j + 2))); } catch (e) { fail('PHRASES de parity_core.js illisibles : ' + e.message); } }
for (const l of fs.readFileSync(path.join(__dirname, 'phrases_courantes.txt'), 'utf8').split('\n')) if (l.trim() && l[0] !== '#') PHR.push(l.trim());
for (const p of PHR) for (const f of (D.diagnoseAll(p).flags || [])) TRIPLES.push([f.name || '', f.word || '', String(f.sugg || '')]);
let nDiv = 0, nTri = 0; const vus = new Set();
for (const [n, w, s] of TRIPLES) {
  const k = n + '' + w + '' + s; if (vus.has(k)) continue; vus.add(k); nTri++;
  const a = famApp(n, w, s), e = famExt(n, w, s);
  if (a !== e) { nDiv++; if (nDiv <= 12) fail('routage app ≠ extension : [' + n + '] « ' + w + ' » → « ' + s + ' » : app ' + a + ' / ext ' + e); }
}
if (!nDiv) console.log('  ✓ routage règle → famille app ≡ extension (' + nTri + ' corrections, ' + NOMS.size + ' noms de règle)');
else if (nDiv > 12) fail('… ' + (nDiv - 12) + ' divergence(s) de routage de plus');

// 4) chaque nom de règle est classé par son NOM, jamais par le repli final « homophone »
let nRepli = 0;
for (const n of NOMS) if (!D.famRegle(n, 'y') && famExt(n, 'x', 'y') === 'homophone_gram') { nRepli++; fail('règle « ' + n + ' » sans famille : elle tombe dans le repli homophone (ajoute-la à _REGLE_FAM)'); }
if (!nRepli) console.log('  ✓ les ' + NOMS.size + ' noms de règle ont une famille par leur nom');

// 5) plus de « Stade » dans le correcteur (la dictée garde « Stade (sur la session…) »)
const panneau = norm(fs.readFileSync(path.join(EXT, 'sidepanel.js'), 'utf8')), bulle = norm(fs.readFileSync(path.join(EXT, 'content.js'), 'utf8'));
for (const [nom, src, motifs] of [
  ['app (correcteur)', app, ["<b>Stade : '+STAGE_LBL", 'developmental(devF)']],
  ['extension/dys-core.js', ext, ['stadeLbl', 'stadeMsg', 'STAGE_MSG', 'developmental(']],
  ['extension/sidepanel.js', panneau, ['Stade :', 'dg.stade']],
  ['extension/content.js', bulle, ['Stade :', 'dg.stade']]]) {
  for (const m of motifs) if (src.indexOf(m) >= 0) fail(nom + ' affiche encore un stade (« ' + m + ' »)');
}
if (app.indexOf('<b>Stade (sur la session') < 0) fail('la dictée a perdu son « Stade (sur la session…) » — il n\'était pas visé');
console.log('  ✓ plus de « Stade » dans le correcteur (app, panneau, bulle) ; la dictée garde le sien');

console.log(rouge ? ('\nTEXTES : ' + rouge + ' attente(s) non tenue(s)') : '\nTEXTES : toutes les attentes tenues (' + CAS.length + ' phrases, couche partagée, routage de ' + NOMS.size + ' règles)');
process.exit(rouge ? 1 : 0);
