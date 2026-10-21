// backend/src/server.js
/**
 * Bootstrap du serveur Express : middleware JSON + routeur de scores.
 *
 * L'application (`app`) est exportée par défaut afin que les tests
 * d'intégration (supertest) puissent la piloter sans ouvrir de port réseau.
 * Le serveur n'écoute (`app.listen`) que lorsque ce fichier est exécuté
 * directement (`node src/server.js`), jamais lors d'un simple import.
 *
 * Écoute sur le port `process.env.PORT || 3000`.
 */
import { fileURLToPath } from "node:url";
import express from "express";
import scoresRouter from "./routes/scores.js";
import profileRouter from "./routes/profile.js";

const app = express();

// Parse le corps JSON des requêtes entrantes.
app.use(express.json());

// Montage du routeur de scores sur le préfixe de l'API.
app.use("/api/scores", scoresRouter);
app.use("/api/profile", profileRouter);

/** Port d'écoute : variable d'environnement `PORT` ou 3000 par défaut. */
const PORT = process.env.PORT || 3000;

/**
 * Vrai lorsque ce module est le point d'entrée du processus
 * (`node src/server.js`), faux lorsqu'il est importé (tests, outillage).
 */
const isMainModule =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  app.listen(PORT, () => console.log(`backend prêt sur :${PORT}`));
}

export default app; // exporté pour les tests d'intégration (supertest)
