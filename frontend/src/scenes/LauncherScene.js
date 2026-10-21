import Phaser from "phaser";
import { GAME, KEYS } from "../config/gameConstants.js";
import TextureFactory from "../gfx/TextureFactory.js";
import { getProfile, saveProfile, LEVEL_COUNT, levelCandyTarget } from "../systems/customizationStore.js";
import { ApiClient } from "../services/ApiClient.js";
import { loadLastUsername, saveLastUsername } from "../systems/lastUsernamePersistence.js";
import {
  USERNAME_MAX_LENGTH,
  sanitizeUsername,
  validateLaunch,
} from "./launcherValidation.js";

// Ré-export de la logique pure pour les consommateurs du Launcher.
export { USERNAME_MAX_LENGTH, sanitizeUsername, validateLaunch };

/** Couleur orange « Halloween » utilisée pour les accents et les yeux. */
const ORANGE = 0xff8c1a;
/** Même orange au format chaîne pour les objets Text. */
const ORANGE_STR = "#ff8c1a";
/** Violet d'accent pour les titres secondaires et contours. */
const PURPLE_STR = "#b06bf0";

/**
 * Scène de lancement (Launcher).
 *
 * Affiche un logo coloré « fantôme » aux yeux orange sur fond noir, un champ
 * de saisie du pseudo (sans mot de passe, limité à 20 caractères), le choix du
 * skin (blanc/noir, aucun présélectionné, un seul actif, indication visuelle),
 * un tableau des touches de contrôle, un bouton de lancement et un accès aux
 * réglages.
 *
 * Le champ de saisie est un élément HTML natif superposé au canvas afin de
 * bénéficier du clavier natif sans activer le plugin DOM de Phaser.
 * @extends Phaser.Scene
 */
export default class LauncherScene extends Phaser.Scene {
  constructor() {
    super("LauncherScene");

    /**
     * Skin sélectionné, ou `null` tant que le joueur n'a rien choisi.
     * @type {("white"|"black"|null)}
     */
    this.selectedSkin = null;

    /**
     * Élément HTML de saisie du pseudo superposé au canvas.
     * @type {HTMLInputElement|null}
     * @private
     */
    this._usernameInput = null;

    /**
     * Objet Text affichant les messages de validation non bloquants.
     * @type {Phaser.GameObjects.Text|null}
     * @private
     */
    this._hintText = null;

    /**
     * Conteneurs cliquables des deux skins, indexés par clé de skin.
     * @type {{ white: Phaser.GameObjects.Container|null, black: Phaser.GameObjects.Container|null }}
     * @private
     */
    this._skinCards = { white: null, black: null };

    /**
     * Fonctions de nettoyage à exécuter lors de l'arrêt de la scène.
     * @type {Array<() => void>}
     * @private
     */
    this._cleanups = [];
  }

  /**
   * Construit l'intégralité de l'interface du Launcher.
   * @returns {void}
   */
  create() {
    this.selectedSkin = null;
    // Reinitialise le garde de lancement : la scene est reutilisee par Phaser,
    // sans ce reset un retour au menu laisserait _launching a true et bloquerait
    // tout nouveau lancement (il fallait rafraichir la page).
    this._launching = false;

    // Fond noir plein (Requirement 11.1).
    this.cameras.main.setBackgroundColor("#000000");

    this._buildBackground();

    this._buildSplash();
    this._buildLogo();
    this._buildUsernameInput();
    this._buildCharacterPreview();
    this._buildLevelMap();
    this._buildKeysTable();
    this._buildButtons();
    this._buildHint();

    // Synchronise la progression des niveaux depuis le serveur (best-effort).
    this._syncLevelsFromServer();

    // Nettoyage systématique à l'arrêt / destruction de la scène.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this._teardown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this._teardown, this);
  }

  /**
   * Splash « a la Minecraft » : une courte phrase jaune, inclinee, en haut a
   * gauche, qui pulse en opacite (fade sans disparaitre). La phrase est tiree
   * au hasard a chaque affichage du menu.
   * @returns {void}
   * @private
   */
  _buildSplash() {
    const PHRASES = [
      "Bouh !",
      "100% sans gluten !",
      "Attrape les bonbons !",
      "Les sorcieres detestent ca !",
      "Fait maison, zero asset !",
      "Plus rapide qu un balai !",
      "Clique 5 fois sur le fantome...",
      "Halloween toute l annee !",
      "Peur du noir ?",
      "Toujours plus de bonbons !",
      "Mode IA inclus !",
      "Un fantome, une mission.",
      "Trick or treat !",
      "La lune te regarde...",
      "Niveau 5 = cauchemar.",
    ];
    const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];

    const splash = this.add
      .text(118, 150, phrase, {
        fontFamily: "monospace",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ffd24a",
        align: "center",
      })
      .setOrigin(0.5)
      .setAngle(-18)
      .setDepth(50);

    // Pulsation d opacite (ne disparait jamais : alpha oscille entre 0.55 et 1).
    this.tweens.add({
      targets: splash,
      alpha: 0.55,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    // Leger « boing » d echelle facon Minecraft.
    this.tweens.add({
      targets: splash,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /**
   * Dessine un fond d ambiance Halloween procedural : ciel degrade nocturne,
   * lune avec halo, etoiles scintillantes, collines/arbres en silhouette et
   * quelques chauves-souris. Entierement en arriere-plan (depth negatif) pour
   * ne pas gener l interface.
   * @returns {void}
   * @private
   */
  _buildBackground() {
    const W = GAME.WIDTH;
    const H = GAME.HEIGHT;
    const g = this.add.graphics().setDepth(-300);

    // Ciel : degrade vertical (bandes) du violet profond vers un mauve plus
    // clair en bas.
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const r = Math.round(0x0b + (0x2a - 0x0b) * t);
      const gg = Math.round(0x00 + (0x12 - 0x00) * t);
      const b = Math.round(0x14 + (0x34 - 0x14) * t);
      const color = (r << 16) | (gg << 8) | b;
      g.fillStyle(color, 1);
      g.fillRect(0, (H * i) / bands, W, H / bands + 1);
    }

    // Halo + lune en haut a droite.
    const moonX = W * 0.82;
    const moonY = 90;
    for (let i = 6; i >= 1; i--) {
      g.fillStyle(0xffe8b0, 0.05 * i);
      g.fillCircle(moonX, moonY, 30 + i * 10);
    }
    g.fillStyle(0xffe8b0, 1);
    g.fillCircle(moonX, moonY, 34);
    g.fillStyle(0x1a1030, 1); // croissant : morsure couleur ciel
    g.fillCircle(moonX + 14, moonY - 6, 32);

    // Etoiles (positions pseudo-aleatoires deterministes).
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 70; i++) {
      const rx = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const ry = ((Math.sin(i * 78.233) * 12543.1234) % 1 + 1) % 1;
      const x = rx * W;
      const y = ry * (H * 0.55);
      const s = 0.5 + (((Math.sin(i * 3.3) + 1) / 2) * 1.3);
      g.fillStyle(0xffffff, 0.5 + ((Math.sin(i * 7.1) + 1) / 2) * 0.5);
      g.fillCircle(x, y, s);
    }

    // Collines sombres en bas (deux couches pour la profondeur).
    g.fillStyle(0x160d26, 1);
    this._hillRow(g, H - 70, 70, 180, 1);
    g.fillStyle(0x0d0718, 1);
    this._hillRow(g, H - 40, 50, 140, 2);

    // Arbres morts en silhouette, poses sur la colline du bas.
    g.lineStyle(0);
    for (let i = 0; i < 7; i++) {
      const x = 40 + i * (W / 7) + 20;
      this._bgTree(g, x, H - 36, 0.6 + ((Math.sin(i * 5.1) + 1) / 2) * 0.4);
    }

    // Quelques chauves-souris (petits « M » clairs) dans le ciel.
    g.fillStyle(0x1a1024, 1);
    for (let i = 0; i < 6; i++) {
      const rx = ((Math.sin(i * 24.17) * 9731.7) % 1 + 1) % 1;
      const ry = ((Math.sin(i * 51.3) * 3471.9) % 1 + 1) % 1;
      this._bat(g, 60 + rx * (W - 120), 60 + ry * (H * 0.4), 10 + rx * 8);
    }
  }

  /**
   * Dessine une rangee de collines ondulees (serie de demi-cercles).
   * @private
   */
  _hillRow(g, baseY, height, step, seed) {
    const W = GAME.WIDTH;
    g.fillRect(0, baseY, W, GAME.HEIGHT - baseY);
    for (let x = -step / 2; x < W + step; x += step) {
      const h = height * (0.6 + ((Math.sin((x + seed * 100) * 0.01) + 1) / 2) * 0.6);
      g.fillEllipse(x, baseY, step * 1.1, h);
    }
  }

  /**
   * Dessine un petit arbre mort en silhouette (tronc + branches).
   * @private
   */
  _bgTree(g, x, baseY, scale) {
    const col = 0x0a0514;
    g.fillStyle(col, 1);
    const h = 60 * scale;
    g.fillRect(x - 3 * scale, baseY - h, 6 * scale, h);
    g.lineStyle(3 * scale, col, 1);
    g.beginPath();
    g.moveTo(x, baseY - h * 0.6);
    g.lineTo(x - 16 * scale, baseY - h * 0.95);
    g.moveTo(x, baseY - h * 0.5);
    g.lineTo(x + 16 * scale, baseY - h);
    g.moveTo(x, baseY - h * 0.75);
    g.lineTo(x + 10 * scale, baseY - h * 1.1);
    g.strokePath();
    g.lineStyle(0);
    g.fillStyle(col, 1);
  }

  /**
   * Dessine une petite chauve-souris stylisee (corps + deux ailes).
   * @private
   */
  _bat(g, x, y, size) {
    const s = size;
    g.fillStyle(0x120a1e, 1);
    g.fillCircle(x, y, s * 0.18);
    g.fillTriangle(x, y, x - s, y - s * 0.5, x - s * 0.5, y + s * 0.3);
    g.fillTriangle(x, y, x + s, y - s * 0.5, x + s * 0.5, y + s * 0.3);
  }

  /**
   * Dessine le logo : silhouette de fantôme coloré aux yeux orange et le titre
   * du jeu sur fond noir.
   * @returns {void}
   * @private
   */
  _buildLogo() {
    const cx = GAME.WIDTH / 2;

    // Fantome EFFRAYANT dessine par code (independant des textures du Preload).
    const ghostX = cx - 155;
    const ghostY = 72;
    const r = 28;

    // Lueur rouge menacante derriere le fantome (halo additif).
    const glow = this.add.graphics();
    glow.fillStyle(0xff2a2a, 0.16);
    glow.fillCircle(ghostX, ghostY + 2, r + 18);
    glow.fillStyle(0x8a0010, 0.14);
    glow.fillCircle(ghostX, ghostY + 2, r + 32);

    const logo = this.add.graphics();

    // Ombre portee au sol.
    logo.fillStyle(0x000000, 0.3);
    logo.fillEllipse(ghostX, ghostY + 58, r * 1.5, 7);

    // --- Corps blafard, decharne (teintes froides, pas de rose) ---
    const bodyBottom = ghostY + 42;
    // Ombre du corps.
    logo.fillStyle(0x8f8fae, 1);
    logo.fillCircle(ghostX + 2, ghostY + 2, r);
    logo.fillRect(ghostX - r + 2, ghostY + 2, r * 2, bodyBottom - ghostY);
    // Corps principal, blanc grisatre maladif.
    logo.fillStyle(0xdfe0ea, 1);
    logo.fillCircle(ghostX, ghostY, r);
    logo.fillRect(ghostX - r, ghostY, r * 2, bodyBottom - ghostY);
    // Bas dechire en pointes irregulieres (triangles) plutot que festons doux.
    const spikes = 5;
    for (let i = 0; i < spikes; i++) {
      const x0 = ghostX - r + i * (r * 2 / spikes);
      const x1 = x0 + (r * 2 / spikes);
      const mid = (x0 + x1) / 2;
      const depth = 10 + (i % 2) * 8; // dentelure irreguliere
      logo.fillStyle(0xdfe0ea, 1);
      logo.fillTriangle(x0, bodyBottom - 2, x1, bodyBottom - 2, mid, bodyBottom + depth);
    }

    // Ombrage interieur (creux sous les yeux) pour un air cave.
    logo.fillStyle(0xb7b8ce, 0.6);
    logo.fillEllipse(ghostX, ghostY + 6, r * 1.1, 14);

    // --- Yeux sombres et vides, inquietants (sans rouge) ---
    const eyeY = ghostY - 2;
    // Orbites creuses sombres.
    logo.fillStyle(0x12121c, 1);
    logo.fillEllipse(ghostX - 10, eyeY, 12, 14);
    logo.fillEllipse(ghostX + 10, eyeY, 12, 14);
    // Iris/pupille noir profond.
    logo.fillStyle(0x05050a, 1);
    logo.fillCircle(ghostX - 10, eyeY + 1, 4.5);
    logo.fillCircle(ghostX + 10, eyeY + 1, 4.5);
    // Leger reflet froid pour un regard vitreux.
    logo.fillStyle(0xaab0c8, 0.8);
    logo.fillCircle(ghostX - 11.5, eyeY - 1, 1.3);
    logo.fillCircle(ghostX + 8.5, eyeY - 1, 1.3);

    // Sourcils fronces (colere) : deux barres obliques sombres au-dessus.
    logo.lineStyle(3, 0x12060a, 1);
    logo.beginPath();
    logo.moveTo(ghostX - 18, eyeY - 10);
    logo.lineTo(ghostX - 3, eyeY - 6);
    logo.moveTo(ghostX + 18, eyeY - 10);
    logo.lineTo(ghostX + 3, eyeY - 6);
    logo.strokePath();
    logo.lineStyle(0);

    // --- Bouche grande ouverte (cri) avec crocs ---
    logo.fillStyle(0x12060a, 1);
    logo.fillEllipse(ghostX, ghostY + 20, 14, 16); // gueule beante
    // Crocs blancs (triangles) en haut et en bas.
    logo.fillStyle(0xf2f2f6, 1);
    logo.fillTriangle(ghostX - 7, ghostY + 13, ghostX - 3, ghostY + 13, ghostX - 5, ghostY + 20); // croc haut g
    logo.fillTriangle(ghostX + 7, ghostY + 13, ghostX + 3, ghostY + 13, ghostX + 5, ghostY + 20); // croc haut d
    logo.fillTriangle(ghostX - 4, ghostY + 28, ghostX - 1, ghostY + 28, ghostX - 2.5, ghostY + 22); // croc bas g
    logo.fillTriangle(ghostX + 4, ghostY + 28, ghostX + 1, ghostY + 28, ghostX + 2.5, ghostY + 22); // croc bas d

    // Easter egg : zone cliquable sur le fantome du logo. 5 clics => nuee.
    const hit = this.add
      .zone(ghostX, ghostY + 8, r * 2.4, r * 3)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this._logoClicks = 0;
    hit.on("pointerdown", () => this._onLogoClick());

    // Titre coloré.
    this.add
      .text(cx + 30, 54, "HALLOWEEN", {
        fontFamily: "monospace",
        fontSize: "40px",
        fontStyle: "bold",
        color: ORANGE_STR,
      })
      .setOrigin(0.5, 0.5);
    this.add
      .text(cx + 30, 96, "GHOST DASH", {
        fontFamily: "monospace",
        fontSize: "40px",
        fontStyle: "bold",
        color: PURPLE_STR,
      })
      .setOrigin(0.5, 0.5);
  }

  /**
   * Easter egg : compte les clics sur le fantome du logo ; au 5e, declenche
   * une nuee de fantomes qui se baladent a l ecran pendant 5 secondes.
   * @returns {void}
   * @private
   */
  _onLogoClick() {
    this._logoClicks = (this._logoClicks || 0) + 1;
    if (this._logoClicks >= 5) {
      this._logoClicks = 0;
      this._spawnGhostSwarm();
    }
  }

  /**
   * Fait apparaitre ~22 fantomes semi-transparents qui flottent a l ecran
   * (deplacement + balancement + oscillation d opacite) pendant 5 secondes,
   * puis les retire. Purement decoratif, au-dessus de l interface.
   * @returns {void}
   * @private
   */
  _spawnGhostSwarm() {
    // Genere une fois une jolie texture de fantome pour la nuee.
    const key = "swarm_ghost";
    if (!this.textures.exists(key)) {
      new TextureFactory(this).makeGhostCustom(key, { color: "white", accessories: [] });
    }

    const COUNT = 22;
    const DURATION = 5000;
    const ghosts = [];
    for (let i = 0; i < COUNT; i++) {
      const startX = Math.random() * GAME.WIDTH;
      const startY = GAME.HEIGHT + 20 + Math.random() * 120;
      const g = this.add
        .image(startX, startY, key)
        .setScale(1.2 + Math.random() * 2.2)
        .setAlpha(0.55 + Math.random() * 0.35)
        .setDepth(5000);
      ghosts.push(g);

      // Montee en diagonale vers le haut de l ecran.
      const driftX = (Math.random() - 0.5) * 300;
      this.tweens.add({
        targets: g,
        y: -40 - Math.random() * 120,
        x: `+=${driftX}`,
        duration: DURATION,
        ease: "Sine.easeIn",
      });
      // Balancement lateral.
      this.tweens.add({
        targets: g,
        x: `+=${(Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 40)}`,
        duration: 700 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      // Oscillation d opacite (apparition fantomatique).
      this.tweens.add({
        targets: g,
        alpha: 0.2,
        duration: 500 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Fin de l easter egg : fondu puis destruction apres 5 s.
    this.time.delayedCall(DURATION, () => {
      for (const g of ghosts) {
        this.tweens.killTweensOf(g);
        this.tweens.add({
          targets: g,
          alpha: 0,
          duration: 400,
          onComplete: () => g.destroy(),
        });
      }
    });
  }

  /**
   * Construit la carte des 5 niveaux au centre : chemin sinueux + noeuds en
   * degrade jaune (facile) -> rouge (difficile). Les niveaux verrouilles sont
   * grises ; cliquer un niveau debloque le lance directement.
   * @returns {void}
   * @private
   */
  _buildLevelMap() {
    this._mapObjects = [];
    this._rebuildLevelMap();
  }

  /**
   * (Re)dessine la carte des niveaux selon la progression du pseudo courant.
   * @returns {void}
   * @private
   */
  _rebuildLevelMap() {
    // Nettoie l ancienne carte.
    if (this._mapObjects) for (const o of this._mapObjects) o && o.destroy();
    this._mapObjects = [];

    const username = sanitizeUsername(this._usernameInput ? this._usernameInput.value : "") || "Fantome";
    const prof = getProfile(username);
    const unlocked = prof.unlocked || 1; // nombre de niveaux debloques
    const best = prof.levelBest || [];

    // Chemin en DIAGONALE elargi : du niveau 1 (bas-gauche) au niveau 5
    // (haut-droite), avec une alternance marquee haut/bas (vague) le long du
    // biais pour un effet "un en haut, un en bas".
    const x0 = 270;
    const x1 = 620;
    const yBase = 400; // niveau 1 (bas), remonte pour degager le bouton Lancer
    const yStep = 32;  // montee moyenne par niveau (le biais)
    const amp = 28;    // amplitude de l alternance haut/bas
    const nodes = [];
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const x = Math.round(x0 + (x1 - x0) * t);
      const wobble = (i % 2 === 0 ? amp : -amp); // alternance haut/bas marquee
      const y = Math.round(yBase - yStep * i + wobble);
      nodes.push({ x, y });
    }

    // Titre de la carte, centre sous le champ pseudo (pas de chevauchement).
    this._mapObjects.push(
      this.add.text(GAME.WIDTH / 2, 224, "AVENTURE", {
        fontFamily: "monospace", fontSize: "16px", fontStyle: "bold", color: "#b06bf0",
      }).setOrigin(0.5),
    );

    // Trace le chemin (ligne pointillee reliant les noeuds).
    const pathG = this.add.graphics().setDepth(1);
    this._mapObjects.push(pathG);
    pathG.lineStyle(3, 0x5a4a78, 0.8);
    for (let i = 0; i < nodes.length - 1; i++) {
      pathG.beginPath();
      pathG.moveTo(nodes[i].x, nodes[i].y);
      pathG.lineTo(nodes[i + 1].x, nodes[i + 1].y);
      pathG.strokePath();
    }

    // Noeuds de niveau.
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const node = nodes[i];
      const isUnlocked = i < unlocked;
      // Degrade jaune -> rouge selon la difficulte (index).
      const t = LEVEL_COUNT > 1 ? i / (LEVEL_COUNT - 1) : 0;
      const col = this._levelColor(t, isUnlocked);

      const g = this.add.graphics().setDepth(2);
      this._mapObjects.push(g);
      g.fillStyle(0x000000, 0.4);
      g.fillCircle(node.x, node.y + 2, 20);
      g.fillStyle(col, 1);
      g.fillCircle(node.x, node.y, 18);
      g.lineStyle(2, 0xffffff, isUnlocked ? 0.8 : 0.25);
      g.strokeCircle(node.x, node.y, 18);

      // Numero du niveau (ou cadenas si verrouille).
      if (isUnlocked) {
        this._mapObjects.push(
          this.add.text(node.x, node.y, String(i + 1), {
            fontFamily: "monospace", fontSize: "18px", fontStyle: "bold",
            color: "#1a1024",
          }).setOrigin(0.5).setDepth(3),
        );
      } else {
        // Cadenas dessine (jamais coupe, independant du rendu d emoji).
        const lock = this.add.graphics().setDepth(3);
        this._mapObjects.push(lock);
        const lx = node.x;
        const ly = node.y + 1;
        // Anse.
        lock.lineStyle(2.5, 0xdddddd, 1);
        lock.beginPath();
        lock.arc(lx, ly - 4, 4, Math.PI, 0, false);
        lock.strokePath();
        lock.lineStyle(0);
        // Corps.
        lock.fillStyle(0xdddddd, 1);
        lock.fillRoundedRect(lx - 6, ly - 2, 12, 9, 2);
        // Trou de serrure.
        lock.fillStyle(0x3a3346, 1);
        lock.fillCircle(lx, ly + 2, 1.4);
      }

      // Objectif de bonbons sous le noeud.
      this._mapObjects.push(
        this.add.text(node.x, node.y + 30, "x" + levelCandyTarget(i), {
          fontFamily: "monospace", fontSize: "11px", color: "#ffcf8a",
        }).setOrigin(0.5).setDepth(3),
      );
      // Etoile si deja termine (best > 0).
      if ((best[i] || 0) > 0) {
        this._mapObjects.push(
          this.add.text(node.x + 16, node.y - 16, "\u2B50", { fontSize: "13px" }).setOrigin(0.5).setDepth(4),
        );
      }

      if (isUnlocked) {
        const hit = this.add.circle(node.x, node.y, 22, 0xffffff, 0.001)
          .setInteractive({ useHandCursor: true }).setDepth(5);
        this._mapObjects.push(hit);
        hit.on("pointerover", () => g.setAlpha(0.8));
        hit.on("pointerout", () => g.setAlpha(1));
        hit.on("pointerdown", () => this._launchLevel(i));
      }
    }

  }

  /**
   * Couleur d un noeud de niveau : degrade jaune->rouge (par difficulte).
   * Verrouille => gris.
   * @param {number} t 0 (facile) .. 1 (difficile)
   * @param {boolean} unlocked
   * @returns {number}
   * @private
   */
  _levelColor(t, unlocked) {
    if (!unlocked) return 0x3a3346;
    // Jaune (0xffd24a) -> orange -> rouge (0xd11a1a).
    const r = Math.round(0xff + (0xd1 - 0xff) * t);
    const g = Math.round(0xd2 + (0x1a - 0xd2) * t);
    const b = Math.round(0x4a + (0x1a - 0x4a) * t);
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Recupere la progression serveur et fusionne en local, puis redessine la
   * carte. Best-effort.
   * @returns {Promise<void>}
   * @private
   */
  async _syncLevelsFromServer() {
    const username = sanitizeUsername(this._usernameInput ? this._usernameInput.value : "");
    if (!username) return;
    try {
      const remote = await ApiClient.fetchProfile(username);
      if (remote && typeof remote === "object") {
        const local = getProfile(username);
        const mergedBest = [];
        for (let i = 0; i < LEVEL_COUNT; i++) {
          mergedBest.push(Math.max(local.levelBest[i] || 0, (remote.levelBest || [])[i] || 0));
        }
        saveProfile(username, {
          color: remote.color === "white" ? "white" : local.color,
          owned: Array.isArray(remote.owned) ? remote.owned : local.owned,
          equipped: Array.isArray(remote.equipped) ? remote.equipped : local.equipped,
          candies: Math.max(local.candies || 0, remote.candies || 0),
          levelBest: mergedBest,
          unlocked: Math.max(local.unlocked || 1, remote.unlocked || 1),
        });
        this._rebuildLevelMap();
        this._refreshPreview();
      }
    } catch { /* hors-ligne */ }
  }

  /**
   * Lance un niveau donne (0-based) avec une transition, apres validation du
   * pseudo.
   * @param {number} levelIndex
   * @returns {void}
   * @private
   */
  _launchLevel(levelIndex) {
    const username = sanitizeUsername(this._usernameInput ? this._usernameInput.value : "");
    if (!username) { this._showHint("Entre un pseudo pour jouer."); return; }
    const prof = getProfile(username);
    this._launchWithTransition({
      username,
      skin: prof.color,
      color: prof.color,
      accessories: prof.equipped,
      level: levelIndex,
    });
  }

  /**
   * Transition menu -> jeu : fondu au noir + petite nuee de fantomes, puis
   * demarre GameScene avec les donnees fournies.
   * @param {object} data
   * @returns {void}
   * @private
   */
  _launchWithTransition(data) {
    if (this._launching) return;
    this._launching = true;

    // Demarrage effectif (nettoie le DOM input juste avant de changer de scene).
    const go = () => {
      this._teardown();
      this.scene.start("GameScene", data);
    };

    // Transition best-effort ; si quoi que ce soit echoue, on lance direct.
    try {
      const veil = this.add
        .rectangle(GAME.WIDTH / 2, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, 0x000000, 0)
        .setDepth(9000);
      this.tweens.add({ targets: veil, alpha: 1, duration: 450, ease: "Quad.easeIn" });

      const key = "swarm_ghost";
      if (!this.textures.exists(key)) {
        new TextureFactory(this).makeGhostCustom(key, { color: "white", accessories: [] });
      }
      for (let i = 0; i < 10; i++) {
        const gg = this.add
          .image(Math.random() * GAME.WIDTH, GAME.HEIGHT + 40, key)
          .setScale(1 + Math.random() * 1.6)
          .setAlpha(0.8)
          .setDepth(9001);
        this.tweens.add({
          targets: gg,
          y: -60,
          x: "+=" + ((Math.random() - 0.5) * 200),
          duration: 500 + Math.random() * 200,
          ease: "Quad.easeIn",
        });
      }
      this.time.delayedCall(520, go);
    } catch (e) {
      // Repli infaillible : demarre le jeu immediatement.
      go();
    }
  }

  /**
   * Crée le libellé et le champ de saisie HTML du pseudo (sans mot de passe),
   * limité à 20 caractères, superposé au canvas (Requirements 2.1, 2.3, 11).
   * @returns {void}
   * @private
   */
  _buildUsernameInput() {
    const cx = GAME.WIDTH / 2;

    this.add
      .text(cx, 150, "PSEUDO", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5);

    // Élément HTML natif superposé (le plugin DOM de Phaser n'est pas activé).
    const parent =
      (this.game.canvas && this.game.canvas.parentElement) ||
      (typeof document !== "undefined" ? document.body : null);

    if (parent && typeof document !== "undefined") {
      const input = document.createElement("input");
      input.type = "text"; // jamais "password" (Requirement 2.1)
      input.maxLength = USERNAME_MAX_LENGTH; // limite dure côté UI (2.3)
      input.placeholder = "Entrez votre pseudo";
      input.setAttribute("aria-label", "Pseudo du joueur");
      input.autocomplete = "off";
      Object.assign(input.style, {
        position: "absolute",
        width: "280px",
        padding: "8px 10px",
        fontFamily: "monospace",
        fontSize: "16px",
        textAlign: "center",
        color: "#ffffff",
        background: "#15101f",
        border: "2px solid #5a2a82",
        borderRadius: "6px",
        outline: "none",
        zIndex: "10",
      });

      // Troncature défensive (collage pouvant dépasser 20 caractères).
      input.addEventListener("input", () => {
        if (input.value.length > USERNAME_MAX_LENGTH) {
          input.value = input.value.slice(0, USERNAME_MAX_LENGTH);
        }
        this._clearHint();
        this._refreshPreview();
        this._rebuildLevelMap();
        saveLastUsername(input.value);
      });

      parent.appendChild(input);
      this._usernameInput = input;

      // Restaure le dernier pseudo saisi (conserve entre les ecrans).
      const saved = loadLastUsername();
      if (saved) {
        input.value = saved.slice(0, USERNAME_MAX_LENGTH);
      }

      // Positionnement initial + repositionnement sur redimensionnement.
      const place = () => this._positionUsernameInput(cx, 180);
      place();
      this.scale.on(Phaser.Scale.Events.RESIZE, place);
      this._cleanups.push(() =>
        this.scale.off(Phaser.Scale.Events.RESIZE, place),
      );

      // Focus confortable à l'ouverture (sans défilement de page).
      try {
        input.focus({ preventScroll: true });
      } catch {
        /* environnement sans focus : ignoré */
      }
    }
  }

  /**
   * Positionne le champ HTML du pseudo au-dessus des coordonnées canvas
   * fournies, en tenant compte de la mise à l'échelle du canvas.
   * @param {number} gameX Position X en coordonnées de jeu.
   * @param {number} gameY Position Y en coordonnées de jeu.
   * @returns {void}
   * @private
   */
  _positionUsernameInput(gameX, gameY) {
    const input = this._usernameInput;
    const canvas = this.game.canvas;
    if (!input || !canvas || typeof canvas.getBoundingClientRect !== "function") {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / GAME.WIDTH;
    const scaleY = rect.height / GAME.HEIGHT;
    const w = input.offsetWidth || 280;
    const h = input.offsetHeight || 36;
    input.style.left = `${rect.left + window.scrollX + gameX * scaleX - w / 2}px`;
    input.style.top = `${rect.top + window.scrollY + gameY * scaleY - h / 2}px`;
  }

  /**
   * Construit le sélecteur de skin : deux cartes (blanc/noir), aucune
   * présélectionnée, un seul actif à la fois, avec indication visuelle
   * (Requirements 1.1, 1.2, 1.3).
   * @returns {void}
   * @private
   */
  _buildCharacterPreview() {
    // Colonne de gauche, groupe centre verticalement : titre -> apercu ->
    // (le bouton CUSTOM SKIN suit, pose juste en dessous dans _buildButtons).
    const colX = 96;
    const previewY = GAME.HEIGHT / 2; // apercu centre sur la hauteur

    this.add
      .text(colX, previewY - 74, "TON PERSO", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5); // titre juste au-dessus de l apercu

    this._previewKey = "ghost_launcher_preview";
    this._preview = this.add.image(colX, previewY, "__none__").setScale(2.4);
    this._refreshPreview();
  }

  /**
   * (Re)genere l aperçu du fantome personnalise a partir du profil du pseudo
   * actuellement saisi (couleur + accessoires equipes). Noir par defaut.
   * @returns {void}
   * @private
   */
  _refreshPreview() {
    if (!this._preview) return;
    const raw = this._usernameInput ? this._usernameInput.value : "";
    const username = sanitizeUsername(raw) || "Fantome";
    const prof = getProfile(username);
    const factory = new TextureFactory(this);
    if (this.textures.exists(this._previewKey)) this.textures.remove(this._previewKey);
    factory.makeGhostCustom(this._previewKey, {
      color: prof.color,
      accessories: prof.equipped,
    });
    this._preview.setTexture(this._previewKey);
  }

  /**
   * Crée une carte de skin cliquable avec aperçu, libellé et cadre de
   * sélection (invisible tant que la carte n'est pas sélectionnée).
   * @param {number} x Centre X de la carte.
   * @param {number} y Centre Y de la carte.
   * @param {("white"|"black")} skin Clé du skin.
   * @param {string} label Libellé affiché.
   * @returns {Phaser.GameObjects.Container}
   * @private
   */
  _makeSkinCard(x, y, skin, label) {
    const w = 120;
    const h = 110;

    const card = this.add.container(x, y);

    // Cadre de sélection (masqué par défaut : aucun skin présélectionné).
    const frame = this.add.graphics();
    frame.lineStyle(3, ORANGE, 1);
    frame.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    frame.setVisible(false);

    // Fond de la carte.
    const bg = this.add.graphics();
    bg.fillStyle(0x15101f, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.lineStyle(2, 0x5a2a82, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

    // Aperçu du fantôme (silhouette aux yeux orange).
    const preview = this.add.graphics();
    const body = skin === "black" ? 0x1a1a24 : 0xf4f4ff;
    const r = 18;
    preview.fillStyle(body, 1);
    preview.fillCircle(0, -16, r);
    preview.fillRect(-r, -16, r * 2, 24);
    for (let i = 0; i < 4; i++) {
      preview.fillCircle(-r + r / 2 + i * ((r * 2) / 4), 8, r / 4);
    }
    preview.fillStyle(ORANGE, 1);
    preview.fillCircle(-7, -18, 4);
    preview.fillCircle(7, -18, 4);

    const text = this.add
      .text(0, 40, label, {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5);

    card.add([frame, bg, preview, text]);
    card.setSize(w, h);
    card.setInteractive({ useHandCursor: true });

    card.on("pointerdown", () => this._selectSkin(skin));
    // Référence au cadre pour mettre à jour l'indication visuelle.
    card.setData("frame", frame);
    card.setData("label", text);

    return card;
  }

  /**
   * Sélectionne un skin : met à jour la sélection active, désélectionne tout
   * autre skin (au plus un actif) et rafraîchit l'indication visuelle
   * (Requirements 1.2, 1.3).
   * @param {("white"|"black")} skin Skin choisi.
   * @returns {void}
   * @private
   */
  _selectSkin(skin) {
    this.selectedSkin = skin;
    this._clearHint();

    for (const key of /** @type {("white"|"black")[]} */ (["white", "black"])) {
      const card = this._skinCards[key];
      if (!card) continue;
      const active = key === skin;
      /** @type {Phaser.GameObjects.Graphics} */ (card.getData("frame")).setVisible(
        active,
      );
      /** @type {Phaser.GameObjects.Text} */ (card.getData("label")).setColor(
        active ? ORANGE_STR : "#ffffff",
      );
    }
  }

  /**
   * Affiche le tableau des touches de contrôle (Requirement 11.2).
   * @returns {void}
   * @private
   */
  _buildKeysTable() {
    // Tableau des touches cale a DROITE et centre sur la hauteur de l ecran.
    const rightX = GAME.WIDTH - 40;
    const rows = [
      ["Gauche", KEYS.LEFT.join(" / ")],
      ["Droite", KEYS.RIGHT.join(" / ")],
      ["Saut", KEYS.JUMP.join(" / ")],
      ["Tir", KEYS.FIRE.join(" / ")],
    ];

    const lineH = 26;
    const titleGap = 32;
    // Hauteur totale du bloc (titre + lignes) pour le centrer verticalement.
    const blockH = titleGap + rows.length * lineH;
    const topY = GAME.HEIGHT / 2 - blockH / 2;

    this.add
      .text(rightX, topY, "TOUCHES", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: ORANGE_STR,
      })
      .setOrigin(1, 0);

    const startY = topY + titleGap;
    // Colonne action collee a droite ; les touches sont au-dessus en gras,
    // mais ici on garde action + touches sur une meme ligne, alignees a droite.
    const keysRightX = rightX;
    const actionRightX = rightX - 110;

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
        .text(keysRightX, rowY, keys, {
          fontFamily: "monospace",
          fontSize: "15px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(1, 0);
    });
  }

  /**
   * Construit le bouton de lancement et le bouton d'accès aux réglages
   * (Requirements 11.3, 11.4).
   * @returns {void}
   * @private
   */
  _buildButtons() {
    const cx = GAME.WIDTH / 2;

    // Bouton principal de lancement, centre.
    this._makeButton(cx, 486, "LANCER LA PARTIE", 0x5a8f3a, () => this._onLaunch());

    // Colonne de gauche : CUSTOM SKIN juste sous l apercu (centre vertical).
    this._makeButton(96, GAME.HEIGHT / 2 + 78, "CUSTOM SKIN", 0x5a2a82, () => {
      const username = sanitizeUsername(this._usernameInput ? this._usernameInput.value : "");
      if (!username) { this._showHint("Entre un pseudo pour customiser."); return; }
      this._teardown();
      this.scene.start("CustomSkinScene", { username });
    });
    this._makeButton(96, 486, "SCORES", 0xb0532a, () =>
      this.scene.start("ScoreboardScene"),
    );

    // Reglages a droite.
    this._makeButton(GAME.WIDTH - 90, 486, "RÉGLAGES", 0x5a2a82, () =>
      this.scene.start("SettingsScene"),
    );
  }

  /**
   * Crée un bouton rectangulaire cliquable avec libellé.
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
   * Prépare l'emplacement du message d'indication non bloquant.
   * @returns {void}
   * @private
   */
  _buildHint() {
    this._hintText = this.add
      .text(GAME.WIDTH / 2, 522, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: ORANGE_STR,
      })
      .setOrigin(0.5, 0.5);
  }

  /**
   * Gère l'appui sur « Lancer la partie » : valide le pseudo (non vide après
   * nettoyage, ≤ 20 caractères) et la sélection d'un skin. En cas d'échec,
   * maintient le Launcher et affiche une indication non bloquante
   * (Requirements 1.4, 1.5, 2.2, 2.3, 2.4). Sinon transmet `{ username, skin }`
   * à GameScene.
   * @returns {void}
   * @private
   */
  async _onLaunch() {
    const rawUsername = this._usernameInput ? this._usernameInput.value : "";
    const username = sanitizeUsername(rawUsername);
    if (!username) {
      this._showHint("Entre un pseudo pour lancer la partie.");
      return;
    }
    // Recupere le profil serveur (best-effort) et fusionne en local en
    // PRESERVANT la progression des niveaux (levelBest/unlocked).
    try {
      const remote = await ApiClient.fetchProfile(username);
      if (remote && typeof remote === "object") {
        const local = getProfile(username);
        const mergedBest = [];
        for (let i = 0; i < LEVEL_COUNT; i++) {
          mergedBest.push(Math.max(local.levelBest[i] || 0, (remote.levelBest || [])[i] || 0));
        }
        saveProfile(username, {
          color: remote.color === "white" ? "white" : local.color,
          owned: Array.isArray(remote.owned) ? remote.owned : local.owned,
          equipped: Array.isArray(remote.equipped) ? remote.equipped : local.equipped,
          candies: Math.max(local.candies || 0, remote.candies || 0),
          levelBest: mergedBest,
          unlocked: Math.max(local.unlocked || 1, remote.unlocked || 1),
        });
      }
    } catch {
      /* hors-ligne : on utilise le profil local */
    }

    // « Lancer la partie » = niveau debloque le plus haut (index unlocked-1).
    const prof = getProfile(username);
    const highest = Math.max(0, (prof.unlocked || 1) - 1);
    this._launchWithTransition({
      username,
      skin: prof.color,
      color: prof.color,
      accessories: prof.equipped,
      level: highest,
    });
  }

  /**
   * Affiche un message d'indication non bloquant.
   * @param {string} message Texte à afficher.
   * @returns {void}
   * @private
   */
  _showHint(message) {
    if (this._hintText) this._hintText.setText(message);
  }

  /**
   * Efface le message d'indication courant.
   * @returns {void}
   * @private
   */
  _clearHint() {
    if (this._hintText) this._hintText.setText("");
  }

  /**
   * Supprime le champ HTML superposé et exécute les nettoyages enregistrés.
   * Idempotent : peut être appelé plusieurs fois sans effet de bord.
   * @returns {void}
   * @private
   */
  _teardown() {
    while (this._cleanups.length > 0) {
      const fn = this._cleanups.pop();
      try {
        fn();
      } catch {
        /* nettoyage best-effort */
      }
    }
    if (this._usernameInput) {
      saveLastUsername(this._usernameInput.value);
      if (this._usernameInput.parentElement) {
        this._usernameInput.parentElement.removeChild(this._usernameInput);
      }
    }
    this._usernameInput = null;
  }
}
