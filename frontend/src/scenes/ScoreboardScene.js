import Phaser from "phaser";
import { GAME } from "../config/gameConstants.js";
import { ApiClient } from "../services/ApiClient.js";
import TextureFactory from "../gfx/TextureFactory.js";
import {
  MAX_SCORES,
  escapeUsername,
  formatScoreDate,
  normalizeScores,
} from "./scoreboardFormat.js";

export { MAX_SCORES, escapeUsername, formatScoreDate, normalizeScores };

/** @typedef {import("./scoreboardFormat.js").ScoreRecord} ScoreRecord */

const ORANGE_STR = "#ff8c1a";
const PURPLE_STR = "#b06bf0";
const RANK_COLORS = ["#ffd54a", "#c7c7d6", "#d08a52"]; // or, argent, bronze

/**
 * Tableau des scores (Scoreboard). Un seul score par joueur (son meilleur),
 * avec son fantome reconstruit (couleur + accessoires) et son solde de bonbons.
 * @extends Phaser.Scene
 */
export default class ScoreboardScene extends Phaser.Scene {
  constructor() {
    super("ScoreboardScene");
  }

  async create() {
    this.cameras.main.setBackgroundColor("#0b0014");
    this._factory = new TextureFactory(this);
    this._rowKeys = [];

    this._buildTitle();

    const raw = await ApiClient.fetchTop10().catch(() => []);
    const scores = normalizeScores(raw);

    if (scores.length === 0) {
      this._buildEmptyMessage();
      this._buildBackButton();
      return;
    }
    this._buildTable(scores);
    this._buildBackButton();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this._cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this._cleanup, this);
  }

  _buildTitle() {
    this.add
      .text(GAME.WIDTH / 2, 40, "TABLEAU DES SCORES", {
        fontFamily: "monospace",
        fontSize: "32px",
        fontStyle: "bold",
        color: ORANGE_STR,
      })
      .setOrigin(0.5);
  }

  _buildEmptyMessage() {
    this.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT / 2, "Aucun score pour le moment.", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
  }

  /**
   * Colonnes (x de reference) :
   *  rang | perso | pseudo | score | bonbons | date
   */
  _columns() {
    return { rank: 70, ghost: 130, name: 180, score: 560, candies: 700, date: 840 };
  }

  _buildTable(scores) {
    const col = this._columns();
    const headerY = 84;
    const rowStartY = 116;
    const rowH = 44;

    // En-tetes.
    const hStyle = { fontFamily: "monospace", fontSize: "14px", fontStyle: "bold", color: PURPLE_STR };
    this.add.text(col.rank, headerY, "#", hStyle).setOrigin(0.5);
    this.add.text(col.name, headerY, "PSEUDO", hStyle).setOrigin(0, 0.5);
    this.add.text(col.score, headerY, "SCORE", hStyle).setOrigin(1, 0.5);
    this.add.text(col.candies, headerY, "BONBONS", hStyle).setOrigin(1, 0.5);
    this.add.text(col.date, headerY, "DATE", hStyle).setOrigin(0, 0.5);

    const sep = this.add.graphics();
    sep.lineStyle(2, 0x5a2a82, 1);
    sep.lineBetween(40, headerY + 16, GAME.WIDTH - 40, headerY + 16);

    scores.forEach((record, i) => {
      const rowY = rowStartY + i * rowH;
      const rank = i + 1;

      // Bande de fond alternee + surbrillance top 3.
      const bandColor = rank <= 3 ? 0x2a1840 : (i % 2 === 0 ? 0x160f24 : 0x120b1c);
      const band = this.add.graphics();
      band.fillStyle(bandColor, rank <= 3 ? 0.9 : 0.6);
      band.fillRoundedRect(40, rowY - rowH / 2 + 3, GAME.WIDTH - 80, rowH - 6, 6);
      if (rank <= 3) {
        band.lineStyle(2, Phaser.Display.Color.HexStringToColor(RANK_COLORS[rank - 1]).color, 0.9);
        band.strokeRoundedRect(40, rowY - rowH / 2 + 3, GAME.WIDTH - 80, rowH - 6, 6);
      }

      // Rang (couleur medaille pour le top 3).
      this.add
        .text(col.rank, rowY, String(rank), {
          fontFamily: "monospace",
          fontSize: "16px",
          fontStyle: "bold",
          color: rank <= 3 ? RANK_COLORS[rank - 1] : "#ffffff",
        })
        .setOrigin(0.5);

      // Fantome reconstruit (couleur de contour + accessoires equipes).
      const key = `sb_ghost_${i}`;
      this._rowKeys.push(key);
      if (this.textures.exists(key)) this.textures.remove(key);
      this._factory.makeGhostCustom(key, {
        color: record && record.color === "white" ? "white" : "violet",
        accessories: Array.isArray(record && record.accessories) ? record.accessories : [],
      });
      this.add.image(col.ghost, rowY, key).setScale(0.82);

      // Pseudo (echappe).
      const nameColor = rank === 1 ? ORANGE_STR : rank <= 3 ? "#ffe9c0" : "#ffffff";
      this.add
        .text(col.name, rowY, escapeUsername(record && record.username), {
          fontFamily: "monospace",
          fontSize: "16px",
          color: nameColor,
        })
        .setOrigin(0, 0.5);

      // Score.
      const scoreVal = record && Number.isFinite(record.score) ? record.score : 0;
      this.add
        .text(col.score, rowY, String(scoreVal), {
          fontFamily: "monospace",
          fontSize: "16px",
          fontStyle: "bold",
          color: "#ffffff",
        })
        .setOrigin(1, 0.5);

      // Bonbons (icone + nombre).
      const candies = record && Number.isFinite(record.candies) ? record.candies : 0;
      this.add
        .text(col.candies, rowY, String(candies), {
          fontFamily: "monospace",
          fontSize: "15px",
          color: ORANGE_STR,
        })
        .setOrigin(1, 0.5);
      this.add.image(col.candies + 16, rowY, "candy").setScale(1.1);

      // Date.
      this.add
        .text(col.date, rowY, formatScoreDate(record && record.date), {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#b9b2c8",
        })
        .setOrigin(0, 0.5);
    });
  }

  _buildBackButton() {
    const label = this.add
      .text(0, 0, "RETOUR", {
        fontFamily: "monospace",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    const w = label.width + 36;
    const h = label.height + 20;
    const bg = this.add.graphics();
    bg.fillStyle(0x5a8f3a, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.lineStyle(2, 0xffffff, 0.4);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    const btn = this.add.container(90, GAME.HEIGHT - 30, [bg, label]);
    btn.setSize(w, h);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setAlpha(0.85));
    btn.on("pointerout", () => btn.setAlpha(1));
    btn.on("pointerdown", () => this.scene.start("LauncherScene"));
  }

  _cleanup() {
    for (const k of this._rowKeys || []) {
      if (this.textures && this.textures.exists(k)) this.textures.remove(k);
    }
  }
}
