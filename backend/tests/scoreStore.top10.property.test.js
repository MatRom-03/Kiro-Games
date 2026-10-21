// backend/tests/scoreStore.top10.property.test.js
/**
 * Property 3 : Top 10 trié et borné
 * Validates: Requirements 16.1, 16.2
 *
 * Pour toute liste de ScoreRecord persistée dans un fichier scores.json,
 * `getTop10` renvoie au plus 10 éléments et, pour tout i < j,
 * result[i].score >= result[j].score (tri décroissant par score).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Dossier temporaire courant utilisé comme SCORES_DATA_DIR. */
let tmpDir;
/** Valeur initiale de SCORES_DATA_DIR à restaurer après les tests. */
const originalEnv = process.env.SCORES_DATA_DIR;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ghostdash-scores-"));
  process.env.SCORES_DATA_DIR = tmpDir;
});

afterEach(async () => {
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
  if (originalEnv === undefined) {
    delete process.env.SCORES_DATA_DIR;
  } else {
    process.env.SCORES_DATA_DIR = originalEnv;
  }
});

/**
 * Générateur d'un ScoreRecord valide
 * ({username, score entier, duration entier, date ISO 8601}).
 */
const scoreRecordArb = fc.record({
  username: fc.string({ minLength: 1, maxLength: 20 }),
  score: fc.integer({ min: 0, max: 999_999_999 }),
  duration: fc.integer({ min: 0, max: 999_999_999 }),
  date: fc
    .date({ min: new Date("2000-01-01T00:00:00.000Z"), max: new Date("2100-01-01T00:00:00.000Z") })
    .map((d) => d.toISOString()),
});

describe("Property 3 : getTop10 trié et borné (Requirements 16.1, 16.2)", () => {
  it("renvoie au plus 10 éléments, triés par score décroissant", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(scoreRecordArb, { maxLength: 50 }), async (records) => {
        // Écrit la liste générée dans un fichier frais à chaque exécution.
        await mkdir(tmpDir, { recursive: true });
        await writeFile(
          path.join(tmpDir, "scores.json"),
          JSON.stringify(records, null, 2),
          "utf8",
        );

        // Import dynamique pour que dataDir() lise la variable d'env courante.
        const { getTop10 } = await import("../src/store/scoreStore.js");
        const result = await getTop10();

        // Borne : au plus 10 éléments.
        expect(result.length).toBeLessThanOrEqual(10);
        // Et jamais plus que le nombre d'enregistrements fournis.
        expect(result.length).toBeLessThanOrEqual(records.length);

        // Tri décroissant par score : pour tout i < j, result[i].score >= result[j].score.
        for (let i = 1; i < result.length; i++) {
          expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
        }
      }),
      { numRuns: 100 },
    );
  });
});
