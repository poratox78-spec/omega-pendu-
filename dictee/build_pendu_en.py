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

for p in (SRC, B64, LF):
    if not os.path.exists(p): print('[FATAL] manquant :', p); sys.exit(1)

html = io.open(SRC, encoding='utf-8').read()
b64 = io.open(B64, encoding='utf-8').read().strip()
lf = json.load(io.open(LF, encoding='utf-8'))

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

# (3) langue + titre
html = html.replace('<html lang="fr">', '<html lang="en">', 1)
html = html.replace('<title>Pendu cognitif, correcteur dys & dictée — l\'application | OMEGA-Ω</title>',
                    '<title>Cognitive Hangman — the engine that guesses your word | OMEGA-Ω</title>', 1)

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
]
_missing = []
for fr, en in TRANSLATIONS:
    if fr in html:
        html = html.replace(fr, en)
    elif fr != en:
        _missing.append(fr[:50])

io.open(OUT, 'w', encoding='utf-8', newline='').write(html)

# --- vérification : le base64 embarqué re-décompresse en JSON valide ---
m = pat.search(html)
raw = gzip.decompress(base64.b64decode(m.group(2)))
data = json.loads(raw)
print('CLONE écrit :', os.path.relpath(OUT, os.path.join(HERE, '..')))
print('  lex4 anglais embarqué : %d mots, version %s' % (data['n_words'], data.get('version')))
print('  len_index longueurs :', sorted(int(k) for k in data['len_index']))
print('  LETTER_FREQ_EN E=%.4f (max attendu) · taille clone %.2f Mo' % (lf['e'], len(html.encode('utf-8'))/1e6))
print('  traductions : %d appliquées · ancres NON trouvées : %s' % (len(TRANSLATIONS) - len(_missing), _missing or 'aucune'))
