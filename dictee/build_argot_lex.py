# -*- coding: utf-8 -*-
# Extrait un lexique d'ARGOT CONTEMPORAIN + ANGLICISMES depuis le Wiktionnaire FR (via kaikki.org, CC BY-SA)
# → dictee/argot_lex.tsv (mot<TAB>freq_milli<TAB>POS). Destiné à la WHITELIST du speller (l'extension vit sur
# Twitch/Discord = argot dense ; le speller FP=0 flaggerait « askip/bg/crush… » comme non-mots = faux positifs).
#
#   Émission COMPLÈTE voulue (Rem : « les types, les genres et tout ») : le TSV porte le POS (type) ; kaikki porte
#   aussi genre (senses[].tags masculine/feminine) + IPA (sounds[].ipa) + pluriels (forms) → phase 2 (genre→gdet-lex,
#   POS→tagger). Ici v1 = whitelist speller (POS inclus).
#
#   ⚠️ FILTRES ANTI-RÉGRESSION (règle Rem : « si on a des doublons mal orthographiés on les garde pas ») :
#     (1) ACCENTS RETIRÉS : jamais une forme = un mot ACCENTUÉ existant sans ses accents (« etre »=être, « besef »=bésef)
#         → masquerait la correction d'un typo dys ultra-courant (perte de recall).
#     (2) DOUBLON D'ORTHOGRAPHE : le Wiktionnaire marque ces variantes `alt-of` + alternative/obsolete/misspelling
#         (« blogguer » = *alternative form of bloguer*, « etre » = *obsolete spelling of être*) → EXCLUS.
#         MAIS on GARDE `alt-of` + `abbreviation` (« bg » = *abbreviation of beau gosse*, bjr, ajd) = abréviations
#         légitimes, PAS des fautes. (Un filtre edit-1 naïf a été essayé puis REJETÉ : il jetait askip→skip,
#         bg→bu, bjr→bar, crush→crash — des mots DIFFÉRENTS, pas des doublons. 120/146 tués pour rien.)
#     (3) COLLISION MESURÉE (COLLIDE) : mot d'argot observé comme FAUTE RÉELLE dans les corpus → l'ajouter
#         tuerait une correction qui marche aujourd'hui. Mesuré sur 185 364 paires (WiCoPaCo + GEC + dys) :
#         « lea » = 4/4 un typo pour la/les → jeté. Les 140 autres : ZÉRO collision réelle (le voisinage edit-1
#         d'un mot fréquent — 99/141 en ont un — est du risque THÉORIQUE, le corpus le réfute).
#
#   Usage : KAIKKI=/chemin/kaikki-fr.jsonl python3 dictee/build_argot_lex.py
#   (kaikki : télécharger l'extraction frwiktionary sur kaikki.org/frwiktionary — le dump EN/French marche aussi
#    mais rate le gaming pur : clutch/tryhard/noob/spawn/lag → à compléter par une petite liste curée.)
import os, sys, json, gzip, unicodedata, re, collections
HERE = os.path.dirname(__file__)
KAIKKI = os.environ.get('KAIKKI', os.path.join(HERE, '..', 'kaikki-fr.jsonl'))
SPELLER = os.path.join(HERE, '..', 'extension', 'assets', 'speller.tsv.gz')
OUT = os.path.join(HERE, 'argot_lex.tsv')
POSMAP = {'noun': 'N', 'adj': 'A', 'verb': 'V', 'adv': 'R', 'intj': 'I', 'name': 'N', 'pron': 'O'}
TIGHT = {'slang', 'internet', 'text-messaging', 'neologism'}   # tags SERRÉS (pas "informal"/"colloquial" = trop large)
COLLIDE = {'lea'}   # (3) collisions MESURÉES avec un vrai typo du corpus — voir l'en-tête

def deacc(s): return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def main():
    if not os.path.exists(KAIKKI):
        print(f"kaikki introuvable ({KAIKKI}) — voir kaikki.org/frwiktionary"); return 1
    have = set(); deacc_acc = set()
    for l in gzip.open(SPELLER, 'rt', encoding='utf-8'):
        w = l.split('\t', 1)[0].lower(); have.add(w)
        if deacc(w) != w: deacc_acc.add(deacc(w))          # squelettes déacc des mots accentués → anti-typo
    cand = {}; filtered = 0; dbl = 0; coll = 0
    for line in open(KAIKKI, encoding='utf-8'):
        try: e = json.loads(line)
        except Exception: continue
        w = e.get('word', '')
        if not re.fullmatch(r"[a-zàâäéèêëîïôöùûüçœ]{2,15}", w) or w in have: continue
        pos = POSMAP.get(e.get('pos', ''), '')
        if not pos: continue
        tagsets = [set(t.lower() for t in s.get('tags', [])) for s in e.get('senses', [])]
        if not any(t in TIGHT for ts in tagsets for t in ts): continue
        # (2) DOUBLON D'ORTHOGRAPHE : variante marquée alt-of + alternative/obsolete/misspelling → JETÉ (blogguer=bloguer,
        #     etre=être). MAIS alt-of + abbreviation = abréviation légitime → GARDÉE (bg=beau gosse, bjr, ajd).
        if any(('alt-of' in ts) and (ts & {'alternative', 'obsolete', 'misspelling'}) and ('abbreviation' not in ts) for ts in tagsets):
            dbl += 1; continue
        if deacc(w) == w and w in deacc_acc: filtered += 1; continue   # (1) accents retirés
        if w in COLLIDE: coll += 1; continue                           # (3) collision mesurée avec un typo réel
        cand.setdefault(w, pos)
    rows = sorted(cand.items())
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('# Argot/anglicismes contemporains — Wiktionnaire FR via kaikki.org (CC BY-SA). Whitelist speller : mot<TAB>freq_milli<TAB>POS.\n')
        f.write('# freq=1 (basse) : mot CONNU (plus flaggé non-mot) mais candidat de correction faible. Filtre anti-typo appliqué. RELIRE avant injection FP=0.\n')
        for w, p in rows: f.write(f'{w}\t1\t{p}\n')
    print(f"écrit {OUT} : {len(rows)} termes | jetés : {dbl} doublons d'orthographe (alt-of), {filtered} accents-retirés, {coll} collisions-typo-mesurées | POS : {dict(collections.Counter(p for _, p in rows))}")
    return 0

if __name__ == '__main__':
    sys.exit(main())
