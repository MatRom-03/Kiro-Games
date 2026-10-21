// backend/src/routes/scores.js
/**
 * Routes REST du tableau des scores.
 * POST /api/scores  : enregistre un score (validation stricte).
 * GET  /api/scores  : renvoie le Top 10 trié par score décroissant.
 */
import { Router } from "express";
import { addScore, getTop10 } from "../store/scoreStore.js";

/** Longueur maximale autorisée pour un pseudo. */
const USERNAME_MAX = 20;
/** Borne inférieure inclusive pour `score` et `duration`. */
const NUMBER_MIN = 0;
/** Borne supérieure inclusive pour `score` et `duration`. */
const NUMBER_MAX = 999999999;

/**
 * Vérifie qu'une valeur est un entier compris dans `[NUMBER_MIN, NUMBER_MAX]`.
 * @param {any} value
 * @returns {boolean}
 */
function isValidNumberField(value) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= NUMBER_MIN &&
    value <= NUMBER_MAX
  );
}

/**
 * Valide le payload d'un score.
 * `username` : chaîne, non vide après trim, au plus 20 caractères (longueur
 * du pseudo après trim). `score` et `duration` : entiers dans
 * `[0, 999999999]`. En cas d'échec, l'erreur indique le champ en cause.
 * @param {any} body
 * @returns {{ok:true, value:{username:string,score:number,duration:number}}|{ok:false,error:string}}
 */
export function validate(body) {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Le corps de la requête est invalide." };
  }

  const { username, score, duration } = body;

  if (typeof username !== "string") {
    return { ok: false, error: "Le champ `username` doit être une chaîne de caractères." };
  }
  const trimmed = username.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Le champ `username` ne doit pas être vide." };
  }
  if (trimmed.length > USERNAME_MAX) {
    return {
      ok: false,
      error: `Le champ \`username\` ne doit pas dépasser ${USERNAME_MAX} caractères.`,
    };
  }

  if (!isValidNumberField(score)) {
    return {
      ok: false,
      error: `Le champ \`score\` doit être un entier compris entre ${NUMBER_MIN} et ${NUMBER_MAX}.`,
    };
  }

  if (!isValidNumberField(duration)) {
    return {
      ok: false,
      error: `Le champ \`duration\` doit être un entier compris entre ${NUMBER_MIN} et ${NUMBER_MAX}.`,
    };
  }

  // Champs optionnels de personnalisation (tolerants).
  const color = body.color === "white" ? "white" : "violet";
  const accessories = Array.isArray(body.accessories)
    ? body.accessories.filter((a) => typeof a === "string").slice(0, 10)
    : [];
  const candies =
    typeof body.candies === "number" && Number.isFinite(body.candies)
      ? Math.max(0, Math.min(NUMBER_MAX, Math.trunc(body.candies)))
      : 0;

  return {
    ok: true,
    value: { username: trimmed, score, duration, color, accessories, candies },
  };
}

const router = Router();

router.post("/", async (req, res) => {
  const v = validate(req.body);
  if (!v.ok) return res.status(400).json({ success: false, error: v.error });
  try {
    const record = await addScore(v.value);
    res.status(201).json({ success: true, record });
  } catch {
    res.status(500).json({ success: false, error: "enregistrement impossible" });
  }
});

router.get("/", async (_req, res) => {
  try {
    res.json(await getTop10());
  } catch {
    res.status(500).json({ error: "lecture impossible" });
  }
});

export default router;
