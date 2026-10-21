import { describe, it, expect, beforeEach } from "vitest";
import {
  getProfile,
  addCandies,
  setColor,
  buyAccessory,
  toggleEquip,
  ACCESSORY_PRICE,
  ACCESSORY_CATEGORY,
} from "../src/systems/customizationStore.js";

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    _raw: map,
  };
}

describe("customizationStore", () => {
  let s;
  beforeEach(() => { s = makeStorage(); });

  it("profil par défaut : 0 bonbon, noir, rien possédé", () => {
    expect(getProfile("Bob", s)).toMatchObject({ candies: 0, color: "violet", owned: [], equipped: [] });
  });

  it("cumule les bonbons par username (isolé)", () => {
    expect(addCandies("Bob", 10, s)).toBe(10);
    expect(addCandies("Bob", 5, s)).toBe(15);
    expect(getProfile("Alice", s).candies).toBe(0);
  });

  it("username insensible à la casse et aux espaces", () => {
    addCandies("  Bob ", 7, s);
    expect(getProfile("bob", s).candies).toBe(7);
  });

  it("change la couleur de contour (violet/blanc)", () => {
    setColor("Bob", "white", s);
    expect(getProfile("Bob", s).color).toBe("white");
    setColor("Bob", "violet", s);
    expect(getProfile("Bob", s).color).toBe("violet");
  });

  it("refuse l'achat sans assez de bonbons", () => {
    const res = buyAccessory("Bob", "tophat", s);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("insufficient");
  });

  it("achète un accessoire et débite le prix", () => {
    addCandies("Bob", ACCESSORY_PRICE, s);
    const res = buyAccessory("Bob", "tophat", s);
    expect(res.ok).toBe(true);
    const p = getProfile("Bob", s);
    expect(p.owned).toContain("tophat");
    expect(p.candies).toBe(0);
  });

  it("équipe puis retire un accessoire possédé", () => {
    addCandies("Bob", ACCESSORY_PRICE, s);
    buyAccessory("Bob", "glasses", s);
    toggleEquip("Bob", "glasses", s);
    expect(getProfile("Bob", s).equipped).toContain("glasses");
    toggleEquip("Bob", "glasses", s);
    expect(getProfile("Bob", s).equipped).not.toContain("glasses");
  });

  it("un seul accessoire équipé par catégorie (chapeaux)", () => {
    addCandies("Bob", ACCESSORY_PRICE * 2, s);
    buyAccessory("Bob", "tophat", s);
    buyAccessory("Bob", "pumpkin", s);
    toggleEquip("Bob", "tophat", s);
    toggleEquip("Bob", "pumpkin", s); // doit déséquiper tophat
    const p = getProfile("Bob", s);
    expect(p.equipped).toContain("pumpkin");
    expect(p.equipped).not.toContain("tophat");
    // Les deux sont bien dans la même catégorie.
    expect(ACCESSORY_CATEGORY.tophat).toBe(ACCESSORY_CATEGORY.pumpkin);
  });

  it("autorise un accessoire équipé dans chaque catégorie differente", () => {
    addCandies("Bob", ACCESSORY_PRICE * 3, s);
    buyAccessory("Bob", "tophat", s);
    buyAccessory("Bob", "glasses", s);
    buyAccessory("Bob", "cape", s);
    toggleEquip("Bob", "tophat", s);
    toggleEquip("Bob", "glasses", s);
    toggleEquip("Bob", "cape", s);
    const p = getProfile("Bob", s);
    expect(p.equipped.sort()).toEqual(["cape", "glasses", "tophat"]);
  });

  it("n'équipe pas un accessoire non possédé", () => {
    toggleEquip("Bob", "tophat", s);
    expect(getProfile("Bob", s).equipped).toEqual([]);
  });
});
