# -*- coding: utf-8 -*-
# Clone ANGLAIS du pendu cognitif : app/omega-pendu.html -> app/omega-pendu-en.html, avec le SUBSTRAT
# moteur échangé (français -> anglais) — « identique, juste la langue » côté MOTEUR (la traduction de
# l'UI se fait ensuite). Swaps : (1) bloc <script id="lex4-data-gz"> = base64 anglais (lex4_en.b64),
# (2) const LETTER_FREQ_FR -> valeurs anglaises (letter_freq_en.json), (3) lang="fr"->"en".
# Le moteur (5000 l.) reste IDENTIQUE : il lit lex4 (mots/phono/fréq) + LETTER_FREQ ; en anglais il
# devine des mots anglais. Modes phon ORANGE = spécifiques FR (le défaut cheat-free n'en dépend pas).
#   Vérifie que le base64 re-décompresse en JSON valide.  Lancer : PYTHONUTF8=1 python dictee/build_pendu_en.py
import re, os, sys, io, base64, gzip, json
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'app', 'omega-pendu.html')
OUT = os.path.join(HERE, '..', 'app', 'omega-pendu-en.html')
B64 = os.path.join(HERE, 'lex4_en.b64')
LF = os.path.join(HERE, 'letter_freq_en.json')
G2P = os.path.join(HERE, 'g2p_en.json')   # tables g2p ANGLAISES (build_g2p_en.py) — zéro français
P2L = os.path.join(HERE, 'phon2letters_en.json')  # phonème IPA -> lettres (build_phon2letters_en.py)
PF  = os.path.join(HERE, 'phonfeatures_en.json')  # lettre -> traits articulatoires EN (build_phonfeatures_en.py)

CHECK = '--check' in sys.argv

# ⚠️ `lex4_en.b64` est un INTERMÉDIAIRE régénérable, donc gitignoré : il n'existe PAS en CI. En
# mode `--check` on prend donc le base64 DANS LE CLONE LIVRÉ. Ce n'est pas un contournement, c'est
# le bon périmètre : ce check répond à « le MOTEUR FRANÇAIS est-il propagé au clone ? », pas à
# « le lexique anglais est-il le dernier ? » (ça, c'est build_lex4_en.py, et ses sources ne sont
# pas non plus dans le dépôt). Le prendre du clone rend aussi le check IDENTIQUE en local et en CI
# — sinon une régénération locale du b64 (estampille gzip différente) le ferait échouer pour rien.
for p in ([SRC] if CHECK else [SRC, B64]) + [LF, G2P, P2L, PF]:
    if not os.path.exists(p): print('[FATAL] manquant :', p); sys.exit(1)

html = io.open(SRC, encoding='utf-8').read()
if CHECK:
    if not os.path.exists(OUT): print('[FATAL] clone absent :', OUT); sys.exit(1)
    _liv = io.open(OUT, encoding='utf-8').read()
    _mb = re.search(r'<script type="text/plain" id="lex4-data-gz">(.*?)</script>', _liv, re.S)
    if not _mb: print('[FATAL] bloc lex4-data-gz introuvable dans le clone livré'); sys.exit(1)
    b64 = _mb.group(1).strip()
else:
    b64 = io.open(B64, encoding='utf-8').read().strip()
lf = json.load(io.open(LF, encoding='utf-8'))
g2p = json.load(io.open(G2P, encoding='utf-8'))
p2l = json.load(io.open(P2L, encoding='utf-8'))
pf  = json.load(io.open(PF, encoding='utf-8'))

# (1) remplace le contenu du bloc lex4-data-gz par le base64 anglais
pat = re.compile(r'(<script type="text/plain" id="lex4-data-gz">)(.*?)(</script>)', re.S)
if not pat.search(html): print('[FATAL] bloc lex4-data-gz introuvable'); sys.exit(1)
html = pat.sub(lambda m: m.group(1) + b64 + m.group(3), html, count=1)

# (2) remplace la const LETTER_FREQ_FR (clés A-Z majuscules, Σ=1) par les fréquences anglaises
AZ = 'abcdefghijklmnopqrstuvwxyz'
rows = []
for i, ch in enumerate(AZ):
    rows.append("'%s': %.4f" % (ch.upper(), lf.get(ch, 0.0)))
lines = ['  ' + ', '.join(rows[j:j+5]) + ',' for j in range(0, 25, 5)] + ["  'Z': %.4f" % lf.get('z', 0.0)]
new_lf = 'const LETTER_FREQ_FR = {\n' + '\n'.join(lines) + '\n};'
lfpat = re.compile(r'const LETTER_FREQ_FR = \{.*?\};', re.S)
if not lfpat.search(html): print('[FATAL] const LETTER_FREQ_FR introuvable'); sys.exit(1)
html = lfpat.sub(new_lf, html, count=1)

# (2b) TABLES g2p FR -> EN (VOW/NASAL/DBL/SEG/COND/ENTSIL du moteur _DECL2). L'algo g2p est
# agnostique de langue ; seules ses tables sont FR. On les remplace par les anglaises (data-driven,
# build_g2p_en.py) → AUCUN français ne score les candidats anglais (declare DUAL, phonScore).
def _sub1(pat, repl, label, flags=0):
    global html
    rx = re.compile(pat, flags)
    if not rx.search(html): print('[FATAL] table g2p introuvable :', label); sys.exit(1)
    html = rx.sub(lambda m: repl, html, count=1)

_sub1(r"const VOW='[^']*'", "const VOW='" + g2p['VOW'] + "'", 'VOW')
_sub1(r"const NASAL=new Set\(\[[^\]]*\]\)", "const NASAL=new Set(" + json.dumps(g2p['NASAL']) + ")", 'NASAL')
_sub1(r"const DBL=new Set\(\[[^\]]*\]\)", "const DBL=new Set(" + json.dumps(g2p['DBL']) + ")", 'DBL')
_sub1(r"const SEG=\[.*?\]\.sort\(\(a,b\)=>b\.length-a\.length\)",
      "const SEG=" + json.dumps(g2p['SEG'], ensure_ascii=False) + ".sort((a,b)=>b.length-a.length)", 'SEG', re.S)
_sub1(r"const COND = \{.*\}(?=\n)", "const COND = " + json.dumps(g2p['COND'], ensure_ascii=False), 'COND')
_sub1(r"const ENTSIL = new Set\(\[.*\]\)(?=\n)", "const ENTSIL = new Set([])", 'ENTSIL')

# (2b-bis) PHON_TO_LETTERS : prior phonème->lettre de la route M4_PHON_USE_P (ON dans la config). La table
# de l'app est en SAMPA FRANÇAIS ; le p anglais est en IPA -> clés qui ne matchent pas -> prior MORT en
# anglais (le moteur saute via `if(!dist)continue`). On la remplace par la table IPA anglaise data-driven
# (build_phon2letters_en.py = inverse du g2p). C'est la « décompose EN » côté prior de lecture.
_sub1(r"const PHON_TO_LETTERS = \{[\s\S]*?\n\};",
      "const PHON_TO_LETTERS = " + json.dumps(p2l, ensure_ascii=False) + ";", 'PHON_TO_LETTERS')

# (2b-ter) PHON_FEATURES : traits articulatoires par lettre (substrat phon, initPhoneticSubstrate). Table
# de l'app = interprétation FRANÇAISE (R uvulaire, U=[y], H muet, J=[ʒ]) → biais FR dans le substrat EN.
# Remplacée par la phonétique ANGLAISE (build_phonfeatures_en.py). Keyée A-Z (pas de crash) mais valeurs FR.
_sub1(r"const PHON_FEATURES = \{[\s\S]*?\n\};",
      "const PHON_FEATURES = " + json.dumps(pf, ensure_ascii=False) + ";", 'PHON_FEATURES')

# (2c) N-GRAMME de lettres sur mots ATTESTÉS seulement (freq>0) — comme le FR (155k mots tous attestés).
# Le lexique EN complet (195k) inclut ~76k formes freq=0 (flexions rares) qui DILUENT la graphotactique
# si on les compte dans le n-gramme (`_neoEnsureNG`/gap = type-weighted, chaque mot 1×). On les garde pour
# la COHORTE/complétude mais on les EXCLUT du n-gramme -> parité FR + pas de biais vers le rare. (mesuré :
# mots courants 98 % inchangé ; ce patch vise le régime OOV/rare où le n-gramme pèse.)
_ng_n = html.count('if (w&&w.m) addWord(w.m)')
html = html.replace('if (w&&w.m) addWord(w.m)', 'if (w&&w.m&&w.f>0) addWord(w.m)')
if _ng_n != 4: print('[WARN] n-gramme attesté : %d occurrences patchées (attendu 4)' % _ng_n)

# (2d) VIDER les blocs de DONNÉES des OUTILS FRANÇAIS (correcteur vdc / dictée vdd / tagger) : le clone EN
# les embarquait à l'identique (~3,95 Mo de français MORT — le pendu ne les lit jamais, les outils ont
# leurs pages EN séparées et sont masqués ici). Tous leurs loaders guardent sur contenu vide
# (`if(!el||!el.textContent)return`) → on remplace le base64 par du vide : boot sûr, clone −45 %.
_TOOL_BLOCKS = ['vdc-lex-gz', 'speller-lex-gz', 'gdet-lex-gz', 'noun-post-gz', 'pos-hmm-gz', 'os-lm-gz', 'prenoms-gz']
for _bid in _TOOL_BLOCKS:
    _rx = re.compile(r'(<script type="text/plain" id="' + re.escape(_bid) + r'">).*?(</script>)', re.S)
    if not _rx.search(html): print('[WARN] bloc outil introuvable (déjà vidé ?) :', _bid)
    html = _rx.sub(lambda m: m.group(1) + m.group(2), html, count=1)

# (3) langue + titre
html = html.replace('<html lang="fr">', '<html lang="en">', 1)
html = html.replace('<title>Pendu cognitif, correcteur dys & dictée — l\'application | OMEGA-Ω</title>',
                    '<title>Cognitive Hangman — the engine that guesses your word | OMEGA-Ω</title>', 1)
# le pendu EN = SEULEMENT le pendu : masque les lanceurs flottants des autres outils FR embarqués
# (correcteur vdc / dictée vdd / décompose vdk) — ils ont leurs propres pages anglaises.
html = html.replace('</head>', '<style>#vdc-btn,#vdd-btn,#vdk-btn{display:none!important}</style>\n</head>', 1)

# (4) TRADUCTION de l'UI VISIBLE — remplacements ancrés (chaînes uniques, jamais du code JS).
# On traduit le chrome joueur (header, game panel, contrôles, présentation) ; le dashboard de
# recherche dense (toggles/math/legacy-debug) reste à compléter (mises à jour EN sporadiques).
TRANSLATIONS = [
    # header instrument + statut
    ('<span id="lex4-status" style="margin-right: 18px; color: var(--fg-mute); font-size: 10px;">LEX4 · CHARGEMENT</span>',
     '<span id="lex4-status" style="margin-right: 18px; color: var(--fg-mute); font-size: 10px;">LEX4 · LOADING</span>'),
    # game panel
    ('<div class="panel-label">PENDU · GAME STATE</div>', '<div class="panel-label">HANGMAN · GAME STATE</div>'),
    ('<div class="panel-title">Partie <span class="accent" id="game-counter">',
     '<div class="panel-title">Game <span class="accent" id="game-counter">'),
    ('placeholder="Mot à deviner (≥7 lettres)"', 'placeholder="Word to guess (≥7 letters)"'),
    # contrôles (libellés + infobulles principales)
    ('title="Active la configuration optimale CHEAT-FREE (preset rapport §8.3). À cliquer en premier : au démarrage tous les interrupteurs sont OFF (≈ 2,6 %).">⚙️ Config optimale</button>',
     'title="Activate the optimal CHEAT-FREE configuration (report preset §8.3). Click this first: at start all switches are OFF (≈ 2.6%).">⚙️ Optimal config</button>'),
    ('>+1 Tick</button>', '>+1 Tick</button>'),
    ('onclick="ui_runUntilEnd()">▶▶ Auto</button>', 'onclick="ui_runUntilEnd()">▶▶ Auto</button>'),
    ('onclick="ui_abortGame()">Abort</button>', 'onclick="ui_abortGame()">Abort</button>'),
    ('>🔄 Reset moteur</button>', '>🔄 Reset engine</button>'),
    ('title="Mesure A/B/C (200 parties, seed 12345) + export JSON">📊 Mesure</button>',
     'title="A/B/C measurement (200 games, seed 12345) + JSON export">📊 Measure</button>'),
    # présentation (haut de page)
    ('<span class="v">architecture cognitive du pendu français — « cognition &gt; oracle »</span>',
     '<span class="v">cognitive architecture of English hangman — “cognition &gt; oracle”</span>'),
    ('<div class="sub">Double route orthographe/phonologie (DRC) sur substrat hyperdimensionnel · déclaration émergente <em>cheat-free</em> · discipline mesure &amp; falsification (R66). Détails : mémoire &amp; rapport de référence.</div>',
     '<div class="sub">Dual orthography/phonology route (DRC) on a hyperdimensional substrate · emergent <em>cheat-free</em> declaration · measurement &amp; falsification discipline (R66). Details: memoir &amp; reference report.</div>'),
    ('<span id="status-pill" class="status-pill gray">non chargé</span>',
     '<span id="status-pill" class="status-pill gray">not loaded</span>'),
    ('<span>~97,5 % cheat-free in-lexique</span>', '<span>~97.5% cheat-free in-lexicon</span>'),
    ('<span class="sub">Cognitive Pendu Engine · v2-α0</span>', '<span class="sub">Cognitive Hangman Engine · v2-α0</span>'),
    # statut LEX4 généré en JS (chaînes distinctives, sûres à remplacer)
    ("' mots'", "' words'"),
    ("'LEX4 · CHARGEMENT'", "'LEX4 · LOADING'"),
    # stragglers (clé i18n non-matchée / messages JS distinctifs)
    ('parties chaudes', 'recent games'),
    ('non chargé', 'not loaded'),
    ('Lexique non chargé', 'Lexicon not loaded'),
    # bouton COPIER du correcteur : le clone anglais affichait des étiquettes FRANÇAISES (jamais
    # ancrées). Ajouter le message d'échec sans le traduire aurait aggravé la chose.
    ("'✓ Copié'", "'✓ Copied'"),
    ("'⚠ copie refusée — Ctrl+C'", "'⚠ copy refused — press Ctrl+C'"),
    ('📋 Copier', '📋 Copy'),
    # petits labels stats/contrôles (ancres distinctives)
    ('moy —', 'avg —'),
    ('voie —', 'route —'),
    ('voie OFF', 'route OFF'),
    ('ratio signaux', 'signal ratio'),
    ('θ pas', 'θ step'),
    ('pas<input', 'step<input'),
]
# (4bis) ADAPTATIONS MOTEUR des features 2026-08-13 (audit : le clone EN les recevait TELLES
# QUELLES — voix fr-FR sur du texte anglais, formule de lisibilité FRANÇAISE, injections
# d'homophones FRANÇAIS dans des phrases anglaises). Chaque remplacement est ASSERTÉ : si
# l'ancre bouge côté FR, le build casse ici plutôt que de livrer un clone semi-français.
_ADAPT = [
    # read-along : libellé + voix anglaise (ancre unique : MON bloc parle de `txt`, say() de `cur.text`)
    ("🔊 Lire</button>", "🔊 Read aloud</button>"),
    ("Écouter ton texte à voix haute — le mot lu est surligné (rien ne quitte ton appareil)",
     "Listen to your text read aloud — the word being read is highlighted (nothing leaves your device)"),
    ("var u=new SpeechSynthesisUtterance(txt);u.lang='fr-FR';", "var u=new SpeechSynthesisUtterance(txt);u.lang='en-US';"),
    # lisibilité : coefficients FLESCH ANGLAIS + libellés anglais (Kandel-Moles est l'adaptation FR)
    ("207-1.015*(mots.length/ph.length)-73.6*(syl/mots.length)", "206.835-1.015*(mots.length/ph.length)-84.6*(syl/mots.length)"),
    ("'très facile à lire':(sc>=60?'facile à lire':(sc>=50?'lecture courante':(sc>=30?'lecture soutenue':'lecture dense')))",
     "'very easy to read':(sc>=60?'easy to read':(sc>=50?'standard reading':(sc>=30?'demanding reading':'dense reading')))"),
    ("/100 — indicatif, jamais un jugement)", "/100 — indicative, never a judgment)"),
    # 🎯 repère la faute : RETIRÉ du clone EN — les familles d'injection sont FRANÇAISES (a/à, la/là) ;
    # un mode anglais demanderait ses familles (their/there, its/it's, -s) : chantier futur, pas un clone.
    ("<button class=\"g\" id=\"vdd-repere\" title=\"La phrase apparaît à l\u2019écran : clique le mot fautif\">🎯 Repère la faute</button>", ""),
]
for fr, en in _ADAPT:
    assert html.count(fr) == 1, '[ADAPT 2026-08-13] ancre absente ou multiple : ' + fr[:60]
    html = html.replace(fr, en)

_missing = []
for fr, en in TRANSLATIONS:
    if fr in html:
        html = html.replace(fr, en)
    elif fr != en:
        _missing.append(fr[:50])

# (5) table i18n étendue (dictee/pendu_en_i18n.json) — dashboard/toggles. Appliquée UNIQUEMENT à la
# zone markup (avant le code JS, borne « CODE FUNCTIONAL ») → aucun risque de toucher le moteur.
_i18n_n = 0; _i18n_tot = 0
_i18n_path = os.path.join(HERE, 'pendu_en_i18n.json')
if os.path.exists(_i18n_path):
    _m = json.load(io.open(_i18n_path, encoding='utf-8'))
    _i18n_tot = len(_m)
    _ci = html.find('CODE FUNCTIONAL')
    _head, _tail = (html[:_ci], html[_ci:]) if _ci > 0 else (html, '')
    for fr, en in sorted(_m.items(), key=lambda kv: -len(kv[0])):   # plus longues d'abord (évite les sous-chaînes)
        if fr != en and fr in _head:
            _head = _head.replace(fr, en); _i18n_n += 1
    html = _head + _tail

# --- `--check` : le clone LIVRÉ est-il celui que ce script produirait AUJOURD'HUI ? ---
# POURQUOI. Le clone anglais n'est régénéré que si quelqu'un y pense. Le 2026-08-10 on a découvert
# qu'il avait PLUSIEURS PR de retard : il lui manquait la table de genre `_GCOLL` et la graine
# `OMEGA_GDET` (#453), le modèle de ponctuation, `_npSubject`, `_quiRelAvant`, `_isPplWideEr`…
# Autrement dit l'application ANGLAISE tournait sur un moteur périmé, sans que rien ne le dise —
# même classe que le zip d'extension rassis, qui a SON check de fraîcheur depuis longtemps.
if CHECK:
    # ⚠️ LIRE COMME ON A LU LA SOURCE. `html` vient de `io.open(SRC)` SANS `newline=''` : Python a
    # donc converti les CRLF en LF. Sous Windows, git rematérialise le clone en CRLF (autocrlf) —
    # relire ici en `newline=''` comparait du CRLF à du LF et criait « périmé » sur un clone frais
    # (27 000 octets d'écart, un par ligne). La comparaison doit être SYMÉTRIQUE de la construction.
    actuel = io.open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else None
    if actuel == html:
        print('✓ clone anglais FRAIS : app/omega-pendu-en.html == build_pendu_en.py(app/omega-pendu.html)')
        sys.exit(0)
    print('✗ CLONE ANGLAIS PÉRIMÉ : le monolithe FR a changé, le clone EN ne suit pas.')
    print('  L\'application anglaise tourne donc sur un moteur plus ancien que le français.')
    print('  Corriger : PYTHONUTF8=1 python dictee/build_pendu_en.py')
    if actuel is None: print('  (le fichier n\'existe même pas)')
    else: print('  écart : %d octets livrés contre %d attendus' % (len(actuel.encode('utf-8')), len(html.encode('utf-8'))))
    sys.exit(1)

io.open(OUT, 'w', encoding='utf-8', newline='').write(html)

# --- vérification : le base64 embarqué re-décompresse en JSON valide ---
m = pat.search(html)
raw = gzip.decompress(base64.b64decode(m.group(2)))
data = json.loads(raw)
print('CLONE écrit :', os.path.relpath(OUT, os.path.join(HERE, '..')))
print('  lex4 anglais embarqué : %d mots, version %s' % (data['n_words'], data.get('version')))
print('  len_index longueurs :', sorted(int(k) for k in data['len_index']))
print('  LETTER_FREQ_EN E=%.4f (max attendu) · taille clone %.2f Mo' % (lf['e'], len(html.encode('utf-8'))/1e6))
print('  g2p ANGLAIS embarqué : %d graphèmes, %d SEG (build_g2p_en.py, zéro français)' % (len(g2p['COND']), len(g2p['SEG'])))
print('  traductions ancrées : %d · i18n dashboard : %d/%d · ancres NON trouvées : %s'
      % (len(TRANSLATIONS) - len(_missing), _i18n_n, _i18n_tot, _missing or 'aucune'))
