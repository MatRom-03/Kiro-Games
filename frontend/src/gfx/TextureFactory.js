/**
 * Fabrique de textures procédurales. Chaque méthode dessine une forme via un
 * objet `Phaser.GameObjects.Graphics` puis l'enregistre comme texture
 * réutilisable dans le cache Phaser (`generateTexture`). Aucune ressource
 * graphique réseau n'est chargée : tout est dessiné par code.
 *
 * Palette d'Halloween :
 * - Fantôme blanc : silhouette claire, contour discret, yeux orange.
 * - Fantôme noir  : silhouette sombre, contour violet, yeux orange.
 * - Sorcière      : chapeau pointu violet, robe sombre, balai, teint verdâtre.
 * - Bonbon        : bonbon enveloppé orange/violet (sert aussi de projectile).
 * - Bloc          : pierre sombre avec mousse verte (sol/plateforme).
 */
export class TextureFactory {
  /**
   * @param {Phaser.Scene} scene Scène active (accès au cache de textures).
   */
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Crée un objet Graphics jetable rattaché à la scène courante.
   * @returns {Phaser.GameObjects.Graphics}
   * @private
   */
  _graphics() {
    return this.scene.make.graphics({ x: 0, y: 0, add: false });
  }

  /**
   * Génère la texture du fantôme pour un skin donné.
   * Dessine une silhouette arrondie avec un bas ondulé, deux yeux orange et
   * une petite bouche. La couleur de remplissage est paramétrée par le skin.
   * @param {"white"|"black"} skin Variante de couleur.
   * @param {string} key Clé de texture (ex: "ghost_white", "ghost_black").
   * @returns {void}
   */
  makeGhost(skin, key) {
    const W = 40;
    const H = 48;
    const g = this._graphics();

    const isBlack = skin === "black";
    const body = isBlack ? 0x1a1a24 : 0xf4f4ff;
    const outline = isBlack ? 0x6a3fb0 : 0xbfbfe0;
    const eye = 0xff8c1a; // orange Halloween
    const pupil = isBlack ? 0xffd27f : 0x3a2200;

    // Contour (dessiné légèrement plus large sous le corps pour un liseré).
    g.fillStyle(outline, 1);
    this._ghostSilhouette(g, 1, 1, W - 2, H - 2);

    // Corps.
    g.fillStyle(body, 1);
    this._ghostSilhouette(g, 3, 3, W - 6, H - 6);

    // Yeux orange.
    g.fillStyle(eye, 1);
    g.fillCircle(W * 0.37, H * 0.42, 5);
    g.fillCircle(W * 0.63, H * 0.42, 5);

    // Pupilles.
    g.fillStyle(pupil, 1);
    g.fillCircle(W * 0.37, H * 0.42, 2);
    g.fillCircle(W * 0.63, H * 0.42, 2);

    // Petite bouche ovale.
    g.fillStyle(eye, 1);
    g.fillEllipse(W * 0.5, H * 0.62, 7, 9);

    g.generateTexture(key, W, H);
    g.destroy();
  }

  /**
   * Dessine la silhouette d'un fantôme (tête arrondie + bas ondulé) dans la
   * boîte englobante (ox, oy, w, h).
   * @param {Phaser.GameObjects.Graphics} g
   * @param {number} ox Origine X.
   * @param {number} oy Origine Y.
   * @param {number} w Largeur.
   * @param {number} h Hauteur.
   * @returns {void}
   * @private
   */
  _ghostSilhouette(g, ox, oy, w, h) {
    const r = w / 2;
    const cx = ox + r;
    const headCy = oy + r;

    // Tête (demi-cercle supérieur) + corps rectangulaire.
    g.fillCircle(cx, headCy, r);
    g.fillRect(ox, headCy, w, h - r - r * 0.45);

    // Bas ondulé : série de festons.
    const waves = 4;
    const waveW = w / waves;
    const waveR = waveW / 2;
    const baseY = oy + h - r * 0.45;
    for (let i = 0; i < waves; i++) {
      g.fillCircle(ox + waveR + i * waveW, baseY, waveR);
    }
  }

  /**
   * Génère la texture de la sorcière : chapeau pointu, visage verdâtre, robe
   * sombre et balai.
   * @param {string} key Clé de texture (ex: "witch").
   * @returns {void}
   */
  makeWitch(key) {
    const W = 40;
    const H = 52;
    const g = this._graphics();

    const hat = 0x5a2a82; // violet
    const hatBand = 0xff8c1a; // bande orange
    const face = 0x7fb069; // vert
    const robe = 0x24122e; // robe sombre
    const broomStick = 0x8a5a2b; // manche marron
    const broomBristle = 0xe0b84a; // paille

    // Balai (diagonale derrière la sorcière).
    g.lineStyle(3, broomStick, 1);
    g.beginPath();
    g.moveTo(4, H - 4);
    g.lineTo(W - 4, 20);
    g.strokePath();
    g.fillStyle(broomBristle, 1);
    g.fillTriangle(2, H - 2, 10, H - 10, 12, H - 1);

    // Robe (trapèze : épaules étroites, bas large).
    g.fillStyle(robe, 1);
    g.fillTriangle(W * 0.5, 24, W * 0.12, H - 2, W * 0.88, H - 2);
    g.fillRect(W * 0.32, 22, W * 0.36, 8);

    // Visage (vert).
    g.fillStyle(face, 1);
    g.fillCircle(W * 0.5, 18, 8);

    // Yeux.
    g.fillStyle(0x1a1a24, 1);
    g.fillCircle(W * 0.44, 17, 1.6);
    g.fillCircle(W * 0.56, 17, 1.6);

    // Chapeau pointu : bord + cône.
    g.fillStyle(hat, 1);
    g.fillEllipse(W * 0.5, 11, 30, 7); // bord
    g.fillTriangle(W * 0.5, -6, W * 0.3, 11, W * 0.7, 11); // cône
    g.fillStyle(hatBand, 1);
    g.fillRect(W * 0.33, 8, W * 0.34, 3); // bande

    g.generateTexture(key, W, H);
    g.destroy();
  }

  /**
   * Génère la texture d'un bonbon (collectible et projectile) : noyau rond
   * enveloppé avec deux ailettes torsadées.
   * @param {string} key Clé de texture (ex: "candy").
   * @returns {void}
   */
  makeCandy(key) {
    const W = 24;
    const H = 16;
    const g = this._graphics();

    const wrap = 0xff8c1a; // orange
    const core = 0xe03fb0; // rose/violet
    const shine = 0xffe6c7; // reflet

    const cx = W / 2;
    const cy = H / 2;

    // Ailettes (triangles torsadés aux extrémités).
    g.fillStyle(wrap, 1);
    g.fillTriangle(0, 1, 0, H - 1, 8, cy);
    g.fillTriangle(W, 1, W, H - 1, W - 8, cy);

    // Noyau central.
    g.fillStyle(core, 1);
    g.fillCircle(cx, cy, 6);

    // Enveloppe (anneau orange autour du noyau).
    g.lineStyle(2, wrap, 1);
    g.strokeCircle(cx, cy, 6);

    // Reflet.
    g.fillStyle(shine, 1);
    g.fillCircle(cx - 2, cy - 2, 1.6);

    g.generateTexture(key, W, H);
    g.destroy();
  }

  /**
   * Génère la texture d'un bloc de sol/plateforme d'Halloween : pierre sombre
   * avec joints et touffes de mousse verte sur le dessus.
   * @param {string} key Clé de texture (ex: "tile").
   * @param {number} tileSize Taille d'une tuile en px (bloc carré).
   * @returns {void}
   */
  makeTile(key, tileSize) {
    const S = tileSize;
    const g = this._graphics();

    const stone = 0x3a3350; // pierre violacée sombre
    const stoneLight = 0x4a4466; // nuance claire
    const joint = 0x241f36; // joints sombres
    const moss = 0x5a8f3a; // mousse verte

    // Base pierre.
    g.fillStyle(stone, 1);
    g.fillRect(0, 0, S, S);

    // Nuances claires (quelques pavés).
    g.fillStyle(stoneLight, 1);
    g.fillRect(2, 2, S / 2 - 3, S / 2 - 3);
    g.fillRect(S / 2 + 1, S / 2 + 1, S / 2 - 3, S / 2 - 3);

    // Joints en croix.
    g.fillStyle(joint, 1);
    g.fillRect(0, S / 2 - 1, S, 2);
    g.fillRect(S / 2 - 1, 0, 2, S);

    // Bordure.
    g.lineStyle(2, joint, 1);
    g.strokeRect(1, 1, S - 2, S - 2);

    // Mousse sur le dessus.
    g.fillStyle(moss, 1);
    g.fillRect(0, 0, S, 3);
    g.fillCircle(S * 0.25, 3, 3);
    g.fillCircle(S * 0.6, 2, 2.5);
    g.fillCircle(S * 0.85, 3, 2);

    g.generateTexture(key, S, S);
    g.destroy();
  }

  /**
   * Genere une tuile de sol/plateforme THEMATIQUE selon le palier.
   * variant: "witch" (pierre violacee + mousse verte),
   *          "skeleton" (pierre glacee bleutee + givre blanc),
   *          "vampire" (pierre rouge sombre + coulures de sang).
   * @param {string} key
   * @param {number} tileSize
   * @param {"witch"|"skeleton"|"vampire"} variant
   * @returns {void}
   */
  makeGroundTile(key, tileSize, variant) {
    const S = tileSize;
    const g = this._graphics();

    // Palettes par variante.
    const palettes = {
      witch: { stone: 0x332d49, light: 0x413a5c, dark: 0x262038, top: 0x5a8f3a, top2: 0x3f6b28 },
      skeleton: { stone: 0x2f3e52, light: 0x3c5070, dark: 0x1f2b3a, top: 0xdbeaf5, top2: 0x9fc4de },
      vampire: { stone: 0x3a1618, light: 0x4e1f22, dark: 0x260c0e, top: 0x8a0d14, top2: 0x5a080c },
    };
    const p = palettes[variant] || palettes.witch;

    // PRNG deterministe (meme rendu a chaque generation).
    let seed = 1337;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    // Base pierre pleine (aucun contour : les tuiles se raccordent).
    g.fillStyle(p.stone, 1);
    g.fillRect(0, 0, S, S);

    // Mouchetures claires et sombres reparties aleatoirement pour une texture
    // organique, sans motif carre ni joints en croix.
    for (let i = 0; i < 26; i++) {
      const x = rnd() * S;
      const y = 5 + rnd() * (S - 6);
      const r = 0.8 + rnd() * 1.8;
      g.fillStyle(rnd() < 0.5 ? p.light : p.dark, 0.6);
      g.fillCircle(x, y, r);
    }

    // Bande de surface continue (traverse toute la largeur => se raccorde
    // entre tuiles) avec une legere ondulation du bord inferieur.
    g.fillStyle(p.top2, 1);
    g.fillRect(0, 0, S, 6);
    g.fillStyle(p.top, 1);
    g.fillRect(0, 0, S, 4);

    // Accent thematique sur la surface (reparti, non aligne sur une grille).
    if (variant === "skeleton") {
      // Givre : petites stalactites de glace qui pendent du liseré.
      g.fillStyle(p.top, 1);
      for (let i = 0; i < 3; i++) {
        const x = (i + 0.3 + rnd() * 0.4) * (S / 3);
        const h = 4 + rnd() * 7;
        g.fillTriangle(x - 2, 5, x + 2, 5, x, 5 + h);
      }
    } else if (variant === "vampire") {
      // Coulures de sang depuis la surface.
      g.fillStyle(p.top, 1);
      for (let i = 0; i < 3; i++) {
        const x = (i + 0.2 + rnd() * 0.5) * (S / 3);
        const h = 5 + rnd() * 9;
        g.fillRect(x - 1, 5, 2.2, h);
        g.fillCircle(x, 5 + h, 2.2);
      }
    } else {
      // Mousse verte : touffes irregulieres sur le liseré.
      g.fillStyle(p.top, 1);
      for (let i = 0; i < 4; i++) {
        const x = rnd() * S;
        g.fillCircle(x, 4 + rnd() * 2, 1.6 + rnd() * 1.8);
      }
    }

    g.generateTexture(key, S, S);
    g.destroy();
  }
  /**
   * Genere une tuile de CORPS de bloc (pierre thematique sans le liseré de
   * surface) : utilisee pour l interieur des buttes qui sortent du sol.
   * @param {string} key
   * @param {number} tileSize
   * @param {"witch"|"skeleton"|"vampire"} variant
   * @returns {void}
   */
  makeBlockBody(key, tileSize, variant) {
    const S = tileSize;
    const g = this._graphics();
    const palettes = {
      witch: { stone: 0x332d49, light: 0x413a5c, dark: 0x262038 },
      skeleton: { stone: 0x2f3e52, light: 0x3c5070, dark: 0x1f2b3a },
      vampire: { stone: 0x3a1618, light: 0x4e1f22, dark: 0x260c0e },
    };
    const p = palettes[variant] || palettes.witch;
    let seed = 7919;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    g.fillStyle(p.stone, 1);
    g.fillRect(0, 0, S, S);
    for (let k = 0; k < 24; k++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 0.8 + rnd() * 1.8;
      g.fillStyle(rnd() < 0.5 ? p.light : p.dark, 0.5);
      g.fillCircle(x, y, r);
    }
    g.generateTexture(key, S, S);
    g.destroy();
  }

  /**
   * Génère la texture d'un arbre mort d'Halloween : tronc sombre et houppier
   * dépouillé en silhouette. Pensé pour le décor de fond (parallax), avec des
   * tons sombres pour créer de la profondeur sans attirer l'œil.
   * @param {string} key Clé de texture (ex: "tree").
   * @returns {void}
   */
  makeTree(key) {
    const W = 120;
    const H = 200;
    const g = this._graphics();

    const trunk = 0x3a2b4d; // tronc violet, plus clair
    const trunkEdge = 0x241a2e;
    const foliage = 0x322247; // houppier, plus visible
    const foliageHi = 0x4a3568; // nuance claire marquee

    const cx = W / 2;

    // Tronc : trapèze large à la base.
    g.fillStyle(trunk, 1);
    g.fillTriangle(cx - 16, H, cx - 7, H * 0.42, cx - 9, H);
    g.fillRect(cx - 10, H * 0.42, 20, H * 0.58);
    g.fillStyle(trunkEdge, 1);
    g.fillRect(cx + 4, H * 0.42, 6, H * 0.58);

    // Branches nues qui montent en V.
    g.lineStyle(6, trunk, 1);
    g.beginPath();
    g.moveTo(cx, H * 0.55);
    g.lineTo(cx - 34, H * 0.3);
    g.moveTo(cx, H * 0.5);
    g.lineTo(cx + 34, H * 0.26);
    g.moveTo(cx, H * 0.6);
    g.lineTo(cx - 20, H * 0.42);
    g.strokePath();

    // Houppier : amas de cercles sombres formant une masse touffue.
    const blobs = [
      [cx, H * 0.24, 46],
      [cx - 34, H * 0.3, 32],
      [cx + 34, H * 0.28, 34],
      [cx - 14, H * 0.14, 30],
      [cx + 18, H * 0.16, 28],
    ];
    g.fillStyle(foliage, 1);
    for (const [bx, by, r] of blobs) g.fillCircle(bx, by, r);
    g.fillStyle(foliageHi, 1);
    g.fillCircle(cx - 8, H * 0.2, 16);
    g.fillCircle(cx + 20, H * 0.22, 12);

    g.generateTexture(key, W, H);
    g.destroy();
  }

  /**
   * Genere une texture de halo lumineux radial (degrade du centre clair vers
   * des bords transparents). Utilisee en fond, derriere les arbres, pour creer
   * un effet de clair de lune et detacher les silhouettes (ombres portees).
   * @param {string} key Cle de texture (ex: "glow").
   * @param {number} [size=256] Diametre de la texture en px.
   * @param {number} [color=0xffe8b0] Couleur centrale du halo (lune chaude).
   * @returns {void}
   */
  makeGlow(key, size = 256, color = 0xffe8b0) {
    const g = this._graphics();
    const c = size / 2;
    const steps = 28;
    for (let i = steps; i >= 1; i--) {
      const t = i / steps;
      const radius = (c * i) / steps;
      const alpha = Math.pow(1 - t, 2) * 0.9;
      g.fillStyle(color, alpha);
      g.fillCircle(c, c, radius);
    }
    g.generateTexture(key, size, size);
    g.destroy();
  }

  /**
   * Genere la texture d un fantome personnalise : silhouette (blanc/noir) +
   * accessoires equipes (chapeau haut-de-forme, lunettes). Reutilise le dessin
   * de base du fantome puis superpose les accessoires.
   * @param {string} key Cle de texture (ex: "ghost_custom").
   * @param {object} opts
   * @param {"white"|"black"} [opts.color="black"] Couleur du fantome.
   * @param {string[]} [opts.accessories=[]] Accessoires equipes ("hat","glasses").
   * @returns {void}
   */
  makeGhostCustom(key, { color = "black", accessories = [] } = {}) {
    const W = 40;
    const H = 48;
    const g = this._graphics();
    // Corps TOUJOURS noir ; seule la couleur du CONTOUR change (violet/blanc).
    const body = 0x1a1a24;
    const outline = color === "white" ? 0xf4f4ff : 0x6a3fb0;
    const eye = 0xff8c1a;
    const pupil = 0xffd27f;
    const has = (a) => Array.isArray(accessories) && accessories.includes(a);

    // --- CAPES (derriere le corps) ---
    if (has("cape")) {
      g.fillStyle(0x5a0d16, 1);
      g.fillTriangle(W * 0.5, H * 0.26, W * 0.02, H * 0.98, W * 0.98, H * 0.98);
      g.fillStyle(0x14060a, 1);
      g.fillTriangle(W * 0.5, H * 0.3, W * 0.1, H * 0.96, W * 0.9, H * 0.96);
      g.fillStyle(0x5a0d16, 1);
      g.fillTriangle(W * 0.5, H * 0.26, W * 0.3, H * 0.14, W * 0.42, H * 0.3);
      g.fillTriangle(W * 0.5, H * 0.26, W * 0.7, H * 0.14, W * 0.58, H * 0.3);
    }
    if (has("cape_orange")) {
      g.fillStyle(0xff8c1a, 1);
      g.fillTriangle(W * 0.5, H * 0.26, W * 0.02, H * 0.98, W * 0.98, H * 0.98);
      g.fillStyle(0xb5590d, 1);
      g.fillTriangle(W * 0.5, H * 0.3, W * 0.1, H * 0.96, W * 0.9, H * 0.96);
      g.fillStyle(0xff8c1a, 1);
      g.fillTriangle(W * 0.5, H * 0.26, W * 0.3, H * 0.14, W * 0.42, H * 0.3);
      g.fillTriangle(W * 0.5, H * 0.26, W * 0.7, H * 0.14, W * 0.58, H * 0.3);
    }
    if (has("cape_purple")) {
      g.fillStyle(0x7a3fb0, 1);
      g.fillTriangle(W * 0.5, H * 0.26, W * 0.02, H * 0.98, W * 0.98, H * 0.98);
      g.fillStyle(0x4a2170, 1);
      g.fillTriangle(W * 0.5, H * 0.3, W * 0.1, H * 0.96, W * 0.9, H * 0.96);
      g.fillStyle(0x7a3fb0, 1);
      g.fillTriangle(W * 0.5, H * 0.26, W * 0.3, H * 0.14, W * 0.42, H * 0.3);
      g.fillTriangle(W * 0.5, H * 0.26, W * 0.7, H * 0.14, W * 0.58, H * 0.3);
    }
    if (has("cape_green")) {
      g.fillStyle(0x3fae5a, 1);
      g.fillTriangle(W * 0.5, H * 0.26, W * 0.02, H * 0.98, W * 0.98, H * 0.98);
      g.fillStyle(0x1f7a38, 1);
      g.fillTriangle(W * 0.5, H * 0.3, W * 0.1, H * 0.96, W * 0.9, H * 0.96);
      g.fillStyle(0x3fae5a, 1);
      g.fillTriangle(W * 0.5, H * 0.26, W * 0.3, H * 0.14, W * 0.42, H * 0.3);
      g.fillTriangle(W * 0.5, H * 0.26, W * 0.7, H * 0.14, W * 0.58, H * 0.3);
    }

    // --- CORPS ---
    g.fillStyle(outline, 1);
    this._ghostSilhouette(g, 1, 1, W - 2, H - 2);
    g.fillStyle(body, 1);
    this._ghostSilhouette(g, 3, 3, W - 6, H - 6);
    g.fillStyle(eye, 1);
    g.fillCircle(W * 0.37, H * 0.42, 5);
    g.fillCircle(W * 0.63, H * 0.42, 5);
    g.fillStyle(pupil, 1);
    g.fillCircle(W * 0.37, H * 0.42, 2);
    g.fillCircle(W * 0.63, H * 0.42, 2);
    g.fillStyle(eye, 1);
    g.fillEllipse(W * 0.5, H * 0.62, 7, 9);

    // --- MASQUES (sur les yeux) ---
    if (has("glasses")) {
      const lensR = 6;
      const ly = H * 0.42;
      const lx1 = W * 0.37;
      const lx2 = W * 0.63;
      g.fillStyle(0x101018, 0.85);
      g.fillCircle(lx1, ly, lensR);
      g.fillCircle(lx2, ly, lensR);
      g.lineStyle(2, 0x303040, 1);
      g.strokeCircle(lx1, ly, lensR);
      g.strokeCircle(lx2, ly, lensR);
      g.beginPath();
      g.moveTo(lx1 + lensR, ly);
      g.lineTo(lx2 - lensR, ly);
      g.strokePath();
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(lx1 - 2, ly - 2, 1.4);
      g.fillCircle(lx2 - 2, ly - 2, 1.4);
    }
    if (has("mask")) {
      // Loup : bandeau sombre sur les yeux avec deux ouvertures.
      const my = H * 0.42;
      g.fillStyle(0x1a1024, 1);
      g.fillEllipse(W * 0.5, my, 30, 13); // bandeau
      // Ouvertures des yeux (couleur des yeux visible).
      g.fillStyle(eye, 1);
      g.fillEllipse(W * 0.37, my, 7, 6);
      g.fillEllipse(W * 0.63, my, 7, 6);
      // Pointes superieures du loup.
      g.fillStyle(0x1a1024, 1);
      g.fillTriangle(W * 0.3, my - 5, W * 0.4, my - 5, W * 0.33, my - 12);
      g.fillTriangle(W * 0.7, my - 5, W * 0.6, my - 5, W * 0.67, my - 12);
    }
    if (has("eyepatch")) {
      // Cache-oeil pirate : bandeau diagonal + patch noir sur un oeil.
      const my = H * 0.42;
      g.lineStyle(3, 0x141018, 1);
      g.beginPath();
      g.moveTo(W * 0.2, H * 0.3);
      g.lineTo(W * 0.82, H * 0.5);
      g.strokePath();
      g.lineStyle(0);
      g.fillStyle(0x0a0a0f, 1);
      g.fillEllipse(W * 0.63, my, 9, 9); // patch sur l oeil droit
    }
    if (has("skull")) {
      // Masque de squelette : face blanche sur le haut du visage.
      const my = H * 0.44;
      g.fillStyle(0xf2f0e6, 1);
      g.fillEllipse(W * 0.5, my - 2, 26, 22); // crane
      g.fillRect(W * 0.42, my + 6, W * 0.16, 5); // machoire
      // Orbites noires.
      g.fillStyle(0x0a0a0f, 1);
      g.fillEllipse(W * 0.4, my - 2, 7, 8);
      g.fillEllipse(W * 0.6, my - 2, 7, 8);
      // Nez triangulaire.
      g.fillTriangle(W * 0.5, my + 2, W * 0.46, my + 6, W * 0.54, my + 6);
      // Dents.
      g.fillStyle(0x0a0a0f, 1);
      g.fillRect(W * 0.47, my + 6, 1.5, 5);
      g.fillRect(W * 0.5, my + 6, 1.5, 5);
      g.fillRect(W * 0.53, my + 6, 1.5, 5);
    }

    // --- CHAPEAUX (sur la tete) ---
    if (has("tophat")) {
      const cx = W * 0.5;
      const brimY = H * 0.2;
      g.fillStyle(0x0d0d12, 1);
      g.fillEllipse(cx, brimY, 34, 7);
      g.fillRect(cx - 10, brimY - 20, 20, 20);
      g.fillStyle(0xff8c1a, 1);
      g.fillRect(cx - 10, brimY - 6, 20, 4);
      g.fillStyle(0x0d0d12, 1);
      g.fillEllipse(cx, brimY - 20, 20, 5);
    }
    if (has("pumpkin")) {
      const px = W * 0.5;
      const py = H * 0.14;
      g.fillStyle(0xff7a18, 1);
      g.fillEllipse(px, py, 22, 16);
      g.fillStyle(0xe85f0a, 1);
      g.fillEllipse(px - 7, py, 7, 15);
      g.fillEllipse(px + 7, py, 7, 15);
      g.fillStyle(0x3a2a12, 1);
      g.fillRect(px - 2, py - 15, 4, 6);
      g.fillStyle(0x3a1500, 1);
      g.fillTriangle(px - 7, py, px - 3, py, px - 5, py + 4);
      g.fillTriangle(px + 7, py, px + 3, py, px + 5, py + 4);
      g.fillTriangle(px, py + 3, px - 4, py + 7, px + 4, py + 7);
    }
    if (has("wizardhat")) {
      // Chapeau de sorciere : bord + cone pointu violet avec bande orange.
      const cx = W * 0.5;
      const brimY = H * 0.2;
      g.fillStyle(0x4a2170, 1);
      g.fillEllipse(cx, brimY, 36, 7); // bord
      g.fillTriangle(cx, brimY - 30, cx - 13, brimY, cx + 13, brimY); // cone
      g.fillStyle(0xff8c1a, 1);
      g.fillRect(cx - 11, brimY - 6, 22, 4); // bande
      g.fillStyle(0xffd27f, 1);
      g.fillRect(cx - 2, brimY - 6, 4, 4);
    }
    if (has("crown")) {
      // Couronne doree : base + 3 pointes a joyaux.
      const cx = W * 0.5;
      const baseY = H * 0.16;
      g.fillStyle(0xf2c21a, 1);
      g.fillRect(cx - 13, baseY, 26, 6); // bandeau
      // Pointes.
      g.fillTriangle(cx - 13, baseY, cx - 6, baseY, cx - 9.5, baseY - 10);
      g.fillTriangle(cx - 3, baseY, cx + 3, baseY, cx, baseY - 13);
      g.fillTriangle(cx + 6, baseY, cx + 13, baseY, cx + 9.5, baseY - 10);
      // Joyaux.
      g.fillStyle(0xe03fb0, 1);
      g.fillCircle(cx, baseY + 3, 2);
      g.fillStyle(0x3fae5a, 1);
      g.fillCircle(cx - 8, baseY + 3, 1.6);
      g.fillCircle(cx + 8, baseY + 3, 1.6);
    }

    g.generateTexture(key, W, H);
    g.destroy();
  }

  /**
   * Genere la texture d un squelette ennemi (meme gabarit que la sorciere).
   * Crane blanc avec orbites, cage thoracique et bras.
   * @param {string} key
   * @returns {void}
   */
  makeSkeleton(key) {
    const W = 40;
    const H = 52;
    const g = this._graphics();
    const bone = 0xeae8dc;
    const boneShade = 0xbfbdb0;
    const dark = 0x0a0a0f;

    // Colonne + bassin.
    g.lineStyle(4, bone, 1);
    g.beginPath();
    g.moveTo(W * 0.5, 20);
    g.lineTo(W * 0.5, H - 10);
    g.strokePath();
    g.lineStyle(0);

    // Cage thoracique (cotes).
    g.lineStyle(2, bone, 1);
    for (let i = 0; i < 3; i++) {
      const y = 26 + i * 6;
      g.beginPath();
      g.moveTo(W * 0.5, y);
      g.lineTo(W * 0.5 - 9, y + 3);
      g.moveTo(W * 0.5, y);
      g.lineTo(W * 0.5 + 9, y + 3);
      g.strokePath();
    }
    // Bras.
    g.beginPath();
    g.moveTo(W * 0.5, 24);
    g.lineTo(W * 0.2, 34);
    g.moveTo(W * 0.5, 24);
    g.lineTo(W * 0.8, 34);
    g.strokePath();
    // Jambes.
    g.beginPath();
    g.moveTo(W * 0.5, H - 10);
    g.lineTo(W * 0.35, H - 1);
    g.moveTo(W * 0.5, H - 10);
    g.lineTo(W * 0.65, H - 1);
    g.strokePath();
    g.lineStyle(0);

    // Crane.
    g.fillStyle(bone, 1);
    g.fillCircle(W * 0.5, 14, 10);
    g.fillRect(W * 0.42, 20, W * 0.16, 5); // machoire
    g.fillStyle(boneShade, 0.5);
    g.fillCircle(W * 0.5 + 3, 15, 8);
    // Orbites + nez.
    g.fillStyle(dark, 1);
    g.fillEllipse(W * 0.44, 13, 5, 6);
    g.fillEllipse(W * 0.56, 13, 5, 6);
    g.fillTriangle(W * 0.5, 16, W * 0.47, 20, W * 0.53, 20);
    // Dents.
    g.fillRect(W * 0.46, 20, 1.5, 4);
    g.fillRect(W * 0.5, 20, 1.5, 4);
    g.fillRect(W * 0.54, 20, 1.5, 4);

    g.generateTexture(key, W, H);
    g.destroy();
  }

  /**
   * Genere la texture d un vampire ennemi (meme gabarit que la sorciere).
   * Cape noire a doublure rouge, col releve, visage pale, crocs.
   * @param {string} key
   * @returns {void}
   */
  makeVampire(key) {
    const W = 40;
    const H = 52;
    const g = this._graphics();
    const cloak = 0x14060a;
    const lining = 0x8a0d16;
    const skin = 0xcfc8d6;
    const hair = 0x0a0a0f;

    // Cape (large, derriere).
    g.fillStyle(lining, 1);
    g.fillTriangle(W * 0.5, 22, W * 0.02, H - 1, W * 0.98, H - 1);
    g.fillStyle(cloak, 1);
    g.fillTriangle(W * 0.5, 26, W * 0.14, H - 1, W * 0.86, H - 1);
    // Corps / costume.
    g.fillStyle(0x1a1420, 1);
    g.fillTriangle(W * 0.5, 28, W * 0.3, H - 4, W * 0.7, H - 4);
    // Col releve (deux pointes rouges derriere la tete).
    g.fillStyle(lining, 1);
    g.fillTriangle(W * 0.5, 20, W * 0.26, 10, W * 0.44, 26);
    g.fillTriangle(W * 0.5, 20, W * 0.74, 10, W * 0.56, 26);
    // Visage pale.
    g.fillStyle(skin, 1);
    g.fillCircle(W * 0.5, 16, 8);
    // Cheveux plaques (widow s peak).
    g.fillStyle(hair, 1);
    g.fillTriangle(W * 0.5, 16, W * 0.38, 8, W * 0.62, 8);
    g.fillRect(W * 0.42, 8, W * 0.16, 3);
    // Yeux rouges.
    g.fillStyle(0xd11a1a, 1);
    g.fillCircle(W * 0.45, 16, 1.8);
    g.fillCircle(W * 0.55, 16, 1.8);
    // Crocs.
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(W * 0.46, 20, W * 0.49, 20, W * 0.475, 24);
    g.fillTriangle(W * 0.54, 20, W * 0.51, 20, W * 0.525, 24);

    g.generateTexture(key, W, H);
    g.destroy();
  }

  /**
   * Genere un arbre MORT sans feuilles (tronc + branches nues ramifiees).
   * Pour le decor des squelettes.
   * @param {string} key
   * @returns {void}
   */
  makeBareTree(key) {
    const W = 120;
    const H = 200;
    const g = this._graphics();
    const trunk = 0x2a2032;
    const cx = W / 2;

    // Tronc.
    g.fillStyle(trunk, 1);
    g.fillTriangle(cx - 14, H, cx - 6, H * 0.4, cx - 8, H);
    g.fillRect(cx - 9, H * 0.4, 18, H * 0.6);

    // Branches nues (lignes ramifiees, de plus en plus fines).
    const branch = (x1, y1, x2, y2, wdt) => {
      g.lineStyle(wdt, trunk, 1);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.strokePath();
    };
    // Grosses branches.
    branch(cx, H * 0.45, cx - 42, H * 0.2, 7);
    branch(cx, H * 0.5, cx + 40, H * 0.16, 7);
    branch(cx, H * 0.6, cx - 30, H * 0.4, 6);
    branch(cx, H * 0.4, cx + 10, H * 0.08, 6);
    // Ramifications fines.
    branch(cx - 42, H * 0.2, cx - 56, H * 0.08, 3);
    branch(cx - 42, H * 0.2, cx - 34, H * 0.05, 3);
    branch(cx + 40, H * 0.16, cx + 54, H * 0.04, 3);
    branch(cx + 40, H * 0.16, cx + 30, H * 0.03, 3);
    branch(cx - 30, H * 0.4, cx - 44, H * 0.3, 3);
    branch(cx + 10, H * 0.08, cx + 2, H * 0.0, 3);
    g.lineStyle(0);

    g.generateTexture(key, W, H);
    g.destroy();
  }

  /**
   * Genere une petite chauve-souris (corps + ailes dentelees) pour le decor
   * des vampires. Dessinee claire pour etre teintee en fond.
   * @param {string} key
   * @returns {void}
   */
  makeBat(key) {
    const W = 48;
    const H = 28;
    const g = this._graphics();
    const col = 0x15101f;
    const cx = W / 2;
    const cy = H / 2;

    // Corps.
    g.fillStyle(col, 1);
    g.fillEllipse(cx, cy, 8, 11);
    // Oreilles.
    g.fillTriangle(cx - 3, cy - 5, cx - 1, cy - 11, cx + 1, cy - 5);
    g.fillTriangle(cx + 3, cy - 5, cx + 1, cy - 11, cx - 1, cy - 5);
    // Aile gauche (dentelee).
    g.fillTriangle(cx - 2, cy, cx - 22, cy - 8, cx - 14, cy + 2);
    g.fillTriangle(cx - 2, cy, cx - 14, cy + 2, cx - 20, cy + 6);
    // Aile droite.
    g.fillTriangle(cx + 2, cy, cx + 22, cy - 8, cx + 14, cy + 2);
    g.fillTriangle(cx + 2, cy, cx + 14, cy + 2, cx + 20, cy + 6);

    g.generateTexture(key, W, H);
    g.destroy();
  }

  /**
   * Spectre : fantome spectral vert/cyan translucide avec longs bras (niveau 4).
   * @param {string} key
   * @returns {void}
   */
  makeSpectre(key) {
    const W = 40;
    const H = 52;
    const g = this._graphics();
    const body = 0x2e6e5a;
    const glow = 0x4fe0b0;
    // Corps spectral (silhouette ondulee).
    g.fillStyle(body, 0.9);
    g.fillCircle(W * 0.5, 18, 15);
    g.fillRect(W * 0.5 - 15, 18, 30, 22);
    for (let i = 0; i < 4; i++) {
      g.fillCircle(W * 0.5 - 15 + 7.5 + i * 7.5, 40, 4.5);
    }
    // Longs bras.
    g.lineStyle(4, body, 0.9);
    g.beginPath();
    g.moveTo(W * 0.5 - 12, 22);
    g.lineTo(W * 0.5 - 22, 40);
    g.moveTo(W * 0.5 + 12, 22);
    g.lineTo(W * 0.5 + 22, 40);
    g.strokePath();
    g.lineStyle(0);
    // Yeux lumineux.
    g.fillStyle(glow, 1);
    g.fillCircle(W * 0.42, 16, 3.2);
    g.fillCircle(W * 0.58, 16, 3.2);
    g.fillStyle(0x0a0a0f, 1);
    g.fillCircle(W * 0.42, 16, 1.3);
    g.fillCircle(W * 0.58, 16, 1.3);
    g.generateTexture(key, W, H);
    g.destroy();
  }

  /**
   * Pumpkinhead : epouvantail a tete de citrouille (niveau 5).
   * @param {string} key
   * @returns {void}
   */
  makePumpkinHead(key) {
    const W = 40;
    const H = 52;
    const g = this._graphics();
    // Corps / tunique.
    g.fillStyle(0x4a3a24, 1);
    g.fillTriangle(W * 0.5, 26, W * 0.2, H - 2, W * 0.8, H - 2);
    // Bras en baton.
    g.lineStyle(3, 0x3a2e1c, 1);
    g.beginPath();
    g.moveTo(W * 0.5, 32); g.lineTo(W * 0.18, 30);
    g.moveTo(W * 0.5, 32); g.lineTo(W * 0.82, 30);
    g.strokePath();
    g.lineStyle(0);
    // Tete citrouille.
    g.fillStyle(0xff7a18, 1);
    g.fillCircle(W * 0.5, 15, 13);
    g.fillStyle(0xe85f0a, 1);
    g.fillEllipse(W * 0.5 - 7, 15, 5, 12);
    g.fillEllipse(W * 0.5 + 7, 15, 5, 12);
    g.fillStyle(0x3a2a12, 1);
    g.fillRect(W * 0.5 - 2, 1, 4, 5); // tige
    // Visage jack-o-lantern lumineux.
    g.fillStyle(0xffe08a, 1);
    g.fillTriangle(W * 0.42, 12, W * 0.48, 12, W * 0.45, 17);
    g.fillTriangle(W * 0.58, 12, W * 0.52, 12, W * 0.55, 17);
    g.fillTriangle(W * 0.5, 17, W * 0.42, 22, W * 0.58, 22);
    g.generateTexture(key, W, H);
    g.destroy();
  }

}

export default TextureFactory;
