import Phaser from "phaser";
import TextureFactory from "../gfx/TextureFactory.js";

/**
 * Génère toutes les textures procédurales avant d'entrer dans le launcher.
 * Aucune ressource réseau n'est chargée : tout est dessiné par code via
 * `TextureFactory`, puis enregistré dans le cache de textures de Phaser.
 * @extends Phaser.Scene
 */
export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  /**
   * Dessine et enregistre toutes les textures (fantômes blanc/noir, sorcière,
   * bonbon, bloc, projectile) puis passe au LauncherScene.
   * @returns {void}
   */
  create() {
    const f = new TextureFactory(this);
    f.makeGhost("white", "ghost_white");
    f.makeGhost("black", "ghost_black");
    f.makeWitch("witch");
    f.makeSkeleton("skeleton");
    f.makeVampire("vampire");
    f.makeBareTree("tree_bare");
    f.makeBat("bat");
    f.makeCandy("candy");
    f.makeTile("tile", 32);
    f.makeGroundTile("tile_witch", 32, "witch");
    f.makeGroundTile("tile_skeleton", 32, "skeleton");
    f.makeGroundTile("tile_vampire", 32, "vampire");
    f.makeBlockBody("body_witch", 32, "witch");
    f.makeBlockBody("body_skeleton", 32, "skeleton");
    f.makeBlockBody("body_vampire", 32, "vampire");
    f.makeSpectre("spectre");
    f.makePumpkinHead("pumpkinhead");
    // Variantes de sol/corps pour les niveaux 4 (marais) et 5 (citrouilles).
    f.makeGroundTile("tile_swamp", 32, "witch");
    f.makeGroundTile("tile_pumpkin", 32, "vampire");
    f.makeBlockBody("body_swamp", 32, "witch");
    f.makeBlockBody("body_pumpkin", 32, "vampire");
    f.makeTree("tree");
    f.makeGlow("glow");
    // Le projectile réutilise la texture du bonbon (bonbon magique lancé).
    f.makeCandy("projectile");

    this.scene.start("LauncherScene");
  }
}
