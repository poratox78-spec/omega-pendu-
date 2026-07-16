// sidepanel.js — le correcteur dys dans le PANNEAU LATÉRAL (F12-style). Surface 100% à nous : aucun champ de site
// à réécrire → plus de Slate/Draft qui écrase, plus de barre par-dessus la saisie. Miroir : ce que l'utilisateur
// tape sur la page se recopie ici (sens UNIQUE) ; il corrige ici, puis « Copier » et colle où il veut.
(function () {
  'use strict';
  var DC = self.DYSCORE || window.DYSCORE;
  var ta = document.getElementById('omdys-ta'), corr = document.getElementById('omdys-corr'),
      stEl = document.getElementById('omdys-st'), cntEl = document.getElementById('omdys-count'),
      stadeEl = document.getElementById('omdys-stade'), fixBtn = document.getElementById('omdys-fixall'),
      copyBtn = document.getElementById('omdys-copy'), mirCb = document.getElementById('omdys-mirror'),
      vigEl = document.getElementById('omdys-vig'), compsEl = document.getElementById('omdys-comps'),
      undoBtn = document.getElementById('omdys-undo'), szSel = document.getElementById('omdys-size'),
      dkCb = document.getElementById('omdys-dark'), bubCb = document.getElementById('omdys-bubble');

  // ===== UNE SEULE ZONE DE CORRECTION (Rem, 07/2026 : « on garde que le panneau, c'est plus lisible ») : la bulle
  // flottante est DÉCOCHÉE par défaut. Elle reste à un clic — décocher ne coupe QUE la bulle et la correction auto
  // dans le champ ; le miroir (envoyé avant ce test dans content.js) et le clic droit « corriger ce mot » vivent.
  try {
    chrome.storage.local.get(['enabled'], function (o) { bubCb.checked = !!(o && o.enabled === true); });
    bubCb.addEventListener('change', function () { chrome.storage.local.set({ enabled: bubCb.checked }); });
  } catch (e) {}

  // ===== accessibilité : taille de texte + mode sombre. Ces réglages vivaient dans le POPUP, devenu injoignable
  // quand l'icône a basculé sur le panneau (0.3.0 retire default_popup) → ils étaient du code mort livré. Ils sont
  // ici désormais, avec la MÊME clé chrome.storage (omSize/omDark) : la barre flottante y reste synchronisée.
  var FS = { p: '15px', m: '17.5px', g: '20px' };
  function applyPrefs(sz, dk) {
    document.documentElement.style.setProperty('--fs', FS[sz] || FS.p);
    document.body.classList.toggle('dark', !!dk);
  }
  try {
    chrome.storage.local.get(['omSize', 'omDark'], function (o) {
      szSel.value = (o && o.omSize) || 'p'; dkCb.checked = !!(o && o.omDark); applyPrefs(szSel.value, dkCb.checked);
    });
    szSel.addEventListener('change', function () { chrome.storage.local.set({ omSize: szSel.value }); applyPrefs(szSel.value, dkCb.checked); });
    dkCb.addEventListener('change', function () { chrome.storage.local.set({ omDark: dkCb.checked }); applyPrefs(szSel.value, dkCb.checked); });
    chrome.storage.onChanged.addListener(function (ch, area) {   // live : réglé ailleurs → suit sans recharger
      if (area !== 'local') return;
      if (ch.omSize) { szSel.value = ch.omSize.newValue || 'p'; }
      if (ch.omDark) { dkCb.checked = !!ch.omDark.newValue; }
      if (ch.omSize || ch.omDark) applyPrefs(szSel.value, dkCb.checked);
    });
  } catch (e) {}
  var TOKRE = /[A-Za-zÀ-ÿœŒ'’ʼ]+/g;
  function spans(t) { var m, s = []; TOKRE.lastIndex = 0; while ((m = TOKRE.exec(t))) s.push([m.index, m.index + m[0].length]); return s; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---- moteur : charge les lexiques depuis les assets (comme content.js) ----
  var ready = false;
  if (DC) try {
    var sp = chrome.runtime.getURL('assets/speller.tsv.gz'), nom = chrome.runtime.getURL('assets/noun-post.txt.gz');
    DC.loadLex({ vdc: chrome.runtime.getURL('assets/vdc-lex.json'), genderRelaxed: chrome.runtime.getURL('assets/gender-relaxed.tsv.gz'),
                 speller: sp, nom: nom, hmm: chrome.runtime.getURL('assets/pos-hmm.json.gz') })
      .then(function () { ready = true; stEl.textContent = 'prêt'; runNow(); })
      .catch(function (e) { stEl.textContent = 'erreur moteur'; });
    if (DC.loadSpellerLex) DC.loadSpellerLex(sp).then(runNow);
    if (DC.loadNounPost) DC.loadNounPost(nom).then(runNow);
    if (DC.loadConfusables) DC.loadConfusables(chrome.runtime.getURL('assets/confusables.json')).then(runNow);
  } catch (e) { stEl.textContent = 'erreur'; }
  else stEl.textContent = 'moteur absent';

  // ---- correction de NOTRE textarea (on la possède → remplacement direct, aucun framework) ----
  var lastDg = { flags: [] };
  function diagnose(t) { try { return DC.diagnoseAll ? DC.diagnoseAll(t) : { flags: [] }; } catch (e) { return { flags: [] }; } }
  function applyFlag(f) {
    var t = ta.value, s = spans(t)[f.i]; if (!s) return;
    var e = spans(t)[f.i + (f.span ? f.span - 1 : 0)] || s;
    ta.value = t.slice(0, s[0]) + f.sugg + t.slice(e[1]);
    runNow();
  }
  // « tout corriger » = UNIQUEMENT le FP=0 (auto + rouge) ; la vigilance reste au clic individuel explicite.
  var _undoSnap = null;
  function applyAll() {
    var flags = (lastDg.flags || []).filter(function (f) { return f.tier !== 'vigilance'; });
    var t = ta.value, before = t, sp2 = spans(t);
    flags.slice().sort(function (a, b) { return b.i - a.i; }).forEach(function (f) {
      var s = sp2[f.i]; if (!s) return; var e = sp2[f.i + (f.span ? f.span - 1 : 0)] || s;
      t = t.slice(0, s[0]) + f.sugg + t.slice(e[1]);
    });
    _undoSnap = { before: before, after: t };   // FILET : réversible tant que le texte n'a pas été ré-édité
    ta.value = t; runNow();
  }
  function undoAll() { if (!_undoSnap || ta.value !== _undoSnap.after) return; ta.value = _undoSnap.before; _undoSnap = null; runNow(); }

  // aide-frappe : complétions du mot SOUS LE CURSEUR (DC.complete, speller accentué) — identique à la barre/app
  var WCH = /[A-Za-zÀ-ÿœŒ'’ʼ]/;
  function compsAt() {
    if (!DC.complete || document.activeElement !== ta) return [];
    var v = ta.value, pos = ta.selectionStart;
    if (pos == null || pos !== ta.selectionEnd) return [];
    var s = pos; while (s > 0 && WCH.test(v[s - 1])) s--;
    var w = v.slice(s, pos);
    if (w.length < 2) return [];
    return DC.complete(w).map(function (a) { return { word: a, start: s, end: pos }; });
  }
  function applyComp(c) {
    ta.value = ta.value.slice(0, c.start) + c.word + ta.value.slice(c.end);
    var p = c.start + c.word.length;
    ta.focus(); ta.setSelectionRange(p, p); runNow();
  }
  function speak(txt) { try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(String(txt).replace(/\s+/g, ' ').trim()); u.lang = 'fr-FR'; u.rate = 0.95; speechSynthesis.speak(u); } catch (e) {} }

  function render(dg) {
    lastDg = dg || { flags: [] };
    var flags = lastDg.flags || [];
    var redn = flags.filter(function (f) { return f.tier !== 'vigilance'; }).length;
    fixBtn.disabled = !redn;
    cntEl.textContent = flags.length ? (flags.length + ' correction' + (flags.length > 1 ? 's' : '')) : (ta.value.trim() ? '✓ rien à corriger' : '');
    var h = '';
    flags.forEach(function (f, k) {
      var vig = f.tier === 'vigilance', orth = /orthographe|[ée]lision/.test(f.name || '');
      h += '<div class="item' + (vig ? ' tvig' : (orth ? ' orth' : '')) + '" data-k="' + k + '">« ' + esc(f.word) + ' » → <b>« ' + esc(f.sugg) + ' »</b>'
        + ' <span class="fam">[' + esc(f.name) + (f.tier === 'auto' ? ' · sûr' : (vig ? ' · à vérifier' : '')) + ']</span>'
        + (f.hint ? '<button class="why" data-k="' + k + '" type="button" title="pourquoi ?">💡</button>' : '')
        + '<button class="tts" data-k="' + k + '" type="button" title="écouter">🔊</button>'
        + (f.hint ? '<div class="astuce" data-k="' + k + '" hidden>' + esc(f.hint) + '</div>' : '')
        + '</div>';
    });
    corr.innerHTML = h;
    var items = corr.querySelectorAll('.item');
    for (var z = 0; z < items.length; z++) (function (node) {
      node.onclick = function (ev) { if (ev.target.closest('.why') || ev.target.closest('.astuce') || ev.target.closest('.tts')) return; applyFlag(flags[+node.getAttribute('data-k')]); };
    })(items[z]);
    var whys = corr.querySelectorAll('.why');
    for (var w = 0; w < whys.length; w++) (function (b) { b.onclick = function (e) { e.stopPropagation(); var a = corr.querySelector('.astuce[data-k="' + b.getAttribute('data-k') + '"]'); if (a) a.hidden = !a.hidden; }; })(whys[w]);
    var tts = corr.querySelectorAll('.tts');
    for (var t2 = 0; t2 < tts.length; t2++) (function (b) { b.onclick = function (e) { e.stopPropagation(); var f = flags[+b.getAttribute('data-k')]; if (f) speak('« ' + f.word + ' » devient « ' + f.sugg + ' ». ' + (f.hint || '')); }; })(tts[t2]);
    // aide-frappe (clic pour insérer le mot en cours)
    var cs = compsAt(), ch = '';
    if (cs.length) {
      ch = '<span class="lab">✏️ compléter :</span>' + cs.map(function (c, j) {
        return '<button class="cbtn" data-j="' + j + '" type="button">' + esc(c.word) + '</button>';
      }).join('');
    }
    compsEl.innerHTML = ch;
    var cb = compsEl.querySelectorAll('.cbtn');
    for (var q = 0; q < cb.length; q++) (function (b) { b.onclick = function () { applyComp(cs[+b.getAttribute('data-j')]); }; })(cb[q]);

    // ===== couches VERTES : elles n'AFFIRMENT pas une faute → aucun clic d'application, jamais dans « tout corriger »
    var vg = '', txt = ta.value;
    var conf = (DC.vigText && txt.trim()) ? DC.vigText(txt) : [];          // confusables
    var ro = (DC.runonText && txt.trim()) ? DC.runonText(txt) : [];        // ponctuation manquante entre 2 propositions
    if (conf.length) {
      vg += '<div class="vig"><div class="vlab">🟢 à vérifier — mots confusables</div>';
      conf.forEach(function (v) { vg += '<div class="vitem">« ' + esc(v.word) + ' » — ' + esc(v.info) + '</div>'; });
      vg += '</div>';
    }
    if (ro.length) {
      vg += '<div class="vig"><div class="vlab">🟢 à vérifier — ponctuation</div>';
      ro.forEach(function (r) { vg += '<div class="vitem">entre « ' + esc(r.a) + ' » et « ' + esc(r.b) + ' » — ponctuation manquante ? (virgule ou point selon le sens)</div>'; });
      vg += '</div>';
    }
    vigEl.innerHTML = vg;

    undoBtn.hidden = !(_undoSnap && ta.value === _undoSnap.after);

    // stade + remédiation (couche dys)
    var s = '';
    if (dg && dg.stade) { s = '<div class="stade"><b>Stade : ' + esc(dg.stadeLbl || dg.stade) + '</b>' + (dg.stadeMsg ? '<br>' + esc(dg.stadeMsg) : '') + '</div>';
      if (dg.remed && dg.remed.length) s += '<div class="remed"><b>🛠️ Remédiation</b><br>' + dg.remed.map(esc).join('<br>') + '</div>'; }
    else if (ta.value.trim() && !flags.length && !conf.length && !ro.length) s = '<div class="ok-msg">✓ Aucune faute détectée.</div>';
    stadeEl.innerHTML = s;
  }

  // ---- orchestration (débounce) ----
  var timer = null;
  function runNow() { if (!ready) return; render(diagnose(ta.value)); }
  function schedule() { clearTimeout(timer); timer = setTimeout(runNow, 300); }
  ta.addEventListener('input', schedule);
  ta.addEventListener('keyup', function (e) { if (/^Arrow|^Home$|^End$/.test(e.key)) schedule(); });   // le curseur bouge → l'aide-frappe suit
  ta.addEventListener('click', schedule);

  fixBtn.onclick = function () { applyAll(); ta.focus(); };
  undoBtn.onclick = function () { undoAll(); ta.focus(); };
  copyBtn.onclick = function () {
    try { navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); try { document.execCommand('copy'); } catch (_) {} }
    copyBtn.classList.add('ok'); copyBtn.textContent = '✓ Copié'; setTimeout(function () { copyBtn.classList.remove('ok'); copyBtn.textContent = '📋 Copier'; }, 1400);
  };

  // ---- MIROIR : ce que l'utilisateur tape dans un champ de la page se recopie ici (sens UNIQUE) ----
  chrome.runtime.onMessage.addListener(function (msg) {
    if (!msg || msg.type !== 'omdys-mirror') return;
    if (!mirCb.checked) return;
    if (document.activeElement === ta) return;             // l'utilisateur édite le panneau → ne pas écraser
    if (typeof msg.text === 'string' && msg.text !== ta.value) { ta.value = msg.text; runNow(); }
  });
})();
