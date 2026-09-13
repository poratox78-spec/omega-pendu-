# -*- coding: utf-8 -*-
u"""GARDE — LES JUGES DU TEXTE DYS SAVENT COMPTER UNE SUGGESTION DE PLUSIEURS MOTS (13/09/2026).

Le lot 2 des « mots soulignés sans suggestion » propose « biensur » → « bien sûr », « rendévous » → « rendez-vous »,
« beaucoupma » → « beaucoup ma ». Les juges alignent UN token brut sur UN token gold, et leurs tokeniseurs coupent le
gold aux blancs ET aux traits d'union : une suggestion qui couvre plusieurs tokens gold ne pouvait jamais égaler le
token aligné. Sur les 72 productions réelles, 4 justes relues à la main → 0 créditée (rattrapables 268 → 269, bruit
236 → 241). Et dans l'autre sens, la tolérance « dernier mot » de dys_precision_probe.eq CRÉDITAIT « rondevous » →
« ronde vous » (gold « rendez-vous ») parce que « vous » était le token aligné.

Phrases INVENTÉES, sans corpus : la garde tourne en CI. Chaque juge est interrogé par la fonction même qu'il appelle :
  · dys_precision_probe.classer (juge par famille, référence et --navigateur) ;
  · dys_precision_probe.juste    (dys_pipeline_probe, rules_audit_probe, spirale_probe — vérifié dans leur source) ;
  · vig_census_probe.aligne_gold + classe (census des oranges, alignement dys_reel_probe, égalité sans désaccentuer).
Falsifiée : `juste` ramené à `egal(sugg, al[i])` → les trois « justes » redeviennent fausse / bruit / pointeuse et
« ronde vous » redevient juste.
  python3 dictee/test_juges_multimots.py
"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dys_precision_probe as DP    # noqa: E402
import vig_census_probe as VC       # noqa: E402

# (brut, gold, mot flagué, suggestion, juge de précision, pipeline, census)
CAS = [
    (u"Je viendrai biensur demain.", u"Je viendrai bien sûr demain.", u"biensur", u"bien sûr", u'juste', u'rattrapable', u'juste'),
    (u"Il a un rendévous chez le médecin.", u"Il a un rendez-vous chez le médecin.", u"rendévous", u"rendez-vous", u'juste', u'rattrapable', u'juste'),
    (u"J'aime beaucoupma ville.", u"J'aime beaucoup ma ville.", u"beaucoupma", u"beaucoup ma", u'juste', u'rattrapable', u'juste'),
    (u"Il àfinit son travail.", u"Il a fini son travail.", u"àfinit", u"a fini", u'juste', u'rattrapable', u'juste'),
    # contre-gardes
    (u"Il va au rondevous demain.", u"Il va au rendez-vous demain.", u"rondevous", u"ronde vous", u'fausse', u'bruit', u'pointeuse'),
    (u"Une ville proanglaise ici.", u"Une ville proanglaise ici.", u"proanglaise", u"pro anglaise", u'inutile', u'hors ratés', u'fatigue'),
    (u"Je viendrai biensur demain.", u"Je viendrai bien sur demain.", u"biensur", u"bien sûr", u'juste', u'rattrapable', u'pointeuse'),   # le census ne désaccentue pas
    (u"Il fait tooujousr beau.", u"Il fait toujours beau.", u"tooujousr", u"toujours", u'juste', u'rattrapable', u'juste'),                 # un seul mot : l'égalité de toujours
    (u"C'est d'grande valeur.", u"C'est d'une grande valeur.", u"d'grande", u"de grande", u'fausse', u'hors ratés', u'pointeuse'),     # « d'grande » ≡ « grande » pour eq : sans l'égalité stricte, INUTILE (colonne FP=0) à tort
    (u"On respecte pas la règle.", u"On respecte pas la règle.", u"respecte", u"ne respecte", u'inutile', u'hors ratés', u'fatigue'),     # le gold garde le mot : inutile (le « ne » n'y est pas)
]


def toks_moteur(s):   # le tokeniseur du moteur (dys-core toks), celui du dump du census
    return [w.replace(u'’', u"'").replace(u'ʼ', u"'") for w in re.findall(u"[A-Za-zÀ-ÿœŒ'’ʼ]+", s)]


fail = []
for brut, gold, w, sugg, att_p, att_pip, att_c in CAS:
    rt = [x.group(0) for x in DP.TOK.finditer(brut)]
    ft = [x.group(0) for x in DP.TOK.finditer(gold)]
    al = DP.align(rt, ft)
    i = rt.index(w)
    k = DP.classer(sugg, w, al, i)
    if k != att_p:
        fail.append(u'précision : « %s » → « %s » (gold « %s ») classé %s, attendu %s' % (w, sugg, gold, k, att_p))
    # dys_pipeline_probe : un raté (mot faux au départ) est « rattrapable » si une orange proposée est juste, sinon « bruit »
    pip = u'hors ratés' if DP.eq(w, al[i]) else (u'rattrapable' if DP.juste(sugg, al, i) else u'bruit')
    if pip != att_pip:
        fail.append(u'pipeline : « %s » → « %s » (gold « %s ») compté %s, attendu %s' % (w, sugg, gold, pip, att_pip))
    T, TF = toks_moteur(brut), toks_moteur(gold)
    alc = VC.aligne_gold(T, TF)
    c = VC.classe(T, T.index(w), sugg, alc)
    if c != att_c:
        fail.append(u'census : « %s » → « %s » (gold « %s ») compté %s, attendu %s' % (w, sugg, gold, c, att_c))

# Les juges qui comparent une SUGGESTION au gold doivent passer par DP.juste — sinon ils dérivent en silence.
for fic, motif in ((u'dys_pipeline_probe.py', u'DP.juste(x, al, i)'), (u'rules_audit_probe.py', u'DP.juste(sg, al, i)'),
                   (u'spirale_probe.py', u'DP.juste(sg, al, i)'), (u'dys_precision_probe.py', u'k = classer(sugg, w, al, i)'),
                   (u'vig_census_probe.py', u'classe(t[\'tokens\'], f[\'i\'], f.get(\'sugg\'), al)')):
    src = io.open(os.path.join(HERE, fic), encoding='utf-8').read()
    if motif not in src:
        fail.append(u'%s ne juge plus ses suggestions par « %s »' % (fic, motif))

if fail:
    print(u'✗ JUGES — suggestion de plusieurs mots mal comptée :')
    for f in fail: print(u'  ' + f)
    sys.exit(1)
print(u'✓ JUGES : %d cas × 3 juges — « bien sûr », « rendez-vous », « beaucoup ma » comptés justes, « ronde vous » faux, '
      u'« pro anglaise » inutile ; 5 sources passent par dys_precision_probe.juste' % len(CAS))
