# Étape 26 — Mise en production

**Prérequis** : 25
**Lire** : `docs/ARCHITECTURE.md` §15 (Production), §8, §14 ; `docs/GUIDE.md` §Mise en production
**Taille** : moyenne

## Objectif
8Box tourne en continu sur un VPS OVH à Beauharnois, le client est servi par Cloudflare Pages, la connexion Google
passe par Clerk en production, et une page itch.io sert de vitrine.

## À faire
1. `docker-compose.prod.yml` : `server`, `db` (volume, aucun port public), `caddy` (TLS automatique,
   `api.<domaine>` → serveur, WebSocket compris). Redémarrage automatique, rotation des journaux.
2. Sauvegardes : `pg_dump` quotidien (conteneur dédié ou minuterie système), conservation 7 jours + 4 semaines,
   script de restauration testé sur une base vide.
3. Déploiement continu : GitHub Actions sur `main` → `pnpm check` → image Docker poussée sur GHCR → connexion SSH au
   VPS → `docker compose pull && docker compose up -d`. Migrations au démarrage du serveur.
4. Client : Cloudflare Pages sur `play.<domaine>`, variables `VITE_*` de production.
5. Durcissement du VPS, documenté dans `docs/GUIDE.md` : utilisateur non root, connexion SSH par clé, pare-feu
   (22, 80, 443), mises à jour de sécurité automatiques.
6. Compléter `docs/GUIDE.md` (§Mise en production) : achat du domaine, DNS Cloudflare, instance Clerk de production
   (domaine, enregistrements DNS, identifiants Google OAuth), secrets GitHub, surveillance de `/health` par un service
   gratuit, page itch.io (bouton « Jouer » vers `https://play.<domaine>`, prix « $0 or donate »).

## Critères d'acceptation
- [ ] `https://play.<domaine>` fonctionne sur PC et téléphone, avec connexion Google en production et liste blanche.
- [ ] Une sauvegarde est restaurée avec succès sur une base de test.
- [ ] Un push sur `main` redéploie sans intervention.

## Tests à écrire
- La CI lance `pnpm check` et un test de fumée de l'image Docker (démarrage + `/health`).

## Hors périmètre
- Plusieurs serveurs, CDN d'assets, montée en charge au-delà de 100 joueurs.

## Notes
- Le jeu n'est pas hébergé sur itch.io : Clerk en production exige ton propre domaine, et Google refuse de s'afficher
  dans une iframe.
