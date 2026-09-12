# -*- coding: utf-8 -*-
u"""INVENTAIRE DES ABSTENTIONS GARDÉES — instrument de lecture, jamais de correction.

Demande de Rem, 12/09/2026 : « tu m'en fais beaucoup des abstentions comme ça sans regarder le contexte et sans rien
contrôler ? » — après « j'est de Paris », dont la garde recall EXIGEAIT le silence (« aux ambigu ») alors que le voisin
tranche (de + nom propre = origine → je suis). Une abstention gardée dans un banc n'est pas une spécification : c'est une
dette datée, à relire cas par cas. Cet instrument dresse la liste pour la relecture ; le verdict (texte CORRECT = silence
légitime, FP=0 / texte FAUX = une sortie à trouver) reste humain, cf. AUDIT_ABSTENTIONS_2026-09-12.md.

Trois gisements :
  ① les bancs qui EXIGENT un silence : recall_probe (abstain), navigateur_probe (rien: true / interdit: […]) ;
  ② la référence : chaque `return None` dont le commentaire dit « abstention / ambigu / on ne sait pas / prudence », par règle ;
  ③ (à part) les mots FAUX restés MUETS du pipeline : dys_pipeline_probe (colonne MUET) — pas des gardes, des règles absentes.

  python3 dictee/abstentions_inventaire.py [sortie.md]
"""
import io, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else None


def lire(p): return io.open(os.path.join(HERE, p), encoding='utf-8', errors='ignore').read()


def inventaire():
    L = [u'# Inventaire des abstentions gardées', u'']
    L.append(u'## ① Bancs qui exigent un silence')
    t = lire('recall_probe.py')
    m = re.search(r"abstain\s*=\s*\[(.*?)\]", t, re.S)
    L.append(u'- `recall_probe.py` abstain : `%s`' % ((m.group(1).strip() or u'(vide)') if m else u'?'))
    t = lire('navigateur_probe.js')
    rien = re.findall(r"\{\s*txt:\s*'((?:[^'\\]|\\.)*)'\s*,\s*rien:\s*true[^}]*?pourquoi:\s*'((?:[^'\\]|\\.)*)'", t)
    inter = re.findall(r"\{\s*txt:\s*'((?:[^'\\]|\\.)*)'\s*,\s*interdit:\s*\[([^\]]*)\][^}]*?pourquoi:\s*'((?:[^'\\]|\\.)*)'", t)
    L.append(u'- `navigateur_probe.js` : **%d** entrées `rien: true`, **%d** entrées `interdit`' % (len(rien), len(inter)))
    L.append(u''); L.append(u'### rien: true')
    for txt, why in rien: L.append(u'- « %s » — %s' % (txt, why))
    L.append(u''); L.append(u'### interdit')
    for txt, cibles, why in inter: L.append(u'- « %s » ⛔ %s — %s' % (txt, cibles.strip(), why))
    L.append(u''); L.append(u'## ② Référence : `return None` commentés abstention / ambigu / on ne sait pas / prudence')
    t = lire('correcteur_probe.py')
    rule = None; rows = []
    for k, ln in enumerate(t.split(chr(10))):
        mm = re.match(r"def (rule_\w+|_\w+)\(", ln)
        if mm: rule = mm.group(1)
        if 'return None' in ln and re.search(r"abstention|abstient|ambigu|on ne sait pas|prudence|pas s[uû]r|trop plausible", ln, re.I):
            c = ln.split('#', 1)[1].strip() if '#' in ln else ln.strip()
            rows.append((rule or '?', k + 1, c[:160]))
    byrule = collections.OrderedDict()
    for r, k, c in rows: byrule.setdefault(r, []).append((k, c))
    L.append(u'**%d** abstentions commentées dans **%d** règles ou aides.' % (len(rows), len(byrule)))
    for r, xs in byrule.items():
        L.append(u'- **%s** (%d)' % (r, len(xs)))
        for k, c in xs: L.append(u'    - l.%d — %s' % (k, c))
    return L, len(rien), len(inter), len(rows)


if __name__ == '__main__':
    L, a, b, c = inventaire()
    txt = chr(10).join(L) + chr(10)
    if OUT: io.open(OUT, 'w', encoding='utf-8').write(txt)
    else: sys.stdout.write(txt)
    sys.stderr.write(u'%d rien · %d interdit · %d abstentions commentées\n' % (a, b, c))
