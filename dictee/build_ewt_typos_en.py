#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_ewt_typos_en.py — le banc des FAUTES RÉELLES EN CONTEXTE de l'anglais (dictee/ewt_typos_en.tsv).

POURQUOI. Il n'y aura pas de corpus dys anglais (CHANTIER_ANGLAIS §5). Mais UD English-EWT — 16 000 phrases du web : blogs,
courriels, avis, forums — annote SES PROPRES fautes : `Typo=Yes` sur le token, et la bonne forme dans `CorrectForm=`. C'est
du texte réel, fautif, EN CONTEXTE, dont la bonne réponse est donnée par les annotateurs d'Universal Dependencies : on peut
donc mesurer un rappel SANS savoir l'anglais, et lire chaque rouge faux. Trouvé le 17/09/2026 en lisant un rouge du speller
sur EWT (« convience » -> convince) que le corpus annotait lui-même « convenience ».

CE QUI ENTRE. Les phrases portant au moins une faute annotée qui soit un MOT ENTIER en lettres, différent de sa correction
autrement que par la casse. Les fautes qu'UD a coupées autrement que le moteur (do+nt, it+s : il sépare les clitiques) sont
listées mais hors banc — le moteur les voit comme un seul mot, la comparaison n'aurait pas de sens.
Format : une phrase par ligne — texte <TAB> début:fin:correction | début:fin:correction … (positions en caractères).

  PYTHONUTF8=1 python dictee/build_ewt_typos_en.py data_local/en_ewt-ud-train.conllu [dev.conllu test.conllu]
Licence : UD English-EWT, CC BY-SA 4.0 (Silveira et al. 2014 ; Universal Dependencies) — même source que le modèle POS livré.
"""
import io, os, re, sys

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'ewt_typos_en.tsv')
TOK = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’ʼ][A-Za-zÀ-ÖØ-öø-ÿ]+)*")          # LE motif du moteur


def phrases(path):
    cur = None
    for ln in io.open(path, encoding='utf-8'):
        if ln.startswith('# text = '):
            cur = {'text': ln[9:].rstrip('\n'), 'toks': []}; yield cur; continue
        c = ln.rstrip('\n').split('\t')
        if cur is None or len(c) != 10 or not c[0].isdigit(): continue
        m = re.search(r'CorrectForm=([^|]+)', c[9])
        cur['toks'].append((c[1], 'Typo=Yes' in c[5], m.group(1) if m else None))


def main():
    srcs = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not srcs: print(__doc__); sys.exit(2)
    lignes = []; n_typo = n_coupe = n_phr = 0
    for src in srcs:
        for ph in list(phrases(src)):
            text = ph['text']; p = 0; spans = []
            eng = [(m.start(), m.end()) for m in TOK.finditer(text)]
            for form, typo, gold in ph['toks']:
                i = text.find(form, p)
                if i < 0: continue
                a, b = i, i + len(form); p = b
                if not typo or not gold: continue
                if not re.fullmatch(r'[A-Za-z]+', form) or form.lower() == gold.lower(): continue
                if '\t' in gold or '|' in gold or ':' in gold: continue
                if (a, b) not in eng: n_coupe += 1; continue                 # UD a coupé autrement que le moteur
                spans.append('%d:%d:%s' % (a, b, gold))
            if spans and '\t' not in text:
                n_phr += 1; n_typo += len(spans); lignes.append(text + '\t' + ' | '.join(spans))
    with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('# Fautes RÉELLES annotées par UD English-EWT (Typo=Yes / CorrectForm) — CC BY-SA 4.0, Universal Dependencies.\n')
        f.write('# texte<TAB>début:fin:correction | … — bâti par dictee/build_ewt_typos_en.py ; ne pas éditer à la main.\n')
        for l in lignes: f.write(l + '\n')
    print('écrit : %s — %d phrases, %d fautes au banc (%d coupées autrement par UD, hors banc), %.0f Ko'
          % (os.path.relpath(OUT), n_phr, n_typo, n_coupe, os.path.getsize(OUT) / 1024.0))


if __name__ == '__main__':
    main()
