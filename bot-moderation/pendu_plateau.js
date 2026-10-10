/* Le plateau du pendu (sorti de pendu.html le 10/10/2026, même raison que pendu_plateau.css). */
'use strict';
(function () {
  var q = new URLSearchParams(location.search);
  var CHAINE = (q.get('chaine') || '').toLowerCase().replace(/^#/, ''), BOT = (q.get('bot') || '').toLowerCase();
  var IRC = q.get('irc') || 'wss://irc-ws.chat.twitch.tv:443', MONTRER_FIN_MS = 20000;
  var $ = function (id) { return document.getElementById(id); };
  var avant = [], cacher = null;

  // le dessin du pendu du jeu du site (pendable.html, drawHangman), tel quel
  function drawHangman(svg, wrong, lives) {
    var frac = Math.min(1, wrong / Math.max(1, lives)), parts = Math.round(frac * 6), dead = wrong >= 99;
    var S = 'stroke="#e9d4a8" stroke-width="3" fill="none" stroke-linecap="round"', s = '';
    s += '<line x1="6" y1="100" x2="50" y2="100" ' + S + '/>';
    s += '<line x1="20" y1="100" x2="20" y2="8" ' + S + '/>';
    s += '<line x1="20" y1="8" x2="62" y2="8" ' + S + '/>';
    s += '<line x1="62" y1="8" x2="62" y2="20" ' + S + '/>';
    var n = dead ? 6 : parts;
    if (n >= 1) s += '<circle cx="62" cy="30" r="9" ' + S + '/>';
    if (n >= 2) s += '<line x1="62" y1="39" x2="62" y2="66" ' + S + '/>';
    if (n >= 3) s += '<line x1="62" y1="46" x2="50" y2="58" ' + S + '/>';
    if (n >= 4) s += '<line x1="62" y1="46" x2="74" y2="58" ' + S + '/>';
    if (n >= 5) s += '<line x1="62" y1="66" x2="52" y2="84" ' + S + '/>';
    if (n >= 6) s += '<line x1="62" y1="66" x2="72" y2="84" ' + S + '/>';
    if (dead) {
      s += '<line x1="58" y1="27" x2="62" y2="31" stroke="#c0492f" stroke-width="2"/><line x1="62" y1="27" x2="58" y2="31" stroke="#c0492f" stroke-width="2"/>';
      s += '<line x1="62" y1="27" x2="66" y2="31" stroke="#c0492f" stroke-width="2"/><line x1="66" y1="27" x2="62" y2="31" stroke="#c0492f" stroke-width="2"/>';
    }
    svg.innerHTML = s;
  }
  function cases(lettres) {
    var z = $('mot');
    z.textContent = '';
    lettres.forEach(function (l, i) {
      var c = document.createElement('div');
      c.className = 'case' + (l !== '_' && avant[i] === '_' ? ' neuve' : '');
      c.textContent = l === '_' ? '' : l;
      z.appendChild(c);
    });
    avant = lettres.slice();
  }
  function montrer() { clearTimeout(cacher); $('plateau').classList.remove('cache'); }
  // un message du bot → le plateau (rend true s'il a été compris : la sonde s'en sert)
  function dessiner(texte) {
    var e = PENDU.lire(texte);
    if (!e) return false;
    montrer();
    if (e.type === 'etat') {
      if (e.erreurs === 0 && e.lettres.every(function (l) { return l === '_'; })) avant = [];
      cases(e.lettres);
      drawHangman($('potence'), e.erreurs, e.max);
      $('erreurs').innerHTML = '❌ <b>' + e.erreurs + '</b> / ' + e.max;
      $('ratees').textContent = e.ratees.join(' ');
      $('dernier').textContent = e.suite;
      $('fin').textContent = ''; $('fin').className = '';
    } else {
      cases(e.mot.split(''));
      if (e.quoi === 'perdue') drawHangman($('potence'), 99, 1);
      $('fin').className = e.quoi;
      $('fin').textContent = e.quoi === 'gagnee' ? '🏆 ' + e.qui + (e.points ? ' +' + e.points : '') : e.quoi === 'perdue' ? '💀 Perdu !' : '⏹ Partie arrêtée';
      $('dernier').textContent = e.suite;
      cacher = setTimeout(function () { $('plateau').classList.add('cache'); }, MONTRER_FIN_MS);
    }
    return true;
  }
  window.__plateau = { dessiner: dessiner };

  // le chat, en spectateur anonyme (« justinfan ») : aucune donnée de connexion
  function ecouter() {
    var ws;
    try { ws = new WebSocket(IRC); } catch (e) { return setTimeout(ecouter, 5000); }
    ws.onopen = function () {
      ws.send('CAP REQ :twitch.tv/tags');
      ws.send('PASS SCHMOOPIIE');
      ws.send('NICK justinfan' + (10000 + Math.floor(Math.random() * 80000)));
      ws.send('JOIN #' + CHAINE);
    };
    ws.onmessage = function (ev) {
      String(ev.data).split('\r\n').forEach(function (ligne) {
        if (!ligne) return;
        if (ligne.indexOf('PING') === 0) { ws.send('PONG' + ligne.slice(4)); return; }
        var m = /^(?:@\S+ )?:([^!\s]+)!\S+ PRIVMSG #\S+ :(.*)$/.exec(ligne);
        if (m && (!BOT || m[1].toLowerCase() === BOT)) dessiner(m[2]);
      });
    };
    ws.onclose = function () { setTimeout(ecouter, 3000); };
  }

  if (q.get('demo')) {                                         // une partie d'exemple, pour placer la source dans OBS
    var M = PENDU.nouvelle('chocolat', 8), pas = ['o', 'z', 'c', 'e', 'a', 'l'], i = 0;
    dessiner(PENDU.ligneEtat(M, 'Nouvelle partie ! 8 lettres.'));
    var t = setInterval(function () {
      if (i >= pas.length) { clearInterval(t); PENDU.proposer(M, 't'); dessiner(PENDU.ligneFin(M, 'gagnee', 'Lili', 12, 'Bravo !')); return; }
      var r = PENDU.proposer(M, pas[i]);
      dessiner(PENDU.ligneEtat(M, (r.quoi === 'bonne' ? '✅ ' : '❌ ') + ['Lili', 'Max', 'Zoé'][i % 3] + ' : ' + pas[i].toUpperCase()));
      i++;
    }, 1500);
  } else if (!CHAINE) {
    $('aide').style.display = 'flex';
  } else {
    drawHangman($('potence'), 0, 8);
    ecouter();
  }
})();
