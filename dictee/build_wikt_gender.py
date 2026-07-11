# -*- coding: utf-8 -*-
# Fusion CHIRURGICALE du genre Wiktionnaire dans les artefacts committés — SANS régénérer la conjugaison.
# Ajoute les noms PURS genrés de dictee/wikt_lex_fr.tsv (POS-set={NOM}, genre net) :
#   - à cgram_hf.json['gn'] (GENDER_PURE : règle genre déterminant)  → embarqué vdc-lex
#   - à cgram_noun_post.json ([1000,0] = nom pur confiant)            → embarqué noun-post-gz (gate §3 des règles genre/pluriel)
# Discipline FP=0 (comme build_cgram) : jamais un mot qui est verbe/adj (hf['v']/hf['a']) ni un genre en conflit.
# Les mots wikt étant ABSENTS de Lexique (garde du speller), ils n'entrent en collision avec aucun verbe/adj Lexique.
#   python3 dictee/build_wikt_gender.py     # met à jour cgram_hf.json + cgram_noun_post.json (puis inject_vdc + inject_noun_post)
import os, json, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
HF = os.path.join(HERE, 'cgram_hf.json')
NP = os.path.join(HERE, 'cgram_noun_post.json')
WK = os.path.join(HERE, 'wikt_lex_fr.tsv')

def deacc(s):
    s = s.replace('œ', 'oe').replace('æ', 'ae')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def main():
    hf = json.load(open(HF, encoding='utf-8'))
    np = json.load(open(NP, encoding='utf-8'))
    gn = hf['gn']; verbs = set(hf.get('v', [])); adj = set(hf.get('a', {}))
    # genres wikt pur-nom (col0=Mot, col4=Cgram, col6=Genre) — agrège, écarte l'ambigu
    wg = {}; amb = set()
    for ln in open(WK, encoding='utf-8'):
        c = ln.rstrip('\n').split('\t')
        if len(c) > 6 and c[4] == 'NOM' and c[6] in ('m', 'f'):
            dw = deacc(c[0].lower())
            if dw in wg and wg[dw] != c[6]: amb.add(dw)
            wg[dw] = c[6]
    for dw in amb: wg.pop(dw, None)
    add_gn = add_np = skip = 0
    for dw, g in sorted(wg.items()):
        if dw in verbs or dw in adj:                 # homographe verbe/adj Lexique → abstention (FP-safe)
            skip += 1; continue
        if dw in gn and gn[dw] != g:                 # conflit avec un genre déjà attesté → garde le committé
            skip += 1; continue
        if dw not in gn:
            gn[dw] = g; add_gn += 1
        if dw not in np:
            np[dw] = [1000, 0]; add_np += 1          # nom pur confiant (gate §3)
    json.dump(hf, open(HF, 'w', encoding='utf-8', newline=''), ensure_ascii=False, separators=(',', ':'))
    json.dump(np, open(NP, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    print(f"[wikt-gender] +{add_gn} genres → gn ({len(gn)}) · +{add_np} noms → noun_post ({len(np)}) · {skip} écartés (homographe/conflit) · {len(amb)} ambigus")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
