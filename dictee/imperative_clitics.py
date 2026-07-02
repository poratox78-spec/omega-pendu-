# -*- coding: utf-8 -*-
# MOVER SYNTAXIQUE de l'IMPÉRATIF — placement des pronoms clitiques (classe fermée, ordre déterministe).
# Corrige les fautes de PLACEMENT que les règles token-à-token ne peuvent pas faire (déplacement/réordre) :
#   négatif   : « ne donne-moi pas »→« ne me donne pas »           (pronom revient devant le verbe)
#   réordre   : « donne-moi-le »→« donne-le-moi »                  (COD avant COI)
#   élision   : « va-te-en »→« va-t'en », « donne-me-en »→« donne-m'en »
#   trait-d'union manquant (ancré sur moi/toi = jamais article) : « donne moi »→« donne-moi »
#   proclitique me/te (jamais sujet) : « me passe le sel »→« passe-moi le sel »
# FP≈0 (scan UD 14450). MUR laissé de côté : nous/vous/lui frontés (sujet/article) — ambiguïté sémantique.
# moves(text, isverb) -> [(start_char, end_char, replacement, name)] triés, sans chevauchement.
import re

VOW = re.compile(r"[aeiouyàâäéèêëîïôöùûüh]", re.I)
COD3 = {'le', 'la', 'les'}
COI3 = {'lui', 'leur'}
ADVP = {'en', 'y'}
WEAK = {'me', 'te', 'se', 'nous', 'vous'}
NEG2 = ('pas', 'plus', 'jamais', 'rien', 'point')
_NOTIMP = {'a', 'as', 'ai', 'ont', 'est', 'es', 'sont', 'fut', 'eut', 'aura', 'sera'}   # homographes non-impératifs (à/a, aux…)
CLI = (r"(?:t'en|m'en|s'en|t'y|m'y|m'|t'|s'|l'|me|te|se|nous|vous|moi|toi|lui|leur|les|le|la|en|y)")


def _deacc(s):
    return (s.replace('œ', 'oe').replace('æ', 'ae')
            .translate(str.maketrans('àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ', 'aaaeeeeiioouuucAAAEEEEIIOOUUUC')))


def _cap(orig, new):
    return new[0].upper() + new[1:] if orig[:1].isupper() else new


def _unapos(p):
    m = re.match(r"^([mts])'(en|y)$", p.lower())
    if m:
        return [{'m': 'me', 't': 'te', 's': 'se'}[m.group(1)], m.group(2)]
    return [p]


def _aff_key(p):
    p = p.lower()
    return 0 if p in COD3 else 2 if p in ADVP else 1


def _build_aff(verb, pros):
    ps = sorted([p.lower() for p in pros], key=_aff_key)
    norm = []
    for i, p in enumerate(ps):
        nx = ps[i + 1] if i + 1 < len(ps) else None
        if p == 'me':
            p = "m'" if nx in ADVP else 'moi'
        elif p == 'te':
            p = "t'" if nx in ADVP else 'toi'
        norm.append(p)
    out = verb
    for i, p in enumerate(norm):
        out += p if (i > 0 and norm[i - 1].endswith("'")) else '-' + p
    return out


def _neg_key(p):
    p = p.lower()
    return 0 if p in WEAK else 1 if p in COD3 else 2 if p in COI3 else 3 if p == 'y' else 4


def _build_neg(pros, verb, neg2):
    ps = sorted(['me' if p == 'moi' else 'te' if p == 'toi' else p.lower() for p in pros], key=_neg_key)
    seq = ps + [verb]
    res = []
    for i, t in enumerate(seq):
        nx = seq[i + 1] if i + 1 < len(seq) else None
        l = t.lower()
        res.append(l[0] + "'" if (nx and VOW.match(_deacc(nx[0])) and l in ('me', 'te', 'se', 'le', 'la')) else t)
    ne = "n'" if VOW.match(_deacc(res[0][0])) else "ne"
    s = ne
    for t in res:
        s += t if s.endswith("'") else ' ' + t
    return s + ' ' + neg2


def moves(text, isverb):
    """Renvoie les corrections de placement clitique de l'impératif comme (start,end,replacement,name)."""
    out = []
    taken = [False] * (len(text) + 1)

    def free(a, b):
        return not any(taken[a:b])

    def mark(a, b):
        for k in range(a, b):
            taken[k] = True

    def add(m, repl, name):
        a, b = m.start(), m.end()
        if free(a, b) and repl != m.group(0):
            out.append((a, b, repl, name)); mark(a, b)

    q = '?' in text

    # 1) NÉGATIF : ne/n' verbe -pron(s) pas → ne pron(s) verbe pas   (sauf question = inversion sujet)
    if not q:
        for m in re.finditer(r"\b(?:[Nn]e\s+|[Nn]'\s*)([A-Za-zÀ-ÿ]+)((?:-" + CLI + r")+)\s+(" + "|".join(NEG2) + r")\b", text):
            verb, chain, neg2 = m.group(1), m.group(2), m.group(3)
            if not isverb(verb):
                continue
            pros = []
            for p in [x for x in chain.split('-') if x]:
                pros += _unapos(p)
            add(m, _cap(m.group(0), _build_neg(pros, verb, neg2)), 'impératif (pronom)')

    # 2) AFFIRMATIF hyphéné, 2+ clitiques : réordre / élision (donne-moi-le, va-te-en)
    for m in re.finditer(r"\b([A-Za-zÀ-ÿ]+)((?:-" + CLI + r"){2,3})(?![A-Za-zÀ-ÿ'])", text):
        verb, chain = m.group(1), m.group(2)
        if not isverb(verb):
            continue
        pros = []
        for p in [x for x in chain.split('-') if x]:
            pros += _unapos(p)
        add(m, _cap(m.group(0), _build_aff(verb, pros)), 'impératif (pronom)')

    # 3) AFFIRMATIF « verbe le/la/les moi/toi/lui » (espaces) → verbe-COD-COI  (le+moi = pronoms sûrs)
    for m in re.finditer(r"\b([A-Za-zÀ-ÿ]+)\s+(les|le|la)\s+(moi|toi|lui|nous)\b", text):
        verb = m.group(1)
        if not isverb(verb) or verb.lower().endswith('ant') or _deacc(verb.lower()) in _NOTIMP or len(_deacc(verb.lower())) < 3:
            continue
        add(m, _cap(m.group(0), _build_aff(verb, [m.group(2), m.group(3)])), 'impératif (pronom)')

    # 4) TRAIT D'UNION manquant, ancré sur moi/toi (jamais article) : (début) verbe moi/toi → verbe-moi
    #    span RESSERRÉ sur (verbe … pronom) — la frontière group1 sert juste de garde de position.
    for m in re.finditer(r"(^|[.!?…]\s+)([A-Za-zÀ-ÿ]+)\s+(moi|toi)\b(?![-'’]?\s*(?:même|meme))", text):
        verb = m.group(2)
        if not isverb(verb) or verb.lower().endswith('ant') or _deacc(verb.lower()) in _NOTIMP or len(_deacc(verb.lower())) < 3:
            continue
        a = m.start() + len(m.group(1)); b = m.end()
        repl = _cap(verb, verb + '-' + m.group(3).lower())
        if free(a, b) and repl != text[a:b]:
            out.append((a, b, repl, 'impératif (pronom)')); mark(a, b)

    # 5) PROCLITIQUE me/te fronté (jamais sujet) : (début) me/te verbe → verbe-moi/toi
    for m in re.finditer(r"(^|[.!?…]\s+)([Mm]e|[Tt]e)\s+([A-Za-zà-ÿ]+)\b", text):
        pron, verb = m.group(2).lower(), m.group(3)
        if not isverb(verb) or verb.lower().endswith('ant'):
            continue
        ton = 'moi' if pron == 'me' else 'toi'
        a = m.start() + len(m.group(1)); b = m.end()
        repl = _cap(m.group(2), verb + '-' + ton)
        if free(a, b) and repl != text[a:b]:
            out.append((a, b, repl, 'impératif (pronom)')); mark(a, b)

    out.sort()
    return out


def apply_moves(text, isverb):
    """Applique les corrections (pour tests) — renvoie le texte corrigé."""
    ms = moves(text, isverb)
    for a, b, repl, _ in reversed(ms):
        text = text[:a] + repl + text[b:]
    return text


if __name__ == '__main__':          # VERROU : la référence Python == dictee/imp_cases.json (== app/extension via imp_probe.js)
    import os, sys, json
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import correcteur_probe as C
    iv = lambda w: C.deacc(w.lower()) in C.VERB_LEX
    cases = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'imp_cases.json'), encoding='utf-8'))
    fails = []
    for bad, good in cases['transform']:
        got = apply_moves(bad, iv)
        if got != good:
            fails.append('TRANSFORM « %s » → attendu « %s » | obtenu « %s »' % (bad, good, got))
    for s in cases['nofire']:
        if moves(s, iv):
            fails.append('NO-FIRE « %s » a déclenché : %s' % (s, moves(s, iv)))
    if fails:
        print('mover impératif (Python) — ÉCHEC :')
        for f in fails:
            print('  ✗ ' + f)
        sys.exit(1)
    print('mover impératif (Python) — OK : %d corrections + %d no-fire (FP=0).' % (len(cases['transform']), len(cases['nofire'])))
