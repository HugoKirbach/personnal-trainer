// Génération du programme hebdomadaire et règles d'adaptation.

export const GRADES = ['5c', '6a', '6a+', '6b', '6b+', '6c', '6c+', '7a', '7a+', '7b'];
export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const TYPES = {
  escalade: { label: 'Escalade', color: 'var(--series-1)' },
  muscu: { label: 'Muscu', color: 'var(--series-2)' },
  cardio: { label: 'Course', color: 'var(--series-3)' },
};

// Cycle de 4 semaines. Le premier cycle est une reprise plus douce.
const PHASES = [
  { name: 'Reprise', note: 'On réhabitue le corps, on reste sous ses limites.' },
  { name: 'Construction', note: 'Volume un peu plus élevé, technique propre.' },
  { name: 'Intensification', note: 'Semaine la plus exigeante du cycle.' },
  { name: 'Décharge', note: 'On allège pour assimiler. Ne force pas.' },
];
const FIRST_CYCLE = [0.75, 0.85, 0.95, 0.7];
const NEXT_CYCLES = [0.9, 1.0, 1.1, 0.75];

// Répartition par nombre de séances : jour (0 = lundi), créneau, modèle.
export const SCHEDULES = {
  3: [
    { day: 0, slot: 'midi', key: 'full' },
    { day: 2, slot: 'soir', key: 'bloc' },
    { day: 5, slot: 'weekend', key: 'voie' },
  ],
  4: [
    { day: 0, slot: 'midi', key: 'haut' },
    { day: 2, slot: 'soir', key: 'bloc' },
    { day: 4, slot: 'midi', key: 'bas' },
    { day: 5, slot: 'weekend', key: 'voie' },
  ],
  5: [
    { day: 0, slot: 'midi', key: 'haut' },
    { day: 1, slot: 'midi', key: 'fractionne' },
    { day: 2, slot: 'soir', key: 'bloc' },
    { day: 4, slot: 'midi', key: 'bas' },
    { day: 5, slot: 'weekend', key: 'voie' },
  ],
};

export const TIPS = {
  escalade: [
    'Poulie : en reprise, privilégie la prise tendue plutôt qu\'arquée sur les petites réglettes.',
    'Pieds précis, bras tendus : grimper en économie est la clé du 7a en voie.',
    'Repos complets de 3 à 5 minutes entre les essais au max, sinon tu travailles l\'endurance, pas la force.',
    'Douleur vive dans un doigt ? Stop immédiat, pas de « dernier essai ».',
    'Lis la voie en entier avant de partir, repère les repos et les clippages.',
    'Filme un essai sur ton projet : on voit vite les mouvements qui coûtent trop.',
  ],
  muscu: [
    'Garde 2 répétitions en réserve sur chaque série pendant la reprise.',
    'Nuque fragile : regarde droit devant, menton rentré, ne tire pas la tête pendant le gainage.',
    'Contrôle la descente (2 à 3 secondes), c\'est là que se construit le muscle.',
    'Note la charge utilisée dans ton ressenti pour la séance suivante.',
    'Épaules basses et serrées sur les tirages, pour soulager le haut du dos.',
  ],
  cardio: [
    'Footing en endurance : tu dois pouvoir parler en courant.',
    'Sur le fractionné, la dernière répétition doit ressembler à la première.',
    'Augmente le volume de course de 10 % maximum par semaine.',
    'Hydrate-toi avant de partir, surtout le midi.',
  ],
  general: [
    'Bois régulièrement dans la journée, pas seulement pendant la séance.',
    'Le sommeil est ton meilleur outil de récupération : vise 7 à 8 heures.',
    'Un blocage de nuque ? Mobilité douce et chaleur, pas d\'étirement forcé.',
  ],
};

const MOBILITY = {
  name: 'Échauffement nuque, épaules, dos',
  detail: 'Rotations de nuque lentes, haussements d\'épaules, cercles de bras, chat-vache, rotations thoraciques. 30 s par mouvement.',
  timer: { mode: 'interval', work: 30, rest: 10, rounds: 8, label: 'Mobilité' },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const grade = (i) => GRADES[clamp(i, 0, GRADES.length - 1)];

export function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function defaultStart(today = new Date()) {
  const m = mondayOf(today);
  if (today.getDay() === 0) m.setDate(m.getDate() + 7);
  return ymd(m);
}

export function weekInfo(date, startYmd) {
  const diff = Math.round((mondayOf(date) - parseYmd(startYmd)) / 86400000);
  const week = Math.max(1, Math.floor(diff / 7) + 1);
  const cycle = Math.ceil(week / 4);
  const p = (week - 1) % 4;
  const mult = (cycle === 1 ? FIRST_CYCLE : NEXT_CYCLES)[p];
  return { week, cycle, phase: PHASES[p], phaseIndex: p, mult };
}

export function weekKey(date) {
  return ymd(mondayOf(date));
}

// Séances d'une semaine, en tenant compte des déplacements faits par l'utilisateur.
export function weekSessions(monday, state) {
  const sched = SCHEDULES[state.settings.sessionsPerWeek] || SCHEDULES[4];
  const moves = state.moves[ymd(monday)] || {};
  return sched.map((s, i) => {
    const day = moves[i] ?? s.day;
    const date = new Date(monday);
    date.setDate(date.getDate() + day);
    const slot = day >= 5 ? 'weekend' : s.slot;
    return { ...buildSession(s.key, date, state), index: i, day, slot, time: state.settings.times[slot], date: ymd(date) };
  });
}

export function sessionsOn(date, state) {
  return weekSessions(mondayOf(date), state).filter((s) => s.date === ymd(date));
}

export function buildSession(key, date, state) {
  const info = weekInfo(date, state.settings.startDate);
  const a = state.adapt;
  const t = TEMPLATES[key];
  const type = t.type;
  const f = info.mult * (a[type] ?? 1);
  const ctx = { f, info, g: a.gradeIdx, sets: (n) => clamp(Math.round(n * f), 1, n + 2) };
  return { key, type, title: t.title, duration: t.duration, phase: info.phase, week: info.week, exercises: t.build(ctx) };
}

const minutes = (base, f) => Math.round((base * f) / 5) * 5;

const TEMPLATES = {
  bloc: {
    type: 'escalade', title: 'Escalade bloc', duration: '1h30',
    build: ({ f, info, g, sets }) => [
      MOBILITY,
      { name: 'Montée en température', detail: `6 à 8 blocs faciles (niveau ~${grade(g - 3)}), grimpés lentement et proprement.` },
      { name: 'Blocs au niveau', detail: `${sets(5)} blocs autour de ${grade(g - 1)}, 2 à 3 essais chacun. Repos 3 min entre les essais.`, timer: { mode: 'countdown', seconds: 180, label: 'Repos bloc' } },
      info.phaseIndex === 3
        ? { name: 'Séance technique (décharge)', detail: 'Pas de projet cette semaine : refais des blocs faciles en cherchant le geste parfait, pieds silencieux.' }
        : { name: 'Projet', detail: `${minutes(25, f)} min sur 1 ou 2 blocs à ta limite (~${grade(g)}). Repos 4 min entre les essais.`, timer: { mode: 'countdown', seconds: 240, label: 'Repos projet' } },
      info.week >= 5 && info.phaseIndex !== 3
        ? { name: 'Poutre douce (salle d\'escalade)', detail: `${sets(5)} séries de 6 × (7 s suspendu / 3 s repos), réglette 20 mm, prise tendue, pieds au sol si besoin. Effort 6/10 max. Repos 2 min entre séries.`, timer: { mode: 'interval', work: 7, rest: 3, rounds: 6, sets: sets(5), setRest: 120, label: 'Poutre' } }
        : { name: 'Pas de poutre pour l\'instant', detail: 'On laisse tes poulies se réhabituer à la grimpe. La poutre arrive en semaine 5.' },
      { name: 'Retour au calme', detail: 'Étirements doux des avant-bras et des doigts, nuque, dos. 5 min.' },
    ],
  },
  voie: {
    type: 'escalade', title: 'Escalade voie', duration: '1h45',
    build: ({ f, info, g, sets }) => [
      MOBILITY,
      { name: 'Voies d\'échauffement', detail: `2 à 3 voies faciles en ${grade(g - 3)}.` },
      { name: 'Pyramide', detail: `2 voies en ${grade(g - 2)}, 2 voies en ${grade(g - 1)}, puis ${info.phaseIndex === 3 ? 'stop' : `1 à 2 essais en ${grade(g)}`}. Repos 5 min entre chaque.`, timer: { mode: 'countdown', seconds: 300, label: 'Repos voie' } },
      info.phaseIndex === 2
        ? { name: 'Endurance : 4 × 4', detail: `${sets(4)} séries de 4 voies faciles (${grade(g - 4)}) enchaînées sans repos. 4 min entre les séries.`, timer: { mode: 'countdown', seconds: 240, label: 'Repos 4×4' } }
        : { name: 'Continuité', detail: `${sets(3)} fois une voie facile (${grade(g - 3)}) montée, désescaladée ou relancée sans toucher le sol. Repos 5 min.`, timer: { mode: 'countdown', seconds: 300, label: 'Repos continuité' } },
      { name: 'Retour au calme', detail: 'Une voie très facile en souplesse, puis étirements avant-bras, nuque et dos.' },
    ],
  },
  haut: {
    type: 'muscu', title: 'Muscu haut du corps et gainage', duration: '1h15',
    build: ({ sets }) => [
      { name: 'Échauffement', detail: '5 min de rameur ou vélo, puis mobilité nuque et épaules.', timer: { mode: 'countdown', seconds: 300, label: 'Échauffement' } },
      { name: 'Développé couché haltères', detail: `${sets(3)} × 10. Repos 90 s.`, timer: { mode: 'countdown', seconds: 90, label: 'Repos' } },
      { name: 'Rowing assis poulie, prise neutre', detail: `${sets(3)} × 10, épaules basses. Repos 90 s.`, timer: { mode: 'countdown', seconds: 90, label: 'Repos' } },
      { name: 'Développé épaules haltères assis', detail: `${sets(3)} × 10. Repos 90 s.`, timer: { mode: 'countdown', seconds: 90, label: 'Repos' } },
      { name: 'Dips assistés ou pompes', detail: `${sets(3)} × 8 à 12. Repos 75 s.`, timer: { mode: 'countdown', seconds: 75, label: 'Repos' } },
      { name: 'Face pull à la poulie', detail: `${sets(3)} × 15, léger. Excellent pour la nuque et les épaules de grimpeur. Repos 60 s.`, timer: { mode: 'countdown', seconds: 60, label: 'Repos' } },
      { name: 'Rotations externes', detail: `${sets(2)} × 15 par bras, poulie basse ou élastique. Repos 45 s.`, timer: { mode: 'countdown', seconds: 45, label: 'Repos' } },
      { name: 'Extensions des doigts (élastique)', detail: `${sets(2)} × 20. Antagonistes des fléchisseurs, protège les poulies.` },
      { name: 'Gainage : planche', detail: `${sets(3)} × 40 s, menton rentré. 20 s de repos.`, timer: { mode: 'interval', work: 40, rest: 20, rounds: sets(3), label: 'Planche' } },
    ],
  },
  bas: {
    type: 'muscu', title: 'Muscu bas du corps et course', duration: '1h20',
    build: ({ f, sets }) => [
      { name: 'Échauffement', detail: '5 min de vélo, squats au poids du corps, mobilité hanches et dos.', timer: { mode: 'countdown', seconds: 300, label: 'Échauffement' } },
      { name: 'Presse à cuisses ou goblet squat', detail: `${sets(3)} × 10. Repos 2 min.`, timer: { mode: 'countdown', seconds: 120, label: 'Repos' } },
      { name: 'Soulevé de terre roumain haltères', detail: `${sets(3)} × 10, dos neutre, charge modérée. Repos 2 min.`, timer: { mode: 'countdown', seconds: 120, label: 'Repos' } },
      { name: 'Fentes marchées', detail: `${sets(3)} × 10 par jambe. Repos 90 s.`, timer: { mode: 'countdown', seconds: 90, label: 'Repos' } },
      { name: 'Hip thrust machine', detail: `${sets(3)} × 12. Repos 90 s.`, timer: { mode: 'countdown', seconds: 90, label: 'Repos' } },
      { name: 'Gainage latéral et dead bug', detail: `${sets(3)} tours : 30 s par côté + 10 dead bugs lents.`, timer: { mode: 'interval', work: 30, rest: 15, rounds: sets(3) * 2, label: 'Gainage' } },
      { name: 'Course sur tapis', detail: `${minutes(20, f)} min en endurance, en aisance respiratoire.`, timer: { mode: 'countdown', seconds: minutes(20, f) * 60, label: 'Course' } },
    ],
  },
  full: {
    type: 'muscu', title: 'Muscu corps complet et course', duration: '1h20',
    build: ({ f, sets }) => [
      { name: 'Échauffement', detail: '5 min de rameur, mobilité nuque, épaules et hanches.', timer: { mode: 'countdown', seconds: 300, label: 'Échauffement' } },
      { name: 'Goblet squat ou presse', detail: `${sets(3)} × 10. Repos 2 min.`, timer: { mode: 'countdown', seconds: 120, label: 'Repos' } },
      { name: 'Développé couché haltères', detail: `${sets(3)} × 10. Repos 90 s.`, timer: { mode: 'countdown', seconds: 90, label: 'Repos' } },
      { name: 'Soulevé de terre roumain haltères', detail: `${sets(3)} × 10, dos neutre. Repos 2 min.`, timer: { mode: 'countdown', seconds: 120, label: 'Repos' } },
      { name: 'Développé épaules haltères', detail: `${sets(3)} × 10. Repos 90 s.`, timer: { mode: 'countdown', seconds: 90, label: 'Repos' } },
      { name: 'Face pull et rotations externes', detail: `${sets(3)} × 15 de chaque, léger. Repos 60 s.`, timer: { mode: 'countdown', seconds: 60, label: 'Repos' } },
      { name: 'Gainage : planche', detail: `${sets(3)} × 40 s.`, timer: { mode: 'interval', work: 40, rest: 20, rounds: sets(3), label: 'Planche' } },
      { name: 'Course sur tapis', detail: `${minutes(15, f)} min en endurance.`, timer: { mode: 'countdown', seconds: minutes(15, f) * 60, label: 'Course' } },
    ],
  },
  fractionne: {
    type: 'cardio', title: 'Course fractionnée', duration: '50 min',
    build: ({ sets }) => [
      { name: 'Footing d\'échauffement', detail: '15 min très facile, puis 3 accélérations progressives.', timer: { mode: 'countdown', seconds: 900, label: 'Échauffement' } },
      { name: '30/30', detail: `${sets(2)} séries de ${sets(8)} × (30 s vite / 30 s trot). 3 min de trot entre les séries.`, timer: { mode: 'interval', work: 30, rest: 30, rounds: sets(8), sets: sets(2), setRest: 180, label: '30/30' } },
      { name: 'Retour au calme', detail: '10 min de footing lent, puis étirements mollets et ischios.', timer: { mode: 'countdown', seconds: 600, label: 'Retour au calme' } },
    ],
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES);

// Ajuste les indices après une séance. Renvoie les messages à afficher.
export function adapt(state, log) {
  const a = state.adapt;
  const msgs = [];
  const delta = { facile: 0.05, ok: 0, dur: -0.05 }[log.feeling] ?? 0;
  let d = delta;
  if (log.completed === false) d -= 0.07;
  if (log.pain) d -= 0.1;
  const before = a[log.type];
  a[log.type] = Math.round(clamp(before + d, 0.7, 1.3) * 100) / 100;
  if (a[log.type] > before) msgs.push(`${TYPES[log.type].label} : volume légèrement augmenté.`);
  if (a[log.type] < before) msgs.push(`${TYPES[log.type].label} : volume allégé pour les prochaines séances.`);

  if (log.type === 'escalade') {
    const recent = state.logs.filter((l) => l.type === 'escalade').slice(-2);
    if (log.pain) {
      a.gradeIdx = clamp(a.gradeIdx - 1, 1, GRADES.length - 2);
      msgs.push(`Douleur signalée : niveau cible abaissé à ${grade(a.gradeIdx)}. Si elle persiste, repos et avis médical.`);
    } else if (recent.length === 2 && recent.every((l) => l.feeling === 'facile')) {
      a.gradeIdx = clamp(a.gradeIdx + 1, 1, GRADES.length - 2);
      msgs.push(`Deux séances faciles d'affilée : niveau cible relevé à ${grade(a.gradeIdx)}.`);
    } else if (recent.length === 2 && recent.every((l) => l.feeling === 'dur')) {
      a.gradeIdx = clamp(a.gradeIdx - 1, 1, GRADES.length - 2);
      msgs.push(`Deux séances dures d'affilée : niveau cible abaissé à ${grade(a.gradeIdx)}.`);
    } else if (log.maxGrade && GRADES.indexOf(log.maxGrade) > a.gradeIdx && log.feeling !== 'dur') {
      a.gradeIdx = clamp(GRADES.indexOf(log.maxGrade), 1, GRADES.length - 2);
      msgs.push(`Tu as enchaîné du ${log.maxGrade} : niveau cible relevé.`);
    }
  }
  return msgs;
}

export function tipFor(type, seed = Date.now()) {
  const list = [...(TIPS[type] || []), ...TIPS.general];
  return list[Math.floor(seed / 86400000) % list.length];
}
