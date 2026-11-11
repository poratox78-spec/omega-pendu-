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
      ['police-de-son', 'Police de son'],
    ]],
    ['Jeux', [
      /* ⚠️ 25/09/2026 — CETTE ENTRÉE MENAIT À L ACCUEIL. Rapport de Rem : « quand je clique sur le pendu
         dans le menu j arrive sur le main ». Vérifié dans Chrome : href="./" se résoud en « / », la page
         d accueil. Ce n était pas une régression récente : l entrée est née ainsi (#312), et même à cette
         époque l accueil était déjà une page de présentation, jamais le jeu. Le menu promettait donc le
         pendu et livrait l accueil depuis le début. Chemin ABSOLU : le menu est injecté sur des pages de
         profondeurs différentes (/en/…), un chemin relatif s y résoudrait ailleurs. */
      /* ⚠️ 25/09/2026, deux heures après la correction précédente : SANS « .html ». Vérifié EN LIGNE,
         « /app/omega-pendu.html » répond 308 vers « /app/omega-pendu » (Cloudflare Pages retire l extension).
         Mettre l URL avec extension dans le MENU, c est un aller-retour sur CHAQUE page du site, et c est
         la catégorie « Page avec redirection » qui compte déjà 30 pages à la Search Console. Sans extension :
         200 direct, mesuré (14,0 Mo en FR, 4,3 Mo en EN). La règle ④ de sitemap_probe existe pour ça ;
         elle exemptait l app, mais sa RAISON vaut ici plus qu ailleurs. */
      /* ⚠ 26/09/2026 — L’ÉTIQUETTE PROMETTAIT UN JEU ET LIVRAIT UN BANC D’ESSAI. Le 25/09 on avait
         corrigé la DESTINATION de cette entrée (elle menait à l’accueil) ; le LIBELLÉ, lui, disait
         toujours « Le pendu ». Or le h1 de la page est « architecture cognitive du pendu français —
         cognition > oracle », et ses titres parlent de smoke tests et de bench R1. Qui cherche à jouer
         cliquait là et tombait dans un laboratoire ; qui cherche le jeu ne devinait pas que
         « Pendable » était le pendu. Les deux entrées disent maintenant ce qu’elles sont. */
      ['/app/omega-pendu', 'Le pendu cognitif'],
      ['solveur-pendu', 'Solveur de pendu'],
      ['mot-difficile-pendu', 'Mot difficile au pendu'],
      ['scrabidon', 'Scrabidon'],
      ['pendable', 'Pendable, le jeu du pendu'],
      ['double-sens', 'Double-Sens'],
    ]],
    // 11/11/2026 : VIVARIUM et le Déformateur de voix, les deux autres grands projets de l'auteur (sur itch.io), entrent au menu.
    ['Autres projets', [
      ['https://poratox78-spec.itch.io/vivarium', 'VIVARIUM, le jeu'],
      ['https://poratox78-spec.itch.io/deformateur-de-voix', 'Déformateur de voix'],
    ]],
    // Rem (17/09/2026) : sur Google, « omega pendu » listait Confidentialité, le modèle double route, le mémoire,
    // l'arbitrage… — les pages de recherche, poussées par ce menu présent sur toutes les pages. Une seule entrée pour
    // ⚠️ 19/09/2026 — Rem : « arbitrage aussi a sauté du menu, c'est chiant ». Les deux reviennent, à sa demande.
    // MESURE, et correction de ce que j'avais d'abord affirmé : /arbitrage n'était PAS orpheline — on y arrivait
    // encore, mais UNIQUEMENT en passant par docs/MEMOIRE et docs/rapport-mode-emploi, qui la lient dans leur
    // corps. Aucune page NORMALE ne la liait hors de cette barre de repli (que ce fichier remplace au
    // chargement) : le seul chemin restant passait par un mémoire de recherche. Ce n'est pas « invisible »,
    // c'est enterré — et ça le devient plus encore depuis que ces documents sont en `noindex`.
    // ⚠️ CETTE PHRASE A ÉTÉ ÉCRITE AVANT LE FAIT. Vérifié le 26/09/2026 en relevant les directives
    // `robots` de tout le site : SEUL 404.html en portait une. Les documents n'étaient pas en
    // `noindex` ; le commentaire décrivait une intention comme un acquis. Elle est vraie DEPUIS le
    // Lot B du 26/09 (docs FR+EN, /toile), et /arbitrage ne dépend plus d'eux : Rem l'a fait revenir
    // au menu le 19/09.
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
      ['/app/omega-pendu-en', 'The Hangman'],   // même défaut côté anglais, même correction : 200 direct au lieu d un 308
    ]],
    ['Other projects', [
      ['https://poratox78-spec.itch.io/vivarium', 'VIVARIUM, the game'],
      ['https://poratox78-spec.itch.io/deformateur-de-voix', 'Voice changer'],
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

  // ⭐ 11/11/2026 — REFONTE, lot 1 (LA LISTE n° 387, maquette validée par Rem) : dans le grand menu, chaque page dit en quelques mots ce
  // qu'elle fait. Clé = l'adresse du lien dans GROUPS (dont le format [adresse, libellé] ne change pas : trois sondes le lisent).
  // Menu anglais : libellés seuls (l'anglais est en pause, rien d'écrit qu'on ne puisse relire).
  var DESC = {
    'correcteur': 'Orthographe, accents, accords',
    'dictee': 'Lue à voix haute, chaque faute expliquée',
    'saisie-vocale': 'Parler au lieu de taper',
    'calcul': 'La dyscalculie pas à pas',
    'police-de-son': 'Un texte en couleur, son par son',
    '/app/omega-pendu': 'Le moteur devine ton mot',
    'solveur-pendu': 'Le mot et la lettre à jouer',
    'mot-difficile-pendu': 'De 3 à 15 lettres',
    'scrabidon': 'Solveur de Scrabble',
    'pendable': 'Le jeu du pendu, sans pub',
    'double-sens': 'Le jeu de mots sans faute',
    'https://poratox78-spec.itch.io/vivarium': "Tir tactique en escouade, l'IA apprend",
    'https://poratox78-spec.itch.io/deformateur-de-voix': 'Ta voix transformée en direct',
    'recherche': 'Dyslexie et double route',
    'arbitrage': "La géométrie de l'arbitrage",
    'evolution': 'Un solveur de pendu, en 3D',
    'donnees': 'Lexiques ouverts, à réutiliser',
    'omega-key': 'Messagerie chiffrée dans un fichier',
    'https://github.com/poratox78-spec/omega-pendu-': 'Le dépôt, open source',
  };

  function currentKey() {
    var p = location.pathname, i = p.lastIndexOf('/');
    var f = (i >= 0 ? p.slice(i + 1) : p) || 'index';
    return f.replace(/\.html$/, '');   // normalise : « /correcteur » (URL propre) == « correcteur.html »
  }

  function buildLinks(nav, groups) {
    var cur = currentKey();
    // Retire les <a> et libellés de section codés en dur / déjà injectés ; garde le reste (bouton Lisible).
    Array.prototype.slice.call(nav.querySelectorAll('a, .navsec, .navgrp')).forEach(function (el) { el.remove(); });
    var toggle = nav.querySelector('#dys-toggle');   // point d'insertion : tout AVANT le bouton
    var frag = document.createDocumentFragment(), fr = groups !== GROUPS_EN;
    (groups || GROUPS).forEach(function (g, gi) {
      var grp = document.createElement('div');   // refonte (lot 1) : une colonne par groupe dans le grand menu
      grp.className = 'navgrp'; grp.setAttribute('data-grp', String(gi)); grp.setAttribute('role', 'group'); grp.setAttribute('aria-label', g[0]);
      var lab = document.createElement('span');
      lab.className = 'navsec'; lab.setAttribute('aria-hidden', 'true'); lab.textContent = g[0];
      grp.appendChild(lab);
      g[1].forEach(function (lk) {
        var a = document.createElement('a');
        a.href = lk[0];
        var nl = document.createElement('span'); nl.className = 'nl'; nl.textContent = lk[1]; a.appendChild(nl);
        if (fr && DESC[lk[0]]) { var nd = document.createElement('span'); nd.className = 'nd'; nd.textContent = DESC[lk[0]]; a.appendChild(nd); }
        if (lk[0].indexOf('http') === 0) { a.rel = 'noopener'; }
        else if (lk[0].replace(/\.html$/, '') === cur) { a.setAttribute('aria-current', 'page'); }
        grp.appendChild(a);
      });
      frag.appendChild(grp);
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
    var bD = document.createElement('button'); bD.className = 'a11y-btn a11y-dys'; bD.type = 'button';
    var bP = document.createElement('button'); bP.className = 'a11y-btn a11y-son'; bP.type = 'button';
    var bS = document.createElement('button'); bS.className = 'a11y-btn'; bS.type = 'button';
    var dysEn = /(^|\/)en(\/|$)/.test(location.pathname);
    bar.appendChild(bT); bar.appendChild(bD); if (!dysEn) bar.appendChild(bP); bar.appendChild(bS);

    function applyTheme(t){                                   // thème clair / sombre
      root.setAttribute('data-theme', t);
      bT.textContent = t === 'light' ? '🌙' : '☀️';
      bT.title = t === 'light' ? 'Passer au thème sombre' : 'Passer au thème clair';
      bT.setAttribute('aria-label', bT.title);
      var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'light' ? '#ffffff' : '#0d1117');
    }
    // ⭐ 11/11/2026 (refonte, lot 1) : CLAIR par défaut, l'identité du panneau de l'extension ; sans choix enregistré, le site suit le
    // réglage de l'ordinateur (sombre s'il est sombre). Le choix fait au bouton prime et reste mémorisé, comme avant.
    var sysSombre = false; try { sysSombre = !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) {}
    applyTheme(ls('omega_theme') || (sysSombre ? 'dark' : 'light'));
    bT.addEventListener('click', function(){ var n = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light'; save('omega_theme', n); applyTheme(n); });

    // ⭐ 09/10/2026 — « Aa OMEGA Dys » : tout le site dans notre police + espacement large (site.css, html[data-dysfont]).
    // OFF par défaut, choix retenu (omega_dysfont) ; l'app intégrée lit la même clé (événement storage). Rem : « on laisse la personne décider ».
    function applyDys(v){
      if (v) root.setAttribute('data-dysfont', '1'); else root.removeAttribute('data-dysfont');
      bD.textContent = 'Aa';
      bD.classList.toggle('on', v);
      bD.setAttribute('aria-pressed', v ? 'true' : 'false');
      bD.title = dysEn ? (v ? 'OMEGA Dys font: on — click to go back to the usual font' : 'OMEGA Dys font: our font with wide spacing on the whole site')
                       : (v ? 'Police OMEGA Dys : activée — cliquer pour revenir à la police habituelle' : 'Police OMEGA Dys : tout le site dans notre police, avec un espacement large');
      bD.setAttribute('aria-label', bD.title);
    }
    applyDys(ls('omega_dysfont') === '1');
    bD.addEventListener('click', function(){ var v = root.getAttribute('data-dysfont') !== '1'; save('omega_dysfont', v ? '1' : '0'); applyDys(v); });

    // ⭐ 09/10/2026 — « 🔡 » : la POLICE DE SON (sons épais ou fins, muettes en vermillon, syllabes alternées) sur le texte de
    // TOUTES les pages (police/son_site.js). Demande de Rem : les couleurs des syllabes et des sons sur le site. OFF par défaut, mêmes
    // clés que l'app (vdd_son, vdd_syl) : l'allumer ici l'allume dans le correcteur et la dictée, et inversement (événement
    // storage, dans les deux sens). Français seulement (le g2p est français) : pas de bouton sur les pages /en/. Les scripts
    // ne se chargent qu'à la première activation : rien de plus à télécharger pour qui ne s'en sert pas.
    // ⭐ 13/10/2026 — la phonologie des « -ent » (« ils mangent » : -ent muet) : les pages du site n'ont pas le moteur, la police de son
    // retombait sur une liste de 582 mots. On charge la table des formes lues 3e pluriel, TIRÉE du moteur (extension/build_ent3p.js,
    // ~0,2 Mo) : la même phonologie que l'extension et l'app.
    function chargerEnt3p(fin){
      if (window.__OMEGA_ENT3P || typeof DecompressionStream === 'undefined' || !window.fetch) return fin();
      fetch('/extension/assets/ent-3p.txt.gz').then(function(r){ if (!r.ok) throw 0; return r.arrayBuffer(); })
        .then(function(b){ return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); })
        .then(function(t){ window.__OMEGA_ENT3P = new Set(t.split('\n').filter(Boolean)); fin(); }, function(){ fin(); });
    }
    function chargerSon(fin){
      var L = [['OmegaDysSonCore', '/police/son_core.js'], ['_DECL2', '/extension/assets/g2p.js'], ['OmegaSonSite', '/police/son_site.js']], i = 0;
      (function suivant(){
        while (i < L.length && typeof window[L[i][0]] !== 'undefined') i++;
        if (i >= L.length) return chargerEnt3p(fin);
        var sc = document.createElement('script'); sc.src = L[i++][1]; sc.onload = suivant; sc.onerror = function(){};
        document.head.appendChild(sc);
      })();
    }
    function applySon(v, s){
      bP.textContent = '🔡';
      bP.classList.toggle('on', v);
      bP.setAttribute('aria-pressed', v ? 'true' : 'false');
      bP.title = v ? 'Police de son : activée — cliquer pour la retirer'
                   : 'Police de son : sons épais ou fins, lettres muettes en couleur, syllabes alternées, sur tout le site';
      bP.setAttribute('aria-label', bP.title);
      if (v) chargerSon(function(){ try { OmegaSonSite.set(true, s); } catch (e) {} });
      else if (window.OmegaSonSite) { try { OmegaSonSite.set(false, false); } catch (e) {} }
    }
    if (!dysEn) {
      applySon(ls('vdd_son') === '1', ls('vdd_syl') === '1');
      bP.addEventListener('click', function(){ var v = ls('vdd_son') !== '1'; save('vdd_son', v ? '1' : '0'); save('vdd_syl', v ? '1' : '0'); applySon(v, v); });
      window.addEventListener('storage', function(e){ if (e.key === 'vdd_son' || e.key === 'vdd_syl') applySon(ls('vdd_son') === '1', ls('vdd_syl') === '1'); });
    }

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
    var groups = isEn ? GROUPS_EN : GROUPS;
    // ⭐ 11/11/2026 — REFONTE, lot 1 : la barre de la maquette. Grand écran : un bouton par groupe ouvre le grand menu sur ce groupe ;
    // petit écran : ☰. La recherche (Ctrl K) cherche dans les pages du menu. « Ajouter à Chrome » mène à la fiche de l'extension.
    var CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>';
    var LOUPE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>';
    var gb = document.createElement('div'); gb.className = 'navgroups'; gb.setAttribute('role', 'group'); gb.setAttribute('aria-label', isEn ? 'Site menu' : 'Menu du site');
    groups.forEach(function (g, gi) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-expanded', 'false'); b.setAttribute('data-grp', String(gi));
      b.textContent = g[0]; b.insertAdjacentHTML('beforeend', CHEV); gb.appendChild(b);
    });
    var sb = document.createElement('button'); sb.type = 'button'; sb.className = 'navsearch';
    sb.innerHTML = LOUPE + '<span class="nsl"></span><kbd>Ctrl K</kbd>';
    sb.querySelector('.nsl').textContent = isEn ? 'Search' : 'Rechercher';
    sb.setAttribute('aria-label', isEn ? 'Search a page (Ctrl K)' : 'Rechercher un outil (Ctrl K)');
    var btn = document.createElement('button');
    btn.className = 'navtoggle'; btn.type = 'button';
    btn.setAttribute('aria-label', 'Menu'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';
    var bar = wrap.querySelector('.a11y');
    wrap.insertBefore(gb, nav); wrap.insertBefore(sb, nav); if (bar) wrap.insertBefore(bar, nav);
    if (!isEn) {
      var cta = document.createElement('a'); cta.className = 'navcta'; cta.rel = 'noopener';
      cta.href = 'https://chromewebstore.google.com/detail/dbochkbaechbemahapplibbhmfkcldln'; cta.textContent = 'Ajouter à Chrome';
      wrap.insertBefore(cta, nav);
    }
    nav.parentNode.insertBefore(btn, nav);                        // ☰ juste avant la nav (le grand menu s'ouvre sous la barre)
    var ouvert = -2;                                              // -2 fermé · -1 ouvert par ☰ · n ouvert sur le groupe n
    function set(open, gi) {
      ouvert = open ? (gi == null ? -1 : gi) : -2;
      hdr.classList.toggle('nav-open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      Array.prototype.forEach.call(gb.children, function (b, i) { b.setAttribute('aria-expanded', open && i === ouvert ? 'true' : 'false'); });
      Array.prototype.forEach.call(nav.querySelectorAll('.navgrp'), function (d, i) { d.classList.toggle('on', open && i === ouvert); });
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(!hdr.classList.contains('nav-open')); });
    gb.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; e.stopPropagation();
      var gi = parseInt(b.getAttribute('data-grp'), 10); set(ouvert !== gi, gi);
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });   // clic sur un lien → ferme
    document.addEventListener('click', function (e) { if (!hdr.contains(e.target)) set(false); });   // clic dehors → ferme
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
    try { recherche(sb, groups, isEn, function () { set(false); }); } catch (e) {}
  }

  // Recherche (Ctrl K, ou « / ») : les pages du menu, filtrées à la frappe (accents et majuscules ignorés), ↑ ↓ pour choisir, Entrée
  // pour ouvrir, Échap pour fermer. Rien n'est envoyé : la liste est celle du menu, dans la page.
  function recherche(sb, groups, isEn, fermerMenu) {
    var L = [];
    groups.forEach(function (g) { g[1].forEach(function (lk) { L.push({ h: lk[0], l: lk[1], d: isEn ? '' : (DESC[lk[0]] || ''), g: g[0] }); }); });
    function norm(x) { return String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
    var dlg = document.createElement('div'); dlg.className = 'navdlg'; dlg.hidden = true;
    dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-label', isEn ? 'Search' : 'Recherche');
    dlg.innerHTML = '<div class="boite"><div class="champ"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>'
      + '<input type="search" id="omega-recherche" autocomplete="off" spellcheck="false"></div><ul role="listbox"></ul><p class="aide"></p></div>';
    var inp = dlg.querySelector('input'), ul = dlg.querySelector('ul');
    inp.placeholder = isEn ? 'A page, a tool, a game…' : 'Une page, un outil, un jeu…';
    inp.setAttribute('aria-label', isEn ? 'Search the site' : 'Rechercher dans le site');
    dlg.querySelector('.aide').textContent = isEn ? '↑ ↓ to choose · Enter to open · Esc to close' : '↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer';
    document.body.appendChild(dlg);
    var sel = 0, vus = [];
    function rendre() {
      var mots = norm(inp.value).split(/\s+/).filter(Boolean);
      vus = L.filter(function (x) { var t = norm(x.l + ' ' + x.d + ' ' + x.g); return mots.every(function (m) { return t.indexOf(m) >= 0; }); });
      if (sel >= vus.length) sel = 0;
      ul.textContent = '';
      if (!vus.length) { var v = document.createElement('li'); v.className = 'vide'; v.textContent = isEn ? 'No page matches.' : 'Aucune page ne correspond.'; ul.appendChild(v); return; }
      vus.forEach(function (x, i) {
        var li = document.createElement('li'); li.setAttribute('role', 'option'); li.setAttribute('aria-selected', i === sel ? 'true' : 'false'); if (i === sel) li.className = 'sel';
        var a = document.createElement('a'); a.href = x.h; if (x.h.indexOf('http') === 0) a.rel = 'noopener';
        var c = document.createElement('span'), nl = document.createElement('span'); nl.className = 'nl'; nl.textContent = x.l; c.appendChild(nl);
        if (x.d) { var nd = document.createElement('span'); nd.className = 'nd'; nd.textContent = x.d; c.appendChild(nd); }
        var ng = document.createElement('span'); ng.className = 'ng'; ng.textContent = x.g;
        a.appendChild(c); a.appendChild(ng); li.appendChild(a); ul.appendChild(li);
      });
    }
    function ouvrir() { fermerMenu(); dlg.hidden = false; inp.value = ''; sel = 0; rendre(); setTimeout(function () { inp.focus(); }, 0); }
    function fermer() { if (dlg.hidden) return; dlg.hidden = true; try { sb.focus(); } catch (e) {} }
    sb.addEventListener('click', function (e) { e.stopPropagation(); ouvrir(); });
    inp.addEventListener('input', function () { sel = 0; rendre(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (vus.length) { sel = (sel + 1) % vus.length; rendre(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (vus.length) { sel = (sel - 1 + vus.length) % vus.length; rendre(); } }
      else if (e.key === 'Enter') { e.preventDefault(); if (vus[sel]) location.href = vus[sel].h; }
    });
    dlg.addEventListener('click', function (e) { if (!e.target.closest('.boite')) fermer(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { fermer(); return; }
      var k = (e.key || '').toLowerCase(), champ = e.target && (e.target.isContentEditable || /^(input|textarea|select)$/i.test(e.target.tagName));
      if ((k === 'k' && (e.ctrlKey || e.metaKey)) || (k === '/' && !champ && !e.ctrlKey && !e.metaKey && !e.altKey)) { e.preventDefault(); if (dlg.hidden) ouvrir(); else fermer(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
