# 8Box

Jeu web de survie bac à sable multijoueur, vue de dessus en 3/4, pixel art 8×8.
La documentation du projet est dans [`docs/`](docs/) (feuille de route : [`docs/ROADMAP.md`](docs/ROADMAP.md)).

## Installer

Prérequis : [Node.js](https://nodejs.org/) 24 ou plus récent et [pnpm](https://pnpm.io/) 12.

```bash
pnpm install
```

Facultatif : copier `apps/server/.env.example` en `apps/server/.env` et `apps/client/.env.example` en
`apps/client/.env` pour changer les valeurs par défaut.

## Lancer

```bash
pnpm dev
```

- Client : <http://localhost:5173> (le bandeau en haut indique « Connecté » quand le serveur répond).
- Serveur : <http://localhost:3000/health> ; WebSocket sur `ws://localhost:3000/ws`.

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm dev` | Serveur et client en mode développement (rechargement automatique) |
| `pnpm build` | Build de production du client |
| `pnpm test` | Tests (Vitest) |
| `pnpm typecheck` | Vérification des types de tous les paquets |
| `pnpm lint` | Lint et format vérifiés par Biome |
| `pnpm format` | Corrige le format et l'ordre des imports |
| `pnpm check` | typecheck + lint + tests (à faire passer avant chaque commit) |

## Organisation

- `packages/shared` (`@8box/shared`) : code partagé entre client et serveur.
- `apps/server` (`@8box/server`) : serveur autoritaire (Fastify + ws).
- `apps/client` (`@8box/client`) : client web (Vite + React + Phaser 4).
