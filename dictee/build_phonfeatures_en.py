# -*- coding: utf-8 -*-
# PHON_FEATURES ANGLAIS : lettre A-Z -> 14 traits articulatoires (ordre FEATURE_NAMES de l'app). Sert à
# bâtir le substrat phonétique du pendu (initPhoneticSubstrate) : similarité entre lettres via traits
# partagés (C/K/Q, I/Y). La table de l'app encode l'interprétation FRANÇAISE de chaque lettre
# (R uvulaire [ʁ], U=[y], H muet, J=[ʒ]) → biais FR dans le substrat EN. On la régénère selon la
# phonétique ANGLAISE (phonème le plus courant de chaque lettre en anglais — vérité linguistique
# standard, PAS arbitraire). Sortie : phonfeatures_en.json (consommé par build_pendu_en.py). Zéro français.
#   Lancer : PYTHONUTF8=1 python dictee/build_phonfeatures_en.py
import io, os, json

# ordre EXACT de FEATURE_NAMES dans l'app (14 dims)
F = ['vowel','nasal','voiced','labial','dental','velar','uvular','fric','stop','liquid','front','open','close','rounded']
def vec(*active):
    s = set(active); return [1 if f in s else 0 for f in F]

# lettre -> traits du phonème anglais dominant (General American)
PF = {
 'A': vec('vowel','voiced','front','open'),          # [æ] cat / [eɪ]
 'B': vec('voiced','labial','stop'),                 # [b]
 'C': vec('velar','stop'),                            # [k] (aussi [s])
 'D': vec('voiced','dental','stop'),                 # [d]
 'E': vec('vowel','voiced','front','close'),         # [ɛ]/[i]
 'F': vec('labial','fric'),                           # [f]
 'G': vec('voiced','velar','stop'),                  # [ɡ] (aussi [dʒ])
 'H': vec('fric'),                                    # [h] glottale VOISELESS — anglais PRONONCÉ (≠ FR muet)
 'I': vec('vowel','voiced','front','close'),         # [ɪ]/[aɪ]
 'J': vec('voiced','fric','stop'),                   # [dʒ] affriquée (≠ FR [ʒ])
 'K': vec('velar','stop'),                            # [k]
 'L': vec('voiced','dental','liquid'),               # [l]
 'M': vec('voiced','labial','nasal'),                # [m]
 'N': vec('voiced','dental','nasal'),                # [n]
 'O': vec('vowel','voiced','open','rounded'),        # [ɑ]/[oʊ] postérieure
 'P': vec('labial','stop'),                           # [p]
 'Q': vec('velar','stop'),                            # [k]
 'R': vec('voiced','dental','liquid'),               # [ɹ] approximante alvéolaire (≠ FR uvulaire)
 'S': vec('dental','fric'),                           # [s]
 'T': vec('dental','stop'),                           # [t]
 'U': vec('vowel','voiced','open'),                  # [ʌ]/[juː] postérieure non-arrondie (≠ FR [y])
 'V': vec('voiced','labial','fric'),                 # [v]
 'W': vec('voiced','labial','close','rounded'),      # [w] glide labio-vélaire
 'X': vec('velar','fric','stop'),                    # [ks]
 'Y': vec('vowel','voiced','front','close'),         # [ɪ]/[aɪ]/[j] — proche de I (homophone-ish)
 'Z': vec('voiced','dental','fric'),                 # [z]
}
assert set(PF) == set('ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'il manque des lettres'
io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'phonfeatures_en.json'),
        'w', encoding='utf-8').write(json.dumps(PF, ensure_ascii=False, sort_keys=True))
print('phonfeatures_en.json : 26 lettres × %d traits' % len(F))
for L in ['H','R','U','J','A','O']:
    print('  %s -> %s' % (L, {F[i]: PF[L][i] for i in range(len(F)) if PF[L][i]}))
