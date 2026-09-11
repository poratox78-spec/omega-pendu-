# -*- coding: utf-8 -*-
"""La table de conjugaison COMMITTÉE porte enfin ce que le chargement réparait (chantier « INSTRUMENT : la table de conjugaison
committée a encore des trous que seul le chargement répare », 11/09/2026).

Mesuré le 08/09 : `ind:imp` 3e pluriel = 0 lemme sur 3 891 dans cgram_conj.json, passé simple 1re/2e/3e du pluriel = 0 — le produit
est correct parce que DEUX rustines s'exécutent au chargement, à l'identique dans les trois moteurs : `_fill_reg_3pl` / `_fillReg3pl`
(3e pluriel régulier de l'imparfait, du conditionnel et du futur, dérivé du 3e singulier : 5 717 cellules) et `_ps_completer` /
`_psCompleter` (passé simple pluriel dérivé du radical accentué, chaque forme validée par le lexique du produit). Toute lecture
DIRECTE du JSON — audit, sonde neuve, autre moteur — voyait donc un trou qui n'existe pas à l'exécution.

Ce script écrit dans les DEUX sources (dictee/cgram_conj.json = référence Python ; dictee/cgram_hf.json = embarqué app → extension
via inject_vdc.py puis build_assets.py) exactement ce que ces rustines produisent — en les APPELANT, pas en les réécrivant : la
donnée commitée devient la vérité, et les rustines deviennent des no-op vérifiés (elles ne touchent jamais une case déjà en table).
Sérialisation identique à build_cgram (compact, ensure_ascii=False) — l'aller-retour est vérifié octet à octet avant d'écrire.
    python3 dictee/bake_conj_table.py [--dir DOSSIER] [--dry]
"""
import io, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = HERE
DRY = '--dry' in sys.argv
if '--dir' in sys.argv: DIR = sys.argv[sys.argv.index('--dir') + 1]
sys.path.insert(0, HERE)
import correcteur_probe as C   # noqa: E402 — les rustines et le lexique du produit vivent là


def completer(c, f):
    """Applique les deux rustines de chargement à (c, f) et renvoie (cellules 3pl ajoutées, cellules passé simple ajoutées)."""
    avant = {lem: {mt: set(sl) for mt, sl in d.items()} for lem, d in c.items()}
    C._fill_reg_3pl(c, f)
    n3 = sum(1 for lem in c for mt in c[lem] for pn in c[lem][mt] if pn not in avant.get(lem, {}).get(mt, set()))
    avant2 = {lem: {mt: set(sl) for mt, sl in d.items()} for lem, d in c.items()}
    sauve = (C.CONJ_C, C._PS_DONE, dict(C._PS_INDEX))
    C.CONJ_C = c; C._PS_DONE = False; C._PS_INDEX.clear()
    try:
        C._ps_completer()
    finally:
        C.CONJ_C, C._PS_DONE = sauve[0], sauve[1]
        C._PS_INDEX.clear(); C._PS_INDEX.update(sauve[2])
    nps = sum(1 for lem in c for mt in c[lem] for pn in c[lem][mt] if pn not in avant2.get(lem, {}).get(mt, set()))
    return n3, nps


def main():
    for fn in ('cgram_conj.json', 'cgram_hf.json'):
        p = os.path.join(DIR, fn)
        raw = io.open(p, encoding='utf-8', newline='').read()
        d = json.loads(raw)
        if json.dumps(d, ensure_ascii=False, separators=(',', ':')) != raw:
            raise SystemExit('%s : la sérialisation ne rend pas les mêmes octets — on ne réécrit pas un fichier qu on ne sait pas reproduire' % fn)
        cj = d if fn == 'cgram_conj.json' else d.get('cj', {})
        n3, nps = completer(cj.get('c', {}), cj.get('f', {}))
        out = json.dumps(d, ensure_ascii=False, separators=(',', ':'))
        change = out != raw
        print('%-16s 3e pluriel régulier : +%d cellule(s) · passé simple pluriel : +%d cellule(s) · %s%s' % (
            fn, n3, nps, 'modifié' if change else 'déjà complet', ' (dry)' if DRY else ''))
        if change and not DRY:
            io.open(p, 'w', encoding='utf-8', newline='').write(out)
    if not DRY:
        print('→ relancer : python3 dictee/inject_vdc.py && python3 extension/build_assets.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
