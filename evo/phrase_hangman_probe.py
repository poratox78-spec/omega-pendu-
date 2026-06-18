# -*- coding: utf-8 -*-
# PROBE FALSIFIABLE — pendu de PHRASES : un prior d'accord inter-mots réduit-il les erreurs ?
# =============================================================================================
# Question (cap §1, falsifiable) : en pendu de phrases, un prior GRAMMATICAL inter-mots
# (l'accord) fait-il deviner moins de lettres fausses qu'un solveur lexical SANS contexte ?
# Et le gain est-il sur les TERMINAISONS flexionnelles muettes (-s/-t/-e/-nt) — l'endroit où,
# pour le mot seul, la lettre est indevinable mais où le contexte la détermine ?
#
# Design (cap §4 — UNE jonction : on ne change QUE le prior, tout le reste identique) :
#   - Plateau : structure révélée (nb de mots + longueurs), lettres cachées ; une lettre devinée
#     se révèle PARTOUT (vrai pendu). Erreur = lettre absente de toute la phrase.
#   - Base P0 (route lexicale, SANS contexte) : pour chaque mot, cohorte = {mot} ∪ homophones/flexions
#     (sentences.json `fam`) compatibles avec le motif révélé + la longueur. On devine la lettre de
#     couverture maximale dans la cohorte (sinon repli fréquence FR). C'est la stratégie forte du pendu.
#   - Prior P1 (route lexicale + ACCORD) : MÊME P0, mais la cohorte est d'abord filtrée par l'accord
#     déduit des mots déjà révélés (réutilise governor_number/gender/is_verb de diag_sentence.py).
#     Seule différence P0↔P1 : ce filtre. Ablation propre.
#
# Honnêteté (cap §6) : la longueur révélée désambiguise DÉJÀ beaucoup (verte=5 ≠ vert=4) ; le prior
# ne peut payer que sur les distracteurs de MÊME longueur (parlais/parlait, dort/dors/dore…).
# On mesure donc aussi combien de décisions sont réellement « accord-décidables » → le Δ a un pourquoi.
#
# Lancer : python3 evo/phrase_hangman_probe.py
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'dictee'))
import diag_sentence as D   # réutilise toute la chaîne grammaire (doctrine §5)

SENT = json.load(open(os.path.join(HERE, '..', 'dictee', 'sentences.json'), encoding='utf-8'))
FR_FREQ = list('ESAITNRULODCPMVQFBGHJXYZKW')   # ordre fréquence FR (repli + bris d'égalité)
FREQ_RANK = {c: i for i, c in enumerate(FR_FREQ)}


def board(w):
    """mot -> forme pendu : majuscules, désaccentué, lettres A-Z seulement (apostrophes/tirets ôtés)."""
    return ''.join(c for c in D.deacc(w).upper() if 'A' <= c <= 'Z')


def candidates(word, fam):
    """Cohorte LOCALE d'un mot = lui-même + ses homophones/flexions (fam), réduits à la même longueur (pendu : longueur connue)."""
    L = board(word)
    cands = {L}
    for h in fam.get(word.lower(), []):
        hb = board(h)
        if len(hb) == len(L):
            cands.add(hb)
    return list(cands)


# --- prior d'accord : un candidat (terminaison) est-il COMPATIBLE avec l'accord du contexte ? ---
def cand_signature(c):
    """Signature flexionnelle grossière d'une terminaison (désacc. majuscule)."""
    return {
        'v3pl':  c.endswith('NT'),                       # verbe 3e pl (-ent/-ont)
        'plur':  (c.endswith('S') or c.endswith('X')) and not c.endswith('NT'),  # pluriel/1-2sg : -s/-x
        'fem_e': c.endswith('E'),                         # marque possible du féminin (-e)
    }


# Classe FERMÉE / invariables : jamais des cibles d'accord (sinon on strippe leur -s réel → fausse déclaration).
FUNCTION_WORDS = set(D.NUM_DET) | set(D.NUM_PRON) | set(D.PREP) | {
    'que', 'qui', 'dont', 'ne', 'pas', 'plus', 'y', 'en', 'ni', 'car', 'or', 'donc',
    'mais', 'ou', 'si', 'quand', 'comme', 'ne', 'que', 'tout', 'tous', 'rien'}


def is_accord_target(T, i):
    """Le mot porte-t-il un accord ? Verbe fini / participe / nom-adjectif OUVERT. Exclut la classe fermée et les infinitifs."""
    w = T[i].lower()
    if w in FUNCTION_WORDS:
        return False
    if D.is_verb(T, i) or D.is_participle(T, i):
        return True
    dw = D.deacc(w)
    if len(dw) > 3 and (dw.endswith('er') or dw.endswith('ir') and dw.endswith('oir') is False) and not D.is_verb(T, i):
        return False                                  # infinitif probable (jouer, finir…) = invariable → s'abstenir (sûr)
    return True


def agreement_filter(cands, T, i):
    """Garde, dans la cohorte, les candidats COMPATIBLES avec l'accord déduit du contexte révélé.
    N'exclut que l'INCOMPATIBLE (ne jette jamais la vraie cible si l'accord est correct). Retourne (cohorte_filtrée, applique?)."""
    if not is_accord_target(T, i):
        return cands, False
    verb = D.is_verb(T, i) or D.is_participle(T, i)
    if verb:
        gov = D.governor_number(T, i, skip_pp=True)
        if not gov:
            return cands, False
        tok, num = gov[0].lower(), gov[1]
        if tok in ('je', 'tu', 'nous', 'vous'):          # 1re/2e pers. : règle de terminaison moins nette → on s'abstient
            return cands, False
        keep = []
        for c in cands:
            sig = cand_signature(c)
            if num == 'sg' and (sig['v3pl'] or sig['plur']):   # 3e sg : jamais -nt (3pl) ni -s (1/2sg)
                continue
            if num == 'pl' and not sig['v3pl']:                # 3e pl : terminaison -nt obligatoire
                continue
            keep.append(c)
        return (keep if keep else cands), (len(keep) != len(cands) and len(keep) > 0)
    else:
        gov = D.governor_number(T, i)
        if not gov:
            return cands, False
        num = gov[1]
        keep = []
        for c in cands:
            sig = cand_signature(c)
            if num == 'pl' and not sig['plur']:           # GN pluriel : nom/adj marqué -s/-x
                continue
            if num == 'sg' and sig['plur']:               # GN singulier : pas de -s/-x
                continue
            keep.append(c)
        return (keep if keep else cands), (len(keep) != len(cands) and len(keep) > 0)


def consistent(cand, true, revealed, tried):
    """cand compatible avec l'état du plateau : positions révélées = vraie lettre ; positions cachées ∉ tried."""
    for p in range(len(cand)):
        if revealed[p]:
            if cand[p] != true[p]:
                return False
        else:
            if cand[p] in tried:
                return False
    return True


def cohort_now(cand_sets, words, revealed, tried, T, wi, use_prior):
    """Cohorte d'un mot compatible avec le plateau (+ prior d'accord si demandé). Retourne (cohorte, prior_a_réduit?)."""
    coh = [c for c in cand_sets[wi] if consistent(c, words[wi], revealed[wi], tried)]
    if not coh:
        coh = [words[wi]]                                  # garde-fou : la vraie cible reste compatible
    applied = False
    if use_prior:
        coh2, app = agreement_filter(coh, T, wi)
        if app and 0 < len(coh2) < len(coh):
            applied = True; coh = coh2
    return coh, applied


def play(text, fam, use_prior):
    """Joue le pendu de la phrase (politique de couverture cohorte). Retourne un dict de métriques :
       errors · acc_decisions · reveals_to_pin (lettres correctes avant que TOUS les mots soient identifiés de façon unique)
       · pinned_at_zero (mots déjà uniques AVANT toute lettre — « compris par le contexte »)."""
    T = D.toks(text)
    words = [board(w) for w in T]
    cand_sets = [candidates(w, fam) for w in T]
    revealed = [[False] * len(w) for w in words]
    full_letters = set(c for w in words for c in w)
    tried = set()
    errors = acc_decisions = correct_reveals = 0

    mispin_set = set()   # mots pincés vers UN candidat FAUX (déclaration rapide mais erronée = pire que lente)

    def all_pinned():
        ok = True
        for wi in range(len(words)):
            coh, _ = cohort_now(cand_sets, words, revealed, tried, T, wi, use_prior)
            if len(coh) == 1 and coh[0] != words[wi]:
                mispin_set.add(wi)
            if len(coh) > 1:
                ok = False
        return ok

    pinned_at_zero = sum(1 for wi in range(len(words))
                         if len(cohort_now(cand_sets, words, revealed, tried, T, wi, use_prior)[0]) == 1)
    reveals_to_pin = None
    if all_pinned():            # initialise aussi mispin_set sur l'état zéro-lettre
        reveals_to_pin = 0

    guard = 0
    while any(not all(rev) for rev in revealed) and guard < 200:
        guard += 1
        cohorts = []
        for wi in range(len(words)):
            if all(revealed[wi]):
                cohorts.append([]); continue
            coh, applied = cohort_now(cand_sets, words, revealed, tried, T, wi, use_prior)
            if applied:
                acc_decisions += 1
            cohorts.append(coh)
        # score lettre = couverture cohorte sur positions cachées (somme sur les mots)
        score = {}
        for wi, coh in enumerate(cohorts):
            if not coh:
                continue
            hidden = [p for p in range(len(words[wi])) if not revealed[wi][p]]
            for L in set(c for cand in coh for c in cand):
                if L in tried:
                    continue
                frac = sum(1 for cand in coh if any(cand[p] == L for p in hidden)) / len(coh)
                score[L] = score.get(L, 0.0) + frac
        untried = [chr(65 + k) for k in range(26) if chr(65 + k) not in tried]
        if not untried:
            break
        if score:
            guess = max(untried, key=lambda L: (score.get(L, 0.0), -FREQ_RANK.get(L, 99)))
        else:
            guess = min(untried, key=lambda L: FREQ_RANK.get(L, 99))
        tried.add(guess)
        hit = any((not revealed[wi][p]) and words[wi][p] == guess
                  for wi in range(len(words)) for p in range(len(words[wi])))
        if hit:
            for wi in range(len(words)):
                for p in range(len(words[wi])):
                    if words[wi][p] == guess:
                        revealed[wi][p] = True
            correct_reveals += 1
            if reveals_to_pin is None and all_pinned():
                reveals_to_pin = correct_reveals       # tous les mots identifiables de façon unique
        else:
            errors += 1
    if reveals_to_pin is None:
        reveals_to_pin = correct_reveals
    return {'errors': errors, 'acc_decisions': acc_decisions, 'mispins': len(mispin_set),
            'reveals_to_pin': reveals_to_pin, 'pinned_at_zero': pinned_at_zero, 'nwords': len(words)}


def main():
    err0 = err1 = pin0 = pin1 = pz0 = pz1 = acc = nwords = mis0 = mis1 = 0
    per = []
    for e in SENT:
        a = play(e['text'], e['fam'], use_prior=False)
        b = play(e['text'], e['fam'], use_prior=True)
        err0 += a['errors']; err1 += b['errors']
        pin0 += a['reveals_to_pin']; pin1 += b['reveals_to_pin']
        pz0 += a['pinned_at_zero']; pz1 += b['pinned_at_zero']
        mis0 += a['mispins']; mis1 += b['mispins']
        acc += b['acc_decisions']; nwords += a['nwords']
        if a['reveals_to_pin'] != b['reveals_to_pin']:
            per.append((a['reveals_to_pin'] - b['reveals_to_pin'], e['text'], a['reveals_to_pin'], b['reveals_to_pin']))
    n = len(SENT)
    print('=== PROBE pendu de phrases — prior d\'accord OFF (P0) vs ON (P1) ===')
    print(f'  corpus : {n} phrases · {nwords} mots (structure révélée, lettres cachées)\n')
    print('  -- Métrique 1 : erreurs (lettres fausses devinées) --')
    print(f'     P0={err0}  P1={err1}  Δ={err0 - err1:+d}')
    print('     → en pendu de phrases, le partage de lettres révèle les terminaisons « gratis » :')
    print('       cette métrique ne peut PAS récompenser le prior (le jeu fuit les fins).\n')
    print('  -- Métrique 2 : DÉCLARATION — lettres correctes avant d\'identifier TOUS les mots --')
    print(f'     reveals→pin   P0={pin0}  P1={pin1}   Δ={pin0 - pin1:+d}  ({(pin0-pin1)/max(1,pin0)*100:+.1f} %)')
    print(f'     mots « compris par le contexte » (uniques AVANT toute lettre) : P0={pz0}  P1={pz1}  (+{pz1-pz0})')
    print(f'     décisions accord-décidables (le prior réduit la cohorte) : {acc}')
    print(f'     déclarations FAUSSES (mot pincé vers un mauvais candidat) : P0={mis0}  P1={mis1}'
          + ('   ✅ le prior n\'invente jamais' if mis1 == 0 else '   ⚠️ le prior se trompe parfois !'))
    if per:
        print('     phrases où le prior fait identifier plus tôt :')
        for d, txt, x, y in sorted(per, reverse=True)[:8]:
            print(f'        Δ={d:+d}  (pin {x}→{y})  « {txt} »')
    print('\n  Lecture : Métrique 1 ≈ 0 attendu (le jeu fuit les fins). Si Métrique 2 Δ>0,')
    print('            le prior d\'accord fait « comprendre la phrase » à partir de MOINS de lettres')
    print('            → la valeur est dans la DÉCLARATION, pas l\'évitement de lettres fausses (§0 : cognition mesurable).')


if __name__ == '__main__':
    main()
