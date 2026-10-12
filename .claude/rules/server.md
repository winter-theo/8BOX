---
paths:
  - "apps/server/**"
---

# Règles pour apps/server

- Le serveur fait foi : ne jamais faire confiance à une position, un dégât, un contenu d'inventaire ou un résultat
  envoyé par le client. Il re-vérifie portée, délais, possession et permissions.
- Une fonctionnalité = un module dans `src/modules/<nom>/` dont `index.ts` exporte un `GameModule`.
  Les modules communiquent par le bus d'événements et les services du `ServerContext`, pas en s'important entre eux.
- La boucle de jeu (20 Hz) ne fait JAMAIS d'I/O ni d'`await` : les écritures en base passent par la file d'écriture,
  traitée hors tick.
- Toute action d'un joueur passe par le registre d'actions : `canPerform` (partagé, dans shared) puis `perform` (serveur).
- Messages entrants : schéma zod + limite de débit par type. Message invalide = ignoré et journalisé, jamais de plantage.
- Journalisation avec le logger (pino). Pas de `console.log`.
- Accès à la base uniquement dans `src/db/` (schéma Drizzle, dépôts `*.repo.ts`).
- Variables d'environnement lues et validées (zod) dans `src/env.ts` uniquement. Toute nouvelle variable va aussi
  dans `.env.example`.
- Tester les modules avec `createTestContext()` (sans réseau ni base réelle).
