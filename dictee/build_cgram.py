# -*- coding: utf-8 -*-
# Génère dictee/cgram_verbs.json : la couverture VERBALE complète pour le correcteur (étape 3).
# Remplace la liste blanche stopgap (vlike) par les VRAIES formes verbales de Lexique 4 (colonne cgram).
#
# ⚠️ Le Lexique4.tsv (34 Mo, 188 863 mots) est HORS-REPO (Drive de Rem). Ce script l'attend en
#    /tmp/lex4/Lexique4.tsv (cf. CLAUDE.md) ; adapter LEX_PATH au besoin. Tant que le fichier n'est
#    pas là, le correcteur utilise sa liste blanche (vlike) — ce script est le branchement prêt à l'emploi.
#
# Robustesse : on repère les colonnes par NOM d'en-tête (cgram / Mot / Freq) — pas par index figé —
# car Lexique 4 a 37 colonnes au nommage « N_Nom ».
# Lancer (lexique présent) : python3 dictee/build_cgram.py
import os, sys, json, csv, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
LEX_PATH = os.environ.get('LEX4', '/tmp/lex4/Lexique4.tsv')
OUT = os.path.join(HERE, 'cgram_verbs.json')
FREQ_MIN = float(os.environ.get('FREQ_MIN', '0.5'))   # garde les formes pas trop rares (taille raisonnable)


def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def find_col(header, *needles):
    """Index de la 1re colonne dont le nom (minuscule) contient l'une des aiguilles."""
    low = [h.lower() for h in header]
    for nd in needles:
        for k, h in enumerate(low):
            if nd in h:
                return k
    return -1


def main():
    if not os.path.exists(LEX_PATH):
        print(f"[cgram] Lexique4 introuvable ({LEX_PATH}).")
        print("        Le correcteur reste sur sa liste blanche (vlike). Place le .tsv et relance.")
        return 1
    with open(LEX_PATH, encoding='utf-8') as f:
        rdr = csv.reader(f, delimiter='\t')
        header = next(rdr)
        c_mot = find_col(header, 'mot')                 # 1_Mot
        c_gram = find_col(header, 'cgram', 'gram')       # catégorie grammaticale
        c_freq = find_col(header, 'freqortho', 'freqfilms', 'freq')
        if min(c_mot, c_gram) < 0:
            print(f"[cgram] colonnes introuvables (mot={c_mot}, cgram={c_gram}). En-tête : {header[:8]}…")
            return 2
        verbs = set()
        n = 0
        for row in rdr:
            if len(row) <= max(c_mot, c_gram):
                continue
            cg = row[c_gram].strip().upper()
            if not cg.startswith('VER'):                 # VER = verbe (toutes formes fléchies)
                continue
            if c_freq >= 0 and c_freq < len(row):
                try:
                    if float((row[c_freq] or '0').replace(',', '.')) < FREQ_MIN:
                        continue
                except ValueError:
                    pass
            w = deacc(row[c_mot].strip().lower())
            if w and all('a' <= ch <= 'z' for ch in w):
                verbs.add(w); n += 1
    out = sorted(verbs)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f"[cgram] {len(out)} formes verbales (sur {n} lignes VER, freq≥{FREQ_MIN}) → {OUT}")
    print("        Le correcteur (vlike) les chargera automatiquement au prochain run.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
