// Shim partagé (#30) : extrait + décompresse le blob gzip <script id="vdc-lex-gz"> de l'app monolithe.
// Les harnais headless posent `global.OMEGA_VDC = vdcSeed(html)` AVANT d'évaluer le moteur → le seed sync
// peuple les maps grammaticales sans passer par le DecompressionStream async (parité, comme OMEGA_POS_HMM).
const zlib = require('zlib');

function vdcSeed(html) {
  const tag = 'id="vdc-lex-gz">';
  const a = html.indexOf(tag);
  if (a < 0) return null;
  const s = a + tag.length, e = html.indexOf('</script>', s);
  const b64 = html.slice(s, e).replace(/\s/g, '');
  return JSON.parse(zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8'));
}

module.exports = { vdcSeed };
