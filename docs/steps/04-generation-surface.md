# Étape 04 — Génération du monde de surface

**Prérequis** : 02
**Lire** : `docs/design/01-monde.md` §Taille et couches, §Biomes de surface, §Spawn et zone sûre ;
`docs/ARCHITECTURE.md` §4
**Taille** : moyenne

## Objectif
Le serveur génère de façon déterministe une surface de 1024 × 1024 cases (forêt autour du spawn, prairies, rivières,
lacs avec plages), qu'on peut vérifier en image PNG.

## À faire
1. `shared/src/world/` : types (`LayerId`, coordonnées de case et de chunk, index de case), `Chunk` (trois
   `Uint16Array` + `meta`), conversions.
2. `shared/src/world/gen/surface.ts` : génération d'un chunk à partir de la graine et de ses coordonnées
   (`simplex-noise` + RNG seedé) :
   - altitude et humidité → eau profonde, eau peu profonde, sable au bord de l'eau, herbe, terre ;
   - rivières le long d'une isoligne de bruit ;
   - objets : chênes (forêt dense près du spawn, clairsemés ailleurs), buissons à baies, hautes herbes, fleurs ;
   - clairière de spawn au centre (rayon 6 cases sans objet, sur la terre ferme).
3. Serveur `world/World.ts` : génère tous les chunks de la surface au démarrage (en mémoire), `getTile` et `setTile`
   (qui marque le chunk « sale »). Graine : variable `WORLD_SEED`, sinon aléatoire (elle sera stockée en base à
   l'étape 10).
4. Outil `pnpm tools:map [seed] [fichier.png]` : exporte la surface en PNG (1 pixel = 1 case, une couleur par type).

## Critères d'acceptation
- [ ] Même graine → même carte (vérifié sur plusieurs chunks).
- [ ] Génération complète en moins de 3 secondes.
- [ ] L'image PNG montre une forêt autour du centre, de l'eau, des plages et des prairies.
- [ ] Le spawn est sur la terre ferme et dégagé.

## Tests à écrire
- Déterminisme, spawn valide, proportions raisonnables (par exemple 10 à 40 % d'eau).

## Hors périmètre
- Mine (P1), structures et ruines (P9), régénération (P12).

## Notes
- Générer chunk par chunk, sans dépendre des voisins : la régénération (P12) en aura besoin.
