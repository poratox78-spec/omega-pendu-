# -*- coding: utf-8 -*-
# Injecte cgram_noun_post.json dans le bloc <script type="text/plain" id="noun-post-gz"> de l'app (gzip+base64).
# Format embarqué = lignes "forme\tnom‰\tver‰" (le JS reconstruit la map au chargement). Pendant de inject_speller.py.
#   python3 dictee/build_noun_post.py     # (ou build_wikt_gender.py) → cgram_noun_post.json
#   python3 dictee/inject_noun_post.py     # app ← cgram_noun_post.json   (CE script)
import os, re, sys, json, gzip, base64

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app', 'omega-pendu.html')
NP = os.path.join(HERE, 'cgram_noun_post.json')


def main():
    if not (os.path.exists(APP) and os.path.exists(NP)):
        print("[inject-noun-post] app ou cgram_noun_post.json introuvable"); return 1
    d = json.load(open(NP, encoding='utf-8'))
    lines = '\n'.join(f"{w}\t{v[0]}\t{v[1]}" for w, v in sorted(d.items()))
    b64 = base64.b64encode(gzip.compress(lines.encode('utf-8'), 9)).decode('ascii')
    app = open(APP, encoding='utf-8', newline='').read()   # newline='' : préserve CRLF (parité extension)
    pat = re.compile(r'(<script type="text/plain" id="noun-post-gz">)(.*?)(</script>)', re.S)
    if not pat.search(app):
        print("[inject-noun-post] bloc noun-post-gz introuvable"); return 2
    new, n = pat.subn(lambda m: m.group(1) + b64 + m.group(3), app)
    if n != 1:
        print(f"[inject-noun-post] {n} blocs (attendu 1) — abandon"); return 3
    if new == app:
        print("[inject-noun-post] déjà à jour."); return 0
    open(APP, 'w', encoding='utf-8', newline='').write(new)
    print(f"[inject-noun-post] noun-post-gz mis à jour ({len(b64)//1024} Ko base64, {len(d)} formes)")
    return 0


if __name__ == '__main__':
    sys.exit(main())
