# Étape 01 — Socle partagé : contenu, config, i18n

**Prérequis** : 00
**Lire** : `docs/ARCHITECTURE.md` §5, §11, §12 ; `docs/design/04-craft-construction.md` §Objets de départ ;
`docs/DECISIONS.md` §Valeurs par défaut
**Taille** : moyenne

## Objectif
Le contenu du jeu se décrit en JSON validé, les valeurs de gameplay sont centralisées, et l'interface parle français
et anglais.

## À faire
1. `packages/shared/src/util/rng.ts` : RNG seedé (mulberry32 ou sfc32) et helpers (`int`, `float`, `pick`, `chance`).
2. `src/util/events.ts` : émetteur d'événements typé et synchrone (`TypedEmitter<EventMap>`).
3. `src/content/schemas.ts` (zod 4) :
   - `TileDef` : `id`, `slot` (`ground | floor | object`), `sprite`, `solid`, `tall`, `hp`, `light?`, `harvest?`
     (outil conseillé), `loot?`, `station?` ;
   - `ItemDef` : `id`, `sprite`, `stack`, `tags`, `tool?` (`kind`, `power`, `durability`), `weapon?` (`damage`,
     `cooldownMs`, `durability`), `food?` (`hunger`), `place?` (id de case), `equip?` (`slot`, `extraSlots?`) ;
   - `RecipeDef` (`inputs`, `outputs`, `station?`, `timeMs`), `LootTable`, `CreatureDef` (ébauche).
4. `src/content/load.ts` : valide les JSON, construit les registres (Map par id + index numériques stables, triés par
   id), vérifie les références croisées. Erreurs claires : fichier, id, champ.
5. Contenu initial dans `packages/shared/content/` : terrains (herbe, terre, sable, eau peu profonde, eau profonde),
   éléments naturels (chêne, buisson à baies, hautes herbes, fleurs), objets de base (bûche, planche, bâton, fibre,
   baies, pomme, or). Les fichiers de recettes, butin et créatures peuvent être des listes vides pour l'instant.
   Exporter le contenu brut depuis shared (imports JSON) pour que le client et le serveur le chargent de la même façon.
6. `src/config/*.ts` : `world`, `time`, `player`, `inventory`, `interaction`, `harvest`, `crafting`, `survival`,
   `combat`, `monsters`, `light`, `building`, `chat`, `net`, `persistence`, avec les valeurs de `docs/DECISIONS.md`
   (commentées, avec unités). Les étapes suivantes y ajouteront leurs valeurs.
7. i18n : `src/i18n/fr.json` et `en.json` (clés `ui.*` et `content.*`). Côté client : i18next + react-i18next,
   langue du navigateur, français par défaut, sélecteur de langue simple (mémorisé). Remplacer les textes de
   l'étape 00 par des clés.

## Critères d'acceptation
- [ ] Le contenu se charge côté serveur (au démarrage) et côté client.
- [ ] Une référence cassée (ex. recette vers un objet inexistant) produit une erreur claire (testé).
- [ ] Changer de langue change les textes affichés.
- [ ] `pnpm check` passe.

## Tests à écrire
- Validation du contenu : un cas valide et au moins trois cas d'erreur.
- RNG : même graine → même suite.
- i18n : mêmes clés en FR et EN ; chaque case et chaque objet a un nom dans les deux langues.

## Hors périmètre
- Les recettes (17), le butin (16), les créatures détaillées (23).

## Notes
- Les index numériques sont des détails d'exécution : ne jamais les persister.
