# Étape 07 — Déplacement autoritaire et collisions

**Prérequis** : 06
**Lire** : `docs/design/02-joueur.md` §Personnage, §Déplacement, §Contrôles sur PC ;
`docs/ARCHITECTURE.md` §7 (Tick et messages)
**Taille** : moyenne

## Objectif
Le joueur se déplace au clavier dans le monde ; le serveur fait foi ; on ne traverse ni les arbres ni l'eau profonde.

## À faire
1. `shared/src/sim/movement.ts` : `stepMovement(state, input, dt, world)` déterministe : 8 directions, vitesse
   `player.speedTilesPerSec`, diagonales normalisées, collisions de la boîte du joueur avec les cases solides
   (glissement le long des obstacles), ralentissement dans l'eau peu profonde.
2. Client : lecture du clavier par `event.code` (KeyW, KeyA, KeyS, KeyD et flèches), envoi de `input { seq, dir }`
   à 20 Hz ; direction du regard (4 directions, dernière direction de déplacement).
3. Sprite placeholder du personnage : 3 frames 8 × 8 regard à droite (repos, marche 1, marche 2), retournées pour la
   gauche, inchangées en montant ou en descendant.
4. Serveur `modules/movement/` : applique au plus un input par tick et par joueur (les autres attendent), refuse toute
   accélération, met à jour la position, l'index spatial et l'abonnement aux chunks ; envoie
   `snapshot { tick, ackSeq, you }`.
5. La caméra suit le joueur. La caméra de debug n'est plus disponible qu'en mode dev.

## Critères d'acceptation
- [ ] On se promène ; on ne traverse ni arbres ni eau profonde ; on glisse le long des obstacles.
- [ ] Les chunks suivent le joueur.
- [ ] Un client qui envoie des inputs trop vite ne va pas plus vite (testé).

## Tests à écrire
- Collisions : coin, glissement, diagonales.
- Vitesse constante, impossibilité d'accélérer en inondant d'inputs.

## Hors périmètre
- Prédiction (08) : ici, le client affiche simplement la position renvoyée par le serveur.
