Objet : OMEGA-Ω — une architecture cognitive du pendu français bâtie sur Lexique 4

Bonjour Christophe,

Merci beaucoup pour l'admission au groupe et pour votre intérêt — cela me
touche, Lexique étant au cœur du projet.

En deux mots : OMEGA-Ω est une architecture cognitive qui joue au pendu
français en *raisonnant* plutôt qu'en consultant un dictionnaire. Sous la
contrainte « cognition > oracle » (aucun module ne lit le mot caché hors des
lettres révélées), la cognition seule atteint ~90 %, et ~97,5 % avec un
système de déclaration *cheat-free* — sans jamais utiliser le lexique pour
choisir une lettre (le lookup lexical, ~98,7 %, n'est mesuré que comme
plafond et reste explicitement exclu de la décision). L'intérêt n'est pas le
score, mais la méthode (mesurer / falsifier avant de garder) et la
cartographie de ce qui généralise.

Le moteur instancie la double route de lecture (DRC, Coltheart 2001) : voie
orthographique ∥ voie phonologique (SAMPA, depuis le champ `phono` de
Lexique 4), arbitrées par un module d'OS. Un résultat qui pourrait vous
parler : le profil des défaites reproduit une signature de dyslexie
phonologique (58 % de confusions voisée/sourde). De là une application
dérivée — une dictée diagnostique ciblant les troubles de l'écrit (dys),
bâtie sur cette même double route.

Tout repose sur Lexique 4 (New et al., 2026), cité et redistribué sous
CC BY-SA 4.0 (attribution + partage à l'identique), conformément à la licence.

Vous trouverez ci-joint :
  - le mémoire de recherche (architecture, méthode, résultats — y compris
    les résultats négatifs) ;
  - le rapport de référence & mode d'emploi (modules, interrupteurs, cadre
    anti-triche ; §8.3 = la configuration exacte à activer ; §18 = dictée) ;
  - l'application complète en un seul fichier HTML, autonome, sans
    dépendance ni serveur — à ouvrir dans un navigateur récent (lexique
    embarqué compressé) ; bouton « ▶ Auto » pour jouer, panneau de mesure
    A/B seedé, « ✍️ Dictée diag » pour la dictée.

Le code : https://github.com/poratox78-spec/omega-pendu-
Single-file, sans build ; chaque module est derrière un interrupteur
OFF-inerte (sortie byte-identique éteint), avec un harnais de mesure
déterministe (graines fixées) — la discipline « R66 » du projet. (Au
démarrage les interrupteurs sont OFF ; la config optimale cheat-free à
activer est détaillée dans le rapport, §8.3.)

Concernant openlexicon : ce serait un honneur, j'y suis tout à fait ouvert.
Par souci de transparence : la validation de la dictée est encore synthétique
(pas de copies d'élèves réelles) — un retour, ou une mise en relation avec
des orthophonistes pour une validation terrain, aurait beaucoup de valeur.

Je reste à votre disposition pour une démonstration ou toute question.

Bien cordialement,
