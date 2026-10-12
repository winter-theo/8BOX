# 02 — Le joueur

## Personnage
- Sprite de 8 × 8 px. Planche de 3 frames regardant vers la droite (24 × 8 px) : frame 1 = repos, frames 2 et 3 = marche.
- Regard vers la gauche : la planche est retournée. En montant ou en descendant, le sprite ne change pas
  (il garde son dernier côté).
- L'objet tenu en main (arme, outil) est dessiné par-dessus le personnage.
- Skins personnalisés (P11) : le joueur importe sa propre planche de 24 × 8.
- Pseudo affiché au-dessus de la tête.
- Quand le joueur se déconnecte, son personnage disparaît du monde (sauf en mode marchand, P6).

## Déplacement
- Libre en 8 directions, 5 cases par seconde (diagonales normalisées).
- Collisions avec ce qui est solide (arbres, murs, portes fermées, meubles) et avec l'eau profonde. On glisse le long
  des obstacles.
- Eau peu profonde : vitesse divisée par deux.
- Direction du regard (haut, bas, gauche, droite) = dernière direction de déplacement. Elle sert à viser et à frapper.

## Contrôles sur PC
| Action | Touche |
|---|---|
| Se déplacer | WASD (ZQSD en AZERTY : positions physiques des touches) ou flèches |
| Frapper / utiliser l'objet en main | Espace ou clic gauche |
| Action principale sur la case visée | E |
| Menu d'actions | clic droit sur une case à portée |
| Choisir un objet de la barre | 1 à 0, molette |
| Inventaire | I |
| Fabrication | C |
| Lâcher l'objet en main | Q (A en AZERTY) |
| Chat | Entrée |
| Zoom | + et − |
| Menu, fermer | Échap |

Quand le navigateur le permet, l'interface affiche le vrai nom de la touche selon le clavier du joueur.

## Contrôles sur téléphone (paysage)
- Joystick virtuel à gauche.
- À droite : gros bouton Frapper/Utiliser, bouton Action, bouton Inventaire. La barre d'objets est en bas.
- Appui long sur le monde : menu d'actions sur la case touchée (si elle est à portée).
- Pincer : zoom. Bouton de chat en haut.
- En portrait : message « Tourne ton téléphone ». Bouton plein écran.

## Caméra
- Suit le joueur. Zoom par paliers entiers, réglable ; par défaut, environ 40 cases visibles en largeur.

## Visée
- La case visée est celle devant le joueur. Sur PC, si la souris survole une case à portée (1,5 case), c'est celle-là.
- La case visée est surlignée.

## Inventaire
- 10 cases, qui forment la barre d'objets. Un sac (porté en équipement) ajoute 10 cases (deuxième rangée).
- Piles de 99 par défaut (réglable par objet ; outils et armes : 1).
- **Bourse** : emplacement à part pour l'or (jusqu'à 1 000 000).
- **Équipement** : tête, corps, sac. L'arme ou l'outil utilisé est l'objet sélectionné dans la barre.

## Objets au sol
- On lâche un objet (touche, ou glisser hors de l'inventaire) : il tombe au sol.
- N'importe qui le ramasse en marchant dessus ; celui qui l'a lâché doit attendre 2 secondes.
- Il disparaît au bout de 10 minutes. Les piles identiques proches fusionnent.
