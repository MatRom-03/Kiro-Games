// frontend/src/systems/SoundManager.js
import {
  MUTE_STORAGE_KEY,
  loadPersistedMute,
  persistMute,
} from "./mutePersistence.js";

// Ré-exportés pour commodité : les consommateurs du SoundManager peuvent
// accéder à la clé et aux helpers de persistance depuis un seul module.
export { MUTE_STORAGE_KEY, loadPersistedMute, persistMute };

/**
 * Gestion globale du son du jeu : expose une bascule mute/unmute dont l'état
 * est appliqué au gestionnaire de son de Phaser et persisté dans
 * `localStorage` (clé partagée avec {@link BootScene}) pour être restauré
 * d'une session à l'autre.
 *
 * L'état initial est lu depuis le stockage via {@link loadPersistedMute} ;
 * si un jeu Phaser est fourni, il est immédiatement synchronisé.
 */
export default class SoundManager {
  /**
   * @param {Phaser.Game} [game] Instance Phaser dont `game.sound.mute` est piloté.
   */
  constructor(game = null) {
    /** @type {Phaser.Game|null} */
    this.game = game;
    /** @type {boolean} */
    this._muted = loadPersistedMute();
    this._applyToGame();
  }

  /**
   * Indique si le son est actuellement coupé.
   * @returns {boolean}
   */
  isMuted() {
    return this._muted;
  }

  /**
   * Définit l'état « son coupé », l'applique au jeu Phaser et le persiste.
   * @param {boolean} muted true pour couper le son, false pour le réactiver.
   * @returns {boolean} Le nouvel état (après coercition en booléen).
   */
  setMuted(muted) {
    this._muted = Boolean(muted);
    this._applyToGame();
    persistMute(this._muted);
    return this._muted;
  }

  /**
   * Bascule l'état du son (coupé ↔ actif).
   * @returns {boolean} Le nouvel état après bascule.
   */
  toggle() {
    return this.setMuted(!this._muted);
  }

  /**
   * Associe (ou remplace) l'instance Phaser pilotée puis la synchronise sur
   * l'état courant. Utile lorsque le gestionnaire est créé avant le jeu.
   * @param {Phaser.Game} game
   * @returns {void}
   */
  attachGame(game) {
    this.game = game;
    this._applyToGame();
  }

  /**
   * Reporte l'état courant sur `game.sound.mute` si un jeu est attaché.
   * @private
   * @returns {void}
   */
  _applyToGame() {
    if (this.game && this.game.sound) {
      this.game.sound.mute = this._muted;
    }
  }
}
