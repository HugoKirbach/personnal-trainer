// Chrono, minuteur et intervalles. Le temps est calculé à partir d'horodatages
// pour rester juste même si le navigateur ralentit l'onglet.

let audioCtx;
function beep(freq = 880, ms = 150, when = 0) {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = freq;
    o.connect(g).connect(audioCtx.destination);
    const t = audioCtx.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.start(t);
    o.stop(t + ms / 1000 + 0.05);
  } catch { /* son indisponible */ }
}

export function unlockAudio() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* son indisponible */ }
}

// Transforme une configuration en liste de phases { label, kind, dur }.
export function buildPhases(cfg) {
  if (cfg.mode === 'countdown') return [{ label: cfg.label || 'Minuteur', kind: 'rest', dur: cfg.seconds }];
  if (cfg.mode !== 'interval') return [];
  const phases = [{ label: 'Prépare-toi', kind: 'prep', dur: 5 }];
  const sets = cfg.sets || 1;
  for (let s = 1; s <= sets; s++) {
    for (let r = 1; r <= cfg.rounds; r++) {
      const tag = `${sets > 1 ? `Série ${s}/${sets} · ` : ''}${r}/${cfg.rounds}`;
      phases.push({ label: `Effort · ${tag}`, kind: 'work', dur: cfg.work });
      const last = r === cfg.rounds;
      if (!last && cfg.rest > 0) phases.push({ label: `Repos · ${tag}`, kind: 'rest', dur: cfg.rest });
    }
    if (s < sets && cfg.setRest) phases.push({ label: `Repos entre séries · ${s}/${sets}`, kind: 'rest', dur: cfg.setRest });
  }
  return phases;
}

export class Timer {
  constructor(onTick, opts) {
    this.onTick = onTick;
    this.opts = opts; // { sound: () => bool, vibrate: () => bool, onDone: (label) => void }
    this.reset({ mode: 'stopwatch' });
  }

  reset(cfg) {
    this.stopLoop();
    this.cfg = cfg;
    this.phases = buildPhases(cfg);
    this.index = 0;
    this.elapsedBefore = 0; // ms accumulés avant la dernière reprise
    this.startedAt = null;
    this.laps = [];
    this.lastBeepSec = null;
    this.done = false;
    this.tick();
  }

  get running() { return this.startedAt !== null; }

  elapsed() {
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
    this.elapsedBefore = this.elapsed();
    this.startedAt = null;
    this.stopLoop();
    this.tick();
  }

  stopLoop() {
    clearInterval(this.loop);
    this.loop = null;
  }

  lap() {
    if (this.cfg.mode === 'stopwatch' && this.running) this.laps.unshift(this.elapsed());
    this.tick();
  }

  skip() {
    if (!this.phases.length || this.done) return;
    const before = this.phases.slice(0, this.index + 1).reduce((s, p) => s + p.dur * 1000, 0);
    this.elapsedBefore += before - this.elapsed();
    this.tick();
  }

  signal(kind) {
    if (this.opts.sound()) {
      if (kind === 'count') beep(660, 120);
      else if (kind === 'work') { beep(990, 250); }
      else if (kind === 'end') { beep(880, 200); beep(880, 200, 0.3); beep(1180, 450, 0.6); }
      else beep(520, 300);
    }
    if (this.opts.vibrate() && navigator.vibrate) {
      navigator.vibrate(kind === 'count' ? 80 : kind === 'end' ? [300, 150, 300, 150, 600] : [250, 100, 250]);
    }
  }

  tick() {
    const ms = this.elapsed();
    if (this.cfg.mode === 'stopwatch') {
      this.onTick({ mode: 'stopwatch', display: ms, label: 'Chrono', laps: this.laps, running: this.running, progress: null });
      return;
    }
    // Retrouve la phase courante à partir du temps écoulé.
    let acc = 0;
    let idx = 0;
    while (idx < this.phases.length && acc + this.phases[idx].dur * 1000 <= ms) {
      acc += this.phases[idx].dur * 1000;
      idx++;
    }
    if (idx >= this.phases.length) {
      if (!this.done) {
        this.done = true;
        this.elapsedBefore = acc;
        this.startedAt = null;
        this.stopLoop();
        this.signal('end');
        this.opts.onDone(this.cfg.label || 'Minuteur');
      }
      this.onTick({ mode: this.cfg.mode, display: 0, label: 'Terminé', kind: 'done', running: false, progress: 1, next: null });
      return;
    }
    if (idx !== this.index && this.running) {
      this.signal(this.phases[idx].kind === 'work' ? 'work' : 'rest');
    }
    this.index = idx;
    const phase = this.phases[idx];
    const remaining = phase.dur * 1000 - (ms - acc);
    const sec = Math.ceil(remaining / 1000);
    if (this.running && sec <= 3 && sec >= 1 && this.lastBeepSec !== `${idx}-${sec}`) {
      this.lastBeepSec = `${idx}-${sec}`;
      this.signal('count');
    }
    this.onTick({
      mode: this.cfg.mode,
      display: remaining,
      label: phase.label,
      kind: phase.kind,
      running: this.running,
      progress: 1 - remaining / (phase.dur * 1000),
      next: this.phases[idx + 1]?.label ?? null,
    });
  }
}

export function fmt(ms, tenths = false) {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const base = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return tenths ? `${base}.${Math.floor((total % 1000) / 100)}` : base;
}

export const PRESETS = [
  { label: 'Repos 1 min', cfg: { mode: 'countdown', seconds: 60, label: 'Repos 1 min' } },
  { label: 'Repos 1 min 30', cfg: { mode: 'countdown', seconds: 90, label: 'Repos 1 min 30' } },
  { label: 'Repos 2 min', cfg: { mode: 'countdown', seconds: 120, label: 'Repos 2 min' } },
  { label: 'Repos 3 min', cfg: { mode: 'countdown', seconds: 180, label: 'Repos 3 min' } },
  { label: 'Repos 5 min', cfg: { mode: 'countdown', seconds: 300, label: 'Repos 5 min' } },
  { label: 'Poutre 7/3 × 6', cfg: { mode: 'interval', work: 7, rest: 3, rounds: 6, sets: 4, setRest: 120, label: 'Poutre' } },
  { label: 'Tabata 20/10 × 8', cfg: { mode: 'interval', work: 20, rest: 10, rounds: 8, label: 'Tabata' } },
  { label: 'Course 30/30 × 10', cfg: { mode: 'interval', work: 30, rest: 30, rounds: 10, label: '30/30' } },
  { label: 'Gainage 40/20 × 3', cfg: { mode: 'interval', work: 40, rest: 20, rounds: 3, label: 'Gainage' } },
];
