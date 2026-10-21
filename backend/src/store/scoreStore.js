// backend/src/store/scoreStore.js
/**
 * Persistance des scores dans backend/data/scores.json.
 *
 * Un SEUL enregistrement par username (insensible a la casse/espaces) : on
 * conserve le MEILLEUR score, et on met a jour a chaque envoi la couleur, les
 * accessoires equipes et le nombre de bonbons (dernieres valeurs connues).
 *
 * Lecture tolerante (fichier absent/corrompu => []), tri Top 10 par score
 * decroissant puis date croissante.
 *
 * @typedef {Object} ScoreRecord
 * @property {string} username
 * @property {number} score
 * @property {number} duration
 * @property {string} date   ISO 8601 (genere cote serveur)
 * @property {string} [color] Couleur de contour ("violet"|"white")
 * @property {string[]} [accessories] Accessoires equipes
 * @property {number} [candies] Solde de bonbons
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

function dataDir() {
  return process.env.SCORES_DATA_DIR
    ? path.resolve(process.env.SCORES_DATA_DIR)
    : path.resolve("data");
}

function scoresFile() {
  return path.join(dataDir(), "scores.json");
}

/** Cle de regroupement par username (insensible casse/espaces). */
function userKey(username) {
  return String(username || "").trim().toLowerCase();
}

/**
 * Lit tous les enregistrements. Renvoie [] si le fichier est absent/corrompu.
 * @returns {Promise<ScoreRecord[]>}
 */
export async function readAll() {
  try {
    const raw = await readFile(scoresFile(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Deduplique une liste par username en gardant, pour chaque username, le
 * meilleur score (et, a score egal, la date la plus ancienne). Les champs
 * color/accessories/candies retenus sont ceux de l enregistrement le plus
 * recent pour ce username.
 * @param {ScoreRecord[]} list
 * @returns {ScoreRecord[]}
 */
export function dedupeByUser(list) {
  /** @type {Map<string, ScoreRecord>} */
  const best = new Map();
  /** @type {Map<string, ScoreRecord>} */
  const latest = new Map();

  for (const r of list) {
    if (!r || typeof r.username !== "string") continue;
    const k = userKey(r.username);
    // Meilleur score (tie-break date croissante).
    const b = best.get(k);
    if (!b || r.score > b.score || (r.score === b.score && String(r.date) < String(b.date))) {
      best.set(k, r);
    }
    // Enregistrement le plus recent (pour color/accessories/candies).
    const l = latest.get(k);
    if (!l || String(r.date) > String(l.date)) latest.set(k, r);
  }

  const out = [];
  for (const [k, b] of best) {
    const l = latest.get(k) || b;
    out.push({
      username: b.username,
      score: b.score,
      duration: b.duration,
      date: b.date,
      color: l.color === "white" ? "white" : "violet",
      accessories: Array.isArray(l.accessories) ? l.accessories : [],
      candies: Number.isFinite(l.candies) ? Math.max(0, Math.trunc(l.candies)) : 0,
    });
  }
  return out;
}

/**
 * Ajoute/merge un score pour un username (UPSERT). Conserve le meilleur score ;
 * met a jour color/accessories/candies avec les valeurs fournies. Ajoute une
 * date ISO cote serveur. Persiste la liste dedupliquee.
 * @param {{username:string, score:number, duration:number, color?:string, accessories?:string[], candies?:number}} input
 * @returns {Promise<ScoreRecord>} L enregistrement resultant pour ce username.
 */
export async function addScore(input) {
  const all = await readAll();
  const now = new Date().toISOString();
  const incoming = {
    username: input.username,
    score: input.score,
    duration: input.duration,
    date: now,
    color: input.color === "white" ? "white" : "violet",
    accessories: Array.isArray(input.accessories) ? input.accessories : [],
    candies: Number.isFinite(input.candies) ? Math.max(0, Math.trunc(input.candies)) : 0,
  };

  // Deduplique l existant puis fusionne l entree.
  const merged = dedupeByUser([...all, incoming]);

  await mkdir(dataDir(), { recursive: true });
  await writeFile(scoresFile(), JSON.stringify(merged, null, 2), "utf8");

  // Renvoie l enregistrement final pour ce username.
  const k = userKey(input.username);
  return merged.find((r) => userKey(r.username) === k) || incoming;
}

/**
 * Renvoie les 10 meilleurs scores (un par username), tri par score decroissant
 * puis date croissante.
 * @returns {Promise<ScoreRecord[]>}
 */
export async function getTop10() {
  const all = dedupeByUser(await readAll());
  return all
    .slice()
    .sort((a, b) => b.score - a.score || String(a.date).localeCompare(String(b.date)))
    .slice(0, 10);
}
