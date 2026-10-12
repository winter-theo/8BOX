# Étape 20 — Vie, faim, mort et réapparition

**Prérequis** : 18
**Lire** : `docs/design/03-survie-combat.md` §Vie, §Faim, §Mort et réapparition
**Taille** : moyenne

## Objectif
Le personnage a des points de vie et une jauge de faim ; il mange ; à 0 PV il meurt, perd 10 % de son or (au sol) et
réapparaît à son lit ou au spawn.

## À faire
1. Composants `health` (20) et `hunger` (20). La faim baisse d'un point toutes les 90 s, plus vite quand on agit
   (fatigue des actions). Faim à 0 : −1 PV toutes les 10 s. Faim ≥ 16 : +1 PV toutes les 5 s.
2. Action « Manger » (objets `food`) : baies +2, pomme +4.
3. HUD : cœurs et jauge de faim en pixel art, sur PC et sur téléphone.
4. Fonction de dégâts générique `damage(entity, amount, source)` (réutilisée par le combat, étape 22).
5. Mort : événement `entity.died` ; 10 % de la bourse lâchés au sol (objet or) ; écran « Vous êtes mort » avec un
   bouton Réapparaître ; réapparition au lit (s'il existe encore) sinon au spawn ; 5 s d'invulnérabilité.
6. Sauvegarde des PV et de la faim.

## Critères d'acceptation
- [ ] Sans manger, la faim baisse, puis les PV ; manger la fait remonter.
- [ ] Mourir fait perdre 10 % de l'or, posé au sol et ramassable, puis réapparaître au bon endroit.

## Tests à écrire
- Baisse de la faim, dégâts de famine, régénération.
- Calcul de la perte d'or.
- Choix du point de réapparition (lit présent, lit détruit).

## Hors périmètre
- Combat (22), cuisine (P10).
