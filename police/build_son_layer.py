# -*- coding: utf-8 -*-
"""Police de son — pont g2p RÉEL → couche de rendu (police/son_layer.json).

Principe cardinal : LE TEXTE NE CHANGE JAMAIS. On ne substitue aucun caractère
(les PUA de la v0.1 sont dépréciés pour le web : un copier-coller donnerait du
texte cassé). La sortie est une liste de segments {g, ph, cls} par mot, que la
démo rend en <span> avec la même police en 3 graisses :
  cls 'voi'  → OMEGA Dys Heavy  (obstruente VOISÉE   : b d g v z Z)
  cls 'srd'  → OMEGA Dys Light  (obstruente SOURDE   : p t k f s S)
  cls 'mute' → gris (lettre non prononcée)
  cls 'n'    → OMEGA Dys (neutre)
Réutilise dictee/decompose.py (double voie : phono lexicale, alignement sublexical).

Usage : python police/build_son_layer.py
"""
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'dictee'))
from decompose import decompose  # noqa: E402

SENTENCES = [
    "Le poison et le poisson ne se ressemblent pas.",
    "Les petits chats blancs jouent dans le jardin.",
    "Papa porte un gâteau et des bonbons doux.",
    "La vache et le cheval broutent derrière la barrière.",
]

VOICED_PH = set('bdgvzZ')     # SAMPA : obstruentes voisées
UNVOICED_PH = set('ptkfsS')   # SAMPA : obstruentes sourdes
# (le contournement DBL_FIX a été RETIRÉ : le bug DBL→∅ du moteur est corrigé
#  à la source — decompose.g2p consulte COND[g] — et re-mesuré : held-out 55,20 % exact,
#  90,46 % phonémique, au-dessus de la baseline 52,4/89,5.)

TOKEN = re.compile(r"[a-zà-ÿœ']+", re.IGNORECASE)

# Mots-fonction (classe fermée) : le g2p sublexical les aligne mal (e final « muet »
# appliqué au schwa prononcé, correction apprise s|e→z fausse en initiale). Table
# explicite — pratique standard, PAS une rustine cachée (auditée ci-dessous).
CLIT = {
    'le': [('l', 'l'), ('e', '°')], 'la': [('l', 'l'), ('a', 'a')],
    'les': [('l', 'l'), ('e', 'e'), ('s', '')],
    'se': [('s', 's'), ('e', '°')], 'ne': [('n', 'n'), ('e', '°')],
    'de': [('d', 'd'), ('e', '°')], 'des': [('d', 'd'), ('e', 'e'), ('s', '')],
    'me': [('m', 'm'), ('e', '°')], 'te': [('t', 't'), ('e', '°')],
    'ce': [('c', 's'), ('e', '°')], 'je': [('j', 'Z'), ('e', '°')],
    'que': [('qu', 'k'), ('e', '°')], 'du': [('d', 'd'), ('u', 'y')],
    'un': [('un', '1')], 'une': [('u', 'y'), ('n', 'n'), ('e', '')],
}


def classify(ph):
    if not ph:
        return 'mute'
    c = ph[0]
    if c in VOICED_PH:
        return 'voi'
    if c in UNVOICED_PH:
        return 'srd'
    return 'n'


def _recase(word, pairs):
    """Reprojette les graphèmes (minuscules) sur le mot ORIGINAL (casse préservée) :
    le texte affiché doit être exactement le texte d'entrée. FAIL-SAFE (parité son_core.js) :
    si l'alignement ne couvre pas le mot (apostrophe, tiret…), UN segment neutre = texte intact."""
    out, pos, lw = [], 0, word.lower()
    if ''.join(g for g, _ in pairs) != lw:
        return None                                      # → segment neutre unique chez l'appelant
    for g, ph in pairs:
        out.append((word[pos:pos + len(g)], ph))
        pos += len(g)
    return out


def word_segments(word):
    lw = word.lower()
    if lw in CLIT:
        pairs, phono, src = CLIT[lw], ''.join(p for _, p in CLIT[lw]), 'clit'
    else:
        rec = decompose(word)
        pairs, n = [], len(rec['alignement'])
        for k, gp in enumerate(rec['alignement']):
            g, ph = gp['g'], gp['ph']
            pairs.append((g, ph))
        phono, src = rec['phono'], rec['src_phon']
    pairs = _recase(word, pairs)
    if pairs is None:                                    # fail-safe : mot entier, classe neutre
        segs = [{'g': word, 'ph': phono, 'cls': 'n'}]
    else:
        segs = [{'g': g, 'ph': ph, 'cls': classify(ph)} for g, ph in pairs]
    return {'mot': word, 'phono': phono, 'src': src, 'segs': segs}


def sentence_layer(sentence):
    out, i = [], 0
    for m in TOKEN.finditer(sentence):
        if m.start() > i:
            out.append({'raw': sentence[i:m.start()]})
        out.append(word_segments(m.group(0)))
        i = m.end()
    if i < len(sentence):
        out.append({'raw': sentence[i:]})
    rebuilt = ''.join(m['raw'] if 'raw' in m else ''.join(s['g'] for s in m['segs']) for m in out)
    if rebuilt != sentence:                               # garantie cardinale : texte JAMAIS modifié
        raise AssertionError('texte altéré : %r != %r' % (rebuilt, sentence))
    return {'texte': sentence, 'mots': out}


def main():
    layer = [sentence_layer(s) for s in SENTENCES]
    out = os.path.join(HERE, 'son_layer.json')
    with io.open(out, 'w', encoding='utf-8') as f:
        json.dump(layer, f, ensure_ascii=False, indent=1)
    nseg = sum(len(m.get('segs', [])) for s in layer for m in s['mots'])
    print('OK ->', out, '(%d phrases, %d segments)' % (len(layer), nseg))
    for s in layer:                                       # audit lisible
        bits = []
        for m in s['mots']:
            if 'raw' in m:
                continue
            bits.append(''.join('[%s:%s]' % (x['g'], x['cls']) if x['cls'] != 'n' else x['g']
                                for x in m['segs']))
        print(' ', ' '.join(bits))


if __name__ == '__main__':
    main()
