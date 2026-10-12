# 01 — Le monde

## Univers
Nature sauvage au ton de RPG classique : forêts, prairies, rivières et lacs. Les monstres sortent la nuit.

## Taille et couches
- Grille de cases de 8 × 8 px. Chaque couche mesure 1024 × 1024 cases (réglable).
- Les couches sont alignées, avec les mêmes coordonnées :
  - **Surface** : le monde principal.
  - **Mine** : un niveau pour commencer (P1). On y accède en creusant un accès (escalier ou échelle) et on arrive à
    la même position, en dessous. Un voisin peut donc creuser jusque sous ta base.
  - **Étages** : construits par les joueurs, accessibles par un escalier (P8).
- Donjons : scènes à part derrière une entrée, une copie (instance) par groupe (P9).

## Biomes de surface
- **Forêt de départ** : dense autour du spawn (chênes, buissons à baies, hautes herbes).
- **Prairie** : herbe, fleurs, arbres épars ; les animaux y vivront (P5).
- **Rivières** : bandes d'eau sinueuses bordées de sable.
- **Lacs** : eau profonde au centre, peu profonde au bord, plages de sable.
- On traverse l'eau peu profonde lentement. L'eau profonde est infranchissable (pas de nage pour l'instant).

## Spawn et zone sûre
- Spawn au centre de la carte, dans une clairière de la forêt.
- Zone sûre : cercle de 32 cases autour du spawn. Pas de monstres, pas de PvP, et on n'y casse ni n'y construit rien
  (sauf l'admin). Les PNJ marchands s'y installeront (P6).

## Temps
- Un cycle complet dure 60 minutes réelles : 30 minutes de jour, 30 minutes de nuit. L'aube et le crépuscule sont
  progressifs (3 minutes).
- Le monde tourne en continu, même sans joueur connecté.
- **Saisons** (P4) : printemps, été, automne, hiver ; 7 jours de jeu chacune, soit 7 heures réelles.
- **Météo** (P4) : pluie (arrose les cultures), orage (ciel sombre, éclairs).

## Lumière
- Le jour, tout est éclairé. La nuit, l'obscurité est forte sauf autour des sources de lumière.
- Sources : torche (rayon de 6 cases), plus tard feu de camp et lanternes.
- Une case éclairée empêche l'apparition des monstres.
- Sous terre : noir complet à toute heure, sauf près des sources de lumière (P1).

## Régénération des zones (P12)
- Une zone de 32 × 32 cases sans construction de joueur et hors parcelle se régénère depuis la graine du monde tous les
  7 jours, quand aucun joueur n'est à proximité : arbres, buissons, minerais et coffres cachés reviennent.

## Structures (P9)
- Ruines, coffres cachés un peu partout, villages de PNJ et entrées de donjons, placés à la génération.
