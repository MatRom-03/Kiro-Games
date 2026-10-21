// frontend/src/systems/aiModePersistence.js
//
// Persistance de la préférence « mode IA » (bot qui joue automatiquement),
// sans dépendance à Phaser afin d'être importable et testable en Node.
// Même approche tolérante que la persistance du mute.

/**
 * Clé de stockage du mode IA dans localStorage.
 * @type {string}
 */
export const AI_MODE_STORAGE_KEY = "ghostdash.aiMode";

/**
 * Résout `localStorage` de manière défensive.
 * @returns {Storage|null}
 */
function resolveLocalStorage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Lit l'état « mode IA » persisté de façon tolérante (false par défaut).
 * @param {Storage} [storage] Implémentation de stockage à utiliser.
 * @returns {boolean} true si le mode IA doit être actif.
 */
export function loadAiMode(storage = resolveLocalStorage()) {
  try {
    if (!storage || typeof storage.getItem !== "function") return false;
    return storage.getItem(AI_MODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Persiste l'état « mode IA » de façon tolérante.
 * @param {boolean} enabled État à persister.
 * @param {Storage} [storage] Implémentation de stockage à utiliser.
 * @returns {boolean} true si la valeur a été écrite, false sinon.
 */
export function persistAiMode(enabled, storage = resolveLocalStorage()) {
  try {
    if (!storage || typeof storage.setItem !== "function") return false;
    storage.setItem(AI_MODE_STORAGE_KEY, enabled ? "true" : "false");
    return true;
  } catch {
    return false;
  }
}
