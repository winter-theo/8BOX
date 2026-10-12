---
paths:
  - "packages/shared/**"
---

# Règles pour packages/shared

- Ce code tourne côté client ET côté serveur : aucune dépendance au DOM, à Phaser ni aux modules Node (fs, net, http).
- Logique pure et déterministe. Pas de `Math.random` : utiliser le RNG seedé de `src/util/rng.ts`.
- Le contenu (`content/*.json`) est validé par les schémas zod de `src/content/schemas.ts`.
  Tout nouveau champ = schéma + type inféré + test de validation.
- Identifiants de contenu : chaînes avec espace de noms (`base:oak_log`). Les index numériques sont des détails
  d'exécution et ne sont JAMAIS persistés ni envoyés comme référence durable.
- Valeurs de gameplay dans `src/config/*.ts` : objets `as const`, chaque valeur commentée avec son unité.
- Protocole : chaque message client → serveur a un schéma zod dans `src/protocol/`. Les messages serveur → client
  sont typés (pas de validation à l'exécution côté client).
- Tout ce qui est utilisé par les apps est exporté depuis `src/index.ts` (pas d'import profond depuis les apps).
- Chaque nouvelle clé i18n existe dans `fr.json` ET `en.json` (un test le vérifie).
