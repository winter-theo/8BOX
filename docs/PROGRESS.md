# Journal d'avancement

Tenu par Claude Code. Le plus récent en haut de l'historique.

## En cours
### Étape 13 : Chat, filtre et signalements (branche `step/13-chat`)
- [x] Protocole 7 et `shared` : messages `chat` et `chatNotice`, listes de mots FR et EN (config), tests.
- [x] Serveur `modules/chat/` : proximité (16 cases, même couche), privé (`/msg`, `/r`, `to`), 200 caractères,
  limite de débit, filtre, joueurs mutés ; tests.
- [x] Base : table `reports`, `muted_until` dans le compte, durée dans le journal (migration) ; commande
  `/signaler` (et `/report`) avec les 20 derniers messages vus ; tests.
- [x] API admin : signalements (liste, traiter, classer), muter X minutes, rendre la parole ; tests.
- [ ] Client : panneau de chat (Entrée, historique, onglets Proximité et Privé, bouton sur téléphone), bulles
  au-dessus des têtes (5 s, texte tronqué), textes FR et EN ; tests.
- [ ] Onglet admin : signalements avec leur contexte, muter et rendre la parole.
- [ ] Vérification dans le navigateur, clôture.

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
  passer dans la case `base:shallow_water` à l'étape 07 (fait : champ `speedFactor`).
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
- (04) Les réglages de génération sont dans `WORLDGEN` (config de `shared`), ajustés à l'œil sur les cartes PNG.
  Résultat pour la graine « 8box » :
  - 20 % d'eau (6 % profonde), 9 % de sable, 10 % de terre ;
  - 6,6 % de chênes, 1 % de buissons à baies, 5,5 % de hautes herbes, 2,4 % de fleurs.
- (04) Les rivières sont en eau peu profonde, donc traversables lentement. En eau profonde, elles couperaient la carte
  en îles, et il n'y a pas de pont dans le MVP. Seuls les centres des lacs sont en eau profonde.
- (04) Autour du spawn (centre de la carte, case 512 + 0,5) :
  - clairière de 6 cases, toujours en herbe et sans objet ;
  - forêt dense sur environ 70 cases ;
  - pas de rivière à moins de 45 cases ;
  - terrain surélevé sur 90 cases, pour éloigner les lacs.
- (04) Sans `WORLD_SEED`, la graine est tirée au hasard et écrite dans le log au démarrage. Elle sera stockée en base à
  l'étape 10. Une graine en texte est hachée (« 8box » donne 2563337752).
- (04) Codes de case dans les `Uint16Array` : index d'exécution + 1, et 0 pour une case vide. Ils ne sont jamais
  sauvegardés.
- (04) Les couleurs de `tools:map` sont des couleurs de débogage, pas le rendu du jeu.
- (04) `tsx` est ajouté à la racine pour lancer l'outil depuis le dossier du projet. Les images `map-*.png` sont
  ignorées par git.
- (04) `createTestContext()` utilise par défaut un petit monde de 64 × 64 cases (graine 1), pour que les tests
  restent rapides.
- (05) Message `chunk` : une palette d'ids de case propre au chunk, puis 1 octet par case et par emplacement (2 si la
  palette dépasse 256). Cela fait environ 3 Ko par chunk, soit environ 50 Ko pour les 16 chunks du départ au
  zoom 4. Pas de compression pour l'instant (permessage-deflate possible plus tard, voir §16).
- (05) Intérêt :
  - zone visible calculée depuis le viewport (pixels CSS / (zoom × 8)), plus 1 chunk d'avance ;
  - un chunk n'est libéré qu'à 1 chunk au-delà, pour éviter le clignotement en bordure ;
  - plafond de 3 chunks autour du chunk central ;
  - 4 chunks envoyés par tick et par client au plus, les plus proches d'abord.
- (05) Caméra de debug, en mode dev seulement :
  - message `debugCamera` ; le serveur centre alors la diffusion sur la caméra au lieu du joueur ;
  - flèches à 40 cases/s ;
  - zoom de 1 à 8 (4 au départ), avec + / - (selon le symbole imprimé, `event.key`) ou la molette.
  - Remplacée à l'étape 06 par un personnage de test (voir plus bas).
- (05, retouche des tuiles) La palette PICO-8 est remplacée par une palette sourde de 24 couleurs, inspirée des
  images envoyées par l'auteur. `docs/design/10-graphismes-son.md` parle encore de PICO-8 : à mettre à jour si
  tu valides. Un seul fichier à modifier : `apps/client/src/assets/palette.ts`.
- (05, retouche) Bordures automatiques entre sols, du plus bas au plus haut : eau profonde < eau peu profonde < sable
  < terre < herbe. Le sol le plus haut déborde sur le plus bas, avec un liseré. L'eau a de l'écume le long des rives,
  et l'herbe a des zones plus denses. Les coins saillants restent carrés : il faudrait découper la case du dessus.
- (05, retouche) Le son de Phaser est coupé (`audio.noAudio`) jusqu'à la phase P13. Cela évite des erreurs
  d'`AudioContext` fermé quand React remonte le jeu en dev.
- (05) Atlas : chargé seulement si `assets/atlas.json` existe (requête HEAD au démarrage). Les noms de frames sont
  les ids de sprite du contenu (`ground.grass`…). Le design parle de `tile.grass`, mais j'ai gardé les ids du
  contenu.
- (05) `PROTOCOL_VERSION` passe à 2 (`welcome` donne la position du joueur, et de nouveaux messages sont apparus).
- (06) Placeholders des objets : chêne 8 × 16 (3 variantes, dont une avec des pommes), buisson à baies (2), hautes
  herbes (3), fleurs (3), mur et porte en bois 8 × 16 (`obj.wooden_wall`, `obj.wooden_door`, pas encore dans le
  contenu : étape 18), personnage `char.default` (une seule image). Nouvelle couleur `skin` dans la palette.
- (06) Tri en profondeur : la profondeur d'un sprite est le Y de ses pieds, en pixels du monde. À Y égal, une entité
  passe devant un objet. Un objet est ancré au milieu du bas de sa case (un sprite d'atlas plus large que 8 px reste
  centré sur sa case).
- (06) Zoom :
  - au plus 150 cases sur le plus **long** côté de la vue (la fiche dit « de large ») : zoom ×2 au minimum en
    1280 × 720 ;
  - au départ, la largeur / 320 arrondie (≈ 40 cases) : ×4 en 1280 px, ×6 en 1920 px. `VIEW.maxZoom` reste à 8 :
    un écran de 3840 px CSS de large verra donc 60 cases ;
  - tant que le joueur n'a pas zoomé, un redimensionnement reprend le zoom par défaut ; ensuite son choix est
    gardé, borné ;
  - + et − : un palier par appui, la répétition automatique est ignorée. Pincement : un palier quand l'écart entre
    les doigts change de 25 % (`VIEW.pinchStepRatio`) ;
  - la molette ne zoome plus : d'après le design 02, elle choisira l'objet de la barre.
- (06) Mode dev : la caméra libre devient un personnage de test, déplacé aux flèches (Maj : 3 cases/s) et suivi
  par la caméra. Le serveur diffuse toujours les chunks autour de lui. L'encart dev affiche les FPS, le zoom et le
  nombre de sprites d'objets.
- (06) Pool d'objets : les sprites libérés restent dans la liste d'affichage de Phaser, cachés, et le pool ne
  rétrécit jamais. Autour du spawn, la vue par défaut compte environ 5 400 sprites d'objets (16 chunks), et 6 700
  au zoom ×2.
- (06) FPS mesurés : 58 à 60 dans le navigateur intégré, à tous les zooms. Comme ce panneau était caché, la boucle
  tournait sur `setTimeout` le temps de la mesure. **À confirmer sur ton PC** avec l'encart dev.
- (06) Écran à `devicePixelRatio` non entier (1,25 ou 1,5, fréquent sur les portables Windows) : le canvas est
  à la taille CSS et agrandi par le navigateur en « pixelated ». Pas de flou, mais des pixels de tailles inégales.
  Rendre à la résolution de l'écran reste à étudier.
- (06) Phaser rejoue les touches d'une même image à chaque nouvel événement clavier. Les touches de zoom passent
  donc par les événements DOM de `window`.
- (07) Ralentissement : nouveau champ de contenu `speedFactor` sur les cases (0,5 sur l'eau peu profonde).
  `PLAYER.shallowWaterSpeedFactor` est supprimé. Si un sol est posé (`floor`), c'est son facteur qui compte.
- (07) Boîte de collision : carré de 0,6 case centré sur les pieds. En 3/4, le personnage se tient devant un tronc
  (il le recouvre) ou derrière (le feuillage le cache).
- (07) Directions : `dir` vaut 0 à l'arrêt, puis 1 à 8 dans le sens horaire en partant du haut. Regard :
  - c'est la dernière direction de déplacement, et il change même contre un obstacle ;
  - en diagonale, il garde son côté actuel s'il fait partie de la diagonale, sinon il prend le côté horizontal.
- (07) Inputs :
  - le client en envoie 20 par seconde seulement en marchant, plus un input « à l'arrêt » quand il s'arrête ;
  - le serveur en applique un par tick. La file est bornée à 4 (`NET.maxQueuedInputs`) : au-delà, les plus
    anciens sont jetés. Un `seq` répété ou en retard est ignoré ;
  - un tick sans input ne fait pas bouger : pas d'extrapolation. Avec de la gigue réseau, le mouvement peut donc
    saccader. La prédiction et l'interpolation (08) lisseront.
- (07) `snapshot` part à chaque tick vers chaque joueur, même sans changement (environ 40 octets). Les autres
  entités viendront à l'étape 08. `PROTOCOL_VERSION` passe à 3. `debugCamera` devient `{ at }`, avec `at: null`
  pour revenir au joueur.
- (07) Sans prédiction, le joueur avance par pas d'un quart de case toutes les 50 ms : c'est visible, et attendu
  jusqu'à l'étape 08. La caméra le suit sans lissage.
- (07) Mode dev :
  - F2 active ou coupe la caméra libre (flèches, Maj pour aller lentement). Pendant ce temps, le joueur ne bouge
    pas ;
  - le personnage de test de l'étape 06 disparaît ;
  - l'encart dev affiche la position du joueur.
- (07) Les flèches n'agissent plus sur la page (`preventDefault`) : sinon elles la feraient défiler.
- (07) FPS : le panneau du navigateur intégré, caché, ralentit les minuteurs. La mesure va de 37 à 61 FPS, mais
  une image ne coûte que 1,7 ms en moyenne (2,3 ms au plus) avec environ 5 500 sprites. **À confirmer sur ton PC.**
- (08) Entités dans `snapshot` : `{ id, kind, x, y, facing, anim }`, plus `name` la première fois seulement, et
  `gone` quand une entité sort de la vue. Coût : environ 55 octets par entité et par tick (chaînes de caractères,
  flottants sur 8 octets), soit environ 22 Ko/s par client avec 20 entités visibles. Optimisations possibles plus
  tard : arrondir les positions, enums numériques, n'envoyer que les changements.
- (08) « Visible » veut dire « dans un chunk reçu par le client » : jusqu'à 7 × 7 chunks autour de lui, donc
  au-delà de l'écran.
- (08) Pseudos : affichés au-dessus des autres joueurs, pas au-dessus de soi. Police pixel 3 × 6 avec contour,
  dessinée par le code (`assets/pixelFont.ts`) : un pixel de police vaut un pixel du monde, elle suit donc le zoom.
  Les pseudos passent par-dessus tout, arbres compris.
- (08) Prédiction :
  - le premier input part dès l'appui sur une touche, puis 20 par seconde ;
  - l'affichage glisse d'un pas prédit au suivant, donc avec 50 ms de retard sur la prédiction, mais sans saccade ;
  - une correction de moins de 2 cases s'efface en douceur (80 ms), une plus grande est appliquée d'un coup ;
  - un chunk pas encore reçu compte comme solide.
- (08) Interpolation des autres entités :
  - 100 ms dans le passé (`NET.interpolationDelayMs`) ;
  - les instants viennent des ticks du serveur, recalés sur les arrivées les plus rapides : la gigue réseau ne
    fait pas saccader ;
  - pas d'extrapolation.
- (08) `?lag=N` (dev) : N ms d'aller-retour, la moitié dans chaque sens, 2 000 ms au plus.
- (08) `pnpm tools:bots <n> [url]` : bots nommés `bot_01`, etc. Chacun a une petite vue, change de direction
  toutes les 0,8 à 3 s et s'arrête une fois sur cinq. Ctrl+C pour les arrêter.
- (08) Mesuré avec 20 bots et 2 navigateurs : tick serveur moyen d'environ 1 ms (6 ms au plus), aucun tick sauté.
- (08) Architecture :
  - le module `movement` n'envoie plus les snapshots : c'est le nouveau module `snapshots` ;
  - nouveaux composants `anim` et `inputAck` ; la session porte ses chunks abonnés (`session.chunks`) ;
  - côté client, les événements `player.spawned`, `player.moved` et `player.despawned` disparaissent : Phaser lit
    `gameClient.localView()` et `remoteViews()` à chaque image.
- (08) Phaser 4 : `RetroFont.Parse` renvoie l'entrée de cache complète, contrairement à Phaser 3 et à l'exemple de
  la fiche « skills ».
- (09) Mode tactile : détecté par `(pointer: coarse)` (téléphones et tablettes). Un PC à écran tactile reste au
  clavier. En dev, `?touch=1` force les contrôles tactiles.
- (09) Joystick « flottant » :
  - il apparaît sous le pouce, dans une grande zone à gauche (45 % de la largeur, au-dessus de la barre d'objets) ;
  - rayon de 56 px, zone morte de 25 %, 8 secteurs de 45° ;
  - le bouton du joystick bouge par le DOM, sans re-rendu React.
- (09) Boutons :
  - Frapper (84 px), Action et Sac (60 px) émettent `input.button`, que rien ne traite encore (étapes 14, 15
    et 22) ;
  - « Sac » plutôt qu'« Inventaire », pour tenir dans le bouton ;
  - le bouton de chat en haut (design 02) viendra avec l'étape 13.
- (09) Appui long :
  - 500 ms ; annulé si le doigt bouge de plus de 12 px ou si un second doigt se pose (pincement) ;
  - bulle de debug en dev seulement : rien en production avant l'étape 15, qui vérifiera aussi la portée.
- (09) Plein écran : bouton en haut à gauche ; il verrouille le paysage quand le navigateur le permet (Android). Il
  est masqué quand c'est impossible (iPhone). En portrait, « Tourne ton téléphone » couvre tout, écran de connexion
  compris.
- (09) Gestes du navigateur bloqués :
  - `touch-action: none`, pas de défilement élastique, pas de sélection ni de menu d'appui long ;
  - balise viewport `maximum-scale=1` et `user-scalable=no`, `gesturestart` bloqué pour iOS ;
  - menu contextuel bloqué sur le jeu en mode tactile.
- (09) Sur un téléphone en paysage (740 px de large), le zoom par défaut est ×2, soit environ 46 cases de large :
  les sprites sont petits. Faut-il un réglage par défaut propre aux téléphones (environ 30 cases, par exemple) ?
- (09) Vérifié seulement en émulation Chrome, avec des touchers simulés : pas encore sur un vrai téléphone. Pour
  tester sur ton téléphone en réseau local, voir la note (00) sur `HOST=0.0.0.0`.
- (09) `.claude/launch.json` a maintenant deux entrées, `server` (port 3000) et `client` (5173) : l'outil d'aperçu
  impose `PORT` à chaque processus.
- (10) Toute la surface est enregistrée à la création du monde (1 024 chunks, environ 3 Mo). Un monde existant ne
  dépend donc plus du générateur : modifier la génération ne change que les nouveaux mondes. Pour repartir de zéro,
  il faut supprimer le volume (`pnpm db:down`, puis `docker volume rm 8box_db-data`). Charger le monde depuis la
  base prend environ 90 ms, contre environ 1 s pour le générer.
- (10) Une case enregistrée dont l'id a disparu du contenu devient vide, avec un avertissement au démarrage.
- (10) Joueurs en mode dev :
  - créés en base au premier enregistrement de leur personnage, avec le statut `approved` ;
  - nom insensible à la casse (« Ana » et « ana » sont le même joueur) ; Clerk (étape 11) les reliera aux comptes ;
  - une position enregistrée hors de la carte renvoie au spawn.
- (10) Colonnes `hp` et `hunger` vides jusqu'à l'étape 20 ; `inventory` et `equipment` vides. Les tables
  `reports` et `admin_audit` (ARCHITECTURE §8) viendront avec leurs étapes (12, 13).
- (10) File d'écriture :
  - ce qui est mis en file pendant un même tick part ensemble ;
  - lots de 100 chunks au plus (`PERSISTENCE.chunkWriteBatchSize`) ;
  - après une erreur de la base, nouvel essai 5 s plus tard ;
  - à l'arrêt, attente de 10 s au plus.
- (10) `DATABASE_URL` est obligatoire en production ; en dev, elle vaut par défaut la base de `docker-compose.yml`.
  La route `POST /dev/tile` existe hors production, même sans `DEV_AUTH`.
- (10) Sous Windows, quand `tsx watch` redémarre le serveur (ou quand l'outil d'aperçu l'arrête), le processus est
  tué sans SIGINT : les changements des 30 dernières secondes peuvent être perdus. Ctrl+C dans un terminal déclenche
  bien la sauvegarde finale (à vérifier chez toi).
- (10) Docker Desktop doit tourner pour `pnpm dev`. Sans base, le serveur s'arrête avec le message « database
  unavailable (is it started? pnpm db:up) ».
- (10) Biome ignore `apps/server/drizzle/` (migrations générées).
- (11) Le bouton « Se connecter avec Google » ouvre la fenêtre de Clerk, qui propose « Continue with Google » :
  un clic de plus. Aller directement à Google demanderait une page de retour. La fenêtre de Clerk est en anglais
  (`@clerk/localizations` pourrait la traduire).
- (11) Après la connexion Google, le jeu se connecte tout seul. Si la session Google est déjà ouverte, l'accueil
  affiche « Jouer ».
- (11) Pseudo :
  - format (3 à 16 caractères : lettres, chiffres, `_`), unique sans tenir compte de la casse ;
  - courte liste de mots interdits en français et en anglais (`shared/moderation/names.ts`) : les mots longs sont
    refusés n'importe où, les mots courts seulement comme partie entière du nom (« pute » n'est pas refusé dans
    « Computer ») ; noms réservés : admin, modérateur, modo, mod, gm, staff, system, server. Liste à compléter ;
  - le joueur ne peut pas le changer lui-même (l'admin le pourra à l'étape 12).
- (11) Les emails de `ADMIN_EMAILS` sont admins et approuvés dès leur connexion. Un compte existant est promu à sa
  connexion suivante.
- (11) En attente : la connexion reste ouverte, mais après une validation en SQL il faut recharger la page. La
  notification en direct viendra avec l'onglet admin (étape 12). Refusé ou banni : message, puis déconnexion, sans
  nouvel essai.
- (11) Mode dev conservé : un pseudo de dev crée un joueur approuvé en base (sans compte Clerk). Un pseudo de dev
  égal à celui d'un joueur Google se connecte sur ce compte (en local seulement).
- (11) `CLERK_SECRET_KEY` est obligatoire en production. Sans elle en dev, seuls les pseudos de dev marchent.
  `CLERK_JWT_KEY` est facultative (vérification sans appel réseau). `PROTOCOL_VERSION` passe à 5.
- (11) Le bouton « Se déconnecter », en haut à droite à côté de la langue, n'apparaît que pour une session Google.
- (11) Côté serveur, la connexion est maintenant asynchrone (base, Clerk), mais en dehors des ticks. Les tests
  attendent la fin des promesses avec `settle()`.
- (11) Ton email est dans `ADMIN_EMAILS` (`apps/server/.env`) : ton compte Google entre donc directement, en admin.
  Pour voir l'écran d'attente, utilise un autre compte Google, ou retire ton email le temps du test.

- (12) API admin (`/admin/*`, en-tête `Authorization: Bearer <jeton Clerk>`) :
  - `GET /admin/me` (nombre de demandes, pour le badge), `GET /admin/players`, `GET /admin/audit` ;
  - `POST /admin/players/:id/<approve|deny|ban|unban|kick>` (`ban` demande `{ reason }`, 1 à 200 caractères) ;
  - 401 sans jeton valide, 403 pour un compte qui n'est pas admin (ou un admin banni).
- (12) Règles des actions :
  - un admin ne peut agir ni sur lui-même, ni sur un autre admin ;
  - approuver : depuis « en attente » ou « refusé » ; refuser : depuis « en attente » ;
  - bannir : tout statut sauf « banni » ; débannir : redonne « approuvé » (même à un joueur jamais approuvé) ;
  - expulser : le joueur connecté (en jeu, en attente ou en train de choisir son pseudo) est déconnecté et peut revenir.
- (12) Une demande en attente apparaît même avant le choix du pseudo (« pseudo pas encore choisi »). L'approuver
  laisse le joueur entrer dès qu'il a choisi son pseudo.
- (12) « En ligne » = connecté (en jeu ou en attente). « Dernière connexion » = dernière sauvegarde du personnage
  (toutes les 60 s et au départ) : « jamais » pour un joueur qui n'a jamais joué.
- (12) Listes complètes des joueurs, et les 100 dernières actions du journal (`ADMIN.auditListSize`), sans pagination.
- (12) Pas de limite de débit HTTP sur `/admin/*` (réservé aux admins, chaque appel vérifie le jeton). À revoir à la
  mise en ligne (25).
- (12) CORS écrit à la main pour `/admin/*` (origines de `ALLOWED_ORIGINS`), sans `@fastify/cors`.
- (12) `/admin` est une route du client (sans routeur) : l'hébergement de production devra servir `index.html` pour
  `/admin` (étape 25). Le lien « Admin » ouvre la page dans le même onglet (on quitte le jeu ; « Retour au jeu »
  le rouvre).
- (12) Un joueur non admin reçoit un 403 sur `/admin/me` au chargement (le lien reste caché) : le navigateur l'affiche
  dans sa console.
- (12) Mode dev : l'API accepte aussi `Authorization: Dev <pseudo>` (jamais en production) ; la page `/admin` prend
  le dernier pseudo de dev du navigateur à son ouverture. Pour avoir un admin de dev :
  `update players set role = 'admin' where name = '<pseudo>';`. J'ai créé dans ta base locale `DevAdmin` (admin)
  et `Newbie` (joueur), avec leurs lignes de journal.
- (12) Protocole 6 : refus `kicked`. L'écran d'attente dit maintenant de garder la page ouverte.
- (12) Corrigé au passage (étape 11) : le bandeau de connexion affichait la clé brute `ui.connection.account` sur les
  écrans de compte ; il est caché sur ces écrans. Les écrans « refusé » et « banni » n'ont toujours pas de bouton :
  il faut recharger la page.

## Historique

### 2026-10-12 — Étape 12 : Onglet admin v1 ✅
- Serveur : table `admin_audit` (migration), service `Admin` et API `/admin/*` protégée (jeton Clerk + rôle
  admin) : demandes en attente, joueurs (statut, en ligne, dernière connexion), journal ; approuver, refuser,
  bannir avec raison, débannir, expulser. Chaque action est écrite dans le journal, dans la même transaction.
- Effets immédiats (`NetServer`) : banni ou refusé → écran correspondant puis déconnexion ; expulsé → écran
  « expulsé » ; approuvé en attente → entre en jeu sans recharger. Protocole 6.
- Client : page `/admin` (trois tableaux, cartes sur téléphone, rafraîchie toutes les 30 s et après chaque action),
  lien « Admin » avec badge du nombre de demandes, visible des seuls admins ; textes FR et EN.
- Tests : garde (401, 403, mode dev, CORS), actions et journal, refus (statut, soi-même, autre admin, raison),
  effets en direct sur de vraies sessions (attente → jeu, refus, bannissement, expulsion), client `AdminApi`.
- Vérifié dans le navigateur avec des pseudos de dev : approbation en direct, bannissement et expulsion en direct,
  journal, page refusée à un non-admin, mise en page téléphone (375 px, sans défilement horizontal).
  Le parcours avec un deuxième compte Google reste à faire par toi.
- Écarts par rapport à la fiche : en-tête `Dev <pseudo>` en mode dev pour tester sans Google ; « en ligne » compte
  aussi les joueurs en attente ; correction du bandeau de connexion (étape 11).

### 2026-10-12 — Étape 11 : Connexion Google, pseudo et liste blanche ✅
- Protocole 5 : `hello { token }`, `setName`, `status` (`needsName`, `pending`, `denied`, `banned`), refus
  `invalidToken`.
- Serveur :
  - service `Accounts` : jetons Clerk vérifiés par `@clerk/backend`, à la première connexion email lu et
    joueur créé `pending`, admins de `ADMIN_EMAILS` ;
  - poignée de main asynchrone, hors tick, avec les écrans de statut ;
  - personnage rattaché à `players.id` ;
  - migration : pseudo vide tant qu'il n'est pas choisi.
- Client : `ClerkProvider` ; accueil (Google, plus le pseudo de dev en dev) ; nouveau jeton à chaque connexion ;
  écrans choix du pseudo, attente, refus et bannissement ; bouton « Se déconnecter ».
- Tests :
  - statuts avec un faux Clerk (pseudo, attente, refus, bannissement, admin, double connexion) ;
  - validation du pseudo et unicité sans tenir compte de la casse ;
  - client : jeton à chaque connexion, statuts.
- Vérifié :
  - jeton forgé refusé par le vrai serveur (vrai Clerk) ;
  - la base refuse « SMOKE_NAME » quand « Smoke_Name » existe ;
  - la fenêtre Clerk « Continue with Google » s'ouvre ;
  - le mode dev marche toujours.
  - Le parcours Google complet reste à faire par toi : je ne me connecte pas à ton compte.
- Écarts par rapport à la fiche : le bouton Google ouvre la fenêtre de Clerk ; le pseudo de dev crée un joueur
  approuvé en base.

### 2026-10-12 — Étape 10 : Base de données et sauvegarde ✅
- PostgreSQL 18 dans Docker (`pnpm db:up`, `db:down`, `db:generate`, `db:migrate`).
- Drizzle : tables `world_state`, `chunks`, `players`, `characters`. Migrations appliquées au démarrage du serveur.
- Chunks enregistrés avec leur propre palette d'ids de tuile. Tests : aller-retour, contenu réordonné, tuile retirée
  du contenu.
- Démarrage : graine lue en base, ou créée ; chunks chargés depuis la base, ou générés puis enregistrés.
- Écriture hors tick, par une file qui regroupe les données (testée) : chunks modifiés toutes les 30 s, personnages
  toutes les 60 s et à la déconnexion, tout à l'arrêt.
- Le personnage revient là où il était ; route de dev `POST /dev/tile`.
- Vérifié avec la vraie base :
  - un arbre posé par `/dev/tile` est enregistré sous 30 s ;
  - après redémarrage (1 024 chunks chargés, 0 généré), il bloque toujours le joueur (x = 513,70) ;
  - un client qui se reconnecte, y compris après un redémarrage du serveur, revient à 513,70 ;
  - aucun `await` dans le code des ticks.
- Écarts par rapport à la fiche :
  - service `ctx.persistence` et module `persistence` ;
  - toute la surface enregistrée dès la création ;
  - `launch.json` séparé en serveur et client.

### 2026-10-12 — Étape 09 : Contrôles mobiles ✅
- Mode tactile détecté (`?touch=1` pour le forcer en dev). HUD React en paysage :
  - joystick flottant qui envoie le même `input` que le clavier (direction testée) ;
  - boutons Frapper, Action et Sac (48 px au moins), place réservée en bas pour la barre d'objets ;
  - bouton plein écran avec verrouillage en paysage.
- Appui long sur le monde : événement `world.longPress` avec la case, et bulle de debug.
- Pincement : le zoom change par paliers (caméra de l'étape 06). Gestes du navigateur bloqués. Écran « Tourne ton
  téléphone » en portrait.
- Vérifié en émulation mobile :
  - portrait : le message s'affiche ;
  - paysage, avec des touchers simulés : le joystick fait avancer de 5,25 cases en 1 s, la page ne bouge pas ;
  - le pincement passe le zoom de ×2 à ×4, sans zoom du navigateur ;
  - l'appui long montre la bonne case, un simple tap ne fait rien.
  Sur PC, rien ne change.
- Écarts par rapport à la fiche :
  - option `?touch=1` ;
  - encart dev adapté au tactile ;
  - le joystick suit le pouce, au lieu d'avoir une base fixe.

### 2026-10-12 — Étape 08 : Prédiction, interpolation, multijoueur ✅
- Protocole 4 :
  - `snapshot.entities` contient les entités des chunks du client, et jamais les autres (testé) ;
  - le pseudo arrive avec la première apparition, et `gone` signale les entités sorties de la vue.
- Client, joueur local :
  - prédiction immédiate avec `stepMovement` ;
  - réconciliation, avec rejeu testé après une correction du serveur ;
  - correction douce et glissé entre deux pas.
- Client, autres joueurs : interpolation 100 ms dans le passé (testée, résiste à la gigue), et pseudos en police
  pixel.
- `pnpm tools:bots <n>` et latence simulée `?lag=N` en dev.
- Vérifié dans le navigateur :
  - avec 150 ms de latence (ping affiché 169 ms), la position prédite bouge 53 ms après l'appui, sans jamais
    reculer ;
  - deux navigateurs (Ana et Bob) et 20 bots : chacun voit les autres, avec leur pseudo ;
  - tick serveur moyen d'environ 1 ms.
- Écarts par rapport à la fiche :
  - `kind` et `name` envoyés comme indiqué dans les points « À valider » ;
  - nouveau module serveur `snapshots` ;
  - le client lit l'état du jeu à chaque image au lieu de passer par des événements.

### 2026-10-12 — Étape 07 : Déplacement autoritaire et collisions ✅
- `shared/sim/movement.ts` : `stepMovement` déterministe, testé (coin, glissement, diagonales, vitesse constante,
  trou d'une case, bord de la carte, pas de traversée même en un grand pas) :
  - 8 directions, diagonales normalisées ;
  - collisions axe par axe, donc glissement le long des obstacles ;
  - vitesse multipliée par la case sous les pieds.
- Serveur, module `movement` :
  - un input par tick et par joueur, file bornée ;
  - met à jour la position, le regard et l'index spatial ; les chunks suivent le joueur (testé sur deux chunks) ;
  - `snapshot { tick, ackSeq, you }` à chaque tick ;
  - inonder d'inputs ne fait pas aller plus vite (testé).
- Client :
  - touches lues par `event.code` (WASD/ZQSD et flèches), inputs à 20 Hz ;
  - personnage en 3 frames, retourné vers la gauche ;
  - la caméra suit le joueur. La caméra libre (F2) n'existe qu'en dev.
- Vérifié dans le navigateur :
  - 5 cases en 1 s ;
  - arrêt contre un arbre (x = 518,70, la boîte touche la case 519) ;
  - glissement le long de l'arbre, puis caché derrière le feuillage de l'arbre du dessous ;
  - F2 coupe la marche et la rend ;
  - aucune erreur dans la console.
- Écarts par rapport à la fiche :
  - ralentissement dans le contenu (`speedFactor`) plutôt que dans la config ;
  - événements client `player.moved`, `player.despawned`, `input.direction`, et composant serveur `facing` ;
  - `debugCamera` peut se couper ;
  - position du joueur dans l'encart dev.

### 2026-10-12 — Étape 06 : Vue 3/4, profondeur, caméra et zoom ✅
- Objets en 3/4 : un sprite par objet, ancré en bas de sa case. Les objets hauts (8 × 16) dépassent sur la case du
  dessus. Tri par le Y des pieds (`depth.ts`, testé). Les sprites sont recyclés (pool) au rythme des chunks.
- Placeholders : chêne, buisson, hautes herbes, fleurs, mur et porte en bois, personnage. `pnpm tools:tiles`
  dessine maintenant les objets, et sa planche accepte les sprites 8 × 16.
- Calque des entités trié avec les objets. En dev, un personnage de test suivi par la caméra le montre.
- Caméra : zoom par paliers entiers (+ / −, pincement), bornes calculées depuis la taille de la vue (`zoom.ts`,
  testé), limites de la carte, suivi d'une cible. Moniteur de FPS dans l'encart dev.
- `tileUpdate` : seule la case change. Le sol redessine la case et ses 8 voisines ; l'objet change de sprite.
- Vérifié dans le navigateur :
  - personnage de test caché par le feuillage derrière un arbre, et devant le tronc une case plus bas ;
  - zoom de ×8 à ×2, un palier à la fois ;
  - caméra arrêtée au coin de la carte ;
  - 58 à 60 FPS.
- Écarts par rapport à la fiche :
  - l'événement client `chunk.changed` devient `tile.changed` ;
  - la molette ne zoome plus ;
  - la caméra de debug devient un personnage de test ;
  - correctif : `BootScene` ne démarre plus le monde d'un jeu déjà détruit (erreur en dev) ;
  - `.claude/launch.json` ajouté pour l'aperçu (`pnpm dev`).

### 2026-10-12 — Retouche de l'étape 05 : tuiles du sol
- À la demande de l'auteur, et dans l'esprit de ses images de référence : nouvelle palette sourde, et sprites du
  sol dessinés pixel par pixel avec des variantes pondérées.
  - Herbe : 10 variantes (touffes, trèfle, fleurs, boutons, caillou), plus des zones denses à bords irréguliers.
  - Terre : 5 variantes. Sable : 4. Eau peu profonde : 6, calme. Eau profonde : 4.
- Bordures automatiques entre sols : rebord bosselé avec liseré, coins arrondis, écume sur l'eau. Les bordures se
  raccordent d'un chunk à l'autre : quand un chunk arrive, les cases des chunks voisins qui le touchent sont
  redessinées.
- `planGroundTile` (pur, testé) décide quoi dessiner sur chaque case. Le jeu et le nouvel outil
  `pnpm tools:tiles` l'utilisent tous les deux. L'outil produit une planche de sprites et des extraits de carte en
  PNG.
- Vérifié dans le navigateur aux zooms 1 et 4 : rivière, plages, terre et herbe. Aucune couture entre chunks, et
  aucune erreur dans la console.

### 2026-10-12 — Étape 05 : Chunks, diffusion et rendu du sol ✅
- Protocole 2 :
  - côté client : `viewport` et `debugCamera` (dev) ;
  - côté serveur : `chunk` (palette d'ids et tableaux compacts), `chunkUnload`, `tileUpdate` ; `welcome` donne la
    position du joueur.
- Serveur :
  - calcul d'intérêt pur (`net/interest.ts`) ;
  - module `chunks` : diffusion des chunks proches, libération des lointains, et `tileUpdate` sur l'événement
    `tile.changed` émis par le `World`.
- Client :
  - `EventBus` typé et `ChunkCache`, branchés dans `GameClient` ;
  - registre d'assets : l'atlas s'il existe, sinon des placeholders PICO-8 à variantes ;
  - sol rendu avec une texture canvas par chunk, posée au pixel près.
- Caméra de debug (flèches, + / - ou molette) et encart d'infos dev (chunks chargés, position de la caméra).
- Vérifié dans le navigateur :
  - sol visible autour du spawn ;
  - en déplaçant la caméra de 10 chunks, le nombre de chunks chargés reste stable (20) : les lointains sont
    libérés ;
  - pixels nets aux zooms 1, 4 et 8, sans couture ;
  - aucune erreur dans la console.
- Écarts par rapport à la fiche :
  - En plus de la fiche : message `debugCamera`, nécessaire pour que le serveur suive la caméra libre, et message
    `chunkUnload`.
  - Événement serveur `tile.changed`.
  - Encart d'infos dev.

### 2026-10-11 — Étape 04 : Génération du monde de surface ✅
- `shared/world` : couches, coordonnées de case et de chunk, `Chunk` (3 `Uint16Array` + `meta`), codes de case.
  `chunkCoord` y est déplacé depuis le serveur.
- Générateur de surface par chunk :
  - bruits simplex seedés pour l'altitude (lacs), les rivières (isoligne), l'humidité (terre) et les forêts ;
  - hachage par case pour placer les objets, si bien qu'un chunk se génère seul, dans n'importe quel ordre.
- Paysage : lacs avec plages, rivières bordées de sable, prairies fleuries, forêts sauvages, et forêt dense autour
  de la clairière de spawn.
- Serveur : `World` génère les 1024 chunks au démarrage (environ 0,8 s). `getTile` et `setTile` marquent le chunk
  modifié. Graine dans `WORLD_SEED`, sinon aléatoire. Les joueurs apparaissent dans la clairière.
- Outil `pnpm tools:map [graine] [fichier.png]` : carte PNG et proportions de chaque case.
- Écarts par rapport à la fiche : réglages dans une config `WORLDGEN` ; `ctx.world` dans le contexte serveur ;
  rivières en eau peu profonde.

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
