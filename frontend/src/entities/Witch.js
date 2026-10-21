/**
 * Sorcière ennemie qui patrouille horizontalement sur sa plateforme entre une
 * borne gauche (`patrolMin`) et une borne droite (`patrolMax`) à la vitesse
 * `GAME.WITCH_SPEED`, et inverse sa direction aux bornes (exigences 8.1, 8.2).
 * Elle peut être détruite par un projectile via `defeat`.
 *
 * Conception testable : la règle d'inversion de direction est déléguée au
 * module pur `witchLogic.js`, indépendant du runtime Phaser et validé par des
 * tests. La classe se limite à relier cet état aux objets Phaser (position,
 * vélocité, flip, destruction).
 *
 * @extends Phaser.Physics.Arcade.Sprite
 */
import Phaser from "phaser";
import { GAME } from "../config/gameConstants.js";
import { createWitchState, stepPatrol } from "./witchLogic.js";

export default class Witch extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene Scène de jeu (fournit la physique).
   * @param {number} x Position initiale X.
   * @param {number} y Position initiale Y.
   * @param {number} patrolMin Borne gauche de patrouille (px).
   * @param {number} patrolMax Borne droite de patrouille (px).
   */
  constructor(scene, x, y, patrolMin, patrolMax, textureKey = "witch") {
    super(scene, x, y, textureKey);

    /**
     * État de patrouille pur (bornes normalisées + direction courante).
     * @type {import("./witchLogic.js").WitchState}
     * @private
     */
    this._state = createWitchState(patrolMin, patrolMax);

    // Enregistrement dans la scène et le moteur physique (si disponibles).
    if (scene.add && typeof scene.add.existing === "function") {
      scene.add.existing(this);
    }
    if (
      scene.physics &&
      scene.physics.add &&
      typeof scene.physics.add.existing === "function"
    ) {
      scene.physics.add.existing(this);
    }

    // La sorcière patrouille sur sa plateforme : pas de chute hors trajectoire,
    // pas de poussée hors de ses bornes par les collisions.
    if (this.body) {
      if (typeof this.body.setAllowGravity === "function") {
        this.body.setAllowGravity(false);
      } else {
        this.body.allowGravity = false;
      }
      // Non immovable : la collision avec le relief le stoppe et met a jour
      // body.blocked (utilise pour faire demi-tour). Gravite desactivee ci-dessus.
      if (typeof this.setImmovable === "function") {
        this.setImmovable(false);
      }
    }

    // Applique la vélocité initiale conforme à la direction de départ.
    this._applyVelocity(this._state.direction);
  }

  /** @returns {number} Borne gauche de patrouille (px). */
  get patrolMin() {
    return this._state.patrolMin;
  }

  /** @returns {number} Borne droite de patrouille (px). */
  get patrolMax() {
    return this._state.patrolMax;
  }

  /**
   * Direction horizontale courante : 1 = droite, -1 = gauche.
   * @returns {1|-1}
   */
  get direction() {
    return this._state.direction;
  }

  /**
   * Met à jour la patrouille horizontale : inverse la direction si une borne de
   * patrouille est atteinte (exigences 8.1, 8.2) puis applique la vélocité
   * correspondante à la vitesse `GAME.WITCH_SPEED`. À appeler à chaque frame
   * depuis `GameScene.update`.
   *
   * @returns {void}
   */
  patrol() {
    // Inversion aux bornes de patrouille (logique pure).
    const result = stepPatrol(this._state, this.x);
    this._state = result.state;
    let dir = result.direction;

    // Inversion si la montagne/mur bloque le deplacement : l ennemi ne traverse
    // jamais le relief, il fait demi-tour.
    const b = this.body;
    if (b && b.blocked) {
      if (b.blocked.right && dir === 1) dir = -1;
      else if (b.blocked.left && dir === -1) dir = 1;
      this._state = { ...this._state, direction: dir };
    }

    this._applyVelocity(dir);
  }

  /**
   * Applique la vélocité horizontale et oriente le sprite selon la direction.
   * @param {1|-1} direction Direction de déplacement.
   * @returns {void}
   * @private
   */
  _applyVelocity(direction) {
    const speed = typeof this.patrolSpeed === "number" ? this.patrolSpeed : GAME.WITCH_SPEED;
    if (typeof this.setVelocityX === "function") {
      this.setVelocityX(direction * speed);
    }
    if (typeof this.setFlipX === "function") {
      // Le sprite de référence « regarde » vers la gauche ; on retourne quand
      // la sorcière se dirige vers la droite.
      this.setFlipX(direction === 1);
    }
  }

  /**
   * Détruit la sorcière au contact d'un projectile (exigence 9.5). Déclenche un
   * bref effet visuel de disparition lorsque la scène dispose d'un gestionnaire
   * de tweens, puis retire définitivement l'entité (et son corps physique) du
   * jeu.
   *
   * @returns {void}
   */
  defeat() {
    // Stoppe immédiatement le mouvement et désactive la physique pour éviter
    // toute collision résiduelle pendant l'effet de disparition.
    if (this.body) {
      if (typeof this.setVelocity === "function") {
        this.setVelocity(0, 0);
      }
      if (typeof this.body.enable === "boolean") {
        this.body.enable = false;
      }
    }

    const tweens = this.scene && this.scene.tweens;
    if (tweens && typeof tweens.add === "function") {
      tweens.add({
        targets: this,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: 150,
        onComplete: () => this.destroy(),
      });
      return;
    }

    // Pas de gestionnaire de tweens (contexte de test) : destruction immédiate.
    this.destroy();
  }
}
