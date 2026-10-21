// frontend/src/services/ApiClient.js
/**
 * @typedef {object} ScoreRecord
 * @property {string} username Pseudo du joueur.
 * @property {number} score    Score calculé (entier >= 0).
 * @property {number} duration Durée de la partie en secondes (entier >= 0).
 * @property {string} date     Horodatage ISO 8601 (généré côté serveur).
 */

/**
 * Accès à l'API de scores. URL relatives : le proxy Nginx route vers le backend
 * (`/api/scores` -> `http://backend:3000`), ce qui évite toute configuration CORS.
 */
export const ApiClient = {
  /**
   * Envoie un score au backend.
   * @param {{ username: string, score: number, duration: number }} payload
   *   Données du score à persister.
   * @returns {Promise<ScoreRecord>} L'enregistrement créé renvoyé par le backend.
   * @throws {Error} Si la réponse HTTP n'est pas un succès (status hors 2xx).
   */
  async submitScore(payload) {
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`POST /api/scores -> ${res.status}`);
    return (await res.json()).record;
  },

  /**
   * Récupère le Top 10 des scores (déjà trié côté backend).
   * @returns {Promise<ScoreRecord[]>} Les enregistrements du tableau des scores.
   * @throws {Error} Si la réponse HTTP n'est pas un succès (status hors 2xx).
   */
  async fetchTop10() {
    const res = await fetch("/api/scores");
    if (!res.ok) throw new Error(`GET /api/scores -> ${res.status}`);
    return res.json();
  },

  /**
   * Recupere le profil cosmetique serveur d un username.
   * @param {string} username
   * @returns {Promise<{color:string, owned:string[], equipped:string[], candies:number}>}
   */
  async fetchProfile(username) {
    const res = await fetch(`/api/profile/${encodeURIComponent(username)}`);
    if (!res.ok) throw new Error(`GET /api/profile -> ${res.status}`);
    return res.json();
  },

  /**
   * Enregistre (upsert) le profil cosmetique serveur d un username.
   * @param {string} username
   * @param {{color:string, owned:string[], equipped:string[], candies:number}} profile
   * @returns {Promise<object>}
   */
  async saveProfile(username, profile) {
    const res = await fetch(`/api/profile/${encodeURIComponent(username)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (!res.ok) throw new Error(`PUT /api/profile -> ${res.status}`);
    return (await res.json()).profile;
  },
};
