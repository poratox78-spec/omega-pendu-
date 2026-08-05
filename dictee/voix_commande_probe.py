# -*- coding: utf-8 -*-
"""MODE COMMANDE OU DICTÉE ? — la question de Rem, tranchée par une mesure et non par une opinion.

LES DEUX RÉGIMES.
  · DICTÉE (ce qu'on livre) : on parle normalement, la ponctuation est déduite de la prosodie et
    de la grammaire. L'utilisateur n'a rien à savoir.
  · COMMANDE (Dragon, Word Dictate, Google Docs) : on DIT « virgule », « point », et le moteur
    écrit le signe. Déterministe — mais il faut savoir où va la virgule, et le dire.

CE QUE LA MESURE DOIT DIRE, parce que le reste est de l'avis :
  ① Google émet-il déjà la ponctuation parlée ? (sinon la commande est à écrire entièrement)
  ② À quel prix ? Un mode commande naïf transforme « point » en « . » — or « point » est un NOM
     français courant (« un point de vue », « mettre au point », « point de départ »). Chaque
     occurrence ordinaire devient une marque FAUSSE. C'est un taux de FAUX POSITIFS, et on sait
     le mesurer sur du texte réel.

⚠️ CE QUE CE PROBE NE MESURE PAS, et il faut le dire : la CHARGE COGNITIVE. Savoir où placer une
virgule est précisément la compétence qu'un dys n'a pas — c'est pour ça qu'on écrit ce logiciel.
Un mode commande la lui rend. Aucun corpus ne chiffre ça ; c'est un argument de conception, pas
une mesure, et il est présenté comme tel.
"""
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(HERE)
UD = os.path.join(RACINE, 'data_local', 'ud_fr_gsd-train.conllu')
KAIKKI = os.path.join(RACINE, 'data_local', 'fr', 'kaikki-frwikt.jsonl')

# Les commandes usuelles des dictées du commerce (Dragon, Word, Google Docs), en français.
CMD = {
    'virgule': ',', 'point': '.', 'point d\'interrogation': '?', 'point d\'exclamation': '!',
    'deux points': ':', 'point-virgule': ';', 'à la ligne': '\n', 'nouveau paragraphe': '\n\n',
    'ouvrez les guillemets': '«', 'fermez les guillemets': '»', 'tiret': '-', 'apostrophe': "'",
}


def phrases_ud(limite=None):
    """Les phrases de UD FR GSD, texte brut (# text = ...)."""
    out = []
    if not os.path.exists(UD):
        return out
    for ligne in io.open(UD, encoding='utf-8'):
        if ligne.startswith('# text = '):
            out.append(ligne[9:].strip())
            if limite and len(out) >= limite:
                break
    return out


def phrases_wikt(limite=None):
    """Les exemples du Wiktionnaire FR — du français courant, phrases complètes et ponctuées."""
    out = []
    if not os.path.exists(KAIKKI):
        return out
    for ligne in io.open(KAIKKI, encoding='utf-8'):
        try:
            d = json.loads(ligne)
        except Exception:
            continue
        for s in (d.get('senses') or []):
            for ex in (s.get('examples') or []):
                t = (ex.get('text') or '').strip()
                if 20 < len(t) < 300:
                    out.append(t)
                    if limite and len(out) >= limite:
                        return out
    return out


def main():
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    except Exception:
        pass
    ph = phrases_ud() + phrases_wikt(400000)
    if not ph:
        print('aucun corpus disponible'); return 1
    print('corpus : %d phrases de francais reel (UD FR GSD + exemples du Wiktionnaire)\n' % len(ph))

    total_mots = 0
    for p in ph:
        total_mots += len(re.findall(r"[\wÀ-ÿ'’-]+", p))

    print('%-26s %10s %12s   %s' % ('mot-commande', 'occurrences', 'pour 10 000', 'exemple d\'emploi ORDINAIRE'))
    lignes = []
    for mot in sorted(CMD, key=lambda m: -len(m)):
        # ⚠️ On cherche le mot-commande EN TANT QUE SUITE DE MOTS, pas en sous-chaine : « pointe »
        # ou « pointu » ne sont pas « point ». C'est la difference entre mesurer et bricoler.
        rx = re.compile(r'(?<![\wÀ-ÿ])' + mot.replace("'", "['’]").replace(' ', r'\s+') +
                        r'(?![\wÀ-ÿ])', re.I)
        n, ex = 0, None
        for p in ph:
            m = rx.search(p)
            if m:
                n += len(rx.findall(p))
                if ex is None:
                    a = max(0, m.start() - 28); b = min(len(p), m.end() + 28)
                    ex = ('…' if a else '') + p[a:b].replace('\n', ' ') + ('…' if b < len(p) else '')
        lignes.append((n, mot, ex))
    for n, mot, ex in sorted(lignes, key=lambda x: -x[0]):
        print('%-26s %10d %12.2f   %s' % (mot, n, 10000.0 * n / max(1, total_mots), (ex or '-')[:70]))

    print('\n%d mots au total dans le corpus.' % total_mots)
    print('\nLECTURE. Chaque occurrence ci-dessus est un mot que quelqu\'un peut PRONONCER sans')
    print('vouloir de signe. Un mode commande NAIF les transformerait toutes en ponctuation :')
    print('c\'est son taux de faux positifs, et il n\'est pas nul.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
