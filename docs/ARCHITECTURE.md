# Architecture technique

Les fiches d'étapes citent ce document par section (§). Ne lire que les sections demandées.

---

## §1 Vue d'ensemble

```
[Navigateur, PC ou téléphone]
  React 19 (menus, HUD, admin) + Phaser 4 (monde) + Clerk (@clerk/react)
        │ HTTPS : API admin, santé, skins          │ WSS : jeu (msgpack)
        ▼                                          ▼
[Serveur Node : un seul processus]
  Fastify (HTTP) + ws (WebSocket)
  Boucle de jeu 20 Hz · modules · monde entier en mémoire
        │ file d'écriture, hors tick
        ▼
[PostgreSQL] joueurs, persos, chunks, journaux
```

- En développement : client sur le serveur Vite, serveur avec `tsx watch`, PostgreSQL dans Docker.
- En test en ligne gratuit : tout sur le PC du développeur, une URL publique via un tunnel Cloudflare (§15).
- En production : client sur Cloudflare Pages (`play.<domaine>`), serveur et base sur un VPS OVH à Beauharnois
  (`api.<domaine>`), Clerk sur `clerk.<domaine>` (§15).

---

## §2 Stack et versions

Installer la dernière version stable de chaque paquet au moment de l'étape 00, en respectant ces versions majeures
(vérifiées en octobre 2026).

| Rôle | Choix |
|---|---|
| Langage et outils | TypeScript strict, Node.js LTS (24+), pnpm (workspaces), ESM |
| Client | Vite (8+), React 19, Phaser 4 (4.1+), Zustand, i18next + react-i18next |
| Auth client | `@clerk/react` : SDK React de Clerk Core 3. L'ancien paquet `@clerk/clerk-react` est obsolète. |
| Serveur | Fastify 5, `ws`, `@msgpack/msgpack`, zod 4, pino |
| Auth serveur | `@clerk/backend` (`verifyToken`, client pour lire l'email) |
| Base de données | PostgreSQL 18 (Docker), Drizzle ORM + drizzle-kit, `pg` |
| Génération | `simplex-noise`, RNG seedé maison |
| Images | `pngjs` (export de carte, validation des skins) |
| Tests et qualité | Vitest, Biome |
| Production | Docker Compose, Caddy (TLS automatique), Cloudflare Pages, GitHub Actions, GHCR |

Phaser 4 est sorti en avril 2026 ; son API est proche de Phaser 3 mais le moteur de rendu a été refait. Le dépôt
Phaser fournit un dossier `skills/` destiné aux agents IA : le consulter en cas de doute plutôt que de supposer
l'API de Phaser 3.

---

## §3 Arborescence du monorepo

```
8box/
├─ CLAUDE.md
├─ .claude/                  skills (/etape, /planifier-phase, /corriger), rules, settings
├─ docs/                     design, architecture, feuille de route, fiches, journal
├─ ref/                      références de sprites de l'auteur (inspiration, jamais utilisées telles quelles)
├─ packages/shared/          @8box/shared
│  ├─ content/               données JSON : tiles, items, recipes, loot, creatures…
│  └─ src/
│     ├─ config/             valeurs de gameplay (world.ts, player.ts, combat.ts…)
│     ├─ content/            schémas zod, chargeur, registres
│     ├─ protocol/           messages client→serveur (zod), types serveur→client, codec msgpack
│     ├─ world/              coordonnées, couches, chunks, génération seedée
│     ├─ sim/                déplacement, collisions, lumière, règles partagées
│     ├─ actions/            définitions d'actions et canPerform
│     ├─ i18n/               fr.json, en.json
│     └─ util/               rng, maths, émetteur d'événements typé
├─ apps/server/              @8box/server
│  └─ src/
│     ├─ main.ts             démarrage Fastify + ws + boucle
│     ├─ env.ts              variables d'environnement (zod)
│     ├─ core/               boucle, modules, contexte, entités, événements, planificateur
│     ├─ net/                sessions, codec, limites de débit, intérêt (abonnement aux chunks)
│     ├─ world/              monde en mémoire, chunks sales, pièces et toits
│     ├─ modules/<nom>/      un dossier par système (movement, inventory, crafting, combat…)
│     ├─ db/                 schéma Drizzle, migrations, dépôts, file d'écriture
│     ├─ http/               routes admin, santé, développement
│     └─ tools/              export de carte PNG, bots
└─ apps/client/              @8box/client
   ├─ public/assets/         atlas.png + atlas.json (quand l'art existera)
   └─ src/
      ├─ main.tsx            React + Clerk + i18n
      ├─ game/               GameClient : réseau, état, prédiction, cache des chunks
      ├─ phaser/             config, scènes, rendu du monde et des entités, caméra, entrées
      ├─ ui/                 HUD, inventaire, craft, chat, menus, admin, contrôles mobiles
      ├─ assets/             registre de sprites, placeholders générés
      └─ store/              Zustand
```

---

## §4 Le monde

### Couches et taille
- Grille de cases de 8 × 8 px. Coordonnées de case entières ; positions d'entités en cases (nombres à virgule).
- Couches (`LayerId`) : `0` surface, `-1` mine, `1` étage. Toutes de même taille et alignées : une case (x, y) d'une
  couche est exactement sous ou sur la case (x, y) des autres.
- Taille par défaut : 1024 × 1024 cases par couche (`config.world.size`). Chunk = 32 × 32 cases, soit 32 × 32 chunks
  par couche.
- Les donjons (phase P9) sont des instances : des petits mondes séparés, créés à la demande.

### Contenu d'une case
Chaque case a trois emplacements, plus des métadonnées facultatives :
- `ground` : terrain naturel (herbe, terre, sable, eau peu profonde, eau profonde, pierre…) ;
- `floor` : sol posé (plancher…) ou 0 ;
- `object` : arbre, buisson, mur, porte, meuble, culture, minerai… ou 0 ;
- `meta` : table creuse par chunk (`Map<indexDeCase, objet>`) pour l'état d'une porte, des PV entamés,
  un propriétaire, l'id de pièce, un stade de croissance, un conteneur…

### En mémoire
- Chaque chunk = trois `Uint16Array` (index numériques d'exécution) + `meta`. Le monde entier tient en mémoire
  (≈ 6 Ko par emplacement et par chunk) : tous les chunks sont chargés au démarrage.
- Les index numériques ne sont jamais persistés. À la sauvegarde, chaque chunk enregistre sa propre palette
  (liste d'identifiants texte) et des indices dans cette palette : ajouter ou retirer du contenu ne casse pas les
  sauvegardes.

### Collisions
- Une définition de case peut être `solid`. L'eau profonde est infranchissable ; l'eau peu profonde ralentit.
- Les entités ont une boîte (perso : 0,6 × 0,6 case, ancrée aux pieds) testée contre les cases solides.

### Génération
- Seedée et déterministe, pensée « par chunk » : un chunk se génère seul à partir de la graine et de ses coordonnées
  (nécessaire pour la régénération).
- Surface : bruit simplex d'altitude et d'humidité → eau profonde, eau peu profonde, sable au bord de l'eau,
  herbe, terre ; rivières le long d'une isoligne de bruit ; forêt dense près du spawn ; buissons, hautes herbes, fleurs.
- Mine (P1) : pierre partout, grottes, minerais selon un bruit dédié.

### Spawn et zone sûre
- Spawn au centre de la carte, sur une clairière dégagée. Zone sûre : cercle de `config.world.safeZoneRadius` cases.

### Régénération (P12)
- Un chunk sans construction de joueur (`has_player_build = false`), hors parcelle et sans joueur proche est régénéré
  depuis la graine tous les `config.world.regenDays` jours.

---

## §5 Contenu en données

- Fichiers JSON dans `packages/shared/content/` : `tiles.json` (ground, floor, object), `items.json`, `recipes.json`,
  `loot.json`, `creatures.json`, puis d'autres au fil des phases.
- Chaque entrée a un `id` avec espace de noms (`base:oak_log`), un `sprite` (ID de sprite) et des propriétés typées.
  Les noms affichés viennent de l'i18n : `content.base.oak_log.name`.
- Schémas zod dans `src/content/schemas.ts` ; types TypeScript inférés.
- Chargement et validation au démarrage, côté serveur ET côté client, avec les mêmes fonctions. Une erreur de contenu
  arrête le chargement avec un message clair (fichier, id, champ).
- Registres : `content.items.get('base:oak_log')`, index numériques d'exécution assignés au chargement (tri par id).
- Les références croisées sont vérifiées (une recette qui cite un objet inexistant = erreur).
- Plus tard, d'autres dossiers de contenu (mods) pourront se charger après `base`.

Exemples :
```json
{ "id": "base:oak_tree", "slot": "object", "sprite": "obj.oak_tree", "solid": true, "tall": true,
  "hp": 6, "harvest": { "tool": "axe" }, "loot": "base:oak_tree" }
```
```json
{ "id": "base:wooden_axe", "sprite": "item.wooden_axe", "stack": 1,
  "tool": { "kind": "axe", "power": 2, "durability": 60 } }
```

---

## §6 Serveur : modules, entités, événements, actions

### Modules
```ts
interface GameModule {
  id: string;
  dependsOn?: string[];
  init(ctx: ServerContext): void;   // enregistre systèmes, actions, handlers de messages, commandes
}
```
`ServerContext` donne accès à : `world`, `entities`, `events`, `net`, `actions`, `commands`, `scheduler`,
`writeQueue` (base), `config`, `content`, `log`.

### Systèmes
Fonctions `(ctx, dt) => void` enregistrées avec une phase (`input` → `simulate` → `post` → `net`) et un ordre.

### Entités
- `EntityStore` maison (pas de librairie ECS) : identifiants numériques, composants dans des `Map<EntityId, T>`
  (position, motion, health, hunger, inventory, ai, groundItem…), requêtes par composants.
- Index spatial par chunk et par couche, mis à jour à chaque déplacement.
- Types d'entités : `player`, `groundItem`, `monster`, puis `animal`, `npc`…

### Événements
- Bus typé et synchrone. Le catalogue vit dans `core/events.ts`. Exemples : `player.joined`, `player.left`,
  `tile.broken`, `tile.placed`, `item.crafted`, `entity.damaged`, `entity.died`, `player.killed`,
  `container.opened`, `chat.message`.
- Un module réagit à un événement plutôt que d'appeler un autre module (ex. les compétences écoutent `tile.broken`).

### Actions (interactions façon Project Zomboid)
- Une action = `{ id, target: 'tile' | 'entity' | 'self', priority, durationMs?, labelKey, canPerform(ctx) }`
  définie dans `shared/actions/`, et un `perform(ctx)` enregistré côté serveur par le module propriétaire.
- Le menu contextuel liste les actions dont `canPerform` est vrai (ou grisées avec la raison) ; la touche d'action
  exécute celle de plus haute priorité.
- Le serveur re-vérifie `canPerform`, la portée (`config.interaction.reach`) et les délais avant `perform`.
- Une action avec durée s'annule si le joueur bouge ou s'éloigne.

### Commandes de chat
Registre `commands` : nom, arguments, permission (`player` ou `admin`), texte d'aide i18n.

---

## §7 Réseau

### Transport
- Un WebSocket par joueur sur `/ws` (attaché au serveur HTTP de Fastify), messages encodés en msgpack.
- Format : `{ t: '<type>', ...données }`. Constante `PROTOCOL_VERSION` dans shared.

### Handshake
1. Le client ouvre le socket et envoie `hello { version, token | devName, viewport }`.
2. Le serveur vérifie la version, le jeton Clerk (ou le mode dev), le statut du compte.
3. Réponse `welcome { you, tick, time, ... }`, ou `status { state: 'pending' | 'denied' | 'banned' | 'needsName' }`,
   ou `rejected { reason }` (ex. `outdated` : le client se recharge).

### Tick et messages
- Tick serveur : 20 Hz (50 ms). Ordre : inputs reçus → systèmes → envoi des snapshots.
- Client → serveur : `input { seq, dir }` (20 par seconde), `action { id, target }`, `craft`, `inventory`, `chat`,
  `viewport`…
- Serveur → client : `snapshot { tick, ackSeq, you, entities }` (seulement les entités visibles, champs compacts),
  `chunk`, `tileUpdate`, `inventory`, `chat`, `time`, `fx` (effets visuels et sonores).

### Prédiction et interpolation
- Joueur local : le client applique ses inputs tout de suite avec `shared/sim/movement.ts`, garde les inputs non
  acquittés, et à chaque snapshot repart de la position du serveur en rejouant ces inputs (réconciliation).
  Les petits écarts sont corrigés en douceur.
- Autres entités : interpolées environ 100 ms dans le passé, à partir d'un tampon de snapshots.

### Intérêt (ce que chaque client reçoit)
- Chaque session est abonnée aux chunks autour de son joueur, sur sa couche, dans un rayon calculé depuis son viewport
  et plafonné (`config.net.maxChunkRadius`).
- À l'abonnement : envoi du chunk complet. Ensuite : `tileUpdate` pour chaque changement. Les entités ne sont
  envoyées que si elles sont dans un chunk abonné.

### Débit
- Limites par type de message (ex. 30 inputs/s, 5 messages de chat par 10 s). Dépassement : messages ignorés,
  puis déconnexion en cas d'abus répété.

---

## §8 Persistance

- PostgreSQL + Drizzle. Migrations générées avec `drizzle-kit generate` et appliquées au démarrage du serveur.
- Tables du MVP :
  - `players` : id, clerk_user_id (unique), email, name (unique, insensible à la casse), status
    (`pending | approved | denied | banned`), role (`player | admin`), ban_reason, muted_until, created_at,
    last_seen_at ;
  - `characters` : player_id, layer, x, y, hp, hunger, inventory (jsonb), equipment (jsonb), spawn_point (jsonb),
    updated_at ;
  - `chunks` : layer, cx, cy (clé primaire), palette (jsonb), data (bytea), meta (jsonb), has_player_build, version,
    updated_at ;
  - `world_state` : clé, valeur (jsonb) — graine, horloge… ;
  - `reports`, `admin_audit`.
- Plus tard : `parcels`, `containers`, `access_log`, `guilds`, `guild_members`, `bounties`, `skins`, `shops`,
  `animals`…
- Le monde vit en mémoire. Les chunks modifiés sont marqués « sales » et écrits par lots toutes les
  `config.persistence.flushSeconds` (30 s) et à l'arrêt propre (SIGINT, SIGTERM). Les persos sont sauvés à la
  déconnexion et toutes les 60 s.
- Toutes les écritures passent par une file asynchrone traitée hors tick : aucun `await` dans la boucle de jeu.
- Production : `pg_dump` quotidien, conservation 7 jours + 4 semaines, restauration testée.

---

## §9 Authentification et liste blanche

- Client : `@clerk/react` (`<ClerkProvider>`), connexion Google uniquement (réglée dans le tableau de bord Clerk).
  Juste avant d'ouvrir le WebSocket, le client obtient un jeton de session (`getToken()`) et l'envoie dans `hello`.
- Serveur : `verifyToken` de `@clerk/backend` avec `authorizedParties` = origines autorisées. Le `sub` est
  l'identifiant Clerk. À la première connexion, l'email est lu via le client de l'API Clerk.
- Première connexion : création de la ligne `players` (status `pending`), puis choix du pseudo (3 à 16 caractères,
  lettres, chiffres et `_`, unique, filtré).
- Statuts : `pending` → écran d'attente ; `approved` → jeu ; `denied` et `banned` → écran explicatif.
- Admin : rôle en base, amorcé par la variable `ADMIN_EMAILS` (ces comptes sont `admin` et `approved`).
- API admin HTTP (`/admin/*`) : en-tête `Authorization: Bearer <jeton Clerk>`, puis vérification du rôle.
- Développement : instance Clerk « development » (fonctionne sur n'importe quelle adresse, y compris un tunnel).
  Production : instance « production » sur ton domaine, avec tes propres identifiants Google OAuth.
- Les jetons de session Clerk sont courts : ils ne servent qu'à l'ouverture du socket ; une reconnexion demande un
  nouveau jeton.

---

## §10 Client

### Structure
- `main.tsx` : `<ClerkProvider>` → i18n → `<App>`. Routes : `/` (jeu) et `/admin` (admin).
- `App` : non connecté → accueil avec bouton Google ; connecté → `GameScreen`, qui monte Phaser dans un `<div>` et
  superpose le HUD React.
- `game/GameClient.ts` : socket, codec, cache des chunks, entités, joueur prédit ; émet vers Phaser par l'`EventBus`
  et met à jour le store Zustand (au plus ~10 fois par seconde pour l'UI).

### Rendu en 3/4
- Config Phaser : `pixelArt: true`, arrondi des pixels, zoom de caméra en paliers entiers, borné pour ne jamais
  afficher plus de ~150 cases de large.
- Sol (`ground` + `floor`) : une texture par chunk (RenderTexture / DynamicTexture), redessinée quand une de ses
  cases change.
- Objets hauts et entités : sprites ancrés en bas de leur case, profondeur = Y ; un objet `tall` peut dépasser vers
  le haut (sprite 8 × 16). Pool de sprites recyclés au gré des chunks.
- Toits : calque au-dessus de tout, masqué en fondu sur la pièce où se trouve le joueur local.
- Lumière : calque d'obscurité (alpha selon l'heure, teinte bleutée la nuit) avec des halos doux autour des sources.

### Entrées
- Clavier via `event.code` (positions physiques). Souris : case visée à portée, clic droit = menu d'actions.
- Tactile : joystick virtuel React, boutons, appui long = menu d'actions, pincement = zoom.

### Assets
- `assets/registry.ts` associe un ID de sprite (`tile.grass`, `obj.oak_tree`, `item.wooden_axe`, `char.default`…) à
  une image de l'atlas (`public/assets/atlas.png` + `atlas.json`) ou, à défaut, à un placeholder dessiné par le code
  dans la palette provisoire.
- Remplacer l'art = fournir l'atlas, sans toucher au code.

---

## §11 Internationalisation

- `packages/shared/src/i18n/fr.json` et `en.json` : clés d'interface (`ui.inventory.title`) et de contenu
  (`content.base.oak_log.name`).
- Langue du navigateur au premier lancement, français si inconnue, changeable dans les options (mémorisée).
- Le serveur envoie des clés et des paramètres, jamais des phrases traduites (sauf le texte du chat).
- Un test vérifie que les deux fichiers ont exactement les mêmes clés et que chaque contenu a un nom.

---

## §12 Configuration et environnement

- Gameplay : `packages/shared/src/config/*.ts`, valeurs commentées avec leur unité. Les valeurs par défaut sont
  listées dans `docs/DECISIONS.md`.
- Serveur (`apps/server/.env`, validé par zod) : `PORT`, `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`
  (facultatif, vérification sans appel réseau), `ALLOWED_ORIGINS`, `ADMIN_EMAILS`, `WORLD_SEED` (facultatif),
  `DEV_AUTH`, `TIME_SCALE` (dev), `SERVE_CLIENT` (test en ligne).
- Client (`apps/client/.env`) : `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_SERVER_URL`.
- `.env.example` est tenu à jour à chaque nouvelle variable.

---

## §13 Tests et outils

- Vitest : logique de shared (génération déterministe, collisions, contenu, inventaire, recettes, protocole) et
  modules serveur testés avec `createTestContext()` (sans réseau ni base réelle).
- `pnpm tools:map [seed] [fichier.png]` : exporte une couche en PNG (1 pixel = 1 case) pour vérifier la génération sans
  lancer le jeu.
- `pnpm tools:bots <n>` : n clients sans affichage, connectés en mode dev, qui se déplacent au hasard.
- Mode dev : `DEV_AUTH=1` autorise `hello { devName }` sans Clerk. Refusé si `NODE_ENV=production`.
- `TIME_SCALE` (dev) accélère l'horloge du monde pour tester la nuit.
- Latence simulée côté client en dev (`?lag=150` dans l'URL).

---

## §14 Sécurité et anti-triche

- Tout est validé côté serveur : vitesse maximale, portée des actions, délais, possession des objets, permissions
  (zone sûre, parcelles, rôles).
- Le client ne reçoit que ce qui est à portée (chunks abonnés). Phase P13 : ne plus envoyer l'intérieur des pièces
  fermées aux joueurs qui sont dehors.
- Origines WebSocket et CORS vérifiées (`ALLOWED_ORIGINS`). HTTPS et WSS en production.
- Pseudos et chat filtrés. Fichiers envoyés (skins) validés et ré-encodés côté serveur.
- Journal d'audit pour toutes les actions admin.

---

## §15 Déploiement

### Test en ligne gratuit (≤ 10 joueurs, étape 25)
- Le serveur sert aussi le client compilé (`SERVE_CLIENT=1`) : une seule adresse.
- Serveur + PostgreSQL dans Docker sur le PC du développeur ; tunnel rapide Cloudflare :
  `cloudflared tunnel --url http://localhost:<port>` (adresse publique gratuite, WebSockets compris).
- Clerk en instance « development ».

### Production (étape 26)
- VPS OVH (VPS-1, Beauharnois, Québec), Ubuntu LTS, Docker Compose : `server`, `db` (PostgreSQL 18, volume, pas de
  port public), `caddy` (TLS automatique, `api.<domaine>` → server, WebSocket compris).
- Client : Cloudflare Pages, construit depuis GitHub, sur `play.<domaine>`. DNS chez Cloudflare.
- Clerk : instance « production » sur ton domaine (enregistrements DNS fournis par Clerk), tes identifiants Google OAuth.
- CI GitHub Actions : `pnpm check` à chaque push ; sur `main`, image Docker poussée sur GHCR puis déploiement par SSH
  (`docker compose pull && docker compose up -d`). Migrations au démarrage.
- itch.io : page vitrine avec un bouton « Jouer » vers `https://play.<domaine>`, prix « $0 or donate ».
  Le jeu n'est PAS hébergé sur itch.io : Clerk en production exige ton propre domaine, et Google refuse de
  s'afficher dans une iframe.

---

## §16 Budgets de performance

- Serveur : tick moyen < 10 ms avec 100 joueurs ; mémoire < 1 Go.
- Réseau : < 10 Ko/s par joueur en moyenne.
- Client : 60 FPS sur un téléphone de milieu de gamme au zoom par défaut ; premier chargement < 3 Mo.
