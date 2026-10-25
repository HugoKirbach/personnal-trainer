# Personal Trainer

Appli web installable (PWA) personnelle d'Hugo : programme hebdomadaire escalade + muscu + course, chrono intégré, notifications, suivi du ressenti et programme qui s'adapte. Cible : Android (Chrome). Interface et textes en français.

## Structure

- `index.html`, `css/styles.css` : coquille et styles (thème clair/sombre via variables CSS). Barre du bas à 5 onglets, Chrono au centre ; Réglages par la roue ⚙️ de la barre du haut (`.top-settings`).
- `js/program.js` : modèles de séances, répartition 3/4/5 séances, cycle de 4 semaines (reprise, construction, intensification, décharge), règles d'adaptation. Logique pure, testée.
- `js/timer.js` : chrono, minuteur, intervalles (calcul par horodatage), son et vibration.
- `js/guided.js` : séance guidée (`buildSteps` transforme une séance en étapes avec la phrase annoncée `say`, `GuidedRunner` les enchaîne).
- `js/voice.js` : annonces vocales (synthèse vocale du téléphone, `settings.voice`).
- `js/lifts.js` : carnet de charges (`state.lifts`, double progression, `liftPlan` appelé par `buildSession`).
- `js/guides.js` : fiches tuto des exercices (consignes, erreurs, recherche vidéo YouTube). Chaque `info` d'exercice doit pointer vers une fiche existante.
- `js/projects.js` : projets de voies et blocs (`state.projects`, essais et point haut par date dans `log`, `sendProject` verse la croix au carnet d'escalade). `js/photos.js` : photos des projets dans IndexedDB, jamais synchronisées.
- `js/recipes.js` : onglet Alimentation, recettes (données : apports par portion calculés ingrédient par ingrédient) et calculs purs (portions, liste de courses, planning des repas, idées selon la séance).
- `js/app.js` : rendu des vues et événements (délégation par `data-*`).
- `js/charts.js` : graphiques SVG faits main. `js/calendar.js` : liens Google Agenda et export .ics.
- `js/store.js` : état dans `localStorage` (clé `personnal-trainer:v1`), `updatedAt` qui ne recule jamais.
- `js/cloud.js` : compte facultatif (Firebase Auth + Firestore, projet `beatforge-ccd25` partagé avec BeatForge, appli nommée `personnal-trainer` pour une session séparée). Document `users/{uid}/apps/personnal-trainer`, une sauvegarde par jour dans `backups/` (7 gardées). SDK chargé à la demande depuis gstatic et mis en cache par `sw.js`. Les règles Firestore de BeatForge (`users/{uid}/**` réservé au propriétaire) couvrent ce chemin.
- `js/merge.js` : fusion à trois voies de deux états (synchro entre téléphones).
- `sw.js` : cache hors ligne et rappel du jour via Periodic Background Sync. Incrémenter `VERSION` quand la liste des fichiers change.

## Règles

- Aucune dépendance ni étape de build : modules ES servis tels quels. Garder ça.
- Accès salle (`settings.access`) : sans abonnement, `resolveKey` remplace les séances par leurs versions maison (`*Maison`). Le mode express (`state.express`) remplace une séance par une version de 20 à 30 min à la maison. Pas de dips à la maison.
- Course (`settings.access.course`, cochée par défaut) : décochée, aucune séance ne fait courir. Le fractionné devient `fractionneVelo` (salle) ou `cardioMaison`, l'express `expressCardio`, la course des séances muscu passe sur vélo/rameur ou en circuit cardio (`ctx.run`), et le test de Cooper disparaît de la référence.
- Matériel maison : un seul haltère réglable de 2 à 10 kg, gilet lesté de 4 à 8 kg, pince de préhension de 5 à 60 kg, barre de traction. Exercices maison à un bras, jamais « des haltères ».
- Prise de référence (`reference`, `state.benchmarks`) : tests maximaux toutes les 4 semaines. `prescriptions(latestBench(state))` en déduit répétitions, charges (gilet, pince) et allures de course (VMA du test de Cooper), passées aux modèles via `ctx.p`.
- Précautions santé d'Hugo : pas de poutre avant la semaine 5, mobilité nuque et dos à chaque séance d'escalade, éviter l'escalade deux jours de suite.
- Les exercices sont structurés (`sets`, `reps`, `work`, `timed`, `rest`, `inner`, `circuit`, `restAfter`, voir l'en-tête des modèles dans `program.js`) : le texte, le chrono ⏱, la durée totale et la séance guidée en sont déduits. Ne pas écrire les repos en dur dans les notes.
- Carnet de charges : les exercices comptés des séances maison et muscu ont un `lift` (objectif suivant). Les charges sont décrites par `load` (`DB`, `VEST`, `GRIP`, `GYM`) et ne dépassent jamais le matériel. Le gilet et la pince sont recalés par une nouvelle prise de référence. Pas de progression en semaine de décharge.
- Douleurs (`state.pains`) : une zone signalée retire pendant 7 jours les exercices dont la fiche la sollicite (`STRAIN` dans `program.js`, à compléter pour toute nouvelle fiche qui charge une articulation).
- Carnet d'escalade (`state.climbs`) : voies et blocs notés en salle, cotation max préremplie dans le ressenti.
- Salles (`settings.gyms = [{ id, name, levels: [{ name, grade }] }]`, `DEFAULT_GYMS`) : les blocs se notent dans le niveau de la salle (couleurs Vert à Noir, chiffres 1 à 9 chez Hugo), `grade` garde l'équivalence approximative (`SCALE`, plafonnée par `statGrade`) pour les statistiques. Changer une équivalence recale les blocs et projets notés dans ce niveau. Les voies restent en cotation. Les séances de bloc donnent les niveaux équivalents (`ctx.lv`, `withLevels`).
- Projets (`state.projects`) : panneau dans les séances d'escalade en salle et sur Aujourd'hui, carte dans Suivi. Un projet enchaîné ajoute au carnet une croix liée (`climb.project`) ; retirer la croix ou annuler l'enchaînement rouvre le projet. Fusion champ par champ, journal des essais date par date (`merge.js`).
- Parcours abdos (`abdos`, `abdosMaison`, `absSession`, index `abs`) : séance bonus à lancer quand on veut depuis Aujourd'hui, hors répartition hebdo. Pas de crunch classique à la maison (nuque).
- Tests de la prise de référence : en séance guidée, le ✓ de chaque test ouvre la saisie du résultat (`recordBench`). Pour les tests au temps, le temps tenu jusqu'au ✓ est proposé à confirmer ou corriger.
- État de forme (`state.forms[date]`, `formLevel`) : petite forme = une série de moins sur chaque exercice ajustable, grande forme = une série bonus sur les deux premiers exercices comptés, jamais sur ce qui sollicite les doigts (`STRAIN`) ni en semaine de décharge. Sans effet sur la prise de référence (simple conseil).
- Créneau (`state.slots['date#index']`, `setSlot`) : une séance de semaine passe du midi au soir ou l'inverse, pour ce jour-là seulement (pas de choix de créneau sur un jour passé). Le planning s'ouvre sur la semaine suivante quand toutes les séances de la semaine sont passées (`planningMonday`). Une séance déplacée (`moveSession`) emporte son créneau, son mode express et son temps dispo. La carte du jour de repos donne la prochaine séance du planning avec sa date et son heure.
- Remplacer (`SWAP_GROUPS`, `swapChoices`, `setSwap`, `state.swaps`) : variantes par mouvement, `where` = home, gym ou any. Clé `date|nom` pour un jour, `nom` pour toujours. Toute variante a une fiche, ses charges restent dans le matériel, et `STRAIN` est complété pour les nouvelles fiches.
- Temps dispo (`state.durations['date#index']`, `fitDuration`) : repos raccourcis (entre efforts de doigts, 3 min gardées quand il y en avait plus), échauffement et retour au calme écourtés, séries en moins depuis la fin, cardio long raccourci, puis exercices secondaires retirés. L'échauffement, la mobilité nuque et dos et le premier exercice principal restent toujours.
- Routine nuque et dos (`nuque`, `routineSession`, index `nuque`, drapeau `mobility`) : hors programme, sans carnet de charges, et `adapt` ignore ses notes.
- Parcours détente (`detente`, `detenteSession`, index `detente`, drapeau `mobility`) : étirements doux, mobilité et respiration selon les zones de courbatures (`SORE_ZONES`, `RELAX`). Zones choisies dans `state.recovery[date]` (`setSore`), sinon proposées par `suggestSore` d'après les séances des 2 derniers jours. Toujours une mise en route et une respiration lente au sol. Étirements tenus de chaque côté (`hold`). Déplié d'office si les courbatures sont « Fortes » dans l'état de forme.
- Aujourd'hui, dans l'ordre : date, jour de repos s'il y a lieu, idée repas ou repas prévu, douleur en cours, prise de référence si elle est à 3 jours ou moins (sinon tout en bas de la page), état de forme, séances, routine nuque et dos, parcours abdos, parcours détente, carnet d'escalade, douleurs, séance hors programme.
- Objectifs de saison (`settings.goals = { voie, bloc }`, goal = `{ grade, kind, date, from, fromGrade, gym?, level? }`, `seasonPlans`, `blockAt`, `seasonStatus`) : un plan par objectif, dans l'ordre des dates, le suivant repartant après l'objectif précédent (même semaine : un seul pic). Les cycles de 4 semaines deviennent des blocs (`BLOCKS` : base, force, endurance, performance, puis affûtage sur les 2 dernières semaines), les cycles consécutifs de même phase sont regroupés, pas de bloc d'une semaine au départ ni juste avant l'affûtage. Le bloc multiplie le volume (`mult`) et arrive aux modèles par `ctx.block`. La règle de la poutre (pas avant la semaine 5) reste prioritaire. L'ancien `settings.goal` est migré par `normalize`.
- Alimentation (`state.food = { favorites, servings, plan, cart, checked }`) : pas de tomate crue, de chèvre, de coriandre (ni fraîche ni moulue) ni de fruits de mer ; champignons et brocolis avec modération. Matériel : four, plaques, cuiseur à riz, grill-presse, micro-ondes (pas de mixeur). 20 plats et 10 collations. La liste de courses vient des recettes cochées (`cart`), pour les portions réglées sur la fiche (`servings`) ; « Courses de la semaine » coche les recettes prévues des jours restants (`cartFromPlan`). Le planning (`plan[date] = { midi, soir, collation }`, `cantine` ou `dehors` possibles) n'impose rien et `fillDinners` ne remplit que les soirs vides à venir. Repères : 2 g de protéines par kilo (`settings.weight`).
- Geste retour du téléphone (`syncHistory`, `navState`, `popstate`) : chaque écran (vue, onglet et recette de l'alimentation, séance ouverte) est une entrée de l'historique avec sa position de défilement. Toute nouvelle variable d'écran va dans `navState`. Une fiche (`openSheet`) a sa propre entrée : la fermer passe toujours par `closeSheet`. Les flèches entre recettes remplacent l'entrée (`replaceNav`), et quitter la séance guidée demande un second geste retour.
- Menus dépliables : tout `<details>` qui doit garder son état quand la page se redessine porte `data-keep="clé"`. Son état par défaut passe par `opened(clé, défaut)`, le choix fait au doigt est gardé dans `userOpen` et réappliqué après chaque rendu, et l'appli l'impose en écrivant `userOpen[clé]` (séance lancée, notée…).
- Ajouter un test dans `tests/program.test.js` pour toute règle de programme ou d'adaptation.

## Commandes

- `npm test` : tests unitaires (node --test).
- `npm run test:e2e` : parcours complet dans Chromium (Playwright), compte inclus avec un faux Firebase (`tests/fbmock`, `tests/fakecloud.js`) : jamais d'appel aux vrais serveurs.
- `npm start` : serveur local sur http://localhost:8080.

Publication : GitHub Actions déploie `main` sur https://hugokirbach.github.io/personnal-trainer/ après les tests.
