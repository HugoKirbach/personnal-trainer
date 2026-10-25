# Personal Trainer

Appli web installable (PWA) personnelle d'Hugo : programme hebdomadaire escalade + muscu + course, chrono intégré, notifications, suivi du ressenti et programme qui s'adapte. Cible : Android (Chrome). Interface et textes en français.

## Structure

- `index.html`, `css/styles.css` : coquille et styles (thème clair/sombre via variables CSS).
- `js/program.js` : modèles de séances, répartition 3/4/5 séances, cycle de 4 semaines (reprise, construction, intensification, décharge), règles d'adaptation. Logique pure, testée.
- `js/timer.js` : chrono, minuteur, intervalles (calcul par horodatage), son et vibration.
- `js/guided.js` : séance guidée (`buildSteps` transforme une séance en étapes, `GuidedRunner` les enchaîne).
- `js/guides.js` : fiches tuto des exercices (consignes, erreurs, recherche vidéo YouTube). Chaque `info` d'exercice doit pointer vers une fiche existante.
- `js/app.js` : rendu des vues et événements (délégation par `data-*`).
- `js/charts.js` : graphiques SVG faits main. `js/calendar.js` : liens Google Agenda et export .ics.
- `js/store.js` : état dans `localStorage` (clé `personnal-trainer:v1`).
- `sw.js` : cache hors ligne et rappel du jour via Periodic Background Sync. Incrémenter `VERSION` quand la liste des fichiers change.

## Règles

- Aucune dépendance ni étape de build : modules ES servis tels quels. Garder ça.
- Accès salle (`settings.access`) : sans abonnement, `resolveKey` remplace les séances par leurs versions maison (`*Maison`). Le mode express (`state.express`) remplace une séance par une version de 20 à 30 min à la maison. Pas de dips à la maison.
- Matériel maison : un seul haltère réglable de 2 à 10 kg, gilet lesté de 4 à 8 kg, pince de préhension de 5 à 60 kg, barre de traction. Exercices maison à un bras, jamais « des haltères ».
- Prise de référence (`reference`, `state.benchmarks`) : tests maximaux toutes les 4 semaines. `prescriptions(latestBench(state))` en déduit répétitions, charges (gilet, pince) et allures de course (VMA du test de Cooper), passées aux modèles via `ctx.p`.
- Précautions santé d'Hugo : pas de poutre avant la semaine 5, mobilité nuque et dos à chaque séance d'escalade, éviter l'escalade deux jours de suite.
- Les exercices sont structurés (`sets`, `reps`, `work`, `timed`, `rest`, `inner`, `circuit`, `restAfter`, voir l'en-tête des modèles dans `program.js`) : le texte, le chrono ⏱, la durée totale et la séance guidée en sont déduits. Ne pas écrire les repos en dur dans les notes.
- Ajouter un test dans `tests/program.test.js` pour toute règle de programme ou d'adaptation.

## Commandes

- `npm test` : tests unitaires (node --test).
- `npm run test:e2e` : parcours complet dans Chromium (Playwright).
- `npm start` : serveur local sur http://localhost:8080.

Publication : GitHub Actions déploie `main` sur https://hugokirbach.github.io/personnal-trainer/ après les tests.
