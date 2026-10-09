// ===== OMEGA Dys — « 🔡 » de l'en-tête : la POLICE DE SON sur le texte des PAGES du site (chargé par nav.js) =====
// ⭐ 10/10/2026 — Rem a demandé pourquoi le site n'avait pas les couleurs des syllabes et des sons. Le correcteur, la dictée et la page
// « Police de son » habillaient LEUR texte ; les pages du site, non. Ici, le texte À LIRE de chaque page (paragraphes,
// listes, titres, tableaux, citations) reçoit la police de son : voisé épais, sourd fin, muette vermillon, syllabes
// alternées. Même cœur (son_core.js), même g2p (extension/assets/g2p.js), mêmes couleurs Okabe-Ito que l'outil.
// Réglages PARTAGÉS avec l'app (vdd_son, vdd_syl) : un seul choix, partout.
// LE TEXTE NE CHANGE JAMAIS : un nœud texte est remplacé par <span class="son-txt"> qui porte exactement les mêmes
// caractères (vérifié avant de remplacer) ; éteindre remet un nœud texte au même endroit. En-tête, champs, boutons,
// code, cadres (l'app a son propre habillage) : jamais touchés.
// Paresseux : un bloc n'est habillé que lorsqu'il approche de l'écran (IntersectionObserver), et les blocs ajoutés
// plus tard par la page (résultats du solveur…) le sont à leur tour.
var OmegaSonSite = (function () {
  'use strict';
  var BLOC = 'p,li,h1,h2,h3,h4,h5,h6,dt,dd,td,th,figcaption,blockquote,summary,caption';
  var SKIP = 'script,style,noscript,textarea,input,select,option,button,code,pre,kbd,samp,var,svg,math,canvas,iframe,'
           + 'template,header.top,.a11y,[contenteditable],[aria-hidden="true"],[data-son],.son-txt,#pds-out,.pds-legende';
  var LETTRE = /[A-Za-zÀ-ÿœŒæÆ]/;
  var on = false, syl = false, io = null, mo = null, css = null, polices = false;

  function pret() {
    return typeof OmegaDysSonCore !== 'undefined' && OmegaDysSonCore &&
           typeof _DECL2 !== 'undefined' && _DECL2 && typeof _DECL2.g2p === 'function';
  }
  /* LES TROIS POLICES, comme la page « Police de son ». ⚠ `weight: '1 1000'` : sans la plage, le navigateur
     SYNTHÉTISE le gras dans un <strong> et le voisement s'inverse (le Light plus encré que le Heavy). */
  function chargerPolices() {
    if (polices) return;
    polices = true;
    [['OMEGA Dys', '/police/OmegaDys-Regular.ttf'], ['OMEGA Dys Light', '/police/OmegaDys-Light.ttf'],
     ['OMEGA Dys Heavy', '/police/OmegaDys-Heavy.ttf']].forEach(function (p) {
      try {
        var f = new FontFace(p[0], 'url(' + p[1] + ')', { weight: '1 1000' });
        f.load().then(function (ff) { document.fonts.add(ff); }).catch(function () {});
      } catch (e) {}
    });
  }
  /* Couleurs RECOPIÉES de police/son_ui.js, extension/son_panel.js et police-de-son.html (parity_son les compare).
     Le site a deux thèmes (html[data-theme], posé par nav.js) : la variante sombre suit le thème. */
  function styles() {
    if (css) return;
    css = document.createElement('style');
    css.id = 'son-site-css';
    css.textContent =
      '.son-txt .son-seg{font-size:1.14em;font-family:"OMEGA Dys",monospace}' +
      '.son-txt .son-seg[data-son="voi"]{font-family:"OMEGA Dys Heavy",monospace}' +
      '.son-txt .son-seg[data-son="srd"]{font-family:"OMEGA Dys Light",monospace}' +
      '.son-txt .son-mute{color:#a34700}' +
      '.son-txt .son-syl{color:#0072b2}' +
      '.son-txt .son-syl.son-mute{color:#a34700}' +
      'html[data-theme="dark"] .son-txt .son-mute{color:#f0a04b}' +
      'html[data-theme="dark"] .son-txt .son-syl{color:#6cc0f0}' +
      'html[data-theme="dark"] .son-txt .son-syl.son-mute{color:#f0a04b}';
    document.head.appendChild(css);
  }

  function admissible(tn) {
    if (!tn.nodeValue || !LETTRE.test(tn.nodeValue)) return false;
    var p = tn.parentElement;
    return !!p && !p.isContentEditable && !p.closest(SKIP);
  }
  function habillerNoeud(tn) {
    var t = tn.nodeValue, w = document.createElement('span');
    w.className = 'son-txt';
    OmegaDysSonCore.sentenceSegments(t, _DECL2.g2p).forEach(function (m) {
      if (m.raw !== undefined) { w.appendChild(document.createTextNode(m.raw)); return; }
      var idx = null;
      try { idx = OmegaDysSonCore.syllableIndex(m.segs); } catch (e) {}
      m.segs.forEach(function (sg, k) {
        var sp = document.createElement('span');
        /* syllabes IMPAIRES, comme l'extension, l'app et la page « Police de son » */
        sp.className = 'son-seg' + (sg.cls === 'mute' ? ' son-mute' : '') + (syl && idx && idx[k] % 2 === 1 ? ' son-syl' : '');
        sp.setAttribute('data-son', sg.cls);
        sp.textContent = sg.g;                           // textContent : jamais de HTML injecté
        w.appendChild(sp);
      });
    });
    if (w.textContent !== t) return;                     // garde : si le découpage a perdu une lettre, on ne touche à rien
    tn.parentNode.replaceChild(w, tn);
  }
  function habillerBloc(b) {
    if (!on || !pret() || !b.isConnected) return;
    var walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, null), L = [], n;
    while ((n = walker.nextNode())) if (admissible(n)) L.push(n);
    L.forEach(function (tn) { try { habillerNoeud(tn); } catch (e) {} });
  }
  function surveiller(root) {
    if (!io || !root || root.nodeType !== 1) return;
    if (root.matches(BLOC)) io.observe(root);
    var L = root.querySelectorAll(BLOC);
    for (var i = 0; i < L.length; i++) io.observe(L[i]);
  }
  function allumer() {
    if (io || !pret()) return;
    chargerPolices();
    styles();
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); habillerBloc(e.target); } });
    }, { rootMargin: '600px 0px' });
    surveiller(document.body);
    mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        for (var i = 0; i < m.addedNodes.length; i++) {
          var a = m.addedNodes[i];
          if (a.nodeType === 1 && !a.classList.contains('son-txt')) surveiller(a);
          else if (a.nodeType === 3 && a.parentElement && !a.parentElement.closest('.son-txt')) {
            var b = a.parentElement.closest(BLOC);
            if (b && io) io.observe(b);
          }
        }
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  function eteindre() {
    if (io) { io.disconnect(); io = null; }
    if (mo) { mo.disconnect(); mo = null; }
    var L = document.querySelectorAll('span.son-txt');
    for (var i = 0; i < L.length; i++) {
      var w = L[i];
      if (w.parentNode) w.parentNode.replaceChild(document.createTextNode(w.textContent), w);
    }
  }
  /* set(son, syllabes) : un changement de réglage ré-habille tout (le texte d'origine d'abord, puis le nouvel habillage). */
  function set(v, s) {
    v = !!v; s = !!s;
    if (v === on && s === syl && (io || !v)) return;
    eteindre();
    on = v; syl = s;
    if (on) allumer();
  }
  /* tout() : habille tous les blocs d'un coup, sans attendre l'écran (sondes, page qu'on va imprimer). */
  function tout() {
    if (!on) return;
    var L = document.querySelectorAll(BLOC);
    for (var i = 0; i < L.length; i++) habillerBloc(L[i]);
  }
  return { set: set, pret: pret, tout: tout };
})();
