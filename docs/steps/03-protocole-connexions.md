# Étape 03 — Protocole et connexions

**Prérequis** : 02
**Lire** : `docs/ARCHITECTURE.md` §7 (Transport, Handshake, Débit), §13
**Taille** : moyenne

## Objectif
Des joueurs se connectent en WebSocket avec un simple pseudo (mode dev), reçoivent un `welcome`, et le serveur les
suit comme des entités.

## À faire
1. `shared/src/protocol/` : schémas zod des messages client → serveur (`hello`, `ping`, `input` vide pour l'instant),
   types des messages serveur → client (`welcome`, `rejected`, `pong`), codec msgpack (`encode`, `decode`),
   `PROTOCOL_VERSION`.
2. Serveur `net/` : sessions (une par socket), décodage et validation, limites de débit par type de message,
   vérification de l'origine (`ALLOWED_ORIGINS`), ping/pong et mesure de latence, fermeture propre.
3. Mode dev : `hello { devName }` accepté seulement si `DEV_AUTH=1` et `NODE_ENV !== 'production'`. Crée une entité
   joueur au spawn, émet `player.joined` et `player.left`.
4. Client `game/GameClient.ts` : connexion, reconnexion avec délai croissant, `hello`, réception de `welcome`,
   affichage du ping. Écran de connexion de dev (champ pseudo) en attendant Clerk.
5. Store Zustand minimal : état de connexion, ping, joueur local.

## Critères d'acceptation
- [ ] Deux onglets avec deux pseudos se connectent ; le serveur journalise arrivées et départs ; chaque onglet affiche
      son ping.
- [ ] Un message invalide ou trop fréquent est ignoré sans plantage (testé).
- [ ] Une version de protocole différente donne `rejected { reason: 'outdated' }` et le client propose de recharger.

## Tests à écrire
- Codec : aller-retour de chaque message.
- Validation : message invalide ignoré.
- Limiteur de débit.

## Hors périmètre
- Clerk (11), déplacement (07).
