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


  /* ── LE SENS INVERSE : des MOTS vers les CHIFFRES. C'est l'erreur canonique de la dyscalculie —
     écrire « 30005 » pour *trois cent cinq*, parce qu'on transcrit ce qu'on entend morceau par
     morceau au lieu de composer. `enLettres` ne sert à rien contre ça : il part des chiffres, donc
     il suppose le problème déjà résolu. Il fallait l'autre direction.
     ⛔ Un mot inconnu fait REFUSER (null). On n'invente pas un nombre à partir d'une phrase. */
  var _MOTS = { zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7,
                huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14,
                quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50,
                soixante: 60, septante: 70, huitante: 80, octante: 80, nonante: 90 };
  var _MULT = { cent: 100, mille: 1000, million: 1e6, milliard: 1e9 };

  function _motNum(w) {
    if (_MOTS[w] !== undefined) return { v: _MOTS[w], mult: false };
    if (_MULT[w] !== undefined) return { v: _MULT[w], mult: true };
    /* pluriels : « quatre-vingtS », « deux centS », « trois millionS ». On ne rabote le -s
       qu'APRÈS avoir cherché le mot entier, sinon « trois » deviendrait « troi ». */
    if (w.length > 1 && w.charAt(w.length - 1) === 's') return _motNum(w.slice(0, -1));
    return null;
  }

  function versNombre(texte) {
    var s = String(texte === null || texte === undefined ? '' : texte).toLowerCase();
    s = s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
    s = s.replace(/[-\u2010\u2011\u2013]/g, ' ');
    var brut = s.split(/[\s\u00a0]+/).filter(function (w) { return w && w !== 'et'; });
    if (!brut.length) return null;

    /* « quatre-vingt » est le SEUL composé MULTIPLICATIF du français : 4 × 20. Sans ce recollage,
       « quatre-vingt-dix-sept » s'additionnerait en 4+20+10+7 = 41 au lieu de 97. */
    var mots = [], i;
    for (i = 0; i < brut.length; i++) {
      if (brut[i] === 'quatre' && i + 1 < brut.length && /^vingts?$/.test(brut[i + 1])) {
        mots.push('__80'); i++;
      } else mots.push(brut[i]);
    }

    var total = 0, pile = 0;
    for (i = 0; i < mots.length; i++) {
      var m = mots[i] === '__80' ? { v: 80, mult: false } : _motNum(mots[i]);
      if (!m) return null;
      if (!m.mult) pile += m.v;
      else if (m.v === 100) pile = (pile === 0 ? 1 : pile) * 100;
      else { total += (pile === 0 ? 1 : pile) * m.v; pile = 0; }
    }
    return total + pile;
  }


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


  /* ── POSER L'OPÉRATION — le cœur pédagogique, pour la page du SITE.
     Ce que l'extension NE fait pas : elle donne la réponse. Ici on montre COMMENT on l'obtient,
     colonne par colonne, parce que c'est exactement là que la dyscalculie bute — aligner les
     unités sous les unités, et savoir ce que « je pose 4 je retiens 1 » veut dire.
     Chaque colonne rend de quoi l'EXPLIQUER en toutes lettres, pas seulement l'afficher. */
  function chiffres(n, largeur) {
    var s = String(Math.abs(Math.trunc(n))), out = [], i;
    for (i = 0; i < largeur; i++) out.unshift(i < s.length ? +s.charAt(s.length - 1 - i) : null);
    return out;   // null = colonne vide (le nombre est plus court), à ne PAS afficher comme un 0
  }

  function poseAddition(a, b) {
    a = Math.trunc(Math.abs(a)); b = Math.trunc(Math.abs(b));
    var larg = Math.max(String(a).length, String(b).length) + 1;
    var ca = chiffres(a, larg), cb = chiffres(b, larg), col = [], ret = 0, i;
    for (i = larg - 1; i >= 0; i--) {
      var x = ca[i] || 0, y = cb[i] || 0, som = x + y + ret;
      col.unshift({ rang: larg - 1 - i, a: ca[i], b: cb[i], retenueEntrante: ret,
                    total: som, pose: som % 10, retenue: som >= 10 ? 1 : 0 });
      ret = som >= 10 ? 1 : 0;
    }
    return { type: 'addition', largeur: larg, colonnes: col, resultat: a + b };
  }

  /* SOUSTRACTION avec EMPRUNT. On garde la méthode « par emprunt » (casser une dizaine), celle
     qu'on enseigne en France, plutôt que la compensation — c'est celle que l'élève voit en classe.
     ⚠️ On REFUSE le résultat négatif au lieu de le bricoler : « on ne peut pas retirer plus grand
     d'un plus petit » est une phrase qui s'explique, pas une erreur à masquer. */
  function poseSoustraction(a, b) {
    a = Math.trunc(Math.abs(a)); b = Math.trunc(Math.abs(b));
    if (b > a) return null;
    var larg = Math.max(String(a).length, String(b).length);
    var ca = chiffres(a, larg), cb = chiffres(b, larg), col = [], emp = 0, i;
    for (i = larg - 1; i >= 0; i--) {
      /* Méthode française de la RETENUE ADDITIVE : la retenue s'ajoute au chiffre du BAS, jamais
         retranchée à celui du haut. Retrancher en haut donne 0-1 = -1 sur « 502 - 347 » — un nombre
         NÉGATIF affiché au milieu d'une soustraction de CE1, c'est exactement la confusion que cette
         page existe pour éviter. Ici aucune étape ne peut produire un négatif. */
      var x = ca[i] || 0, y = (cb[i] || 0) + emp, empSortant = 0;
      if (x < y) { x += 10; empSortant = 1; }
      col.unshift({ rang: larg - 1 - i, a: ca[i], b: cb[i], empruntEntrant: emp,
                    bAvecEmprunt: y, aEffectif: x, pose: x - y, emprunt: empSortant });
      emp = empSortant;
    }
    return { type: 'soustraction', largeur: larg, colonnes: col, resultat: a - b };
  }

  /* MULTIPLICATION posée : une ligne par chiffre du multiplicateur, décalée de son rang. */
  function poseMultiplication(a, b) {
    a = Math.trunc(Math.abs(a)); b = Math.trunc(Math.abs(b));
    var sb = String(b), lignes = [], i;
    for (i = sb.length - 1; i >= 0; i--) {
      var d = +sb.charAt(i), rang = sb.length - 1 - i;
      lignes.push({ chiffre: d, rang: rang, produit: a * d, decale: a * d * Math.pow(10, rang) });
    }
    return { type: 'multiplication', lignes: lignes, resultat: a * b };
  }

  /* ── LA DIVISION POSÉE (la « potence »). La seule des quatre où l'on ne descend pas les colonnes
     de droite à gauche mais de GAUCHE à droite, ce qui la rend contre-intuitive après les trois
     autres — raison de plus pour l'expliquer pas à pas plutôt que de donner le quotient.
     Division ENTIÈRE avec reste : c'est ce qu'on pose à l'école, et le reste rend la vérification
     possible (quotient × diviseur + reste = dividende), qui est le vrai cadeau fait au dyscalculique.
     ⛔ Diviser par zéro rend `null` : pas de réponse inventée. */
  function poseDivision(a, b) {
    a = Math.trunc(Math.abs(a)); b = Math.trunc(Math.abs(b));
    if (b === 0) return null;
    var sa = String(a), etapes = [], reste = 0, i, premier = -1;
    for (i = 0; i < sa.length; i++) {
      var courant = reste * 10 + (+sa.charAt(i));
      var q = Math.floor(courant / b);
      if (q > 0 && premier < 0) premier = i;
      reste = courant - q * b;
      etapes.push({ col: i, abaisse: +sa.charAt(i), courant: courant, chiffre: q,
                    produit: q * b, reste: reste, ecrit: false });
    }
    /* Les zéros de tête du quotient ne s'écrivent PAS (« 042 » n'est pas un quotient) — sauf si le
       quotient vaut zéro tout entier, auquel cas on écrit ce zéro-là, il est signifiant. */
    if (premier < 0) premier = sa.length - 1;
    for (i = premier; i < etapes.length; i++) etapes[i].ecrit = true;
    return { type: 'division', dividende: a, diviseur: b, largeur: sa.length,
             quotient: Math.floor(a / b), reste: reste, etapes: etapes, premier: premier };
  }

  root.CALCDYS = { enLettres: enLettres, groupe: groupe, positions: positions, lire: lire,
                    calcule: calcule, versNombre: versNombre,
                    poseAddition: poseAddition, poseSoustraction: poseSoustraction,
                    poseMultiplication: poseMultiplication, poseDivision: poseDivision };
})(typeof globalThis !== 'undefined' ? globalThis : this);
