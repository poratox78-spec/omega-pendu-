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
 *
 * LES ORDRES À LA VOIX (08/10/2026, idée de Rem) : l'outil Déformateur de voix entend « Bot, efface », « Bot, exclus trois »,
 * « Bot, bannis Kevin »… (reconnaissance de Windows, sur le PC) et les passe ici par le WebSocket de son petit serveur local
 * (127.0.0.1:47821 et suivants — le seul canal qu'OBS laisse ouvert entre une page et un logiciel du PC). Chaque
 * signalement porte un NUMÉRO à dire ; un pseudo se dit s'il vient d'écrire. Bannir à la voix demande « Bot, confirme ».
 */
'use strict';
(function () {
  var CLIENT_ID = 'xc1r4prc5wm7jg5fyrd3thtdz4cz5c';          // l'application Twitch du Déformateur (publique, voix.py)
  var ID = 'https://id.twitch.tv/oauth2', HELIX = 'https://api.twitch.tv/helix', WS = 'wss://eventsub.wss.twitch.tv/ws';
  // 08/10 : + le mode bouclier et le mode lent, pour les ordres à la voix (« Bot, mode bouclier »)
  var PORTEES = ['user:read:chat', 'moderator:manage:chat_messages', 'moderator:manage:banned_users',
    'moderator:manage:shield_mode', 'moderator:manage:chat_settings'];
  var EXCLUSION_S = 600, MAX_LISTE = 100, MAX_NUMERO = 20, LENT_S = 30, CONFIRMER_MS = 15000;
  // « ?port= » : la sonde branche le dock sur SON serveur de test, jamais sur l'outil de Rem s'il tourne
  var OUTIL_PORT = +((/[?&]port=(\d+)/.exec(location.search) || [])[1]) || 47821, OUTIL_ESSAIS = 12, OUTIL_AGE_MS = 5000;
  var $ = function (id) { return document.getElementById(id); };

  // ── les réglages, gardés dans ce navigateur ──────────────────────────────────────────────────────────────
  function lire(cle, defaut) { try { var v = localStorage.getItem('bot.' + cle); return v == null ? defaut : JSON.parse(v); } catch (e) { return defaut; } }
  function ecrire(cle, v) { try { localStorage.setItem('bot.' + cle, JSON.stringify(v)); } catch (e) {} }
  var reglages = lire('reglages', { mode: 'prevenir', familles: ['haine', 'menace', 'insulte'], ignorerVip: true, ignorerAbonnes: false, autorises: [] });
  // 08/10 : écouter l'outil — allumé d'office dans OBS (son navigateur laisse passer le WebSocket vers le PC) ; dans un
  // navigateur ordinaire, c'est une case : il pourrait demander la permission de « parler aux appareils du réseau local ».
  if (reglages.voix == null) reglages.voix = /\bOBS\//.test(navigator.userAgent) || !!window.obsstudio;
  var jeton = lire('jeton', null);                         // { access, refresh, expire }
  var moi = null;                                          // { id, login, name }

  function familles() { return reglages.familles; }
  function dessinerReglages() {
    document.querySelectorAll('input[name=mode]').forEach(function (r) { r.checked = r.value === reglages.mode; });
    document.querySelectorAll('input[data-famille]').forEach(function (c) { c.checked = reglages.familles.indexOf(c.dataset.famille) >= 0; });
    $('ignorer-vip').checked = !!reglages.ignorerVip;
    $('ignorer-abonnes').checked = !!reglages.ignorerAbonnes;
    $('autorises').value = (reglages.autorises || []).join('\n');
    $('voix').checked = !!reglages.voix;
  }
  function noterReglages() {
    reglages.mode = (document.querySelector('input[name=mode]:checked') || {}).value || 'prevenir';
    reglages.familles = Array.prototype.map.call(document.querySelectorAll('input[data-famille]:checked'), function (c) { return c.dataset.famille; });
    reglages.ignorerVip = $('ignorer-vip').checked;
    reglages.ignorerAbonnes = $('ignorer-abonnes').checked;
    reglages.autorises = $('autorises').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    var avant = reglages.voix;
    reglages.voix = $('voix').checked;
    ecrire('reglages', reglages);
    if (avant !== reglages.voix) { if (reglages.voix) chercherOutil(); else couperOutil(); }
    essayer();
  }
  document.querySelectorAll('input[name=mode], input[data-famille], #ignorer-vip, #ignorer-abonnes, #voix').forEach(function (e) { e.addEventListener('change', noterReglages); });
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
    jeton = { access: r.j.access_token, refresh: r.j.refresh_token || jeton.refresh, expire: Date.now() + 1000 * (r.j.expires_in || 3600),
      portees: r.j.scope || jeton.portees };
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
        jeton = { access: t.j.access_token, refresh: t.j.refresh_token, expire: Date.now() + 1000 * (t.j.expires_in || 3600),
          portees: t.j.scope || PORTEES };
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
    retenir(ev);
    var b = badges(ev);
    if (ev.chatter_user_id === moi.id || b.indexOf('broadcaster') >= 0 || b.indexOf('moderator') >= 0) return;
    if (reglages.ignorerVip && b.indexOf('vip') >= 0) return;
    if (reglages.ignorerAbonnes && (b.indexOf('subscriber') >= 0 || b.indexOf('founder') >= 0)) return;
    var texte = (ev.message && ev.message.text) || '';
    var r = DETECTEUR.analyser(texte, { familles: familles(), autorises: reglages.autorises });
    if (!r.signale) return;
    var s = { id: ev.message_id, user: ev.chatter_user_id, pseudo: ev.chatter_user_name || ev.chatter_user_login, texte: texte,
      r: r, quand: Date.now(), fait: null, num: numeroSuivant() };
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
    var corps = { data: { user_id: s.user, reason: s.r ? 'Bot de modération : ' + s.r.trouvailles.map(function (t) { return NOMS[t.famille]; })
      .filter(function (f, i, l) { return l.indexOf(f) === i; }).join(', ')
      : 'Bot de modération (ordre à la voix)' } };
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
  function marquer(s, quoi) { s.fait = quoi; if (!s.horsListe) dessiner(); }   // horsListe : un pseudo visé à la voix, sans signalement
  function dessiner() {
    var ul = $('signalements');
    ul.textContent = '';
    liste.forEach(function (s) {
      var li = document.createElement('li');
      li.className = s.r.gravite + (s.fait ? ' fait' : '');
      var h = document.createElement('div');
      var q = document.createElement('span'); q.className = 'qui'; q.textContent = s.pseudo;
      var n = document.createElement('span'); n.className = 'num'; n.textContent = s.num; n.title = 'À dire : « Bot, exclus ' + (NOMBRES[s.num - 1] || s.num) + ' »';
      var w = document.createElement('span'); w.className = 'quand';
      w.textContent = new Date(s.quand).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + (s.fait ? ' · ' + s.fait : '');
      h.append(n, q, w);
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
  $('vider').addEventListener('click', function () { liste = []; dernierNumero = 0; dessiner(); });

  // ── 08/10 : LES ORDRES À LA VOIX ─────────────────────────────────────────────────────────────────────────
  // Les numéros : 1, 2, 3… jusqu'à vingt (ce qu'on peut dire), puis on repart à 1 ; « trois » vise le plus récent n° 3.
  var NOMBRES = ['un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize',
    'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf', 'vingt'];
  var dernierNumero = 0;
  function numeroSuivant() { dernierNumero = dernierNumero % MAX_NUMERO + 1; return dernierNumero; }

  // Qui vient d'écrire (TOUT le chat, pas seulement les signalés) : « Bot, efface Kevin » vise son dernier message.
  var recents = [];                                         // [{ user, login, pseudo, id, quand }], le plus récent devant
  function retenir(ev) {
    var login = (ev.chatter_user_login || '').toLowerCase();
    recents = recents.filter(function (r) { return r.login !== login; });
    recents.unshift({ user: ev.chatter_user_id, login: login, pseudo: ev.chatter_user_name || login, id: ev.message_id, quand: Date.now() });
    if (recents.length > 200) recents.length = 200;
  }
  // la même forme « prononçable » que l'outil (commandes_voix.pseudo_prononcable) : Kevin_42 → « kevin »
  function sansAccent(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function prononcable(p) {
    var t = sansAccent(String(p || '').replace(/([a-z])([A-Z])/g, '$1 $2')).replace(/[^a-z ]+/g, ' ');
    return t.split(/\s+/).filter(function (m) { return m.length >= 2; }).join(' ');
  }
  function chercherPseudo(dit) {
    var d = String(dit || '').toLowerCase(), f = prononcable(dit);
    for (var i = 0; i < recents.length; i++) {
      var r = recents[i];
      if (r.login === d || r.pseudo.toLowerCase() === d || (f && prononcable(r.pseudo) === f)) return r;
    }
    return null;
  }

  // La cible d'un ordre → un signalement (ou, pour un pseudo qui n'a rien de signalé, son dernier message)
  function cibler(cible) {
    var i;
    if (cible.numero) {
      for (i = 0; i < liste.length; i++) if (liste[i].num === cible.numero) return liste[i];
      return null;
    }
    if (cible.pseudo) {
      var r = chercherPseudo(cible.pseudo);
      if (!r) return null;
      for (i = 0; i < liste.length; i++) if (liste[i].user === r.user && !liste[i].fait) return liste[i];
      return { id: r.id, user: r.user, pseudo: r.pseudo, texte: '', r: null, quand: r.quand, fait: null, horsListe: true };
    }
    for (i = 0; i < liste.length; i++) if (!liste[i].fait) return liste[i];    // « le dernier » : le plus récent pas traité
    return null;
  }

  var enAttente = null;                                     // un bannissement qui attend « Bot, confirme »
  function montrerAttente() {
    var z = $('voix-confirmer');
    if (enAttente && Date.now() < enAttente.fin) {
      z.textContent = '⛔ Bannir ' + enAttente.s.pseudo + ' ? Dis « Bot, confirme » (ou « Bot, annule »).';
      z.hidden = false;
    } else { enAttente = null; z.hidden = true; }
  }
  function dire(t, bien) { var e = $('voix-etat'); e.textContent = t; e.className = bien ? 'ok' : 'doux'; }

  // Un ordre : { action, cible: {dernier} | {numero} | {pseudo}, texte }. Rend ce qui a été fait (pour la sonde).
  async function ordre(c) {
    if (!moi) { dire('🎙 « ' + c.texte + ' » : connecte d\'abord Twitch.'); return 'pas connecté'; }
    var a = c.action, cible = c.cible || { dernier: true };
    if (a === 'annuler') { var avait = !!enAttente; enAttente = null; montrerAttente(); dire('🎙 Annulé.', true); return avait ? 'annulé' : 'rien'; }
    if (a === 'confirmer') {
      if (!enAttente || Date.now() >= enAttente.fin) { enAttente = null; montrerAttente(); dire('🎙 Rien à confirmer.'); return 'rien'; }
      var b = enAttente.s; enAttente = null; montrerAttente();
      await exclure(b, 0); dire('🎙 ' + b.pseudo + ' : ' + (b.fait || '…'), true); return 'banni';
    }
    if (a === 'bouclier' || a === 'fin_bouclier') {
      var rb = await helix('PUT', '/moderation/shield_mode?broadcaster_id=' + moi.id + '&moderator_id=' + moi.id, { is_active: a === 'bouclier' });
      dire(rb.code === 200 ? (a === 'bouclier' ? '🛡 Mode bouclier allumé.' : '🛡 Mode bouclier éteint.') : refus(rb), rb.code === 200);
      return a;
    }
    if (a === 'lent' || a === 'fin_lent') {
      var rl = await helix('PATCH', '/chat/settings?broadcaster_id=' + moi.id + '&moderator_id=' + moi.id,
        a === 'lent' ? { slow_mode: true, slow_mode_wait_time: LENT_S } : { slow_mode: false });
      dire(rl.code === 200 ? (a === 'lent' ? '🐢 Mode lent : un message toutes les ' + LENT_S + ' s.' : '🐢 Mode lent éteint.') : refus(rl), rl.code === 200);
      return a;
    }
    var s = cibler(cible);
    var quoi = cible.numero ? 'le n° ' + cible.numero : cible.pseudo ? cible.pseudo : 'le dernier signalement';
    if (!s) { dire('🎙 « ' + c.texte + ' » : ' + quoi + ' — introuvable.'); return 'introuvable'; }
    if (a === 'effacer') {
      if (!s.id) { dire('🎙 ' + s.pseudo + ' : aucun message à effacer.'); return 'introuvable'; }
      await effacer(s); dire('🎙 ' + s.pseudo + ' : ' + (s.fait || '…'), true); return 'effacé';
    }
    if (a === 'exclure') { await exclure(s, EXCLUSION_S); dire('🎙 ' + s.pseudo + ' : ' + (s.fait || '…'), true); return 'exclu'; }
    if (a === 'laisser') {
      if (s.horsListe) { dire('🎙 ' + s.pseudo + ' : rien de signalé.'); return 'rien'; }
      marquer(s, 'laissé'); dire('🎙 ' + s.pseudo + ' : laissé.', true); return 'laissé';
    }
    if (a === 'bannir') { enAttente = { s: s, fin: Date.now() + CONFIRMER_MS }; montrerAttente(); setTimeout(montrerAttente, CONFIRMER_MS + 50); return 'à confirmer'; }
    return 'inconnu';
  }
  function refus(r) {
    if (r.code === 401 || r.code === 403) return '✗ Twitch refuse (' + r.code + ') : déconnecte-toi puis reconnecte-toi pour donner ce droit au bot.';
    return '✗ Twitch refuse (' + r.code + (r.j && r.j.message ? ' : ' + r.j.message : '') + ').';
  }
  // ── le branchement à l'outil (WebSocket local) ───────────────────────────────────────────────────────────
  var outil = { ws: null, port: null, session: null, vu: 0, essai: 0, minuterie: null };
  function couperOutil() {
    clearTimeout(outil.minuterie);
    if (outil.ws) { try { outil.ws.onclose = null; outil.ws.close(); } catch (e) {} }
    outil.ws = null; outil.port = null;
    dire(reglages.voix ? '' : 'Éteint.');
  }
  function chercherOutil() {
    clearTimeout(outil.minuterie);
    if (!reglages.voix || outil.ws) return;
    var port = OUTIL_PORT + (outil.essai++ % OUTIL_ESSAIS), fini = false, sock;
    try { sock = new WebSocket('ws://127.0.0.1:' + port + '/?bot'); } catch (e) { return suite(); }
    var delai = setTimeout(function () { try { sock.close(); } catch (e) {} suite(); }, 1500);
    function suite() {
      if (fini) return; fini = true; clearTimeout(delai);
      // un tour des 12 ports, puis une pause : un outil éteint ne coûte presque rien
      outil.minuterie = setTimeout(chercherOutil, outil.essai % OUTIL_ESSAIS === 0 ? 5000 : 50);
      if (outil.essai % OUTIL_ESSAIS === 0) dire('🎙 Outil pas trouvé : ouvre le Déformateur de voix, menu Live → « Modération à la voix », et coche « Écouter ».');
    }
    sock.onmessage = function (ev) {
      var m = {}; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.outil !== 'deformateur-voix') { try { sock.close(); } catch (e) {} return; }
      if (!fini) { fini = true; clearTimeout(delai); outil.ws = sock; outil.port = port; outil.essai = port - OUTIL_PORT;
        dire('🎙 Branché au Déformateur de voix (port ' + port + ') : dis « Bot, … ».', true); }
      recevoir(m);
    };
    sock.onclose = function () {
      if (outil.ws === sock) { outil.ws = null; dire('🎙 L\'outil s\'est arrêté — je le cherche…'); outil.minuterie = setTimeout(chercherOutil, 2000); }
      else suite();
    };
    sock.onerror = function () {};
  }
  function recevoir(m) {
    var voix = m.voix || [];
    if (m.session !== outil.session) {                      // une nouvelle session de l'outil : on ne rejoue pas son passé
      outil.session = m.session;
      outil.vu = voix.reduce(function (x, c) { return Math.max(x, c.age_ms < 1500 ? 0 : c.n); }, 0);
    }
    voix.forEach(function (c) {
      if (c.n > outil.vu) { outil.vu = c.n; if (c.age_ms <= OUTIL_AGE_MS) ordre(c); }
    });
  }

  // pour la sonde : un faux message du chat, un faux ordre à la voix, sans Twitch ni outil
  window.__bot = { traiter: function (ev) { if (!moi) moi = { id: '0', login: 'test', name: 'test' }; if (!jeton) jeton = { access: 'test' }; traiter(ev); }, liste: function () { return liste; },
    reglages: function () { return reglages; }, ordre: function (c) { if (!moi) moi = { id: '0', login: 'test', name: 'test' }; if (!jeton) jeton = { access: 'test' }; return ordre(c); },
    recents: function () { return recents; }, outil: function () { return outil; }, enAttente: function () { return enAttente; } };

  dessinerReglages();
  dessiner();
  if (jeton && jeton.access) demarrer();
  if (reglages.voix) chercherOutil();
})();
