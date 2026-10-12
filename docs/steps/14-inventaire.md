# Étape 14 — Inventaire, barre, bourse, objets au sol

**Prérequis** : 09, 10
**Lire** : `docs/design/02-joueur.md` §Inventaire, §Objets au sol, §Contrôles sur PC ; `docs/ARCHITECTURE.md` §6 (Entités)
**Taille** : moyenne

## Objectif
Chaque personnage a 10 cases (qui forment la barre d'objets), une bourse d'or et des emplacements d'équipement ; on
lâche et on ramasse des objets.

## À faire
1. Shared : modèle d'inventaire (piles, taille maximale par objet, fusion, découpe) et opérations pures (déplacer,
   échanger, diviser, ajouter avec débordement).
2. Serveur `modules/inventory/` : 10 cases, case active, bourse (objet `base:gold`, jusqu'à 1 000 000), équipement
   (tête, corps, sac) ; le sac en fibres ajoute 10 cases ; opérations validées ; envoi des changements au client ;
   sauvegarde dans `characters`.
3. Objets au sol : entité `groundItem` (objet + quantité). Lâcher (touche Q physique, ou glisser hors de
   l'inventaire) ; ramassage automatique en marchant dessus (2 s d'attente pour celui qui a lâché) ; fusion des piles
   proches ; disparition au bout de 10 minutes.
4. Client : barre d'objets (touches 1 à 0 via `Digit1` … `Digit0`, molette, toucher sur téléphone), fenêtre
   d'inventaire (I), glisser-déposer à la souris et au doigt, affichage de la bourse, sprites des objets au sol.
5. Route ou commande de dev pour se donner des objets, en attendant `/give` (24).

## Critères d'acceptation
- [ ] On change d'objet actif au clavier, à la molette et au doigt.
- [ ] Un objet lâché apparaît au sol ; un autre joueur peut le ramasser.
- [ ] L'inventaire survit à la déconnexion et au redémarrage du serveur.
- [ ] Un client ne peut ni créer ni dupliquer d'objets (tentatives testées).

## Tests à écrire
- Opérations d'inventaire : piles, fusion, limites, débordement.
- Ramassage simultané par deux joueurs : un seul l'obtient.

## Hors périmètre
- Coffres (P2), échanges (P6).
