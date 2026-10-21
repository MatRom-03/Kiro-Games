/**
 * Logique pure et testable du Launcher : nettoyage du pseudo et validation du
 * lancement. Extraite dans un module sans dépendance à Phaser afin de pouvoir
 * être testée en environnement Node (Vitest) sans DOM.
 */

/**
 * Longueur maximale autorisée pour le pseudo du joueur.
 * @type {number}
 */
export const USERNAME_MAX_LENGTH = 20;

/**
 * Nettoie et borne un pseudo saisi : supprime les espaces de début/fin puis
 * tronque à {@link USERNAME_MAX_LENGTH} caractères.
 * @param {string} raw Valeur brute du champ de saisie.
 * @returns {string} Pseudo nettoyé (≤ 20 caractères, sans espaces aux bords).
 */
export function sanitizeUsername(raw) {
  const value = typeof raw === "string" ? raw : "";
  return value.trim().slice(0, USERNAME_MAX_LENGTH);
}

/**
 * Détermine si une configuration de lancement est valide (pseudo non vide
 * après nettoyage et skin sélectionné).
 * @param {{ username: string, skin: ("white"|"black"|null) }} cfg
 * @returns {{ ok: true } | { ok: false, reason: "username"|"skin" }}
 *   `ok` indique si le lancement est autorisé ; sinon `reason` précise la
 *   première cause de blocage rencontrée (pseudo prioritaire sur le skin).
 */
export function validateLaunch({ username, skin }) {
  if (sanitizeUsername(username).length === 0) {
    return { ok: false, reason: "username" };
  }
  if (skin !== "white" && skin !== "black") {
    return { ok: false, reason: "skin" };
  }
  return { ok: true };
}
