import Phaser from "phaser";
// La logique de persistance du mute vit dans un module sans dépendance Phaser
// afin d'être testable en Node. On la ré-exporte ici pour conserver l'API
// historique de BootScene (imports existants inchangés).
import {
  MUTE_STORAGE_KEY,
  loadPersistedMute,
} from "../systems/mutePersistence.js";

export { MUTE_STORAGE_KEY, loadPersistedMute };

/**
 * Première scène du flux : effectue la configuration initiale, applique l'état
 * du son persisté (mute) puis bascule immédiatement vers PreloadScene, qui
 * génère les textures procédurales.
 *
 * Aucune ressource réseau n'est chargée ici : la préparation graphique est
 * entièrement déléguée à PreloadScene.
 * @extends Phaser.Scene
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  /**
   * Applique les réglages persistés (son coupé) et passe à PreloadScene.
   * @returns {void}
   */
  create() {
    // Restaure la préférence de son du joueur dès le démarrage.
    this.sound.mute = loadPersistedMute();

    this.scene.start("PreloadScene");
  }
}
