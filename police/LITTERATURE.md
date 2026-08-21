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

## Décision d'architecture (discussion 2026-08-21) : le texte ne change JAMAIS

Question posée : « les sons changent les lettres, donc il faudrait une table de caractères plus
grande ? » — Réponse tranchée : **NON**. On ne crée pas d'alphabet privé (dépendance, texte non
portable, copier-coller cassé). Le texte reste du français Unicode normal ; le son ne change que
l'**habillage à l'affichage** :

- **Même police, 3 graisses** (`OmegaDys-{Light,Regular,Heavy}.ttf`, même générateur) ; la couche
  de rendu pose des `<span>` par graphème : phonème voisé → Heavy, sourd → Light, muette → grisé.
  Précédents du principe « échafaudage retirable » : LireCouleur (couleur), furigana, hébreu pointé.
- **PUA U+E000/E001 : DÉPRÉCIÉS** pour le web (substituer des caractères = texte cassé au
  copier-coller). Conservés dans la TTF pour d'éventuels rendus fermés (canvas/print).
- **Branché sur le g2p RÉEL** : `build_son_layer.py` → `son_layer.json` (decompose/g2p double
  route + table fermée des mots-fonction) ; garantie testée à la génération : chaque phrase se
  reconstruit à l'identique depuis les segments. Démo §5 + `apercu_son.png`.
- **Bug moteur découvert au branchement** (et signalé en tâche séparée, doctrine §4) : la branche
  DBL de `decompose.g2p` rend les doubles consonnes muettes (`poisson`→/pwa§/, `assis`→/ai/) et
  `g2p_corrections.json` a APPRIS `ss→∅` ; contournement local documenté dans `build_son_layer.py`
  en attendant le correctif mesuré (held-out). **Confirmé dans l'app** (`_DECL2.g2p`, même défaut
  `COND[g[0]]['_']` dans la branche DBL) — le contournement `DBL_FIX` est porté dans `son_core.js`
  et devient inerte quand le moteur sera corrigé.
- **Intégrée dans l'APP** (banc de mesure = la dictée) : bloc idempotent `OMEGADYS-SON`
  (`inject_fonts.py` : 3 TTF base64 + `son_core.js` sans DOM + `son_ui.js`) → case
  « Police de son » dans les réglages de la dictée (OFF par défaut, localStorage `vdd_son`,
  polices chargées paresseusement). La phrase correcte (`.vdd-truth`, y compris Repère/Conjugue)
  est habillée par le g2p moteur : voisé=Heavy, sourd=Light, muette=gris foncé — texte DOM
  identique. Parité CI `parity_son.js` : fraîcheur du bloc, clitiques ≡ Python, texte jamais
  altéré, ancres poison/poisson/chats.

## Couleur & daltonisme (ajout 2026-08-21, retour terrain : « le gris clair est dur à lire »)

Ce que dit la littérature couleur×dyslexie :

- **Fond crème / pastel, pas blanc pur** (éblouissement, distorsion au contraste extrême) et texte
  foncé **pas noir pur** — recommandation BDA (Style Guide). Notre démo l'avait déjà en aveugle
  (`#f7f5ef` / `#1c2431`). Les **gris faibles sont déconseillés** — le retour terrain concorde.
- **Overlays/filtres colorés** : preuve d'efficacité **manquante** (position BDA elle-même
  prudente) — ne pas investir là.
- **Daltonisme** (~8 % des hommes) : jamais rouge/vert ; palette **Okabe-Ito** (vermillon/bleu/
  violet) ; et surtout **la couleur ne doit jamais être le seul canal** — chez nous l'information
  voisée/sourde est portée par la **graisse**, la couleur n'est qu'un renfort.

Décisions appliquées (démo + aperçu) :

| Élément | Avant | Après |
|---|---|---|
| Muette | `opacity .28` (illisible) → gris foncé `#5f6672` (retour terrain : « le gris, c'est pénible ») | **vermillon Okabe-Ito** `#a34700` sur clair / `#f0a04b` sur sombre (≥ 4,5:1) — la paire vermillon/bleu est LA paire daltonien-sûre (les syllabes étant en bleu) |
| Paires voisée/sourde (renfort) | rouge sombre / bleu | Okabe-Ito assombri `#a34700` / `#0072b2` (≥ 4,5:1) |
| Soulignés graphèmes | vert | violet `#8b5a9e` (plus de vert dans la page) |

## Sources

- [Méta-analyse 2026 — polices dys sans effet fiable](https://link.springer.com/article/10.1007/s11881-026-00389-8) · [PubMed](https://pubmed.ncbi.nlm.nih.gov/42536336/)
- [Dyslexie font sans bénéfice (2017)](https://link.springer.com/article/10.1007/s11881-017-0154-6) · [OpenDyslexic plus lent (PMC 2017)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5629233/)
- [Zorzi et al. 2012, PNAS — l'espacement extra-large améliore la lecture](https://www.pnas.org/doi/10.1073/pnas.1205566109) · [PMC — interletter spacing](https://pmc.ncbi.nlm.nih.gov/articles/PMC3497831/) · [Réplication overlays/spacing 2021](https://www.sciencedirect.com/science/article/abs/pii/S0891422221002146)
- [Visible Speech (Bell, 1867)](https://en.wikipedia.org/wiki/Visible_Speech)
- [Apprentissage graphème-phonème chez dyslexiques (Frontiers 2018)](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2018.01393/full)
- [LireCouleur (Primàbord/Éduscol)](https://primabord.eduscol.education.fr/lirecouleur) · [LireCouleur — présentation ASH](https://ash.dsden02.ac-amiens.fr/290-lirecouleur.html) · [dysclick — LireCouleur](https://dysclick.fr/outils/lirecouleur/)
- Couleur : [BDA Style Guide 2023 (PDF)](https://cdn.bdadyslexia.org.uk/uploads/documents/Advice/style-guide/BDA-Style-Guide-2023.pdf) · [Dyslexia Scotland — contraste](https://dyslexiascotland.org.uk/contrasting-advice-what-colours-are-best-for-accessibility/) · [Cardiff Univ. — couleur inclusive](https://blogs.cardiff.ac.uk/LTAcademy/not-just-pretty-colours-using-colour-and-contrast-inclusively/) · [palette Okabe-Ito](https://scifig.ai/blog/okabe-ito-color-palette-hex-codes)
