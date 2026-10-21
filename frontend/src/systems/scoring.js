// frontend/src/systems/scoring.js
import { GAME } from "../config/gameConstants.js";

/**
 * Calcule le score d'une partie.
 * Formule : (bonbons restants * SCORE_PER_CANDY) + (secondes restantes * SCORE_PER_SECOND),
 * soit `candiesRemaining * 100 + secondsRemaining * 50`.
 * En cas de victoire, l'appelant transmet `candiesRemaining = 0`.
 *
 * Le résultat est toujours un entier non négatif : les entrées négatives
 * ou non finies sont ramenées à 0 et le total est tronqué puis borné à 0.
 *
 * @param {object} p
 * @param {number} p.candiesRemaining Bonbons non collectés (0..15).
 * @param {number} p.secondsRemaining Secondes restantes (0..45).
 * @returns {number} Score entier >= 0.
 */
export function computeScore({ candiesRemaining, secondsRemaining } = {}) {
  const candies = Number.isFinite(candiesRemaining)
    ? Math.max(0, Math.trunc(candiesRemaining))
    : 0;
  const seconds = Number.isFinite(secondsRemaining)
    ? Math.max(0, Math.trunc(secondsRemaining))
    : 0;

  const score =
    candies * GAME.SCORE_PER_CANDY + seconds * GAME.SCORE_PER_SECOND;

  return Math.max(0, score);
}
