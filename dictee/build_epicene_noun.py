# -*- coding: utf-8 -*-
"""Dérive la LISTE CLOSE des NOMS ÉPICÈNES (mêmes le/la : médecin, juge, élève, artiste…)
depuis Lexique4 (CC BY-SA) + une liste curée de PROFESSIONS FÉMINISÉES modernes.

But : `rule_det_gender` force le déterminant sur « la médecin »→« le médecin » car
GENDER_PURE marque médecin masculin (usage traditionnel). Or ces noms sont ÉPICÈNES
(« la médecin », « la juge » = usage moderne valide) → il faut ABSTENIR.

Source (1) = marqueur canonique Lexique **genre == 'e'** sur cgram=NOM, fréq lemme ≥ 0.5
(juge/ministre/artiste/élève/secrétaire/architecte/maire…). Source (2) = CURÉE : les
professions que Lexique marque encore 'm' seul mais féminisées en usage courant
(médecin/chef/notaire/professeur/auteur/ingénieur…) + quelques épicènes en -e absents
du plancher fréquentiel (protagoniste/alpiniste/adepte/détective).

Sortie : chaîne d'espaces DÉACCENTUÉE triée → miroir exact injecté dans les 3 moteurs,
consommée par rule_det_gender / rDetGenre (abstention si le nom-tête ∈ set). L'exclusion
ne peut QU'ENLEVER des FP (jamais en ajouter) → FP-safe par construction.
Usage : python dictee/build_epicene_noun.py  → écrit dictee/epicene_noun.txt
"""
import os, io, lzma, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX_XZ = os.path.join(ROOT, "Lexique4.tsv.xz")
OUT = os.path.join(ROOT, "dictee", "epicene_noun.txt")
FREQ_MIN = 0.5

def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

# Professions féminisées que Lexique marque 'm' seul (usage moderne = épicène : « la médecin »).
CURATED = set(("medecin chef notaire psychologue therapeute professeur auteur ingenieur docteur "
               "procureur entrepreneur sculpteur gouverneur ecrivain magistrat pasteur agent "
               "protagoniste alpiniste adepte detective hote").split())

def build():
    epi = set()
    with lzma.open(LEX_XZ, mode="rt", encoding="utf-8") as f:
        for ln in f:
            p = ln.rstrip("\n").split("\t")
            if len(p) < 12 or p[4] != "NOM" or p[6] != "e":   # 5_Cgram=NOM, 7_Genre='e' (épicène)
                continue
            try: fr = float(p[11].replace(",", "."))
            except ValueError: fr = 0.0
            if fr >= FREQ_MIN and p[0].isalpha():
                epi.add(deacc(p[0].lower()))
    return sorted(epi | CURATED)

if __name__ == "__main__":
    epn = build()
    io.open(OUT, "w", encoding="utf-8", newline="").write(" ".join(epn))
    print(f"noms épicènes : {len(epn)} → {OUT}")
