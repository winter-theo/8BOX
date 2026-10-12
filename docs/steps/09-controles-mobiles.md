# Étape 09 — Contrôles mobiles

**Prérequis** : 07
**Lire** : `docs/design/02-joueur.md` §Contrôles sur téléphone (paysage), §Caméra
**Taille** : petite à moyenne

## Objectif
Le jeu se joue au téléphone en paysage : joystick, boutons, appui long, pincement pour zoomer.

## À faire
1. Détection du tactile ; HUD mobile en React : joystick virtuel à gauche (grande zone, retour au centre), boutons à
   droite (Frapper/Utiliser, Action, Inventaire), place réservée pour la barre d'objets en bas.
2. Le joystick produit le même `input` que le clavier (8 directions).
3. Appui long sur le monde → événement « menu d'actions » sur la case touchée. Le menu réel arrive à l'étape 15 :
   pour l'instant, une bulle de debug affiche la case.
4. Pincement → zoom par paliers. Empêcher le zoom et le défilement du navigateur (`touch-action`, balise viewport).
5. En portrait : écran « Tourne ton téléphone ». Bouton plein écran, et verrouillage en paysage quand le navigateur le
   permet.
6. Boutons d'au moins 48 px, interface lisible sur un petit écran.

## Critères d'acceptation
- [ ] Sur un téléphone (ou l'émulation mobile du navigateur), on se déplace au joystick sans que la page bouge ;
      le pincement zoome ; le portrait affiche le message.
- [ ] Sur PC, rien ne change.

## Tests à écrire
- Conversion position du joystick → direction (fonction pure).

## Hors périmètre
- Menu d'actions réel (15), barre d'objets (14).
