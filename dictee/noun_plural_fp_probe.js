// FP=0 À L'ÉCHELLE pour rNounPlural — le corpus UD est du français CORRECT, donc TOUT
// déclenchement de la règle du pluriel y est un FAUX POSITIF. On compare AVANT/APRÈS
// l'assouplissement du veto verbal derrière un déterminant pluriel NON AMBIGU.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const APP = process.env.APP || path.join(__dirname, '..', 'app', 'omega-pendu.html');
const html = fs.readFileSync(APP, 'utf8');
const t = 'id="noun-post-gz">'; const a = html.indexOf(t);
globalThis.OMEGA_NOUN_POST = {};
zlib.gunzipSync(Buffer.from(html.slice(a + t.length, html.indexOf('</script>', a)).replace(/\s/g, ''), 'base64'))
  .toString('utf8').split('\n').forEach(l => { const p = l.split('\t'); if (p.length >= 3) globalThis.OMEGA_NOUN_POST[p[0]] = [+p[1], +p[2]]; });
const hm = 'id="pos-hmm-gz">'; const b = html.indexOf(hm);
if (b >= 0) { try { globalThis.OMEGA_POS_HMM = JSON.parse(zlib.gunzipSync(Buffer.from(
  html.slice(b + hm.length, html.indexOf('</script>', b)).replace(/\s/g, ''), 'base64')).toString('utf8')); } catch (e) {} }
const { create } = require('./correcteur.js');
(async () => {
  const c = await create(APP);
  const lines = fs.readFileSync(path.join(__dirname, 'fp_scale_corpus.txt'), 'utf8').split('\n').filter(Boolean);
  let n = 0, toks = 0; const ex = [];
  for (const s of lines) {
    toks += s.split(/\s+/).length;
    for (const f of c.grammar(s)) if (/pluriel nom/.test(f.name || '')) {
      n++; if (ex.length < 8) ex.push(f.word + '→' + f.sugg + '  « ' + s.slice(0, 62) + ' »');
    }
  }
  console.log(`rNounPlural sur ${lines.length} phrases FR CORRECTES (${toks} tokens) : ${n} déclenchement(s) = ${n} FAUX POSITIFS`);
  ex.forEach(e => console.log('   ' + e));
})();
