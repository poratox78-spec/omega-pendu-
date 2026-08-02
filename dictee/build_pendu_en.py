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

io.open(OUT, 'w', encoding='utf-8', newline='').write(html)

# --- vérification : le base64 embarqué re-décompresse en JSON valide ---
m = pat.search(html)
raw = gzip.decompress(base64.b64decode(m.group(2)))
data = json.loads(raw)
print('CLONE écrit :', os.path.relpath(OUT, os.path.join(HERE, '..')))
print('  lex4 anglais embarqué : %d mots, version %s' % (data['n_words'], data.get('version')))
print('  len_index longueurs :', sorted(int(k) for k in data['len_index']))
print('  LETTER_FREQ_EN E=%.4f (max attendu) · taille clone %.2f Mo' % (lf['e'], len(html.encode('utf-8'))/1e6))
