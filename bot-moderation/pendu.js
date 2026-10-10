/* LE PENDU DU CHAT (10/10/2026, Rem : « GO PENDU ») — le moteur d'une partie, et le FORMAT des messages du bot.
 *
 * Le bot (bot.js, dans le dock d'OBS) mène la partie : il choisit le mot, lit les lettres proposées dans le chat et écrit
 * l'état dans le chat. Le PLATEAU (pendu.html, une source navigateur d'OBS) n'a besoin d'aucun compte : il lit le chat
 * comme un spectateur anonyme et redessine la partie à partir des messages du bot — d'où un format fixe, lisible par un
 * humain ET par le plateau :
 *   🎯 PENDU · M A _ S O N · ❌ 2/8 · Z X — ✅ Lili : A · ❌ Max : Z
 *   🏆 PENDU · MAISON · trouvé par Lili (+5) — …
 *   💀 PENDU · MAISON · perdu — …          ⏹ PENDU · MAISON · arrêté — …
 * Les lettres se comparent sans accent : « e » découvre E, É, È, Ê.
 * Repris du jeu existant (Rem : « on l'a déjà ») : les POINTS par lettre de pendable.html (VAL, façon Scrabble), son
 * dessin du pendu (pendu.html) ; les NIVEAUX des mots = la mesure de mot-difficile-pendu.html (fabriquer_pendu.py).
 */
var PENDU = (function () {
  // pendable.html : « const VAL » — une lettre trouvée rapporte sa valeur × le nombre de fois qu'elle est dans le mot
  var VAL = { A: 1, E: 1, I: 1, L: 1, N: 1, O: 1, R: 1, S: 1, T: 1, U: 1, D: 2, G: 2, M: 2, B: 3, C: 3, P: 3, F: 4, H: 4, V: 4,
    J: 8, Q: 8, K: 10, W: 10, X: 10, Y: 10, Z: 10 };
  var BONUS_MOT = 10;                                          // celui qui termine le mot
  function valeur(l) { return VAL[String(l).toUpperCase()] || 1; }
  function nu(t) { return String(t || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  /* une nouvelle partie */
  function nouvelle(mot, max) {
    mot = String(mot).toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae');   // le mot et sa clé ont la même longueur
    return { mot: mot, cle: nu(mot), trouvees: {}, ratees: [], erreurs: 0, max: max || 8, fin: null, debut: Date.now(), dernier: Date.now() };
  }
  /* le mot masqué : « M A _ S O N » (les lettres trouvées gardent leur accent) */
  function masque(p, tout) {
    var r = [];
    for (var i = 0; i < p.mot.length; i++) r.push(tout || p.trouvees[p.cle[i]] ? p.mot[i].toUpperCase() : '_');
    return r.join(' ');
  }
  function gagnee(p) {
    for (var i = 0; i < p.cle.length; i++) if (!p.trouvees[p.cle[i]]) return false;
    return true;
  }
  /* une lettre proposée → { quoi: 'bonne' | 'mauvaise' | 'deja' | 'invalide' | 'finie', n: nombre de fois dans le mot } */
  function proposer(p, lettre) {
    if (p.fin) return { quoi: 'finie', n: 0 };
    var l = nu(lettre);
    if (!/^[a-z]$/.test(l)) return { quoi: 'invalide', n: 0 };
    if (p.trouvees[l] || p.ratees.indexOf(l) >= 0) return { quoi: 'deja', n: 0 };
    p.dernier = Date.now();
    var n = p.cle.split(l).length - 1;
    if (n) {
      p.trouvees[l] = 1;
      if (gagnee(p)) p.fin = 'gagnee';
      return { quoi: 'bonne', n: n };
    }
    p.ratees.push(l); p.erreurs++;
    if (p.erreurs >= p.max) p.fin = 'perdue';
    return { quoi: 'mauvaise', n: 0 };
  }
  /* le mot entier proposé : les points gagnés (valeur des lettres encore cachées + le bonus), ou 0 s'il est faux */
  function deviner(p, mot) {
    if (p.fin || nu(mot).replace(/[^a-z]/g, '') !== p.cle) return 0;
    var pts = BONUS_MOT;
    for (var i = 0; i < p.cle.length; i++) { if (!p.trouvees[p.cle[i]]) pts += valeur(p.cle[i]); }
    for (i = 0; i < p.cle.length; i++) p.trouvees[p.cle[i]] = 1;
    p.fin = 'gagnee'; p.dernier = Date.now();
    return pts;
  }
  /* les points d'une bonne lettre (n = nombre de fois) ; + le bonus si elle termine le mot */
  function pointsLettre(p, lettre, n) { return valeur(nu(lettre)) * n + (p.fin === 'gagnee' ? BONUS_MOT : 0); }
  /* combien de lettres restent cachées (les points d'un mot trouvé d'un coup) */
  function cachees(p) {
    var n = 0;
    for (var i = 0; i < p.cle.length; i++) if (!p.trouvees[p.cle[i]]) n++;
    return n;
  }
  /* une lettre cachée au hasard (l'indice) */
  function indice(p, hasard) {
    var reste = [];
    for (var i = 0; i < p.cle.length; i++) if (!p.trouvees[p.cle[i]] && reste.indexOf(p.cle[i]) < 0) reste.push(p.cle[i]);
    if (reste.length <= 1) return null;                       // on ne donne pas la dernière
    var l = reste[Math.floor((hasard || Math.random)() * reste.length) % reste.length];
    p.trouvees[l] = 1;
    return l;
  }

  /* ── le format des messages (le bot les écrit, le plateau les lit) ── */
  function ligneEtat(p, suite) {
    var s = '🎯 PENDU · ' + masque(p) + ' · ❌ ' + p.erreurs + '/' + p.max;
    if (p.ratees.length) s += ' · ' + p.ratees.join(' ').toUpperCase();
    return s + (suite ? ' — ' + suite : '');
  }
  function ligneFin(p, quoi, qui, points, suite) {
    var s = (quoi === 'gagnee' ? '🏆' : quoi === 'perdue' ? '💀' : '⏹') + ' PENDU · ' + p.mot.toUpperCase() + ' · ';
    s += quoi === 'gagnee' ? 'trouvé par ' + qui + (points ? ' (+' + points + ')' : '') : quoi === 'perdue' ? 'perdu' : 'arrêté';
    return s + (suite ? ' — ' + suite : '');
  }
  var LETTRES = 'A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸ';
  var RE_ETAT = new RegExp('^🎯 PENDU · ([' + LETTRES + '_](?: [' + LETTRES + '_])*) · ❌ (\\d+)/(\\d+)(?: · ([A-Z](?: [A-Z])*))?(?: — (.*))?$');
  var RE_FIN = new RegExp('^(🏆|💀|⏹) PENDU · ([' + LETTRES + ']+) · (?:trouvé par (\\S+?)(?: \\(\\+(\\d+)\\))?|perdu|arrêté)(?: — (.*))?$');
  /* un message du bot → l'état à dessiner, ou null s'il ne parle pas du pendu */
  function lire(texte) {
    texte = String(texte || '').trim();
    var m = RE_ETAT.exec(texte);
    if (m) return { type: 'etat', lettres: m[1].split(' '), erreurs: +m[2], max: +m[3], ratees: m[4] ? m[4].split(' ') : [], suite: m[5] || '' };
    m = RE_FIN.exec(texte);
    if (m) return { type: 'fin', quoi: m[1] === '🏆' ? 'gagnee' : m[1] === '💀' ? 'perdue' : 'arretee', mot: m[2], qui: m[3] || '',
      points: m[4] ? +m[4] : 0, suite: m[5] || '' };
    return null;
  }

  return { nu: nu, nouvelle: nouvelle, masque: masque, proposer: proposer, deviner: deviner, pointsLettre: pointsLettre, cachees: cachees, indice: indice,
    gagnee: gagnee, ligneEtat: ligneEtat, ligneFin: ligneFin, lire: lire };
})();
if (typeof module !== 'undefined') module.exports = PENDU;
