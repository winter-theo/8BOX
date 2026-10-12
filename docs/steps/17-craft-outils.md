# Étape 17 — Craft, établi et outils

**Prérequis** : 16
**Lire** : `docs/design/04-craft-construction.md` §Craft, §Outils et paliers, §Objets de départ, §Construction
(premier paragraphe)
**Taille** : moyenne

## Objectif
À partir d'une liste de recettes, on fabrique planches, bâtons, torches, établi, outils et armes en bois, murs, sols,
porte, lit et sac. On peut poser un objet (l'établi d'abord).

## À faire
1. Recettes du tableau « Objets de départ » dans `recipes.json`, avec les nouveaux objets dans `items.json` et
   `tiles.json` (les objets posables ont `place`).
2. Serveur `modules/crafting/` : `craft { recipeId, count }` → vérifie la station à moins de `crafting.stationRange`
   cases (3), les ingrédients et la place → consomme puis donne ; temps de fabrication avec barre de progression,
   annulé si on s'éloigne.
3. Action générique « Poser » (objet en main avec `place`) : sur une case libre et à portée, hors zone sûre ; règles
   détaillées à l'étape 18. Utilisée ici pour poser l'établi.
4. Outils et armes : la récolte (16) utilise le type et la puissance de l'outil ; la durabilité baisse à chaque
   utilisation ; un outil à 0 se brise (message).
5. Client : fenêtre de fabrication (C, bouton sur téléphone) : recettes disponibles, grisées s'il manque des
   ingrédients, quantité, détail des ingrédients, regroupées par station.

## Critères d'acceptation
- [ ] En partant de rien : bûches → planches → établi posé → hache en bois ; la hache coupe plus vite que la main.
- [ ] Impossible de fabriquer sans les ingrédients ou loin de l'établi (vérifié côté serveur, testé).
- [ ] Un outil usé se brise.

## Tests à écrire
- Validation d'une recette, consommation exacte des ingrédients, gestion d'un inventaire plein.
- Usure et casse d'un outil.

## Hors périmètre
- Recettes débloquées par compétence (P3), four (P1), règles fines de construction (18).
