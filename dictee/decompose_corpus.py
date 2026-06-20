# -*- coding: utf-8 -*-
# DÉCOMPOSITION PARALLÈLE sur 3 VOIES — ORTHO / PHON / GRAMMAIRE — qui LIT le corpus et ENRICHIT la base.
# ============================================================================================
# La base DÉCRIT (elle ne corrige rien, ne peut pas « se tromper »). Chaque mot est décomposé en
# parallèle sur trois voies, exactement comme Lexique 4 sépare ortho / phono / morpho-grammaire :
#   • ORTHO     : graphèmes, syllabes orthographiques, nb de lettres            (decompose.py)
#   • PHON      : phonèmes (SAMPA), syllabes phonologiques, structure CV         (decompose.py)
#   • GRAMMAIRE : cgram / genre / nombre / morphologie (mot)                     (decompose.py)
#                 + RÔLE EN CONTEXTE dans la phrase (déterminant, verbe, accord) (diag_sentence.py)
#
# On LIT les phrases (correctes) du corpus réel corpus_gec_fr.jsonl et on APPREND chaque mot dans
# learned_lex.json (FP=0) — « lit et apprend des mots » sur données réelles. Aucune correction.
# Lancer :
#   python3 dictee/decompose_corpus.py           # lit le corpus → enrichit la base + aperçu parallèle
#   python3 dictee/decompose_corpus.py --show     # aperçu parallèle (lecture seule, n'écrit pas)
#   python3 dictee/decompose_corpus.py --phrase "Le chat dort."   # une phrase de ton choix
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import decompose as D
import diag_sentence as G

CORPUS = os.path.join(HERE, 'corpus_gec_fr.jsonl')


def role_contexte(T, i):
    """Voie GRAMMAIRE EN CONTEXTE (descriptive) : rôle du mot dans la phrase. Réutilise les leviers
    de diag_sentence (is_verb, gouverneurs de genre/nombre). Décrit — ne corrige pas."""
    w = T[i].lower(); parts = []
    if w in G.NUM_PRON:   parts.append('pronom-sujet(' + G.NUM_PRON[w] + ')')
    elif w in G.NUM_DET:  parts.append('déterminant(' + G.NUM_DET[w] + ')')
    elif G.deacc(w) in G.PREP: parts.append('préposition')
    elif G.is_verb(T, i):
        gov = G.governor_number(T, i, skip_pp=True)
        parts.append('verbe' + (' ← sujet « ' + gov[0] + ' » ' + gov[1] if gov else ''))
    else:
        gg = G.governor_gender(T, i) or G.lexical_gender(T, i)
        gn = G.governor_number(T, i)
        if gg: parts.append(('féminin' if gg[1] == 'f' else 'masculin') + ' ← « ' + gg[0] + ' »')
        if gn: parts.append(gn[1] + ' ← « ' + gn[0] + ' »')
    return ' · '.join(parts) if parts else '—'


def parallel(T, i):
    """Décomposition PARALLÈLE d'un mot en contexte → (mot, ortho, phon, grammaire)."""
    w = T[i]; r = D.decompose(w)
    ortho = '-'.join(r['syll_ortho']) + f"  ({r['nblettres']} l, {r['graphemes'].__len__()} graph.)"
    phon = '/' + r['phono'] + '/  ' + '-'.join(r['syll_phon']) + f"  CV={r['cv']}"
    cg = '/'.join(r['cgram']) or '—'
    g = {'m': ' m', 'f': ' f'}.get(r['genre'], '')
    morph = ('  morpho ' + '+'.join(r['morpho'])) if r.get('morpho') else ''
    gram = f"{cg}{g} {r['nombre']}{morph}  ·  rôle : {role_contexte(T, i)}"
    return w, ortho, phon, gram


def show_sentence(text):
    T = G.toks(text)
    print('« ' + text + ' »')
    for i in range(len(T)):
        w, o, p, gr = parallel(T, i)
        print(f"  {w:<14}┃ ORTHO {o:<26}┃ PHON {p:<26}┃ GRAM {gr}")


def enrich_base(rows):
    """Lit les phrases CORRECTES du corpus et apprend chaque mot dans la base (FP=0)."""
    lex = D.load_learned(); n = 0
    for r in rows:
        for tok in G.toks(r.get('good', '')):
            if D.learn_word(lex, tok):
                n += 1; lex['_meta']['lus'] += 1
    D.save_learned(lex)
    return n, len([k for k in lex if k != '_meta'])


def main(argv):
    if argv and argv[0] == '--phrase':
        show_sentence(' '.join(argv[1:]) or 'Le petit chat dort.'); return 0
    if not os.path.exists(CORPUS):
        print("[corpus] corpus_gec_fr.jsonl absent."); return 1
    rows = [json.loads(l) for l in open(CORPUS, encoding='utf-8') if l.strip()]
    if argv and argv[0] == '--show':                       # aperçu parallèle, lecture seule
        for r in rows[:2]:
            show_sentence(r['good']); print()
        return 0
    n, words = enrich_base(rows)                            # défaut : lit le corpus → enrichit la base
    print(f"lu {len(rows)} phrases du corpus · {n} mots décomposés (3 voies parallèles) et appris "
          f"→ base = {words} mots distincts (learned_lex.json)")
    print("\naperçu parallèle (1re phrase) :")
    show_sentence(rows[0]['good'])
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
