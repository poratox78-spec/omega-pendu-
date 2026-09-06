// TEXTES D'EXPLICATION du correcteur — la sonde née de l'AUDIT du 11/09/2026 dans le vrai Chrome
// (dictee/AUDIT_CORRECTEUR_2026-09-11.md, §2). Le moteur y était juste sur 24 phrases ; les TEXTES, non :
// « clé → clés : remplace le verbe par mordre » (un nom), « c'est « ma » (singulier) qui commande → heures »
// (le cardinal « huit » est à côté), « château : é ferme, è ouvre » (un circonflexe), aucun 💡 sur -er/-é,
// c'est/s'est générique, « avont → avons : ce son s'écrit s » (une terminaison), « aujourdhui : les accents
// s'entendent » (une apostrophe manque). Aucun test ne lisait ces textes : ils dérivaient sans témoin.
//
// Ce que la sonde garde, sur le moteur de l'EXTENSION chargé comme le produit (mêmes assets) :
//   1) pour chaque phrase de l'audit, le 💡 (ctxHint → f.hint) et la ligne « remèdes » (REMED via diagnoseAll)
//      CONTIENNENT ce qu'ils doivent, et ne contiennent PLUS ce qui était faux ;
//   2) les blocs de texte partagés app ≡ extension : REMED (octet pour octet, CRLF neutralisé), _HSUB et
//      _HPROBE (aux blancs près) — deux routes, un seul texte.
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
    remed: { oui: ['chateau » → « château » : a→â', 'circonflexe'], non: ['é ferme'] } },
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
  { t: 'nous sommes allé au cinéma.', mots: { 'allé': { sugg: 'allés', oui: ['« nous » (pluriel)'] } },
    remed: { oui: ['il manque « s » : le participe s’ACCORDE ici'] } },
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
}

// 2) app ≡ extension sur les blocs de texte partagés
const norm = (s) => s.replace(/\r\n/g, '\n');
const app = norm(fs.readFileSync(path.join(ROOT, 'app', 'omega-pendu.html'), 'utf8'));
const ext = norm(fs.readFileSync(path.join(EXT, 'dys-core.js'), 'utf8'));
function bloc(src, a, b, nom) {
  const i = src.indexOf(a); if (i < 0) throw new Error('bloc ' + nom + ' introuvable (' + a + ')');
  const j = src.indexOf(b, i); if (j < 0) throw new Error('fin du bloc ' + nom + ' introuvable (' + b + ')');
  return src.slice(i, j);
}
const BLOCS = [
  ['REMED', '  var REMED={', 'function remedTip', (s) => s],
  ['_HSUB', 'var _HSUB = {', 'var REMED={', (s) => s.replace(/\s+/g, '')],
  ['_HPROBE', 'var _HPROBE={', 'function _suggVerbNum', (s) => s.replace(/\s+/g, '')],
];
for (const [nom, a, b, f] of BLOCS) {
  const x = f(bloc(app, a, b, nom)), y = f(bloc(ext, a, b, nom));
  if (x !== y) { let k = 0; while (k < x.length && x[k] === y[k]) k++; fail(nom + ' app ≠ extension au caractère ' + k + ' : app « ' + x.slice(k, k + 60) + ' » / ext « ' + y.slice(k, k + 60) + ' »'); }
  else console.log('  ✓ ' + nom + ' app ≡ extension (' + x.length + ' c.)');
}

console.log(rouge ? ('\nTEXTES : ' + rouge + ' attente(s) non tenue(s)') : '\nTEXTES : toutes les attentes tenues (' + CAS.length + ' phrases, ' + BLOCS.length + ' blocs app ≡ ext)');
process.exit(rouge ? 1 : 0);
