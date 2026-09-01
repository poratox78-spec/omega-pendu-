// bake_probe.js — GARDE DU CORRECTEUR AUTONOME, dans les conditions RÉELLES de la CI.
//
// POURQUOI CE FICHIER EXISTE (panne du 2026-08-03, PR#366 → #367) :
//   Du code d'UI navigateur (`navigator.mediaDevices`, information sur le périphérique audio) est
//   tombé dans la zone BAKÉE du correcteur — celle que `build_correcteur.js` extrait du monolithe
//   pour en faire un module Node autonome. La garde écrite était `!navigator.mediaDevices`, qui
//   JETTE quand `navigator` n'existe pas du tout, au lieu de valoir false.
//   → CI ROUGE : « ReferenceError: navigator is not defined ».
//   → dev.sh VERT quand même. Pourquoi ? **Node 21+ définit un `navigator` global.** La machine de
//     dev est en Node 24 (navigator présent), la CI sur une version antérieure (absent).
//
//   Autrement dit : le contrôle LOCAL était PLUS PERMISSIF que la CI, donc il MENTAIT. Un « tout
//   vert » qui ne prédit pas la CI ne sert à rien — c'est exactement le genre d'écart que
//   `ci_parity_probe.py` traque au niveau des LISTES de checks, mais qui passait au niveau de
//   l'ENVIRONNEMENT d'exécution.
//
// CE QU'ON FAIT ICI : on teste le bake DEUX FOIS, dans deux mondes.
//   ① tel quel (Node du dev, `navigator` peut exister) ;
//   ② `navigator` SUPPRIMÉ — le monde de la CI et des vieux Node.
//   Un seul script, appelé des DEUX côtés (dev.sh et ci.yml), pour qu'ils ne puissent plus diverger.
//
//   node dictee/bake_probe.js            · node dictee/bake_probe.js --check   (garde CI)
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-bake-'));
const OUT = path.join(TMP, 'c.standalone.js');

// Le test métier, identique dans les deux mondes : une faute est corrigée, une phrase juste
// n'est PAS touchée (recall ET FP=0, les deux comptent).
//
// ⭐ ET SURTOUT : LE MOTEUR EST-IL ÉQUIPÉ ? Ce banc ne testait qu'UN cas, « fote »→« faute » — une
// correction du SPELLER. Or le bake n'embarquait que `speller-lex-gz` et son `init()` n'appelait que
// `loadSpellerLex()` : l'accord du NOMBRE, du GENRE et les PRÉNOMS étaient MUETS, et les deux sondes
// qui gardaient le bake (ici et dev.sh:98) passaient au vert. Vérifié le 01/09/2026 en interrogeant
// l'artefact : « les chien aboient » rendait (RIEN). C'est le bug du 2026-08-11, réparé dans l'app et
// jamais dans le bake — alors que CORRECTEUR.md propose ce bake comme voie d'intégration à des tiers.
// Les trois cas ci-dessous sont les MÊMES que ceux du banc navigateur réel : chacun exige qu'une
// TABLE PRÉCISE soit chargée, et échoue si elle ne l'est pas. On teste un COMPORTEMENT, pas une
// présence — une table vide mais non nulle répondrait « oui » à une question de présence.
const TEST = `
  const C = require(${JSON.stringify(OUT)});
  C.init().then(function () {
    const f = C.correct('une grosse fote');
    if (!f.find(function (x) { return x.word === 'fote' && x.sugg === 'faute'; })) throw new Error('bake KO : « fote » non corrigé');
    // le moteur est-il ÉQUIPÉ ? une table manquante = ces trois-là deviennent muets, en silence.
    const equipe = [['les chien aboient', 'chien', 'chiens', 'noun-post (accord du nombre)'],
                    ['des oiseau dans le ciel', 'oiseau', 'oiseaux', 'noun-post (pluriel en -x)'],
                    ['Marie est venu.', 'venu', 'venue', 'prenoms + genre + pos-hmm (l’ablation montre qu’il en dépend aussi)'],
                    // ⭐ pos-hmm : la table la PLUS porteuse, établie par ABLATION sur le moteur réel
                    // (bake reconstruit sans une table à la fois). Sans elle, 8 phrases dys réelles sur 300
                    // changent de correction — et le moteur FABRIQUE une faute (« ont »→« on ») qu'elle
                    // retenait. Ces trois cas ont un SUJET éloigné du verbe : muets sans le tagger.
                    ['la liste des courses sont longue', 'sont', 'est', 'pos-hmm (sujet éloigné)'],
                    ['le chien de mes voisins aboient', 'aboient', 'aboie', 'pos-hmm (complément pluriel)'],
                    ['la plupart des élèves comprend la leçon', 'comprend', 'comprennent', 'pos-hmm (quantifieur)']];
    // on collecte TOUS les cas muets avant de jeter : s'arrêter au premier accusait une table
    // innocente. Retirer pos-hmm casse 4 cas ; la boucle ne montrait que le 1er, étiqueté prenoms.
    const muets = [];
    equipe.forEach(function (c) {
      const g = C.correct(c[0]) || [];
      if (!g.find(function (x) { return x.word === c[1] && x.sugg === c[2]; }))
        muets.push(c[3] + ' : « ' + c[0] + ' » ne donne pas « ' + c[2] + ' »');
    });
    if (muets.length)
      throw new Error('bake MUET sur ' + muets.length + ' comportement(s) — lexique non baké ou chargeur'
                      + ' non appelé dans init() :' + muets.map(function (m) { return ' [' + m + ']'; }).join(''));
    if (C.correct('Le chat mange une pomme.').length) throw new Error('bake FP : phrase correcte flaguée');
    console.log('OK');
  }).catch(function (e) { console.error(e && e.message || e); process.exit(1); });
`;

function run(label, prelude) {
  const r = cp.spawnSync(process.execPath, ['-e', prelude + TEST], { encoding: 'utf8' });
  const ok = r.status === 0 && /OK/.test(r.stdout || '');
  const msg = ok ? '' : ((r.stderr || r.stdout || '').trim().split('\n')[0] || 'échec sans message');
  return { label, ok, msg };
}

let fails = [];
try {
  const b = cp.spawnSync(process.execPath, [path.join(__dirname, 'build_correcteur.js'), OUT], { encoding: 'utf8' });
  if (b.status !== 0) { console.error('[bake] build_correcteur.js a échoué :', (b.stderr || '').slice(0, 300)); process.exit(1); }

  const res = [
    run('Node tel quel', ''),
    // ⭐ LE test qui manquait : reproduire l'ABSENCE de `navigator` (Node < 21, donc la CI).
    run('sans navigator (= CI)', 'delete globalThis.navigator;\n'),
    // même logique pour les autres globales de navigateur qui traînent dans le monolithe
    run('sans window/document', 'delete globalThis.navigator; delete globalThis.window; delete globalThis.document;\n'),
  ];
  for (const r of res) {
    console.log('  ' + (r.ok ? '✓' : '✗') + ' ' + (r.label + '                        ').slice(0, 24) + ' ' + r.msg);
    if (!r.ok) fails.push(r.label);
  }
} finally {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
}

console.log(fails.length ? '❌ bake : ' + fails.length + ' monde(s) en échec — ' + fails.join(', ')
                         : '✅ bake autonome OK dans les 3 mondes (dont l\'environnement CI)');
if (fails.length && process.argv.includes('--check')) process.exit(1);
