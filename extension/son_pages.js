// son_pages.js — « 🎨 Couleurs sur les sites » (case du panneau, clé chrome.storage.local omSonSites). Content script.
// ⭐ 10/10/2026 — demande de Rem : les couleurs des syllabes et des sons manquaient sur le site ET dans l'extension, hors du
// panneau. Le site habille ses propres pages (police/son_site.js) ; ici ce sont les sites des AUTRES.
//
// ⚠ PRINCIPE : AUCUN caractère et AUCUN nœud de la page ne sont touchés. Couper un mot en <span> sur un site qu'on ne connaît
// pas casse les éditeurs, les formulaires et les sites React (qui mettent à jour LEURS nœuds texte : remplacés, la page se fige
// ou plante — le défaut connu des traducteurs de page). Chrome peint donc PAR-DESSUS le texte (CSS Custom Highlight API,
// ::highlight) avec des StaticRange : le DOM du site ne voit rien changer, et une StaticRange ne ralentit pas ses mutations.
// Ce que la peinture permet : la COULEUR (muette en vermillon, syllabes alternées en bleu — les couleurs Okabe-Ito du produit)
// et une OMBRE qui épaissit les sons voisés. Ce qu'elle ne permet pas : changer de police — les sourds ne s'amincissent pas
// (la police de son complète, épais ET fin, vit dans le panneau et sur le site).
// Texte À LIRE seulement (paragraphes, listes, titres, tableaux, citations) ; jamais les champs, le code, les boutons, les
// icônes ; pages en français (ou sans langue déclarée) : le g2p est français. Paresseux : un bloc n'est peint que lorsqu'il
// approche de l'écran ; un texte modifié par le site est repeint.
(function () {
  'use strict';
  if (typeof CSS === 'undefined' || !CSS.highlights || typeof Highlight === 'undefined' || typeof StaticRange === 'undefined') return;
  if (typeof OmegaDysSonCore === 'undefined' || typeof _DECL2 === 'undefined' || !_DECL2 || typeof _DECL2.g2p !== 'function') return;

  var BLOC = 'p,li,h1,h2,h3,h4,h5,h6,dt,dd,td,th,figcaption,blockquote,summary,caption';
  var SKIP = 'script,style,noscript,textarea,input,select,option,button,code,pre,kbd,samp,var,svg,math,canvas,iframe,template,'
           + '[contenteditable],[aria-hidden="true"],[class*="icon"],[class*="Icon"],[class*="material"],[class*="glyph"],'
           + '[class*="fa-"],.omdys-bar';
  var LETTRE = /[A-Za-zÀ-ÿœŒæÆ]/;
  var EPAIS = 'text-shadow:.025em 0 0 currentColor,-.025em 0 0 currentColor';
  // nom → règle ; « d » = variante pour texte CLAIR sur fond sombre (mêmes paires que son_ui.js / sidepanel.html)
  var REGLES = {
    'omdys-v': EPAIS,
    'omdys-s': 'color:#0072b2', 'omdys-vs': 'color:#0072b2;' + EPAIS, 'omdys-m': 'color:#a34700',
    'omdys-sd': 'color:#6cc0f0', 'omdys-vsd': 'color:#6cc0f0;' + EPAIS, 'omdys-md': 'color:#f0a04b'
  };
  var H = null, css = null, io = null, mo = null, parNoeud = new Map(), vus = new WeakSet(), nettoyage = 0;

  function francais(el) {
    var l = el.closest('[lang]');
    var v = (l ? l.getAttribute('lang') : '') || '';
    return !v || /^fr\b/i.test(v);
  }
  function admissible(tn) {
    if (!tn.nodeValue || !LETTRE.test(tn.nodeValue)) return false;
    var p = tn.parentElement;
    return !!p && !p.isContentEditable && !p.closest(SKIP) && francais(p);
  }
  function sombre(el) {                                  // texte CLAIR ⇒ fond sombre : on prend la variante claire des couleurs
    try {
      var m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(getComputedStyle(el).color || '');
      return !!m && (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 > 0.5;
    } catch (e) { return false; }
  }
  function retirer(tn) {
    var L = parNoeud.get(tn);
    if (!L) return;
    for (var i = 0; i < L.length; i++) H[L[i][0]].delete(L[i][1]);
    parNoeud.delete(tn);
  }
  function peindreNoeud(tn, fonce) {
    retirer(tn);
    var t = tn.nodeValue, pos = 0, morceaux = [], dernier = null;
    OmegaDysSonCore.sentenceSegments(t, _DECL2.g2p).forEach(function (m) {
      if (m.raw !== undefined) { pos += m.raw.length; dernier = null; return; }
      var idx = null;
      try { idx = OmegaDysSonCore.syllableIndex(m.segs); } catch (e) {}
      m.segs.forEach(function (sg, k) {
        var n = sg.g.length, impair = !!idx && idx[k] % 2 === 1, nom = null;
        if (sg.cls === 'mute') nom = 'omdys-m';                       // la muette prime sur la syllabe, comme partout
        else if (sg.cls === 'voi') nom = impair ? 'omdys-vs' : 'omdys-v';
        else if (impair) nom = 'omdys-s';
        if (nom && fonce && nom !== 'omdys-v') nom += 'd';
        if (nom && dernier && dernier[0] === nom && dernier[2] === pos) dernier[2] = pos + n;   // segments voisins fusionnés
        else if (nom) { dernier = [nom, pos, pos + n]; morceaux.push(dernier); }
        else dernier = null;
        pos += n;
      });
    });
    if (pos !== t.length) return;                         // découpage incohérent : on ne peint rien plutôt que faux
    var L = morceaux.map(function (x) {
      var r = new StaticRange({ startContainer: tn, startOffset: x[1], endContainer: tn, endOffset: x[2] });
      H[x[0]].add(r);
      return [x[0], r];
    });
    if (L.length) parNoeud.set(tn, L);
  }
  function peindreBloc(b) {
    if (!H || !b.isConnected) return;
    vus.add(b);
    var fonce = sombre(b), walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, null), L = [], n;
    while ((n = walker.nextNode())) if (admissible(n)) L.push(n);
    L.forEach(function (tn) { try { peindreNoeud(tn, fonce); } catch (e) {} });
  }
  function surveiller(root) {
    if (!io || !root || root.nodeType !== 1) return;
    if (root.matches(BLOC)) io.observe(root);
    var L = root.querySelectorAll(BLOC);
    for (var i = 0; i < L.length; i++) io.observe(L[i]);
  }
  function texteChange(tn) {                             // le site a écrit dans un nœud texte : on le repeint (ou on l'efface)
    retirer(tn);
    var p = tn.parentElement, b = p && p.closest(BLOC);
    if (!b) return;
    if (vus.has(b)) { if (admissible(tn)) try { peindreNoeud(tn, sombre(b)); } catch (e) {} }
    else io.observe(b);
  }
  function nettoyer() {                                  // nœuds retirés par le site : on libère leurs zones peintes
    nettoyage = 0;
    parNoeud.forEach(function (L, tn) { if (!tn.isConnected) retirer(tn); });
  }
  function allumer() {
    if (H) return;
    H = {};
    var regles = '';
    Object.keys(REGLES).forEach(function (nom) {
      H[nom] = new Highlight();
      CSS.highlights.set(nom, H[nom]);
      regles += '::highlight(' + nom + '){' + REGLES[nom] + '}';
    });
    css = document.createElement('style');
    css.id = 'omdys-son-pages';
    css.textContent = regles;
    (document.head || document.documentElement).appendChild(css);
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); peindreBloc(e.target); } });
    }, { rootMargin: '600px 0px' });
    surveiller(document.body);
    mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'characterData') { texteChange(m.target); continue; }
        for (var j = 0; j < m.addedNodes.length; j++) {
          var a = m.addedNodes[j];
          if (a.nodeType === 1) surveiller(a);
          else if (a.nodeType === 3) texteChange(a);
        }
        if (m.removedNodes.length && !nettoyage) nettoyage = setTimeout(nettoyer, 1000);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  function eteindre() {
    if (!H) return;
    if (io) io.disconnect();
    if (mo) mo.disconnect();
    if (nettoyage) clearTimeout(nettoyage);
    Object.keys(H).forEach(function (nom) { CSS.highlights.delete(nom); });
    if (css && css.parentNode) css.parentNode.removeChild(css);
    H = css = io = mo = null; nettoyage = 0;
    parNoeud = new Map(); vus = new WeakSet();
  }
  function applique(v) { try { if (v && document.body) allumer(); else eteindre(); } catch (e) {} }
  // tout() : peint tous les blocs d'un coup (sonde de l'extension, page qu'on va imprimer)
  try { self.__omdysSonPages = { tout: function () { if (!H) return; var L = document.querySelectorAll(BLOC); for (var i = 0; i < L.length; i++) peindreBloc(L[i]); },
                                 compte: function () { if (!H) return 0; var n = 0; Object.keys(H).forEach(function (k) { n += H[k].size; }); return n; } }; } catch (e) {}
  try { chrome.storage.local.get(['omSonSites'], function (o) { applique(!!(o && o.omSonSites)); }); } catch (e) {}
  try { chrome.storage.onChanged.addListener(function (ch, area) { if (area === 'local' && ch.omSonSites) applique(!!ch.omSonSites.newValue); }); } catch (e) {}
})();
