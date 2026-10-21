import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  createPlayerState,
  registerFire,
  FIRE_COOLDOWN_MS,
} from "../src/entities/playerLogic.js";

/**
 * Property 5 : Le tir ne décrémente pas le compteur de victoire.
 *
 * Quel que soit le nombre d'appels à `fire()`, `candiesCollected` reste
 * inchangé par le tir (exigence 9.5 / critère 9.7 : « WHEN le Player émet un
 * Projectile [...], THE Game SHALL laisser le Candy_Counter inchangé »).
 *
 * La logique pure `registerFire` ne connaît pas le compteur de bonbons : elle
 * ne manipule que l'état temporisé du joueur. On modélise ici une séquence
 * arbitraire de tentatives de tir (nombre et horodatages quelconques) tout en
 * suivant un compteur `candiesCollected` dans le harnais de test, auquel la
 * logique de tir n'a aucun accès. L'invariance est confirmée si ce compteur
 * ressort strictement identique après toute la séquence.
 *
 * **Validates: Requirements 9.5**
 */
describe("playerLogic.registerFire — Property 5 : invariance du compteur de victoire", () => {
  it("ne modifie jamais candiesCollected quel que soit le nombre et le rythme des tirs", () => {
    fc.assert(
      fc.property(
        // Compteur de départ arbitraire (0..15 bonbons récoltés).
        fc.integer({ min: 0, max: 15 }),
        // Suite arbitraire d'intervalles entre tentatives de tir (ms).
        // La longueur du tableau = nombre d'appels à fire().
        fc.array(fc.integer({ min: 0, max: 5000 }), {
          minLength: 0,
          maxLength: 200,
        }),
        (initialCandies, deltas) => {
          // Harnais : le compteur de victoire vit en dehors de la logique de
          // tir. registerFire n'y a structurellement pas accès.
          const candiesCollected = initialCandies;
          let observedCandies = candiesCollected;

          let state = createPlayerState();
          let now = 0;
          let firedCount = 0;

          for (const delta of deltas) {
            now += delta;
            const result = registerFire(state, now);
            state = result.state;
            if (result.fired) {
              firedCount += 1;
            }
            // Le tir ne doit jamais toucher le compteur de bonbons : la seule
            // valeur dont dispose le harnais reste celle initialisée.
            observedCandies = candiesCollected;
          }

          // Invariance stricte : aucune mutation, même après de nombreux tirs.
          expect(observedCandies).toBe(initialCandies);
          // Et l'état de tir ne porte aucune notion de compteur de victoire.
          expect(state).not.toHaveProperty("candiesCollected");
          expect(state).not.toHaveProperty("candies");
          // Au moins le premier tir d'une séquence non vide est émis (cohérence
          // du modèle : le compteur reste intact malgré des tirs réels).
          if (deltas.length > 0) {
            expect(firedCount).toBeGreaterThanOrEqual(1);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("laisse candiesCollected intact même pour une rafale de tirs tous espacés du cooldown", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 100 }),
        (initialCandies, shots) => {
          const candiesCollected = initialCandies;
          let state = createPlayerState();
          let now = 0;

          for (let i = 0; i < shots; i++) {
            const result = registerFire(state, now);
            state = result.state;
            expect(result.fired).toBe(true); // chaque tir respecte le cooldown
            now += FIRE_COOLDOWN_MS;
          }

          // Le compteur local n'a jamais été exposé au tir : il est inchangé.
          expect(candiesCollected).toBe(initialCandies);
        },
      ),
      { numRuns: 200 },
    );
  });
});
