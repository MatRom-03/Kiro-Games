/**
 * Point d'entrée du frontend : configure le jeu Phaser et enregistre les
 * scènes dans l'ordre du flux (Boot -> Preload -> Launcher -> Game ->
 * GameOver -> Scoreboard -> Settings).
 */
import Phaser from "phaser";
import { GAME } from "./config/gameConstants.js";
import BootScene from "./scenes/BootScene.js";
import PreloadScene from "./scenes/PreloadScene.js";
import LauncherScene from "./scenes/LauncherScene.js";
import GameScene from "./scenes/GameScene.js";
import GameOverScene from "./scenes/GameOverScene.js";
import ScoreboardScene from "./scenes/ScoreboardScene.js";
import SettingsScene from "./scenes/SettingsScene.js";
import CustomSkinScene from "./scenes/CustomSkinScene.js";

/** @type {Phaser.Types.Core.GameConfig} */
const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  pixelArt: true, // rendu pixel art net
  backgroundColor: "#0b0014",
  physics: {
    default: "arcade",
    arcade: { gravity: { y: GAME.GRAVITY_Y }, debug: false },
  },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [
    BootScene,
    PreloadScene,
    LauncherScene,
    GameScene,
    GameOverScene,
    ScoreboardScene,
    SettingsScene,
    CustomSkinScene,
  ],
};

new Phaser.Game(config);
