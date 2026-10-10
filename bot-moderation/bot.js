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
 *
 * LE BOT PARLE (10/10/2026, Rem : « élargir notre bot, un tout-en-un » ; « compte bot à part, ton taquin ») : on connecte le
 * compte du BOT (un compte Twitch créé par le streamer, nommé modérateur de sa chaîne) et on écrit le nom de la chaîne à
 * surveiller. Le bot écrit dans le chat (POST /helix/chat/messages) : une réplique après chaque action, une réponse quand on
 * l'appelle (@lebot, !bot). Il ne parle QUE s'il a son propre compte — jamais sous le nom du streamer. Ses répliques :
 * repliques.js. Connecté avec le compte du streamer (comme avant le 10/10), tout marche comme avant, en silence.
 */
'use strict';
(function () {
  var CLIENT_ID = 'xc1r4prc5wm7jg5fyrd3thtdz4cz5c';          // l'application Twitch du Déformateur (publique, voix.py)
  var ID = 'https://id.twitch.tv/oauth2', HELIX = 'https://api.twitch.tv/helix', WS = 'wss://eventsub.wss.twitch.tv/ws';
  // 08/10 : + le mode bouclier et le mode lent, pour les ordres à la voix (« Bot, mode bouclier »)
  var PORTEES = ['user:read:chat', 'moderator:manage:chat_messages', 'moderator:manage:banned_users',
    'moderator:manage:shield_mode', 'moderator:manage:chat_settings',
    // 10/10 : parler dans le chat ; savoir s'il est bien modérateur de la chaîne surveillée
    'user:write:chat', 'user:read:moderated_channels',
    // 10/10 (étape 2) : !followage — depuis quand quelqu'un suit la chaîne (le bot, modérateur, peut le lire)
    'moderator:read:followers',
    // 10/10 (étape 3) : mettre en avant la chaîne qui fait un raid (/shoutout)
    'moderator:manage:shoutouts'];
  var EXCLUSION_S = 600, MAX_LISTE = 100, MAX_NUMERO = 20, LENT_S = 30, CONFIRMER_MS = 15000;
  // la parole : Twitch admet 100 messages / 30 s pour un modérateur (20 sinon) ; le bot reste très en dessous, et ne
  // répond pas deux fois de suite à la même personne (sinon un spectateur le ferait parler en boucle)
  var PAROLE_ECART_MS = 1200, PAROLE_MAX_30S = 12, APPEL_PAR_PERSONNE_MS = 30000, APPEL_GLOBAL_MS = 4000;
  // les commandes : 5 s entre deux usages d'une même commande, 30 s pour la même personne (le streamer et ses modos : sans
  // attente) — chacun peut demander SON !followage sans bloquer les autres ; les messages réguliers :
  // 5 min au moins entre deux, et 5 messages du chat depuis le dernier
  var COMMANDE_DELAI_MS = 5000, COMMANDE_PERSONNE_MS = 30000, MINUTEUR_MIN = 5, MIN_LIGNES = 5;
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
  if (reglages.ton == null) reglages.ton = 'taquin';       // 10/10 : choix de Rem
  if (reglages.chaine == null) reglages.chaine = '';       // vide = la chaîne du compte connecté
  // 10/10 : les filtres classiques (filtres.js) — Rem : « liens, MAJUSCULES, spam si même texte, pas de limite d'émoticônes »
  if (!reglages.filtres) reglages.filtres = { liens: true, majuscules: true, spam: true, liensAbonnes: false, sites: [] };
  var jeton = lire('jeton', null);                         // { access, refresh, expire }
  var moi = null;                                          // { id, login, name } : le compte connecté (le bot, ou le streamer)
  var chaine = null;                                       // { id, login, name, mod } : la chaîne surveillée

  function familles() { return reglages.familles; }
  function dessinerReglages() {
    document.querySelectorAll('input[name=mode]').forEach(function (r) { r.checked = r.value === reglages.mode; });
    document.querySelectorAll('input[data-famille]').forEach(function (c) { c.checked = reglages.familles.indexOf(c.dataset.famille) >= 0; });
    $('ignorer-vip').checked = !!reglages.ignorerVip;
    $('ignorer-abonnes').checked = !!reglages.ignorerAbonnes;
    $('autorises').value = (reglages.autorises || []).join('\n');
    $('voix').checked = !!reglages.voix;
    $('ton').value = reglages.ton;
    $('nom-chaine').value = reglages.chaine;
    var F = reglages.filtres;
    $('filtre-liens').checked = F.liens !== false; $('filtre-majuscules').checked = F.majuscules !== false;
    $('filtre-spam').checked = F.spam !== false; $('filtre-liens-abonnes').checked = !!F.liensAbonnes;
    $('filtre-sites').value = (F.sites || []).join('\n');
  }
  function noterReglages() {
    reglages.mode = (document.querySelector('input[name=mode]:checked') || {}).value || 'prevenir';
    reglages.familles = Array.prototype.map.call(document.querySelectorAll('input[data-famille]:checked'), function (c) { return c.dataset.famille; });
    reglages.ignorerVip = $('ignorer-vip').checked;
    reglages.ignorerAbonnes = $('ignorer-abonnes').checked;
    reglages.autorises = $('autorises').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    var avant = reglages.voix;
    reglages.voix = $('voix').checked;
    reglages.ton = $('ton').value || 'taquin';
    reglages.filtres = { liens: $('filtre-liens').checked, majuscules: $('filtre-majuscules').checked, spam: $('filtre-spam').checked,
      liensAbonnes: $('filtre-liens-abonnes').checked,
      sites: $('filtre-sites').value.split('\n').map(function (s) { return FILTRES.domaine(s.trim()); }).filter(Boolean) };
    ecrire('reglages', reglages);
    montrerParole();
    if (avant !== reglages.voix) { if (reglages.voix) chercherOutil(); else couperOutil(); }
    essayer();
  }
  document.querySelectorAll('input[name=mode], input[data-famille], #ignorer-vip, #ignorer-abonnes, #voix, #ton, '
    + '#filtre-liens, #filtre-majuscules, #filtre-spam, #filtre-liens-abonnes').forEach(function (e) { e.addEventListener('change', noterReglages); });
  $('autorises').addEventListener('input', noterReglages);
  $('filtre-sites').addEventListener('change', noterReglages);
  // la chaîne à surveiller : on relance l'écoute quand elle change (« twitch.tv/Rem » ou « @Rem » sont acceptés)
  $('nom-chaine').addEventListener('change', function () {
    var v = $('nom-chaine').value.trim().replace(/^.*twitch\.tv\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '').toLowerCase();
    $('nom-chaine').value = v;
    if (v === reglages.chaine) return;
    reglages.chaine = v; ecrire('reglages', reglages);
    if (jeton && jeton.access) demarrer();
  });

  function etat(t) { $('etat').textContent = t; }

  // ── essayer une phrase (sans Twitch) ─────────────────────────────────────────────────────────────────────
  var NOMS = { haine: 'haine', menace: 'menace', insulte: 'insulte', leger: 'moquerie', juron: 'juron',
    lien: 'lien', majuscules: 'majuscules', spam: 'message répété' };
  function expliquer(r) {
    return r.trouvailles.map(function (t) { return '« ' + t.mot + ' » (' + NOMS[t.famille] + ', ' + t.comment + ')'; }).join(' ; ');
  }
  function essayer() {
    var v = $('essai').value.trim();
    if (!v) { $('essai-resultat').textContent = ''; return; }
    var r = DETECTEUR.analyser(v, { familles: familles(), autorises: reglages.autorises });
    if (!r.signale) r = FILTRES.analyser({ message: { text: v } }, optionsFiltres(false), null);   // liens et majuscules aussi
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
    jeton = null; moi = null; chaine = null; ecrire('jeton', null);
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) {} ws = null; }
    clearTimeout(revoirMod);
    $('pas-connecte').hidden = false; $('connecte').hidden = true;
    etat(t || 'Pas connecté.');
    montrerParole();
  }

  // ── le chat : EventSub par WebSocket ─────────────────────────────────────────────────────────────────────
  var ws = null, garde = null, revoirMod = null;
  async function demarrer() {
    var u = await helix('GET', '/users');
    if (u.code !== 200 || !u.j.data || !u.j.data[0]) { oublier('Twitch a refusé la connexion : reconnecte-toi.'); return; }
    moi = { id: u.j.data[0].id, login: u.j.data[0].login, name: u.j.data[0].display_name };
    $('compte').textContent = moi.name;
    $('pas-connecte').hidden = true; $('connecte').hidden = false;
    // 10/10 : la chaîne surveillée — celle écrite dans le champ, sinon celle du compte connecté
    chaine = null;
    if (reglages.chaine && reglages.chaine !== moi.login) {
      var c = await helix('GET', '/users?login=' + encodeURIComponent(reglages.chaine));
      if (c.code !== 200 || !c.j.data || !c.j.data[0]) { etat('Chaîne « ' + reglages.chaine + ' » introuvable sur Twitch : vérifie le nom.'); montrerParole(); return; }
      chaine = { id: c.j.data[0].id, login: c.j.data[0].login, name: c.j.data[0].display_name, mod: null };
      await verifierMod();
    } else {
      chaine = { id: moi.id, login: moi.login, name: moi.name, mod: true };
    }
    $('chaine').textContent = chaine.name;
    montrerParole();
    ouvrir(WS);
  }
  // le bot est-il modérateur de la chaîne ? Sans ce rang, il ne peut ni effacer ni exclure. On revérifie toutes les
  // minutes tant qu'il ne l'est pas : le streamer tape « /mod lebot » et le dock le voit tout seul.
  async function verifierMod() {
    clearTimeout(revoirMod);
    if (!chaine || chaine.id === moi.id) return;
    if (!aLaPortee('user:read:moderated_channels')) { chaine.mod = null; return; }
    var apres = '', trouve = false;
    for (var page = 0; page < 10 && !trouve; page++) {
      var r = await helix('GET', '/moderation/channels?user_id=' + moi.id + '&first=100' + (apres ? '&after=' + encodeURIComponent(apres) : ''));
      if (r.code !== 200) { chaine.mod = null; return; }
      trouve = (r.j.data || []).some(function (d) { return d.broadcaster_id === chaine.id; });
      apres = r.j.pagination && r.j.pagination.cursor;
      if (!apres) break;
    }
    chaine.mod = trouve;
    if (!trouve) revoirMod = setTimeout(function () { verifierMod().then(montrerParole); }, 60000);
  }
  function aLaPortee(p) {
    var l = jeton && jeton.portees;
    return !l || (Array.isArray(l) ? l : String(l).split(' ')).indexOf(p) >= 0;
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
          condition: { broadcaster_user_id: chaine.id, user_id: moi.id }, transport: { method: 'websocket', session_id: m.payload.session.id } });
        etat(r.code === 202 ? '✓ En écoute du chat de ' + chaine.name + ' — ' + ({ prevenir: 'prévient seulement', effacer: 'efface', exclure: 'efface et exclut' })[reglages.mode]
          : 'Le chat n\'a pas pu être écouté (' + r.code + (r.j.message ? ' : ' + r.j.message : '') + ').');
        // 10/10 (étape 3) : les abonnements, cadeaux et raids (les « annonces » du chat, lisibles par le bot) et les follows
        // (le bot doit être modérateur). Les Bits arrivent avec le message du chat lui-même.
        var sid = m.payload.session.id;
        var rn = await helix('POST', '/eventsub/subscriptions', { type: 'channel.chat.notification', version: '1',
          condition: { broadcaster_user_id: chaine.id, user_id: moi.id }, transport: { method: 'websocket', session_id: sid } });
        var rf = await helix('POST', '/eventsub/subscriptions', { type: 'channel.follow', version: '2',
          condition: { broadcaster_user_id: chaine.id, moderator_user_id: moi.id }, transport: { method: 'websocket', session_id: sid } });
        ecoute = { annonces: rn.code === 202, follows: rf.code === 202 };
        montrerAccueil();
      } else if (type === 'session_reconnect') {
        ouvrir(m.payload.session.reconnect_url);
      } else if (type === 'notification' && m.payload.subscription.type === 'channel.chat.message') {
        traiter(m.payload.event);
      } else if (type === 'notification' && m.payload.subscription.type === 'channel.chat.notification') {
        annonce(m.payload.event);
      } else if (type === 'notification' && m.payload.subscription.type === 'channel.follow') {
        suivi(m.payload.event);
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
    if (ev.chatter_user_id === moi.id) return;               // ses propres répliques
    retenir(ev);
    var b = badges(ev);
    var texte = (ev.message && ev.message.text) || '';
    var protege = ev.chatter_user_id === chaine.id || b.indexOf('broadcaster') >= 0 || b.indexOf('moderator') >= 0
      || (reglages.ignorerVip && b.indexOf('vip') >= 0) || (reglages.ignorerAbonnes && (b.indexOf('subscriber') >= 0 || b.indexOf('founder') >= 0));
    var r = protege ? { signale: false } : DETECTEUR.analyser(texte, { familles: familles(), autorises: reglages.autorises });
    if (!protege && !r.signale) r = filtrer(ev, b);             // 10/10 : liens, majuscules, même message répété
    if (!r.signale) {
      compterLigne();
      if (ev.cheer && ev.cheer.bits) remercierBits(ev);
      else accueillir(ev);
      if (permettre(ev, texte, b)) return;                     // « !permit Lili » (toi et tes modos)
      if (jouerPendu(ev, texte, b)) return;                    // une lettre, un mot, !pendu, !classement
      if (!commande(ev, texte, b)) repondre(ev, texte);
      return;
    }
    var s = { id: ev.message_id, user: ev.chatter_user_id, pseudo: ev.chatter_user_name || ev.chatter_user_login, texte: texte,
      r: r, quand: Date.now(), fait: null, num: numeroSuivant() };
    ajouter(s);
    if (reglages.mode === 'effacer') effacer(s);
    else if (reglages.mode === 'exclure') { if (r.gravite === 'haine' || r.gravite === 'menace') exclure(s, EXCLUSION_S); else effacer(s); }
  }

  // ── les actions ──────────────────────────────────────────────────────────────────────────────────────────
  async function effacer(s) {
    var r = await helix('DELETE', '/moderation/chat?broadcaster_id=' + chaine.id + '&moderator_id=' + moi.id + '&message_id=' + encodeURIComponent(s.id));
    marquer(s, r.code === 204 ? '🧹 effacé' : '✗ effacement refusé (' + r.code + ')');
    if (r.code === 204) parlerApres(s.r && FILTRES.FAMILLES[s.r.gravite] ? 'filtre_' + s.r.gravite : 'efface', s);
  }

  // ── 10/10 : LES FILTRES CLASSIQUES (filtres.js) ──────────────────────────────────────────────────────────
  // Après les insultes ; jamais pour toi, tes modos (ni les VIP, si « Ignorer les VIP »). Ce qu'ils signalent suit le
  // mode du bot, mais n'est jamais qu'EFFACÉ (pas d'exclusion pour un lien ou des majuscules).
  var memoireSpam = {}, permisLiens = {}, PERMIT_MS = 60000;
  function optionsFiltres(permis) {
    var F = reglages.filtres;
    return { liens: F.liens, majuscules: F.majuscules, spam: F.spam, sites: F.sites, liensPermis: permis };
  }
  function filtrer(ev, b) {
    var login = (ev.chatter_user_login || '').toLowerCase(), maintenant = Date.now();
    var abonne = ['subscriber', 'founder', 'vip'].some(function (x) { return b.indexOf(x) >= 0; });
    var permit = permisLiens[login] && maintenant < permisLiens[login];
    var r = FILTRES.analyser(ev, optionsFiltres(!!(reglages.filtres.liensAbonnes && abonne) || !!permit), memoireSpam, maintenant);
    if (permit && FILTRES.liens(FILTRES.texteSeul(ev)).length) delete permisLiens[login];   // un !permit = UN lien
    return r;
  }
  // « !permit Lili » : Lili peut poster un lien pendant 60 s (toi et tes modos seulement)
  function permettre(ev, texte, b) {
    var m = /^\s*!permit\s+@?([A-Za-z0-9_]{2,25})\b/i.exec(texte);
    if (!m) return false;
    if (!estChef(ev, b)) return true;
    permisLiens[m[1].toLowerCase()] = Date.now() + PERMIT_MS;
    parler(REPLIQUES.choisir(tonCommandes(), 'permit', { cible: m[1] }), true);
    return true;
  }
  async function exclure(s, duree) {
    var corps = { data: { user_id: s.user, reason: s.r ? 'Bot de modération : ' + s.r.trouvailles.map(function (t) { return NOMS[t.famille]; })
      .filter(function (f, i, l) { return l.indexOf(f) === i; }).join(', ')
      : 'Bot de modération (ordre à la voix)' } };
    if (duree) corps.data.duration = duree;
    var r = await helix('POST', '/moderation/bans?broadcaster_id=' + chaine.id + '&moderator_id=' + moi.id, corps);
    marquer(s, r.code === 200 ? (duree ? '⏱ exclu ' + Math.round(duree / 60) + ' min' : '⛔ banni') : '✗ refusé (' + r.code + ')');
    if (r.code === 200) parlerApres(duree ? 'exclu' : 'banni', s);
  }

  // ── 10/10 : LE BOT PARLE dans le chat ─────────────────────────────────────────────────────────────────────
  // Seulement avec son PROPRE compte (jamais sous le nom du streamer), le droit d'écrire, et un ton qui n'est pas « muet ».
  // Les COMMANDES (étape 2) répondent même en « muet » : c'est le streamer qui les a choisies, et un spectateur les demande.
  function peutParler(commande) {
    return !!(moi && chaine && chaine.id !== moi.id && (commande || reglages.ton !== 'muet') && aLaPortee('user:write:chat'));
  }
  var fileParole = [], envoyes = [], dernierEnvoi = 0, minuterieParole = null, dits = [];
  function parler(texte, commande) {
    if (!texte || !peutParler(commande)) return false;
    // jamais une commande de chat (« /ban », « .timeout ») en tête : un {cible} tapé par un spectateur ne doit rien déclencher
    texte = String(texte).replace(/^[\s\/.\\]+/, '');
    if (!texte) return false;
    fileParole.push(texte.slice(0, 450));
    if (fileParole.length > 5) fileParole.splice(0, fileParole.length - 5);   // en rafale, les plus anciennes tombent
    pousserParole();
    return true;
  }
  function pousserParole() {
    clearTimeout(minuterieParole);
    if (!fileParole.length) return;
    var maintenant = Date.now();
    envoyes = envoyes.filter(function (t) { return maintenant - t < 30000; });
    var attendre = Math.max(dernierEnvoi + PAROLE_ECART_MS - maintenant, envoyes.length >= PAROLE_MAX_30S ? envoyes[0] + 30000 - maintenant : 0);
    if (attendre > 0) { minuterieParole = setTimeout(pousserParole, attendre); return; }
    var texte = fileParole.shift();
    dernierEnvoi = maintenant; envoyes.push(maintenant);
    helix('POST', '/chat/messages', { broadcaster_id: chaine.id, sender_id: moi.id, message: texte }).then(function (r) {
      var d = r.j && r.j.data && r.j.data[0];
      var ok = r.code === 200 && (!d || d.is_sent !== false);
      dits.unshift({ texte: texte, ok: ok, pourquoi: ok ? '' : (d && d.drop_reason && d.drop_reason.message) || ('code ' + r.code), quand: Date.now() });
      if (dits.length > 20) dits.length = 20;
      montrerDits();
    }).catch(function () {
      dits.unshift({ texte: texte, ok: false, pourquoi: 'Twitch ne répond pas', quand: Date.now() }); montrerDits();
    });
    if (fileParole.length) minuterieParole = setTimeout(pousserParole, PAROLE_ECART_MS);
  }
  function camoufle(s) {
    return !!(s && s.r && s.r.trouvailles && s.r.trouvailles.some(function (t) {
      return !FILTRES.FAMILLES[t.famille] && t.comment && t.comment !== 'en clair' && t.comment !== 'expression'; }));
  }
  function parlerApres(genre, s) {
    parler(REPLIQUES.choisir(reglages.ton, genre, { pseudo: s.pseudo, chaine: chaine.name, camoufle: camoufle(s) }));
  }
  // quelqu'un s'adresse au bot (@lebot, !bot) : une réponse, pas plus d'une toutes les 30 s par personne
  var derniersAppels = {}, dernierAppel = 0;
  function repondre(ev, texte) {
    if (!peutParler()) return;
    var genre = REPLIQUES.intention(texte, moi.login);
    if (!genre || (reglages.ton === 'sobre' && genre !== 'presentation')) return;
    var qui = ev.chatter_user_id, maintenant = Date.now();
    if (maintenant - (derniersAppels[qui] || 0) < APPEL_PAR_PERSONNE_MS || maintenant - dernierAppel < APPEL_GLOBAL_MS) return;
    derniersAppels[qui] = dernierAppel = maintenant;
    parler(REPLIQUES.choisir(reglages.ton, genre, { pseudo: ev.chatter_user_name || ev.chatter_user_login, chaine: chaine.name }));
  }
  // ── 10/10 : ÉTAPE 2 — LES COMMANDES et LES MESSAGES RÉGULIERS ────────────────────────────────────────────
  // Rem : « vas-y étape 2 les commandes ». Pas de serveur : le bot répond depuis le dock d'OBS, tant qu'OBS est ouvert.
  // Une commande perso porte le même nom qu'une intégrée ? La perso gagne (le streamer réécrit !discord à sa façon).
  var INTEGREES = {
    bot: 'se présente', commandes: 'la liste des commandes', uptime: 'depuis quand le live tourne', titre: 'le titre du live',
    jeu: 'le jeu du live', followage: 'depuis quand on te suit', discord: 'ton lien Discord', reseaux: 'tes réseaux'
  };
  if (!reglages.commandes) reglages.commandes = { actives: {}, discord: '', reseaux: '', perso: [] };
  if (!reglages.minuteurs) reglages.minuteurs = [];
  function tonCommandes() { return reglages.ton === 'taquin' ? 'taquin' : 'sobre'; }   // « muet » : des réponses sobres
  function estChef(ev, b) { return ev.chatter_user_id === chaine.id || b.indexOf('broadcaster') >= 0 || b.indexOf('moderator') >= 0; }
  function permis(qui, ev, b) {
    if (qui === 'modos') return estChef(ev, b);
    if (qui === 'abonnes') return estChef(ev, b) || ['subscriber', 'founder', 'vip'].some(function (x) { return b.indexOf(x) >= 0; });
    return true;
  }
  function integreeActive(nom) {
    var C = reglages.commandes;
    if (!INTEGREES[nom] || C.actives[nom] === false) return false;
    return !((nom === 'discord' || nom === 'reseaux') && !String(C[nom] || '').trim());   // sans lien, pas de commande
  }
  function listeCommandes() {
    var noms = Object.keys(INTEGREES).filter(integreeActive);
    reglages.commandes.perso.forEach(function (p) { if (p.nom && p.texte && (p.qui || 'tous') === 'tous' && noms.indexOf(p.nom) < 0) noms.push(p.nom); });
    if (reglages.pendu && reglages.pendu.qui === 'tous') noms.push('pendu');
    noms.push('classement');
    return noms.map(function (n) { return '!' + n; }).join(' ');
  }
  var dernierUsage = {};
  // rend true si le message était une commande du bot (on ne fait alors pas la conversation en plus)
  function commande(ev, texte, b) {
    var m = /^\s*!([^\s!]{1,25})(?:\s+([\s\S]*))?$/.exec(texte);
    if (!m) return false;
    var nom = m[1].toLowerCase(), arg = (m[2] || '').trim();
    var perso = null;
    reglages.commandes.perso.forEach(function (p) { if (p.nom === nom && String(p.texte || '').trim()) perso = p; });
    if (!perso && !integreeActive(nom)) return false;
    if (!peutParler(true)) return true;
    if (perso && !permis(perso.qui, ev, b)) return true;          // reconnue mais pas pour lui : silence
    var maintenant = Date.now();
    var cle = nom + '|' + ev.chatter_user_id;
    if (!estChef(ev, b) && (maintenant - (dernierUsage[nom] || 0) < COMMANDE_DELAI_MS
      || maintenant - (dernierUsage[cle] || 0) < COMMANDE_PERSONNE_MS)) return true;
    dernierUsage[nom] = dernierUsage[cle] = maintenant;
    var pseudo = ev.chatter_user_name || ev.chatter_user_login;
    var cible = (/^@?([A-Za-z0-9_]{2,25})\b/.exec(arg) || [])[1];
    reponseCommande(nom, perso, { pseudo: pseudo, cible: cible || pseudo, chaine: chaine.name, user: ev.chatter_user_id, ciblee: !!cible })
      .then(function (t) { if (t) parler(t, true); }).catch(function () {});
    return true;
  }
  async function infosChaine() {
    var r = await helix('GET', '/channels?broadcaster_id=' + chaine.id);
    var d = r.code === 200 && r.j.data && r.j.data[0];
    return d ? { titre: d.title || '', jeu: d.game_name || '' } : { titre: '', jeu: '' };
  }
  var cacheLive = { quand: 0, debut: null };
  async function debutDuLive() {                               // la date ISO du début du live, ou null (60 s de mémoire)
    if (Date.now() - cacheLive.quand < 60000) return cacheLive.debut;
    var r = await helix('GET', '/streams?user_id=' + chaine.id);
    var d = r.code === 200 && r.j.data && r.j.data[0];
    cacheLive = { quand: Date.now(), debut: d ? d.started_at : null };
    return cacheLive.debut;
  }
  async function reponseCommande(nom, perso, v) {
    var ton = tonCommandes();
    if (perso) {                                                 // le texte du streamer, ses {variables} remplies
      var t = perso.texte;
      if (/\{(titre|jeu)\}/.test(t)) { var i = await infosChaine(); v.titre = i.titre; v.jeu = i.jeu; }
      if (/\{uptime\}/.test(t)) { var deb = await debutDuLive(); v.uptime = deb ? REPLIQUES.duree(deb) : 'pas en live'; }
      return REPLIQUES.remplir(t, v);
    }
    if (nom === 'bot') return REPLIQUES.choisir(ton, 'presentation', v);
    if (nom === 'commandes') { v.liste = listeCommandes(); return REPLIQUES.choisir(ton, 'commandes', v); }
    if (nom === 'discord' || nom === 'reseaux') { v.lien = reglages.commandes[nom].trim(); return REPLIQUES.choisir(ton, nom, v); }
    if (nom === 'uptime') {
      var debut = await debutDuLive();
      if (!debut) return REPLIQUES.choisir(ton, 'uptime_off', v);
      v.duree = REPLIQUES.duree(debut); return REPLIQUES.choisir(ton, 'uptime', v);
    }
    if (nom === 'titre' || nom === 'jeu') {
      var info = await infosChaine();
      v.titre = info.titre; v.jeu = info.jeu;
      return REPLIQUES.choisir(ton, info[nom] ? nom : nom + '_aucun', v);
    }
    if (nom === 'followage') {
      var qui = v.user;
      if (v.ciblee) {                                           // « !followage Lili » : le pseudo écrit
        var u = await helix('GET', '/users?login=' + encodeURIComponent(v.cible.toLowerCase()));
        if (u.code !== 200 || !u.j.data || !u.j.data[0]) return null;
        qui = u.j.data[0].id; v.cible = u.j.data[0].display_name;
      }
      if (qui === chaine.id) return null;                       // le streamer ne se suit pas lui-même
      var f = await helix('GET', '/channels/followers?broadcaster_id=' + chaine.id + '&user_id=' + qui);
      if (f.code !== 200) return null;                          // pas le droit (bot pas modérateur) : silence
      var d = f.j.data && f.j.data[0];
      if (!d) return REPLIQUES.choisir(ton, 'suit_pas', v);
      v.duree = REPLIQUES.duree(d.followed_at, null, true); return REPLIQUES.choisir(ton, 'suit', v);
    }
    return null;
  }

  // Les messages réguliers : chacun à son rythme, seulement pendant le live, et seulement si le chat a bougé depuis
  // (MIN_LIGNES messages d'autres personnes) — un bot qui parle seul dans un chat vide, ça fait triste.
  var etatMinuteurs = {};                                      // id → { dernier, lignes }
  function compterLigne() { Object.keys(etatMinuteurs).forEach(function (k) { etatMinuteurs[k].lignes++; }); }
  async function tourMinuteurs(maintenant) {
    maintenant = maintenant || Date.now();
    var actifs = reglages.minuteurs.filter(function (m) { return m.actif !== false && String(m.texte || '').trim(); });
    actifs.forEach(function (m) { if (!etatMinuteurs[m.id]) etatMinuteurs[m.id] = { dernier: maintenant, lignes: 0 }; });
    var prets = actifs.filter(function (m) {
      var e = etatMinuteurs[m.id];
      return maintenant - e.dernier >= Math.max(MINUTEUR_MIN, +m.minutes || 15) * 60000 && e.lignes >= MIN_LIGNES;
    });
    if (!prets.length || !peutParler(true) || !(await debutDuLive())) return 0;
    var m = prets[0];                                          // un seul à la fois ; les autres attendent le tour suivant
    etatMinuteurs[m.id] = { dernier: maintenant, lignes: 0 };
    var t = m.texte;
    if (/\{(titre|jeu)\}/.test(t)) { var i = await infosChaine(); t = REPLIQUES.remplir(t, { chaine: chaine.name, titre: i.titre, jeu: i.jeu }); }
    else t = REPLIQUES.remplir(t, { chaine: chaine.name });
    parler(t, true);
    return 1;
  }
  setInterval(function () { if (chaine) tourMinuteurs().catch(function () {}); }, 20000);

  // ── 10/10 : ÉTAPE 3 — L'ACCUEIL ET LES REMERCIEMENTS ─────────────────────────────────────────────────────
  // Rem : « vas-y étape 3 accueil et remerciements ». Le bot lit lui-même (sans le compte du streamer) : les follows (il
  // doit être modérateur), les abonnements, cadeaux et raids (annonces du chat), les Bits (dans le message). Les arrivées
  // et les follows rapprochés sont GROUPÉS (« Bienvenue Lili, Max et Zoé ! ») ; une VAGUE de follows (des robots, souvent)
  // le fait taire 5 minutes au lieu de remercier des robots. Chaque remerciement a sa case et son texte à soi.
  var EVENEMENTS = {
    bienvenue: ['👋 Bienvenue', 'au premier message de chacun pendant le live'],
    follow: ['💜 Follow', 'merci pour un nouveau follow'],
    sub: ['⭐ Abonnement', 'merci pour un abonnement'],
    resub: ['🔁 Réabonnement', '{mois} : depuis combien de mois'],
    cadeau: ['🎁 Abonnements offerts', '{nombre} offerts, {cible} : à qui'],
    raid: ['🚀 Raid', '{spectateurs} : combien de personnes arrivent'],
    bits: ['💎 Bits', '{bits} : combien']
  };
  if (!reglages.accueil) reglages.accueil = {};
  Object.keys(EVENEMENTS).forEach(function (k) { if (!reglages.accueil[k]) reglages.accueil[k] = { on: true, texte: '' }; });
  if (reglages.accueil.raid.shoutout == null) reglages.accueil.raid.shoutout = true;
  var PLURIELS = { bienvenue: 'merci_bienvenues', follow: 'merci_follows', cadeau: 'merci_cadeaux' };
  var GROUPE_MS = 8000, VAGUE_FOLLOWS = 20, VAGUE_SILENCE_MS = 5 * 60000, SHOUTOUT_ECART_MS = 120000;
  var ecoute = { annonces: null, follows: null };              // ce que Twitch a accepté de lui envoyer
  var groupes = {}, followsRecents = [], vagueJusqua = 0, merciFollow = {}, dernierShoutout = 0;
  var vus = lire('vus', { debut: null, ids: [] });             // qui a déjà été accueilli pendant CE live
  function actif(genre) { return reglages.accueil[genre] && reglages.accueil[genre].on !== false; }
  function pluriel(n, mot) { n = +n || 0; return n + ' ' + mot + (n > 1 ? 's' : ''); }
  function nomsLisibles(noms) {
    var montres = noms.slice(0, 5), reste = noms.length - montres.length;
    if (reste > 0) return montres.join(', ') + ' et ' + pluriel(reste, 'autre');
    return montres.length > 1 ? montres.slice(0, -1).join(', ') + ' et ' + montres[montres.length - 1] : montres[0];
  }
  function remercier(genre, v, n) {
    if (!peutParler(true)) return false;
    v.chaine = chaine.name;
    var perso = String(reglages.accueil[genre].texte || '').trim();
    var cle = (n || 1) > 1 && PLURIELS[genre] ? PLURIELS[genre] : 'merci_' + genre;
    var t = perso ? REPLIQUES.remplir(perso, v) : REPLIQUES.choisir(tonCommandes(), cle, v);
    return parler(t, true);
  }
  function grouper(genre, pseudo) {
    var g = groupes[genre] || (groupes[genre] = { noms: [], minuterie: null });
    if (g.noms.indexOf(pseudo) < 0) g.noms.push(pseudo);
    if (!g.minuterie) g.minuterie = setTimeout(function () {
      var noms = g.noms; g.noms = []; g.minuterie = null;
      remercier(genre, { pseudo: nomsLisibles(noms) }, noms.length);
    }, GROUPE_MS);
  }
  async function accueillir(ev) {
    if (!actif('bienvenue') || ev.chatter_user_id === chaine.id || ev.chatter_user_id === moi.id || !peutParler(true)) return;
    var debut = await debutDuLive();
    if (!debut) return;                                        // hors live : personne à accueillir
    if (vus.debut !== debut) vus = { debut: debut, ids: [] };  // un nouveau live : tout le monde est nouveau
    if (vus.ids.indexOf(ev.chatter_user_id) >= 0) return;
    vus.ids.push(ev.chatter_user_id);
    if (vus.ids.length > 5000) vus.ids.splice(0, 1000);
    ecrire('vus', vus);
    grouper('bienvenue', ev.chatter_user_name || ev.chatter_user_login);
  }
  function suivi(ev) {
    var maintenant = Date.now();
    followsRecents = followsRecents.filter(function (t) { return maintenant - t < 60000; });
    followsRecents.push(maintenant);
    if (followsRecents.length > VAGUE_FOLLOWS) {
      vagueJusqua = maintenant + VAGUE_SILENCE_MS;
      var g = groupes.follow;                                  // le merci groupé en attente partait pour des robots : annulé
      if (g) { clearTimeout(g.minuterie); g.minuterie = null; g.noms = []; }
    }
    montrerAccueil();
    if (!actif('follow') || maintenant < vagueJusqua) return;
    if (merciFollow[ev.user_id]) return;                      // suivre, ne plus suivre, re-suivre : un seul merci
    merciFollow[ev.user_id] = 1;
    grouper('follow', ev.user_name || ev.user_login);
  }
  function remercierBits(ev) {
    if (!actif('bits')) return;
    remercier('bits', { pseudo: ev.chatter_user_name || ev.chatter_user_login, bits: pluriel(ev.cheer.bits, 'bit') });
  }
  function annonce(ev) {
    var t = ev.notice_type, qui = ev.chatter_is_anonymous ? 'Anonyme' : (ev.chatter_user_name || ev.chatter_user_login);
    if ((t === 'sub' || t === 'gift_paid_upgrade' || t === 'prime_paid_upgrade') && actif('sub')) return remercier('sub', { pseudo: qui });
    if (t === 'resub' && actif('resub')) {
      var r = ev.resub || {};
      return remercier('resub', { pseudo: qui, mois: r.cumulative_months || r.duration_months || 1 });
    }
    if (t === 'sub_gift' && actif('cadeau')) {
      if (ev.sub_gift && ev.sub_gift.community_gift_id) return;   // une part d'un lot : le lot entier est remercié une fois
      return remercier('cadeau', { pseudo: qui, nombre: 1, cible: (ev.sub_gift && ev.sub_gift.recipient_user_name) || '' });
    }
    if (t === 'community_sub_gift' && actif('cadeau')) {
      var n = (ev.community_sub_gift && ev.community_sub_gift.total) || 1;
      return remercier('cadeau', { pseudo: qui, nombre: n, cible: '' }, n);
    }
    if (t === 'raid' && actif('raid') && ev.raid) {
      remercier('raid', { pseudo: ev.raid.user_name || ev.raid.user_login || qui, spectateurs: pluriel(ev.raid.viewer_count, 'personne') });
      if (reglages.accueil.raid.shoutout) shoutout(ev.raid.user_id);
    }
  }
  async function shoutout(id) {                                // Twitch : 2 min entre deux, 1 h pour la même chaîne
    if (!id || Date.now() - dernierShoutout < SHOUTOUT_ECART_MS) return;
    dernierShoutout = Date.now();
    await helix('POST', '/chat/shoutouts?from_broadcaster_id=' + chaine.id + '&to_broadcaster_id=' + id + '&moderator_id=' + moi.id);
  }
  function montrerAccueil() {
    var e = $('accueil-etat');
    if (!e) return;
    var t = [], bien = true;
    if (Date.now() < vagueJusqua) { t.push('⚠ Vague de follows (des robots ?) : pas de merci pendant 5 minutes.'); bien = false; }
    if (ecoute.follows === false) { t.push('⚠ Les follows ne lui arrivent pas : le bot doit être modérateur (/mod ' + (moi ? moi.login : 'lebot') + '), puis recharge le dock.'); bien = false; }
    if (ecoute.annonces === false) { t.push('⚠ Les abonnements et les raids ne lui arrivent pas : reconnecte le bot.'); bien = false; }
    if (!t.length && ecoute.follows) t.push('✓ Il voit les follows, les abonnements, les raids et les Bits.');
    e.textContent = t.join(' '); e.className = bien ? 'ok' : 'doux';
  }
  function dessinerAccueil() {
    var z = $('accueil');
    z.textContent = '';
    Object.keys(EVENEMENTS).forEach(function (genre) {
      var g = reglages.accueil[genre], bloc = document.createElement('div'); bloc.className = 'cmd';
      var haut = document.createElement('label'); haut.className = 'ligne';
      var c = champ('checkbox', g.on !== false);
      c.onchange = function () { g.on = c.checked; sauverCommandes(); };
      var s = document.createElement('span'); s.innerHTML = '<b>' + EVENEMENTS[genre][0] + '</b> <span class="doux">— ' + EVENEMENTS[genre][1] + '</span>';
      haut.append(c, s);
      var exemple = (REPLIQUES.TAQUIN['merci_' + genre] || [''])[0];
      var texte = champ('text', g.texte, { placeholder: 'Ton texte (sinon : « ' + exemple + ' »)' });
      texte.oninput = function () { g.texte = texte.value; sauverCommandes(); };
      bloc.append(haut, texte);
      if (genre === 'raid') {
        var l = document.createElement('label'); l.className = 'ligne';
        var so = champ('checkbox', g.shoutout !== false);
        so.onchange = function () { g.shoutout = so.checked; sauverCommandes(); };
        var st = document.createElement('span'); st.textContent = 'Mettre sa chaîne en avant (/shoutout)';
        l.append(so, st); bloc.appendChild(l);
      }
      z.appendChild(bloc);
    });
    montrerAccueil();
  }

  // ── 10/10 : ÉTAPE 4 — LE PENDU DANS LE CHAT ──────────────────────────────────────────────────────────────
  // Rem : « GO PENDU » (puis « tu écris le cœur du jeu alors qu'on l'a déjà ? » → on reprend les points et le dessin de
  // pendable.html, les niveaux de mot-difficile-pendu.html ; seul le branchement au chat est neuf). Le bot choisit le mot,
  // le chat tape UNE lettre (ou le mot entier), le bot écrit l'état (groupé toutes les 2,5 s) ; le plateau d'OBS
  // (pendu.html) le redessine en lisant ces messages. Le streamer, qui voit le mot dans son dock, ne joue pas.
  if (!reglages.pendu) reglages.pendu = {};
  [['niveau', 'facile'], ['erreurs', 8], ['qui', 'modos'], ['relance', false], ['mesMots', ''], ['seulementMesMots', false], ['streamerJoue', true]]
    .forEach(function (d) { if (reglages.pendu[d[0]] == null) reglages.pendu[d[0]] = d[1]; });
  var PENDU_GROUPE_MS = 2500, PENDU_COUP_MS = 4000, PENDU_SOMMEIL_MS = 5 * 60000, PENDU_RELANCE_MS = 30000, PENDU_RAPPEL_MS = 10000;
  var partie = null, tamponPendu = [], minuteriePendu = null, relancePendu = null, dernierCoup = {}, recentsMots = [], dernierRappel = 0;
  var scores = lire('pendu.scores', {});                       // login → { pseudo, points }
  function motPropre(m) { return String(m || '').trim().toLowerCase(); }
  function mesMots() {
    return reglages.pendu.mesMots.split(/[\n,;]+/).map(motPropre).filter(function (m) { return /^[a-zàâäçéèêëîïôöùûüÿœæ]{3,20}$/.test(m); });
  }
  function motsPendu() {
    var P = reglages.pendu, mes = mesMots();
    if (P.seulementMesMots && mes.length) return mes;
    var base = P.niveau === 'melange' ? PENDU_MOTS.facile.concat(PENDU_MOTS.moyen, PENDU_MOTS.dur) : (PENDU_MOTS[P.niveau] || PENDU_MOTS.facile);
    return mes.length ? base.concat(mes, mes, mes) : base;    // tes mots : trois fois plus de chances de sortir
  }
  function lancerPendu() {
    if ((partie && !partie.fin) || !peutParler(true)) return false;
    clearTimeout(relancePendu);
    var l = motsPendu().filter(function (m) { return recentsMots.indexOf(m) < 0; });
    if (!l.length) l = motsPendu();
    var mot = l[Math.floor(Math.random() * l.length)];
    recentsMots.push(mot); if (recentsMots.length > 50) recentsMots.shift();
    partie = PENDU.nouvelle(mot, Math.max(4, Math.min(12, +reglages.pendu.erreurs || 8)));
    tamponPendu = []; dernierCoup = {};
    parler(PENDU.ligneEtat(partie, REPLIQUES.choisir(tonCommandes(), 'pendu_debut', { n: mot.length })), true);
    dessinerPartie();
    return true;
  }
  function viderTampon() {                                     // les coups des 2,5 dernières secondes : un seul message
    clearTimeout(minuteriePendu); minuteriePendu = null;
    if (!partie || partie.fin || !tamponPendu.length) return;
    var suite = tamponPendu.slice(-8).join(' · ');
    tamponPendu = [];
    parler(PENDU.ligneEtat(partie, suite), true);
  }
  function noter(evenement) {
    tamponPendu.push(evenement);
    if (!minuteriePendu) minuteriePendu = setTimeout(viderTampon, PENDU_GROUPE_MS);
    dessinerPartie();
  }
  function finirPendu(quoi, qui, points, genre) {
    if (!partie) return;
    clearTimeout(minuteriePendu); minuteriePendu = null; tamponPendu = [];
    if (!partie.fin) partie.fin = quoi === 'gagnee' ? 'gagnee' : quoi === 'perdue' ? 'perdue' : 'arretee';
    var suite = REPLIQUES.choisir(tonCommandes(), genre || ('pendu_' + (quoi === 'gagnee' ? 'gagne' : quoi === 'perdue' ? 'perdu' : 'arrete')), {});
    if (reglages.pendu.relance && quoi !== 'arretee') {
      suite += ' Prochaine partie dans ' + Math.round(PENDU_RELANCE_MS / 1000) + ' s.';
      relancePendu = setTimeout(lancerPendu, PENDU_RELANCE_MS);
    }
    parler(PENDU.ligneFin(partie, quoi, qui, points, suite), true);
    dessinerPartie();
  }
  function ajouterPoints(ev, pts) {
    var login = (ev.chatter_user_login || '').toLowerCase();
    var s = scores[login] || (scores[login] = { pseudo: ev.chatter_user_name || login, points: 0 });
    s.points += pts; s.pseudo = ev.chatter_user_name || s.pseudo;
    ecrire('pendu.scores', scores);
    dessinerClassement();
  }
  function premiers(n) {
    return Object.keys(scores).map(function (k) { return scores[k]; }).filter(function (s) { return s.points > 0; })
      .sort(function (a, b) { return b.points - a.points; }).slice(0, n);
  }
  // rend true si le message appartenait au pendu (on ne le traite alors pas comme une commande ou une conversation)
  function jouerPendu(ev, texte, b) {
    var t = String(texte || '').trim(), bas = t.toLowerCase(), maintenant = Date.now();
    if (/^!pendu\b/.test(bas)) {
      if (partie && !partie.fin) {                             // une partie tourne : on la rappelle
        if (maintenant - dernierRappel >= PENDU_RAPPEL_MS || estChef(ev, b)) { dernierRappel = maintenant; parler(PENDU.ligneEtat(partie), true); }
      } else if (reglages.pendu.qui === 'tous' || estChef(ev, b)) lancerPendu();
      return true;
    }
    if (/^!(classement|top)\b/.test(bas)) {
      if (maintenant - dernierRappel < PENDU_RAPPEL_MS && !estChef(ev, b)) return true;
      dernierRappel = maintenant;
      var top = premiers(5);
      parler(top.length ? REPLIQUES.choisir(tonCommandes(), 'pendu_classement', { liste: top.map(function (s, i) { return (i + 1) + '. ' + s.pseudo + ' ' + s.points; }).join(' · ') })
        : REPLIQUES.choisir(tonCommandes(), 'pendu_vide', {}), true);
      return true;
    }
    // le streamer joue aussi (Rem, 10/10 : « je veux jouer aussi ») ; le mot reste flouté dans son dock — case pour l'exclure
    if (!partie || partie.fin || (ev.chatter_user_id === chaine.id && !reglages.pendu.streamerJoue)) return false;
    var qui = ev.chatter_user_name || ev.chatter_user_login;
    var m = /^(?:!l(?:ettre)?\s+)?([a-zàâäçéèêëîïôöùûüÿ])$/i.exec(t);
    if (m) {
      if (maintenant - (dernierCoup[ev.chatter_user_id] || 0) < PENDU_COUP_MS) return true;   // une lettre toutes les 4 s chacun
      var r = PENDU.proposer(partie, m[1]);
      if (r.quoi === 'deja' || r.quoi === 'invalide') return true;
      dernierCoup[ev.chatter_user_id] = maintenant;
      var L = PENDU.nu(m[1]).toUpperCase();
      if (r.quoi === 'bonne') {
        var pts = PENDU.pointsLettre(partie, m[1], r.n);
        ajouterPoints(ev, pts);
        if (partie.fin === 'gagnee') finirPendu('gagnee', qui, pts); else noter('✅ ' + qui + ' : ' + L);
      } else if (partie.fin === 'perdue') finirPendu('perdue');
      else noter('❌ ' + qui + ' : ' + L);
      return true;
    }
    var mot = t.replace(/^!mot\s+/i, '');
    if (/^[a-zàâäçéèêëîïôöùûüÿœæ]+$/i.test(mot) && PENDU.nu(mot).length === partie.cle.length) {
      var gagnes = PENDU.deviner(partie, mot);
      if (gagnes) { ajouterPoints(ev, gagnes); finirPendu('gagnee', qui, gagnes); return true; }
    }
    return /^!mot\s/i.test(t);                                  // « !mot xxx » faux : rien, mais ce n'est pas une conversation
  }
  setInterval(function () {                                    // personne ne joue depuis 5 min : on range la partie
    if (partie && !partie.fin && Date.now() - partie.dernier > PENDU_SOMMEIL_MS) finirPendu('arretee', '', 0, 'pendu_sommeil');
  }, 20000);

  // le dock : la partie (le mot, visible d'un clic), les boutons, les réglages, le classement, l'adresse du plateau
  function dessinerPartie() {
    var z = $('pendu-partie');
    if (!z) return;
    var enCours = partie && !partie.fin;
    $('pendu-masque').textContent = partie ? PENDU.masque(partie, !!partie.fin) : '—';
    $('pendu-info').textContent = !partie ? 'Pas de partie.' : (enCours ? '❌ ' + partie.erreurs + '/' + partie.max
      + (partie.ratees.length ? ' · ' + partie.ratees.join(' ').toUpperCase() : '') : ({ gagnee: '🏆 trouvé', perdue: '💀 perdu', arretee: '⏹ arrêté' })[partie.fin]);
    $('pendu-mot').textContent = partie ? partie.mot.toUpperCase() : '';
    $('pendu-lancer').disabled = enCours || !peutParler(true);
    $('pendu-indice').disabled = !enCours;
    $('pendu-arreter').disabled = !enCours;
  }
  function dessinerClassement() {
    var ul = $('pendu-classement');
    if (!ul) return;
    ul.textContent = '';
    var top = premiers(5);
    top.forEach(function (s, i) { var li = document.createElement('li'); li.textContent = (i + 1) + '. ' + s.pseudo + ' — ' + s.points + ' pts'; ul.appendChild(li); });
    if (!top.length) { var li = document.createElement('li'); li.className = 'doux'; li.textContent = 'Personne n\'a encore de points.'; ul.appendChild(li); }
  }
  function adressePlateau() {
    var base = location.origin + location.pathname.replace(/[^/]*$/, '');
    return base + 'pendu.html?chaine=' + encodeURIComponent(chaine ? chaine.login : '') + '&bot=' + encodeURIComponent(moi ? moi.login : '');
  }
  function dessinerReglagesPendu() {
    var P = reglages.pendu;
    $('pendu-niveau').value = P.niveau; $('pendu-erreurs').value = P.erreurs; $('pendu-qui').value = P.qui;
    $('pendu-relance').checked = !!P.relance; $('pendu-mes-mots').value = P.mesMots; $('pendu-seulement').checked = !!P.seulementMesMots;
    $('pendu-streamer').checked = P.streamerJoue !== false;
    dessinerPartie(); dessinerClassement();
  }
  ['pendu-niveau', 'pendu-erreurs', 'pendu-qui', 'pendu-relance', 'pendu-seulement', 'pendu-streamer'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      var P = reglages.pendu;
      P.niveau = $('pendu-niveau').value; P.qui = $('pendu-qui').value;
      P.erreurs = Math.max(4, Math.min(12, Math.round(+$('pendu-erreurs').value) || 8)); $('pendu-erreurs').value = P.erreurs;
      P.relance = $('pendu-relance').checked; P.seulementMesMots = $('pendu-seulement').checked;
      P.streamerJoue = $('pendu-streamer').checked;
      sauverCommandes();
      if (!P.relance) clearTimeout(relancePendu);
    });
  });
  $('pendu-mes-mots').addEventListener('input', function () { reglages.pendu.mesMots = $('pendu-mes-mots').value; sauverCommandes(); });
  $('pendu-lancer').addEventListener('click', function () { lancerPendu(); });
  $('pendu-arreter').addEventListener('click', function () { if (partie && !partie.fin) finirPendu('arretee'); });
  function donnerIndice() {                                    // le bouton 💡 et « Bot, indice » : rend la lettre, ou null
    if (!partie || partie.fin) return null;
    var l = PENDU.indice(partie);
    if (l) { noter('💡 Indice : ' + l.toUpperCase()); viderTampon(); }
    return l;
  }
  $('pendu-indice').addEventListener('click', donnerIndice);
  $('pendu-voir').addEventListener('click', function () { $('pendu-mot').classList.toggle('cache'); });
  $('pendu-zero').addEventListener('click', function () {
    if (!confirm('Remettre le classement du pendu à zéro ?')) return;
    scores = {}; ecrire('pendu.scores', scores); dessinerClassement();
  });
  $('pendu-plateau').addEventListener('click', function () {
    var a = adressePlateau(), fait = function () { $('pendu-plateau-etat').textContent = '✓ Copiée : ' + a; };
    try { navigator.clipboard.writeText(a).then(fait, function () { $('pendu-plateau-etat').textContent = a; }); }
    catch (e) { $('pendu-plateau-etat').textContent = a; }
  });

  // ── les réglages des commandes et des messages réguliers, dans le dock ──
  function nomPropre(n) { return String(n || '').toLowerCase().replace(/^!+/, '').replace(/\s+/g, '').slice(0, 25); }
  function sauverCommandes() { ecrire('reglages', reglages); }
  function champ(type, valeur, attrs) {
    var e = document.createElement(type === 'select' ? 'select' : 'input');
    if (type !== 'select') e.type = type;
    Object.keys(attrs || {}).forEach(function (k) { e[k] = attrs[k]; });
    if (type === 'checkbox') e.checked = !!valeur; else if (valeur != null) e.value = valeur;
    return e;
  }
  function bouton(texte, titre, faire) {
    var bt = document.createElement('button'); bt.className = 'petit'; bt.textContent = texte; bt.title = titre; bt.onclick = faire; return bt;
  }
  function dessinerCommandes() {
    var C = reglages.commandes, z = $('cmd-integrees');
    z.textContent = '';
    Object.keys(INTEGREES).forEach(function (nom) {
      var l = document.createElement('label'); l.className = 'ligne';
      var c = champ('checkbox', C.actives[nom] !== false);
      c.onchange = function () { C.actives[nom] = c.checked; sauverCommandes(); };
      var s = document.createElement('span'); s.innerHTML = '<b>!' + nom + '</b> <span class="doux">— ' + INTEGREES[nom] + '</span>';
      l.append(c, s); z.appendChild(l);
    });
    $('cmd-discord').value = C.discord || ''; $('cmd-reseaux').value = C.reseaux || '';
    var p = $('cmd-perso');
    p.textContent = '';
    C.perso.forEach(function (cmd, i) {
      var bloc = document.createElement('div'); bloc.className = 'cmd';
      var haut = document.createElement('div'); haut.className = 'ligne';
      var nom = champ('text', cmd.nom, { placeholder: 'nom', className: 'cmd-nom', spellcheck: false });
      nom.onchange = function () { cmd.nom = nomPropre(nom.value); nom.value = cmd.nom; sauverCommandes(); };
      var qui = champ('select');
      [['tous', 'tout le monde'], ['abonnes', 'abonnés et VIP'], ['modos', 'toi et tes modos']].forEach(function (o) {
        var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; qui.appendChild(op);
      });
      qui.value = cmd.qui || 'tous';
      qui.onchange = function () { cmd.qui = qui.value; sauverCommandes(); };
      var bang = document.createElement('b'); bang.textContent = '!';
      haut.append(bang, nom, qui, bouton('🗑', 'Supprimer cette commande', function () { C.perso.splice(i, 1); sauverCommandes(); dessinerCommandes(); }));
      var texte = champ('text', cmd.texte, { placeholder: 'Ce que le bot répond (ex. Câlin de {pseudo} pour {cible} 🤗)' });
      texte.oninput = function () { cmd.texte = texte.value; sauverCommandes(); };
      bloc.append(haut, texte); p.appendChild(bloc);
    });
    var mz = $('minuteurs');
    mz.textContent = '';
    reglages.minuteurs.forEach(function (m, i) {
      var bloc = document.createElement('div'); bloc.className = 'cmd';
      var texte = champ('text', m.texte, { placeholder: 'ex. Suivez la chaîne pour ne rien rater ! 💜' });
      texte.oninput = function () { m.texte = texte.value; sauverCommandes(); };
      var bas = document.createElement('div'); bas.className = 'ligne';
      var actif = champ('checkbox', m.actif !== false);
      actif.onchange = function () { m.actif = actif.checked; sauverCommandes(); };
      var min = champ('number', m.minutes || 15, { min: MINUTEUR_MIN, max: 240, className: 'cmd-min' });
      min.onchange = function () { m.minutes = Math.max(MINUTEUR_MIN, Math.min(240, Math.round(+min.value) || 15)); min.value = m.minutes; sauverCommandes(); };
      var a = document.createElement('span'); a.textContent = 'toutes les';
      var b2 = document.createElement('span'); b2.textContent = 'min';
      var sp = document.createElement('span'); sp.style.flex = '1';
      bas.append(actif, a, min, b2, sp, bouton('🗑', 'Supprimer ce message', function () { reglages.minuteurs.splice(i, 1); sauverCommandes(); dessinerCommandes(); }));
      bloc.append(texte, bas); mz.appendChild(bloc);
    });
  }
  $('cmd-discord').addEventListener('input', function () { reglages.commandes.discord = $('cmd-discord').value; sauverCommandes(); });
  $('cmd-reseaux').addEventListener('input', function () { reglages.commandes.reseaux = $('cmd-reseaux').value; sauverCommandes(); });
  $('cmd-ajouter').addEventListener('click', function () { reglages.commandes.perso.push({ nom: '', texte: '', qui: 'tous' }); sauverCommandes(); dessinerCommandes(); });
  $('min-ajouter').addEventListener('click', function () {
    reglages.minuteurs.push({ id: 'm' + Date.now().toString(36), texte: '', minutes: 15, actif: true }); sauverCommandes(); dessinerCommandes();
  });

  // ce que le dock montre de la parole : pourquoi il se tait, ou ses dernières répliques
  function montrerParole() {
    var e = $('parole-etat');
    if (!e) return;
    var t, bien = false;
    if (!moi) t = 'Connecte le compte du bot pour qu\'il parle.';
    else if (!chaine) t = 'Écris le nom de ta chaîne.';
    else if (chaine.id === moi.id) t = '🤐 Connecté avec le compte de la chaîne : le bot ne parle pas sous ton nom. Pour qu\'il parle, connecte le compte du bot.';
    else if (!aLaPortee('user:write:chat')) t = '🤐 Le bot n\'a pas encore le droit d\'écrire : clique « Se déconnecter », puis reconnecte-le.';
    else if (reglages.ton === 'muet') t = '🤐 Muet : aucun commentaire ; il répond seulement aux commandes, aux messages réguliers et aux remerciements (sobres).';
    else if (chaine.mod === false) t = '⚠ ' + moi.name + ' n\'est pas modérateur de ' + chaine.name + ' : dans ton chat, tape /mod ' + moi.login;
    else { t = '💬 ' + moi.name + ' parle dans le chat de ' + chaine.name + ' (' + (reglages.ton === 'sobre' ? 'sobre' : 'taquin') + ').'; bien = true; }
    e.textContent = t; e.className = bien ? 'ok' : 'doux';
    $('bonjour').disabled = !peutParler();
  }
  function montrerDits() {
    var ul = $('dits');
    if (!ul) return;
    ul.textContent = '';
    dits.slice(0, 5).forEach(function (d) {
      var li = document.createElement('li');
      li.className = d.ok ? '' : 'refuse';
      li.textContent = (d.ok ? '💬 ' : '✗ ') + d.texte + (d.ok ? '' : ' — refusé par Twitch : ' + d.pourquoi);
      ul.appendChild(li);
    });
  }
  $('bonjour').addEventListener('click', function () {
    if (!parler(REPLIQUES.choisir(reglages.ton, 'bonjour', { chaine: chaine && chaine.name }))) montrerParole();
  });

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
      if (moi && chaine && !s.fait) {
        var a = document.createElement('div'); a.className = 'actions';
        [['🧹 Effacer', function () { effacer(s); }], ['⏱ 10 min', function () { exclure(s, EXCLUSION_S); }],
         ['⛔ Bannir', function () { if (confirm('Bannir ' + s.pseudo + ' ?')) exclure(s, 0); }],
         ['✓ Pas grave', function () { marquer(s, 'laissé'); }]]
          // « autoriser » un mot : jamais pour une menace (on n'autorise pas « va te suicider » d'un clic)
          .concat(s.r.gravite === 'menace' || s.r.gravite === 'majuscules' || s.r.gravite === 'spam' ? []
            // un lien : on autorise le SITE (youtube.com…), pas un mot
            : s.r.gravite === 'lien' ? [['➕ Autoriser le site « ' + s.r.trouvailles[0].mot + ' »', function () {
              reglages.filtres.sites.push(s.r.trouvailles[0].mot); ecrire('reglages', reglages); dessinerReglages(); marquer(s, 'site autorisé'); }]]
            : [['➕ Autoriser « ' + s.r.trouvailles[0].mot + ' »', function () {
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
    if (!moi || !chaine) { dire('🎙 « ' + c.texte + ' » : connecte d\'abord Twitch.'); return 'pas connecté'; }
    var a = c.action, cible = c.cible || { dernier: true };
    if (a === 'annuler') { var avait = !!enAttente; enAttente = null; montrerAttente(); dire('🎙 Annulé.', true); return avait ? 'annulé' : 'rien'; }
    if (a === 'confirmer') {
      if (!enAttente || Date.now() >= enAttente.fin) { enAttente = null; montrerAttente(); dire('🎙 Rien à confirmer.'); return 'rien'; }
      var b = enAttente.s; enAttente = null; montrerAttente();
      await exclure(b, 0); dire('🎙 ' + b.pseudo + ' : ' + (b.fait || '…'), true); return 'banni';
    }
    if (a === 'bouclier' || a === 'fin_bouclier') {
      var rb = await helix('PUT', '/moderation/shield_mode?broadcaster_id=' + chaine.id + '&moderator_id=' + moi.id, { is_active: a === 'bouclier' });
      dire(rb.code === 200 ? (a === 'bouclier' ? '🛡 Mode bouclier allumé.' : '🛡 Mode bouclier éteint.') : refus(rb), rb.code === 200);
      return a;
    }
    // 4.04 — Rem : « Bot, pendu » et « Bot, indice » (et « Bot, fin du pendu »)
    if (a === 'pendu') {
      if (partie && !partie.fin) { parler(PENDU.ligneEtat(partie), true); dire('🎯 Une partie tourne déjà : je la rappelle dans le chat.', true); return 'rappel'; }
      if (!lancerPendu()) { dire('🎯 Le pendu écrit dans le chat : il faut le compte du bot (pas le tien) pour le lancer.'); return 'impossible'; }
      dire('🎯 Nouvelle partie de pendu lancée.', true); return 'pendu';
    }
    if (a === 'indice') {
      var l = donnerIndice();
      dire(l ? '💡 Indice donné : ' + l.toUpperCase() : '💡 Pas d\'indice : aucune partie, ou il ne reste qu\'une lettre.', !!l);
      return l ? 'indice' : 'rien';
    }
    if (a === 'fin_pendu') {
      if (!partie || partie.fin) { dire('🎯 Aucune partie en cours.'); return 'rien'; }
      finirPendu('arretee'); dire('🎯 Partie arrêtée : le mot est donné dans le chat.', true); return 'fin_pendu';
    }
    if (a === 'lent' || a === 'fin_lent') {
      var rl = await helix('PATCH', '/chat/settings?broadcaster_id=' + chaine.id + '&moderator_id=' + moi.id,
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
  // 10/10 : « connecter » pose un faux compte (le bot) et une fausse chaîne, comme après une vraie connexion
  function faux() { if (!moi) moi = { id: '0', login: 'test', name: 'test' }; if (!chaine) chaine = { id: moi.id, login: moi.login, name: moi.name, mod: true }; if (!jeton) jeton = { access: 'test' }; }
  window.__bot = { traiter: function (ev) { faux(); traiter(ev); }, liste: function () { return liste; },
    reglages: function () { return reglages; }, ordre: function (c) { faux(); return ordre(c); },
    recents: function () { return recents; }, outil: function () { return outil; }, enAttente: function () { return enAttente; },
    connecter: function (m, c, portees) { moi = m; chaine = c; jeton = { access: 'test', portees: portees || PORTEES }; montrerParole(); },
    dits: function () { return dits; }, peutParler: peutParler, verifierMod: function () { return verifierMod().then(function () { montrerParole(); return chaine.mod; }); },
    tourMinuteurs: function (t) { return tourMinuteurs(t); }, oublierLive: function () { cacheLive.quand = 0; },
    redessinerCommandes: function () { dessinerCommandes(); },
    annonce: function (ev) { return annonce(ev); }, suivi: function (ev) { suivi(ev); }, groupeMs: function (ms) { GROUPE_MS = ms; },
    ecoute: function () { return ecoute; }, vus: function () { return vus; },
    partie: function () { return partie; }, lancerPendu: function () { return lancerPendu(); }, scores: function () { return scores; },
    penduGroupeMs: function (ms) { PENDU_GROUPE_MS = ms; }, adressePlateau: function () { return adressePlateau(); } };

  dessinerReglages();
  dessiner();
  dessinerCommandes();
  dessinerAccueil();
  dessinerReglagesPendu();
  montrerParole();
  if (jeton && jeton.access) demarrer();
  if (reglages.voix) chercherOutil();
})();
