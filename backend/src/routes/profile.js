// backend/src/routes/profile.js
/**
 * Routes REST du profil cosmetique par username.
 * GET  /api/profile/:username  -> profil { color, owned, equipped, candies }
 * PUT  /api/profile/:username  -> upsert du profil
 */
import { Router } from "express";
import { getProfile, saveProfile } from "../store/profileStore.js";

/** Valide/normalise le corps d un PUT profil. */
export function validateProfile(body) {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Corps de requete invalide." };
  }
  const color = body.color === "white" ? "white" : "violet";
  const owned = Array.isArray(body.owned)
    ? body.owned.filter((a) => typeof a === "string").slice(0, 50)
    : [];
  const equipped = Array.isArray(body.equipped)
    ? body.equipped.filter((a) => typeof a === "string").slice(0, 50)
    : [];
  const candies =
    typeof body.candies === "number" && Number.isFinite(body.candies)
      ? Math.max(0, Math.trunc(body.candies))
      : 0;
  const levelBest = Array.isArray(body.levelBest)
    ? body.levelBest.slice(0, 5).map((v) => (Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0))
    : [];
  const unlocked =
    typeof body.unlocked === "number" && Number.isFinite(body.unlocked)
      ? Math.max(1, Math.min(5, Math.trunc(body.unlocked)))
      : 1;
  return { ok: true, value: { color, owned, equipped, candies, levelBest, unlocked } };
}

const router = Router();

router.get("/:username", async (req, res) => {
  try {
    const profile = await getProfile(req.params.username);
    res.json(profile);
  } catch {
    res.status(500).json({ error: "lecture impossible" });
  }
});

router.put("/:username", async (req, res) => {
  const v = validateProfile(req.body);
  if (!v.ok) return res.status(400).json({ success: false, error: v.error });
  try {
    const saved = await saveProfile(req.params.username, v.value);
    res.json({ success: true, profile: saved });
  } catch {
    res.status(500).json({ success: false, error: "enregistrement impossible" });
  }
});

export default router;
