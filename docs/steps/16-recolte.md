# Étape 16 — Récolte et zone sûre

**Prérequis** : 15
**Lire** : `docs/design/04-craft-construction.md` §Récolte, §Outils et paliers ; `docs/design/01-monde.md` §Spawn et
zone sûre
**Taille** : moyenne

## Objectif
On coupe les arbres, on arrache les hautes herbes, on cueille les baies ; ce qu'on casse donne du butin ; rien ne se
casse dans la zone sûre du spawn.

## À faire
1. Points de vie des cases (`hp` de la définition) ; dégâts selon l'objet en main (main = 1, outil adapté = sa
   puissance, outil inadapté = 1) ; affichage des dégâts sur la case ; récupération des PV après 30 s sans coup.
2. Actions : « Couper » (arbres), « Arracher » (hautes herbes → fibre), « Cueillir » (buisson → baies, qui repoussent
   en 10 minutes), « Casser » (objets posés, utilisé à l'étape 18).
3. Tables de butin (`loot.json`) : chêne → 2 à 4 bûches + pomme à 20 %. Événement `tile.broken`.
4. Diffusion des changements (`tileUpdate`) aux joueurs abonnés au chunk ; chunk marqué « sale ».
5. Zone sûre : dans le cercle de 32 cases autour du spawn, on ne casse rien (sauf un admin) ; message clair.
6. Butin dans l'inventaire, ou au sol s'il est plein.
7. Préparer l'usure des outils (branchée à l'étape 17).

## Critères d'acceptation
- [ ] Couper un chêne donne des bûches dans l'inventaire (ou au sol si l'inventaire est plein).
- [ ] Deux joueurs qui frappent le même arbre : un seul butin, aucun doublon.
- [ ] Dans la zone sûre, l'action est refusée avec un message.

## Tests à écrire
- Calcul des dégâts selon l'outil.
- Table de butin (déterministe avec une graine).
- Règle de la zone sûre.

## Hors périmètre
- Pierre et minerais (P1).
