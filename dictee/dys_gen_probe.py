# -*- coding: utf-8 -*-
u"""GARDE DU GÉNÉRATEUR DE FAUTES DYS (dictee/dys_gen.py), versions 1 et 2 — liste n° 670.

Le générateur sert de banc : s'il change sans qu'on le voie, les mesures faites avec lui ne se comparent plus. Cette garde
n'a besoin d'aucun corpus privé : elle travaille sur un texte INVENTÉ, écrit ici.

  ① la version 1 n'a pas bougé : `genere(texte)` et `genere(texte, profil='asei')` rendent le même texte, graine pour graine ;
  ② la version 2 est reproductible (même graine, même sortie) ;
  ③ ses traits tiennent sur le texte inventé : la première lettre presque toujours gardée, peu de lettres qui « dansent »,
     l'apostrophe sous ses trois formes, plus de fautes que la version 1 (30 % des mots contre 20 %) ;
  ④ la grille sait compter l'apostrophe collée (« jai » pour « j'ai ») ;
  ⑤ chaque profil déclare ses briques, et la contrainte de son se tait proprement si la lecture devinée manque.

    python dictee/dys_gen_probe.py
"""
import os, random, sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dys_gen as G
from dys_reel_probe import toks, align, apostrophe, deacc

TEXTE = (u"Ce matin, j'ai pris le train de huit heures pour aller chez ma grand-mère. Elle habite une petite maison près de la gare, "
         u"avec un grand jardin et des pommiers. Mes cousins étaient déjà arrivés quand je suis entré dans la cuisine. Nous avons préparé "
         u"le repas ensemble : une soupe de légumes, des pâtes au fromage et une tarte aux pommes. Plus tard, les enfants ont joué dehors "
         u"pendant que les adultes rangeaient la vaisselle. Mon oncle m'a montré les photographies de son voyage en Bretagne, qu'il avait "
         u"rangées dans une vieille boîte. Je crois qu'il aimerait y retourner l'été prochain avec toute la famille. Avant de partir, "
         u"j'ai promis à ma grand-mère de lui écrire une longue lettre et de revenir la voir pendant les vacances.")
echec = []
lex = G.charge_lex()
if len(lex) < 100000:
    echec.append(u'lexique du correcteur introuvable ou trop court (%d formes) : la garde ne peut pas juger' % len(lex))

# ① la version 1 à l'identique
for g in (1, 2, 3):
    a = G.genere(TEXTE, random.Random(G.GRAINE + g), lex)
    b = G.genere(TEXTE, random.Random(G.GRAINE + g), lex, profil=u'asei')
    if a != b:
        echec.append(u'① la version 1 et le profil « asei » ne rendent plus le même texte (graine +%d)' % g)
if G.PROFILS[u'asei'][u'briques'] is not G.BRIQUES or G.PROFILS[u'asei'][u'taux'] != G.TAUX or G.PROFILS[u'asei'][u'apostrophe'] != 0.0:
    echec.append(u'① le profil « asei » ne pointe plus sur les briques et le taux de la version 1')

# ② reproductible
for prof in (u'dys_lourd', u'scolaire'):
    if G.genere(TEXTE, random.Random(7), lex, profil=prof) != G.genere(TEXTE, random.Random(7), lex, profil=prof):
        echec.append(u'② le profil « %s » ne rend pas deux fois la même sortie pour la même graine' % prof)

# ③ les traits de la version 2, sur 60 tirages du texte inventé
def traits(profil, tours=60):
    n = prem = n4 = danse = fautes = mots = 0
    apo = {u'colle': 0, u'separe': 0, u'entier': 0}
    for g in range(tours):
        faux, k = G.genere(TEXTE, random.Random(1000 + g), lex, profil=profil)
        fautes += k; mots += len(toks(TEXTE))
        apo[u'colle'] += faux.count(u'jai ') + faux.count(u'Jai ') + faux.count(u'quil ')
        apo[u'separe'] += faux.count(u'j ai ') + faux.count(u'J ai ') + faux.count(u'qu il ')
        apo[u'entier'] += faux.count(u'je ai ') + faux.count(u'Je ai ') + faux.count(u'que il ')
        for op, x, y in align(toks(faux), toks(TEXTE)):
            if op != 'sub' or not x or not y or apostrophe(x, y):
                continue
            a, b = deacc(x.lower()), deacc(y.lower())
            if a == b or len(b) < 4:
                continue
            n4 += 1; prem += 1 if a[:1] == b[:1] else 0
            danse += 1 if (sorted(a) == sorted(b)) else 0
    return 100.0 * fautes / mots, 100.0 * prem / max(1, n4), 100.0 * danse / max(1, n4), apo
t2, p2, d2, apo2 = traits(u'dys_lourd')
t1, p1, d1, _ = traits(None)
if not (t2 > t1 + 5):
    echec.append(u'③ le profil « dys_lourd » devrait poser nettement plus de fautes que la version 1 (%.1f %% contre %.1f %%)' % (t2, t1))
if p2 < 78:                                                # version 2.2 : 86 % dans le réel toutes fautes confondues (65 % dans les fautes multiples)
    echec.append(u'③ première lettre gardée : %.1f %% (attendu 78 %% et plus — 86 %% dans le réel)' % p2)
if d2 > 4:
    echec.append(u'③ lettres qui dansent (mêmes lettres, autre ordre) : %.1f %% des mots fautifs (attendu 4 %% au plus — 1 %% dans le réel)' % d2)
if not (d2 < d1):
    echec.append(u'③ la version 2 devrait faire danser moins de lettres que la version 1 (%.1f %% contre %.1f %%)' % (d2, d1))
for forme, v in apo2.items():
    if v == 0:
        echec.append(u'③ l\'apostrophe « %s » n\'apparaît jamais sur 60 tirages (trois formes attendues : jai, j ai, je ai)' % forme)

# ④ la grille compte l'apostrophe collée
c, n = G._typologie([(u"Demain jai piscine à midi.", u"Demain j'ai piscine à midi.")], colle=True)
if c.get(u'apostrophe collée') != 1 or n != 1:
    echec.append(u'④ « jai » pour « j\'ai » devrait compter UNE apostrophe collée, vu %r' % dict(c))
c0, n0 = G._typologie([(u"Demain jai piscine à midi.", u"Demain j'ai piscine à midi.")])
if c0.get(u'apostrophe collée'):
    echec.append(u'④ sans colle=True la grille de la version 1 ne doit pas changer')

# ⑤ les profils et la contrainte de son
for prof, d in G.PROFILS.items():
    if not d[u'briques'] or not (0.05 < d[u'taux'] < 0.5):
        echec.append(u'⑤ profil « %s » mal formé' % prof)
if G._cle_son(u'maison') == u'' or G._ecart_son(u'maison', u'maizon') != 0 or G._ecart_son(u'maison', u'raison') == 0:
    echec.append(u'⑤ la clé de son ne distingue plus « maison », « maizon » (même son) et « raison » (autre son) : la contrainte de son est muette')

# ⑥ version 2.1 (liste n° 671) : les briques refaites sur la forme des fautes réelles
r = random.Random(11)
if G.f_homophone_v2(u'est', r, lex) != u'et' or G.f_homophone_v2(u'maison', r, lex) is not None:
    echec.append(u'⑥ homophones : « est » doit donner « et », et un mot hors de la liste ne rien donner')
sorties = [G.f_accent_v2(u'élève', r, lex) for _ in range(400)]
if sum(1 for f in sorties if f in (u'elève', u'éleve')) < 220:
    echec.append(u'⑥ accent : sur « élève », l\'accent doit être OUBLIÉ dans la majorité des tirages (78 % dans le réel)')
if G.f_accent_v2(u'table', r, lex) is not None:
    echec.append(u'⑥ accent : « table » n\'a pas d\'accent à perdre, et son « e » final ne doit pas en prendre')
t = [G.f_terminaison_v2(u'mangé', r, lex) for _ in range(300)]
if sum(1 for f in t if f == u'manger') < 200:
    echec.append(u'⑥ terminaison : « mangé » doit donner « manger » dans la grande majorité des tirages (-é → -er, 51 cas sur 54)')
acc = [G.f_accord_v2(u'voitures', r, lex) for _ in range(300)]
if sum(1 for f in acc if f == u'voiture') < 240:
    echec.append(u'⑥ accord : sur « voitures », la marque doit être OUBLIÉE presque toujours, vu %d sur 300' % sum(1 for f in acc if f == u'voiture'))

# ⑦ version 2.2 (liste n° 672) : fautes multiples sur la forme relevée, réécriture au son, mots collés et coupés
r = random.Random(13)
MOT = u'photographie'
multi = [f for f in (G.f_autre_v2(MOT, r, lex) for _ in range(200)) if f]
if len(multi) < 150:
    echec.append(u'⑦ fautes multiples : « %s » devrait presque toujours recevoir une faute multiple, vu %d sur 200' % (MOT, len(multi)))
else:
    courts = sum(1 for f in multi if len(f) < len(MOT)); sons = sum(1 for f in multi if G._ecart_son(MOT, f) == 0)
    if courts < 0.5 * len(multi):
        echec.append(u'⑦ fautes multiples : le mot écrit doit être plus COURT le plus souvent (70 %% dans le réel), vu %d sur %d' % (courts, len(multi)))
    if sons < 0.12 * len(multi):
        echec.append(u'⑦ fautes multiples : le son doit être gardé dans une bonne part des tirages (26 %% dans le réel), vu %d sur %d' % (sons, len(multi)))
g = G._autre_son(MOT, MOT, r)
if not g or g == MOT or G._ecart_son(MOT, g) != 0:
    echec.append(u'⑦ réécriture au son : « %s » doit recevoir une autre graphie de même son, vu %r' % (MOT, g))
PHRASE = u"Le voisin a un grand jardin et la maison de mon frère est proche de l'école du village."
for cle, sens in ((u'colle', -1), (u'coupe', 1)):
    G.PROFILS[u'_essai'] = {u'briques': [], u'oublie': 0.0, u'trop': 0.0, u'segmentation': 0.0, u'apostrophe': 0.0, cle: 1.0, u'taux': 0.2}
    faux, k = G.genere(PHRASE, random.Random(5), lex, profil=u'_essai')
    ecart = len(faux.replace(u"'", u' ').split()) - len(PHRASE.replace(u"'", u' ').split())
    if k < 1 or ecart * sens < 1:
        echec.append(u'⑦ « %s » : la phrase devrait %s des mots, écart vu %+d' % (cle, u'perdre' if sens < 0 else u'gagner', ecart))
    del G.PROFILS[u'_essai']
if G.PROFILS[u'asei'].get(u'colle') or G.PROFILS[u'asei'].get(u'coupe'):
    echec.append(u'⑦ la version 1 ne doit ni coller ni couper des mots')

if echec:
    print(u'  ✗ GÉNÉRATEUR DE FAUTES DYS :')
    for e in echec:
        print(u'      ' + e)
    sys.exit(1)
print(u'  ✓ générateur de fautes dys : version 1 intacte, version 2 reproductible · dys_lourd %.0f %% de mots fautifs (v1 %.0f %%), '
      u'première lettre gardée %.0f %%, lettres qui dansent %.1f %% (v1 %.1f %%), apostrophe sous 3 formes' % (t2, t1, p2, d2, d1))
