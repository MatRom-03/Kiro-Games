// backend/src/store/profileStore.js
/**
 * Persistance des profils cosmetiques par username dans
 * backend/data/profiles.json : couleur de contour, accessoires possedes et
 * equipes, solde de bonbons. Permet de retrouver sa config sur n importe quel
 * navigateur/appareil.
 *
 * Lecture tolerante (fichier absent/corrompu => {}).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

function dataDir() {
  return process.env.SCORES_DATA_DIR
    ? path.resolve(process.env.SCORES_DATA_DIR)
    : path.resolve("data");
}

function profilesFile() {
  return path.join(dataDir(), "profiles.json");
}

/** Cle de profil (insensible casse/espaces). */
function keyFor(username) {
  return String(username || "").trim().toLowerCase() || "_anon";
}

/** Lit la table complete des profils ({} si absent/corrompu). */
async function readAll() {
  try {
    const raw = await readFile(profilesFile(), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Nombre de niveaux de la carte. */
const LEVEL_COUNT = 5;

/** Normalise un profil (cosmetiques + progression des niveaux). */
function normalize(p = {}) {
  // Meilleur score par niveau (0 = non termine). Toujours un tableau de 5.
  const rawLevels = Array.isArray(p.levelBest) ? p.levelBest : [];
  const levelBest = [];
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const v = rawLevels[i];
    levelBest.push(Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);
  }
  // Niveau le plus haut debloque : au moins 1. On autorise aussi a le deduire
  // des niveaux termines (level i termine => i+1 debloque).
  // Deblocage : uniquement la valeur stockee (incrementee par une victoire
  // cote client). Un score > 0 sur une defaite ne debloque pas.
  const unlocked = Math.min(LEVEL_COUNT, Number.isFinite(p.unlocked) ? Math.max(1, Math.trunc(p.unlocked)) : 1);

  return {
    color: p.color === "white" ? "white" : "violet",
    owned: Array.isArray(p.owned) ? p.owned.filter((a) => typeof a === "string").slice(0, 50) : [],
    equipped: Array.isArray(p.equipped) ? p.equipped.filter((a) => typeof a === "string").slice(0, 50) : [],
    candies: Number.isFinite(p.candies) ? Math.max(0, Math.trunc(p.candies)) : 0,
    levelBest,
    unlocked,
  };
}

/**
 * Renvoie le profil cosmetique d un username (profil par defaut si absent).
 * @param {string} username
 * @returns {Promise<{color:string, owned:string[], equipped:string[], candies:number}>}
 */
export async function getProfile(username) {
  const all = await readAll();
  return normalize(all[keyFor(username)]);
}

/**
 * Enregistre (upsert) le profil cosmetique d un username.
 * @param {string} username
 * @param {object} profile
 * @returns {Promise<object>} Le profil normalise persiste.
 */
export async function saveProfile(username, profile) {
  const all = await readAll();
  const norm = normalize(profile);
  all[keyFor(username)] = norm;
  await mkdir(dataDir(), { recursive: true });
  await writeFile(profilesFile(), JSON.stringify(all, null, 2), "utf8");
  return norm;
}
