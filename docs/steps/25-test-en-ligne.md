# Étape 25 — Test en ligne gratuit

**Prérequis** : 24
**Lire** : `docs/ARCHITECTURE.md` §15 (Test en ligne gratuit) ; `docs/GUIDE.md` §Faire tester des amis
**Taille** : petite

## Objectif
Tu fais jouer jusqu'à une dizaine d'amis gratuitement : le jeu tourne sur ton PC et un tunnel Cloudflare lui donne une
adresse publique.

## À faire
1. Mode « tout-en-un » : avec `SERVE_CLIENT=1`, le serveur sert aussi le client compilé (une seule adresse).
2. `Dockerfile` du serveur (multi-étapes) et `docker-compose.test.yml` (serveur + base) ; script `pnpm test:online`
   qui compile et lance.
3. Compléter `docs/GUIDE.md` (§Faire tester des amis) pas à pas : installer `cloudflared`, lancer
   `cloudflared tunnel --url http://localhost:<port>`, ajouter l'adresse du tunnel à `ALLOWED_ORIGINS`, partager le
   lien.
4. Écran « Serveur indisponible » propre quand le serveur est éteint, avec nouvelle tentative automatique.
5. Noter dans `docs/PROGRESS.md` les retours des premiers tests ; ne corriger dans cette étape que ce qui bloque.

## Critères d'acceptation
- [ ] Depuis un autre appareil en 4G, on se connecte par l'adresse du tunnel et on joue à plusieurs.
- [ ] Redémarrer les conteneurs ne perd rien.

## Tests à écrire
- Test de fumée automatisé : le serveur démarre, `/health` répond, un bot se connecte et bouge.

## Hors périmètre
- Production (26).
