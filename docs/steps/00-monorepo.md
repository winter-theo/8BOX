# Étape 00 — Monorepo et outillage

**Prérequis** : aucun
**Lire** : `docs/ARCHITECTURE.md` §2, §3, §12
**Taille** : moyenne

## Objectif
Un monorepo qui démarre avec `pnpm dev` : le serveur (Fastify + ws) et le client (Vite + React + Phaser 4) se lancent
et se parlent. La qualité est vérifiée par `pnpm check`, en local et en intégration continue.

## À faire
1. Si besoin `git init`. Créer `.gitignore` (node_modules, dist, coverage, `.env`, logs…), fixer la version de Node
   (`engines` et `.nvmrc`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`).
2. Racine : `package.json` avec les scripts `dev`, `build`, `test`, `typecheck`, `lint`, `format` et
   `check` (= typecheck + lint + test) ; `tsconfig.base.json` strict (`strict`, `noUncheckedIndexedAccess`) ;
   configuration Biome ; configuration Vitest pour le monorepo.
3. `packages/shared` (`@8box/shared`, ESM) : `src/index.ts` exporte `PROTOCOL_VERSION = 1`. Les apps le consomment
   directement depuis les sources (pas d'étape de build en développement).
4. `apps/server` (`@8box/server`) : Fastify avec `GET /health` → `{ ok: true, protocol: PROTOCOL_VERSION }` ;
   WebSocket `ws` sur `/ws`, attaché au serveur HTTP de Fastify, qui répond `pong` à `ping` ; `tsx watch` en dev ;
   `src/env.ts` (zod) ; logger pino.
5. `apps/client` (`@8box/client`) : Vite + React 19 + TypeScript ; composant `PhaserGame` qui monte Phaser 4
   (`pixelArt: true`) avec une scène `BootScene` affichant « 8Box » ; un petit bandeau React indique l'état de la
   connexion WebSocket (connecté / hors ligne).
6. `.env.example` pour le serveur et le client ; README racine court (installer, lancer, commandes).
7. CI GitHub Actions (`.github/workflows/ci.yml`) : installation pnpm avec cache, `pnpm check`.
8. Si les commandes réelles diffèrent de la section « Commandes » de `CLAUDE.md`, la mettre à jour.

## Critères d'acceptation
- [ ] `pnpm install` puis `pnpm dev` démarrent les deux apps ; la page affiche le canvas Phaser et l'état
      « connecté ».
- [ ] `GET /health` répond `{ ok: true, protocol: 1 }`.
- [ ] Le client et le serveur importent `PROTOCOL_VERSION` depuis `@8box/shared`.
- [ ] `pnpm check` passe, avec au moins un test dans shared et un dans le serveur.

## Tests à écrire
- Un test simple dans shared.
- Un test de la route `/health` avec `fastify.inject`.

## Hors périmètre
- Authentification (11), base de données (10), rendu du monde (05).

## Notes
- Installer la dernière version stable de chaque paquet, avec les versions majeures de ARCHITECTURE §2.
- Pour `pnpm dev`, lancer les apps en parallèle (`pnpm -r --parallel` ou un petit outil comme `concurrently`).
- Phaser 4 : en cas de doute sur l'API, consulter les « skills » du dépôt Phaser plutôt que l'API de Phaser 3.
