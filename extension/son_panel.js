// son_panel.js — « POLICE DE SON » dans le PANNEAU LATÉRAL (chargé AVANT sidepanel.js).
// 1) SHIM : la zone de texte #omdys-ta est un contenteditable (ex-textarea, 2026-08-21) pour que la police
//    puisse habiller la SAISIE lettre à lettre. sidepanel.js continue d'utiliser l'API textarea
//    (value / selectionStart / selectionEnd / setSelectionRange / select) : on la fournit ici.
//    Entrée = retour à la ligne texte, collage en texte brut. Le texte reste le texte (textContent).
// 2) POLICE DE SON (OFF par défaut) : g2p du moteur (assets/g2p.js, extrait verbatim de l'app) +
//    cœur sans DOM (assets/son_core.js, identique à police/son_core.js) + 3 TTF — chargés PARESSEUSEMENT
//    à la première activation. On ne remplace que des NŒUDS TEXTE par des <span> : structure et texte intacts.
//    Surface PANNEAU seulement : on n'habille jamais un champ de site tiers (content.js n'est pas concerné).
(function () {
  'use strict';
  var ta = document.getElementById('omdys-ta');
  if (!ta || ta.tagName === 'TEXTAREA') return;

  // ---------- 1. shim API textarea ----------
  function offsetOf(node, off) {
    var pre = document.createRange();
    pre.selectNodeContents(ta);
    pre.setEnd(node, off);
    return pre.toString().length;
  }
  function selOffsets() {
    var s = window.getSelection();
    if (!s || !s.rangeCount) return null;
    var r = s.getRangeAt(0);
    if (!ta.contains(r.startContainer) || !ta.contains(r.endContainer)) return null;
    return [offsetOf(r.startContainer, r.startOffset), offsetOf(r.endContainer, r.endOffset)];
  }
  function posAt(off) {                                  // offset texte → (nœud texte, offset)
    var walker = document.createTreeWalker(ta, NodeFilter.SHOW_TEXT, null), n, cnt = 0, last = null;
    while ((n = walker.nextNode())) {
      var L = n.nodeValue.length;
      if (cnt + L >= off) return [n, off - cnt];
      cnt += L; last = n;
    }
    return last ? [last, last.nodeValue.length] : [ta, ta.childNodes.length];
  }
  function setSel(a, b) {
    var s = window.getSelection(), r = document.createRange(), p = posAt(a), q = posAt(b == null ? a : b);
    r.setStart(p[0], p[1]);
    r.setEnd(q[0], q[1]);
    s.removeAllRanges();
    s.addRange(r);
  }
  Object.defineProperty(ta, 'value', {configurable: true,
    get: function () { return this.textContent; },
    set: function (v) { this.textContent = (v == null ? '' : String(v)); }});
  Object.defineProperty(ta, 'selectionStart', {configurable: true, get: function () { var o = selOffsets(); return o ? o[0] : this.textContent.length; }});
  Object.defineProperty(ta, 'selectionEnd', {configurable: true, get: function () { var o = selOffsets(); return o ? o[1] : this.textContent.length; }});
  ta.setSelectionRange = function (a, b) { try { setSel(a, b); } catch (e) {} };
  ta.select = function () { try { setSel(0, this.textContent.length); } catch (e) {} };
  function insertText(txt) {
    var s = window.getSelection();
    if (!s || !s.rangeCount || !ta.contains(s.anchorNode)) { ta.textContent += txt; }
    else {
      var rg = s.getRangeAt(0);
      rg.deleteContents();
      var tn = document.createTextNode(txt);
      rg.insertNode(tn);
      rg.setStartAfter(tn);
      rg.collapse(true);
      s.removeAllRanges();
      s.addRange(rg);
    }
    ta.dispatchEvent(new Event('input', {bubbles: true}));
  }
  ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); insertText('\n'); } });
  ta.addEventListener('paste', function (e) {
    e.preventDefault();
    var t = '';
    try { t = (e.clipboardData || window.clipboardData).getData('text/plain'); } catch (_) {}
    if (t) insertText(t.replace(/\r\n?/g, '\n'));
  });

  // ---------- 2. police de son ----------
  var sonCb = document.getElementById('omdys-son'), sylCb = document.getElementById('omdys-syl'), corr = document.getElementById('omdys-corr');
  if (!sonCb || !sylCb) return;
  var on = false, syl = false;
  try { on = localStorage.getItem('omdys_son') === '1'; syl = localStorage.getItem('omdys_syl') === '1'; } catch (e) {}
  sonCb.checked = on;
  sylCb.checked = syl;
  var ready = false, loading = null;
  function loadScript(src) {
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  function ensure() {                                    // assets chargés UNE fois, à la première activation
    if (ready) return Promise.resolve();
    if (loading) return loading;
    loading = loadScript('assets/g2p.js').then(function () { return loadScript('assets/son_core.js'); }).then(function () {
      [['OMEGA Dys', 'assets/OmegaDys-Regular.ttf'], ['OMEGA Dys Light', 'assets/OmegaDys-Light.ttf'], ['OMEGA Dys Heavy', 'assets/OmegaDys-Heavy.ttf']].forEach(function (p) {
        /* ⭐ PLAGE de graisse : sans elle, chaque face n'existe qu'en 400 et le navigateur SYNTHÉTISE le
           gras dès qu'une lettre habillée tombe dans un <b> — or chaque mot corrigé EST un <b>. Mesuré :
           Light passe de 836 à 1263 pixels encrés, soit PLUS que Heavy (1242) : le voisement s'INVERSE.
           La largeur ne le voit pas (chasse fixe) ; il faut compter l'encre. La correction reste visible
           par le fond vert de `.out b`, qui ne dépend pas de la graisse. */
        try { var f = new FontFace(p[0], 'url(' + p[1] + ')', {weight: '1 1000'}); f.load().then(function (ff) { document.fonts.add(ff); }).catch(function () {}); } catch (e) {}
      });
      ready = !!(window._DECL2 && window._DECL2.g2p && window.OmegaDysSonCore);
    }).catch(function () { ready = false; });
    return loading;
  }
  var FAM = {voi: "'OMEGA Dys Heavy',monospace", srd: "'OMEGA Dys Light',monospace", n: "'OMEGA Dys',monospace", mute: "'OMEGA Dys',monospace"};
  function isDarkBg(el) {
    try {
      for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
        var bg = getComputedStyle(n).backgroundColor, m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(bg || '');
        if (!m || (m[4] !== undefined && parseFloat(m[4]) === 0)) continue;
        return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 < 0.5;
      }
    } catch (e) {}
    return document.body.classList.contains('dark');
  }
  var cache = {};
  function segsOf(word) {
    if (!cache[word]) {
      var s = window.OmegaDysSonCore.wordSegments(word, window._DECL2.g2p), idx = window.OmegaDysSonCore.syllableIndex(s);
      for (var i = 0; i < s.length; i++) s[i].syl = idx[i];
      cache[word] = s;
    }
    return cache[word];
  }
  function fragmentFor(text, dark) {
    var frag = document.createDocumentFragment();
    window.OmegaDysSonCore.sentenceSegments(text, window._DECL2.g2p).forEach(function (m) {
      if (m.raw !== undefined) { frag.appendChild(document.createTextNode(m.raw)); return; }
      segsOf(m.mot).forEach(function (seg) {
        var sp = document.createElement('span');
        sp.textContent = seg.g;
        sp.setAttribute('data-son', seg.cls);
        sp.className = 'son-seg' + (seg.cls === 'mute' ? ' son-mute' : '') + (syl && (seg.syl % 2) ? ' son-syl' : '') + (dark ? ' son-on-dark' : '');
        sp.style.fontFamily = FAM[seg.cls] || FAM.n;
        sp.title = (seg.ph ? '/' + seg.ph + '/' : 'muette') + (syl ? ' · syllabe ' + (seg.syl + 1) : '');
        frag.appendChild(sp);
      });
    });
    return frag;
  }
  var busy = false;
  function caretOff() { var o = selOffsets(); return o ? o[1] : null; }
  function habiller(container, keepCaret, off) {
    if (!on || !ready || !container || busy) return;
    if (container.querySelector('span[data-son]')) return;
    var all = container.textContent || '';
    if (!all.trim() || all.length > 4000) return;
    busy = true;
    try {
      if (keepCaret && off == null) off = caretOff();
      var dark = isDarkBg(container);
      var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null), nodes = [], n;
      while ((n = walker.nextNode())) if (n.nodeValue && /[A-Za-zÀ-ÿœ]/.test(n.nodeValue)) nodes.push(n);
      nodes.forEach(function (tn) { tn.parentNode.replaceChild(fragmentFor(tn.nodeValue, dark), tn); });
      if (keepCaret && off != null) setSel(off, off);
    } finally { busy = false; }
  }
  function deshabiller(container) {
    if (!container) return;
    var L = container.querySelectorAll('span[data-son]');
    for (var i = 0; i < L.length; i++) L[i].parentNode.replaceChild(document.createTextNode(L[i].textContent), L[i]);
    container.normalize();
  }
  function refresh() {
    var off = caretOff();
    deshabiller(ta);
    if (on) habiller(ta, true, off); else if (off != null) try { setSel(off, off); } catch (e) {}
    if (corr) { deshabiller(corr); if (on) habiller(corr); }
  }
  var tAns = null;
  ta.addEventListener('input', function () { clearTimeout(tAns); tAns = setTimeout(function () { if (on) refresh(); }, 300); });
  new MutationObserver(function (muts) {                 // ta.value = … (application d'une correction) → contenu neuf sans spans
    for (var k = 0; k < muts.length; k++) if (muts[k].type === 'childList' && !busy) { habiller(ta, true); return; }
  }).observe(ta, {childList: true, subtree: true});
  if (corr) new MutationObserver(function () { if (!busy) habiller(corr); }).observe(corr, {childList: true});
  sonCb.addEventListener('change', function () {
    on = sonCb.checked;
    try { localStorage.setItem('omdys_son', on ? '1' : '0'); } catch (e) {}
    if (on) ensure().then(refresh); else refresh();
  });
  sylCb.addEventListener('change', function () {
    syl = sylCb.checked;
    try { localStorage.setItem('omdys_syl', syl ? '1' : '0'); } catch (e) {}
    if (syl && !on) { on = true; sonCb.checked = true; try { localStorage.setItem('omdys_son', '1'); } catch (e) {} }
    if (on) ensure().then(refresh); else refresh();
  });
  if (on) ensure().then(refresh);
})();
