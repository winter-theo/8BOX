---
description: Découpe une phase de docs/ROADMAP.md en fiches d'étapes détaillées, sans écrire de code.
argument-hint: "[id de phase, ex. P1]"
disable-model-invocation: true
---

Phase à planifier : $ARGUMENTS. Tu n'écris AUCUN code dans cette session.

1. Lis la section de la phase $ARGUMENTS dans `docs/ROADMAP.md`, le modèle `docs/steps/_MODELE.md`
   et le haut de `docs/PROGRESS.md`.
2. Lis les sections de `docs/design/` et `docs/ARCHITECTURE.md` citées par la phase. Survole avec Glob
   l'arborescence de `apps/server/src/modules/`, `packages/shared/src/` et `apps/client/src/` pour
   connaître ce qui existe déjà (noms de fichiers seulement, sans tout lire).
3. Rédige une fiche par étape prévue : `docs/steps/$ARGUMENTS-01-<nom>.md`, `-02-`, etc., au format du modèle.
   Chaque fiche doit tenir dans UNE session : un ou deux systèmes, une dizaine de fichiers au plus,
   critères d'acceptation vérifiables, tests demandés, « Hors périmètre » explicite.
   Si une étape prévue est trop grosse, coupe-la et renumérote les suivantes de la phase.
4. Mets à jour la phase dans `docs/ROADMAP.md` : tableau avec liens vers les fiches, prérequis, statut ⬜.
5. Ajoute les questions de design non tranchées dans `docs/DECISIONS.md` (« Questions ouvertes »),
   chacune avec ta proposition par défaut.
6. Commit `plan $ARGUMENTS`. Résume en 5 lignes à l'utilisateur et liste les questions ouvertes.
