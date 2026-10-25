# Personal Trainer 🧗

Mon appli de sport perso : programme hebdomadaire escalade, muscu et course, chrono intégré, rappels et suivi de progression.

👉 **https://hugokirbach.github.io/personnal-trainer/**

## Installer sur Android

1. Ouvre le lien dans Chrome.
2. Menu ⋮, puis « Ajouter à l'écran d'accueil » (ou « Installer l'application »).
3. Dans l'appli, onglet Réglages : active les notifications et ajoute tes créneaux à Google Agenda.

## Fonctionnalités

- **Aujourd'hui** : la séance du jour, exercices à cocher, chrono en un appui, conseil du jour, puis ressenti (Facile / OK / Dur), course terminée ou non, cotation max, zone douloureuse.
- **État de forme** : avant la séance, trois questions (sommeil, énergie, courbatures). En petite forme, une série de moins par exercice ; en grande forme, une série bonus sur les deux premiers exercices (jamais sur ce qui charge les doigts, ni en semaine de décharge).
- **Remplacer un exercice** : le bouton ⇄ propose deux ou trois variantes du même mouvement, avec le matériel du lieu et sans solliciter une zone douloureuse, pour aujourd'hui ou pour toujours.
- **Temps dispo** : choisis 20, 30, 45 ou 60 min et la séance est raccourcie (repos, séries, exercices secondaires) en gardant l'échauffement, la mobilité nuque et dos et l'exercice principal.
- **Midi ou soir** : une séance de semaine passe du midi au soir, ou l'inverse, pour ce jour-là (sur la séance ou dans Semaine).
- **Séance guidée** : un seul chrono pour toute la séance, avec décompte, exercice en cours en grand, exercice suivant, temps restant et annonces vocales (coupables avec 🔊).
- **Carnet de charges** : répétitions et charge de chaque série (dans la séance guidée ou avec 📒). L'appli propose l'objectif suivant : une répétition de plus, puis +1 kg quand le haut de la fourchette est atteint.
- **Douleurs** : signale une zone (doigts, coude, épaule, nuque, dos…) et les exercices qui la sollicitent sont retirés pendant 7 jours, jusqu'à « Ça va mieux ».
- **Carnet d'escalade** : chaque voie (cotation) ou bloc (niveau de ta salle : Vert à Noir, 1 à 9…), flash, enchaîné ou en travail, avec la courbe du max par semaine et la pyramide.
- **Mes salles** : dans Réglages, les niveaux de bloc de chaque salle et leur équivalence approximative en cotation (pour comparer les salles et suivre ta progression). Les séances de bloc indiquent les niveaux à viser dans tes salles.
- **Projets** : les voies et blocs à ta limite, travaillés sur plusieurs séances (nom, secteur, notes, photo). Dans la séance d'escalade, compte tes essais et ton point haut ; « Enchaîné ! » clôt le projet et l'ajoute au carnet. Suivi garde la liste des projets en cours et enchaînés, avec la progression séance par séance. La photo reste sur le téléphone.
- **Tutos** : un bouton « i » par exercice ouvre les consignes, les erreurs à éviter et des vidéos de démonstration.
- **Semaine** : le planning, avec la possibilité de déplacer une séance.
- **Chrono** : chronomètre avec tours, minuteur de repos, intervalles (poutre, tabata, 30/30, gainage), son et vibration, écran maintenu allumé.
- **Suivi** : séances par semaine, ressenti, progression en voie et en bloc vers le 7a, carnet de charges, références, historique.
- **Salle ou maison** : coche dans Réglages tes abonnements (escalade, muscu) et si tu peux courir. Sans abonnement, les séances passent en version maison (barre de traction, haltère, gilet lesté, pompes). Sans course, le cardio se fait sur vélo, rameur ou elliptique en salle, ou en circuit (jumping jacks, shadow boxing, mountain climbers, fentes, burpees) à la maison.
- **Version express** : un bouton sur la séance du jour la remplace par une séance de 25 min à la maison.
- **Prise de référence** : toutes les 4 semaines, des tests (pompes, tractions, suspension, pince, planche, squat, course 12 min) recalculent répétitions, charges et allures. En séance guidée, tu notes ton résultat à la fin de chaque test ; pour la suspension et la planche, le chrono tourne jusqu'à ton ✓ et le temps est proposé à confirmer ou corriger.
- **Routine nuque et dos** : 8 min guidées, idéale les jours sans séance (nuque, haut du dos, épaules, avant-bras). Notée d'un geste, elle ne change pas le volume du programme.
- **Parcours abdos** : une séance de 25 à 35 min, en salle ou à la maison, à lancer quand tu veux (grand droit, obliques, gainage profond et lombaires).
- **Programme adaptatif** : cycles de 4 semaines, volume et niveau cible ajustés selon le ressenti.
- **Objectifs de saison** : fixe dans Réglages une cotation en voie (7a, par exemple) et un niveau en bloc (Rouge dans ta salle), chacun avec sa date. Les cycles s'enchaînent en blocs base, force, force-endurance et performance, puis deux semaines d'affûtage avant l'objectif le plus proche, et repartent vers le suivant. Les séances changent selon le bloc (4 × 4, voie projet, suspensions répétées…) et Suivi montre la frise des blocs et, pour chaque objectif, si tu es en avance ou en retard.

- **Compte (facultatif)** : Réglages › Compte, « Continuer avec Google » ou e-mail, avec le même compte Firebase que BeatForge. Chaque changement est sauvegardé en ligne quelques secondes après, retrouvé sur un autre téléphone, et fusionné si deux téléphones ont été modifiés. Une sauvegarde par jour est gardée 7 jours (bouton « Sauvegardes en ligne » pour revenir en arrière).

Sans compte, les données restent sur le téléphone (export et import JSON dans Réglages).

## Développement

```bash
npm install
npm start          # http://localhost:8080
npm test           # tests unitaires
npm run test:e2e   # test dans Chromium
```
