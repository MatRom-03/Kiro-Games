import { describe, it, expect, beforeEach, vi } from "vitest";
import { TextureFactory } from "../src/gfx/TextureFactory.js";

/**
 * Crée un faux objet Graphics qui enregistre les appels de dessin et de
 * génération de texture. Chaque méthode de dessin est chaînable (retourne
 * `this`), comme l'API réelle de Phaser.
 */
function makeFakeGraphics() {
  const calls = [];
  const generated = [];
  const record = (name) => (...args) => {
    calls.push({ name, args });
    return graphics;
  };
  const graphics = {
    calls,
    generated,
    fillStyle: record("fillStyle"),
    lineStyle: record("lineStyle"),
    fillRect: record("fillRect"),
    strokeRect: record("strokeRect"),
    fillCircle: record("fillCircle"),
    strokeCircle: record("strokeCircle"),
    fillEllipse: record("fillEllipse"),
    fillTriangle: record("fillTriangle"),
    beginPath: record("beginPath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    strokePath: record("strokePath"),
    generateTexture: vi.fn((key, w, h) => {
      generated.push({ key, w, h });
      return graphics;
    }),
    destroy: vi.fn(),
  };
  return graphics;
}

/**
 * Fausse scène Phaser exposant `make.graphics(...)`.
 */
function makeFakeScene(graphics) {
  return {
    make: {
      graphics: vi.fn(() => graphics),
    },
  };
}

describe("TextureFactory", () => {
  /** @type {ReturnType<typeof makeFakeGraphics>} */
  let gfx;
  /** @type {TextureFactory} */
  let factory;

  beforeEach(() => {
    gfx = makeFakeGraphics();
    factory = new TextureFactory(makeFakeScene(gfx));
  });

  it("makeGhost(white) dessine puis enregistre la texture sous la clé fournie", () => {
    factory.makeGhost("white", "ghost_white");

    expect(gfx.generated).toHaveLength(1);
    expect(gfx.generated[0].key).toBe("ghost_white");
    expect(gfx.generated[0].w).toBeGreaterThan(0);
    expect(gfx.generated[0].h).toBeGreaterThan(0);
    expect(gfx.destroy).toHaveBeenCalledOnce();
  });

  it("makeGhost(black) utilise une couleur de remplissage différente de white", () => {
    const whiteGfx = makeFakeGraphics();
    new TextureFactory(makeFakeScene(whiteGfx)).makeGhost("white", "ghost_white");
    const blackGfx = makeFakeGraphics();
    new TextureFactory(makeFakeScene(blackGfx)).makeGhost("black", "ghost_black");

    const firstFill = (calls) =>
      calls.find((c) => c.name === "fillStyle").args[0];

    expect(firstFill(whiteGfx.calls)).not.toBe(firstFill(blackGfx.calls));
    expect(blackGfx.generated[0].key).toBe("ghost_black");
  });

  it("makeGhost dessine des yeux orange (0xff8c1a)", () => {
    factory.makeGhost("white", "ghost_white");
    const usedColors = gfx.calls
      .filter((c) => c.name === "fillStyle")
      .map((c) => c.args[0]);
    expect(usedColors).toContain(0xff8c1a);
    // deux yeux dessinés via fillCircle
    expect(gfx.calls.filter((c) => c.name === "fillCircle").length).toBeGreaterThanOrEqual(2);
  });

  it("makeWitch dessine (chapeau/robe/balai) et enregistre la texture 'witch'", () => {
    factory.makeWitch("witch");

    expect(gfx.generated).toHaveLength(1);
    expect(gfx.generated[0].key).toBe("witch");
    // chapeau et robe utilisent des triangles ; balai utilise un tracé
    expect(gfx.calls.some((c) => c.name === "fillTriangle")).toBe(true);
    expect(gfx.calls.some((c) => c.name === "strokePath")).toBe(true);
    expect(gfx.destroy).toHaveBeenCalledOnce();
  });

  it("makeCandy enregistre la texture sous la clé fournie (bonbon/projectile)", () => {
    factory.makeCandy("candy");
    expect(gfx.generated[0].key).toBe("candy");

    const projGfx = makeFakeGraphics();
    new TextureFactory(makeFakeScene(projGfx)).makeCandy("projectile");
    expect(projGfx.generated[0].key).toBe("projectile");
  });

  it("makeTile utilise la taille fournie pour une tuile carrée", () => {
    factory.makeTile("tile", 32);
    expect(gfx.generated[0]).toMatchObject({ key: "tile", w: 32, h: 32 });

    const bigGfx = makeFakeGraphics();
    new TextureFactory(makeFakeScene(bigGfx)).makeTile("tile", 48);
    expect(bigGfx.generated[0]).toMatchObject({ key: "tile", w: 48, h: 48 });
  });

  it("chaque méthode dessine avant d'appeler generateTexture (aucune ressource réseau)", () => {
    const runs = [
      (f) => f.makeGhost("white", "g"),
      (f) => f.makeWitch("w"),
      (f) => f.makeCandy("c"),
      (f) => f.makeTile("t", 32),
    ];
    for (const run of runs) {
      const local = makeFakeGraphics();
      const f = new TextureFactory(makeFakeScene(local));
      run(f);
      const drawCalls = local.calls.filter((c) => c.name !== "generateTexture");
      expect(drawCalls.length).toBeGreaterThan(0);
      expect(local.generateTexture).toHaveBeenCalledOnce();
    }
  });
});
