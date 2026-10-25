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

// Un exercice décrit ses séries pour estimer sa durée et piloter la séance guidée :
//   sets       nombre de séries (ou de tours)
//   reps       répétitions affichées ("10", "8 à 12", "10 par jambe") pour un exercice compté
//   work       durée d'une série en secondes (exacte si timed, estimée sinon)
//   timed      true si la série est chronométrée (gainage, suspensions, course)
//   rest       repos entre les séries, en secondes
//   inner      intervalles à l'intérieur d'une série : { work, rest, rounds }, innerLabels pour nommer chaque intervalle
//   circuit    exercices enchaînés dans un tour : [{ name, label, work, timed?, info? }]
//   setLabels  libellé de chaque série (pyramides)
//   restAfter  repos avant l'exercice suivant, en secondes
//   info       fiche(s) tuto de guides.js
//   note       consignes affichées après la prescription
const MOBILITY = {
  name: 'Échauffement nuque, épaules, dos', info: 'mobilite', label: 'Mobilité',
  inner: { work: 30, rest: 10, rounds: 8 }, restAfter: 30,
  innerLabels: ['Inclinaisons de nuque', 'Rotations douces de nuque', 'Haussements d\'épaules', 'Cercles de bras vers l\'avant', 'Cercles de bras vers l\'arrière', 'Chat-vache', 'Rotation thoracique gauche', 'Rotation thoracique droite'],
  note: 'Rotations de nuque lentes, haussements d\'épaules, cercles de bras, chat-vache, rotations thoraciques.',
};

const WARMUP_GYM = (seconds, note) => ({ name: 'Échauffement', info: 'echauffement-general', work: seconds, timed: true, restAfter: 30, note });
const PLANK = (sets) => ({ name: 'Gainage : planche', info: 'planche', sets, work: 40, timed: true, rest: 20, note: 'Menton rentré.' });
const SIDE_PLANK_CIRCUIT = (sets) => ({
  name: 'Gainage latéral et dead bug', info: ['gainage-lateral', 'dead-bug'], sets, rest: 30,
  circuit: [
    { name: 'Gainage latéral gauche', label: '30 s de gainage latéral de chaque côté', work: 30, timed: true, info: 'gainage-lateral' },
    { name: 'Gainage latéral droit', work: 30, timed: true, info: 'gainage-lateral' },
    { name: 'Dead bug', label: '10 dead bugs lents', work: 45, info: 'dead-bug' },
  ],
});

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
    const express = !!state.express?.[`${ymd(date)}#${i}`];
    return { ...buildSession(s.key, date, state, express), index: i, day, slot, time: state.settings.times[slot], date: ymd(date) };
  });
}

export function sessionsOn(date, state) {
  return weekSessions(mondayOf(date), state).filter((s) => s.date === ymd(date));
}

// Choisit la variante réelle d'une séance selon les accès en salle et le mode express.
export function resolveKey(key, state, express = false) {
  const type = TEMPLATES[key].type;
  if (express) return { escalade: 'expressGrimpe', muscu: 'expressRenfo', cardio: 'expressCourse' }[type];
  if (TEMPLATES[key].home) return key;
  const access = state.settings.access || {};
  if (type === 'escalade' && !access.escalade) return key === 'bloc' ? 'blocMaison' : 'voieMaison';
  if (type === 'muscu' && !access.muscu) return `${key}Maison`;
  return key;
}

// ---------- Durées ----------
export function fmtDuration(sec) {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`;
}

// Durée d'une séance arrondie à 5 min : "50 min" ou "1h05".
export function durationLabel(sec) {
  const m = Math.max(5, Math.round(sec / 300) * 5);
  if (m < 60) return `${m} min`;
  const mm = m % 60;
  return `${Math.floor(m / 60)}h${mm ? String(mm).padStart(2, '0') : ''}`;
}

const innerSeconds = (i) => i.rounds * i.work + (i.rounds - 1) * i.rest;
const setSeconds = (e) => (e.circuit ? e.circuit.reduce((t, c) => t + c.work, 0) : e.inner ? innerSeconds(e.inner) : e.work);
export const exerciseSeconds = (e) => e.sets * setSeconds(e) + (e.sets - 1) * (e.rest || 0);
export const sessionSeconds = (exs) => exs.reduce((t, e) => t + exerciseSeconds(e) + (e.restAfter || 0), 0);

function describe(e) {
  const unit = e.unit || (e.circuit ? 'tours' : 'séries');
  let main;
  if (e.circuit) main = `${e.sets} tour${e.sets > 1 ? 's' : ''} : ${e.circuit.filter((c) => c.label).map((c) => c.label).join(', ')}`;
  else if (e.setLabels) main = `${e.sets} ${unit} : ${e.setLabels.join(', ')}`;
  else if (e.inner) main = `${e.sets > 1 ? `${e.sets} séries de ` : ''}${e.inner.rounds} × (${fmtDuration(e.inner.work)} d'effort${e.inner.rest ? ` / ${fmtDuration(e.inner.rest)} de repos` : ''})`;
  else if (e.reps) main = `${e.sets} × ${e.reps}`;
  else if (e.sets > 1) main = `${e.sets} × ${fmtDuration(e.work)}`;
  else main = fmtDuration(e.work);
  const rest = e.sets > 1 && e.rest ? `, repos ${fmtDuration(e.rest)} entre les ${unit}` : '';
  return `${main}${rest}.${e.note ? ` ${e.note}` : ''}`;
}

// Réglage du chrono lancé depuis le bouton ⏱ d'un exercice.
function timerFor(e) {
  const label = e.label || e.name;
  if (e.inner) return { mode: 'interval', ...e.inner, sets: e.sets, setRest: e.rest || 0, label };
  if (e.circuit) return e.rest ? { mode: 'countdown', seconds: e.rest, label: `Repos · ${label}` } : null;
  if (e.timed && e.sets > 1) return { mode: 'interval', work: e.work, rest: e.rest || 0, rounds: e.sets, label };
  if (e.timed) return { mode: 'countdown', seconds: e.work, label };
  if (e.rest) return { mode: 'countdown', seconds: e.rest, label: `Repos · ${label}` };
  return null;
}

export function buildSession(key, date, state, express = false) {
  const info = weekInfo(date, state.settings.startDate);
  const a = state.adapt;
  const variant = resolveKey(key, state, express);
  const t = TEMPLATES[variant];
  const type = t.type;
  const f = info.mult * (a[type] ?? 1);
  const ctx = { f, info, g: a.gradeIdx, sets: (n) => clamp(Math.round(n * f), 1, n + 2) };
  const raw = t.build(ctx).filter(Boolean);
  const notes = raw.filter((e) => e.kind === 'note').map((e) => e.text);
  const items = raw.filter((e) => e.kind !== 'note');
  const exercises = items.map((e, i) => {
    const x = { sets: 1, ...e };
    x.restAfter = i === items.length - 1 ? 0 : (e.restAfter ?? t.restAfter ?? 90);
    x.detail = describe(x);
    x.timer = timerFor(x);
    x.seconds = exerciseSeconds(x);
    return x;
  });
  const totalSeconds = sessionSeconds(exercises);
  return {
    key, variant, type, express, home: !!t.home, run: !!t.run, notes,
    title: t.title, duration: durationLabel(totalSeconds), totalSeconds, phase: info.phase, week: info.week, exercises,
  };
}

const minutes = (base, f) => Math.round((base * f) / 5) * 5;

const TEMPLATES = {
  bloc: {
    type: 'escalade', title: 'Escalade bloc', restAfter: 120,
    build: ({ info, g, sets }) => [
      MOBILITY,
      { name: 'Montée en température', info: 'grimpe-echauffement', work: 600, timed: true, note: `6 à 8 blocs faciles (niveau ~${grade(g - 3)}), grimpés lentement et proprement.` },
      { name: 'Blocs au niveau', info: 'bloc-niveau', sets: sets(5), reps: '2 à 3 essais', work: 150, rest: 180, unit: 'blocs', note: `Un bloc différent à chaque fois, autour de ${grade(g - 1)}.` },
      info.phaseIndex === 3
        ? { name: 'Séance technique (décharge)', info: 'technique-pieds', work: 900, timed: true, note: 'Pas de projet cette semaine : blocs faciles en cherchant le geste parfait, pieds silencieux.' }
        : { name: 'Projet', info: 'projet', sets: sets(6), reps: '1 essai', work: 60, rest: 240, unit: 'essais', note: `1 ou 2 blocs à ta limite (~${grade(g)}).` },
      info.week >= 5 && info.phaseIndex !== 3
        ? { name: 'Poutre douce (salle d\'escalade)', info: 'poutre', label: 'Poutre', sets: sets(5), inner: { work: 7, rest: 3, rounds: 6 }, rest: 120, note: 'Réglette 20 mm, prise tendue, pieds au sol si besoin. Effort 6/10 max.' }
        : { kind: 'note', text: 'Pas de poutre avant la semaine 5 : on laisse tes poulies se réhabituer à la grimpe.' },
      { name: 'Retour au calme', info: 'etirements-grimpe', work: 300, timed: true, note: 'Étirements doux des avant-bras et des doigts, nuque, dos.' },
    ],
  },
  voie: {
    type: 'escalade', title: 'Escalade voie', restAfter: 120,
    build: ({ info, g, sets }) => {
      const pyramid = [g - 2, g - 2, g - 1, g - 1, ...(info.phaseIndex === 3 ? [] : [g])].map((x) => grade(x));
      return [
        MOBILITY,
        { name: 'Voies d\'échauffement', info: 'grimpe-echauffement', sets: 3, reps: 'voie facile', work: 240, rest: 90, unit: 'voies', note: `Niveau ~${grade(g - 3)}.` },
        { name: 'Pyramide', info: 'pyramide-voie', sets: pyramid.length, setLabels: pyramid, work: 300, rest: 240, unit: 'voies', note: 'Repère repos et clippages avant de partir.' },
        info.phaseIndex === 2
          ? { name: 'Endurance : 4 × 4', info: '4x4', sets: sets(3), reps: '4 voies faciles enchaînées', work: 480, rest: 240, note: `Niveau ~${grade(g - 4)}, sans repos entre les 4 voies.` }
          : { name: 'Continuité', info: 'continuite', sets: sets(3), reps: 'voie facile montée, désescaladée puis remontée', work: 420, rest: 300, note: `Niveau ~${grade(g - 3)}, sans toucher le sol.` },
        { name: 'Retour au calme', info: 'etirements-grimpe', work: 420, timed: true, note: 'Une voie très facile en souplesse, puis étirements avant-bras, nuque et dos.' },
      ];
    },
  },
  haut: {
    type: 'muscu', title: 'Muscu haut du corps et gainage', restAfter: 90,
    build: ({ sets }) => [
      WARMUP_GYM(420, '5 min de rameur ou de vélo, puis mobilité nuque et épaules.'),
      { name: 'Développé couché haltères', info: 'developpe-couche-halteres', sets: sets(3), reps: '10', work: 40, rest: 90 },
      { name: 'Rowing assis poulie, prise neutre', info: 'rowing-poulie', sets: sets(3), reps: '10', work: 40, rest: 90, note: 'Épaules basses.' },
      { name: 'Développé épaules haltères assis', info: 'developpe-epaules', sets: sets(3), reps: '10', work: 40, rest: 90 },
      { name: 'Pompes ou dips assistés (machine)', info: ['pompes', 'dips-machine'], sets: sets(3), reps: '8 à 12', work: 40, rest: 75 },
      { name: 'Face pull à la poulie', info: 'face-pull', sets: sets(3), reps: '15', work: 45, rest: 60, note: 'Léger. Excellent pour la nuque et les épaules de grimpeur.' },
      { name: 'Rotations externes', info: 'rotations-externes', sets: sets(2), reps: '15 par bras', work: 70, rest: 45, note: 'Poulie basse ou élastique, coude collé au corps.', restAfter: 60 },
      { name: 'Extensions des doigts (élastique)', info: 'extensions-doigts', sets: sets(2), reps: '20', work: 40, rest: 30, note: 'Antagonistes des fléchisseurs, protège les poulies.', restAfter: 60 },
      PLANK(sets(3)),
    ],
  },
  bas: {
    type: 'muscu', title: 'Muscu bas du corps et course', restAfter: 90, run: true,
    build: ({ f, sets }) => [
      WARMUP_GYM(300, '5 min de vélo, squats au poids du corps, mobilité hanches et dos.'),
      { name: 'Presse à cuisses ou goblet squat', info: ['presse', 'goblet-squat'], sets: sets(3), reps: '10', work: 45, rest: 120 },
      { name: 'Soulevé de terre roumain haltères', info: 'souleve-roumain', sets: sets(3), reps: '10', work: 45, rest: 120, note: 'Dos neutre, charge modérée.' },
      { name: 'Fentes marchées', info: 'fentes-marchees', sets: sets(3), reps: '10 par jambe', work: 70, rest: 90 },
      { name: 'Hip thrust machine', info: 'hip-thrust', sets: sets(3), reps: '12', work: 45, rest: 90 },
      SIDE_PLANK_CIRCUIT(sets(3)),
      { name: 'Course sur tapis', info: 'course-endurance', work: minutes(20, f) * 60, timed: true, note: 'En endurance, en aisance respiratoire.' },
    ],
  },
  full: {
    type: 'muscu', title: 'Muscu corps complet et course', restAfter: 90, run: true,
    build: ({ f, sets }) => [
      WARMUP_GYM(300, '5 min de rameur, mobilité nuque, épaules et hanches.'),
      { name: 'Goblet squat ou presse', info: ['goblet-squat', 'presse'], sets: sets(3), reps: '10', work: 45, rest: 120 },
      { name: 'Développé couché haltères', info: 'developpe-couche-halteres', sets: sets(3), reps: '10', work: 40, rest: 90 },
      { name: 'Soulevé de terre roumain haltères', info: 'souleve-roumain', sets: sets(3), reps: '10', work: 45, rest: 120, note: 'Dos neutre.' },
      { name: 'Développé épaules haltères', info: 'developpe-epaules', sets: sets(3), reps: '10', work: 40, rest: 90 },
      {
        name: 'Face pull et rotations externes', info: ['face-pull', 'rotations-externes'], sets: sets(3), rest: 60, note: 'Léger.',
        circuit: [
          { name: 'Face pull', label: '15 face pulls', work: 45, info: 'face-pull' },
          { name: 'Rotations externes', label: '15 rotations externes par bras', work: 70, info: 'rotations-externes' },
        ],
      },
      PLANK(sets(3)),
      { name: 'Course sur tapis', info: 'course-endurance', work: minutes(15, f) * 60, timed: true, note: 'En endurance.' },
    ],
  },
  fractionne: {
    type: 'cardio', title: 'Course fractionnée', restAfter: 60, run: true,
    build: ({ sets }) => [
      { name: 'Footing d\'échauffement', info: 'course-endurance', work: 900, timed: true, note: 'Très facile, puis 3 accélérations progressives.' },
      { name: '30/30', info: 'fractionne-30-30', label: '30/30', sets: sets(2), inner: { work: 30, rest: 30, rounds: sets(8) }, rest: 180, note: 'Vite sur l\'effort, trot pendant les repos.' },
      { name: 'Retour au calme', info: 'course-endurance', work: 600, timed: true, note: 'Footing lent, puis étirements mollets et ischios.' },
    ],
  },

  // ---------- À la maison : barre de traction, haltères 10 kg, gilet lesté 8 kg, tapis ----------
  blocMaison: {
    type: 'escalade', title: 'Force grimpe à la maison', home: true, restAfter: 90,
    build: ({ info, sets }) => {
      const weighted = info.week >= 5 && info.phaseIndex !== 3;
      return [
        MOBILITY,
        {
          name: 'Activation à la barre', info: 'scap-pulls', sets: 2, rest: 30, restAfter: 60,
          circuit: [
            { name: 'Tirages d\'omoplates (scap pulls)', label: '10 tirages d\'omoplates bras tendus', work: 40, info: 'scap-pulls' },
            { name: 'Cercles de bras', label: '10 cercles de bras', work: 20 },
          ],
        },
        { name: 'Suspensions actives', info: 'suspensions', sets: sets(4), work: 20, timed: true, rest: 40, note: 'Épaules engagées. Prise large et confortable, pas du bout des doigts.' },
        weighted
          ? { name: 'Tractions lestées', info: 'tractions', sets: sets(4), reps: '3 à 5 avec le gilet de 8 kg', work: 25, rest: 150, note: 'Amplitude complète, sans élan.' }
          : { name: 'Tractions', info: 'tractions', sets: sets(4), reps: '5 à 8', work: 30, rest: 120, note: 'Amplitude complète, sans élan. Garde 1 à 2 répétitions en réserve.' },
        { name: 'Tractions négatives', info: 'tractions-negatives', sets: sets(3), reps: '3', work: 25, rest: 90, note: 'Descente en 5 secondes.' },
        { name: 'Relevés de genoux suspendu', info: 'releves-genoux', sets: sets(3), reps: '8 à 10', work: 30, rest: 60, note: 'Sans balancer.' },
        { name: 'Pompes', info: 'pompes', sets: sets(3), reps: '15', work: 35, rest: 60, note: 'Antagonistes des tractions.' },
        { name: 'Oiseau haltères', info: 'oiseau', sets: sets(3), reps: '15', work: 45, rest: 45, note: 'Léger. Bon pour la nuque et le haut du dos.' },
        { name: 'Gainage creux (hollow)', info: 'hollow', sets: sets(3), work: 30, timed: true, rest: 30, note: 'Bas du dos plaqué au sol.', restAfter: 30 },
        { name: 'Retour au calme', info: 'etirements-grimpe', work: 300, timed: true, note: 'Étirements avant-bras, pectoraux, nuque et dos.' },
      ];
    },
  },
  voieMaison: {
    type: 'escalade', title: 'Endurance grimpe à la maison', home: true, restAfter: 90,
    build: ({ sets }) => [
      MOBILITY,
      {
        name: 'Circuit endurance', info: ['suspensions', 'tractions', 'pompes', 'planche'], sets: sets(4), rest: 120, note: 'Enchaîne sans pause à l\'intérieur d\'un tour.',
        circuit: [
          { name: 'Suspension', label: '30 s suspendu', work: 30, timed: true, info: 'suspensions' },
          { name: 'Tractions', label: '5 tractions', work: 20, info: 'tractions' },
          { name: 'Pompes', label: '10 pompes', work: 25, info: 'pompes' },
          { name: 'Planche', label: '30 s de planche', work: 30, timed: true, info: 'planche' },
        ],
      },
      { name: 'Pyramide de tractions', info: 'tractions', sets: 7, setLabels: ['1', '2', '3', '4', '3', '2', '1'].map((n) => `${n} traction${n === '1' ? '' : 's'}`), work: 15, rest: 30, unit: 'paliers', note: 'Repos = le temps passé à tirer. Arrête si les tractions deviennent moches.' },
      { name: 'Superman', info: 'superman', sets: sets(3), reps: '12 lents', work: 40, rest: 45, note: 'Regard vers le sol pour protéger la nuque.' },
      { name: 'Extensions de poignets haltère', info: 'extensions-poignets', sets: sets(2), reps: '15 par bras', work: 60, rest: 30, note: 'Léger. Antagonistes des avant-bras.', restAfter: 30 },
      { name: 'Retour au calme', info: 'etirements-grimpe', work: 300, timed: true, note: 'Étirements avant-bras, épaules, nuque et dos.' },
    ],
  },
  hautMaison: {
    type: 'muscu', title: 'Haut du corps à la maison', home: true, restAfter: 90,
    build: ({ info, sets }) => [
      WARMUP_GYM(300, '2 min de jumping jacks, cercles de bras, 10 pompes inclinées sur une chaise.'),
      info.week >= 5
        ? { name: 'Pompes lestées', info: 'pompes', sets: sets(4), reps: '12 à 15', work: 40, rest: 90, note: 'Avec le gilet de 8 kg, descente en 2 secondes.' }
        : { name: 'Pompes', info: 'pompes', sets: sets(4), reps: '12 à 15', work: 40, rest: 90, note: 'Descente en 2 secondes.' },
      { name: 'Rowing haltère un bras', info: 'rowing-haltere', sets: sets(3), reps: '12 par bras', work: 80, rest: 60, note: 'Pause d\'une seconde en haut.' },
      { name: 'Pompes piquées (épaules)', info: 'pompes-piquees', sets: sets(3), reps: '8 à 10', work: 35, rest: 90, note: 'Hanches hautes, tête vers le sol.' },
      { name: 'Développé épaules haltères debout', info: 'developpe-epaules', sets: sets(3), reps: '12', work: 40, rest: 60 },
      { name: 'Élévations latérales', info: 'elevations-laterales', sets: sets(3), reps: '15', work: 45, rest: 45, note: 'Lent.', restAfter: 60 },
      { name: 'Oiseau haltères', info: 'oiseau', sets: sets(3), reps: '15', work: 45, rest: 45, restAfter: 60 },
      { name: 'Pompes diamant (triceps)', info: 'pompes-diamant', sets: sets(2), reps: '8 à 12', work: 35, rest: 60, note: 'Mains rapprochées. Remplace les dips.', restAfter: 60 },
      { name: 'Curl haltères', info: 'curl', sets: sets(2), reps: '12', work: 40, rest: 45, note: 'Tempo lent.', restAfter: 60 },
      PLANK(sets(3)),
    ],
  },
  basMaison: {
    type: 'muscu', title: 'Bas du corps à la maison et course', home: true, run: true, restAfter: 90,
    build: ({ f, sets }) => [
      WARMUP_GYM(300, 'Squats au poids du corps, fentes, mobilité des hanches et du dos.'),
      { name: 'Goblet squat lesté', info: 'goblet-squat', sets: sets(4), reps: '15', work: 60, rest: 90, note: 'Haltère et gilet, descente en 3 secondes pour compenser la charge légère.' },
      { name: 'Fentes bulgares', info: 'fentes-bulgares', sets: sets(3), reps: '10 par jambe', work: 90, rest: 90, note: 'Pied arrière sur une chaise.' },
      { name: 'Soulevé de terre roumain sur une jambe', info: 'souleve-roumain-unilateral', sets: sets(3), reps: '10 par jambe', work: 90, rest: 60, note: 'Haltère en main, dos neutre.' },
      { name: 'Hip thrust au sol lesté', info: 'hip-thrust', sets: sets(3), reps: '15', work: 45, rest: 60, note: 'Gilet et haltère sur les hanches.', restAfter: 60 },
      { name: 'Mollets sur une marche', info: 'mollets', sets: sets(3), reps: '20', work: 45, rest: 45, note: 'Sur une jambe si c\'est trop facile.', restAfter: 60 },
      SIDE_PLANK_CIRCUIT(sets(3)),
      { name: 'Course dehors', info: 'course-endurance', work: minutes(20, f) * 60, timed: true, note: 'En endurance, en aisance respiratoire.' },
    ],
  },
  fullMaison: {
    type: 'muscu', title: 'Corps complet à la maison et course', home: true, run: true, restAfter: 90,
    build: ({ f, sets }) => [
      WARMUP_GYM(300, 'Jumping jacks, mobilité nuque, épaules et hanches.'),
      { name: 'Goblet squat lesté', info: 'goblet-squat', sets: sets(3), reps: '15', work: 60, rest: 90, note: 'Haltère et gilet.' },
      { name: 'Pompes', info: 'pompes', sets: sets(3), reps: '12 à 15', work: 40, rest: 75 },
      { name: 'Rowing haltère un bras', info: 'rowing-haltere', sets: sets(3), reps: '12 par bras', work: 80, rest: 60 },
      { name: 'Fentes bulgares', info: 'fentes-bulgares', sets: sets(3), reps: '10 par jambe', work: 90, rest: 90 },
      { name: 'Développé épaules haltères', info: 'developpe-epaules', sets: sets(3), reps: '12', work: 40, rest: 60 },
      { name: 'Oiseau haltères', info: 'oiseau', sets: sets(3), reps: '15', work: 45, rest: 45, note: 'Léger.', restAfter: 60 },
      PLANK(sets(3)),
      { name: 'Course dehors', info: 'course-endurance', work: minutes(15, f) * 60, timed: true, note: 'En endurance.' },
    ],
  },

  // ---------- Express : 20 à 30 min, à la maison ----------
  expressGrimpe: {
    type: 'escalade', title: 'Express grimpe à la maison', home: true, restAfter: 30,
    build: ({ sets }) => [
      { ...MOBILITY, name: 'Mobilité express', note: 'Nuque, épaules, poignets, chat-vache.' },
      {
        name: 'Circuit barre', info: ['tractions', 'suspensions', 'pompes', 'hollow'], sets: clamp(sets(5), 4, 6), rest: 75,
        circuit: [
          { name: 'Tractions', label: '5 à 8 tractions', work: 30, info: 'tractions' },
          { name: 'Suspension', label: '20 s suspendu', work: 20, timed: true, info: 'suspensions' },
          { name: 'Pompes', label: '10 pompes', work: 25, info: 'pompes' },
          { name: 'Gainage creux', label: '30 s de gainage creux', work: 30, timed: true, info: 'hollow' },
        ],
      },
      { name: 'Étirements', info: 'etirements-grimpe', work: 240, timed: true, note: 'Avant-bras, pectoraux, nuque.' },
    ],
  },
  expressRenfo: {
    type: 'muscu', title: 'Express renfo à la maison', home: true, restAfter: 30,
    build: () => [
      WARMUP_GYM(180, 'Jumping jacks, cercles de bras, squats au poids du corps.'),
      {
        name: 'EMOM 20 min', info: ['pompes', 'goblet-squat', 'rowing-haltere', 'fentes-marchees', 'planche'], sets: 4, rest: 0,
        note: 'Chaque minute, fais l\'exercice puis récupère jusqu\'à la minute suivante.',
        circuit: [
          { name: 'Pompes', label: '12 pompes', work: 60, timed: true, info: 'pompes' },
          { name: 'Goblet squat', label: '15 goblet squats', work: 60, timed: true, info: 'goblet-squat' },
          { name: 'Rowing haltère', label: '10 rowings haltère par bras', work: 60, timed: true, info: 'rowing-haltere' },
          { name: 'Fentes', label: '10 fentes par jambe', work: 60, timed: true, info: 'fentes-marchees' },
          { name: 'Planche', label: '40 s de planche', work: 60, timed: true, info: 'planche' },
        ],
      },
      { name: 'Étirements', info: 'etirements', work: 120, timed: true, note: 'Hanches, pectoraux, nuque.' },
    ],
  },
  expressCourse: {
    type: 'cardio', title: 'Course express', run: true, restAfter: 0,
    build: () => [
      { name: 'Footing d\'échauffement', info: 'course-endurance', work: 420, timed: true, note: 'Très facile.' },
      { name: '30/30', info: 'fractionne-30-30', label: '30/30', inner: { work: 30, rest: 30, rounds: 10 }, note: 'Pas le temps de sortir ? Remplace par des montées de genoux sur place.' },
      { name: 'Retour au calme', info: 'course-endurance', work: 300, timed: true, note: 'Marche ou footing lent.' },
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

  if (log.type === 'escalade' && !log.home) {
    const recent = state.logs.filter((l) => l.type === 'escalade' && !l.home).slice(-2);
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
