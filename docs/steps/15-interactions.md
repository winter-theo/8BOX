# Étape 15 — Interactions : visée, action, menu

**Prérequis** : 14
**Lire** : `docs/design/04-craft-construction.md` §Interactions ; `docs/design/02-joueur.md` §Visée ;
`docs/ARCHITECTURE.md` §6 (Actions)
**Taille** : moyenne

## Objectif
Le système d'actions façon Project Zomboid : on vise une case, la touche E fait l'action principale, et le menu
d'actions liste tout ce qui est possible.

## À faire
1. `shared/actions/` : registre d'actions (id, cible `tile | entity | self`, priorité, durée éventuelle, clé i18n,
   `canPerform(ctx)` qui renvoie oui ou non avec une raison). Premières actions : « Ramasser » (objet au sol),
   « Examiner » (affiche le nom de la chose visée).
2. Visée : case devant le joueur ; sur PC, case sous la souris si elle est à portée (`interaction.reach`) ;
   surbrillance de la case visée.
3. Client : E (et bouton Action sur téléphone) → action principale ; clic droit (PC) ou appui long (téléphone) → menu
   d'actions en React près de la case, actions impossibles grisées avec la raison ; barre de progression pour les
   actions qui durent.
4. Serveur : `action { id, target }` → re-vérification de la portée, de `canPerform` et du délai → `perform` du module
   propriétaire. Une action qui dure s'annule si le joueur bouge.
5. « Utiliser l'objet en main » (Espace, clic gauche, bouton Frapper/Utiliser) : point d'entrée unique qui choisira
   l'action selon l'objet tenu (complété aux étapes 16, 17, 18, 20 et 22).

## Critères d'acceptation
- [ ] Le menu s'ouvre au clic droit et à l'appui long, avec les bonnes actions selon la chose visée.
- [ ] Une action hors de portée est refusée par le serveur même si le client l'envoie (testé).

## Tests à écrire
- Choix de la case visée (regard, souris, portée).
- Filtrage `canPerform` et ordre de priorité.
- Refus serveur hors de portée.

## Hors périmètre
- Les actions métier : récolte (16), craft (17), construction (18), manger (20), combat (22).
