import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { GAME } from "../src/config/gameConstants.js";
import {
  createPlayerState,
  applyDamage,
  isInvulnerable,
} from "../src/entities/playerLogic.js";

/**
 * Property 4 : L'invulnérabilité absorbe les contacts
 * Validates: Requirements 7.2, 7.3
 *
 * Horloge mockée : deux appels à `applyDamage()` (la logique pure derrière
 * `Player.takeDamage()`) séparés de moins de `INVULN_MS` ne retirent qu'un
 * seul cœur. Le premier contact décrémente d'un cœur et déclenche
 * l'invulnérabilité de `INVULN_MS` (exigence 7.3) ; tout second contact
 * survenant dans cette fenêtre est absorbé et laisse le nombre de cœurs
 * inchangé (exigence 7.2 : au plus un cœur perdu par fenêtre).
 */
describe("Property 4 : l'invulnérabilité absorbe les contacts rapprochés", () => {
  it("deux contacts séparés de moins de INVULN_MS ne retirent qu'un seul cœur (exigences 7.2, 7.3)", () => {
    fc.assert(
      fc.property(
        // t0 arbitraire : instant du premier contact (horloge mockée).
        fc.integer({ min: 0, max: 10_000_000 }),
        // dt dans [0, INVULN_MS[ : second contact strictement dans la fenêtre
        // d'invulnérabilité ouverte par le premier.
        fc.integer({ min: 0, max: GAME.INVULN_MS - 1 }),
        (t0, dt) => {
          const fresh = createPlayerState();

          // Premier contact : un cœur retiré, invulnérabilité active.
          const first = applyDamage(fresh, t0);
          expect(first.damaged).toBe(true);
          expect(first.state.hearts).toBe(fresh.hearts - 1);
          expect(isInvulnerable(first.state, t0)).toBe(true);

          // Second contact dans la fenêtre : absorbé, aucun cœur retiré.
          const now2 = t0 + dt;
          expect(isInvulnerable(first.state, now2)).toBe(true);
          const second = applyDamage(first.state, now2);
          expect(second.damaged).toBe(false);
          expect(second.state.hearts).toBe(first.state.hearts);

          // Invariant global : exactement un cœur perdu sur la fenêtre.
          expect(second.state.hearts).toBe(fresh.hearts - 1);
        },
      ),
    );
  });
});
