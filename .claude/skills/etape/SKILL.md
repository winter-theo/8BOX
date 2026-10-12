---
description: Réalise une étape de la feuille de route 8Box à partir de sa fiche docs/steps/<id>-*.md.
argument-hint: "[id d'étape, ex. 05 ou P1-02]"
disable-model-invocation: true
---

Étape demandée : $ARGUMENTS (un numéro seul s'écrit sur deux chiffres : 5 → 05).

1. Trouve la fiche avec Glob `docs/steps/<id>-*.md`. Si elle n'existe pas, arrête-toi et propose
   `/planifier-phase <phase>`.
2. Lis le haut de `docs/PROGRESS.md` (« En cours », « À valider » et la dernière entrée d'historique).
   - Cette étape est déjà « En cours » : reprends où elle s'est arrêtée (`git status`,
     `git log --oneline -10`, cases cochées). Ne refais pas ce qui est fait.
   - Une AUTRE étape est en cours et inachevée : arrête-toi et demande quoi faire.
   - Vérifie que les prérequis de la fiche sont ✅ dans `docs/ROADMAP.md`. Sinon, arrête-toi et dis-le.
3. Lis la fiche, puis UNIQUEMENT les documents et sections qu'elle cite.
4. Crée la branche `step/<id>-<sujet>` depuis `main` à jour (si elle n'existe pas déjà).
   Écris dans `docs/PROGRESS.md` (« En cours ») la liste des sous-tâches en cases à cocher.
   Passe l'étape à 🟡 dans `docs/ROADMAP.md`. Commit.
5. Implémente sous-tâche par sous-tâche. Après chacune : vérifications utiles (`pnpm check` ou la partie
   concernée), case cochée, commit `step <id>: <sous-tâche>`.
6. Vérifie chaque critère d'acceptation et écris les tests demandés par la fiche.
7. Clôture : remplace le bloc « En cours » par une entrée d'historique en haut de l'historique
   (date, résumé en 3 à 6 lignes, écarts par rapport à la fiche, points « À valider »).
   Passe l'étape à ✅ dans `docs/ROADMAP.md`. `pnpm check` doit passer. Commit final.
   Pousse la branche, ouvre une PR vers `main` (titre « Étape <id> : <nom> », description en français :
   contenu et comment tester), fusionne-la (commit de fusion, branche supprimée), puis remets `main` local à jour.
8. Termine par un message court à l'utilisateur : ce qui marche, comment le tester à la main
   (étapes concrètes), les points à valider. Ne commence PAS l'étape suivante.

Pendant toute l'étape :
- Respecte la section « Hors périmètre » : ce qui n'est pas prévu se note dans `docs/PROGRESS.md`, ne se code pas.
- Si le contexte devient très chargé : termine la sous-tâche en cours, commit, note précisément
  où tu en es dans « En cours », puis arrête-toi et dis à l'utilisateur de relancer `/etape <id>`
  après `/clear`.
