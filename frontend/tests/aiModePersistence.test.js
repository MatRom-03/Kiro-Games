import { describe, it, expect } from "vitest";
import {
  AI_MODE_STORAGE_KEY,
  loadAiMode,
  persistAiMode,
} from "../src/systems/aiModePersistence.js";

function makeStorage({ throwOnSet = false } = {}) {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (throwOnSet) throw new Error("quota");
      map.set(k, String(v));
    },
    _raw: map,
  };
}

describe("aiModePersistence", () => {
  it("false par défaut quand rien n'est stocké", () => {
    expect(loadAiMode(makeStorage())).toBe(false);
  });

  it("persiste et relit true", () => {
    const s = makeStorage();
    expect(persistAiMode(true, s)).toBe(true);
    expect(s.getItem(AI_MODE_STORAGE_KEY)).toBe("true");
    expect(loadAiMode(s)).toBe(true);
  });

  it("persiste et relit false", () => {
    const s = makeStorage();
    persistAiMode(false, s);
    expect(loadAiMode(s)).toBe(false);
  });

  it("tolère l'absence de stockage sans lever", () => {
    expect(loadAiMode(null)).toBe(false);
    expect(persistAiMode(true, null)).toBe(false);
  });

  it("absorbe les erreurs d'écriture", () => {
    expect(persistAiMode(true, makeStorage({ throwOnSet: true }))).toBe(false);
  });
});
