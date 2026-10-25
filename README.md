# Personal Trainer 🧗

Mon appli de sport perso : programme hebdomadaire escalade, muscu et course, chrono intégré, rappels et suivi de progression.

👉 **https://hugokirbach.github.io/personnal-trainer/**

## Installer sur Android

1. Ouvre le lien dans Chrome.
2. Menu ⋮, puis « Ajouter à l'écran d'accueil » (ou « Installer l'application »).
3. Dans l'appli, onglet Réglages : active les notifications et ajoute tes créneaux à Google Agenda.

## Fonctionnalités

- **Aujourd'hui** : la séance du jour, exercices à cocher, chrono en un appui, conseil du jour, puis ressenti (Facile / OK / Dur), course terminée ou non, cotation max, douleur.
- **Séance guidée** : un seul chrono pour toute la séance, avec décompte, exercice en cours en grand, exercice suivant et temps restant.
- **Tutos** : un bouton « i » par exercice ouvre les consignes, les erreurs à éviter et des vidéos de démonstration.
- **Semaine** : le planning, avec la possibilité de déplacer une séance.
- **Chrono** : chronomètre avec tours, minuteur de repos, intervalles (poutre, tabata, 30/30, gainage), son et vibration, écran maintenu allumé.
- **Suivi** : séances par semaine, ressenti, progression en voie vers le 7a, historique.
- **Salle ou maison** : coche dans Réglages tes abonnements (escalade, muscu). Sans abonnement, les séances passent en version maison (barre de traction, haltères, gilet lesté, pompes).
- **Version express** : un bouton sur la séance du jour la remplace par une séance de 25 min à la maison.
- **Prise de référence** : toutes les 4 semaines, des tests (pompes, tractions, suspension, pince, planche, squat, course 12 min) recalculent répétitions, charges et allures.
- **Programme adaptatif** : cycles de 4 semaines, volume et niveau cible ajustés selon le ressenti.

Les données restent sur le téléphone (export et import JSON dans Réglages).

## Développement

```bash
npm install
npm start          # http://localhost:8080
npm test           # tests unitaires
npm run test:e2e   # test dans Chromium
```
