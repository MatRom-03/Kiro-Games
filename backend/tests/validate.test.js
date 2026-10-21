// backend/tests/validate.test.js
/**
 * Tests unitaires de la fonction `validate` du routeur de scores.
 *
 * Couvre les critères d'acceptation :
 * - Requirement 15.1 : un payload valide (username chaîne non vide ≤ 20 car.,
 *   score et duration entiers dans [0, 999999999]) est accepté.
 * - Requirement 15.3 : rejet avec message indiquant le champ en cause lorsque
 *   `username`/`score`/`duration` est manquant, que `username` est vide ou
 *   uniquement des espaces ou dépasse 20 caractères, ou que `score`/`duration`
 *   est non entier, négatif ou supérieur à 999999999.
 */
import { describe, expect, it } from "vitest";

import { validate } from "../src/routes/scores.js";

const NUMBER_MAX = 999999999;

/** Construit un payload valide, surchargeable champ par champ. */
function makePayload(overrides = {}) {
  return { username: "Casper", score: 1500, duration: 42, ...overrides };
}

describe("validate (payloads valides)", () => {
  it("accepte un payload valide et renvoie la valeur normalisée", () => {
    const result = validate(makePayload());
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({ username: "Casper", score: 1500, duration: 42 });
  });

  it("supprime les espaces de début et de fin du username", () => {
    const result = validate(makePayload({ username: "  Casper  " }));
    expect(result.ok).toBe(true);
    expect(result.value.username).toBe("Casper");
  });

  it("accepte un username de exactement 20 caractères (borne haute incluse)", () => {
    const username = "a".repeat(20);
    const result = validate(makePayload({ username }));
    expect(result.ok).toBe(true);
    expect(result.value.username).toBe(username);
  });

  it("accepte score et duration à la borne basse 0", () => {
    const result = validate(makePayload({ score: 0, duration: 0 }));
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({ username: "Casper", score: 0, duration: 0 });
  });

  it("accepte score et duration à la borne haute 999999999", () => {
    const result = validate(makePayload({ score: NUMBER_MAX, duration: NUMBER_MAX }));
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({
      username: "Casper",
      score: NUMBER_MAX,
      duration: NUMBER_MAX,
    });
  });
});

describe("validate (corps invalide)", () => {
  it("rejette un corps null", () => {
    const result = validate(null);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("rejette un corps qui n'est pas un objet", () => {
    const result = validate("pas un objet");
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe("validate (champ username)", () => {
  it("rejette un username manquant en nommant le champ", () => {
    const { username, ...rest } = makePayload();
    const result = validate(rest);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("username");
  });

  it("rejette un username non chaîne (nombre) en nommant le champ", () => {
    const result = validate(makePayload({ username: 42 }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("username");
  });

  it("rejette un username vide en nommant le champ", () => {
    const result = validate(makePayload({ username: "" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("username");
  });

  it("rejette un username composé uniquement d'espaces en nommant le champ", () => {
    const result = validate(makePayload({ username: "    " }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("username");
  });

  it("rejette un username de plus de 20 caractères en nommant le champ", () => {
    const result = validate(makePayload({ username: "a".repeat(21) }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("username");
  });
});

describe("validate (champ score)", () => {
  it("rejette un score manquant en nommant le champ", () => {
    const { score, ...rest } = makePayload();
    const result = validate(rest);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("score");
  });

  it("rejette un score non entier en nommant le champ", () => {
    const result = validate(makePayload({ score: 12.5 }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("score");
  });

  it("rejette un score non numérique (chaîne) en nommant le champ", () => {
    const result = validate(makePayload({ score: "1500" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("score");
  });

  it("rejette un score négatif en nommant le champ", () => {
    const result = validate(makePayload({ score: -1 }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("score");
  });

  it("rejette un score supérieur à 999999999 en nommant le champ", () => {
    const result = validate(makePayload({ score: NUMBER_MAX + 1 }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("score");
  });
});

describe("validate (champ duration)", () => {
  it("rejette une duration manquante en nommant le champ", () => {
    const { duration, ...rest } = makePayload();
    const result = validate(rest);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("duration");
  });

  it("rejette une duration non entière en nommant le champ", () => {
    const result = validate(makePayload({ duration: 3.14 }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("duration");
  });

  it("rejette une duration non numérique (chaîne) en nommant le champ", () => {
    const result = validate(makePayload({ duration: "42" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("duration");
  });

  it("rejette une duration négative en nommant le champ", () => {
    const result = validate(makePayload({ duration: -5 }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("duration");
  });

  it("rejette une duration supérieure à 999999999 en nommant le champ", () => {
    const result = validate(makePayload({ duration: NUMBER_MAX + 1 }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("duration");
  });
});
