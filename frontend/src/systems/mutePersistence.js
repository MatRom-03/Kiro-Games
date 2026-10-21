// frontend/src/systems/mutePersistence.js
//
// Logique de persistance de la préférence « son coupé » (mute), sans aucune
// dépendance à Phaser afin d'être importable et testable en environnement Node.
// BootScene et SoundManager réutilisent ces helpers pour partager la même clé
// et le même comportement tolérant.

/**
 * Clé de stockage de l'état « son coupé » (mute) dans localStorage.
 * Partagée entre BootScene, SoundManager et SettingsScene pour conserver la
 * préférence du joueur entre deux sessions.
 * @type {string}
 */
export const MUTE_STORAGE_KEY = "ghostdash.mute";

/**
 * Résout `localStorage` de manière défensive : renvoie `null` dès que le
 * global est absent (SSR, tests sans jsdom) ou inaccessible.
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
 * Lit l'état « mute » persisté de façon tolérante.
 * Toute valeur absente, invalide ou un accès au stockage impossible
 * (mode privé, quota, environnement sans localStorage) retombe sur `false`.
 * @param {Storage} [storage] Implémentation de stockage à utiliser.
 * @returns {boolean} true si le son doit être coupé au démarrage.
 */
export function loadPersistedMute(storage = resolveLocalStorage()) {
  try {
    if (!storage || typeof storage.getItem !== "function") return false;
    return storage.getItem(MUTE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Persiste l'état « son coupé » (mute) de façon tolérante.
 * Tout environnement sans stockage ou toute erreur d'écriture (mode privé,
 * quota dépassé) est absorbé silencieusement — la préférence n'est alors
 * simplement pas conservée, sans jamais faire échouer l'appelant.
 *
 * @param {boolean} muted État à persister (true = son coupé).
 * @param {Storage} [storage] Implémentation de stockage à utiliser.
 * @returns {boolean} true si la valeur a été écrite, false sinon.
 */
export function persistMute(muted, storage = resolveLocalStorage()) {
  try {
    if (!storage || typeof storage.setItem !== "function") return false;
    storage.setItem(MUTE_STORAGE_KEY, muted ? "true" : "false");
    return true;
  } catch {
    return false;
  }
}
