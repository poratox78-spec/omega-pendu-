# -*- coding: utf-8 -*-
# Extrait un lexique d'ARGOT CONTEMPORAIN + ANGLICISMES depuis le Wiktionnaire FR (via kaikki.org, CC BY-SA)
# → dictee/argot_lex.tsv (mot<TAB>freq_milli<TAB>POS). Destiné à la WHITELIST du speller (l'extension vit sur
# Twitch/Discord = argot dense ; le speller FP=0 flaggerait « askip/bg/crush… » comme non-mots = faux positifs).
#
#   Émission COMPLÈTE voulue (Rem : « les types, les genres et tout ») : le TSV porte le POS (type) ; kaikki porte
#   aussi genre (senses[].tags masculine/feminine) + IPA (sounds[].ipa) + pluriels (forms) → phase 2 (genre→gdet-lex,
#   POS→tagger). Ici v1 = whitelist speller (POS inclus).
#
#   ⚠️ FILTRE ANTI-TYPO OBLIGATOIRE : ne JAMAIS whitelister une forme = un mot ACCENTUÉ existant privé de ses accents
#   (« etre »=« être », « besef »=« bésef ») → ça masquerait la correction d'un vrai typo dys (perte de recall).
#   Reste un risque edit-1 résiduel (coto/doss/dîn…) → RELIRE la liste avant d'injecter dans le lexique FP=0.
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

def deacc(s): return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def main():
    if not os.path.exists(KAIKKI):
        print(f"kaikki introuvable ({KAIKKI}) — voir kaikki.org/frwiktionary"); return 1
    have = set(); deacc_acc = set()
    for l in gzip.open(SPELLER, 'rt', encoding='utf-8'):
        w = l.split('\t', 1)[0].lower(); have.add(w)
        if deacc(w) != w: deacc_acc.add(deacc(w))          # squelettes déacc des mots accentués → anti-typo
    cand = {}; filtered = 0
    for line in open(KAIKKI, encoding='utf-8'):
        try: e = json.loads(line)
        except Exception: continue
        w = e.get('word', '')
        if not re.fullmatch(r"[a-zàâäéèêëîïôöùûüçœ]{2,15}", w) or w in have: continue
        pos = POSMAP.get(e.get('pos', ''), '')
        if not pos: continue
        if not any(t.lower() in TIGHT for s in e.get('senses', []) for t in s.get('tags', [])): continue
        if deacc(w) == w and w in deacc_acc: filtered += 1; continue   # FILTRE ANTI-TYPO
        cand.setdefault(w, pos)
    rows = sorted(cand.items())
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('# Argot/anglicismes contemporains — Wiktionnaire FR via kaikki.org (CC BY-SA). Whitelist speller : mot<TAB>freq_milli<TAB>POS.\n')
        f.write('# freq=1 (basse) : mot CONNU (plus flaggé non-mot) mais candidat de correction faible. Filtre anti-typo appliqué. RELIRE avant injection FP=0.\n')
        for w, p in rows: f.write(f'{w}\t1\t{p}\n')
    print(f"écrit {OUT} : {len(rows)} termes (filtrés anti-typo : {filtered}) | POS : {dict(collections.Counter(p for _, p in rows))}")
    return 0

if __name__ == '__main__':
    sys.exit(main())
