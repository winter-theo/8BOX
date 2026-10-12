# Étape 13 — Chat, filtre et signalements

**Prérequis** : 12
**Lire** : `docs/design/07-economie-social.md` §Chat, §Modération
**Taille** : moyenne

## Objectif
Les joueurs discutent avec ceux qui sont proches ou en privé, avec des bulles au-dessus des têtes, et peuvent signaler
un joueur.

## À faire
1. Protocole : client → serveur `chat { text, to? }` ; serveur → client `chat { from, text, channel, ts }`.
2. Serveur `modules/chat/` :
   - proximité : rayon `chat.proximityRadius` (16 cases), même couche ;
   - privé : `/msg <pseudo> <texte>`, réponse rapide `/r` ;
   - 200 caractères maximum, limite de débit, filtre de mots (listes FR et EN dans la config, remplacement par
     `***`), joueurs mutés bloqués avec un message d'information.
3. Client : panneau de chat (Entrée pour écrire, historique, onglets Proximité et Privé), bulles au-dessus des têtes
   (5 s, texte tronqué), bouton de chat sur téléphone.
4. Signalement : `/signaler <pseudo> <raison>` → table `reports` avec les 20 derniers messages visibles par le
   signaleur ; onglet admin : liste des signalements (traiter, classer).
5. Mute : champ `muted_until` ; action « Muter X minutes » et « Rendre la parole » dans l'onglet admin.

## Critères d'acceptation
- [ ] Deux joueurs proches se lisent ; éloignés de plus de 16 cases, non ; le privé fonctionne à toute distance.
- [ ] Un mot filtré est masqué ; un joueur muté ne peut plus parler.
- [ ] Un signalement apparaît dans l'onglet admin avec son contexte.

## Tests à écrire
- Rayon de proximité, filtre, limite de débit, mute.

## Hors périmètre
- Chat de guilde (P7), annonces admin (24).
