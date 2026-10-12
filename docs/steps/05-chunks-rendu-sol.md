# Étape 05 — Chunks : diffusion et rendu du sol

**Prérequis** : 03, 04
**Lire** : `docs/ARCHITECTURE.md` §7 (Intérêt), §10 (Rendu en 3/4, Assets) ;
`docs/design/10-graphismes-son.md` §Palette, §Placeholders et atlas
**Taille** : moyenne

## Objectif
Le client reçoit les chunks autour d'un point et dessine le sol (terrain et sols posés) en pixel art net, avec des
placeholders générés.

## À faire
1. Protocole : `chunk { layer, cx, cy, ground, floor, object, meta }` (tableaux compacts), `tileUpdate`
   (changement d'une case), `viewport { w, h, zoom }` envoyé par le client.
2. Serveur `net/interest.ts` : pour chaque session, ensemble des chunks abonnés autour de la position du joueur
   (rayon selon le viewport, plafonné par `net.maxChunkRadius`) ; envoi des nouveaux chunks, désabonnement des chunks
   lointains. Pour l'instant, la position du joueur est le spawn.
3. Client `game/world/ChunkCache.ts` : stockage des chunks reçus, application des `tileUpdate`.
4. Client `assets/registry.ts` : ID de sprite → image de l'atlas si présente, sinon placeholder dessiné par le code
   avec la palette provisoire (herbe à touffes, sable pointillé, eau en deux tons, terre).
5. Rendu du sol : une texture par chunk, redessinée quand une de ses cases change ; aucune couture visible entre
   chunks.
6. Caméra de debug libre (flèches), réservée au mode dev, pour se promener avant d'avoir un personnage.

## Critères d'acceptation
- [ ] À l'ouverture du client, on voit le sol autour du spawn.
- [ ] En déplaçant la caméra de debug, les nouveaux chunks arrivent et les lointains sont libérés.
- [ ] Pixels nets à tous les zooms entiers, sans couture entre chunks.

## Tests à écrire
- Calcul des chunks à abonner et désabonner.
- Encodage et décodage d'un chunk.

## Hors périmètre
- Objets hauts (06), déplacement (07).
