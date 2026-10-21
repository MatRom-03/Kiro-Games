# Halloween Ghost Dash — Guide de Gameplay

> Ce document explique comment le jeu fonctionne, du point de vue du joueur
> comme du point de vue des mécaniques internes. Il complète `design.md`
> (architecture technique) en se concentrant sur l'expérience de jeu.

---

## 1. Pitch

Tu incarnes un petit **fantôme** (blanc ou noir, au choix) lâché dans un niveau
hanté. Ta mission : récolter **15 bonbons** avant la fin d'un compte à rebours
de **45 secondes**, tout en survivant aux **sorcières** qui patrouillent sur les
plateformes. Plus tu es rapide et efficace, plus ton score grimpe.

---

## 2. Objectif

- **But principal :** collecter **15 bonbons** disséminés dans le niveau.
- **Contrainte de temps :** tu disposes de **45 secondes**.
- **Survie :** tu commences avec **3 cœurs** de vie.

### Conditions de victoire
Tu gagnes dès que le **15e bonbon** est récolté, à condition qu'il te reste du
temps et au moins 1 cœur.

### Conditions de défaite
Tu perds si :
- ton **compteur de cœurs tombe à 0**, OU
- le **timer atteint 0** avant d'avoir récolté les 15 bonbons.

---

## 3. Contrôles

| Action                | Touches                       |
|-----------------------|-------------------------------|
| Se déplacer à gauche  | Flèche Gauche **ou** `Q`      |
| Se déplacer à droite  | Flèche Droite **ou** `D`      |
| Sauter                | `Espace` **ou** Flèche Haut   |
| Tirer un projectile   | `F` **ou** `E`                |

Les contrôles sont rappelés dans le **Launcher** et dans l'écran **Réglages**.

---

## 4. Mécaniques de jeu

### 4.1 Déplacement « type Mario »
- Déplacement latéral gauche/droite à vitesse constante.
- **Gravité** permanente : le fantôme retombe toujours vers le sol.
- **Saut** uniquement lorsque le fantôme touche une surface (sol ou plateforme).
- Le fantôme peut enchaîner sauts et déplacements pour atteindre les plateformes
  en hauteur où se cachent certains bonbons.

### 4.2 Collecte des bonbons
- Les **15 bonbons** sont répartis dans le niveau (sol et plateformes).
- Toucher un bonbon le récolte automatiquement : le **compteur `x / 15`**
  augmente de 1.
- Récolter le 15e bonbon déclenche immédiatement la **victoire**.

### 4.3 Les sorcières (ennemis)
- Les sorcières **patrouillent** horizontalement sur leurs plateformes et font
  demi-tour aux extrémités.
- **Contact avec une sorcière :** tu perds **1 cœur** et deviens
  **invulnérable pendant 1,5 seconde**.
- Pendant l'invulnérabilité, le fantôme **clignote** et ne peut plus perdre de
  cœur, même en cas de contacts répétés. Cela évite de perdre plusieurs cœurs
  d'un coup sur une même collision.

### 4.4 Le tir de bonbons magiques
- Tu peux **tirer un projectile** (bonbon magique) pour **détruire une sorcière
  à distance**.
- Un projectile part dans la direction où regarde le fantôme.
- Un léger **délai (cooldown)** empêche le tir en rafale continu.
- **Important :** tirer **ne consomme PAS** tes bonbons récoltés. Le compteur
  `x / 15` n'est jamais décrémenté par un tir. Les projectiles sont une
  ressource distincte et illimitée (hors cooldown).

---

## 5. Interface en jeu (HUD)

Affiché en haut de l'écran pendant la partie :
- **Cœurs :** 3 icônes représentant la vie restante.
- **Compteur de bonbons :** `x / 15`.
- **Timer :** compte à rebours dynamique en secondes.

---

## 6. Score

À la fin de la partie, le score est calculé ainsi :

```
Score = (Bonbons restants × 100) + (Secondes restantes × 50)
```

- **Bonbons restants** = `15 − bonbons récoltés`. En cas de victoire, c'est 0.
- **Secondes restantes** = temps affiché au timer au moment de la fin.

### Lecture de la formule
- Finir **vite** rapporte beaucoup de points (bonus de secondes restantes).
- En cas de défaite, les bonbons non récoltés rapportent quand même des points,
  ce qui récompense une partie bien entamée.

> Exemple : victoire avec 30 secondes restantes →
> `(0 × 100) + (30 × 50) = 1500 points`.

---

## 7. Déroulé d'une session

```
Launcher  ──►  Partie  ──►  Écran de fin
   │                            │
   │                            ├─► Rejouer  ──► nouvelle Partie
   │                            └─► Voir le tableau des scores
   └─► Réglages (son, raccourcis)
```

1. **Launcher :** le joueur saisit son **pseudo**, choisit son **skin**
   (fantôme blanc ou noir), consulte le rappel des touches, puis lance la partie.
2. **Partie :** le gameplay décrit ci-dessus se déroule avec le HUD visible.
3. **Écran de fin :** affiche victoire/défaite et le **score**, avec les boutons
   **« Rejouer »** et **« Voir le tableau des scores »**. Le score est envoyé au
   serveur pour être classé.
4. **Tableau des scores (Scoreboard) :** affiche le **Top 10** (Rang, Pseudo,
   Score, Date) dans un style arcade.
5. **Réglages (Settings) :** permet de couper/activer le son et rappelle les
   raccourcis clavier.

---

## 8. Le fantôme : skins blanc et noir

Au lancement, le joueur **doit** choisir entre deux variantes du fantôme :
- **Fantôme blanc** : silhouette claire aux yeux orange.
- **Fantôme noir** : silhouette sombre aux yeux orange.

Le choix est **purement esthétique** : les deux skins ont exactement le même
comportement, la même physique et les mêmes capacités.

---

## 9. Résumé des valeurs de référence

| Paramètre                          | Valeur         |
|------------------------------------|----------------|
| Bonbons à collecter                | 15             |
| Durée de la partie                 | 45 secondes    |
| Cœurs de vie initiaux             | 3              |
| Perte par contact sorcière         | 1 cœur         |
| Durée d'invulnérabilité            | 1,5 seconde    |
| Points par bonbon restant          | 100            |
| Points par seconde restante        | 50             |
| Tir consomme des bonbons récoltés  | Non            |

---

*Ce guide décrit l'expérience de jeu attendue. Les valeurs numériques
correspondent aux constantes définies dans `design.md`
(`frontend/src/config/gameConstants.js`).*
