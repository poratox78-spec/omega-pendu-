// ===== OMEGA Dys — « Police de son » dans la DICTÉE (OFF par défaut, additif R66) =====
// N'altère PAS le panneau dictée : ajoute une case dans la rangée de réglages existante et
// habille les `.vdd-truth` déjà rendues (MutationObserver). Le TEXTE DOM reste identique —
// seuls des <span> d'habillage (graisse par phonème via OmegaDysSonCore + g2p moteur).
// Polices : blocs base64 embarqués (omegadys-b64-*), chargées PARESSEUSEMENT (0 coût si OFF).
(function () {
  'use strict';
  if (typeof _DECL2 === 'undefined' || !_DECL2 || typeof _DECL2.g2p !== 'function') return;
  if (typeof OmegaDysSonCore === 'undefined' || typeof FontFace === 'undefined') return;
  var on = false;
  try { on = localStorage.getItem('vdd_son') === '1'; } catch (e) {}
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
  function renderInto(span) {
    var txt = span.textContent;
    span.setAttribute('data-son', '1');
    if (!txt) return;
    var frag = document.createDocumentFragment();
    OmegaDysSonCore.sentenceSegments(txt, _DECL2.g2p).forEach(function (m) {
      if (m.raw !== undefined) { frag.appendChild(document.createTextNode(m.raw)); return; }
      m.segs.forEach(function (seg) {
        var sp = document.createElement('span');
        sp.textContent = seg.g;                          // textContent : jamais de HTML injecté
        sp.style.fontFamily = FAM[seg.cls] || FAM.n;
        sp.style.fontSize = '1.14em';
        if (seg.cls === 'mute') sp.style.color = '#5f6672';   // gris FONCÉ lisible (BDA : pas de gris faible) ; luminosité = daltonien-safe
        sp.title = seg.ph ? '/' + seg.ph + '/' : 'muette';
        frag.appendChild(sp);
      });
    });
    span.textContent = '';
    span.appendChild(frag);
  }
  function sweep() {
    if (!on) return;
    loadFonts();
    var list = document.querySelectorAll('#vdd-card .vdd-truth:not([data-son])');
    for (var i = 0; i < list.length; i++) renderInto(list[i]);
  }
  var card = document.getElementById('vdd-card');
  if (!card) return;                                     // panneau dictée absent → inerte
  new MutationObserver(sweep).observe(card, {childList: true, subtree: true});
  var rows = card.querySelectorAll('.vdd-row'), row = null, i;
  for (i = 0; i < rows.length; i++) if (rows[i].querySelector('#vdd-lisible')) row = rows[i];
  if (row) {
    var lab = document.createElement('label');
    lab.className = 'vdd-sc';
    lab.title = 'La phrase correcte s’affiche en police OMEGA Dys : phonème voisé = épais, sourd = fin, lettre muette = grisée. Le texte ne change pas (habillage seulement).';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'vdd-son';
    cb.checked = on;
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(' Police de son'));
    row.appendChild(document.createTextNode(' '));
    row.appendChild(lab);
    cb.addEventListener('change', function () {
      on = cb.checked;
      try { localStorage.setItem('vdd_son', on ? '1' : '0'); } catch (e) {}
      if (on) sweep();
    });
  }
})();
