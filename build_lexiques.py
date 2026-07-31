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
import os, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'omega-lexiques.zip')

# (chemin source, nom dans le zip, description, source amont)
FILES = [
    ('extension/assets/speller.tsv.gz',   'speller.tsv.gz',
     'Lexique orthographique — ~214 000 formes (correction, accents, non-mots).', 'Lexique 4 + Wiktionnaire'),
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
    ('dictee/morpho.json',                 'morpho-lexique4.json',
     'Morphologie (radicaux md/mb) décodée de Lexique 4.', 'Lexique 4'),
    ('dictee/phono_homophones.json',       'homophones-phonetiques.json',
     'Groupes d’homophones (clé phonétique).', 'Lexique 4'),
    ('dictee/elision_recall.txt',          'elision.txt',
     'Mots à apostrophe (élision) pour le rappel — sources sûres uniquement.', 'UD French-GSD + curé'),
]

NOTICE = """OMEGA-Ω — Lexiques ouverts & POS-tagger français
==================================================

Les lexiques et modèles du correcteur/dictée OMEGA-Ω, retravaillés à la
main (tri à zéro faux positif, POS-tagger, clés phonétiques, curation) et
réunis ici en un seul paquet. Le français n'appartient à personne :
réutilise-les librement, pour n'importe quel projet.

Merci aux ressources amont dont ces données partent — Lexique 4
(lexique.org), le Wiktionnaire français (via kaikki.org) et Universal
Dependencies French-GSD (universaldependencies.org). Elles sont en
CC BY-SA 4.0 ; par correction on partage donc dans le même esprit
(crédite OMEGA-Ω + ces sources si tu réutilises, et garde-le ouvert).

Rien de privé ici : ni corpus personnel, ni WiCoPaCo, ni OQLF.

FICHIERS
--------
"""


def main():
    rows = []
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
        notice = NOTICE
        for src, name, desc, up in FILES:
            p = os.path.join(HERE, src)
            if not os.path.exists(p):
                print(f"  ⚠ manquant : {src} (ignoré)")
                continue
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
    main()
