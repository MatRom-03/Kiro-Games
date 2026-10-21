# Halloween Ghost Dash

Jeu de plateforme 2D rétro en pixel art sur le thème d'Halloween. Incarnez un fantôme (blanc ou noir) qui doit collecter 15 bonbons dans un niveau avant la fin d'un compte à rebours de 45 secondes, tout en évitant ou en détruisant des sorcières patrouilleuses.

Toutes les textures (fantôme, sorcière, bonbons, blocs de sol/plateforme) sont générées de façon procédurale par code : **aucune ressource graphique externe n'est requise**.

## Architecture

Deux services conteneurisés orchestrés par Docker Compose sur un réseau partagé (`ghostdash-net`) :

- **frontend** : build Vite + Phaser 3 servi par Nginx. Exposé sur le port `8080` (hôte) → `80` (conteneur).
- **backend** : API Express qui persiste les scores dans un fichier JSON local. Exposé sur le port `3000` (hôte) → `3000` (conteneur).

## Démarrage

Prérequis : Docker et Docker Compose installés.

Depuis la racine du projet, lancez :

```bash
docker compose up --build
```

Cette commande construit les deux images et démarre les services. Une fois les conteneurs lancés, ouvrez le jeu dans votre navigateur :

```
http://localhost:8080
```

Pour arrêter les services :

```bash
docker compose down
```

## API et proxy

Le frontend effectue des appels vers des URL relatives sous `/api/*`. Nginx relaie automatiquement ces requêtes vers le service `backend` (`http://backend:3000`). Il n'y a donc **pas de configuration CORS** à gérer et aucune URL absolue n'est codée en dur côté client.

Points d'entrée de l'API :

- `POST /api/scores` — enregistre un score (`username`, `score`, `duration`) ; la date ISO 8601 est ajoutée côté serveur.
- `GET /api/scores` — renvoie le Top 10 trié par score décroissant (départage par date croissante).

## Persistance des scores

Le dossier `backend/data` est monté comme volume Docker (`./backend/data:/app/data`). Le backend y écrit `scores.json` :

- Le fichier est **créé automatiquement à la première écriture** s'il n'existe pas.
- La lecture est **tolérante** : un fichier absent ou un JSON corrompu est traité comme une liste de scores vide, sans faire planter le service.

Comme `backend/data` est un volume monté depuis la machine hôte, **les scores persistent entre les redémarrages** des conteneurs : arrêter puis relancer `docker compose up` conserve l'historique des scores.
