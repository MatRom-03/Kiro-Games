import { describe, it, expect } from "vitest";
import {
  escapeUsername,
  formatScoreDate,
  normalizeScores,
  MAX_SCORES,
} from "../src/scenes/scoreboardFormat.js";

describe("ScoreboardScene — escapeUsername (anti-injection HTML, Req 12.4)", () => {
  it("échappe les chevrons pour neutraliser une balise HTML", () => {
    const result = escapeUsername("<script>alert(1)</script>");
    expect(result).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  it("échappe l'esperluette, les guillemets et l'apostrophe", () => {
    expect(escapeUsername(`a & b "c" 'd'`)).toBe(
      "a &amp; b &quot;c&quot; &#39;d&#39;",
    );
  });

  it("échappe l'esperluette avant tout afin de ne pas double-encoder", () => {
    expect(escapeUsername("&lt;")).toBe("&amp;lt;");
  });

  it("laisse inchangé un pseudo sans caractère spécial", () => {
    expect(escapeUsername("Casper_42")).toBe("Casper_42");
  });

  it("convertit les valeurs non chaîne en chaîne et traite null/undefined", () => {
    expect(escapeUsername(123)).toBe("123");
    expect(escapeUsername(null)).toBe("");
    expect(escapeUsername(undefined)).toBe("");
  });

  it("ne laisse passer aucun caractère HTML actif pour une charge d'injection", () => {
    const result = escapeUsername('"><img src=x onerror=alert(1)>');
    expect(result).not.toMatch(/[<>"]/);
  });
});

describe("ScoreboardScene — normalizeScores (Req 12.2)", () => {
  it("renvoie [] pour une valeur non tableau (échec de récupération)", () => {
    expect(normalizeScores(null)).toEqual([]);
    expect(normalizeScores(undefined)).toEqual([]);
    expect(normalizeScores({})).toEqual([]);
  });

  it("conserve au plus 10 scores", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      username: `u${i}`,
      score: i,
      duration: 0,
      date: "2024-10-31T00:00:00.000Z",
    }));
    const result = normalizeScores(many);
    expect(result).toHaveLength(MAX_SCORES);
    expect(result[0].username).toBe("u0");
    expect(result[9].username).toBe("u9");
  });

  it("laisse une liste plus courte intacte", () => {
    const few = [
      { username: "a", score: 1, duration: 0, date: "" },
      { username: "b", score: 2, duration: 0, date: "" },
    ];
    expect(normalizeScores(few)).toEqual(few);
  });
});

describe("ScoreboardScene — formatScoreDate", () => {
  it("formate une date ISO valide sans lever d'erreur", () => {
    const out = formatScoreDate("2024-10-31T12:00:00.000Z");
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("renvoie une chaîne vide pour une valeur absente", () => {
    expect(formatScoreDate(null)).toBe("");
    expect(formatScoreDate(undefined)).toBe("");
    expect(formatScoreDate("")).toBe("");
  });

  it("retombe sur la valeur brute pour une date invalide", () => {
    expect(formatScoreDate("pas-une-date")).toBe("pas-une-date");
  });
});
