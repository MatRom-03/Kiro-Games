/**
 * Logique pure et testable de l'entité Witch, indépendante du runtime Phaser.
 *
 * La sorcière patrouille horizontalement entre une borne gauche (`patrolMin`)
 * et une borne droite (`patrolMax`) à vitesse constante. À chaque fois qu'elle
 * atteint ou dépasse une borne, elle inverse sa direction (exigences 8.1, 8.2).
 *
 * Ces fonctions encapsulent la règle d'inversion de direction en s'appuyant sur
 * un état simple `{ patrolMin, patrolMax, direction }` et la position courante
 * `x`. Elles permettent de valider la patrouille sans instancier de sprite
 * Phaser. La classe `Witch` (frontend/src/entities/Witch.js) délègue à ces
 * fonctions pour garantir une seule source de vérité de la règle de patrouille.
 */

/**
 * @typedef {Object} WitchState
 * @property {number} patrolMin Borne gauche de patrouille (px).
 * @property {number} patrolMax Borne droite de patrouille (px).
 * @property {1|-1} direction Direction horizontale courante (1 = droite, -1 = gauche).
 */

/**
 * Construit l'état de patrouille d'une sorcière.
 *
 * Les bornes sont normalisées : si `patrolMin > patrolMax`, elles sont
 * échangées de sorte que `patrolMin ≤ patrolMax` reste un invariant.
 *
 * @param {number} patrolMin Borne gauche de patrouille (px).
 * @param {number} patrolMax Borne droite de patrouille (px).
 * @param {1|-1} [direction=1] Direction initiale (droite par défaut).
 * @returns {WitchState} État de patrouille normalisé.
 */
export function createWitchState(patrolMin, patrolMax, direction = 1) {
  const min = Math.min(patrolMin, patrolMax);
  const max = Math.max(patrolMin, patrolMax);
  return {
    patrolMin: min,
    patrolMax: max,
    direction: direction === -1 ? -1 : 1,
  };
}

/**
 * Détermine la direction de patrouille à partir de la position courante.
 * Fonction pure : ne mute pas l'entrée.
 *
 * Règle (exigence 8.2) :
 * - Si `x ≤ patrolMin`, la sorcière repart vers la droite (direction = 1).
 * - Si `x ≥ patrolMax`, la sorcière repart vers la gauche (direction = -1).
 * - Entre les deux bornes, la direction courante est conservée.
 *
 * Cette règle est idempotente aux bornes : une fois la direction corrigée vers
 * l'intérieur de l'intervalle, elle reste stable tant que la position n'a pas
 * franchi la borne opposée.
 *
 * @param {WitchState} state État de patrouille courant.
 * @param {number} x Position horizontale courante (px).
 * @returns {1|-1} Direction de déplacement à appliquer.
 */
export function patrolDirection(state, x) {
  if (x <= state.patrolMin) {
    return 1;
  }
  if (x >= state.patrolMax) {
    return -1;
  }
  return state.direction;
}

/**
 * Calcule l'état de patrouille suivant à partir de la position courante.
 * Fonction pure : renvoie un nouvel état sans muter l'entrée.
 *
 * @param {WitchState} state État de patrouille courant.
 * @param {number} x Position horizontale courante (px).
 * @returns {{state: WitchState, direction: 1|-1, reversed: boolean}} Nouvel état,
 *   direction à appliquer et indicateur d'inversion effective par rapport à la
 *   direction précédente.
 */
export function stepPatrol(state, x) {
  const direction = patrolDirection(state, x);
  return {
    state: { ...state, direction },
    direction,
    reversed: direction !== state.direction,
  };
}
