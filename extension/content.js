// content.js — correcteur dys EN PLACE dans n'importe quel champ. Réutilise dys-core.js (le moteur mesuré).
// Détecte les fautes du périmètre — GRAMMAIRE (homophones, accord sujet-verbe, genre déterminant, j'est→j'ai)
// ET ORTHOGRAPHE (non-mots/accents/typos : fenetre→fenêtre, leson→leçon, élision « c est »→« c'est ») —
// affiche une barre flottante près du champ : on clique pour corriger DANS le champ. Situe le stade dys + remédiation.
// FP=0 (mêmes règles que l'app/Python). Hors-ligne, aucune donnée envoyée.
(function () {
  'use strict';
  var DC = self.DYSCORE || window.DYSCORE;
  if (!DC) return;                       // moteur absent → inerte

  var CFG = { enabled: true };
  try { chrome.storage && chrome.storage.local.get(['enabled'], function (o) { if (o && typeof o.enabled === 'boolean') CFG.enabled = o.enabled; }); } catch (e) {}
  try { chrome.storage && chrome.storage.onChanged && chrome.storage.onChanged.addListener(function (ch) { if (ch.enabled) { CFG.enabled = ch.enabled.newValue; if (!CFG.enabled) hideBar(); else schedule(active); } }); } catch (e) {}

  // charge les lexiques depuis les assets de l'extension (fetch + DecompressionStream, comme l'app)
  try {
    var spellerUrl = chrome.runtime.getURL('assets/speller.tsv.gz');
    DC.loadLex({
      vdc: chrome.runtime.getURL('assets/vdc-lex.json'),
      genderRelaxed: chrome.runtime.getURL('assets/gender-relaxed.tsv.gz'),
      speller: spellerUrl
    }).then(function () { if (active) schedule(active); });
    if (DC.loadSpellerLex) DC.loadSpellerLex(spellerUrl).then(function () { if (active) schedule(active); });  // re-render quand l'orthographe (non-mots/accents) est prête
  } catch (e) {}

  // ===== cible éditable =====
  var INPUT_OK = { text: 1, search: 1, email: 1, url: 1, tel: 1, '': 1 };
  function isEditable(el) {
    if (!el || el.disabled || el.readOnly) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') return !!INPUT_OK[(el.type || '').toLowerCase()];
    if (el.isContentEditable) return true;
    return false;
  }
  function getText(el) {
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input') return el.value;
    return el.innerText || '';
  }
  function setText(el, txt, caret) {
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input') {
      el.value = txt;
      try { if (caret != null) el.setSelectionRange(caret, caret); } catch (e) {}
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {                              // contenteditable (plein texte ; éditeurs riches = best-effort)
      el.textContent = txt;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // ===== application des corrections (réutilise le découpage tokens du moteur) =====
  var TOKRE = /[A-Za-zÀ-ÿœŒ']+/g;
  function spans(text) { var m, s = []; TOKRE.lastIndex = 0; while ((m = TOKRE.exec(text))) s.push([m.index, m.index + m[0].length]); return s; }
  function applyOne(el, flag) {
    var t = getText(el), sp = spans(t), s = sp[flag.i]; if (!s) return;
    var e = sp[flag.i + (flag.span ? flag.span - 1 : 0)] || s;   // élision : la suggestion fusionne 2 tokens (« c est »→« c'est »)
    var nt = t.slice(0, s[0]) + flag.sugg + t.slice(e[1]);
    setText(el, nt, s[0] + flag.sugg.length);
    schedule(el);
  }
  function applyAll(el, flags) {
    var t = getText(el), sp = spans(t);
    var ord = flags.slice().sort(function (a, b) { return b.i - a.i; });   // droite→gauche : indices stables
    ord.forEach(function (f) { var s = sp[f.i]; if (!s) return; var e = sp[f.i + (f.span ? f.span - 1 : 0)] || s; t = t.slice(0, s[0]) + f.sugg + t.slice(e[1]); });
    setText(el, t);
    schedule(el);
  }

  // ===== barre flottante =====
  var bar = null, active = null, dismissed = new WeakSet();
  function hideBar() { if (bar) bar.style.display = 'none'; }
  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'omdys-bar';
    bar.setAttribute('data-omdys', '1');
    bar.addEventListener('mousedown', function (e) { e.preventDefault(); });   // garde le focus dans le champ
    document.documentElement.appendChild(bar);
    return bar;
  }
  function place(el) {
    var r = el.getBoundingClientRect(), b = ensureBar();
    var top = r.bottom + 6, left = r.left;
    var maxw = Math.min(420, window.innerWidth - 16);
    b.style.maxWidth = maxw + 'px';
    if (left + maxw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - maxw - 8);
    if (top + 60 > window.innerHeight) top = Math.max(8, r.top - 6 - 200);
    b.style.top = (top + window.scrollY) + 'px';
    b.style.left = (left + window.scrollX) + 'px';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function render(el, dg) {
    var b = ensureBar();
    var h = '<div class="omdys-head"><b>🩹 Correcteur dys</b>'
      + '<span class="omdys-n">' + dg.flags.length + '</span>'
      + '<button class="omdys-all">tout corriger</button>'
      + '<button class="omdys-x" title="masquer">×</button></div>';
    h += '<div class="omdys-list">';
    dg.flags.forEach(function (f, k) {
      var orth = /orthographe|[ée]lision/.test(f.name || '');   // bleu = orthographe (non-mot/accent) ; rouge = grammaire
      h += '<div class="omdys-item' + (orth ? ' omdys-orth' : '') + '" data-k="' + k + '">« ' + esc(f.word) + ' » → <b>« ' + esc(f.sugg) + ' »</b>'
        + ' <span class="omdys-fam">[' + esc(f.name) + (f.tier === 'auto' ? ' · sûr' : '') + ']</span></div>';
    });
    h += '</div>';
    if (dg.stade) {
      h += '<div class="omdys-stade"><b>Stade : ' + esc(dg.stadeLbl) + '</b><br>' + esc(dg.stadeMsg) + '</div>';
      if (dg.remed && dg.remed.length) h += '<div class="omdys-remed"><b>🛠️ Remédiation</b><br>' + dg.remed.map(esc).join('<br>') + '</div>';
    }
    b.innerHTML = h;
    b.style.display = 'block';
    place(el);
    b.querySelector('.omdys-x').onclick = function () { dismissed.add(el); hideBar(); };
    b.querySelector('.omdys-all').onclick = function () { applyAll(el, dg.flags); };
    var items = b.querySelectorAll('.omdys-item');
    for (var z = 0; z < items.length; z++) (function (node) {
      node.onclick = function () { applyOne(el, dg.flags[+node.getAttribute('data-k')]); };
    })(items[z]);
  }

  // AUTO (orthographe sûre, FP=0) : appliquée EN SILENCE — jamais le mot sous le curseur (en cours de frappe). Miroir applyAutos de l'app.
  function applyAutos(el, autos) {
    var t = getText(el), sp = spans(t), cur = null;
    try { cur = el.selectionStart; } catch (e) {}
    if (cur == null) cur = t.length;
    var ap = autos.filter(function (f) { var s = sp[f.i]; return s && !(cur >= s[0] && cur <= s[1]); });
    if (!ap.length) return false;
    ap.sort(function (a, b) { return sp[a.i][0] - sp[b.i][0]; });
    var res = '', last = 0, delta = 0;
    ap.forEach(function (f) { var s = sp[f.i]; res += t.slice(last, s[0]) + f.sugg; last = s[1]; if (s[1] <= cur) delta += f.sugg.length - (s[1] - s[0]); });
    res += t.slice(last);
    setText(el, res, cur + delta);   // dispatch 'input' → re-run : ne resteront que les FLAG (+ autos sous le curseur)
    return true;
  }
  function run(el) {
    if (!CFG.enabled || !DC.isReady() || !el || el !== active || dismissed.has(el)) return;
    var text = getText(el);
    if (!text || !text.trim()) { hideBar(); return; }
    var dg = DC.diagnoseAll ? DC.diagnoseAll(text) : DC.diagnose(text);   // grammaire + orthographe (non-mots/accents)
    var autos = dg.flags.filter(function (f) { return f.tier === 'auto'; });
    if (autos.length && applyAutos(el, autos)) return;                    // AUTO sûr → corrigé tout seul
    if (!dg.flags.length) { hideBar(); return; }
    render(el, dg);
  }

  // ===== orchestration =====
  var timer = null;
  function schedule(el) { clearTimeout(timer); timer = setTimeout(function () { run(el); }, 400); }

  document.addEventListener('focusin', function (e) {
    var el = e.target;
    if (isEditable(el)) { active = el; dismissed.delete(el); schedule(el); }
  }, true);
  document.addEventListener('input', function (e) {
    if (e.target === active && isEditable(e.target)) { dismissed.delete(active); schedule(active); }
  }, true);
  document.addEventListener('focusout', function (e) {
    if (e.target === active) { setTimeout(function () {
      var a = document.activeElement;
      if (!bar || !bar.contains(a)) hideBar();          // garde la barre si on clique dedans
    }, 150); }
  }, true);
  window.addEventListener('scroll', function () { if (active && bar && bar.style.display !== 'none') place(active); }, true);
})();
