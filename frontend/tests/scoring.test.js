import { describe, it, expect } from "vitest";
import { computeScore } from "../src/systems/scoring.js";

describe("computeScore", () => {
  it("applique la formule candiesRemaining * 100 + secondsRemaining * 50", () => {
    expect(computeScore({ candiesRemaining: 3, secondsRemaining: 20 })).toBe(
      3 * 100 + 20 * 50,
    );
  });

  it("renvoie 0 quand aucun bonbon restant et aucune seconde restante", () => {
    expect(computeScore({ candiesRemaining: 0, secondsRemaining: 0 })).toBe(0);
  });

  it("gère la victoire (candiesRemaining = 0) avec du temps restant", () => {
    expect(computeScore({ candiesRemaining: 0, secondsRemaining: 45 })).toBe(
      45 * 50,
    );
  });

  it("gère la défaite maximale (bornes hautes)", () => {
    expect(computeScore({ candiesRemaining: 15, secondsRemaining: 45 })).toBe(
      15 * 100 + 45 * 50,
    );
  });

  it("gère 15 bonbons restants et 0 seconde (défaite au temps écoulé, aucun bonbon collecté)", () => {
    expect(computeScore({ candiesRemaining: 15, secondsRemaining: 0 })).toBe(
      15 * 100,
    );
  });

  it("gère 0 bonbon restant et 0 seconde (victoire sur le fil)", () => {
    expect(computeScore({ candiesRemaining: 0, secondsRemaining: 0 })).toBe(0);
  });

  it("ne compte que les bonbons restants quand il ne reste aucune seconde", () => {
    expect(computeScore({ candiesRemaining: 15, secondsRemaining: 0 })).toBe(
      1500,
    );
    expect(computeScore({ candiesRemaining: 0, secondsRemaining: 0 })).toBe(0);
  });

  it("ne compte que les secondes restantes quand il ne reste aucun bonbon", () => {
    expect(computeScore({ candiesRemaining: 0, secondsRemaining: 45 })).toBe(
      2250,
    );
    expect(computeScore({ candiesRemaining: 0, secondsRemaining: 0 })).toBe(0);
  });

  it("retourne toujours un entier non négatif", () => {
    const score = computeScore({ candiesRemaining: 7, secondsRemaining: 12 });
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("borne les entrées négatives à 0", () => {
    expect(computeScore({ candiesRemaining: -5, secondsRemaining: -10 })).toBe(
      0,
    );
  });

  it("tronque les entrées non entières", () => {
    expect(
      computeScore({ candiesRemaining: 2.9, secondsRemaining: 3.9 }),
    ).toBe(2 * 100 + 3 * 50);
  });

  it("renvoie 0 pour des entrées manquantes ou non finies", () => {
    expect(computeScore()).toBe(0);
    expect(computeScore({})).toBe(0);
    expect(
      computeScore({ candiesRemaining: NaN, secondsRemaining: Infinity }),
    ).toBe(0);
  });
});
