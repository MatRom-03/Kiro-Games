import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import app from "../src/server.js";

let tempDir, prev;
beforeEach(async () => {
  prev = process.env.SCORES_DATA_DIR;
  tempDir = await mkdtemp(path.join(tmpdir(), "profile-"));
  process.env.SCORES_DATA_DIR = tempDir;
});
afterEach(async () => {
  if (prev === undefined) delete process.env.SCORES_DATA_DIR;
  else process.env.SCORES_DATA_DIR = prev;
  await rm(tempDir, { recursive: true, force: true });
});

describe("profile API", () => {
  it("GET renvoie un profil par defaut si absent", async () => {
    const res = await request(app).get("/api/profile/Bob");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ color: "violet", owned: [], equipped: [], candies: 0 });
    expect(res.body.levelBest).toEqual([0, 0, 0, 0, 0]);
    expect(res.body.unlocked).toBe(1);
  });

  it("PUT upsert puis GET reflete la sauvegarde", async () => {
    const payload = { color: "white", owned: ["tophat", "cape"], equipped: ["tophat"], candies: 33 };
    const put = await request(app).put("/api/profile/Bob").send(payload);
    expect(put.status).toBe(200);
    expect(put.body.success).toBe(true);

    const get = await request(app).get("/api/profile/Bob");
    expect(get.body).toMatchObject(payload);
  });

  it("username insensible a la casse/espaces", async () => {
    await request(app).put("/api/profile/%20Bob%20").send({ color: "white", owned: [], equipped: [], candies: 5 });
    const get = await request(app).get("/api/profile/bob");
    expect(get.body.candies).toBe(5);
    expect(get.body.color).toBe("white");
  });

  it("normalise les valeurs invalides", async () => {
    const put = await request(app).put("/api/profile/X").send({ color: "weird", owned: "nope", candies: -7 });
    expect(put.status).toBe(200);
    expect(put.body.profile).toMatchObject({ color: "violet", owned: [], equipped: [], candies: 0 });
  });
});
