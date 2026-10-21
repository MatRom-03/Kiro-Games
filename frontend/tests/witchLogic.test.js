import { describe, it, expect } from "vitest";
import {
  createWitchState,
  patrolDirection,
  stepPatrol,
} from "../src/entities/witchLogic.js";

describe("witchLogic.createWitchState", () => {
  it("normalise les bornes (patrolMin ≤ patrolMax) et droite par défaut", () => {
    const s = createWitchState(300, 100);
    expect(s.patrolMin).toBe(100);
    expect(s.patrolMax).toBe(300);
    expect(s.direction).toBe(1);
  });

  it("accepte une direction initiale explicite", () => {
    expect(createWitchState(100, 300, -1).direction).toBe(-1);
    expect(createWitchState(100, 300, 1).direction).toBe(1);
  });
});

describe("witchLogic.patrolDirection", () => {
  it("repart vers la droite à la borne gauche (exigence 8.2)", () => {
    const s = createWitchState(100, 300, -1);
    expect(patrolDirection(s, 100)).toBe(1);
    expect(patrolDirection(s, 90)).toBe(1);
  });

  it("repart vers la gauche à la borne droite (exigence 8.2)", () => {
    const s = createWitchState(100, 300, 1);
    expect(patrolDirection(s, 300)).toBe(-1);
    expect(patrolDirection(s, 310)).toBe(-1);
  });

  it("conserve la direction entre les deux bornes (exigence 8.1)", () => {
    expect(patrolDirection(createWitchState(100, 300, 1), 200)).toBe(1);
    expect(patrolDirection(createWitchState(100, 300, -1), 200)).toBe(-1);
  });
});

describe("witchLogic.stepPatrol", () => {
  it("signale une inversion lorsque la direction change à une borne", () => {
    const s = createWitchState(100, 300, 1);
    const atRight = stepPatrol(s, 300);
    expect(atRight.direction).toBe(-1);
    expect(atRight.reversed).toBe(true);
    expect(atRight.state.direction).toBe(-1);
  });

  it("ne signale pas d'inversion au milieu du parcours", () => {
    const s = createWitchState(100, 300, 1);
    const mid = stepPatrol(s, 200);
    expect(mid.direction).toBe(1);
    expect(mid.reversed).toBe(false);
  });

  it("effectue un aller-retour complet entre les bornes", () => {
    let s = createWitchState(100, 300, 1);
    // Atteint la borne droite -> inversion vers la gauche.
    s = stepPatrol(s, 300).state;
    expect(s.direction).toBe(-1);
    // Atteint la borne gauche -> inversion vers la droite.
    s = stepPatrol(s, 100).state;
    expect(s.direction).toBe(1);
  });

  it("ne mute pas l'état d'entrée (fonction pure)", () => {
    const s = createWitchState(100, 300, 1);
    stepPatrol(s, 300);
    expect(s.direction).toBe(1);
  });
});
