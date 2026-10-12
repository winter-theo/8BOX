---
description: Corrige un bug signalé dans 8Box, au plus près de la cause, sans élargir le périmètre.
argument-hint: "[description courte du bug]"
disable-model-invocation: true
---

Bug signalé : $ARGUMENTS

1. Localise la cause avec Grep et Glob ciblés. Ne lis que les fichiers en cause.
2. Quand c'est possible, écris d'abord un test Vitest qui échoue et reproduit le bug.
3. Corrige au plus petit endroit possible. Pas de refonte ni d'amélioration opportuniste.
4. `pnpm check` doit passer. Commit `fix: <résumé>`.
5. Ajoute une ligne « Correctif » en haut de l'historique de `docs/PROGRESS.md`.
6. Explique en trois lignes à l'utilisateur : la cause, le correctif, comment vérifier.
