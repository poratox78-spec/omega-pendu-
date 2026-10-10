/* LES RÉPLIQUES DU BOT (10/10/2026) — ce qu'il écrit dans le chat. Décision de Rem : « compte bot à part, ton taquin ».
 *
 * Taquin : il chambre, gentiment — jamais d'insulte, jamais le mot fautif répété dans le chat, jamais de moquerie sur la
 * façon d'écrire (une faute n'est pas un crime : le bot sert aussi des personnes dys).
 * Sobre : une phrase courte et neutre après une action ; il ne répond qu'à « !bot ».
 * Muet : rien dans le chat.
 * {pseudo} = la personne visée ; {chaine} = le nom de la chaîne. Une réplique n'est jamais tirée deux fois de suite.
 *
 *   REPLIQUES.choisir('taquin', 'efface', { pseudo: 'Kevin' }) → « 🧹 Petit coup de balai sur le message de Kevin… »
 */
var REPLIQUES = (function () {
  var TAQUIN = {
    efface: [
      '🗑️ Message envoyé à la corbeille, {pseudo}. Même elle a hésité.',
      '🧹 Petit coup de balai sur le message de {pseudo}. On reste poli, on garde ses dents.',
      '{pseudo}, ton message est parti en vacances. Sans billet retour. 🏝️',
      'Oups, {pseudo}, ton message a glissé. Tout seul. Je n\'y suis pour rien. 😇',
      '{pseudo}, on reformule avec des mots gentils ? Je t\'attends. ☕'
    ],
    exclu: [
      '{pseudo} part réfléchir 10 minutes. Prends un goûter, ça ira mieux. 🍪',
      '⏱️ {pseudo} est au coin pour 10 minutes. Le coin est confortable, promis.',
      '{pseudo}, pause de 10 minutes. Profites-en pour boire de l\'eau. 💧',
      '10 minutes de silence pour {pseudo}. Le chat respire. 🌬️'
    ],
    banni: [
      '🚪 {pseudo} a trouvé la sortie. On ne raccompagne pas.',
      '{pseudo} nous quitte. Il n\'y aura pas de pot de départ. 👋',
      '⛔ {pseudo} est banni. Le chat retrouve son calme habituel (enfin, presque).'
    ],
    // une insulte CAMOUFLÉE (k o n, c0nnard, konar…) : il le fait remarquer — c'est ce que les autres bots ne voient pas
    camoufle: [
      'Bien essayé de camoufler, {pseudo}, mais je lis entre les lettres. 🔍',
      '{pseudo}, les espaces et les chiffres, ça ne me trompe pas. J\'ai fait des études. 🤓',
      'Joli déguisement, {pseudo}. Je l\'ai reconnu quand même. 🥸'
    ],
    appel: [
      'Oui, {pseudo} ? Je surveille, je ne dors jamais. 👀',
      '{pseudo}, je suis là. Toujours. C\'est un peu mon problème. 🤖',
      'On m\'a appelé ? Ah, c\'est toi {pseudo}. Bon, d\'accord. 😏',
      '{pseudo}, je suis un bot, pas un psy. Mais je t\'écoute. 🛋️',
      'Présent ! {pseudo}, tu voulais un autographe ? ✍️'
    ],
    salut: [
      'Salut {pseudo} ! Sois sage, je regarde. 😇',
      'Coucou {pseudo} ! Installe-toi, les chips sont au fond. 🍿',
      'Bonjour {pseudo} ! Le chat est plus beau quand tu arrives. Enfin, presque. 😏'
    ],
    merci: [
      'De rien {pseudo}, c\'est mon métier. Et je ne suis même pas payé. 🤖',
      'Avec plaisir, {pseudo}. Je te note dans mon carnet des gens sympas. 📒'
    ],
    presentation: [
      'Je suis le bot de {chaine} : je surveille le chat, j\'efface les méchancetés (même camouflées) et je réponds quand on m\'appelle. 🤖'
    ],
    bonjour: [
      '👋 Bonjour le chat ! Je suis le bot de {chaine}. Soyez sages, je vous ai à l\'œil. 😏'
    ],
    // 10/10 — étape 2 : les réponses des commandes intégrées
    uptime: [
      'Le live tourne depuis {duree}. Et toi, tu as bu de l\'eau ? 💧',
      '{duree} de live au compteur. Personne n\'a encore craqué. 💪',
      'En direct depuis {duree}. {chaine} tient bon. 🫡'
    ],
    uptime_off: ['Pas de live en ce moment. Je garde la maison. 🏠'],
    titre: ['Le titre du live : « {titre} ». Joli, hein ? 😏', 'Titre du jour : « {titre} »'],
    titre_aucun: ['Pas de titre pour l\'instant. Le mystère reste entier. 🕵️'],
    jeu: ['Au menu : {jeu}. 🎮', 'On joue à {jeu}. Enfin, on essaie. 🎮'],
    jeu_aucun: ['Pas de jeu choisi. On improvise ! 🎲'],
    suit: ['{cible} suit {chaine} depuis {duree}. Fidèle au poste ! 🫡', '{cible} est là depuis {duree}. Une légende. 🏆'],
    suit_pas: ['{cible} ne suit pas encore {chaine}. Le bouton est juste là, je dis ça, je dis rien. 👀'],
    discord: ['Le Discord de {chaine} : {lien} — viens, il y a des cookies. 🍪'],
    reseaux: ['Retrouve {chaine} ailleurs : {lien} 📱'],
    commandes: ['Les commandes : {liste} — essaie, je ne mords pas. 😇'],
    // 10/10 — étape 3 : l'accueil et les remerciements ({pseudo} peut être une liste : « Lili, Max et Zoé »)
    merci_bienvenue: [
      'Bienvenue {pseudo} ! Installe-toi, les chips sont au fond. 🍿',
      'Salut {pseudo} ! Content de te voir. Sois sage, je regarde. 😇',
      'Tiens, {pseudo} est là ! Le chat est au complet. 👋'
    ],
    merci_bienvenues: ['Bienvenue {pseudo} ! Installez-vous, il y a de la place. 🍿', 'Salut {pseudo} ! Le chat se remplit, j\'adore. 👋'],
    merci_follow: ['Merci pour le follow, {pseudo} ! Tu as très bon goût. 💜', 'Bienvenue dans la famille, {pseudo} ! Le follow est validé. 💜'],
    merci_follows: ['Merci pour les follows, {pseudo} ! La famille s\'agrandit. 💜'],
    merci_sub: ['Merci pour l\'abonnement, {pseudo} ! Tu fais partie des légendes maintenant. 🏆',
      '{pseudo} s\'abonne ! Quelqu\'un a vu la classe ? Moi oui. ✨'],
    merci_resub: ['{pseudo} est abonné depuis {mois} mois ! La fidélité, ça se respecte. 🫡',
      '{mois} mois d\'abonnement pour {pseudo} ! On t\'a gardé ta place. 🪑'],
    merci_cadeau: ['{pseudo} offre un abonnement à {cible} ! Le Père Noël existe. 🎁'],
    merci_cadeaux: ['{pseudo} offre {nombre} abonnements ! Pluie de cadeaux sur le chat. 🎁'],
    merci_raid: ['🚀 Raid de {pseudo} avec {spectateurs} ! Bienvenue à tous, essuyez vos pieds. 😏',
      '🚀 {pseudo} débarque avec {spectateurs} ! Faites de la place, ça arrive. 🎉'],
    merci_bits: ['Merci pour les {bits}, {pseudo} ! Ça brille. 💎', '{bits} de la part de {pseudo} ! Je les range dans le coffre. 💎'],
    // 10/10 — étape 4 : le pendu (la fin du message, après « — » : la ligne d'état elle-même est fixe, cf. pendu.js)
    pendu_debut: ['Nouvelle partie ! {n} lettres. Tapez UNE lettre dans le chat. 🎯', 'Un mot de {n} lettres vous attend. À vos lettres ! 🔤'],
    pendu_gagne: ['Bravo ! Le chat est trop fort. 🎉', 'Bien joué ! Je n\'aurais pas fait mieux. 😏'],
    pendu_perdu: ['Le pendu a gagné cette fois. Revanche ? 😈', 'Perdu ! C\'était pourtant facile… non ? 😏'],
    pendu_arrete: ['Partie arrêtée. On rejoue quand vous voulez. 🎯'],
    pendu_sommeil: ['Personne ? Je range le pendu. 💤'],
    pendu_classement: ['🏆 Classement du pendu : {liste}'],
    pendu_vide: ['Personne n\'a encore de points au pendu. Ça va venir. 😏'],
    // 10/10 — étape 5 : les filtres classiques (après l'effacement) et !permit
    filtre_lien: ['{pseudo}, pas de lien sans permission. Demande à un modo ! 🔗', '🔗 Lien confisqué, {pseudo}. Un modo peut te donner un !permit.'],
    filtre_majuscules: ['{pseudo}, pas besoin de crier, on t\'entend très bien. 🔊', 'Doucement sur les MAJUSCULES, {pseudo}. Mes oreilles de robot sifflent. 🤖'],
    filtre_spam: ['{pseudo}, on a bien lu la première fois. 😉', 'Écho… écho… écho… On a compris, {pseudo}. 🔁'],
    permit: ['{cible} peut poster un lien pendant 60 secondes. Pas de bêtise ! 🔗']
  };
  var SOBRE = {
    efface: ['Message de {pseudo} retiré.'],
    exclu: ['{pseudo} exclu 10 minutes.'],
    banni: ['{pseudo} banni.'],
    presentation: ['Je suis le bot de modération de {chaine}.'],
    bonjour: ['Bonjour, je suis le bot de modération de {chaine}.'],
    uptime: ['En direct depuis {duree}.'],
    uptime_off: ['Pas de live en ce moment.'],
    titre: ['Titre du live : {titre}'],
    titre_aucun: ['Pas de titre.'],
    jeu: ['Jeu : {jeu}'],
    jeu_aucun: ['Pas de jeu choisi.'],
    suit: ['{cible} suit {chaine} depuis {duree}.'],
    suit_pas: ['{cible} ne suit pas {chaine}.'],
    discord: ['Discord : {lien}'],
    reseaux: ['Réseaux : {lien}'],
    commandes: ['Commandes : {liste}'],
    merci_bienvenue: ['Bienvenue {pseudo}.'],
    merci_follow: ['Merci pour le follow, {pseudo}.'],
    merci_follows: ['Merci pour les follows, {pseudo}.'],
    merci_sub: ['Merci pour l\'abonnement, {pseudo}.'],
    merci_resub: ['Merci {pseudo} pour ces {mois} mois d\'abonnement.'],
    merci_cadeau: ['Merci {pseudo} pour l\'abonnement offert à {cible}.'],
    merci_cadeaux: ['Merci {pseudo} pour les {nombre} abonnements offerts.'],
    merci_raid: ['Merci {pseudo} pour le raid avec {spectateurs}.'],
    merci_bits: ['Merci {pseudo} pour les {bits}.'],
    pendu_debut: ['Nouvelle partie : {n} lettres. Proposez une lettre.'],
    pendu_gagne: ['Bravo.'],
    pendu_perdu: ['Perdu.'],
    pendu_arrete: ['Partie arrêtée.'],
    pendu_sommeil: ['Partie arrêtée faute de joueurs.'],
    pendu_classement: ['Classement du pendu : {liste}'],
    pendu_vide: ['Aucun point au pendu pour l\'instant.'],
    filtre_lien: ['Lien retiré ({pseudo}).'],
    filtre_majuscules: ['Message en majuscules retiré ({pseudo}).'],
    filtre_spam: ['Message répété retiré ({pseudo}).'],
    permit: ['{cible} peut poster un lien pendant 60 secondes.']
  };
  // ce qu'on ajoute à une réplique « camouflé » selon ce qui a été fait
  var SUITE = { efface: ' Message retiré.', exclu: ' Et 10 minutes de pause.', banni: '' };

  var derniere = {};
  function remplir(t, v) {
    return t.replace(/\{(\w+)\}/g, function (tout, k) { return v && v[k] != null ? String(v[k]) : ''; });
  }
  function tirer(liste, cle, hasard) {
    if (!liste || !liste.length) return null;
    var i = Math.floor((hasard || Math.random)() * liste.length) % liste.length;
    if (liste.length > 1 && derniere[cle] === i) i = (i + 1) % liste.length;
    derniere[cle] = i;
    return liste[i];
  }
  /* ton : 'taquin' | 'sobre' | 'muet' ; genre : efface, exclu, banni, appel, salut, merci, presentation, bonjour ;
     v : { pseudo, chaine, camoufle } → le texte, ou null s'il n'y a rien à dire */
  function choisir(ton, genre, v, hasard) {
    if (ton === 'muet') return null;
    var table = ton === 'sobre' ? SOBRE : TAQUIN;
    if (ton !== 'sobre' && v && v.camoufle && SUITE[genre] != null) {
      var c = tirer(TAQUIN.camoufle, 'camoufle', hasard);
      return remplir(c, v) + SUITE[genre];
    }
    var t = tirer(table[genre], ton + genre, hasard);
    return t ? remplir(t, v) : null;
  }
  /* un message qui s'adresse au bot : 'presentation' (!bot, « t'es qui »), 'salut', 'merci', 'appel', ou null */
  function intention(texte, login) {
    var t = String(texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/^\s*!bot\b/.test(t)) return 'presentation';
    var nom = String(login || '').toLowerCase();
    if (!nom || t.indexOf('@' + nom) < 0) return null;
    if (/\b(t'?es|tu es|c'?est) qui\b|\bqui es[- ]tu\b/.test(t)) return 'presentation';
    if (/\b(merci|thx|thanks)\b/.test(t)) return 'merci';
    if (/\b(salut|bonjour|bonsoir|coucou|hello|yo|wesh|slt|cc)\b/.test(t)) return 'salut';
    return 'appel';
  }
  /* une durée lisible depuis une date ISO : « 2 h 14 min » (court) ou « 3 ans, 2 mois et 5 jours » (long) */
  function duree(iso, maintenant, long) {
    var debut = new Date(iso), fin = new Date(maintenant || Date.now());
    if (isNaN(debut)) return '';
    function pl(n, mot, pluriel) { return n + ' ' + (n > 1 ? (pluriel || mot + 's') : mot); }
    function liste(p) { p = p.filter(Boolean); return p.length > 1 ? p.slice(0, -1).join(', ') + ' et ' + p[p.length - 1] : (p[0] || ''); }
    if (!long) {
      var min = Math.max(0, Math.floor((fin - debut) / 60000)), h = Math.floor(min / 60);
      return h ? h + ' h ' + String(min % 60).padStart(2, '0') + ' min' : pl(min, 'minute');
    }
    var mois = (fin.getFullYear() - debut.getFullYear()) * 12 + fin.getMonth() - debut.getMonth();
    if (fin.getDate() < debut.getDate()) mois--;
    var repere = new Date(debut); repere.setMonth(debut.getMonth() + mois);
    var jours = Math.max(0, Math.floor((fin - repere) / 86400000)), ans = Math.floor(mois / 12);
    mois = mois % 12;
    if (!ans && !mois && !jours) return 'aujourd\'hui';
    return liste([ans && pl(ans, 'an'), mois && pl(mois, 'mois', 'mois'), jours && pl(jours, 'jour')]);
  }
  return { choisir: choisir, intention: intention, duree: duree, remplir: remplir, TAQUIN: TAQUIN, SOBRE: SOBRE };
})();
if (typeof module !== 'undefined') module.exports = REPLIQUES;
