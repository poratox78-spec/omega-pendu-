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
    var s = String(n).replace(',', '.'), neg = s.charAt(0) === '-';
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
                  'milliards', 'dizaines de milliards', 'centaines de milliards', 'billions',
                  'dizaines de billions', 'centaines de billions', 'billiards'];
  var NOMS_DEC = ['dixièmes', 'centièmes', 'millièmes', 'dix-millièmes', 'cent-millièmes', 'millionièmes'];
  /* « 1 dizaine », « 0 unité » : au-dessous de 2, le premier mot du rang reste au singulier. */
  function _nomRang(nom, chiffre) { return chiffre >= 2 ? nom : nom.replace(/^([^ ]+)s\b/, '$1'); }

  /* VALEUR DE POSITION, chiffre par chiffre — « le 3 de 305 vaut 300 ». C'est le point que ni la
     police de son ni une calculette ne touchent, et c'est le cœur de la difficulté. */
  function positions(n) {
    var s = String(Math.floor(Math.abs(Number(n))));
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var rang = s.length - 1 - i, d = +s.charAt(i);
      out.push({ chiffre: s.charAt(i), rang: rang, nom: _nomRang(NOMS_POS[rang] || ('10^' + rang), d),
                 vaut: d * Math.pow(10, rang) });
    }
    return out;
  }

  /* Les chiffres APRÈS la virgule : « le 5 de 0,5 vaut cinq dixièmes ». `brut` est une chaîne (« 12.50 »)
     pour garder le zéro écrit, qu'un nombre perdrait. `vaut` est une chaîne, sans bruit binaire. */
  function positionsDecimales(brut) {
    var p = (String(brut).replace(',', '.').split('.')[1] || '').slice(0, 6), out = [];   // au-delà des millionièmes, rien de lisible
    for (var i = 0; i < p.length; i++) {
      var d = +p.charAt(i), z = '';
      for (var k = 0; k < i; k++) z += '0';
      out.push({ chiffre: p.charAt(i), rang: -(i + 1), nom: _nomRang(NOMS_DEC[i] || ('10^-' + (i + 1)), d), vaut: '0,' + z + d });
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
      .replace(/[×xX]/g, '*').replace(/[÷:]/g, '/').replace(/−/g, '-').replace(/=$/, '');
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


  /* CE QUE L'ONGLET FAIT DE LA SAISIE. Rend { etat } : 'vide', 'attente' (un calcul en train de
     s'écrire : « 12+ » n'est pas une erreur), 'erreur' (avec son texte) ou 'ok' (n, brut, calcul, mots).
     x et : valent × et ÷, « = » final s'ignore, et les mots vont vers les chiffres (`versNombre`) :
     écrire « trois cent cinq » pour voir 305 est l'erreur canonique que ce fichier existe pour aider. */
  function lireSaisie(src) {
    var saisie = String(src === null || src === undefined ? '' : src).trim();
    if (!saisie) return { etat: 'vide' };
    if (/^[a-zà-ÿœ\s\u00a0'’-]+$/i.test(saisie)) {
      var vn = versNombre(saisie.replace(/['’]/g, ' '));
      if (vn === null) return { etat: 'erreur', texte: "Je ne reconnais pas ce nombre en lettres." };
      return { etat: 'ok', n: vn, brut: String(vn), mots: true };
    }
    var exp = saisie.replace(/[xX]/g, '*').replace(/:/g, '/').replace(/=\s*$/, ''),
        brut = exp.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
    if (/\.$/.test(brut)) brut = brut.slice(0, -1);
    if (/[+\-*\/×÷−]/.test(brut.slice(1))) {
      var ouv = (brut.match(/\(/g) || []).length, fer = (brut.match(/\)/g) || []).length;
      if (/[+\-*\/×÷−(]$/.test(brut) || ouv > fer) return { etat: 'attente', texte: 'Continue ton calcul…' };
      var op = calcule(exp);
      if (op === null) return { etat: 'erreur', texte: "Calcul impossible (vérifie l'opération)." };
      if (Math.abs(op) > 1e15) return { etat: 'erreur', texte: 'Nombre trop grand.' };
      return { etat: 'ok', n: op, brut: String(op), calcul: saisie.replace(/=\s*$/, '').trim() };
    }
    if (!/^-?\d+(\.\d+)?$/.test(brut)) return { etat: 'erreur', texte: 'Écris un nombre ou un calcul (12+5).' };
    if (Math.abs(Number(brut)) > 1e15) return { etat: 'erreur', texte: 'Nombre trop grand.' };
    return { etat: 'ok', n: Number(brut), brut: brut };
  }


  /* ── L'ONGLET NOMBRES, VERSION A (Rem, 31/10/2026) : sous la saisie, le résultat, puis COMMENT on l'obtient.
     `detailSaisie` part de `lireSaisie` et ajoute ce qu'il faut pour montrer le chemin : l'opération posée (grille + étapes),
     le pourcentage, les euros, les durées. Tout passe par le moteur, testable sans le panneau (calc_dys_probe). */
  function _eur(n) { var r = Math.round(n * 100) / 100; return groupe(r === Math.floor(r) ? String(r) : r.toFixed(2)) + ' €'; }
  function _nb(n, euro) { return euro ? _eur(n) : groupe(String(Math.round(n * 1e10) / 1e10)); }
  function _enEuros(n) {
    var c = Math.round(Math.abs(n) * 100), e = Math.floor(c / 100); c = c % 100;
    if (!e) return c ? enLettres(c) + ' centime' + (c > 1 ? 's' : '') : 'zéro euro';
    return enLettres(e) + ' euro' + (e > 1 ? 's' : '') + (c ? ' ' + enLettres(c) : '');
  }
  function _feminin(n) { return enLettres(n).replace(/un$/, 'une'); }
  function _dureeTxt(m) { var h = Math.floor(m / 60), r = m % 60; return h ? h + ' h' + (r ? ' ' + (r < 10 ? '0' : '') + r : '') : r + ' min'; }
  function _dureeLettres(m) {
    var h = Math.floor(m / 60), r = m % 60, p = [];
    if (h) p.push(_feminin(h) + ' heure' + (h > 1 ? 's' : ''));
    if (r || !h) p.push(_feminin(r) + ' minute' + (r > 1 ? 's' : ''));
    return p.join(' et ');
  }
  /* « 1 h 45 », « 30 min », « 2 h » → minutes ; null si ce n'est pas une durée. */
  function _dureeMin(t) {
    var m = /^(?:(\d+)\s*h(?:\s*(\d{1,2}))?(?:\s*min)?|(\d+)\s*min)$/i.exec(t.trim());
    return m ? (m[3] !== undefined ? +m[3] : (+m[1]) * 60 + (+(m[2] || 0))) : null;
  }
  function _lireDuree(s) {
    var morceaux = s.split(/([+\-−])/), vals = [], ops = [], i;
    for (i = 0; i < morceaux.length; i++) {
      if (i % 2) { ops.push(morceaux[i]); continue; }
      var v = _dureeMin(morceaux[i]);
      if (v === null) return null;
      vals.push(v);
    }
    return vals.length ? { vals: vals, ops: ops } : null;
  }
  function _detailDuree(d) {
    var tot = d.vals[0], i, etapes = [];
    for (i = 0; i < d.ops.length; i++) tot += d.ops[i] === '+' ? d.vals[i + 1] : -d.vals[i + 1];
    if (tot < 0) return { etat: 'erreur', texte: 'Le résultat serait négatif : vérifie les durées.' };
    if (d.vals.length === 2 && d.ops[0] === '+') {
      var a = d.vals[0], b = d.vals[1], ma = a % 60, mb = b % 60, s = ma + mb, ha = Math.floor(a / 60), hb = Math.floor(b / 60);
      etapes.push('Les minutes : ' + ma + ' + ' + mb + ' = ' + s + ' min.');
      if (s >= 60) etapes.push('60 min font 1 h : ' + s + ' min = ' + _dureeTxt(s) + '.');
      if (ha || hb || s >= 60) etapes.push('Les heures : ' + [ha ? ha + ' h' : null, hb ? hb + ' h' : null, s >= 60 ? _dureeTxt(s) : null].filter(Boolean).join(' + ') + ' = ' + _dureeTxt(tot) + '.');
    } else if (d.vals.length === 2) {
      etapes.push('En minutes : ' + d.vals[0] + ' − ' + d.vals[1] + ' = ' + tot + ' min.');
      if (tot >= 60) etapes.push('60 min font 1 h : ' + tot + ' min = ' + _dureeTxt(tot) + '.');
    }
    return { etat: 'ok', type: 'duree', n: tot, brut: String(tot), affichage: _dureeTxt(tot), lettres: _dureeLettres(tot), titre: 'Comment on le trouve', etapes: etapes };
  }
  function _detailPourcent(p, b, euro) {
    var un = Math.round(b) === b ? b / 100 : Math.round(b * 100) / 10000, res = Math.round(un * p * 1e8) / 1e8, etapes = [];
    etapes.push('1 % de ' + _nb(b, euro) + ' : ' + _nb(b, false) + ' ÷ 100 = ' + _nb(un, euro) + '.');
    if (p !== 1) etapes.push(_nb(p, false) + ' %, c\'est ' + _nb(p, false) + ' fois plus : ' + (euro ? _eur(un).replace(' €', '') : _nb(un, false)) + ' × ' + _nb(p, false) + ' = ' + _nb(res, euro) + '.');
    return { etat: 'ok', type: 'pourcent', n: res, brut: String(res), affichage: _nb(res, euro), lettres: euro ? _enEuros(res) : enLettres(res), titre: 'Comment on le trouve', etapes: etapes,
             duo: [{ valeur: _nb(b - res, euro), texte: euro ? 'prix après la remise' : 'si on retire ' + _nb(p, false) + ' %' },
                   { valeur: _nb(b + res, euro), texte: euro ? 'prix après la hausse' : 'si on ajoute ' + _nb(p, false) + ' %' }] };
  }
  function _detailEuros(exp) {
    var m = /^(\d+(?:[.,]\d+)?)\s*([+\-−])\s*(\d+(?:[.,]\d+)?)$/.exec(exp), v, etapes = [];
    var propre = exp.replace(/[\s  ]/g, '');
    if (/[+\-*\/×÷−]/.test(propre.slice(1))) { v = calcule(exp); if (v === null) return { etat: 'erreur', texte: "Calcul impossible (vérifie l'opération)." }; }
    else { v = Number(propre.replace(',', '.')); if (!isFinite(v)) return { etat: 'erreur', texte: 'Écris un nombre ou un calcul (12+5).' }; }
    if (m && m[2] === '+') {
      var ca = Math.round(Number(m[1].replace(',', '.')) * 100), cb = Math.round(Number(m[3].replace(',', '.')) * 100), s = ca % 100 + cb % 100;
      etapes.push('Les centimes : ' + (ca % 100) + ' + ' + (cb % 100) + ' = ' + s + '.');
      if (s >= 100) etapes.push('100 centimes font 1 € : je pose ' + (s - 100) + ' centimes, je retiens 1 €.');
      etapes.push('Les euros : ' + Math.floor(ca / 100) + ' + ' + Math.floor(cb / 100) + (s >= 100 ? ' + 1' : '') + ' = ' + (Math.floor(ca / 100) + Math.floor(cb / 100) + (s >= 100 ? 1 : 0)) + '.');
    }
    return { etat: 'ok', type: 'euros', n: v, brut: String(v), affichage: _eur(v), lettres: (v < 0 ? 'moins ' : '') + _enEuros(v), titre: etapes.length ? 'Comment on le trouve' : null, etapes: etapes };
  }
  /* La grille posée : des lignes de cases, à droite les unités ; `r` = le rang (la couleur), null = case vide. */
  function _ligne(s, larg, signe) { var c = [], t = String(s), i; for (i = 0; i < larg; i++) { var k = t.length - larg + i; c.push(k >= 0 ? { t: t.charAt(k), r: larg - 1 - i } : null); } return { type: 'chiffres', signe: signe || '', cases: c }; }
  function _detailPose(a, op, b) {
    var res, etapes = [], i, larg, L = [], col;
    if (op === '+') {
      var A = poseAddition(a, b); res = A.resultat; larg = String(res).length;
      col = A.colonnes.slice(-larg);
      var ret = col.map(function (x) { return x.retenueEntrante ? { t: '1', r: x.rang } : null; });
      if (ret.some(Boolean)) L.push({ type: 'retenue', signe: '', cases: ret });
      L.push(_ligne(a, larg)); L.push(_ligne(b, larg, '+')); L.push({ type: 'trait' }); L.push(_ligne(res, larg));
      for (i = col.length - 1; i >= 0; i--) {
        var x = col[i], av = x.a === null ? null : x.a, bv = x.b === null ? null : x.b, e = x.retenueEntrante;
        if (av === null && bv === null) { etapes.push('Je descends la retenue : ' + x.pose + '.'); continue; }
        if (!e && (av === null || bv === null)) { etapes.push('Il reste ' + (av === null ? bv : av) + ' : je le descends.'); continue; }
        var parts = [av, bv].filter(function (v) { return v !== null; }); if (e) parts.push(1);
        etapes.push(parts.join(' + ') + ' = ' + x.total + ' : je pose ' + x.pose + (x.retenue ? ', je retiens 1.' : '.'));
      }
    } else if (op === '-') {
      var S = poseSoustraction(a, b); if (!S) return null; res = S.resultat; larg = S.largeur; col = S.colonnes;
      L.push(_ligne(a, larg)); L.push(_ligne(b, larg, '−'));
      var em = col.map(function (x) { return x.empruntEntrant ? { t: '+1', r: x.rang } : null; });
      if (em.some(Boolean)) L.push({ type: 'retenue', signe: '', cases: em });
      L.push({ type: 'trait' }); L.push(_ligne(res, larg));
      for (i = col.length - 1; i >= 0; i--) {
        var y = col[i], tete = y.empruntEntrant ? (y.b || 0) + ' + 1 = ' + y.bAvecEmprunt + '. ' : '';
        if (y.a === null) continue;
        if (y.emprunt) etapes.push(tete + y.a + ' − ' + y.bAvecEmprunt + ', je ne peux pas : ' + y.aEffectif + ' − ' + y.bAvecEmprunt + ' = ' + y.pose + '. Je retiens 1.');
        else etapes.push(tete + y.a + ' − ' + y.bAvecEmprunt + ' = ' + y.pose + '.');
      }
    } else if (op === '*') {
      var M = poseMultiplication(a, b); res = M.resultat; larg = Math.max(String(res).length, String(a).length, String(b).length);
      L.push(_ligne(a, larg)); L.push(_ligne(b, larg, '×')); L.push({ type: 'trait' });
      M.lignes.forEach(function (l) {
        if (M.lignes.length > 1) L.push(_ligne(l.decale, larg));
        etapes.push(a + ' × ' + l.chiffre + ' = ' + l.produit + (l.rang ? ' ; décalé de ' + l.rang + ' rang' + (l.rang > 1 ? 's' : '') + ' : ' + l.decale : '') + '.');
      });
      if (M.lignes.length > 1) { L.push({ type: 'trait' }); L.push(_ligne(res, larg)); etapes.push("J'additionne : " + M.lignes.map(function (l) { return l.decale; }).join(' + ') + ' = ' + res + '.'); }
      else L.push(_ligne(res, larg));
    } else {
      var D = poseDivision(a, b); if (!D) return null; res = D.quotient;
      D.etapes.forEach(function (x) { if (x.ecrit) etapes.push('Dans ' + x.courant + ', ' + b + ' va ' + x.chiffre + ' fois : ' + x.chiffre + ' × ' + b + ' = ' + x.produit + ', il reste ' + x.reste + '.'); });
      etapes.push('Vérification : ' + D.quotient + ' × ' + b + (D.reste ? ' + ' + D.reste : '') + ' = ' + a + '.');
      return { titre: "Je pose l'opération", etapes: etapes, grille: null, reste: D.reste, quotient: D.quotient };
    }
    return { titre: "Je pose l'opération", etapes: etapes, grille: { colonnes: larg, lignes: L } };
  }
  function detailSaisie(src) {
    var saisie = String(src === null || src === undefined ? '' : src).trim();
    var net = saisie.replace(/=\s*$/, '').trim(), euro = /€|\beuros?\b/i.test(net), sans = net.replace(/€|\beuros?\b/gi, ' ').replace(/\s+/g, ' ').trim();
    var mp = /^(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s+|d['’]\s*)(\d[\d\s  ]*(?:[.,]\d+)?)$/i.exec(sans);
    if (mp) {
      var p = Number(mp[1].replace(',', '.')), b = Number(mp[2].replace(/[\s  ]/g, '').replace(',', '.'));
      if (Math.abs(b) > 1e12 || p > 1e6) return { etat: 'erreur', texte: 'Nombre trop grand.' };
      return _detailPourcent(p, b, euro);
    }
    if (euro && /\d/.test(sans)) return _detailEuros(sans);
    if (/\d\s*(h|min)/i.test(net)) { var d = _lireDuree(net); if (d) return _detailDuree(d); }
    var r = lireSaisie(saisie);
    if (r.etat !== 'ok') return r;
    r.type = r.calcul ? 'calcul' : 'nombre';
    r.affichage = groupe(r.brut);
    r.lettres = enLettres(r.n);
    if (r.calcul) {
      var mo = /^(\d+)([+\-*\/])(\d+)$/.exec(r.calcul.replace(/[\s  ]/g, '').replace(/[×xX]/g, '*').replace(/[÷:]/g, '/').replace(/−/g, '-'));
      if (mo && mo[1].length <= 12 && mo[3].length <= 12) {
        var P = _detailPose(+mo[1], mo[2], +mo[3]);
        if (P) { r.titre = P.titre; r.etapes = P.etapes; r.grille = P.grille; if (mo[2] === '/' && P.reste) { r.affichage = groupe(String(P.quotient)) + ', reste ' + P.reste; r.lettres = enLettres(P.quotient) + ', reste ' + enLettres(P.reste); r.sansRangs = true; } }
      }
    }
    return r;
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
                    calcule: calcule, versNombre: versNombre, lireSaisie: lireSaisie, positionsDecimales: positionsDecimales, detailSaisie: detailSaisie,
                    poseAddition: poseAddition, poseSoustraction: poseSoustraction,
                    poseMultiplication: poseMultiplication, poseDivision: poseDivision };
})(typeof globalThis !== 'undefined' ? globalThis : this);
