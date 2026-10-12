# Journal d'avancement

Tenu par Claude Code. Le plus récent en haut de l'historique.

## En cours
_Aucune étape en cours._

## À valider par l'humain
_Questions ou choix par défaut apparus pendant les étapes. Une fois tranchés, les reporter dans `docs/DECISIONS.md`._

- (00) Style de code Biome : indentation 2 espaces, guillemets simples, lignes de 100 caractères, fins de ligne LF
  (imposées par `.gitattributes`).
- (00) TypeScript 7.0 (le compilateur natif) a été pris comme « dernière version stable ». En cas de souci d'outillage,
  revenir à TypeScript 6.
- (00) Le WebSocket refuse les origines de navigateur absentes de `ALLOWED_ORIGINS` (403). Les clients sans en-tête
  `Origin` (bots, outils) sont acceptés.
- (00) Le serveur écoute sur `localhost` par défaut. Pour tester sur téléphone en réseau local (étape 09), il faudra
  `HOST=0.0.0.0`, l'origine du téléphone dans `ALLOWED_ORIGINS`, `VITE_SERVER_URL` et `vite --host`.
- (00) Le paquet client fait environ 1,6 Mo (Phaser) : Vite affiche un avertissement de taille. À traiter aux étapes
  de mise en ligne (25, 26).
- (00) Le serveur tourne avec `tsx` (pas de build serveur). Le mode d'exécution en production reste à choisir à
  l'étape 25.
- (00) L'auteur git du dépôt est « Ton Nom » : à corriger avec `git config user.name "…"`.

## Historique

### 2026-10-11 — Étape 00 : Monorepo et outillage ✅
- Monorepo pnpm (`apps/*`, `packages/*`), Node 24 (`engines`, `.nvmrc`), TypeScript strict, Biome, Vitest (projets).
- `@8box/shared` exporte `PROTOCOL_VERSION = 1`, consommé depuis les sources par le serveur et le client.
- Serveur Fastify 5 : `GET /health`, WebSocket `ws` sur `/ws` (ping → pong), `env.ts` validé par zod, logs pino
  (affichés par `pino-pretty` en dev).
- Client Vite 8 + React 19 + Phaser 4.2 (`pixelArt`, `BootScene` « 8Box ») ; bandeau Connecté / Hors ligne alimenté
  par un store Zustand, avec reconnexion automatique.
- CI GitHub Actions (`pnpm check`) ; `.env.example` et README.
- Écarts par rapport à la fiche :
  - En plus de la fiche : contrôle d'origine du WebSocket, taille maximale des messages, tests du ping/pong et de
    `env.ts`, `.gitattributes` (LF).
  - Les textes du bandeau sont en dur en français, comme prévu : l'étape 01 les remplace par des clés i18n.
  - `pnpm dev` utilise `pnpm --parallel`, sans dépendance supplémentaire.
- Environnement : Node.js 24.20.0 LTS (winget) et pnpm 12.11.2 (`npm -g`) installés sur le poste.
  - pnpm 12 bloque les scripts d'installation : seul `esbuild` est autorisé (`allowBuilds` dans
    `pnpm-workspace.yaml`).
  - pnpm propose d'« approuver » les skills agents de Phaser : non fait. On les lit directement dans
    `node_modules/phaser/skills/`.
