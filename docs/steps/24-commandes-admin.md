# Étape 24 — Commandes admin et mode admin

**Prérequis** : 13, 23
**Lire** : `docs/design/09-admin.md` §Commandes en jeu ; `docs/ARCHITECTURE.md` §6 (Commandes de chat)
**Taille** : moyenne

## Objectif
Tu administres le jeu de l'intérieur : téléportation, don d'objets, heure, sanctions, annonces et mode admin.

## À faire
1. Registre de commandes dans le chat : analyse des arguments, complétion des pseudos, permissions (`player` ou
   `admin`), `/aide` qui liste les commandes accessibles.
2. Commandes admin : `/tp`, `/tphere`, `/give`, `/heal`, `/time`, `/kick`, `/ban`, `/unban`, `/mute`, `/unmute`,
   `/annonce`, `/who`, `/save`, et `/spawnmob <id> [n]` (dev).
3. Mode admin `/admin` : invisible pour les autres, traverse les murs, invulnérable, ignoré par les monstres ; badge
   visible pour soi seulement.
4. Journal d'audit pour chaque commande admin ; messages d'erreur clairs et traduits.
5. Retirer les routes et raccourcis de debug provisoires des étapes précédentes, ou les réserver au mode dev.

## Critères d'acceptation
- [ ] Chaque commande fonctionne et échoue proprement (pseudo ou objet inconnu).
- [ ] Un non-admin reçoit « Commande inconnue » pour une commande admin.
- [ ] En mode admin, les autres joueurs ne te voient pas et les monstres t'ignorent.

## Tests à écrire
- Analyse des commandes et des arguments.
- Permissions.
- Effets de `/tp` et `/give`.

## Hors périmètre
- Outils d'édition du monde (plus tard, si besoin).
