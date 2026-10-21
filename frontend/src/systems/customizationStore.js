// frontend/src/systems/customizationStore.js
//
// Persistance locale (localStorage) de la personnalisation du fantome par
// username : solde de bonbons (monnaie), couleur, et accessoires possedes /
// equipes. Les accessoires sont ranges par CATEGORIE (chapeaux, masques,
// capes) ; on ne peut equiper qu UN seul accessoire par categorie a la fois.
// Sans dependance a Phaser (testable en Node).

/** Cle racine de stockage des profils de personnalisation. */
export const CUSTOMIZATION_STORAGE_KEY = "ghostdash.customization";

/** Prix (en bonbons) de chaque accessoire. */
export const ACCESSORY_PRICE = 10;

/** Nombre de niveaux de la carte. */
export const LEVEL_COUNT = 5;

/** Objectif de bonbons du niveau `levelIndex` (0-based) : 15 + 5*index. */
export function levelCandyTarget(levelIndex) {
  return 15 + 5 * Math.max(0, Math.trunc(levelIndex));
}

/**
 * Catalogue : categories ordonnees, chacune avec ses articles (cle + libelle).
 * @type {Array<{id:string, label:string, items:Array<{key:string,label:string}>}>}
 */
export const CATALOG = [
  {
    id: "hats",
    label: "CHAPEAUX",
    items: [
      { key: "tophat", label: "Haut-de-forme" },
      { key: "pumpkin", label: "Citrouille" },
      { key: "wizardhat", label: "Sorciere" },
      { key: "crown", label: "Couronne" },
    ],
  },
  {
    id: "masks",
    label: "MASQUES",
    items: [
      { key: "glasses", label: "Lunettes" },
      { key: "mask", label: "Loup" },
      { key: "skull", label: "Squelette" },
      { key: "eyepatch", label: "Pirate" },
    ],
  },
  {
    id: "capes",
    label: "CAPES",
    items: [
      { key: "cape", label: "Vampire" },
      { key: "cape_orange", label: "Citrouille" },
      { key: "cape_purple", label: "Sorciere" },
      { key: "cape_green", label: "Poison" },
    ],
  },
];

/** Liste a plat de toutes les cles d accessoires valides. */
export const ACCESSORIES = CATALOG.flatMap((c) => c.items.map((i) => i.key));

/** Table accessoire -> categorie. */
export const ACCESSORY_CATEGORY = CATALOG.reduce((acc, c) => {
  for (const it of c.items) acc[it.key] = c.id;
  return acc;
}, /** @type {Record<string,string>} */ ({}));

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
 * Normalise un username en cle de profil (trim, minuscules).
 * @param {string} username
 * @returns {string}
 */
function keyFor(username) {
  return String(username || "").trim().toLowerCase() || "_anon";
}

/** Profil par defaut : fantome noir, rien possede/equipe, 0 bonbon. */
function defaultProfile() {
  return { candies: 0, color: "violet", owned: [], equipped: [] };
}

function readAll(storage = resolveStorage()) {
  try {
    if (!storage || typeof storage.getItem !== "function") return {};
    const raw = storage.getItem(CUSTOMIZATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(all, storage = resolveStorage()) {
  try {
    if (!storage || typeof storage.setItem !== "function") return false;
    storage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

/**
 * Garantit qu au plus un accessoire par categorie est present dans une liste
 * d accessoires equipes (garde la derniere occurrence de chaque categorie).
 * @param {string[]} equipped
 * @returns {string[]}
 */
function enforceOnePerCategory(equipped) {
  const byCat = {};
  for (const a of equipped) {
    if (ACCESSORIES.includes(a)) byCat[ACCESSORY_CATEGORY[a]] = a;
  }
  return Object.values(byCat);
}

/**
 * Renvoie le profil (normalise) d un username.
 * @param {string} username
 * @param {Storage} [storage]
 * @returns {{candies:number, color:("white"|"black"), owned:string[], equipped:string[]}}
 */
export function getProfile(username, storage = resolveStorage()) {
  const all = readAll(storage);
  const base = defaultProfile();
  const stored = all[keyFor(username)];
  const p = stored || {};
  // Bonus de depart : "matteo" demarre a 100 bonbons tant qu aucun profil
  // n a ete enregistre pour lui.
  if (!stored && keyFor(username) === "matteo") base.candies = 100;
  const owned = Array.isArray(p.owned) ? p.owned.filter((a) => ACCESSORIES.includes(a)) : [];
  const equipped = enforceOnePerCategory(
    (Array.isArray(p.equipped) ? p.equipped : []).filter((a) => owned.includes(a)),
  );
  const levelBest = [];
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const v = Array.isArray(p.levelBest) ? p.levelBest[i] : 0;
    levelBest.push(Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);
  }
  // Deblocage : uniquement la valeur stockee (une VICTOIRE l incremente via
  // recordLevelResult). Un simple score > 0 (defaite) ne debloque pas.
  const unlocked = Number.isFinite(p.unlocked) ? Math.max(1, Math.trunc(p.unlocked)) : 1;
  return {
    candies: Number.isFinite(p.candies) ? Math.max(0, Math.trunc(p.candies)) : base.candies,
    color: p.color === "white" ? "white" : "violet",
    owned: [...new Set(owned)],
    equipped,
    levelBest,
    unlocked: Math.min(LEVEL_COUNT, unlocked),
  };
}

/**
 * Persiste un profil pour un username.
 * @param {string} username
 * @param {object} profile
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function saveProfile(username, profile, storage = resolveStorage()) {
  const all = readAll(storage);
  const owned = Array.isArray(profile.owned)
    ? [...new Set(profile.owned.filter((a) => ACCESSORIES.includes(a)))]
    : [];
  const equipped = enforceOnePerCategory(
    (Array.isArray(profile.equipped) ? profile.equipped : []).filter((a) => owned.includes(a)),
  );
  const levelBest = [];
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const v = Array.isArray(profile.levelBest) ? profile.levelBest[i] : 0;
    levelBest.push(Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);
  }
  all[keyFor(username)] = {
    candies: Math.max(0, Math.trunc(profile.candies || 0)),
    color: profile.color === "white" ? "white" : "violet",
    owned,
    equipped,
    levelBest,
    unlocked: Math.min(LEVEL_COUNT, Math.max(1, Math.trunc(profile.unlocked || 1))),
  };
  return writeAll(all, storage);
}

/**
 * Credite des bonbons gagnes au profil (monnaie cumulee).
 * @param {string} username
 * @param {number} n
 * @param {Storage} [storage]
 * @returns {number} Nouveau solde.
 */
export function addCandies(username, n, storage = resolveStorage()) {
  const prof = getProfile(username, storage);
  prof.candies += Math.max(0, Math.trunc(n || 0));
  saveProfile(username, prof, storage);
  return prof.candies;
}

/**
 * Definit la couleur du fantome.
 * @param {string} username
 * @param {"violet"|"white"} color Couleur du CONTOUR (le corps reste noir).
 * @param {Storage} [storage]
 * @returns {object}
 */
export function setColor(username, color, storage = resolveStorage()) {
  const prof = getProfile(username, storage);
  prof.color = color === "white" ? "white" : "violet";
  saveProfile(username, prof, storage);
  return prof;
}

/**
 * Achete un accessoire si solde suffisant et pas deja possede.
 * @param {string} username
 * @param {string} accessory
 * @param {Storage} [storage]
 * @returns {{ok:boolean, reason?:string, profile:object}}
 */
export function buyAccessory(username, accessory, storage = resolveStorage()) {
  const prof = getProfile(username, storage);
  if (!ACCESSORIES.includes(accessory)) return { ok: false, reason: "unknown", profile: prof };
  if (prof.owned.includes(accessory)) return { ok: true, reason: "already-owned", profile: prof };
  if (prof.candies < ACCESSORY_PRICE) return { ok: false, reason: "insufficient", profile: prof };
  prof.candies -= ACCESSORY_PRICE;
  prof.owned.push(accessory);
  saveProfile(username, prof, storage);
  return { ok: true, profile: prof };
}

/**
 * Equipe/desequipe un accessoire possede. Equiper un accessoire DESEQUIPE
 * automatiquement tout autre accessoire deja equipe de la MEME categorie
 * (un seul par categorie).
 * @param {string} username
 * @param {string} accessory
 * @param {Storage} [storage]
 * @returns {object} Profil mis a jour.
 */
/**
 * Enregistre le resultat d un niveau : met a jour le meilleur score du niveau
 * et debloque le niveau suivant si c est une victoire. Renvoie le profil.
 * @param {string} username
 * @param {number} levelIndex 0-based
 * @param {number} score
 * @param {boolean} won
 * @param {Storage} [storage]
 * @returns {object}
 */
export function recordLevelResult(username, levelIndex, score, won, storage = resolveStorage()) {
  const prof = getProfile(username, storage);
  const i = Math.max(0, Math.min(LEVEL_COUNT - 1, Math.trunc(levelIndex)));
  const s = Number.isFinite(score) ? Math.max(0, Math.trunc(score)) : 0;
  if (s > (prof.levelBest[i] || 0)) prof.levelBest[i] = s;
  if (won) prof.unlocked = Math.min(LEVEL_COUNT, Math.max(prof.unlocked, i + 2));
  saveProfile(username, prof, storage);
  return getProfile(username, storage);
}

/** Somme des meilleurs scores de tous les niveaux. */
export function totalLevelScore(username, storage = resolveStorage()) {
  const prof = getProfile(username, storage);
  return (prof.levelBest || []).reduce((a, b) => a + (b || 0), 0);
}

export function toggleEquip(username, accessory, storage = resolveStorage()) {
  const prof = getProfile(username, storage);
  if (!prof.owned.includes(accessory)) return prof;
  const cat = ACCESSORY_CATEGORY[accessory];
  const already = prof.equipped.includes(accessory);
  // Retire tout accessoire de la meme categorie.
  prof.equipped = prof.equipped.filter((a) => ACCESSORY_CATEGORY[a] !== cat);
  // Si l accessoire n etait pas deja equipe, on l equipe (sinon on l a retire).
  if (!already) prof.equipped.push(accessory);
  saveProfile(username, prof, storage);
  return prof;
}
