# Feuille de route

Statuts : ⬜ à faire · 🟡 en cours · ✅ terminé.
Une ligne = une session Claude Code : `/etape <id>`, puis `/clear` avant la suivante.

## Phase MVP — première version jouable

| Id | Étape | Prérequis | Statut |
|---|---|---|---|
| 00 | [Monorepo et outillage](steps/00-monorepo.md) | — | ⬜ |
| 01 | [Socle partagé : contenu, config, i18n](steps/01-socle-partage.md) | 00 | ⬜ |
| 02 | [Serveur : boucle, modules, entités, événements](steps/02-boucle-serveur.md) | 01 | ⬜ |
| 03 | [Protocole et connexions](steps/03-protocole-connexions.md) | 02 | ⬜ |
| 04 | [Génération du monde de surface](steps/04-generation-surface.md) | 02 | ⬜ |
| 05 | [Chunks : diffusion et rendu du sol](steps/05-chunks-rendu-sol.md) | 03, 04 | ⬜ |
| 06 | [Vue 3/4, profondeur, caméra et zoom](steps/06-vue-3-4-camera.md) | 05 | ⬜ |
| 07 | [Déplacement autoritaire et collisions](steps/07-deplacement.md) | 06 | ⬜ |
| 08 | [Prédiction, interpolation, multijoueur](steps/08-multijoueur-fluide.md) | 07 | ⬜ |
| 09 | [Contrôles mobiles](steps/09-controles-mobiles.md) | 07 | ⬜ |
| 10 | [Base de données et sauvegarde](steps/10-base-de-donnees.md) | 08 | ⬜ |
| 11 | [Connexion Google, pseudo et liste blanche](steps/11-connexion-clerk.md) | 10 | ⬜ |
| 12 | [Onglet admin v1](steps/12-admin-v1.md) | 11 | ⬜ |
| 13 | [Chat, filtre et signalements](steps/13-chat.md) | 12 | ⬜ |
| 14 | [Inventaire, barre, bourse, objets au sol](steps/14-inventaire.md) | 09, 10 | ⬜ |
| 15 | [Interactions : visée, action, menu](steps/15-interactions.md) | 14 | ⬜ |
| 16 | [Récolte et zone sûre](steps/16-recolte.md) | 15 | ⬜ |
| 17 | [Craft, établi et outils](steps/17-craft-outils.md) | 16 | ⬜ |
| 18 | [Construction : sols, murs, portes, meubles](steps/18-construction.md) | 17 | ⬜ |
| 19 | [Pièces et toits automatiques](steps/19-toits.md) | 18 | ⬜ |
| 20 | [Vie, faim, mort et réapparition](steps/20-survie-mort.md) | 18 | ⬜ |
| 21 | [Jour, nuit et lumière](steps/21-jour-nuit-lumiere.md) | 18 | ⬜ |
| 22 | [Combat façon Zelda et PvP](steps/22-combat-pvp.md) | 20 | ⬜ |
| 23 | [Monstres de nuit](steps/23-monstres.md) | 21, 22 | ⬜ |
| 24 | [Commandes admin et mode admin](steps/24-commandes-admin.md) | 13, 23 | ⬜ |
| 25 | [Test en ligne gratuit](steps/25-test-en-ligne.md) | 24 | ⬜ |
| 26 | [Mise en production](steps/26-production.md) | 25 | ⬜ |

Jalons :
- après 08 : on se promène à plusieurs dans la forêt ;
- après 13 : connexion Google, liste blanche et chat ;
- après 19 : on bâtit une cabane avec un toit ;
- après 23 : on survit (ou pas) à la nuit ;
- après 26 : 8Box est en ligne pour de bon.

---

## Phases suivantes

Chaque phase se découpe en fiches avec `/planifier-phase <id>` (session courte, sans code), puis se code avec
`/etape <id>-01`, `/etape <id>-02`…

### P1 — Mine et lumière
- Lire : design/01 §Taille et couches, §Lumière ; design/04 §Outils et paliers ; design/03 §Monstres ; ARCHITECTURE §4, §7.
- Étapes prévues : P1-01 Couches et passages (escalier, échelle, abonnement aux chunks par couche) ·
  P1-02 Génération de la mine (pierre, grottes, minerais) · P1-03 Obscurité souterraine, torches et monstres de la mine ·
  P1-04 Four, lingots, outils, armes et murs en pierre et en fer.
- Terminé quand : on creuse un accès, on descend, on mine à la torche et on fabrique des outils en fer.

### P2 — Parcelles, coffres et clés
- Lire : design/04 §Coffres, serrures et clés, §Parcelles ; design/03 §PvP.
- Étapes prévues : P2-01 Coffres et conteneurs · P2-02 Parcelles (plan, pose, agrandissement, protections, pas de PvP) ·
  P2-03 Serrures, clés et journal d'accès.
- Terminé quand : ta cabane est sur ta parcelle, intouchable, et ton coffre ne s'ouvre qu'avec la clé.

### P3 — Compétences
- Lire : design/05.
- Étapes prévues : P3-01 XP et niveaux (événements → XP, fenêtre des compétences) · P3-02 Effets et recettes débloquées.

### P4 — Ferme, météo et saisons
- Lire : design/01 §Temps ; design/06 §Agriculture.
- Étapes prévues : P4-01 Calendrier, saisons et météo · P4-02 Agriculture.

### P5 — Animaux
- Lire : design/06 §Animaux.
- Étapes prévues : P5-01 Faune et chasse · P5-02 Apprivoisement et compagnons ·
  P5-03 Élevage, production et reproduction · P5-04 Montures.

### P6 — Économie et PNJ marchands
- Lire : design/07 §Or, §Échanges, §Mode marchand, §PNJ.
- Étapes prévues : P6-01 Marchands PNJ au spawn · P6-02 Échange sécurisé · P6-03 Mode marchand hors ligne.

### P7 — Guildes et justice
- Lire : design/07 §Guildes, §Réputation et primes.
- Étapes prévues : P7-01 Guildes, rangs et chat de guilde · P7-02 Permissions de guilde · P7-03 Réputation et primes.

### P8 — Étages
- Lire : design/01 §Taille et couches ; design/04 §Pièces et toits.
- Étapes prévues : P8-01 Couche d'étage et escaliers · P8-02 Construction et rendu des étages.

### P9 — Exploration
- Lire : design/08.
- Étapes prévues : P9-01 Structures et ruines · P9-02 Coffres cachés et tables de butin · P9-03 Villages et quêtes ·
  P9-04 Instances de donjon · P9-05 Premier donjon et boss.

### P10 — Pêche et cuisine
- Étapes prévues : P10-01 Pêche · P10-02 Cuisine (feu de camp, plats).

### P11 — Skins personnalisés
- Lire : design/02 §Personnage ; design/09 §Onglet Admin.
- Étapes prévues : P11-01 Import, validation, stockage et affichage des skins, signalement et réinitialisation par
  l'admin.

### P12 — Régénération des zones
- Lire : design/01 §Régénération des zones ; ARCHITECTURE §4.
- Étapes prévues : P12-01 Planificateur de régénération.

### P13 — Finitions
- Étapes prévues : P13-01 Sons et options audio · P13-02 Intérieurs cachés côté serveur (anti-triche) ·
  P13-03 Test de charge à 100 bots et optimisations · P13-04 Aide en jeu pour les nouveaux joueurs.

### Plus tard
- Factions, armes à distance, armures, application installable (PWA), nouvelles couches de mine.
