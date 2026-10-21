import Phaser from "phaser";
import { GAME } from "../config/gameConstants.js";
import TextureFactory from "../gfx/TextureFactory.js";
import {
  getProfile,
  saveProfile,
  setColor,
  buyAccessory,
  toggleEquip,
  ACCESSORY_PRICE,
  ACCESSORY_CATEGORY,
  CATALOG,
} from "../systems/customizationStore.js";
import { ApiClient } from "../services/ApiClient.js";

const ORANGE_STR = "#ff8c1a";
const PURPLE_STR = "#b06bf0";

/**
 * Magasin de personnalisation (« Custom skin »).
 *
 * Affiche a gauche le fantome equipe (couleur + accessoires), le solde de
 * bonbons et le choix de couleur. A droite, une boutique organisee par
 * categories (chapeaux, masques, capes). Chaque article a sa propre vignette
 * d apercu (le fantome portant uniquement cet accessoire) et un bouton
 * Acheter / Equiper / Retirer. On ne peut equiper qu un seul article par
 * categorie.
 * @extends Phaser.Scene
 */
export default class CustomSkinScene extends Phaser.Scene {
  constructor() {
    super("CustomSkinScene");
    this.username = "";
  }

  init(data) {
    this.username = (data && data.username) || "Fantome";
  }

  create() {
    this.cameras.main.setBackgroundColor("#0b0014");
    this._factory = new TextureFactory(this);
    this._refreshers = []; // callbacks appeles a chaque _refresh(prof)
    this._itemKeys = []; // cles de textures d apercu a nettoyer

    // Titre + retour.
    this.add
      .text(GAME.WIDTH / 2, 30, "MAGASIN", {
        fontFamily: "monospace",
        fontSize: "30px",
        fontStyle: "bold",
        color: ORANGE_STR,
      })
      .setOrigin(0.5);

    // Solde de bonbons en haut a droite.
    this._candyText = this.add
      .text(GAME.WIDTH - 24, 30, "", {
        fontFamily: "monospace",
        fontSize: "18px",
        fontStyle: "bold",
        color: ORANGE_STR,
      })
      .setOrigin(1, 0.5);

    this._buildLeftPanel();
    this._buildShop();
    this._buildBackButton();

    this._refresh();

    // Charge le profil cosmetique serveur (best-effort) et le fusionne dans le
    // store local, puis rafraichit l affichage.
    this._loadServerProfile();

    // Sauvegarde serveur a l arret de la scene (filet en plus du bouton RETOUR).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._saveServerProfile());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this._cleanupTextures, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this._cleanupTextures, this);
  }

  /**
   * Recupere le profil cosmetique serveur et le fusionne dans le store local.
   * Best-effort : en cas d echec reseau, on garde le profil local.
   * @returns {Promise<void>}
   * @private
   */
  async _loadServerProfile() {
    try {
      const remote = await ApiClient.fetchProfile(this.username);
      if (remote && typeof remote === "object") {
        const local = getProfile(this.username);
        // Fusionne la progression : on garde le meilleur de local/serveur pour
        // chaque niveau, et le niveau debloque le plus avance. Ne jamais effacer.
        const rb = Array.isArray(remote.levelBest) ? remote.levelBest : [];
        const mergedBest = (local.levelBest || []).map((v, i) =>
          Math.max(v || 0, rb[i] || 0),
        );
        saveProfile(this.username, {
          color: remote.color === "white" ? "white" : "violet",
          owned: Array.isArray(remote.owned) ? remote.owned : local.owned,
          equipped: Array.isArray(remote.equipped) ? remote.equipped : local.equipped,
          candies: Math.max(local.candies || 0, remote.candies || 0),
          levelBest: mergedBest,
          unlocked: Math.max(local.unlocked || 1, remote.unlocked || 1),
        });
        this._refresh();
      }
    } catch {
      /* hors-ligne : on reste sur le profil local */
    }
  }

  /**
   * Pousse le profil cosmetique local vers le serveur (best-effort).
   * @returns {Promise<void>}
   * @private
   */
  async _saveServerProfile() {
    try {
      const p = getProfile(this.username);
      await ApiClient.saveProfile(this.username, {
        color: p.color,
        owned: p.owned,
        equipped: p.equipped,
        candies: p.candies,
        // IMPORTANT : conserver la progression des niveaux, sinon le serveur
        // ecrase levelBest/unlocked et la progression est perdue.
        levelBest: p.levelBest,
        unlocked: p.unlocked,
      });
    } catch {
      /* best-effort : la config reste au moins en local */
    }
  }

  /** Panneau de gauche : grand apercu equipe, solde, couleur. */
  _buildLeftPanel() {
    const cx = GAME.WIDTH * 0.2;

    // Cadre.
    const panel = this.add.graphics();
    panel.fillStyle(0x15101f, 0.6);
    panel.fillRoundedRect(20, 70, GAME.WIDTH * 0.33, GAME.HEIGHT - 150, 10);
    panel.lineStyle(2, 0x5a2a82, 1);
    panel.strokeRoundedRect(20, 70, GAME.WIDTH * 0.33, GAME.HEIGHT - 150, 10);

    this.add
      .text(cx, 96, "TON PERSO", { fontFamily: "monospace", fontSize: "15px", color: "#ffffff" })
      .setOrigin(0.5);

    this._equippedKey = "ghost_equipped_preview";
    this._preview = this.add.image(cx, 180, "__none__").setScale(3.2);

    // Couleur (le solde de bonbons est affiche en haut a droite de la page).
    this.add
      .text(cx, 262, "CONTOUR", { fontFamily: "monospace", fontSize: "13px", color: PURPLE_STR })
      .setOrigin(0.5);
    const violetBtn = this._makeButton(cx - 56, 294, "VIOLET", 0x6a3fb0, 92, () => {
      setColor(this.username, "violet");
      this._refresh();
    });
    const whiteBtn = this._makeButton(cx + 56, 294, "BLANC", 0x5a5a6a, 92, () => {
      setColor(this.username, "white");
      this._refresh();
    });
    this._refreshers.push((prof) => {
      violetBtn.getData("label").setColor(prof.color === "violet" ? ORANGE_STR : "#ffffff");
      whiteBtn.getData("label").setColor(prof.color === "white" ? ORANGE_STR : "#ffffff");
    });
  }

  /** Panneau de droite : boutique par categories, un article = vignette+bouton. */
  _buildShop() {
    const colLeft = GAME.WIDTH * 0.42;
    const colWidth = GAME.WIDTH * 0.54;
    let y = 70;

    for (const cat of CATALOG) {
      // En-tete de categorie.
      this.add
        .text(colLeft, y, cat.label, {
          fontFamily: "monospace",
          fontSize: "17px",
          fontStyle: "bold",
          color: PURPLE_STR,
        })
        .setOrigin(0, 0.5);
      // Ligne de separation.
      const sep = this.add.graphics();
      sep.lineStyle(1, 0x3a2a52, 1);
      sep.lineBetween(colLeft, y + 14, colLeft + colWidth, y + 14);
      y += 26; // espace entre le titre et les vignettes

      // Articles de la categorie, disposes en grille horizontale.
      cat.items.forEach((item, idx) => {
        const cellW = colWidth / cat.items.length;
        const cellX = colLeft + idx * cellW + cellW / 2;
        this._buildShopItem(item, cellX, y, cellW);
      });
      y += 128; // bloc d articles (plus compact) + marge avant le titre suivant
    }
  }

  /** Un article : vignette (fantome + cet accessoire), nom, bouton. */
  _buildShopItem(item, cx, topY, cellW) {
    // Vignette : fantome noir portant uniquement cet accessoire.
    const thumbKey = `thumb_${item.key}`;
    this._itemKeys.push(thumbKey);
    if (this.textures.exists(thumbKey)) this.textures.remove(thumbKey);
    this._factory.makeGhostCustom(thumbKey, { color: "black", accessories: [item.key] });

    // Fond de vignette.
    const bg = this.add.graphics();
    bg.fillStyle(0x15101f, 0.7);
    bg.fillRoundedRect(cx - 36, topY, 72, 54, 8);
    bg.lineStyle(2, 0x3a2a52, 1);
    bg.strokeRoundedRect(cx - 36, topY, 72, 54, 8);

    this.add.image(cx, topY + 27, thumbKey).setScale(1.05);

    this.add
      .text(cx, topY + 64, item.label, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const btn = this._makeButton(cx, topY + 84, "", 0xb0532a, 96, () => {
      const prof = getProfile(this.username);
      if (!prof.owned.includes(item.key)) {
        const res = buyAccessory(this.username, item.key);
        if (!res.ok && res.reason === "insufficient") {
          this._flash(`Pas assez de bonbons (${ACCESSORY_PRICE})`);
        }
      } else {
        toggleEquip(this.username, item.key);
      }
      this._refresh();
    });

    this._refreshers.push((prof) => {
      const owned = prof.owned.includes(item.key);
      const equipped = prof.equipped.includes(item.key);
      const label = btn.getData("label");
      const bgBtn = btn.getData("bg");
      if (!owned) { label.setText(`ACHETER ${ACCESSORY_PRICE}`); this._recolorButton(btn, 0xb0532a); }
      else if (equipped) { label.setText("RETIRER"); this._recolorButton(btn, 0x5a8f3a); }
      else { label.setText("EQUIPER"); this._recolorButton(btn, 0x5a2a82); }
    });
  }

  /** Recharge le profil, regenere l apercu equipe et rafraichit les libelles. */
  _refresh() {
    const prof = getProfile(this.username);

    if (this.textures.exists(this._equippedKey)) this.textures.remove(this._equippedKey);
    this._factory.makeGhostCustom(this._equippedKey, {
      color: prof.color,
      accessories: prof.equipped,
    });
    this._preview.setTexture(this._equippedKey);

    this._candyText.setText(`Bonbons : ${prof.candies}`);
    for (const fn of this._refreshers) fn(prof);
  }

  _flash(message) {
    const t = this.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT - 54, message, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: ORANGE_STR,
      })
      .setOrigin(0.5)
      .setDepth(50);
    this.tweens.add({ targets: t, alpha: 0, duration: 1500, onComplete: () => t.destroy() });
  }

  _buildBackButton() {
    // Dans le panneau de gauche, sous le choix de couleur (pas de chevauchement
    // avec la colonne boutique).
    const cx = GAME.WIDTH * 0.2;
    this._makeButton(cx, 352, "RETOUR", 0x5a8f3a, 150, () => {
      this._saveServerProfile();
      this.scene.start("LauncherScene");
    });
  }

  _recolorButton(btn, color) {
    const bg = btn.getData("bg");
    const w = btn.getData("w");
    const h = btn.getData("h");
    bg.clear();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 7);
    bg.lineStyle(2, 0xffffff, 0.35);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 7);
  }

  _makeButton(x, y, label, color, width, onClick) {
    const text = this.add
      .text(0, 0, label, {
        fontFamily: "monospace",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    const w = width || Math.max(90, text.width + 24);
    const h = 28;
    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 7);
    bg.lineStyle(2, 0xffffff, 0.35);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 7);
    const btn = this.add.container(x, y, [bg, text]);
    btn.setSize(w, h);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setAlpha(0.85));
    btn.on("pointerout", () => btn.setAlpha(1));
    btn.on("pointerdown", onClick);
    btn.setData("label", text);
    btn.setData("bg", bg);
    btn.setData("w", w);
    btn.setData("h", h);
    return btn;
  }

  _cleanupTextures() {
    const keys = [...(this._itemKeys || []), this._equippedKey];
    for (const k of keys) {
      if (k && this.textures && this.textures.exists(k)) this.textures.remove(k);
    }
  }
}
