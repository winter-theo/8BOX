# 04 — Interactions, récolte, craft et construction

## Interactions
Inspirées de Project Zomboid, mais simplifiées.
- Chaque case ou entité propose une liste d'actions : Couper, Cueillir, Arracher, Ouvrir, Fermer, Dormir ici, Manger,
  Ramasser, Examiner…
- **Touche d'action** (E, ou bouton Action sur téléphone) : exécute l'action principale sur la case visée.
- **Menu d'actions** (clic droit, ou appui long) : toutes les actions possibles. Celles qui sont impossibles sont
  grisées avec la raison (« Il faut une hache »).
- Certaines actions prennent du temps (barre de progression) et s'annulent si on bouge.
- Le serveur vérifie toujours la portée, les conditions et les délais.

## Récolte
- Les éléments naturels ont des points de vie. Chaque coup en retire selon l'outil : main = 1 ; outil adapté = sa
  puissance (hache en bois = 2) ; outil inadapté = 1.
- Chêne : se coupe (hache conseillée), donne 2 à 4 bûches et parfois une pomme (20 %).
- Hautes herbes : s'arrachent à la main et donnent de la fibre.
- Buisson à baies : se cueille ; les baies repoussent en 10 minutes.
- Si on arrête de frapper pendant 30 secondes, l'élément récupère ses PV.
- Rien ne se casse dans la zone sûre.

## Outils et paliers
- Paliers : bois → pierre (P1) → fer (P1) → et ensuite.
- Outils : hache (bois), pioche (pierre et minerais, P1), épée (combat), houe (P4), canne à pêche (P10).
- Chaque outil a une durabilité. À 0, il se brise.

## Craft
- Fenêtre de fabrication : la liste des recettes, grisées quand il manque des ingrédients.
- Certaines recettes se font à la main, d'autres à moins de 3 cases d'une station (établi ; plus tard four, enclume…).
- Fabrication rapide (0,5 à 2 secondes) avec barre de progression.
- Plus tard (P3) : certaines recettes demandent un niveau de compétence.

## Objets de départ (MVP)
| Objet | Recette | Où |
|---|---|---|
| Planches ×4 | 1 bûche | à la main |
| Bâtons ×4 | 2 planches | à la main |
| Torches ×2 | 1 bâton + 2 fibres | à la main |
| Établi | 8 planches | à la main |
| Hache en bois | 3 planches + 2 bâtons | établi |
| Pioche en bois | 3 planches + 2 bâtons | établi |
| Épée en bois | 2 planches + 1 bâton | établi |
| Murs en bois ×2 | 4 planches | établi |
| Sols en bois ×4 | 2 planches | établi |
| Porte en bois | 6 planches | établi |
| Lit | 6 planches + 10 fibres | établi |
| Sac en fibres | 20 fibres | établi |

Identifiants : `base:oak_log`, `base:plank`, `base:stick`, `base:fiber`, `base:berries`, `base:apple`, `base:gold`,
`base:slime_gel`, `base:fang`, `base:torch`, `base:workbench`, `base:wooden_axe`, `base:wooden_pickaxe`,
`base:wooden_sword`, `base:wooden_wall`, `base:wooden_floor`, `base:wooden_door`, `base:bed`, `base:fiber_bag`.

## Construction
- On pose l'objet tenu en main sur une case libre à portée (action Poser, clic gauche ou bouton Utiliser).
- Une case a trois emplacements : terrain, sol posé, objet (mur, porte, meuble…).
- Murs : se raccordent visuellement à leurs voisins. Résistance selon le matériau : bois 20 PV, pierre 60 PV (P1).
- Portes : s'ouvrent et se ferment ; fermées, elles bloquent le passage.
- Meubles du MVP : établi, lit (« Dormir ici » en fait ton point de réapparition), torche.
- Casser sa propre construction rend l'objet.
- Rien dans la zone sûre.

## Pièces et toits
- Une zone fermée par des murs et des portes, de 64 cases au plus, devient une **pièce** : un toit apparaît
  automatiquement.
- Le toit cache l'intérieur aux joueurs qui sont dehors et s'efface quand on entre.
- Casser un mur ouvre la pièce : le toit disparaît.

## Coffres, serrures et clés (P2)
- Coffres : 10 cases de stockage.
- Serrures sur les portes et les coffres : elles s'ouvrent pour quiconque a la clé. Une clé se donne, s'échange, se
  perd… c'est là que naissent les trahisons.
- Journal d'accès : le propriétaire voit qui a ouvert ses coffres et ses portes.

## Parcelles (P2)
- Une par joueur, 16 × 16 cases, créée en posant un **plan de parcelle** que l'on fabrique.
- Agrandissable contre de l'or. Jamais libérée, même après une longue absence.
- Dans une parcelle : seul le propriétaire (et sa guilde selon les permissions, P7) peut casser, construire et
  récolter. Pas de PvP.
- Les monstres peuvent tout de même frapper les murs s'ils poursuivent un joueur.
