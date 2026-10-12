# Étape 18 — Construction : sols, murs, portes, meubles

**Prérequis** : 17
**Lire** : `docs/design/04-craft-construction.md` §Construction ; `docs/design/10-graphismes-son.md` §Vue 3/4
**Taille** : moyenne

## Objectif
On bâtit une cabane : sols en bois, murs qui se raccordent, porte qui s'ouvre et se ferme, lit et torches.

## À faire
1. Règles de pose : case à portée, hors zone sûre, pas d'eau profonde, pas d'objet déjà présent, pas d'entité qui
   chevauche la case ; les sols vont dans l'emplacement `floor`, murs, portes et meubles dans `object`.
2. Murs : sprite choisi selon les murs voisins (raccords dans les 4 directions) en vue 3/4 ; face avant visible
   seulement sans mur en dessous ; PV selon le matériau (`base:wooden_wall` : 20).
3. Portes : action « Ouvrir » / « Fermer » ; fermée = solide ; état dans `meta` ; sprites ouverte et fermée.
4. Meubles du MVP : lit (action « Dormir ici » : enregistre le point de réapparition du joueur dans son personnage),
   torche (déclare une source de lumière `light: 6`, l'effet visuel arrive à l'étape 21), établi.
5. Casser ses constructions (action « Casser ») rend l'objet. Le chunk est marqué `has_player_build`.

## Critères d'acceptation
- [ ] On construit une pièce fermée avec une porte ; fermée, elle bloque ; ouverte, elle laisse passer.
- [ ] Les murs se raccordent proprement dans tous les cas (ligne, angle, croix).
- [ ] « Dormir ici » enregistre le point de réapparition (vérifié dans les données ; utilisé à l'étape 20).

## Tests à écrire
- Règles de pose.
- Raccords des murs (table voisins → sprite).
- État des portes et collision.

## Hors périmètre
- Toits (19), serrures et clés (P2), étages (P8).
