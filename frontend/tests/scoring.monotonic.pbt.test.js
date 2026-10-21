import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeScore } from "../src/systems/scoring.js";

/**
 * Property 2 : Monotonie du score
 * Validates: Requirements 10.1
 *
 * Le score est monotone croissant (au sens large) en `candiesRemaining`
 * à `secondsRemaining` fixé, et monotone croissant en `secondsRemaining`
 * à `candiesRemaining` fixé.
 */
describe("computeScore — Property 2 : monotonie", () => {
  it("est monotone croissant en candiesRemaining à secondes fixées", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 45 }),
        (crA, crB, sr) => {
          const cr1 = Math.min(crA, crB);
          const cr2 = Math.max(crA, crB);
          const s1 = computeScore({ candiesRemaining: cr1, secondsRemaining: sr });
          const s2 = computeScore({ candiesRemaining: cr2, secondsRemaining: sr });
          expect(s1).toBeLessThanOrEqual(s2);
        },
      ),
    );
  });

  it("est monotone croissant en secondsRemaining à bonbons fixés", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 45 }),
        fc.integer({ min: 0, max: 45 }),
        (cr, srA, srB) => {
          const sr1 = Math.min(srA, srB);
          const sr2 = Math.max(srA, srB);
          const s1 = computeScore({ candiesRemaining: cr, secondsRemaining: sr1 });
          const s2 = computeScore({ candiesRemaining: cr, secondsRemaining: sr2 });
          expect(s1).toBeLessThanOrEqual(s2);
        },
      ),
    );
  });
});
