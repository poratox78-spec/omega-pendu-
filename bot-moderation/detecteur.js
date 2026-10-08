/* LE DÉTECTEUR du bot de modération (08/10/2026) — trouve les insultes, même CAMOUFLÉES, dans un message du chat.
 *
 * Ce qu'il démasque : les chiffres et symboles à la place des lettres (c0nn4rd, $alope), les lettres espacées ou pointées
 * (k o n, c.o.n.n.a.r.d), les lettres doublées (connnnard), et le SON (konar, anculé, paidai) grâce à la clé de prononciation
 * d'OMEGA (cle_son.js). Ce qu'il protège : un mot français qui EXISTE n'est jamais accusé parce qu'il ressemble à une insulte
 * (mots_fr.js) ; un mot à double sens (con ↔ qu'on, pédale de vélo) ne l'est que dans une tournure qui vise quelqu'un.
 * Il ne fait que RÉPONDRE : c'est la page du bot qui décide quoi en faire (prévenir, effacer…), selon les réglages.
 *
 *   var r = DETECTEUR.analyser("t'es qu'un k o n n a r d", { familles: ['haine', 'menace', 'insulte'] });
 *   r.signale → true ; r.trouvailles → [{ mot: 'connard', famille: 'insulte', comment: 'lettres espacées', vu: 'k o n n a r d' }]
 */
var DETECTEUR = (function () {
  var L = (typeof LISTE_INSULTES !== 'undefined') ? LISTE_INSULTES : require('./liste_insultes.js');
  var C = (typeof CLE_SON !== 'undefined') ? CLE_SON : require('./cle_son.js');
  var M = (typeof MOTS_FR !== 'undefined') ? MOTS_FR : require('./mots_fr.js');

  var COURANTS = {};
  M.split(' ').forEach(function (m) { COURANTS[m] = 1; });

  var CHIFFRES = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '€': 'e', '!': 'i', '|': 'i' };

  function nu(s) {   // minuscules, sans accent, ligatures
    return String(s || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function serre(w) { return w.replace(/(.)\1+/g, '$1'); }          // lettres répétées → une seule
  // « konar » ≡ « konard », « tarlouz » ≡ « tarlouze » : la consonne finale qui ne s'entend pas. Une clé raccourcie doit
  // garder 4 signes au moins — « merdeux » réduit à « mer » accrochait « Mayer » et des textes de personnes dys (mesuré)
  function sansMuette(k) { var r = k.replace(/[dtsx]$/, ''); return r.length >= 4 ? r : k; }

  // les index de la liste : la forme écrite, la forme « serrée », la clé de son
  var MOTS = {}, SERRES = {}, SONS = {};
  Object.keys(L.mots).forEach(function (m) {
    var v = L.mots[m], fiche = Array.isArray(v) ? { famille: v[0], seul: v[1] !== false } : { famille: v, seul: true };
    fiche.mot = m;
    MOTS[m] = fiche;
    if (!SERRES[serre(m)]) SERRES[serre(m)] = fiche;
    if (m.length >= 4) {                                 // la clé entière, et sans la consonne finale muette
      [C.phonKey(m), sansMuette(C.phonKey(m))].forEach(function (k) { if (k.length >= 3 && !SONS[k]) SONS[k] = fiche; });
    }
  });
  var VISENT = L.visent.slice().sort(function (a, b) { return b.length - a.length; });
  var EXPRS = Object.keys(L.expressions).map(function (e) { return { e: e, famille: L.expressions[e] }; });

  /* le message ramené à une suite de mots « lisibles », chacun avec ce qu'on a dû défaire pour le lire */
  function decouper(message) {
    var t = nu(message).replace(/[’'`´]/g, ' ');
    var mots = [];
    // 1) lettres espacées ou pointées : au moins 3 lettres seules à la suite (« k o n », « c.o.n.n.a.r.d »)
    t = t.replace(/(?:^|[^a-z0-9@$€!|])((?:[a-z0-9@$€][\s.\-_*+~]+){2,}[a-z0-9@$€])(?=$|[^a-z0-9@$€!|])/g, function (tout, bloc) {
      var colle = bloc.replace(/[\s.\-_*+~]+/g, '');
      return tout.slice(0, tout.length - bloc.length) + ' \u0001' + colle + ' ';
    });
    // 2) séparateurs DANS un mot (« con.nard », « en-cu-lé »)
    t = t.replace(/([a-z0-9@$€])[.\-_*+~]+(?=[a-z0-9@$€])/g, '$1\u0002');
    (t.match(/[\u0001a-z0-9@$€!|\u0002]+/g) || []).forEach(function (brut) {
      var espace = brut.indexOf('\u0001') >= 0, pointe = brut.indexOf('\u0002') >= 0;
      var w = brut.replace(/[\u0001\u0002]/g, '');
      var lettres = /[a-z]/.test(w), autres = /[0-9@$€!|]/.test(w);
      if (!lettres && !/^[0-9]*[@$€][0-9@$€]*$/.test(w)) { if (w) mots.push({ w: w, vu: w, comment: null }); return; }
      var lu = w, comment = espace ? 'lettres espacées' : pointe ? 'lettres séparées' : null;
      if (autres && lettres) {
        lu = w.replace(/[0-9@$€!|]/g, function (c) { return CHIFFRES[c] || c; });
        if (lu !== w) comment = comment || 'chiffres ou symboles à la place des lettres';
      }
      lu = lu.replace(/[^a-z]/g, '');
      if (lu) mots.push({ w: lu, vu: brut.replace(/[\u0001\u0002]/g, espace ? ' ' : '.'), comment: comment });
    });
    return mots;
  }

  function precede(mots, i) {   // ce qui est écrit juste avant le mot i (jusqu'à 3 mots), ramené à la même forme
    var avant = [];
    for (var j = Math.max(0, i - 3); j < i; j++) avant.push(mots[j].w);
    var s = ' ' + avant.join(' ');
    for (var k = 0; k < VISENT.length; k++) if (s.slice(-VISENT[k].length - 1) === ' ' + VISENT[k]) return VISENT[k];
    return null;
  }

  function chercher(mot) {
    var w = mot.w;
    if (MOTS[w]) return { fiche: MOTS[w], comment: mot.comment || 'en clair' };
    if (COURANTS[w]) return null;                        // un mot qui existe n'est jamais un camouflage
    var s = serre(w);
    if (SERRES[s]) return { fiche: SERRES[s], comment: mot.comment || 'lettres répétées' };
    if (w.length >= 4) {
      var k = C.phonKey(w), f = SONS[k] || SONS[sansMuette(k)];
      if (f) return { fiche: f, comment: mot.comment ? mot.comment + ', même son' : 'écrit autrement, même son' };
    }
    return null;
  }

  function analyser(message, options) {
    options = options || {};
    var familles = options.familles || ['haine', 'menace', 'insulte'];
    var autorises = {};
    (options.autorises || []).forEach(function (m) { autorises[nu(m)] = 1; });
    var mots = decouper(message), trouvailles = [];
    mots.forEach(function (m, i) {
      if (autorises[m.w]) return;
      var r = chercher(m);
      if (!r || familles.indexOf(r.fiche.famille) < 0 || autorises[r.fiche.mot]) return;
      var vise = precede(mots, i);
      if (!r.fiche.seul && !vise) return;
      trouvailles.push({ mot: r.fiche.mot, famille: r.fiche.famille, comment: r.comment, vu: m.vu, vise: vise });
    });
    // les expressions, sur le message entier remis en mots « lisibles » (et serrés)
    var phrase = ' ' + mots.map(function (m) { return m.w; }).join(' ') + ' ';
    var phraseS = ' ' + mots.map(function (m) { return serre(m.w); }).join(' ') + ' ';
    EXPRS.forEach(function (x) {
      if (familles.indexOf(x.famille) < 0 || autorises[x.e]) return;
      if (phrase.indexOf(' ' + x.e + ' ') >= 0 || phraseS.indexOf(' ' + serre(x.e) + ' ') >= 0) {
        if (!trouvailles.some(function (t) { return x.e.indexOf(t.mot) >= 0; }))
          trouvailles.push({ mot: x.e, famille: x.famille, comment: 'expression', vu: x.e, vise: null });
      }
    });
    var ordre = ['menace', 'haine', 'insulte', 'leger', 'juron'];
    trouvailles.sort(function (a, b) { return ordre.indexOf(a.famille) - ordre.indexOf(b.famille); });
    return { signale: trouvailles.length > 0, gravite: trouvailles.length ? trouvailles[0].famille : null, trouvailles: trouvailles };
  }

  return { analyser: analyser, decouper: decouper, nu: nu };
})();
if (typeof module !== 'undefined') module.exports = DETECTEUR;
