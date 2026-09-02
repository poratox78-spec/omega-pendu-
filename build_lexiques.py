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
import os, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'omega-lexiques.zip')

# (chemin source, nom dans le zip, description, source amont)
FILES = [
    ('extension/assets/speller.tsv.gz',   'speller.tsv.gz',
     'Lexique orthographique — ~706 000 formes (correction, accents, non-mots ; forme, fréquence ‰, catégorie).', 'Lexique 4 + Wiktionnaire + Morphalou 3.1 (LGPL-LR)'),
    ('extension/assets/gender-acc.json.gz', 'genre-accentue.json.gz',
     'Genre des noms, formes accentuées (accord du déterminant et de l’adjectif).', 'Lexique 4 + Wiktionnaire + Morphalou 3.1 (LGPL-LR)'),
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
formes fléchies (≈ 500 000 formes verbales, noms, adjectifs, adverbes).
Par correction on partage donc dans le même esprit : crédite OMEGA-Ω et
ces sources si tu réutilises, garde-le ouvert, et joins le texte de la
LGPL-LR (LICENSE-LGPL-LR.txt) avec toute redistribution des fichiers qui
en dérivent (speller.tsv.gz, genre-accentue.json.gz).

Rien de privé ici : ni corpus personnel, ni WiCoPaCo, ni OQLF.

FICHIERS
--------
"""


def _texte(name):
    return name.endswith(('.txt', '.json', '.tsv', '.md'))


def _lf(b):
    return b.replace(b'\r\n', b'\n')


def _notice_et_membres():
    notice = NOTICE; membres = []
    for src, name, desc, up in FILES:
        p = os.path.join(HERE, src)
        if not os.path.exists(p):
            continue
        membres.append((name, p))
        notice += f"- {name}\n    {desc}\n    Source : {up}\n"
    notice += "\nGénéré par build_lexiques.py — OMEGA-Ω — https://omegapendu.com/\n"
    return notice, membres


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
            a, b = z.read(n), open(p, 'rb').read()
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
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
        notice = NOTICE
        for src, name, desc, up in FILES:
            p = os.path.join(HERE, src)
            if not os.path.exists(p):
                print(f"  ⚠ manquant : {src} (ignoré)")
                continue
            if _texte(name):                              # membres TEXTE : fins de ligne LF, quel que soit l'OS de build
                z.writestr(name, _lf(open(p, 'rb').read()))
            else:
                z.write(p, name)
            sz = os.path.getsize(p)
            rows.append((name, sz))
            notice += f"- {name}\n    {desc}\n    Source : {up}\n"
        notice += "\nGénéré par build_lexiques.py — OMEGA-Ω — https://omegapendu.com/\n"
        z.writestr('NOTICE.txt', notice)
    total = os.path.getsize(OUT)
    print(f"✓ {OUT}  ({total//1024} Ko, {len(rows)} fichiers + NOTICE.txt)")
    for n, s in rows:
        print(f"    {n:34s} {s//1024:6d} Ko")


if __name__ == '__main__':
    sys.exit(check() if '--check' in sys.argv else (main() or 0))
