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
//   6) lot 2 : les cartes du site et la copie du panneau.
//   7) lot 3 : la DICTÉE — le retour que check() écrit (faits, stade, conseils), exécuté tel quel : le mot oublié est dit, une lettre
//      muette ou qui s'entend est nommée comme telle (le stade et le conseil suivent), les mots collés/coupés sont un découpage.
//   8) lot 4 : les NOTES de grammaire de la dictée ne contredisent jamais la forme attendue (balayage des 333 phrases), et/est n'est
//      pas un accord, -er/-é/-ez est la forme du verbe, un trait d'union oublié ou en trop est vu.
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
  { t: 'Il a une chien', mots: { une: { sugg: 'un', oui: ['le nom « chien » (masculin) qui commande'], non: ['« Il »'] } },   // lot 2 : le 💡 citait « Il », lu en arrière
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
  // ===== 14/09/2026, lot 2 : le 💡 « C'est X qui commande » (UNE copie, _govHint) et le témoin de famille =====
  { t: 'nous avons vue notre médecin', mots: { vue: { sugg: 'vu', oui: ['Avec « avoir », le participe ne s’accorde pas avec le sujet'], non: ['« nous » (pluriel) qui commande'] } } },
  { t: 'Un fait divers tragique', mots: { tragique: { sugg: 'tragiques', non: ['« Un » (singulier) qui commande'] } } },   // gouverneur singulier pour une suggestion au pluriel : silence
  { t: 'La commission présidentiel est là', mots: { 'présidentiel': { sugg: 'présidentielle', oui: ['« La » (féminin) qui commande'] } } },   // le genre, plus « (singulier) »
  { t: 'Elle est parti tôt.', mots: { parti: { sugg: 'partie', oui: ['« Elle » (féminin) qui commande'] } } },
  { t: 'Le soir jadmet tout.', mots: { jadmet: { sugg: "j'admets", non: ['qui commande'] } } },   // le pronom est DANS le mot : « C'est le qui commande »
  { t: 'Il a cént euros.', mots: { 'cént': { sugg: 'cent', non: ['muet s’entend'] } } },   // la faute est l'accent, pas le t final
  { t: 'Il est gran.', mots: { gran: { sugg: 'grand', oui: ['Le d muet s’entend dans « grande »'] } } },   // témoin : la dernière lettre manquait
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
  // lot 3 : une consonne finale échangée n'est « muette » que si le mot la tait — « tennis », « sept » la prononcent
  const s3 = D.REMED.surface('bois', 'boit'), s5 = D.REMED.muette('tie', 'tige');
  if (!has(s3, 'à la fin du mot, « t » ne s’entend pas')) fail('consonne finale muette « bois → boit » : ' + s3);
  if (!has(s5, 'elle s’entend') || has(s5, 'ne s’entend pas')) fail('lettre oubliée qui s’entend « tie → tige » : ' + s5);
  const s6 = D.REMED.muette('hui', 'huit');   // le t de « huit » se prononce : la liste fermée des finales sonores
  if (has(s6, 'ne s’entend pas')) fail('« hui → huit » : le t de huit se prononce — ' + s6);
  // …et les finales qui PEUVENT se prononcer, hors liste : -is/-us après consonne, -ct (on ne sait pas → le conseil ne promet rien)
  const s7 = D.REMED.surface('irit', 'iris'), s8 = D.REMED.muette('direc', 'direct');
  if (has(s7, 'ne s’entend pas')) fail('« irit → iris » : le s de iris se prononce — ' + s7);
  if (has(s8, 'ne s’entend pas')) fail('« direc → direct » : le t de direct se prononce — ' + s8);
  console.log('  ✓ lettre finale muette ou prononcée (bois/boit, hui/huit, irit/iris, direc/direct), lettre oubliée qui s’entend (tie/tige)');
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
  for (const def of ['var _HPROBE=', 'var _HSUB =', 'var REMED=', 'var _RTIP=', 'var _REGLE_FAM=', 'function remedTip(', 'function remedFams(', 'function _govHint(', 'function _diffGenre(', 'function _finConcernee(', 'function _diffMuette(']) {
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

// 6) lot 2 (14/09/2026) — les CARTES du site et le PANNEAU de l'extension
{
  // le 💡 gouverneur : UNE copie (couche partagée) lue par les deux moteurs, et le témoin de famille filtré des deux côtés
  const exige = [
    ['app', app, "function _accHint(f,i){var s=_govHint(f,_curToks,i);return s?esc(s):'';}", 'le 💡 gouverneur du site ne lit plus _govHint'],
    ['extension', ext, 'var gh=_govHint(f,T,i);if(gh!==null)return gh;', 'le 💡 gouverneur de l\'extension ne lit plus _govHint'],
    ['app', app, "if(!_finConcernee(f.word,f.sugg))return '';", 'le témoin de famille du site n\'est plus filtré'],
    ['extension', ext, "return _finConcernee(f.word,f.sugg)?famHint(f.sugg||''):'';", 'le témoin de famille de l\'extension n\'est plus filtré'],
    // un clic ouvre la CARTE : les libellés ne promettent plus une bascule ; et le chargement ne se fait plus passer pour « aucune faute »
    ['app', app, "if(!_corrs.length&&!SP.ready){", 'la page affirme « Aucune faute détectée » tant que le dictionnaire charge'],
  ];
  for (const [nom, src, motif, msg] of exige) if (src.indexOf(motif) < 0) fail(nom + ' : ' + msg);
  // les explications FAUSSES des cartes (_EXPL) : du/de n'est pas « après une négation », « nombre » est l'ordinal, etc.
  for (const faux of ['après une négation, « du » devient « de »', "en toutes lettres jusqu'à seize", "les nombres composés prennent un trait d'union",
                      "même son, l'orthographe est corrigée", 'e="même son, orthographe corrigée', 'La virgule sépare : elle ne se met jamais',
                      "un trait d'union relie le verbe et le pronom (donne-moi)", "pas d'apostrophe ici : on sépare les deux mots",
                      'pour basculer)', "' — clique pour annuler'", "'clique pour appliquer -> '", '(clique pour annuler)</span>', '(clique pour appliquer)</span>'])
    if (app.indexOf(faux) >= 0) fail('app : texte faux encore présent — « ' + faux + ' »');
  // la COPIE du panneau (« c'est lui que Copier copie ») : corrige() exécuté tel quel sur les corrections du moteur
  const P = norm(fs.readFileSync(path.join(EXT, 'sidepanel.js'), 'utf8'));
  const src = (P.match(/  var TOKRE = [^\n]*\n/) || [''])[0] + (P.match(/  function spans\(t\) [^\n]*\n/) || [''])[0] + (P.match(/  function esc\(s\) [^\n]*\n/) || [''])[0]
    + bloc(P, '  var _ign = {}, lastOut = null;', "    var out = ''; parts.forEach(function (p) { out += p[0] + p[1]; }); return out + t.slice(last);\n  }", 'corrige du panneau');
  const pan = new Function(src + '\nreturn {corrige:corrige};')();
  for (const [t, attendu] of [['Il arrive , puis il repart', 'Il arrive, puis il repart'], ['Il est  là,elle aussi', 'Il est là, elle aussi'], ['les enfant joue', 'les enfants jouent']]) {
    const got = pan.corrige(t, D.diagnoseAll(t).flags);
    if (got !== attendu) fail('panneau : la copie de « ' + t + ' » est « ' + got + ' », attendu « ' + attendu + ' » (corrections sûres ancrées caractère sautées ?)');
  }
  console.log('  ✓ cartes du site et copie du panneau (💡 partagé, témoin filtré, libellés de clic, chargement, corrections ancrées caractère)');
}

// 7) lot 3 (14/09/2026) — la DICTÉE. Rejouée sur le vrai écrit dys (188 textes découpés en phrases), elle affichait « Mot oublié : mot
//    oublié » (196 fois : le mot n'était jamais dit), « lettre muette » sur des lettres qui S'ENTENDENT (406), « phonologique — le mot n'est
//    pas encore bien ENTENDU » décidé par des lettres muettes seules (136 blocs), « ne s'entend pas » en conseil sur une lettre qui
//    s'entend (180), et lisait « vontchercher » comme « mot oublié » + « lettre en trop ». Le rendu de check() est EXTRAIT de l'app et
//    exécuté dans la portée de la dictée, sur des phrases inventées.
{
  const i0 = app.indexOf('mode PHRASES'), start = app.indexOf('(function(){', i0);
  const spIdx = app.indexOf('function spellText', start), cut = app.indexOf('return out;}', spIdx) + 'return out;}'.length;
  const ck = app.indexOf('function check(){if(!cur||answered)return;');
  const m1 = app.indexOf(':F.map(function(x){', ck), m2 = app.indexOf("}).join('');", m1) + "}).join('')".length;
  const s1 = app.indexOf('if(!ok){var dev=developmental(SESSF);', ck), s2 = app.indexOf('}', app.indexOf("remedBlock(SESSF,'vdd-fact');", s1)) + 1;
  if (ck < 0 || m1 < 0 || s1 < 0 || m1 > s1) fail('dictée : le rendu de check() est introuvable (faits ' + m1 + ', stade ' + s1 + ')');
  else {
    const code = app.slice(start, cut) + ';globalThis.__DICTEE={diagnose:diagnoseSentence,homoGram:homoGram,natureEr:(typeof _natureEr==="function"?_natureEr:null),rendre:function(F,SESSF,nT){var html="",ok=F.length===0;html=' + app.slice(m1 + 1, m2) + ';' + app.slice(s1, s2) + 'return html;}};})();';
    try { globalThis.OMEGA_VDC = require(path.join(__dirname, 'blobgz')).vdcSeed(app); } catch (e) {}
    const blob = (id) => { const m = app.match(new RegExp('id="' + id + '">([\\s\\S]*?)</script>')); return m ? m[1] : ''; };
    const B = { 'vdc-lex': blob('vdc-lex'), 'speller-lex-gz': blob('speller-lex-gz'), 'noun-post-gz': blob('noun-post-gz'), 'pos-hmm-gz': blob('pos-hmm-gz'), 'gdet-lex-gz': blob('gdet-lex-gz') };
    const stub = new Proxy(function () {}, { get(o, k) { if (k === 'style') return {}; if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains: () => false }; return stub; }, set: () => true, apply: () => stub });
    global.document = { getElementById: (id) => B[id] ? { textContent: B[id] } : stub, createElement: () => stub, body: stub, head: stub, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
    global.window = global; try { global.navigator = { userAgent: 'node' }; } catch (e) { Object.defineProperty(global, 'navigator', { value: { userAgent: 'node' }, configurable: true }); }
    global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    (0, eval)(code);
    const X = globalThis.__DICTEE;
    const texte = (h) => h.replace(/<br>/g, ' ¶ ').replace(/<\/div>/g, ' ¶ ').replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const CASD = [
      ['Le chat dort sur le lit.', 'Le chat dort sur lit.', {}, ['Mot oublié : « le »'], ['Mot oublié : mot oublié']],
      ['Le chat dort sur le lit.', 'Le chat dort sur le le lit.', {}, ['Mot en trop : « le »'], ['Mot en trop : mot en trop']],
      ['Il a grandi très vite.', 'Il a grandit très vite.', {}, ['lettre muette en trop', 'Stade (sur la session, 1 phrase) : lexical', 'Vu : « grandit » pour « grandi »', 'elle ne s’entend pas'],
        ['phonologique', 'Compte les sons', 'pas encore bien ENTENDU']],
      ['La tige est verte.', 'La tie est verte.', {}, ['lettre oubliée (elle s’entend)', ': phonologique', 'ne se lit pas comme le mot dicté', 'elle s’entend : dis le mot lentement'],
        ['lettre muette', 'ne s’entend pas', 'lexical']],
      ['Ils vont chercher du pain.', 'Ils vontchercher du pain.', {}, ['« vontchercher » → « vont chercher » : découpage', 'ce sont DEUX mots'], ['Mot oublié', 'lettre en trop', 'phonologique']],
      ['Elle est bienveillante.', 'Elle est bien veillante.', {}, ['« bien veillante » → « bienveillante » : découpage', 'c’est UN seul mot'], ['Mot en trop', 'lettre muette', 'ne s’entend']],
      ['Les enfants mangent la soupe.', 'Les enfants mange la soupe.', { mangent: ['mange'] }, ['accord sujet-verbe', '(la marque ne s’entend pas : c’est l’accord qui la dit)', 'il manque le « nt » du verbe'],
        ['groupe nominal', 'même famille', 'nt » ne s’entend', 'les lettres « nt »', 'compare avec « mangent »']],   // un conseil par leçon : pas de conseil de LONGUEUR en plus de l'accord
      ['Le chat boit du lait.', 'Le chat bois du lait.', {}, ['à la fin du mot, « t » ne s’entend pas'], ['ce son s’écrit']],
      ['Elle a mangé une pomme.', 'Elle a mange une pomme.', {}, ['accents'], ['le son est juste', 'écrit au son']],
      ['Le lit est grand.', 'le lit est grand.', {}, ['il manque la majuscule'], ['majuscule initiale']],
    ];
    for (const [cible, eleve, fam, oui, non] of CASD) {
      let h; try { const F = X.diagnose(cible, eleve, fam); h = texte(X.rendre(F, F, 1)); } catch (e) { fail('dictée « ' + eleve + ' » : ' + e.message); continue; }
      for (const x of oui) if (!has(h, x)) fail('dictée « ' + eleve + ' » (dicté : « ' + cible + ' ») sans « ' + x + ' » — rendu : ' + h);
      for (const x of non) if (has(h, x)) fail('dictée « ' + eleve + ' » (dicté : « ' + cible + ' ») contient « ' + x + ' » — rendu : ' + h);
    }
    for (const faux of ["x.msg.replace(/: [^:]*$/,': <b>'+tags+'</b>')", "phonologique:'le mot n’est pas encore bien ENTENDU", "alphabetique:'le son est juste, la graphie non", "alphabetique:'alphabétique (écrit au son)'"])
      if (app.indexOf(faux) >= 0) fail('app (dictée) : texte ou rendu faux encore présent — « ' + faux + ' »');
    console.log('  ✓ dictée : mot oublié dit, lettre muette / qui s’entend nommée (stade et conseil suivent), mots collés/coupés = découpage (' + CASD.length + ' phrases)');
  }
}

// 8) lot 4 (14/09/2026) — les NOTES de la dictée. Chaque homophone curé de chaque mot des 333 phrases substitué (5 318 cas) : 356 notes
//    de grammaire contredisaient la forme attendue (« « La » féminin → accorder « sur » », « « ma » (singulier) → accorder « arrivés » »),
//    532 mots-outils (et/est, sur/sure) étaient rangés « accord », 196 -er/-é/-ez « homophone lexical : le SENS tranche », et « La grand
//    mère tricote » passait pour « ✓ Phrase correcte ». Corpus de la dictée (public) ; la note est confrontée à la marque attendue.
{
  const X = globalThis.__DICTEE;
  if (!X || !X.natureEr) fail('dictée (lot 4) : moteur de la dictée non chargé ou _natureEr absent');
  else {
    const SENT = JSON.parse(fs.readFileSync(path.join(__dirname, 'sentences.json'), 'utf8'));
    const low = (x) => String(x || '').toLowerCase();
    const contredit = (g, t, s) => {   // la note contredit-elle la forme attendue t (écrit s) ? — même lecture que la mesure du lot
      let m;
      if ((m = /accord en genre : « [^»]+ » (féminin|masculin) → accorder/.exec(g))) {
        if (m[1] === 'féminin' && !/e(s)?$/.test(t)) return 'genre féminin, attendu sans -e';
        if (m[1] === 'masculin' && /e(s)?$/.test(t) && !/e(s)?$/.test(s)) return 'genre masculin, attendu en -e';
      }
      if ((m = /accord dans le groupe nominal : « [^»]+ » (pluriel|singulier) → accorder/.exec(g))) {
        if (m[1] === 'pluriel' && !/[sx]$/.test(t)) return 'GN pluriel, attendu sans -s/-x';
        if (m[1] === 'singulier' && /[sx]$/.test(t) && !/[sx]$/.test(s)) return 'GN singulier, attendu avec -s/-x';
      }
      if ((m = /accord sujet-verbe : « [^»]+ » (pluriel|singulier) → accorder/.exec(g))) {
        if (m[1] === 'pluriel' && !/(nt|ons|ez|mes|tes)$/.test(t)) return 'sujet pluriel, verbe attendu sans marque du pluriel';
        if (m[1] === 'singulier' && /nt$/.test(t)) return 'sujet singulier, verbe attendu en -nt';
      }
      if ((m = /participe passé avec être : accord avec le sujet « [^»]+ » \((pluriel|singulier)\)/.exec(g))) {
        if (m[1] === 'singulier' && /[sx]$/.test(t)) return 'participe : sujet singulier, attendu au pluriel';
        if (m[1] === 'pluriel' && !/[sx]$/.test(t)) return 'participe : sujet pluriel, attendu sans -s';
      }
      if (/participe passé avec avoir : invariable/.test(g) && /(ée|ées|és|ie|ies|ue|ues|us|te|tes|ts|se|ses)$/.test(t)) return '« invariable », attendu accordé';
      return null;
    };
    const apresDet = (phrase, mot) => new RegExp("(^|[\\s'’])(le|la|les|l|un|une|des|du|au|aux|mon|ton|son|ma|ta|sa|mes|tes|ses|nos|vos|notre|votre|leur|leurs|ce|cet|cette|ces)[\\s'’]+" + String(mot).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "(?![A-Za-zÀ-ÿ])", 'i').test(phrase);   // le mot attendu suit un déterminant : c'est un nom
    let nSub = 0, nNote = 0; const pb = {};
    const note = (k, v) => { (pb[k] = pb[k] || []).push(v); };
    for (const e of SENT) {
      const re = /[A-Za-zÀ-ÿœŒ'’ʼ]+/g; let m; const tk = [];
      while ((m = re.exec(e.text))) tk.push([m.index, m.index + m[0].length, m[0]]);
      for (const [a, b, w] of tk) for (const h of (e.fam[w] || [])) {
        if (low(h) === low(w)) continue;
        const eleve = e.text.slice(0, a) + h + e.text.slice(b);
        let F; try { F = X.diagnose(e.text, eleve, e.fam); } catch (err) { note('le moteur a levé', eleve + ' : ' + err.message); continue; }
        nSub++;
        for (const f of F) {
          if (!f.mot || !f.ecrit) continue;
          if (f.gram) { nNote++; const c = contredit(f.gram, low(f.mot), low(f.ecrit)); if (c) note('note contradictoire (' + c + ')', '« ' + eleve + ' » → ' + f.gram);
            if (/^accord sujet-verbe/.test(f.gram) && apresDet(e.text, f.mot)) note('« accord sujet-verbe » sur un NOM (après un déterminant)', '« ' + eleve + ' » → ' + f.gram); }
          if (f.types.indexOf('accord') >= 0 && X.homoGram(f.mot, f.ecrit)) note('mot-outil rangé « accord »', '« ' + eleve + ' » : ' + f.ecrit + ' → ' + f.mot);
          if (f.types.indexOf('accord') >= 0 && /nt$/.test(low(f.ecrit)) && !/nt$/.test(low(f.mot)) && apresDet(e.text, f.mot)) note('« accord » sur un NOM écrit avec le -nt d’un verbe', '« ' + eleve + ' » : ' + f.ecrit + ' → ' + f.mot);
          if (X.natureEr(f.mot, f.ecrit) && f.types.some((y) => /^homophone/.test(y))) note('-er/-é/-ez rangé homophone', '« ' + eleve + ' » : ' + f.ecrit + ' → ' + f.mot);
        }
      }
    }
    if (nSub < 5000 || nNote < 300) fail('dictée (lot 4) : balayage trop maigre (' + nSub + ' substitutions, ' + nNote + ' notes) — le corpus ou le moteur ont changé ?');
    // les traits d'union des phrases de la dictée : remplacés par une espace, retirés, ou ajoutés entre deux mots
    let nTrait = 0;
    for (const e of SENT) if (/[A-Za-zÀ-ÿ]-[A-Za-zÀ-ÿ]/.test(e.text)) {
      for (const eleve of [e.text.replace(/([A-Za-zÀ-ÿ])-([A-Za-zÀ-ÿ])/g, '$1 $2'), e.text.replace(/([A-Za-zÀ-ÿ])-([A-Za-zÀ-ÿ])/g, '$1$2')]) {
        nTrait++;
        const F = X.diagnose(e.text, eleve, e.fam);
        if (!F.some((f) => f.types[0] === 'segmentation' && /-/.test(String(f.mot)))) note('trait d’union oublié non vu (ou rendu sans lui)', '« ' + eleve + ' » : ' + JSON.stringify(F.map((f) => [f.ecrit, f.mot, f.types])));
      }
    }
    if (nTrait < 8) fail('dictée (lot 4) : moins de 4 phrases à trait d’union dans le corpus (' + nTrait / 2 + ') — la garde ne voit plus rien');
    for (const [k, v] of Object.entries(pb)) fail('dictée (lot 4) : ' + v.length + ' × ' + k + ' — ex. ' + v.slice(0, 2).join(' ¶ '));
    // le rendu de check() sur des phrases de la dictée (public) et inventées
    const FM = { 'mangé': ['manger', 'mangez', 'mangée', 'mangées', 'mangés'], et: ['est', 'é'], 'arrivés': ['arrivé', 'arrivée', 'arrivées', 'arriver', 'arrivez'] };
    const texte = (h) => h.replace(/<br>/g, ' ¶ ').replace(/<\/div>/g, ' ¶ ').replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    for (const [cible, eleve, fam, oui, non] of [
      ['La grand-mère tricote un pull chaud.', 'La grand mère tricote un pull chaud.', {}, ['« grand mère » → « grand-mère »', 'il faut un trait d’union'], ['Phrase correcte']],
      ['La grand-mère tricote un pull chaud.', 'La grandmère tricote un pull chaud.', {}, ['« grandmère » → « grand-mère »', 'il faut un trait d’union'], ['il faut l’espace', '« grand mère »']],
      ['Il est parti tôt.', 'Il est-parti tôt.', {}, ['« est-parti » → « est parti »', 'ce sont DEUX mots'], []],
      ['Elle a mangé une pomme.', 'Elle a manger une pomme.', FM, ['terminaison -er / -é / -ez', 'participe passé avec avoir : invariable', 'mordre', 'se prononcent pareil'], ['homophone lexical', 'le SENS', 'c’est l’accord qui la dit', 'lettre muette']],
      ['Elle a mangé une pomme.', 'Elle a mangée une pomme.', FM, ['participe passé avec avoir : invariable', 'le « e » est en trop'], ['« une » féminin']],
      ['Il met ses chaussures et son manteau.', 'Il met ses chaussures est son manteau.', FM, ['homophone grammatical'], ['accorder « et »', 'groupe nominal']],
      ['La mer se calme après la tempête.', 'La mer se calme après la tempêtent.', { 'tempête': ['tempêtent', 'tempêtes'] }, ['homophone lexical'], ['le sujet est au SINGULIER', '« tempêtent » → « tempête » : accord']],
      ['Mon frère et ma sœur sont arrivés ensemble.', 'Mon frère et ma sœur sont arrivé ensemble.', FM, [], ['« ma » (singulier)']],
      // un alignement DÉCALÉ ne fabrique pas de paire à trait d'union (phrases et fautes inventées)
      ['Il a pris deux rendez-vous.', 'Il a pri deu randévou.', {}, [], ['deu randévou']],
      ['Elle garde ses porte-clés.', 'Elle garde cé portklé.', {}, [], ['cé portklé']],
    ]) {
      let h; try { const F = X.diagnose(cible, eleve, fam); h = texte(X.rendre(F, F, 1)); } catch (e) { fail('dictée (lot 4) « ' + eleve + ' » : ' + e.message); continue; }
      for (const x of oui) if (!has(h, x)) fail('dictée (lot 4) « ' + eleve + ' » (dicté : « ' + cible + ' ») sans « ' + x + ' » — rendu : ' + h);
      for (const x of non) if (has(h, x)) fail('dictée (lot 4) « ' + eleve + ' » (dicté : « ' + cible + ' ») contient « ' + x + ' » — rendu : ' + h);
    }
    if (app.indexOf('Le bon verbe, le bon son') >= 0) fail('app (Conjugue) : « Le bon verbe, le bon son » — un accent manquant ne garantit pas le son (« achete » / « achète »)');
    console.log('  ✓ dictée (lot 4) : ' + nNote + ' notes de grammaire sur ' + nSub + ' substitutions, aucune ne contredit la forme attendue ; mots-outils, -er/-é/-ez, ' + nTrait + ' traits d’union');
  }
}

console.log(rouge ? ('\nTEXTES : ' + rouge + ' attente(s) non tenue(s)') : '\nTEXTES : toutes les attentes tenues (' + CAS.length + ' phrases, couche partagée, routage de ' + NOMS.size + ' règles)');
process.exit(rouge ? 1 : 0);
