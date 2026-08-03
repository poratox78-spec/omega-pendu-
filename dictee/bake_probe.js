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
const TEST = `
  const C = require(${JSON.stringify(OUT)});
  C.init().then(function () {
    const f = C.correct('une grosse fote');
    if (!f.find(function (x) { return x.word === 'fote' && x.sugg === 'faute'; })) throw new Error('bake KO : « fote » non corrigé');
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
