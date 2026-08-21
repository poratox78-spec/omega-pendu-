// ===== OMEGA Dys — cœur « police de son » (sans DOM ; chargé par l'app ET par node) =====
// Pendant JS de police/build_son_layer.py. PRINCIPE CARDINAL : le texte ne change JAMAIS —
// on segmente le mot en graphèmes {g, ph, cls}, on ne substitue aucun caractère.
// cls : 'voi' (obstruente voisée → graisse Heavy) · 'srd' (sourde → Light) · 'mute' (grisée,
// gris FONCÉ lisible) · 'n' (neutre). Le g2p est INJECTÉ (app : _DECL2.g2p ; node : extrait).
// Parité CI : police/parity_son.js (clitiques ≡ Python + invariants end-to-end sur le g2p app).
var OmegaDysSonCore = (function () {
  'use strict';
  // IPA → SAMPA Lexique (copie verbatim du panneau Décompose de l'app)
  var I2S = {'a':'a','e':'e','i':'i','o':'o','u':'u','y':'y','ɑ':'a','ɔ':'O','ɛ':'E','ø':'2','œ':'9','ə':'°','p':'p','b':'b','t':'t','d':'d','k':'k','ɡ':'g','g':'g','f':'f','v':'v','s':'s','z':'z','m':'m','n':'n','l':'l','ʁ':'R','ʃ':'S','ʒ':'Z','ɲ':'N','ŋ':'G','j':'j','w':'w','ɥ':'8','ɑ̃':'@','ɛ̃':'5','œ̃':'1','ɔ̃':'§'};
  // overlay accents (le g2p moteur rend '?' sur les lettres accentuées) — verbatim panneau Décompose
  var ACC = {'é':'e','è':'ɛ','ê':'ɛ','ë':'ɛ','à':'a','â':'a','ä':'a','ô':'o','ö':'o','î':'i','ï':'i','û':'y','ù':'y','ü':'y','ÿ':'i','ç':'s'};
  // mots-fonction (classe fermée) — MÊME table que build_son_layer.py (schwa = ° en SAMPA Lexique)
  var CLIT = {
    le:[['l','l'],['e','°']], la:[['l','l'],['a','a']], les:[['l','l'],['e','e'],['s','']],
    se:[['s','s'],['e','°']], ne:[['n','n'],['e','°']], de:[['d','d'],['e','°']],
    des:[['d','d'],['e','e'],['s','']], me:[['m','m'],['e','°']], te:[['t','t'],['e','°']],
    ce:[['c','s'],['e','°']], je:[['j','Z'],['e','°']], que:[['qu','k'],['e','°']],
    du:[['d','d'],['u','y']], un:[['un','1']], une:[['u','y'],['n','n'],['e','']]
  };
  var VOICED = 'bdgvzZ', UNVOICED = 'ptkfsS';
  function classify(ph) {
    if (!ph) return 'mute';
    var c = ph.charAt(0);
    if (VOICED.indexOf(c) >= 0) return 'voi';
    if (UNVOICED.indexOf(c) >= 0) return 'srd';
    return 'n';
  }
  function ipa2sampa(ph) {
    if (ph === '∅' || !ph) return '';
    var o = '', i = 0;
    while (i < ph.length) {
      var t = ph[i];
      if (i + 1 < ph.length && ph.charCodeAt(i + 1) === 0x303) { t = ph[i] + ph[i + 1]; i += 2; }
      else i++;
      o += (I2S[t] != null ? I2S[t] : t);
    }
    return o;
  }
  function wordSegments(word, g2p) {
    var lw = word.toLowerCase(), pairs = [], k;
    if (CLIT[lw]) pairs = CLIT[lw];
    else {
      var steps = g2p(lw) || [], n = steps.length;
      for (k = 0; k < n; k++) {
        var g = steps[k].g, raw = steps[k].ph;
        if ((raw === '?' || !raw) && ACC[g]) raw = ACC[g];
        var sp = ipa2sampa(raw);
        pairs.push([g, sp]);
      }
    }
    // reprojection de casse sur le mot ORIGINAL ; FAIL-SAFE (≡ Python) : si l'alignement ne
    // couvre pas le mot (apostrophe, œ…), UN segment neutre → le texte reste intact.
    var cat = '', i;
    for (i = 0; i < pairs.length; i++) cat += pairs[i][0];
    if (cat !== lw) return [{g: word, ph: '', cls: 'n'}];
    var segs = [], pos = 0;
    for (i = 0; i < pairs.length; i++) {
      var gg = word.slice(pos, pos + pairs[i][0].length);
      pos += pairs[i][0].length;
      segs.push({g: gg, ph: pairs[i][1], cls: classify(pairs[i][1])});
    }
    return segs;
  }
  var TOKEN = /[a-zà-ÿœ']+/gi;
  function sentenceSegments(sentence, g2p) {
    var out = [], i = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(sentence))) {
      if (m.index > i) out.push({raw: sentence.slice(i, m.index)});
      out.push({mot: m[0], segs: wordSegments(m[0], g2p)});
      i = m.index + m[0].length;
    }
    if (i < sentence.length) out.push({raw: sentence.slice(i)});
    return out;
  }
  return {wordSegments: wordSegments, sentenceSegments: sentenceSegments,
          classify: classify, ipa2sampa: ipa2sampa, CLIT: CLIT};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = OmegaDysSonCore;
