import { describe, it, expect, beforeEach } from "vitest";
import {
  getProfile,
  recordLevelResult,
  totalLevelScore,
  levelCandyTarget,
  LEVEL_COUNT,
} from "../src/systems/customizationStore.js";

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

describe("progression des niveaux", () => {
  let s;
  beforeEach(() => { s = makeStorage(); });

  it("objectif de bonbons = 15 + 5*index", () => {
    expect(levelCandyTarget(0)).toBe(15);
    expect(levelCandyTarget(1)).toBe(20);
    expect(levelCandyTarget(4)).toBe(35);
  });

  it("profil par défaut : 5 niveaux à 0, 1 débloqué", () => {
    const p = getProfile("Bob", s);
    expect(p.levelBest).toEqual([0, 0, 0, 0, 0]);
    expect(p.unlocked).toBe(1);
  });

  it("gagner un niveau débloque le suivant et enregistre le score", () => {
    recordLevelResult("Bob", 0, 1200, true, s);
    const p = getProfile("Bob", s);
    expect(p.levelBest[0]).toBe(1200);
    expect(p.unlocked).toBe(2);
  });

  it("ne garde que le meilleur score d'un niveau", () => {
    recordLevelResult("Bob", 0, 1000, true, s);
    recordLevelResult("Bob", 0, 1500, true, s);
    recordLevelResult("Bob", 0, 800, true, s);
    expect(getProfile("Bob", s).levelBest[0]).toBe(1500);
  });

  it("perdre n'ouvre pas le niveau suivant mais garde le meilleur score", () => {
    recordLevelResult("Bob", 0, 600, false, s);
    const p = getProfile("Bob", s);
    expect(p.levelBest[0]).toBe(600);
    expect(p.unlocked).toBe(1);
  });

  it("le total = somme des meilleurs scores", () => {
    recordLevelResult("Bob", 0, 1000, true, s);
    recordLevelResult("Bob", 1, 1500, true, s);
    expect(totalLevelScore("Bob", s)).toBe(2500);
  });

  it("borne l'index de niveau", () => {
    recordLevelResult("Bob", 99, 500, true, s);
    expect(getProfile("Bob", s).levelBest[LEVEL_COUNT - 1]).toBe(500);
  });
});
