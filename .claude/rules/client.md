---
paths:
  - "apps/client/**"
---

# Règles pour apps/client

- Trois couches séparées :
  - `src/game/` : état, réseau, prédiction, cache du monde (TypeScript pur, sans React ni Phaser) ;
  - `src/phaser/` : rendu, scènes, caméra, entrées clavier et souris ;
  - `src/ui/` : React (HUD, menus, inventaire, chat, admin, contrôles mobiles).
- React ne se re-rend jamais à 60 FPS : l'UI lit un store Zustand mis à jour quelques fois par seconde, avec sélecteurs.
- Phaser et React communiquent par l'`EventBus` et le store, jamais en important les composants l'un de l'autre.
- Pixel art net : `pixelArt: true`, arrondi des pixels, zoom en paliers entiers. Aucune image floue.
- Clavier : utiliser `KeyboardEvent.code` (positions physiques) pour que WASD devienne ZQSD en AZERTY.
- Tactile : chaque action doit être faisable au doigt (boutons ≥ 48 px, appui long). Vérifier en vue mobile paysage.
- Aucun texte en dur : `t('clé')` avec i18next, clés en français et en anglais.
- Les images passent par le registre d'assets (ID de sprite → atlas ou placeholder généré).
  Jamais de chemin d'image en dur dans le code de jeu.
- Le client n'invente aucun résultat : il affiche ce que le serveur confirme (seuls le déplacement local et les
  animations sont prédits).
