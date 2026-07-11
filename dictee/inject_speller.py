# -*- coding: utf-8 -*-
# Injecte le lexique speller (base64 gzip, sortie de build_speller_lex.py) dans le bloc
# <script type="text/plain" id="speller-lex-gz"> de l'app monolithe. Pendant de inject_vdc.py pour le speller.
#   Pipeline complet (régénération, Lexique4 hors-repo) :
#     cat /tmp/lex4/Lexique4.tsv dictee/wikt_lex_fr.tsv > /tmp/lex4/Lexique4_aug.tsv      # augmentation Wiktionnaire
#     LEX4=/tmp/lex4/Lexique4_aug.tsv MINFREQ=0 OUT=/tmp/lex4/speller_lex python3 dictee/build_speller_lex.py
#     SPELLER_B64=/tmp/lex4/speller_lex.b64 python3 dictee/inject_speller.py             # CE script
#   Source : Lexique 4 (CC BY-SA 4.0) + Wiktionnaire FR (CC BY-SA, kaikki.org) — cf. dictee/wikt_lex_fr.tsv.
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app', 'omega-pendu.html')
B64 = os.environ.get('SPELLER_B64', '/tmp/lex4/speller_lex.b64')


def main():
    if not (os.path.exists(APP) and os.path.exists(B64)):
        print(f"[inject-speller] app ou {B64} introuvable"); return 1
    b64 = open(B64, encoding='utf-8').read().strip()
    app = open(APP, encoding='utf-8', newline='').read()   # newline='' : PRÉSERVE les CRLF (parité extension)
    pat = re.compile(r'(<script type="text/plain" id="speller-lex-gz">)(.*?)(</script>)', re.S)
    if not pat.search(app):
        print("[inject-speller] bloc speller-lex-gz introuvable dans l'app"); return 2
    new, n = pat.subn(lambda m: m.group(1) + b64 + m.group(3), app)
    if n != 1:
        print(f"[inject-speller] {n} blocs (attendu 1) — abandon"); return 3
    if new == app:
        print("[inject-speller] déjà à jour (aucun changement)."); return 0
    open(APP, 'w', encoding='utf-8', newline='').write(new)
    print(f"[inject-speller] speller-lex-gz mis à jour ({len(b64) // 1024} Ko base64) ← {os.path.basename(B64)}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
