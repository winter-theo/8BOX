# 09 — Administration

## Liste blanche
- Première connexion Google → choix du pseudo → statut « en attente ».
- L'admin voit la demande (email, pseudo, date) dans l'onglet Admin et l'approuve ou la refuse.
- Statuts : en attente, approuvé, refusé, banni.

## Onglet Admin (sur le site)
- Demandes en attente, avec un badge indiquant leur nombre.
- Joueurs : statut, en ligne ou non, dernière connexion ; bannir, débannir, expulser, muter.
- Signalements avec le contexte du chat : traiter, classer.
- Journal d'audit des actions admin.
- Skins (P11) : réinitialiser un skin signalé.
- Utilisable sur téléphone.

## Commandes en jeu (admin)
| Commande | Effet |
|---|---|
| `/tp <joueur>` ou `/tp <x> <y> [couche]` | Se téléporter |
| `/tphere <joueur>` | Amener un joueur à soi |
| `/give <joueur> <objet> [quantité]` | Donner des objets |
| `/heal [joueur]` | Remettre PV et faim au maximum |
| `/time <hh:mm \| jour \| nuit>` | Régler l'heure |
| `/kick <joueur> [raison]` | Expulser |
| `/ban <joueur> [raison]`, `/unban <joueur>` | Bannir, débannir |
| `/mute <joueur> <minutes>`, `/unmute <joueur>` | Muter, rendre la parole |
| `/annonce <texte>` | Message à tous les joueurs |
| `/who` | Joueurs en ligne |
| `/save` | Sauvegarde immédiate |
| `/admin` | Mode admin : invisible, traverse les murs, invulnérable, ignoré des monstres |
| `/aide` | Liste des commandes disponibles |

« Bouger en jeu » a été compris comme le mode admin plus `/tphere` (voir `docs/DECISIONS.md`).

## Sauvegardes
- Le monde est sauvegardé en continu (toutes les 30 secondes) et à l'arrêt du serveur.
- En production : sauvegarde complète de la base chaque jour, 7 jours et 4 semaines conservés, restauration documentée.
