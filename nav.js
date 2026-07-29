// nav.js — replie la barre de navigation du site derrière un bouton ☰ (haut-droite), à TOUTES les largeurs.
// La nav est devenue longue (pendu, correcteur, dictée, saisie vocale, recherche, OMEGA·KEY, Code…) → un menu
// hamburger déclutter l'en-tête. Logique CENTRALISÉE ici ; le style + l'état ouvert/fermé vivent dans site.css.
// Chargé en `defer` par chaque page ; idempotent ; se ferme au clic sur un lien, au clic dehors, ou sur Échap.
(function () {
  function init() {
    var hdr = document.querySelector('header.top'); if (!hdr) return;
    var wrap = hdr.querySelector('.wrap') || hdr, nav = hdr.querySelector('nav'); if (!nav) return;
    if (wrap.querySelector('.navtoggle')) return;                 // déjà posé
    var btn = document.createElement('button');
    btn.className = 'navtoggle'; btn.type = 'button';
    btn.setAttribute('aria-label', 'Menu'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';
    nav.parentNode.insertBefore(btn, nav);                        // le bouton juste avant la nav (dropdown ancré dessous)
    function set(open) { hdr.classList.toggle('nav-open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(!hdr.classList.contains('nav-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });   // clic sur un lien → ferme
    document.addEventListener('click', function (e) { if (!hdr.contains(e.target)) set(false); });   // clic dehors → ferme
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
