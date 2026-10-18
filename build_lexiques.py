#!/usr/bin/env python3
# build_lexiques.py — assemble le bundle de données ouvertes « omega-lexiques.zip » (racine du site).
#
# Rassemble EN UN les lexiques retravaillés + le POS-tagger d'OMEGA, tous dérivés de sources CC BY-SA
# (Lexique 4, Wiktionnaire/kaikki, Universal Dependencies French-GSD). Écrit un NOTICE d'attribution
# (obligation share-alike) dans le zip. AUCUNE donnée privée (data_local/, dys-corpus, WiCoPaCo, OQLF)
# n'est incluse — WiCoPaCo n'a servi qu'à découvrir des faux positifs devenus des règles (code), jamais
# une donnée redistribuée.
#
# Reproductible : python build_lexiques.py   → omega-lexiques.zip (+ liste les fichiers/tailles).
import io, json, os, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'omega-lexiques.zip')

# (chemin source, nom dans le zip, description, source amont)
FILES = [
    ('extension/assets/speller.tsv.gz',   'speller.tsv.gz',
     'Lexique orthographique — ~{N_SPELLER} formes (correction, accents, non-mots ; forme, fréquence ‰, catégorie).', 'Lexique 4 + Wiktionnaire + Morphalou 3.1 (LGPL-LR)'),
    ('extension/assets/gender-acc.json.gz', 'genre-accentue.json.gz',
     'Genre des noms, formes accentuées (accord du déterminant et de l’adjectif) — hors noms épicènes, '
     'qui ont les deux genres (un/une peintre) et ne peuvent donc trancher aucun accord.', 'Lexique 4 + Wiktionnaire + Morphalou 3.1 (LGPL-LR)'),
    ('extension/assets/gender-relaxed.tsv.gz', 'genre-noms.tsv.gz',
     'Genre des noms à genre non ambigu (accord).', 'Lexique 4 + Wiktionnaire'),
    ('extension/assets/pos-hmm.json.gz',   'pos-tagger-hmm.json.gz',
     'POS-tagger HMM (émissions + transitions bigramme, décodage Viterbi).', 'UD French-GSD + Lexique 4'),
    ('dictee/pos_hmm.json',                'pos-tagger-hmm.json',
     'Même POS-tagger, JSON lisible (non compressé).', 'UD French-GSD + Lexique 4'),
    ('extension/assets/noun-post.txt.gz',  'noun-post.txt.gz',
     'Contextes post-nominaux (désambiguïsation nom/verbe en contexte).', 'Lexique 4'),
    ('extension/assets/os-subj-lm.json.gz','accord-sujet-verbe-lm.json.gz',
     'Modèle de langue trigramme élagué pour l’arbitrage de l’accord sujet-verbe.', 'UD French-GSD'),
    ('extension/assets/confusables.json',  'confusables.json',
     'Groupes de confusables (homophones + paronymes) avec sens (vigilance verte).', 'Lexique 4 + Wiktionnaire'),
    ('dictee/morpho.json',                 'morpho.json',
     'Morphologie : radicaux (md/mb).', 'Lexique 4'),
    ('dictee/phono_homophones.json',       'homophones-phonetiques.json',
     'Groupes d’homophones (clé phonétique).', 'Lexique 4'),
    ('dictee/elision_recall.txt',          'elision.txt',
     'Mots à apostrophe (élision) pour le rappel — sources sûres uniquement.', 'UD French-GSD + curé'),
    # ⭐ 18/10/2026 (choix de Rem : « ça peut pas être tout notre lexique ? ») — le reste de ce qui est publiable. Tous ces fichiers
    # étaient déjà servis un par un par le site ; le paquet les réunit, sources créditées. Une source peut être une FONCTION
    # (lexique du pendu tiré du bloc de l'app, table de conjugaison reconstruite et lisible) : --check la recalcule et compare.
    (lambda: _pendu_lexique(),             'pendu-lexique.json',
     'Lexique du pendu : ~{N_PENDU} mots (en capitales, sans accent) avec prononciation, lemme, catégorie, fréquence ; '
     'les colonnes sont décrites en tête du fichier.', 'Lexique 4'),
    (lambda: _conjugaison(),               'conjugaison.json',
     'Table de conjugaison : {N_VERBES} verbes, tous les temps et toutes les personnes (verbe → temps → personne → forme ; '
     'le verbe est écrit sans accent, les formes avec).', 'Lexique 4 + Morphalou 3.1 (LGPL-LR)'),
    ('dictee/phono_morphalou.json',        'prononciations-morphalou.json',
     'Prononciations de ~{N_PHON} formes de Morphalou, notées comme dans Lexique 4 (forme → prononciation).', 'Morphalou 3.1 (LGPL-LR)'),
    ('extension/assets/prenoms.tsv.gz',    'prenoms-genre.tsv.gz',
     'Prénoms et leur genre (accord : « Marie est venue »).', 'Wiktionnaire'),
    ('extension/assets/ent-3p.txt.gz',     'troisieme-personne-pluriel.txt.gz',
     'Formes en « -ent » qui sont des 3es personnes du pluriel (« -ent » muet : ils mangent), tirées de la table de conjugaison.',
     'Lexique 4 + Morphalou 3.1 (LGPL-LR)'),
    ('extension/assets/sens.json.gz',      'definitions-courtes.json.gz',
     'Définitions courtes par mot (jeu Double-Sens).', 'Wiktionnaire'),
    ('extension/assets/ponct-lm.json.gz',  'ponctuation-lm.json.gz',
     'Modèle de ponctuation du texte dicté (où poser virgules et points).', 'UD French-GSD + exemples du Wiktionnaire'),
    ('dictee/nv_genre_fr.json',            'genre-noms-verbes-rares.json',
     'Genre des formes rares qui sont à la fois nom et verbe (« flue » : nom féminin), quand Morphalou et le Wiktionnaire sont d’accord.',
     'Morphalou 3.1 (LGPL-LR) + Wiktionnaire'),
    ('LICENSE-LGPL-LR.txt',                 'LICENSE-LGPL-LR.txt',
     'Texte de la licence LGPL-LR (Morphalou 3.1, ATILF/CNRS).', 'ATILF/CNRS'),
]

NOTICE = """OMEGA-Ω — Lexiques ouverts & POS-tagger français
==================================================

Les lexiques et modèles du correcteur/dictée OMEGA-Ω, retravaillés à la
main (tri à zéro faux positif, POS-tagger, clés phonétiques, curation) et
réunis ici en un seul paquet. Le français n'appartient à personne :
réutilise-les librement, pour n'importe quel projet.

Merci aux ressources amont dont ces données partent — Lexique 4
(lexique.org), le Wiktionnaire français (via kaikki.org) et Universal
Dependencies French-GSD (universaldependencies.org), en CC BY-SA 4.0 ;
et, depuis septembre 2026, Morphalou 3.1 (ATILF/CNRS, ortolang.fr), sous
LGPL-LR : le lexique orthographique et le genre accentué en contiennent des
formes fléchies (≈ {N_MORPHALOU} formes verbales, noms, adjectifs, adverbes).
Par correction on partage donc dans le même esprit : crédite OMEGA-Ω et
ces sources si tu réutilises, garde-le ouvert, et joins le texte de la
LGPL-LR (LICENSE-LGPL-LR.txt) avec toute redistribution des fichiers qui
en dérivent (speller.tsv.gz, genre-accentue.json.gz, conjugaison.json,
prononciations-morphalou.json, troisieme-personne-pluriel.txt.gz,
genre-noms-verbes-rares.json).

Rien de privé ici : ni corpus personnel, ni WiCoPaCo, ni OQLF.

FICHIERS
--------
"""


# Lots du speller tirés de Morphalou 3.1 (LGPL-LR) : leur part dans le speller livré est comptée pour la NOTICE.
LOTS_MORPHALOU = ('morph_na_lex_fr.tsv', 'morph_ver_lex_fr.tsv.gz', 'morph_acc_lex_fr.tsv', 'conj_lex_fr.tsv',
                  'ver_justes_lex_fr.tsv.gz', 'rect90_lex_fr.tsv.gz', 'na_justes_lex_fr.tsv.gz')


def _formes(p):
    import gzip, io
    f = gzip.open(p, 'rt', encoding='utf-8') if p.endswith('.gz') else io.open(p, encoding='utf-8')
    with f:
        return {l.split('\t', 1)[0].strip() for l in f if l.strip()}


def _chiffres():
    """Les chiffres de la NOTICE, COMPTÉS sur les fichiers livrés (arrondis au millier) — jamais écrits à la main : le
    « ~706 000 » a dormi dans le paquet pendant que le speller passait à 739 000 (vu le 18/10/2026), et --check, qui
    comparait la NOTICE à elle-même, ne pouvait pas le voir."""
    sp = _formes(os.path.join(HERE, 'extension', 'assets', 'speller.tsv.gz'))
    mo = set()
    for f in LOTS_MORPHALOU:
        q = os.path.join(HERE, 'dictee', f)
        if os.path.exists(q): mo |= _formes(q)
    k = lambda n: '{:,}'.format(int(round(n / 1000.0)) * 1000).replace(',', ' ')
    pen = json.loads(_pendu_lexique().decode('utf-8'))
    pho = json.load(io.open(os.path.join(HERE, 'dictee', 'phono_morphalou.json'), encoding='utf-8'))
    return {'N_SPELLER': k(len(sp)), 'N_MORPHALOU': k(len(mo & sp)), 'N_PENDU': k(pen.get('n_words') or len(pen.get('words') or [])),
            'N_VERBES': '{:,}'.format(len(_conj_table())).replace(',', ' '), 'N_PHON': k(len(pho))}


def _pendu_lexique():
    """Le lexique du pendu tel que l'app l'embarque (bloc base64 + gzip « lex4-data-gz ») : JSON lisible."""
    import re, base64, gzip
    t = io.open(os.path.join(HERE, 'app', 'omega-pendu.html'), encoding='utf-8').read()
    m = re.search(r'<script type="text/plain" id="lex4-data-gz">(.*?)</script>', t, re.S)
    return gzip.decompress(base64.b64decode(m.group(1).strip()))


def _conj_table():
    sys.path.insert(0, os.path.join(HERE, 'dictee'))
    import conj_io
    return conj_io.charger(os.path.join(HERE, 'dictee', 'cgram_conj.json'))['c']


def _conjugaison():
    """La table de conjugaison LISIBLE (verbe → temps → personne → forme) : le fichier du dépôt est compact (index recalculé au
    chargement, cf. conj_io.py), inutilisable tel quel hors de nos moteurs."""
    return json.dumps(_conj_table(), ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode('utf-8')


def _remplir(t, c):
    for a, b in c.items(): t = t.replace('{' + a + '}', b)
    return t


def _texte(name):
    return name.endswith(('.txt', '.json', '.tsv', '.md'))


def _lf(b):
    return b.replace(b'\r\n', b'\n')


def _notice_et_membres():
    c = _chiffres(); notice = _remplir(NOTICE, c); membres = []
    for src, name, desc, up in FILES:
        if not callable(src) and not os.path.exists(os.path.join(HERE, src)):
            continue
        membres.append((name, src))
        notice += f"- {name}\n    {_remplir(desc, c)}\n    Source : {up}\n"
    notice += "\nGénéré par build_lexiques.py — OMEGA-Ω — https://omegapendu.com/\n"
    return notice, membres


def _octets(src):
    return src() if callable(src) else open(os.path.join(HERE, src), 'rb').read()


def check():
    """--check : le paquet COMMITÉ reflète-t-il les sources d'aujourd'hui ? Il a dormi avec un speller de
    214 000 formes pendant que le moteur en servait 705 653 (vu le 03/09/2026) : rien ne le surveillait.
    Octet pour octet, NOTICE comprise ; sortie explicite, jamais un vert muet."""
    if not os.path.exists(OUT):
        print('✗ PAQUET DE DONNÉES ABSENT — régénérer avec : python3 build_lexiques.py'); return 1
    notice, membres = _notice_et_membres()
    z = zipfile.ZipFile(OUT); noms = set(z.namelist()); pb = []
    attendus = set(n for n, _ in membres) | {'NOTICE.txt'}
    for n in sorted(attendus - noms): pb.append(f'manque dans le zip : {n}')
    for n in sorted(noms - attendus): pb.append(f'en trop dans le zip : {n}')
    import gzip
    def _contenu(b):                                   # .gz : on compare le CONTENU (l'en-tête gzip porte une date)
        try: return gzip.decompress(b)
        except Exception: return b
    for n, p in membres:
        if n in noms:
            a, b = z.read(n), _octets(p)
            if _texte(n): a, b = _lf(a), _lf(b)
            if a != b and not (n.endswith('.gz') and _contenu(a) == _contenu(b)): pb.append(f'périmé : {n}')
    if 'NOTICE.txt' in noms and z.read('NOTICE.txt').decode('utf-8') != notice: pb.append('périmé : NOTICE.txt')
    if pb:
        print('✗ PAQUET DE DONNÉES PAS FRAIS — régénérer avec : python3 build_lexiques.py')
        for x in pb: print('   ', x)
        return 1
    print(f'✓ paquet de données ouvertes frais : {len(membres)} fichiers + NOTICE.txt == sources ({os.path.getsize(OUT)//1024} Ko)'); return 0


def main():
    rows = []
    notice, _m = _notice_et_membres()   # une seule fabrique de NOTICE (chiffres comptés) pour l'écriture et pour --check
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
        for src, name, desc, up in FILES:
            if not callable(src) and not os.path.exists(os.path.join(HERE, src)):
                print(f"  ⚠ manquant : {src} (ignoré)")
                continue
            b = _octets(src)
            if _texte(name): b = _lf(b)                   # membres TEXTE : fins de ligne LF, quel que soit l'OS de build
            zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0)); zi.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(zi, b)                             # date fixe : le zip ne change que si le contenu change
            rows.append((name, len(b)))
        z.writestr('NOTICE.txt', notice)
    total = os.path.getsize(OUT)
    print(f"✓ {OUT}  ({total//1024} Ko, {len(rows)} fichiers + NOTICE.txt)")
    for n, s in rows:
        print(f"    {n:34s} {s//1024:6d} Ko")


if __name__ == '__main__':
    sys.exit(check() if '--check' in sys.argv else (main() or 0))
