/**
 * Constantes centrales de configuration du gameplay.
 * @readonly
 */
export const GAME = {
  WIDTH: 960,
  HEIGHT: 540,
  GRAVITY_Y: 900, // gravité verticale (px/s^2)
  PLAYER_SPEED: 220, // vitesse latérale (px/s)
  PLAYER_JUMP: 480, // vélocité de saut (px/s)
  PLAYER_HEARTS: 3, // cœurs de vie initiaux
  INVULN_MS: 1500, // durée d'invulnérabilité après contact (ms)
  INVULN_BLINK_MS: 120, // période de clignotement (ms)
  CANDIES_TO_WIN: 15, // bonbons à collecter pour gagner
  TIMER_SECONDS: 60, // compte à rebours par palier (s)
  PROJECTILE_SPEED: 420, // vitesse du bonbon magique (px/s)
  PROJECTILE_COOLDOWN_MS: 350, // délai entre deux tirs (ms)
  WITCH_SPEED: 80, // vitesse de patrouille (px/s)
  SCORE_PER_CANDY: 100, // points par bonbon restant
  SCORE_PER_SECOND: 50, // points par seconde restante
};

/**
 * Clés de contrôle clavier.
 * @readonly
 */
export const KEYS = {
  LEFT: ["LEFT", "Q"],
  RIGHT: ["RIGHT", "D"],
  JUMP: ["SPACE", "UP"],
  FIRE: ["F", "E"],
};
