# -*- coding: utf-8 -*-
# Extrait les lexiques embarqués de l'app (app/omega-pendu.html) vers extension/assets/ — SOURCE UNIQUE régénérable.
# L'extension réutilise EXACTEMENT les mêmes données que l'app/le correcteur (parité) : aucune divergence possible.
#   - vdc-lex (JSON : verbes v, genre g/gn, paires adj a, conjugaison cj)            -> assets/vdc-lex.json
#   - gdet-lex-gz (gzip TSV  word\tg  g='1'->f)  = genre relâché « le voiture→la »   -> assets/gender-relaxed.tsv.gz
#   - speller-lex-gz (gzip TSV  form\tfreq\tPOS) = orthographe (non-mots/accents)     -> assets/speller.tsv.gz
# Données dérivées Lexique 4 → CC BY-SA 4.0 (voir NOTICE).
#   python3 extension/build_assets.py
import os, re, base64, json, gzip

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

    # vdc-lex : dans l'app c'est désormais un bloc GZIP (vdc-lex-gz, #30 −3,93 Mo) → on le DÉCOMPRESSE en JSON brut
    # pour l'asset extension (dys-core lit vdc-lex.json en clair — inchangé côté extension).
    vdc = gzip.decompress(base64.b64decode(re.sub(r'\s', '', block(html, 'vdc-lex-gz')))).decode('utf-8')
    open(os.path.join(OUT, 'vdc-lex.json'), 'w', encoding='utf-8').write(vdc)

    # vdc-confusables = JSON brut (couche VERTE « vigilance » : confusables + indice contexte) -> tel quel
    conf = block(html, 'vdc-confusables')
    open(os.path.join(OUT, 'confusables.json'), 'w', encoding='utf-8').write(conf)

    # blocs gzip+base64 -> on réécrit le binaire gzip tel quel (DecompressionStream côté extension, comme l'app)
    for bid, fname in [('gdet-lex-gz', 'gender-relaxed.tsv.gz'), ('speller-lex-gz', 'speller.tsv.gz')]:
        raw = re.sub(r'\s', '', block(html, bid))
        open(os.path.join(OUT, fname), 'wb').write(base64.b64decode(raw))

    # noun-post (genre ET accord pluriel) : MAP form->[nom‰,ver‰] = posterior §3 P(POS|forme), dérivé de cgram_noun_post.json (FreqMot du TSV).
    # L'app embarque ces données ; l'extension (sans le lexique) charge ce dérivé → parité exacte des gardes. (pos-abstain supprimé : remplacé par le posterior.)
    assets = ['vdc-lex.json', 'confusables.json', 'gender-relaxed.tsv.gz', 'speller.tsv.gz']
    NPOST = os.path.join(HERE, '..', 'dictee', 'cgram_noun_post.json')
    if os.path.exists(NPOST):
        npost = json.load(open(NPOST, encoding='utf-8'))
        rows = sorted('%s\t%d\t%d' % (w, v[0], v[1]) for w, v in npost.items())
        gzip.open(os.path.join(OUT, 'noun-post.txt.gz'), 'wb', compresslevel=9).write(('\n'.join(rows)).encode('utf-8'))
        assets.append('noun-post.txt.gz')
    else:
        print("  ⚠️ cgram_noun_post.json absent — lancer build_noun_post.py d'abord (asset pluriel non régénéré)")

    for f in assets:
        p = os.path.join(OUT, f)
        print("  %-26s %7.0f Ko" % (f, os.path.getsize(p) / 1024))
    print("[build_assets] OK -> " + OUT)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
