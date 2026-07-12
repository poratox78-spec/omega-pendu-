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
    var nomUrl = chrome.runtime.getURL('assets/noun-post.txt.gz');
    DC.loadLex({
      vdc: chrome.runtime.getURL('assets/vdc-lex.json'),
      genderRelaxed: chrome.runtime.getURL('assets/gender-relaxed.tsv.gz'),
      speller: spellerUrl,
      nom: nomUrl,
      hmm: chrome.runtime.getURL('assets/pos-hmm.json.gz')   // POS-tagger HMM : l'asset était LIVRÉ mais jamais chargé → ~7 règles rouges (accord/épithète via tagger) inertes dans le navigateur (audit 07/2026)
    }).then(function () { if (active) schedule(active);
      try { chrome.storage.local.set({ omdysStatus: { ready: !!(DC.isReady && DC.isReady()), words: (DC.lexSize ? DC.lexSize() : null) } }); } catch (e) {}   // état pour le popup
    }).catch(function (e) { try { chrome.storage.local.set({ omdysStatus: { ready: false, error: String(e && e.message || e) } }); } catch (e2) {} });
    if (DC.loadSpellerLex) DC.loadSpellerLex(spellerUrl).then(function () { if (active) schedule(active); });  // re-render quand l'orthographe (non-mots/accents) est prête
    if (DC.loadNounPost) DC.loadNounPost(nomUrl).then(function () { if (active) schedule(active); });  // re-render quand le posterior (genre + pluriel) est prêt
    if (DC.loadConfusables) DC.loadConfusables(chrome.runtime.getURL('assets/confusables.json')).then(function () { if (active) schedule(active); });  // couche VERTE vigilance (confusables)
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
  function isCE(el) { var tag = (el.tagName || '').toLowerCase(); return tag !== 'textarea' && tag !== 'input'; }
  // ===== contenteditable SANS destruction (audit 07/2026 : setText via textContent rasait gras/liens/paragraphes,
  //       y compris en AUTO sans action utilisateur). On collecte les NŒUDS TEXTE (avec \n aux frontières de bloc/BR)
  //       et on remplace CHIRURGICALEMENT dans le nœud concerné ; une correction à cheval sur deux nœuds (mot coupé
  //       par un <b>) est simplement ignorée — on ne touche jamais à la structure. =====
  var CE_BLOCK = { P: 1, DIV: 1, LI: 1, UL: 1, OL: 1, TABLE: 1, TR: 1, TD: 1, TH: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, BLOCKQUOTE: 1, PRE: 1, SECTION: 1, ARTICLE: 1 };
  function ceCollect(el) {
    var text = '', map = [];
    (function walk(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { map.push({ node: c, start: text.length, end: text.length + c.nodeValue.length }); text += c.nodeValue; }
        else if (c.nodeType === 1) {
          if (c.tagName === 'BR') { text += '\n'; continue; }
          if (c.getAttribute && c.getAttribute('data-omdys')) continue;
          walk(c);
          if (CE_BLOCK[c.tagName]) text += '\n';
        }
      }
    })(el);
    return { text: text, map: map };
  }
  function ceReplace(el, s, e, sugg) {
    var col = ceCollect(el);
    for (var k = 0; k < col.map.length; k++) { var m = col.map[k];
      if (s >= m.start && e <= m.end) { var off = s - m.start, v = m.node.nodeValue;
        m.node.nodeValue = v.slice(0, off) + sugg + v.slice(off + (e - s)); return true; } }
    return false;                                            // à cheval sur 2 nœuds → on n'applique PAS (structure préservée)
  }
  function getText(el) {
    if (!isCE(el)) return el.value;
    return ceCollect(el).text;
  }
  function setText(el, txt, caret) {                          // input/textarea UNIQUEMENT (le contenteditable passe par ceReplace)
    if (isCE(el)) return;
    el.value = txt;
    try { if (caret != null) el.setSelectionRange(caret, caret); } catch (e) {}
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ===== complétion (aide-frappe) : mot SOUS LE CURSEUR — réutilise DC.complete (speller accentué). Identique app. =====
  var WCH = /[A-Za-zÀ-ÖØ-öø-ÿœŒ']/;
  function caretOf(el) {
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input') { try { return el.selectionStart; } catch (e) { return null; } }
    // contenteditable : mappe le curseur DOM → offset dans ceCollect.text (MÊMES coords que getText/ceReplace → complétion affichée ET applicable partout, Twitch/Discord inclus)
    var sel; try { sel = (el.ownerDocument || document).getSelection(); } catch (e) { return null; }
    if (!sel || !sel.rangeCount) return null;
    var r = sel.getRangeAt(0); if (!r.collapsed) return null;                                   // sélection en cours (non vide) → pas de complétion
    var node = r.endContainer, off = r.endOffset;
    if (node !== el && !el.contains(node)) return null;                                          // curseur hors de ce champ
    var col = ceCollect(el);
    if (node.nodeType === 3) { for (var k = 0; k < col.map.length; k++) if (col.map[k].node === node) return col.map[k].start + off; return null; }   // nœud texte (cas frappe) : offset direct
    var child = node.childNodes[off];                                                           // nœud élément : curseur AVANT childNodes[off]
    if (child) for (var j = 0; j < col.map.length; j++) { var mn = col.map[j].node; if (mn === child || (child.contains && child.contains(mn))) return col.map[j].start; }
    return col.text.length;                                                                     // sinon : fin du texte
  }
  function wordAt(v, pos) { var s = pos, e = pos; while (s > 0 && WCH.test(v[s - 1])) s--; while (e < v.length && WCH.test(v[e])) e++; return { word: v.slice(s, e), start: s, end: e }; }
  function computeComps(el) {
    if (!DC.complete) return []; var pos = caretOf(el); if (pos == null) return [];
    var v = getText(el), w = wordAt(v, pos);
    if (!w.word || pos !== w.end || w.word.length < 2) return [];   // seulement en FIN de mot (préfixe en cours de frappe)
    return DC.complete(w.word);
  }
  function applyComplete(el, repl) {
    if (!repl) return;
    var tag = (el.tagName || '').toLowerCase();
    var v = getText(el), pos = caretOf(el); if (pos == null) pos = v.length; var w = wordAt(v, pos); if (!w.word) return;
    if (/^[A-ZÀ-Ö]/.test(w.word)) repl = repl.charAt(0).toUpperCase() + repl.slice(1);   // garde la majuscule initiale
    if (tag === 'textarea' || tag === 'input') { setText(el, v.slice(0, w.start) + repl + v.slice(w.end), w.start + repl.length); }   // setText dispatch 'input' → re-run
    else if (ceReplace(el, w.start, w.end, repl)) { el.dispatchEvent(new Event('input', { bubbles: true })); }   // contenteditable (Twitch/Discord…) : ceReplace = mêmes offsets getText/ceCollect que les corrections → aide-frappe applicable partout
  }

  // ===== application des corrections (réutilise le découpage tokens du moteur) =====
  var TOKRE = /[A-Za-zÀ-ÿœŒ'’ʼ]+/g;   // ’ typographique incluse : les spans (positions) restent alignés avec les tokens normalisés du moteur
  function spans(text) { var m, s = []; TOKRE.lastIndex = 0; while ((m = TOKRE.exec(text))) s.push([m.index, m.index + m[0].length]); return s; }
  function applyOne(el, flag) {
    var t = getText(el), sp = spans(t), s = sp[flag.i]; if (!s) return;
    var e = sp[flag.i + (flag.span ? flag.span - 1 : 0)] || s;   // élision : la suggestion fusionne 2 tokens (« c est »→« c'est »)
    if (isCE(el)) {
      if (ceReplace(el, s[0], e[1], flag.sugg)) el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      var nt = t.slice(0, s[0]) + flag.sugg + t.slice(e[1]);
      setText(el, nt, s[0] + flag.sugg.length);
    }
    schedule(el);
  }
  function applyAll(el, flags) {
    var t = getText(el), sp = spans(t);
    var ord = flags.slice().sort(function (a, b) { return b.i - a.i; });   // droite→gauche : indices stables
    if (isCE(el)) {
      var did = false;
      ord.forEach(function (f) { var s = sp[f.i]; if (!s) return; var e = sp[f.i + (f.span ? f.span - 1 : 0)] || s; if (ceReplace(el, s[0], e[1], f.sugg)) did = true; });
      if (did) el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      ord.forEach(function (f) { var s = sp[f.i]; if (!s) return; var e = sp[f.i + (f.span ? f.span - 1 : 0)] || s; t = t.slice(0, s[0]) + f.sugg + t.slice(e[1]); });
      setText(el, t);
    }
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

  function render(el, dg, comps, vig, ro) {
    var b = ensureBar();
    var h = '<div class="omdys-head"><b>🩹 Correcteur dys</b>';
    if (dg.flags.length) h += '<span class="omdys-n">' + dg.flags.length + '</span><button class="omdys-all">tout corriger</button>';
    h += '<button class="omdys-x" title="masquer">×</button></div>';
    if (dg.flags.length) {
      h += '<div class="omdys-list">';
      dg.flags.forEach(function (f, k) {
        var vigT = f.tier === 'vigilance';                        // orange pointillé = À VÉRIFIER (hors FP=0 : clic individuel possible, JAMAIS dans « tout corriger »)
        var orth = /orthographe|[ée]lision/.test(f.name || '');   // bleu = orthographe (non-mot/accent) ; rouge = grammaire
        h += '<div class="omdys-item' + (vigT ? ' omdys-tvig' : (orth ? ' omdys-orth' : '')) + '" data-k="' + k + '">« ' + esc(f.word) + ' » → <b>« ' + esc(f.sugg) + ' »</b>'
          + ' <span class="omdys-fam">[' + esc(f.name) + (f.tier === 'auto' ? ' · sûr' : (vigT ? ' · à vérifier' : '')) + ']</span></div>';
      });
      h += '</div>';
    }
    if (comps && comps.length) {   // aide-frappe : complétions du mot en cours (clic pour insérer)
      h += '<div class="omdys-comp"><span class="omdys-clab">➡️ compléter</span>'
        + comps.map(function (a) { return '<button class="omdys-cbtn" data-w="' + esc(a) + '">' + esc(a) + '</button>'; }).join('') + '</div>';
    }
    if (vig && vig.length) {   // couche VERTE : confusables — VIGILANCE (n'affirme pas une faute → pas de clic d'application)
      h += '<div class="omdys-vig"><div class="omdys-vlab">🟢 à vérifier — mots confusables</div>';
      vig.forEach(function (v) { h += '<div class="omdys-vitem">« ' + esc(v.word) + ' » — ' + esc(v.info) + '</div>'; });
      h += '</div>';
    }
    if (ro && ro.length) {   // couche VERTE : run-on — ponctuation manquante entre 2 propositions (le sens en dépend)
      h += '<div class="omdys-vig"><div class="omdys-vlab">🟢 à vérifier — ponctuation</div>';
      ro.forEach(function (r) { h += '<div class="omdys-vitem">entre « ' + esc(r.a) + ' » et « ' + esc(r.b) + ' » — ponctuation manquante ? (virgule ou point selon le sens)</div>'; });
      h += '</div>';
    }
    if (dg.stade) {
      h += '<div class="omdys-stade"><b>Stade : ' + esc(dg.stadeLbl) + '</b><br>' + esc(dg.stadeMsg) + '</div>';
      if (dg.remed && dg.remed.length) h += '<div class="omdys-remed"><b>🛠️ Remédiation</b><br>' + dg.remed.map(esc).join('<br>') + '</div>';
    }
    b.innerHTML = h;
    b.style.display = 'block';
    place(el);
    b.querySelector('.omdys-x').onclick = function () { dismissed.add(el); hideBar(); };
    var allb = b.querySelector('.omdys-all'); if (allb) allb.onclick = function () { applyAll(el, dg.flags.filter(function (f) { return f.tier !== 'vigilance'; })); };   // « tout corriger » = UNIQUEMENT le FP=0 (auto+flag) ; la vigilance reste au clic individuel explicite (audit 07/2026)
    var items = b.querySelectorAll('.omdys-item');
    for (var z = 0; z < items.length; z++) (function (node) {
      node.onclick = function () { applyOne(el, dg.flags[+node.getAttribute('data-k')]); };
    })(items[z]);
    var cbs = b.querySelectorAll('.omdys-cbtn');
    for (var c = 0; c < cbs.length; c++) (function (node) {
      node.onclick = function () { applyComplete(el, node.getAttribute('data-w')); };
    })(cbs[c]);
  }

  // AUTO (orthographe sûre, FP=0) : appliquée EN SILENCE — jamais le mot sous le curseur (en cours de frappe). Miroir applyAutos de l'app.
  function applyAutos(el, autos) {
    var t = getText(el), sp = spans(t), cur = null;
    try { cur = el.selectionStart; } catch (e) {}
    if (cur == null) cur = t.length;
    var ap = autos.filter(function (f) { var s = sp[f.i]; return s && !(cur >= s[0] && cur <= s[1]); });
    if (!ap.length) return false;
    if (isCE(el)) {                                           // contenteditable : remplacement par nœud (droite→gauche), JAMAIS textContent global
      var did = false;
      ap.slice().sort(function (a, b) { return sp[b.i][0] - sp[a.i][0]; })
        .forEach(function (f) { var s = sp[f.i]; if (ceReplace(el, s[0], s[1], f.sugg)) did = true; });
      if (did) el.dispatchEvent(new Event('input', { bubbles: true }));
      return did;
    }
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
    var comps = computeComps(el);                                         // aide-frappe : complétions du mot en cours
    var vig = DC.vigText ? DC.vigText(text) : [];                         // couche VERTE : confusables (vigilance, n'affirme pas)
    var ro = DC.runonText ? DC.runonText(text) : [];                      // couche VERTE : run-on (ponctuation manquante entre 2 propositions)
    if (!dg.flags.length && !comps.length && !vig.length && !ro.length) { hideBar(); return; }
    render(el, dg, comps, vig, ro);
  }

  // ===== orchestration =====
  var timer = null;
  function schedule(el) { clearTimeout(timer); timer = setTimeout(function () { run(el); }, 400); }

  // Champ actif observé : les ÉDITEURS RICHES (Slate.js = chat Twitch/Discord, Draft.js = ancien Twitter,
  // ProseMirror = Reddit…) appliquent la frappe via leur modèle interne et ne laissent PAS toujours remonter
  // un événement 'input' jusqu'à document → nos écoutes focusin/input ratent la frappe et la barre n'apparaît
  // jamais (bug « rien sur Twitch » alors que le moteur est prêt). On ajoute deux filets, débouncés comme le
  // reste (400 ms), qui ne changent QUE le moment du scan — jamais son résultat (moteur/FP=0/parité intacts) :
  //   1) MutationObserver sur le contenteditable focalisé : capte la mutation DOM que Slate produit à chaque
  //      frappe/collage, même sans 'input' qui bulle.  2) keyup : filet clavier (keyup remonte, lui).
  var mo = null;
  function observeActive(el) {
    if (mo) { mo.disconnect(); mo = null; }
    if (el && isCE(el) && typeof MutationObserver !== 'undefined') {   // uniquement contenteditable (les <input>/<textarea> passent déjà par 'input')
      mo = new MutationObserver(function () { if (active) schedule(active); });
      mo.observe(el, { childList: true, characterData: true, subtree: true });
    }
  }
  function stopObserve() { if (mo) { mo.disconnect(); mo = null; } }

  document.addEventListener('focusin', function (e) {
    var el = e.target;
    if (isEditable(el)) { active = el; dismissed.delete(el); observeActive(el); schedule(el); }
  }, true);
  document.addEventListener('input', function (e) {
    if (e.target === active && isEditable(e.target)) { dismissed.delete(active); schedule(active); }
  }, true);
  document.addEventListener('keyup', function (e) {   // filet éditeurs riches : 'input' peut ne pas remonter (Slate/Draft/ProseMirror), keyup si
    if (active && isEditable(active) && (e.target === active || active.contains(e.target))) schedule(active);
  }, true);
  document.addEventListener('focusout', function (e) {
    if (e.target === active) { setTimeout(function () {
      var a = document.activeElement;
      if (!bar || !bar.contains(a)) { hideBar(); stopObserve(); }   // garde la barre si on clique dedans ; sinon on stoppe l'observateur
    }, 150); }
  }, true);
  window.addEventListener('scroll', function () { if (active && bar && bar.style.display !== 'none') place(active); }, true);
})();
