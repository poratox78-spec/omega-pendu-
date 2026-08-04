# -*- coding: utf-8 -*-
"""build_sens.py — table de DÉFINITIONS jouables, pour le jeu « Double-Sens ».

SOURCE : Wiktionnaire français via kaikki (`data_local/fr/kaikki-frwikt.jsonl`, 3 Go, CC BY-SA,
gitignoré). Sortie : `extension/assets/sens.json.gz`, committée. Si la source est absente, on SORT
SANS RIEN CASSER (la CI n'a pas le dump) — l'asset committé fait foi.

    python dictee/build_sens.py           ·    python dictee/build_sens.py --check

⚠️ LES QUATRE PIÈGES MESURÉS EN CONSTRUISANT CETTE TABLE (ne pas les redécouvrir)

① LA FRÉQUENCE PORTE SUR LA FORME, PAS SUR LE SENS. Trier par fréquence donne les PIRES
   définitions : « elle » -> « Lettre latine L », « rien » -> « Langue taï du Laos », « cesse » ->
   « Variété de cerise ». Le mot est fréquent, mais l'entrée servie est un homographe rare.
   -> On ne garde que la PREMIÈRE entrée du mot dans le dump : le Wiktionnaire y met le sens
   principal. Filtrer d'abord par POS SAUTE cette entrée et sélectionne justement l'homographe.

② MÊME AVEC ÇA, la fréquence peut appartenir à un AUTRE LEXÈME : « peut » (forme de pouvoir) sert
   l'adjectif « peut » = sale/méchant ; « mène » sert un nom du jeu de boules. -> On croise avec
   `pos-hmm.json.gz` (`emit` = POS apprise sur corpus RÉEL) : si l'usage réel contredit la POS de
   l'entrée, la fréquence ment. Jette 533 cas dont fait/passé/trois/demain/personne.

③ UN FILTRE DE CONTENU SANS FRONTIÈRES DE MOT CENSURE LE DICTIONNAIRE. Mesuré : « verge » dans
   di-VERGE-ant bloque *rayon* · « urine » dans fig-URINE bloque *poupée* · « fesse » dans
   con-FESSE-r bloque *avouer* · « pute » dans ré-PUTÉ bloque *livre*. 78 blocages -> 44 une fois
   les frontières posées. Et « héroïne » est à la fois la drogue et l'héroïne du récit : retiré de
   la liste (cocaïne/cannabis/stupéfiant couvrent la drogue) — sinon *héroïque* saute.

④ LA DÉFINITION LIVRE SOUVENT LE MOT (51 % des candidats bruts) : soit c'est une forme fléchie
   (« Participe passé de… »), soit le radical est dans la glose. Les deux sont rejetés.
"""
import gzip
import io
import json
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(RACINE, 'data_local', 'fr', 'kaikki-frwikt.jsonl')
OUT = os.path.join(RACINE, 'extension', 'assets', 'sens.json.gz')
LEX = os.path.join(RACINE, 'extension', 'assets', 'speller.tsv.gz')
HMM = os.path.join(RACINE, 'extension', 'assets', 'pos-hmm.json.gz')

MOT = re.compile(r'"word":\s*"([^"]{4,24})"')
POS_LIGNE = re.compile(r'"pos":\s*"([a-z]+)"')
CONTENU = {'noun', 'verb', 'adj'}                       # un jeu de SENS se joue sur des mots PLEINS
USAGE = {'noun': {'NOUN'}, 'verb': {'VERB', 'AUX'}, 'adj': {'ADJ'}}
REGISTRE = re.compile(r'vieilli|familier|argot|anglicisme|désuet|rare|régionalis|vulgaire|'
                      r'péjoratif|archa|obsolète', re.I)
FLEXION = re.compile(r'^(Première|Deuxième|Troisième|Participe|Masculin|Féminin|Pluriel|'
                     r'Singulier|Variante)', re.I)

# Filtre de contenu — liste EXPLICITE, relue ligne à ligne (44 mots écartés sur 6498 = 0,7 %).
# But : aucune mauvaise surprise pour un enfant dys. Ce n'est pas de la censure de dictionnaire,
# c'est le choix de ce qu'un jeu public propose de deviner.
SENSIBLE = """sexe sexuel sexuelle sexuellement sexy érotique érotisme coït copuler orgasme
libidineux lubricité lubrique obscène obscénité prostituée prostitution putain pute salope
pouffiasse poufiasse catin verge pénis vagin vulve téton fesse fesses anus excrément excréments
uriner urine défèquer viol violer violée violeur meurtre meurtrier assassiner assassinat
torture torturer suicide suicider égorger pendaison cocaïne cannabis stupéfiant
nègre youpin pédé tapette lopette vaurien pouilleux
homosexuelle homosexuel lesbienne""".split()
# ⚠️ (?<![a-zà-ÿ]) / (?![a-zà-ÿ]) = les frontières du piège ③. `\b` ne suffit PAS en français :
# il coupe sur les lettres accentuées, qui ne sont pas des « mot-caractères » pour `re` en ASCII.
RE_SENSIBLE = re.compile(r'(?<![a-zà-ÿ])(?:' + '|'.join(map(re.escape, SENSIBLE)) + r')(?![a-zà-ÿ])',
                         re.I)

# Salissures de mise en forme du Wiktionnaire qui n'ont rien à faire dans un indice de jeu.
SALETES = [
    (re.compile(r'\s*#[0-9A-Fa-f]{6}\b'), ''),          # « rouge foncé. #DC143C »
    (re.compile(r'\s*\^?\(\[\d+\]\)'), ''),             # « Prostituée. ^([1]) »
    (re.compile(r'\s*\[\d+\]'), ''),
    (re.compile(r'^\s*\([^)]{0,40}\)\s*'), ''),         # « (Par extension) » en tête
    (re.compile(r'\s{2,}'), ' '),
]


def charger_frequences():
    freq = {}
    with gzip.open(LEX, 'rt', encoding='utf-8') as f:
        for ligne in f:
            p = ligne.rstrip('\n').split('\t')
            if len(p) > 1 and p[0]:
                freq[p[0]] = int(p[1])
    return freq


def charger_usage():
    """POS apprise sur corpus réel : le juge du piège ②."""
    with gzip.open(HMM, 'rt', encoding='utf-8') as f:
        return json.loads(f.read()).get('emit', {})


def nettoyer(g):
    for rx, rep in SALETES:
        g = rx.sub(rep, g)
    return g.strip()


def construire():
    freq, usage = charger_frequences(), charger_usage()
    vus = set()
    rejets = dict.fromkeys(['trop rare', 'mot-outil', 'sens spécialisé', 'registre',
                            'forme fléchie', 'longueur', 'mot donné', 'usage réel ≠ entrée',
                            'contenu'], 0)
    items, lignes = [], 0

    for ligne in io.open(SRC, encoding='utf-8'):
        lignes += 1
        m = MOT.search(ligne, 0, 200)
        if not m:
            continue
        mot = m.group(1)
        bas = mot.lower()
        if bas in vus or not bas.isalpha():             # ① SEULE la 1re entrée = le sens principal
            continue
        vus.add(bas)
        if freq.get(bas, 0) < 300:
            rejets['trop rare'] += 1
            continue

        o = json.loads(ligne)
        pos = o.get('pos') or ''
        if pos not in CONTENU:
            rejets['mot-outil'] += 1
            continue
        sens = (o.get('senses') or [{}])[0]
        if not isinstance(sens, dict):
            continue
        if sens.get('topics'):                          # botany / linguistic / geography…
            rejets['sens spécialisé'] += 1
            continue

        g = (sens.get('glosses') or [''])[0]
        cats = ' '.join(c.get('name', '') for c in (sens.get('categories') or []))
        if REGISTRE.search(cats) or REGISTRE.search(g):
            rejets['registre'] += 1
            continue
        if not g or FLEXION.match(g):
            rejets['forme fléchie'] += 1
            continue

        g = nettoyer(g)
        if not (14 <= len(g) <= 80):
            rejets['longueur'] += 1
            continue
        if bas[:max(4, len(bas) - 2)] in g.lower():     # ④ la définition livre le mot
            rejets['mot donné'] += 1
            continue

        e = usage.get(bas)                              # ② la fréquence appartient-elle à ce sens ?
        if e and max(e, key=e.get) not in USAGE[pos]:
            rejets['usage réel ≠ entrée'] += 1
            continue
        if RE_SENSIBLE.search(mot) or RE_SENSIBLE.search(g):   # ③
            rejets['contenu'] += 1
            continue

        items.append({'m': mot, 'd': g, 'f': freq[bas]})

    items.sort(key=lambda x: -x['f'])
    return items, rejets, lignes


def main():
    if not os.path.exists(SRC):
        print('[SKIP] %s absent — l\'asset committé fait foi (dump 3 Go, gitignoré).'
              % os.path.relpath(SRC, RACINE))
        if os.path.exists(OUT):
            with gzip.open(OUT, 'rt', encoding='utf-8') as f:
                n = len(json.loads(f.read()))
            print('       %s : %d définitions, %.0f Ko'
                  % (os.path.relpath(OUT, RACINE), n, os.path.getsize(OUT) / 1024.0))
        return 0

    items, rejets, lignes = construire()
    print('lignes %d · mots uniques %d  ->  ⭐ %d définitions jouables' % (lignes, len(items) +
          sum(rejets.values()), len(items)))
    for k, v in sorted(rejets.items(), key=lambda x: -x[1]):
        print('   rejet %-22s %7d' % (k, v))

    if '--check' in sys.argv:
        return 0
    brut = json.dumps(items, ensure_ascii=False, separators=(',', ':'))
    with gzip.open(OUT, 'wt', encoding='utf-8') as f:
        f.write(brut)
    print('-> %s  (%.0f Ko compressés, %.0f Ko bruts)'
          % (os.path.relpath(OUT, RACINE), os.path.getsize(OUT) / 1024.0, len(brut) / 1024.0))
    return 0


if __name__ == '__main__':
    sys.exit(main())
