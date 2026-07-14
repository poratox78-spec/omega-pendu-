// sidepanel.js — le correcteur dys dans le PANNEAU LATÉRAL (F12-style). Surface 100% à nous : aucun champ de site
// à réécrire → plus de Slate/Draft qui écrase, plus de barre par-dessus la saisie. Miroir : ce que l'utilisateur
// tape sur la page se recopie ici (sens UNIQUE) ; il corrige ici, puis « Copier » et colle où il veut.
(function () {
  'use strict';
  var DC = self.DYSCORE || window.DYSCORE;
  var ta = document.getElementById('omdys-ta'), corr = document.getElementById('omdys-corr'),
      stEl = document.getElementById('omdys-st'), cntEl = document.getElementById('omdys-count'),
      stadeEl = document.getElementById('omdys-stade'), fixBtn = document.getElementById('omdys-fixall'),
      copyBtn = document.getElementById('omdys-copy'), mirCb = document.getElementById('omdys-mirror');
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
  function applyAll() {
    var flags = (lastDg.flags || []).filter(function (f) { return f.tier !== 'vigilance'; });
    var t = ta.value, sp2 = spans(t);
    flags.slice().sort(function (a, b) { return b.i - a.i; }).forEach(function (f) {
      var s = sp2[f.i]; if (!s) return; var e = sp2[f.i + (f.span ? f.span - 1 : 0)] || s;
      t = t.slice(0, s[0]) + f.sugg + t.slice(e[1]);
    });
    ta.value = t; runNow();
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
        + ' <span class="fam">[' + esc(f.name) + (vig ? ' · à vérifier' : '') + ']</span>'
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
    // stade + remédiation (couche dys)
    var s = '';
    if (dg && dg.stade) { s = '<div class="stade"><b>Stade : ' + esc(dg.stadeLbl || dg.stade) + '</b>' + (dg.stadeMsg ? '<br>' + esc(dg.stadeMsg) : '') + '</div>';
      if (dg.remed && dg.remed.length) s += '<div class="remed"><b>🛠️ Remédiation</b><br>' + dg.remed.map(esc).join('<br>') + '</div>'; }
    else if (ta.value.trim() && !flags.length) s = '<div class="ok-msg">✓ Aucune faute détectée.</div>';
    stadeEl.innerHTML = s;
  }

  // ---- orchestration (débounce) ----
  var timer = null;
  function runNow() { if (!ready) return; render(diagnose(ta.value)); }
  function schedule() { clearTimeout(timer); timer = setTimeout(runNow, 300); }
  ta.addEventListener('input', schedule);

  fixBtn.onclick = function () { applyAll(); ta.focus(); };
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
