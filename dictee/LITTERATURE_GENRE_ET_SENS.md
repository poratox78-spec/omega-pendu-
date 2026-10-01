# Revue de littérature : genre de la personne qui écrit, juge de sens (01/10/2026)

Demandée par Rem pour le **lot C** du catalogue des muets (`dictee/CATALOGUE_MUETS.md`) : les fautes que le texte seul ne permet pas de corriger.
Sources ouvertes et lues le 01/10/2026 ; les chiffres viennent des textes eux-mêmes. Une source lue seulement à travers une autre est dite « non vérifiée ».

**Trois pièges vus pendant la recherche**
- Un résumé de moteur de recherche prêtait à LanguageTool un réglage de genre : il n'existe pas. La description était celle de Scribens.
- Des chiffres « son/sont 55 → 88 % » attribués à un mémoire universitaire venaient en fait de notre page `recherche` : une mesure d'OMEGA, pas de la littérature.
- Un outil de lecture a inventé des scores BLEU pour Vanmassenhove et al. ; ceux d'ici ont été relus dans le PDF.

---

## 1. Réglage « j'écris au féminin / au masculin / je ne précise pas »

Le problème : « je suis allé / allée », « je me suis trompé / trompée », « je suis content / contente ». Le genre de « je » n'est pas dans le texte. Aujourd'hui le moteur garde le genre écrit et se tait. Dans le gold : 7 fautes muettes et 7 mots faux en dépendent.

### Ce que font les autres correcteurs

| Outil | Réglage ? | Détail |
|---|---|---|
| **Antidote 12** | **oui** | Réglages linguistiques, panneau **« Protagonistes »**. Pronoms je, tu, nous, vous (pas « on »). Genre : féminin, masculin ou **« selon le cas »** (valeur à l'installation). Druide conseille de le fixer quand c'est possible. Aucune valeur non binaire. Le panneau « Auteur » ne contient pas de genre. |
| **BonPatron** | **oui** | Une case sur la page d'accueil : « je » est-il féminin ? |
| Scribens | probablement | Option « genre des pronoms » citée par 3 sources secondaires concordantes ; pas trouvée dans sa documentation. |
| LanguageTool, Grammalecte, MerciApp, Word/Editor, Google Docs | non trouvé | Rien dans les documentations consultées. |

### Ce que dit la recherche

- **Fournir le genre plutôt que le deviner.** En traduction automatique, un jeton FEMALE/MALE tiré des métadonnées améliore la traduction des phrases en « je » au féminin (Vanmassenhove et al. 2018). Sur MuST-SHE, anglais → français, les formes féminines passent de 20,4 % justes / 37,5 % fausses sans information à 53,7 % justes / 7,0 % fausses avec le genre fourni (Bentivogli et al. 2020).
- **Mais seulement pour le « je » de la personne.** Dans environ la moitié des segments de MuST-SHE, le mot accordé ne renvoie pas à la personne qui parle : là, l'information ajoute du bruit (Bentivogli et al. 2020). Même idée en arabe : préférences séparées pour « je » et pour « tu » (Alhafni et al. 2022).
- **Ne jamais déduire le genre**, ni d'un prénom ni de la voix : c'est faire des hypothèses non autorisées sur l'identité de quelqu'un (Savoldi et al. 2021 ; Gaido et al. 2020). Sans information, proposer les deux formes et laisser choisir (Habash et al. 2019 ; Google Traduction, Johnson 2018).

### « Je ne précise pas », écriture inclusive

- L'OQLF recommande les formulations neutres et les doublets complets ; elle déconseille les doublets abrégés par un signe et les néologismes comme « iel ».
- La FFDys déconseille d'exposer au point médian les jeunes lecteurs et les lecteurs dyslexiques fragiles ; la synthèse vocale le lit mal. La circulaire du 5 mai 2021 le proscrit à l'école en citant les élèves avec troubles d'apprentissage.
- Oculométrie : les doublets complets n'ont pas de coût de lecture, les formes contractées en ont un (Tibblin et al. 2026) — **aucune donnée chez les lecteurs dys**.
- Les personnes non binaires emploient des formes variées ; cette variation fait partie de leur autonomie (Knisely 2020).

### Vie privée

- Le genre n'est pas dans la liste des données sensibles de l'article 9 du RGPD ; une donnée qui en révèle une **indirectement** en relève (CJUE C-184/20).
- Une civilité n'est pas « indispensable » pour un service quand une formule neutre suffit (CJUE C-394/23, *Mousse*) : demander la grammaire (« j'écris au féminin »), pas l'identité.
- CNIL (applications mobiles, 2024) : un traitement lancé par l'utilisateur, qui reste dans son appareil sans tiers, ne fait pas de l'éditeur un responsable de traitement.
- Dans Chrome, `chrome.storage.local` reste sur la machine ; `chrome.storage.sync` suit le compte Google.

### Ce que ça décide pour OMEGA

1. **Trois choix, « je ne précise pas » par défaut** : c'est le comportement actuel (silence). On ne devine jamais.
2. **Une question de grammaire** : « J'écris au féminin / au masculin / je ne précise pas ».
3. **Portée stricte** : les accords commandés par le « je » de la personne qui écrit — participe avec être (« je suis allée »), attribut (« je suis contente »), pronominal qui s'accorde (« je me suis trompée »). Exclus : « je me suis coupé le doigt », « je me suis demandé », « je me suis rendu compte ». Rien pour tu/nous/vous.
4. **Rien entre guillemets ni sur une ligne de dialogue** : le « je » peut être celui d'un personnage.
5. **Orange** : l'information vient du réglage, pas du texte. Une dictée, un récit, un texte écrit pour quelqu'un d'autre peuvent faire parler un autre « je ».
6. **« Je ne précise pas »** : accepter en silence le masculin, le féminin et les formes abrégées ; **ne jamais proposer de point médian**.
7. **Stockage local seulement** (`chrome.storage.local`, `localStorage`), jamais transmis ; revenir à « je ne précise pas » l'efface. À dire dans le mode d'emploi et la page Confidentialité.

Risque principal : un réglage oublié s'applique au mauvais texte. Parades : portée stricte, orange, et l'explication de la marque rappelle le réglage.

---

## 2. Juge de sens : vrais mots mal employés, homophones

Le problème : dans le gold, 93 vrais mots à la place d'un autre et 30 homophones que seul le sens tranche.

### Ce que font les autres

- **LanguageTool** (règle n-grammes, ~8 Go de données pour le français) : un seuil par paire **et par sens** (« sans → cent » n'est pas « cent → sans »). Son fichier français note précision, rappel et fausses alertes pour 10 000 mots, et **coupe toute paire sous 0,99 de précision** ou au-dessus de 0,025 fausse alerte pour 10 000 mots. « cent → sans » (p 0,997, r 0,80) est coupée ; « ces/ses », « à/a », « mer/mère » sont désactivées ; « verre → vers » (p 1,0, r 0,71) est active.
- Sur des textes dys, les correcteurs du commerce ratent la majorité des vrais mots : Word 2007 P 90 % R 41 % sur le corpus anglais de Pedler (After the Deadline, 2010) ; dictées d'enfants dysorthographiques en français : 31 à 41 % des erreurs ne sont même pas détectées, surtout les vrais mots (Antoine et al. 2019).

### Ce que dit la recherche

- **Classique** (ensembles de confusion + n-grammes ou classifieurs) : 94,5 % d'exactitude en tranchant tout, **99,0 % en s'abstenant sur 14 % des cas** (Carlson et al. 2001). Un paramètre « le mot écrit est probablement juste » règle le compromis (Wilcox-O'Hearn et al. 2008). Le vrai problème est la **détection** : départager deux mots donnés est facile, trouver lequel est faux sans créer d'alertes ne l'est pas (Wilcox-O'Hearn 2014).
- **Dyslexie** : Pedler 2007 — 830 vrais mots fautifs dans 11 810 mots ; correction de 31 % des erreurs avec des fausses alertes sur 0,6 % des emplois justes, grâce à un « handicap » qui favorise le mot écrit (sans lui, plus de fausses alertes que de corrections). Son argument : **les dys acceptent ce que propose le correcteur, donc une fausse alerte fabrique une faute.** Rello et al. 2015 (espagnol) : la mise en évidence seule aide déjà, mais leur test ne contenait que des phrases fautives — coût des fausses alertes non mesuré.
- **Français** : chez Antoine et al. 2019, les vrais mots font 29 % des erreurs, dont **3 % seulement sont sémantiques** ; chez Bodard 2020, les formes les plus touchées sont à, peut, ils, ont, c'est, est — de la syntaxe.
- **Neuronal** : on garde la phrase écrite sauf si la candidate la dépasse d'une marge (Bryant & Briscoe 2018 ; Alikaniotis & Raheja 2019) — c'est le principe de notre juge. Aucune évaluation publiée d'un modèle neuronal sur les homophones du français n'a été trouvée.
- **Dans le navigateur** : DistilCamemBERT ≈ 34 Mo en q4, CamemBERT ≈ 56 Mo (notre paquet fait 5,6 Mo, notre juge 15 Mo). L'IA intégrée à Chrome (Prompt API, français depuis Chrome 149) ne donne **aucune probabilité** : elle ne peut pas comparer deux phrases ; la Proofreader API est encore en essai.

### Ce que ça décide pour OMEGA

1. **Le volume est dans la syntaxe** (à/a, peut/peu, ils/il, ont/on, c'est/ses/ces, est/et) : règles et cartes d'abord — c'est le travail du catalogue.
2. **Un seuil par paire et par sens**, admis seulement si la précision mesurée sur du français correct atteint 0,99 (critère de LanguageTool), avec le taux de fausses alertes sur les emplois justes du corpus dys (protocole de Pedler).
3. **Marge en faveur du mot écrit**, au plus une marque par phrase, **orange** pour les paires sémantiques (ces/ses, mer/mère, sans/cent, vers/verre).
4. **Extension** : pas de modèle (27 à 111 Mo) ; des tables distillées pour les seules paires retenues, comme les cartes déjà embarquées.
5. **Site** : un modèle plus gros, en option, seulement s'il bat le juge actuel **au même budget de fausses alertes**.
6. **Petit effectif** (93 + 30) : seuils réglés par validation croisée, figés sur un autre corpus.

---

## Références

Vérifiées (page ou PDF ouverts le 01/10/2026) :

- Alhafni, B., Habash, N. & Bouamor, H. (2022). User-Centric Gender Rewriting. *NAACL 2022*. https://aclanthology.org/2022.naacl-main.46/ (résumé)
- Alikaniotis, D. & Raheja, V. (2019). The Unreasonable Effectiveness of Transformer Language Models in Grammatical Error Correction. *BEA 2019*. https://aclanthology.org/W19-4412/
- Antoine, J.-Y. et al. (2019). Ma copie adore le vélo : analyse des besoins réels en correction orthographique sur un corpus de dictées d'enfants. *TALN 2019*. https://aclanthology.org/2019.jeptalnrecital-court.19/
- Bentivogli, L. et al. (2020). Gender in Danger? Evaluating Speech Translation Technology on the MuST-SHE Corpus. *ACL 2020*. https://aclanthology.org/2020.acl-main.619/
- Bodard, J. (2020). Spécificités des erreurs d'orthographe des personnes dyslexiques. *RECITAL 2020*. https://aclanthology.org/2020.jeptalnrecital-recital.2/
- BonPatron, page d'accueil. https://bonpatron.com/
- Bryant, C. & Briscoe, T. (2018). Language Model Based Grammatical Error Correction without Annotated Training Data. *BEA 2018*. https://aclanthology.org/W18-0529/
- Carlson, A. J., Rosen, J. & Roth, D. (2001). Scaling Up Context-Sensitive Text Correction. *IAAI-01*. http://www.cs.cmu.edu/~acarlson/papers/carlson-iaai-01.pdf
- Chrome for Developers : API `chrome.storage` ; Prompt API ; Proofreader API. https://developer.chrome.com/docs/extensions/reference/api/storage · https://developer.chrome.com/docs/ai/prompt-api · https://developer.chrome.com/docs/ai/proofreader-api
- CJUE, communiqué n° 2/25, affaire C-394/23 *Mousse* (9/01/2025). https://curia.europa.eu/site/upload/docs/application/pdf/2025-01/cp250002en.pdf
- CNIL (2024). Recommandation relative aux applications mobiles. https://www.cnil.fr/sites/cnil/files/2024-09/recommandation-applications-mobiles.pdf
- Druide, Antidote 12 : panneaux « Protagonistes » et « Auteur ». https://www.antidote.info/fr/documentation/guide-utilisation/les-reglages/reglages-linguistiques/panneau-protagonistes
- FFDys (2018, mise à jour 2020). Écriture inclusive et dyslexie : l'avis de la FFDys. https://www.ffdys.com/actualites/ecriture-inclusive-et-dyslexie-lavis-de-la-ffdys/
- Gaido, M. et al. (2020). Breeding Gender-aware Direct Speech Translation Systems. *COLING 2020*. https://aclanthology.org/2020.coling-main.350/ (résumé)
- Habash, N., Bouamor, H. & Chung, C. (2019). Automatic Gender Identification and Reinflection in Arabic. *GeBNLP 2019*. https://aclanthology.org/W19-3822/ (résumé)
- Johnson, M. (2018). Providing Gender-Specific Translations in Google Translate. Google AI Blog. https://research.google/blog/providing-gender-specific-translations-in-google-translate/
- Knisely, K. A. (2020). Le français non-binaire. *Foreign Language Annals* 53(4). (résumé)
- LanguageTool. Finding errors using n-gram data ; `confusion_sets.txt` (français). https://dev.languagetool.org/finding-errors-using-n-gram-data
- Mudge, R. (2010). Measuring the Real Word Error Corrector. Blog After the Deadline. https://blog.afterthedeadline.com/2010/04/09/measuring-the-real-word-error-corrector/
- OQLF (2025). Rédaction épicène, formulation neutre, rédaction non binaire et écriture inclusive. Banque de dépannage linguistique.
- Pedler, J. (2007). *Computer Correction of Real-word Spelling Errors in Dyslexic Text*. Thèse, Birkbeck. https://www.dcs.bbk.ac.uk/site/assets/files/1025/pedler.pdf
- Pedler, J. & Mitton, R. (2010). A Large List of Confusion Sets for Spellchecking Assessed Against a Corpus of Real-word Errors. *LREC 2010*. https://aclanthology.org/L10-1077/
- Rello, L., Ballesteros, M. & Bigham, J. P. (2015). A Spellchecker for Dyslexia. *ASSETS '15*. DOI 10.1145/2700648.2809850
- Savoldi, B. et al. (2021). Gender Bias in Machine Translation. *TACL* 9. https://aclanthology.org/2021.tacl-1.51/
- Tibblin, J. et al. (2026). Recognized but harder to integrate: an eye-tracking study of French gender-fair forms during reading. *Applied Psycholinguistics* 47.
- Vanmassenhove, E., Hardmeier, C. & Way, A. (2018). Getting Gender Right in Neural Machine Translation. *EMNLP 2018*. https://aclanthology.org/D18-1334/
- Wilcox-O'Hearn, A., Hirst, G. & Budanitsky, A. (2008). Real-Word Spelling Correction with Trigrams. *CICLing 2008*. https://www.cs.toronto.edu/pub/gh/WilcoxOHearn-etal-2008.pdf
- Wilcox-O'Hearn, L. A. (2014). Detection is the central problem in real-word spelling correction. arXiv:1408.3153 (résumé)

Non vérifiées : Mays, Damerau & Mercer (1991) et Hirst & Budanitsky (2005), lus à travers Pedler 2007 et Wilcox-O'Hearn 2008 ; Carrier (2025), mémoire de maîtrise (Université Laval) sur la correction orthographique contextuelle — PDF inaccessible, à lire en priorité pour le juge de sens.
