# Étape 10 — Base de données et sauvegarde

**Prérequis** : 08
**Lire** : `docs/ARCHITECTURE.md` §4 (En mémoire), §8
**Taille** : moyenne

## Objectif
Le monde et les personnages survivent au redémarrage du serveur.

## À faire
1. `docker-compose.yml` de développement avec PostgreSQL 18 et un volume ; scripts `pnpm db:up`, `db:down`,
   `db:generate`, `db:migrate`. Mettre à jour la section « Commandes » de `CLAUDE.md` si besoin.
2. Drizzle : tables `world_state`, `chunks`, `players`, `characters` (voir ARCHITECTURE §8). Migrations appliquées
   au démarrage du serveur.
3. Sérialisation des chunks avec palette d'identifiants texte (voir §4) ; test d'aller-retour qui résiste à un
   changement d'ordre du contenu.
4. Démarrage : graine lue en base (créée sinon) ; chunks chargés depuis la base ou générés s'ils manquent.
   Chunks « sales » écrits par lots toutes les 30 s et à l'arrêt (SIGINT, SIGTERM), via une file d'écriture traitée
   hors tick.
5. Personnages : couche et position sauvegardées à la déconnexion et toutes les 60 s, restaurées à la connexion.
   En mode dev, le pseudo identifie le joueur en attendant Clerk.
6. Route de développement `POST /dev/tile` (désactivée en production) pour modifier une case et tester la sauvegarde.

## Critères d'acceptation
- [ ] Modifier une case, redémarrer le serveur : la case est toujours modifiée.
- [ ] Se déconnecter puis se reconnecter : on revient au même endroit.
- [ ] Aucun `await` sur la base dans la boucle de jeu (vérifié à la relecture).

## Tests à écrire
- Sérialisation d'un chunk : aller-retour, et résistance à un réordonnancement du contenu.
- File d'écriture : regroupement des chunks sales.

## Hors périmètre
- Clerk (11), inventaire (14).
