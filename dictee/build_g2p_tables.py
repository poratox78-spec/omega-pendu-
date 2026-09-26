# -*- coding: utf-8 -*-
# Extrait les tables g2p (route SUBLEXICALE de la double voie) depuis l'app monolithique
# app/omega-pendu.html vers dictee/g2p_tables.json, pour que la décompo Python réutilise
# EXACTEMENT la même machinerie graphème→phonème que le moteur (briques AQUA-PHOTON v3,
# bloc _DECL2). Aucune réécriture des tables : on les recopie verbatim (doctrine §A2/A4).
#
# Constantes extraites : VOW (voyelles), NASAL, DBL (graphèmes doublés), SEG (segments
# multi-lettres), COND (table conditionnelle graphème→[phonème IPA, hésitation]), ENTSIL
# (verbes à -ent muet). Lancer : python3 dictee/build_g2p_tables.py
import os, re, json

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app', 'omega-pendu.html')
OUT = os.path.join(HERE, 'g2p_tables.json')


def main():
    if not os.path.exists(APP):
        print(f"[g2p] app introuvable : {APP}"); return 1
    # On NE charge PAS le 5 Mo dans un éditeur : lecture brute en script (méthode sanctionnée).
    with open(APP, encoding='utf-8') as f:
        src = f.read()
    # Repère le bloc _DECL2 (briques PHON) pour borner la recherche et éviter les faux positifs.
    a = src.find('var _DECL2')
    if a < 0:
        print("[g2p] bloc _DECL2 introuvable"); return 2
    # ⚠️ 25/09/2026 — fenêtre élargie : l ajout de RFIN (160 mots) a poussé la fin de la liste ENTSIL
    # au-delà des 20 Ko, et  ne trouvait plus son motif — le builder rendait des tables VIDES
    # en le DISANT. Le message a servi ; la fenêtre suit désormais la taille du bloc.
    blk = src[a:a + 40000]

    def grab(pattern, flags=0):
        m = re.search(pattern, blk, flags)
        if not m:
            raise SystemExit(f"[g2p] motif introuvable : {pattern[:40]}…")
        return m.group(1)

    vow = grab(r"const VOW='([^']*)'")
    nasal = json.loads(grab(r"const NASAL=new Set\((\[.*?\])\)", re.S).replace("'", '"'))
    dbl = json.loads(grab(r"const DBL=new Set\((\[.*?\])\)", re.S).replace("'", '"'))
    seg = json.loads(grab(r"const SEG=(\[.*?\])\.sort", re.S).replace("'", '"'))
    cond = json.loads(grab(r"const COND = (\{.*?\})\n", re.S))     # COND est déjà du JSON (guillemets doubles)
    entsil = json.loads(grab(r"const ENTSIL = new Set\((\[.*?\])\)", re.S).replace("'", '"'))
    # ⭐ 25/09/2026 — RFIN : les -er dont le r se PRONONCE (liste fermée). Extraite comme le reste,
    # pour que Python tienne la même liste que l'app sans qu'on la recopie à la main.
    rfin = json.loads(grab(r"const RFIN = new Set\((\[.*?\])\)", re.S).replace("'", '"'))
    epron = json.loads(grab(r"const EPRON = new Set\((\[.*?\])\)", re.S).replace("'", '"'))
    entambig = json.loads(grab(r"const ENTAMBIG = new Set\((\[.*?\])\)", re.S).replace("'", '"'))
    cfin = json.loads(grab(r"const CFIN_MUET = new Set\((\[.*?\])\)", re.S).replace("'", '"'))
    gfin = json.loads(grab(r"const GFIN_MUET = new Set\((\[.*?\])\)", re.S).replace("'", '"'))

    # SEG est trié par longueur décroissante dans l'app (maximal munch). On fige ce tri ici.
    seg = sorted(seg, key=lambda s: -len(s))
    tables = {'VOW': vow, 'NASAL': nasal, 'DBL': dbl, 'SEG': seg, 'COND': cond, 'ENTSIL': entsil,
              'RFIN': rfin, 'EPRON': epron, 'ENTAMBIG': entambig,
              'CFIN_MUET': cfin, 'GFIN_MUET': gfin}
    json.dump(tables, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f"[g2p] tables extraites de l'app → {OUT}")
    print(f"      VOW={len(vow)} car · NASAL={len(nasal)} · DBL={len(dbl)} · SEG={len(seg)} · "
          f"COND={len(cond)} graphèmes · ENTSIL={len(entsil)} verbes")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
