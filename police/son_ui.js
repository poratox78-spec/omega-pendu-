// ===== OMEGA Dys — « Police de son » dans l'app : DICTÉE + CORRECTEUR (OFF par défaut, additif R66) =====
// N'altère AUCUN panneau : ajoute ses contrôles dans les rangées de réglages existantes et habille
// des conteneurs déjà rendus (MutationObserver). On ne remplace que des NŒUDS TEXTE par des <span>
// d'habillage → la structure DOM (boutons, [data-key], cartes) et le texte restent identiques.
// SAISIE (#vdc-in, contenteditable) : le correcteur réécrit déjà son innerHTML à chaque correction
// (curseur restauré par OFFSET TEXTE) ; on habille après lui de la même façon, curseur sauvé/restauré.
// Couleurs : décidées par la LUMINOSITÉ du fond réel (thème clair/sombre, encadrés) — la muette
// reste lisible partout ; syllabes = alternance de teinte (Okabe-Ito), jamais seul canal.
// Réglages partagés : `vdd_son` (police de son) et `vdd_syl` (syllabes, même clé que la dictée).
(function () {
  'use strict';
  if (typeof _DECL2 === 'undefined' || !_DECL2 || typeof _DECL2.g2p !== 'function') return;
  if (typeof OmegaDysSonCore === 'undefined' || typeof FontFace === 'undefined') return;
  var KEY = 'vdd_son', KEY_SYL = 'vdd_syl', MAX_CHARS = 4000;   // au-delà : abstention (texte intact)
  var on = false, syl = false;
  try { on = localStorage.getItem(KEY) === '1'; syl = localStorage.getItem(KEY_SYL) === '1'; } catch (e) {}
  var css = document.createElement('style');
  css.textContent =
    '.son-seg{font-size:1.14em}' +
    '.son-mute{color:#a34700}.son-mute.son-on-dark{color:#f0a04b}' +            // muette = VERMILLON Okabe-Ito (clair/sombre) — le gris était pénible ; paire daltonien-sûre avec le bleu des syllabes
    '.son-syl{color:#0072b2}.son-syl.son-on-dark{color:#6cc0f0}' +               // syllabe impaire : bleu Okabe-Ito (clair/sombre)
    '.son-syl.son-mute{color:#a34700}.son-syl.son-mute.son-on-dark{color:#f0a04b}';
  document.head.appendChild(css);
  var loaded = false;
  function loadFonts() {
    if (loaded) return;
    loaded = true;
    [['omegadys-b64-regular', 'OMEGA Dys'], ['omegadys-b64-light', 'OMEGA Dys Light'],
     ['omegadys-b64-heavy', 'OMEGA Dys Heavy']].forEach(function (p) {
      try {
        var el = document.getElementById(p[0]);
        var b = el ? el.textContent.replace(/\s+/g, '') : '';
        if (!b) return;
        var bin = atob(b), u8 = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        var f = new FontFace(p[1], u8.buffer);
        f.load().then(function (ff) { document.fonts.add(ff); }).catch(function () {});
      } catch (e) {}
    });
  }
  var FAM = {voi: "'OMEGA Dys Heavy',monospace", srd: "'OMEGA Dys Light',monospace",
             n: "'OMEGA Dys',monospace", mute: "'OMEGA Dys',monospace"};
  function isDarkBg(el) {                                // fond RÉEL derrière le texte (remonte jusqu'à un fond opaque)
    try {
      for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
        var bg = getComputedStyle(n).backgroundColor, m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(bg || '');
        if (!m || (m[4] !== undefined && parseFloat(m[4]) === 0)) continue;
        var L = (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
        return L < 0.5;
      }
    } catch (e) {}
    return document.body.classList.contains('dys-dark');
  }
  var cache = {};
  function segsOf(word) {
    if (!cache[word]) {
      var s = OmegaDysSonCore.wordSegments(word, _DECL2.g2p);
      var idx = OmegaDysSonCore.syllableIndex(s);
      for (var i = 0; i < s.length; i++) s[i].syl = idx[i];
      cache[word] = s;
    }
    return cache[word];
  }
  function fragmentFor(text, dark, withSyl) {
    var frag = document.createDocumentFragment();
    OmegaDysSonCore.sentenceSegments(text, _DECL2.g2p).forEach(function (m) {
      if (m.raw !== undefined) { frag.appendChild(document.createTextNode(m.raw)); return; }
      segsOf(m.mot).forEach(function (seg) {
        var sp = document.createElement('span');
        sp.textContent = seg.g;                          // textContent : jamais de HTML injecté
        sp.setAttribute('data-son', seg.cls);
        sp.className = 'son-seg' + (seg.cls === 'mute' ? ' son-mute' : '') + (withSyl && (seg.syl % 2) ? ' son-syl' : '') + (dark ? ' son-on-dark' : '');
        sp.style.fontFamily = FAM[seg.cls] || FAM.n;
        sp.title = (seg.ph ? '/' + seg.ph + '/' : 'muette') + (withSyl ? ' · syllabe ' + (seg.syl + 1) : '');
        frag.appendChild(sp);
      });
    });
    return frag;
  }
  // ---- curseur (contenteditable) : offset texte, comme _ceCaret/_ceSetCaret du correcteur ----
  function caretOff(el) {
    var s = window.getSelection();
    if (!s || !s.rangeCount) return null;
    var r = s.getRangeAt(0);
    if (!el.contains(r.endContainer)) return null;
    var pre = r.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(r.endContainer, r.endOffset);
    return pre.toString().length;
  }
  function setCaret(el, off) {
    if (off == null) return;
    var s = window.getSelection(), r = document.createRange(), cnt = 0, done = false;
    (function w(n) {
      for (var c = n.firstChild; c && !done; c = c.nextSibling) {
        if (c.nodeType === 3) {
          var L = c.nodeValue.length;
          if (cnt + L >= off) { r.setStart(c, off - cnt); r.collapse(true); done = true; return; }
          cnt += L;
        } else w(c);
      }
    })(el);
    if (!done) { r.selectNodeContents(el); r.collapse(false); }
    s.removeAllRanges();
    s.addRange(r);
  }
  var busy = false, composing = false;
  function habiller(container, opts) {                   // remplace les nœuds TEXTE seulement ; idempotent
    opts = opts || {};
    if (!on || !container || busy || composing) return;
    if (container.querySelector('span[data-son]')) return;          // déjà habillé (rendu externe inchangé)
    var all = container.textContent || '';
    if (!all.trim() || all.length > MAX_CHARS) return;
    loadFonts();
    busy = true;
    try {
      var off = opts.caret ? (opts.off != null ? opts.off : caretOff(container)) : null;   // sélection DANS le champ (même règle que _ceCaret) ; opts.off = offset sauvé AVANT un déshabillage
      var dark = isDarkBg(container), withSyl = syl && !opts.noSyl;
      var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null), nodes = [], n;
      while ((n = walker.nextNode())) if (n.nodeValue && /[A-Za-zÀ-ÿœ]/.test(n.nodeValue)) nodes.push(n);
      nodes.forEach(function (tn) { tn.parentNode.replaceChild(fragmentFor(tn.nodeValue, dark, withSyl), tn); });
      if (off != null) setCaret(container, off);
    } finally { busy = false; }
  }
  function deshabiller(container) {                      // retire les spans (texte inchangé) pour re-rendre
    if (!container) return;
    var L = container.querySelectorAll('span[data-son]');
    for (var i = 0; i < L.length; i++) L[i].parentNode.replaceChild(document.createTextNode(L[i].textContent), L[i]);
    container.normalize();
  }
  var APERCU = 'Aperçu : poison · poisson · les petits chats blancs · un gâteau';
  function apercu(id, parent) {
    var el = document.getElementById(id);
    if (!on) { if (el) el.style.display = 'none'; return; }
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = 'vdd-sc';
      el.style.cssText = 'margin-top:6px;font-size:17px;line-height:1.8';
      parent.appendChild(el);
    }
    el.style.display = '';
    deshabiller(el);
    el.textContent = APERCU;
    habiller(el);
  }
  var controls = [], refreshers = [];
  function refreshAll() { refreshers.forEach(function (f) { f(); }); }
  function setOn(v) {
    on = !!v;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    controls.forEach(function (c) { c(on, syl); });
    refreshAll();
  }
  function setSyl(v) {
    syl = !!v;
    try { localStorage.setItem(KEY_SYL, syl ? '1' : '0'); } catch (e) {}
    controls.forEach(function (c) { c(on, syl); });
    refreshAll();
  }

  // ---- DICTÉE : case + aperçu + phrase correcte (.vdd-truth ; syllabes = option native du panneau) ----
  var card = document.getElementById('vdd-card');
  if (card) {
    var rows = card.querySelectorAll('.vdd-row'), row = null, i;
    for (i = 0; i < rows.length; i++) if (rows[i].querySelector('#vdd-lisible')) row = rows[i];
    if (row) {
      var lab = document.createElement('label');
      lab.className = 'vdd-sc';
      lab.title = 'Police de son OMEGA Dys : phonème voisé = épais, sourd = fin, lettre muette = vermillon. Le texte ne change pas (habillage seulement).';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'vdd-son';
      cb.checked = on;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(' Police de son'));
      row.appendChild(document.createTextNode(' '));
      row.appendChild(lab);
      cb.addEventListener('change', function () { setOn(cb.checked); });
      controls.push(function (v) { cb.checked = v; });
      var hostA = document.createElement('div');
      row.parentNode.insertBefore(hostA, row.nextSibling);
      refreshers.push(function () {
        apercu('vdd-son-apercu', hostA);
        if (on) { var L = card.querySelectorAll('.vdd-truth'); for (var k = 0; k < L.length; k++) habiller(L[k], {noSyl: true}); }
      });
    }
    // SAISIE dictée (#vdd-ans, contenteditable depuis 2026-08-21) : personne ne la réécrit → on ré-habille
    // nous-mêmes 300 ms après la frappe, curseur préservé (offset sauvé AVANT le déshabillage).
    var ans = document.getElementById('vdd-ans'), tAns = null;
    if (ans && ans.isContentEditable) {
      var rehab = function () { if (!on) return; var off = caretOff(ans); deshabiller(ans); habiller(ans, {caret: true, off: off}); };
      ans.addEventListener('input', function () { clearTimeout(tAns); tAns = setTimeout(rehab, 300); });
      refreshers.push(function () {
        var off = caretOff(ans);
        deshabiller(ans);
        if (on) habiller(ans, {caret: true, off: off}); else if (off != null) setCaret(ans, off);
      });
    }
    new MutationObserver(function () {
      if (!on) return;
      var L = card.querySelectorAll('.vdd-truth');
      for (var k = 0; k < L.length; k++) habiller(L[k], {noSyl: true});
    }).observe(card, {childList: true, subtree: true});
  }

  // ---- CORRECTEUR : boutons (police de son, syllabes) + SAISIE (#vdc-in) + texte corrigé (#vdc-result) ----
  var set = document.getElementById('vdc-set'), res = document.getElementById('vdc-result'), zin = document.getElementById('vdc-in');
  if (set) {
    function mkBtn(id, label, title, handler) {
      var b = document.createElement('button');
      b.type = 'button';
      b.id = id;
      b.title = title;
      b.textContent = label;
      set.appendChild(b);
      b.addEventListener('click', handler);
      return b;
    }
    var bt = mkBtn('vdc-son', '🔡 Police de son', 'Police de son OMEGA Dys dans la saisie et le texte corrigé : voisé = épais, sourd = fin, muette = vermillon (texte inchangé)', function () { setOn(!on); });
    var bs = mkBtn('vdc-syl', '✂️ Syllabes', 'Alterne la couleur des syllabes (règle de l’attaque maximale) — avec la police de son', function () { setSyl(!syl); if (!on && syl) setOn(true); });
    controls.push(function (v, w) { bt.setAttribute('aria-pressed', v ? 'true' : 'false'); bs.setAttribute('aria-pressed', w ? 'true' : 'false'); });
    var hostB = document.createElement('div');
    set.parentNode.insertBefore(hostB, set.nextSibling);
    refreshers.push(function () {
      apercu('vdc-son-apercu', hostB);
      if (res) { deshabiller(res); if (on) habiller(res); }
      if (zin) { var off = caretOff(zin); deshabiller(zin); if (on) habiller(zin, {caret: true, off: off}); else if (off != null) setCaret(zin, off); }
    });
    if (res) new MutationObserver(function () { habiller(res); }).observe(res, {childList: true, subtree: true});
    if (zin) {
      zin.addEventListener('compositionstart', function () { composing = true; });
      zin.addEventListener('compositionend', function () { composing = false; });
      // après chaque réécriture du correcteur (innerHTML neuf, sans nos spans) → habiller, curseur préservé
      new MutationObserver(function (muts) {
        for (var k = 0; k < muts.length; k++) if (muts[k].type === 'childList') { habiller(zin, {caret: true}); return; }
      }).observe(zin, {childList: true, subtree: true});
    }
  }
  controls.forEach(function (c) { c(on, syl); });
  refreshAll();
})();
