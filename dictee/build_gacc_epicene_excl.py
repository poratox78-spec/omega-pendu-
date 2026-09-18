# -*- coding: utf-8 -*-
u"""LES NOMS ÉPICÈNES QUE LA TABLE DE GENRE DÉCLARAIT FÉMININS (18/09/2026).

CE QUI S'EST PASSÉ, MESURÉ. `gender_acc.json` (genre ACCENTUÉ) est bâti en deux temps :
  ① kaikki + Lexique4 — un mot qu'UNE source dit AMBIGU (Lexique4 note le genre « e » = épicène :
     un/une peintre, un/une ministre) est ÉCARTÉ de la base, exprès ;
  ② Morphalou 3.1, AJOUT PUR : tout mot que la base ① ne couvre pas (#573).
Le signal d'ambiguïté de ① était perdu entre les deux : un mot écarté POUR CAUSE D'ÉPICÉNIE n'est plus
dans la base, donc ② le voit comme « non couvert » et le rajoute — avec le genre que Morphalou donne à
sa seule entrée, « feminine ». D'où, dans la table livrée : peintre→f, ministre→f, architecte→f,
diplomate→f, cinéaste→f, antiquaire→f… et, au produit, des ROUGES sur du français JUSTE :
    « Le peintre est italien. »      → italienne  [auto]
    « Le ministre est content. »     → contente   [auto]
    « Ce diplomate est américain. »  → américaine [auto]
    « Le cinéaste était présent. »   → présente   [auto]
    « Le peintre est parti hier. »   → partie     [vigilance]
FP=0 sur le rouge est le garde-fou cardinal : ces quatre-là le violent sur des phrases correctes.

CE QUE CE SCRIPT FAIT. Il RESTAURE le signal perdu, sans rien retirer du lexique : il liste les clés de
`gender_acc.json` que Lexique4 marque explicitement épicènes, et les consommateurs du GENRE les ignorent
(`build_gacc_js.py` pour les deux moteurs JS, `correcteur_probe.py` au chargement). Le TSV du speller
(`gacc_lex_fr.tsv`) n'est PAS touché : ces mots restent connus en orthographe, ils cessent seulement
d'AFFIRMER un genre qu'ils n'ont pas. Un nom épicène n'a pas de genre à lui : l'abstention est la
réponse juste, pas une perte.

GARDES DÉLIBÉRÉES (`GARDEES`) — une décision déjà MESURÉE ne se défait pas par une règle générale :
  · « gens » : forcé à « m » le 12/09/2026 parce que le moteur n'accorde qu'APRÈS le nom, où « gens »
    est masculin (« les gens touchés ») ; kaikki le dit féminin à cause de l'épithète antéposée
    (« bonnes gens »). Le retirer coûtait 2 corrections justes, mesurées (1 UD, 1 corpus dys).

MESURE DU 18/09/2026 (moteur du produit, différentiel avant/après) :
  · 14 450 phrases UD CORRECTES : 2 066 → 2 065 marques — la SEULE marque perdue est un faux positif
    (« un nouveau Premier ministre est nommé » → nommée) ;
  · corpus dys brut (72 textes) : 1 379 → 1 379, aucune correction perdue.

  python3 dictee/build_gacc_epicene_excl.py            # régénère dictee/gacc_epicene_excl.json
  python3 dictee/build_gacc_epicene_excl.py --check    # garde : la liste committée == la source
"""
import io, json, lzma, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LEX4 = os.path.join(ROOT, 'Lexique4.tsv.xz')          # committé à la racine : la garde tourne en CI
GACC = os.path.join(HERE, 'gender_acc.json')
OUT = os.path.join(HERE, 'gacc_epicene_excl.json')

GARDEES = {'gens'}                                     # cf. l'en-tête : décisions mesurées, jamais défaites ici


def epicenes_lexique4():
    u"""Graphies que Lexique4 donne comme NOM à genre « e » (épicène EXPLICITE). Le genre vide n'est PAS
    de l'épicénie — c'est une absence d'information, et la table accentuée est justement là pour ça."""
    out = set()
    with lzma.open(LEX4, 'rt', encoding='utf-8') as f:
        f.readline()
        for l in f:
            p = l.rstrip(u'\n').split(u'\t')
            if len(p) >= 8 and p[4] == 'NOM' and p[6] == 'e':
                out.add(p[0].lower())
    return out


def liste():
    E = epicenes_lexique4()
    G = json.load(io.open(GACC, encoding='utf-8'))
    return sorted(w for w in G if w.lower() in E and w.lower() not in GARDEES)


def main():
    chk = '--check' in sys.argv
    if not os.path.exists(LEX4):
        print(u'· ÉPICÈNES : SAUTÉ — Lexique4.tsv.xz absent')
        return 0
    L = liste()
    if chk:
        try:
            ancien = json.load(io.open(OUT, encoding='utf-8'))
        except Exception as e:
            print(u'✗ ÉPICÈNES : %s illisible (%s)' % (os.path.basename(OUT), e))
            return 1
        if ancien != L:
            manque = [w for w in L if w not in set(ancien)][:8]
            trop = [w for w in ancien if w not in set(L)][:8]
            print(u'✗ ÉPICÈNES : la liste committée (%d) ne vaut plus la source (%d) — manquants %s · en trop %s'
                  % (len(ancien), len(L), manque, trop))
            return 1
        print(u'  %d noms épicènes exclus du GENRE (lexique intact) · gardés : %s' % (len(L), ', '.join(sorted(GARDEES))))
        return 0
    json.dump(L, io.open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(u'%d noms épicènes -> %s' % (len(L), os.path.relpath(OUT, ROOT).replace(os.sep, '/')))
    print(u'   échantillon : %s' % u', '.join(L[:12]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
