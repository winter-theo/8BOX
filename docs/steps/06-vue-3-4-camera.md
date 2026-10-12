# Étape 06 — Vue 3/4, profondeur, caméra et zoom

**Prérequis** : 05
**Lire** : `docs/design/10-graphismes-son.md` §Vue 3/4 ; `docs/design/02-joueur.md` §Caméra ;
`docs/ARCHITECTURE.md` §10
**Taille** : moyenne

## Objectif
Arbres, buissons, murs et entités s'affichent en 3/4 avec un tri en profondeur correct, et la caméra zoome par
paliers entiers.

## À faire
1. Rendu des objets (emplacement `object`) : sprites ancrés en bas de leur case ; un objet `tall` dépasse vers le
   haut (8 × 16) ; profondeur selon Y ; création et recyclage (pool) au rythme des chunks.
2. Placeholders d'objets : chêne (tronc + feuillage, 8 × 16), buisson, hautes herbes, fleurs, mur avec face visible,
   porte.
3. Calque des entités prêt : les sprites d'entités se trient avec les objets.
4. Caméra : zoom par paliers entiers (touches + et −, pincement sur téléphone), borné pour ne jamais afficher plus de
   ~150 cases de large ; zoom par défaut ≈ 40 cases de large ; limites de la carte ; suivi d'une cible.
5. Réception de `tileUpdate` : redessin du sol du chunk ou du sprite d'objet concerné.

## Critères d'acceptation
- [ ] Une entité de test placée derrière un arbre est cachée par le feuillage ; devant, elle le recouvre.
- [ ] Le zoom passe d'un palier à l'autre sans flou.
- [ ] 60 FPS sur la vue par défaut sur PC (moniteur de FPS en dev).

## Tests à écrire
- Fonctions de tri et d'ancrage, si elles sont extraites en fonctions pures.

## Hors périmètre
- Toits (19), lumière (21), joueur jouable (07).
