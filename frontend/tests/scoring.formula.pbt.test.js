import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeScore } from "../src/systems/scoring.js";

/**
 * Property 1 : Formule de score déterministe
 * Validates: Requirements 10.1, 10.2
 *
 * Pour tout cr ∈ [0,15] (bonbons restants) et sr ∈ [0,45] (secondes restantes),
 * computeScore({ candiesRemaining: cr, secondsRemaining: sr }) === cr * 100 + sr * 50.
 */
describe("Property 1 : Formule de score déterministe", () => {
  it("computeScore égale cr*100 + sr*50 pour tout cr∈[0,15] et sr∈[0,45]", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 45 }),
        (cr, sr) => {
          expect(
            computeScore({ candiesRemaining: cr, secondsRemaining: sr }),
          ).toBe(cr * 100 + sr * 50);
        },
      ),
    );
  });
});
