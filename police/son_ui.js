// ===== OMEGA Dys — « Police de son » dans l'app : DICTÉE + CORRECTEUR (OFF par défaut, additif R66) =====
// N'altère AUCUN panneau : ajoute ses contrôles dans les rangées de réglages existantes et habille
// des conteneurs déjà rendus (MutationObserver). On ne remplace que des NŒUDS TEXTE par des <span>
// d'habillage → la structure DOM (boutons, [data-key], cartes) et le texte restent identiques.
// Un seul réglage partagé (localStorage `vdd_son`) pour la case Dictée et le bouton Correcteur.
// Polices : blocs base64 embarqués (omegadys-b64-*), chargées PARESSEUSEMENT (0 coût si OFF).
(function () {
  'use strict';
  if (typeof _DECL2 === 'undefined' || !_DECL2 || typeof _DECL2.g2p !== 'function') return;
  if (typeof OmegaDysSonCore === 'undefined' || typeof FontFace === 'undefined') return;
  var KEY = 'vdd_son', MAX_CHARS = 4000;                 // au-delà : trop de spans par frappe → abstention (texte intact)
  var on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch (e) {}
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
  var cache = {};                                        // mot → segments (le g2p ne change pas en session)
  function segsOf(word) {
    if (!cache[word]) cache[word] = OmegaDysSonCore.wordSegments(word, _DECL2.g2p);
    return cache[word];
  }
  function fragmentFor(text) {
    var frag = document.createDocumentFragment();
    OmegaDysSonCore.sentenceSegments(text, _DECL2.g2p).forEach(function (m) {
      if (m.raw !== undefined) { frag.appendChild(document.createTextNode(m.raw)); return; }
      segsOf(m.mot).forEach(function (seg) {
        var sp = document.createElement('span');
        sp.textContent = seg.g;                          // textContent : jamais de HTML injecté
        sp.setAttribute('data-son', seg.cls);
        sp.style.fontFamily = FAM[seg.cls] || FAM.n;
        sp.style.fontSize = '1.14em';
        if (seg.cls === 'mute') sp.style.color = '#5f6672';   // gris FONCÉ lisible (BDA) ; luminosité = daltonien-safe
        sp.title = seg.ph ? '/' + seg.ph + '/' : 'muette';
        frag.appendChild(sp);
      });
    });
    return frag;
  }
  var busy = false;
  function habiller(container) {                         // remplace les nœuds TEXTE seulement ; idempotent
    if (!on || !container || busy) return;
    if (container.querySelector('span[data-son]')) return;          // déjà habillé (rendu externe inchangé)
    var all = container.textContent || '';
    if (!all.trim() || all.length > MAX_CHARS) return;
    loadFonts();
    busy = true;
    try {
      var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null), nodes = [], n;
      while ((n = walker.nextNode())) if (n.nodeValue && /[A-Za-zÀ-ÿœ]/.test(n.nodeValue)) nodes.push(n);
      nodes.forEach(function (tn) { tn.parentNode.replaceChild(fragmentFor(tn.nodeValue), tn); });
    } finally { busy = false; }
  }
  // ---- aperçu immédiat (voir l'effet sans attendre une faute) ----
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
    if (!el.querySelector('span[data-son]')) { el.textContent = ''; loadFonts(); el.appendChild(fragmentFor(APERCU)); }
  }
  var controls = [], refreshers = [];                    // synchronisation case Dictée ↔ bouton Correcteur
  function refreshAll() { refreshers.forEach(function (f) { f(); }); }
  function setOn(v) {
    on = !!v;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    controls.forEach(function (c) { c(on); });
    refreshAll();
  }

  // ---- DICTÉE : case dans la rangée « Police lisible / Syllabes / Vitesse » + phrase correcte (.vdd-truth) ----
  var card = document.getElementById('vdd-card');
  if (card) {
    var rows = card.querySelectorAll('.vdd-row'), row = null, i;
    for (i = 0; i < rows.length; i++) if (rows[i].querySelector('#vdd-lisible')) row = rows[i];
    if (row) {
      var lab = document.createElement('label');
      lab.className = 'vdd-sc';
      lab.title = 'Police de son OMEGA Dys : phonème voisé = épais, sourd = fin, lettre muette = grisée. Le texte ne change pas (habillage seulement).';
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
        if (on) { var L = card.querySelectorAll('.vdd-truth'); for (var k = 0; k < L.length; k++) habiller(L[k]); }
      });
    }
    new MutationObserver(function () {
      if (!on) return;
      var L = card.querySelectorAll('.vdd-truth');
      for (var k = 0; k < L.length; k++) habiller(L[k]);
    }).observe(card, {childList: true, subtree: true});
  }

  // ---- CORRECTEUR : bouton dans les réglages d'affichage + texte corrigé (#vdc-result) ----
  var set = document.getElementById('vdc-set'), res = document.getElementById('vdc-result');
  if (set) {
    var bt = document.createElement('button');
    bt.type = 'button';
    bt.id = 'vdc-son';
    bt.setAttribute('aria-pressed', on ? 'true' : 'false');
    bt.title = 'Police de son OMEGA Dys sur le texte corrigé : voisé = épais, sourd = fin, muette = grisée (texte inchangé)';
    bt.textContent = '🔡 Police de son';
    set.appendChild(bt);
    bt.addEventListener('click', function () { setOn(!on); });
    controls.push(function (v) { bt.setAttribute('aria-pressed', v ? 'true' : 'false'); });
    var hostB = document.createElement('div');
    set.parentNode.insertBefore(hostB, set.nextSibling);
    refreshers.push(function () { apercu('vdc-son-apercu', hostB); if (on && res) habiller(res); });
    if (res) new MutationObserver(function () { habiller(res); }).observe(res, {childList: true, subtree: true, characterData: true});
  }
  refreshAll();
})();
