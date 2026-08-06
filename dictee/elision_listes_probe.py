# -*- coding: utf-8 -*-
u"""LA CHASSE SYSTÉMATIQUE AUX LISTES FERMÉES AVEUGLES À L'ÉLISION.

POURQUOI CETTE SONDE EXISTE. En une seule journée, la même famille de bug est sortie TROIS fois :
  · `estQue` dans les règles de virgule — « Alors qu'il se baladait » recevait une virgule ;
  · `_NP_BREAK` dans le parseur de sujet — la coupure de relative ne coupait RIEN ;
  · le marqueur fusionné dans le verbe — « qu'offrent » n'était jamais vu.
La cause est toujours la même : **`toks` ne sépare pas l'élision**. « qu'offrent » est UN token.
Toute liste fermée testée par ÉGALITÉ de token (`dj in LISTE`, `LISTE[dj]`) est donc AVEUGLE à
la forme élidée de ses propres membres — silencieusement, sans jamais lever d'erreur.
Trois occurrences ne sont pas une coïncidence : c'est une classe. On la cherche en entier.

⚠️ CE QUI EXISTE DÉJÀ, VÉRIFIÉ : `dictee/elision_probe.js` (en CI) mesure le RAPPEL PERDU sur
« l'X » face à « cet/cette X ». C'est un différentiel de CORRECTIONS MANQUÉES sur un seul
préfixe. Ce n'est pas la même question : ici on cherche des GARDES INERTES, sur tous les
préfixes, et on veut l'INVENTAIRE des listes concernées.

DEUX PASSES, et la seconde est celle qui décide :

  ① INVENTAIRE STATIQUE — quelles listes fermées, dans les 3 moteurs, contiennent un mot qui
    s'élide ? Et sont-elles testées par égalité seule ? Ça donne la carte, pas le prix.

  ② LE PRIX, MESURÉ D'UN SEUL COUP. Plutôt que corriger chaque liste puis mesurer, on rend le
    mot-outil VISIBLE au moteur — « qu'offrent » -> « que offrent », « d'un » -> « de un » — et on
    regarde si ses décisions CHANGENT. Une différence signifie que la décision dépendait du fait
    que le mot-outil était CACHÉ dans le token : c'est exactement la cécité qu'on cherche, et la
    somme des différences est le BUDGET TOTAL de la famille sur tout le moteur.
    ⚠️ Les formes développées ne sont pas du français correct (« que offrent ») — ce n'est pas le
    sujet : le LEXÈME est le même, seule sa VISIBILITÉ change. On ne mesure pas la grammaticalité,
    on mesure ce que le moteur perd à ne pas voir.
    ⚠️ « l' » est EXCLU : il est vraiment ambigu (le/la) et il a déjà sa primitive dédiée
    (`_ELID_DET`) plus sa sonde en CI. L'inclure mélangerait deux problèmes.

    python dictee/elision_listes_probe.py
"""
import os, re, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import correcteur_probe as C

UD = os.path.join(RACINE, 'data_local', 'ud_fr_gsd-train.conllu')

# Les mots-outils qui s'élident, et leur forme élidée. `le`/`la` sont à part (voir en-tête).
ELIDABLES = {
    "qu'": 'que', "d'": 'de', "n'": 'ne', "j'": 'je', "m'": 'me', "t'": 'te',
    "s'": 'se', "c'": 'ce', "jusqu'": 'jusque', "lorsqu'": 'lorsque',
    "puisqu'": 'puisque', "quoiqu'": 'quoique',
}
MOTS_ELIDABLES = set(ELIDABLES.values())


# ══ ① INVENTAIRE STATIQUE ═════════════════════════════════════════════════════════════════════
def listes_python(src):
    u"""Listes fermées Python : `NOM = {...}` (littéral) et `NOM = set('a b c'.split())`."""
    out = {}
    for m in re.finditer(r"^(_?[A-Z][A-Z0-9_]*)\s*=\s*(set\()?\{?'([^']*)'\.split\(\)\)?",
                         src, re.M):
        out[m.group(1)] = set(m.group(3).split())
    for m in re.finditer(r"^(_?[A-Z][A-Z0-9_]*)\s*=\s*\{([^}]*)\}", src, re.M):
        mots = set(re.findall(r"'([a-zà-ÿœ'\-]+)'", m.group(2)))
        if mots: out.setdefault(m.group(1), set()).update(mots)
    return out


def listes_js(src):
    u"""Listes fermées JS : `var NOM={};'a b c'.split(' ').forEach` et `new Set(('a b').split(' '))`."""
    out = {}
    for m in re.finditer(r"var\s+(_?[A-Za-z][A-Za-z0-9_]*)\s*=\s*\{\};\s*'([^']*)'\s*\.split", src):
        out[m.group(1)] = set(m.group(2).split())
    for m in re.finditer(r"var\s+(_?[A-Za-z][A-Za-z0-9_]*)\s*=\s*new Set\(\s*\('([^']*)'\)?\s*\.split", src):
        out[m.group(1)] = set(m.group(2).split())
    return out


def teste_le_prefixe(src, nom):
    u"""Le code fait-il, QUELQUE PART, un test de préfixe à côté de cette liste ? Heuristique
    volontairement large : on préfère un faux « couvert » à signaler qu'un vrai raté caché —
    l'inventaire sert à ORIENTER la passe ②, ce n'est pas lui qui conclut."""
    for m in re.finditer(re.escape(nom), src):
        fen = src[max(0, m.start() - 400): m.start() + 400]
        if re.search(r"startswith\(\"qu'|indexOf\(\"qu'|estQue|_ELID_DET|match\(r?\"?\^?\(?qu", fen):
            return True
    return False


def direction(src, nom):
    u"""⭐ LE CRITÈRE QUI DÉCIDE, et il sort de la mesure ② + ③ : réparer un angle mort d'élision
    est SÛR quand ça fait ABSTENIR le moteur, DANGEREUX quand ça fait DÉCLENCHER une règle.
    On regarde donc ce que le code fait quand la liste MATCHE : sortir (return/break/continue) =
    la liste est un GARDE-FOU, la rendre voyante ne peut que protéger davantage. Sinon la liste
    ALIMENTE une règle, et la rendre voyante ajoute des corrections — donc des FP.

    ⚠️ CETTE COLONNE N'EST FIABLE QUE SUR LE MOTEUR PYTHON. app/extension sont écrits en lignes
    très denses (plusieurs instructions par ligne) : la lecture « jusqu'à la fin de la ligne »
    y attrape des `break` qui appartiennent à une AUTRE instruction, et tout ressort en MIXTE.
    Ce n'est pas un verdict, c'est une absence de verdict — et comme les 3 moteurs sont en
    PARITÉ, c'est le classement Python qui fait foi pour les trois."""
    # ⚠️ ON LIT L'INSTRUCTION ENTIÈRE, pas une fenêtre de N caractères. Première version : fenêtre
    # de 90 caractères juste après le nom → elle classait `_NP_BREAK` en ALIMENTE alors qu'il fait
    # `break`, simplement parce que le `break` arrive après un `or dj.startswith(...)`. Une
    # heuristique fausse est pire qu'une heuristique absente : elle oriente vers le mauvais endroit.
    freine = alimente = 0
    # ⚠️ DEUX SYNTAXES À COUVRIR, sinon on ne classe QUE le Python : `dj in NOM` (Python) et
    # `NOM[dj]` (JS). La première version ne cherchait que `in NOM` / `[NOM` — les trois moteurs
    # JS ressortaient donc tous en « — », ce qui ressemblait à « rien à signaler ».
    motif = r"(?:\bin\s+%s\b|\b%s\s*\[)" % (re.escape(nom), re.escape(nom))
    for m in re.finditer(motif, src):
        fin = src.find('\n', m.end())
        ligne = src[m.end(): fin if fin > 0 else m.end() + 200]
        if re.search(r"\b(return (None|null|false)|break|continue)\b", ligne):
            freine += 1
        else:
            alimente += 1
    if freine and not alimente: return u'FREIN   (sûr à réparer)'
    if alimente and not freine: return u'ALIMENTE (réparer = +FP)'
    if freine or alimente: return u'MIXTE   (cas par cas)'
    return u'—'


def inventaire():
    print(u'\n╔══ ① INVENTAIRE — listes fermées contenant un mot qui s\'élide ' + u'═' * 21)
    total = suspects = 0
    for chemin, lecteur in ((os.path.join(HERE, 'correcteur_probe.py'), listes_python),
                            (os.path.join(RACINE, 'extension', 'dys-core.js'), listes_js),
                            (os.path.join(RACINE, 'app', 'omega-pendu.html'), listes_js)):
        src = open(chemin, encoding='utf-8').read()
        L = lecteur(src)
        touchees = {n: (v & MOTS_ELIDABLES) for n, v in L.items() if (v & MOTS_ELIDABLES)}
        total += len(L)
        print(u'\n  %s — %d listes fermées lues, %d contiennent un élidable'
              % (os.path.basename(chemin), len(L), len(touchees)))
        for n in sorted(touchees):
            couvert = teste_le_prefixe(src, n)
            if not couvert: suspects += 1
            print(u'    %s %-16s %-24s {%s}' % ('✓' if couvert else '⚠', n,
                                                 direction(src, n),
                                                 ', '.join(sorted(touchees[n]))))
    print(u'\n  %d listes lues au total · %d SUSPECTES (aucun test de préfixe repéré)'
          % (total, suspects))
    return suspects


# ══ ② LE PRIX, MESURÉ ═════════════════════════════════════════════════════════════════════════
RE_ELID = re.compile(r"\b(qu|d|n|j|m|t|s|c|jusqu|lorsqu|puisqu|quoiqu)['’]", re.I)


def developpe(texte):
    u"""Rend le mot-outil VISIBLE : « qu'offrent » -> « que offrent »."""
    def r(m):
        plein = ELIDABLES[m.group(1).lower() + "'"]
        return (plein[0].upper() + plein[1:] if m.group(1)[0].isupper() else plein) + ' '
    return RE_ELID.sub(r, texte)


def phrases():
    out = []
    if not os.path.exists(UD): return out
    for l in open(UD, encoding='utf-8'):
        if l.startswith('# text = '):
            t = l[9:].strip()
            if 25 < len(t) < 220: out.append(t)
    return out


def prix():
    print(u'\n╔══ ② LE PRIX — ce que le moteur perd à ne pas VOIR le mot-outil ' + u'═' * 19)
    cas = [t for t in phrases() if RE_ELID.search(t)]
    print(u'  %d phrases UD contenant au moins une élision' % len(cas))
    norm = lambda r: sorted((str(x[1]), str(x[2])) for x in r)
    change = gagne = perd = 0
    par_mot = Counter()
    ex = []
    for t in cas:
        d = developpe(t)
        a, b = C.correct(t), C.correct(d)
        na, nb = norm(a), norm(b)
        if na == nb: continue
        change += 1
        if len(nb) > len(na): gagne += 1
        elif len(nb) < len(na): perd += 1
        for m in RE_ELID.finditer(t): par_mot[ELIDABLES[m.group(1).lower() + "'"]] += 1
        if len(ex) < 6:
            ex.append(u'    caché %s\n    visible %s\n      %s' % (na or u'∅', nb or u'∅', t[:88]))
    print(u'  ── %d phrases sur %d (%.2f %%) où les DÉCISIONS du moteur changent'
          % (change, len(cas), 100.0 * change / max(1, len(cas))))
    print(u'     dont %d où le moteur VOIT une faute de plus, %d où il en voit une de moins'
          % (gagne, perd))
    print(u'  ── mots-outils impliqués : '
          + ' · '.join('%s %d' % (m, n) for m, n in par_mot.most_common(8)))
    if ex:
        print(u'  exemples :')
        for e in ex: print(e)
    return change, len(cas)


# ══ ③ L'AUTRE MOITIÉ : ET LE RAPPEL ? ═════════════════════════════════════════════════════════
def rappel():
    u"""⚠️ LA PASSE ② NE MESURE QU'UNE MOITIÉ, ET CONCLURE SANS CELLE-CI SERAIT UNE FAUTE DE
    MÉTHODE. UD est du français CORRECT : une correction proposée y est un FAUX POSITIF. La passe
    ② dit donc seulement ce que la visibilité COÛTE en FP — pas ce qu'elle RAPPORTE en fautes
    réellement attrapées. Il faut du texte FAUTIF avec sa version juste."""
    import json
    paires = []
    for f in ('corpus_gec_fr.jsonl', 'corpus_multi1000.jsonl', 'wicopaco_pairs.jsonl'):
        p = os.path.join(RACINE, 'data_local', f)
        if not os.path.exists(p): continue
        for l in open(p, encoding='utf-8'):
            if not l.strip(): continue
            try: o = json.loads(l)
            except Exception: continue
            b, g = o.get('bad'), o.get('good')
            if b and g and b != g and RE_ELID.search(b): paires.append((b, g))
    print(u'\n╔══ ③ ET LE RAPPEL ? (texte FAUTIF avec sa version juste) ' + u'═' * 25)
    if not paires:
        print(u'  aucun corpus de paires disponible.'); return
    print(u'  %d paires bad/good contenant une élision' % len(paires))

    def bien_corriges(fab):
        n = 0
        for (b, g) in paires:
            t = fab(b)
            r = C.correct(t)
            if not r: continue
            # une correction est BONNE si le mot proposé apparaît dans la version juste
            if any(str(x[2]) and str(x[2]) in g for x in r): n += 1
        return n
    cache = bien_corriges(lambda t: t)
    visible = bien_corriges(developpe)
    print(u'  fautes attrapées, mot-outil CACHÉ   : %d' % cache)
    print(u'  fautes attrapées, mot-outil VISIBLE : %d' % visible)
    print(u'  ── le rappel %s de %+d' % ('MONTE' if visible > cache else
                                         ('BAISSE' if visible < cache else 'NE BOUGE PAS'),
                                         visible - cache))
    return cache, visible


if __name__ == '__main__':
    inventaire()
    if not os.path.exists(UD):
        print(u'\n  (UD absent — passes ②/③ sautées, sonde locale seulement.)')
    else:
        prix()
        rappel()
