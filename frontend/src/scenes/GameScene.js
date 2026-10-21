/**
 * Scène de jeu principale (Game).
 *
 * Niveau « en longueur » : le monde est plus large que l'écran et la caméra
 * suit le joueur, ce qui fait défiler la map horizontalement. Des arbres morts
 * d'Halloween défilent en fond (parallax) pour donner de la profondeur. Les
 * plateformes sont générées aléatoirement sur toute la largeur, à des hauteurs
 * atteignables au saut.
 *
 * Progression par paliers de bonbons : 15 → 30 → 50. Chaque palier atteint
 * régénère le niveau (nouvelles plateformes, sorcières et bonbons) et relève
 * la cible du compteur, SANS jamais réinitialiser le compte à rebours : le
 * timer est continu jusqu'à 0 (défaite) ou l'atteinte du dernier palier
 * (victoire).
 *
 * Exigences couvertes : 1.6, 3.1–3.4, 4.1–4.2, 5.1–5.4, 6.1–6.4, 7.1–7.2,
 * 7.7–7.8, 8.1–8.2, 9.4–9.7, 10.1–10.2.
 *
 * @extends Phaser.Scene
 */
import Phaser from "phaser";
import { GAME, KEYS } from "../config/gameConstants.js";
import Player from "../entities/Player.js";
import Witch from "../entities/Witch.js";
import { computeScore } from "../systems/scoring.js";
import { loadAiMode } from "../systems/aiModePersistence.js";
import AudioEngine from "../systems/AudioEngine.js";
import TextureFactory from "../gfx/TextureFactory.js";
import { getProfile, addCandies, recordLevelResult, levelCandyTarget, LEVEL_COUNT } from "../systems/customizationStore.js";
import { loadPersistedMute } from "../systems/mutePersistence.js";

/** Taille d'une tuile de sol/plateforme (px), alignée sur `TextureFactory`. */
const TILE = 32;
/** Couleur orange « Halloween » (chaîne) pour les accents du HUD. */
const ORANGE_STR = "#ff8c1a";

/** Largeur totale du monde (plus large que l'écran) → défilement horizontal. */
const WORLD_WIDTH = 3200;

/**
 * Paliers de bonbons à atteindre successivement. Le dernier palier déclenche
 * la victoire finale. Le timer n'est jamais réinitialisé entre les paliers.
 * @type {number[]}
 */
const CANDY_TIERS = [15, 15, 15]; // 15 bonbons par palier (x3)

/**
 * Theme visuel + ennemi par palier : couleur de fond, teintes d arbres
 * (3 couches de parallax) et cle de texture de l ennemi.
 * @type {Array<{bg:string, treeTints:number[], enemy:string}>}
 */
const TIER_THEMES = [
  // Palier 1 : nuit violette, arbres touffus, sorcieres.
  { bg: "#0b0014", tree: "tree", treeTints: [0x3a2d55, 0x4a3768, 0x5e4785], enemy: "witch", tile: "tile_witch", body: "body_witch" },
  // Palier 2 : nuit bleutee glaciale, arbres MORTS sans feuilles, squelettes.
  { bg: "#05101c", tree: "tree_bare", treeTints: [0x2a3a52, 0x35506e, 0x44658f], enemy: "skeleton", tile: "tile_skeleton", body: "body_skeleton" },
  // Palier 3 : crepuscule rouge sang, BROUILLARD + chauves-souris, vampires.
  { bg: "#1a0608", tree: "tree_bare", treeTints: [0x3a1216, 0x551a20, 0x7a2630], enemy: "vampire", fog: true, bats: true, tile: "tile_vampire", body: "body_vampire" },
  // Niveau 4 : marais hante, spectres (vert).
  { bg: "#04140e", tree: "tree", treeTints: [0x1a3a2a, 0x245038, 0x2f6648], enemy: "spectre", fog: true, tile: "tile_swamp", body: "body_swamp" },
  // Niveau 5 : champ de citrouilles, epouvantails (orange sombre).
  { bg: "#1c1206", tree: "tree_bare", treeTints: [0x3a2810, 0x553c14, 0x7a561c], enemy: "pumpkinhead", bats: true, tile: "tile_pumpkin", body: "body_pumpkin" },
];

/**
 * Hauteur de saut maximale théorique du joueur (v²/2g), utilisée pour borner
 * la hauteur des plateformes afin qu'elles restent atteignables au saut.
 * @type {number}
 */
const MAX_JUMP_HEIGHT =
  (GAME.PLAYER_JUMP * GAME.PLAYER_JUMP) / (2 * GAME.GRAVITY_Y);

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  /**
   * Reçoit la configuration de partie transmise par le Launcher.
   * @param {{username?: string, skin?: ("white"|"black")}} data
   * @returns {void}
   */
  init(data) {
    /** @type {{username: string, skin: ("white"|"black")}} */
    const profile = getProfile((data && data.username) || "Fantome");
    this.cfg = {
      username: (data && data.username) || "Fantome",
      skin: data && data.skin === "black" ? "black" : "white",
      color: (data && data.color) || profile.color || "violet",
      accessories: (data && data.accessories) || profile.equipped || [],
    };

    // Mode NIVEAU (carte) : data.level est l index 0-based du niveau choisi.
    // Sinon, mode classique a 3 paliers.
    this._levelMode = Number.isInteger(data && data.level);
    this._levelIndex = this._levelMode ? Math.max(0, Math.min(LEVEL_COUNT - 1, data.level)) : 0;

    // État de partie (réinitialisé à chaque entrée dans la scène).
    /** @type {number} Bonbons collectés au total (cumul sur tous les paliers). */
    this.candiesCollected = 0;
    /** @type {number} Bonbons collectés dans le palier courant (0..candyTarget). */
    this.tierCollected = 0;
    /** @type {number} Index du palier courant dans CANDY_TIERS. */
    this.tierIndex = 0;
    /** @type {number} Cible de bonbons : specifique au niveau en mode carte. */
    this.candyTarget = this._levelMode ? levelCandyTarget(this._levelIndex) : CANDY_TIERS[0];
    /** @type {number} Secondes restantes au timer (0..TIMER_SECONDS). */
    this.secondsRemaining = GAME.TIMER_SECONDS;
    /** @type {boolean} Garde-fou : la partie n'est terminée qu'une seule fois. */
    this._ended = false;
    /** @type {boolean} Vrai lorsque le menu pause est ouvert. */
    this._paused = false;
    /** @type {Phaser.GameObjects.Container|null} Conteneur du menu pause. */
    this._pauseMenu = null;
    /** @type {boolean} Mode IA : le bot joue automatiquement. */
    this._aiMode = loadAiMode();

    // --- Difficulte croissante par niveau (mode carte) ---
    // Facteur 0 (niveau 1) .. 1 (niveau 5). Pilote la vitesse et le nombre
    // d ennemis. En mode classique, difficulte neutre.
    this._diff = this._levelMode ? this._levelIndex / 4 : 0;
    /** Multiplicateur de vitesse des ennemis (1.0 -> ~1.9). */
    this._enemySpeedMul = 1 + 0.9 * this._diff;
    /** Nombre max d ennemis (6 -> ~12). */
    this._enemyMax = Math.round(6 + 6 * this._diff);

    // --- Combo de collecte (fun) ---
    /** @type {number} Compteur de combo courant. */
    this._combo = 0;
    /** @type {number} Horodatage (ms) de la derniere collecte. */
    this._lastCollectAt = -99999;
    /** @type {number} Bonus de score cumule grace aux combos. */
    this._comboBonus = 0;
  }

  /**
   * Construit le monde, la caméra, le décor, les entités, les collisions, le
   * HUD et le timer.
   * @returns {void}
   */
  create() {
    // Theme : en mode carte, chaque niveau reprend une ambiance (sorciere /
    // squelette / vampire) ; sinon on suit le palier courant.
    if (this._levelMode) {
      const LEVEL_THEME = [0, 1, 2, 3, 4]; // sorciere, squelette, vampire, spectre, citrouille
      const idx = LEVEL_THEME[this._levelIndex] ?? 0;
      this._theme = TIER_THEMES[idx] || TIER_THEMES[0];
    } else {
      this._theme = TIER_THEMES[this.tierIndex] || TIER_THEMES[0];
    }
    this.cameras.main.setBackgroundColor(this._theme.bg);

    // Monde large + bornes de caméra pour le défilement horizontal.
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, GAME.HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME.HEIGHT);

    this._buildBackground();
    this._buildPlatforms();
    this._buildPlayer();
    this._buildWitches();
    this._buildCandies();
    this._buildProjectiles();
    this._buildHud();
    this._bindInput();
    this._wireCollisions();
    this._startTimer();

    // La caméra suit le joueur → la map défile en longueur.
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    // Audio procedural : musique de fond Halloween + effets. Le contexte
    // Web Audio demarre apres l interaction « Lancer la partie » du Launcher.
    this.audio = new AudioEngine();
    this.audio.setMuted(loadPersistedMute());
    this.audio.startMusic();
    // Coupe la musique quand la scene s arrete.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.audio && this.audio.stopMusic());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.audio && this.audio.stopMusic());

    // Nettoyage du timer à l'arrêt de la scène.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this._teardown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this._teardown, this);
  }

  /**
   * Dessine un décor d'arbres morts en plusieurs couches de parallax pour
   * donner de la profondeur. Les couches lointaines défilent plus lentement
   * (scrollFactor plus faible) et sont plus sombres/petites.
   * @returns {void}
   * @private
   */
  _buildBackground() {
    // Objets de decor traces, memorises pour pouvoir les detruire a chaque
    // changement de palier (regeneration).
    this._bgObjects = [];
    const theme = this._theme || TIER_THEMES[0];
    const tints = theme.treeTints;

    // Lueur d ambiance douce et discrete en haut (ciel), sans halos par arbre.
    this._bgObjects.push(
      this.add
        .image(GAME.WIDTH * 0.78, 90, "glow")
        .setScale(2.0)
        .setAlpha(0.28)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(0.1)
        .setDepth(-200),
    );

    /**
     * Couches de parallax d arbres (sans halo lumineux individuel). Les arbres
     * lointains sont plus sombres/petits et defilent plus lentement.
     * @type {Array<{factor:number, scale:number, tint:number, alpha:number, gap:number, y:number}>}
     */
    // La rangee la plus proche (factor 0.7) a sa base de tronc posee sur le sol
    // (GAME.HEIGHT - TILE) ; les rangees lointaines restent legerement en retrait
    // pour l effet de profondeur.
    const groundTop = GAME.HEIGHT - TILE;
    const layers = [
      { factor: 0.2, scale: 1.3, tint: tints[0], alpha: 0.95, gap: 240, y: groundTop - 70 },
      { factor: 0.45, scale: 1.05, tint: tints[1], alpha: 1, gap: 200, y: groundTop - 36 },
      { factor: 0.7, scale: 0.85, tint: tints[2], alpha: 1, gap: 180, y: groundTop },
    ];

    for (const layer of layers) {
      const virtualWidth = WORLD_WIDTH / Math.max(0.0001, layer.factor) + GAME.WIDTH;
      for (let x = 40; x < virtualWidth; x += layer.gap) {
        const jitter = ((Math.sin(x * 12.9898) * 43758.5453) % 1 + 1) % 1;
        const offsetY = jitter * 24;
        this._bgObjects.push(
        this.add
          .image(x, layer.y + offsetY, theme.tree || "tree")
          .setOrigin(0.5, 1)
          .setScale(layer.scale)
          .setTint(layer.tint)
          .setAlpha(layer.alpha)
          .setScrollFactor(layer.factor)
          .setDepth(-100 + Math.round(layer.factor * 10)),
        );
      }
    }

    // Brouillard : bandes semi-transparentes qui derivent (palier vampire).
    if (theme.fog) {
      // Plusieurs petits nuages de brume qui derivent independamment, plutot
      // qu une seule grande bande.
      const PUFFS = 14;
      for (let i = 0; i < PUFFS; i++) {
        const rx = ((Math.sin(i * 13.1) * 43758.5) % 1 + 1) % 1;
        const ry = ((Math.sin(i * 7.7) * 1234.5) % 1 + 1) % 1;
        const x = rx * GAME.WIDTH;
        const y = GAME.HEIGHT - 30 - ry * 220;
        const w = 60 + ry * 120;
        const h = 24 + rx * 26;
        const puff = this.add
          .ellipse(x, y, w, h, 0xb0a0c0, 0.06 + rx * 0.05)
          .setScrollFactor(0.15)
          .setDepth(-80)
          .setBlendMode(Phaser.BlendModes.ADD);
        this._bgObjects.push(puff);
        // Derive horizontale propre a chaque nuage (sens + vitesse varies).
        this.tweens.add({
          targets: puff,
          x: "+=" + ((i % 2 === 0 ? 1 : -1) * (60 + rx * 120)),
          duration: 4000 + ry * 5000,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        // Leger battement d opacite.
        this.tweens.add({
          targets: puff,
          alpha: 0.02,
          duration: 2500 + rx * 2500,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }

    // Chauves-souris volant en fond (palier vampire).
    if (theme.bats) {
      for (let i = 0; i < 9; i++) {
        const bx = (GAME.WIDTH * (i + 0.5)) / 9;
        const by = 60 + ((Math.sin(i * 37.1) + 1) / 2) * (GAME.HEIGHT * 0.45);
        const bat = this.add
          .image(bx, by, "bat")
          .setScale(0.6 + ((Math.sin(i * 9.3) + 1) / 2) * 0.8)
          .setAlpha(0.8)
          .setTint(0x1a1024)
          .setScrollFactor(0.3)
          .setDepth(-70);
        this._bgObjects.push(bat);
        this.tweens.add({
          targets: bat,
          x: "+=" + (i % 2 === 0 ? 180 : -180),
          duration: 3000 + (i % 4) * 700,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        this.tweens.add({
          targets: bat,
          y: "+=" + (12 + (i % 3) * 6),
          scaleY: 0.75,
          duration: 500 + (i % 3) * 120,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }
  }

  /**
   * Construit le sol continu (sur toute la largeur du monde) et un ensemble de
   * plateformes générées aléatoirement, à des hauteurs atteignables au saut.
   * @returns {void}
   * @private
   */
  _buildPlatforms() {
    /** @type {Phaser.Physics.Arcade.StaticGroup} */
    this.platforms = this.physics.add.staticGroup();

    const theme = this._theme || TIER_THEMES[0];
    const tileKey = theme.tile || "tile";   // dessus (chemin)
    const bodyKey = theme.body || tileKey;   // interieur (corps)
    const sky = Phaser.Display.Color.HexStringToColor(theme.bg).color;
    this._platformOverlay = this.add.graphics().setDepth(5);

    // Sol continu sur toute la largeur du monde.
    const groundY = GAME.HEIGHT - TILE / 2;
    const groundTop = GAME.HEIGHT - TILE;
    const totalCols = Math.ceil(WORLD_WIDTH / TILE);
    for (let i = 0; i < totalCols; i++) {
      this.platforms.create(i * TILE + TILE / 2, groundY, tileKey);
    }

    // Profil de montagne IRREGULIER : hauteur (en niveaux) par colonne de
    // tuile, via une marche aleatoire. 0 = sol plat. Les colonnes a 0 servent
    // aussi a reperer les zones plates ou faire apparaitre les ennemis.
    this._colLevels = this._randomColumnLevels(totalCols);

    // Zones plates (suites de colonnes a 0) pour le spawn des ennemis.
    this._flatSpans = [];
    let runStart = -1;
    for (let c = 0; c <= totalCols; c++) {
      const flat = c < totalCols && this._colLevels[c] === 0;
      if (flat && runStart < 0) runStart = c;
      if (!flat && runStart >= 0) {
        if (c - runStart >= 4) {
          this._flatSpans.push({ x0: runStart * TILE, x1: c * TILE });
        }
        runStart = -1;
      }
    }

    // Construit les colonnes de montagne + overlay arrondi sur les sommets.
    const maxCol = this._colLevels.length;
    for (let c = 0; c < maxCol; c++) {
      const levels = this._colLevels[c];
      if (levels <= 0) continue;
      const bx = c * TILE + TILE / 2;
      const topY = groundTop - levels * TILE + TILE / 2;
      this.platforms.create(bx, topY, tileKey); // dessus
      for (let lvl = 1; lvl < levels; lvl++) {
        this.platforms.create(bx, topY + lvl * TILE, bodyKey);
      }
      // Arrondi : coin haut-gauche si la colonne de gauche est plus basse ;
      // coin haut-droit si celle de droite est plus basse.
      const surfaceY = groundTop - levels * TILE;
      const leftLower = (this._colLevels[c - 1] || 0) < levels;
      const rightLower = (this._colLevels[c + 1] || 0) < levels;
      const r = 9;
      this._platformOverlay.fillStyle(sky, 1);
      if (leftLower) {
        const lx = c * TILE;
        this._platformOverlay.beginPath();
        this._platformOverlay.moveTo(lx, surfaceY);
        this._platformOverlay.lineTo(lx + r, surfaceY);
        this._platformOverlay.arc(lx + r, surfaceY + r, r, -Math.PI / 2, Math.PI, true);
        this._platformOverlay.lineTo(lx, surfaceY);
        this._platformOverlay.closePath();
        this._platformOverlay.fillPath();
      }
      if (rightLower) {
        const rx = (c + 1) * TILE;
        this._platformOverlay.beginPath();
        this._platformOverlay.moveTo(rx, surfaceY);
        this._platformOverlay.lineTo(rx - r, surfaceY);
        this._platformOverlay.arc(rx - r, surfaceY + r, r, -Math.PI / 2, 0, false);
        this._platformOverlay.lineTo(rx, surfaceY);
        this._platformOverlay.closePath();
        this._platformOverlay.fillPath();
      }
    }

    // PLATEFORMES FLOTTANTES (conservees) : quelques plateformes suspendues
    // en plus des montagnes, atteignables au saut.
    this._ledges = [];
    const floating = this._randomFloatingLedges();
    for (const ledge of floating) {
      const startX = ledge.x - (ledge.tiles * TILE) / 2 + TILE / 2;
      for (let i = 0; i < ledge.tiles; i++) {
        this.platforms.create(startX + i * TILE, ledge.y + TILE / 2, tileKey);
      }
      // Overlay arrondi des 2 coins superieurs.
      const left = ledge.x - (ledge.tiles * TILE) / 2;
      const w = ledge.tiles * TILE;
      const r = 9;
      this._platformOverlay.fillStyle(sky, 1);
      this._platformOverlay.beginPath();
      this._platformOverlay.moveTo(left, ledge.y);
      this._platformOverlay.lineTo(left + r, ledge.y);
      this._platformOverlay.arc(left + r, ledge.y + r, r, -Math.PI / 2, Math.PI, true);
      this._platformOverlay.lineTo(left, ledge.y);
      this._platformOverlay.closePath();
      this._platformOverlay.fillPath();
      this._platformOverlay.beginPath();
      this._platformOverlay.moveTo(left + w, ledge.y);
      this._platformOverlay.lineTo(left + w - r, ledge.y);
      this._platformOverlay.arc(left + w - r, ledge.y + r, r, -Math.PI / 2, 0, false);
      this._platformOverlay.lineTo(left + w, ledge.y);
      this._platformOverlay.closePath();
      this._platformOverlay.fillPath();
      this._ledges.push({ x: ledge.x, y: ledge.y, tiles: ledge.tiles });
    }

    // Enregistre aussi les sommets de montagne comme "ledges" (pour bonbons/IA).
    this._registerMountainTops(groundTop);
  }

  /**
   * Marche aleatoire de hauteurs par colonne (profil de montagne irregulier).
   * @param {number} totalCols
   * @returns {number[]}
   * @private
   */
  _randomColumnLevels(totalCols) {
    const maxLevels = Math.max(1, Math.min(3, Math.floor((MAX_JUMP_HEIGHT * 0.9) / TILE)));
    const levels = new Array(totalCols).fill(0);
    const rng = Math.random;
    // Ecart plat GARANTI entre deux montagnes (en colonnes) : jamais de
    // superposition.
    const MIN_GAP = 6;
    let c = 6; // depart plat pres du spawn
    while (c < totalCols - (MIN_GAP + 4)) {
      // Une montagne = suite de PALIERS. Chaque palier de hauteur h fait au
      // moins 2*h colonnes de large (2 carres de large min par niveau de
      // hauteur). On enchaine 1 a 3 paliers de hauteurs variees (asymetrique).
      const plateaus = 1 + Math.floor(rng() * 3);
      let prevH = 0;
      for (let pz = 0; pz < plateaus; pz++) {
        // Hauteur du palier (evite de repeter exactement la precedente).
        let h = 1 + Math.floor(rng() * maxLevels);
        if (h === prevH && maxLevels > 1) {
          h = 1 + ((h) % maxLevels); // force une variation
        }
        prevH = h;
        // Largeur minimale = 2 * hauteur, plus un supplement aleatoire.
        const w = Math.max(2 * h, 2) + Math.floor(rng() * 4);
        for (let k = 0; k < w && c < totalCols - MIN_GAP; k++, c++) {
          levels[c] = h;
        }
        if (c >= totalCols - MIN_GAP) break;
      }
      // Ecart plat garanti avant la prochaine montagne.
      c += MIN_GAP + Math.floor(rng() * 5);
    }
    return levels;
  }  /**
   * Quelques plateformes flottantes aleatoires (hauteur atteignable au saut),
   * placees au-dessus de zones plutot plates.
   * @returns {Array<{x:number, y:number, tiles:number}>}
   * @private
   */
  _randomFloatingLedges() {
    const rng = Math.random;
    const groundTop = GAME.HEIGHT - TILE;
    const minUp = 78;
    const maxUp = Math.min(MAX_JUMP_HEIGHT * 0.85, 108);
    const ledges = [];
    // Uniquement au-dessus des ZONES PLATES (jamais au-dessus d une montagne),
    // avec une marge laterale pour garder une distance avec le relief.
    const spans = (this._flatSpans || []).filter((s) => s.x1 - s.x0 >= 6 * TILE);
    for (const s of spans) {
      if (rng() < 0.45) continue; // pas de plateforme partout
      const tiles = 3 + Math.floor(rng() * 2); // 3 a 4 tuiles
      const w = tiles * TILE;
      const margin = 2 * TILE; // distance laterale avec les montagnes
      const minX = s.x0 + margin + w / 2;
      const maxX = s.x1 - margin - w / 2;
      if (maxX <= minX) continue; // zone plate trop petite
      const x = minX + rng() * (maxX - minX);
      const up = minUp + rng() * (maxUp - minUp);
      ledges.push({ x: Math.round(x), y: Math.round(groundTop - up), tiles });
    }
    return ledges;
  }
  /**
   * Enregistre le sommet de chaque palier de montagne comme "ledge" (pour y
   * poser des bonbons et guider l IA). Un palier = suite de colonnes de meme
   * hauteur >= 1.
   * @param {number} groundTop
   * @returns {void}
   * @private
   */
  _registerMountainTops(groundTop) {
    const L = this._colLevels || [];
    let c = 0;
    while (c < L.length) {
      const h = L[c];
      if (h > 0) {
        let c2 = c;
        while (c2 < L.length && L[c2] === h) c2++;
        const tiles = c2 - c;
        const cx = (c + c2) / 2 * TILE;
        const y = groundTop - h * TILE;
        this._ledges.push({ x: Math.round(cx), y, tiles });
        c = c2;
      } else {
        c++;
      }
    }
  }
  /**
   * Instancie le Player au sol avec le skin choisi (exigence 1.6, 7.1).
   * @returns {void}
   * @private
   */
  _buildPlayer() {
    const spawnY = GAME.HEIGHT - TILE - 24;
    // Texture personnalisee (couleur + accessoires equipes) regeneree a chaque
    // partie a partir du profil du joueur.
    const factory = new TextureFactory(this);
    factory.makeGhostCustom("ghost_custom", {
      color: this.cfg.color,
      accessories: this.cfg.accessories,
    });
    /** @type {Player} */
    this.player = new Player(this, 60, spawnY, this.cfg.skin, "ghost_custom");
  }

  /**
   * Place des sorcières patrouilleuses au sol et sur certaines plateformes,
   * réparties sur la largeur du monde (exigences 8.1, 8.2).
   * @returns {void}
   * @private
   */
  _buildWitches() {
    /** @type {Phaser.GameObjects.Group} */
    this.witches = this.add.group();

    const groundWitchY = GAME.HEIGHT - TILE - 26;
    const enemyKey = (this._theme || TIER_THEMES[0]).enemy;

    // Zone de depart SANS ennemi : rien devant le joueur avant le premier
    // obstacle, pour ne pas le piéger au spawn.
    const START_SAFE_X = 760;

    // Les ennemis apparaissent sur les ZONES PLATES (jamais dans une montagne),
    // au-dela de la zone de depart, et patrouillent dans les limites de leur
    // zone ; ils font demi-tour au contact du relief (Witch.patrol/body.blocked).
    const spans = (this._flatSpans || [])
      .filter((s) => s.x1 - s.x0 >= 5 * TILE)
      .filter((s) => s.x0 >= START_SAFE_X);
    const margin = 20;
    const speed = GAME.WITCH_SPEED * (this._enemySpeedMul || 1);
    let count = 0;
    const maxWitches = this._enemyMax || 7;
    for (const s of spans) {
      if (count >= maxWitches) break;
      const center = (s.x0 + s.x1) / 2;
      const min = s.x0 + margin;
      const max = s.x1 - margin;
      const witch = new Witch(this, center, groundWitchY, min, max, enemyKey);
      witch.patrolSpeed = speed;
      this.witches.add(witch);
      count++;
      // Aux niveaux difficiles, certaines zones larges accueillent 2 ennemis.
      if (this._diff >= 0.5 && (s.x1 - s.x0) >= 10 * TILE && count < maxWitches) {
        const w2 = new Witch(this, center - 100, groundWitchY, min, max, enemyKey);
        w2.patrolSpeed = speed;
        this.witches.add(w2);
        count++;
      }
    }

    // Repli : si aucune zone plate exploitable, place quelques ennemis au-dela
    // de la zone de depart.
    if (count === 0) {
      const speed = GAME.WITCH_SPEED * (this._enemySpeedMul || 1);
      for (let i = 1; i <= 4; i++) {
        const center = Math.max(START_SAFE_X + 160, (WORLD_WIDTH * i) / 5);
        const witch = new Witch(this, center, groundWitchY, center - 120, center + 120, enemyKey);
        witch.patrolSpeed = speed;
        this.witches.add(witch);
      }
    }
  }

  /**
   * Distribue exactement `candyTarget - candiesCollected` bonbons collectables
   * pour le palier courant, répartis sur les plateformes et le long du sol, sur
   * toute la largeur du monde (exigence 5.1).
   * @returns {void}
   * @private
   */
  _buildCandies() {
    /** @type {Phaser.Physics.Arcade.Group} */
    this.candies = this.physics.add.group({ allowGravity: false, immovable: true });

    const needed = Math.max(0, this.candyTarget);
    const positions = this._candyPositions(needed);
    for (const pos of positions) {
      const candy = this.candies.create(pos.x, pos.y, "candy");
      if (candy.body && typeof candy.body.setAllowGravity === "function") {
        candy.body.setAllowGravity(false);
      }
    }
  }

  /**
   * Calcule des positions de bonbons réparties sur les plateformes et le sol,
   * étalées sur toute la largeur du monde, limitées au nombre demandé.
   * @param {number} count Nombre de bonbons à placer.
   * @returns {Array<{x: number, y: number}>}
   * @private
   */
  _candyPositions(count) {
    /** @type {Array<{x: number, y: number}>} */
    const positions = [];

    // Bonbons posés au-dessus des plateformes.
    for (const ledge of this._ledges) {
      const y = ledge.y - 22;
      const span = (ledge.tiles - 1) * TILE;
      const left = ledge.x - span / 2;
      const n = Math.min(2, ledge.tiles);
      for (let i = 0; i < n; i++) {
        const x = ledge.tiles === 1 ? ledge.x : left + (span * i) / Math.max(1, n - 1);
        positions.push({ x, y });
      }
    }

    // Le reste au sol/sur les montagnes : chaque bonbon est pose JUSTE AU-DESSUS
    // de la surface reelle a sa position x (sol plat ou sommet de montagne),
    // jamais a l interieur d un relief.
    const remaining = Math.max(0, count - positions.length);
    const groundSlots = Math.max(remaining, 1);
    for (let i = 0; i < groundSlots; i++) {
      const x = 80 + ((WORLD_WIDTH - 160) * i) / Math.max(1, groundSlots - 1);
      positions.push({ x, y: this._surfaceYAt(x) - 22 });
    }

    return positions.slice(0, count);
  }

  /**
   * Renvoie l ordonnee de la surface (haut du sol ou du sommet de montagne) a
   * la position horizontale `x`, en px. Sert a poser les bonbons au-dessus du
   * relief.
   * @param {number} x
   * @returns {number}
   * @private
   */
  _surfaceYAt(x) {
    const groundTop = GAME.HEIGHT - TILE;
    const col = Math.floor(x / TILE);
    const levels = (this._colLevels && this._colLevels[col]) || 0;
    return groundTop - levels * TILE;
  }

  /**
   * Crée le groupe de projectiles (bonbons magiques), sans gravité
   * (exigence 9.4). Le groupe est consommé par `Player.fire`.
   * @returns {void}
   * @private
   */
  _buildProjectiles() {
    /** @type {Phaser.Physics.Arcade.Group} */
    this.projectiles = this.physics.add.group({
      allowGravity: false,
      defaultKey: "projectile",
    });
  }

  /**
   * Construit le HUD : cœurs (0–3), Candy_Counter `x / cible` précédé d'une
   * icône bonbon, et timer dynamique (exigences 5.4, 6.3, 7.8). Les éléments
   * restent fixes à l'écran (scrollFactor 0).
   * @returns {void}
   * @private
   */
  _buildHud() {
    const style = {
      fontFamily: "monospace",
      fontSize: "20px",
      fontStyle: "bold",
      color: "#ffffff",
    };

    /** @type {Phaser.GameObjects.Text} Affichage des cœurs. */
    this._heartsText = this.add
      .text(16, 12, "", style)
      .setScrollFactor(0)
      .setDepth(1000);

    /** @type {Phaser.GameObjects.Text} Candy_Counter `x / cible`. */
    this._candyText = this.add
      .text(GAME.WIDTH / 2, 12, "", { ...style, color: ORANGE_STR })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    /** @type {Phaser.GameObjects.Image} Icône bonbon à gauche du compteur. */
    this._candyIcon = this.add
      .image(GAME.WIDTH / 2 - 16, 22, "candy")
      .setOrigin(1, 0.5)
      .setScale(1.6)
      .setScrollFactor(0)
      .setDepth(1000);

    /** @type {Phaser.GameObjects.Text} Indicateur de palier. */
    this._tierText = this.add
      .text(GAME.WIDTH / 2, 38, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#b06bf0",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    /** @type {Phaser.GameObjects.Text} Timer dynamique. */
    this._timerText = this.add
      .text(GAME.WIDTH - 16, 12, "", style)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this._buildMoon();
    this._updateHud();
  }

  /**
   * Dessine une petite lune (croissant) fixe dans le HUD, en haut a droite,
   * sous le timer. Purement decorative ; reste fixe a l ecran (scrollFactor 0).
   * @returns {void}
   * @private
   */
  _buildMoon() {
    const cxMoon = GAME.WIDTH - 44;
    const cyMoon = 60;
    const r = 16;

    const moon = this.add.graphics().setScrollFactor(0).setDepth(1000);
    // Lueur douce autour de la lune.
    moon.fillStyle(0xffe8b0, 0.18);
    moon.fillCircle(cxMoon, cyMoon, r + 8);
    // Disque de la lune.
    moon.fillStyle(0xffe8b0, 1);
    moon.fillCircle(cxMoon, cyMoon, r);
    // Croissant : on redessine un disque de la couleur du ciel, decale, pour
    // "mordre" la lune.
    moon.fillStyle(0x0b0014, 1);
    moon.fillCircle(cxMoon + 7, cyMoon - 3, r);
  }

  /**
   * Rafraîchit l'ensemble des éléments du HUD à partir de l'état courant.
   * @returns {void}
   * @private
   */
  _updateHud() {
    const hearts = this.player ? this.player.hearts : GAME.PLAYER_HEARTS;
    const full = "\u2665".repeat(Math.max(0, hearts));
    const empty = "\u2661".repeat(Math.max(0, GAME.PLAYER_HEARTS - hearts));
    if (this._heartsText) this._heartsText.setText(full + empty);
    if (this._candyText) {
      this._candyText.setText(`${this.tierCollected} / ${this.candyTarget}`);
    }
    if (this._tierText) {
      this._tierText.setText(
        this._levelMode
          ? `NIVEAU ${this._levelIndex + 1}/${LEVEL_COUNT}`
          : `PALIER ${this.tierIndex + 1}/${CANDY_TIERS.length}`,
      );
    }
    if (this._timerText) this._timerText.setText(`${this.secondsRemaining}s`);
  }

  /**
   * Enregistre les objets-touches pour la lecture d'entrée dans `update`
   * (gauche, droite, saut, tir). Chaque action peut avoir plusieurs touches.
   * @returns {void}
   * @private
   */
  _bindInput() {
    const kb = this.input.keyboard;
    const codes = Phaser.Input.Keyboard.KeyCodes;

    // Ajoute les touches SANS capture globale (enableCapture=false) : la saisie
    // clavier dans les champs HTML (pseudo) n est jamais avalee par Phaser.
    const makeKeys = (names) =>
      names
        .map((name) => (codes[name] != null ? kb.addKey(codes[name], false) : null))
        .filter(Boolean);

    /** @type {{left: any[], right: any[], jump: any[], fire: any[], pause: any[]}} */
    this._keys = {
      left: makeKeys(KEYS.LEFT),
      right: makeKeys(KEYS.RIGHT),
      jump: makeKeys(KEYS.JUMP),
      fire: makeKeys(KEYS.FIRE),
      pause: makeKeys(["ESC"]),
    };

    // Capture (preventDefault) UNIQUEMENT pendant le jeu, pour empecher le
    // defilement de la page avec Espace/fleches, puis liberation a l arret.
    const captureCodes = [...KEYS.LEFT, ...KEYS.RIGHT, ...KEYS.JUMP, ...KEYS.FIRE, "ESC"]
      .map((nm) => codes[nm])
      .filter((c) => c != null);
    kb.addCapture(captureCodes);

    const releaseKeyboard = () => {
      try {
        kb.removeCapture(captureCodes);
        kb.removeAllKeys(true);
      } catch { /* best-effort */ }
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, releaseKeyboard);
    this.events.once(Phaser.Scenes.Events.DESTROY, releaseKeyboard);
  }

  /**
   * Indique si l'une des touches d'une action est actuellement pressée.
   * @param {any[]} keys Liste d'objets Key.
   * @returns {boolean}
   * @private
   */
  _isDown(keys) {
    return keys.some((k) => k && k.isDown);
  }

  /**
   * Indique si l'une des touches d'une action vient d'être pressée (edge).
   * @param {any[]} keys Liste d'objets Key.
   * @returns {boolean}
   * @private
   */
  _justDown(keys) {
    return keys.some((k) => k && Phaser.Input.Keyboard.JustDown(k));
  }

  /**
   * Déclare les collisions et chevauchements physiques.
   * @returns {void}
   * @private
   */
  _wireCollisions() {
    this._playerPlatformCollider = this.physics.add.collider(this.player, this.platforms);
    this._witchPlatformCollider = this.physics.add.collider(this.witches, this.platforms);

    this._candyOverlap = this.physics.add.overlap(
      this.player,
      this.candies,
      this.onCollectCandy,
      undefined,
      this,
    );
    this._witchOverlap = this.physics.add.overlap(
      this.player,
      this.witches,
      this.onHitWitch,
      undefined,
      this,
    );
    this._projOverlap = this.physics.add.overlap(
      this.projectiles,
      this.witches,
      this.onProjectileHit,
      undefined,
      this,
    );
  }

  /**
   * Démarre le compte à rebours : un évènement périodique d'une seconde
   * décrémente le timer (exigences 6.1, 6.2).
   * @returns {void}
   * @private
   */
  _startTimer() {
    /** @type {Phaser.Time.TimerEvent} */
    this._timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this.tickTimer,
      callbackScope: this,
    });
  }

  /**
   * Boucle de frame : entrées clavier, déplacement, tir, patrouilles, retrait
   * des projectiles hors limites et rafraîchissement du HUD.
   * @param {number} _time Horodatage courant (non utilisé).
   * @param {number} _delta Delta depuis la dernière frame (non utilisé).
   * @returns {void}
   */
  update(_time, _delta) {
    if (this._ended) return;

    // Bascule du menu pause sur ECHAP (fonctionne meme en pause).
    if (this._justDown(this._keys.pause)) {
      this._togglePause();
    }
    // Tant que le menu pause est ouvert, le gameplay est gele.
    if (this._paused) return;

    if (this._aiMode) {
      // Mode IA : pilotage direct et fiable (le fantome se dirige vers chaque
      // bonbon et le ramasse, sans dependre de l arc de saut). Garantit la
      // reussite des 3 paliers.
      this._driveAiAutopilot(_delta);
    } else {
      // Mode manuel : entrees clavier du joueur.
      this.player.handleMovement({
        left: this._isDown(this._keys.left),
        right: this._isDown(this._keys.right),
        jump: this._isDown(this._keys.jump),
      });
      if (this._justDown(this._keys.fire)) {
        this.player.fire(this.projectiles);
      }
    }

    this.witches.children.each((witch) => {
      if (witch && witch.active && typeof witch.patrol === "function") {
        witch.patrol();
      }
      return true;
    });

    this.projectiles.children.each((proj) => {
      if (!proj || !proj.active) return true;
      if (
        proj.x < -32 ||
        proj.x > WORLD_WIDTH + 32 ||
        proj.y < -32 ||
        proj.y > GAME.HEIGHT + 32
      ) {
        this._removeProjectile(proj);
      }
      return true;
    });

    this._updateHud();
  }

  /**
   * Collecte un bonbon : le retire, incrémente le compteur cumulé et déclenche
   * le passage de palier (ou la victoire finale) à l'atteinte de la cible
   * courante (exigences 5.2, 5.3).
   * @param {Player} _player Player (non utilisé directement).
   * @param {Phaser.Physics.Arcade.Sprite} candy Bonbon collecté.
   * @returns {void}
   */
  onCollectCandy(_player, candy) {
    if (this._ended || !candy || !candy.active) return;

    const cx = candy.x;
    const cy = candy.y;
    candy.disableBody(true, true);
    this.candiesCollected += 1;
    this.tierCollected += 1;

    // --- Combo de collecte : ramasser vite enchaine le combo ---
    const now = this.time.now;
    if (now - this._lastCollectAt < 1200) this._combo += 1;
    else this._combo = 1;
    this._lastCollectAt = now;

    // Petit « pop » de particules sur le bonbon.
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI * 2 * i) / 6;
      const p = this.add.circle(cx, cy, 2.5, 0xffc24a, 1).setDepth(900);
      this.tweens.add({
        targets: p,
        x: cx + Math.cos(ang) * 18,
        y: cy + Math.sin(ang) * 18,
        alpha: 0,
        duration: 320,
        onComplete: () => p.destroy(),
      });
    }

    // Bonus de score cumule a partir de combo 2 (10 pts * (combo-1)).
    if (this._combo >= 2) {
      this._comboBonus += 10 * (this._combo - 1);
    }

    // A partir de 3 de combo : affichage « COMBO xN » au-dessus du joueur.
    if (this._combo >= 3) {
      const label = this.add
        .text(this.player.x, this.player.y - 40, "COMBO x" + this._combo, {
          fontFamily: "monospace",
          fontSize: "16px",
          fontStyle: "bold",
          color: this._combo >= 6 ? "#ff5a5a" : "#ffd24a",
        })
        .setOrigin(0.5)
        .setDepth(1500);
      this.tweens.add({
        targets: label,
        y: label.y - 26,
        alpha: 0,
        duration: 700,
        onComplete: () => label.destroy(),
      });
    }

    this._updateHud();

    if (this.tierCollected >= this.candyTarget) {
      this._advanceTier();
    }
  }

  /**
   * Fait progresser le palier. Si c'était le dernier (50), c'est la victoire
   * finale. Sinon, relève la cible et régénère le niveau (plateformes,
   * sorcières, bonbons) SANS toucher au compte à rebours.
   * @returns {void}
   * @private
   */
  _advanceTier() {
    // En mode carte (niveau unique), atteindre la cible = victoire du niveau.
    if (this._levelMode) {
      this.endGame("win");
      return;
    }
    const isLast = this.tierIndex >= CANDY_TIERS.length - 1;
    if (isLast) {
      this.endGame("win");
      return;
    }

    this.tierIndex += 1;
    this.candyTarget = CANDY_TIERS[this.tierIndex];
    this.tierCollected = 0;
    // 1 minute par palier : on reinitialise le compte a rebours a chaque palier.
    this.secondsRemaining = GAME.TIMER_SECONDS;
    this._regenerateLevel();
    this._updateHud();

    // Petit flash « PALIER ! » non bloquant.
    const banner = this.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT / 2, `PALIER ${this.tierIndex + 1} !`, {
        fontFamily: "monospace",
        fontSize: "40px",
        fontStyle: "bold",
        color: ORANGE_STR,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000);
    this.tweens.add({
      targets: banner,
      alpha: 0,
      y: GAME.HEIGHT / 2 - 40,
      duration: 900,
      onComplete: () => banner.destroy(),
    });
  }

  /**
   * Régénère le niveau pour le nouveau palier : détruit plateformes, sorcières,
   * bonbons et projectiles existants, puis les reconstruit (nouvelles
   * plateformes aléatoires). Reconnecte les collisions et recadre la caméra.
   * Le joueur, les cœurs et le timer sont conservés.
   * @returns {void}
   * @private
   */
  _regenerateLevel() {
    // Applique le theme du nouveau palier (fond + arbres + ennemi).
    this._theme = TIER_THEMES[this.tierIndex] || TIER_THEMES[0];
    this.cameras.main.setBackgroundColor(this._theme.bg);

    // Détruit les groupes de décor/entités (sauf le joueur) et l ancien decor.
    if (this.platforms) this.platforms.clear(true, true);
    if (this._platformOverlay) { this._platformOverlay.destroy(); this._platformOverlay = null; }
    if (this.witches) this.witches.clear(true, true);
    if (this.candies) this.candies.clear(true, true);
    if (this.projectiles) this.projectiles.clear(true, true);
    if (this._bgObjects) {
      for (const o of this._bgObjects) o && o.destroy();
      this._bgObjects = [];
    }

    // Reconstruit le decor (nouvelles teintes) et le niveau.
    this._buildBackground();
    this._buildPlatforms();
    this._buildWitches();
    this._buildCandies();
    this._buildProjectiles();

    // Replace le joueur nettement AU-DESSUS du sol pour eviter qu il se retrouve
    // a moitie encastre dans la tuile apres la regeneration des plateformes.
    // On resynchronise le corps physique a la nouvelle position (body.reset)
    // et on annule toute velocite residuelle ; le joueur retombera proprement
    // sur le nouveau sol.
    const spawnX = 60;
    const spawnY = GAME.HEIGHT - TILE - 60; // marge de securite au-dessus du sol
    if (this.player.body && typeof this.player.body.reset === "function") {
      this.player.body.reset(spawnX, spawnY);
    } else {
      this.player.setPosition(spawnX, spawnY);
    }
    if (this.player.setVelocity) this.player.setVelocity(0, 0);
    if (typeof this.player.setVisible === "function") this.player.setVisible(true);

    // Reconnecte les colliders/overlaps vers les nouveaux groupes.
    this._wireCollisions();
  }

  /**
   * Contact Player / sorcière : applique un dégât via `takeDamage` (ignoré
   * pendant l'invulnérabilité) et déclare la défaite une seule fois si les
   * cœurs tombent à 0 (exigences 7.2, 7.7).
   * @param {Player} player Player touché.
   * @param {Witch} _witch Sorcière en contact.
   * @returns {void}
   */
  onHitWitch(player, _witch) {
    if (this._ended) return;
    if (player.isInvulnerable) return;

    const before = player.hearts;
    const hearts = player.takeDamage();
    this._updateHud();

    // Son de perte de coeur si un coeur a effectivement ete retire.
    if (this.audio && hearts < before && hearts > 0) {
      this.audio.playHurt();
    }

    if (hearts <= 0) {
      this.endGame("lose");
    }
  }

  /**
   * Impact projectile / sorcière : détruit la sorcière et retire le projectile
   * (exigence 9.5). Laisse le Candy_Counter inchangé (9.7).
   * @param {Phaser.Physics.Arcade.Sprite} projectile Projectile en contact.
   * @param {Witch} witch Sorcière touchée.
   * @returns {void}
   */
  onProjectileHit(projectile, witch) {
    if (!witch || !witch.active) return;
    if (typeof witch.defeat === "function") {
      witch.defeat();
    } else {
      witch.destroy();
    }
    this._removeProjectile(projectile);
  }

  /**
   * Retire proprement un projectile du jeu (désactivation + destruction).
   * @param {Phaser.Physics.Arcade.Sprite} proj Projectile à retirer.
   * @returns {void}
   * @private
   */
  _removeProjectile(proj) {
    if (!proj) return;
    if (typeof proj.disableBody === "function") {
      proj.disableBody(true, true);
    }
    proj.destroy();
  }

  /**
   * Décrémente le timer d'une seconde ; rafraîchit le HUD et déclare la défaite
   * si le compte à rebours atteint 0 avant le dernier palier (exigences 6.2,
   * 6.4).
   * @returns {void}
   */
  tickTimer() {
    if (this._ended) return;

    this.secondsRemaining = Math.max(0, this.secondsRemaining - 1);
    this._updateHud();

    if (this.secondsRemaining <= 0) {
      this.endGame("lose");
    }
  }

  /**
   * Mode IA : autopilote fiable. Deplace directement le fantome vers le bonbon
   * actif le plus proche (interpolation de position a vitesse elevee, gravite
   * neutralisee pendant le pilotage) jusqu a le toucher, ce qui declenche l
   * overlap de collecte existant. Enchaine ainsi tous les bonbons et donc les
   * trois paliers sans jamais rester bloque sur une plateforme. Tire au passage
   * sur les sorcieres proches pour l ambiance.
   * @param {number} deltaMs Delta de frame en millisecondes.
   * @returns {void}
   * @private
   */
  _driveAiAutopilot(deltaMs) {
    const p = this.player;
    if (!p) return;
    const TILE = 32;

    // Physique reelle : gravite active, pilotage via handleMovement.
    if (p.body && typeof p.body.setAllowGravity === "function" && p.body.allowGravity === false) {
      p.body.setAllowGravity(true);
    }

    const onGround = !!(p.body && p.body.blocked && p.body.blocked.down);

    // 1) Cible : bonbon actif le plus proche.
    let target = null;
    let bestD = Infinity;
    this.candies.children.each((c) => {
      if (!c || !c.active) return true;
      const d = Math.abs(c.x - p.x) + Math.abs(c.y - p.y) * 0.6;
      if (d < bestD) { bestD = d; target = c; }
      return true;
    });

    const input = { left: false, right: false, jump: false };
    // Direction de progression : vers le bonbon (droite par defaut).
    const progressDir = target ? (target.x >= p.x ? 1 : -1) : 1;

    // 2) PRIORITE : eliminer une sorciere qui barre la route avant d avancer.
    //    On cherche une sorciere devant (dans la direction de progression), a
    //    hauteur voisine et a portee. Si presente : stop + face + tir, sans
    //    avancer vers elle. On n avance qu une fois la voie degagee.
    let blockingWitch = null;
    let blockingDist = Infinity;
    this.witches.children.each((w) => {
      if (!w || !w.active) return true;
      const rel = w.x - p.x;
      const ahead = Math.sign(rel) === progressDir || Math.abs(rel) < 20;
      const closeY = Math.abs(w.y - p.y) < 60;
      if (ahead && closeY && Math.abs(rel) < 420) {
        if (Math.abs(rel) < blockingDist) { blockingDist = Math.abs(rel); blockingWitch = w; }
      }
      return true;
    });

    if (blockingWitch) {
      // Compteur : si on n arrive pas a degager la sorciere depuis trop
      // longtemps, on la saute pour ne jamais rester bloque.
      this._aiWitchWait = (this._aiWitchWait || 0) + 1;
      const giveUp = this._aiWitchWait > 150; // ~2.5 s
      if (!giveUp) {
        const dirW = blockingWitch.x >= p.x ? 1 : -1;
        if (typeof p.setFlipX === "function") p.setFlipX(dirW < 0);
        this.player.facing = dirW; // garantit la direction du projectile
        // Petit recul si la sorciere est tres proche (garde la distance de tir).
        if (blockingDist < 90) { input.left = dirW > 0; input.right = dirW < 0; }
        this.player.handleMovement(input);
        this.player.fire(this.projectiles);
        this._aiPrevX = p.x; this._aiPrevY = p.y;
        this._aiStall = 0; this._aiFail = 0;
        return; // tant qu une sorciere barre la route, on ne progresse pas
      }
      // Abandon : on saute par-dessus et on continue vers le bonbon.
      if (onGround) input.jump = true;
      if (this._aiWitchWait > 170) this._aiWitchWait = 0;
    } else {
      this._aiWitchWait = 0;
    }

    if (!target) {
      input.right = true;
      this.player.handleMovement(input);
      this._aiStall = 0; this._aiFail = 0;
      this._aiPrevX = p.x; this._aiPrevY = p.y;
      return;
    }

    // 3) Visee horizontale vers le bonbon.
    const dx = target.x - p.x;
    const dead = 6;
    if (dx > dead) input.right = true;
    else if (dx < -dead) input.left = true;
    if (typeof p.setFlipX === "function") p.setFlipX(input.left);

    // 4) Saut sur plateforme : des que le bot approche une plateforme devant
    //    lui (dans sa direction, a portee, plus haute que lui), il saute et
    //    garde l elan pour monter dessus. Combine avec la regle « bonbon plus
    //    haut => saute ».
    const targetHigher = target.y < p.y - 12;
    let platformAhead = false;
    if (this._ledges && onGround) {
      for (const l of this._ledges) {
        const halfW = (l.tiles * TILE) / 2;
        const platTop = l.y - TILE;
        const higher = platTop < p.y - 10;        // plateforme au-dessus du bot
        const relEdge = (l.x - p.x) * progressDir; // >0 si la plateforme est devant
        // « Proche » = bord de la plateforme a moins de ~90 px devant le bot.
        const nearFront = relEdge > -halfW && relEdge < halfW + 90;
        if (higher && nearFront) { platformAhead = true; break; }
      }
    }

    const blockedSide = !!(p.body && p.body.blocked && (p.body.blocked.left || p.body.blocked.right));
    if (onGround && (targetHigher || platformAhead || blockedSide)) {
      input.jump = true;
      // Garde l elan dans la direction de progression pour atterrir dessus.
      if (progressDir >= 0) input.right = true; else input.left = true;
    }

    this.player.handleMovement(input);

    // 5) ANTI-BLOCAGE #1 : stagnation de position (~0.3 s) -> impulsion.
    const moved = Math.abs(p.x - (this._aiPrevX ?? p.x)) + Math.abs(p.y - (this._aiPrevY ?? p.y));
    this._aiPrevX = p.x;
    this._aiPrevY = p.y;
    if (moved < 0.8) this._aiStall = (this._aiStall || 0) + 1;
    else this._aiStall = Math.max(0, (this._aiStall || 0) - 4);

    // 6) ANTI-BLOCAGE #2 (filet absolu) : cible plus haute non atteinte depuis
    //    trop longtemps -> glissee directe garantie vers le bonbon.
    if (targetHigher) this._aiFail = (this._aiFail || 0) + 1;
    else this._aiFail = 0;

    const stall = this._aiStall > 18;
    const failed = this._aiFail > 90;
    if (stall || failed) {
      const tdx = target.x - p.x;
      const tdy = target.y - p.y;
      const dist = Math.hypot(tdx, tdy) || 1;
      if (failed && p.setPosition) {
        const step = Math.min(dist, 9);
        p.setPosition(p.x + (tdx / dist) * step, p.y + (tdy / dist) * step);
        if (p.body && p.setVelocity) p.setVelocity(0, 0);
      } else if (p.body && typeof p.setVelocity === "function") {
        const dash = 380;
        const vx = (tdx / dist) * dash;
        const vy = tdy < -8 ? -Math.abs(GAME.PLAYER_JUMP) : (p.body.velocity ? p.body.velocity.y : 0);
        p.setVelocity(vx, vy);
      }
      if (this._aiStall > 36) this._aiStall = 0;
    }
  }

  /**
   * Retrouve la plateforme (corniche) situee sous un bonbon donne.
   * @param {Phaser.GameObjects.GameObject & {x:number,y:number}} candy
   * @returns {{x:number,y:number,tiles:number}|null}
   * @private
   */
  _ledgeUnderCandy(candy) {
    if (!this._ledges) return null;
    let best = null;
    let bestD = Infinity;
    for (const l of this._ledges) {
      const halfW = (l.tiles * 32) / 2;
      const withinX = candy.x >= l.x - halfW - 16 && candy.x <= l.x + halfW + 16;
      const above = Math.abs(candy.y - (l.y - 22)) < 36;
      if (withinX && above) {
        const d = Math.abs(candy.x - l.x);
        if (d < bestD) { bestD = d; best = l; }
      }
    }
    return best;
  }

  /**
   * Ouvre ou ferme le menu pause (ECHAP). En pause, la physique et le timer
   * sont suspendus ; le menu affiche le rappel des touches et un acces aux
   * reglages, plus un bouton Reprendre.
   * @returns {void}
   * @private
   */
  _togglePause() {
    if (this._ended) return;
    if (this._paused) {
      this._closePauseMenu();
    } else {
      this._openPauseMenu();
    }
  }

  /**
   * Suspend le jeu et construit le panneau de pause (overlay fixe a l ecran).
   * @returns {void}
   * @private
   */
  _openPauseMenu() {
    this._paused = true;
    this.physics.world.pause();
    if (this._timerEvent) this._timerEvent.paused = true;

    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(3000);

    // Voile sombre plein ecran.
    const veil = this.add.graphics();
    veil.fillStyle(0x000000, 0.72);
    veil.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT);
    container.add(veil);

    // Titre PAUSE.
    container.add(
      this.add
        .text(cx, cy - 150, "PAUSE", {
          fontFamily: "monospace",
          fontSize: "44px",
          fontStyle: "bold",
          color: ORANGE_STR,
        })
        .setOrigin(0.5),
    );

    // Rappel des touches.
    container.add(
      this.add
        .text(cx, cy - 90, "TOUCHES", {
          fontFamily: "monospace",
          fontSize: "18px",
          color: "#b06bf0",
        })
        .setOrigin(0.5),
    );
    const rows = [
      ["Gauche", KEYS.LEFT.join(" / ")],
      ["Droite", KEYS.RIGHT.join(" / ")],
      ["Saut", KEYS.JUMP.join(" / ")],
      ["Tir", KEYS.FIRE.join(" / ")],
      ["Pause", "ESC"],
    ];
    const startY = cy - 58;
    const lineH = 24;
    rows.forEach(([action, keys], i) => {
      const rowY = startY + i * lineH;
      container.add(
        this.add
          .text(cx - 16, rowY, action, {
            fontFamily: "monospace",
            fontSize: "15px",
            color: "#dddddd",
          })
          .setOrigin(1, 0),
      );
      container.add(
        this.add
          .text(cx + 16, rowY, keys, {
            fontFamily: "monospace",
            fontSize: "15px",
            fontStyle: "bold",
            color: "#ffffff",
          })
          .setOrigin(0, 0),
      );
    });

    // Boutons Reprendre / Reglages, puis Retour au menu en dessous.
    container.add(this._makeMenuButton(cx - 90, cy + 120, "REPRENDRE", 0x5a8f3a, () => this._closePauseMenu()));
    container.add(this._makeMenuButton(cx + 90, cy + 120, "RÉGLAGES", 0x5a2a82, () => this.scene.start("SettingsScene")));
    container.add(this._makeMenuButton(cx, cy + 164, "MENU", 0xb0532a, () => {
      // Reprend l etat (physique/timer) avant de quitter, puis retourne au menu.
      this._closePauseMenu();
      this.scene.start("LauncherScene");
    }));

    this._pauseMenu = container;
  }

  /**
   * Ferme le menu pause et reprend le jeu.
   * @returns {void}
   * @private
   */
  _closePauseMenu() {
    if (this._pauseMenu) {
      this._pauseMenu.destroy(true);
      this._pauseMenu = null;
    }
    this._paused = false;
    this.physics.world.resume();
    if (this._timerEvent) this._timerEvent.paused = false;
  }

  /**
   * Cree un bouton de menu (overlay) cliquable, renvoye comme conteneur a
   * ajouter au panneau de pause.
   * @param {number} x Centre X.
   * @param {number} y Centre Y.
   * @param {string} label Texte.
   * @param {number} color Couleur de fond (hex).
   * @param {() => void} onClick Action au clic.
   * @returns {Phaser.GameObjects.Container}
   * @private
   */
  _makeMenuButton(x, y, label, color, onClick) {
    const text = this.add
      .text(0, 0, label, {
        fontFamily: "monospace",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    const padX = 18;
    const padY = 10;
    const w = text.width + padX * 2;
    const h = text.height + padY * 2;
    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.lineStyle(2, 0xffffff, 0.4);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    const btn = this.add.container(x, y, [bg, text]).setScrollFactor(0);
    btn.setSize(w, h);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setAlpha(0.85));
    btn.on("pointerout", () => btn.setAlpha(1));
    btn.on("pointerdown", onClick);
    return btn;
  }

  /**
   * Termine la partie (une seule fois), construit le `GameResult` via
   * `computeScore` et lance GameOverScene (exigences 7.7, 10.1, 10.2).
   *
   * Le score utilise le dernier palier (50) comme référence de bonbons afin que
   * la formule reste cohérente sur l'ensemble de la progression.
   * @param {"win"|"lose"} outcome Issue de la partie.
   * @returns {void}
   */
  endGame(outcome) {
    if (this._ended) return;
    this._ended = true;

    // Credite les bonbons ramasses au profil du joueur (monnaie de customisation).
    let candyBalance = 0;
    try { candyBalance = addCandies(this.cfg.username, this.candiesCollected); } catch {}

    // Coupe la musique et joue l effet correspondant a l issue.
    if (this.audio) {
      this.audio.stopMusic();
      if (outcome === "win") this.audio.playVictory();
      else this.audio.playDeath();
    }

    if (this._timerEvent && typeof this._timerEvent.remove === "function") {
      this._timerEvent.remove(false);
      this._timerEvent = null;
    }

    const win = outcome === "win";
    const durationPlayed = GAME.TIMER_SECONDS - this.secondsRemaining;

    let score;        // score affiche sur l ecran de fin (celui de la manche)
    let scoreboardScore; // total envoye au tableau des scores
    let candiesRemaining;

    if (this._levelMode) {
      // Score du NIVEAU courant : cible specifique au niveau.
      candiesRemaining = win ? 0 : Math.max(0, this.candyTarget - this.candiesCollected);
      score = computeScore({ candiesRemaining, secondsRemaining: this.secondsRemaining }) + (this._comboBonus || 0);
      // Enregistre le meilleur score du niveau + deblocage si victoire.
      let prof;
      try {
        prof = recordLevelResult(this.cfg.username, this._levelIndex, score, win);
      } catch { prof = null; }
      // Total = somme des meilleurs scores de tous les niveaux (va au scoreboard).
      scoreboardScore = prof
        ? (prof.levelBest || []).reduce((a, b) => a + (b || 0), 0)
        : score;
    } else {
      // Mode classique a 3 paliers (repli) : score de la partie.
      const finalTarget = CANDY_TIERS.reduce((a, b) => a + b, 0);
      candiesRemaining = win ? 0 : Math.max(0, finalTarget - this.candiesCollected);
      score = computeScore({ candiesRemaining, secondsRemaining: this.secondsRemaining });
      scoreboardScore = score;
    }

    /** @type {object} GameResult transmis à GameOverScene. */
    const result = {
      username: this.cfg.username,
      skin: this.cfg.skin,
      color: this.cfg.color,
      accessories: this.cfg.accessories,
      candies: candyBalance,
      outcome,
      candiesCollected: this.candiesCollected,
      candiesRemaining,
      secondsRemaining: this.secondsRemaining,
      durationPlayed,
      score,                    // score du niveau (affiche)
      scoreboardScore,          // total a enregistrer au scoreboard
      levelMode: this._levelMode,
      levelIndex: this._levelIndex,
    };

    this.scene.start("GameOverScene", result);
  }

  /**
   * Libère le timer périodique à l'arrêt de la scène. Idempotent.
   * @returns {void}
   * @private
   */
  _teardown() {
    if (this._timerEvent && typeof this._timerEvent.remove === "function") {
      this._timerEvent.remove(false);
    }
    this._timerEvent = null;
  }
}
