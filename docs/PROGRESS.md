# Journal d'avancement

Tenu par Claude Code. Le plus récent en haut de l'historique.

## En cours
**Étape 02 — Serveur : boucle, modules, entités, événements** (démarrée le 2026-10-11)
- [x] 1. Boucle à pas fixe (`core/loop.ts`), rattrapage borné, mesure du tick, tests
- [ ] 2. Planificateur (`core/scheduler.ts`) : tâches périodiques et différées en ticks, tests
- [ ] 3. `EntityStore` (`core/entities.ts`) et index spatial par couche et chunk, tests
- [ ] 4. Catalogue d'événements serveur et bus (`core/events.ts`)
- [ ] 5. Modules (`core/module.ts`) : `GameModule`, ordre par dépendances, systèmes par phase, `ServerContext`, tests
- [ ] 6. `createTestContext()` et test « un module enregistre un système et réagit à un événement »
- [ ] 7. Module `modules/debug/` (nombre d'entités toutes les 10 s, désactivable par config)
- [ ] 8. Démarrage dans `main.ts`, temps de tick dans `/health`, critères d'acceptation, clôture

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
- (01) Objets : `stack` est facultatif. Sans valeur, il vaut 99 (`INVENTORY.defaultStackSize`), ou 1 pour un outil
  ou une arme (`INVENTORY.toolStackSize`). L'or fixe le sien dans le contenu (1 000 000).
- (01) Cases : `hp: 0` signifie « incassable » (terrains). Le buisson à baies et l'eau profonde bloquent le passage.
  Les hautes herbes et les fleurs ne le bloquent pas.
- (01) Les valeurs propres à un objet ou une créature vont dans le contenu quand il est créé, pas dans la config.
  Exemples : outils et épée en bois, PV des murs, monstres, nourriture (baies +2 et pomme +4, déjà dans `items.json`).
  La torche prendra `LIGHT.defaultRadiusTiles` (6).
- (01) Le ralentissement en eau peu profonde (× 0,5) reste dans `PLAYER.shallowWaterSpeedFactor`. On pourra le
  passer dans la case `base:shallow_water` à l'étape 07.
- (01) Régénération « tous les 7 jours » : comprise comme 7 jours réels (`WORLD.regenerationIntervalMs`).
- (01) Pseudo : lettres ASCII seulement (sans accents), chiffres et `_`.
- (01) Recettes : un champ `id` a été ajouté. Une station est un id (`base:workbench`) fourni par une case (champ
  `station`), et le chargeur vérifie qu'une case la fournit. Types d'outils : `axe` et `pickaxe` pour l'instant.
- (01) Une case et un objet de même id partagent le même nom affiché (`content.base.<nom>.name`).
- (01) Le sélecteur de langue est provisoire, en haut à droite. Il ira dans le menu des options quand il existera.
- (01) Le paquet client passe à environ 1,74 Mo (zod et i18next en plus de Phaser).

## Historique

### 2026-10-11 — Étape 01 : Socle partagé : contenu, config, i18n ✅
- `shared` fournit un RNG seedé (mulberry32 et `hashSeed`) et un émetteur d'événements typé et synchrone.
- Schémas zod 4 stricts : cases, objets, recettes, et ébauches pour le butin et les créatures.
- `loadContent` construit des registres triés par id (index d'exécution stables). Il vérifie les références
  croisées et lève une `ContentError` qui liste chaque problème : fichier, id, champ.
- Contenu de base : 9 cases et 7 objets. Les recettes, le butin et les créatures sont vides. Le serveur le charge au
  démarrage (log « content loaded ») et le client aussi (console en dev).
- 15 fichiers de config avec les valeurs de `DECISIONS.md`, commentées avec leur unité (durées en ms).
- i18n FR/EN dans `shared`. Côté client : i18next, langue enregistrée sinon celle du navigateur, sinon le français.
  Le sélecteur garde le choix dans `localStorage`. Les textes de l'étape 00 passent par des clés.
- Écarts par rapport à la fiche :
  - La config a été faite avant les schémas, qui en ont besoin.
  - `stack` est facultatif, avec une valeur par défaut tirée de la config, et les recettes ont un `id`.
  - Les constantes réseau de l'étape 00 (taille maximale des messages, délai de reconnexion) sont passées dans `NET`.
  - En plus de la fiche : tests des schémas, test du contenu de base, helpers `contentNameKey`, `resolveLanguage`
    et `contentSizes`.

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
- Environnement : Node.js 24.20.0 LTS installé par winget, et pnpm 12.11.2 installé par l'utilisateur
  (`npm.cmd install -g pnpm@12.11.2`).
  - pnpm 12 bloque les scripts d'installation : seul `esbuild` est autorisé (`allowBuilds` dans
    `pnpm-workspace.yaml`).
  - pnpm propose d'« approuver » les skills agents de Phaser : non fait. On les lit directement dans
    `node_modules/phaser/skills/`.
