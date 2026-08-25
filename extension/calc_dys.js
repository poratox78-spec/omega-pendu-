/* calc_dys.js — AIDE AU NOMBRE pour la DYSCALCULIE (panneau de l'extension).
 *
 * POURQUOI CE FICHIER, ET POURQUOI IL COMMENCE PAR LE TRANSCODAGE
 * --------------------------------------------------------------
 * La dyscalculie n'est pas d'abord un problème de CALCUL, c'est un problème de NOMBRE :
 *   · transcodage — écrire « 30005 » pour « trois cent cinq » ;
 *   · valeur de position — savoir que le 3 de 305 vaut trois CENTS ;
 *   · inversion de chiffres — 69 lu 96 ;
 *   · quantité — ne pas « voir » que 1000000 est mille fois 1000.
 * Une calculette qui calcule à la place ne touche AUCUN de ces quatre points. La page du correcteur
 * dit « comprendre sa faute vaut mieux que la déléguer » : on outille donc la LECTURE et l'ÉCRITURE
 * du nombre d'abord, l'opération ensuite.
 *
 * ⚠️ LA POLICE DE SON NE SUFFIT PAS — MESURÉ le 2026-08-25 : `decompose('42')` rend
 * `graphemes: []`, `phono: ''`, 0 lettre. Elle habille des PHONÈMES, or un chiffre n'en a pas.
 * Elle décompose en revanche parfaitement les MOTS-nombres (« quatre-vingt-dix », « soixante-quinze »)
 * — d'où l'intérêt d'afficher la forme EN LETTRES à côté du chiffre : c'est là qu'elle sert, et les
 * nombres français sont une vraie difficulté de lecture.
 *
 * Zéro dépendance, aucun réseau. Exporte `CALCDYS` : { enLettres, groupe, positions, lire }.
 */
(function (root) {
  'use strict';

  var UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
               'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
  var DIZ = { 20: 'vingt', 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante' };

  /* 0-99 — le cœur des pièges du français : 70/80/90 n'ont pas de nom propre, « et » n'apparaît
     qu'à 21/31/41/51/61/71, et « quatre-vingts » ne prend son s QUE s'il finit le nombre. */
  function sousCent(n, finalAbsolu) {
    if (n <= 16) return UNITS[n];
    if (n < 20) return 'dix-' + UNITS[n - 10];
    if (n < 70) {
      var d = Math.floor(n / 10) * 10, u = n % 10;
      if (u === 0) return DIZ[d];
      if (u === 1) return DIZ[d] + ' et un';
      return DIZ[d] + '-' + UNITS[u];
    }
    if (n < 80) {                                   // 70-79 : soixante + 10..19
      if (n === 71) return 'soixante et onze';
      return 'soixante-' + sousCent(n - 60, false);
    }
    if (n === 80) return finalAbsolu ? 'quatre-vingts' : 'quatre-vingt';
    if (n < 100) return 'quatre-vingt-' + sousCent(n - 80, false);   // 81-99, jamais de « et »
    return '';
  }

  /* 0-999 — « cent » prend un s au pluriel ET seulement s'il termine le nombre (« deux cents »,
     mais « deux cent un »). */
  function sousMille(n, finalAbsolu) {
    if (n < 100) return sousCent(n, finalAbsolu);
    var c = Math.floor(n / 100), r = n % 100;
    var tete = (c === 1) ? 'cent' : (UNITS[c] + ' cent');
    if (r === 0) return (c === 1) ? 'cent' : (tete + (finalAbsolu ? 's' : ''));
    return tete + ' ' + sousCent(r, finalAbsolu);
  }

  var ECHELLE = [
    { v: 1e15, s: ['billiard', 'billiards'] }, { v: 1e12, s: ['billion', 'billions'] },
    { v: 1e9, s: ['milliard', 'milliards'] }, { v: 1e6, s: ['million', 'millions'] },
    { v: 1e3, s: ['mille', 'mille'] }          // ⚠️ « mille » est INVARIABLE — jamais de s
  ];

  function enLettres(n) {
    n = Number(n);
    if (!isFinite(n)) return '';
    if (n < 0) return 'moins ' + enLettres(-n);
    if (n !== Math.floor(n)) {                       // décimal : la virgule se DIT, elle ne se calcule pas
      var s = String(n).split('.');
      return enLettres(Number(s[0])) + ' virgule ' + s[1].split('').map(function (d) { return UNITS[+d]; }).join(' ');
    }
    if (n < 1000) return sousMille(n, true);
    for (var i = 0; i < ECHELLE.length; i++) {
      var e = ECHELLE[i];
      if (n >= e.v) {
        var q = Math.floor(n / e.v), r = n % e.v;
        var tete;
        if (e.v === 1e3) tete = (q === 1) ? 'mille' : (sousMille(q, false) + ' mille');
        else tete = sousMille(q, false) + ' ' + (q > 1 ? e.s[1] : e.s[0]);
        return r === 0 ? tete : tete + ' ' + enLettres(r);
      }
    }
    return sousMille(n, true);
  }

  /* GROUPAGE par tranches de 3, avec une ESPACE INSÉCABLE fine — la norme française, et surtout
     ce qui rend 1000000 lisible d'un coup d'œil : 1 000 000. */
  function groupe(n) {
    var s = String(n), neg = s.charAt(0) === '-';
    if (neg) s = s.slice(1);
    var p = s.split('.'), ent = p[0], out = '', c = 0, i;
    for (i = ent.length - 1; i >= 0; i--) {
      out = ent.charAt(i) + out;
      if (++c % 3 === 0 && i > 0) out = ' ' + out;
    }
    return (neg ? '-' : '') + out + (p[1] ? ',' + p[1] : '');
  }

  var NOMS_POS = ['unités', 'dizaines', 'centaines', 'milliers', 'dizaines de mille',
                  'centaines de mille', 'millions', 'dizaines de millions', 'centaines de millions',
                  'milliards'];

  /* VALEUR DE POSITION, chiffre par chiffre — « le 3 de 305 vaut 300 ». C'est le point que ni la
     police de son ni une calculette ne touchent, et c'est le cœur de la difficulté. */
  function positions(n) {
    var s = String(Math.abs(Math.floor(Number(n))));
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var rang = s.length - 1 - i, d = +s.charAt(i);
      out.push({ chiffre: s.charAt(i), rang: rang, nom: NOMS_POS[rang] || ('10^' + rang),
                 vaut: d * Math.pow(10, rang) });
    }
    return out;
  }

  /* Ce qu'on DIT à voix haute : le nombre groupé puis sa forme en lettres. */
  function lire(n) { return groupe(n) + ' — ' + enLettres(n); }


  /* ── CALCUL — l'extension est l'outil RAPIDE (Rem, 2026-08-25 : « le but rapide pour le calcul
     aussi donc on calcule à la place sur le site éventuellement on pourrait faire une partie plus
     développée »). Ici on donne la RÉPONSE ; la version qui apprend à POSER l'opération ira sur le
     site, où l'utilisateur vient pour travailler, pas pour écrire vite.
     Le résultat est rendu sous les MÊMES trois formes que la saisie (groupé, en lettres, valeur de
     position) : la réponse reste LISIBLE, ce qui est tout l'intérêt pour un dyscalculique.

     ⛔ AUCUN `eval`, JAMAIS. On analyse nous-mêmes : un `eval` sur une saisie utilisateur dans une
     extension à `<all_urls>` serait une porte ouverte, et Google le refuserait au Store — à juste
     titre. Analyseur descendant, 4 opérations, parenthèses, décimales à la virgule française. */
  function _tokens(src) {
    var t = [], i = 0, s = String(src).replace(/[\s\u00a0]/g, '').replace(/,/g, '.')
      .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    while (i < s.length) {
      var c = s.charAt(i);
      if (c >= '0' && c <= '9' || c === '.') {
        var j = i; while (j < s.length && (s.charAt(j) >= '0' && s.charAt(j) <= '9' || s.charAt(j) === '.')) j++;
        var num = s.slice(i, j);
        if ((num.match(/\./g) || []).length > 1) return null;      // « 1.2.3 » n'est pas un nombre
        t.push({ n: parseFloat(num) }); i = j; continue;
      }
      if ('+-*/()'.indexOf(c) >= 0) { t.push({ o: c }); i++; continue; }
      return null;                                                  // caractère inconnu → on refuse
    }
    return t;
  }
  function _parse(t) {
    var p = 0;
    function expr() {
      var v = terme();
      if (v === null) return null;
      while (p < t.length && t[p].o && (t[p].o === '+' || t[p].o === '-')) {
        var op = t[p++].o, r = terme();
        if (r === null) return null;
        v = (op === '+') ? v + r : v - r;
      }
      return v;
    }
    function terme() {
      var v = facteur();
      if (v === null) return null;
      while (p < t.length && t[p].o && (t[p].o === '*' || t[p].o === '/')) {
        var op = t[p++].o, r = facteur();
        if (r === null) return null;
        if (op === '/' && r === 0) return null;                     // division par zéro : on REFUSE, on n'invente pas
        v = (op === '*') ? v * r : v / r;
      }
      return v;
    }
    function facteur() {
      if (p >= t.length) return null;
      var x = t[p];
      if (x.o === '-') { p++; var v = facteur(); return v === null ? null : -v; }
      if (x.o === '+') { p++; return facteur(); }
      if (x.o === '(') {
        p++; var e = expr();
        if (e === null || p >= t.length || t[p].o !== ')') return null;
        p++; return e;
      }
      if (typeof x.n === 'number') { p++; return x.n; }
      return null;
    }
    var v = expr();
    return (v === null || p !== t.length) ? null : v;
  }

  /* Rend `null` si ce n'est pas un calcul valide — l'appelant AFFICHE alors une raison,
     il n'invente pas un résultat. */
  function calcule(src) {
    var t = _tokens(src);
    if (!t || !t.length) return null;
    if (!t.some(function (x) { return x.o && '+-*/'.indexOf(x.o) >= 0; })) return null;   // pas d'opération = simple nombre
    var v = _parse(t);
    if (v === null || !isFinite(v)) return null;
    return Math.round(v * 1e10) / 1e10;                             // rabote le bruit binaire (0,1+0,2)
  }

  root.CALCDYS = { enLettres: enLettres, groupe: groupe, positions: positions, lire: lire, calcule: calcule };
})(typeof globalThis !== 'undefined' ? globalThis : this);
