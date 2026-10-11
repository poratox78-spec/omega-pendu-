// son_pages.js — « 🎨 Couleurs sur les sites » (case du panneau, clé chrome.storage.local omSonSites). Content script.
// ⭐ 09/10/2026 — demande de Rem : les couleurs des syllabes et des sons manquaient sur le site ET dans l'extension, hors du
// panneau. Le site habille ses propres pages (police/son_site.js) ; ici ce sont les sites des AUTRES.
//
// ⚠ PRINCIPE : AUCUN caractère et AUCUN nœud de la page ne sont touchés. Couper un mot en <span> sur un site qu'on ne connaît
// pas casse les éditeurs, les formulaires et les sites React (qui mettent à jour LEURS nœuds texte : remplacés, la page se fige
// ou plante — le défaut connu des traducteurs de page). Chrome peint donc PAR-DESSUS le texte (CSS Custom Highlight API,
// ::highlight) avec des StaticRange : le DOM du site ne voit rien changer, et une StaticRange ne ralentit pas ses mutations.
// Ce que la peinture permet : la COULEUR (muette en vermillon, syllabes alternées en bleu — les couleurs Okabe-Ito du produit)
// et une OMBRE qui épaissit les sons voisés. Ce qu'elle ne permet pas : changer de police — les sourds ne s'amincissent pas
// (la police de son complète, épais ET fin, vit dans le panneau et sur le site).
// Texte À LIRE : tout texte visible de la page — jamais les champs, le code, les boutons ni ce qui en a le rôle, les icônes ;
// pages en français (ou sans langue déclarée) : le g2p est français. Paresseux : un texte n'est peint que lorsqu'il approche de
// l'écran ; un texte ajouté ou modifié par le site est (re)peint.
// ⭐ 10/10/2026 — rapport de Rem : les couleurs manquaient sur des pages en français, Twitch par exemple. La 1re version ne regardait
// que les paragraphes, listes, titres, tableaux et citations ; Twitch (le chat, les bandeaux) et la plupart des applis web rangent
// leur texte dans des div/span. Mesuré sur twitch.tv (paquet réel, Chrome) : 9 messages du chat affichés, 0 zone peinte. On
// surveille désormais le PARENT de chaque morceau de texte, quelle que soit sa balise, et on peint ses textes directs.
(function () {
  'use strict';
  if (typeof CSS === 'undefined' || !CSS.highlights || typeof Highlight === 'undefined' || typeof StaticRange === 'undefined') return;
  if (typeof OmegaDysSonCore === 'undefined' || typeof _DECL2 === 'undefined' || !_DECL2 || typeof _DECL2.g2p !== 'function') return;

  var SKIP = 'script,style,noscript,textarea,input,select,option,button,code,pre,kbd,samp,var,svg,math,canvas,iframe,template,'
           + '[contenteditable],[aria-hidden="true"],[class*="icon"],[class*="Icon"],[class*="material"],[class*="glyph"],'
           + '[class*="fa-"],.omdys-bar,'
           + '[role="button"],[role="tab"],[role="menuitem"],[role="option"],[role="switch"],[role="checkbox"],[role="radio"],'
           + '[role="slider"],[role="textbox"],[role="searchbox"],[role="combobox"]';   // ce qui a le RÔLE d'un contrôle, même en div
  var LETTRE = /[A-Za-zÀ-ÿœŒæÆ]/;
  var EPAIS = 'text-shadow:.025em 0 0 currentColor,-.025em 0 0 currentColor';
  // nom → règle ; « d » = variante pour texte CLAIR sur fond sombre (mêmes paires que son_ui.js / sidepanel.html)
  var REGLES = {
    'omdys-v': EPAIS,
    'omdys-s': 'color:#0072b2', 'omdys-vs': 'color:#0072b2;' + EPAIS, 'omdys-m': 'color:#a34700',
    'omdys-sd': 'color:#6cc0f0', 'omdys-vsd': 'color:#6cc0f0;' + EPAIS, 'omdys-md': 'color:#f0a04b'
  };
  var H = null, css = null, io = null, mo = null, parNoeud = new Map(), vus = new WeakSet(), suivis = new WeakSet(), nettoyage = 0;

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
    // adresses web, mails, @pseudos, #mots-clés : pas du français à lire — on n'y peint rien (vu sur le chat de Twitch)
    var hors = [], mh, RX = /(?:https?:\/\/|www\.)\S+|\S+@\S+\.\w+|[@#][\w.-]+|\S+\.(?:com|fr|tv|gg|net|org|io)\S*/gi;
    while ((mh = RX.exec(t))) hors.push([mh.index, mh.index + mh[0].length]);
    var dehors = function (a) { for (var q = 0; q < hors.length; q++) if (a >= hors[q][0] && a < hors[q][1]) return true; return false; };
    OmegaDysSonCore.sentenceSegments(t, _DECL2.g2p).forEach(function (m) {
      if (m.raw !== undefined) { pos += m.raw.length; dernier = null; return; }
      if (dehors(pos)) { pos += m.mot.length; dernier = null; return; }
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
  function peindreBloc(b, fonce) {                      // b = un PARENT de texte : on peint ses textes DIRECTS (ses enfants ont leur tour)
    if (!H || !b.isConnected) return;
    vus.add(b);
    if (fonce === undefined) fonce = sombre(b);
    var c;
    for (c = b.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && admissible(c)) { try { peindreNoeud(c, fonce); } catch (e) {} }
  }
  /* ⭐ 10/10/2026 — PAR LOT : la couleur du texte (fond clair ou sombre) est lue pour TOUS les blocs d'abord, puis on peint.
     Lire un style juste après avoir ajouté des zones forçait Chrome à recalculer les styles de la page à CHAQUE bloc (mesuré sur
     une page de presse : 27 s pour tout peindre, bloc par bloc). */
  function peindreLot(L) {
    if (!H || !L.length) return;
    var f = L.map(function (b) { return b.isConnected ? sombre(b) : false; });
    L.forEach(function (b, k) { peindreBloc(b, f[k]); });
  }
  function suivre(tn) {                                  // le parent d'un texte admissible entre dans l'observateur (une fois)
    var p = tn.parentElement;
    if (!p || suivis.has(p) || !admissible(tn)) return;
    suivis.add(p);
    if (vus.has(p)) { try { peindreNoeud(tn, sombre(p)); } catch (e) {} } else io.observe(p);
  }
  function surveiller(root) {
    if (!io || !root || root.nodeType !== 1) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) suivre(n);
  }
  function texteChange(tn) {                             // le site a écrit dans un nœud texte : on le repeint (ou on l'efface)
    retirer(tn);
    var p = tn.parentElement;
    if (!p) return;
    if (vus.has(p)) { if (admissible(tn)) try { peindreNoeud(tn, sombre(p)); } catch (e) {} }
    else if (admissible(tn)) { suivis.add(p); io.observe(p); }
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
      var L = [];
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); L.push(e.target); } });
      peindreLot(L);
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
    parNoeud = new Map(); vus = new WeakSet(); suivis = new WeakSet();
  }
  function applique(v) { try { if (v && document.body) allumer(); else eteindre(); } catch (e) {} }
  // tout() : peint tous les blocs d'un coup (sonde de l'extension, page qu'on va imprimer)
  try { self.__omdysSonPages = { tout: function () { if (!H) return; var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n, P = new Set(); while ((n = w.nextNode())) if (n.parentElement) P.add(n.parentElement); peindreLot(Array.from(P)); },
                                 compte: function () { if (!H) return 0; var n = 0; Object.keys(H).forEach(function (k) { n += H[k].size; }); return n; } }; } catch (e) {}
  try { chrome.storage.local.get(['omSonSites'], function (o) { applique(!!(o && o.omSonSites)); }); } catch (e) {}
  try { chrome.storage.onChanged.addListener(function (ch, area) { if (area === 'local' && ch.omSonSites) applique(!!ch.omSonSites.newValue); }); } catch (e) {}
})();
