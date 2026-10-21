/**
 * Fantôme contrôlé par le joueur. Gère la physique « Mario » (déplacement
 * latéral, saut depuis une surface, gravité héritée de la scène),
 * l'invulnérabilité temporisée clignotante et le tir de projectiles de
 * bonbons magiques.
 *
 * Conception testable : toute la logique temporisée (`fire`, `takeDamage`,
 * `isInvulnerable`) est déléguée au module pur `playerLogic.js`, indépendant du
 * runtime Phaser et validé par des tests avec horloge mockée. La classe se
 * limite à relier cet état aux objets Phaser (vélocité, visibilité,
 * projectiles) via une source de temps unique `now()` (lit `scene.time.now`).
 *
 * @extends Phaser.Physics.Arcade.Sprite
 */
import Phaser from "phaser";
import { GAME } from "../config/gameConstants.js";
import {
  createPlayerState,
  isInvulnerable,
  applyDamage,
  registerFire,
  FIRE_COOLDOWN_MS,
} from "./playerLogic.js";

export { FIRE_COOLDOWN_MS };

export default class Player extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene Scène de jeu (fournit l'horloge et la physique).
   * @param {number} x Position initiale X.
   * @param {number} y Position initiale Y.
   * @param {"white"|"black"} skin Skin choisi ; détermine la clé de texture.
   */
  constructor(scene, x, y, skin, textureKey) {
    const resolvedKey = textureKey || (skin === "black" ? "ghost_black" : "ghost_white");
    super(scene, x, y, resolvedKey);

    /** @type {"white"|"black"} Skin esthétique courant. */
    this.skin = skin === "black" ? "black" : "white";

    /**
     * État de gameplay pur (cœurs, invulnérabilité, cooldown, direction).
     * @type {import("./playerLogic.js").PlayerState}
     * @private
     */
    this._state = createPlayerState();

    /**
     * Référence au minuteur de clignotement en cours (le cas échéant), afin de
     * pouvoir l'arrêter et de rétablir la visibilité à la fin de
     * l'invulnérabilité.
     * @type {Phaser.Time.TimerEvent|null}
     * @private
     */
    this._blinkEvent = null;

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

    if (this.body && typeof this.setCollideWorldBounds === "function") {
      this.setCollideWorldBounds(true);
    }
  }

  /** @returns {number} Cœurs de vie restants (0..PLAYER_HEARTS). */
  get hearts() {
    return this._state.hearts;
  }

  /** @param {number} value Nombre de cœurs (utilisé par la logique/les tests). */
  set hearts(value) {
    this._state.hearts = value;
  }

  /**
   * Direction horizontale courante : 1 = droite, -1 = gauche. Droite par
   * défaut tant que le joueur ne s'est pas déplacé (exigence 9.2).
   * @returns {1|-1}
   */
  get facing() {
    return this._state.facing;
  }

  /** @param {1|-1} value Nouvelle direction horizontale. */
  set facing(value) {
    this._state.facing = value;
  }

  /**
   * Source de temps unique de l'entité, en millisecondes. S'appuie sur
   * l'horloge de la scène Phaser (`scene.time.now`). Un repli sur `Date.now()`
   * évite les exceptions dans les contextes dépourvus d'horloge.
   * @returns {number} Horodatage courant en millisecondes.
   */
  now() {
    const t = this.scene && this.scene.time ? this.scene.time.now : undefined;
    return typeof t === "number" ? t : Date.now();
  }

  /**
   * Indique si le joueur est actuellement en invulnérabilité.
   * @returns {boolean} true tant que `now() < invulnUntil`.
   */
  get isInvulnerable() {
    return isInvulnerable(this._state, this.now());
  }

  /**
   * Met à jour le mouvement latéral et le saut selon l'état des touches.
   * - Gauche/droite : applique la vitesse latérale configurée et met à jour la
   *   direction courante (`facing`).
   * - Aucune touche latérale : vitesse horizontale nulle (direction conservée).
   * - Saut : appliqué uniquement si le joueur est en contact avec une surface
   *   (`body.blocked.down`) ; sinon la commande de saut est ignorée
   *   (exigences 4.1, 4.2).
   *
   * @param {{left?: boolean, right?: boolean, jump?: boolean}} input État des touches.
   * @returns {void}
   */
  handleMovement(input = {}) {
    const { left = false, right = false, jump = false } = input;

    if (left && !right) {
      this.facing = -1;
      this.setVelocityX(-GAME.PLAYER_SPEED);
      if (typeof this.setFlipX === "function") this.setFlipX(true);
    } else if (right && !left) {
      this.facing = 1;
      this.setVelocityX(GAME.PLAYER_SPEED);
      if (typeof this.setFlipX === "function") this.setFlipX(false);
    } else {
      this.setVelocityX(0);
    }

    const onSurface = !!(
      this.body &&
      this.body.blocked &&
      this.body.blocked.down
    );
    if (jump && onSurface) {
      this.setVelocityY(-GAME.PLAYER_JUMP);
    }
  }

  /**
   * Tire un projectile de bonbon dans la direction horizontale courante si le
   * cooldown (≥ 400 ms) est écoulé depuis le dernier tir. N'affecte jamais le
   * compteur des 15 bonbons (exigence 9.5/9.7). Le projectile ignore la
   * gravité (exigence 9.4) et se déplace à la vitesse horizontale configurée.
   *
   * @param {{get: Function}|Phaser.Physics.Arcade.Group} projectiles Groupe de
   *   projectiles exposant `get(x, y, key)` (API `Phaser.Physics.Arcade.Group`).
   * @returns {boolean} true si un projectile a été émis, false sinon.
   */
  fire(projectiles) {
    const now = this.now();
    const result = registerFire(this._state, now);
    if (!result.fired) {
      return false; // cooldown non écoulé : tir ignoré (exigence 9.3)
    }
    if (!projectiles || typeof projectiles.get !== "function") {
      return false;
    }

    const proj = projectiles.get(this.x, this.y, "projectile");
    if (!proj) {
      return false; // groupe épuisé : aucun tir, l'état n'est pas avancé
    }

    // Le tir est confirmé : on avance l'état (cooldown).
    this._state = result.state;

    if (typeof proj.setActive === "function") proj.setActive(true);
    if (typeof proj.setVisible === "function") proj.setVisible(true);
    if (proj.body) {
      // Les projectiles ignorent la gravité (exigence 9.4).
      if (typeof proj.body.setAllowGravity === "function") {
        proj.body.setAllowGravity(false);
      } else {
        proj.body.allowGravity = false;
      }
    }
    if (typeof proj.setVelocityX === "function") {
      proj.setVelocityX(result.direction * GAME.PROJECTILE_SPEED);
    }
    if (typeof proj.setVelocityY === "function") {
      proj.setVelocityY(0);
    }

    return true;
  }

  /**
   * Applique un dégât au contact d'une sorcière : retire 1 cœur (borné à 0) et
   * déclenche l'invulnérabilité clignotante pendant `INVULN_MS` (1,5 s).
   * Ignoré sans effet si le joueur est déjà invulnérable (exigence 7.4) :
   * le nombre de cœurs reste alors inchangé.
   *
   * @returns {number} Le nombre de cœurs restants après l'éventuel dégât.
   */
  takeDamage() {
    const result = applyDamage(this._state, this.now());
    this._state = result.state;
    if (result.damaged) {
      this._startBlink();
    }
    return this._state.hearts;
  }

  /**
   * Démarre le clignotement d'invulnérabilité : alternance visible/masqué à une
   * fréquence comprise entre 5 et 10 Hz (exigence 7.5), puis rétablit la
   * visibilité continue à la fin de la période (exigence 7.6).
   *
   * La demi-période de basculement est bornée dans [50, 100] ms, soit une
   * fréquence de cycles complets f = 1000 / (2 · demi-période) ∈ [5, 10] Hz.
   * @returns {void}
   * @private
   */
  _startBlink() {
    if (this._blinkEvent && typeof this._blinkEvent.remove === "function") {
      this._blinkEvent.remove(false);
      this._blinkEvent = null;
    }

    const halfPeriodMs = Math.min(100, Math.max(50, GAME.INVULN_BLINK_MS / 2));

    const timer = this.scene && this.scene.time;
    if (!timer || typeof timer.addEvent !== "function") {
      return; // pas d'horloge planifiable (contexte de test) : rien à animer
    }

    const repeat = Math.max(1, Math.round(GAME.INVULN_MS / halfPeriodMs));

    this._blinkEvent = timer.addEvent({
      delay: halfPeriodMs,
      repeat: repeat - 1,
      callback: () => {
        if (typeof this.setVisible === "function") {
          this.setVisible(!this.visible);
        }
        if (
          this._blinkEvent &&
          typeof this._blinkEvent.getRepeatCount === "function" &&
          this._blinkEvent.getRepeatCount() === 0
        ) {
          this._endBlink();
        }
      },
      callbackScope: this,
    });
  }

  /**
   * Arrête le clignotement et rétablit l'affichage continu du joueur
   * (exigence 7.6).
   * @returns {void}
   * @private
   */
  _endBlink() {
    if (this._blinkEvent && typeof this._blinkEvent.remove === "function") {
      this._blinkEvent.remove(false);
    }
    this._blinkEvent = null;
    if (typeof this.setVisible === "function") {
      this.setVisible(true);
    }
  }
}
