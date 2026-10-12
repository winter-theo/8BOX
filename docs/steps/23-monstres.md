# Étape 23 — Monstres de nuit

**Prérequis** : 21, 22
**Lire** : `docs/design/03-survie-combat.md` §Monstres ; `docs/ARCHITECTURE.md` §6
**Taille** : grosse (si besoin : 23a apparition et IA de base, 23b poursuite, casse des murs et butin)

## Objectif
La nuit, des monstres apparaissent autour des joueurs connectés, loin de la lumière ; ils poursuivent, attaquent,
cassent un mur s'il le faut pour atteindre leur cible, et laissent de l'or en mourant.

## À faire
1. `creatures.json` : Gluant et Rôdeur (PV, dégâts, vitesse, délai d'attaque, sprite placeholder, butin), avec leurs
   objets (`base:slime_gel`, `base:fang`).
2. `modules/spawning/` : la nuit, apparition dans un anneau de 18 à 32 cases autour de chaque joueur connecté, sur une
   case non éclairée (`isLit`), hors zone sûre, pas sur l'eau ; plafonds de 6 par joueur et 150 au total.
3. `modules/ai/` : errance ; repérage d'un joueur à 10 cases ; poursuite avec A* sur la grille (rayon borné, recalcul
   au plus deux fois par seconde) ; attaque au contact avec délai ; abandon si la cible s'éloigne trop.
4. Murs : si le chemin vers la cible poursuivie est bloqué par un mur ou une porte, le monstre frappe l'obstacle
   (PV de la construction). Jamais sans cible.
5. Aube : 80 % des monstres disparaissent dans les 3 premières minutes du jour ; tout monstre à plus de 64 cases de
   tout joueur pendant 60 s disparaît.
6. Butin : or (1 à 3 ou 2 à 5) et objets. Les monstres ne sont pas sauvegardés.

## Critères d'acceptation
- [ ] Avec le temps accéléré, la nuit, des monstres arrivent hors des zones éclairées et jamais dans la zone sûre ;
      ils attaquent, meurent et laissent de l'or.
- [ ] Un monstre ne frappe un mur que s'il poursuit un joueur situé derrière.
- [ ] 20 bots plus les monstres : tick serveur moyen < 10 ms.

## Tests à écrire
- Règles d'apparition (lumière, zone sûre, eau, plafonds).
- A* (chemin trouvé, obstacle, cible inaccessible).
- Décision de frapper un mur.

## Hors périmètre
- Monstres de la mine (P1), animaux (P5).
