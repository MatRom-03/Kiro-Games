// backend/tests/api.integration.test.js
/**
 * Tests d'intégration de l'API REST des scores (supertest).
 *
 * L'application Express est importée depuis `../src/server.js` (export par
 * défaut) sans ouvrir de port réseau. Chaque test utilise un dossier
 * temporaire frais (fs.mkdtemp) pointé par `SCORES_DATA_DIR`, puis nettoie
 * le dossier à la fin, afin d'isoler les tests entre eux et de tout fichier
 * `data/scores.json` réel.
 *
 * Couvre :
 * - POST /api/scores valide → 201 avec un enregistrement contenant une date ISO
 *   (Requirements 15.1, 15.2)
 * - GET /api/scores reflète l'ajout                     (Requirement 16.1)
 * - plusieurs POST → GET trié par score décroissant,
 *   départage par date croissante                       (Requirements 16.1, 16.2)
 * - POST /api/scores invalide → 400 sans persistance    (Requirements 15.3, 15.4)
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";

import app from "../src/server.js";

let tempDir;
let previousDataDir;

beforeEach(async () => {
  previousDataDir = process.env.SCORES_DATA_DIR;
  tempDir = await mkdtemp(path.join(tmpdir(), "api-integration-"));
  process.env.SCORES_DATA_DIR = tempDir;
});

afterEach(async () => {
  if (previousDataDir === undefined) {
    delete process.env.SCORES_DATA_DIR;
  } else {
    process.env.SCORES_DATA_DIR = previousDataDir;
  }
  await rm(tempDir, { recursive: true, force: true });
});

describe("POST /api/scores (payload valide)", () => {
  it("répond 201 avec l'enregistrement créé et une date ISO", async () => {
    const payload = { username: "Casper", score: 1200, duration: 42 };

    const res = await request(app).post("/api/scores").send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.record).toMatchObject(payload);

    // La date est générée côté serveur au format ISO 8601.
    const { date } = res.body.record;
    expect(typeof date).toBe("string");
    expect(new Date(date).toISOString()).toBe(date);
    expect(Number.isNaN(Date.parse(date))).toBe(false);
  });

  it("reflète l'ajout dans un GET /api/scores ultérieur", async () => {
    const payload = { username: "Boo", score: 777, duration: 30 };

    const post = await request(app).post("/api/scores").send(payload);
    expect(post.status).toBe(201);

    const get = await request(app).get("/api/scores");

    expect(get.status).toBe(200);
    expect(Array.isArray(get.body)).toBe(true);
    expect(get.body).toHaveLength(1);
    expect(get.body[0]).toMatchObject(payload);
    expect(get.body[0].date).toBe(post.body.record.date);
  });
});

describe("GET /api/scores (tri du Top 10)", () => {
  it("renvoie les scores triés par score décroissant", async () => {
    const payloads = [
      { username: "a", score: 100, duration: 10 },
      { username: "b", score: 500, duration: 10 },
      { username: "c", score: 250, duration: 10 },
    ];
    for (const p of payloads) {
      const res = await request(app).post("/api/scores").send(p);
      expect(res.status).toBe(201);
    }

    const get = await request(app).get("/api/scores");

    expect(get.status).toBe(200);
    expect(get.body.map((r) => r.score)).toEqual([500, 250, 100]);
    expect(get.body.map((r) => r.username)).toEqual(["b", "c", "a"]);
  });

  it("départage les scores égaux par date croissante (ordre d'insertion)", async () => {
    // Postés dans l'ordre : premier, deuxième, troisième. Tous le même score,
    // donc le serveur génère des dates croissantes dans cet ordre d'insertion.
    const payloads = [
      { username: "premier", score: 300, duration: 10 },
      { username: "deuxieme", score: 300, duration: 10 },
      { username: "troisieme", score: 300, duration: 10 },
    ];
    for (const p of payloads) {
      const res = await request(app).post("/api/scores").send(p);
      expect(res.status).toBe(201);
    }

    const get = await request(app).get("/api/scores");

    expect(get.status).toBe(200);
    expect(get.body.map((r) => r.username)).toEqual([
      "premier",
      "deuxieme",
      "troisieme",
    ]);
  });
});

describe("POST /api/scores (payload invalide)", () => {
  it("répond 400 pour un username vide et ne persiste rien", async () => {
    const res = await request(app)
      .post("/api/scores")
      .send({ username: "   ", score: 100, duration: 10 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe("string");

    // Vérifie l'absence totale de persistance via GET.
    const get = await request(app).get("/api/scores");
    expect(get.status).toBe(200);
    expect(get.body).toEqual([]);
  });

  it("répond 400 pour un score non entier négatif et ne persiste rien", async () => {
    const res = await request(app)
      .post("/api/scores")
      .send({ username: "Spooky", score: -5.5, duration: 10 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    const get = await request(app).get("/api/scores");
    expect(get.body).toEqual([]);
  });

  it("répond 400 pour un champ manquant (duration) sans altérer les scores existants", async () => {
    // Un score valide préexiste.
    const ok = await request(app)
      .post("/api/scores")
      .send({ username: "Valide", score: 400, duration: 20 });
    expect(ok.status).toBe(201);

    // Puis un POST invalide (duration manquante).
    const bad = await request(app)
      .post("/api/scores")
      .send({ username: "Invalide", score: 999 });
    expect(bad.status).toBe(400);

    // Le GET ne contient que le score valide préexistant.
    const get = await request(app).get("/api/scores");
    expect(get.body).toHaveLength(1);
    expect(get.body[0]).toMatchObject({ username: "Valide", score: 400 });
  });
});
