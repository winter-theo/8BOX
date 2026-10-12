# Étape 22 — Combat façon Zelda et PvP

**Prérequis** : 20
**Lire** : `docs/design/03-survie-combat.md` §Combat, §PvP ; `docs/design/10-graphismes-son.md` §Personnages
**Taille** : moyenne

## Objectif
On frappe dans la direction regardée avec l'objet en main ; la cible recule et clignote ; le PvP est possible partout
sauf dans la zone sûre.

## À faire
1. Attaque (Espace, clic gauche, bouton Frapper/Utiliser) quand l'objet en main est une arme ou rien : zone de coup
   d'une case devant le joueur, un peu plus large que lui ; délai entre deux coups selon l'arme ; dégâts de l'arme
   (main nue = 1).
2. Serveur : résolution des coups (entités dans la zone au moment du coup), dégâts via `damage()`, recul d'une
   demi-case (bloqué par les murs), 0,5 s d'invulnérabilité, usure de l'arme.
3. PvP : autorisé hors de la zone sûre (et plus tard hors des parcelles) ; dans la zone sûre, les coups ne blessent
   pas les joueurs.
4. Client : animation d'attaque immédiate (l'arme balaie par-dessus le personnage dans la bonne direction),
   clignotement de la cible, petits chiffres de dégâts.
5. Événements `entity.damaged` et `player.killed` (tueur, victime, qui a frappé en premier), utiles plus tard à la
   réputation (P7).

## Critères d'acceptation
- [ ] Deux joueurs hors de la zone sûre peuvent se battre ; dans la zone sûre, non.
- [ ] L'épée en bois fait plus mal que la main ; on ne frappe pas plus vite que le délai (vérifié côté serveur).

## Tests à écrire
- Zone de coup selon la direction du regard.
- Cadence des coups.
- PvP refusé dans la zone sûre.

## Hors périmètre
- Armes à distance et armures (plus tard), monstres (23).
