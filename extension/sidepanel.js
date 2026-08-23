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
                 speller: sp, nom: nom, hmm: chrome.runtime.getURL('assets/pos-hmm.json.gz'), osLm: chrome.runtime.getURL('assets/os-subj-lm.json.gz'),
                 prenoms: chrome.runtime.getURL('assets/prenoms.tsv.gz') })   // PRÉNOMS : l'asset était LIVRÉ mais JAMAIS CHARGÉ ici (« Marie est venu » muet dans l'extension, vu au banc navigateur réel 2026-08-21)
      .then(function () { ready = true; stEl.textContent = 'prêt'; runNow(); })
      .catch(function (e) { stEl.textContent = 'erreur moteur'; });
    if (DC.loadSpellerLex) DC.loadSpellerLex(sp).then(runNow);
    if (DC.loadNounPost) DC.loadNounPost(nom).then(runNow);
    if (DC.loadConfusables) DC.loadConfusables(chrome.runtime.getURL('assets/confusables.json')).then(runNow);
    // ⭐ CANAL TEXTE DE LA PONCTUATION (182 Ko) — surfaces VOCALES seulement (content.js, qui
    // tourne sur toutes les pages web, ne le charge pas). Dégradation douce si absent.
    if (DC.loadPonctLm) DC.loadPonctLm(chrome.runtime.getURL('assets/ponct-lm.json.gz'));
    // ⭐ DICTIONNAIRE UTILISATEUR — MÊME BUG QUE SUR LE SITE, trouvé en faisant l'inventaire.
    // Le panneau charge sa PROPRE copie de dys-core (contexte séparé de content.js), et `_UD` y vit
    // EN MÉMOIRE : seul l'hôte l'alimente. Or seul `content.js` appelait `udSet` -> les mots ajoutés
    // par l'utilisateur (prénoms, pseudos, jargon) étaient corrigés dans les pages web mais toujours
    // signalés « inconnu » ICI. Même source (`chrome.storage.local`), et on suit les changements.
    // ⚠️ RÈGLE GÉNÉRALE : dys-core ne persiste RIEN — toute nouvelle surface doit appeler udSet().
    try {
      chrome.storage.local.get('vdc_userdict', function (o) {
        if (o && o.vdc_userdict && DC.udSet) { DC.udSet(o.vdc_userdict); runNow(); }
      });
      chrome.storage.onChanged.addListener(function (ch) {
        if (ch.vdc_userdict && DC.udSet) { DC.udSet(ch.vdc_userdict.newValue || []); runNow(); }
      });
    } catch (e) {}
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
  // ===== ROUGES D'OFFICE (Rem, 2026-08-21 : « le texte copié sort déjà corrigé, comme sur le site ») =====
  // Comme sur le site : la zone reste ce que l'utilisateur (ou le miroir) y a mis ; le FP=0 (auto + rouge) est
  // appliqué dans le TEXTE CORRIGÉ — aperçu sous les boutons, et c'est LUI que « Copier » copie. L'orange reste
  // au clic. Chaque rouge se révoque d'un clic (« annuler »), par clé (index, mot, suggestion) : une ré-édition
  // qui déplace les mots fait tomber les révocations d'elles-mêmes. Le miroir n'est jamais réécrit → pas de bataille.
  var _ign = {}, lastOut = null;
  function _fk(f) { return f.i + '|' + f.word + '|' + f.sugg; }
  function corrige(t, flags, html) {
    var sp2 = spans(t), parts = [], last = 0, out = t;
    var L = (flags || []).filter(function (f) { return f.tier !== 'vigilance' && !_ign[_fk(f)]; }).slice().sort(function (a, b) { return a.i - b.i; });
    L.forEach(function (f) {
      var s = sp2[f.i]; if (!s || s[0] < last) return; var e = sp2[f.i + (f.span ? f.span - 1 : 0)] || s;
      parts.push([t.slice(last, s[0]), f.sugg]); last = e[1];
    });
    if (!parts.length) return html ? '' : t;
    if (html) { var h = ''; parts.forEach(function (p) { h += esc(p[0]) + '<b>' + esc(p[1]) + '</b>'; }); return h + esc(t.slice(last)); }
    out = ''; parts.forEach(function (p) { out += p[0] + p[1]; }); return out + t.slice(last);
  }
  // « tout corriger » = écrit le FP=0 (auto + rouge, hors révoqués) DANS la zone ; la vigilance reste au clic explicite.
  var _undoSnap = null;
  function applyAll() {
    var before = ta.value, t = corrige(before, lastDg.flags || []);
    _undoSnap = { before: before, after: t };   // FILET : réversible tant que le texte n'a pas été ré-édité
    ta.value = t; runNow();
  }
  function undoAll() { if (!_undoSnap || ta.value !== _undoSnap.after) return; ta.value = _undoSnap.before; _undoSnap = null; runNow(); }

  // aide-frappe : complétions du mot SOUS LE CURSEUR (DC.complete, speller accentué) — identique à la barre/app
  var WCH = /[A-Za-zÀ-ÿœŒ'’ʼ]/;
  function prevWordAt(txt, start, back) {                    // miroir content.js/app (_prevWord) : contexte du bigramme + accord
    var s = String(txt || '').slice(0, start);
    var m = s.match(/([A-Za-zÀ-ÖØ-öø-ÿœŒ'’ʼ]+)([^A-Za-zÀ-ÖØ-öø-ÿœŒ'’ʼ]*)$/);
    if (!m) return '';
    if (!back || back < 2) return m[1];
    var s2 = s.slice(0, s.length - m[1].length - m[2].length);
    if (/[.,;:!?…«»()\[\]]\s*$/.test(s2)) return '';          // ponctuation = tête de proposition
    var m2 = s2.match(/([A-Za-zÀ-ÖØ-öø-ÿœŒ'’ʼ]+)[^A-Za-zÀ-ÖØ-öø-ÿœŒ'’ʼ]*$/);
    return m2 ? m2[1] : '';
  }
  function compsAt() {
    if (!DC.complete || document.activeElement !== ta) return [];
    var v = ta.value, pos = ta.selectionStart;
    if (pos == null || pos !== ta.selectionEnd) return [];
    var s = pos; while (s > 0 && WCH.test(v[s - 1])) s--;
    var w = v.slice(s, pos);
    if (w.length < 2) return [];
    /* CONTEXTE (mot précédent, avant-dernier) : sans lui, pas de classement par accord — « je mang » donnait
       « manger » en tête au lieu de « mange » (vu au banc Edge 2026-08-21) ; content.js et l'app le passaient déjà. */
    return DC.complete(w, prevWordAt(v, s), prevWordAt(v, s, 2)).map(function (a) { return { word: a, start: s, end: pos }; });
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
    if (!ta.value.trim()) _ign = {};
    lastOut = corrige(ta.value, flags);
    var outEl = document.getElementById('omdys-out');
    if (outEl) { var oh = lastOut !== ta.value ? corrige(ta.value, flags, true) : ''; outEl.hidden = !oh; outEl.innerHTML = oh ? '<span class="lab">texte corrigé (c\'est lui que « Copier » copie) :</span><br>' + oh : ''; }
    var h = '';
    flags.forEach(function (f, k) {
      var vig = f.tier === 'vigilance', orth = /orthographe|[ée]lision/.test(f.name || ''), off = !vig && !!_ign[_fk(f)];
      h += '<div class="item' + (vig ? ' tvig' : (orth ? ' orth' : '')) + (vig ? '' : (off ? ' off' : ' done')) + '" data-k="' + k + '">« ' + esc(f.word) + ' » → <b>« ' + esc(f.sugg) + ' »</b>'
        + ' <span class="fam">[' + esc(f.name) + (f.tier === 'auto' ? ' · sûr' : (vig ? ' · à vérifier' : '')) + ']</span>'
        + (vig ? '' : '<span class="etat">' + (off ? 'annulé · clique pour réappliquer' : '✓ appliqué à la copie · clique pour annuler') + '</span>')
        + (f.hint ? '<button class="why" data-k="' + k + '" type="button" title="pourquoi ?">💡</button>' : '')
        + '<button class="tts" data-k="' + k + '" type="button" title="écouter">🔊</button>'
        + (f.hint ? '<div class="astuce" data-k="' + k + '" hidden>' + esc(f.hint) + '</div>' : '')
        + '</div>';
    });
    corr.innerHTML = h;
    var items = corr.querySelectorAll('.item');
    for (var z = 0; z < items.length; z++) (function (node) {
      node.onclick = function (ev) { if (ev.target.closest('.why') || ev.target.closest('.astuce') || ev.target.closest('.tts')) return;
        var f = flags[+node.getAttribute('data-k')]; if (!f) return;
        if (f.tier === 'vigilance') { applyFlag(f); return; }                 // ORANGE : au clic, dans la zone (inchangé)
        var key = _fk(f); if (_ign[key]) delete _ign[key]; else _ign[key] = true; runNow(); };   // ROUGE : bascule appliqué/annulé dans la copie
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
  // COPIE : `writeText` rend une PROMESSE — le try/catch synchrone d'avant n'attrapait que
  // l'absence d'API, jamais un REFUS du navigateur. Le repli n'était donc pas atteint et
  // « ✓ Copié » s'affichait quand même : l'interface AFFIRMAIT une copie qui n'avait pas eu lieu.
  copyBtn.onclick = function () {
    function fini(ok) {
      copyBtn.classList.toggle('ok', ok);
      copyBtn.textContent = ok ? '✓ Copié' : '⚠ copie refusée — Ctrl+C';
      setTimeout(function () { copyBtn.classList.remove('ok'); copyBtn.textContent = '📋 Copier'; }, ok ? 1400 : 3200);
    }
    var txt = (lastOut != null ? lastOut : ta.value);              // ROUGES D'OFFICE : la copie sort corrigée (auto + rouge non révoqués)
    function repli() {
      var keep = ta.value, sel = [ta.selectionStart, ta.selectionEnd];
      ta.value = txt; ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      ta.value = keep; try { ta.setSelectionRange(sel[0], sel[1]); } catch (_) {}
      fini(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(txt).then(function () { fini(true); }, repli);
    else repli();
  };

  // ---- SAISIE VOCALE (opt-in, VOIE A : Web Speech du navigateur = service cloud, ex. Google) --------------------
  // Le correcteur reste 100 % hors-ligne ; SEULE la transcription vocale sort (audio → service du navigateur).
  // Consentement explicite (case à cocher persistée) AVANT tout accès micro ; le texte transcrit tombe dans la
  // textarea → correction + « Copier » déjà en place. UI-only : aucun impact sur le moteur ni la parité 3 moteurs.
  var micBtn = document.getElementById('omdys-mic'), voiceCb = document.getElementById('omdys-voice-ok');
  var SR = self.SpeechRecognition || self.webkitSpeechRecognition;
  var rec = null, recording = false, vstop = null;   // vstop : posé par startRec(), c'est LUI qui arrête pour de vrai (cf. onend)
  function voiceStatus(m) { stEl.textContent = m; }
  function setVoiceEnabled(on) { micBtn.disabled = !(on && SR); if (!on && recording) stopRec(); }
  if (!SR) { voiceCb.disabled = true; voiceCb.parentNode.title = 'Reconnaissance vocale non supportée par ce navigateur'; }
  try { chrome.storage.local.get(['omVoice'], function (o) { var on = !!(o && o.omVoice); voiceCb.checked = on; if (on) mirCb.checked = false; setVoiceEnabled(on); }); } catch (e) {}
  // EXCLUSION MUTUELLE voix ↔ miroir : les deux écrivent dans la MÊME textarea et se battaient (il fallait décocher/recocher).
  // Activer l'un désactive l'autre. Le miroir lit `mirCb.checked` en direct (l.~185) → le décocher le coupe aussitôt.
  voiceCb.addEventListener('change', function () {
    if (voiceCb.checked && mirCb.checked) mirCb.checked = false;
    try { chrome.storage.local.set({ omVoice: voiceCb.checked }); } catch (e) {}
    setVoiceEnabled(voiceCb.checked);
    if (voiceCb.checked) demanderMicro();
  });
  /* ⚠️⚠️ CORRECTION 2026-08-10 — LA PRÉ-DEMANDE NE POUVAIT PAS MARCHER, ET ELLE ÉCHOUAIT EN SILENCE.
     L'ancien code appelait `getUserMedia` ici même avec un `.catch(function(){})` VIDE, sous le
     commentaire « l'invite s'affiche de façon fiable (MV3) ». C'est FAUX : Chrome traite le side
     panel comme un contexte « offscreen », l'invite d'autorisation NE S'Y AFFICHE JAMAIS et la
     promesse part en « permission dismissed ». Résultat vécu : on coche la case, et il ne se passe
     RIEN — ni invite, ni message, ni erreur. Le catch vide rendait le bug indétectable.
     ⇒ Contournement documenté par Chromium : obtenir l'autorisation depuis une page d'extension
     ouverte dans un VRAI ONGLET (`micro.html`), dont le panneau hérite ensuite.
     ⇒ Et surtout : PLUS AUCUN ÉCHEC MUET — chaque issue écrit dans la barre d'état. */
  function demanderMicro() {
    var ouvre = function () {
      try { chrome.tabs.create({ url: chrome.runtime.getURL('micro.html') }); voiceStatus('autorise le micro dans l’onglet qui vient de s’ouvrir'); }
      catch (e) { voiceStatus('ouvre micro.html pour autoriser le micro'); }
    };
    if (!navigator.permissions || !navigator.permissions.query) { ouvre(); return; }
    navigator.permissions.query({ name: 'microphone' }).then(function (p) {
      if (p.state === 'granted') voiceStatus('micro autorisé — clique 🎤 Dicter');
      else if (p.state === 'denied') voiceStatus('micro bloqué : réautorise-le dans les réglages de site de Chrome');
      else ouvre();                                   // 'prompt' : l'invite ne peut pas s'afficher ICI → onglet
    }).catch(function () { ouvre(); });
  }
  mirCb.addEventListener('change', function () {   // activer le miroir coupe la voix
    if (mirCb.checked && voiceCb.checked) { voiceCb.checked = false; try { chrome.storage.local.set({ omVoice: false }); } catch (e) {} setVoiceEnabled(false); }
  });
  function stopRec() { if (vstop) { vstop(); } else { recording = false; micBtn.textContent = '🎤 Dicter'; micBtn.classList.remove('rec'); try { if (rec) rec.stop(); } catch (e) {} } }
  // ── PROSODIE PARALLÈLE (voie A) — identique au site : Web Speech ne donne que du texte ; on capte le micro
  //    nous-mêmes (Web Audio, zéro modèle) → silence → « , . », pitch (F0) → « ? », ancrés sur les segments
  //    finaux. Dégradant : getUserMedia async ne peut pas casser startRec, fallback capitalize() seul. NON testé sans micro.
  function _f0(buf, sr){ var n=buf.length, m=0, i, best=0, bc=0, lo=(sr/350)|0, hi=(sr/75)|0;
    for(i=0;i<n;i++)m+=buf[i]; m/=n;
    for(var lag=lo; lag<=hi && lag<n; lag++){ var c=0; for(i=0;i<n-lag;i++)c+=(buf[i]-m)*(buf[i+lag]-m); if(c>bc){bc=c;best=lag;} }
    return best>0 ? sr/best : 0; }
  function audioStart(S){ try{ if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) return;
      navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
        var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
        var ac=new AC(), sr=ac.sampleRate, src=ac.createMediaStreamSource(stream), an=ac.createAnalyser();
        try{ ac.resume&&ac.resume(); }catch(e){}   // AudioContext démarre suspendu (autoplay) → réveiller, sinon 0 donnée audio
        an.fftSize=1024; src.connect(an); var buf=new Float32Array(an.fftSize); S.au={ac:ac, stream:stream, tl:[], maxr:0};
        S.au.iv=setInterval(function(){ try{ an.getFloatTimeDomainData(buf);
          var r=0,i; for(i=0;i<buf.length;i++)r+=buf[i]*buf[i]; r=Math.sqrt(r/buf.length); if(r>S.au.maxr)S.au.maxr=r;
          S.au.tl.push({t:Date.now()-S.t0, r:r, f:r>0.012?_f0(buf,sr):0}); }catch(e){} },30);
      }).catch(function(){}); }catch(e){} }
  function audioStop(S){ try{ if(S.au){ clearInterval(S.au.iv); try{S.au.ac.close();}catch(e){} try{S.au.stream.getTracks().forEach(function(t){t.stop();});}catch(e){} } }catch(e){} }
  // ⭐⭐ LE SEUIL DE SILENCE — RÉPARÉ (2026-08-05). L'ancien valait `max(0,008 ; maxRMS x 0,18)` :
  // il était RELATIF AU PIC. Un seul instant fort (plosive, rire, on s'approche du micro) suffisait
  // à désensibiliser toute la détection. MESURÉ sur la prise libre de Rem : maxRMS 0,3608 pour une
  // MÉDIANE de trame à 0,0247 — le pic vaut 14 fois la médiane, donc le seuil (0,0649) passait
  // AU-DESSUS de la parole ordinaire. Résultat : **5850 ms de parole détectée sur 19470 ms pour
  // 62 mots**, soit 94 ms par mot. Physiquement impossible : on classait la moitié de la parole
  // en « silence ».
  // `git log -S` : ce 0,18 avait été posé au TOUT PREMIER commit de prosodie (32ba743, marqué
  // « EXPÉRIMENTAL »), sans un commentaire ni une mesure, et tout reposait dessus depuis.
  //
  // LE REMPLAÇANT est le standard du domaine : estimer le PLANCHER DE BRUIT sur un décile BAS
  // (insensible aux pics, contrairement au max) et se placer un facteur au-dessus.
  // MESURÉ sur VoxPopuli-FR — 250 clips, 47 locuteurs, 655 virgules écrites par des humains :
  //    ancien  pic x0,18       -> parole 47 % du temps   (physiologiquement FAUX : ~65-80 % attendu)
  //    plancher seul 0,008     -> parole 74 %            meilleure pause 310 ms, ratio 1,07
  //    ⭐ bruit p10 x3 + 0,004 -> parole 68 %            meilleure pause 370 ms, ratio 0,98
  // Sur les prises de Rem l'ancien était PIRE ENCORE (21 % de parole) : son micro a de la dynamique,
  // et c'est justement la condition qui compte.
  // ⚠️ HONNÊTETÉ : sur ses 3 prises, ce correctif ne change PAS le score des marques (8/11 avant,
  // 8/11 après) — il déplace des erreurs sans en enlever. On le livre parce que le détecteur était
  // FAUX, pas parce qu'il ponctue mieux. Tout ce qui lit la structure des silences en dépend.
  // ⚠️ BORNÉ PAR LE HAUT, et c'est la garde CI qui l'a exigé : l'estimation par décile suppose
  // qu'AU MOINS 10 % des trames sont du silence. Quelqu'un qui parle sans respirer fait monter le
  // p10 au niveau de la PAROLE, et le seuil s'emballe -> tout devient « silence ». On l'encadre
  // donc entre le plancher absolu et la MOITIÉ DE LA MÉDIANE : un seuil au-dessus de la moitié du
  // niveau typique ne peut pas être un plancher de bruit, par construction.
  function _seuilSilence(au){
    var v=[],i; for(i=0;i<au.tl.length;i++) v.push(au.tl[i].r);
    if(!v.length) return 0.008;
    v.sort(function(a,b){return a-b;});
    var p10=v[Math.min(v.length-1,Math.floor(0.10*v.length))];
    var med=v[Math.min(v.length-1,Math.floor(0.50*v.length))];
    return Math.min(Math.max(0.008, p10*3+0.004), Math.max(0.008, med*0.5)); }
  function silBetween(tl,thr,a,b){ var run=0,mx=0; for(var i=0;i<tl.length;i++){ var p=tl[i]; if(p.t<a||p.t>b)continue; if(p.r<thr){ run+=30; if(run>mx)mx=run; } else run=0; } return mx; }
  function riseEndingAt(tl,a,b){ var v=[]; for(var i=0;i<tl.length;i++){ var p=tl[i]; if(p.t>=a&&p.t<=b&&p.f>0)v.push(p.f); }
    if(v.length<6)return 0; var q=Math.max(2,(v.length/5)|0); var tail=v.slice(-q), body=v.slice(0,-q);
    function med(x){ x=x.slice().sort(function(a,b){return a-b;}); return x[(x.length/2)|0]; }
    var mt=med(tail), mb=med(body); return (mb>0&&mt>0)? 12*Math.log(mt/mb)/Math.log(2) : 0; }
  // MIX règles + voix : frontières de segments finaux (pauses Web Speech, sans getUserMedia) + règles
  // (point/virgule + normalisation de la majuscule d'amorce Google) ; audio en refinement si dispo.
  // ── ⭐ MOT DE TÊTE HORS PHRASE — « Bonjour, ... » (règle BDL/OQLF, MESURÉE ; parité site).
  // Le BDL isole l'élément hors phrase par des virgules ; EN TÊTE la première est omise, la seconde
  // reste. MESURÉ sur 694 949 phrases françaises ponctuées (Wiktionnaire FR + UD FR GSD) : 79,4 %
  // (bonjour) à 93 % (tiens) de séparation réelle. Un corpus mesure ce qu'on ÉCRIT, pas ce qui est
  // CORRECT — j'ai donc relu LES 53 cas non séparés des 4 salutations retenues : « Bonjour
  // Mademoiselle. », « Salut les pigeons ! », « Coucou Loulou, »… ce sont TOUS des apostrophes, où
  // le BDL PRESCRIT la virgule. 0 contre-exemple structurel. Seul « Salut bien » gouverne -> gardé.
  // ⚠️ EXCLUS APRÈS MESURE : merci (48,2 % — « merci bien/beaucoup »), ok (70,2 %), oui/bon/alors/
  // voilà/eh (adverbes et présentatifs qui gouvernent leur suite). Ne pas les rajouter.
  // ── ⭐ LA MAJUSCULE QUE GOOGLE POSE *À L'INTÉRIEUR* D'UN SEGMENT (parité site).
  // Trouvé en rejouant la prise LIBRE de Rem : « bonjour Qu'est-ce que je fais » — minuscule au
  // début, MAJUSCULE au milieu, parce que Google croit qu'une phrase commence là. On ne normalisait
  // que le PREMIER caractère du segment -> on sortait « Bonjour, Qu'est-ce ». Liste FERMÉE de
  // mots-outils (aucun n'est un nom propre : « je vais à Paris » garde son Paris), et seulement
  // hors marque de fin de phrase — là, la majuscule est la NÔTRE et elle est juste.
  var _MAJOUTIL=new RegExp('([^.!?…]\\s)((?:qu\'est-ce|est-ce|c\'est|j\'ai|j\'en|qu\'|il|elle|on|nous|vous|ils|elles|je|tu|le|la|les|un|une|des|du|au|aux|ce|cet|cette|ces|et|ou|mais|donc|car|ni|alors|puis|aussi|si|que|qui|quoi|dont|quand|comment|pourquoi|combien|quel|quelle|quels|quelles|en|dans|sur|pour|avec|sans|chez|vers|depuis)(?![a-zà-ÿœ]))','gi');
  // ⚠️ La garde « nom propre composé » NE PEUT PAS vivre dans la regex : elle porte le drapeau `i`
  // (il faut bien reconnaître « Qu'est-ce » ET « qu'est-ce »), donc une classe [A-Z] y serait
  // insensible à la casse et ne prouverait plus rien. Elle est donc testée ICI, où la casse compte :
  // « à La Rochelle », « au Havre », « Le Mans » gardent leur majuscule ; « la voiture » non.
  var _NOMPROPRE=/^\s+[A-ZÀ-ÖØ-Þ]/;
  function _dedoubleMarques(s){
    /* ⛔⛔ DEUX MARQUES QUI SE SUIVENT — RÉPARÉ ICI, À LA SOURCE, PAS DANS LE CORRECTEUR.
       Rem, sur sa prise réelle : « ,, est doublon, ça se corrige facilement même si on peut pas
       l'empêcher de se produire ». Il a raison sur les deux moitiés : la CAUSE n'est pas reproduite
       (trois tentatives dans proso_probe ont échoué), mais l'EFFET est trivialement décidable.
       Deux virgules à la suite n'existent pas en français : 0 occurrence sur 14 450 phrases UD
       correctes. On n'a donc pas besoin de comprendre d'où ça vient pour refuser de l'écrire.
       ⚠️ ON NE TOUCHE PAS « ., », et c'est une abstention MESURÉE : ce motif apparaît 15 fois dans
       UD et il y est TOUJOURS CORRECT — « av. J.-C., », « etc., », « Martine B., », « Next..., ».
       Le point d'abréviation suivi d'une virgule est du bon français. C'est le durcissement de la
       JOINTURE qui traite ce cas-là, pas un nettoyage aveugle. */
    return String(s||'')
      .replace(/,[ 	]*,+/g, ',')          /* « ,, » -> « , » : impossible en français */
      .replace(/,[ 	]*\?/g, ' ?')         /* « ,? » -> « ? » : la marque FORTE gagne (espace FR avant le « ? ») */
      .replace(/,[ 	]*([.!])/g, '$1'); }  /* « ,. » -> « . » : idem */
  function normMajInterne(t){
    t=String(t);
    return t.replace(_MAJOUTIL,function(m,av,mot,off){
      if(_NOMPROPRE.test(t.slice(off+m.length))) return m;
      return av+mot.charAt(0).toLowerCase()+mot.slice(1); }); }

  var _SALUT=/^(bonjour|bonsoir|salut|coucou)(?![a-zà-ÿœ])/i;
  var _GOUVERNE=/^\s*(?:[àa]|au|aux|de|du|des|d['’]|en|dans|sur|sous|par|pour|avec|sans|chez|vers|depuis|pendant|selon|entre|que|qu['’]|comme|si|quand|dont|bien)(?![a-zà-ÿœ])/i;
  function teteHorsPhrase(t){
    var m=_SALUT.exec(t||''); if(!m) return 0;
    var reste=t.slice(m[0].length);
    if(!reste.trim()) return 0;
    if(_GOUVERNE.test(reste)) return 0;
    return m[0].length; }
  // Insère les marques aux positions de MOT données, en respectant le texte d'origine (on ne
  // reconstruit pas la chaîne depuis les tokens : ça perdrait la casse et les espaces réels).
  // ⛔ « JAMAIS DE MARQUE APRES UN DETERMINANT OU UNE PREPOSITION » — mesure sur 78 022 virgules
  // reelles (UD + WiCoPaCo) : 0,32 % de contre-exemples, et le residu tenait a des ADVERBES que
  // j'avais mis a tort dans la liste (« De plus, », « Depuis, »). C'est le garde-fou qui refuse
  // « a la, plage » et « manger du, chocolat ».
  var _PASAPRES={};
  ("le la les un une des du de d au aux a en dans sur sous par pour avec sans chez vers depuis " +
   "pendant selon entre mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs ce cet " +
   "cette ces chaque aucun aucune plusieurs quel quelle quels quelles")
    .split(' ').forEach(function(w){ _PASAPRES[w]=1; });
  // Le token suivant est-il colle par un TRAIT D'UNION ? `DC.toks` coupe « Dessine-moi » en deux,
  // mais c'est UN groupe : on n'ecrit pas au milieu.
  function _avantTiret(txt,mots,z){
    var re=/[A-Za-zÀ-ÿœŒ'’ʼ]+/g,m,k=0,fin=-1;
    while((m=re.exec(txt))){ if(k===z){ fin=m.index+m[0].length; break; } k++; }
    return fin>=0 && txt.charAt(fin)==='-'; }

  // ⭐ LE SEUL RÉGLAGE DE L'ANCRE : le prix d'entrée que le CANAL TEXTE exige pour accepter une
  // marque proposée par l'audio. En dessous, il REFUSE — et ce refus est le maillon qui fait
  // marcher la combinaison. Sans lui l'ancre marquait CHAQUE pause et la justesse s'effondrait
  // (mesuré : 69 % -> 22 % sur le lit de 93 clips).
  // BALAYÉ, PAS DEVINÉ — et le genou tombe au MÊME endroit sur les deux bancs, ce qui le rend
  // crédible : 0,30 maximise le F1 sur le lit comme sur les prises de Rem.
  var PONCT_ANCRE_TAU = 0.30;
  // La tranche de texte D'ORIGINE entre deux indices de MOT (bornes incluses). On ne recolle
  // jamais les tokens : `DC.toks` supprime le trait d'union, or c'est lui qui porte l'inversion
  // (« viens-tu », « n'as-tu ») dont dépend toute la détection de question.
  function _trancheTexte(txt,a,b){
    var re=/[A-Za-z\u00C0-\u00FF\u0153\u0152'\u2019\u02BC]+/g,m,k=0,d=-1,f=-1;
    while((m=re.exec(txt))){ if(k===a) d=m.index; if(k===b){ f=m.index+m[0].length; break; } k++; }
    return (d>=0&&f>d) ? txt.slice(d,f) : ''; }

  // ⭐⭐⭐ LE CANAL TEXTE *À TRAVERS* UNE FRONTIÈRE DE SEGMENT.
  // Le modèle a été appris sur un FLUX de phrases concaténées : une frontière de segment est donc
  // EXACTEMENT sa forme d'entrée, sans adaptation. Il rend [rien, virgule, point] à la jointure.
  // ⭐ CE QUE LA DURÉE D'UNE PAUSE DIT DU TYPE DE MARQUE — vraisemblances P(durée | marque),
  // MESURÉES (dictee/ponct_audio_vrais_probe.py) sur 93 clips où l'on connaît la marque réelle ET
  // le silence vu par EXACTEMENT le détecteur du navigateur. Rendues [virgule, point].
  // ⚠️ CE SONT DES VRAISEMBLANCES, PAS DES PROBABILITÉS DE MARQUE : elles se MULTIPLIENT par ce
  // que dit le texte (qui, lui, porte déjà le prior). Les prendre pour une décision, c'est
  // l'erreur payée le 2026-08-05 — 264 points posés pour 10 justes.
  var _DUR_B=[0,30,90,180,300,450,600,900];
  var _DUR_L=[[0.299,0.159],[0.266,0.289],[0.301,0.266],[0.543,0.248],
              [0.569,0.286],[0.332,0.604],[0.305,0.652],[0.145,0.826]];
  function _durBiais(ms){ var k=_DUR_B.length-1; while(k>0 && ms<_DUR_B[k]) k--; return _DUR_L[k]; }

  function _txtFrontiere(a,b){
    if(!(DC&&DC.ponctDist&&DC.ponctReady&&DC.ponctReady())) return null;
    var ma=DC.toks(a)||[], mb=DC.toks(b)||[];
    if(!ma.length||!mb.length) return null;
    var tout=ma.concat(mb), tg=DC.posTags(tout)||[];
    return DC.ponctDist(tout,tg,ma.length-1,ma.length-1); }

  function _poseMarques(txt,mots,ins){
    var re=/[A-Za-zÀ-ÿœŒ'’ʼ]+/g,m,fins=[],k;
    while((m=re.exec(txt))) fins.push(m.index+m[0].length);
    var out='',prev=0;
    for(k=0;k<ins.length;k++){
      var i=ins[k][0]; if(i>=fins.length) continue;
      // ⛔ NE JAMAIS DOUBLER UNE MARQUE. Le texte porte déjà celles posées en amont (la virgule de
      // salutation, par exemple) : sans ce test on écrivait « Bonjour,, qu'est-ce que… ».
      if(/[,.;:!?]/.test(txt.charAt(fins[i]))) continue;
      out+=txt.slice(prev,fins[i])+ins[k][1]; prev=fins[i];
    }
    return out+txt.slice(prev); }

  /* ⭐ DOUBLON ANDROID, 2e FORME (2026-08-16) — le revenant, révélé PAR le fix de la double
     capture : la reco recapte enfin sur téléphone… et Android renvoie parfois des finals
     CUMULATIFS (un segment contient TOUT le texte déjà dit) ou RÉPÈTE un segment déjà rendu.
     L'écrasement par index (1re forme, déjà en place) ne couvre pas ces deux formes-là.
     Normalisation PURE des finals, miroir site/extension (voix_parite_probe la compare) :
     · final qui contient l'accumulé en PRÉFIXE → on ne garde que son DELTA ;
     · final déjà contenu dans l'accumulé → répétition pure, supprimé. */
  function _dedupFinals(finals){
    var ks=Object.keys(finals).map(Number).sort(function(a,b){return a-b;});
    var out={}, acc='';
    for(var k=0;k<ks.length;k++){
      var f=(finals[ks[k]]||'').trim(); if(!f) continue;
      var accN=acc.toLowerCase(), fN=f.toLowerCase();
      if(acc && fN.indexOf(accN)===0){ f=f.slice(acc.length).replace(/^[\s,]+/,''); }
      else if(acc && accN.indexOf(fN)>=0){ f=''; }
      if(f){ out[ks[k]]=f; acc=acc?acc+' '+f:f; }
    }
    return out;
  }
  function _commandesVocales(t){
    /* MODE COMMANDE (acté 2026-08-05, construit 2026-08-16 pour le mobile sans pitch) : Google
       n'émet AUCUNE ponctuation en fr-FR — dire « virgule » écrivait le MOT. Mesuré sur 9,4 M mots
       (voix_commande_probe) : tous les mots-commandes sont LIBRES (≈0 usage ordinaire) SAUF
       « point » (6,17/10 000 : « un point de vue ») → garde fermée DET/NUM/qualificatif devant, et
       « point de/du » exclu. La surcharge explicite rend la certitude là où l'automatique plafonne
       — et rend le « ? » au MOBILE, où le pitch n'existe plus (une seule capture micro). */
    t=t.replace(/\s*\bpoints? d[’']interrogation\b/gi,' ?');
    t=t.replace(/\s*\bpoints? d[’']exclamation\b/gi,' !');
    t=t.replace(/\s*\bdeux[- ]points\b/gi,' :');
    t=t.replace(/\s*\bpoints? de suspension\b/gi,'…');
    t=t.replace(/\s*\bpoint[- ]virgule\b/gi,' ;');
    t=t.replace(/\s*\bvirgule\b/gi,',');
    t=t.replace(/\s*\bnouvelle ligne\b|\s*\bà la ligne\b/gi,'\n');
    t=t.replace(/([^\s]+)[  ]+point\b(?![  ]*(?:de\b|d[’']|du\b|final\b|commun\b))/gi,function(m,prev){
      return /^(un|le|ce|du|au|mon|ton|son|leur|notre|votre|chaque|quel|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|dernier|premier|petit|grand|bon|beau|meme|même)$/i.test(prev)?m:(prev+'.');});
    return t;
  }
  function prosodyText(state){
    var ks=Object.keys(state.finals).map(Number).sort(function(a,b){return a-b;}); var segs=[];
    for(var k=0;k<ks.length;k++){ var t=_commandesVocales((state.finals[ks[k]]||'').trim().replace(/[.,;:!?…]+$/,'').trim()); if(t)segs.push({t:t.charAt(0).toLowerCase()+t.slice(1),idx:ks[k]}); }  // norm : enlève la MAJ d'amorce Google
    if(!segs.length) return null;
    // ⚠️⚠️ SEUILS D'ORIGINE DE LA VOIE A (commit 32ba743) : COMMA=190, PERIOD=600, QR=4.
    // LE PLANCHER À 190 MANQUAIT ICI (perdu en PR#311, restauré côté site mais pas côté extension) :
    // sans lui, `sil>=600?'.':','` donnait au MINIMUM une virgule à CHAQUE frontière de segment,
    // même à 0 ms de silence. C'est la divergence qu'a laissée le rollback — corrigée, parité rétablie.
    var COMMA=190, PERIOD=600, QR=4;
    var CONT=/^(et|mais|ou|car|donc|ni|puis|alors|aussi|qui|que|qu|dont|quand|si|comme|parce|puisque|lorsque)\b/i;
    // ⭐ PAS DE VIRGULE DEVANT « et / ou / ni » (BDL/OQLF). On ne fait que RÉTROGRADER : une virgule
    // devient RIEN (les segments se recollent), un vrai POINT (≥ 600 ms) reste un point.
    var COORD=/^(et|ou|ni)(?![a-zà-ÿœ'’])/i;
    var QW=/^(est-ce|qu'est|où|comment|pourquoi|quand|combien|quel|quelle|quels|quelles|lequel|laquelle)(?![a-zà-ÿœ])/i;   // interrogatifs FORTS en tête (lookahead car \b casse après « où »)
    // ⭐⭐ DÉTECTION DE QUESTION — version MESURÉE (l'ancienne règle « interrogatif en tête » faisait
    // 45,5 % de précision : 79 faux sur 145, sur 48 653 phrases réelles). Nouvelle règle : 100 %,
    // 0 faux sur 60 998 échantillons. Le BDL confirme la cause principale : L'INTERROGATION
    // INDIRECTE NE PREND PAS DE « ? » (« Je me demande à quelle heure. »). ⚠️ La règle s'ancre sur
    // la TÊTE DU SEGMENT : le dégât arrive quand Google coupe AU MILIEU de l'énoncé et rend un
    // segment « quelle heure il est » — l'ancienne règle y posait un « ? » sur une subordonnée.
    // L'inversion SEULE a été
    // mesurée et refusée (69,4 %) — lue uniquement APRÈS un interrogatif. Le PITCH reste le seul
    // canal pour l'interrogation par INTONATION (« Tu pars dans un mois ? ») : les deux se complètent.
    // ⭐⭐⭐ DÉTECTION DE QUESTION PAR LES PARTIES DU DISCOURS (2026-08-05).
    // L'ancienne version était une LISTE DE MOTS. Passée sur les formes que Rem a nommées, elle
    // faisait 5/10 : elle ratait TOUTE l'interro-négative (« Ne viens-tu pas ? », « N'as-tu pas
    // vu ? », « … n'est-ce pas ? ») et toute l'inversion nue (« Viens-tu demain ? »). Pas par
    // manque de vocabulaire : parce qu'UNE LISTE NE VOIT PAS UNE STRUCTURE. « verbe + clitique
    // sujet postposé » est un fait de PARTIES DU DISCOURS — et le tagger HMM était déjà chargé
    // ici (`pos-hmm.json.gz`), la ponctuation ne l'appelait simplement jamais.
    //
    // L'INVERSION SEULE AVAIT ÉTÉ MESURÉE ET REFUSÉE (69,4 %). Ses deux familles d'échec sont
    // connues et TOUTES DEUX décidables avec les étiquettes :
    //   · inversion STYLISTIQUE (« peut-être est-elle partie ») -> adverbe ANTÉPOSÉ, liste fermée ;
    //   · INCISE de citation (« je viendrai, dit-il ») -> ⭐ un VERBE CONJUGUÉ précède déjà.
    //     C'est cette garde-là qui rend l'inversion utilisable.
    //
    // MESURÉ sur 72 498 cas réels (UD FR GSD + WiCoPaCo + GEC + multi1000), dont 27 145 FRAGMENTS
    // de milieu de phrase — le piège propre à la dictée, où Google coupe où il veut :
    //     ancienne (liste de mots)   précision 96,55 %   rappel  8,92 %
    //     ⭐ celle-ci (tagger)       précision 95,83 %   rappel 14,65 %
    // +64 % de rappel pour UN faux positif de plus en valeur absolue (2 contre 1 sur 72 498).
    // Et sur les 2 restants : « Doit-on hériter de ceux qu'on assassine » EST une question, écrite
    // avec un point dans le corpus (titre) ; l'autre est un fragment dont le déclencheur
    // (« Non seulement … ») est hors du fragment. Aucun n'est réparable sans deviner.
    //
    // DÉGRADATION DOUCE : si le tagger n'est pas prêt, `posTags` rend null, les gardes verbales
    // ne s'arment pas et on retombe sur les seules routes lexicales. Aucune exception.
    var CLIT='je|tu|il|elle|on|ils|elles';
    // ⚠️ NOUS et VOUS EXCLUS de l'inversion nue — c'était déjà écrit dans les notes de juillet
    // (« l'impératif prend moi/toi/lui/nous/vous/y/en ») et le banc l'a confirmé sans pitié :
    // « Abonnez-vous dès maintenant » était compté comme une question. Ils redeviennent sûrs
    // APRÈS un interrogatif, où l'impératif est impossible.
    var QINV=new RegExp("([A-Za-zÀ-ÿœ']+)-(?:t-)?("+CLIT+")(?![-\\w])",'i');
    var QINV_Q=new RegExp("([A-Za-zÀ-ÿœ']+)-(?:t-)?("+CLIT+"|nous|vous)(?![-\\w])",'i');
    // l'incise EN TÊTE de fragment (« disent-ils, … ») : la garde « verbe avant » ne peut pas la
    // voir puisque le fragment COMMENCE par elle. Sa signature est la virgule qui la referme.
    // ⛔ INCISE EN TÊTE (« disent-ils, peuvent jouer… »). ⚠️ Ma 1re garde cherchait la VIRGULE qui
    // la referme : elle marche sur du texte écrit — donc sur le banc — mais **un segment vocal
    // n'a AUCUNE ponctuation**, elle y serait INERTE. La garde CI l'a montré. Il faut une
    // signature qui survive à l'absence de ponctuation : les VERBES DE PAROLE, liste fermée, et
    // seulement quand l'inversion est en TÊTE (ailleurs, la garde « verbe déjà conjugué » suffit).
    // Coût assumé : « Dis-tu vrai ? » est perdu — forme rare, et le pitch la rattrape.
    var QINCISE=new RegExp("^\\s*[A-Za-zÀ-ÿœ']+-(?:t-)?("+CLIT+")\\s*,",'i');
    var QPAROLE=/^(dit|dis|disent|disait|répondit|repondit|répond|repond|ajouta|ajoute|demanda|s['’]écria|secria|fit|reprit|poursuivit|murmura|songea|expliqua|précisa|precisa|lança|lanca|conclut|renchérit|rencherit)$/i;
    var QADV=/^\s*(?:peut-être|sans doute|ainsi|aussi|à peine|a peine|du moins|encore|en vain|toujours est-il|aussi bien|tout au plus|rarement|jamais|non seulement)\b/i;
    var QTAG=/\bn['’]est-ce\s+pas\s*$/i;
    // ⚠️ ANCRÉ EN TÊTE : sans l'ancre, « se demandant quand est-ce qu'il va sortir » (interrogation
    // INDIRECTE, que le BDL exclut explicitement du « ? ») redevenait une question.
    var QEQ=/^\s*est-ce\s+(?:que|qu['’])/i;
    var QEQ3=/^\s*est-ce(?!\s+qu)(?![a-zà-ÿœ])/i;   // « est-ce possible ? » : en TETE, « est-ce » n'a pas d'emploi non interrogatif
    var QEQ2=/^\s*[a-zà-ÿœ']+\s+est-ce\s+(?:que|qu['’])/i;
    var QW_PREP=/^\s*(?:à|a|de|d['’]|par|pour|avec|sur|dans|en|chez|vers|depuis|selon)\s+(?:quoi|qui|quel|quelle|quels|quelles|lequel|laquelle|lesquels|lesquelles)(?![a-zà-ÿœ])/i;   // interrogatif precede de sa preposition : « a quoi penses-tu ? »
    var QSEUL=/^(qu['’]est|comment|pourquoi|combien)(?![a-zà-ÿœ])/i;
    var QPRON=/^(lequel|laquelle|lesquels|lesquelles)(?![a-zà-ÿœ])/i;   // pronom interrogatif SUJET (garde anti-relatif : verbe juste apres)
    var QEUPH=/[A-Za-zÀ-ÿœ']+-t-(?:il|elle|on|ils|elles)(?![-\w])/i;   // « t » euphonique : 74/74 inversions dans UD, ancrage ORTHOGRAPHIQUE (tient la ou le tagger lache)
    var QPARTPAROLE=/^\s*(?:affirmé|précisé|precise|déclaré|declare|ajouté|ajoute|expliqué|explique|indiqué|indique|souligné|souligne|conclu|poursuivi|répondu|repondu|confié|confie|assuré|assure|estimé|estime|noté|note|rappelé|rappele|lancé|lance|martelé|martele|insisté|insiste|dit|écrit|ecrit)(?![a-zà-ÿœ])/i;   // participes de parole = incise au temps compose. ⚠️ PAS de  apres une lettre accentuee : en JS \w=[A-Za-z0-9_], donc la frontiere n'existe jamais et la regex ne matche RIEN (echec SILENCIEUX, deja paye)
    var QVERBAL={VERB:1,AUX:1};
    // le « ne » de la négation, collé (n') ou non, AVANT le verbe inversé ; et sa seconde moitié APRÈS
    var QNEG1=/(^|[\s'’])(?:ne\s|n['’])/i;
    var QNEG2=/^\s*(?:pas|plus|jamais|rien|gu[èe]re|personne|aucun|aucune)\b/i;
    function estQuestion(t){
      if(!t) return false;
      var mots=(DC&&DC.toks)?DC.toks(t):null;
      if(!mots||!mots.length||mots.length>12) return false;   // au-delà : titre ou subordonnée
      if(QTAG.test(t)) return true;
      // ⭐ ÉLISION : `toks` garde l'apostrophe dans le token, donc « n'as-tu » donne « n'as » —
      // une forme que le modèle (appris sur UD, qui SÉPARE les clitiques) n'a jamais vue. Il ne la
      // tague pas VERB, la garde verbale ne s'arme pas, et « N'as-tu pas vu le film ? » retombait
      // en affirmative. On tague une COPIE dont le clitique élidé est retiré : les INDICES sont
      // préservés, donc tout le reste de la fonction est inchangé.
      var motsTag=mots.map(function(w){ return w.replace(/^(?:n|j|t|s|m|qu|l|d|c)['’]/i,'') || w; });
      var tg=null;
      function tag(i){ if(tg===null) tg=((DC&&DC.posTags)?DC.posTags(motsTag):null)||[]; return tg[i]; }
      var qw=QW.test(t)||QW_PREP.test(t);   // « a quoi penses-tu » : la tete interrogative peut etre precedee de sa preposition
      var m=(qw?QINV_Q:QINV).exec(t);
      // ⭐ ROUTE INTERRO-NÉGATIVE, indépendante du tagger. « n'as-tu pas … » : `toks` rend le token
      // « n'as », et même dé-élidé en « as » le modèle l'étiquette PROPN en tête (mesuré) — « as »
      // y est trop rare comme auxiliaire dans UD. La garde verbale ne s'arme pas et la question
      // retombait en affirmative. Or le cadre « ne … pas » ENCADRANT un clitique sujet POSTPOSÉ
      // n'existe qu'à l'interrogatif : l'affirmative met le clitique AVANT (« tu n'as pas vu »),
      // jamais après. C'est de l'ORDRE DES MOTS, ça ne demande aucun tagger.
      if(m && QNEG1.test(t) && QNEG2.test(t.slice(m.index+m[0].length)) && !QADV.test(t)) return true;
      if(m && !QINCISE.test(t)){
        var iv=DC.toks(t.slice(0,m.index)).length;
        // incise en tête sans ponctuation : un VERBE DE PAROLE inversé au tout début
        if(iv===0 && QPAROLE.test(m[1])) return false;
        if(QPARTPAROLE.test(t.slice(m.index+m[0].length))) return false;   // « … », a-t-il affirmé » : l'auxiliaire est inverse, le verbe de parole est le PARTICIPE qui suit
        // ⭐ SANS LE TAGGER : le « t » euphonique (fait d'orthographe) et l'interrogatif en tete
        // (l'imperatif y est impossible). Mesure 2026-08-06 : le tagger lit « a/ADP » dans
        // « a-t-il raison » et « devrions/NOUN » dans « ou devrions-nous » — la regle avait raison,
        // c'est sa confirmation qui echouait. Les GARDES, elles, restent toutes.
        if(QVERBAL[tag(iv)]===1 || QEUPH.test(t) || qw || iv===0){   // iv===0 : inversion EN TETE — l'imperatif prend moi/toi/nous/vous, jamais je/tu/il/elle/on/ils/elles
          if(QADV.test(t)) return false;                      // inversion stylistique
          for(var k=0;k<iv;k++) if(QVERBAL[tag(k)]===1) return false;   // incise : proposition déjà close
          return true;
        }
      }
      if(QEQ.test(t)) return true;
      if(QEQ3.test(t)) return true;   // « est-ce possible ? » — sans « que »
      if(qw && QEQ2.test(t)) return true;
      // dernier recours : l'interrogatif seul en ordre affirmatif (4e forme du BDL, celle que
      // seule l'INTONATION signale). Le tagger ferme le FP que la liste ne voyait pas :
      // l'interrogation INDIRECTE enchaîne un GN plein (« comment UNE PERSONNE a obtenu… »).
      if(QPRON.test(t) && t.indexOf(',')<0 && QVERBAL[tag(1)]===1) return true;   // « Lequel est le plus grand ? » ; le relatif, lui, porte un clitique (« laquelle lui repond »)
      if(!QSEUL.test(t) || t.indexOf(',')>=0) return false;
      return tag(1)!=='DET';
    }
    var au=state.au, useAudio=au&&au.tl&&au.tl.length, thr=useAudio?_seuilSilence(au):0;
    function riseAt(idx){ return (useAudio&&idx!=null&&state.ftimes[idx]!=null)?riseEndingAt(au.tl,state.ftimes[idx]-500,state.ftimes[idx]):0; }
    // ── ⭐⭐⭐ L'ANCRE TEMPORELLE : après quel MOT tombe chaque pause, et combien elle dure.
    // ⭐ ELLE IGNORE L'HORLOGE DE GOOGLE, ET C'EST CE QUI LÈVE LE BLOCAGE. On a longtemps buté sur
    // « deux moteurs sans horloge commune » : Google a les mots, notre capture a le temps, et les
    // `ftimes` datent l'ARRIVÉE des résultats, pas la parole. Le mur n'existait que tant qu'on
    // cherchait à RECALER les deux horloges. Ici on ne recale rien : on aligne LA SUITE DE MOTS
    // (toute la dictée d'un coup) sur LE SIGNAL. `ftimes` n'intervient nulle part.
    // ⚠️ SEULE, cette ancre est MAUVAISE et c'est mesuré : 44 % de placement exact sur 90 clips
    // lus, 1/12 sur la voix de Rem. Elle ne vaut QUE combinée au canal texte, juste en dessous —
    // mesuré F1 0,220 -> 0,309 (lit) et 0,333 -> 0,480 (voix de Rem).
    var _anc=null, _finTr=null;   // _finTr : derniere phrase du dernier segment (cf. plus bas)
    if(useAudio && DC && DC.ponctAncre && DC.ponctReady && DC.ponctReady()){
      var _tkS=[],_glo=[],_map=[],_q,_z2,_s0;
      for(_s0=0;_s0<segs.length;_s0++){
        var _tk=DC.toks(segs[_s0].t)||[]; _tkS.push(_tk);
        for(_q=0;_q<_tk.length;_q++){ _map.push([_s0,_q]); _glo.push(_tk[_q]); }
      }
      if(_glo.length>3){
        var _pz=DC.ponctAncre(_glo,au.tl,thr,COMMA), _tgG=DC.posTags(_glo)||[];
        _anc={};
        for(_q=0;_q<_pz.length;_q++){
          var _ig=_pz[_q][0], _ms=_pz[_q][1], _bi=-1, _bp=-1, _dd, _c, _pp;
          // ⭐ LE CANAL TEXTE RECALE, PUIS REFUSE. L'ancre vise à ±1 mot ; le texte choisit lequel
          // des trois est GRAMMATICALEMENT possible, et si aucun ne l'est, il refuse. C'est la
          // division du travail qui paie : l'audio apporte une preuve que le texte n'a pas
          // (quelqu'un s'est tu), le texte apporte une légalité que l'audio ignore.
          for(_z2=-1;_z2<=1;_z2++){
            _c=_ig+_z2; if(_c<0||_c>=_glo.length-1) continue;
            if(_PASAPRES[String(_glo[_c]).toLowerCase()]) continue;   // « à la, plage » : interdit
            _dd=DC.ponctDist(_glo,_tgG,_c,0);
            _pp=_dd?(_dd[1]+_dd[2]):0;
            if(_pp>_bp){ _bp=_pp; _bi=_c; }
          }
          if(_bi<0 || _bp<PONCT_ANCRE_TAU) continue;                  // le texte REFUSE
          // ⭐ ET LE TYPE VIENT DU TEXTE, PAS DE LA DUREE — corrige par la garde CI, qui a ressorti
          // « Alors demain. Je ne sais pas encore. On va aller au marche. » : la regression exacte
          // que Rem avait signalee (6 points dans un segment de 7,9 s, PR#380).
          // LA RAISON EST MESUREE : en dictee DYS, une pause longue n'est PAS une fin de phrase.
          // Sur la prise de Rem, il se tait 1530 ms la ou il ecrit une VIRGULE. La falaise a 600 ms
          // vaut pour du discours lu, pas pour lui — et c'est lui qu'on sert.
          // Division du travail finale : l'AUDIO dit QU'IL Y A une marque (il a entendu le
          // silence), le TEXTE dit LAQUELLE (il a la grammaire). Chacun ne repond qu'a ce qu'il
          // sait. `_dd` est deja la distribution a la position retenue.
          var _mkA=(_dd && _dd[2]>_dd[1]) ? '.' : ',';
          var _sl=_map[_bi]; if(!_sl) continue;
          // le DERNIER mot d'un segment est une FRONTIÈRE : elle est déjà traitée plus bas, avec
          // le silence mesuré entre segments. On ne la double pas.
          if(_sl[1]>=_tkS[_sl[0]].length-1) continue;
          // le 3e champ (_pz[_q][2]) est l'INSTANT ou la parole s'arrete : il permet de lire la
          // melodie juste avant la pause, donc de reconnaitre la question d'ordre AFFIRMATIF.
          (_anc[_sl[0]]=_anc[_sl[0]]||[]).push([_sl[1], _mkA, _pz[_q][2]]);
        }
      }
    }

    var out=(state.base.trim()?state.base.trim()+' ':''), s;
      for(s=0;s<segs.length;s++){
      if(s>0){ var pv=segs[s-1], nx=segs[s], mk;
        var _dfM=useAudio?null:_txtFrontiere(pv.t,nx.t);
        var _fr50=!!_dfM&&Math.max(_dfM[1]||0,_dfM[2]||0)>0.5;
        /* ⭐ SANS AUDIO, `estQuestion` ne CRÉE pas de frontière — elle SURCLASSE. Android
           fragmente les finals N'IMPORTE OÙ (« est-ce » | « que je vais à la plage ») : la règle,
           100 % de précision sur des FINS D'ÉNONCÉ desktop (un final Google y tombe sur une vraie
           pause), devenait fausse sur des fragments arbitraires — « Est ce ? que je vais à la
           plage. » (téléphone de Rem, 2026-08-16). Mesuré sur le moteur : le modèle texte donne
           p(rien)=0,86 à cette jointure — il REFUSE, et le refus doit gagner (acté PR#394/409).
           Un « ? » ne se pose ici que là où le texte AFFIRME une frontière (p>0,5). Avec audio,
           rien ne change : les finals desktop tombent sur de vraies pauses. */
        if((useAudio||_fr50)&&(estQuestion(pv.t)||riseAt(pv.idx)>QR)) mk='?';                    // le segment qui SE FERME est une question (lexical OU pitch montant)
        else if(useAudio){ var sil=silBetween(au.tl,thr,(state.ftimes[pv.idx]||0)-100,(state.ftimes[nx.idx]||1e9));
          // ⭐⭐⭐ L'AUDIO DIT QU'IL Y A UNE MARQUE, LE TEXTE DIT LAQUELLE.
          // C'est la même division du travail qu'À L'INTÉRIEUR des segments — et c'est ici qu'elle
          // manquait encore. La falaise « >= 600 ms => POINT » y régnait, et elle est FAUSSE POUR
          // LA PAROLE DYS : Rem dicte par petits blocs séparés d'une pause, donc CHAQUE frontière
          // devenait une fin de phrase. Sa dictée réelle du 2026-08-06 sortait ainsi :
          //   « Nous irons. Manger des pommes. » — un point entre un verbe et son complément ;
          //   « Il y avait. Des oranges des violettes. » — et pas une seule virgule de tout le texte.
          // Reproduit à l'identique en banc, à 700, 900 et 1500 ms : la durée seule ne peut pas
          // distinguer « je respire » de « je termine ma phrase », et chez un dys elle se trompe
          // presque toujours. Le texte, lui, sait que « nous irons » appelle un complément.
          // ⚠️ LE PLANCHER À 190 ms RESTE : sous lui, l'audio dit qu'il n'y a RIEN, et le texte
          // n'est pas consulté. On ne remplace pas une preuve par une opinion.
          // ⚠️ LE TEXTE NE DOIT PAS *ÉCRASER* LA DURÉE — la garde CI l'a montré tout de suite :
          // à 300 ms il imposait un point (« Il fait beau. Je sors. ») là où la brièveté de la
          // pause dit virgule, et à 900 ms devant « et » on perdait la coupure de phrase.
          // ⇒ ON MULTIPLIE. Le texte donne la probabilité de chaque type, la durée donne sa
          // VRAISEMBLANCE mesurée : posterior ∝ texte × durée. Un texte sûr l'emporte ; un texte
          // hésitant laisse la durée trancher. Aucun seuil nouveau — juste deux sources qui
          // apportent chacune ce qu'elle sait, la forme d'arbitrage de la maison.
          if(sil>=COMMA){ var _df=_txtFrontiere(pv.t,nx.t), _lb=_durBiais(sil);
            mk = _df ? (((_df[2]*_lb[1]) > (_df[1]*_lb[0])) ? '.' : ',')
                     : (sil>=PERIOD?'.':',');   // repli : la durée seule, si le modèle n'est pas chargé
          } else mk=''; }               // sous 190 ms : RIEN
        else {
          /* ⭐ SANS AUDIO (mobile : UNE seule capture micro, gate PR#492) : aucune durée n'est
             mesurée — et cette branche, JAMAIS exécutée sur desktop (l'audio y est toujours là),
             posait un POINT par défaut à CHAQUE frontière. Résultat chez Rem (2026-08-16) :
             « des points partout » — le précédent acté du 2026-08-06 (« Nous irons. Manger des
             pommes. », la falaise durée→point) sous sa forme sans-audio. La règle actée vaut à
             plus forte raison ici : sans preuve de durée, le TEXTE seul décide (ponctDist), et
             sans certitude on n'affirme RIEN — plutôt sous-ponctuer que hacher la dictée. */
          /* ⭐ LE REFUS EST LE MAILLON (acté PR#394 : sans lui, justesse 69 % → 22 % ; seuil 0,50
             balayé PR#409 = « déjà le meilleur », monter coûte 94 % du rappel). Pas d'argmax nu :
             une marque ne se pose que si le modèle la donne à PLUS D'UNE CHANCE SUR DEUX. */
          mk = _fr50 ? (((_dfM[2]||0) >= (_dfM[1]||0)) ? '.' : ',')
             : (!_dfM && CONT.test(nx.t) ? ',' : '');
        }
        if(mk===',' && COORD.test(nx.t)) mk='';                             // « … , et … » -> « … et … » (BDL)
        // ⛔⛔ NE JAMAIS EMPILER DEUX MARQUES À LA JOINTURE. `_poseMarques` a bien une garde
        // anti-doublon, mais elle regarde le texte du segment COURANT : elle ne peut pas voir la
        // marque que la jointure va coller APRÈS elle. Résultat sur la prise de Rem :
        // « je sais pas comment,, on va le faire » et « certaines sauces., certaines choses ».
        // ⭐ ET ON NE SE CONTENTE PAS D'IGNORER : la marque LA PLUS FORTE gagne. L'audio qui a
        // entendu une longue pause, ou le texte qui a reconnu une question, en savent PLUS que la
        // virgule déjà posée en fin de segment — on la remplace au lieu de la doubler.
        var _fin=out.replace(/\s*$/,''), _der=_fin.slice(-1), _RG={',':1,';':1,':':1,'.':2,'!':2,'?':3};
        if(/[,.;:!?]/.test(_der)){ if((_RG[mk]||0)>(_RG[_der]||0)) _fin=_fin.replace(/\s*[,.;:!?]$/,''); else mk=''; }
        out=_fin+(mk?((mk==='?'?' ':'')+mk):'')+' '; }                      // espace AVANT le « ? » : règle FR
      var txt=segs[s].t;
      if(s===0 && !state.base.trim()){ var n=teteHorsPhrase(txt); if(n) txt=txt.slice(0,n)+','+txt.slice(n); }      // ── ⭐⭐⭐ LES MARQUES *DANS* LE SEGMENT, PAR LE CANAL TEXTE.
      // C'est le trou que rien ne comblait : on ne posait de marque QU'AUX frontières de segment,
      // or Google ne coupe qu'aux pauses >= 600 ms et les virgules françaises vivent vers 350 ms
      // (mesuré, 47 locuteurs) — elles sont DANS les segments.
      // ⚠️ L'AUDIO NE PARLE PAS ICI, et c'est délibéré : il n'y a AUCUNE ancre temporelle à
      // l'intérieur d'un segment (les `ftimes` datent la latence de Google, pas la parole). La
      // tentative précédente d'y poser des marques depuis le son a été mesurée-réfutée (2/10 sur
      // la prise libre de Rem). Le canal texte, lui, n'a besoin que des mots.
      // SEUIL : on n'écrit que si la marque DOMINE nettement — un texte sur-ponctué coûte plus
      // cher à un dys qu'un texte sous-ponctué (doctrine, et mesuré sur ses retours).
      if(DC && DC.ponctReady && DC.ponctReady()){
        var _mots=DC.toks(txt);
        if(_mots.length>1){   // 3 -> 1 : l'ancre doit pouvoir parler dans un segment court
          var _tg=DC.posTags(_mots)||[], _dep=0, _ins=[], _z;
          // ⛔ LE CANAL TEXTE GARDE SON SEUIL DE 3 MOTS, et la garde CI a exige qu'on le remette :
          // en l'ouvrant a 1 mot pour laisser passer l'ancre, on a fait sortir « Salut, bien,
          // monsieur », « Merci, beaucoup » et « Bonjour, les amis » — le modele de texte n'a
          // simplement pas assez de contexte dans un segment de trois mots. L'ANCRE, elle, n'a pas
          // besoin de contexte : elle a ENTENDU la pause. Les deux ne meritent donc pas le meme
          // droit d'entree, et c'est pour ca que la condition est ici et non plus haut.
          for(_z=0;_mots.length>3 && _z<_mots.length-1;_z++){
            var _d=DC.ponctDist(_mots,_tg,_z,_dep);
            // ⛔ GARDE STRUCTURELLE, remise après que la garde CI a ressorti « Dessine,-moi, un
            // mouton » — la régression exacte que Rem avait signalee (PR#380). Deux interdits :
            //  · JAMAIS de marque apres un DETERMINANT ou une PREPOSITION. Mesure sur 78 022
            //    virgules reelles (UD + WiCoPaCo) : 0,32 %. C'est ce qui refuse « a la, plage ».
            //  · JAMAIS devant un TRAIT D'UNION : « Dessine-moi », « est-il » sont un seul groupe
            //    verbe+clitique, et `DC.toks` les coupe en deux tokens — sans cette garde on
            //    ecrirait au milieu.
            // ⚠️ SEUILS ASYMÉTRIQUES, et la raison est structurelle : Google N'A PAS COUPÉ ici.
            // Ce non-découpage est une preuve FAIBLE contre une fin de phrase (il ne coupe qu'au-delà
            // de ~600 ms), mais ce n'est pas RIEN. Poser un POINT là où le moteur n'a pas coupé est
            // donc une affirmation plus forte que poser une virgule : on l'exige plus sûre.
            // La garde CI a sorti « Quelle heure. Il est. » avec un seuil symétrique.
            var _seuil = (_d && _d[2]>_d[1]) ? 0.70 : 0.50;
            if(_d && !_PASAPRES[_mots[_z].toLowerCase()] && !_avantTiret(txt,_mots,_z)
               && (_d[1]>_seuil || _d[2]>_seuil)) { _ins.push([_z, _d[2]>_d[1]?'.':',']); _dep=0; }
            else _dep++;
          }
          // ── ⭐⭐⭐ LES RÈGLES DE VIRGULE D'ALLÔ PROF, par-dessus le modèle. Elles connaissent
          // des FAMILLES que la statistique ignore : coordonnant entre deux phrases, coordonnant
          // en tête, interjection/incidente, corrélation, « ni » répété. Mesuré sur 11 304
          // phrases écrites par des humains : justesse 50,53 -> 52,02 %, rappel 10,97 -> 12,80 %.
          // ⚠️ UNION, jamais remplacement, et MÊMES GARDES que le modèle (`_PASAPRES`,
          // `_avantTiret`) : une règle n'a pas le droit d'écrire là où le modèle s'interdit
          // d'écrire. Elles s'appliquent DÈS 2 MOTS — contrairement au modèle statistique elles
          // n'ont pas besoin de contexte, elles lisent une liste fermée (« Zut, j'ai oublié »).
          // ⭐ FUSION AVEC L'ANCRE. Le canal texte a posé ce dont il était sûr ; l'ancre ajoute
          // ce qu'elle a ENTENDU et que le texte a validé. UNION, jamais remplacement : on ne
          // retire pas une marque que le texte tenait pour sûre.
          if(_anc && _anc[s]){
            var _dj={},_w; for(_w=0;_w<_ins.length;_w++) _dj[_ins[_w][0]]=1;
            for(_w=0;_w<_anc[s].length;_w++){
              var _ia=_anc[s][_w][0];
              if(_dj[_ia]) continue;                                  // le texte l'avait déjà
              if(_avantTiret(txt,_mots,_ia)) continue;                // « Dessine-moi » = un groupe
              _ins.push([_ia,_anc[s][_w][1],_anc[s][_w][2]]);
            }
            _ins.sort(function(a,b){return a[0]-b[0];});              // _poseMarques exige l'ordre
          }
          // ── ⭐⭐⭐ LES RÈGLES DE VIRGULE D'ALLÔ PROF, par-dessus les deux canaux. Elles
          // connaissent des FAMILLES que la statistique ignore : coordonnant entre deux phrases,
          // coordonnant en tête, interjection/incidente, corrélation, « ni » répété.
          // MESURÉ sur 11 304 phrases écrites par des humains : justesse 50,53 -> 52,02 %,
          // rappel 10,97 -> 12,80 % — meilleur sur les DEUX axes, ce qui est rare et ce qui a
          // décidé la livraison.
          // ⚠️ APRÈS LA FUSION, ET C'EST VOULU : les règles reçoivent `_dr`, la liste de ce qui
          // est DÉJÀ posé par le modèle ET par l'ancre, pour ne pas empiler deux détachements
          // (« Alors, demain, je ne sais pas » — sorti par la garde CI sur la prise libre de Rem).
          // ⚠️ UNION, jamais remplacement, et MÊMES GARDES que le modèle (`_PASAPRES`,
          // `_avantTiret`) : une règle n'a pas le droit d'écrire là où le modèle s'interdit
          // d'écrire. Elles s'appliquent DÈS 2 MOTS — contrairement au modèle statistique elles
          // n'ont pas besoin de contexte, elles lisent une liste fermée (« Zut, j'ai oublié »).
          if(DC.ponctReglesVirgule){
            var _dr={},_r; for(_r=0;_r<_ins.length;_r++) _dr[_ins[_r][0]]=1;
            DC.ponctReglesVirgule(_mots,_tg,_dr).forEach(function(_ir){
              if(_dr[_ir] || _ir<0 || _ir>=_mots.length-1) return;
              if(_PASAPRES[String(_mots[_ir]).toLowerCase()]) return;
              if(_avantTiret(txt,_mots,_ir)) return;
              _ins.push([_ir,',']);
            });
            _ins.sort(function(a,b){return a[0]-b[0];});
          }
          // ── ⭐⭐⭐ LE TYPE DE FIN DE PHRASE : POINT ou POINT D'INTERROGATION.
          // Passe unique sur les marques finales. Sans elle, toute fin de phrase INTERNE était
          // forcément un point — l'ancre en crée désormais, donc le trou était actif.
          // `_deb` = premier mot de la phrase EN COURS dans ce segment ; il repart après chaque
          // fin de phrase. Une phrase commencée dans le segment PRÉCÉDENT donne une tranche
          // tronquée, et c'est acceptable : `estQuestion` a été mesurée sur 27 145 FRAGMENTS de
          // milieu de phrase, c'est précisément son terrain.
          var _deb2=0,_u;
          for(_u=0;_u<_ins.length;_u++){
            if(_ins[_u][1]==='.'){
              var _tq=_trancheTexte(txt,_deb2,_ins[_u][0]);
              // ① la GRAMMAIRE (parties du discours) : est-ce que, inversion, interro-négative…
              var _q1=estQuestion(_tq);
              // ② sinon la MÉLODIE, seule route pour l'ordre AFFIRMATIF (« Tu pars demain ? »),
              //    4e forme du BDL. `_ins[_u][2]` n'existe que pour les marques venues de l'ancre.
              var _q2=(!_q1 && useAudio && _ins[_u][2]!=null &&
                       riseEndingAt(au.tl,_ins[_u][2]-500,_ins[_u][2])>QR);
              if(_q1||_q2) _ins[_u][1]=' ?';        // espace AVANT le « ? » : règle typographique FR
            }
            if(_ins[_u][1]!==',') _deb2=_ins[_u][0]+1;
          }
          // ⭐ MEMORISE LA DERNIERE PHRASE DU SEGMENT (texte brut). La marque FINALE de la dictee
          // se decidait sur le segment ENTIER : quand celui-ci contient plusieurs phrases, un
          // « est-ce que » en tete faisait mettre un « ? » a la fin d'une phrase affirmative.
          // Bug anterieur, revele par le cas de garde « QUESTION INTERNE ».
          if(s===segs.length-1) _finTr=_trancheTexte(txt,_deb2,_mots.length-1);
          if(_ins.length) txt=_poseMarques(txt,_mots,_ins);
        }
      }
      
      out+=txt; }
    var last=segs[segs.length-1];
    var _finT2=_finTr||last.t;
    /* ⭐ SANS AUDIO, la dernière PHRASE enjambe les fragments : « est-ce » + « que je vais à la
       plage » sans marque interne = UNE question, que le dernier fragment seul ne montre pas.
       On la juge sur la queue de `out` depuis la dernière marque forte. */
    if(!useAudio){ var _mQ=/[^.!?…]*$/.exec(out); if(_mQ&&_mQ[0].trim()) _finT2=_mQ[0].trim(); }
    var fin=(estQuestion(_finT2)||riseAt(last.idx)>QR)?'?':'.';
    if(/[.!?…]\s*$/.test(out)) out=out.replace(/\s*$/,'');   // une COMMANDE dictée a déjà posé la marque finale : sa certitude (100 %) prime sur la déduction
    else out=out.replace(/\s*$/,'')+(fin==='?'?' ':'')+fin;
    return capitalize(normMajInterne(_dedoubleMarques(out))); }
  function capitalize(t){ return String(t).replace(/(^|[.!?…]\s+|\n\s*)([a-zà-ÿœ])/g,function(m,p,c){ return p+c.toUpperCase(); }); }
  function startRec() {
    if (!SR) { voiceStatus('reconnaissance non supportée par ce navigateur'); return; }
    if (!voiceCb.checked) { voiceStatus('coche d’abord « Activer la dictée vocale »'); return; }
    var S = { base: ta.value, t0: Date.now(), finals: {}, ftimes: {}, pt: [], au: null, tEnd: 0 };   // pt : horodatage des PARTIELS (cf. site — seul signal temporel sans 2e capture)
    var gotAny = false, lastErr = '', tr = { a: 0, s: 0 }, userStop = false;
    audioStart(S);
    vstop = function () { userStop = true; try { if (rec) rec.stop(); } catch (e) {} };
    /* AUTO-STOP DU NAVIGATEUR ≠ CLIC DE REM (bug signalé 2026-08-23) : même avec continuous=true, le
       moteur vocal coupe tout seul après un silence — limite connue de l'API Web Speech, pas un
       réglage qu'on contrôle. Avant ce fix, onend finalisait TOUJOURS, donc chaque silence = arrêt
       perçu par l'utilisateur alors qu'il n'a rien cliqué. Fix : onend ne finalise QUE si userStop
       (posé par stopRec(), donc par le clic ⏹) ; sinon on rearme silencieusement (nouvel objet SR —
       un objet arrêté ne se relance pas — en reprenant le texte déjà transcrit dans S.base). Miroir
       exact du fix posé le même soir sur saisie-vocale.html (site). */
    (function armer(premiere) {
      try {
        rec = new SR(); rec.lang = 'fr-FR'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
        rec.onstart = function () { voiceStatus('🎤 micro ouvert — parle…'); };
        rec.onaudiostart = function () { tr.a = 1; };
        rec.onspeechstart = function () { tr.s = 1; voiceStatus('🎤 je t’entends…'); };
        // Android ré-émet les segments DÉJÀ finalisés à chaque événement (resultIndex peu fiable) : on les
        // stocke PAR INDEX (overwrite) puis on reconstruit — sinon « base += fin » ré-ajoute chaque mot = tapé plusieurs fois.
        rec.onresult = function (ev) {
          var intr = '';
          for (var i = ev.resultIndex; i < ev.results.length; i++) {
            var r = ev.results[i];
            if (r.isFinal) { S.finals[i] = r[0].transcript.trim(); if (S.ftimes[i] == null) S.ftimes[i] = Date.now() - S.t0; } else intr += r[0].transcript;
          }
          if (S.pt.length < 4000) S.pt.push([Date.now() - S.t0, (intr.match(/\S+/g) || []).length, Object.keys(S.finals).length]);   // cf. site : mesurer si la cadence des partiels rend les silences
          var parts = []; if (S.base.trim()) parts.push(S.base.trim());
          var fdd = _dedupFinals(S.finals);   // Android : finals cumulatifs/répétés → deltas propres
          var ks = Object.keys(fdd).map(Number).sort(function (a, b) { return a - b; });
          for (var k = 0; k < ks.length; k++) { if (fdd[ks[k]]) parts.push(fdd[ks[k]]); }
          if (intr.trim()) parts.push(intr.trim());
          if (ks.length || intr.trim()) gotAny = true;
          ta.value = parts.join(' ');
          voiceStatus('🎤 transcription…');
        };
        rec.onerror = function (ev) { lastErr = ev.error || 'inconnue'; };   // le message final est posé dans onend (onend suit toujours onerror)
        rec.onend = function () {
          var fatale = (lastErr === 'not-allowed' || lastErr === 'service-not-allowed' || lastErr === 'audio-capture');   // relancer ne réparera pas un micro refusé/absent
          if (!userStop && !fatale) { S.base = ta.value; S.finals = {}; S.ftimes = {}; lastErr = ''; armer(false); return; }
          recording = false; micBtn.textContent = '🎤 Dicter'; micBtn.classList.remove('rec'); vstop = null;
          S.tEnd = Date.now() - S.t0;
          audioStop(S);   // ⛔ était AVALÉ dans le commentaire ci-dessous depuis le miroir PR#493 : le micro (voie A) ne se relâchait plus en fin de dictée
          S.finals = _dedupFinals(S.finals);   // deltas propres avant la ponctuation
          var pt = null; try { pt = prosodyText(S); } catch (e) {}                 // ponctuation MIX (segments Web Speech + règles, + audio si dispo)
          ta.value = pt || capitalize(ta.value);
          runNow(); if (ready) { try { applyAll(); } catch (e) {} }                // SAISIE VOCALE = automatique : rouge FP=0 appliqué tout seul (réversible), pas de « Tout corriger » à cliquer
          if (lastErr) voiceStatus(({ 'not-allowed': 'micro refusé — clique la case « dictée vocale » pour rouvrir la page d’autorisation', 'service-not-allowed': 'service vocal indisponible — utilise Google Chrome', 'no-speech': 'rien entendu — parle plus près du micro', 'audio-capture': 'aucun micro détecté', 'network': 'réseau indisponible — la voix a besoin d’internet' })[lastErr] || ('erreur : ' + lastErr));
          else if (!gotAny) voiceStatus(tr.a && !tr.s ? 'rien capté — choisis ton micro (casque ?) comme micro PAR DÉFAUT dans les réglages de Chrome' : 'aucun son capté — micro non détecté');
          else if (ready) voiceStatus('✓ ponctué + corrigé — copie & colle  ·  audio ' + ((S.au && S.au.tl) ? S.au.tl.length : 0) + 'f');
        };
        recording = true; micBtn.textContent = '⏹ Stop'; micBtn.classList.add('rec');
        if (premiere) voiceStatus('🎤 démarrage…');
        rec.start();
        // filet : si dans 1,5 s rien n'a démarré (ni onstart, ni onerror, ni onend), le prévenir
        if (premiere) setTimeout(function () { if (recording && stEl.textContent.indexOf('démarrage') >= 0) voiceStatus('le micro tarde à répondre… vérifie l’autorisation et le micro par défaut de Chrome'); }, 1500);
      } catch (e) { recording = false; micBtn.textContent = '🎤 Dicter'; micBtn.classList.remove('rec'); vstop = null; voiceStatus('démarrage impossible : ' + ((e && (e.name + ' — ' + e.message)) || 'erreur inconnue')); }
    })(true);
  }
  micBtn.addEventListener('click', function () { if (recording) stopRec(); else startRec(); ta.focus(); });

  // ---- MIROIR : ce que l'utilisateur tape dans un champ de la page se recopie ici (sens UNIQUE) ----
  chrome.runtime.onMessage.addListener(function (msg) {
    if (!msg) return;
    if (msg.type === 'omdys-tab') {                          // autre onglet / navigation : en miroir, le panneau n'affirme jamais un texte que la page n'a plus
      if (mirCb.checked && ta.value && !(document.hasFocus() && document.activeElement === ta)) { ta.value = ''; _ign = {}; runNow(); }
      return;
    }
    if (msg.type !== 'omdys-mirror') return;
    if (!mirCb.checked) return;
    /* « l'utilisateur édite le panneau » = la zone a le focus ET la fenêtre du panneau aussi. Sans hasFocus(),
       activeElement SURVIT à la perte de focus fenêtre : après « Tout corriger » (ta.focus()) ou un clic dans la
       zone, tout miroir suivant était ignoré → panneau figé sur l'ancien message (mesuré Edge 2026-08-21). */
    if (document.hasFocus() && document.activeElement === ta) return;
    if (typeof msg.text === 'string' && msg.text !== ta.value) { ta.value = msg.text; runNow(); }
  });
})();
