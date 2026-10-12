# Étape 21 — Jour, nuit et lumière

**Prérequis** : 18
**Lire** : `docs/design/01-monde.md` §Temps, §Lumière ; `docs/ARCHITECTURE.md` §10 (Rendu en 3/4), §13 (`TIME_SCALE`)
**Taille** : moyenne

## Objectif
Un cycle de 60 minutes (30 de jour, 30 de nuit) assombrit le monde la nuit ; les torches éclairent.

## À faire
1. Horloge du monde côté serveur, sauvegardée dans `world_state` ; heure envoyée aux clients (resynchronisation toutes
   les 10 s, interpolation entre deux) ; aube et crépuscule progressifs (3 minutes).
2. Shared `sim/light.ts` : niveau de lumière d'une case = maximum entre la lumière ambiante (selon l'heure) et les
   sources proches (atténuation avec la distance) ; `isLit(world, x, y, time)`, utilisée pour l'apparition des
   monstres (23).
3. Client : calque d'obscurité avec des halos doux autour des torches et une faible lueur autour du joueur (pour
   rester jouable) ; teinte bleutée la nuit, orangée à l'aube et au crépuscule.
4. HUD : petite horloge (soleil, lune).
5. `TIME_SCALE` en dev pour accélérer le temps.

## Critères d'acceptation
- [ ] Avec le temps accéléré, la nuit tombe progressivement et les torches éclairent.
- [ ] 60 FPS maintenus avec 30 torches à l'écran sur PC.

## Tests à écrire
- Niveau de lumière : atténuation, maximum de plusieurs sources.
- Horloge : passage du jour à la nuit, valeurs à l'aube et au crépuscule.

## Hors périmètre
- Météo et saisons (P4), lumière sous terre (P1).
