import { describe, it, expect, beforeEach } from "vitest";
import SoundManager, {
  persistMute,
  MUTE_STORAGE_KEY,
} from "../src/systems/SoundManager.js";

/**
 * Petit faux localStorage pour les tests : implémente l'API minimale
 * (getItem/setItem) sur une Map, avec option pour simuler des erreurs.
 */
function makeStorage({ throwOnSet = false } = {}) {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (throwOnSet) throw new Error("quota exceeded");
      map.set(k, String(v));
    },
    _raw: map,
  };
}

/** Fausse instance Phaser exposant uniquement `sound.mute`. */
function makeFakeGame(initialMute = false) {
  return { sound: { mute: initialMute } };
}

describe("persistMute (logique de persistance pure)", () => {
  it("écrit 'true' dans le stockage quand le son est coupé", () => {
    const storage = makeStorage();
    expect(persistMute(true, storage)).toBe(true);
    expect(storage.getItem(MUTE_STORAGE_KEY)).toBe("true");
  });

  it("écrit 'false' dans le stockage quand le son est actif", () => {
    const storage = makeStorage();
    expect(persistMute(false, storage)).toBe(true);
    expect(storage.getItem(MUTE_STORAGE_KEY)).toBe("false");
  });

  it("renvoie false sans lever quand le stockage est absent", () => {
    expect(persistMute(true, null)).toBe(false);
  });

  it("absorbe les erreurs d'écriture (quota/mode privé) et renvoie false", () => {
    const storage = makeStorage({ throwOnSet: true });
    expect(persistMute(true, storage)).toBe(false);
  });
});

describe("SoundManager", () => {
  beforeEach(() => {
    // Chaque test part d'un stockage propre pour l'état initial.
    globalThis.localStorage = makeStorage();
  });

  it("initialise l'état mute depuis le stockage persisté (coupé)", () => {
    globalThis.localStorage.setItem(MUTE_STORAGE_KEY, "true");
    const sm = new SoundManager();
    expect(sm.isMuted()).toBe(true);
  });

  it("initialise à non coupé par défaut", () => {
    const sm = new SoundManager();
    expect(sm.isMuted()).toBe(false);
  });

  it("applique l'état initial au jeu Phaser fourni", () => {
    globalThis.localStorage.setItem(MUTE_STORAGE_KEY, "true");
    const game = makeFakeGame(false);
    const sm = new SoundManager(game);
    expect(sm.isMuted()).toBe(true);
    expect(game.sound.mute).toBe(true);
  });

  it("setMuted applique l'état au jeu et le persiste", () => {
    const game = makeFakeGame(false);
    const sm = new SoundManager(game);
    sm.setMuted(true);
    expect(sm.isMuted()).toBe(true);
    expect(game.sound.mute).toBe(true);
    expect(globalThis.localStorage.getItem(MUTE_STORAGE_KEY)).toBe("true");
  });

  it("setMuted coerce les valeurs truthy/falsy en booléen", () => {
    const sm = new SoundManager();
    expect(sm.setMuted(1)).toBe(true);
    expect(sm.setMuted(0)).toBe(false);
  });

  it("toggle inverse l'état et le synchronise avec le jeu", () => {
    const game = makeFakeGame(false);
    const sm = new SoundManager(game);
    expect(sm.toggle()).toBe(true);
    expect(game.sound.mute).toBe(true);
    expect(sm.toggle()).toBe(false);
    expect(game.sound.mute).toBe(false);
  });

  it("attachGame synchronise un jeu attaché après coup", () => {
    globalThis.localStorage.setItem(MUTE_STORAGE_KEY, "true");
    const sm = new SoundManager();
    const game = makeFakeGame(false);
    sm.attachGame(game);
    expect(game.sound.mute).toBe(true);
  });

  it("ne lève pas sans jeu attaché", () => {
    const sm = new SoundManager();
    expect(() => sm.toggle()).not.toThrow();
  });
});
