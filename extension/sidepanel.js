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
                 speller: sp, nom: nom, hmm: chrome.runtime.getURL('assets/pos-hmm.json.gz'), osLm: chrome.runtime.getURL('assets/os-subj-lm.json.gz') })
      .then(function () { ready = true; stEl.textContent = 'prêt'; runNow(); })
      .catch(function (e) { stEl.textContent = 'erreur moteur'; });
    if (DC.loadSpellerLex) DC.loadSpellerLex(sp).then(runNow);
    if (DC.loadNounPost) DC.loadNounPost(nom).then(runNow);
    if (DC.loadConfusables) DC.loadConfusables(chrome.runtime.getURL('assets/confusables.json')).then(runNow);
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

  // ---- SAISIE VOCALE (opt-in, VOIE A : Web Speech du navigateur = service cloud, ex. Google) --------------------
  // Le correcteur reste 100 % hors-ligne ; SEULE la transcription vocale sort (audio → service du navigateur).
  // Consentement explicite (case à cocher persistée) AVANT tout accès micro ; le texte transcrit tombe dans la
  // textarea → correction + « Copier » déjà en place. UI-only : aucun impact sur le moteur ni la parité 3 moteurs.
  var micBtn = document.getElementById('omdys-mic'), voiceCb = document.getElementById('omdys-voice-ok');
  var SR = self.SpeechRecognition || self.webkitSpeechRecognition;
  var rec = null, recording = false;
  // ===== ARBITRAGE DES HYPOTHÈSES (N-best) — miroir exact du site (saisie-vocale.html).
  // Google rend jusqu'à 5 transcriptions ; il n'en donnait qu'UNE à notre correcteur, qui n'y pouvait
  // RIEN : une transcription fautive est une suite de VRAIS mots, souvent bien accordée. Détecter une
  // faute invisible : impossible. CHOISIR entre des candidats fournis : c'est notre architecture même.
  //
  // PRINCIPE — l'ASR connaît l'ACOUSTIQUE, nous la LANGUE. On ne refait donc PAS son classement : on
  // RÉTROGRADE seulement ce qu'on prouve incohérent, et à égalité SON ordre gagne. Rétrograder n'est
  // pas affirmer : pas de contrainte FP=0 ici, et sans preuve on ne touche à rien.
  function arbitre(r) {
    var n = Math.min(r.length || 1, 5);
    if (n < 2 || !DC || !DC.diagnoseAll) return (r[0].transcript || '').trim();
    var best = 0, bestN = -1;
    for (var k = 0; k < n; k++) {
      var t = (r[k].transcript || '').trim(); if (!t) continue;
      var f = 0;
      try { f = (DC.diagnoseAll(t).flags || []).filter(function (x) {
              return !/majuscule|typographie/.test(x.name || ''); }).length; } catch (e) { f = 0; }
      if (bestN < 0 || f < bestN) { bestN = f; best = k; }   // < strict : à égalité on GARDE l'ordre de l'ASR
    }
    return (r[best].transcript || '').trim();
  }
  function voiceStatus(m) { stEl.textContent = m; }
  // ===== MICRO — informer, puisqu'on ne peut pas CHOISIR. MESURÉ : SpeechRecognition n'a AUCUNE
  // propriété device/stream/input/source (grammars lang continuous interimResults maxAlternatives…).
  // Il prend donc le micro PAR DÉFAUT du système, et ce n'est pas notre code qui limite : c'est l'API.
  // On dit lequel sera utilisé plutôt que de laisser quelqu'un chercher pourquoi son casque est ignoré.
  // Les noms ne sont lisibles qu'APRÈS la permission micro — que la voix demande déjà à l'activation.
  function micInfo() {
    var el = document.getElementById('omdys-micinfo');
    if (!el) {
      el = document.createElement('div'); el.id = 'omdys-micinfo';
      el.style.cssText = 'font-size:11px;opacity:.85;margin-top:6px;line-height:1.35';
      if (micBtn && micBtn.parentNode) micBtn.parentNode.appendChild(el); else return;
    }
    var sys = 'Pour en changer : réglages son de ton système.';
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) { el.textContent = '🎤 ' + sys; return; }
    navigator.mediaDevices.enumerateDevices().then(function (d) {
      var ins = d.filter(function (x) { return x.kind === 'audioinput'; });
      var nommes = ins.filter(function (x) { return x.label; });
      if (!nommes.length) {
        el.textContent = '🎤 La dictée vocale utilise le micro par défaut de ton système'
          + (ins.length > 1 ? ' (' + ins.length + ' micros détectés)' : '') + '. ' + sys;
        return; }
      var def = nommes.filter(function (x) { return x.deviceId === 'default'; })[0] || nommes[0];
      var autres = nommes.filter(function (x) { return x !== def && x.deviceId !== 'default'; })
        .map(function (x) { return x.label; }).slice(0, 3);
      el.textContent = '🎤 Micro utilisé : ' + def.label
        + (autres.length ? ' — autres : ' + autres.join(', ') : '') + '. ' + sys;
    }).catch(function () { el.textContent = '🎤 ' + sys; });
  }
  micInfo();
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener)
    navigator.mediaDevices.addEventListener('devicechange', micInfo);   // casque branché/débranché en cours de route
  function setVoiceEnabled(on) { micBtn.disabled = !(on && SR); if (!on && recording) stopRec(); }
  if (!SR) { voiceCb.disabled = true; voiceCb.parentNode.title = 'Reconnaissance vocale non supportée par ce navigateur'; }
  try { chrome.storage.local.get(['omVoice'], function (o) { var on = !!(o && o.omVoice); voiceCb.checked = on; if (on) mirCb.checked = false; setVoiceEnabled(on); }); } catch (e) {}
  // EXCLUSION MUTUELLE voix ↔ miroir : les deux écrivent dans la MÊME textarea et se battaient (il fallait décocher/recocher).
  // Activer l'un désactive l'autre. Le miroir lit `mirCb.checked` en direct (l.~185) → le décocher le coupe aussitôt.
  voiceCb.addEventListener('change', function () {
    if (voiceCb.checked && mirCb.checked) mirCb.checked = false;
    try { chrome.storage.local.set({ omVoice: voiceCb.checked }); } catch (e) {}
    setVoiceEnabled(voiceCb.checked);
    // pré-demande la permission micro à l'activation → l'invite du navigateur s'affiche de façon fiable (MV3)
    if (voiceCb.checked && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) { st.getTracks().forEach(function (t) { t.stop(); }); micInfo(); }).catch(function () {});   // micInfo APRÈS l'octroi : les LABELS n'existent qu'une fois la permission donnée
  });
  mirCb.addEventListener('change', function () {   // activer le miroir coupe la voix
    if (mirCb.checked && voiceCb.checked) { voiceCb.checked = false; try { chrome.storage.local.set({ omVoice: false }); } catch (e) {} setVoiceEnabled(false); }
  });
  function stopRec() { recording = false; micBtn.textContent = '🎤 Dicter'; micBtn.classList.remove('rec'); try { if (rec) rec.stop(); } catch (e) {} }
  // ── PROSODIE PARALLÈLE (voie A) — identique au site : Web Speech ne donne que du texte ; on capte le micro
  //    nous-mêmes (Web Audio, zéro modèle) → silence → « , . », pitch (F0) → « ? », ancrés sur les segments
  //    finaux. Dégradant : getUserMedia async ne peut pas casser startRec, fallback capV() seul. NON testé sans micro.
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
  function silBetween(tl,thr,a,b){ var run=0,mx=0; for(var i=0;i<tl.length;i++){ var p=tl[i]; if(p.t<a||p.t>b)continue; if(p.r<thr){ run+=30; if(run>mx)mx=run; } else run=0; } return mx; }
  function riseEndingAt(tl,a,b){ var v=[]; for(var i=0;i<tl.length;i++){ var p=tl[i]; if(p.t>=a&&p.t<=b&&p.f>0)v.push(p.f); }
    if(v.length<6)return 0; var q=Math.max(2,(v.length/5)|0), tail=v.slice(-q), body=v.slice(0,-q);
    function med(x){ x=x.slice().sort(function(a,b){return a-b;}); return x[(x.length/2)|0]; }
    var mt=med(tail), mb=med(body); return (mb>0&&mt>0)? 12*Math.log(mt/mb)/Math.log(2) : 0; }
  // MIX règles + voix : frontières de segments finaux (pauses Web Speech, sans getUserMedia) + règles
  // (point/virgule + normalisation de la majuscule d'amorce Google) ; audio en refinement si dispo.
  function prosodyText(S){
    var ks=Object.keys(S.finals).map(Number).sort(function(a,b){return a-b;}), segs=[];
    for(var k=0;k<ks.length;k++){ var t=(S.finals[ks[k]]||'').trim(); if(t)segs.push({t:t.charAt(0).toLowerCase()+t.slice(1),idx:ks[k]}); }  // norm : enlève la MAJ d'amorce Google
    if(!segs.length) return null;
    var CONT=/^(et|mais|ou|car|donc|ni|puis|alors|aussi|qui|que|qu|dont|quand|si|comme|parce|puisque|lorsque)\b/i;
    var QW=/^(est-ce|qu'est|où|comment|pourquoi|quand|combien|quel|quelle|quels|quelles|lequel|laquelle)(?![a-zà-ÿœ])/i;   // interrogatifs FORTS en tête → « ? » (les qu-questions ne montent pas en pitch ; lookahead car \b casse après « où »)
    var au=S.au, useAudio=au&&au.tl&&au.tl.length, thr=useAudio?Math.max(0.008,au.maxr*0.18):0;
    function riseAt(idx){ return (useAudio&&idx!=null&&S.ftimes[idx]!=null)?riseEndingAt(au.tl,S.ftimes[idx]-500,S.ftimes[idx]):0; }
    var out=(S.base.trim()?S.base.trim()+' ':'');
    for(var s=0;s<segs.length;s++){
      if(s>0){ var pv=segs[s-1], nx=segs[s], mk;
        if(QW.test(pv.t)||riseAt(pv.idx)>4) mk='?';                         // le segment qui SE FERME est une question (lexical OU pitch montant)
        else if(useAudio){ var sil=silBetween(au.tl,thr,(S.ftimes[pv.idx]||0)-100,(S.ftimes[nx.idx]||1e9)); mk=sil>=600?'.':','; }
        else if(CONT.test(nx.t)) mk=',';
        else mk='.';
        out=out.replace(/\s*$/,'')+mk+' '; }
      out+=segs[s].t; }
    var last=segs[segs.length-1];
    return capV(out.replace(/\s*$/,'')+((QW.test(last.t)||riseAt(last.idx)>4)?'?':'.')); }
  function capV(t){ return String(t).replace(/(^|[.!?…]\s+|\n\s*)([a-zà-ÿœ])/g,function(m,p,c){ return p+c.toUpperCase(); }); }
  function startRec() {
    if (!SR) { voiceStatus('reconnaissance non supportée par ce navigateur'); return; }
    if (!voiceCb.checked) { voiceStatus('coche d’abord « Activer la dictée vocale »'); return; }
    try {
      rec = new SR(); rec.lang = 'fr-FR'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 5;
      // ⚠️⚠️ `quality='dictation'` CASSE la reconnaissance SUR L'APPAREIL (« language-not-supported »),
      // mesuré par balayage des 8 combinaisons. Ici l'extension n'a PAS encore l'option locale, donc
      // « dictation » est sûr — mais le jour où on l'ajoutera, il faudra la MÊME garde que le site.
      // Régression livrée puis réparée côté site (PR#370/371) : deux options croisées, une seule testée.
      try { if ('quality' in rec && !rec.processLocally) rec.quality = 'dictation'; } catch (e) {}
      var S = { base: ta.value, t0: Date.now(), finals: {}, ftimes: {}, au: null, tEnd: 0 };
      var gotAny = false, lastErr = '', tr = { a: 0, s: 0 };
      audioStart(S);
      rec.onstart = function () { voiceStatus('🎤 micro ouvert — parle…'); };
      rec.onaudiostart = function () { tr.a = 1; };
      rec.onspeechstart = function () { tr.s = 1; voiceStatus('🎤 je t’entends…'); };
      // Android ré-émet les segments DÉJÀ finalisés à chaque événement (resultIndex peu fiable) : on les
      // stocke PAR INDEX (overwrite) puis on reconstruit — sinon « base += fin » ré-ajoute chaque mot = tapé plusieurs fois.
      rec.onresult = function (ev) {
        var intr = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var r = ev.results[i];
          if (r.isFinal) { S.finals[i] = arbitre(r); if (S.ftimes[i] == null) S.ftimes[i] = Date.now() - S.t0; } else intr += r[0].transcript;
        }
        var parts = []; if (S.base.trim()) parts.push(S.base.trim());
        var ks = Object.keys(S.finals).map(Number).sort(function (a, b) { return a - b; });
        for (var k = 0; k < ks.length; k++) { if (S.finals[ks[k]]) parts.push(S.finals[ks[k]]); }
        if (intr.trim()) parts.push(intr.trim());
        if (ks.length || intr.trim()) gotAny = true;
        ta.value = parts.join(' ');
        voiceStatus('🎤 transcription…');
      };
      rec.onerror = function (ev) { lastErr = ev.error || 'inconnue'; };   // le message final est posé dans onend (onend suit toujours onerror)
      rec.onend = function () {
        recording = false; micBtn.textContent = '🎤 Dicter'; micBtn.classList.remove('rec');
        S.tEnd = Date.now() - S.t0; audioStop(S);
        var pt = null; try { pt = prosodyText(S); } catch (e) {}                 // ponctuation MIX (segments Web Speech + règles, + audio si dispo)
        ta.value = pt || capV(ta.value);
        runNow(); if (ready) { try { applyAll(); } catch (e) {} }                // SAISIE VOCALE = automatique : rouge FP=0 appliqué tout seul (réversible), pas de « Tout corriger » à cliquer
        if (lastErr) voiceStatus(({ 'not-allowed': 'micro refusé — autorise-le dans le navigateur', 'service-not-allowed': 'service vocal indisponible — utilise Google Chrome', 'no-speech': 'rien entendu — parle plus près du micro', 'audio-capture': 'aucun micro détecté', 'network': 'réseau indisponible — la voix a besoin d’internet' })[lastErr] || ('erreur : ' + lastErr));
        else if (!gotAny) voiceStatus(tr.a && !tr.s ? 'rien capté — choisis ton micro (casque ?) comme micro PAR DÉFAUT dans les réglages de Chrome' : 'aucun son capté — micro non détecté');
        else if (ready) voiceStatus('✓ ponctué + corrigé — copie & colle  ·  audio ' + ((S.au && S.au.tl) ? S.au.tl.length : 0) + 'f');
      };
      recording = true; micBtn.textContent = '⏹ Stop'; micBtn.classList.add('rec'); voiceStatus('🎤 démarrage…');
      rec.start();
      // filet : si dans 1,5 s rien n'a démarré (ni onstart, ni onerror, ni onend), le prévenir
      setTimeout(function () { if (recording && stEl.textContent.indexOf('démarrage') >= 0) voiceStatus('le micro tarde à répondre… vérifie l’autorisation et le micro par défaut de Chrome'); }, 1500);
    } catch (e) { recording = false; micBtn.textContent = '🎤 Dicter'; micBtn.classList.remove('rec'); voiceStatus('démarrage impossible : ' + ((e && (e.name + ' — ' + e.message)) || 'erreur inconnue')); }
  }
  micBtn.addEventListener('click', function () { if (recording) stopRec(); else startRec(); ta.focus(); });

  // ---- MIROIR : ce que l'utilisateur tape dans un champ de la page se recopie ici (sens UNIQUE) ----
  chrome.runtime.onMessage.addListener(function (msg) {
    if (!msg || msg.type !== 'omdys-mirror') return;
    if (!mirCb.checked) return;
    if (document.activeElement === ta) return;             // l'utilisateur édite le panneau → ne pas écraser
    if (typeof msg.text === 'string' && msg.text !== ta.value) { ta.value = msg.text; runNow(); }
  });
})();
