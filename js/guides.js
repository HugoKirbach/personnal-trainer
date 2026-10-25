// Fiches tuto des exercices : consignes d'exécution, erreurs fréquentes et
// recherche de vidéos de démonstration (YouTube s'ouvre dans l'appli sur Android).
export const GUIDES = {
  mobilite: {
    title: 'Mobilité nuque, épaules, dos', query: 'mobilité nuque épaules dos échauffement',
    steps: [
      'Nuque : inclinaisons lentes oreille vers épaule, puis rotations douces à gauche et à droite. Jamais de grands cercles rapides.',
      'Épaules : haussements, puis cercles de bras vers l\'avant et vers l\'arrière, amplitude croissante.',
      'Chat-vache à quatre pattes : arrondis le dos en expirant, creuse-le en inspirant.',
      'Rotations thoraciques : à quatre pattes, une main derrière la tête, ouvre le coude vers le plafond en le suivant du regard.',
    ],
    errors: ['Forcer l\'amplitude de la nuque : reste dans une zone sans douleur.', 'Aller trop vite : le but est de réveiller les articulations.'],
  },
  'grimpe-echauffement': {
    title: 'Échauffement en grimpe', query: 'échauffement escalade progressif doigts',
    steps: [
      'Choisis des passages 2 à 3 niveaux sous ton maximum.',
      'Grimpe lentement, pieds posés sans bruit, bras le plus tendus possible.',
      'Augmente progressivement la difficulté et termine sur des prises plus petites.',
    ],
    errors: ['Attaquer directement les petites réglettes : c\'est là que les poulies se blessent.'],
  },
  'bloc-niveau': {
    title: 'Blocs au niveau', query: 'escalade bloc lecture de bloc conseils technique',
    steps: [
      'Choisis des blocs juste sous ta limite, faisables en 1 à 3 essais.',
      'Observe le bloc avant de grimper et visualise chaque mouvement, mains et pieds.',
      'Repos complet entre les essais pour garder une bonne qualité de mouvement.',
    ],
    errors: ['Enchaîner les essais sans repos : tu travailles la fatigue au lieu de la technique.'],
  },
  projet: {
    title: 'Travailler un projet', query: 'escalade comment travailler un projet bloc',
    steps: [
      'Choisis 1 ou 2 blocs (ou une voie) à ta limite.',
      'Découpe-le en sections et travaille les mouvements durs séparément.',
      'Fais de vrais repos (3 à 4 min en bloc, 5 à 6 min en voie), puis tente-le en entier.',
    ],
    errors: ['Insister sur un mouvement qui fait mal aux doigts : change de méthode ou de bloc.'],
  },
  'technique-pieds': {
    title: 'Technique : pieds silencieux', query: 'exercice escalade pieds silencieux silent feet',
    steps: [
      'Grimpe des blocs faciles en posant chaque pied sans aucun bruit.',
      'Regarde ton pied jusqu\'à ce qu\'il soit posé sur la prise.',
      'Pose la pointe du chausson sur le bord de la prise, puis charge-la.',
    ],
    errors: ['Regarder la prise suivante avant que le pied soit posé.'],
  },
  poutre: {
    title: 'Suspensions à la poutre', query: 'poutre escalade suspension prise tendue débutant',
    steps: [
      'Réglette d\'environ 20 mm, prise tendue : doigts ouverts, pouce libre.',
      'Épaules engagées, bras légèrement fléchis, pieds au sol ou sur une chaise pour alléger.',
      '7 s suspendu, 3 s de repos, 6 fois, puis repos de la série.',
    ],
    errors: ['Prise arquée (doigts repliés à 90°) : trop de charge sur les poulies en reprise.', 'Chercher l\'échec : reste à 6/10 d\'effort.'],
    tip: 'Ta poulie a déjà été touchée : à la moindre douleur dans un doigt, arrête la séance.',
  },
  'etirements-grimpe': {
    title: 'Retour au calme du grimpeur', query: 'étirements avant-bras doigts escalade après séance',
    steps: [
      'Avant-bras : bras tendu, paume vers l\'avant, tire doucement les doigts vers toi 30 s, puis paume vers toi.',
      'Doigts : ouvre et ferme les mains, étire chaque doigt doucement.',
      'Nuque : inclinaison latérale douce, 20 s de chaque côté.',
      'Dos : posture de l\'enfant, 30 s.',
    ],
    errors: ['Étirer brutalement : reste doux, sans douleur.'],
  },
  'pyramide-voie': {
    title: 'Pyramide en voie', query: 'escalade voie pyramide entraînement',
    steps: [
      'Monte en difficulté voie après voie, et termine au niveau le plus dur.',
      'Grimpe chaque voie le plus fluide possible, en repérant repos et clippages avant de partir.',
      'Repos complet entre les voies.',
    ],
    errors: ['Sauter des étapes : la progression prépare les doigts.'],
  },
  '4x4': {
    title: 'Endurance 4 × 4', query: 'escalade 4x4 entraînement endurance',
    steps: [
      'Enchaîne 4 voies (ou 4 blocs) faciles sans repos entre elles : redescends et repars aussitôt.',
      'Garde un rythme régulier, respire, secoue les bras sur les bonnes prises.',
      'Repos de la série, puis recommence.',
    ],
    errors: ['Choisir des voies trop dures : tu dois finir la 4e, même fatigué.'],
  },
  continuite: {
    title: 'Continuité', query: 'escalade continuité endurance désescalade',
    steps: [
      'Monte une voie facile, désescalade-la (ou relance-la) sans toucher le sol.',
      'Cherche des positions économiques, bras tendus.',
      'Le but est de rester longtemps sur le mur à intensité modérée.',
    ],
    errors: ['Serrer trop fort les prises : relâche au minimum nécessaire.'],
  },
  'echauffement-general': {
    title: 'Échauffement général', query: 'échauffement musculation complet',
    steps: [
      '3 à 5 min de cardio léger : rameur, vélo ou jumping jacks.',
      'Mobilité : nuque, épaules, hanches.',
      'Une série légère du premier exercice avant les séries de travail.',
    ],
    errors: ['Commencer directement avec la charge de travail.'],
  },
  'developpe-couche-halteres': {
    title: 'Développé couché haltères', query: 'développé couché haltères technique',
    steps: [
      'Allongé sur le banc, pieds à plat au sol, omoplates serrées.',
      'Haltères au-dessus de la poitrine, bras tendus.',
      'Descends en 2 secondes, coudes à environ 45° du buste, jusqu\'à hauteur de la poitrine.',
      'Pousse en expirant sans verrouiller brutalement les coudes.',
    ],
    errors: ['Coudes écartés à 90° : agresse les épaules.', 'Décoller les fesses du banc.'],
  },
  'rowing-poulie': {
    title: 'Rowing assis à la poulie', query: 'rowing assis poulie basse technique',
    steps: [
      'Assis, pieds calés, dos droit, poignée en prise neutre.',
      'Tire la poignée vers le nombril en serrant les omoplates.',
      'Reviens lentement bras tendus, sans arrondir le dos.',
    ],
    errors: ['Basculer le buste en arrière pour tirer.', 'Hausser les épaules vers les oreilles.'],
  },
  'developpe-epaules': {
    title: 'Développé épaules haltère', query: 'développé militaire haltère un bras technique',
    steps: [
      'Assis dos calé, ou debout gainé, haltère(s) à hauteur de l\'oreille, paume vers l\'avant.',
      'Pousse au-dessus de la tête sans cambrer ni pencher le buste sur le côté.',
      'Redescends lentement à hauteur de l\'oreille. À un bras : fais toutes les répétitions d\'un côté, puis de l\'autre.',
    ],
    errors: ['Cambrer le bas du dos : serre abdos et fessiers.', 'Avancer la tête : garde le menton rentré.'],
  },
  pompes: {
    title: 'Pompes', query: 'pompes technique parfaite',
    steps: [
      'Mains un peu plus larges que les épaules, corps aligné de la tête aux talons.',
      'Descends en 2 secondes, coudes à environ 45° du corps, poitrine près du sol.',
      'Pousse en gardant le gainage.',
    ],
    errors: ['Laisser tomber les hanches ou lever les fesses.', 'Tête qui pique vers le sol : regarde un peu devant tes mains.'],
    tip: 'Version lestée : enfile le gilet de 8 kg quand 20 pompes deviennent faciles.',
  },
  'dips-machine': {
    title: 'Dips assistés (machine)', query: 'dips assistés machine technique',
    steps: [
      'Genoux sur la plateforme, choisis une assistance qui permet 8 à 12 répétitions.',
      'Buste légèrement penché, descends jusqu\'à ce que les coudes forment 90°.',
      'Remonte sans verrouiller les coudes.',
    ],
    errors: ['Descendre trop bas : stress sur l\'avant de l\'épaule.'],
  },
  'face-pull': {
    title: 'Face pull', query: 'face pull poulie corde technique',
    steps: [
      'Poulie haute, corde, prise par-dessus.',
      'Tire la corde vers ton visage en écartant les mains, coudes hauts.',
      'Termine mains à hauteur des oreilles, omoplates serrées, puis reviens lentement.',
    ],
    errors: ['Prendre trop lourd et tirer avec le dos.', 'Laisser tomber les coudes.'],
  },
  'rotations-externes': {
    title: 'Rotations externes', query: 'rotation externe épaule élastique coiffe des rotateurs',
    steps: [
      'Coude collé au corps et plié à 90°, poignée de poulie ou élastique à hauteur du coude.',
      'Tourne l\'avant-bras vers l\'extérieur sans décoller le coude.',
      'Reviens lentement.',
    ],
    errors: ['Charge trop lourde : ce sont de petits muscles, reste très léger.'],
    tip: 'Sans poulie ni élastique : couché sur le côté, haltère de 2 kg dans la main du dessus, coude collé au flanc.',
  },
  'extensions-doigts': {
    title: 'Extensions des doigts', query: 'extension doigts élastique grimpeur antagoniste',
    steps: [
      'Passe un élastique autour du bout des doigts et du pouce.',
      'Écarte les doigts au maximum contre l\'élastique, puis reviens lentement.',
    ],
    errors: ['Aller trop vite.'],
    tip: 'Sans élastique : ouvre les doigts dans un seau de riz.',
  },
  planche: {
    title: 'Planche (gainage)', query: 'planche gainage technique',
    steps: [
      'Avant-bras au sol, coudes sous les épaules.',
      'Corps aligné, fessiers et abdos serrés, bassin légèrement rentré.',
      'Respire normalement, regard vers le sol.',
    ],
    errors: ['Fesses trop hautes ou bas du dos qui se creuse.', 'Bloquer la respiration.'],
  },
  'goblet-squat': {
    title: 'Goblet squat', query: 'goblet squat technique haltère',
    steps: [
      'Haltère tenu verticalement contre la poitrine, pieds largeur d\'épaules, pointes légèrement ouvertes.',
      'Descends en poussant les fesses en arrière, genoux dans l\'axe des pieds.',
      'Descends au moins cuisses parallèles au sol, dos droit, talons au sol, puis remonte.',
    ],
    errors: ['Genoux qui rentrent vers l\'intérieur.', 'Talons qui décollent.'],
  },
  presse: {
    title: 'Presse à cuisses', query: 'presse à cuisses technique',
    steps: [
      'Dos et bassin plaqués contre le dossier, pieds largeur d\'épaules au milieu de la plateforme.',
      'Descends jusqu\'à 90° aux genoux sans décoller le bas du dos.',
      'Pousse sans verrouiller les genoux.',
    ],
    errors: ['Descendre si bas que le bassin décolle du dossier.'],
  },
  'souleve-roumain': {
    title: 'Soulevé de terre roumain', query: 'soulevé de terre roumain haltères technique',
    steps: [
      'Debout, haltères devant les cuisses, genoux légèrement fléchis.',
      'Pousse les hanches en arrière en gardant le dos plat : les haltères glissent le long des jambes.',
      'Descends jusqu\'à sentir l\'étirement des ischios (mi-tibia environ), puis remonte en serrant les fessiers.',
    ],
    errors: ['Arrondir le dos.', 'Plier les genoux comme un squat.'],
    tip: 'Dos sensible : charge modérée et amplitude réduite plutôt que forcer.',
  },
  'souleve-roumain-unilateral': {
    title: 'Soulevé de terre roumain sur une jambe', query: 'soulevé de terre roumain unilatéral haltère',
    steps: [
      'Debout sur une jambe, haltère dans la main opposée.',
      'Bascule le buste vers l\'avant en levant la jambe libre derrière toi, dos plat, hanches parallèles au sol.',
      'Remonte en contrôlant.',
    ],
    errors: ['Ouvrir la hanche vers le côté.'],
    tip: 'Pose une main sur un mur au début pour l\'équilibre.',
  },
  'fentes-marchees': {
    title: 'Fentes', query: 'fentes marchées technique',
    steps: [
      'Grand pas en avant, descends jusqu\'à ce que le genou arrière frôle le sol.',
      'Genou avant au-dessus de la cheville, buste droit.',
      'Pousse sur le talon avant et enchaîne avec l\'autre jambe.',
    ],
    errors: ['Pas trop court : le genou avant part loin devant les orteils.'],
  },
  'hip-thrust': {
    title: 'Hip thrust', query: 'hip thrust technique',
    steps: [
      'Haut du dos sur un banc (au sol pour la version maison), pieds à plat, charge sur les hanches.',
      'Pousse les hanches vers le haut jusqu\'à aligner épaules, hanches et genoux.',
      'Serre les fessiers 1 seconde en haut, puis redescends lentement.',
    ],
    errors: ['Cambrer le bas du dos en haut du mouvement : rentre le bassin.'],
  },
  'gainage-lateral': {
    title: 'Gainage latéral', query: 'gainage latéral technique',
    steps: [
      'Sur le côté, coude sous l\'épaule, jambes tendues.',
      'Monte le bassin pour aligner tête, bassin et pieds.',
      'Tiens sans laisser tomber les hanches, puis change de côté.',
    ],
    errors: ['Hanches qui partent en arrière.'],
  },
  'dead-bug': {
    title: 'Dead bug', query: 'dead bug exercice gainage technique',
    steps: [
      'Sur le dos, bras tendus vers le plafond, genoux à 90° au-dessus des hanches.',
      'Plaque le bas du dos au sol.',
      'Allonge lentement un bras et la jambe opposée sans décoller le dos, reviens, change de côté.',
    ],
    errors: ['Le bas du dos se décolle : réduis l\'amplitude.'],
  },
  'course-endurance': {
    title: 'Course en endurance', query: 'course à pied endurance fondamentale foulée technique',
    steps: [
      'Allure à laquelle tu peux tenir une conversation.',
      'Foulée courte et légère, pied qui se pose sous le corps.',
      'Épaules relâchées, bras pliés à 90°.',
    ],
    errors: ['Partir trop vite.'],
  },
  'fractionne-30-30': {
    title: 'Fractionné 30/30', query: 'fractionné 30 30 course à pied',
    steps: [
      '30 s vite, à environ 90 % de ton maximum, puis 30 s de trot lent.',
      'Garde la même allure sur toutes les fractions.',
    ],
    errors: ['Exploser sur les premières fractions et s\'effondrer ensuite.'],
  },
  'scap-pulls': {
    title: 'Tirages d\'omoplates (scap pulls)', query: 'scapular pull up technique',
    steps: [
      'Suspendu à la barre, bras tendus.',
      'Sans plier les coudes, abaisse les épaules et rapproche les omoplates : le corps monte de quelques centimètres.',
      'Relâche lentement.',
    ],
    errors: ['Plier les bras : seules les omoplates bougent.'],
  },
  suspensions: {
    title: 'Suspensions actives à la barre', query: 'active hang barre de traction',
    steps: [
      'Prise large et confortable, paume entière sur la barre, pas du bout des doigts.',
      'Épaules engagées : éloigne-les des oreilles, bras tendus.',
      'Tiens en respirant, pieds décollés.',
    ],
    errors: ['Rester avachi, épaules aux oreilles.'],
  },
  tractions: {
    title: 'Tractions', query: 'traction barre technique parfaite',
    steps: [
      'Prise en pronation un peu plus large que les épaules, bras tendus.',
      'Engage les épaules, puis tire jusqu\'à passer le menton au-dessus de la barre, coudes vers les hanches.',
      'Redescends contrôlé jusqu\'aux bras tendus.',
    ],
    errors: ['Donner de l\'élan avec les jambes.', 'Faire des demi-répétitions.', 'Tendre le cou vers la barre : garde la nuque neutre.'],
    tip: 'Version lestée : gilet de 8 kg, seulement quand 8 tractions propres sont faciles.',
  },
  'tractions-negatives': {
    title: 'Tractions négatives', query: 'traction négative technique',
    steps: [
      'Monte en haut de la traction avec un saut ou une chaise.',
      'Descends le plus lentement possible (5 s) jusqu\'aux bras tendus.',
    ],
    errors: ['Lâcher en fin de descente.'],
  },
  'releves-genoux': {
    title: 'Relevés de genoux suspendu', query: 'relevé de genoux suspendu barre technique',
    steps: [
      'Suspendu à la barre, épaules engagées.',
      'Monte les genoux vers la poitrine en enroulant le bassin.',
      'Redescends lentement sans balancer.',
    ],
    errors: ['Utiliser l\'élan.'],
  },
  oiseau: {
    title: 'Oiseau (un bras)', query: 'oiseau un bras haltère deltoïde postérieur',
    steps: [
      'Buste penché à environ 45°, dos plat, main libre sur une chaise, haltère léger sous l\'épaule.',
      'Écarte le bras sur le côté, coude légèrement fléchi, jusqu\'à hauteur de l\'épaule.',
      'Serre les omoplates en haut, puis redescends lentement.',
    ],
    errors: ['Prendre trop lourd et donner de l\'élan.', 'Lever la tête : nuque dans l\'alignement du dos.'],
  },
  hollow: {
    title: 'Gainage creux (hollow)', query: 'hollow body hold technique',
    steps: [
      'Sur le dos, bas du dos plaqué au sol.',
      'Décolle les épaules et les jambes tendues, bras le long des oreilles.',
      'Tiens la position en forme de banane.',
    ],
    errors: ['Bas du dos qui décolle : plie les genoux ou ramène les bras.'],
    tip: 'Nuque sensible : menton légèrement rentré, sans tirer sur la tête.',
  },
  superman: {
    title: 'Superman', query: 'superman exercice lombaires technique',
    steps: [
      'Allongé sur le ventre, bras tendus devant toi.',
      'Décolle ensemble bras, poitrine et jambes, tiens 2 secondes, puis redescends.',
    ],
    errors: ['Lever la tête : garde le regard vers le sol.'],
  },
  'extensions-poignets': {
    title: 'Extensions de poignets', query: 'extension poignet haltère avant-bras',
    steps: [
      'Avant-bras posé sur la cuisse, paume vers le bas, haltère léger.',
      'Relève le dos de la main en pliant le poignet, puis redescends lentement.',
    ],
    errors: ['Bouger l\'avant-bras.'],
  },
  'rowing-haltere': {
    title: 'Rowing haltère un bras', query: 'rowing haltère un bras technique',
    steps: [
      'Une main et un genou sur une chaise ou un banc, dos plat.',
      'Tire l\'haltère vers la hanche, coude près du corps.',
      'Pause d\'une seconde en haut, puis redescends bras tendu.',
    ],
    errors: ['Tourner le buste pour tirer.', 'Tirer vers l\'épaule au lieu de la hanche.'],
  },
  'pompes-piquees': {
    title: 'Pompes piquées (pike push-ups)', query: 'pike push up technique',
    steps: [
      'Position en V inversé : mains au sol, hanches hautes, jambes tendues.',
      'Plie les coudes pour amener le sommet du crâne vers le sol, devant les mains.',
      'Pousse pour revenir.',
    ],
    errors: ['Coudes trop écartés.'],
  },
  'elevations-laterales': {
    title: 'Élévations latérales', query: 'élévation latérale un bras haltère technique',
    steps: [
      'Debout, haltère le long du corps, coude légèrement fléchi. Main libre posée sur un mur ou une chaise.',
      'Monte le bras sur le côté jusqu\'à hauteur de l\'épaule.',
      'Redescends lentement.',
    ],
    errors: ['Hausser les épaules.', 'Balancer le buste.'],
  },
  'pompes-diamant': {
    title: 'Pompes diamant', query: 'pompes diamant technique',
    steps: [
      'Mains rapprochées sous la poitrine, pouces et index formant un losange.',
      'Coudes le long du corps, descends la poitrine vers les mains.',
      'Pousse en gardant le corps gainé.',
    ],
    errors: ['Coudes qui s\'écartent.'],
    tip: 'Trop dur ? Écarte un peu les mains, ou pose les genoux au sol.',
  },
  curl: {
    title: 'Curl haltère', query: 'curl biceps haltère un bras technique',
    steps: [
      'Debout, coude collé au corps, paume vers l\'avant.',
      'Plie le coude pour monter l\'haltère, sans avancer le coude.',
      'Redescends en 2 à 3 secondes.',
    ],
    errors: ['Balancer le buste.'],
  },
  'fentes-bulgares': {
    title: 'Fentes bulgares', query: 'fentes bulgares technique',
    steps: [
      'Dos à une chaise, pose le dessus d\'un pied dessus, l\'autre pied un grand pas devant.',
      'Descends verticalement jusqu\'à ce que la cuisse avant soit parallèle au sol.',
      'Pousse sur le talon avant pour remonter.',
    ],
    errors: ['Pied avant trop proche de la chaise.', 'Genou avant qui rentre vers l\'intérieur.'],
  },
  mollets: {
    title: 'Mollets sur une marche', query: 'extension mollets sur une marche technique',
    steps: [
      'Avant du pied sur le bord d\'une marche, talons dans le vide, une main au mur.',
      'Monte sur la pointe le plus haut possible, puis descends le talon sous le niveau de la marche.',
    ],
    errors: ['Rebondir en bas du mouvement.'],
  },
  etirements: {
    title: 'Étirements de fin de séance', query: 'étirements fin de séance musculation',
    steps: [
      'Hanches : fente basse, 30 s par côté.',
      'Pectoraux : avant-bras contre un mur, tourne le buste à l\'opposé.',
      'Nuque : inclinaison douce, 20 s par côté.',
    ],
    errors: ['Rebondir ou forcer.'],
  },
};

Object.assign(GUIDES, {
  pince: {
    title: 'Pince de préhension', query: 'hand gripper technique fermeture complète',
    steps: [
      'Pince dans la paume, poignées calées à la base des doigts, poignet droit.',
      'Ferme complètement jusqu\'à ce que les poignées se touchent, tiens 1 seconde.',
      'Rouvre lentement en gardant le contrôle.',
    ],
    errors: ['Fermer à moitié : seule la fermeture complète compte.', 'Plier le poignet.'],
    tip: 'Ta poulie a déjà été touchée : douleur dans un doigt = stop. Commence léger et monte progressivement.',
  },
  'test-cooper': {
    title: 'Test de Cooper (12 min)', query: 'test de cooper 12 minutes conseils',
    steps: [
      'Échauffe-toi 10 min en footing facile.',
      'Cours la plus grande distance possible en 12 min sur un terrain plat (piste ou parcours mesuré par ta montre ou ton téléphone).',
      'Pars à une allure régulière et accélère sur les 2 dernières minutes.',
    ],
    errors: ['Partir trop vite et marcher ensuite.'],
    tip: 'L\'appli en déduit ta VMA et tes allures de footing et de fractionné.',
  },

  // ---------- Cardio sans course ----------
  'jumping-jacks': {
    title: 'Jumping jacks', query: 'jumping jacks technique',
    steps: [
      'Debout, pieds joints, bras le long du corps.',
      'Saute en écartant les pieds et en montant les bras au-dessus de la tête.',
      'Reviens pieds joints, bras le long du corps, et enchaîne.',
    ],
    errors: ['Atterrir talons d\'abord, genoux tendus : reste sur l\'avant du pied, genoux souples.'],
    tip: 'Version sans saut : écarte un pied après l\'autre.',
  },
  'shadow-boxing': {
    title: 'Shadow boxing', query: 'shadow boxing débutant cardio',
    steps: [
      'En garde : pieds écartés, un pied devant, poings près du menton.',
      'Enchaîne directs, crochets et uppercuts dans le vide, en restant léger sur les appuis.',
      'Expire à chaque coup et ramène vite le poing en garde.',
    ],
    errors: ['Verrouiller le coude en fin de coup.', 'Hausser les épaules : garde la nuque relâchée.'],
  },
  burpees: {
    title: 'Burpees sans saut', query: 'burpee sans saut débutant',
    steps: [
      'Debout, accroupis-toi et pose les mains au sol devant les pieds.',
      'Recule les pieds un par un jusqu\'en position de planche.',
      'Ramène les pieds un par un vers les mains, puis relève-toi.',
    ],
    errors: ['Creuser le dos en planche.', 'Aller trop vite au détriment du gainage.'],
    tip: 'Plus intense : saute les pieds en arrière puis en avant, et termine par un saut.',
  },
  'cardio-machine': {
    title: 'Vélo, rameur ou elliptique', query: 'rameur technique débutant vélo elliptique cardio',
    steps: [
      'Vélo : selle à hauteur de hanche, jambe presque tendue en bas du coup de pédale.',
      'Rameur : jambes, puis buste, puis bras à la poussée, et l\'inverse au retour. Dos droit.',
      'Elliptique : buste droit, pousse aussi avec les bras.',
      'Endurance : tu dois pouvoir parler. Fractionné : fort sur l\'effort, sans t\'arrêter pendant la récupération.',
    ],
    errors: ['Rameur : tirer avec les bras en premier ou arrondir le dos.', 'Vélo : selle trop basse, genoux qui souffrent.'],
  },

  // ---------- Parcours abdos ----------
  'crunch-inverse': {
    title: 'Crunch inversé', query: 'crunch inversé reverse crunch technique',
    steps: [
      'Allongé sur le dos, bras le long du corps, genoux pliés à 90° au-dessus des hanches.',
      'Expire et enroule le bassin vers la poitrine : les fesses décollent du sol.',
      'Redescends lentement vertèbre par vertèbre, sans reposer les pieds.',
    ],
    errors: ['Balancer les jambes pour prendre de l\'élan.', 'Creuser le bas du dos en redescendant.'],
    tip: 'La tête reste au sol : aucun effort pour la nuque, idéal avec tes blocages.',
  },
  'russian-twist': {
    title: 'Russian twist avec haltère', query: 'russian twist haltère technique dos droit',
    steps: [
      'Assis, genoux pliés, talons au sol, buste incliné en arrière à 45°, dos droit.',
      'Tiens l\'haltère à deux mains contre la poitrine.',
      'Tourne les épaules d\'un côté puis de l\'autre, le regard suit les mains. Une rotation de chaque côté = 2.',
      'Pieds décollés seulement quand c\'est facile.',
    ],
    errors: ['Arrondir le dos.', 'Bouger seulement les bras : ce sont les épaules qui tournent.'],
  },
  'mountain-climbers': {
    title: 'Mountain climbers', query: 'mountain climbers technique gainage',
    steps: [
      'Position de pompe, mains sous les épaules, corps gainé.',
      'Ramène un genou vers la poitrine puis l\'autre, en alternance rapide.',
      'Les hanches restent à la hauteur des épaules.',
    ],
    errors: ['Lever les fesses.', 'Laisser les épaules partir en arrière des mains.'],
  },
  'crunch-poulie': {
    title: 'Crunch à la poulie haute', query: 'crunch poulie haute à genoux technique',
    steps: [
      'À genoux face à la poulie haute, corde tenue de chaque côté de la tête.',
      'Enroule le buste vers le sol en rapprochant les côtes du bassin, les hanches restent fixes.',
      'Remonte lentement en gardant la tension.',
    ],
    errors: ['Tirer avec les bras ou la nuque.', 'S\'asseoir sur les talons pour descendre.'],
    tip: 'Regard vers le sol, nuque relâchée.',
  },
  'chaise-romaine': {
    title: 'Relevés de jambes à la chaise romaine', query: 'relevé de jambes chaise romaine captain chair technique',
    steps: [
      'Avant-bras sur les appuis, dos plaqué contre le dossier, épaules basses.',
      'Monte les genoux vers la poitrine en enroulant le bassin.',
      'Redescends lentement sans balancer. Jambes tendues quand c\'est facile.',
    ],
    errors: ['Se balancer.', 'Monter seulement les cuisses sans enrouler le bassin.'],
  },
  'bucheron-poulie': {
    title: 'Bûcheron à la poulie', query: 'woodchopper poulie bûcheron abdos obliques',
    steps: [
      'De profil à la poulie réglée en haut, poignée à deux mains, bras presque tendus.',
      'Tire en diagonale vers la hanche opposée en tournant les épaules, pivote sur le pied arrière.',
      'Reviens lentement, puis change de côté.',
    ],
    errors: ['Tirer avec les bras au lieu de tourner le buste.', 'Arrondir le dos.'],
  },
  pallof: {
    title: 'Pallof press', query: 'pallof press technique anti rotation',
    steps: [
      'De profil à la poulie réglée à hauteur de poitrine, poignée contre le sternum.',
      'Pousse les bras devant toi sans laisser le buste tourner vers la poulie, tiens 2 secondes.',
      'Ramène la poignée et recommence, puis change de côté.',
    ],
    errors: ['Laisser les hanches ou les épaules pivoter.', 'Prendre trop lourd.'],
    tip: 'Exercice anti-rotation : excellent pour le dos et le gainage en grimpe.',
  },
  'roue-abdos': {
    title: 'Roue abdominale', query: 'roue abdominale ab wheel débutant genoux technique',
    steps: [
      'À genoux, mains sur la roue sous les épaules, dos légèrement arrondi.',
      'Roule vers l\'avant en gardant le bassin rentré, aussi loin que tu peux sans creuser le dos.',
      'Reviens en tirant avec les abdos.',
    ],
    errors: ['Creuser le bas du dos.', 'Aller trop loin dès le début : augmente l\'amplitude peu à peu.'],
  },
  'extensions-lombaires': {
    title: 'Extensions lombaires au banc', query: 'extension lombaire banc à 45 degrés technique',
    steps: [
      'Sur le banc à 45°, hanches calées sur le coussin, bras croisés sur la poitrine.',
      'Descends le buste en gardant le dos droit, puis remonte jusqu\'à l\'alignement jambes-buste.',
      'Contracte les fessiers en haut.',
    ],
    errors: ['Remonter au-delà de l\'alignement en cambrant.', 'Aller vite.'],
  },
  'menton-rentre': {
    title: 'Rentrées de menton', query: 'chin tuck exercice nuque posture',
    steps: [
      'Debout ou assis, dos et arrière de la tête contre un mur.',
      'Recule le menton comme pour faire un double menton, sans baisser la tête.',
      'Tiens 3 secondes, puis relâche doucement.',
    ],
    errors: ['Baisser le menton vers la poitrine au lieu de reculer la tête.', 'Forcer : le mouvement est petit.'],
    tip: 'À refaire au bureau : c\'est l\'antidote à la tête projetée en avant.',
  },
  'open-book': {
    title: 'Livre ouvert (rotation du haut du dos)', query: 'open book stretch rotation thoracique',
    steps: [
      'Allongé sur le côté, genoux pliés à 90°, bras tendus devant toi, paumes jointes.',
      'Ouvre le bras du dessus vers l\'arrière en suivant ta main du regard, genoux collés au sol.',
      'Expire en ouvrant, puis reviens lentement.',
    ],
    errors: ['Décoller les genoux : la rotation doit venir du haut du dos.', 'Forcer pour poser l\'épaule au sol.'],
  },
  'wall-angels': {
    title: 'Anges au mur', query: 'wall angels exercice posture épaules',
    steps: [
      'Dos au mur, pieds à 15 cm, bas du dos, haut du dos et arrière de la tête contre le mur.',
      'Bras en chandelier, coudes et dos des mains contre le mur.',
      'Monte les bras en glissant le long du mur, puis redescends lentement.',
    ],
    errors: ['Cambrer le bas du dos pour garder les bras au mur.', 'Monter trop haut : arrête-toi avant que les mains décollent.'],
  },
  'etirement-pectoraux': {
    title: 'Étirement des pectoraux au cadre de porte', query: 'étirement pectoraux cadre de porte',
    steps: [
      'Avant-bras contre le cadre d\'une porte, coude à hauteur d\'épaule.',
      'Avance doucement le buste jusqu\'à sentir l\'étirement devant l\'épaule, 20 à 30 s par côté.',
      'Termine à genoux, fesses sur les talons, bras allongés devant toi (posture de l\'enfant), en respirant lentement.',
    ],
    errors: ['Tirer sur l\'épaule jusqu\'à la douleur.', 'Cambrer le dos.'],
  },
  // Alternatives proposées par le bouton « Remplacer ».
  'pompes-declinees': {
    title: 'Pompes pieds surélevés', query: 'pompes pieds surélevés technique',
    steps: [
      'Pieds sur une chaise ou un banc, mains au sol un peu plus larges que les épaules.',
      'Corps gainé en planche, descends la poitrine vers le sol en 2 secondes.',
      'Pousse fort pour remonter, sans casser la ligne du corps.',
    ],
    errors: ['Hanches qui tombent.', 'Coudes à 90° du corps : garde-les à 45°.'],
  },
  'floor-press': {
    title: 'Développé au sol un bras', query: 'floor press haltère un bras technique',
    steps: [
      'Allongé sur le dos, genoux pliés, haltère dans une main au-dessus de la poitrine.',
      'Descends jusqu\'à ce que le coude touche légèrement le sol, coude à 45° du corps.',
      'Pousse l\'haltère vers le plafond sans tourner le buste.',
    ],
    errors: ['Laisser tomber le coude au sol.', 'Pivoter le bassin pour aider.'],
    tip: 'Le sol limite l\'amplitude : c\'est doux pour les épaules.',
  },
  'rowing-inverse': {
    title: 'Rowing inversé', query: 'rowing inversé sous une table australian pull up',
    steps: [
      'Allongé sous une table bien stable (ou une barre basse), mains sur le bord, bras tendus.',
      'Corps gainé, talons au sol, tire la poitrine vers le bord en serrant les omoplates.',
      'Redescends lentement jusqu\'aux bras tendus.',
    ],
    errors: ['Utiliser une table qui peut basculer.', 'Laisser les hanches tomber.'],
    tip: 'Plus tes pieds sont loin, plus c\'est dur.',
  },
  'chin-up': {
    title: 'Tractions supination', query: 'traction supination chin up technique',
    steps: [
      'Prise paumes vers toi, mains écartées de la largeur des épaules.',
      'Épaules engagées, tire jusqu\'à passer le menton au-dessus de la barre.',
      'Redescends bras tendus, sans élan.',
    ],
    errors: ['Demi-amplitude.', 'Balancer les jambes.'],
    tip: 'Plus de biceps, un peu moins de dos : une bonne variante pour soulager les coudes en prise pronation.',
  },
  'tirage-vertical': {
    title: 'Tirage vertical à la poulie', query: 'tirage vertical poulie haute technique',
    steps: [
      'Assis, cuisses calées, prise un peu plus large que les épaules.',
      'Poitrine sortie, tire la barre vers le haut de la poitrine, coudes vers les hanches.',
      'Remonte lentement jusqu\'aux bras tendus.',
    ],
    errors: ['Tirer derrière la nuque.', 'Se pencher en arrière pour tricher.'],
  },
  ytw: {
    title: 'Y-T-W au sol', query: 'exercice YTW épaules au sol',
    steps: [
      'Allongé sur le ventre, front sur une serviette, bras tendus devant toi, pouces vers le plafond.',
      'Y : bras en diagonale, décolle-les du sol. T : bras sur les côtés. W : coudes pliés, serre les omoplates.',
      'Tiens 2 secondes en haut de chaque répétition.',
    ],
    errors: ['Lever la tête : regard vers le sol.', 'Hausser les épaules vers les oreilles.'],
  },
  'extension-triceps': {
    title: 'Extension triceps', query: 'extension triceps haltère un bras au dessus de la tête',
    steps: [
      'Haltère dans une main, bras tendu au-dessus de la tête (ou poignée de poulie en salle).',
      'Plie le coude pour descendre l\'haltère derrière la tête, coude pointé vers le plafond.',
      'Tends le bras sans bouger le coude.',
    ],
    errors: ['Écarter le coude.', 'Cambrer le dos : gaine-toi.'],
  },
  'pistol-assiste': {
    title: 'Squat sur une jambe assisté', query: 'pistol squat assisté progression',
    steps: [
      'Debout sur une jambe, une main sur un appui stable (porte, chaise contre un mur).',
      'Descends lentement en poussant les hanches en arrière, l\'autre jambe devant.',
      'Remonte en t\'aidant le moins possible de la main.',
    ],
    errors: ['Genou qui rentre vers l\'intérieur.', 'Descendre plus bas que ce que tu contrôles.'],
    tip: 'Commence en t\'asseyant sur une chaise, puis baisse la hauteur.',
  },
  'step-up': {
    title: 'Step-up lesté', query: 'step up chaise exercice jambes',
    steps: [
      'Face à une chaise stable ou une marche haute, gilet sur le dos.',
      'Pose un pied dessus et monte en poussant avec cette jambe, sans t\'aider du pied au sol.',
      'Redescends lentement, puis enchaîne les répétitions de la même jambe.',
    ],
    errors: ['Pousser avec la jambe du bas.', 'Utiliser une chaise qui glisse.'],
  },
  'good-morning': {
    title: 'Good morning avec le gilet', query: 'good morning poids du corps technique',
    steps: [
      'Debout, gilet sur le dos, mains croisées sur la poitrine, genoux légèrement fléchis.',
      'Pousse les hanches en arrière en penchant le buste, dos droit, jusqu\'à sentir l\'arrière des cuisses.',
      'Remonte en serrant les fessiers.',
    ],
    errors: ['Arrondir le dos.', 'Descendre trop bas au début.'],
  },
  'bird-dog': {
    title: 'Bird dog', query: 'bird dog exercice gainage lombaires',
    steps: [
      'À quatre pattes, mains sous les épaules, genoux sous les hanches.',
      'Tends un bras devant et la jambe opposée derrière, dos plat, tiens 2 secondes.',
      'Reviens lentement et change de côté.',
    ],
    errors: ['Cambrer le bas du dos.', 'Pivoter le bassin.'],
  },
});

export function videoUrl(guide) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(guide.query)}`;
}
