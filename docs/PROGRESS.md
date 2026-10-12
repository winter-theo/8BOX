# Journal d'avancement

Tenu par Claude Code. Le plus récent en haut de l'historique.

## En cours
**Étape 00 — Monorepo et outillage** (démarrée le 2026-10-11)
- [x] 1. Git, `.gitignore`, version de Node (`engines`, `.nvmrc`), `pnpm-workspace.yaml`
- [x] 2. Racine : `package.json` (scripts), `tsconfig.base.json` strict, Biome, Vitest
- [ ] 3. `packages/shared` : `PROTOCOL_VERSION = 1` + test
- [ ] 4. `apps/server` : Fastify `/health`, ws `/ws` (ping → pong), `env.ts` (zod), pino, test `/health`
- [ ] 5. `apps/client` : Vite + React 19 + Phaser 4 (`BootScene` « 8Box »), bandeau d'état WebSocket
- [ ] 6. `.env.example` (serveur, client) et README racine
- [ ] 7. CI GitHub Actions (`pnpm check`)
- [ ] 8. Vérifier les critères d'acceptation, mettre à jour « Commandes » de `CLAUDE.md` si besoin

Notes :
- Node.js 24.20.0 LTS (winget) et pnpm 12.11.2 (npm -g) installés sur le poste pendant l'étape.

## À valider par l'humain
_Questions ou choix par défaut apparus pendant les étapes. Une fois tranchés, les reporter dans `docs/DECISIONS.md`._

## Historique
_Vide pour l'instant. Première étape : `/etape 00`._
