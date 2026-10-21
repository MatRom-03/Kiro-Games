# Implementation Plan: Halloween Ghost Dash

## Overview

Ce plan convertit la conception de Halloween Ghost Dash en une série d'étapes de codage incrémentales. L'implémentation commence par l'échafaudage des deux services (`/frontend` Vite + Phaser 3, `/backend` Express), puis construit le backend d'abord (persistance → routeur → serveur) avec ses tests unitaires, basés sur les propriétés et d'intégration. Elle enchaîne sur le frontend (bootstrap, constantes, textures procédurales, scènes, entités, logique pure de score) avec ses tests, puis assemble le tout. Enfin, les artefacts Docker sont créés et une tâche de vérification confirme que `docker compose up --build` démarre les deux services sans erreur et que le jeu est jouable sur `localhost:8080` avec persistance des scores.

Langage d'implémentation : **JavaScript (ESM)** côté frontend et backend, conformément aux exemples de code du document de conception.

## Tasks

- [x] 1. Échafauder la structure des deux services
  - [x] 1.1 Échafauder le projet backend
    - Créer `backend/package.json` (type: module, dépendance `express`, devDeps `vitest`, `supertest`, `fast-check`, script `test`)
    - Créer l'arborescence `backend/src/`, `backend/src/routes/`, `backend/src/store/`, `backend/data/`, `backend/tests/`
    - Ajouter un `.gitignore` et un `backend/data/.gitkeep` pour conserver le dossier de données
    - _Requirements: 18.1_

  - [x] 1.2 Échafauder le projet frontend
    - Créer `frontend/package.json` (type: module, dépendance `phaser`, devDeps `vite`, `vitest`, `fast-check`, scripts `dev`/`build`/`test`)
    - Créer `frontend/vite.config.js` et `frontend/index.html` (conteneur du canvas, fond noir)
    - Créer l'arborescence `frontend/src/{config,scenes,entities,gfx,systems,services}/` et `frontend/tests/`
    - _Requirements: 18.1_

- [x] 2. Implémenter la couche de persistance du backend
  - [x] 2.1 Implémenter `scoreStore` (persistance JSON tolérante)
    - Créer `backend/src/store/scoreStore.js` avec `readAll`, `addScore`, `getTop10`
    - `readAll` : lecture tolérante — fichier absent ou JSON corrompu → tableau vide
    - `addScore` : ajouter `date` ISO 8601 côté serveur, `mkdir -p` du dossier `data`, écrire en préservant les enregistrements existants, créer le fichier à la première écriture
    - `getTop10` : tri par `score` décroissant puis `date` croissante, `slice(0, 10)`
    - _Requirements: 15.2, 15.4, 16.1, 16.2, 17.1, 17.2_

  - [x] 2.2 Écrire le test basé sur les propriétés du tri Top 10
    - **Property 3 : Top 10 trié et borné**
    - **Validates: Requirements 16.1, 16.2**
    - fast-check : pour toute liste de scores, `getTop10` renvoie ≤ 10 éléments et `result[i].score ≥ result[j].score` pour `i < j`

  - [x] 2.3 Écrire le test basé sur les propriétés de persistance round-trip
    - **Property 6 : Persistance round-trip**
    - **Validates: Requirements 15.1, 15.2, 15.4**
    - fast-check sur un fichier temporaire : après `addScore(s)`, `readAll()` contient `s` avec une `date` au format ISO 8601
    - _Requirements: 17.1_

  - [x] 2.4 Écrire les tests unitaires de `scoreStore`
    - Lecture d'un fichier absent → `[]` ; lecture d'un fichier corrompu → `[]`
    - `getTop10` : borne 10, tri décroissant, départage par date croissante en cas d'égalité
    - _Requirements: 16.1, 16.2, 17.1, 17.2_

- [x] 3. Implémenter le routeur et le serveur du backend
  - [x] 3.1 Implémenter le routeur de scores avec validation stricte
    - Créer `backend/src/routes/scores.js` : fonction `validate` et routes `POST /` et `GET /`
    - `validate` : `username` chaîne, non vide après trim, ≤ 20 caractères ; `score` et `duration` entiers dans `[0, 999999999]` ; message d'erreur indiquant le champ en cause
    - `POST` : 400 si invalide ; sinon `addScore` et 201 avec l'enregistrement ; 500 si la persistance échoue
    - `GET` : 200 avec `getTop10` ; 500 si la lecture échoue
    - _Requirements: 15.1, 15.2, 15.3, 15.5, 16.1, 16.3_

  - [x] 3.2 Implémenter le serveur Express
    - Créer `backend/src/server.js` : middleware `express.json()`, montage de `scoresRouter` sur `/api/scores`, écoute sur `process.env.PORT || 3000`
    - Exporter `app` pour les tests d'intégration
    - _Requirements: 15.1, 16.1, 18.2_

  - [x] 3.3 Écrire les tests unitaires de validation du payload
    - Payloads valides acceptés ; champ manquant, username vide/trop long, score/duration non entier/négatif/hors borne → rejet avec champ en cause
    - _Requirements: 15.1, 15.3_

  - [x] 3.4 Écrire les tests d'intégration de l'API (supertest)
    - `POST /api/scores` valide → 201 avec `date` ISO ; `GET /api/scores` reflète l'ajout, trié décroissant
    - `POST` invalide → 400 sans persistance
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 16.1, 16.2_

- [x] 4. Checkpoint backend
  - S'assurer que tous les tests passent, demander à l'utilisateur en cas de question.

- [x] 5. Implémenter le bootstrap et les constantes du frontend
  - [x] 5.1 Créer les constantes de gameplay et les touches
    - Créer `frontend/src/config/gameConstants.js` : objets `GAME` (dimensions, gravité, vitesses, cœurs, invulnérabilité, bonbons, timer, projectiles, barème de score) et `KEYS` (gauche, droite, saut, tir)
    - _Requirements: 3.3, 5.1, 6.1, 7.1, 9.1, 10.1_

  - [x] 5.2 Créer le bootstrap Phaser
    - Créer `frontend/src/main.js` : configuration Phaser (AUTO, dimensions, `pixelArt`, physique Arcade avec gravité, scale FIT) et enregistrement des scènes dans l'ordre du flux
    - Importer les scènes (déclarées dans les étapes suivantes) ; conserver l'ordre Boot → Preload → Launcher → Game → GameOver → Scoreboard → Settings
    - _Requirements: 3.3, 14.2_

- [x] 6. Implémenter la génération procédurale des textures
  - [x] 6.1 Implémenter `TextureFactory`
    - Créer `frontend/src/gfx/TextureFactory.js` : `makeGhost(skin, key)` (fantôme blanc/noir avec yeux orange), `makeWitch(key)`, `makeCandy(key)` (bonbon et projectile), `makeTile(key, tileSize)`
    - Chaque méthode dessine via `Graphics` puis appelle `generateTexture` — aucune ressource réseau
    - _Requirements: 14.1, 14.2_

  - [x] 6.2 Implémenter BootScene et PreloadScene
    - Créer `frontend/src/scenes/BootScene.js` : configuration initiale, chargement de l'état `mute` persisté, passage à PreloadScene
    - Créer `frontend/src/scenes/PreloadScene.js` : instancier `TextureFactory`, générer toutes les textures (ghost_white, ghost_black, witch, candy, tile, projectile), puis `scene.start("LauncherScene")`
    - _Requirements: 14.1, 14.2_

- [x] 7. Implémenter la scène de lancement
  - [x] 7.1 Implémenter LauncherScene
    - Créer `frontend/src/scenes/LauncherScene.js` : logo coloré sur fond noir avec yeux orange, champ de saisie du pseudo (sans mot de passe), choix du skin (white/black, aucun présélectionné, indication visuelle, un seul actif), tableau des touches, bouton de lancement, accès au Settings
    - Validation au lancement : empêcher si pseudo vide/espaces ou skin non sélectionné (indication non bloquante), limiter le pseudo à 20 caractères, transmettre `{ username, skin }` à GameScene
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 11.1, 11.2, 11.3, 11.4_

- [x] 8. Implémenter les entités de jeu
  - [x] 8.1 Implémenter l'entité Player
    - Créer `frontend/src/entities/Player.js` (extends Arcade.Sprite) : skin appliqué, `hearts = 3`
    - `handleMovement` (déplacement latéral, saut si `blocked.down`), `fire` (cooldown ≥ 400 ms, direction courante, droite par défaut, projectile sans gravité), `takeDamage` (−1 cœur borné ≥ 0, invulnérabilité 1,5 s, clignotement 5–10 Hz, ignore si invulnérable), getter `isInvulnerable`
    - _Requirements: 1.6, 1.7, 3.1, 3.2, 4.1, 4.2, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 9.1, 9.2, 9.3, 9.4_

  - [x] 8.2 Écrire le test basé sur les propriétés d'absorption des contacts
    - **Property 4 : L'invulnérabilité absorbe les contacts**
    - **Validates: Requirements 7.2, 7.3**
    - fast-check (horloge mockée) : deux appels à `takeDamage()` séparés de moins de `INVULN_MS` ne retirent qu'un seul cœur

  - [x] 8.3 Écrire le test basé sur les propriétés d'invariance du tir
    - **Property 5 : Le tir ne décrémente pas le compteur de victoire**
    - **Validates: Requirements 9.5**
    - fast-check : quel que soit le nombre d'appels à `fire()`, `candiesCollected` reste inchangé

  - [x] 8.4 Implémenter l'entité Witch
    - Créer `frontend/src/entities/Witch.js` (extends Arcade.Sprite) : `patrol` (patrouille horizontale entre `patrolMin`/`patrolMax`, inversion de direction aux bornes), `defeat` (destruction + effet)
    - _Requirements: 8.1, 8.2_

- [x] 9. Implémenter la logique de score pure
  - [x] 9.1 Implémenter `computeScore`
    - Créer `frontend/src/systems/scoring.js` : `computeScore({ candiesRemaining, secondsRemaining })` → `candiesRemaining * 100 + secondsRemaining * 50`, entier ≥ 0
    - _Requirements: 10.1, 10.2_

  - [x] 9.2 Écrire le test basé sur les propriétés de formule déterministe
    - **Property 1 : Formule de score déterministe**
    - **Validates: Requirements 10.1, 10.2**
    - fast-check : pour tout `cr ∈ [0,15]` et `sr ∈ [0,45]`, `computeScore` égale `cr*100 + sr*50`

  - [x] 9.3 Écrire le test basé sur les propriétés de monotonie
    - **Property 2 : Monotonie du score**
    - **Validates: Requirements 10.1**
    - fast-check : score monotone croissant en `candiesRemaining` et en `secondsRemaining`

  - [x] 9.4 Écrire les tests unitaires de `computeScore`
    - Cas limites 0/15 bonbons, 0/45 secondes
    - _Requirements: 10.1, 10.2_

- [x] 10. Implémenter la scène de jeu
  - [x] 10.1 Implémenter GameScene
    - Créer `frontend/src/scenes/GameScene.js` : construire plateformes (StaticGroup), Player (selon skin), sorcières patrouilleuses, 15 bonbons collectables, HUD (cœurs 0–3, Candy_Counter `x / 15`, timer dynamique)
    - Physique et collisions : collider player/plateformes, overlaps player/bonbons, player/sorcières, projectiles/sorcières
    - Timer 45 s décrémenté chaque seconde → défaite à 0 ; collecte de bonbon → +1 et victoire à 15 ; contact sorcière → `takeDamage`, défaite si 0 cœur (une seule fois) ; projectile touche sorcière → destruction des deux ; projectile hors limites → retrait ; `endGame` construit le `GameResult` via `computeScore` et lance GameOverScene
    - _Requirements: 1.6, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.7, 7.8, 8.1, 8.2, 9.4, 9.5, 9.6, 9.7, 10.1, 10.2_

- [x] 11. Implémenter les scènes de fin, de scores et de réglages, et les services
  - [x] 11.1 Implémenter ApiClient
    - Créer `frontend/src/services/ApiClient.js` : `submitScore(payload)` (POST `/api/scores`, URL relative) et `fetchTop10()` (GET `/api/scores`)
    - _Requirements: 10.7, 12.1_

  - [x] 11.2 Implémenter SoundManager
    - Créer `frontend/src/systems/SoundManager.js` : gestion globale du son (mute/unmute), état persisté
    - _Requirements: 13.2_

  - [x] 11.3 Implémenter GameOverScene
    - Créer `frontend/src/scenes/GameOverScene.js` : afficher issue (victoire/défaite) et score ; envoi POST une seule fois par partie (best-effort) ; message non bloquant si l'envoi échoue en conservant le score et le bouton Rejouer actif ; boutons Rejouer (nouvelle Game même pseudo/skin) et Voir le tableau des scores (Scoreboard)
    - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [x] 11.4 Implémenter ScoreboardScene
    - Créer `frontend/src/scenes/ScoreboardScene.js` : récupérer via `fetchTop10`, afficher au plus 10 scores (Rang, Pseudo, Score, Date) en style arcade, échapper le pseudo (anti-injection HTML), message si vide ou échec de récupération
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 11.5 Implémenter SettingsScene
    - Créer `frontend/src/scenes/SettingsScene.js` : bouton de bascule du son (via SoundManager), rappel des raccourcis clavier, retour au Launcher
    - _Requirements: 13.1, 13.2, 13.3_

- [x] 12. Checkpoint frontend
  - S'assurer que tous les tests passent, demander à l'utilisateur en cas de question.

- [x] 13. Créer les artefacts Docker et la documentation
  - [x] 13.1 Créer les artefacts Docker du backend et du frontend
    - Créer `backend/Dockerfile` (node:20-alpine, `npm ci --omit=dev`, `CMD node src/server.js`, EXPOSE 3000)
    - Créer `frontend/Dockerfile` (build multi-étapes : build Vite puis service nginx:alpine servant `/dist`)
    - Créer `frontend/nginx.conf` : servir le build (`try_files`) et proxy `location /api/ → http://backend:3000`
    - _Requirements: 18.1, 18.3_

  - [x] 13.2 Créer docker-compose.yml et le README
    - Créer `docker-compose.yml` à la racine : services `backend` (3000:3000, volume `./backend/data:/app/data`) et `frontend` (8080:80, `depends_on` backend), réseau partagé `ghostdash-net`
    - Créer `README.md` : instructions `docker compose up --build`, accès `http://localhost:8080`, description de la persistance
    - _Requirements: 18.1, 18.2, 18.4_

- [x] 14. Vérification finale
  - Lancer `docker compose up --build` et confirmer que les deux services démarrent sans erreur
  - Confirmer que le jeu est jouable sur `http://localhost:8080`, que les appels `/api/*` sont relayés vers le backend et que les scores sont persistés dans `backend/data/scores.json` entre les redémarrages
  - S'assurer que tous les tests passent, demander à l'utilisateur en cas de question.
  - _Requirements: 18.2, 18.3, 18.4_

## Notes

- Les sous-tâches marquées d'un `*` sont optionnelles (tests unitaires, basés sur les propriétés et d'intégration) et peuvent être ignorées pour un MVP plus rapide ; les tâches principales ne doivent jamais être ignorées.
- Chaque tâche référence des exigences précises pour la traçabilité.
- Les checkpoints assurent une validation incrémentale.
- Les tests basés sur les propriétés valident les propriétés de correction universelles (Properties 1 à 6 de la conception) ; les tests unitaires couvrent les exemples et cas limites.
- Le backend est implémenté et testé avant le frontend pour disposer d'une API fonctionnelle dès l'assemblage.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "5.1", "5.2", "6.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.1", "6.2", "7.1", "8.1", "8.4", "9.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "8.2", "8.3", "9.2", "9.3", "9.4", "11.1", "11.2"] },
    { "id": 4, "tasks": ["3.4", "10.1", "11.4", "11.5"] },
    { "id": 5, "tasks": ["11.3", "13.1"] },
    { "id": 6, "tasks": ["13.2"] }
  ]
}
```
