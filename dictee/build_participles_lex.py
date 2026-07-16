# -*- coding: utf-8 -*-
# Complète le speller avec les PARTICIPES ACCORDÉS (féminin/pluriel) attestés par le Wiktionnaire (kaikki, CC BY-SA)
# dont le masculin -é est DÉJÀ dans le speller. → dictee/participle_rows.tsv (schéma Lexique4 37 col, comme
# argot_rows.tsv) → même pipeline d'injection : cat Lexique4 wikt_lex_fr argot_rows participle_rows > aug ...
#
#   POURQUOI (mesuré 2026-07-16 sur le corpus dys RÉEL de Rem) : « les cases dallées du couloir » → le correcteur
#   coupait « dallées » en « d'allées ». Cause : « dallé » est dans le speller mais PAS ses accords « dallée/dallés/
#   dallées » (ni Lexique4, ni notre extraction Wiktionnaire — build_wikt_lex.py écarte TOUTES les flexions verbales).
#   Le mot valide inconnu déclenche la règle d'élision inversée (rDeselide) → faux positif sur un mot CORRECT, la
#   pire faute pour un outil dys. Rendre ces participes CONNUS tue la classe entière (rDeselide ne tire pas sur un
#   mot connu). Le kaikki les étiquette proprement : tags ['feminine','form-of','participle',...] + form_of=<lemme -é>.
#
#   BORNÉ + DEPUIS LA SOURCE (doctrine Rem « compléter TOUS les lexiques vs Lexique, pas patcher mot par mot ») :
#   on n'ajoute QUE la forme accordée dont le masculin -é est déjà présent — on complète l'existant, on n'invente
#   pas de participe. Gardes identiques à l'argot : collision mesurée avec un vrai typo du corpus → jetée.
#
#   Usage : KAIKKI=/chemin/kaikki-fr.jsonl python3 dictee/build_participles_lex.py
import os, sys, json, gzip, re, unicodedata, collections

HERE = os.path.dirname(__file__)
KAIKKI = os.environ.get('KAIKKI', os.path.join(HERE, '..', 'kaikki-fr.jsonl'))
SPELLER = os.path.join(HERE, '..', 'extension', 'assets', 'speller.tsv.gz')
OUT_L4 = os.path.join(HERE, 'participle_rows.tsv')
NC = 37
CI = {'Mot': 0, 'Phono_IPA': 2, 'Lemme': 3, 'Cgram': 4, 'CgramOrtho': 5, 'Genre': 6, 'Nombre': 7,
      'FreqMot': 9, 'FreqOrtho': 10, 'FreqLemme': 11}
FLOOR = '0.05'   # plancher : passe MINFREQ du speller sans jamais dominer un vrai mot comme candidat

# collisions MESURÉES avec un vrai typo des corpus dys/GEC (comme l'argot) — remplies après mesure, vide sinon
COLLIDE = {'abjurés', 'arrogée', 'bisées', 'bitumée', 'béées', 'capacitée', 'capacitées', 'cloitrées', 'cohabitées', 'consistée', 'designées', 'débandée', 'dénommées', 'déparés', 'engravées', 'figurées', 'giclés', 'interjetées', 'jalonnées', 'mensualisés', 'migrées', 'musés', 'mâtées', 'perdurés', 'persistées', 'phagocytés', 'procédées', 'prospérée', 'préfigurée', 'périclitée', 'randonnés', 'repétée', 'repétées', 'ricochée', 'régressée', 'réimprimées', 'résistées', 'révolutionnés', 'sombrées', 'soupoudrées', 'subsistée', 'taggées', 'tetées', 'tremblés'}


def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def main():
    if not os.path.exists(KAIKKI):
        print(f"kaikki introuvable ({KAIKKI}) — voir kaikki.org/frwiktionary"); return 1
    have = set(l.split('\t', 1)[0] for l in gzip.open(SPELLER, 'rt', encoding='utf-8'))

    rows = {}   # forme -> (genre, nombre, lemme)
    coll = 0
    for line in open(KAIKKI, encoding='utf-8'):
        if 'participle' not in line:
            continue
        try:
            e = json.loads(line)
        except Exception:
            continue
        w = e.get('word', '')
        if not (w.endswith('ée') or w.endswith('és') or w.endswith('ées')):
            continue
        if w in have:                                   # déjà connu → rien à faire
            continue
        for s in e.get('senses', []):
            ts = set(s.get('tags', []))
            if 'participle' not in ts or 'form-of' not in ts:
                continue
            fo = s.get('form_of') or []
            lem = fo[0].get('word', '') if fo else ''
            if not lem.endswith('é') or lem not in have:  # complète l'EXISTANT (masculin -é présent)
                continue
            if w in COLLIDE:
                coll += 1
                break
            g = 'f' if 'feminine' in ts else ('m' if 'masculine' in ts else '')
            nb = 'p' if 'plural' in ts else ('s' if 'singular' in ts else '')
            rows[w] = (g, nb, lem)
            break

    with open(OUT_L4, 'w', encoding='utf-8', newline='') as f:
        for w, (g, nb, lem) in sorted(rows.items()):
            row = [''] * NC
            row[CI['Mot']] = w; row[CI['Lemme']] = lem
            row[CI['Cgram']] = 'VER'; row[CI['CgramOrtho']] = 'VER'   # participe (comme le masculin -é dans le speller)
            row[CI['Genre']] = g; row[CI['Nombre']] = nb
            row[CI['FreqMot']] = FLOOR; row[CI['FreqOrtho']] = FLOOR; row[CI['FreqLemme']] = FLOOR
            f.write('\t'.join(row) + '\r\n')
    ng = sum(1 for v in rows.values() if v[0])
    print(f"écrit {OUT_L4} : {len(rows)} participes accordés (genre : {ng}) | collisions-typo jetées : {coll}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
