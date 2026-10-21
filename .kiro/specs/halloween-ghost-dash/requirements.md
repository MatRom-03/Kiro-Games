# Requirements Document

## Introduction

Halloween Ghost Dash est un jeu de plateforme 2D rétro sur le thème d'Halloween. Le joueur incarne un fantôme (blanc ou noir) qui collecte 15 bonbons dans un niveau avant la fin d'un compte à rebours de 45 secondes, tout en évitant ou en détruisant des sorcières patrouilleuses. Le gameplay s'inspire des plateformes de type Mario (déplacement latéral, gravité, saut) et ajoute une mécanique de tir à distance. L'application repose sur une architecture client-serveur découplée : un frontend Phaser 3 qui gère le rendu, la physique et la logique de jeu, et un backend Node.js/Express qui expose une API REST pour la persistance d'un tableau des scores. L'ensemble est conteneurisé via Docker et démarre en local avec `docker compose up --build`.

Ce document dérive les exigences au format EARS à partir du document de conception approuvé (`design.md`) et du guide de gameplay (`gameplay.md`).

## Glossary

- **Launcher** : Scène de lancement affichant le logo, la saisie du pseudo, le choix du skin, le rappel des touches et le bouton de lancement.
- **Game** : Scène de jeu principale exécutant la boucle de gameplay (physique, timer, HUD, collecte, combat).
- **GameOver** : Scène de fin affichant l'issue de la partie, le score et les boutons de navigation.
- **Scoreboard** : Scène affichant le Top 10 des scores dans un style arcade.
- **Settings** : Scène de réglages gérant le son et le rappel des raccourcis.
- **Player** : Entité fantôme contrôlée par le joueur.
- **Witch** : Entité sorcière ennemie qui patrouille horizontalement sur une plateforme.
- **Projectile** : Bonbon magique tiré par le Player pour détruire une Witch.
- **HUD** : Interface en jeu affichant les cœurs, le compteur de bonbons et le timer.
- **Candy_Counter** : Compteur des bonbons collectés affiché sous la forme `x / 15`.
- **Timer** : Compte à rebours de la partie, exprimé en secondes.
- **Backend_API** : Service REST Express exposant `POST /api/scores` et `GET /api/scores`.
- **Score_Store** : Couche de persistance JSON écrivant dans `backend/data/scores.json`.
- **ScoreRecord** : Enregistrement de score persisté `{ username, score, duration, date }`.
- **TextureFactory** : Composant générant les textures de façon procédurale par code.
- **Skin** : Variante esthétique du fantôme, `white` ou `black`.
- **Invulnerability** : État temporaire du Player durant lequel aucun cœur ne peut être perdu.

## Requirements

### Requirement 1: Choix du skin au lancement

**User Story:** As a joueur, I want choisir le skin de mon fantôme au lancement, so that je joue avec l'apparence que je préfère.

#### Acceptance Criteria

1. WHEN le Launcher est affiché, THE Launcher SHALL proposer un choix entre le Skin `white` et le Skin `black` sans qu'aucun des deux ne soit présélectionné par défaut.
2. WHEN le joueur sélectionne un Skin, THE Launcher SHALL retenir ce Skin comme sélection active et désélectionner tout autre Skin, de sorte qu'au plus un Skin soit sélectionné à la fois.
3. WHILE un Skin est sélectionné, THE Launcher SHALL afficher une indication visuelle distinguant le Skin sélectionné du Skin non sélectionné.
4. IF le joueur tente de lancer une partie sans avoir sélectionné de Skin, THEN THE Launcher SHALL empêcher le lancement, maintenir l'affichage du Launcher et afficher une indication non bloquante signalant qu'un Skin doit être sélectionné.
5. WHEN le joueur lance la partie alors qu'un Skin est sélectionné, THE Launcher SHALL transmettre le Skin sélectionné à la Game.
6. WHEN la Game reçoit le Skin sélectionné, THE Game SHALL afficher le Player avec la variante esthétique correspondant à ce Skin.
7. THE Player SHALL présenter un comportement, une physique et des capacités identiques quel que soit le Skin sélectionné.

### Requirement 2: Saisie du pseudo au lancement

**User Story:** As a joueur, I want saisir un pseudo sans mot de passe, so that mon score puisse être associé à mon identité dans le tableau des scores.

#### Acceptance Criteria

1. THE Launcher SHALL fournir un champ de saisie de pseudo sans champ de mot de passe.
2. IF le joueur tente de lancer une partie avec un pseudo vide ou composé uniquement d'espaces, THEN THE Launcher SHALL empêcher le lancement et maintenir l'affichage du Launcher.
3. WHEN le joueur saisit un pseudo dépassant 20 caractères, THE Launcher SHALL limiter le pseudo retenu à 20 caractères.
4. WHEN le joueur lance la partie, THE Launcher SHALL transmettre le pseudo saisi à la Game.

### Requirement 3: Déplacement latéral et gravité du fantôme

**User Story:** As a joueur, I want déplacer le fantôme et subir la gravité comme dans un jeu de plateforme, so that je puisse naviguer dans le niveau.

#### Acceptance Criteria

1. WHEN le joueur appuie sur la touche de déplacement gauche (Flèche Gauche ou Q), THE Player SHALL se déplacer vers la gauche à la vitesse latérale configurée.
2. WHEN le joueur appuie sur la touche de déplacement droite (Flèche Droite ou D), THE Player SHALL se déplacer vers la droite à la vitesse latérale configurée.
3. THE Game SHALL appliquer une gravité verticale constante au Player.
4. WHILE le Player n'est pas en contact avec une surface, THE Game SHALL faire chuter le Player vers le sol sous l'effet de la gravité.

### Requirement 4: Saut sur les plateformes

**User Story:** As a joueur, I want sauter uniquement depuis une surface, so that je puisse atteindre les plateformes en hauteur.

#### Acceptance Criteria

1. WHILE le Player est en contact avec une surface, WHEN le joueur appuie sur la touche de saut (Espace ou Flèche Haut), THE Player SHALL appliquer la vélocité de saut configurée vers le haut.
2. IF le Player n'est pas en contact avec une surface, THEN THE Player SHALL ignorer la commande de saut.

### Requirement 5: Collecte des bonbons et objectif de victoire

**User Story:** As a joueur, I want collecter des bonbons dans le niveau, so that j'atteigne l'objectif de 15 bonbons.

#### Acceptance Criteria

1. THE Game SHALL placer 15 bonbons collectables répartis dans le niveau.
2. WHEN le Player entre en contact avec un bonbon collectable, THE Game SHALL récolter le bonbon et incrémenter le Candy_Counter de 1.
3. WHEN le Candy_Counter atteint 15 avant la fin du Timer, THE Game SHALL déclarer la victoire.
4. THE HUD SHALL afficher le Candy_Counter sous la forme `x / 15`.

### Requirement 6: Compte à rebours de la partie

**User Story:** As a joueur, I want disposer d'un temps limité, so that la partie reste une course contre la montre.

#### Acceptance Criteria

1. WHEN la Game démarre, THE Timer SHALL être initialisé à 45 secondes.
2. WHILE la partie est en cours, THE Timer SHALL décrémenter d'une seconde chaque seconde écoulée.
3. THE HUD SHALL afficher la valeur courante du Timer de façon dynamique.
4. IF le Timer atteint 0 avant que le Candy_Counter atteigne 15, THEN THE Game SHALL déclarer la défaite.

### Requirement 7: Cœurs de vie et dégâts au contact d'une sorcière

**User Story:** As a joueur, I want survivre aux sorcières, so that je conserve mes cœurs de vie durant la partie.

#### Acceptance Criteria

1. WHEN la Game démarre, THE Player SHALL être initialisé avec exactement 3 cœurs de vie.
2. IF le Player entre en contact avec une Witch alors qu'il n'est pas en Invulnerability et que son nombre de cœurs est supérieur à 0, THEN THE Player SHALL décrémenter son nombre de cœurs de 1 sans jamais descendre en dessous de 0.
3. WHEN le Player perd un cœur au contact d'une Witch, THE Player SHALL entrer en Invulnerability pendant 1,5 seconde.
4. WHILE le Player est en Invulnerability, THE Player SHALL ignorer tout dégât supplémentaire au contact d'une Witch et conserver son nombre de cœurs inchangé.
5. WHILE le Player est en Invulnerability, THE Player SHALL alterner son affichage entre visible et masqué à une fréquence comprise entre 5 et 10 cycles par seconde.
6. WHEN la période d'Invulnerability de 1,5 seconde se termine, THE Player SHALL cesser de clignoter et redevenir affiché en continu.
7. IF le nombre de cœurs du Player atteint 0, THEN THE Game SHALL déclarer la défaite une seule fois.
8. THE HUD SHALL afficher le nombre de cœurs restants du Player, compris entre 0 et 3.

### Requirement 8: Patrouille des sorcières

**User Story:** As a joueur, I want des sorcières qui patrouillent, so that le niveau présente un défi d'évitement.

#### Acceptance Criteria

1. THE Witch SHALL patrouiller horizontalement sur sa plateforme entre une borne gauche et une borne droite.
2. WHEN une Witch atteint une borne de patrouille, THE Witch SHALL inverser sa direction de déplacement.

### Requirement 9: Tir de projectiles et destruction des sorcières

**User Story:** As a joueur, I want tirer des projectiles de bonbons magiques, so that je puisse détruire les sorcières à distance.

#### Acceptance Criteria

1. WHEN le joueur appuie sur la touche de tir (F ou E) et qu'au moins 400 millisecondes se sont écoulées depuis le dernier Projectile émis, THE Player SHALL émettre un Projectile à partir de sa position courante, dans sa direction horizontale courante.
2. WHILE le Player ne s'est déplacé ni vers la gauche ni vers la droite depuis le début de la partie, WHEN le joueur appuie sur la touche de tir, THE Player SHALL émettre le Projectile vers la droite par défaut.
3. IF le joueur appuie sur la touche de tir alors que moins de 400 millisecondes se sont écoulées depuis le dernier Projectile émis, THEN THE Player SHALL ignorer la commande de tir sans émettre de Projectile.
4. WHEN le Player émet un Projectile, THE Game SHALL déplacer le Projectile en ligne droite à la vitesse horizontale configurée, sans appliquer l'effet de la gravité.
5. WHEN un Projectile entre en contact avec une Witch, THE Game SHALL détruire la Witch et retirer le Projectile du jeu.
6. IF un Projectile sort des limites du niveau sans avoir touché de Witch, THEN THE Game SHALL retirer le Projectile du jeu.
7. WHEN le Player émet un Projectile ou qu'une Witch est détruite par un Projectile, THE Game SHALL laisser le Candy_Counter inchangé.

### Requirement 10: Calcul du score et écran de fin

**User Story:** As a joueur, I want voir mon score et des options à la fin de la partie, so that je puisse rejouer ou consulter mon classement.

#### Acceptance Criteria

1. WHEN une partie se termine, THE GameOver SHALL calculer le score comme un entier non négatif selon la formule `((15 − Candy_Counter) × 100) + (secondes restantes du Timer × 50)`, en utilisant la valeur du Candy_Counter et la valeur du Timer au moment de la fin de partie.
2. WHEN une partie se termine par une victoire (Candy_Counter égal à 15), THE GameOver SHALL utiliser une valeur de bonbons restants égale à 0 dans le calcul du score.
3. WHEN le GameOver est affiché, THE GameOver SHALL afficher l'issue de la partie (victoire ou défaite) et le score calculé.
4. WHEN le GameOver est affiché, THE GameOver SHALL présenter un bouton « Rejouer » et un bouton « Voir le tableau des scores ».
5. WHEN le joueur active le bouton « Rejouer », THE GameOver SHALL démarrer une nouvelle Game avec le même pseudo et le même Skin.
6. WHEN le joueur active le bouton « Voir le tableau des scores », THE GameOver SHALL afficher le Scoreboard.
7. WHEN le GameOver est affiché, THE GameOver SHALL envoyer au Backend_API via `POST /api/scores`, une seule fois par partie, un corps contenant le pseudo du joueur, le score calculé et la durée écoulée en secondes.
8. IF l'envoi du score au Backend_API échoue, THEN THE GameOver SHALL afficher un message non bloquant indiquant que l'enregistrement du score a échoué, conserver l'affichage du score calculé et laisser le bouton « Rejouer » actif.

### Requirement 11: Interface du Launcher

**User Story:** As a joueur, I want un launcher clair, so that je comprenne les contrôles avant de jouer.

#### Acceptance Criteria

1. THE Launcher SHALL afficher un logo coloré sur un fond noir avec des yeux orange.
2. THE Launcher SHALL afficher un tableau des touches de contrôle.
3. THE Launcher SHALL présenter un bouton de lancement de la partie.
4. WHERE le joueur demande les réglages, THE Launcher SHALL permettre d'accéder au Settings.

### Requirement 12: Tableau des scores

**User Story:** As a joueur, I want consulter un classement, so that je puisse comparer mon score aux autres.

#### Acceptance Criteria

1. WHEN le Scoreboard est affiché, THE Scoreboard SHALL récupérer les scores via `GET /api/scores`.
2. THE Scoreboard SHALL afficher au maximum les 10 meilleurs scores dans un style arcade avec les colonnes Rang, Pseudo, Score et Date.
3. IF aucun score n'est disponible ou que la récupération échoue, THEN THE Scoreboard SHALL afficher un message indiquant l'absence de scores.
4. WHEN le Scoreboard affiche un pseudo, THE Scoreboard SHALL échapper le pseudo pour éviter l'injection HTML.

### Requirement 13: Réglages

**User Story:** As a joueur, I want régler le son et revoir les raccourcis, so that je personnalise mon expérience de jeu.

#### Acceptance Criteria

1. THE Settings SHALL fournir un bouton de bascule pour couper et réactiver le son.
2. WHEN le joueur bascule le son, THE Settings SHALL appliquer l'état de son choisi au jeu.
3. THE Settings SHALL afficher un rappel des raccourcis clavier.

### Requirement 14: Génération procédurale des assets

**User Story:** As a développeur, I want des assets générés par code, so that le jeu démarre sans dépendance d'assets externe.

#### Acceptance Criteria

1. THE TextureFactory SHALL générer par code les textures du fantôme (blanc et noir), de la sorcière, du bonbon, des blocs et du projectile.
2. WHEN le jeu démarre, THE Game SHALL utiliser uniquement des textures générées de façon procédurale ou des données vectorielles intégrées, sans charger de ressource graphique réseau.

### Requirement 15: Enregistrement d'un score (POST)

**User Story:** As a joueur, I want que mon score soit enregistré, so that il figure dans le classement persistant.

#### Acceptance Criteria

1. WHEN le Backend_API reçoit une requête `POST /api/scores` dont le corps contient un `username` de type chaîne qui, après suppression des espaces de début et de fin, est non vide et comporte au plus 20 caractères, un `score` entier compris entre 0 et 999 999 999 inclus et une `duration` entière comprise entre 0 et 999 999 999 inclus, THE Backend_API SHALL enregistrer un ScoreRecord et répondre avec le code 201 et l'enregistrement créé.
2. WHEN le Backend_API enregistre un ScoreRecord, THE Backend_API SHALL ajouter un champ `date` au format ISO 8601 généré côté serveur et inclure ce champ dans l'enregistrement renvoyé.
3. IF le Backend_API reçoit une requête `POST /api/scores` dont le corps présente au moins une des conditions suivantes — un champ `username`, `score` ou `duration` manquant, un `username` vide ou composé uniquement d'espaces ou de plus de 20 caractères, un `score` ou une `duration` non entier, négatif ou supérieur à 999 999 999 — THEN THE Backend_API SHALL rejeter la requête sans persister de ScoreRecord et répondre avec le code 400 et un message d'erreur indiquant le champ en cause.
4. WHEN le Backend_API enregistre un ScoreRecord, THE Score_Store SHALL persister l'enregistrement dans `backend/data/scores.json` en l'ajoutant aux ScoreRecord existants sans les modifier.
5. IF la persistance d'un ScoreRecord valide dans `backend/data/scores.json` échoue, THEN THE Backend_API SHALL répondre avec le code 500 et un message d'erreur, sans conserver d'enregistrement partiel.

### Requirement 16: Récupération du Top 10 (GET)

**User Story:** As a joueur, I want récupérer les meilleurs scores, so that le classement affiche les 10 premiers.

#### Acceptance Criteria

1. WHEN le Backend_API reçoit une requête `GET /api/scores`, THE Backend_API SHALL répondre avec le code 200 et au maximum 10 ScoreRecord triés par `score` décroissant.
2. WHEN deux ScoreRecord ont un `score` identique, THE Backend_API SHALL les ordonner par `date` croissante.
3. IF la lecture des scores échoue côté serveur, THEN THE Backend_API SHALL répondre avec le code 500 et un message d'erreur.

### Requirement 17: Persistance tolérante des scores

**User Story:** As a développeur, I want une persistance robuste, so that le backend fonctionne même sans fichier de scores préexistant.

#### Acceptance Criteria

1. IF le fichier `backend/data/scores.json` est absent ou corrompu au moment de la lecture, THEN THE Score_Store SHALL renvoyer une liste vide de scores.
2. WHEN le Score_Store écrit un ScoreRecord alors que le fichier `scores.json` est absent, THE Score_Store SHALL créer le fichier à la première écriture.

### Requirement 18: Déploiement conteneurisé

**User Story:** As a développeur, I want lancer le jeu complet avec une seule commande, so that l'exécution locale soit immédiate et sans erreur.

#### Acceptance Criteria

1. THE projet SHALL fournir un fichier `frontend/Dockerfile`, un fichier `backend/Dockerfile` et un fichier `docker-compose.yml` à la racine.
2. WHEN la commande `docker compose up --build` est exécutée, THE projet SHALL construire les images frontend et backend et démarrer les deux services sans erreur.
3. WHILE les services sont démarrés, THE projet SHALL relayer les appels `/api/*` du navigateur vers le service backend.
4. WHILE les services sont démarrés, THE projet SHALL monter `backend/data` en volume afin de conserver `scores.json` entre les redémarrages.
