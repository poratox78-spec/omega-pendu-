# Audit triche — apprentissage en ligne & g2p « appris en jouant » (2026-06-14)

Question (Rem) : l'apprentissage et le **g2p appris en jouant** lisent-ils le mot caché pour décider ? (cap §43)
Méthode : lecture du code de `app/omega-pendu.html` (sites d'appel + fonctions). Verdict : **CHEAT-FREE**.

## g2p « appris en jouant » (`M_EMERGENT_G2P_ONLINE`)
- `_emrg_initOnline().learn(currentWord)` est appelé **dans `endCurrentGame()`** → **descendant** (après la décision). Apprend des parties **passées**, sert aux **suivantes**.
- `learn(word)` lit `wp.get(word)` = **phonologie** (entrée légitime « mot entendu »), aligne phon→graphème, incrémente `emit`/`cooc`. Le mot complet n'est lu qu'**après** la partie.
- **À l'inférence** : `align(currentWord, ph, revealedMask)` ⇒ aux positions **non révélées**, distribution **UNIFORME** (jamais `ci(m[i-1])`) → **aucun graphème caché lu**. Propositions seulement aux positions `!revealedMask[p]`, depuis la table **L2 apprise** (son→lettre).
- Recall NEO : `_emrg_bind(currentWord, revealedMask)` (révélé seul) + `_ncompat` ne compare qu'aux positions **révélées** ; mot rappelé = **banc des parties passées**.
- Lecture de `currentWord` au montant = **uniquement** sa phono (légitime) + positions révélées (légitime). Cas connu §9.1.

## Apprentissage OS en ligne (`M_OS_LEARNING_ONLINE`)
- `_omega_OSL_onGameEnd(success)` dans `endCurrentGame` : apprend du **résultat (gagné/perdu)**, pas du mot. Descendant. (Mis OFF pour la **dérive** — pas pour triche.)

## Verdict
Tout l'apprentissage est **descendant** (post-partie) ; à la décision l'alignement est **masqué** → jamais de graphème caché. **Conforme cap §43, cheat-free.** Cohérent avec le mémoire §8.4 (le test décisif = ce qui est lu à l'inférence → ici masqué).
