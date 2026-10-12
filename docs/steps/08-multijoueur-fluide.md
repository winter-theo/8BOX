# Étape 08 — Prédiction, interpolation, multijoueur

**Prérequis** : 07
**Lire** : `docs/ARCHITECTURE.md` §7 (Prédiction et interpolation, Intérêt), §13
**Taille** : grosse (si besoin : 08a prédiction et réconciliation, 08b autres joueurs et bots)

## Objectif
Le déplacement reste fluide même avec 150 ms de latence, et on voit les autres joueurs bouger en douceur.

## À faire
1. Client : prédiction locale avec `stepMovement` partagé, tampon des inputs non acquittés, réconciliation à chaque
   snapshot (on repart de la position serveur et on rejoue), correction douce des petits écarts.
2. Serveur : `snapshot.entities` contient les entités visibles (dans les chunks abonnés), en champs compacts
   (`id`, `kind`, `x`, `y`, `facing`, `anim`) ; apparition et disparition des entités côté client.
3. Client : interpolation des autres entités environ 100 ms dans le passé (tampon de snapshots).
4. Pseudos au-dessus des têtes, en texte pixel lisible.
5. Outil `pnpm tools:bots <n>` : n clients Node sans affichage, en mode dev, qui marchent au hasard.
6. Latence simulée en dev (`?lag=150` dans l'URL).

## Critères d'acceptation
- [ ] Avec 150 ms de latence simulée, son propre déplacement reste instantané, sans à-coups.
- [ ] Deux navigateurs et 20 bots : chacun voit les autres bouger en douceur ; tick serveur moyen < 5 ms.
- [ ] Un client ne reçoit pas les entités situées hors de ses chunks (testé).

## Tests à écrire
- Réconciliation : rejeu correct après une correction du serveur.
- Sélection des entités visibles.

## Hors périmètre
- Combat (22), chat (13).
