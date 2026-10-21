/**
 * Logique pure et testable de l'entité Player, indépendante du runtime Phaser.
 *
 * Ces fonctions encapsulent les règles temporisées du joueur (cooldown de tir,
 * invulnérabilité, dégâts) en s'appuyant sur un état simple `{ hearts,
 * invulnUntil, lastFireAt, facing }` et une horloge injectée (`now` en ms).
 * Elles permettent de valider les propriétés (cooldown, absorption des
 * contacts, invariance du compteur de bonbons) avec une horloge mockée, sans
 * instancier de sprite Phaser.
 *
 * La classe `Player` (frontend/src/entities/Player.js) délègue à ces fonctions
 * pour garantir une seule source de vérité des règles de gameplay.
 */
import { GAME } from "../config/gameConstants.js";

/**
 * Cooldown minimal entre deux tirs, en millisecondes.
 * L'exigence 9.1/9.3 impose au moins 400 ms. On applique le maximum entre la
 * constante de gameplay et 400 ms afin de garantir le respect de l'exigence.
 * @type {number}
 */
export const FIRE_COOLDOWN_MS = Math.max(GAME.PROJECTILE_COOLDOWN_MS, 400);

/**
 * @typedef {Object} PlayerState
 * @property {number} hearts Cœurs de vie restants (0..PLAYER_HEARTS).
 * @property {number} invulnUntil Horodatage (ms) de fin d'invulnérabilité ; 0 = aucune.
 * @property {number} lastFireAt Horodatage (ms) du dernier tir ; -Infinity = jamais tiré.
 * @property {1|-1} facing Direction horizontale courante (1 = droite, -1 = gauche).
 */

/**
 * Construit l'état initial d'un joueur.
 * @returns {PlayerState} État neuf : 3 cœurs, non invulnérable, droite par défaut.
 */
export function createPlayerState() {
  return {
    hearts: GAME.PLAYER_HEARTS,
    invulnUntil: 0,
    lastFireAt: Number.NEGATIVE_INFINITY,
    facing: 1,
  };
}

/**
 * Indique si le joueur est invulnérable à l'instant `now`.
 * @param {PlayerState} state État courant.
 * @param {number} now Horodatage courant en millisecondes.
 * @returns {boolean} true tant que `now < state.invulnUntil`.
 */
export function isInvulnerable(state, now) {
  return now < state.invulnUntil;
}

/**
 * Indique si un tir est autorisé à l'instant `now` (cooldown écoulé).
 * @param {PlayerState} state État courant.
 * @param {number} now Horodatage courant en millisecondes.
 * @returns {boolean} true si au moins FIRE_COOLDOWN_MS se sont écoulées.
 */
export function canFire(state, now) {
  return now - state.lastFireAt >= FIRE_COOLDOWN_MS;
}

/**
 * Applique un dégât en respectant l'invulnérabilité. Fonction pure : renvoie un
 * nouvel état sans muter l'entrée.
 * - Si invulnérable à `now` : aucun changement (exigence 7.4).
 * - Sinon : −1 cœur borné à 0 (exigence 7.2) et invulnérabilité de `INVULN_MS`
 *   (exigence 7.3).
 *
 * @param {PlayerState} state État courant.
 * @param {number} now Horodatage courant en millisecondes.
 * @returns {{state: PlayerState, damaged: boolean}} Nouvel état et indicateur de
 *   dégât effectivement appliqué.
 */
export function applyDamage(state, now) {
  if (isInvulnerable(state, now)) {
    return { state: { ...state }, damaged: false };
  }
  const next = {
    ...state,
    hearts: Math.max(0, state.hearts - 1),
    invulnUntil: now + GAME.INVULN_MS,
  };
  return { state: next, damaged: true };
}

/**
 * Enregistre un tir si le cooldown est écoulé. Fonction pure : renvoie un
 * nouvel état sans muter l'entrée. N'affecte aucun compteur de bonbons
 * (exigence 9.5/9.7) ; cette logique ne connaît pas le compteur de victoire.
 *
 * @param {PlayerState} state État courant.
 * @param {number} now Horodatage courant en millisecondes.
 * @returns {{state: PlayerState, fired: boolean, direction: 1|-1}} Nouvel état,
 *   indicateur de tir effectif et direction du projectile (direction courante,
 *   droite par défaut — exigence 9.2).
 */
export function registerFire(state, now) {
  if (!canFire(state, now)) {
    return { state: { ...state }, fired: false, direction: state.facing };
  }
  return {
    state: { ...state, lastFireAt: now },
    fired: true,
    direction: state.facing,
  };
}
