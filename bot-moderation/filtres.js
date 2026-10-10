/* LES FILTRES CLASSIQUES DU BOT (10/10/2026) — Rem : « liens, MAJUSCULES, spam répété si même texte ; pas de limite
 * d'émoticônes ».
 *
 * Ils répondent dans la même forme que le détecteur d'insultes (detecteur.js) : { signale, gravite, trouvailles }, avec
 * trois familles de plus — lien, majuscules, spam. C'est la page du bot qui décide quoi en faire (prévenir, effacer).
 *   - LIENS : la reconnaissance des liens de l'outil (outil/lecture_chat.py, _URL), resserrée d'un cran — l'extension doit
 *     finir le mot : « salut.comment ça va » n'est pas un lien vers salut.com. Sites autorisés, !permit (le bot).
 *   - MAJUSCULES : 12 lettres au moins, 70 % en capitales — sur le TEXTE seulement : une émoticône (LUL, KEKW, PogChamp)
 *     ne compte jamais.
 *   - SPAM : le MÊME texte, par la même personne, 3 fois en 60 s. Un message fait seulement d'émoticônes n'est jamais du
 *     spam ; un message de 1 ou 2 signes non plus (les lettres du pendu, « ok », « gg »).
 */
var FILTRES = (function () {
  var URL = /(?:https?:\/\/|www\.)\S+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|fr|net|org|tv|gg|io|ly|be|co|xyz|me|link|ru)(?![\w-])(?:\/\S*)?/gi;
  var MAJ_LETTRES = 12, MAJ_PART = 0.7, SPAM_FOIS = 3, SPAM_FENETRE_MS = 60000, SPAM_MIN = 3;

  /* le texte tapé, sans les émoticônes ni les mentions (EventSub donne le message en morceaux) */
  function texteSeul(ev) {
    var m = ev && ev.message;
    if (!m) return '';
    if (!Array.isArray(m.fragments) || !m.fragments.length) return m.text || '';
    return m.fragments.filter(function (f) { return f.type === 'text'; }).map(function (f) { return f.text; }).join(' ');
  }
  function domaine(u) {
    return String(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '').replace(/[.,;:!?)\]]+$/, '');
  }
  function liens(texte) {
    var r = [];
    (String(texte || '').match(URL) || []).forEach(function (u) { var d = domaine(u); if (d && r.indexOf(d) < 0) r.push(d); });
    return r;
  }
  /* un domaine autorisé : lui-même ou un de ses sous-domaines (« youtube.com » permet « m.youtube.com ») */
  function autorise(d, sites) {
    return (sites || []).some(function (s) {
      s = domaine(s);
      return s && (d === s || d.slice(-s.length - 1) === '.' + s);
    });
  }
  function crie(texte) {
    var lettres = String(texte || '').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
    if (lettres.length < MAJ_LETTRES) return false;
    var hautes = lettres.replace(/[^A-ZÀ-ÖØ-Þ]/g, '').length;
    return hautes / lettres.length >= MAJ_PART;
  }
  function cle(texte) {                                        // « Salut !! », « SALUTTT », « salut » : le même message
    return String(texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, '').replace(/(.)\1+/g, '$1').replace(/\s+/g, ' ').trim();
  }
  /* memoire : un objet que la page garde (login → [{ cle, t }]) ; maintenant : l'heure (les sondes la fixent) */
  function analyser(ev, options, memoire, maintenant) {
    options = options || {};
    maintenant = maintenant || Date.now();
    var texte = texteSeul(ev), trouvailles = [];
    if (options.liens !== false && !options.liensPermis) {
      liens(texte).forEach(function (d) {
        if (!autorise(d, options.sites)) trouvailles.push({ mot: d, famille: 'lien', comment: 'site non autorisé', vu: d });
      });
    }
    if (options.majuscules !== false && crie(texte)) trouvailles.push({ mot: 'MAJUSCULES', famille: 'majuscules', comment: '70 % de capitales ou plus', vu: '' });
    if (options.spam !== false && memoire) {
      var k = cle(texte), qui = String((ev && (ev.chatter_user_id || ev.chatter_user_login)) || '?');
      if (k.length >= SPAM_MIN) {
        var l = (memoire[qui] || []).filter(function (x) { return maintenant - x.t < SPAM_FENETRE_MS; });
        l.push({ cle: k, t: maintenant });
        memoire[qui] = l.slice(-10);
        var fois = l.filter(function (x) { return x.cle === k; }).length;
        if (fois >= SPAM_FOIS) trouvailles.push({ mot: 'même message ×' + fois, famille: 'spam', comment: '3 fois en 1 minute', vu: '' });
      }
    }
    return { signale: trouvailles.length > 0, gravite: trouvailles.length ? trouvailles[0].famille : null, trouvailles: trouvailles };
  }
  return { analyser: analyser, liens: liens, crie: crie, cle: cle, texteSeul: texteSeul, domaine: domaine, autorise: autorise,
    FAMILLES: { lien: 1, majuscules: 1, spam: 1 } };
})();
if (typeof module !== 'undefined') module.exports = FILTRES;
