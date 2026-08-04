// voix_arbitrage_bench.js — BANC MANUEL (hors CI : demande Chrome + un serveur local).
//   python -m http.server 8899 --bind 127.0.0.1     puis     node dictee/voix_arbitrage_bench.js
// La garde AUTOMATIQUE, elle, est dictee/voix_parity_probe.js (statique, donc CI-compatible).
// BANC DE L'ARBITRAGE N-BEST — dans le NAVIGATEUR, sur le code RÉELLEMENT LIVRÉ.
//
// POURQUOI PAS EN NODE. Le correcteur autonome (build_correcteur.js) ne charge QUE le lexique du
// speller : ni noun-post, ni OS-LM, ni confusables. Les règles d'accord y sont donc INERTES —
// vérifié : « la grande boites » n'y déclenche rien alors que Python la corrige. Mesurer
// l'arbitrage là-dessus aurait donné un faux négatif propre et silencieux.
// Ici on ouvre la VRAIE page, qui charge les VRAIES données, et on y injecte la fonction
// _arbitre EXTRAITE DU FICHIER LIVRÉ (pas une copie écrite à la main).
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9334, PAGE = 'http://127.0.0.1:8899/saisie-vocale.html';

// Les 5 hypothèses RÉELLES rendues par Google sur une dictée de Rem, plus deux cas construits où
// le n°1 de l'ASR est cassé (c'est là que l'arbitrage doit servir à quelque chose).
const CAS = [
  { nom: 'réel (Google, 5 hyp.)', attendu: 0,
    hyps: ["les enfants jouent dans le jardin", "les enfants joue dans le jardin",
           "les enfant jouent dans le jardin", "les enfants jouent dans les jardins",
           "l'enfant joue dans le jardin"] },
  { nom: 'n°1 cassé — nombre',    attendu: 1,
    hyps: ["la grande boites", "la grande boite", "la grande botte"] },
  { nom: 'n°1 cassé — accord SV', attendu: 1,
    hyps: ["les enfants joue", "les enfants jouent", "les enfant jouent"] },
  { nom: 'aucune preuve → on NE TOUCHE PAS à l\'ordre de l\'ASR', attendu: 0,
    hyps: ["le chat dort sur le canapé", "le chat sort sur le canapé", "le chat dore sur le canapé"] },
];

const src = fs.readFileSync(path.join(__dirname, '..', 'saisie-vocale.html'), 'utf8');
const a = src.indexOf('function _arbitre(r){');
const FN = src.slice(a, src.indexOf('\n  }', a) + 4);          // extraite du livrable, telle quelle
if (!a || !/return \(r\[best\]/.test(FN)) { console.error('extraction de _arbitre ratée'); process.exit(1); }

const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'om-arb-'));
const ch = spawn(CHROME, ['--headless=new', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + profil, '--remote-debugging-port=' + PORT, '--remote-allow-origins=*', PAGE],
  { stdio: 'ignore' });
const attendre = ms => new Promise(r => setTimeout(r, ms));

async function cible() {
  for (let i = 0; i < 60; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = l.find(x => x.type === 'page' && /saisie-vocale/.test(x.url));
      if (p) return p.webSocketDebuggerUrl; } catch (e) {}
    await attendre(500);
  }
  throw new Error('page introuvable');
}
function cdp(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url); let id = 0; const att = new Map();
    ws.onopen = () => res({ ev: e => new Promise((ok, ko) => { const n = ++id; att.set(n, { ok, ko });
      ws.send(JSON.stringify({ id: n, method: 'Runtime.evaluate',
        params: { expression: e, returnByValue: true, awaitPromise: true } })); }) });
    ws.onerror = e => rej(new Error('WS'));
    ws.onmessage = m => { const d = JSON.parse(m.data);
      if (d.id && att.has(d.id)) { const { ok, ko } = att.get(d.id); att.delete(d.id);
        if (d.error) ko(new Error(d.error.message));
        else if (d.result?.exceptionDetails) ko(new Error(d.result.exceptionDetails.text + ' ' +
             (d.result.exceptionDetails.exception?.description || '')));
        else ok(d.result?.result?.value); } };
  });
}

(async () => {
  let code = 1;
  try {
    const c = await cdp(await cible());
    // attendre que le moteur ait fini de charger SES données (c'est tout l'objet du test)
    // ⚠️ `DC` est une variable LOCALE de l'IIFE de la page ; la globale s'appelle DYSCORE.
    const pret = await c.ev(`new Promise(function(ok){ var n=0; (function t(){
       var D=window.DYSCORE;
       if(D && D.diagnoseAll && D.diagnoseAll('la grande boites').flags.length) return ok('pret');
       if(++n>120) return ok('timeout'); setTimeout(t,500); })(); })`);
    console.log('moteur :', pret);
    if (pret !== 'pret') throw new Error('le correcteur n\'a pas fini de charger ses données');

    await c.ev(`var DC = window.DYSCORE; window.__arb = (${FN.replace(/^function _arbitre/, 'function')});'ok'`);
    console.log('\n════ ARBITRAGE N-BEST — page réelle, code livré ════');
    let ok = 0;
    for (const cas of CAS) {
      const faux = h => `({length:${cas.hyps.length},` +
        cas.hyps.map((t, i) => `${i}:{transcript:${JSON.stringify(t)}}`).join(',') + `})`;
      const n = await c.ev(`(function(){var r=${faux()};var out=window.__arb(r);
         for(var i=0;i<r.length;i++) if(r[i].transcript.trim()===out) return i; return -1;})()`);
      const bon = n === cas.attendu;
      ok += bon ? 1 : 0;
      console.log(`  ${bon ? '✓' : '✗'} ${cas.nom}`);
      console.log(`      choisi n°${n + 1} « ${cas.hyps[n]} »   (attendu n°${cas.attendu + 1})`);
    }
    console.log(`\n${ok}/${CAS.length} ${ok === CAS.length ? '✅' : '❌'}`);
    code = ok === CAS.length ? 0 : 1;
  } catch (e) { console.error('ÉCHEC :', e.message); }
  finally { try { ch.kill(); } catch (e) {} }
  process.exit(code);
})();
