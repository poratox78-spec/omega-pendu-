/* Demande d'autorisation micro, depuis un VRAI ONGLET d'extension.
   Cf. l'en-tête de micro.html : dans le side panel l'invite ne s'affiche jamais (contexte
   « offscreen »), donc on la déclenche ici, où Chrome l'affiche normalement.
   ⚠️ CSP MV3 : aucun script en ligne dans une page d'extension — d'où ce fichier séparé.
   ⚠️ ET SURTOUT : on AFFICHE le résultat, succès comme échec. Le bug d'origine n'était pas que
   la permission manquait, c'est qu'elle échouait EN SILENCE (`.catch(function(){})` vide). */
'use strict';
(function () {
  var btn = document.getElementById('go'), et = document.getElementById('et');

  function dis(txt, cls) { et.textContent = txt; et.className = cls || ''; }

  /* Déjà accordée ? On le dit tout de suite plutôt que de faire cliquer pour rien. */
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'microphone' }).then(function (p) {
      if (p.state === 'granted') { dis('✓ Le micro est déjà autorisé. Tu peux revenir au panneau.', 'ok'); btn.disabled = true; }
      else if (p.state === 'denied') dis('Le micro est bloqué pour cette extension. Ouvre les réglages de site de Chrome (l’icône à gauche de la barre d’adresse) pour le réautoriser.', 'ko');
    }).catch(function () {});                     // navigateur sans l'API Permissions : on laisse le bouton faire foi
  }

  btn.addEventListener('click', function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      dis('Ce navigateur ne donne pas accès au micro (getUserMedia absent).', 'ko'); return;
    }
    btn.disabled = true; dis('Chrome va te demander l’autorisation…');
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
      st.getTracks().forEach(function (t) { t.stop(); });   // on ne garde PAS le flux : on voulait la permission, pas le son
      dis('✓ Micro autorisé. Retourne dans le panneau latéral et coche « dictée vocale ».', 'ok');
    }).catch(function (e) {
      btn.disabled = false;
      var n = (e && e.name) || '';
      dis(n === 'NotAllowedError' ? 'Autorisation refusée. Reclique le bouton, puis choisis « Autoriser ».'
        : n === 'NotFoundError' ? 'Aucun micro détecté sur cet appareil.'
        : 'Le micro n’a pas pu être ouvert (' + (n || 'erreur inconnue') + ').', 'ko');
    });
  });
})();
