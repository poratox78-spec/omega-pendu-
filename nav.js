// nav.js — SOURCE UNIQUE de la barre de navigation du site + repli hamburger ☰.
//
// Pourquoi centralisé : la nav était codée EN DUR dans ~9 pages → elle a dérivé (index avait 12 liens,
// saisie-vocale 7, correcteur-outil 9…) = incohérent et « moins lisible ». Ici la liste est UNIQUE :
// chaque page reçoit exactement le même menu, groupé (Outils / Jeux / Recherche / Plus) pour la lisibilité.
// nav.js RÉÉCRIT le contenu de <nav> (les <a> codés en dur ne servent plus que de repli sans JS), garde le
// bouton « 🔤 Lisible », marque la page courante (aria-current), et replie le tout derrière ☰ à toutes largeurs.
// Idempotent ; se ferme au clic sur un lien, au clic dehors, ou sur Échap. Les pages /en/ gardent leur nav.
(function () {
  // Groupes → [libellé de section, [ [href, texte], ... ] ]. hrefs relatifs à la racine du site (pages fr).
  var GROUPS = [
    ['Outils dys', [
      ['correcteur.html', 'Le correcteur'],
      ['dictee.html', 'La dictée'],
      ['saisie-vocale.html', 'Saisie vocale'],
    ]],
    ['Jeux', [
      ['index.html', 'Le pendu'],
      ['scrabidon.html', 'Scrabidon'],
      ['pendable.html', 'Pendable'],
    ]],
    ['Recherche', [
      ['recherche.html', 'La recherche'],
      ['donnees.html', 'Données'],
      ['arbitrage.html', "L'arbitrage"],
      ['evolution.html', "L'évolution"],
    ]],
    ['Plus', [
      ['omega-key.html', 'OMEGA·KEY'],
      ['https://github.com/poratox78-spec/omega-pendu-', 'Code'],
      ['en/index.html', 'English'],
    ]],
  ];

  function currentKey() {
    var p = location.pathname, i = p.lastIndexOf('/');
    var f = (i >= 0 ? p.slice(i + 1) : p) || 'index';
    return f.replace(/\.html$/, '');   // normalise : « /correcteur » (URL propre) == « correcteur.html »
  }

  function buildLinks(nav) {
    var cur = currentKey();
    // Retire les <a> et libellés de section codés en dur / déjà injectés ; garde le reste (bouton Lisible).
    Array.prototype.slice.call(nav.querySelectorAll('a, .navsec')).forEach(function (el) { el.remove(); });
    var toggle = nav.querySelector('#dys-toggle');   // point d'insertion : tout AVANT le bouton
    var frag = document.createDocumentFragment();
    GROUPS.forEach(function (g) {
      var lab = document.createElement('span');
      lab.className = 'navsec'; lab.setAttribute('aria-hidden', 'true'); lab.textContent = g[0];
      frag.appendChild(lab);
      g[1].forEach(function (lk) {
        var a = document.createElement('a');
        a.href = lk[0]; a.textContent = lk[1];
        if (lk[0].indexOf('http') === 0) { a.rel = 'noopener'; }
        else if (lk[0].replace(/\.html$/, '') === cur) { a.setAttribute('aria-current', 'page'); }
        frag.appendChild(a);
      });
    });
    if (toggle) nav.insertBefore(frag, toggle); else nav.appendChild(frag);
  }

  function init() {
    var hdr = document.querySelector('header.top'); if (!hdr) return;
    var wrap = hdr.querySelector('.wrap') || hdr, nav = hdr.querySelector('nav'); if (!nav) return;
    // Pages /en/ : nav propre (2 pages) → on ne réécrit pas les liens fr, on ajoute juste le hamburger.
    if (location.pathname.indexOf('/en/') === -1) { try { buildLinks(nav); } catch (e) {} }

    if (wrap.querySelector('.navtoggle')) return;                 // hamburger déjà posé
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
