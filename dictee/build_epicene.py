# -*- coding: utf-8 -*-
"""Dérive la LISTE CLOSE des adjectifs ÉPICÈNES (invariables en GENRE) depuis
Lexique4 (CC BY-SA). Le -s pluriel est MUET → l'accord de NOMBRE (X→Xs) préserve
le son (doctrine d'audibilité) ; le genre (sales→salées) CHANGE le son → hors scope.

Critère = marqueur canonique Lexique **genre == 'e'** (épicène : masc=fém), forme
singulière en -e, fréquence lemme ≥ 0.05, MOINS couleurs invariables + 3 collisions
mesurées. On N'utilise PAS l'heuristique « forme sing unique » (elle fuit les
féminins comme « affreuse » quand le masculin « affreux » est tagué NOM en 5_Cgram).
UNION avec la liste hand-vérifiée d'origine (comble les épicènes que Lexique marque
'm' seul, ex. « fiable »).

Sortie : chaîne d'espaces DÉACCENTUÉE triée → miroir exact injecté dans les 3
moteurs et consommée par rule_adj_number / rAdjNumber. FP=0 vérifié sur les DEUX
bancs (fp_scale_full 14450 + fp_scale_probe 2500).
Usage : python dictee/build_epicene.py  → écrit dictee/epicene_adj.txt
"""
import unicodedata, io, lzma, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX_XZ = os.path.join(ROOT, "Lexique4.tsv.xz")
OUT = os.path.join(ROOT, "dictee", "epicene_adj.txt")
def deacc(s): return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
INVAR_COLOR = set("creme marine saumon emeraude turquoise kaki bordeaux ivoire ebene moutarde brique ocre indigo azur cerise framboise lavande prune olive caramel chocolat noisette paille sable bronze cuivre acajou corail grenat aubergine abricot peche citron lilas anthracite ardoise taupe champagne rouille safran pistache amande menthe crevette nacre perle".split())
EXCLUDE = set("meme historique celeste".split())
# liste hand-vérifiée d'origine (épicènes que Lexique peut marquer 'm' seul → à préserver)
HAND = "acceptable admirable adorable agreable aimable alimentaire atroce bizarre capable celebre comparable complementaire comprehensible confortable considerable convenable coriace coupable credible dense desagreable difficile digne disponible drole durable efficace effroyable enorme epouvantable facile faible fantastique favorable feroce fiable fidele formidable fragile honnete honorable horrible humide imaginaire immense immobile impeccable impossible imprevisible improbable inacceptable incapable incroyable indisponible inevitable insensible insupportable intense intime inutile invincible invisible involontaire irresistible irresponsable jeune lamentable magnifique malhonnete mince miserable mobile modeste obligatoire ordinaire paisible pitoyable populaire possible preferable previsible prioritaire probable rapide rare redoutable reglementaire remarquable respectable responsable riche robuste scolaire secondaire semblable sensible similaire simple sincere sobre sociable solaire solide spectaculaire splendide sublime superbe supplementaire susceptible tenace terrible timide tranquille ultime unique universitaire utile valable vaste veritable visible volontaire vulnerable".split()
def build():
    freqE = {}
    with lzma.open(LEX_XZ, mode="rt", encoding="utf-8") as f:
        for ln in f:
            p = ln.rstrip("\n").split("\t")
            if len(p) < 12 or p[4] != "ADJ": continue
            mot, genre, nombre = p[0].lower(), p[6], p[7]  # 7_Genre=p[6], 8_Nombre=p[7]
            if genre != "e" or nombre not in ("s", ""): continue
            if not mot.endswith("e") or any(c in mot for c in "'- "): continue
            try: fl = float(p[11].replace(",", "."))
            except ValueError: fl = 0.0
            d = deacc(mot); freqE[d] = max(freqE.get(d, 0.0), fl)
    epi = {d for d, fl in freqE.items() if fl >= 0.05}
    epi |= set(HAND)                       # union : combler les gaps Lexique
    epi -= INVAR_COLOR; epi -= EXCLUDE
    return sorted(w for w in epi if w)
if __name__ == "__main__":
    epi = build()
    io.open(OUT, "w", encoding="utf-8", newline="").write(" ".join(epi))
    print(f"épicène : {len(epi)} adjectifs → {OUT}")
