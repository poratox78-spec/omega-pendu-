# -*- coding: utf-8 -*-
"""sans_proto — les TABLES DE MOTS du moteur (extension/dys-core.js) n'ont pas de prototype (liste n° 480, 09/11/2026).

Une table lue avec un mot du texte (« PREP[mot] ») héritait des propriétés de tout objet JavaScript : le mot anglais
« constructor » y trouvait une FONCTION, que le moteur prenait pour une entrée (préposition, conjugaison, suggestion…)
et plantait dessus — dans l'extension, le champ entier perdait toute correction. Remède : les tables écrites en dur portent
« __proto__:null » (ce script les réécrit), celles qui viennent d'un fichier passent par _sansProto() au chargement.

Ce que le script appelle une TABLE : un littéral de DONNÉES (clés simples ; valeurs nombre, chaîne, true/false/null, tableau ou
objet de données) ou un littéral vide, à droite de « NOM= » (pas « obj.nom= »). Petit lexeur JS : chaînes, commentaires,
expressions régulières et gabarits sont sautés ; on ne touche que le code.

    python tools/sans_proto.py extension/dys-core.js --verifier   # contrôle : 0 table sans « __proto__:null » (code 1 sinon)
    python tools/sans_proto.py extension/dys-core.js --ecrire     # réécrit les tables trouvées (fins de ligne gardées)
    python tools/sans_proto.py extension/dys-core.js --liste      # ligne et nom de chaque table trouvée

La page (app/omega-pendu.html) reçoit la même réécriture sur les lignes du moteur ; sa garde est dynamique (dictee/parity_corr.js).
La garde dynamique de l'extension est extension/proto_probe.js.
"""
import io, re, sys

KW_RE = {'return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await'}
ID = re.compile(r'[A-Za-z_$][\w$]*')
NUM = re.compile(r'0[xX][0-9a-fA-F]+|[0-9.]+(?:[eE][-+]?\d+)?')


def lexe(s, a=0, b=None):
    """Positions des « { » en CODE (hors chaînes, commentaires, regex, texte des gabarits) entre a et b."""
    b = len(s) if b is None else b
    i = a; out = []; last = ''; lastword = ''; tpl = []; depth = 0
    while i < b:
        c = s[i]
        if c in ' \t\r\n':
            i += 1; continue
        if c == '/' and s[i + 1:i + 2] == '/':
            j = s.find('\n', i); i = b if j < 0 else j; continue
        if c == '/' and s[i + 1:i + 2] == '*':
            j = s.find('*/', i + 2); i = b if j < 0 else j + 2; continue
        if c in '\'"':
            j = i + 1
            while j < b and s[j] != c:
                j += 2 if s[j] == '\\' else 1
            i = j + 1; last = 'x'; lastword = ''; continue
        if c == '`' or (c == '}' and tpl and tpl[-1] == depth):
            if c == '}':
                tpl.pop()
            j = i + 1; ouvre = False
            while j < b:
                if s[j] == '\\':
                    j += 2; continue
                if s[j] == '`':
                    break
                if s[j] == '$' and s[j + 1:j + 2] == '{':
                    tpl.append(depth); ouvre = True; j += 2; break
                j += 1
            if ouvre:
                i = j; last = '{'; lastword = ''; continue
            i = j + 1; last = 'x'; lastword = ''; continue
        if c == '/':
            if last == '' or last in '(,=:[!&|?{};+-*%<>~^' or lastword in KW_RE:
                j = i + 1; cl = False
                while j < b:
                    if s[j] == '\\':
                        j += 2; continue
                    if s[j] == '[':
                        cl = True
                    elif s[j] == ']':
                        cl = False
                    elif s[j] == '/' and not cl:
                        break
                    elif s[j] == '\n':
                        raise ValueError('regex non fermée ligne %d' % (s.count('\n', 0, i) + 1))
                    j += 1
                j += 1
                while j < b and s[j].isalpha():
                    j += 1
                i = j; last = 'x'; lastword = ''; continue
            i += 1; last = '/'; lastword = ''; continue
        m = ID.match(s, i)
        if m:
            lastword = m.group(0); last = 'x'; i = m.end(); continue
        if c.isdigit():
            i = NUM.match(s, i).end(); last = 'x'; lastword = ''; continue
        if c == '{':
            out.append(i); depth += 1
        elif c == '}':
            depth -= 1
        last = c; lastword = ''; i += 1
    return out


class Pas(Exception):
    pass


VAL = re.compile(r'-?(?:\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+)|true\b|false\b|null\b')
CLE = re.compile(r'[A-Za-z_$][\w$]*|\d+')


def donnees(s, i, poses):
    """Analyse un littéral de DONNÉES qui commence en s[i] ; rend sa fin ; ajoute à poses chaque « { » d'objet."""
    def esp(k):
        while True:
            while k < len(s) and s[k] in ' \t\r\n':
                k += 1
            if s.startswith('//', k):
                k = s.find('\n', k); continue
            if s.startswith('/*', k):
                k = s.find('*/', k) + 2; continue
            return k

    def chaine(k):
        q = s[k]; k += 1
        while s[k] != q:
            if s[k] == '\n':
                raise Pas()
            k += 2 if s[k] == '\\' else 1
        return k + 1

    def valeur(k):
        k = esp(k); c = s[k]
        if c in '\'"':
            return chaine(k)
        m = VAL.match(s, k)
        if m:
            return m.end()
        if c == '[':
            k = esp(k + 1)
            if s[k] == ']':
                return k + 1
            while True:
                k = esp(valeur(k))
                if s[k] == ',':
                    k = esp(k + 1)
                    if s[k] == ']':
                        return k + 1
                    continue
                if s[k] == ']':
                    return k + 1
                raise Pas()
        if c == '{':
            return objet(k)
        raise Pas()

    def objet(k):
        poses.append(k); k = esp(k + 1)
        if s[k] == '}':
            return k + 1
        while True:
            if s[k] in '\'"':
                k = chaine(k)
            else:
                m = CLE.match(s, k)
                if not m or m.group(0) == '__proto__':
                    raise Pas()
                k = m.end()
            k = esp(k)
            if s[k] != ':':
                raise Pas()
            k = esp(valeur(k + 1))
            if s[k] == ',':
                k = esp(k + 1)
                if s[k] == '}':
                    return k + 1
                continue
            if s[k] == '}':
                return k + 1
            raise Pas()
    return objet(i)


def cibles(s, a=0, b=None):
    """« { » à rendre sans prototype : littéraux de données à droite de « NOM= » (pas « obj.nom= »)."""
    res = []; fin = -1
    for p in lexe(s, a, b):
        if p < fin:
            continue
        k = p - 1
        while k >= 0 and s[k] in ' \t':
            k -= 1
        if s[k] != '=' or s[k - 1] in '=!<>+-*/%&|^':
            continue
        k -= 1
        while k >= 0 and s[k] in ' \t':
            k -= 1
        e = k + 1
        while k >= 0 and (s[k].isalnum() or s[k] in '_$'):
            k -= 1
        nom = s[k + 1:e]
        if not nom or not ID.fullmatch(nom):
            continue
        j = k
        while j >= 0 and s[j] in ' \t':
            j -= 1
        if s[j] == '.':
            continue
        poses = []
        try:
            fin = donnees(s, p, poses)
        except (Pas, IndexError):
            continue
        res.extend((q, nom) for q in poses)
    return res


def reecrit(s, poses):
    out = []; prev = 0
    for q in sorted(poses):
        out.append(s[prev:q + 1]); vide = s[q + 1:q + 40].lstrip(' \t').startswith('}')
        out.append('__proto__:null' if vide else '__proto__:null,'); prev = q + 1
    out.append(s[prev:]); return ''.join(out)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    P = sys.argv[1]; s = io.open(P, encoding='utf-8', newline='').read()
    cs = cibles(s)
    if '--liste' in sys.argv or '--verifier' in sys.argv:
        for q, nom in cs:
            print(s.count('\n', 0, q) + 1, nom)
    print('tables sans « __proto__:null »', len(cs), '— noms', len({n for _, n in cs}))
    if '--ecrire' in sys.argv:
        io.open(P, 'w', encoding='utf-8', newline='').write(reecrit(s, [q for q, _ in cs])); print('écrit')
    elif '--verifier' in sys.argv and cs:
        print('✗ table(s) de mots AVEC prototype : un mot comme « constructor » y lirait une fonction (liste n° 480).')
        print('  Écrire « {__proto__:null, …} » (ou lancer : python tools/sans_proto.py ' + P + ' --ecrire).')
        sys.exit(1)
    elif '--verifier' in sys.argv:
        print('✓ toutes les tables de mots du moteur sont sans prototype')
