import { describe, it, expect } from "vitest";
import {
  LAST_USERNAME_KEY,
  loadLastUsername,
  saveLastUsername,
} from "../src/systems/lastUsernamePersistence.js";

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    _raw: map,
  };
}

describe("lastUsernamePersistence", () => {
  it("chaîne vide par défaut", () => {
    expect(loadLastUsername(makeStorage())).toBe("");
  });

  it("sauvegarde et relit le pseudo", () => {
    const s = makeStorage();
    saveLastUsername("Casper", s);
    expect(s.getItem(LAST_USERNAME_KEY)).toBe("Casper");
    expect(loadLastUsername(s)).toBe("Casper");
  });

  it("tolère l'absence de stockage", () => {
    expect(loadLastUsername(null)).toBe("");
    expect(saveLastUsername("x", null)).toBe(false);
  });
});
