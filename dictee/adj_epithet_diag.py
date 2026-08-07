# -*- coding: utf-8 -*-
u"""POURQUOI `rule_adj_epithet` DÉCLINE SUR LES VRAIS RATÉS D'ACCORD DYS.

LE POINT DE DÉPART. Les 8 ratés d'accord des 6 dictées appariées ASEI ont tous la même forme : un
adjectif ou participe qui doit s'accorder avec le nom voisin. Or le moteur a DÉJÀ 12 règles
d'accord et 8 couches de vigilance, dont `rule_adj_epithet` qui vise exactement ce patron
[ARTICLE + NOM + ADJ]. Aucune ne se déclenche. Le trou n'est donc pas une règle absente : c'est une
GARDE qui se ferme. Cette sonde dit laquelle, et sur combien de cas.

CE QU'ELLE MESURE, ET POURQUOI ÇA SUFFIT À DÉCIDER. On énumère, sur UD French GSD, toutes les
positions où le patron est réuni (un mot de ADJ_LEX placé juste après un NOM) et on compte quelle
garde tranche. Pas de gold nécessaire : on ne mesure pas la justesse, on mesure l'ACCESSIBILITÉ.

  python dictee/adj_epithet_diag.py [n_phrases]

RÉSULTATS (3 000 phrases UD) — sur les positions où le patron est réuni :
  1223  le tagger dit ADJ           -> la règle PEUT agir
   319    ... mais le nom est ABSENT de GENDER_PURE -> elle s'abstient quand même (26 %)
   300  le tagger dit VERB          -> BLOQUÉ net par la garde `tg[i] != 'ADJ'`

⭐ LES DEUX CAUSES, ET ELLES SONT DE NATURES OPPOSÉES.

(A) LA GARDE TAGGER — 300 cas. `cultivé`, `destiné`, `marié` sont étiquetés VERB parce que ce sont
    des PARTICIPES. La garde les jette. C'est précisément la forme la plus fréquente de la faute
    dys d'accord (« une femme cultivé », « les sucs destiné »).
    ⚠️ MAIS LA GARDE N'EST PAS ARBITRAIRE, et c'est le cœur du problème : elle est ce qui sépare
    « texte écrit » (nom + participe -> accord) de « rifampicine diminue » (nom sujet + verbe
    conjugué -> surtout PAS d'accord). Relâcher `tg[i] != 'ADJ'` en bloc fabriquerait des faux
    positifs sur tous les [nom + verbe conjugué], c'est-à-dire sur de la prose ordinaire.
    -> PISTE, à valider par SCAN UD complet : n'accepter VERB que si le mot est un PARTICIPE
       AVÉRÉ (`_is_ppl` / `_looks_ppl` existent déjà dans le moteur), jamais une forme finie.
       La mesure ci-dessous chiffre la part récupérable et le risque.

(B) LES TROUS DE GENDER_PURE — 319 cas, soit 26 % des positions pourtant éligibles. Le genre du nom
    est inconnu de la table, donc la règle s'abstient. Vérifié : `règle`, `marche`, `ferme`,
    `livre` en sont absents (alors que `femme`, `table`, `porte`, `voiture` y sont).
    ⚠️ Conséquence à signaler : l'exemple donné par la DOCSTRING de la règle elle-même,
    « la règle présidentiel » -> présidentielle, NE SE DÉCLENCHE PAS — `regle` manque à la table.
    -> C'est un problème de COUVERTURE LEXICALE, pas de logique. Il rejoint le chantier
       Wiktionnaire déjà décidé, et il ne demande aucune prise de risque FP.

TROIS AUTRES BLOCAGES vus sur les cas réels, mineurs mais à connaître :
  · « de petit tuyaux souterrain » : le NOMBRE se lit sur l'article en T[i-2], mais ici un adjectif
    (`petit`) s'est intercalé entre l'article et le nom -> `num is None` -> abstention.
  · « de petit tuyaux » : `petit` est ANTÉPOSÉ ; la règle ne traite que le postposé, par conception.
  · « elle s'est marié » : relève de `rule_pp_etre`, pas de l'épithète.
"""
import os, sys, io
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import correcteur_probe as P
from correcteur_probe import deacc

UD = os.path.join(ROOT, 'data_local', 'ud_fr_gsd-train.conllu')

CAS_REELS = [
    (u"c'était une femme cultivé, bienveillante", u'cultivé', u'cultivée'),
    (u"tous les sucs destiné a la nourriture de leurs tiges", u'destiné', u'destinés'),
    (u"comme par de petit tuyaux souterrain", u'souterrain', u'souterrains'),
    (u"comme par de petit tuyaux souterrain", u'petit', u'petits'),
    (u"elle s'est marié à l'âge de vingt ans", u'marié', u'mariée'),
    (u"la règle présidentiel", u'présidentiel', u'présidentielle'),   # l'exemple de la docstring
]


def pourquoi(T, tg, i):
    u"""Quelle garde tranche, dans l'ORDRE où la règle les évalue ?"""
    w, lw = T[i], T[i].lower()
    d = deacc(lw)
    if u"'" in lw or w[:1].isupper():
        return u'apostrophe / majuscule'
    if d not in P.ADJ_LEX:
        return u'absent de ADJ_LEX'
    if P._adj_estem(lw) is not None:
        return u'épicène (radical en -e)'
    if not tg or i >= len(tg):
        return u'pas de tag'
    if tg[i] != u'ADJ':
        return u'GARDE TAGGER : tg=%s (pas ADJ)' % tg[i]
    if i < 1 or tg[i - 1] != u'NOUN':
        return u'le mot à gauche n\'est pas un NOUN'
    if P._head_text(T[i - 1])[:1].isupper():
        return u'nom propre à gauche'
    dn = deacc(P._head_text(T[i - 1]).lower())
    if P.GENDER_PURE.get(dn) not in ('m', 'f'):
        return u'TROU GENDER_PURE : « %s » absent' % dn
    if dn in P._SG_STOP:
        return u'nom invariant (_SG_STOP)'
    num = P._EPI_ART.get(deacc(T[i - 2].lower())) if i >= 2 else None
    if num is None:
        return u'NOMBRE non net : « %s » n\'est pas un article' % (T[i - 2] if i >= 2 else u'∅')
    return u'aucune garde ne bloque'


if __name__ == '__main__':
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 3000

    print(u'LES CAS RÉELS — pourquoi chacun échappe à la règle\n')
    for phrase, mot, attendu in CAS_REELS:
        T = P.toks(phrase)
        k = [j for j, t in enumerate(T) if t.lower() == mot.lower()]
        if not k:
            continue
        tg = P.pos_tags(T)
        print(u'  %-14s -> %-14s   %s' % (mot, attendu, pourquoi(T, tg, k[0])))

    if not os.path.exists(UD):
        print(u'\n(UD French GSD absent de data_local — pas de mesure d\'échelle)')
        sys.exit(0)

    phr = [l[9:].strip() for l in io.open(UD, encoding='utf-8') if l.startswith(u'# text = ')][:n]
    c, ppl, fini = Counter(), [], []
    for t in phr:
        T = P.toks(t)
        tg = P.pos_tags(T)
        for i in range(2, len(T)):
            if deacc(T[i].lower()) not in P.ADJ_LEX or i < 1 or tg[i - 1] != u'NOUN':
                continue
            r = pourquoi(T, tg, i)
            c[r.split(u' : ')[0]] += 1
            if r.startswith(u'GARDE TAGGER') and tg[i] == u'VERB':
                # LA MESURE QUI DÉCIDE DU CORRECTIF : parmi les VERB bloqués, combien sont des
                # PARTICIPES (récupérables sans risque) et combien des formes FINIES (à ne surtout
                # pas toucher — « la rifampicine diminue » n'est pas un accord) ?
                (ppl if P._looks_ppl(T[i].lower()) else fini).append(T[i - 1] + u' ' + T[i])

    print(u'\n\nÀ L\'ÉCHELLE — %d phrases UD, positions [NOM + mot de ADJ_LEX] :\n' % len(phr))
    for k, v in c.most_common():
        print(u'  %-46s %5d' % (k, v))

    tot = len(ppl) + len(fini)
    if tot:
        print(u'\n  ⭐ PARMI LES %d BLOQUÉS PAR LA GARDE TAGGER (tg=VERB) :' % tot)
        print(u'     PARTICIPES  (récupérables, vrai accord)  : %4d  (%.0f %%)' % (len(ppl), 100.0 * len(ppl) / tot))
        print(u'     formes FINIES (à NE PAS toucher)         : %4d  (%.0f %%)' % (len(fini), 100.0 * len(fini) / tot))
        print(u'     participes  : ' + u' · '.join(ppl[:6]))
        print(u'     formes finies : ' + u' · '.join(fini[:6]))
        print(u'\n     -> si `_looks_ppl` sépare proprement les deux, la garde peut s\'ouvrir SUR LES')
        print(u'        PARTICIPES SEULEMENT. À confirmer par un scan UD complet (FP=0), pas ici.')
