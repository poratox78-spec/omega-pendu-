# Expérience M3_d pour la dictée — FALSIFIÉE au design (2026-06-13)

> Hypothèse (Rem) : le concept M3_d, orphelin dans le pendu, trouverait une utilité en
> **désambiguïsant les homophones** du diagnostic de dictée. Verdict après revue d'architecture :
> **falsifiée — ne pas construire l'expérience.** (Résultat négatif instructif, dans l'esprit du mémoire §8.)

## Vérification (code `app/omega-pendu.html`)
`M3_d_step()` encode depuis **`M1_d.output`** (perception **orthographique** du plateau) + option
**`M1_phon`** (articulatoire, si `M_BPC_CROSSMODAL`). Autoencodeur bPC sur le pattern ortho/son.
Canal OS d'entrée : `D2 = M2_d → M3_d`. **Aucune entrée sémantique / de contexte / lexicale.**

## Pourquoi ça falsifie l'hypothèse
1. **Mauvais signal.** Homophones = même son ; en dictée l'orthographe (seul signal discriminant de
   M3_d) n'est pas fournie (c'est la sortie cherchée). Fed le son, M3_d produit le **même concept**
   pour *ver/vert/verre* → ne peut pas trancher. Et **aucun canal de contexte** pour départager.
2. **Pas de problème réel à résoudre.** En dictée, le **mot cible est connu** (le système le dicte).
   L'« ambiguïté » mesurée au baseline (ex. *battu*↔*battus* = homophone ET lettre muette) se gère
   en **multi-étiquette** (« mot réel homophone + il manque le -s »), feedback **plus riche**, pas un défaut.

## Conséquences
- M3_d **ne gagne pas d'utilité** via la dictée (cohérent avec mémoire §8.1/§12 : petit latent de
  pattern, pas de rôle sémantique). On ne monte PAS l'expérience.
- Désambiguïser le sens demanderait un **signal externe** (embeddings / contexte de phrase / petit LM)
  = **nouveau** chemin, hors substrat OMEGA, et en tension avec « cognition cheat-free ». À acter
  séparément si un jour on veut la dictée de phrases sémantique.
- **Valeur du produit intacte** : 91,3 % de diagnostic exact (accent, voisée/sourde, muette) **sans**
  M3_d ; les ~9 % d'ambigus = feedback multi-étiquette. → on avance sur la surface (roadmap Ph.1-2).
