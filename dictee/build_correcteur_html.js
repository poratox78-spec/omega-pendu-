// dictee/build_correcteur_html.js — GÉNÈRE un correcteur dys AUTONOME en UN SEUL FICHIER HTML, hors-ligne.
//
// Enveloppe le moteur baké (dictee/build_correcteur.js) dans une page self-contained : moteur + lexiques + UI + CSS
// TOUT inline, zéro requête réseau → marche par double-clic (file://), téléchargeable, rien ne quitte l'appareil.
//
// UI « en contexte » : le texte corrigé s'affiche avec chaque correction SURLIGNÉE À SA PLACE ; clic = pourquoi +
// appliquer/annuler. Pas de liste de corrections détachée (le reproche « hors contexte »).
//
//   node dictee/build_correcteur_html.js [sortie.html]        (défaut: correcteur-hors-ligne.html à la racine)
//   node dictee/build_correcteur_html.js --check              (vérifie que le fichier commité est à jour)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DEFAULT = path.join(ROOT, 'correcteur-hors-ligne.html');
const arg = process.argv[2];
const CHECK = arg === '--check';
const OUT = (!arg || CHECK) ? OUT_DEFAULT : path.resolve(arg);

// 1) bake le moteur autonome (réutilise le builder prouvé + testé en CI)
const tmp = path.join(os.tmpdir(), 'omega-corr-engine-' + process.pid + '.js');
cp.execFileSync('node', [path.join(__dirname, 'build_correcteur.js'), tmp], { stdio: ['ignore', 'ignore', 'inherit'] });
let engine = fs.readFileSync(tmp, 'utf8');
fs.unlinkSync(tmp);
engine = engine.replace(/<\/script>/gi, '<\\/script>');   // ne jamais fermer le <script> hôte depuis les données bakées

// 2) UI (inline) — surlignage en contexte + popover pourquoi/appliquer + copier
const UI = String.raw`
(function(){
  'use strict';
  var C = window.Correcteur, $ = function(id){return document.getElementById(id);};
  // explication PÉDAGOGIQUE par famille de règle (nom de flag → pourquoi), reprise du correcteur en ligne
  function why(name){
    name = name || '';
    if (/j'est|j'ai/.test(name)) return "« j'ai » = j'ai fait (auxiliaire avoir) ; « j'est » n'existe pas.";
    if (/a\/à/.test(name)) return "« a » = le verbe avoir (il a) ; « à » = préposition (à la plage). Test : remplace par « avait ».";
    if (/et\/est/.test(name)) return "« est » = verbe être ; « et » = et puis. Test : remplace par « était ».";
    if (/son\/sont/.test(name)) return "« sont » = verbe être (ils sont) ; « son » = le sien. Test : remplace par « étaient ».";
    if (/on\/ont/.test(name)) return "« ont » = verbe avoir (ils ont) ; « on » = il. Test : remplace par « avaient ».";
    if (/ce\/se|c'est|s'est|ça\/sa|mais\/mes|met\/mais|leur|peu|sais|quel|ou\/où|la\/là|du\/d/.test(name)) return "Homophone grammatical : remplace par une forme sûre pour trancher (le rôle dans la phrase décide).";
    if (/accord|genre|pluriel|participe|sujet-verbe|tout/.test(name)) return "Accord : le mot s'accorde avec ce qui le commande (sujet, déterminant) en genre/nombre.";
    if (/majuscule/.test(name)) return "Une phrase commence toujours par une majuscule.";
    if (/répétition|repetition/.test(name)) return "Ce mot est écrit deux fois de suite.";
    if (/espacement/.test(name)) return "Il manque une espace autour de la ponctuation.";
    if (/élision|elision|segment/.test(name)) return "Découpage : sépare les mots collés (l'hôpital, du coup).";
    if (/orthograph|inconnu|surface/.test(name)) return "Orthographe du mot : la graphie attendue diffère de ce qui est écrit.";
    return "Correction proposée.";
  }
  function famLabel(f){
    var n = f.name || '';
    if (/orthograph|inconnu/.test(n)) return 'orthographe';
    if (/accord|genre|pluriel|participe|sujet-verbe|tout/.test(n)) return 'accord';
    if (/majuscule/.test(n)) return 'majuscule';
    if (/répétition|repetition/.test(n)) return 'répétition';
    if (/espacement|élision|elision|segment/.test(n)) return 'découpage';
    return 'homophone';
  }
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  var applied = {};          // index de flag → appliqué (bool)
  var flags = [], spans = [], srcText = '';

  // mappe chaque flag (index de TOKEN) à sa position CARACTÈRE dans le texte (recherche avant, ordre garanti)
  function locate(text, toks, fl){
    var byI = {}; fl.forEach(function(f){byI[f.i] = f;});
    var out = [], cur = 0;
    for (var i = 0; i < toks.length; i++){
      var tk = toks[i], p = text.indexOf(tk, cur);
      if (p < 0) continue;
      if (byI[i] != null) out.push({flag: byI[i], start: p, end: p + tk.length});
      cur = p + tk.length;
    }
    return out;
  }
  function correctedText(){
    var s = '', cur = 0;
    for (var k = 0; k < spans.length; k++){
      var sp = spans[k]; s += srcText.slice(cur, sp.start);
      s += (applied[sp.flag.i] ? sp.flag.sugg : srcText.slice(sp.start, sp.end));
      cur = sp.end;
    }
    return s + srcText.slice(cur);
  }
  function render(){
    var out = $('out'), cur = 0, html = '';
    for (var k = 0; k < spans.length; k++){
      var sp = spans[k], f = sp.flag, on = applied[f.i];
      html += esc(srcText.slice(cur, sp.start));
      var cls = 'mk ' + (f.tier === 'vigilance' ? 'v' : (f.tier === 'flag' ? 'o' : 'g')) + (on ? ' on' : ' off');
      html += '<span class="' + cls + '" data-k="' + k + '" role="button" tabindex="0">' + esc(on ? f.sugg : srcText.slice(sp.start, sp.end)) + '</span>';
      cur = sp.end;
    }
    html += esc(srcText.slice(cur));
    out.innerHTML = html || '<span class="ph">Le texte corrigé s\'affiche ici, avec les corrections surlignées.</span>';
    var n = spans.length;
    $('count').textContent = n ? (n + (n > 1 ? ' corrections' : ' correction')) : 'Aucune correction';
    $('bar').style.display = n ? 'flex' : 'none';
  }
  function run(){
    srcText = $('in').value;
    if (!srcText.trim()){ flags = []; spans = []; render(); return; }
    flags = C.correct(srcText);
    var toks = C.tokens(srcText);
    spans = locate(srcText, toks, flags);
    spans.forEach(function(sp){ if (applied[sp.flag.i] === undefined) applied[sp.flag.i] = (sp.flag.tier !== 'vigilance'); });   // sûr = appliqué d'office ; orange = à confirmer
    render();
  }

  var pop = null;
  function closePop(){ if (pop){ pop.remove(); pop = null; } }
  function openPop(el){
    closePop();
    var sp = spans[+el.getAttribute('data-k')]; if (!sp) return;
    var f = sp.flag, on = applied[f.i], orig = srcText.slice(sp.start, sp.end);
    pop = document.createElement('div'); pop.className = 'pop';
    pop.innerHTML =
      '<div class="pw"><s>' + esc(orig) + '</s> → <b>' + esc(f.sugg) + '</b> <span class="fam">' + esc(famLabel(f)) + (f.tier === 'vigilance' ? ' · à vérifier' : '') + '</span></div>' +
      '<div class="pwy">' + esc(why(f.name)) + '</div>' +
      '<div class="pa"><button class="ap">' + (on ? 'Annuler' : 'Appliquer') + '</button><button class="ig">Ignorer</button></div>';
    document.body.appendChild(pop);
    var r = el.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.innerWidth - pop.offsetWidth - 12)) + 'px';
    pop.style.top = (r.bottom + window.scrollY + 6) + 'px';
    pop.querySelector('.ap').onclick = function(){ applied[f.i] = !on; closePop(); render(); };
    pop.querySelector('.ig').onclick = function(){ spans = spans.filter(function(x){return x !== sp;}); delete applied[f.i]; closePop(); render(); };
  }
  document.addEventListener('click', function(e){
    var mk = e.target.closest ? e.target.closest('.mk') : null;
    if (mk){ openPop(mk); e.stopPropagation(); return; }
    if (pop && !e.target.closest('.pop')) closePop();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closePop();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('mk')){ e.preventDefault(); openPop(e.target); }
  });

  var t;
  $('in').addEventListener('input', function(){ clearTimeout(t); t = setTimeout(run, 250); });
  $('allon').onclick = function(){ spans.forEach(function(sp){ applied[sp.flag.i] = true; }); render(); };
  $('alloff').onclick = function(){ spans.forEach(function(sp){ applied[sp.flag.i] = false; }); render(); };
  $('copy').onclick = function(){
    var txt = correctedText();
    navigator.clipboard && navigator.clipboard.writeText(txt).then(function(){
      $('copy').textContent = '✓ Copié'; setTimeout(function(){ $('copy').textContent = '📋 Copier le texte corrigé'; }, 1400);
    });
  };
  $('big').onclick = function(){ document.body.classList.toggle('big'); };

  // init moteur (décompresse le lexique ortho, async, hors-ligne)
  $('status').textContent = 'Chargement du dictionnaire…';
  C.init().then(function(){ $('status').textContent = ''; $('in').disabled = false; $('in').placeholder = 'Colle ou écris ton texte ici…'; run(); })
          .catch(function(){ $('status').textContent = 'Erreur de chargement.'; });
})();
`;

const HTML = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Correcteur dys hors-ligne — OMEGA-Ω</title>
<style>
  :root{--bg:#fdfdfb;--fg:#1a1f26;--fg2:#5b6572;--line:#e2e0d8;--card:#fffdf7;--accent:#0a66c2;
        --g:#c0392b;--o:#0a66c2;--v:#b8860b;}
  @media(prefers-color-scheme:dark){:root{--bg:#12161c;--fg:#e6edf3;--fg2:#9aa7b4;--line:#2a313b;--card:#1a1f27;--accent:#5aa2e6;--g:#ff6b5e;--o:#5aa2e6;--v:#e0b64a;}}
  *{box-sizing:border-box}
  html,body{margin:0}
  body{background:var(--bg);color:var(--fg);font:17px/1.55 system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
       max-width:860px;margin:0 auto;padding:22px 18px 60px}
  body.big{font-size:21px}
  h1{font-size:1.35em;margin:.2em 0 .1em}
  .sub{color:var(--fg2);margin:0 0 18px;font-size:.92em}
  .sub b{color:var(--fg)}
  textarea{width:100%;min-height:140px;padding:12px 14px;font:inherit;line-height:1.5;color:var(--fg);
           background:var(--card);border:1.5px solid var(--line);border-radius:12px;resize:vertical}
  textarea:focus{outline:none;border-color:var(--accent)}
  .status{color:var(--fg2);font-size:.9em;min-height:1.3em;margin:8px 2px}
  .lbl{font-size:.82em;color:var(--fg2);text-transform:uppercase;letter-spacing:.04em;margin:16px 2px 6px}
  #out{background:var(--card);border:1.5px solid var(--line);border-radius:12px;padding:14px 16px;min-height:64px;
       white-space:pre-wrap;word-wrap:break-word}
  #out .ph{color:var(--fg2)}
  .mk{border-radius:4px;padding:0 1px;cursor:pointer;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px}
  .mk.g{text-decoration-color:var(--g)}
  .mk.o{text-decoration-color:var(--o)}
  .mk.v{text-decoration-color:var(--v);text-decoration-style:dashed}
  .mk.on{background:color-mix(in srgb,var(--accent) 12%,transparent);font-weight:600}
  .mk.off{opacity:.9}
  .bar{display:none;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 2px}
  .count{font-size:.9em;color:var(--fg2);margin-right:auto}
  button{font:inherit;font-size:.9em;padding:7px 12px;border:1.5px solid var(--line);background:var(--card);
         color:var(--fg);border-radius:9px;cursor:pointer}
  button:hover{border-color:var(--accent)}
  button.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
  .pop{position:absolute;z-index:50;max-width:320px;background:var(--card);border:1.5px solid var(--line);
       border-radius:10px;padding:10px 12px;box-shadow:0 8px 28px rgba(0,0,0,.18);font-size:.92em}
  .pop .pw s{opacity:.6}.pop .pw b{color:var(--accent)}
  .pop .fam{display:inline-block;font-size:.78em;color:var(--fg2);border:1px solid var(--line);border-radius:20px;padding:0 7px;margin-left:4px}
  .pop .pwy{color:var(--fg2);margin:7px 0 9px}
  .pop .pa{display:flex;gap:8px}.pop .pa button{flex:0 0 auto;padding:5px 10px}
  footer{margin-top:26px;color:var(--fg2);font-size:.82em;border-top:1px solid var(--line);padding-top:12px}
  footer a{color:var(--accent)}
</style>
</head>
<body>
  <h1>🩹 Correcteur dys — hors-ligne</h1>
  <p class="sub">Colle ton texte : les corrections apparaissent <b>surlignées à leur place</b>. Clique une correction pour voir <b>pourquoi</b> et l'appliquer ou l'annuler. <b>100 % hors-ligne</b> — rien ne quitte ton appareil.</p>
  <textarea id="in" disabled placeholder="Chargement…" spellcheck="false"></textarea>
  <div class="status" id="status"></div>
  <div class="lbl">Texte corrigé</div>
  <div id="out"><span class="ph">Le texte corrigé s'affiche ici, avec les corrections surlignées.</span></div>
  <div class="bar" id="bar">
    <span class="count" id="count"></span>
    <button id="allon">Tout appliquer</button>
    <button id="alloff">Tout annuler</button>
    <button id="big" title="Texte plus grand">A+</button>
    <button id="copy" class="primary">📋 Copier le texte corrigé</button>
  </div>
  <footer>
    Correcteur orthographe &amp; grammaire pour les troubles de l'écrit (dys). Moteur OMEGA-Ω, embarqué dans cette page.
    <a href="https://omegapendu.com/correcteur">omegapendu.com</a>
  </footer>
<script>${engine}</script>
<script>${UI}</script>
</body>
</html>
`;

if (CHECK) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== HTML) {
    console.error('✗ ' + path.basename(OUT) + ' obsolète — régénère : node dictee/build_correcteur_html.js');
    process.exit(1);
  }
  console.log('✓ ' + path.basename(OUT) + ' à jour (' + (HTML.length / 1e6).toFixed(2) + ' Mo)');
} else {
  fs.writeFileSync(OUT, HTML);
  console.log('généré : ' + OUT + '  (' + (HTML.length / 1e6).toFixed(2) + ' Mo, self-contained, hors-ligne)');
}
