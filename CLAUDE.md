# 8Box

<!-- Lu par Claude Code au début de CHAQUE session : rester sous 200 lignes.
     Le détail vit dans docs/ et se lit à la demande. Ces commentaires HTML ne coûtent aucun token. -->

Jeu web de survie bac à sable multijoueur, vue de dessus en 3/4, pixel art 8×8.
Un seul monde persistant (10 à 100 joueurs sur liste blanche), jouable sur PC et sur téléphone.
Inspirations : Minecraft (survie), Dofus et RuneScape (social, économie), Project Zomboid (interactions),
RimWorld et The Escapists (bâtiments), Zelda vu de dessus (combat).

## Où trouver quoi
- `docs/ROADMAP.md` : phases et étapes, avec leur statut.
- `docs/steps/<id>-*.md` : la fiche de chaque étape. C'est LA référence pour coder une étape.
- `docs/design/*.md` : règles du jeu par système. Ne lire que les sections citées par la fiche.
- `docs/ARCHITECTURE.md` : choix techniques. Ne lire que les sections (§) citées par la fiche.
- `docs/DECISIONS.md` : décisions validées et valeurs par défaut.
- `docs/PROGRESS.md` : journal d'avancement (« En cours » en haut, historique ensuite).
- `ref/` : références de sprites fournies par l'auteur. Inspiration seulement, jamais copiées dans le jeu.
  Ne les ouvrir que si on le demande : leur résumé est dans `docs/design/10-graphismes-son.md`.

## Stack
- Monorepo pnpm, TypeScript strict partout, Node.js LTS (24+), ESM.
- `packages/shared` (`@8box/shared`) : contenu en données, config de gameplay, protocole,
  logique partagée (monde, déplacement, collisions, actions), i18n.
- `apps/server` (`@8box/server`) : serveur autoritaire. Fastify (HTTP) + ws (WebSocket),
  boucle de jeu à 20 Hz, monde en mémoire, PostgreSQL via Drizzle.
- `apps/client` (`@8box/client`) : Vite + React 19 (interface) + Phaser 4 (rendu), Zustand, i18next.
- Auth : Clerk Core 3 (`@clerk/react` côté client, `@clerk/backend` côté serveur).
- Tests : Vitest. Lint et format : Biome. Messages réseau : msgpack + validation zod.

## Commandes
<!-- L'étape 00 crée ces scripts ; la mettre à jour ici si elle s'en écarte. -->
- `pnpm dev` : serveur + client en mode développement.
- `pnpm check` : typecheck + lint + tests. Doit passer avant chaque commit.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format`.
- À partir de l'étape 10 : `pnpm db:up` (PostgreSQL dans Docker), `pnpm db:generate`, `pnpm db:migrate`.
- Outils : `pnpm tools:map` (carte du monde en PNG, étape 04), `pnpm tools:bots <n>` (clients robots, étape 08).

## Règles d'or
1. Le serveur fait foi. Le client envoie des intentions (inputs, actions), jamais des résultats.
2. Le contenu est de la donnée : un objet, une case, une recette, une créature s'ajoute dans
   `packages/shared/content/` sans toucher au moteur.
3. Pas de nombre magique : toute valeur de gameplay va dans `packages/shared/src/config/`, avec son unité.
4. Un système = un module serveur (`apps/server/src/modules/<nom>/`) enregistré dans le registre de modules.
   Les modules communiquent par événements typés, pas en s'important les uns les autres.
5. La logique que le client doit prédire (déplacement, collisions, `canPerform` des actions) vit dans `shared`.
6. Tout texte affiché passe par i18n, avec des clés en français ET en anglais.
7. Chaque message client est validé (zod) et soumis à une limite de débit.
8. Code, identifiants, commentaires et messages de commit en anglais ; docs en français.

## Façon de travailler (abonnement limité : économiser le contexte)
- Une étape = une session. L'utilisateur lance `/etape <id>`. Ne JAMAIS enchaîner sur l'étape suivante.
- Lire uniquement ce que la fiche demande. Pas d'exploration large : Glob et Grep ciblés.
- Modifier par petites éditions plutôt que réécrire des fichiers entiers.
- Commit après chaque sous-tâche (`step <id>: ...`) pour pouvoir reprendre si la session est coupée.
- Tenir `docs/PROGRESS.md` à jour (section « En cours », puis historique à la fin de l'étape).
- Décision de design manquante : choisir le plus simple, le mettre en config, le noter dans
  `docs/PROGRESS.md` (« À valider »), et continuer.
- Pas de nouvelle dépendance sans raison claire. Préférer du code simple et lisible.
- Ne pas modifier `docs/design/` ni `docs/ARCHITECTURE.md` sans le signaler dans `docs/PROGRESS.md`.
- Phaser 4 : en cas de doute sur une API, consulter les fichiers « skills » fournis par le dépôt Phaser
  plutôt que supposer l'API de Phaser 3. Ils sont installés dans `apps/client/node_modules/phaser/skills/<sujet>/SKILL.md`.
