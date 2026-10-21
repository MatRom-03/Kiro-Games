import Phaser from "phaser";
import { GAME, KEYS } from "../config/gameConstants.js";
import SoundManager from "../systems/SoundManager.js";
import { loadAiMode, persistAiMode } from "../systems/aiModePersistence.js";

/** Couleur orange « Halloween » utilisée pour les accents et les yeux. */
const ORANGE = 0xff8c1a;
/** Même orange au format chaîne pour les objets Text. */
const ORANGE_STR = "#ff8c1a";
/** Violet d'accent pour les titres secondaires et contours. */
const PURPLE_STR = "#b06bf0";

/**
 * Scène de réglages (Settings).
 *
 * Fournit un bouton de bascule du son (mute/unmute) piloté par
 * {@link SoundManager} — l'état est appliqué au gestionnaire de son de Phaser
 * (`game.sound.mute`) et persisté entre deux sessions —, un rappel des
 * raccourcis clavier issus de {@link KEYS}, et un bouton de retour vers le
 * Launcher (Requirements 13.1, 13.2, 13.3).
 * @extends Phaser.Scene
 */
export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super("SettingsScene");

    /**
     * Gestionnaire de son global (mute/unmute + persistance).
     * @type {SoundManager|null}
     * @private
     */
    this._sound = null;

    /**
     * Libellé du bouton de bascule du son, mis à jour à chaque changement.
     * @type {Phaser.GameObjects.Text|null}
     * @private
     */
    this._soundLabel = null;
  }

  /**
   * Construit l'intégralité de l'interface des réglages.
   * @returns {void}
   */
  create() {
    // Instancie le SoundManager sur le jeu courant : l'état persisté est lu et
    // immédiatement synchronisé avec `game.sound.mute` (Requirement 13.2).
    this._sound = new SoundManager(this.game);

    // Fond noir plein, cohérent avec le Launcher.
    this.cameras.main.setBackgroundColor("#000000");

    this._buildTitle();
    this._buildSoundToggle();
    this._buildAiToggle();
    this._buildKeysTable();
    this._buildBackButton();
  }

  /**
   * Affiche le titre coloré de la scène sur fond noir.
   * @returns {void}
   * @private
   */
  _buildTitle() {
    const cx = GAME.WIDTH / 2;

    this.add
      .text(cx, 70, "RÉGLAGES", {
        fontFamily: "monospace",
        fontSize: "40px",
        fontStyle: "bold",
        color: ORANGE_STR,
      })
      .setOrigin(0.5, 0.5);
  }

  /**
   * Construit le libellé et le bouton de bascule du son (Requirements 13.1,
   * 13.2). Le libellé reflète l'état courant et est rafraîchi à chaque clic.
   * @returns {void}
   * @private
   */
  _buildSoundToggle() {
    // Colonne de gauche : option Son.
    const colX = GAME.WIDTH * 0.28;
    const y = 210;

    this.add
      .text(colX, y - 40, "SON", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5);

    const btn = this._makeButton(colX, y, this._soundButtonLabel(), 0x5a2a82, () =>
      this._onToggleSound(),
    );
    this._soundLabel = /** @type {Phaser.GameObjects.Text} */ (
      btn.getData("label")
    );
  }

  /**
   * Calcule le libellé du bouton de son selon l'état courant.
   * @returns {string}
   * @private
   */
  _soundButtonLabel() {
    const muted = this._sound ? this._sound.isMuted() : false;
    return muted ? "SON : COUPÉ" : "SON : ACTIVÉ";
  }

  /**
   * Bascule l'état du son via le SoundManager (appliqué à `game.sound.mute` et
   * persisté) puis met à jour le libellé du bouton (Requirement 13.2).
   * @returns {void}
   * @private
   */
  _onToggleSound() {
    if (this._sound) this._sound.toggle();
    if (this._soundLabel) this._soundLabel.setText(this._soundButtonLabel());
  }

  /**
   * Construit le libelle et le bouton de bascule du mode IA (bot qui joue
   * automatiquement). L etat est persiste dans localStorage et lu par la
   * GameScene au demarrage d une partie.
   * @returns {void}
   * @private
   */
  _buildAiToggle() {
    // Colonne de gauche : option Mode IA, sous l option Son.
    const colX = GAME.WIDTH * 0.28;
    const y = 320;

    this.add
      .text(colX, y - 40, "MODE IA (bot auto)", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5);

    const btn = this._makeButton(colX, y, this._aiButtonLabel(), 0xb0532a, () =>
      this._onToggleAi(),
    );
    this._aiLabel = /** @type {Phaser.GameObjects.Text} */ (btn.getData("label"));
  }

  /**
   * Libelle du bouton mode IA selon l etat persiste.
   * @returns {string}
   * @private
   */
  _aiButtonLabel() {
    return loadAiMode() ? "MODE IA : ON" : "MODE IA : OFF";
  }

  /**
   * Bascule le mode IA et persiste la nouvelle valeur, puis rafraichit le
   * libelle du bouton.
   * @returns {void}
   * @private
   */
  _onToggleAi() {
    const next = !loadAiMode();
    persistAiMode(next);
    if (this._aiLabel) this._aiLabel.setText(this._aiButtonLabel());
  }

  /**
   * Affiche le rappel des raccourcis clavier issus de {@link KEYS}
   * (Requirement 13.3).
   * @returns {void}
   * @private
   */
  _buildKeysTable() {
    // Colonne de droite : rappel des raccourcis clavier.
    const colX = GAME.WIDTH * 0.72;
    const topY = 150;

    this.add
      .text(colX, topY, "RACCOURCIS", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: ORANGE_STR,
      })
      .setOrigin(0.5, 0.5);

    const rows = [
      ["Gauche", KEYS.LEFT.join(" / ")],
      ["Droite", KEYS.RIGHT.join(" / ")],
      ["Saut", KEYS.JUMP.join(" / ")],
      ["Tir", KEYS.FIRE.join(" / ")],
      ["Pause", "ESC"],
    ];

    const startY = topY + 36;
    const lineH = 30;
    // Action alignee a droite d un axe, touches a gauche de ce meme axe.
    const actionRightX = colX - 10;
    const keysLeftX = colX + 10;

    rows.forEach(([action, keys], i) => {
      const rowY = startY + i * lineH;
      this.add
        .text(actionRightX, rowY, action, {
          fontFamily: "monospace",
          fontSize: "15px",
          color: "#dddddd",
        })
        .setOrigin(1, 0);
      this.add
        .text(keysLeftX, rowY, keys, {
          fontFamily: "monospace",
          fontSize: "15px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0, 0);
    });
  }

  /**
   * Construit le bouton de retour au Launcher (Settings → Launcher).
   * @returns {void}
   * @private
   */
  _buildBackButton() {
    this._makeButton(GAME.WIDTH / 2, 486, "RETOUR", 0x5a8f3a, () =>
      this.scene.start("LauncherScene"),
    );
  }

  /**
   * Crée un bouton rectangulaire cliquable avec libellé, dans le style du
   * Launcher.
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

    // Expose le Text du bouton pour permettre une mise à jour ultérieure.
    btn.setData("label", text);

    return btn;
  }
}
