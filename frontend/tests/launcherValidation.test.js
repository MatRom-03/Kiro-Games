import { describe, it, expect } from "vitest";
import {
  sanitizeUsername,
  validateLaunch,
  USERNAME_MAX_LENGTH,
} from "../src/scenes/launcherValidation.js";

describe("sanitizeUsername", () => {
  it("supprime les espaces de début et de fin", () => {
    expect(sanitizeUsername("  Casper  ")).toBe("Casper");
  });

  it("tronque à 20 caractères (Requirement 2.3)", () => {
    const long = "A".repeat(30);
    expect(sanitizeUsername(long)).toHaveLength(USERNAME_MAX_LENGTH);
    expect(sanitizeUsername(long)).toBe("A".repeat(20));
  });

  it("supprime les espaces avant de tronquer", () => {
    expect(sanitizeUsername("   " + "B".repeat(25) + "   ")).toBe(
      "B".repeat(20),
    );
  });

  it("renvoie une chaîne vide pour un pseudo composé uniquement d'espaces", () => {
    expect(sanitizeUsername("     ")).toBe("");
  });

  it("renvoie une chaîne vide pour une entrée non chaîne", () => {
    expect(sanitizeUsername(undefined)).toBe("");
    expect(sanitizeUsername(null)).toBe("");
    expect(sanitizeUsername(42)).toBe("");
  });
});

describe("validateLaunch", () => {
  it("autorise le lancement avec un pseudo valide et un skin", () => {
    expect(validateLaunch({ username: "Casper", skin: "white" })).toEqual({
      ok: true,
    });
    expect(validateLaunch({ username: "Spooky", skin: "black" })).toEqual({
      ok: true,
    });
  });

  it("bloque pour un pseudo vide (Requirement 2.2)", () => {
    expect(validateLaunch({ username: "", skin: "white" })).toEqual({
      ok: false,
      reason: "username",
    });
  });

  it("bloque pour un pseudo composé uniquement d'espaces (Requirement 2.2)", () => {
    expect(validateLaunch({ username: "    ", skin: "black" })).toEqual({
      ok: false,
      reason: "username",
    });
  });

  it("bloque sans skin sélectionné (Requirement 1.4)", () => {
    expect(validateLaunch({ username: "Casper", skin: null })).toEqual({
      ok: false,
      reason: "skin",
    });
  });

  it("rejette toute valeur de skin autre que white/black", () => {
    expect(validateLaunch({ username: "Casper", skin: "green" })).toEqual({
      ok: false,
      reason: "skin",
    });
  });

  it("priorise le pseudo manquant sur le skin manquant", () => {
    expect(validateLaunch({ username: "   ", skin: null })).toEqual({
      ok: false,
      reason: "username",
    });
  });
});
