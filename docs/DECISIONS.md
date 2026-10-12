# Décisions et valeurs par défaut

Tout ce qui est chiffré ici est réglable dans `packages/shared/src/config/`. Si tu changes une valeur, change-la ici
ET dans la config.

## Validé avec toi
- **Monde** : nature sauvage, spawn en forêt avec zone sûre ; monde généré de taille fixe ; un seul monde persistant
  pour 10 à 100 joueurs.
- **Couches alignées** : surface, un niveau de mine (torches obligatoires), étages ; donjons à part.
- **Contrôles** : déplacement libre (WASD, ZQSD, flèches) ; joystick et boutons sur téléphone, en paysage ; zoom réglable.
- **Vue** : 3/4, cases et personnages 8×8 ; skins = 3 frames regard à droite, retournées pour la gauche, sans éditeur
  intégré ; arme dessinée par-dessus le personnage.
- **Combat** : temps réel façon vieux Zelda ; PvP partout sauf au spawn et dans les parcelles.
- **Survie** : vie + faim. À la mort on garde tout, sauf un peu d'or.
- **Progression** : compétences qui montent en pratiquant.
- **Ressources** : les zones sans construction se régénèrent.
- **Temps** : 30 min de jour, 30 min de nuit ; pluie, orage, saisons.
- **Monstres** : partout sauf au spawn, uniquement autour des joueurs connectés, repoussés par la lumière, ils cassent
  les murs, la plupart disparaissent à l'aube.
- **Ferme** : cultures avec arrosage et saisons ; tous les animaux apprivoisables, enclos, reproduction, montures.
- **Inventaire** : 10 cases (20 avec un sac), barre d'objets façon Minecraft ; objets au sol ramassables par tous.
- **Économie** : or ; échanges sécurisés façon Dofus ; mode marchand à la déconnexion (invincible).
- **Craft et construction** : craft par liste ; construction case par case ; murs de solidité variable ; portes à
  clé ; meubles.
- **Contenu** : PNJ au spawn et dans le monde ; pêche, cuisine, chasse, exploration, ruines, coffres cachés, donjons.
- **Parcelles** : 16×16, créées avec un plan qu'on fabrique, agrandies contre de l'or, jamais libérées ; rien ne s'y
  casse ; pas de PvP dedans. Déconnecté, ton personnage disparaît.
- **Social** : trahisons laissées aux joueurs ; guildes avec rangs et permissions ; réputation visible et primes ;
  factions en pause ; toits qui cachent l'intérieur.
- **Chat** : proximité, privé, guilde, bulles. Pas de canal global.
- **Modération** : toi seul ; liste blanche validée dans un onglet admin ; signalement, mute, ban, filtre de mots ;
  commandes en jeu (téléportation, don d'objets…).
- **Plateforme** : français et anglais ; jeu sur ton domaine, page itch.io comme vitrine et pour les dons.
- **Hébergement** : joueurs au Québec, donc serveur OVH à Beauharnois ; tests gratuits depuis ton PC par tunnel.
- **Plan** : première version jouable et ordre des phases validés (voir `docs/ROADMAP.md`).

## Valeurs par défaut (à ajuster après les tests)
| Sujet | Valeur |
|---|---|
| Couche | 1024 × 1024 cases ; chunks de 32 × 32 |
| Zone sûre | rayon de 32 cases autour du spawn ; clairière de spawn de rayon 6 |
| Déplacement | 5 cases/s ; eau peu profonde × 0,5 ; boîte du joueur 0,6 × 0,6 case |
| Portée d'interaction | 1,5 case ; station de craft à 3 cases au plus |
| Piles | 99 par défaut ; outils et armes 1 ; or 1 000 000 |
| Inventaire | 10 cases ; sac + 10 ; équipement : tête, corps, sac |
| Objets au sol | disparaissent après 10 min ; 2 s d'attente pour celui qui lâche |
| Récolte | PV d'un élément récupérés après 30 s sans coup ; baies repoussent en 10 min ; pomme 20 % |
| Vie et faim | 20 et 20 ; faim −1 toutes les 90 s ; à 0 : −1 PV toutes les 10 s ; +1 PV toutes les 5 s si faim ≥ 16 |
| Nourriture | baies +2 ; pomme +4 |
| Mort | 10 % de l'or porté tombe au sol ; réapparition au lit, sinon au spawn ; 5 s d'invulnérabilité |
| Combat | main : 1 dégât, 0,5 s ; épée en bois : 3 dégâts, 0,45 s ; recul 0,5 case ; invulnérabilité 0,5 s |
| Outils en bois | hache et pioche : puissance 2, durabilité 60 ; épée : durabilité 60 |
| Cycle | 60 min (30 de jour, 30 de nuit) ; aube et crépuscule de 3 min |
| Saisons | 7 jours de jeu chacune (7 h réelles) |
| Lumière | torche : rayon de 6 cases |
| Monstres | anneau de 18 à 32 cases ; repérage à 10 cases ; 6 par joueur, 150 au total ; 80 % disparaissent à l'aube ; disparition à plus de 64 cases pendant 60 s |
| Monstres du MVP | Gluant 6 PV, 2 dégâts, 2 cases/s ; Rôdeur 10 PV, 3 dégâts, 4 cases/s |
| Murs | bois 20 PV ; pierre 60 PV (P1) |
| Pièce avec toit | 64 cases au plus |
| Chat | proximité 16 cases ; 200 caractères ; 5 messages par 10 s |
| Pseudo | 3 à 16 caractères : lettres, chiffres, `_` |
| Régénération | zones de 32 × 32 sans construction, tous les 7 jours |
| Mode marchand | partout sauf mine, donjons et zone sûre ; 10 au plus par zone de 32 × 32 |
| Réseau | tick 20 Hz ; rayon d'abonnement plafonné à 3 chunks ; 30 inputs/s au plus |
| Sauvegarde | chunks toutes les 30 s ; personnages toutes les 60 s et à la déconnexion |

## Questions ouvertes
1. **« Bouger en jeu » (admin)** : compris comme le mode admin (invisible, traverse les murs) + `/tphere`.
   Si tu voulais dire déplacer des objets ou des animaux à la main, précise-le.
2. **Interdits** : à définir. Par défaut : pas de pay-to-win, pas de publicité, dons sans avantage en jeu.
3. **Palette et police** : en attente de tes références de sprites (dossier `ref/` à la racine du projet).
4. **Noms provisoires** : monstres « Gluant » et « Rôdeur ».
5. **Copie de clé** (P2) : par défaut, oui, à l'établi, à partir de la clé d'origine.
6. **Animaux apprivoisés hors parcelle** (P5) : par défaut, ils peuvent être tués mais pas volés.
7. **Nom de domaine** : à choisir avant la mise en production (étape 26).
