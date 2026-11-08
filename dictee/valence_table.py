# -*- coding: utf-8 -*-
"""Table de VALENCE (liste n° 457, 08/11/2026) — rôle d'un pronom PERSONNE (me, te, nous, vous, se) devant le verbe.

  D  = la personne est complément DIRECT (aider quelqu'un) : « il nous a aidés », « ils se sont aidés » (accord) —
       sauf si un complément direct SUIT le participe (« il nous a présenté son frère », « elle s'est lavé les mains »).
  I  = la personne est complément INDIRECT (parler à qqn, donner qqch à qqn) : « il nous a parlé », « il nous a écrit »,
       « ils se sont écrit » (invariable).
  DI = les deux selon le sens (envoyer quelqu'un / envoyer qqch à qqn) : sans complément après, le doute reste.
  P  = verbe essentiellement pronominal (se souvenir, s'enfuir) : « se » sans fonction, accord avec le sujet ; pas d'avoir.
  Ligne 461 (08/11/2026) : + 21 pronominaux courants en D (s'inscrire, s'amuser, se reposer…) et 24 en P, vérifiés dans UD
  (« se » toujours annoté pronominal, jamais complément indirect ; « se vanter » écarté).

Clé = participe masculin singulier (la forme que lisent les règles). Liste FERMÉE de verbes courants, vérifiée contre les
comptes de UD French GSD (pronom obj / iobj par verbe) : chaque désaccord relu un par un (les réfléchis « s'installer, se
sentir » ajoutés en D ; « conseiller, imposer, livrer » en DI : « elle s'est imposée »).
Recopiée dans les deux moteurs (_VAL457, sans accents) ; `node dictee/participes_probe.js --check` vérifie l'égalité.

    python3 dictee/valence_table.py     → réécrit dictee/valence_table.json
"""
import json, os
D = """aidé appelé attendu accompagné aimé amené emmené ramené averti battu blessé cherché choisi consolé convaincu cru déçu
dérangé embrassé encouragé entendu étonné réveillé excusé félicité forcé frappé gêné guidé invité obligé oublié payé
perdu poussé prévenu protégé quitté raccompagné rassuré reçu reconnu regardé rejoint remercié rencontré retrouvé salué
soigné soutenu suivi surpris trompé tué vexé vu connu accueilli applaudi arrêté interrogé écouté épousé abandonné
accusé admiré adoré aperçu convoqué critiqué défendu déposé détesté élu empêché engagé enfermé ennuyé fâché fatigué
gardé habillé ignoré informé inquiété insulté interrompu jugé lavé libéré licencié menacé observé persuadé photographié
piégé poursuivi préféré puni ramassé recruté regretté remarqué remplacé repoussé respecté retenu réuni sauvé secoué
séparé signalé sollicité surveillé touché traité trahi troublé vaincu visité vouvoyé tutoyé arrangé dépassé devancé
couché levé caché assis installé chargé concentré débarrassé entraîné éloigné rapproché réconcilié senti établi
nourri associé affronté vengé sacrifié placé plongé lié uni élevé renseigné impliqué orienté effacé appuyé décidé
habitué trouvé mis pris tenu mené dirigé conduit
inscrit amusé reposé promené baigné changé disputé marié plaint coiffé maquillé douché occupé intéressé approché
allongé penché retourné endormi rendormi régalé""".split()
I = """parlé téléphoné plu déplu souri menti obéi désobéi répondu ressemblé nui succédé survécu résisté semblé paru valu
dit écrit demandé permis promis proposé appris enseigné interdit reproché souhaité expliqué raconté annoncé
indiqué confié transmis donné offert prêté fourni accordé adressé attribué dédié procuré recommandé ordonné suggéré
garanti pardonné prédit prescrit décerné volé enlevé acheté vendu apporté réservé tendu cédé""".split()
DI = """envoyé présenté montré laissé servi rendu rappelé jeté lancé préparé refusé envié passé posé conseillé imposé
livré""".split()
# P = verbes ESSENTIELLEMENT pronominaux (ligne 461) : « se » n'a pas de fonction, le participe s'accorde avec le sujet
# (« elle s'est souvenue ») ; avec avoir, ils n'existent pas : aucune attente. UD les annote « expl:pv » (jamais iobj).
P = """souvenu moqué méfié enfui évanoui absenté dépêché écrié efforcé envolé évadé exclamé abstenu repenti réfugié écroulé
effondré agenouillé accroupi blotti obstiné soucié fié comporté""".split()
T = {}
for cls, L in (('D', D), ('I', I), ('DI', DI), ('P', P)):
    for w in L:
        T[w] = 'DI' if (w in T and T[w] != cls) else cls
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'valence_table.json')
with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write(json.dumps(dict(sorted(T.items())), ensure_ascii=False, indent=0) + '\n')
if __name__ == '__main__':
    from collections import Counter
    print(len(T), dict(Counter(T.values())))
