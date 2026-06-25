# -*- coding: utf-8 -*-
# CLÔTURE DE PARADIGME du bloc de conjugaison embarqué (app `vdc-lex` → puis extension).
#
# POURQUOI. Le sous-ensemble HF embarqué (cj.f = formes / cj.c = tables de lemmes) est filtré par fréquence :
# il garde « roule » (3s) mais pas toujours « roulent » (3p). Or la règle d'accord sujet-verbe se garde par
# AUTO-VÉRIFICATION : elle produit la forme accordée via cj.c puis vérifie svReads(suggestion) dans cj.f. Si la
# forme suggérée manque de cj.f, l'accord n'est JAMAIS proposé (« Les voitures roule » reste non corrigé) — un
# écart de couverture vs le probe Python (qui charge cgram_conj.json COMPLET). build_cgram.py fait désormais cette
# clôture à la génération ; ce script l'applique aux ARTEFACTS EN REPO sans le Lexique4.tsv (hors-repo), en tirant
# les lectures manquantes de dictee/cgram_conj.json (déjà dérivé, en repo). Idempotent.
#
#   python3 dictee/close_conj_paradigm.py [--check]
#     (défaut) complète le bloc vdc-lex de app/omega-pendu.html et réécrit le fichier.
#     --check  : ne modifie rien ; sort en erreur s'il reste des formes-suggestions non clôturées (garde CI).
#
# Données dérivées Lexique 4 → CC BY-SA 4.0 (voir NOTICE).
import os, re, json, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app', 'omega-pendu.html')
CONJ = os.path.join(HERE, 'cgram_conj.json')
HF_TENSES = {'ind:pre', 'ind:imp'}   # temps embarqués (cf. build_cgram.py)


def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def closure_additions(cjf, cjc, full_f):
    """Formes-suggestions de cjc absentes de cjf, avec lectures (HF_TENSES) tirées de full_f. -> dict {forme: lectures}."""
    add = {}
    for mts in cjc.values():
        for slots in mts.values():
            for form in slots.values():
                fw = deacc(form.lower())
                if fw in cjf or fw in add:
                    continue
                rs = full_f.get(fw)
                if not rs:
                    continue
                kept = sorted(r for r in rs.split('|') if r.split(';')[1] in HF_TENSES)
                if kept:
                    add[fw] = '|'.join(kept)
    return add


def main(argv):
    check = '--check' in argv
    html = open(APP, encoding='utf-8').read()
    m = re.search(r'(<script type="application/json" id="vdc-lex">)(.*?)(</script>)', html, re.S)
    if not m:
        print('bloc vdc-lex introuvable dans l\'app'); return 2
    vdc = json.loads(m.group(2))
    full = json.load(open(CONJ, encoding='utf-8'))
    cj = vdc.get('cj') or {}
    cjf, cjc = cj.get('f') or {}, cj.get('c') or {}
    add = closure_additions(cjf, cjc, full.get('f') or {})

    if check:
        if add:
            print(f'[close_conj] NON CLÔTURÉ : {len(add)} forme(s)-suggestion absente(s) de cj.f (ex. {sorted(add)[:5]}).')
            return 1
        print('[close_conj] OK — paradigme clôturé (aucune forme-suggestion manquante).')
        return 0

    if not add:
        print('[close_conj] déjà clôturé — rien à faire.'); return 0
    cjf.update(add)
    cj['f'] = cjf
    vdc['cj'] = cj
    new_block = json.dumps(vdc, ensure_ascii=False, separators=(',', ':'))
    html2 = html[:m.start(2)] + new_block + html[m.end(2):]
    open(APP, 'w', encoding='utf-8').write(html2)
    print(f'[close_conj] +{len(add)} formes ajoutées à cj.f (clôture) ; cj.f : {len(cjf) - len(add)} → {len(cjf)}.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
