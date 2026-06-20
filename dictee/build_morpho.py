# -*- coding: utf-8 -*-
# Extrait la DÉCOMPOSITION MORPHOLOGIQUE de Lexique 4 (champs md/mb/ms) depuis le lexique embarqué
# OMEGA_LEX4 (bloc gzip+base64 'lex4-data-gz' de app/omega-pendu.html) → dictee/morpho.json.
# « décompose comme Lexique 4 » inclut la MORPHOLOGIE (base + affixes) : c'est la route LEXICALE
# de la morpho de la double voie. Ex. Lexique 4 : portable → md=/port(er).able, mb=porter.
#
# Méthode sanctionnée (CLAUDE.md) : on NE charge pas le 5 Mo dans un éditeur ; on le traite par script.
# Lancer : python3 dictee/build_morpho.py
import os, re, base64, gzip, json

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app', 'omega-pendu.html')
OUT = os.path.join(HERE, 'morpho.json')


def parse_md(md):
    """« /port(er).able » → liste de morphèmes ['port','able'] (la parenthèse = forme du lemme, ignorée
    pour le découpage mais gardée dans le md brut). Sépare sur '.', retire le '/' de tête."""
    s = md.lstrip('/')
    parts = [p for p in s.split('.') if p]
    morphs = [re.sub(r'\(.*?\)', '', p) for p in parts]      # « port(er) » → « port »
    return [m for m in morphs if m]


def main():
    if not os.path.exists(APP):
        print(f"[morpho] app introuvable : {APP}"); return 1
    src = open(APP, encoding='utf-8').read()
    m = re.search(r'id="lex4-data-gz"[^>]*>([A-Za-z0-9+/=\s]+?)</script>', src)
    if not m:
        print("[morpho] bloc lex4-data-gz introuvable"); return 2
    b64 = re.sub(r'\s', '', m.group(1))
    W = json.loads(gzip.decompress(base64.b64decode(b64)).decode('utf-8'))['words']
    morpho = {}                                              # mot(deacc minuscule) → [base, md_brut, [morphèmes]]
    n_md = n_mb = 0
    for e in W:
        key = (e.get('m') or '').lower()                     # m = ASCII MAJ deacc → minuscule = clé deacc
        if not key:
            continue
        md = e.get('md'); mb = e.get('mb')
        if not md and not mb:
            continue
        morphs = parse_md(md) if md else ([mb] if mb else [])
        if md: n_md += 1
        if mb: n_mb += 1
        # on ne garde que ce qui APPORTE (≥2 morphèmes, ou une base ≠ mot) — sinon pas d'info morpho.
        # On stocke [base, md_brut] ; les morphèmes se reparsent au chargement (parse_md) → asset plus léger.
        if len(morphs) >= 2 or (mb and mb.lower() != key):
            morpho[key] = [mb or '', md or '']
    json.dump(morpho, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    sz = os.path.getsize(OUT)
    print(f"[morpho] {len(morpho)} mots à décomposition morphologique non triviale "
          f"(sur {n_md} md / {n_mb} mb vus) → {OUT} ({sz//1024} Ko)")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
