# 10 — Graphismes et son

## Direction artistique
- Pixel art « 8-bit » : cases et personnages de 8 × 8 px.
- Bâtiments à la RimWorld et The Escapists : vus de dessus, pièces lisibles, toits qui s'effacent.
- Références des sprites : dossier `ref/` à la racine du projet, fourni par l'auteur. Tant qu'il est absent ou vide,
  on travaille avec des placeholders.
- Ces images servent d'inspiration : on ne les copie jamais telles quelles dans le jeu.
- Une seule session lit les images de `ref/` pour résumer ici la direction artistique (palette en codes couleur,
  proportions, style des murs, des toits et des personnages). Les étapes de code suivent ce résumé et n'ouvrent pas
  les images, pour économiser le contexte.

## Vue 3/4
- Le sol est vu de dessus. Les objets hauts (arbres, murs, portes, meubles hauts) montrent une face et peuvent
  dépasser vers le haut : sprite de 8 × 16 ancré en bas de sa case.
- Tri en profondeur selon Y : un personnage derrière un arbre est caché par le feuillage ; devant, il le recouvre.
- Murs : le sprite dépend des murs voisins ; la face avant n'apparaît que s'il n'y a pas de mur juste en dessous.
- Toits : calque au-dessus de tout, effacé en fondu sur la pièce où l'on se trouve.

## Personnages
- 8 × 8, 3 frames regard à droite (repos, marche 1, marche 2), retournées pour la gauche.
- L'objet en main est dessiné par-dessus ; une attaque = un balayage de l'arme dans la direction du regard.

## Palette
- Provisoire : palette PICO-8 (16 couleurs), en attendant le résumé tiré de `ref/`.
- La palette est définie à un seul endroit du code, pour être remplacée facilement.

## Placeholders et atlas
- Chaque élément visuel a un identifiant de sprite : `tile.grass`, `obj.oak_tree`, `item.wooden_axe`, `char.default`…
- Si l'atlas (`apps/client/public/assets/atlas.png` + `atlas.json`) contient l'identifiant, on l'utilise ;
  sinon, le code dessine un placeholder simple et lisible.
- Remplacer l'art = livrer l'atlas, sans toucher au code.

## Interface
- Interface en pixel art. Police pixel libre qui gère les accents français (par exemple Pixelify Sans, à valider),
  taille du texte réglable.
- Cœurs, jauge de faim, barre d'objets, horloge jour/nuit.
- Lisible sur téléphone : zones tactiles d'au moins 48 px.

## Son (P13)
- Bruitages chiptune générés (style sfxr) : coup, récolte, pose, porte, dégâts, monstres, interface.
- Musique d'ambiance pour le jour et la nuit, plus tard. Volumes séparés (musique, effets).
