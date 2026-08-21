# Police dys — confrontation du design AVEUGLE à la littérature (2026-08-21)

> Protocole respecté : `DESIGN_AVEUGLE.md` + `OmegaDys-Regular.ttf` v0.1 ont été **figés et
> commités AVANT** toute lecture. Verdicts ci-dessous, décision par décision.

## Verdicts

| Décision aveugle | Verdict | Ce que dit la littérature |
|---|---|---|
| **Espacement élargi** (chasse généreuse, anti-encombrement) | ✅ **CONFIRMÉ** — le seul effet robuste du domaine | Zorzi et al. 2012 (PNAS) : l'espacement extra-large **double la précision et +20 % de vitesse** chez des dyslexiques FR/IT de 8-14 ans, sans entraînement. Mécanisme = **crowding** (encombrement visuel anormalement fort). Répliqué (Sci. Direct 2021). |
| **Anti-miroir bdpq** (formes uniques par lettre) | ❌ **FALSIFIÉ par proxy** pour la vitesse/précision de lecture | C'est exactement le pari des polices Dyslexie et OpenDyslexic (lettres lestées, asymétrisées). **Méta-analyse 2026** (Annals of Dyslexia, 15 études, 688 participants) : **aucun effet fiable** sur vitesse ou précision ; une étude 2017 montre même OpenDyslexic **plus lent** qu'Arial, et les enfants préfèrent les polices standard. Nuance non tranchée : utilité possible pour l'*apprentissage initial* des lettres (pas mesurée). |
| **Voisement = graisse** (voisée lourde / sourde légère) | 🆕 **INÉDIT — non testé** | Aucune police n'encode un trait articulatoire. Précédent historique direct : **Visible Speech de Bell (1867)** — symboles iconiques des positions articulatoires, efficace pour l'oralisation des sourds, jamais porté sur l'alphabet latin pour les dys. Les indices multi-sensoriels graphème-phonème « show promise » (études d'apprentissage). ⚠️ Leçon de la méta-analyse : les distorsions de forme n'améliorent pas la *vitesse de lecture* → notre cible doit être la **discrimination/l'orthographe** (dictée, écriture), pas la fluence. Hypothèse vivante, à mesurer terrain. |
| **« Police de son »** (rendu contextuel : muettes grisées, s→/z/, graphèmes, syllabes) | ✅ **CONVERGE avec la pratique orthophonique** | C'est LireCouleur (outil FR répandu à l'école : syllabes bicolores = « imprégnation syllabique » de Garnier-Lasek, orthophoniste ; muettes grisées ; phonèmes coloriés). Preuve clinique/pédagogique, pas de grand RCT. Notre plus-value : la substitution est **automatique** (g2p + n-grams du projet) et porte sur le **glyphe** (variantes PUA), pas seulement la couleur. |
| **Accents agrandis** | ➖ Pas de littérature directe trouvée | Cohérent avec le « phoneme highlighting » ; à creuser/mesurer. |

## Conséquence pour l'architecture (répond à la question fixe vs adaptatif)

La littérature **tranche dans le sens de la question posée en cours de route** : ce qui marche est
**adaptatif** (espacement, segmentation syllabique, coloration contextuelle), pas la forme fixe des
lettres. Donc :

1. **La couche de rendu « police de son » devient l'axe principal** : g2p/n-grams décident par
   graphème (phonème réel, muette, frontière de syllabe) et pilotent variantes de glyphes + gris +
   arcs. La TTF n'est que le support qui expose les variantes.
2. **La TTF garde** : espacement large (confirmé), squelette sobre, variantes de son en zone
   privée (U+E000…). Le contraste de graisse par voisement passe de « toutes les consonnes » à
   **outil ciblé de remédiation** (on l'allume sur LA paire travaillée, ex. s/z, comme le rejeu
   ciblé de la dictée) — l'allumer partout dégrade la texture pour un gain non prouvé.
3. **Le banc de mesure existe déjà** dans le projet : la dictée diagnostique. Protocole futur :
   dicter avec rendu OmegaDys-son vs standard, comparer les taux par famille (voisée/sourde
   attendue en baisse si l'hypothèse tient). Même canal que `validation_terrain.html`.

## Sources

- [Méta-analyse 2026 — polices dys sans effet fiable](https://link.springer.com/article/10.1007/s11881-026-00389-8) · [PubMed](https://pubmed.ncbi.nlm.nih.gov/42536336/)
- [Dyslexie font sans bénéfice (2017)](https://link.springer.com/article/10.1007/s11881-017-0154-6) · [OpenDyslexic plus lent (PMC 2017)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5629233/)
- [Zorzi et al. 2012, PNAS — l'espacement extra-large améliore la lecture](https://www.pnas.org/doi/10.1073/pnas.1205566109) · [PMC — interletter spacing](https://pmc.ncbi.nlm.nih.gov/articles/PMC3497831/) · [Réplication overlays/spacing 2021](https://www.sciencedirect.com/science/article/abs/pii/S0891422221002146)
- [Visible Speech (Bell, 1867)](https://en.wikipedia.org/wiki/Visible_Speech)
- [Apprentissage graphème-phonème chez dyslexiques (Frontiers 2018)](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2018.01393/full)
- [LireCouleur (Primàbord/Éduscol)](https://primabord.eduscol.education.fr/lirecouleur) · [LireCouleur — présentation ASH](https://ash.dsden02.ac-amiens.fr/290-lirecouleur.html) · [dysclick — LireCouleur](https://dysclick.fr/outils/lirecouleur/)
