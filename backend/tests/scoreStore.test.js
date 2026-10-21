// backend/tests/scoreStore.test.js
/**
 * Tests unitaires de `scoreStore` : lecture tolérante et tri Top 10.
 *
 * Chaque test utilise un dossier temporaire frais (fs.mkdtemp) pointé par
 * `SCORES_DATA_DIR`, puis nettoie le dossier à la fin. Cela isole les tests
 * les uns des autres et de tout fichier `data/scores.json` réel.
 *
 * Couvre :
 * - readAll sur fichier absent → []   (Requirement 17.1)
 * - readAll sur JSON corrompu → []    (Requirement 17.1)
 * - getTop10 borné à 10               (Requirement 16.1)
 * - getTop10 tri par score décroissant (Requirement 16.1)
 * - getTop10 départage par date croissante en cas d'égalité (Requirement 16.2, 17.2)
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { readAll, getTop10 } from "../src/store/scoreStore.js";

let tempDir;
let previousDataDir;

beforeEach(async () => {
  previousDataDir = process.env.SCORES_DATA_DIR;
  tempDir = await mkdtemp(path.join(tmpdir(), "scorestore-"));
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

/** Écrit un contenu brut dans scores.json du dossier temporaire courant. */
async function writeRawScores(raw) {
  await mkdir(tempDir, { recursive: true });
  await writeFile(path.join(tempDir, "scores.json"), raw, "utf8");
}

describe("readAll (lecture tolérante)", () => {
  it("renvoie [] quand le fichier scores.json est absent", async () => {
    // Le dossier temporaire est vide : aucun scores.json n'existe.
    const result = await readAll();
    expect(result).toEqual([]);
  });

  it("renvoie [] quand le fichier scores.json contient du JSON corrompu", async () => {
    await writeRawScores("{ ceci n'est pas: du json valide ]");
    const result = await readAll();
    expect(result).toEqual([]);
  });

  it("renvoie [] quand le JSON est valide mais n'est pas un tableau", async () => {
    await writeRawScores(JSON.stringify({ username: "oops" }));
    const result = await readAll();
    expect(result).toEqual([]);
  });
});

describe("getTop10 (tri et bornage)", () => {
  it("borne le résultat à 10 enregistrements", async () => {
    const records = Array.from({ length: 15 }, (_, i) => ({
      username: `p${i}`,
      score: i,
      duration: 10,
      date: `2024-10-31T00:00:${String(i).padStart(2, "0")}.000Z`,
    }));
    await writeRawScores(JSON.stringify(records));

    const result = await getTop10();
    expect(result).toHaveLength(10);
  });

  it("trie par score décroissant", async () => {
    const records = [
      { username: "a", score: 100, duration: 10, date: "2024-10-31T00:00:00.000Z" },
      { username: "b", score: 500, duration: 10, date: "2024-10-31T00:00:01.000Z" },
      { username: "c", score: 250, duration: 10, date: "2024-10-31T00:00:02.000Z" },
    ];
    await writeRawScores(JSON.stringify(records));

    const result = await getTop10();
    expect(result.map((r) => r.score)).toEqual([500, 250, 100]);
    expect(result.map((r) => r.username)).toEqual(["b", "c", "a"]);
  });

  it("conserve les 10 meilleurs scores lorsqu'il y a plus de 10 enregistrements", async () => {
    const records = Array.from({ length: 12 }, (_, i) => ({
      username: `p${i}`,
      score: i * 10, // 0, 10, ..., 110
      duration: 10,
      date: `2024-10-31T00:00:${String(i).padStart(2, "0")}.000Z`,
    }));
    await writeRawScores(JSON.stringify(records));

    const result = await getTop10();
    // Les deux plus faibles (0 et 10) doivent être exclus.
    expect(result.map((r) => r.score)).toEqual([110, 100, 90, 80, 70, 60, 50, 40, 30, 20]);
  });

  it("départage les scores égaux par date croissante", async () => {
    const records = [
      { username: "tard", score: 300, duration: 10, date: "2024-10-31T12:00:00.000Z" },
      { username: "tot", score: 300, duration: 10, date: "2024-10-31T08:00:00.000Z" },
      { username: "milieu", score: 300, duration: 10, date: "2024-10-31T10:00:00.000Z" },
    ];
    await writeRawScores(JSON.stringify(records));

    const result = await getTop10();
    expect(result.map((r) => r.username)).toEqual(["tot", "milieu", "tard"]);
  });

  it("combine tri par score décroissant puis par date croissante", async () => {
    const records = [
      { username: "egal-tard", score: 200, duration: 10, date: "2024-10-31T11:00:00.000Z" },
      { username: "haut", score: 500, duration: 10, date: "2024-10-31T09:00:00.000Z" },
      { username: "egal-tot", score: 200, duration: 10, date: "2024-10-31T09:30:00.000Z" },
      { username: "bas", score: 50, duration: 10, date: "2024-10-31T09:00:00.000Z" },
    ];
    await writeRawScores(JSON.stringify(records));

    const result = await getTop10();
    expect(result.map((r) => r.username)).toEqual(["haut", "egal-tot", "egal-tard", "bas"]);
  });

  it("renvoie [] lorsque le fichier est absent", async () => {
    const result = await getTop10();
    expect(result).toEqual([]);
  });
});
