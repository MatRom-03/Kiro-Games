import Phaser from "phaser";
import { GAME } from "../config/gameConstants.js";
import { ApiClient } from "../services/ApiClient.js";
import { getProfile, LEVEL_COUNT, levelCandyTarget } from "../systems/customizationStore.js";

/**
 * @typedef {import("../services/ApiClient.js").ScoreRecord} ScoreRecord
 */

/**
 * Résultat d'une partie transmis par GameScene via `scene.start`.
 * @typedef {object} GameResult
 * @property {string} username        Pseudo du joueur.
 * @property {("white"|"black")} skin Skin du fantôme choisi.
 * @property {("win"|"lose")} outcome Issue de la partie.
 * @property {number} candiesCollected Bonbons récoltés (0..15).
 * @property {number} candiesRemaining Bonbons restants (15 - candiesCollected).
 * @property {number} secondsRemaining Secondes restantes au timer (0..45).
 * @property {number} durationPlayed  Secondes écoulées depuis le début.
 * @property {number} score           Score calculé (entier >= 0).
 */

/** Couleur orange « Halloween » (titres et accents). */
const ORANGE_STR = "#ff8c1a";
/** Vert utilisé pour une victoire. */
const GREEN_STR = "#5ad85a";
/** Rouge utilisé pour une défaite. */
const RED_STR = "#ff5a5a";

/**
 * Scène de fin de partie (GameOver).
 *
 * Affiche l'issue (victoire/défaite) et le score calculé, puis propose de
 * rejouer (nouvelle Game avec le même pseudo et le même skin) ou de consulter
 * le tableau des scores. À l'affichage, la scène envoie le score au backend
 * une seule fois par partie, en best-effort : si l'envoi échoue, un message
 * non bloquant est affiché, le score reste visible et le bouton « Rejouer »
 * demeure actif (Requirements 10.3, 10.4, 10.5, 10.6, 10.7, 10.8).
 * @extends Phaser.Scene
 */
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOverScene");

    /**
     * Résultat de la partie courante.
     * @type {GameResult|null}
     */
    this.result = null;

    /**
     * Garde garantissant un unique envoi POST par partie (Requirement 10.7).
     * @type {boolean}
     * @private
     */
    this._submitted = false;

    /**
     * Objet Text affichant un message non bloquant d'échec d'envoi.
     * @type {Phaser.GameObjects.Text|null}
     * @private
     */
    this._statusText = null;
  }

  /**
   * Reçoit le résultat de la partie transmis par GameScene.
   * @param {GameResult} data Résultat de la partie.
   * @returns {void}
   */
  init(data) {
    this.result = data || null;
    this._submitted = false;
    this._statusText = null;
  }

  /**
   * Construit l'écran de fin (issue + score + boutons) puis déclenche l'envoi
   * best-effort du score au backend.
   * @returns {Promise<void>}
   */
  async create() {
    this.cameras.main.setBackgroundColor("#000000");

    const result = this.result || {
      username: "",
      skin: "white",
      outcome: "lose",
      candiesCollected: 0,
      candiesRemaining: GAME.CANDIES_TO_WIN,
      secondsRemaining: 0,
      durationPlayed: GAME.TIMER_SECONDS,
      score: 0,
    };

    this._buildOutcome(result);
    this._buildScore(result);
    // En mode carte + victoire : affiche la mini-carte et anime le deblocage.
    if (result.levelMode && result.outcome === "win") {
      this._buildLevelMap(result);
    }
    this._buildButtons(result);
    this._buildStatus();

    await this._submitScore(result);
  }

  /**
   * Affiche l'issue de la partie : victoire ou défaite (Requirement 10.3).
   * @param {GameResult} result Résultat de la partie.
   * @returns {void}
   * @private
   */
  _buildOutcome(result) {
    const win = result.outcome === "win";
    const label = win ? "VICTOIRE !" : "DÉFAITE";
    const color = win ? GREEN_STR : RED_STR;
    const y = (result.levelMode && win) ? 70 : 150;

    this.add
      .text(GAME.WIDTH / 2, y, label, {
        fontFamily: "monospace",
        fontSize: "52px",
        fontStyle: "bold",
        color,
      })
      .setOrigin(0.5, 0.5);
  }

  /**
   * Affiche le score calculé de la partie (Requirement 10.3).
   * @param {GameResult} result Résultat de la partie.
   * @returns {void}
   * @private
   */
  _buildScore(result) {
    const score = Number.isFinite(result.score) ? result.score : 0;
    const win = result.levelMode && result.outcome === "win";
    const yLabel = win ? 118 : 232;
    const yVal = win ? 150 : 272;

    this.add
      .text(GAME.WIDTH / 2, yLabel, "SCORE", {
        fontFamily: "monospace",
        fontSize: win ? "16px" : "20px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(GAME.WIDTH / 2, yVal, String(score), {
        fontFamily: "monospace",
        fontSize: win ? "34px" : "48px",
        fontStyle: "bold",
        color: ORANGE_STR,
      })
      .setOrigin(0.5, 0.5);
  }

  /**
   * Mini-carte des 5 niveaux avec animation de deblocage du niveau suivant.
   * @param {GameResult} result
   * @returns {void}
   * @private
   */
  _buildLevelMap(result) {
    const prof = getProfile(result.username);
    const best = prof.levelBest || [];
    const justCleared = result.levelIndex; // niveau qu on vient de reussir
    const nextIndex = justCleared + 1;      // niveau a debloquer (si existe)

    // Disposition horizontale simple de 5 noeuds.
    const y = 210;
    const x0 = 230;
    const x1 = GAME.WIDTH - 230;
    const nodes = [];
    for (let i = 0; i < LEVEL_COUNT; i++) {
      nodes.push({ x: Math.round(x0 + (x1 - x0) * (i / (LEVEL_COUNT - 1))), y });
    }

    // Chemin.
    const pathG = this.add.graphics().setDepth(1);
    pathG.lineStyle(3, 0x5a4a78, 0.8);
    for (let i = 0; i < nodes.length - 1; i++) {
      pathG.beginPath();
      pathG.moveTo(nodes[i].x, nodes[i].y);
      pathG.lineTo(nodes[i + 1].x, nodes[i + 1].y);
      pathG.strokePath();
    }

    for (let i = 0; i < LEVEL_COUNT; i++) {
      const node = nodes[i];
      // Etat AVANT ce deblocage : le niveau "nextIndex" etait verrouille.
      const unlockedNow = i < prof.unlocked;
      const isTheNewOne = i === nextIndex && unlockedNow;
      const t = LEVEL_COUNT > 1 ? i / (LEVEL_COUNT - 1) : 0;
      const col = this._levelColor(t, unlockedNow && !isTheNewOne ? true : unlockedNow);

      const g = this.add.graphics().setDepth(2);
      const draw = (unlocked) => {
        g.clear();
        g.fillStyle(0x000000, 0.4);
        g.fillCircle(node.x, node.y + 2, 18);
        g.fillStyle(unlocked ? col : 0x3a3346, 1);
        g.fillCircle(node.x, node.y, 16);
        g.lineStyle(2, 0xffffff, unlocked ? 0.8 : 0.25);
        g.strokeCircle(node.x, node.y, 16);
      };

      if (isTheNewOne) {
        // Le noeud reste verrouille au depart ; la tete du monstre du niveau
        // precedent le recouvre, puis EXPLOSE pour reveler le niveau debloque.
        draw(false);
        const enemyKey = this._enemyKeyForLevel(justCleared);
        const head = (enemyKey && this.textures.exists(enemyKey))
          ? this.add.image(node.x, node.y, enemyKey).setDepth(6).setScale(1.1)
          : null;

        this.time.delayedCall(600, () => {
          // Flash lumineux.
          const flash = this.add.circle(node.x, node.y, 10, 0xffffff, 0.9).setDepth(7);
          this.tweens.add({ targets: flash, radius: 40, alpha: 0, scale: 2, duration: 300, onComplete: () => flash.destroy() });

          // Fragments qui giclent (petits morceaux colores).
          const fragColor = this._enemyFragColor(justCleared);
          for (let f = 0; f < 12; f++) {
            const ang = (Math.PI * 2 * f) / 12 + Math.random() * 0.4;
            const dist = 26 + Math.random() * 26;
            const frag = this.add.rectangle(node.x, node.y, 4 + Math.random() * 4, 4 + Math.random() * 4, fragColor, 1).setDepth(7);
            this.tweens.add({
              targets: frag,
              x: node.x + Math.cos(ang) * dist,
              y: node.y + Math.sin(ang) * dist + 10, // legere gravite
              angle: Math.random() * 360,
              alpha: 0,
              duration: 500 + Math.random() * 250,
              ease: "Quad.easeOut",
              onComplete: () => frag.destroy(),
            });
          }

          // Disparition de la tete (explosion) : grossit + fade.
          if (head) {
            this.tweens.add({
              targets: head, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 260,
              onComplete: () => head.destroy(),
            });
          }

          // Revele le noeud debloque dessous, avec une pulsation.
          this.time.delayedCall(180, () => {
            draw(true);
            g.setScale(0.2);
            this.tweens.add({ targets: g, scaleX: 1, scaleY: 1, ease: "Back.easeOut", duration: 350 });
            const num = this.add.text(node.x, node.y, String(i + 1), {
              fontFamily: "monospace", fontSize: "16px", fontStyle: "bold", color: "#1a1024",
            }).setOrigin(0.5).setDepth(3).setAlpha(0);
            this.tweens.add({ targets: num, alpha: 1, duration: 300, delay: 120 });
            const star = this.add.text(node.x, node.y - 28, "DEBLOQUE !", {
              fontFamily: "monospace", fontSize: "12px", fontStyle: "bold", color: "#ffd24a",
            }).setOrigin(0.5).setDepth(5).setAlpha(0);
            this.tweens.add({ targets: star, alpha: 1, y: node.y - 36, duration: 400, yoyo: true, hold: 700 });
          });
        });
      } else {
        draw(unlockedNow);
        this.add.text(node.x, node.y, unlockedNow ? String(i + 1) : "", {
          fontFamily: "monospace", fontSize: "16px", fontStyle: "bold", color: "#1a1024",
        }).setOrigin(0.5).setDepth(3);
        if (!unlockedNow) {
          // Petit cadenas dessine.
          const lock = this.add.graphics().setDepth(3);
          lock.lineStyle(2, 0xdddddd, 1);
          lock.beginPath(); lock.arc(node.x, node.y - 3, 3.5, Math.PI, 0, false); lock.strokePath();
          lock.lineStyle(0);
          lock.fillStyle(0xdddddd, 1); lock.fillRoundedRect(node.x - 5, node.y - 1, 10, 8, 2);
        }
      }
    }
  }

  /**
   * Couleur d un noeud : degrade jaune->rouge (par difficulte) ; gris si
   * verrouille.
   * @param {number} t
   * @param {boolean} unlocked
   * @returns {number}
   * @private
   */
  _levelColor(t, unlocked) {
    if (!unlocked) return 0x3a3346;
    const r = Math.round(0xff + (0xd1 - 0xff) * t);
    const g = Math.round(0xd2 + (0x1a - 0xd2) * t);
    const b = Math.round(0x4a + (0x1a - 0x4a) * t);
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Cle de texture du monstre d un niveau (meme mapping que GameScene).
   * @param {number} levelIndex
   * @returns {string}
   * @private
   */
  _enemyKeyForLevel(levelIndex) {
    const enemies = ["witch", "skeleton", "vampire", "spectre", "pumpkinhead"];
    return enemies[Math.max(0, Math.min(enemies.length - 1, levelIndex | 0))];
  }

  /**
   * Couleur dominante des fragments d explosion selon le monstre.
   * @param {number} levelIndex
   * @returns {number}
   * @private
   */
  _enemyFragColor(levelIndex) {
    const cols = [0x7fb069, 0xeae8dc, 0x8a0d16, 0x4fe0b0, 0xff7a18];
    return cols[Math.max(0, Math.min(cols.length - 1, levelIndex | 0))];
  }

  /**
   * Construit les boutons « Rejouer » (nouvelle Game, même pseudo/skin) et
   * « Voir le tableau des scores » (Scoreboard) (Requirements 10.4, 10.5, 10.6).
   * @param {GameResult} result Résultat de la partie.
   * @returns {void}
   * @private
   */
  _buildButtons(result) {
    const cx = GAME.WIDTH / 2;
    const y = 380;

    const baseData = {
      username: result.username,
      skin: result.skin,
      color: result.color,
      accessories: result.accessories,
    };

    // Y a-t-il un niveau suivant debloque ? (victoire en mode carte, pas le 5).
    const prof = getProfile(result.username);
    const nextIndex = (result.levelIndex || 0) + 1;
    const hasNext =
      result.levelMode &&
      result.outcome === "win" &&
      nextIndex < LEVEL_COUNT &&
      nextIndex < prof.unlocked;

    if (hasNext) {
      // Trois boutons : Rejouer / Niveau suivant / Menu.
      this._makeButton(cx - 170, y, "REJOUER", 0x5a8f3a, () => {
        this.scene.start("GameScene", { ...baseData, level: result.levelIndex });
      });
      this._makeButton(cx, y, "NIVEAU SUIVANT", 0xb06bf0, () => {
        this.scene.start("GameScene", { ...baseData, level: nextIndex });
      });
      this._makeButton(cx + 170, y, "MENU", 0xb0532a, () => {
        this.scene.start("LauncherScene");
      });
    } else {
      // Rejouer + Menu uniquement.
      this._makeButton(cx - 90, y, "REJOUER", 0x5a8f3a, () => {
        const again = { ...baseData };
        if (result.levelMode) again.level = result.levelIndex;
        this.scene.start("GameScene", again);
      });
      this._makeButton(cx + 90, y, "MENU", 0xb0532a, () => {
        this.scene.start("LauncherScene");
      });
    }
  }

  /**
   * Crée un bouton rectangulaire cliquable avec libellé (même style que le
   * Launcher).
   * @param {number} x Centre X.
   * @param {number} y Centre Y.
   * @param {string} label Texte du bouton.
   * @param {number} color Couleur de fond (hex).
   * @param {() => void} onClick Action au clic.
   * @returns {Phaser.GameObjects.Container}
   * @private
   */
  _makeButton(x, y, label, color, onClick) {
    const text = this.add
      .text(0, 0, label, {
        fontFamily: "monospace",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5);

    const padX = 18;
    const padY = 10;
    const w = text.width + padX * 2;
    const h = text.height + padY * 2;

    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.lineStyle(2, 0xffffff, 0.4);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

    const btn = this.add.container(x, y, [bg, text]);
    btn.setSize(w, h);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setAlpha(0.85));
    btn.on("pointerout", () => btn.setAlpha(1));
    btn.on("pointerdown", onClick);

    return btn;
  }

  /**
   * Prépare l'emplacement du message d'état non bloquant (échec d'envoi).
   * @returns {void}
   * @private
   */
  _buildStatus() {
    this._statusText = this.add
      .text(GAME.WIDTH / 2, 430, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: ORANGE_STR,
      })
      .setOrigin(0.5, 0.5);
  }

  /**
   * Envoie le score au backend une seule fois par partie, en best-effort. En
   * cas d'échec, affiche un message non bloquant sans retirer le score ni
   * désactiver le bouton « Rejouer » (Requirements 10.7, 10.8).
   * @param {GameResult} result Résultat de la partie.
   * @returns {Promise<void>}
   * @private
   */
  async _submitScore(result) {
    if (this._submitted) return; // unique envoi par partie (10.7)
    this._submitted = true;

    // Score envoye au tableau : le TOTAL des niveaux (scoreboardScore) si
    // disponible, sinon le score de la manche.
    const sbScore = Number.isFinite(result.scoreboardScore)
      ? result.scoreboardScore
      : result.score;
    try {
      await ApiClient.submitScore({
        username: result.username,
        score: sbScore,
        duration: result.durationPlayed,
        color: result.color,
        accessories: result.accessories,
        candies: result.candies,
      });
      // Synchronise la progression des niveaux (debloquage + meilleurs scores)
      // cote serveur, best-effort.
      try {
        const prof = getProfile(result.username);
        await ApiClient.saveProfile(result.username, {
          color: prof.color,
          owned: prof.owned,
          equipped: prof.equipped,
          candies: prof.candies,
          levelBest: prof.levelBest,
          unlocked: prof.unlocked,
        });
      } catch { /* best-effort */ }
    } catch {
      // Échec non bloquant : score conservé, bouton Rejouer actif (10.8).
      if (this._statusText) {
        this._statusText.setText("Enregistrement du score impossible.");
      }
    }
  }
}
