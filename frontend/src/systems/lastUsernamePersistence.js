// frontend/src/systems/lastUsernamePersistence.js
//
// Persistance locale du dernier pseudo saisi, pour le restaurer dans le champ
// du Launcher quand on revient d une autre scene (Custom Skin, Reglages...).
// Sans dependance a Phaser (testable en Node).

/** Cle de stockage du dernier pseudo. */
export const LAST_USERNAME_KEY = "ghostdash.lastUsername";

/**
 * Resout `localStorage` de maniere defensive.
 * @returns {Storage|null}
 */
function resolveStorage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Lit le dernier pseudo saisi (chaine vide par defaut).
 * @param {Storage} [storage]
 * @returns {string}
 */
export function loadLastUsername(storage = resolveStorage()) {
  try {
    if (!storage || typeof storage.getItem !== "function") return "";
    return storage.getItem(LAST_USERNAME_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * Persiste le dernier pseudo saisi de maniere tolerante.
 * @param {string} username
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function saveLastUsername(username, storage = resolveStorage()) {
  try {
    if (!storage || typeof storage.setItem !== "function") return false;
    storage.setItem(LAST_USERNAME_KEY, String(username || ""));
    return true;
  } catch {
    return false;
  }
}
