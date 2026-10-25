// Séance guidée : un seul chrono qui enchaîne décompte, séries, repos et
// exercices suivants. Les étapes chronométrées passent seules ; les séries
// comptées (répétitions) affichent un temps estimé et attendent « Fait ».
import { fmtDuration } from './program.js';
import { signal, unlockAudio } from './timer.js';

export const PREP_SECONDS = 10;

export function buildSteps(session) {
  const steps = [];
  const exs = session.exercises;
  exs.forEach((e, i) => {
    for (let s = 1; s <= e.sets; s++) {
      const setTag = e.setLabels
        ? `${e.setLabels[s - 1]} · ${s}/${e.sets}`
        : e.sets > 1 ? `${e.circuit ? 'Tour' : 'Série'} ${s}/${e.sets}` : '';
      if (e.circuit) {
        e.circuit.forEach((c) => steps.push({
          kind: 'work', title: c.name, sub: [setTag, c.label].filter(Boolean).join(' · '), dur: c.work, timed: !!c.timed, ex: i, info: c.info || e.info,
        }));
      } else if (e.inner) {
        for (let r = 1; r <= e.inner.rounds; r++) {
          const named = e.innerLabels?.[r - 1];
          steps.push({
            kind: 'work', title: named || e.name, sub: [named ? e.name : '', setTag, `${r}/${e.inner.rounds}`].filter(Boolean).join(' · '), dur: e.inner.work, timed: true, ex: i, info: e.info,
          });
          if (r < e.inner.rounds && e.inner.rest) steps.push({ kind: 'rest', title: 'Repos', sub: e.name, dur: e.inner.rest, timed: true, ex: i });
        }
      } else {
        steps.push({
          kind: 'work', title: e.name, sub: [setTag, e.setLabels ? '' : e.reps].filter(Boolean).join(' · '), dur: e.work, timed: !!e.timed, countUp: !!e.countUp, ex: i, info: e.info,
        });
      }
      if (s < e.sets && e.rest) {
        steps.push({ kind: 'rest', title: 'Repos', sub: `${e.name} · avant ${e.circuit ? 'le tour' : 'la série'} ${s + 1}/${e.sets}`, dur: e.rest, timed: true, ex: i });
      }
    }
    if (i < exs.length - 1 && e.restAfter) {
      steps.push({ kind: 'rest', title: 'Repos', sub: `Prochain exercice : ${exs[i + 1].name}`, dur: e.restAfter, timed: true, ex: i, transition: true });
    }
  });
  steps.unshift({ kind: 'prep', title: exs[0].name, sub: exs[0].detail, dur: PREP_SECONDS, timed: true, ex: 0, info: exs[0].info });
  return steps;
}

// Texte « Ensuite » : la prochaine étape d'effort, précédée du repos s'il y en a un.
export function nextLabel(steps, k) {
  const j = steps.findIndex((s, i) => i > k && s.kind === 'work');
  if (j < 0) return k < steps.length - 1 ? `Repos ${fmtDuration(steps[k + 1].dur)}, puis fin de la séance` : 'Fin de la séance';
  const work = `${steps[j].title}${steps[j].sub ? ` · ${steps[j].sub}` : ''}`;
  const rest = steps.slice(k + 1, j).reduce((t, s) => t + s.dur, 0);
  return rest && steps[k].kind !== 'rest' ? `Repos ${fmtDuration(rest)}, puis ${work}` : work;
}

export class GuidedRunner {
  constructor(session, onTick, opts) {
    this.session = session;
    this.steps = buildSteps(session);
    this.onTick = onTick;
    this.opts = opts; // { sound, vibrate, onExerciseDone(i), onFinish() }
    this.lastWork = {};
    this.steps.forEach((s, i) => { if (s.kind === 'work') this.lastWork[s.ex] = i; });
    this.totalMs = this.steps.reduce((t, s) => t + s.dur * 1000, 0);
    this.index = 0;
    this.elapsedBefore = 0;
    this.startedAt = null;
    this.done = false;
    this.lastCount = null;
  }

  get running() { return this.startedAt !== null; }

  stepElapsed() {
    return this.elapsedBefore + (this.running ? Date.now() - this.startedAt : 0);
  }

  start() {
    if (this.running || this.done) return;
    unlockAudio();
    this.startedAt = Date.now();
    this.loop = setInterval(() => this.tick(), 200);
    this.tick();
  }

  pause() {
    if (!this.running) return;
    this.elapsedBefore = this.stepElapsed();
    this.startedAt = null;
    clearInterval(this.loop);
    this.tick();
  }

  stop() {
    clearInterval(this.loop);
    this.startedAt = null;
  }

  // Passe à l'étape i en gardant le temps déjà écoulé au-delà de l'étape précédente.
  enter(i, carry = 0) {
    const leaving = this.index;
    if (i > leaving && this.lastWork[this.steps[leaving].ex] === leaving) this.opts.onExerciseDone(this.steps[leaving].ex);
    this.index = i;
    this.elapsedBefore = carry;
    if (this.running) this.startedAt = Date.now();
    this.lastCount = null;
    this.overtimeSignaled = false;
  }

  next() {
    if (this.done) return;
    if (this.index >= this.steps.length - 1) return this.finish();
    this.enter(this.index + 1);
    this.signalStep();
    this.tick();
  }

  prev() {
    if (this.done) return;
    if (this.stepElapsed() > 3000 || this.index === 0) this.enter(this.index);
    else this.enter(this.index - 1);
    this.tick();
  }

  finish() {
    if (this.lastWork[this.steps[this.index].ex] === this.index) this.opts.onExerciseDone(this.steps[this.index].ex);
    this.done = true;
    this.stop();
    signal('end', this.opts);
    this.opts.onFinish();
    this.tick();
  }

  signalStep() {
    const k = this.steps[this.index].kind;
    if (k !== 'prep') signal(k === 'work' ? 'work' : 'rest', this.opts);
  }

  remainingMs() {
    const cur = Math.max(0, this.steps[this.index].dur * 1000 - this.stepElapsed());
    return cur + this.steps.slice(this.index + 1).reduce((t, s) => t + s.dur * 1000, 0);
  }

  tick() {
    if (this.done) {
      this.onTick({ done: true, running: false, remainingTotal: 0, progress: 1 });
      return;
    }
    // Avance automatiquement sur les étapes chronométrées terminées (même après une mise en veille).
    let advanced = false;
    while (this.running) {
      const st = this.steps[this.index];
      const over = this.stepElapsed() - st.dur * 1000;
      if (!st.timed || over < 0) break;
      if (this.index >= this.steps.length - 1) { this.finish(); return; }
      this.enter(this.index + 1, over);
      advanced = true;
    }
    if (advanced) this.signalStep();

    const st = this.steps[this.index];
    const remaining = st.dur * 1000 - this.stepElapsed();
    const sec = Math.ceil(remaining / 1000);
    if (this.running && st.timed && sec >= 1 && sec <= 3 && this.lastCount !== sec) {
      this.lastCount = sec;
      signal('count', this.opts);
    }
    if (this.running && !st.timed && !st.countUp && remaining <= 0 && !this.overtimeSignaled) {
      this.overtimeSignaled = true;
      signal('count', this.opts);
    }
    const remainingTotal = this.remainingMs();
    this.onTick({
      step: st,
      index: this.index,
      count: this.steps.length,
      remaining,
      remainingTotal,
      progress: 1 - remainingTotal / this.totalMs,
      next: nextLabel(this.steps, this.index),
      running: this.running,
      done: false,
    });
  }
}
