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
POS = os.path.join(HERE, '..', 'dictee', 'cgram_pos.json')   # POS 155k (build_pos.py) — extension n'a pas OMEGA_LEX4


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

    # POS-abstain (genre) : SET des formes où POS≠NOM ∨ nbhomog>1, dérivé de cgram_pos.json (= même lexique que l'app/Python).
    # NOM-nbhomog (accord pluriel) : MAP form->nbhomog des formes POS=NOM-dominantes (≡ posOf()[0]=='NOM' + nbhomog).
    # L'app/Python lisent OMEGA_LEX4 ; l'extension (sans le lexique) charge ces dérivés → parité exacte des gardes.
    assets = ['vdc-lex.json', 'gender-relaxed.tsv.gz', 'speller.tsv.gz']
    if os.path.exists(POS):
        pos = json.load(open(POS, encoding='utf-8'))
        ab = sorted(w for w, v in pos.items() if v[0] != 'NOM' or (len(v) > 2 and v[2] > 1))
        gzip.open(os.path.join(OUT, 'pos-abstain.txt.gz'), 'wb', compresslevel=9).write(('\n'.join(ab)).encode('utf-8'))
        nm = sorted((w, v[2] if len(v) > 2 else 0) for w, v in pos.items() if v[0] == 'NOM')
        gzip.open(os.path.join(OUT, 'nom-nbhomog.txt.gz'), 'wb', compresslevel=9).write(('\n'.join('%s\t%d' % (w, nb) for w, nb in nm)).encode('utf-8'))
        assets += ['pos-abstain.txt.gz', 'nom-nbhomog.txt.gz']
    else:
        print("  ⚠️ cgram_pos.json absent — lancer build_pos.py d'abord (assets POS/NOM non régénérés)")

    for f in assets:
        p = os.path.join(OUT, f)
        print("  %-26s %7.0f Ko" % (f, os.path.getsize(p) / 1024))
    print("[build_assets] OK -> " + OUT)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
