// backend/tests/scoreStore.roundtrip.pbt.test.js
/**
 * Test basé sur les propriétés — Property 6 : Persistance round-trip.
 *
 * Pour tout score valide `s`, après `addScore(s)` l'appel `readAll()`
 * contient un enregistrement correspondant à `s` (username/score/duration)
 * dont le champ `date` est au format ISO 8601 et est analysable.
 *
 * Chaque exécution de la propriété utilise un dossier temporaire frais
 * (fs.mkdtemp) assigné à `SCORES_DATA_DIR`, afin d'isoler les écritures et
 * d'éviter toute collision avec d'autres fichiers de test sur le même dossier.
 *
 * **Property 6 : Persistance round-trip**
 * **Validates: Requirements 15.1, 15.2, 15.4**
 */
import { describe, it, afterEach } from "vitest";
import fc from "fast-check";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { addScore, readAll } from "../src/store/scoreStore.js";

/**
 * Regex ISO 8601 correspondant au format produit par `Date#toISOString`,
 * p. ex. `2024-10-31T23:59:59.999Z`.
 */
const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/** Borne supérieure des entiers valides selon l'exigence 15.1. */
const MAX_INT = 999_999_999;

/**
 * Générateur d'un score d'entrée valide { username, score, duration }.
 * - `username` : chaîne non vide après trim, au plus 20 caractères.
 * - `score`, `duration` : entiers dans [0, 999 999 999].
 */
const validScoreArb = fc.record({
  username: fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => s.trim().length > 0 && s.length <= 20),
  score: fc.integer({ min: 0, max: MAX_INT }),
  duration: fc.integer({ min: 0, max: MAX_INT }),
});

describe("scoreStore — Property 6 : persistance round-trip (PBT)", () => {
  /** Dossiers temporaires créés pendant l'exécution, nettoyés après coup. */
  const tempDirs = [];
  const previousDataDir = process.env.SCORES_DATA_DIR;

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.SCORES_DATA_DIR;
    } else {
      process.env.SCORES_DATA_DIR = previousDataDir;
    }
    await Promise.all(
      tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
    );
  });

  it("après addScore(s), readAll() contient s avec une date ISO 8601", async () => {
    await fc.assert(
      fc.asyncProperty(validScoreArb, async (s) => {
        // Dossier temporaire frais et isolé pour cette exécution.
        const dir = await mkdtemp(path.join(os.tmpdir(), "ghostdash-scores-"));
        tempDirs.push(dir);
        process.env.SCORES_DATA_DIR = dir;

        const created = await addScore(s);
        const all = await readAll();

        // L'enregistrement renvoyé porte une date ISO 8601 (exigence 15.2).
        if (!ISO_8601.test(created.date)) {
          throw new Error(
            `date renvoyée non ISO 8601 : ${JSON.stringify(created.date)}`
          );
        }
        if (Number.isNaN(Date.parse(created.date))) {
          throw new Error(`date renvoyée non analysable : ${created.date}`);
        }

        // readAll() contient l'enregistrement persisté (exigences 15.1, 15.4).
        const match = all.find(
          (r) =>
            r.username === s.username &&
            r.score === s.score &&
            r.duration === s.duration
        );
        if (!match) {
          throw new Error(
            `enregistrement absent de readAll() pour ${JSON.stringify(s)}`
          );
        }

        // Le champ date persisté est également ISO 8601 et analysable.
        if (!ISO_8601.test(match.date)) {
          throw new Error(
            `date persistée non ISO 8601 : ${JSON.stringify(match.date)}`
          );
        }
        if (Number.isNaN(Date.parse(match.date))) {
          throw new Error(`date persistée non analysable : ${match.date}`);
        }

        return true;
      })
    );
  });
});
