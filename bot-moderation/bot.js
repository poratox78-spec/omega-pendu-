/* LE BOT DE MODÉRATION — la page du dock d'OBS (08/10/2026). Décision de Rem : « on part sur la page web en dock OBS ».
 *
 * Connexion : le « device code flow » de Twitch, comme l'outil (twitch_compte.py) — la page affiche un code, on le tape
 * sur twitch.tv/activate. Aucun mot de passe ne passe par ici, aucun secret (application publique). Même application
 * Twitch que l'outil (son Client ID est public). Le jeton reste dans le stockage de CE navigateur (le dock d'OBS) et ne
 * part que vers Twitch.
 * Lecture du chat : EventSub par WebSocket (channel.chat.message). Actions : l'API officielle de Twitch (effacer un message,
 * exclure). Le détecteur (detecteur.js) décide de ce qui est signalé ; le MODE décide de ce qu'on en fait — « Prévenir
 * seulement » par défaut : le bot n'efface rien tant que le streamer ne l'a pas choisi.
 * Toujours ignorés : le streamer et ses modérateurs.
 */
'use strict';
(function () {
  var CLIENT_ID = 'xc1r4prc5wm7jg5fyrd3thtdz4cz5c';          // l'application Twitch du Déformateur (publique, voix.py)
  var ID = 'https://id.twitch.tv/oauth2', HELIX = 'https://api.twitch.tv/helix', WS = 'wss://eventsub.wss.twitch.tv/ws';
  var PORTEES = ['user:read:chat', 'moderator:manage:chat_messages', 'moderator:manage:banned_users'];
  var EXCLUSION_S = 600, MAX_LISTE = 100;
  var $ = function (id) { return document.getElementById(id); };

  // ── les réglages, gardés dans ce navigateur ──────────────────────────────────────────────────────────────
  function lire(cle, defaut) { try { var v = localStorage.getItem('bot.' + cle); return v == null ? defaut : JSON.parse(v); } catch (e) { return defaut; } }
  function ecrire(cle, v) { try { localStorage.setItem('bot.' + cle, JSON.stringify(v)); } catch (e) {} }
  var reglages = lire('reglages', { mode: 'prevenir', familles: ['haine', 'menace', 'insulte'], ignorerVip: true, ignorerAbonnes: false, autorises: [] });
  var jeton = lire('jeton', null);                         // { access, refresh, expire }
  var moi = null;                                          // { id, login, name }

  function familles() { return reglages.familles; }
  function dessinerReglages() {
    document.querySelectorAll('input[name=mode]').forEach(function (r) { r.checked = r.value === reglages.mode; });
    document.querySelectorAll('input[data-famille]').forEach(function (c) { c.checked = reglages.familles.indexOf(c.dataset.famille) >= 0; });
    $('ignorer-vip').checked = !!reglages.ignorerVip;
    $('ignorer-abonnes').checked = !!reglages.ignorerAbonnes;
    $('autorises').value = (reglages.autorises || []).join('\n');
  }
  function noterReglages() {
    reglages.mode = (document.querySelector('input[name=mode]:checked') || {}).value || 'prevenir';
    reglages.familles = Array.prototype.map.call(document.querySelectorAll('input[data-famille]:checked'), function (c) { return c.dataset.famille; });
    reglages.ignorerVip = $('ignorer-vip').checked;
    reglages.ignorerAbonnes = $('ignorer-abonnes').checked;
    reglages.autorises = $('autorises').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    ecrire('reglages', reglages);
    essayer();
  }
  document.querySelectorAll('input[name=mode], input[data-famille], #ignorer-vip, #ignorer-abonnes').forEach(function (e) { e.addEventListener('change', noterReglages); });
  $('autorises').addEventListener('input', noterReglages);

  function etat(t) { $('etat').textContent = t; }

  // ── essayer une phrase (sans Twitch) ─────────────────────────────────────────────────────────────────────
  var NOMS = { haine: 'haine', menace: 'menace', insulte: 'insulte', leger: 'moquerie', juron: 'juron' };
  function expliquer(r) {
    return r.trouvailles.map(function (t) { return '« ' + t.mot + ' » (' + NOMS[t.famille] + ', ' + t.comment + ')'; }).join(' ; ');
  }
  function essayer() {
    var v = $('essai').value.trim();
    if (!v) { $('essai-resultat').textContent = ''; return; }
    var r = DETECTEUR.analyser(v, { familles: familles(), autorises: reglages.autorises });
    $('essai-resultat').textContent = r.signale ? '⚠ ' + expliquer(r) : '✓ rien à signaler';
  }
  $('essai').addEventListener('input', essayer);

  // ── Twitch : les appels ──────────────────────────────────────────────────────────────────────────────────
  function formulaire(o) { return Object.keys(o).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }
  async function poster(url, corps) {
    var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formulaire(corps) });
    var j = {}; try { j = await r.json(); } catch (e) {}
    return { code: r.status, j: j };
  }
  async function helix(methode, chemin, corps, deja) {
    var r = await fetch(HELIX + chemin, { method: methode, headers: { 'Authorization': 'Bearer ' + jeton.access, 'Client-Id': CLIENT_ID,
      'Content-Type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined });
    if (r.status === 401 && !deja && await rafraichir()) return helix(methode, chemin, corps, true);
    var j = {}; try { j = await r.json(); } catch (e) {}
    return { code: r.status, j: j };
  }
  async function rafraichir() {
    if (!jeton || !jeton.refresh) return false;
    var r = await poster(ID + '/token', { client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token: jeton.refresh });
    if (r.code !== 200 || !r.j.access_token) { oublier('La connexion à Twitch a expiré : reconnecte-toi.'); return false; }
    jeton = { access: r.j.access_token, refresh: r.j.refresh_token || jeton.refresh, expire: Date.now() + 1000 * (r.j.expires_in || 3600) };
    ecrire('jeton', jeton);
    return true;
  }

  // ── la connexion par code (twitch.tv/activate) ───────────────────────────────────────────────────────────
  var attente = null;
  $('connecter').addEventListener('click', async function () {
    $('connecter').disabled = true;
    var r = await poster(ID + '/device', { client_id: CLIENT_ID, scopes: PORTEES.join(' ') });
    if (r.code !== 200 || !r.j.device_code) { etat('Twitch ne répond pas (' + r.code + ') : réessaie dans un instant.'); $('connecter').disabled = false; return; }
    $('code').textContent = r.j.user_code;
    $('lien-activer').href = r.j.verification_uri || 'https://www.twitch.tv/activate';
    $('code-zone').hidden = false;
    var fin = Date.now() + 1000 * (r.j.expires_in || 1800), pas = 1000 * Math.max(5, r.j.interval || 5);
    clearInterval(attente);
    attente = setInterval(async function () {
      if (Date.now() > fin) { clearInterval(attente); $('code-zone').hidden = true; $('connecter').disabled = false; etat('Le code a expiré : reclique « Connecter ».'); return; }
      var t = await poster(ID + '/token', { client_id: CLIENT_ID, scopes: PORTEES.join(' '), device_code: r.j.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
      if (t.code === 200 && t.j.access_token) {
        clearInterval(attente);
        jeton = { access: t.j.access_token, refresh: t.j.refresh_token, expire: Date.now() + 1000 * (t.j.expires_in || 3600) };
        ecrire('jeton', jeton);
        $('code-zone').hidden = true; $('connecter').disabled = false;
        demarrer();
      }
    }, pas);
  });
  $('deconnecter').addEventListener('click', function () { oublier('Déconnecté.'); });
  function oublier(t) {
    jeton = null; moi = null; ecrire('jeton', null);
    if (ws) { try { ws.close(); } catch (e) {} ws = null; }
    $('pas-connecte').hidden = false; $('connecte').hidden = true;
    etat(t || 'Pas connecté.');
  }

  // ── le chat : EventSub par WebSocket ─────────────────────────────────────────────────────────────────────
  var ws = null, garde = null;
  async function demarrer() {
    var u = await helix('GET', '/users');
    if (u.code !== 200 || !u.j.data || !u.j.data[0]) { oublier('Twitch a refusé la connexion : reconnecte-toi.'); return; }
    moi = { id: u.j.data[0].id, login: u.j.data[0].login, name: u.j.data[0].display_name };
    $('chaine').textContent = moi.name;
    $('pas-connecte').hidden = true; $('connecte').hidden = false;
    ouvrir(WS);
  }
  function ouvrir(url) {
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) {} }
    etat('Connexion au chat…');
    ws = new WebSocket(url);
    ws.onmessage = async function (ev) {
      var m = {}; try { m = JSON.parse(ev.data); } catch (e) { return; }
      var type = m.metadata && m.metadata.message_type;
      vivant();
      if (type === 'session_welcome') {
        var r = await helix('POST', '/eventsub/subscriptions', { type: 'channel.chat.message', version: '1',
          condition: { broadcaster_user_id: moi.id, user_id: moi.id }, transport: { method: 'websocket', session_id: m.payload.session.id } });
        etat(r.code === 202 ? '✓ En écoute du chat de ' + moi.name + ' — ' + ({ prevenir: 'prévient seulement', effacer: 'efface', exclure: 'efface et exclut' })[reglages.mode]
          : 'Le chat n\'a pas pu être écouté (' + r.code + (r.j.message ? ' : ' + r.j.message : '') + ').');
      } else if (type === 'session_reconnect') {
        ouvrir(m.payload.session.reconnect_url);
      } else if (type === 'notification' && m.payload.subscription.type === 'channel.chat.message') {
        traiter(m.payload.event);
      } else if (type === 'revocation') {
        etat('Twitch a retiré l\'écoute du chat : reconnecte-toi.');
      }
    };
    ws.onclose = function () { etat('Chat coupé — reconnexion…'); setTimeout(function () { if (jeton) ouvrir(WS); }, 3000); };
  }
  function vivant() {   // pas de nouvelles de Twitch depuis 40 s : on rouvre
    clearTimeout(garde);
    garde = setTimeout(function () { if (jeton) ouvrir(WS); }, 40000);
  }

  // ── un message du chat ───────────────────────────────────────────────────────────────────────────────────
  function badges(ev) { return (ev.badges || []).map(function (b) { return b.set_id; }); }
  function traiter(ev) {
    var b = badges(ev);
    if (ev.chatter_user_id === moi.id || b.indexOf('broadcaster') >= 0 || b.indexOf('moderator') >= 0) return;
    if (reglages.ignorerVip && b.indexOf('vip') >= 0) return;
    if (reglages.ignorerAbonnes && (b.indexOf('subscriber') >= 0 || b.indexOf('founder') >= 0)) return;
    var texte = (ev.message && ev.message.text) || '';
    var r = DETECTEUR.analyser(texte, { familles: familles(), autorises: reglages.autorises });
    if (!r.signale) return;
    var s = { id: ev.message_id, user: ev.chatter_user_id, pseudo: ev.chatter_user_name || ev.chatter_user_login, texte: texte,
      r: r, quand: Date.now(), fait: null };
    ajouter(s);
    if (reglages.mode === 'effacer') effacer(s);
    else if (reglages.mode === 'exclure') { if (r.gravite === 'haine' || r.gravite === 'menace') exclure(s, EXCLUSION_S); else effacer(s); }
  }

  // ── les actions ──────────────────────────────────────────────────────────────────────────────────────────
  async function effacer(s) {
    var r = await helix('DELETE', '/moderation/chat?broadcaster_id=' + moi.id + '&moderator_id=' + moi.id + '&message_id=' + encodeURIComponent(s.id));
    marquer(s, r.code === 204 ? '🧹 effacé' : '✗ effacement refusé (' + r.code + ')');
  }
  async function exclure(s, duree) {
    var corps = { data: { user_id: s.user, reason: 'Bot de modération : ' + s.r.trouvailles.map(function (t) { return NOMS[t.famille]; }).join(', ') } };
    if (duree) corps.data.duration = duree;
    var r = await helix('POST', '/moderation/bans?broadcaster_id=' + moi.id + '&moderator_id=' + moi.id, corps);
    marquer(s, r.code === 200 ? (duree ? '⏱ exclu ' + Math.round(duree / 60) + ' min' : '⛔ banni') : '✗ refusé (' + r.code + ')');
  }

  // ── la liste des signalements ────────────────────────────────────────────────────────────────────────────
  var liste = [];
  function surligner(texte, r) {
    var span = document.createElement('span');
    span.className = 'texte';
    span.textContent = texte;
    return span;
  }
  function ajouter(s) {
    liste.unshift(s);
    if (liste.length > MAX_LISTE) liste.pop();
    dessiner();
  }
  function marquer(s, quoi) { s.fait = quoi; dessiner(); }
  function dessiner() {
    var ul = $('signalements');
    ul.textContent = '';
    liste.forEach(function (s) {
      var li = document.createElement('li');
      li.className = s.r.gravite + (s.fait ? ' fait' : '');
      var h = document.createElement('div');
      var q = document.createElement('span'); q.className = 'qui'; q.textContent = s.pseudo;
      var w = document.createElement('span'); w.className = 'quand';
      w.textContent = new Date(s.quand).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + (s.fait ? ' · ' + s.fait : '');
      h.append(q, w);
      var p = document.createElement('div'); p.className = 'pourquoi'; p.textContent = expliquer(s.r);
      li.append(h, surligner(s.texte, s.r), p);
      if (moi && !s.fait) {
        var a = document.createElement('div'); a.className = 'actions';
        [['🧹 Effacer', function () { effacer(s); }], ['⏱ 10 min', function () { exclure(s, EXCLUSION_S); }],
         ['⛔ Bannir', function () { if (confirm('Bannir ' + s.pseudo + ' ?')) exclure(s, 0); }],
         ['✓ Pas grave', function () { marquer(s, 'laissé'); }]]
          // « autoriser » un mot : jamais pour une menace (on n'autorise pas « va te suicider » d'un clic)
          .concat(s.r.gravite === 'menace' ? [] : [['➕ Autoriser « ' + s.r.trouvailles[0].mot + ' »', function () {
            reglages.autorises.push(s.r.trouvailles[0].mot); ecrire('reglages', reglages); dessinerReglages(); marquer(s, 'mot autorisé'); }]])
          .forEach(function (x) { var bt = document.createElement('button'); bt.className = 'petit'; bt.textContent = x[0]; bt.onclick = x[1]; a.appendChild(bt); });
        li.appendChild(a);
      }
      ul.appendChild(li);
    });
    $('aucun').hidden = liste.length > 0;
    $('nb').textContent = liste.length ? '(' + liste.length + ')' : '';
  }
  $('vider').addEventListener('click', function () { liste = []; dessiner(); });

  // pour la sonde : un faux message du chat, sans Twitch
  window.__bot = { traiter: function (ev) { if (!moi) moi = { id: '0', login: 'test', name: 'test' }; traiter(ev); }, liste: function () { return liste; },
    reglages: function () { return reglages; } };

  dessinerReglages();
  dessiner();
  if (jeton && jeton.access) demarrer();
})();
