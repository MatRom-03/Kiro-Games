// frontend/src/systems/AudioEngine.js
//
// Moteur audio 100 % procedural (Web Audio API) : aucune ressource reseau.
// Fournit une musique de fond en boucle sur le theme d'Halloween et des
// effets ponctuels (perte de coeur, mort, victoire finale).
//
// L'etat « son coupe » (mute) est partage avec le reste du jeu via le meme
// stockage que le SoundManager : on relit la preference au besoin.

import { loadPersistedMute } from "./mutePersistence.js";

/**
 * Convertit un numero de demi-ton (par rapport au A4 = 440 Hz) en frequence.
 * @param {number} semitonesFromA4
 * @returns {number} Frequence en Hz.
 */
function freq(semitonesFromA4) {
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

/**
 * Moteur audio du jeu. Instancie un seul `AudioContext`, gere un noeud de
 * volume maitre (coupe par le mute) et planifie une boucle musicale ainsi que
 * des effets sonores synthetises.
 */
export default class AudioEngine {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    /** @type {GainNode|null} Volume maitre (0 si mute). */
    this.master = null;
    /** @type {GainNode|null} Sous-mix de la musique. */
    this.musicGain = null;
    /** @type {boolean} Musique en cours de lecture. */
    this._musicOn = false;
    /** @type {number} Index de la note courante de la boucle. */
    this._step = 0;
    /** @type {number|null} Timer de planification de la musique. */
    this._loopTimer = null;
    /** @type {boolean} */
    this._muted = loadPersistedMute();
  }

  /**
   * Cree (si besoin) et renvoie l'AudioContext, en le reprenant s'il a ete
   * suspendu par la politique d'autoplay du navigateur. Doit etre appele a la
   * suite d'une interaction utilisateur pour demarrer le son.
   * @returns {AudioContext|null}
   * @private
   */
  _ensureContext() {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.35;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Applique l'etat mute : coupe/retablit le volume maitre.
   * @param {boolean} muted
   * @returns {void}
   */
  setMuted(muted) {
    this._muted = !!muted;
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this._muted ? 0 : 0.6, now, 0.05);
    }
  }

  /**
   * Joue une note synthetisee simple (oscillateur + enveloppe ADSR courte).
   * @param {object} opts
   * @param {number} opts.frequency Frequence en Hz.
   * @param {number} opts.duration Duree en secondes.
   * @param {OscillatorType} [opts.type="triangle"] Forme d'onde.
   * @param {number} [opts.gain=0.3] Gain crete.
   * @param {GainNode} [opts.dest] Noeud de destination (defaut: master).
   * @param {number} [opts.when=0] Delai avant le debut (s).
   * @returns {void}
   * @private
   */
  _note({ frequency, duration, type = "triangle", gain = 0.3, dest, when = 0 }) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t0);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env);
    env.connect(dest || this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /**
   * Demarre la musique de fond en boucle (si pas deja active). Melodie en la
   * mineur / phrygien, lente et lugubre, avec une basse pulsee.
   * @returns {void}
   */
  startMusic() {
    if (!this._ensureContext()) return;
    if (this._musicOn) return;
    this._musicOn = true;
    this._step = 0;

    // Theme : la mineur harmonique, motif descendant « spooky ».
    // Demi-tons par rapport au A4. Octave medium pour la melodie.
    const melody = [0, 3, 7, 8, 7, 3, 0, -2, 0, 3, 7, 11, 10, 7, 3, 0];
    const bassPattern = [-24, -24, -17, -17, -22, -22, -24, -24];
    const stepMs = 300; // tempo lent

    const tick = () => {
      if (!this._musicOn || !this.ctx) return;
      const i = this._step % melody.length;
      // Melodie.
      this._note({
        frequency: freq(melody[i]),
        duration: 0.28,
        type: "triangle",
        gain: 0.25,
        dest: this.musicGain,
      });
      // Basse une fois sur deux.
      if (this._step % 2 === 0) {
        const b = bassPattern[(this._step / 2) % bassPattern.length | 0];
        this._note({
          frequency: freq(b),
          duration: 0.5,
          type: "sawtooth",
          gain: 0.18,
          dest: this.musicGain,
        });
      }
      // Petit « cloche » dissonant toutes les 8 notes pour l'ambiance.
      if (i === 0) {
        this._note({
          frequency: freq(13),
          duration: 0.6,
          type: "sine",
          gain: 0.12,
          dest: this.musicGain,
        });
      }
      this._step += 1;
      this._loopTimer = setTimeout(tick, stepMs);
    };
    tick();
  }

  /**
   * Arrete la musique de fond.
   * @returns {void}
   */
  stopMusic() {
    this._musicOn = false;
    if (this._loopTimer) {
      clearTimeout(this._loopTimer);
      this._loopTimer = null;
    }
  }

  /**
   * Effet « perte de coeur » : court bruit descendant, sec.
   * @returns {void}
   */
  playHurt() {
    if (!this._ensureContext()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.18);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(env);
    env.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  /**
   * Effet « mort » : chute grave plus longue, lugubre.
   * @returns {void}
   */
  playDeath() {
    if (!this._ensureContext()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.9);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    osc.connect(env);
    env.connect(this.master);
    osc.start(t);
    osc.stop(t + 1.05);
    // Deuxieme voix pour l'effet « plainte ».
    this._note({ frequency: freq(-12), duration: 1.0, type: "triangle", gain: 0.18, when: 0.05 });
  }

  /**
   * Effet « victoire finale » (3 manches reussies) : petite fanfare ascendante.
   * @returns {void}
   */
  playVictory() {
    if (!this._ensureContext()) return;
    // Arpege majeur ascendant joyeux (do - mi - sol - do).
    const notes = [3, 7, 10, 15, 19];
    notes.forEach((n, i) => {
      this._note({
        frequency: freq(n),
        duration: 0.3,
        type: "triangle",
        gain: 0.3,
        when: i * 0.12,
      });
    });
    // Accord final tenu.
    this._note({ frequency: freq(15), duration: 0.8, type: "sine", gain: 0.22, when: 0.6 });
    this._note({ frequency: freq(19), duration: 0.8, type: "sine", gain: 0.18, when: 0.6 });
  }
}
