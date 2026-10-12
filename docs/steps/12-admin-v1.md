# Étape 12 — Onglet admin v1

**Prérequis** : 11
**Lire** : `docs/design/09-admin.md` §Liste blanche, §Onglet Admin ; `docs/ARCHITECTURE.md` §9
**Taille** : moyenne

## Objectif
Depuis un onglet Admin sur le site, tu valides les nouveaux joueurs et tu gères les comptes.

## À faire
1. API HTTP `/admin/*` (Fastify), protégée par jeton Clerk + rôle admin :
   - demandes en attente (email, pseudo, date) ; approuver ; refuser ;
   - liste des joueurs (statut, en ligne, dernière connexion) ;
   - bannir (avec raison), débannir, expulser.
2. Table `admin_audit` : chaque action admin y est enregistrée (qui, quoi, cible, quand).
3. Client : route `/admin`, visible uniquement pour les admins (lien dans le menu) ; tableaux simples ; badge
   « N en attente » ; rafraîchissement automatique toutes les 30 s ; utilisable sur téléphone.
4. Effets immédiats : un joueur banni ou expulsé est déconnecté avec l'écran correspondant ; un joueur approuvé qui
   attend entre en jeu sans recharger la page (le serveur lui envoie son nouveau statut).

## Critères d'acceptation
- [ ] Un deuxième compte Google apparaît dans « En attente » ; l'approuver le fait entrer en jeu.
- [ ] Un non-admin reçoit 403 sur `/admin/*`.
- [ ] Chaque action apparaît dans le journal d'audit.

## Tests à écrire
- Garde admin (403 pour un non-admin).
- Approbation et bannissement (logique + écriture dans l'audit).

## Hors périmètre
- Signalements et mute (13), commandes en jeu (24).
