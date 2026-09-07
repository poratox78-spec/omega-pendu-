# -*- coding: utf-8 -*-
u"""GOLD EXTERNE — sortir le corpus de mesure du seul écrit dys.

POURQUOI (07/09/2026, demande de Rem). Le chiffre du produit repose sur `gold_claude.jsonl` :
72 productions dys réelles, corpus privé, 92,7 % de sondes à faute unique (`corpus_profile_probe`).
Un correcteur d'orthographe française n'a aucune raison de n'être mesuré que là. Ce script fabrique
DEUX gold supplémentaires, au MÊME format (`{raw, fixed}` = production ↔ version corrigée), depuis
des sources publiques et vérifiables :

  · ECRISCOL — copies de SECONDE (projet CLESTHIA/E-CALM). Les fichiers `ANNOTATIONS/*.txt` portent
    une notation de transcription où la forme PRODUITE et sa forme NORMALISÉE sont écrites côte à
    côte : `<tres>_<très>`, `<basse>_<basses>`, `<appercevoir>_<apercevoir>`. C'est un corrigé
    HUMAIN, aligné, sur de l'écrit scolaire ORDINAIRE (ni dys, ni Wikipédia).
    ⚠️ L'archive déposée sur ORTOLANG est TRONQUÉE (107 Mio exactement, pas de répertoire central) :
    on marche les en-têtes locaux, d'où un sous-ensemble. Cf. RESSOURCES_LIBRES.md §6.3.

  · French_GEC — paires phrase↔phrase des révisions de Wikipédia FR, filtrées par
    `fetch_frgec_pairs.py` (un seul mot changé, source hors lexique, cible dedans).

CE QUE LE SCRIPT NE PRÉTEND PAS. Ces deux gold ne valent pas `gold_claude` en qualité : la
normalisation d'ECRISCOL est PARTIELLE (le transcripteur n'a pas marqué toutes les formes) et le
« corrigé » de Wikipédia ne corrige qu'UN mot par phrase. Un mot faux peut donc rester dans `fixed`
— et si le correcteur le répare, la sonde le comptera CASSÉ à tort. Le script MESURE cette pollution
(taux de mots hors lexique restant dans `fixed`) et l'imprime : à lire AVANT tout chiffre.

  OMEGA_DYS_DATA=… ECRISCOL_ZIP=… python3 dictee/build_gold_externe.py
  → <DATA>/gold_ecriscol.jsonl · <DATA>/gold_frgec.jsonl · <DATA>/gold_externe_revue.tsv (relecture)
"""
import io
import json
import os
import re
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

DATA = os.environ.get('OMEGA_DYS_DATA') or os.path.join(ROOT, 'data_local', 'dys_reel')
ZIP = os.environ.get('ECRISCOL_ZIP') or os.path.join(ROOT, 'data_local', 'ECRISCOL.zip')
FRGEC = os.environ.get('FRGEC_PAIRS') or os.path.join(ROOT, 'data_local', 'frgec_pairs.jsonl')

# ⚠️ SENS DE LA NOTATION — VÉRIFIÉ, PAS SUPPOSÉ (07/09/2026). Sur les 780 paires simples des
# 63 copies : 241 (30,9 %) n'ont QUE le 2e membre dans le lexique, 13 (1,7 %) que le 1er — et ces
# 13 sont presque toutes des normalisations EN DEUX MOTS (« entrain »_« en train », « appart »_« à
# part », « cette »_« c'est »), donc absentes du lexique comme token unique. Reste ~5 inversions
# réelles (« assoir »_« asseaoir ») = 0,6 %. La notation est donc bien <produit>_<normalisé>.
PAIRE = re.compile(u'<([^<>]*)>_<([^<>]*)>')           # <produit>_<normalisé>
TEMPS = re.compile(u'T\\d#')                           # T2# : marqueur de « temps » de rédaction
REMPL = re.compile(u'®\\[([^\\]]*)\\](?://([^/]*)//|\\|\\|([^|]*)\\|\\|)®')   # ®[avant]//après//®
INSER = re.compile(u'//([^/]*)//|\\|\\|([^|]*)\\|\\|')   # //ajout// ou ||ajout||
SUPPR = re.compile(u'\\[[^\\]]*\\]')                   # [rature]
ILLIS = re.compile(u'#X+#')                            # #XXX# : illisible
MOT = re.compile(u"[A-Za-zÀ-ÿœŒæÆ'’-]+")


def _resoudre(s):
    u"""Applique les opérations de révision : on garde l'ÉTAT FINAL voulu par l'élève."""
    s = TEMPS.sub(u'', s)
    s = REMPL.sub(lambda m: m.group(2) if m.group(2) is not None else (m.group(3) or u''), s)
    s = INSER.sub(lambda m: m.group(1) if m.group(1) is not None else (m.group(2) or u''), s)
    s = SUPPR.sub(u' ', s)
    s = s.replace(u'£', u' ').replace(u'§', u'\n').replace(u'®', u' ')
    return re.sub(u'[ \t]+', u' ', s).strip()


def _copies_ecriscol(path):
    u"""Marche les en-têtes locaux du zip (le répertoire central manque : archive tronquée)."""
    import zlib
    d = io.open(path, 'rb').read()
    p = 0
    while True:
        i = d.find(b'PK\x03\x04', p)
        if i < 0:
            break
        csz, _usz = struct.unpack('<II', d[i + 18:i + 26])
        nl, el = struct.unpack('<HH', d[i + 26:i + 30])
        nm = d[i + 30:i + 30 + nl].decode('utf-8', 'replace')
        off = i + 30 + nl + el
        if nm.endswith('.txt') and 'ANNOTATIONS' in nm:
            try:
                yield nm, zlib.decompress(d[off:off + csz], -15).decode('utf-8', 'replace')
            except Exception:
                pass
        p = i + 4


def _segments(txt):
    u"""Coupe en phrases et rend les segments (raw, fixed) qui portent au moins une correction."""
    lignes = [l for l in txt.split(u'\n')[1:] if not re.match(u'^\\s*page\\s*\\d', l)]
    txt = u'\n'.join(lignes)
    brut = _resoudre(PAIRE.sub(lambda m: m.group(1), txt))
    corr = _resoudre(PAIRE.sub(lambda m: m.group(2), txt))
    out = []
    sa, sb = re.split(u'(?<=[.!?])\\s|\n', brut), re.split(u'(?<=[.!?])\\s|\n', corr)
    if len(sa) != len(sb):
        return out            # découpes divergentes : tout `zip` d'après serait décalé → on jette
    for a, b in zip(sa, sb):
        a, b = a.strip(), b.strip()
        if a == b or not a or u'DESSIN' in a:
            continue
        # RÉSIDU DE BALISAGE = segment jeté. Un « ridéT » ou un « ®[…] » non résolu fabriquerait
        # un faux cassé : mieux vaut 100 segments propres que 200 dont on doute.
        if re.search(u'[#\\[\\]|®/<>]', a) or re.search(u'[#\\[\\]|®/<>]', b):
            continue
        if len(MOT.findall(a)) < 4 or len(MOT.findall(a)) != len(MOT.findall(b)):
            continue                                   # segments désalignés : on ne devine pas
        out.append((a, b))
    return out


def _audit(recs, W):
    u"""Pollution : mots de `fixed` absents du lexique (donc corrigibles à tort → faux « cassé »)."""
    tot = sale = 0
    exs = []
    for r in recs:
        for w in MOT.findall(r['fixed']):
            if w[:1].isupper():
                continue      # majuscule = nom propre ou début de phrase : hors lexique par nature
            # même découpe que le moteur : l'élision et le trait d'union portent deux mots
            # (« d'une », « soir-là ») — les compter entiers ferait un faux taux de pollution.
            for part in re.split(u"['’-]", w.lower()):
                if len(part) < 2:
                    continue
                tot += 1
                if part not in W:
                    sale += 1
                    if len(exs) < 14:
                        exs.append(part)
    return tot, sale, exs


def _norme(recs, W):
    u"""LE TEXTE NORMÉ — demande de Rem (07/09) : garder le gold dys, le COMPLÉTER avec du texte
    conforme à la norme. Un gold ne vaut que si son côté `fixed` est VRAIMENT correct : sinon le
    correcteur répare une faute que le corrigé avait laissée, et la sonde compte un « cassé » qui
    n'en est pas (mesuré : 65 % des cassés externes étaient exactement ça). On ne garde donc que
    les textes dont CHAQUE mot en minuscule de `fixed` est une forme du lexique.
    ⚠️ Ce que le filtre NE garantit PAS : l'accord. « les chien mangent » passerait (les deux mots
    existent). Il enlève la pollution LEXICALE, la seule mesurable sans juge humain."""
    out = []
    for r in recs:
        ok = True
        for w in MOT.findall(r['fixed']):
            if w[:1].isupper():
                continue
            for part in re.split(u"['’-]", w.lower()):
                if len(part) >= 2 and part not in W:
                    ok = False
                    break
            if not ok:
                break
        if ok:
            out.append(r)
    return out


def main():
    import speller_probe as S
    if not os.path.exists(S.LEX):
        print(u'· GOLD EXTERNE : SAUTÉ (Lexique 4 absent — garde locale)')
        return 0
    if not os.path.isdir(DATA):
        print(u'· GOLD EXTERNE : SAUTÉ (%s absent — OMEGA_DYS_DATA=…)' % DATA)
        return 0
    W = S.Speller().WORDS
    revue = []

    # ---- ECRISCOL --------------------------------------------------------------------
    ecr = []
    if os.path.exists(ZIP):
        ncop = 0
        for nm, txt in _copies_ecriscol(ZIP):
            ncop += 1
            for a, b in _segments(txt):
                ecr.append({'raw': a, 'fixed': b,
                            'src': 'ECRISCOL 2NDE (E-CALM/CLESTHIA, CC BY-NC-SA 3.0 FR) — '
                                   + nm.split('/')[-1]})
        with io.open(os.path.join(DATA, 'gold_ecriscol.jsonl'), 'w', encoding='utf-8') as f:
            for r in ecr:
                f.write(json.dumps(r, ensure_ascii=False) + u'\n')
        tot, sale, exs = _audit(ecr, W)
        print(u'· ECRISCOL : %d copies lues → %d segments gold (%d mots ; %d hors lexique dans '
              u'`fixed` = %.1f %% de pollution)' % (ncop, len(ecr), tot, sale,
                                                    100.0 * sale / max(1, tot)))
        print(u'    exemples hors lexique : %s' % u', '.join(exs))
        revue += [('ecriscol', r) for r in ecr]
    else:
        print(u'· ECRISCOL : archive absente (ECRISCOL_ZIP=…) — sauté')

    # ---- French_GEC ------------------------------------------------------------------
    frg = []
    if os.path.exists(FRGEC):
        for line in io.open(FRGEC, encoding='utf-8'):
            line = line.strip()
            if not line:
                continue
            o = json.loads(line)
            frg.append({'raw': o['x'], 'fixed': o['y'],
                        'src': 'French_GEC (révisions Wikipédia FR, CC BY-SA 4.0) — '
                               '%s→%s' % (o['bad'], o['good'])})
        with io.open(os.path.join(DATA, 'gold_frgec.jsonl'), 'w', encoding='utf-8') as f:
            for r in frg:
                f.write(json.dumps(r, ensure_ascii=False) + u'\n')
        tot, sale, exs = _audit(frg, W)
        print(u'· French_GEC : %d phrases gold (%d mots ; %d hors lexique dans `fixed` = %.1f %% '
              u'de pollution)' % (len(frg), tot, sale, 100.0 * sale / max(1, tot)))
        print(u'    exemples hors lexique : %s' % u', '.join(exs))
        revue += [('frgec', r) for r in frg]
    else:
        print(u'· French_GEC : %s absent — lance fetch_frgec_pairs.py' % FRGEC)

    # ---- LE COMPLÉMENT « TEXTE NORMÉ » -------------------------------------------------
    for recs, nom in ((ecr, 'gold_ecriscol_norme.jsonl'), (frg, 'gold_frgec_norme.jsonl')):
        if not recs:
            continue
        pur = _norme(recs, W)
        with io.open(os.path.join(DATA, nom), 'w', encoding='utf-8') as f:
            for r in pur:
                f.write(json.dumps(r, ensure_ascii=False) + u'\n')
        tot, sale, _ = _audit(pur, W)
        print(u'· %-26s %5d textes gardés sur %5d (%.0f %%) — pollution résiduelle %.2f %%'
              % (nom, len(pur), len(recs), 100.0 * len(pur) / max(1, len(recs)),
                 100.0 * sale / max(1, tot)))

    # ---- fichier de RELECTURE (c'est Rem qui tranche, pas la sonde) --------------------
    p = os.path.join(DATA, 'gold_externe_revue.tsv')
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(u'corpus\tmot_faux\tmot_gold\tproduction\tcorrige\n')
        for src, r in revue:
            a, b = MOT.findall(r['raw']), MOT.findall(r['fixed'])
            diff = [(x, y) for x, y in zip(a, b) if x != y][:1]
            mf, mg = diff[0] if diff else (u'', u'')
            f.write(u'%s\t%s\t%s\t%s\t%s\n' % (src, mf, mg,
                                               r['raw'].replace(u'\t', u' '),
                                               r['fixed'].replace(u'\t', u' ')))
    print(u'· relecture : %s (%d lignes)' % (p, len(revue)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
