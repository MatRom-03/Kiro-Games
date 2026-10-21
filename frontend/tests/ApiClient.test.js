import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient } from "../src/services/ApiClient.js";

/**
 * Construit une fausse réponse fetch minimale.
 * @param {{ ok: boolean, status: number, body?: any }} opts
 * @returns {{ ok: boolean, status: number, json: () => Promise<any> }}
 */
function makeResponse({ ok, status, body }) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe("ApiClient", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("submitScore", () => {
    it("effectue un POST JSON vers l'URL relative /api/scores avec le payload", async () => {
      const payload = { username: "Casper", score: 1200, duration: 30 };
      const record = { ...payload, date: "2024-10-31T12:00:00.000Z" };
      global.fetch.mockResolvedValue(
        makeResponse({ ok: true, status: 201, body: { success: true, record } }),
      );

      const result = await ApiClient.submitScore(payload);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toBe("/api/scores");
      expect(options.method).toBe("POST");
      expect(options.headers).toEqual({ "Content-Type": "application/json" });
      expect(options.body).toBe(JSON.stringify(payload));
      expect(JSON.parse(options.body)).toEqual(payload);
      expect(result).toEqual(record);
    });

    it("lève une erreur contenant le status quand la réponse n'est pas ok", async () => {
      global.fetch.mockResolvedValue(
        makeResponse({ ok: false, status: 400, body: { error: "invalide" } }),
      );

      await expect(
        ApiClient.submitScore({ username: "", score: 0, duration: 0 }),
      ).rejects.toThrow("POST /api/scores -> 400");
    });
  });

  describe("fetchTop10", () => {
    it("effectue un GET vers l'URL relative /api/scores et renvoie le tableau", async () => {
      const scores = [
        { username: "A", score: 2000, duration: 20, date: "2024-10-31T10:00:00.000Z" },
        { username: "B", score: 1000, duration: 40, date: "2024-10-31T11:00:00.000Z" },
      ];
      global.fetch.mockResolvedValue(
        makeResponse({ ok: true, status: 200, body: scores }),
      );

      const result = await ApiClient.fetchTop10();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toBe("/api/scores");
      // GET : aucune méthode explicite (défaut) ou "GET" selon l'implémentation.
      expect(options === undefined || options.method === undefined).toBe(true);
      expect(result).toEqual(scores);
    });

    it("lève une erreur contenant le status quand la réponse n'est pas ok", async () => {
      global.fetch.mockResolvedValue(
        makeResponse({ ok: false, status: 500, body: { error: "serveur" } }),
      );

      await expect(ApiClient.fetchTop10()).rejects.toThrow(
        "GET /api/scores -> 500",
      );
    });
  });
});
