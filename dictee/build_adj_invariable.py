# -*- coding: utf-8 -*-
"""Complète les PAIRES DE GENRE des adjectifs à masculin INVARIABLE-EN-NOMBRE (-x :
heureux/heureuse, dangereux/dangereuse, nombreux/nombreuse, défectueux/défectueuse…).

BUG SOURCE (build_cgram.py) : le masculin -x est noté `nb='i'` (invariable : sing==pluriel)
dans Lexique4, or build_cgram ne garde que `nb in ('s','p')` → le masculin est jeté → la
paire genrée ne se forme jamais → ~500 adjectifs -eux ABSENTS d'ADJ_LEX (mesuré : 16755).

Pourquoi un PATCH chirurgical et pas un rebuild de build_cgram : les assets commités
(cgram_adj.json, cgram_hf.json) ont été bâtis depuis un Lexique ANTÉRIEUR ; un rebuild
complet traîne un delta de Lexique (participe-adjectifs teinté/organisé…) qui CASSE le
rouge (mesuré : banc 2500 40→41). Ce script AJOUTE seulement les paires -x manquantes aux
fichiers commités (idempotent, ne touche à rien d'autre) → rouge INCHANGÉ (mesuré 40/43).

Écarte les participes/homographes en -is/-us/-os (acquis/admis/surpris = champ de mines
FP dans la règle rouge rule_adj_epithet). Les -euse ainsi appariées nourrissent la
vigilance ORANGE genreAdjVig (#276) : « les dossiers dangereuse »→dangereux.

⭐ 14/10/2026 (liste n° 12, « des idées claires et précis » muet) — LE MÊME BUG pour les masculins en -s :
mauvais, gros, bas, frais, français, précis, gris, épais… (308 adjectifs, AUCUNE des deux formes dans la
table : « une robe gris », « une voiture français » étaient muets). Ajoutés SAUF quand la forme masculine est
AUSSI une forme verbale dans Lexique4 — c'est exactement le champ de mines des participes (compris, assis,
surpris, clos, inclus…), désormais repéré par la donnée et plus par la finale — et sauf trois emplois figés
invariables (exprès : « une lettre exprès » ; tiers ; tors). Le Lexique se lit en .xz (racine) OU en .tsv
(LEX4=… ou data_local/Lexique4.tsv).

Sortie : réécrit dictee/cgram_adj.json (Python) + le champ `a` de dictee/cgram_hf.json
(source de l'embed app/ext via inject_vdc + build_assets). Re-lancer inject_vdc.py +
extension/build_assets.py après. FP=0 rouge vérifié sur les 2 bancs.
Usage : python dictee/build_adj_invariable.py
"""
import os, io, json, lzma, sys, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX_XZ = os.path.join(ROOT, "Lexique4.tsv.xz")
LEX_TSV = os.environ.get("LEX4") or os.path.join(ROOT, "data_local", "Lexique4.tsv")
_STOP_S = {"expres", "tiers", "tors"}         # ⭐ 14/10/2026 : emplois figés invariables (« une lettre exprès »)
ADJ = os.path.join(ROOT, "dictee", "cgram_adj.json")
HF = os.path.join(ROOT, "dictee", "cgram_hf.json")
FREQ_MIN = 0.5
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from build_cgram import rang_adj   # même choix de forme que build_cgram

def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def invariable_pairs():
    sing, plur = defaultdict(dict), defaultdict(dict)
    verf = set()                                # ⭐ 14/10/2026 : formes VERBALES (participes compris/assis/clos…) → jamais appariées
    minv = set()                                # ⭐ 14/10/2026 : masculins notés « i » (le bug) — les paires régulières écartées par build_cgram restent écartées
    ouvrir = (lambda: lzma.open(LEX_XZ, mode="rt", encoding="utf-8")) if os.path.exists(LEX_XZ) else (lambda: io.open(LEX_TSV, encoding="utf-8"))
    with ouvrir() as f:
        for ln in f:
            p = ln.rstrip("\n").split("\t")
            if len(p) > 4 and p[4].startswith("VER"):
                verf.add(p[0].strip().lower())
            if len(p) < 12 or not p[4].startswith("ADJ"):
                continue
            g = p[6].strip().lower(); nb = (p[7].strip().lower()[:1] or '')
            lem = p[3].strip().lower(); mot = p[0].strip().lower()   # lemme ACCENTUÉ (ligne 143 : béat ≠ beat, fermé ≠ ferme)
            try: fr = float(p[11].replace(",", "."))
            except ValueError: fr = 0.0
            if fr < FREQ_MIN or g not in ("m", "f"):
                continue
            # ⭐ ligne 143 (23/10/2026) : la forme retenue suit rang_adj (build_cgram), pas la première lue — l'ordre des lignes de
            # Lexique décidait (« artério-veineuses », « médico-légaux » changeaient d'une Lexique réordonnée à l'autre)
            r = (rang_adj(mot, lem, g, 'p' if nb == 'i' else nb, fr), mot)
            garde = lambda d: d.__setitem__(g, min(d.get(g, r), r))
            if nb == 'i':                       # invariable -x : vaut sing ET pluriel
                if g == 'm': minv.add(mot)
                garde(sing[lem]); garde(plur[lem])
            elif nb == 's': garde(sing[lem])
            elif nb == 'p': garde(plur[lem])
    for bucket in (sing, plur):
        for d in bucket.values():
            for g in d: d[g] = d[g][1]
    cand = {}                                   # deacc(forme) -> {[genre, contrepartie accentuée]} : une seule réponse, ou écartée
    for lem in sorted(set(sing) | set(plur)):
        for bucket in (sing, plur):
            d = bucket.get(lem, {})
            if 'm' in d and 'f' in d and d['m'] != d['f']:
                m, f = d['m'], d['f']
                if m.endswith('x'):
                    pass                         # -x vrai adjectif
                elif m.endswith('s') and m in minv and m not in verf and deacc(m) not in _STOP_S:
                    pass                         # ⭐ 14/10/2026 : -s qui n'est pas une forme verbale (mauvais, gros, précis, français)
                else:
                    continue
                cand.setdefault(deacc(m), set()).add(('m', f))
                cand.setdefault(deacc(f), set()).add(('f', m))
    return {k: list(next(iter(v))) for k, v in cand.items() if len(v) == 1}

def main():
    pairs = invariable_pairs()
    adj = json.load(open(ADJ, encoding="utf-8"))
    hf = json.load(open(HF, encoding="utf-8"))
    a = hf.get("a", {})
    n_adj = n_hf = 0
    for k, v in pairs.items():
        if k not in adj: adj[k] = v; n_adj += 1
        if k not in a:   a[k] = v;   n_hf += 1
    io.open(ADJ, "w", encoding="utf-8", newline="").write(json.dumps(adj, ensure_ascii=False))
    io.open(HF, "w", encoding="utf-8", newline="").write(json.dumps(hf, ensure_ascii=False, separators=(",", ":")))   # COMPACT, comme le fichier commité (14/10/2026 : l'aéré pesait +1 Mo dans l'asset)
    print(f"paires -x/-s invariables : +{n_adj} → cgram_adj ({len(adj)}), +{n_hf} → cgram_hf.a ({len(a)})")

if __name__ == "__main__":
    main()
