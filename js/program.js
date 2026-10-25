// Génération du programme hebdomadaire et règles d'adaptation.
import { fmtKg, liftPlan } from './lifts.js';

export const GRADES = ['5c', '6a', '6a+', '6b', '6b+', '6c', '6c+', '7a', '7a+', '7b'];
export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const TYPES = {
  escalade: { label: 'Escalade', color: 'var(--series-1)' },
  muscu: { label: 'Muscu', color: 'var(--series-2)' },
  cardio: { label: 'Cardio', color: 'var(--series-3)' },
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
  cardioSansCourse: [
    'Cardio sans course : vise un effort où tu peux encore parler par phrases courtes.',
    'Atterris en douceur sur l\'avant du pied pendant les sauts, genoux souples.',
    'Sur les intervalles, la dernière série doit ressembler à la première.',
    'Hydrate-toi avant la séance, surtout le midi.',
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
//   countUp    test maximal : la séance guidée affiche le temps écoulé
//   test       clé du résultat à noter (prise de référence)
//   load       charge suivie dans le carnet : { kg, step, min, max, tool, fromBench? }
//   note       consignes affichées après la prescription
const MOBILITY = {
  name: 'Échauffement nuque, épaules, dos', info: 'mobilite', label: 'Mobilité',
  inner: { work: 30, rest: 10, rounds: 8 }, restAfter: 30,
  innerLabels: ['Inclinaisons de nuque', 'Rotations douces de nuque', 'Haussements d\'épaules', 'Cercles de bras vers l\'avant', 'Cercles de bras vers l\'arrière', 'Chat-vache', 'Rotation thoracique gauche', 'Rotation thoracique droite'],
  note: 'Rotations de nuque lentes, haussements d\'épaules, cercles de bras, chat-vache, rotations thoraciques.',
};

const WARMUP_GYM = (seconds, note) => ({ name: 'Échauffement', info: 'echauffement-general', work: seconds, timed: true, restAfter: 30, note });
const PLANK = (sets, work = 40) => ({ name: 'Gainage : planche', info: 'planche', sets, work, timed: true, rest: 20, note: 'Menton rentré.' });
const SIDE_PLANK_CIRCUIT = (sets) => ({
  name: 'Gainage latéral et dead bug', info: ['gainage-lateral', 'dead-bug'], sets, rest: 30,
  circuit: [
    { name: 'Gainage latéral gauche', label: '30 s de gainage latéral de chaque côté', work: 30, timed: true, info: 'gainage-lateral' },
    { name: 'Gainage latéral droit', work: 30, timed: true, info: 'gainage-lateral' },
    { name: 'Dead bug', label: '10 dead bugs lents', work: 45, info: 'dead-bug' },
  ],
});

// Charges suivies dans le carnet. À la maison : un haltère réglable de 2 à 10 kg (pas de 1 kg),
// le gilet de 4 à 8 kg, la pince de 5 à 60 kg. En salle, la charge est libre.
const DB = (kg) => ({ kg, step: 1, min: 2, max: 10, tool: 'haltère' });
const VEST = (kg) => ({ kg, step: 1, min: 4, max: 8, tool: 'gilet', fromBench: true });
const GRIP = (kg) => ({ kg, step: 5, min: 5, max: 60, tool: 'pince', fromBench: true });
const GYM = (step = 2) => ({ kg: null, step, min: 0, max: 300, tool: 'charge' });

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

// ---------- Plan de saison vers un objectif ----------
// Les cycles de 4 semaines deviennent des blocs qui s'enchaînent jusqu'à la date visée,
// puis deux semaines d'affûtage (la semaine d'avant et celle de l'objectif).
export const BLOCKS = {
  base: { name: 'Base', short: 'Base', note: 'Volume et technique : beaucoup de grimpe facile et propre, charges modérées.', mult: 1 },
  force: { name: 'Force', short: 'Force', note: 'Blocs durs et charges lourdes, avec des repos complets entre les efforts.', mult: 0.95 },
  endurance: { name: 'Force-endurance', short: 'Endurance', note: 'Continuité et 4 × 4 : tenir longtemps sans exploser.', mult: 1 },
  performance: { name: 'Performance', short: 'Perf', note: 'Essais sur tes projets, volume réduit pour rester frais.', mult: 0.9 },
  affutage: { name: 'Affûtage', short: 'Affût', note: 'Peu de volume, intensité gardée : tu arrives frais le jour J.', mult: 0.6 },
};

// Répartition des cycles disponibles avant l'affûtage.
export function allocateBlocks(k) {
  if (k <= 0) return [];
  if (k === 1) return ['performance'];
  if (k === 2) return ['force', 'performance'];
  if (k === 3) return ['force', 'endurance', 'performance'];
  const base = Math.max(1, Math.round(k * 0.25));
  const endurance = Math.max(1, Math.round(k * 0.25));
  return [...Array(base).fill('base'), ...Array(k - base - endurance - 1).fill('force'), ...Array(endurance).fill('endurance'), 'performance'];
}

// settings.goal = { grade, kind (voie ou bloc), date, from (lundi où le plan a été fixé), fromGrade }
export function seasonPlan(state) {
  const g = state.settings.goal;
  if (!g?.date || !g.from) return null;
  const start = state.settings.startDate;
  const goalWeek = weekInfo(parseYmd(g.date), start).week;
  const fromWeek = Math.min(goalWeek, weekInfo(parseYmd(g.from), start).week);
  const taperFrom = Math.max(fromWeek, goalWeek - 1);
  const firstCycle = Math.ceil(fromWeek / 4);
  const k = taperFrom > fromWeek ? Math.ceil((taperFrom - 1) / 4) - firstCycle + 1 : 0;
  // Un bloc regroupe les cycles consécutifs de la même phase.
  const blocks = [];
  allocateBlocks(k).forEach((phase, j) => {
    const c = firstCycle + j;
    const from = Math.max(fromWeek, 4 * (c - 1) + 1);
    const to = Math.min(4 * c, taperFrom - 1);
    if (blocks.at(-1)?.phase === phase) blocks.at(-1).to = to;
    else blocks.push({ phase, from, to });
  });
  blocks.push({ phase: 'affutage', from: taperFrom, to: goalWeek });
  return { ...g, fromWeek, goalWeek, blocks };
}

export function blockAt(plan, week) {
  if (!plan || week < plan.fromWeek || week > plan.goalWeek) return null;
  const index = plan.blocks.findIndex((b) => week >= b.from && week <= b.to);
  const b = plan.blocks[index];
  return { ...b, ...BLOCKS[b.phase], index, weekIn: week - b.from + 1, weeks: b.to - b.from + 1, goalWeek: week === plan.goalWeek };
}

// Meilleure cotation enchaînée ces 8 dernières semaines (carnet d'escalade, sinon ressenti des séances).
export function recentMax(state, kind, today = new Date()) {
  const since = addDays(today, -56);
  const end = ymd(today);
  const idx = [
    ...(state.climbs || []).filter((c) => c.kind === kind && c.style !== 'travail' && c.date >= since && c.date <= end).map((c) => c.grade),
    ...(state.logs || []).filter((l) => l.maxGrade && l.key === kind && l.date >= since && l.date <= end).map((l) => l.maxGrade),
  ].map((x) => GRADES.indexOf(x)).filter((i) => i >= 0);
  return idx.length ? GRADES[Math.max(...idx)] : null;
}

// Où en est la saison : bloc en cours, cotation attendue (progression linéaire vers l'objectif) et références.
export function seasonStatus(state, today = new Date()) {
  const plan = seasonPlan(state);
  if (!plan) return null;
  const week = weekInfo(today, state.settings.startDate).week;
  const block = blockAt(plan, week);
  const daysLeft = Math.round((parseYmd(plan.date) - parseYmd(ymd(today))) / 86400000);
  const from = GRADES.indexOf(plan.fromGrade);
  const to = GRADES.indexOf(plan.grade);
  const progress = clamp((week - plan.fromWeek) / Math.max(1, plan.goalWeek - plan.fromWeek), 0, 1);
  const expected = GRADES[Math.round(from + (to - from) * progress)];
  const current = recentMax(state, plan.kind, today);
  const ci = GRADES.indexOf(current);
  const ei = GRADES.indexOf(expected);
  const pace = !current ? 'unknown' : ci >= to ? 'reached' : ci > ei ? 'ahead' : ci === ei ? 'on-track' : 'behind';
  const benches = state.benchmarks || [];
  const ref = [...benches].reverse().find((b) => b.date <= plan.from) || benches[0];
  const last = benches.at(-1);
  const gains = ref && last && ref !== last
    ? ['pullups', 'hang', 'gripper'].filter((k) => ref[k] && last[k]).map((k) => ({ key: k, delta: last[k] - ref[k] }))
    : [];
  return { plan, week, block, daysLeft, expected, current, pace, gap: ei - ci, gains, over: week > plan.goalWeek };
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
    const id = `${ymd(date)}#${i}`;
    const slot = day >= 5 ? 'weekend' : (state.slots?.[id] ?? s.slot);
    const express = !!state.express?.[id];
    return { ...buildSession(s.key, date, state, express, state.durations?.[id]), index: i, day, slot, time: state.settings.times[slot], date: ymd(date) };
  });
}

// Passe une séance de semaine du midi au soir (ou l'inverse), pour ce jour-là seulement.
export function setSlot(state, id, slot) {
  const [date, i] = id.split('#');
  const sched = SCHEDULES[state.settings.sessionsPerWeek] || SCHEDULES[4];
  state.slots = { ...(state.slots || {}) };
  if (sched[Number(i)]?.slot === slot) delete state.slots[id];
  else state.slots[id] = slot;
  return date;
}

export function sessionsOn(date, state) {
  return weekSessions(mondayOf(date), state).filter((s) => s.date === ymd(date));
}

// Choisit la variante réelle d'une séance selon les accès en salle et le mode express.
export function resolveKey(key, state, express = false) {
  const type = TEMPLATES[key].type;
  const access = state.settings.access || {};
  const runs = access.course !== false;
  if (express) return { escalade: 'expressGrimpe', muscu: 'expressRenfo', cardio: runs ? 'expressCourse' : 'expressCardio' }[type];
  if (TEMPLATES[key].home) return key;
  // Pas de course : fractionné sur vélo ou rameur en salle, sinon circuit cardio à la maison.
  if (type === 'cardio' && !runs) return access.muscu ? 'fractionneVelo' : 'cardioMaison';
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
  if (sec < 15 * 60) return `${Math.max(1, Math.round(sec / 60))} min`;
  const m = Math.round(sec / 300) * 5;
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
  else if (e.countUp) main = 'Effort maximal, une seule fois';
  else if (e.setLabels) main = `${e.sets} ${unit} : ${e.setLabels.join(', ')}`;
  else if (e.inner) main = `${e.sets > 1 ? `${e.sets} séries de ` : ''}${e.inner.rounds} × (${fmtDuration(e.inner.work)} d'effort${e.inner.rest ? ` / ${fmtDuration(e.inner.rest)} de repos` : ''})`;
  else if (e.reps) main = `${e.sets > 1 ? `${e.sets} × ` : ''}${e.reps}${e.load?.kg != null ? `, ${e.load.tool} à ${fmtKg(e.load.kg)}` : ''}`;
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
  if (e.countUp) return { mode: 'stopwatch' };
  if (e.timed && e.sets > 1) return { mode: 'interval', work: e.work, rest: e.rest || 0, rounds: e.sets, label };
  if (e.timed) return { mode: 'countdown', seconds: e.work, label };
  if (e.rest) return { mode: 'countdown', seconds: e.rest, label: `Repos · ${label}` };
  return null;
}

// ---------- Douleurs ----------
export const ZONES = { doigts: 'Doigts', poignet: 'Poignet', coude: 'Coude', epaule: 'Épaule', nuque: 'Nuque', dos: 'Dos', genou: 'Genou' };
export const PAIN_DAYS = 7;
// Zones sollicitées par chaque fiche d'exercice. Mobilité, étirements, grimpe facile,
// gainage et exercices de prévention (face pull, rotations externes) restent toujours.
const STRAIN = {
  poutre: ['doigts', 'coude'], projet: ['doigts', 'coude', 'epaule'], 'bloc-niveau': ['doigts', 'epaule'],
  'pyramide-voie': ['doigts'], '4x4': ['doigts', 'coude'],
  suspensions: ['doigts', 'coude', 'epaule'], pince: ['doigts', 'poignet', 'coude'],
  tractions: ['coude', 'epaule'], 'tractions-negatives': ['coude', 'epaule'], 'scap-pulls': ['epaule'], 'releves-genoux': ['epaule', 'dos'],
  pompes: ['poignet', 'epaule'], 'pompes-diamant': ['poignet', 'coude', 'epaule'], 'pompes-piquees': ['poignet', 'epaule', 'nuque'],
  'dips-machine': ['epaule', 'coude'], 'developpe-couche-halteres': ['epaule'], 'developpe-epaules': ['epaule', 'nuque'],
  'elevations-laterales': ['epaule'], oiseau: ['epaule'], 'rowing-haltere': ['dos', 'coude'], 'rowing-poulie': ['dos', 'coude'],
  curl: ['coude', 'poignet'], 'extensions-poignets': ['poignet', 'coude'],
  'goblet-squat': ['genou', 'dos'], presse: ['genou'], 'souleve-roumain': ['dos'], 'souleve-roumain-unilateral': ['dos'],
  'fentes-marchees': ['genou'], 'fentes-bulgares': ['genou'], hollow: ['dos', 'nuque'], superman: ['dos', 'nuque'],
  'course-endurance': ['genou'], 'fractionne-30-30': ['genou'], 'test-cooper': ['genou'],
  'jumping-jacks': ['genou'], burpees: ['genou', 'poignet', 'epaule'], 'shadow-boxing': ['epaule'],
  'crunch-inverse': ['dos'], 'russian-twist': ['dos'], 'mountain-climbers': ['poignet', 'epaule'], 'crunch-poulie': ['dos', 'nuque'],
  'chaise-romaine': ['dos'], 'bucheron-poulie': ['dos', 'epaule'], 'roue-abdos': ['dos', 'epaule'], 'extensions-lombaires': ['dos'],
  'pompes-declinees': ['poignet', 'epaule'], 'floor-press': ['epaule'], 'rowing-inverse': ['epaule', 'coude'], 'chin-up': ['coude', 'epaule'],
  'tirage-vertical': ['epaule', 'coude'], 'extension-triceps': ['coude', 'epaule'], 'pistol-assiste': ['genou'], 'step-up': ['genou'], 'good-morning': ['dos'],
};
export const strainOf = (info) => [...new Set([].concat(info || []).flatMap((i) => STRAIN[i] || []))];

function addDays(d, n) { return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); }

// Zones douloureuses actives à une date : { zone: date de fin }.
export function activePains(state, dateYmd) {
  const out = {};
  (state.pains || []).forEach((p) => {
    if (p.from <= dateYmd && dateYmd <= p.until && (!out[p.zone] || p.until > out[p.zone])) out[p.zone] = p.until;
  });
  return out;
}

// Signale des douleurs à partir d'une date : les exercices concernés sont retirés pendant 7 jours.
export function addPains(state, zones, fromYmd) {
  const until = addDays(parseYmd(fromYmd), PAIN_DAYS - 1);
  state.pains = [...(state.pains || []).filter((p) => !zones.includes(p.zone) || p.until < fromYmd), ...zones.map((zone) => ({ zone, from: fromYmd, until }))];
}

// « Ça va mieux » : la zone redevient disponible dès la date donnée.
export function healPain(state, zone, fromYmd) {
  const before = addDays(parseYmd(fromYmd), -1);
  state.pains = (state.pains || [])
    .map((p) => (p.zone === zone && p.until >= fromYmd ? { ...p, until: before } : p))
    .filter((p) => p.from <= p.until);
}

function withoutPain(items, zones) {
  const removed = [];
  const hurts = (info) => strainOf(info).some((z) => zones.includes(z));
  const kept = items.flatMap((e) => {
    if (e.circuit) {
      const circuit = e.circuit.filter((c) => !hurts(c.info || e.info));
      e.circuit.filter((c) => !circuit.includes(c)).forEach((c) => removed.push(c.name));
      if (!circuit.length) return [];
      if (circuit.length === e.circuit.length) return [e];
      if (!circuit.some((c) => c.label)) circuit[0] = { ...circuit[0], label: circuit[0].name };
      return [{ ...e, circuit, info: [...new Set(circuit.map((c) => c.info).filter(Boolean))] }];
    }
    if (hurts(e.info)) { removed.push(e.name); return []; }
    return [e];
  });
  return { kept, removed: [...new Set(removed)] };
}

// ---------- Remplacer un exercice ----------
// Alternatives équivalentes, rangées par mouvement. where : home (matériel maison), gym (salle) ou any.
// reps absent ou keepReps : on garde la prescription d'origine (tractions calées sur la prise de référence).
// load : une charge, ou { home, gym } selon le lieu. keepLoad : on garde celle d'origine (gilet des tractions lestées).
const SWAP_GROUPS = {
  push: [
    { name: 'Pompes', info: 'pompes', where: 'any', reps: '10 à 15' },
    { name: 'Pompes pieds surélevés', info: 'pompes-declinees', where: 'any', reps: '8 à 12', note: 'Pieds sur une chaise, corps gainé.' },
    { name: 'Développé au sol un bras', info: 'floor-press', where: 'home', reps: '10 à 12 par bras', load: DB(8), note: 'Allongé au sol, coude qui touche le sol à chaque répétition.' },
    { name: 'Développé couché haltères', info: 'developpe-couche-halteres', where: 'gym', reps: '8 à 12', load: GYM(2) },
  ],
  row: [
    { name: 'Rowing haltère un bras', info: 'rowing-haltere', where: 'any', reps: '10 à 15 par bras', load: { home: DB(10), gym: GYM(2) }, note: 'Pause d\'une seconde en haut.' },
    { name: 'Rowing inversé sous une table', info: 'rowing-inverse', where: 'any', reps: '8 à 12', note: 'Table bien stable (ou barre basse en salle), corps gainé.' },
    { name: 'Rowing assis poulie, prise neutre', info: 'rowing-poulie', where: 'gym', reps: '8 à 12', load: GYM(5), note: 'Épaules basses.' },
  ],
  pull: [
    { name: 'Tractions', info: 'tractions', where: 'any', keepReps: true, keepLoad: true, note: 'Amplitude complète, sans élan.' },
    { name: 'Tractions supination', info: 'chin-up', where: 'any', keepReps: true, keepLoad: true, note: 'Paumes vers toi, amplitude complète.' },
    { name: 'Tractions négatives', info: 'tractions-negatives', where: 'any', reps: '3 à 5', note: 'Descente en 5 secondes.' },
    { name: 'Tirage vertical à la poulie', info: 'tirage-vertical', where: 'gym', reps: '8 à 12', load: GYM(5), note: 'Poitrine sortie, coudes vers les hanches.' },
  ],
  press: [
    { name: 'Développé épaules un bras', info: 'developpe-epaules', where: 'home', reps: '8 à 12 par bras', load: DB(6), note: 'Debout et gainé.' },
    { name: 'Développé épaules haltères assis', info: 'developpe-epaules', where: 'gym', reps: '8 à 12', load: GYM(2) },
    { name: 'Pompes piquées (épaules)', info: 'pompes-piquees', where: 'any', reps: '8 à 10', note: 'Hanches hautes, tête vers le sol.' },
  ],
  lateral: [
    { name: 'Élévations latérales un bras', info: 'elevations-laterales', where: 'home', reps: '12 à 15 par bras', load: DB(3), note: 'Lent, sans élan.' },
    { name: 'Élévations latérales à la poulie', info: 'elevations-laterales', where: 'gym', reps: '12 à 15 par bras', load: GYM(2.5), note: 'Lent, sans élan.' },
    { name: 'Y-T-W au sol', info: 'ytw', where: 'any', reps: '8 de chaque lettre', note: 'Allongé sur le ventre, pouces vers le plafond.' },
  ],
  rear: [
    { name: 'Oiseau un bras', info: 'oiseau', where: 'home', reps: '12 à 15 par bras', load: DB(3), note: 'Main libre sur une chaise.' },
    { name: 'Face pull à la poulie', info: 'face-pull', where: 'gym', reps: '15', load: GYM(2.5), note: 'Léger.' },
    { name: 'Y-T-W au sol', info: 'ytw', where: 'any', reps: '8 de chaque lettre', note: 'Allongé sur le ventre, pouces vers le plafond.' },
  ],
  triceps: [
    { name: 'Pompes diamant (triceps)', info: 'pompes-diamant', where: 'any', reps: '8 à 12', note: 'Mains rapprochées.' },
    { name: 'Extension triceps un bras au-dessus de la tête', info: 'extension-triceps', where: 'home', reps: '10 à 15 par bras', load: DB(5), note: 'Coude pointé vers le plafond.' },
    { name: 'Extension triceps à la poulie', info: 'extension-triceps', where: 'gym', reps: '10 à 15', load: GYM(2.5) },
    { name: 'Dips assistés (machine)', info: 'dips-machine', where: 'gym', reps: '8 à 12' },
  ],
  biceps: [
    { name: 'Curl un bras', info: 'curl', where: 'home', reps: '8 à 12 par bras', load: DB(7), note: 'Tempo lent.' },
    { name: 'Curl marteau un bras', info: 'curl', where: 'home', reps: '8 à 12 par bras', load: DB(7), note: 'Pouce vers le haut, tempo lent.' },
    { name: 'Curl à la poulie', info: 'curl', where: 'gym', reps: '10 à 12', load: GYM(2.5) },
    { name: 'Tractions supination', info: 'chin-up', where: 'any', reps: '5 à 8', note: 'Paumes vers toi.' },
  ],
  squat: [
    { name: 'Goblet squat lesté', info: 'goblet-squat', where: 'home', keepReps: true, note: 'Haltère 10 kg et gilet 8 kg, descente en 3 secondes.' },
    { name: 'Step-up lesté sur une chaise', info: 'step-up', where: 'home', reps: '10 à 12 par jambe', note: 'Gilet 8 kg, haltère 10 kg à la main. Pousse avec la jambe du haut.' },
    { name: 'Squat sur une jambe assisté', info: 'pistol-assiste', where: 'any', reps: '6 à 10 par jambe', note: 'Une main sur un appui, descente contrôlée.' },
    { name: 'Presse à cuisses', info: 'presse', where: 'gym', reps: '8 à 12', load: GYM(5) },
    { name: 'Goblet squat', info: 'goblet-squat', where: 'gym', reps: '8 à 12', load: GYM(2) },
  ],
  lunge: [
    { name: 'Fentes bulgares', info: 'fentes-bulgares', where: 'any', reps: '10 par jambe', note: 'Pied arrière sur une chaise.' },
    { name: 'Fentes marchées', info: 'fentes-marchees', where: 'any', reps: '10 par jambe' },
    { name: 'Fentes arrière', info: 'fentes-marchees', where: 'any', reps: '10 par jambe', note: 'Grand pas en arrière, buste droit.' },
    { name: 'Step-up lesté sur une chaise', info: 'step-up', where: 'home', reps: '10 à 12 par jambe', note: 'Gilet 8 kg. Pousse avec la jambe du haut.' },
  ],
  hinge: [
    { name: 'Soulevé de terre roumain sur une jambe', info: 'souleve-roumain-unilateral', where: 'home', reps: '10 à 12 par jambe', load: DB(10), note: 'Dos neutre.' },
    { name: 'Good morning avec le gilet', info: 'good-morning', where: 'home', reps: '12 à 15', note: 'Gilet 8 kg, dos neutre, genoux légèrement fléchis.' },
    { name: 'Pont fessier sur une jambe', info: 'hip-thrust', where: 'any', reps: '12 par jambe' },
    { name: 'Soulevé de terre roumain haltères', info: 'souleve-roumain', where: 'gym', reps: '8 à 12', load: GYM(2), note: 'Dos neutre.' },
  ],
  glutes: [
    { name: 'Hip thrust au sol lesté', info: 'hip-thrust', where: 'home', reps: '15', note: 'Gilet 8 kg et haltère 10 kg sur les hanches.' },
    { name: 'Pont fessier sur une jambe', info: 'hip-thrust', where: 'any', reps: '12 par jambe' },
    { name: 'Hip thrust machine', info: 'hip-thrust', where: 'gym', reps: '10 à 15', load: GYM(5) },
  ],
  hang: [
    { name: 'Relevés de genoux suspendu', info: 'releves-genoux', where: 'any', reps: '8 à 10', note: 'Sans balancer.' },
    { name: 'Crunch inversé', info: 'crunch-inverse', where: 'any', reps: '12 à 15' },
    { name: 'Relevés de jambes à la chaise romaine', info: 'chaise-romaine', where: 'gym', reps: '10 à 12' },
  ],
  lowerBack: [
    { name: 'Superman', info: 'superman', where: 'any', reps: '12 lents', note: 'Regard vers le sol pour protéger la nuque.' },
    { name: 'Bird dog', info: 'bird-dog', where: 'any', reps: '10 par côté', note: 'Dos plat, mouvement lent.' },
    { name: 'Extensions lombaires', info: 'extensions-lombaires', where: 'gym', reps: '12' },
  ],
  plank: [
    { name: 'Gainage : planche', info: 'planche', where: 'any', timed: true, work: (p) => p.plank, note: 'Menton rentré.' },
    { name: 'Gainage creux (hollow)', info: 'hollow', where: 'any', timed: true, work: () => 30, note: 'Bas du dos plaqué au sol.' },
    { name: 'Dead bug', info: 'dead-bug', where: 'any', timed: false, reps: '10 lents', work: () => 45, note: 'Bas du dos plaqué au sol.' },
  ],
};
const SWAP_GROUP_OF = {};
Object.entries(SWAP_GROUPS).forEach(([g, list]) => list.forEach((a) => { SWAP_GROUP_OF[a.info] ||= g; }));
Object.assign(SWAP_GROUP_OF, { hollow: 'plank', 'dead-bug': 'plank', 'step-up': 'lunge', ytw: 'rear', 'chin-up': 'pull' });
export const SWAP_INFOS = Object.values(SWAP_GROUPS).flat().map((a) => a.info);

const swapGroup = (e) => (!e.circuit && !e.inner && !e.setLabels && !e.test && !e.countUp ? SWAP_GROUP_OF[[].concat(e.info || [])[0]] : null);
const fits = (a, where) => a.where === 'any' || a.where === where;

function toAlt(e, a, where, p) {
  const x = { ...e, name: a.name, info: a.info, note: a.note || '' };
  delete x.label;
  const load = a.keepLoad ? e.load : a.load?.tool ? a.load : a.load?.[where];
  if (load) x.load = load; else delete x.load;
  if (a.timed) { x.timed = true; delete x.reps; delete x.unit; } else if (a.timed === false || a.reps) delete x.timed;
  if (a.reps && !a.keepReps) x.reps = a.reps;
  if (a.work) x.work = a.work(p);
  else if (x.timed !== e.timed) x.work = 40;
  return x;
}

// Remplacement retenu pour un exercice : d'abord celui du jour, sinon celui choisi pour toujours.
function applySwap(e, state, day, where, p) {
  const group = swapGroup(e);
  if (!group) return e;
  const once = state.swaps?.[`${day}|${e.name}`];
  const to = once ?? state.swaps?.[e.name];
  const a = to && to !== e.name && SWAP_GROUPS[group].find((x) => x.name === to && fits(x, where));
  if (!a) return { ...e, swap: { from: e.name, group } };
  return { ...toAlt(e, a, where, p), swap: { from: e.name, group, to: a.name, once: !!once } };
}

// Alternatives proposées pour un exercice d'une séance (même mouvement, matériel du lieu, sans zone douloureuse).
export function swapChoices(e, session, state) {
  if (!e.swap) return [];
  const where = session.home ? 'home' : 'gym';
  const zones = Object.keys(activePains(state, session.date));
  const p = prescriptions(latestBench(state));
  return SWAP_GROUPS[e.swap.group]
    .filter((a) => fits(a, where) && a.name !== e.name && a.name !== e.swap.from && !strainOf(a.info).some((z) => zones.includes(z)))
    .map((a) => { const x = { sets: 1, ...toAlt(e, a, where, p) }; return { name: a.name, info: a.info, detail: describe(x) }; });
}

// always : remplace l'exercice dans toutes les séances ; sinon pour ce jour-là seulement. to = from : retour à l'original.
export function setSwap(state, day, from, to, always = false) {
  const swaps = { ...(state.swaps || {}) };
  delete swaps[`${day}|${from}`];
  if (to === from) delete swaps[from];
  else if (always) swaps[from] = to;
  else swaps[`${day}|${from}`] = to;
  state.swaps = swaps;
}

// ---------- État de forme du jour ----------
// Chaque réponse vaut de 0 (mauvais) à 2 (bon).
export const FORM_QUESTIONS = [
  { key: 'sleep', label: 'Sommeil', options: ['Mauvais', 'Moyen', 'Bon'] },
  { key: 'energy', label: 'Énergie', options: ['Fatigué', 'Normale', 'En forme'] },
  { key: 'sore', label: 'Courbatures', options: ['Fortes', 'Légères', 'Aucune'] },
];
export const FORM_LABELS = { low: 'Petite forme', normal: 'Forme normale', high: 'Grande forme' };

export function formLevel(state, dateYmd) {
  const f = state.forms?.[dateYmd];
  if (!f) return null;
  const score = FORM_QUESTIONS.reduce((t, q) => t + (Number(f[q.key]) || 0), 0);
  return score <= 2 ? 'low' : score >= 6 ? 'high' : 'normal';
}

export function setForm(state, dateYmd, answers) {
  state.forms = { ...(state.forms || {}), [dateYmd]: answers };
}

// Séries comptées qu'on peut retirer ou ajouter sans casser la séance (pas les pyramides ni les tests).
const adjustable = (e) => (e.sets ?? 1) >= 2 && !e.setLabels && !e.test;

// Petite forme : une série de moins partout, cardio long raccourci. Grande forme : une série bonus
// sur les deux premiers exercices comptés, sauf en semaine de décharge.
function applyForm(items, level, { type, home, deload, notes }) {
  if (level === 'low') {
    notes.unshift('Petite forme : une série de moins sur chaque exercice. Garde de la marge, la séance compte quand même.');
    if (type === 'escalade' && !home) notes.unshift('Pas d\'essais au max aujourd\'hui : grimpe propre, sous ta limite.');
    return items.map((e) => {
      if (adjustable(e)) return { ...e, sets: e.sets - 1 };
      if (e.timed && (e.sets ?? 1) === 1 && e.work >= 900) return { ...e, work: Math.round((e.work * 0.75) / 60) * 60 };
      return e;
    });
  }
  if (level !== 'high') return items;
  if (deload) {
    notes.unshift('Grande forme, mais semaine de décharge : garde le plan, tu en profiteras la semaine prochaine.');
    return items;
  }
  // Jamais de série bonus sur ce qui charge les doigts (poulies fragiles).
  const picks = items.filter((e) => adjustable(e) && e.reps && !e.circuit && !e.inner && !strainOf(e.info).includes('doigts')).slice(0, 2);
  if (!picks.length) {
    notes.unshift(type === 'escalade' && !home ? 'Grande forme : bonne journée pour tes projets.' : 'Grande forme : profites-en pour soigner l\'amplitude et le tempo.');
    return items;
  }
  notes.unshift(`Grande forme : une série bonus sur ${picks.map((e) => e.name.toLowerCase()).join(' et ')}, seulement si la technique reste propre.`);
  return items.map((e) => (picks.includes(e) ? { ...e, sets: e.sets + 1 } : e));
}

// ---------- Séance à la durée choisie ----------
export const DURATION_CHOICES = [20, 30, 45, 60];
const WARMUPS = ['mobilite', 'echauffement-general', 'grimpe-echauffement'];
const firstInfo = (e) => [].concat(e.info || [])[0] || '';
const isCooldown = (e) => /etirements/.test(firstInfo(e)) || e.name === 'Retour au calme';

// Ramène une séance sous la durée voulue, dans cet ordre : repos raccourcis, échauffement et retour au calme
// écourtés, une série de moins (en partant de la fin), cardio long raccourci, puis exercices secondaires retirés.
// La mobilité nuque et dos, l'échauffement et l'exercice principal restent toujours.
function fitDuration(items, target, notes) {
  // Repères posés avant les retouches : échauffement (le premier exercice compris) et retour au calme.
  let list = items.map((e, i) => ({ ...e, warm: i === 0 || WARMUPS.includes(firstInfo(e)), cool: i > 0 && isCooldown(e) }));
  const clean = () => list.map(({ warm, cool, ...e }) => e);
  const total = (l = list) => sessionSeconds(l.map((e, i) => (i === l.length - 1 ? { ...e, restAfter: 0 } : e)));
  if (total() <= target) return clean();
  const removed = [];
  let fewer = 0;
  const over = () => total() > target;
  list = list.map((e) => {
    const fingers = strainOf(e.info).includes('doigts');
    const rest = !e.rest ? e.rest : fingers ? Math.max(Math.min(e.rest, 180), Math.round((e.rest * 0.75) / 15) * 15) : Math.max(30, Math.round((e.rest * 0.67) / 15) * 15);
    return { ...e, rest, restAfter: Math.min(e.restAfter, 45) };
  });
  list = list.map((e, i) => {
    if (over() && (e.warm || e.cool) && e.timed && e.sets === 1 && firstInfo(e) !== 'mobilite' && e.work > 180) return { ...e, work: Math.max(180, Math.round((e.work * 0.6) / 60) * 60) };
    return e;
  });
  // Pyramides : on retire les paliers les plus faciles, en gardant les trois derniers.
  list = list.map((e) => {
    if (!over() || !e.setLabels || e.setLabels.length <= 3) return e;
    const keep = e.setLabels.slice(-3);
    fewer += e.setLabels.length - keep.length;
    return { ...e, setLabels: keep, sets: keep.length };
  });
  for (let changed = true; changed && over();) {
    changed = false;
    for (let j = list.length - 1; j >= 0 && over(); j--) {
      if (adjustable(list[j]) && list[j].sets >= 3) { list[j] = { ...list[j], sets: list[j].sets - 1 }; fewer++; changed = true; }
    }
  }
  list = list.map((e, i) => {
    if (!over() || e.warm || e.cool) return e;
    if (e.timed && e.sets === 1 && e.work > 600) return { ...e, work: Math.max(600, Math.round((e.work - (total() - target)) / 60) * 60) };
    if (e.inner && e.innerLabels && e.inner.rounds > 8) return { ...e, inner: { ...e.inner, rounds: 8 }, innerLabels: e.innerLabels.slice(0, 8) };
    return e;
  });
  // Exercices retirés en partant de la fin : d'abord ceux dont le retrait ne fait pas tomber trop bas,
  // puis les autres, et le deuxième exercice principal seulement en dernier recours.
  const main = list.filter((e) => !e.warm && !e.cool).slice(0, 2);
  const removable = (e) => !e.warm && !e.cool && !main.includes(e);
  const drop = (e) => { removed.unshift(e.name); list = list.filter((x) => x !== e); };
  [...list].reverse().filter(removable).forEach((e) => { if (over() && total(list.filter((x) => x !== e)) >= target - 300) drop(e); });
  [...list].reverse().filter(removable).forEach((e) => { if (over()) drop(e); });
  list = list.map((e) => (over() && main.includes(e) && adjustable(e) ? (fewer++, { ...e, sets: e.sets - 1 }) : e));
  const second = list.find((e) => !e.warm && !e.cool && e !== list.find((x) => !x.warm && !x.cool));
  if (over() && second) drop(second);
  const done = ['repos raccourcis', fewer ? `${fewer} série${fewer > 1 ? 's' : ''} en moins` : '', removed.length ? `${removed.join(', ')} ${removed.length > 1 ? 'retirés' : 'retiré'}` : ''].filter(Boolean);
  notes.unshift(`Séance ramenée à ${durationLabel(total())}${total() > target + 150 ? ' (au plus court)' : ''} : ${done.join(', ')}.`);
  return clean();
}

const PAIN_FALLBACK = { name: 'Mobilité douce et étirements', info: 'etirements', work: 900, timed: true, note: 'Bouge sans douleur, amplitude confortable.' };

export function buildSession(key, date, state, express = false, minutes = null) {
  const info = weekInfo(date, state.settings.startDate);
  const a = state.adapt;
  const variant = resolveKey(key, state, express);
  const t = TEMPLATES[variant];
  const type = t.type;
  const block = blockAt(seasonPlan(state), info.week);
  const f = info.mult * (block?.mult ?? 1) * (a[type] ?? 1);
  const bench = latestBench(state);
  const p = prescriptions(bench);
  const runs = state.settings.access?.course !== false;
  const ctx = { f, info, p, g: a.gradeIdx, run: runs, block: block?.phase ?? null, sets: (n) => clamp(Math.round(n * f), 1, n + 2) };
  const raw = t.build(ctx).filter(Boolean);
  const notes = raw.filter((e) => e.kind === 'note').map((e) => e.text);
  if (block?.goalWeek && type === 'escalade' && !t.reference) notes.unshift(`Semaine objectif : tu es frais, c'est le moment de tenter ton ${state.settings.goal.grade} !`);
  else if (block?.phase === 'performance' && type === 'escalade' && !t.home) notes.unshift('Bloc performance : commence par tes projets, quand tu es frais.');
  const day = ymd(date);
  let items = raw.filter((e) => e.kind !== 'note').map((e) => applySwap(e, state, day, t.home ? 'home' : 'gym', p));

  const pains = activePains(state, day);
  const zones = Object.keys(pains);
  if (zones.length) {
    const { kept, removed } = withoutPain(items, zones);
    items = kept.length ? kept : [PAIN_FALLBACK];
    const until = parseYmd(Object.values(pains).sort().at(-1)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const names = zones.map((z) => ZONES[z].toLowerCase()).join(', ');
    if (removed.length) notes.unshift(`Douleur signalée (${names}) : ${removed.join(', ')} ${removed.length > 1 ? 'retirés' : 'retiré'} jusqu'au ${until}. Si la douleur dure plus d'une semaine, consulte.`);
    if (zones.includes('doigts') && type === 'escalade' && !t.home) notes.unshift('Doigts douloureux : grimpe facile uniquement, sur grosses prises, sans réglettes.');
  }

  const form = formLevel(state, day);
  if (form && t.reference) {
    if (form === 'low') notes.unshift('Petite forme : si tu peux, fais les tests un autre jour pour des résultats fiables.');
  } else if (form && !t.mobility) {
    items = applyForm(items, form, { type, home: !!t.home, deload: info.phaseIndex === 3, notes });
  }

  items = items.map((e) => ({ sets: 1, ...e, restAfter: e.restAfter ?? t.restAfter ?? 90 }));
  const fullSeconds = sessionSeconds(items.map((e, i) => (i === items.length - 1 ? { ...e, restAfter: 0 } : e)));
  const fit = minutes && !express && !t.reference && !t.mobility ? Number(minutes) : null;
  if (fit) items = fitDuration(items, fit * 60, notes);

  // Carnet de charges : à la maison et en muscu, l'objectif suit tes dernières séances.
  const track = (t.home || type === 'muscu') && !t.reference && !t.mobility;
  const exercises = items.map((e, i) => {
    const x = { ...e };
    if (i === items.length - 1) x.restAfter = 0;
    x.lift = track ? liftPlan(x, state, day, { resetBefore: bench.date, hold: info.phaseIndex === 3 }) : null;
    if (x.load && x.lift?.target.kg != null) x.load = { ...x.load, kg: x.lift.target.kg };
    x.detail = describe(x);
    x.timer = timerFor(x);
    x.seconds = exerciseSeconds(x);
    return x;
  });
  const totalSeconds = sessionSeconds(exercises);
  return {
    key, variant, type, express, home: !!t.home, run: !!t.run, reference: !!t.reference, bonus: !!t.bonus, mobility: !!t.mobility, form, notes,
    title: typeof t.title === 'function' ? t.title(ctx) : t.title, duration: durationLabel(totalSeconds), totalSeconds, fullSeconds, minutes: fit, phase: info.phase, week: info.week, block, exercises,
  };
}

const minutes = (base, f) => Math.round((base * f) / 5) * 5;

// ---------- Prise de référence ----------
export const BENCH_TESTS = [
  { key: 'pushups', label: 'Pompes max', unit: 'répétitions' },
  { key: 'pullups', label: 'Tractions max', unit: 'répétitions' },
  { key: 'hang', label: 'Suspension max à la barre', unit: 'secondes' },
  { key: 'gripper', label: 'Pince : charge max fermée', unit: 'kg' },
  { key: 'plank', label: 'Planche max', unit: 'secondes' },
  { key: 'squat', label: 'Goblet squat 10 kg + gilet 8 kg', unit: 'répétitions' },
  { key: 'cooper', label: 'Course 12 min', unit: 'mètres', optional: true },
];
export const BENCH_EVERY_DAYS = 28;

// Dernier résultat connu de chaque test (un test sauté garde l'ancienne valeur).
export function latestBench(state) {
  const out = {};
  (state.benchmarks || []).forEach((b) => {
    BENCH_TESTS.forEach(({ key }) => { if (Number(b[key]) > 0) out[key] = Number(b[key]); });
    out.date = b.date;
  });
  return out;
}

export function benchDue(state, today = new Date()) {
  const last = (state.benchmarks || []).at(-1);
  if (!last) return { due: true, days: null };
  const days = Math.round((parseYmd(ymd(today)) - parseYmd(last.date)) / 86400000);
  return { due: days >= BENCH_EVERY_DAYS, days, inDays: BENCH_EVERY_DAYS - days };
}

const range = (max, lo, hi, min = 1) => `${Math.max(min, Math.round(max * lo))} à ${Math.max(min + 1, Math.round(max * hi))}`;
const pace = (kmh) => {
  const total = Math.round(3600 / kmh);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
// VMA estimée à partir du test de Cooper (VO2max = 22,351 × d − 11,288 ; VMA = VO2max / 3,5).
export const vmaFromCooper = (m) => Math.round(((22.351 * (m / 1000) - 11.288) / 3.5) * 10) / 10;

// Charges et répétitions déduites de la dernière prise de référence (valeurs par défaut sinon).
export function prescriptions(b = {}) {
  const pull = b.pullups;
  const push = b.pushups;
  const vma = b.cooper ? vmaFromCooper(b.cooper) : null;
  return {
    pullReps: pull ? range(pull, 0.5, 0.7, 2) : '5 à 8',
    weightedPull: pull ? pull >= 10 : null,
    vest: pull >= 16 ? 8 : pull >= 13 ? 6 : 4,
    circuitPull: pull ? Math.max(2, Math.round(pull * 0.45)) : 5,
    pushReps: push ? range(push, 0.55, 0.7, 5) : '12 à 15',
    weightedPush: push ? push >= 30 : null,
    vestPush: push >= 40 ? 8 : push >= 35 ? 6 : 4,
    circuitPush: push ? Math.max(5, Math.round(push * 0.4)) : 10,
    hang: b.hang ? clamp(Math.round((b.hang * 0.5) / 5) * 5, 10, 45) : 20,
    plank: b.plank ? clamp(Math.round((b.plank * 0.6) / 5) * 5, 20, 90) : 40,
    squatReps: b.squat ? clamp(Math.round(b.squat * 0.6), 8, 25) : 15,
    grip: b.gripper ? clamp(Math.round(b.gripper * 0.7), 5, 60) : null,
    gripEndurance: b.gripper ? clamp(Math.round(b.gripper * 0.45), 5, 60) : null,
    vma,
    easyPace: vma ? `${pace(vma * 0.7)} à ${pace(vma * 0.65)} min/km` : null,
    fastPace: vma ? `${pace(vma)} min/km, soit ${vma.toLocaleString('fr-FR')} km/h` : null,
  };
}

// Cardio quand la course est décochée : 5 mouvements en boucle, chaque intervalle porte son nom.
const CARDIO_MOVES = [
  { name: 'Jumping jacks', info: 'jumping-jacks' },
  { name: 'Shadow boxing', info: 'shadow-boxing' },
  { name: 'Mountain climbers', info: 'mountain-climbers' },
  { name: 'Fentes alternées', info: 'fentes-marchees' },
  { name: 'Burpees sans saut', info: 'burpees' },
];
const CARDIO_INFO = CARDIO_MOVES.map((m) => m.info);
const moves = (rounds) => Array.from({ length: rounds }, (_, i) => CARDIO_MOVES[i % CARDIO_MOVES.length].name);
// Cardio continu à la maison : intervalles 40/20, une minute par mouvement.
const homeCardio = (min) => {
  const rounds = Math.max(5, min);
  return {
    name: 'Cardio sans course', info: CARDIO_INFO, label: 'Cardio', inner: { work: 40, rest: 20, rounds }, innerLabels: moves(rounds),
    note: 'Les 5 mouvements en boucle, à un rythme où tu peux encore parler par phrases courtes.',
  };
};
const gymCardio = (min) => ({ name: 'Vélo, rameur ou elliptique', info: 'cardio-machine', work: min * 60, timed: true, note: 'En endurance : tu dois pouvoir parler.' });

const easyRun = (p) => (p.easyPace ? `En endurance, vers ${p.easyPace}.` : 'En endurance, en aisance respiratoire.');
const fastRun = (p) => (p.fastPace ? `Effort vers ${p.fastPace} (ta VMA), trot pendant les repos.` : 'Vite sur l\'effort, trot pendant les repos.');

// Ce que la dernière prise de référence change dans les séances.
export function benchSummary(state) {
  const b = latestBench(state);
  const p = prescriptions(b);
  const out = [];
  if (b.pullups) out.push(p.weightedPull ? `Tractions : séries de 3 à 5 lestées avec le gilet à ${p.vest} kg` : `Tractions : séries de ${p.pullReps}`);
  if (b.pushups) out.push(p.weightedPush ? `Pompes : séries de 12 à 15 avec le gilet à ${p.vestPush} kg` : `Pompes : séries de ${p.pushReps}`);
  if (b.hang) out.push(`Suspensions : ${p.hang} s`);
  if (b.gripper) out.push(`Pince : ${p.grip} kg en force, ${p.gripEndurance} kg en endurance`);
  if (b.plank) out.push(`Planche : ${p.plank} s`);
  if (b.squat) out.push(`Goblet squat : séries de ${p.squatReps}`);
  if (p.vma) out.push(`VMA estimée : ${p.vma.toLocaleString('fr-FR')} km/h, footing vers ${p.easyPace}`);
  return out;
}

export function referenceSession(date, state) {
  return { ...buildSession('reference', date, state), index: 'ref', day: null, slot: null, time: '', date: ymd(date) };
}

// Enregistre un résultat de test (saisi à la fin de chaque test de la séance guidée).
export function recordBench(state, date, key, value) {
  const list = state.benchmarks || [];
  const entry = { ...(list.find((b) => b.date === date) || { date }), [key]: value };
  state.benchmarks = [...list.filter((b) => b.date !== date), entry].sort((a, b) => a.date.localeCompare(b.date));
}

// Parcours abdos, à lancer quand on veut : version salle ou maison selon l'abonnement.
export function absSession(date, state) {
  return { ...buildSession('abdos', date, state, false, state.durations?.[`${ymd(date)}#abs`]), index: 'abs', day: null, slot: null, time: '', date: ymd(date) };
}

// Routine nuque et dos, quelques minutes les jours sans séance (ou en plus).
export function routineSession(date, state) {
  return { ...buildSession('nuque', date, state), index: 'nuque', day: null, slot: null, time: '', date: ymd(date) };
}

const TEMPLATES = {
  bloc: {
    type: 'escalade', title: 'Escalade bloc', restAfter: 120,
    build: ({ info, g, sets, block }) => {
      const easy = info.phaseIndex === 3 || block === 'affutage';
      const hard = block === 'force' || block === 'performance';
      return [
        MOBILITY,
        { name: 'Montée en température', info: 'grimpe-echauffement', work: 600, timed: true, note: `6 à 8 blocs faciles (niveau ~${grade(g - 3)}), grimpés lentement et proprement.` },
        block === 'endurance'
          ? { name: '4 × 4 en bloc', info: '4x4', sets: sets(3), reps: '4 blocs faciles enchaînés', work: 300, rest: 240, note: `Niveau ~${grade(g - 3)}, sans repos entre les 4 blocs.` }
          : { name: 'Blocs au niveau', info: 'bloc-niveau', sets: sets(block === 'base' ? 6 : hard ? 4 : 5), reps: '2 à 3 essais', work: 150, rest: 180, unit: 'blocs', note: `Un bloc différent à chaque fois, autour de ${grade(g - 1)}.` },
        easy
          ? { name: `Séance technique (${info.phaseIndex === 3 ? 'décharge' : 'affûtage'})`, info: 'technique-pieds', work: 900, timed: true, note: 'Pas de projet cette semaine : blocs faciles en cherchant le geste parfait, pieds silencieux.' }
          : { name: block === 'performance' ? 'Projets' : 'Projet', info: 'projet', sets: sets(hard ? 7 : block === 'base' ? 4 : 6), reps: '1 essai', work: 60, rest: 240, unit: 'essais', note: block === 'performance' ? `Tes projets (~${grade(g)} à ${grade(g + 1)}) : essais complets, 4 min de repos.` : `1 ou 2 blocs à ta limite (~${grade(g)}).` },
        info.week >= 5 && !easy
          ? { name: 'Poutre douce (salle d\'escalade)', info: 'poutre', label: 'Poutre', sets: sets(block === 'force' ? 6 : 5), inner: { work: 7, rest: 3, rounds: 6 }, rest: 120, note: 'Réglette 20 mm, prise tendue, pieds au sol si besoin. Effort 6/10 max.' }
          : info.week < 5 ? { kind: 'note', text: 'Pas de poutre avant la semaine 5 : on laisse tes poulies se réhabituer à la grimpe.' } : null,
        { name: 'Retour au calme', info: 'etirements-grimpe', work: 300, timed: true, note: 'Étirements doux des avant-bras et des doigts, nuque, dos.' },
      ];
    },
  },
  voie: {
    type: 'escalade', title: 'Escalade voie', restAfter: 120,
    build: ({ info, g, sets, block }) => {
      const easy = info.phaseIndex === 3 || block === 'affutage';
      const pyramid = [g - 2, g - 2, g - 1, g - 1, ...(easy ? [] : [g])].map((x) => grade(x));
      // Dernier bloc de la séance : selon le bloc de saison, sinon 4 × 4 en semaine d'intensification.
      const last = block === 'endurance' ? '4x4' : (block === 'force' || block === 'performance') && !easy ? 'projet' : block ? 'continuite' : info.phaseIndex === 2 ? '4x4' : 'continuite';
      return [
        MOBILITY,
        { name: 'Voies d\'échauffement', info: 'grimpe-echauffement', sets: 3, reps: 'voie facile', work: 240, rest: 90, unit: 'voies', note: `Niveau ~${grade(g - 3)}.` },
        { name: 'Pyramide', info: 'pyramide-voie', sets: pyramid.length, setLabels: pyramid, work: 300, rest: 240, unit: 'voies', note: 'Repère repos et clippages avant de partir.' },
        {
          '4x4': { name: 'Endurance : 4 × 4', info: '4x4', sets: sets(3), reps: '4 voies faciles enchaînées', work: 480, rest: 240, note: `Niveau ~${grade(g - 4)}, sans repos entre les 4 voies.` },
          projet: { name: 'Voie projet', info: 'projet', sets: sets(3), reps: '1 essai', work: 360, rest: 360, unit: 'essais', note: `Une voie à ta limite (~${grade(g)}), 6 min de repos complet entre les essais.` },
          continuite: { name: 'Continuité', info: 'continuite', sets: sets(3), reps: 'voie facile montée, désescaladée puis remontée', work: 420, rest: 300, note: `Niveau ~${grade(g - 3)}, sans toucher le sol.` },
        }[last],
        { name: 'Retour au calme', info: 'etirements-grimpe', work: 420, timed: true, note: 'Une voie très facile en souplesse, puis étirements avant-bras, nuque et dos.' },
      ];
    },
  },
  haut: {
    type: 'muscu', title: 'Muscu haut du corps et gainage', restAfter: 90,
    build: ({ sets, p }) => [
      WARMUP_GYM(420, '5 min de rameur ou de vélo, puis mobilité nuque et épaules.'),
      { name: 'Développé couché haltères', info: 'developpe-couche-halteres', sets: sets(3), reps: '8 à 12', load: GYM(2), work: 40, rest: 90 },
      { name: 'Rowing assis poulie, prise neutre', info: 'rowing-poulie', sets: sets(3), reps: '8 à 12', load: GYM(5), work: 40, rest: 90, note: 'Épaules basses.' },
      { name: 'Développé épaules haltères assis', info: 'developpe-epaules', sets: sets(3), reps: '8 à 12', load: GYM(2), work: 40, rest: 90 },
      { name: 'Pompes ou dips assistés (machine)', info: ['pompes', 'dips-machine'], sets: sets(3), reps: '8 à 12', work: 40, rest: 75 },
      { name: 'Face pull à la poulie', info: 'face-pull', sets: sets(3), reps: '15', load: GYM(2.5), work: 45, rest: 60, note: 'Léger. Excellent pour la nuque et les épaules de grimpeur.' },
      { name: 'Rotations externes', info: 'rotations-externes', sets: sets(2), reps: '15 par bras', work: 70, rest: 45, note: 'Poulie basse ou élastique, coude collé au corps.', restAfter: 60 },
      { name: 'Extensions des doigts (élastique)', info: 'extensions-doigts', sets: sets(2), reps: '20', work: 40, rest: 30, note: 'Antagonistes des fléchisseurs, protège les poulies.', restAfter: 60 },
      PLANK(sets(3), p.plank),
    ],
  },
  bas: {
    type: 'muscu', title: ({ run }) => `Muscu bas du corps et ${run ? 'course' : 'cardio'}`, restAfter: 90, run: true,
    build: ({ f, sets, p, run }) => [
      WARMUP_GYM(300, '5 min de vélo, squats au poids du corps, mobilité hanches et dos.'),
      { name: 'Presse à cuisses ou goblet squat', info: ['presse', 'goblet-squat'], sets: sets(3), reps: '8 à 12', load: GYM(5), work: 45, rest: 120 },
      { name: 'Soulevé de terre roumain haltères', info: 'souleve-roumain', sets: sets(3), reps: '8 à 12', load: GYM(2), work: 45, rest: 120, note: 'Dos neutre, charge modérée.' },
      { name: 'Fentes marchées', info: 'fentes-marchees', sets: sets(3), reps: '10 par jambe', load: GYM(2), work: 70, rest: 90 },
      { name: 'Hip thrust machine', info: 'hip-thrust', sets: sets(3), reps: '10 à 15', load: GYM(5), work: 45, rest: 90 },
      SIDE_PLANK_CIRCUIT(sets(3)),
      run ? { name: 'Course sur tapis', info: 'course-endurance', work: minutes(20, f) * 60, timed: true, note: easyRun(p) } : gymCardio(minutes(20, f)),
    ],
  },
  full: {
    type: 'muscu', title: ({ run }) => `Muscu corps complet et ${run ? 'course' : 'cardio'}`, restAfter: 90, run: true,
    build: ({ f, sets, p, run }) => [
      WARMUP_GYM(300, '5 min de rameur, mobilité nuque, épaules et hanches.'),
      { name: 'Goblet squat ou presse', info: ['goblet-squat', 'presse'], sets: sets(3), reps: '8 à 12', load: GYM(5), work: 45, rest: 120 },
      { name: 'Développé couché haltères', info: 'developpe-couche-halteres', sets: sets(3), reps: '8 à 12', load: GYM(2), work: 40, rest: 90 },
      { name: 'Soulevé de terre roumain haltères', info: 'souleve-roumain', sets: sets(3), reps: '8 à 12', load: GYM(2), work: 45, rest: 120, note: 'Dos neutre.' },
      { name: 'Développé épaules haltères', info: 'developpe-epaules', sets: sets(3), reps: '8 à 12', load: GYM(2), work: 40, rest: 90 },
      {
        name: 'Face pull et rotations externes', info: ['face-pull', 'rotations-externes'], sets: sets(3), rest: 60, note: 'Léger.',
        circuit: [
          { name: 'Face pull', label: '15 face pulls', work: 45, info: 'face-pull' },
          { name: 'Rotations externes', label: '15 rotations externes par bras', work: 70, info: 'rotations-externes' },
        ],
      },
      PLANK(sets(3), p.plank),
      run ? { name: 'Course sur tapis', info: 'course-endurance', work: minutes(15, f) * 60, timed: true, note: easyRun(p) } : gymCardio(minutes(15, f)),
    ],
  },
  fractionne: {
    type: 'cardio', title: 'Course fractionnée', restAfter: 60, run: true,
    build: ({ sets, p }) => [
      { name: 'Footing d\'échauffement', info: 'course-endurance', work: 900, timed: true, note: 'Très facile, puis 3 accélérations progressives.' },
      { name: '30/30', info: 'fractionne-30-30', label: '30/30', sets: sets(2), inner: { work: 30, rest: 30, rounds: sets(8) }, rest: 180, note: fastRun(p) },
      { name: 'Retour au calme', info: 'course-endurance', work: 600, timed: true, note: 'Footing lent, puis étirements mollets et ischios.' },
    ],
  },

  // ---------- À la maison : barre de traction, un haltère réglable 2 à 10 kg, gilet 4 à 8 kg, pince 5 à 60 kg ----------
  blocMaison: {
    type: 'escalade', title: 'Force grimpe à la maison', home: true, restAfter: 90,
    build: ({ info, sets, p, block }) => {
      const weighted = (p.weightedPull ?? info.week >= 5) && info.phaseIndex !== 3 && block !== 'affutage';
      const pulls = sets(block === 'force' ? 5 : 4);
      return [
        MOBILITY,
        {
          name: 'Activation à la barre', info: 'scap-pulls', sets: 2, rest: 30, restAfter: 60,
          circuit: [
            { name: 'Tirages d\'omoplates (scap pulls)', label: '10 tirages d\'omoplates bras tendus', work: 40, info: 'scap-pulls' },
            { name: 'Cercles de bras', label: '10 cercles de bras', work: 20 },
          ],
        },
        block === 'endurance'
          ? { name: 'Suspensions répétées', info: 'suspensions', label: 'Suspensions', sets: sets(4), inner: { work: 7, rest: 3, rounds: 6 }, rest: 120, note: 'À la barre, prise large et confortable, épaules engagées.' }
          : { name: 'Suspensions actives', info: 'suspensions', sets: sets(4), work: p.hang, timed: true, rest: 40, note: 'Épaules engagées. Prise large et confortable, pas du bout des doigts.' },
        weighted
          ? { name: 'Tractions lestées', info: 'tractions', sets: pulls, reps: '3 à 5', load: VEST(p.vest), work: 25, rest: 150, note: 'Amplitude complète, sans élan.' }
          : { name: 'Tractions', info: 'tractions', sets: pulls, reps: p.pullReps, work: 30, rest: 120, note: 'Amplitude complète, sans élan. Garde 1 à 2 répétitions en réserve.' },
        { name: 'Tractions négatives', info: 'tractions-negatives', sets: sets(3), reps: '3', work: 25, rest: 90, note: 'Descente en 5 secondes.' },
        block === 'endurance'
          ? { name: 'Pince endurance', info: 'pince', sets: sets(3), reps: '20 par main', load: GRIP(p.gripEndurance), work: 80, rest: 60, note: `${p.gripEndurance ? 'Rythme régulier.' : 'Pince légère : 20 fermetures doivent être faisables, rythme régulier.'}` }
          : { name: 'Pince de préhension', info: 'pince', sets: sets(3), reps: '8 à 10 par main', load: GRIP(p.grip), work: 60, rest: 90, note: `${p.grip ? '' : 'Règle la pince pour 8 à 10 fermetures difficiles mais propres. '}Stop à la moindre douleur dans un doigt.` },
        { name: 'Relevés de genoux suspendu', info: 'releves-genoux', sets: sets(3), reps: '8 à 10', work: 30, rest: 60, note: 'Sans balancer.' },
        { name: 'Pompes', info: 'pompes', sets: sets(3), reps: p.pushReps, work: 35, rest: 60, note: 'Antagonistes des tractions.' },
        { name: 'Oiseau un bras', info: 'oiseau', sets: sets(3), reps: '12 à 15 par bras', load: DB(3), work: 70, rest: 45, note: 'Main libre sur une chaise. Bon pour la nuque et le haut du dos.' },
        { name: 'Gainage creux (hollow)', info: 'hollow', sets: sets(3), work: 30, timed: true, rest: 30, note: 'Bas du dos plaqué au sol.', restAfter: 30 },
        { name: 'Retour au calme', info: 'etirements-grimpe', work: 300, timed: true, note: 'Étirements avant-bras, pectoraux, nuque et dos.' },
      ];
    },
  },
  voieMaison: {
    type: 'escalade', title: 'Endurance grimpe à la maison', home: true, restAfter: 90,
    build: ({ sets, p, block }) => [
      MOBILITY,
      {
        name: 'Circuit endurance', info: ['suspensions', 'tractions', 'pompes', 'planche'], sets: sets(block === 'endurance' ? 5 : 4), rest: 120, note: 'Enchaîne sans pause à l\'intérieur d\'un tour.',
        circuit: [
          { name: 'Suspension', label: `${p.hang + 10} s suspendu`, work: p.hang + 10, timed: true, info: 'suspensions' },
          { name: 'Tractions', label: `${p.circuitPull} tractions`, work: 20, info: 'tractions' },
          { name: 'Pompes', label: `${p.circuitPush} pompes`, work: 25, info: 'pompes' },
          { name: 'Planche', label: '30 s de planche', work: 30, timed: true, info: 'planche' },
        ],
      },
      { name: 'Pyramide de tractions', info: 'tractions', sets: 7, setLabels: ['1', '2', '3', '4', '3', '2', '1'].map((n) => `${n} traction${n === '1' ? '' : 's'}`), work: 15, rest: 30, unit: 'paliers', note: 'Repos = le temps passé à tirer. Arrête si les tractions deviennent moches.' },
      block === 'force'
        ? { name: 'Pince de préhension', info: 'pince', sets: sets(3), reps: '8 à 10 par main', load: GRIP(p.grip), work: 60, rest: 90, note: `${p.grip ? '' : 'Règle la pince pour 8 à 10 fermetures difficiles mais propres. '}Stop à la moindre douleur dans un doigt.` }
        : { name: 'Pince endurance', info: 'pince', sets: sets(3), reps: '20 par main', load: GRIP(p.gripEndurance), work: 80, rest: 60, note: `${p.gripEndurance ? 'Rythme régulier.' : 'Pince légère : 20 fermetures doivent être faisables, rythme régulier.'}` },
      { name: 'Superman', info: 'superman', sets: sets(3), reps: '12 lents', work: 40, rest: 45, note: 'Regard vers le sol pour protéger la nuque.' },
      { name: 'Extensions de poignets', info: 'extensions-poignets', sets: sets(2), reps: '15 à 20 par bras', load: DB(3), work: 60, rest: 30, note: 'Antagonistes des avant-bras.', restAfter: 30 },
      { name: 'Retour au calme', info: 'etirements-grimpe', work: 300, timed: true, note: 'Étirements avant-bras, épaules, nuque et dos.' },
    ],
  },
  hautMaison: {
    type: 'muscu', title: 'Haut du corps à la maison', home: true, restAfter: 90,
    build: ({ info, sets, p }) => [
      WARMUP_GYM(300, '2 min de jumping jacks, cercles de bras, 10 pompes inclinées sur une chaise.'),
      (p.weightedPush ?? info.week >= 5)
        ? { name: 'Pompes lestées', info: 'pompes', sets: sets(4), reps: '12 à 15', load: VEST(p.vestPush), work: 40, rest: 90, note: 'Descente en 2 secondes.' }
        : { name: 'Pompes', info: 'pompes', sets: sets(4), reps: p.pushReps, work: 40, rest: 90, note: 'Descente en 2 secondes.' },
      { name: 'Rowing haltère un bras', info: 'rowing-haltere', sets: sets(3), reps: '10 à 15 par bras', load: DB(10), work: 80, rest: 60, note: 'Pause d\'une seconde en haut.' },
      { name: 'Pompes piquées (épaules)', info: 'pompes-piquees', sets: sets(3), reps: '8 à 10', work: 35, rest: 90, note: 'Hanches hautes, tête vers le sol.' },
      { name: 'Développé épaules un bras', info: 'developpe-epaules', sets: sets(3), reps: '8 à 12 par bras', load: DB(6), work: 70, rest: 60, note: 'Debout et gainé.' },
      { name: 'Élévations latérales un bras', info: 'elevations-laterales', sets: sets(3), reps: '12 à 15 par bras', load: DB(3), work: 70, rest: 45, note: 'Lent, sans élan.', restAfter: 60 },
      { name: 'Oiseau un bras', info: 'oiseau', sets: sets(3), reps: '12 à 15 par bras', load: DB(3), work: 70, rest: 45, note: 'Main libre sur une chaise.', restAfter: 60 },
      { name: 'Pompes diamant (triceps)', info: 'pompes-diamant', sets: sets(2), reps: '8 à 12', work: 35, rest: 60, note: 'Mains rapprochées. Remplace les dips.', restAfter: 60 },
      { name: 'Curl un bras', info: 'curl', sets: sets(2), reps: '8 à 12 par bras', load: DB(7), work: 60, rest: 45, note: 'Tempo lent.', restAfter: 60 },
      PLANK(sets(3), p.plank),
    ],
  },
  basMaison: {
    type: 'muscu', title: ({ run }) => `Bas du corps à la maison et ${run ? 'course' : 'cardio'}`, home: true, run: true, restAfter: 90,
    build: ({ f, sets, p, run }) => [
      WARMUP_GYM(300, 'Squats au poids du corps, fentes, mobilité des hanches et du dos.'),
      { name: 'Goblet squat lesté', info: 'goblet-squat', sets: sets(4), reps: `${p.squatReps}`, work: 60, rest: 90, note: 'Haltère 10 kg et gilet 8 kg, descente en 3 secondes pour compenser la charge légère.' },
      { name: 'Fentes bulgares', info: 'fentes-bulgares', sets: sets(3), reps: '10 par jambe', work: 90, rest: 90, note: 'Pied arrière sur une chaise, gilet 8 kg.' },
      { name: 'Soulevé de terre roumain sur une jambe', info: 'souleve-roumain-unilateral', sets: sets(3), reps: '10 à 12 par jambe', load: DB(10), work: 90, rest: 60, note: 'Haltère dans la main opposée à la jambe d\'appui, dos neutre.' },
      { name: 'Hip thrust au sol lesté', info: 'hip-thrust', sets: sets(3), reps: '15', work: 45, rest: 60, note: 'Gilet 8 kg et haltère 10 kg sur les hanches.', restAfter: 60 },
      { name: 'Mollets sur une marche', info: 'mollets', sets: sets(3), reps: '20', work: 45, rest: 45, note: 'Sur une jambe si c\'est trop facile.', restAfter: 60 },
      SIDE_PLANK_CIRCUIT(sets(3)),
      run ? { name: 'Course dehors', info: 'course-endurance', work: minutes(20, f) * 60, timed: true, note: easyRun(p) } : homeCardio(minutes(20, f)),
    ],
  },
  fullMaison: {
    type: 'muscu', title: ({ run }) => `Corps complet à la maison et ${run ? 'course' : 'cardio'}`, home: true, run: true, restAfter: 90,
    build: ({ f, sets, p, run }) => [
      WARMUP_GYM(300, 'Jumping jacks, mobilité nuque, épaules et hanches.'),
      { name: 'Goblet squat lesté', info: 'goblet-squat', sets: sets(3), reps: `${p.squatReps}`, work: 60, rest: 90, note: 'Haltère 10 kg et gilet 8 kg.' },
      { name: 'Pompes', info: 'pompes', sets: sets(3), reps: p.pushReps, work: 40, rest: 75 },
      { name: 'Rowing haltère un bras', info: 'rowing-haltere', sets: sets(3), reps: '10 à 15 par bras', load: DB(10), work: 80, rest: 60 },
      { name: 'Fentes bulgares', info: 'fentes-bulgares', sets: sets(3), reps: '10 par jambe', work: 90, rest: 90, note: 'Gilet 8 kg.' },
      { name: 'Développé épaules un bras', info: 'developpe-epaules', sets: sets(3), reps: '8 à 12 par bras', load: DB(6), work: 70, rest: 60 },
      { name: 'Oiseau un bras', info: 'oiseau', sets: sets(3), reps: '12 à 15 par bras', load: DB(3), work: 70, rest: 45, restAfter: 60 },
      PLANK(sets(3), p.plank),
      run ? { name: 'Course dehors', info: 'course-endurance', work: minutes(15, f) * 60, timed: true, note: easyRun(p) } : homeCardio(minutes(15, f)),
    ],
  },

  // ---------- Express : 20 à 30 min, à la maison ----------
  expressGrimpe: {
    type: 'escalade', title: 'Express grimpe à la maison', home: true, restAfter: 30,
    build: ({ sets, p }) => [
      { ...MOBILITY, name: 'Mobilité express', note: 'Nuque, épaules, poignets, chat-vache.' },
      {
        name: 'Circuit barre', info: ['tractions', 'suspensions', 'pompes', 'hollow'], sets: clamp(sets(5), 4, 6), rest: 75,
        circuit: [
          { name: 'Tractions', label: `${p.circuitPull} tractions`, work: 30, info: 'tractions' },
          { name: 'Suspension', label: `${p.hang} s suspendu`, work: p.hang, timed: true, info: 'suspensions' },
          { name: 'Pompes', label: `${p.circuitPush} pompes`, work: 25, info: 'pompes' },
          { name: 'Gainage creux', label: '30 s de gainage creux', work: 30, timed: true, info: 'hollow' },
        ],
      },
      { name: 'Étirements', info: 'etirements-grimpe', work: 240, timed: true, note: 'Avant-bras, pectoraux, nuque.' },
    ],
  },
  expressRenfo: {
    type: 'muscu', title: 'Express renfo à la maison', home: true, restAfter: 30,
    build: ({ p }) => [
      WARMUP_GYM(180, 'Jumping jacks, cercles de bras, squats au poids du corps.'),
      {
        name: 'EMOM 20 min', info: ['pompes', 'goblet-squat', 'rowing-haltere', 'fentes-marchees', 'planche'], sets: 4, rest: 0,
        note: 'Chaque minute, fais l\'exercice puis récupère jusqu\'à la minute suivante.',
        circuit: [
          { name: 'Pompes', label: `${p.circuitPush} pompes`, work: 60, timed: true, info: 'pompes' },
          { name: 'Goblet squat', label: `${Math.min(p.squatReps, 20)} goblet squats (10 kg)`, work: 60, timed: true, info: 'goblet-squat' },
          { name: 'Rowing haltère', label: '10 rowings haltère par bras', work: 60, timed: true, info: 'rowing-haltere' },
          { name: 'Fentes', label: '10 fentes par jambe', work: 60, timed: true, info: 'fentes-marchees' },
          { name: 'Planche', label: `${Math.min(p.plank, 45)} s de planche`, work: 60, timed: true, info: 'planche' },
        ],
      },
      { name: 'Étirements', info: 'etirements', work: 120, timed: true, note: 'Hanches, pectoraux, nuque.' },
    ],
  },
  expressCourse: {
    type: 'cardio', title: 'Course express', run: true, restAfter: 0,
    build: ({ p }) => [
      { name: 'Footing d\'échauffement', info: 'course-endurance', work: 420, timed: true, note: 'Très facile.' },
      { name: '30/30', info: 'fractionne-30-30', label: '30/30', inner: { work: 30, rest: 30, rounds: 10 }, note: `${fastRun(p)} Pas le temps de sortir ? Remplace par des montées de genoux sur place.` },
      { name: 'Retour au calme', info: 'course-endurance', work: 300, timed: true, note: 'Marche ou footing lent.' },
    ],
  },

  // ---------- Cardio sans course (case « Je peux courir » décochée) ----------
  fractionneVelo: {
    type: 'cardio', title: 'Fractionné vélo ou rameur', restAfter: 60, run: true,
    build: ({ sets }) => [
      { name: 'Échauffement vélo ou rameur', info: 'cardio-machine', work: 600, timed: true, note: 'Facile, puis 3 accélérations de 15 s.' },
      { name: '30/30 sur vélo ou rameur', info: 'cardio-machine', label: '30/30', sets: sets(2), inner: { work: 30, rest: 30, rounds: sets(8) }, rest: 180, note: 'Fort sur l\'effort, tranquille pendant la récupération, sans t\'arrêter.' },
      { name: 'Retour au calme', info: 'cardio-machine', work: 420, timed: true, note: 'Pédale ou rame lentement, puis étirements mollets, cuisses et dos.' },
    ],
  },
  cardioMaison: {
    type: 'cardio', title: 'Cardio fractionné à la maison', home: true, restAfter: 60, run: true,
    build: ({ sets, f }) => {
      const rounds = sets(8);
      return [
        WARMUP_GYM(300, 'Marche sur place, cercles de bras, squats lents, jumping jacks légers.'),
        { name: 'Circuit cardio 30/30', info: CARDIO_INFO, label: 'Circuit cardio', sets: sets(2), inner: { work: 30, rest: 30, rounds }, innerLabels: moves(rounds), rest: 120, note: 'Effort fort sur 30 s, récupération en marchant sur place.' },
        homeCardio(minutes(10, f)),
        { name: 'Retour au calme', info: 'etirements', work: 300, timed: true, note: 'Marche lente, puis étirements mollets, cuisses et hanches.' },
      ];
    },
  },
  expressCardio: {
    type: 'cardio', title: 'Cardio express à la maison', home: true, run: true, restAfter: 30,
    build: () => [
      WARMUP_GYM(180, 'Marche sur place, cercles de bras, jumping jacks légers.'),
      { name: 'Circuit cardio 30/30', info: CARDIO_INFO, label: 'Circuit cardio', inner: { work: 30, rest: 30, rounds: 16 }, innerLabels: moves(16), note: 'Effort fort sur 30 s, récupération en marchant sur place.' },
      { name: 'Étirements', info: 'etirements', work: 180, timed: true, note: 'Mollets, cuisses, hanches.' },
    ],
  },

  // ---------- Parcours abdos : en plus du programme, quand tu veux ----------
  abdos: {
    type: 'muscu', title: 'Parcours abdos en salle', bonus: true, restAfter: 60,
    build: ({ sets, p }) => [
      WARMUP_GYM(180, 'Chat-vache, bascules du bassin, 10 dead bugs lents.'),
      {
        name: 'Bloc 1 : grand droit', info: ['crunch-poulie', 'chaise-romaine', 'hollow'], sets: sets(3), rest: 60,
        circuit: [
          { name: 'Crunch à la poulie haute', label: '12 à 15 crunchs à la poulie', work: 45, info: 'crunch-poulie' },
          { name: 'Relevés de jambes à la chaise romaine', label: '10 à 12 relevés de jambes', work: 40, info: 'chaise-romaine' },
          { name: 'Gainage creux (hollow)', label: '30 s de gainage creux', work: 30, timed: true, info: 'hollow' },
        ],
      },
      {
        name: 'Bloc 2 : obliques', info: ['bucheron-poulie', 'pallof', 'gainage-lateral'], sets: sets(3), rest: 60,
        circuit: [
          { name: 'Bûcheron à la poulie', label: '12 bûcherons par côté', work: 70, info: 'bucheron-poulie' },
          { name: 'Pallof press', label: '10 pallof press par côté', work: 60, info: 'pallof' },
          { name: 'Gainage latéral gauche', label: '30 s de gainage latéral de chaque côté', work: 30, timed: true, info: 'gainage-lateral' },
          { name: 'Gainage latéral droit', work: 30, timed: true, info: 'gainage-lateral' },
        ],
      },
      {
        name: 'Bloc 3 : gainage profond et lombaires', info: ['roue-abdos', 'extensions-lombaires', 'planche'], sets: sets(3), rest: 45,
        circuit: [
          { name: 'Roue abdominale', label: '8 à 10 roulés à genoux', work: 40, info: 'roue-abdos' },
          { name: 'Extensions lombaires', label: '12 extensions lombaires au banc', work: 40, info: 'extensions-lombaires' },
          { name: 'Planche', label: `${Math.min(p.plank, 60)} s de planche`, work: Math.min(p.plank, 60), timed: true, info: 'planche' },
        ],
      },
      { name: 'Étirements', info: 'etirements', work: 180, timed: true, note: 'Cobra doux, posture de l\'enfant, rotation couchée de chaque côté.' },
    ],
  },
  abdosMaison: {
    type: 'muscu', title: 'Parcours abdos à la maison', home: true, bonus: true, restAfter: 60,
    build: ({ sets, p }) => [
      WARMUP_GYM(180, 'Chat-vache, bascules du bassin, 10 dead bugs lents.'),
      {
        name: 'Bloc 1 : grand droit', info: ['crunch-inverse', 'releves-genoux', 'hollow'], sets: sets(3), rest: 60,
        circuit: [
          { name: 'Crunch inversé', label: '12 à 15 crunchs inversés', work: 40, info: 'crunch-inverse' },
          { name: 'Relevés de genoux suspendu', label: '8 à 10 relevés de genoux à la barre', work: 35, info: 'releves-genoux' },
          { name: 'Gainage creux (hollow)', label: '30 s de gainage creux', work: 30, timed: true, info: 'hollow' },
        ],
      },
      {
        name: 'Bloc 2 : obliques', info: ['russian-twist', 'gainage-lateral'], sets: sets(3), rest: 60,
        circuit: [
          { name: 'Russian twist', label: '16 à 20 rotations avec l\'haltère à 4 ou 5 kg', work: 40, info: 'russian-twist' },
          { name: 'Gainage latéral gauche', label: '30 s de gainage latéral de chaque côté', work: 30, timed: true, info: 'gainage-lateral' },
          { name: 'Gainage latéral droit', work: 30, timed: true, info: 'gainage-lateral' },
        ],
      },
      {
        name: 'Bloc 3 : gainage profond et lombaires', info: ['dead-bug', 'planche', 'superman'], sets: sets(3), rest: 45,
        circuit: [
          { name: 'Dead bug', label: '10 dead bugs lents', work: 45, info: 'dead-bug' },
          { name: 'Planche', label: `${Math.min(p.plank, 60)} s de planche`, work: Math.min(p.plank, 60), timed: true, info: 'planche' },
          { name: 'Superman', label: '12 supermans lents', work: 40, info: 'superman' },
        ],
      },
      { name: 'Finisher : mountain climbers', info: 'mountain-climbers', label: 'Mountain climbers', inner: { work: 30, rest: 30, rounds: sets(4) }, note: 'Rythme soutenu, hanches basses.', restAfter: 30 },
      { name: 'Étirements', info: 'etirements', work: 180, timed: true, note: 'Cobra doux, posture de l\'enfant, rotation couchée de chaque côté.' },
    ],
  },

  // ---------- Routine nuque et dos : prévention, sans compter dans le programme ----------
  nuque: {
    type: 'muscu', title: 'Routine nuque et dos', home: true, bonus: true, mobility: true, restAfter: 5,
    build: () => [
      {
        name: 'Mobilité douce de la nuque', info: 'mobilite', label: 'Nuque', inner: { work: 20, rest: 5, rounds: 4 },
        innerLabels: ['Inclinaison à gauche', 'Inclinaison à droite', 'Rotation douce à gauche', 'Rotation douce à droite'], note: 'Lent, dans une zone sans douleur.',
      },
      { name: 'Rentrées de menton', info: 'menton-rentre', reps: '10, tenue 3 s', work: 40, note: 'Dos et tête contre un mur, regard droit devant.' },
      {
        name: 'Chat-vache et livre ouvert', info: ['mobilite', 'open-book'], label: 'Dos', inner: { work: 25, rest: 5, rounds: 3 },
        innerLabels: ['Chat-vache', 'Livre ouvert à gauche', 'Livre ouvert à droite'],
      },
      { name: 'Anges au mur', info: 'wall-angels', reps: '10 lents', work: 45, note: 'Bas du dos, nuque et bras collés au mur.' },
      { name: 'Rotations externes couché sur le côté', info: 'rotations-externes', reps: '12 par bras', work: 60, note: 'Haltère à 2 kg, coude collé au flanc.' },
      { name: 'Extensions de poignets', info: 'extensions-poignets', reps: '15 par bras', work: 45, note: 'Haltère à 2 ou 3 kg : protège les coudes du grimpeur.' },
      {
        name: 'Étirements pectoraux et posture de l\'enfant', info: 'etirement-pectoraux', label: 'Étirements', inner: { work: 25, rest: 5, rounds: 3 },
        innerLabels: ['Pectoral gauche au cadre de porte', 'Pectoral droit au cadre de porte', 'Posture de l\'enfant, respiration lente'],
      },
    ],
  },

  // ---------- Prise de référence : à refaire toutes les 4 semaines ----------
  reference: {
    type: 'muscu', title: 'Prise de référence', home: true, reference: true, restAfter: 180,
    build: ({ run }) => [
      MOBILITY,
      { ...WARMUP_GYM(300, 'Jumping jacks, 10 pompes faciles, 3 tractions faciles, quelques fermetures de pince légères.'), restAfter: 60 },
      { name: 'Test : pompes max', info: 'pompes', test: 'pushups', countUp: true, work: 60, note: 'Le plus possible sans pause, poitrine près du sol, corps gainé. Arrête quand la technique casse.' },
      { name: 'Test : tractions max', info: 'tractions', test: 'pullups', countUp: true, work: 60, note: 'Strictes : bras tendus en bas, menton au-dessus de la barre, sans élan.' },
      { name: 'Test : suspension max', info: 'suspensions', test: 'hang', countUp: true, work: 60, note: 'Paume entière sur la barre, épaules engagées. Note le temps tenu.' },
      { name: 'Test : pince', info: 'pince', test: 'gripper', countUp: true, work: 300, restAfter: 120, note: 'Monte par paliers de 5 kg (une fermeture complète par palier, 1 min de repos entre les paliers). Note la charge max fermée proprement. Stop à la moindre douleur dans un doigt.' },
      { name: 'Test : planche max', info: 'planche', test: 'plank', countUp: true, work: 90, restAfter: 120, note: 'Tiens tant que le dos reste droit.' },
      { name: 'Test : goblet squat', info: 'goblet-squat', test: 'squat', countUp: true, work: 75, note: 'Haltère 10 kg et gilet 8 kg. Répétitions max avec une technique propre.' },
      run && { name: 'Test : course 12 min (optionnel)', info: 'test-cooper', test: 'cooper', work: 720, timed: true, note: 'La plus grande distance possible en 12 min sur terrain plat. Peut se faire un autre jour.' },
    ],
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES);

// Ajuste les indices après une séance. Renvoie les messages à afficher.
export function adapt(state, log) {
  const a = state.adapt;
  const msgs = [];
  if (log.mobility) return msgs; // la routine nuque-dos ne change pas le volume du programme
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
