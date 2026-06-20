# -*- coding: utf-8 -*-
# Extrait les lexiques embarqués de l'app (app/omega-pendu.html) vers extension/assets/ — SOURCE UNIQUE régénérable.
# L'extension réutilise EXACTEMENT les mêmes données que l'app/le correcteur (parité) : aucune divergence possible.
#   - vdc-lex (JSON : verbes v, genre g/gn, paires adj a, conjugaison cj)            -> assets/vdc-lex.json
#   - gdet-lex-gz (gzip TSV  word\tg  g='1'->f)  = genre relâché « le voiture→la »   -> assets/gender-relaxed.tsv.gz
#   - speller-lex-gz (gzip TSV  form\tfreq\tPOS) = orthographe (non-mots/accents)     -> assets/speller.tsv.gz
# Données dérivées Lexique 4 → CC BY-SA 4.0 (voir NOTICE).
#   python3 extension/build_assets.py
import os, re, base64

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app', 'omega-pendu.html')
OUT = os.path.join(HERE, 'assets')


def block(html, bid):
    m = re.search(r'id="%s"[^>]*>(.*?)</script>' % re.escape(bid), html, re.S)
    if not m:
        raise SystemExit("bloc introuvable dans l'app : " + bid)
    return m.group(1).strip()


def main():
    if not os.path.exists(APP):
        print("app introuvable :", APP); return 1
    os.makedirs(OUT, exist_ok=True)
    html = open(APP, encoding='utf-8').read()

    # vdc-lex = JSON brut (déjà lisible) -> recompacté tel quel
    vdc = block(html, 'vdc-lex')
    open(os.path.join(OUT, 'vdc-lex.json'), 'w', encoding='utf-8').write(vdc)

    # blocs gzip+base64 -> on réécrit le binaire gzip tel quel (DecompressionStream côté extension, comme l'app)
    for bid, fname in [('gdet-lex-gz', 'gender-relaxed.tsv.gz'), ('speller-lex-gz', 'speller.tsv.gz')]:
        raw = re.sub(r'\s', '', block(html, bid))
        open(os.path.join(OUT, fname), 'wb').write(base64.b64decode(raw))

    for f in ['vdc-lex.json', 'gender-relaxed.tsv.gz', 'speller.tsv.gz']:
        p = os.path.join(OUT, f)
        print("  %-26s %7.0f Ko" % (f, os.path.getsize(p) / 1024))
    print("[build_assets] OK -> " + OUT)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
