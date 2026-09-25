// nav.js — SOURCE UNIQUE de la barre de navigation du site + repli hamburger ☰.
//
// Pourquoi centralisé : la nav était codée EN DUR dans ~9 pages → elle a dérivé (index avait 12 liens,
// saisie-vocale 7, correcteur-outil 9…) = incohérent et « moins lisible ». Ici la liste est UNIQUE :
// chaque page reçoit exactement le même menu, groupé (Outils dys / Jeux / Plus) pour la lisibilité.
// nav.js RÉÉCRIT le contenu de <nav> (les <a> codés en dur ne servent plus que de repli sans JS), garde le
// bouton « 🔤 Lisible », marque la page courante (aria-current), et replie le tout derrière ☰ à toutes largeurs.
// Idempotent ; se ferme au clic sur un lien, au clic dehors, ou sur Échap. Les pages /en/ reçoivent le menu
// GROUPS_EN (même mécanisme, menu anglais) — centralisé ici pour éviter la dérive des navs codées en dur.
(function () {
  // Groupes → [libellé de section, [ [href, texte], ... ] ]. hrefs relatifs à la racine du site (pages fr).
  var GROUPS = [
    ['Outils dys', [
      ['correcteur', 'Le correcteur'],
      ['dictee', 'La dictée'],
      ['saisie-vocale', 'Saisie vocale'],
      ['calcul', 'Poser un calcul'],
    ]],
    ['Jeux', [
      /* ⚠️ 25/09/2026 — CETTE ENTRÉE MENAIT À L ACCUEIL. Rapport de Rem : « quand je clique sur le pendu
         dans le menu j arrive sur le main ». Vérifié dans Chrome : href="./" se résoud en « / », la page
         d accueil. Ce n était pas une régression récente : l entrée est née ainsi (#312), et même à cette
         époque l accueil était déjà une page de présentation, jamais le jeu. Le menu promettait donc le
         pendu et livrait l accueil depuis le début. Chemin ABSOLU : le menu est injecté sur des pages de
         profondeurs différentes (/en/…), un chemin relatif s y résoudrait ailleurs. */
      ['/app/omega-pendu.html', 'Le pendu'],
      ['scrabidon', 'Scrabidon'],
      ['pendable', 'Pendable'],
      ['double-sens', 'Double-Sens'],
    ]],
    // Rem (17/09/2026) : sur Google, « omega pendu » listait Confidentialité, le modèle double route, le mémoire,
    // l'arbitrage… — les pages de recherche, poussées par ce menu présent sur toutes les pages. Une seule entrée pour
    // ⚠️ 19/09/2026 — Rem : « arbitrage aussi a sauté du menu, c'est chiant ». Les deux reviennent, à sa demande.
    // MESURE, et correction de ce que j'avais d'abord affirmé : /arbitrage n'était PAS orpheline — on y arrivait
    // encore, mais UNIQUEMENT en passant par docs/MEMOIRE et docs/rapport-mode-emploi, qui la lient dans leur
    // corps. Aucune page NORMALE ne la liait hors de cette barre de repli (que ce fichier remplace au
    // chargement) : le seul chemin restant passait par un mémoire de recherche. Ce n'est pas « invisible »,
    // c'est enterré — et ça le devient plus encore depuis que ces documents sont en `noindex`.
    // Le motif SEO du 17/09 (les pages de recherche poussées dans les liens de site Google) est traité là où
    // il se joue : le `noindex` des documents internes, pas l'amputation du menu.
    // ⚠️ DONNÉES N'EST PAS UNE PAGE DE RECHERCHE (Rem, 18/09/2026 : « je suis pas d'accord que les données soient sorties du
    // menu, on a fait un gros travail dessus et en plus y a la police dys ») : c'est une page PRODUIT — les lexiques à
    // télécharger et la police dys. Sortie du menu par erreur avec le groupe « Recherche », elle y revient ; la garde
    // sitemap_probe ⑤ EXIGE maintenant sa présence.
    // ⭐ 19/09/2026 — MÊME FORME QU'EN ANGLAIS, à la demande de Rem : « tu les as mis en anglais mais pas en
    // français ». GROUPS_EN portait « Research : recherche · donnees · arbitrage · evolution » depuis toujours ;
    // le 17/09 n'avait amputé QUE le menu français. Quatre entrées dans « Plus » en faisaient un mur — pour un
    // lecteur dys, un groupe qui NOMME ce qu'il contient vaut mieux qu'une liste fourre-tout.
    ['Recherche', [
      ['recherche', 'La recherche'],
      ['arbitrage', "L'arbitrage"],
      ['evolution', "L'évolution"],
    ]],
    ['Plus', [
      ['donnees', 'Données & police dys'],
      ['omega-key', 'OMEGA·KEY'],
      ['https://github.com/poratox78-spec/omega-pendu-', 'Code'],
    ]],
  ];
  // Menu ANGLAIS (pages /en/) — même mécanisme que le FR (il garde un groupe Research : la page Research anglaise
  // ne relie pas encore Data ni Arbitration), et seulement les outils/pages qui EXISTENT
  // en anglais (pas de saisie-vocale/scrabidon/pendable/données EN pour l'instant). hrefs relatifs à /en/.
  // Centralisé ici pour tuer la dérive (« Dictation » manquait sur 6 pages/8, dont l'accueil).
  var GROUPS_EN = [
    ['Dyslexia tools', [
      ['correcteur', 'Corrector'],
      ['dictee', 'Dictation'],
      ['saisie-vocale', 'Voice typing'],
      ['decompose-outil', 'Decompose'],
    ]],
    ['Play', [
      ['/app/omega-pendu-en.html', 'The Hangman'],   // même défaut côté anglais, même correction
    ]],
    ['Research', [
      ['recherche', 'Research'],
      ['donnees', 'Data'],
      ['arbitrage', 'Arbitration'],
      ['evolution', 'Evolution'],
    ]],
    ['More', [
      ['omega-key', 'OMEGA·KEY'],
      ['https://github.com/poratox78-spec/omega-pendu-', 'Code'],
    ]],
  ];

  function currentKey() {
    var p = location.pathname, i = p.lastIndexOf('/');
    var f = (i >= 0 ? p.slice(i + 1) : p) || 'index';
    return f.replace(/\.html$/, '');   // normalise : « /correcteur » (URL propre) == « correcteur.html »
  }

  function buildLinks(nav, groups) {
    var cur = currentKey();
    // Retire les <a> et libellés de section codés en dur / déjà injectés ; garde le reste (bouton Lisible).
    Array.prototype.slice.call(nav.querySelectorAll('a, .navsec')).forEach(function (el) { el.remove(); });
    var toggle = nav.querySelector('#dys-toggle');   // point d'insertion : tout AVANT le bouton
    var frag = document.createDocumentFragment();
    (groups || GROUPS).forEach(function (g) {
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

  // Barre d'accessibilité centrée en haut : thème clair/sombre + taille du texte (loupe, 3 niveaux).
  // Mémorisée (localStorage), injectée sur toutes les pages, remplace l'ancien bouton « 🔤 Lisible ».
  function a11y(hdr, wrap) {
    if (wrap.querySelector('.a11y')) return;
    var root = document.documentElement, body = document.body;
    function ls(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
    function save(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
    // migration de l'ancien réglage « Lisible » (clé omega_lisible → niveau de lecture 1)
    try { if (ls('omega_lisible') && ls('omega_read') == null) save('omega_read', '1'); localStorage.removeItem('omega_lisible'); } catch (e) {}

    var bar = document.createElement('div'); bar.className = 'a11y';
    var bT = document.createElement('button'); bT.className = 'a11y-btn'; bT.type = 'button';
    var bS = document.createElement('button'); bS.className = 'a11y-btn'; bS.type = 'button';
    bar.appendChild(bT); bar.appendChild(bS);

    function applyTheme(t){                                   // thème clair / sombre
      root.setAttribute('data-theme', t);
      bT.textContent = t === 'light' ? '🌙' : '☀️';
      bT.title = t === 'light' ? 'Passer au thème sombre' : 'Passer au thème clair';
      bT.setAttribute('aria-label', bT.title);
      var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'light' ? '#faf9f6' : '#0d1117');
    }
    applyTheme(ls('omega_theme') || 'dark');                 // défaut sombre (identité du site) ; le choix prime et est mémorisé
    bT.addEventListener('click', function(){ var n = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light'; save('omega_theme', n); applyTheme(n); });

    var LV = ['Normal', 'Grand', 'Très grand'];              // taille du texte (loupe, 3 niveaux)
    function level(){ var n = parseInt(ls('omega_read') || '0', 10); return (n === 1 || n === 2) ? n : 0; }
    function applyRead(l){
      if (l > 0) root.setAttribute('data-read', String(l)); else root.removeAttribute('data-read');
      body.classList.toggle('lisible', l > 0);               // police dys + espacement dès le niveau 1
      bS.classList.toggle('on', l > 0);
      bS.textContent = '🔍';
      bS.title = 'Taille du texte : ' + LV[l] + ' — cliquer pour ' + (l < 2 ? 'agrandir' : 'revenir à normal');
      bS.setAttribute('aria-label', bS.title);
    }
    applyRead(level());
    bS.addEventListener('click', function(){ var l = (level() + 1) % 3; save('omega_read', String(l)); applyRead(l); });

    // Bascule de LANGUE FR/EN — dans la barre a11y (au milieu, avec thème + loupe), pas dans le menu.
    // Les pages qui existent en /en/ (les autres FR pointent vers l'accueil EN).
    var EN_PAGES = {'index':1,'correcteur':1,'dictee':1,'evolution':1,'recherche':1,'omega-key':1,
      'arbitrage':1,'correcteur-outil':1,'dictee-outil':1,'saisie-vocale':1,'confidentialite':1,'donnees':1,
      'docs/MEMOIRE':1,'docs/rapport-mode-emploi':1};
    var pth = location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
    var onEn = /(^|\/)en(\/|$)/.test(pth);
    var key = onEn ? pth.replace(/^.*?\/en\//, '').replace(/^\/?en$/, 'index') : pth.replace(/^\//, '');
    if (!key) key = 'index';
    var bL = document.createElement('a'); bL.className = 'a11y-btn a11y-lang'; bL.setAttribute('role', 'button');
    if (onEn) { bL.href = EN_PAGES[key] ? '/' + key : '/'; bL.textContent = 'FR'; bL.title = 'Version française'; }  // page EN-only (ex. decompose-outil) → accueil FR (pas de 404)
    else { bL.href = EN_PAGES[key] ? '/en/' + key : '/en/'; bL.textContent = 'EN'; bL.title = 'English version'; }
    bL.setAttribute('aria-label', bL.title);
    bar.appendChild(bL);

    var old = hdr.querySelector('#dys-toggle'); if (old) old.remove();   // remplace l'ancien bouton « Lisible »
    wrap.appendChild(bar);
  }

  function init() {
    var hdr = document.querySelector('header.top'); if (!hdr) return;
    var wrap = hdr.querySelector('.wrap') || hdr, nav = hdr.querySelector('nav'); if (!nav) return;
    // Nav pilotée par nav.js dans les DEUX langues (menu unique, drift-proof) : GROUPS en FR, GROUPS_EN en /en/.
    var isEn = location.pathname.indexOf('/en/') !== -1;
    try { buildLinks(nav, isEn ? GROUPS_EN : GROUPS); } catch (e) {}
    try { a11y(hdr, wrap); } catch (e) {}                    // barre accessibilité (thème + taille) — sur toutes les pages, y compris /en/

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
