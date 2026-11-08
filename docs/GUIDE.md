# Mode d'emploi du pack 8Box

Ce guide est pour toi. Claude Code, lui, lit `CLAUDE.md` et les fiches d'étapes.

## Ce que contient le pack
| Fichier ou dossier | Rôle |
|---|---|
| `CLAUDE.md` | Carte d'identité du projet, lue par Claude Code à chaque session. Volontairement courte. |
| `.claude/skills/` | Trois commandes : `/etape`, `/planifier-phase`, `/corriger`. |
| `.claude/rules/` | Règles de code qui ne se chargent que lorsque Claude touche le dossier concerné. |
| `.claude/settings.json` | Autorise d'office pnpm, git (sans push) et docker compose : moins de demandes de permission. |
| `docs/design/` | Le game design, un fichier par système. |
| `docs/ARCHITECTURE.md` | Les choix techniques, par sections numérotées. |
| `docs/ROADMAP.md` + `docs/steps/` | La feuille de route et une fiche par étape (27 pour la première version jouable). |
| `docs/DECISIONS.md` | Ce qu'on a décidé, les valeurs par défaut et les questions ouvertes. |
| `docs/PROGRESS.md` | Le journal que Claude Code tient à jour. |
| `ref/` (à ajouter) | Tes références de sprites, que tu déposes à la racine du projet. |

## Démarrer
1. Installe Git, Node.js LTS (24 ou plus), pnpm (`npm install -g pnpm`), Docker Desktop et Claude Code.
2. Dézippe `8box.zip` : tu obtiens un dossier `8box` avec `CLAUDE.md`, `docs/` et le dossier `.claude`
   (caché, car il commence par un point : vérifie qu'il est bien là).
3. Dans ce dossier : `git init`, `git add -A`, `git commit -m "docs: pack de départ"`. Crée un dépôt privé sur
   GitHub et pousse.
4. Lance `claude` dans le dossier, puis tape `/etape 00`.

## Le rythme de travail
1. `/etape 00` : Claude Code fait l'étape, teste, fait ses commits, puis s'arrête avec un résumé.
2. Toi : teste à la main en suivant le résumé (2 à 5 minutes), et réponds aux points « À valider ».
3. `/clear` pour repartir d'une conversation vide, puis `/etape 01`. Et ainsi de suite.

Si ta limite d'usage tombe au milieu d'une étape, reviens plus tard et retape la même commande : Claude Code reprend
où il s'était arrêté, grâce au journal et aux petits commits.

## Économiser ton abonnement
- Une étape par session, et `/clear` entre deux étapes.
- Ne colle pas les docs dans la conversation : chaque fiche dit quoi lire.
- Garde le même modèle et le même niveau d'effort pendant une session : en changer en cours de route invalide le cache
  et coûte plus cher.
- Regarde `/usage` avant une étape marquée « grosse ». Pour celles-là, tu peux demander d'abord un plan (mode plan) et
  le valider : moins de code jeté.
- Si une étape déborde : `/clear`, puis « Découpe l'étape NN en deux fiches NNa et NNb ».
- Pour un bug : `/corriger <description courte>`, qui corrige sans refondre.

## Après la première version jouable
- `/planifier-phase P1` : Claude Code écrit les fiches de la phase (session courte, sans code).
- Puis `/etape P1-01`, `/etape P1-02`, etc.

## Clerk (étape 11)
1. Crée un compte sur clerk.com et une application « 8Box ».
2. Méthodes de connexion : Google uniquement.
3. Copie la clé publique dans `apps/client/.env` (`VITE_CLERK_PUBLISHABLE_KEY`) et la clé secrète dans
   `apps/server/.env` (`CLERK_SECRET_KEY`).
4. Mets ton email dans `ADMIN_EMAILS` (fichier `.env` du serveur).

En développement, l'instance Clerk fonctionne sur n'importe quelle adresse, avec un badge « Development mode ».
Le paquet à utiliser est `@clerk/react` (Clerk Core 3) ; l'ancien `@clerk/clerk-react` est obsolète.

## Faire tester des amis (étape 25)
Le jeu tourne sur ton PC dans Docker (le serveur et sa base), et un tunnel Cloudflare gratuit lui donne une adresse
publique en `https://….trycloudflare.com`. Le serveur sert aussi le jeu : une seule adresse à partager. Ton PC doit
rester allumé pendant les sessions. Une dizaine de joueurs, sans frais.

### Une fois pour toutes
1. Installe `cloudflared` : `winget install --id Cloudflare.cloudflared`, puis ouvre un nouveau terminal et vérifie
   avec `cloudflared --version`.
2. Copie `.env.online.example` en `.env.online` (à la racine du dépôt, jamais commité) et remplis-le :
   - `VITE_CLERK_PUBLISHABLE_KEY` et `CLERK_SECRET_KEY` : les clés de ton instance Clerk « development », les mêmes
     que dans `apps/client/.env` et `apps/server/.env` ;
   - `ADMIN_EMAILS` : ton email Google, pour être admin et approuver tes amis.
3. Ce monde est séparé de celui de `pnpm dev` : il a sa propre base, dans le volume Docker `8box-online_db-data`.

### À chaque session
1. Lance Docker Desktop.
2. Dans un premier terminal : `cloudflared tunnel --url http://localhost:8080`. Après quelques secondes, il affiche
   une adresse du type `https://mots-au-hasard.trycloudflare.com`. Laisse ce terminal ouvert : le fermer coupe le
   tunnel. L'adresse change à chaque lancement.
3. Dans `.env.online`, mets cette adresse dans `ALLOWED_ORIGINS`, après celle de ton PC, sans `/` à la fin :
   `ALLOWED_ORIGINS=http://localhost:8080,https://mots-au-hasard.trycloudflare.com`.
4. Dans un second terminal, à la racine du dépôt : `pnpm test:online`. La première fois, la construction de l'image
   prend quelques minutes ; ensuite, seul ce qui a changé est refait. La commande rend la main quand le serveur répond.
5. Vérifie : `https://mots-au-hasard.trycloudflare.com/health` affiche `{"ok":true,…}`, et l'adresse seule ouvre le
   jeu. Connecte-toi avec Google.
6. Envoie l'adresse à tes amis. Chacun se connecte avec Google et choisit son pseudo, puis attend ton accord : bouton
   « Admin » en haut à droite (ou `/admin`), « Approuver ».
7. Fin de session : `pnpm test:online:stop` (le monde est sauvegardé), puis Ctrl+C dans le terminal du tunnel.

### Bon à savoir
- Arrêter ou redémarrer les conteneurs, Docker Desktop ou le PC ne perd rien : tout est dans le volume Docker. Les
  joueurs connectés voient « Serveur indisponible », puis le jeu se reconnecte tout seul au retour du serveur.
- Après un `git pull`, relance `pnpm test:online` : l'image est reconstruite et le serveur redémarre.
- Journal du serveur : `pnpm test:online:logs` (Ctrl+C pour en sortir).
- Un ami reste sur « Serveur indisponible » : regarde le journal. `websocket rejected: origin not allowed` veut dire
  que l'adresse du tunnel manque dans `ALLOWED_ORIGINS` (étape 3, puis `pnpm test:online`).
- Une page d'erreur Cloudflare (502, 1033) : le serveur ou le tunnel est arrêté.
- Le badge « Development mode » de Clerk est normal : c'est l'instance de développement.
- Le tunnel rapide est fait pour tester : 200 requêtes simultanées au plus, une adresse qui change, aucune garantie.
  La mise en ligne durable, c'est l'étape 26.
- Pour repartir d'un monde neuf : `docker compose -f docker-compose.test.yml --env-file .env.online down -v`
  efface ce monde pour de bon (le `-v` supprime le volume).

## Mise en production (étape 26)
- Un nom de domaine : compte une dizaine de dollars par an.
- Un VPS OVH « VPS-1 » à Beauharnois : 4 vCPU, 8 Go de RAM, environ 6,50 à 7,60 $ US par mois depuis la hausse de prix
  de 2026.
- Cloudflare (gratuit) : DNS et Cloudflare Pages pour le client.
- Clerk : instance de production sur ton domaine, avec tes propres identifiants Google OAuth. L'offre gratuite couvre
  50 000 utilisateurs retenus par mois.
- itch.io : page vitrine avec un bouton « Jouer » vers ton site et le prix « $0 or donate ». Le jeu n'est pas hébergé
  sur itch.io : Clerk en production exige ton propre domaine, et Google refuse de s'afficher dans une iframe.
- L'étape 26 complète cette section (DNS, secrets, sauvegardes, surveillance).

## Tes références de sprites
1. Mets ton dossier `ref/` à la racine du projet (à côté de `CLAUDE.md`) et commite-le. Des noms de fichiers parlants
   aident (`murs-rimworld.png`, `palette.png`, `perso-croquis.png`…), et un `ref/notes.md` peut dire ce que tu aimes
   dans chaque image.
2. Dans Claude Code, une seule fois : « Lis les images de ref/ et mets à jour docs/design/10-graphismes-son.md
   (palette en codes couleur, proportions, style des murs, des toits et des personnages). Ne code rien. »
3. Les étapes suivantes suivent ce résumé sans rouvrir les images, ce qui économise ton abonnement. Si tu modifies
   `ref/`, refais l'étape 2.
4. Les placeholders suivront la nouvelle palette. Les vrais sprites arriveront dans l'atlas
   (`apps/client/public/assets/`) quand tu les auras dessinés, sans toucher au code.

## Quand Claude Code s'égare
- Il sort du périmètre : « Arrête. Reste dans le périmètre de la fiche NN et note le reste dans PROGRESS.md. »
- Les tests échouent en boucle : `/clear`, puis `/corriger <le test qui échoue>`.
- Tu veux changer une règle du jeu : modifie le fichier concerné dans `docs/design/` (ou demande-le), puis la fiche
  de l'étape à venir qui en dépend.
