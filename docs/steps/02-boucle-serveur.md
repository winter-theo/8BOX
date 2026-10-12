# Étape 02 — Serveur : boucle, modules, entités, événements

**Prérequis** : 01
**Lire** : `docs/ARCHITECTURE.md` §6, §16
**Taille** : moyenne

## Objectif
Le squelette du serveur de jeu : une boucle à 20 Hz qui fait tourner les systèmes fournis par des modules, sur un
magasin d'entités, avec un bus d'événements.

## À faire
1. `core/loop.ts` : boucle à pas fixe (50 ms) avec rattrapage borné ; mesure du temps de tick (moyenne, maximum),
   exposée dans `/health`.
2. `core/module.ts` : interface `GameModule`, registre qui initialise les modules dans l'ordre de leurs dépendances,
   type `ServerContext`.
3. `core/entities.ts` : `EntityStore` (création, suppression, composants typés en `Map`, requêtes par composants) et
   index spatial par couche et par chunk, mis à jour quand une position change.
4. `core/events.ts` : catalogue typé des événements serveur et bus (émetteur typé de shared).
5. `core/scheduler.ts` : tâches périodiques (toutes les N secondes) et différées (dans N ticks), sans `setTimeout`
   dans la logique de jeu.
6. `createTestContext()` : contexte de test pour exercer un module sans réseau ni base.
7. Module d'exemple `modules/debug/` (journalise le nombre d'entités toutes les 10 s, désactivable par config).

## Critères d'acceptation
- [ ] Le serveur démarre, la boucle tourne, `/health` affiche le temps de tick moyen.
- [ ] Un module peut enregistrer un système et réagir à un événement (testé).
- [ ] `pnpm check` passe.

## Tests à écrire
- Ordre d'initialisation des modules (dépendances).
- Planificateur (tâches périodiques et différées).
- `EntityStore` : ajout, suppression, requêtes, index spatial après déplacement.

## Hors périmètre
- Protocole réseau du jeu (03), monde (04).
