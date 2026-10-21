/**
 * Logique pure de mise en forme du tableau des scores, extraite de
 * `ScoreboardScene` afin d'être testable sans dépendance à Phaser (ni au DOM).
 *
 * @typedef {object} ScoreRecord
 * @property {string} username Pseudo du joueur.
 * @property {number} score    Score calculé (entier >= 0).
 * @property {number} duration Durée de la partie en secondes (entier >= 0).
 * @property {string} date     Horodatage ISO 8601 (généré côté serveur).
 */

/** Nombre maximal de scores affichés dans le tableau (Requirement 12.2). */
export const MAX_SCORES = 10;

/**
 * Échappe un pseudo pour éviter toute injection HTML lors de l'affichage
 * (Requirement 12.4). Remplace les caractères sensibles (`& < > " '`) par
 * leurs entités HTML. Fonction pure.
 *
 * Note : le rendu de texte de Phaser n'interprète pas le HTML, mais
 * l'échappement est appliqué conformément à l'exigence et au cas où le pseudo
 * serait réutilisé dans un contexte HTML natif.
 *
 * @param {unknown} value Valeur brute du pseudo (idéalement une chaîne).
 * @returns {string} Le pseudo échappé, sûr pour un contexte HTML.
 */
export function escapeUsername(value) {
  const str = value == null ? "" : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Met en forme une date de score pour l'affichage. Tente une localisation
 * courte ; retombe sur la chaîne d'origine si la valeur n'est pas une date
 * valide. Fonction pure.
 *
 * @param {unknown} isoDate Horodatage ISO 8601 (ou valeur arbitraire).
 * @returns {string} Date formatée, ou chaîne vide si rien d'exploitable.
 */
export function formatScoreDate(isoDate) {
  if (isoDate == null || isoDate === "") return "";
  const raw = String(isoDate);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  try {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    // Environnements sans Intl : repli sur la portion date de l'ISO.
    return raw.slice(0, 10);
  }
}

/**
 * Normalise une réponse de scores en un tableau d'au plus `MAX_SCORES`
 * enregistrements (Requirement 12.2). Toute valeur non tableau devient `[]`.
 * Fonction pure.
 *
 * @param {unknown} scores Réponse brute (idéalement un tableau de ScoreRecord).
 * @returns {ScoreRecord[]} Au plus les 10 premiers enregistrements.
 */
export function normalizeScores(scores) {
  if (!Array.isArray(scores)) return [];
  return scores.slice(0, MAX_SCORES);
}
