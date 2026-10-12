# Étape 19 — Pièces et toits automatiques

**Prérequis** : 18
**Lire** : `docs/design/04-craft-construction.md` §Pièces et toits ; `docs/ARCHITECTURE.md` §10 (Rendu en 3/4)
**Taille** : moyenne

## Objectif
Une pièce fermée reçoit automatiquement un toit, qui cache l'intérieur aux joueurs restés dehors et s'efface quand on
entre.

## À faire
1. Serveur `world/rooms.ts` : détection des pièces par remplissage à partir des cases voisines d'un mur ou d'une
   porte qui vient de changer, borné à `building.maxRoomSize` (64 cases). Une pièce = zone fermée par des murs et des
   portes. Identifiant de pièce par case (dans `meta`), recalcul local à chaque pose ou casse de mur ou de porte.
2. Diffusion aux clients : cases couvertes et identifiant de pièce.
3. Client : calque des toits au-dessus des objets ; fondu qui révèle la pièce où se trouve le joueur local ; les autres
   pièces restent couvertes.
4. Quand une pièce s'ouvre (mur cassé), son toit disparaît.

## Critères d'acceptation
- [ ] Quatre murs et une porte → un toit apparaît ; on entre → il s'efface pour soi seulement ; on casse un mur → plus
      de toit.
- [ ] Recalcul en moins de 2 ms pour une pièce de 64 cases.

## Tests à écrire
- Détection de pièce : ouverte, fermée, trop grande, deux pièces collées.

## Hors périmètre
- Masquer l'intérieur côté serveur (P13), étages (P8).
