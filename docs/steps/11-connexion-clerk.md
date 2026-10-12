# Étape 11 — Connexion Google, pseudo et liste blanche

**Prérequis** : 10
**Lire** : `docs/ARCHITECTURE.md` §9, §12 ; `docs/design/09-admin.md` §Liste blanche ; `docs/GUIDE.md` §Clerk
**Taille** : moyenne

## Objectif
On se connecte avec Google ; un nouveau joueur choisit son pseudo, puis attend la validation de l'admin.

## À faire
1. Client : `@clerk/react` (`<ClerkProvider>`), écran d'accueil avec bouton « Se connecter avec Google », menu du
   compte (déconnexion). Juste avant d'ouvrir le WebSocket, `getToken()` et envoi dans `hello { token }`.
2. Serveur : `verifyToken` de `@clerk/backend` avec `authorizedParties` = origines autorisées ; à la première
   connexion, lecture de l'email via le client de l'API Clerk et création de la ligne `players` (`pending`).
3. Choix du pseudo avant la validation : 3 à 16 caractères, lettres, chiffres et `_`, unique sans tenir compte de la
   casse, filtré (liste de mots interdits). Message `status { state: 'needsName' }` puis `setName`.
4. Écrans selon le statut : `pending` (« En attente de validation »), `denied`, `banned` (avec la raison),
   `approved` → jeu.
5. Rôle admin : les emails de `ADMIN_EMAILS` deviennent `admin` et `approved` automatiquement.
6. Le personnage est désormais rattaché au joueur (`players.id`). Le mode dev (`DEV_AUTH`) reste disponible en local
   pour les bots et les tests.
7. Mettre à jour `.env.example`.

## Critères d'acceptation
- [ ] Avec une instance Clerk « development » : connexion Google → choix du pseudo → écran d'attente.
      Après passage du statut à `approved` (en SQL pour l'instant), le joueur entre en jeu.
- [ ] Un jeton invalide ou expiré est refusé.
- [ ] Deux comptes ne peuvent pas prendre le même pseudo (même avec une casse différente).

## Tests à écrire
- Logique des statuts avec une vérification de jeton simulée (sans appel à Clerk).
- Validation du pseudo.

## Hors périmètre
- Onglet admin (12).

## Notes
- Clerk Core 3 : le paquet est `@clerk/react`, pas l'ancien `@clerk/clerk-react`. Si une API diffère de ce qui est
  attendu, suivre la documentation Clerk à jour (quickstart React + Vite).
- Les jetons de session Clerk sont courts : ils ne servent qu'à l'ouverture du socket.
