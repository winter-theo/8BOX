# Journal d'avancement

Tenu par Claude Code. Le plus récent en haut de l'historique.

## En cours
**Étape 04 — Génération du monde de surface** (démarrée le 2026-10-11, branche `step/04-generation-surface`)
- [x] 1. `shared/world` : types (couche, coordonnées, index de case), `Chunk` (3 `Uint16Array` + `meta`), codes de case
- [x] 2. Générateur de surface par chunk (simplex + hachage seedé) : eau, plages, rivières, prairies, forêt, clairière ; tests
- [x] 3. Serveur `world/World.ts` : génération au démarrage, `getTile` / `setTile` (chunk sale), `WORLD_SEED`, spawn
- [ ] 4. Outil `pnpm tools:map [seed] [fichier.png]`, réglage visuel de la génération, mesure du temps
- [ ] 5. Critères d'acceptation, clôture, PR et fusion

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
- (02) Deux nouvelles sections de config dans `shared` :
  - `LOOP` : rattrapage de 5 ticks au plus ; statistiques calculées sur les 100 derniers ticks (5 s).
  - `DEBUG` : log du nombre d'entités activé, toutes les 10 s.
- (02) `CONFIG` regroupe toutes les sections (`ctx.config.player…`). Son type `GameConfig` élargit les valeurs
  (`20` → `number`) pour que les tests puissent passer une autre config.
- (02) Le `dt` des systèmes est en secondes (0,05 à 20 Hz). Les tâches planifiées passent avant les systèmes.
- (02) `/health` renvoie `tick: { count, avgMs, maxMs, skipped }`, calculés sur les 100 derniers ticks.
- (02) Un seul logger pino, créé dans `main.ts` : Fastify l'utilise (`loggerInstance`) et le jeu reçoit un enfant
  (`scope: "game"`).
- (02) Le calcul des chunks (`chunkCoord`) vit pour l'instant dans `apps/server/src/core/spatial.ts`. L'étape 04 ou
  05 pourra le déplacer dans `shared/world/`, car le client en aura besoin.
- (02) Ids d'entité : des nombres qui augmentent et ne sont jamais réutilisés pendant une exécution. Ils ne sont ni
  sauvegardés ni durables.
- (02) Le planificateur parcourt toutes ses tâches à chaque tick. Il faudra un tas (heap) s'il en a des milliers.
- (03) Le même pseudo qui se reconnecte remplace l'ancienne session : l'ancien onglet reçoit
  `rejected { reason: 'replaced' }` et ne se reconnecte pas. On ne refuse pas le nouveau venu.
- (03) Mode dev : `pnpm dev` charge `apps/server/.env.development` (commité, `DEV_AUTH=1`), puis `.env`, qui le
  surcharge. Le mode dev est toujours ignoré en production.
- (03) Sans mode dev, il n'y a encore aucun moyen de se connecter (`devAuthDisabled`), en attendant Clerk (11).
- (03) Spawn provisoire au centre de la couche 0 (512, 512), en attendant le monde (04).
- (03) Limites de débit par client :
  - `hello` 3 par 10 s, `ping` 5 par s, `input` 30 par s ;
  - 50 messages ignorés par 10 s entraînent une déconnexion (code 1008).
- (03) Délais réseau :
  - `hello` attendu sous 10 s ;
  - battement toutes les 5 s, et coupure si le ping précédent est resté sans réponse ;
  - ping du client toutes les 2 s ;
  - reconnexion après 1, 2, 4… s, plafonnée à 30 s.
- (03) Les messages sont traités dès leur réception, entre deux ticks. L'étape 07 mettra les `input` en file, pour
  les traiter dans la phase `input`.
- (03) En dev, `?protocol=N` dans l'URL du client annonce une autre version, pour tester l'écran « Recharger ».
- (03) `welcome` ne contient pas encore l'heure du monde (étape 21), et `hello` pas encore le viewport (étape 05).

## Historique

### 2026-10-11 — Étape 03 : Protocole et connexions ✅
- Protocole dans `shared` :
  - messages client validés par zod (`hello`, `ping`, `input`) et messages serveur typés (`welcome`, `rejected`,
    `pong`) ;
  - codec msgpack.
- Serveur, `NetServer` :
  - une session par socket ;
  - validation des messages, et limites par type avec des seaux de jetons ;
  - message invalide ou trop fréquent ignoré, déconnexion en cas d'abus ;
  - battement (latence, connexions mortes), contrôle d'origine, fermeture propre.
- Mode dev (`DEV_AUTH`) et module `players` : entité joueur au spawn, `player.joined` / `player.left`, logs
  d'arrivée et de départ.
- Client :
  - `GameClient` : `hello`, `welcome`, ping affiché, reconnexion à délai croissant ;
  - écran de connexion de dev (pseudo mémorisé) et écran de refus (« Recharger » si la version est dépassée) ;
  - textes en FR et en EN.
- Vérifié dans le navigateur : Ana et Bob dans deux onglets, ping affiché, arrivées et départs journalisés,
  `?protocol=0` mène à l'écran « Recharger ».
- Écarts par rapport à la fiche :
  - Événements `session.authenticated` / `session.closed` : le module `players` y crée et retire le joueur.
  - Composant d'entité `player` (nom).
  - Tests du client (Vitest) en plus.
  - Fonctionnement Git : une branche et une PR par étape (`CLAUDE.md`, skill `/etape`). Les commits sont signés
    Théo Winter.

### 2026-10-11 — Étape 02 : Serveur : boucle, modules, entités, événements ✅
- Boucle à pas fixe (50 ms) avec rattrapage borné et mesure du tick (moyenne, maximum, ticks sautés), affichée
  dans `/health`. Mesure réelle : 20 ticks/s, environ 0,015 ms par tick.
- `GameModule` avec `dependsOn` (tri topologique, erreurs claires : doublon, dépendance inconnue, cycle).
  Systèmes par phase (`input` → `simulate` → `post` → `net`) ; un système qui plante est journalisé, les autres
  tournent quand même.
- `EntityStore` : composants typés dans des `Map`, requêtes par composants, et index spatial par couche et par
  chunk, mis à jour à chaque `set` de position. Recherche `near()`. Événements `entity.created` et `entity.removed`.
- Planificateur en ticks (`every`, `after`, `inTicks`, annulation), sans `setTimeout` dans la logique de jeu.
- `createTestContext()` (vrais services, logs muets, ticks à la main) et module `debug` (désactivable par
  `CONFIG.debug`).
- Écarts par rapport à la fiche :
  - Fichiers en plus : `core/game.ts` (assemble le contexte, les modules et la boucle), `core/spatial.ts`
    (index spatial) et `core/testing.ts`.
  - `EntityStore` accepte un catalogue de composants en paramètre de type, pour les tests.
  - `pino` devient une dépendance directe du serveur.

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
