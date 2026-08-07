# -*- coding: utf-8 -*-
u"""CONSTRUCTION DU GOLD SUR DU VRAI ÉCRIT DYS — et pourquoi ce corpus-ci vaut les autres réunis.

CE QU'IL RÉSOUT. Tout ce qu'on avait d'apparié en français venait soit de WiCoPaCo (des Wikipédiens
qui réparent leurs COQUILLES : 27,7 % lettre manquante, 1,0 % terminaison verbale — la distribution
d'un clavier, pas d'un dys), soit de corpus fabriqués dont on ne pouvait pas prouver qu'ils ne
mesuraient pas nos propres hypothèses. Le seul écrit réellement dys apparié tenait en 20 lignes.

LE CORPUS (`data_local/dys_reel/`, GITIGNORÉ — jamais commité, le site est public) :
  corpus1 — 7 textes d'un adolescent dyslexique pendant sa scolarité (FFDys, Laetitia Branciard)
  corpus2 — 71 textes d'adultes dyslexiques-dysorthographiques (Plateforme Dys de l'ASEI, Cécile Péguin)
⚠️ Corpus de recherche communiqué à titre privé : il RESTE dans data_local. Aucun extrait sur le site.

D'OÙ VIENT LE GOLD, PUISQUE LES FICHIERS SONT « raw ». Les 6 textes de `corpus2/Dictée` sont des
DICTÉES : le texte source est connu et fixe, et cinq scripteurs différents ont écrit LE MÊME texte.
Le gold n'est donc pas une reconstruction subjective — il est contraint par la convergence des cinq
versions. C'est la seule partie du corpus où la bonne réponse est récupérable sans l'inventer.

RÈGLE DE CORRECTION : **édition minimale** (même principe que JFLEG). On corrige l'orthographe, les
accords, les accents et la ponctuation ; on NE réécrit PAS les choix de mots ni la segmentation en
phrases du scripteur. Sinon on mesurerait notre goût de rédaction et pas le correcteur.
⚠️ Un point d'incertitude assumé : t3/t4 écrivent « en maison de retraite » là où t2/t5/t6 écrivent
« dans une maison de retraite ». Impossible de savoir laquelle était dictée -> l'édition minimale
garde la forme du scripteur dans les deux cas, ce qui évite d'inventer une faute d'omission.

  python dictee/dys_reel_gold.py          # écrit data_local/dys_reel/dictees_gold.jsonl
  node dictee/dys_corpus_probe.js data_local/dys_reel/dictees_gold.jsonl   # le rappel du correcteur
"""
import os, sys, json, io

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIR = os.path.join(ROOT, 'data_local', 'dys_reel', 'corpus_dys')

# Gold en ÉDITION MINIMALE, un par scripteur (les fautes propres à chacun, pas un texte moyen).
GOLD = {
 'texte1_h25': u"Leurs racines les défendent contre les vents et vont chercher, comme par de petits "
               u"tuyaux souterrains, tous les sucs destinés à la nourriture de leurs tiges. La tige "
               u"elle-même se revêt d’une dure écorce qui met le bois tendre à l’abri des injures de l’air.",
 'texte2_h19': u"J’aimais beaucoup ma grand-mère, c’était une femme cultivée, bienveillante et toujours "
               u"de bonne humeur. Elle a grandi pendant la guerre et elle s’est mariée à l’âge de vingt ans. "
               u"Elle a eu trois enfants qui vivent en France. Elle a fini sa vie dans une maison de "
               u"retraite et je ne l’oublierai jamais.",
 'texte3_h22': u"J’aimais beaucoup ma grand-mère, c’était une femme cultivée et bienveillante, toujours "
               u"de bonne humeur. Elle a grandi pendant la guerre, et elle s’est mariée à l’âge de vingt ans. "
               u"Elle a eu trois enfants qui vivent en France. Elle a fini sa vie en maison de retraite "
               u"et je ne l’oublierai jamais.",
 'texte4_f35': u"J’aimais beaucoup ma grand-mère, c’était une femme cultivée toujours de bonne humeur. "
               u"Elle a grandi pendant la guerre. Elle s’est mariée à l’âge de vingt ans, elle a eu trois "
               u"enfants qui vivent en France. Elle a fini sa vie en maison de retraite et je ne "
               u"l’oublierai jamais.",
 'texte5_h23': u"J’aimais beaucoup ma grand-mère, c’était une femme cultivée, bienveillante et toujours "
               u"de bonne humeur. Elle a grandi pendant la guerre et elle s’est mariée à l’âge de vingt ans. "
               u"Elle a eu trois enfants qui vivent en France. Elle a fini sa vie dans une maison de "
               u"retraite et je ne l’oublierai jamais.",
 'texte6_h23': u"J’aimais beaucoup ma grand-mère. C’était une femme cultivée, bienveillante et toujours "
               u"de bonne humeur. Elle a grandi pendant la guerre et elle s’est mariée à l’âge de 20 ans. "
               u"Elle a eu trois enfants qui vivent en France et elle a fini sa vie dans une maison de "
               u"retraite. Je ne l’oublierai jamais.",
}


def raws():
    u"""Les 6 dictées appariées, lues sur disque (jamais recopiées ici : le corpus reste en local)."""
    d = os.path.join(DIR, u'corpus2', u'Dictée')
    if not os.path.isdir(d):
        return None
    out = []
    for sub in sorted(os.listdir(d)):
        p = os.path.join(d, sub)
        if not os.path.isdir(p):
            continue
        for f in sorted(os.listdir(p)):
            if not f.endswith('_raw.txt'):
                continue
            cle = f[:-len('_raw.txt')]
            if cle not in GOLD:
                continue
            txt = io.open(os.path.join(p, f), encoding='utf-8').read()
            txt = txt.replace(u'\r', u'').strip()
            txt = u' '.join(txt.split())          # les retours à la ligne du scan ne sont pas des fautes
            out.append((cle, txt, GOLD[cle]))
    return out


if __name__ == '__main__':
    r = raws()
    if r is None:
        print(u'(corpus dys réel absent de data_local/dys_reel — rien à construire)')
        sys.exit(0)
    dst = os.path.join(ROOT, 'data_local', 'dys_reel', 'dictees_gold.jsonl')
    with io.open(dst, 'w', encoding='utf-8') as fh:
        for cle, raw, gold in r:
            fh.write(json.dumps({'src': 'dys_reel/' + cle, 'raw': raw, 'fixed': gold},
                                ensure_ascii=False) + u'\n')
    print(u'%d dictées appariées -> %s' % (len(r), dst))
    for cle, raw, gold in r:
        print(u'  %-12s %3d mots' % (cle, len(gold.split())))
