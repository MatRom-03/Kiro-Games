import { describe, it, expect } from "vitest";
import { GAME } from "../src/config/gameConstants.js";
import {
  createPlayerState,
  isInvulnerable,
  canFire,
  applyDamage,
  registerFire,
  FIRE_COOLDOWN_MS,
} from "../src/entities/playerLogic.js";

describe("playerLogic.FIRE_COOLDOWN_MS", () => {
  it("vaut au moins 400 ms (exigence 9.1)", () => {
    expect(FIRE_COOLDOWN_MS).toBeGreaterThanOrEqual(400);
  });
});

describe("playerLogic.createPlayerState", () => {
  it("initialise 3 cœurs, non invulnérable, direction droite", () => {
    const s = createPlayerState();
    expect(s.hearts).toBe(GAME.PLAYER_HEARTS);
    expect(s.facing).toBe(1);
    expect(isInvulnerable(s, 0)).toBe(false);
    expect(canFire(s, 0)).toBe(true);
  });
});

describe("playerLogic.applyDamage", () => {
  it("retire un cœur et active l'invulnérabilité 1,5 s hors invulnérabilité", () => {
    const s0 = createPlayerState();
    const { state: s1, damaged } = applyDamage(s0, 1000);
    expect(damaged).toBe(true);
    expect(s1.hearts).toBe(2);
    expect(isInvulnerable(s1, 1000)).toBe(true);
    expect(isInvulnerable(s1, 1000 + GAME.INVULN_MS - 1)).toBe(true);
    expect(isInvulnerable(s1, 1000 + GAME.INVULN_MS)).toBe(false);
  });

  it("ignore le dégât si le joueur est invulnérable (exigence 7.4)", () => {
    const s0 = createPlayerState();
    const { state: s1 } = applyDamage(s0, 1000); // hearts 2, invuln until 2500
    const { state: s2, damaged } = applyDamage(s1, 1500);
    expect(damaged).toBe(false);
    expect(s2.hearts).toBe(2);
  });

  it("borne les cœurs à 0 (exigence 7.2)", () => {
    let s = createPlayerState();
    let t = 0;
    for (let i = 0; i < 5; i++) {
      s = applyDamage(s, t).state;
      t += GAME.INVULN_MS; // laisser l'invulnérabilité expirer entre deux coups
    }
    expect(s.hearts).toBe(0);
  });

  it("ne mute pas l'état d'entrée (fonction pure)", () => {
    const s0 = createPlayerState();
    applyDamage(s0, 1000);
    expect(s0.hearts).toBe(GAME.PLAYER_HEARTS);
    expect(s0.invulnUntil).toBe(0);
  });
});

describe("playerLogic.registerFire", () => {
  it("autorise un tir immédiat au début de partie, direction droite par défaut", () => {
    const s0 = createPlayerState();
    const { fired, direction, state: s1 } = registerFire(s0, 0);
    expect(fired).toBe(true);
    expect(direction).toBe(1);
    expect(s1.lastFireAt).toBe(0);
  });

  it("ignore un tir avant la fin du cooldown (exigence 9.3)", () => {
    let s = createPlayerState();
    s = registerFire(s, 0).state;
    const early = registerFire(s, FIRE_COOLDOWN_MS - 1);
    expect(early.fired).toBe(false);
    const ok = registerFire(s, FIRE_COOLDOWN_MS);
    expect(ok.fired).toBe(true);
  });

  it("respecte la direction courante", () => {
    const s = { ...createPlayerState(), facing: -1 };
    const { direction } = registerFire(s, 0);
    expect(direction).toBe(-1);
  });
});
