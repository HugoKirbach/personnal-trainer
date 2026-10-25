import {
  BENCH_TESTS, DAYS, FORM_LABELS, FORM_QUESTIONS, GRADES, TYPES, SCHEDULES, ZONES, absSession, activePains, adapt, addPains, benchDue, benchSummary,
  buildSession, fmtDuration, formLevel, healPain, mondayOf, parseYmd, recordBench, referenceSession, routineSession, sessionsOn, setForm, setSlot, tipFor,
  weekInfo, weekSessions, ymd,
} from './program.js';
import {
  load, save, defaults, normalize, onSave,
} from './store.js';
import {
  cloudStatus, initCloud, listBackups, onCloud, resetPassword, restoreBackup, signInEmail, signInGoogle, signOutCloud, signUpEmail,
  startCloud, stateSaved, sync,
} from './cloud.js';
import { Timer, PRESETS, fmt, unlockAudio } from './timer.js';
import {
  CLIMB_STYLES, weeklyBars, feelingDots, gradeLine, climbChart, climbPyramid, bindTooltips,
} from './charts.js';
import { downloadIcs, googleLink } from './calendar.js';
import { GuidedRunner } from './guided.js';
import { GUIDES, videoUrl } from './guides.js';
import { fmtKg, formatSets, liftProgress, recordSet, saveLift, setsOn, suggestLift } from './lifts.js';
import { speak, stopSpeaking } from './voice.js';

let state = load();
let view = 'today';
let weekOffset = 0;
let openSession = null; // { date, index } affiché en détail depuis la semaine
let refOpen = false; // bloc « prise de référence » déplié
let absOpen = false; // bloc « parcours abdos » déplié
let routineOpen = false; // bloc « routine nuque et dos » déplié
let formEdit = false; // questionnaire d'état de forme rouvert pour modification
let editBench = null; // date des résultats de référence en cours de modification
let lastClimb = { kind: 'bloc', grade: null }; // dernier type et cotation saisis dans le carnet d'escalade
let painOpen = false; // formulaire « Signaler une douleur » déplié
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const persist = () => { save(state); writePlan(); };
const shortDate = (d) => parseYmd(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// ---------- Chrono ----------
let timerView = { mode: 'stopwatch', display: 0, label: 'Chrono', laps: [], running: false, progress: null };
let wakeLock = null;
const timer = new Timer((v) => { timerView = v; if (view === 'timer') paintTimer(); updateTimerBadge(v.running); }, {
  sound: () => state.settings.sound,
  vibrate: () => state.settings.vibrate,
  onDone: (label) => {
    releaseWake();
    notify(`${label} : terminé`, 'On repart !', 'timer');
  },
});
let customCfg = { countdown: 90, work: 30, rest: 30, rounds: 8, sets: 1, setRest: 120 };

async function requestWake() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* non supporté */ }
}
function releaseWake() {
  try { wakeLock?.release(); } catch { /* déjà relâché */ }
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (timer.running) { requestWake(); timer.tick(); }
  if (guided?.running) { requestWake(); guided.tick(); }
});

function loadTimer(cfg) {
  timer.reset(cfg);
  releaseWake();
  go('timer');
}

// ---------- Séance guidée ----------
let guided = null;
let guidedId = null;
let guidedView = null;
let liftStep = null; // étape dont les compteurs répétitions / charge sont affichés

function findSession(id) {
  const [date, idx] = id.split('#');
  if (idx === 'ref') return referenceSession(parseYmd(date), state);
  if (idx === 'abs') return absSession(parseYmd(date), state);
  if (idx === 'nuque') return routineSession(parseYmd(date), state);
  return weekSessions(mondayOf(parseYmd(date)), state).find((x) => x.index === Number(idx));
}

function startGuided(id) {
  guided?.stop();
  const s = findSession(id);
  guidedId = id;
  guidedView = null;
  if (s.reference) refOpen = true;
  if (s.mobility) routineOpen = true;
  else if (s.bonus) absOpen = true;
  guided = new GuidedRunner(s, (v) => { guidedView = v; if (view === 'guided') paintGuided(); }, {
    sound: () => state.settings.sound,
    vibrate: () => state.settings.vibrate,
    onExerciseDone: (i, elapsedMs) => {
      const list = new Set(state.checks[id] || []);
      list.add(i);
      state.checks[id] = [...list];
      save(state);
      if (s.exercises[i].test) promptBench(s.exercises[i].test, s.date, elapsedMs);
    },
    onFinish: () => {
      releaseWake();
      notify('Séance terminée 💪', 'Pense à noter ton ressenti.', 'timer');
    },
    onSpeak: (text) => { if (state.settings.voice) speak(text); },
  });
  go('guided');
  guided.start();
  requestWake();
}

function quitGuided() {
  guided?.stop();
  stopSpeaking();
  releaseWake();
  const id = guidedId;
  guided = null;
  guidedId = null;
  const [date, idx] = id.split('#');
  if (date === ymd(new Date()) || Number.isNaN(Number(idx))) return go('today');
  view = 'week';
  openSession = { date, index: Number(idx) };
  render();
  window.scrollTo(0, 0);
}

// ---------- Fiches tuto ----------
function openGuide(ids) {
  const list = ids.split(',').map((k) => GUIDES[k]).filter(Boolean);
  if (!list.length) return;
  openSheet(list.map((g) => `<section class="guide">
      <h2>${esc(g.title)}</h2>
      <h3>Comment faire</h3>
      <ol>${g.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      <h3>Erreurs à éviter</h3>
      <ul>${g.errors.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${g.tip ? `<p class="tip">💡 ${esc(g.tip)}</p>` : ''}
      <a class="btn video" href="${videoUrl(g)}" target="_blank" rel="noopener">▶ Voir des vidéos de démonstration</a>
    </section>`).join(''));
}

function openSheet(html) {
  $('#sheet-body').innerHTML = html;
  $('#sheet').hidden = false;
  $('#sheet .sheet-card').scrollTop = 0;
}

// ---------- Carnet de charges ----------
const targetText = (t) => `${t.reps} rép.${t.kg != null ? ` à ${fmtKg(t.kg)}` : ''}`;

function liftLine(e, date) {
  const l = e.lift;
  const today = setsOn(state, l.key, date);
  if (today.some(Boolean)) return `<span class="ex-lift done">✓ Noté : ${formatSets({ sets: today })}</span>`;
  if (!l.last) return `<span class="ex-lift">📒 Première fois : note tes séries pour suivre ta progression</span>`;
  return `<span class="ex-lift">📒 Dernière fois : ${formatSets(l.last)} → objectif <strong>${targetText(l.target)}</strong></span>`;
}

function openLiftSheet(id, i) {
  const s = findSession(id);
  const e = s.exercises[i];
  const l = e.lift;
  const today = setsOn(state, l.key, s.date);
  const kg = today.find(Boolean)?.kg ?? l.target.kg ?? '';
  openSheet(`<form data-form="lift" data-id="${id}" data-ex="${i}" class="stack lift-form">
      <h2>${esc(e.name)}</h2>
      <p class="small muted">${esc(e.detail)}</p>
      ${l.last ? `<p class="small">Dernière fois (${shortDate(l.last.date)}) : <strong>${formatSets(l.last)}</strong></p>` : ''}
      ${l.reset ? '<p class="small muted">Charge recalée sur ta dernière prise de référence.</p>' : ''}
      <p class="tip">🎯 Objectif : ${targetText(l.target)} par série${l.target.reason ? ` (${esc(l.target.reason)})` : ''}</p>
      <div class="grid3">${Array.from({ length: e.sets }, (_, k) => `<label>Série ${k + 1}
        <span class="unit-input"><input type="number" inputmode="numeric" min="0" max="300" name="reps${k}" value="${today[k]?.reps ?? l.target.reps}"><span>rép.</span></span></label>`).join('')}</div>
      ${e.load ? `<label>Charge (${e.load.tool})
        <span class="unit-input"><input type="number" inputmode="decimal" step="${e.load.step}" min="${e.load.min}" max="${e.load.max}" name="kg" value="${kg}"><span>kg</span></span></label>` : ''}
      <p class="small muted">Vide une série que tu n'as pas faite.</p>
      <button class="primary">Enregistrer</button>
    </form>`);
}

// Compteurs répétitions / charge de la séance guidée, sur les séries comptées.
function guidedLiftEx(st) {
  if (!guided || st.kind !== 'work' || st.timed || st.countUp || st.set == null) return null;
  const e = guided.session.exercises[st.ex];
  return e.lift ? e : null;
}

function paintLift(v) {
  const box = $('#g-lift');
  const e = guidedLiftEx(v.step);
  box.hidden = !e;
  if (!e || liftStep === v.index) return;
  liftStep = v.index;
  const today = setsOn(state, e.lift.key, guided.session.date);
  const done = today[v.step.set];
  $('#g-reps').value = done?.reps ?? e.lift.target.reps;
  $('#g-kgwrap').hidden = !e.load;
  $('#g-kg').value = done?.kg ?? today[v.step.set - 1]?.kg ?? e.lift.target.kg ?? '';
  $('#g-kg').step = e.load?.step ?? 1;
}

function recordGuidedLift() {
  const st = guidedView?.step;
  const e = st && !guidedView.done && guidedLiftEx(st);
  if (!e) return;
  const reps = Number($('#g-reps').value);
  if (!(reps > 0)) return;
  const kg = e.load && $('#g-kg').value !== '' ? Number($('#g-kg').value) : null;
  recordSet(state, e.lift.key, guided.session.date, st.set, { reps, kg });
  save(state);
}

function stepLift(field, dir) {
  const st = guidedView?.step;
  const e = st && guidedLiftEx(st);
  if (!e) return;
  const input = field === 'reps' ? $('#g-reps') : $('#g-kg');
  if (field === 'reps') input.value = Math.max(0, (Number(input.value) || 0) + dir);
  else {
    const { step, min, max } = e.load;
    const cur = input.value === '' ? min - (dir > 0 ? step : 0) : Number(input.value);
    input.value = Math.round(Math.min(max, Math.max(min, cur + dir * step)) * 10) / 10;
  }
}

// ---------- Résultat d'un test de la prise de référence ----------
const BENCH_HINT = { gripper: 'Charge max fermée proprement.', cooper: 'Distance parcourue en 12 minutes.' };
const BENCH_STEP = { gripper: 5, cooper: 50 };

function promptBench(key, date, elapsedMs) {
  const t = BENCH_TESTS.find((b) => b.key === key);
  const current = (state.benchmarks || []).find((b) => b.date === date)?.[key];
  // Tests au temps : le chrono a tourné jusqu'au ✓, on propose ce temps à confirmer.
  const measured = t.unit === 'secondes' && elapsedMs > 0 ? Math.round(elapsedMs / 1000) : null;
  const value = measured ?? current ?? '';
  const step = BENCH_STEP[key] || 1;
  openSheet(`<form data-form="bench-one" data-date="${date}" data-key="${key}" class="stack bench-prompt">
      <h2>${esc(t.label)}</h2>
      ${measured != null
    ? `<p>Temps mesuré : <strong>${fmtDuration(measured)}</strong></p><p class="small muted">Confirme, ou corrige si tu as lâché avant d'appuyer sur ✓.</p>`
    : `<p class="small muted">${BENCH_HINT[key] || 'Nombre de répétitions propres, sans pause.'}</p>`}
      <div class="stepper bench-stepper">
        <div><button type="button" data-bstep="${-step}" aria-label="Moins">−</button><input name="value" type="number" inputmode="numeric" min="0" step="1" value="${value}" aria-label="${esc(t.label)}"><button type="button" data-bstep="${step}" aria-label="Plus">+</button></div>
        <span class="g-caption">${t.unit}</span>
      </div>
      <div class="row-btns">
        <button type="button" data-action="close-sheet">Plus tard</button>
        <button class="primary">${measured != null ? 'Confirmer' : 'Valider'}</button>
      </div>
    </form>`);
}

// ---------- Notifications ----------
async function notify(title, body, tag) {
  if (!state.settings.notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
  if (!document.hidden && tag === 'timer') return; // l'appli est à l'écran : le son et la vibration suffisent
  try {
    const reg = await navigator.serviceWorker?.ready;
    reg?.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/badge.png', vibrate: [200, 100, 200] });
  } catch { /* notification impossible */ }
}

async function enableNotifications() {
  if (!('Notification' in window)) return toast('Ce navigateur ne gère pas les notifications.');
  const perm = await Notification.requestPermission();
  state.settings.notifications = perm === 'granted';
  persist();
  if (perm !== 'granted') return toast('Notifications refusées. Tu peux les réactiver dans les réglages Android du site.');
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg) {
      await reg.periodicSync.register('rappel-seance', { minInterval: 6 * 3600 * 1000 });
    }
  } catch { /* synchronisation périodique indisponible */ }
  toast('Notifications activées.');
  render();
}

// Écrit le planning des 14 prochains jours pour que le service worker puisse
// envoyer le rappel du jour même quand l'appli est fermée.
async function writePlan() {
  if (!('caches' in window)) return;
  const items = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    sessionsOn(d, state).forEach((s) => items.push({ date: s.date, time: s.time, title: s.title, tip: tipFor(s.type, d.getTime()) }));
  }
  try {
    const c = await caches.open('pt-data');
    await c.put('plan.json', new Response(JSON.stringify({ enabled: state.settings.notifications, items })));
  } catch { /* cache indisponible */ }
}

// ---------- Navigation ----------
function go(v) {
  view = v;
  if (v !== 'week') openSession = null;
  render();
  window.scrollTo(0, 0);
}

function toast(msg, ms = 3500) {
  const t = $('#toast');
  t.innerHTML = msg;
  t.hidden = false;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => { t.hidden = true; }, ms);
}

function render() {
  document.body.classList.toggle('guided-mode', view === 'guided');
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.go === view));
  const info = weekInfo(new Date(), state.settings.startDate);
  $('#week-badge').textContent = `Semaine ${info.week} · ${info.phase.name}`;
  const main = $('#main');
  main.innerHTML = {
    today: renderToday, week: renderWeek, timer: renderTimer, stats: renderStats, settings: renderSettings, guided: renderGuided,
  }[view]();
  if (view === 'timer') paintTimer();
  if (view === 'settings') cloudDrawn = cloudShape(cloudStatus());
  liftStep = null;
  if (view === 'guided') paintGuided();
}

// ---------- Aujourd'hui ----------
function renderToday() {
  const now = new Date();
  const list = sessionsOn(now, state);
  const dateLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  let html = `<h1 class="cap">${dateLabel}</h1>`;
  const today = ymd(now);
  const hurting = Object.keys(activePains(state, today)).length > 0;
  if (hurting) html += painCard(today);
  const due = benchDue(state, now);
  const refBlock = `<details class="card ref-wrap bench-wrap" ${due.due || refOpen ? 'open' : ''}>
      <summary>📏 Prise de référence ${due.due ? '<span class="pill due">À faire</span>' : `<span class="muted small">· prochaine dans ${due.inDays} j</span>`}</summary>
      <p class="small muted">Toutes les 4 semaines : tes résultats recalculent répétitions, charges et allures de tes séances.</p>
      ${sessionCard(referenceSession(now, state))}
    </details>`;
  if (due.due) html += refBlock;
  if (!list.length) {
    const next = nextSession(now);
    html += `<section class="card rest"><h2>Jour de repos</h2><p>Récupère bien : marche, mobilité douce de la nuque et du dos, hydratation.</p>
      ${next ? `<p class="muted">Prochaine séance : <strong>${esc(next.title)}</strong>, ${parseYmd(next.date).toLocaleDateString('fr-FR', { weekday: 'long' })} à ${next.time}.</p>` : ''}
      <p class="tip">💡 ${esc(tipFor('general'))}</p></section>`;
  }
  if (list.length) html += formCard(today);
  list.forEach((s) => { html += sessionCard(s); });
  const routine = routineSession(now, state);
  const routineLogged = !!logFor(routine);
  html += `<details class="card ref-wrap routine-wrap" ${routineOpen || (!list.length && !routineLogged) ? 'open' : ''}>
      <summary>🧘 Routine nuque et dos <span class="muted small">· ${routine.duration}${routineLogged ? ' · ✓ faite' : ''}</span></summary>
      <p class="small muted">Prévention du grimpeur : nuque, haut du dos, épaules et avant-bras. Idéale les jours sans séance, le matin ou à midi.</p>
      ${sessionCard(routine)}
    </details>`;
  const abs = absSession(now, state);
  html += `<details class="card ref-wrap abs-wrap" ${absOpen ? 'open' : ''}>
      <summary>🔥 Parcours abdos <span class="muted small">· ${abs.duration}, ${abs.home ? 'à la maison' : 'en salle'}</span></summary>
      <p class="small muted">En plus du programme, quand tu veux : grand droit, obliques, gainage profond et lombaires.</p>
      ${sessionCard(abs)}
    </details>`;
  if (!due.due) html += refBlock;
  if (!list.some((s) => s.type === 'escalade' && !s.home)) html += `<section class="card">${climbLogger(today, 'Grimpé hors programme ? Note tes voies et blocs ici.')}</section>`;
  if (!hurting) html += painCard(today);
  html += `<details class="card"><summary>Noter une séance hors programme</summary>
    <form data-form="extra" class="stack">
      <label>Type <select name="type">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}</select></label>
      <label>Intitulé <input name="title" placeholder="Ex. grimpe avec des potes" required></label>
      ${feedbackFields('extra', true)}
      <button class="primary">Enregistrer</button>
    </form></details>`;
  return html;
}

// ---------- État de forme ----------
const FORM_EFFECT = { low: 'séance allégée d\'une série par exercice', normal: 'séance prévue, sans changement', high: 'série bonus proposée' };

function formCard(day) {
  const level = formLevel(state, day);
  if (level && !formEdit) {
    return `<section class="card form-card ${level}"><p><i class="form-dot"></i><span><strong>${FORM_LABELS[level]}</strong> aujourd'hui : ${FORM_EFFECT[level]}.</span>
      <button class="link" data-form-edit="1">Modifier</button></p></section>`;
  }
  const cur = state.forms?.[day] || {};
  return `<section class="card form-card">
      <h2>Comment tu te sens ?</h2>
      <p class="small muted">Trois réponses, et ta séance du jour s'ajuste.</p>
      <form data-form="form" data-date="${day}" class="stack">
        ${FORM_QUESTIONS.map((q) => `<fieldset class="form-q"><legend>${q.label}</legend><div class="seg">${q.options.map((o, v) => `<label><input type="radio" name="${q.key}" value="${v}" required ${cur[q.key] === v ? 'checked' : ''}><span>${o}</span></label>`).join('')}</div></fieldset>`).join('')}
        <button class="primary">Adapter ma séance</button>
        <p class="small muted">Une vraie douleur ? Signale-la plus bas : les exercices concernés seront retirés.</p>
      </form>
    </section>`;
}

// ---------- Douleurs ----------
function zoneChips(name, exclude = []) {
  return `<div class="chips zone-chips">${Object.entries(ZONES).filter(([k]) => !exclude.includes(k)).map(([k, l]) => `<label class="chip-check"><input type="checkbox" name="${name}" value="${k}"><span>${l}</span></label>`).join('')}</div>`;
}

function painCard(day) {
  const active = activePains(state, day);
  const zones = Object.keys(active);
  const form = `<form data-form="pain" data-date="${day}" class="stack">
      ${zoneChips('zone', zones)}
      <p class="small muted">Pendant 7 jours, les exercices qui sollicitent ces zones sont retirés de tes séances. Douleur vive, gonflement ou douleur qui dure : consulte.</p>
      <button class="primary">Adapter mes séances</button>
    </form>`;
  if (!zones.length) return `<details class="card pain-card" ${painOpen ? 'open' : ''}><summary>🩹 Signaler une douleur</summary>${form}</details>`;
  return `<section class="card pain-card active">
      <h2>🩹 Douleur en cours</h2>
      <p class="small muted">Les exercices qui sollicitent ces zones sont retirés de tes séances.</p>
      <ul class="pain-list">${zones.map((z) => `<li><span><strong>${ZONES[z]}</strong> <span class="muted small">jusqu'au ${shortDate(active[z])}</span></span>
        <button data-heal="${z}">Ça va mieux</button></li>`).join('')}</ul>
      ${zones.length < Object.keys(ZONES).length ? `<details ${painOpen ? 'open' : ''}><summary class="small">Signaler une autre douleur</summary>${form}</details>` : ''}
    </section>`;
}

// ---------- Carnet d'escalade ----------
const sentClimb = (c) => c.style !== 'travail';

function bestClimb(date) {
  const sends = (state.climbs || []).filter((c) => c.date === date && sentClimb(c));
  const pick = sends.some((c) => c.kind === 'voie') ? sends.filter((c) => c.kind === 'voie') : sends;
  return pick.reduce((best, c) => (GRADES.indexOf(c.grade) > GRADES.indexOf(best ?? '') ? c.grade : best), null);
}

function climbLogger(date, intro = 'Note chaque voie ou bloc au fil de la séance.') {
  const list = (state.climbs || []).filter((c) => c.date === date);
  const grade = lastClimb.grade ?? GRADES[state.adapt.gradeIdx];
  const sends = list.filter(sentClimb).length;
  return `<details class="climbs" ${list.length || lastClimb.open === date ? 'open' : ''}>
      <summary>🧗 Carnet d'escalade${list.length ? ` <span class="muted small">· ${sends} enchaînée${sends > 1 ? 's' : ''} sur ${list.length}</span>` : ''}</summary>
      ${list.length ? `<ul class="climb-list">${list.map((c) => `<li><span class="grade-tag${c.kind === 'bloc' ? ' bloc' : ''}">${c.grade}</span>
        <span>${c.kind === 'voie' ? 'Voie' : 'Bloc'} · ${CLIMB_STYLES[c.style]}</span>
        <button class="link" data-climb-del="${c.id}" aria-label="Retirer">✕</button></li>`).join('')}</ul>` : `<p class="small muted">${intro}</p>`}
      <form data-form="climb" data-date="${date}" class="stack climb-form">
        <div class="climb-row">
          <div class="seg">${['bloc', 'voie'].map((k) => `<label><input type="radio" name="kind" value="${k}" ${lastClimb.kind === k ? 'checked' : ''}><span>${k === 'voie' ? 'Voie' : 'Bloc'}</span></label>`).join('')}</div>
          <select name="grade" aria-label="Cotation">${GRADES.map((g) => `<option ${g === grade ? 'selected' : ''}>${g}</option>`).join('')}</select>
        </div>
        <div class="seg">${Object.entries(CLIMB_STYLES).map(([k, l]) => `<label><input type="radio" name="style" value="${k}" ${k === 'enchaine' ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <button>+ Ajouter</button>
      </form>
    </details>`;
}

function nextSession(from) {
  for (let i = 1; i <= 14; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const s = sessionsOn(d, state)[0];
    if (s) return s;
  }
  return null;
}

function logFor(s) {
  return state.logs.find((l) => l.date === s.date && l.sessionIndex === s.index && !l.extra);
}

function sessionCard(s) {
  const id = `${s.date}#${s.index}`;
  const done = state.checks[id] || [];
  const log = logFor(s);
  const hasRun = s.run;
  return `<section class="card session${s.reference ? ' ref-session' : ''}${s.bonus ? ' bonus-session' : ''}" style="--accent:${s.mobility ? 'var(--rest)' : TYPES[s.type].color}">
    <div class="session-head">
      <span>${s.reference ? '<span class="pill">📏 Référence</span>' : s.mobility ? '<span class="pill">🧘 Routine</span>' : s.bonus ? '<span class="pill">🔥 Abdos</span>' : `<span class="pill">${TYPES[s.type].label}</span>`}${s.home && !s.reference && !s.mobility ? ' <span class="pill ghost">🏠 Maison</span>' : ''}${s.express ? ' <span class="pill ghost">⚡ Express</span>' : ''}</span>
      <span class="muted">${s.reference || s.bonus ? 'Quand tu veux' : `${slotLabel(s.slot)} · ${s.time}`}</span>
    </div>
    <h2>${esc(s.title)}</h2>
    ${slotSwitch(s, id, log)}
    <p class="total">⏱ <strong>${s.duration}</strong> au total, repos compris</p>
    ${s.reference ? '<p class="muted small">Fais les tests reposé, dans l\'ordre, avec les repos indiqués. Note chaque résultat en bas.</p>' : s.mobility ? '' : `<p class="muted small">Semaine ${s.week} · ${s.phase.name} : ${s.phase.note}</p>`}
    ${s.notes.map((n) => `<p class="small note">ℹ️ ${esc(n)}</p>`).join('')}
    ${s.reference || s.mobility ? '' : `<p class="tip">💡 ${esc(tipFor(s.type === 'cardio' && state.settings.access.course === false ? 'cardioSansCourse' : s.type, parseYmd(s.date).getTime()))}</p>`}
    <button class="primary guided-btn" data-guided="${id}">▶ Lancer la séance guidée</button>
    ${log || s.reference || s.bonus ? '' : `<button class="express-btn" data-express="${id}">${s.express ? '↩︎ Revenir à la séance prévue' : '⚡ Pas le temps ? Version express (25 min, maison)'}</button>`}
    <ol class="exercises">
      ${s.exercises.map((e, i) => `<li class="${done.includes(i) ? 'done' : ''}">
        <label class="check"><input type="checkbox" data-check="${id}" data-i="${i}" ${done.includes(i) ? 'checked' : ''}>
          <span><strong>${esc(e.name)}</strong><br><span class="small">${esc(e.detail)}</span>
          <span class="ex-meta">≈ ${fmtDuration(e.seconds)}${e.restAfter ? ` · puis ${fmtDuration(e.restAfter)} de repos avant l'exercice suivant` : ''}</span>
          ${e.lift ? liftLine(e, s.date) : ''}</span></label>
        <span class="ex-actions">
          ${e.info ? `<button class="icon-btn info-btn" data-info="${[].concat(e.info).join(',')}" aria-label="Tuto : ${esc(e.name)}">i</button>` : ''}
          ${e.lift ? `<button class="icon-btn" data-lift="${id}|${i}" aria-label="Noter mes séries">📒</button>` : ''}
          ${e.timer ? `<button class="icon-btn" data-timer='${esc(JSON.stringify(e.timer))}' aria-label="Lancer le chrono">⏱</button>` : ''}
        </span>
      </li>`).join('')}
    </ol>
    ${s.type === 'escalade' && !s.home && !s.reference ? climbLogger(s.date) : ''}
    ${s.reference ? benchForm(s.date) : s.mobility ? routineDone(id, log) : log ? `<div class="logged">✓ Séance notée : <strong>${feelLabel(log.feeling)}</strong>${log.completed === false ? ', arrêtée avant la fin' : ''}${log.maxGrade ? `, max ${log.maxGrade}` : ''}${log.zones?.length ? `, douleur ${log.zones.map((z) => ZONES[z].toLowerCase()).join(', ')}` : ''}
        <button class="link" data-unlog="${log.id}">Modifier</button></div>`
    : `<form data-form="log" data-date="${s.date}" data-index="${s.index}" class="stack feedback">
        <h3>Comment ça s'est passé ?</h3>
        ${feedbackFields(id, false, s.home ? 'maison' : s.type, hasRun, bestClimb(s.date))}
        <button class="primary">Terminer la séance</button>
      </form>`}
  </section>`;
}

// Midi ou soir, pour les séances de semaine pas encore notées.
function slotSwitch(s, id, log) {
  if (s.reference || s.bonus || s.slot === 'weekend' || log) return '';
  const t = state.settings.times;
  return `<div class="seg slot-seg" role="group" aria-label="Créneau">${['midi', 'soir'].map((k) => `<button type="button" data-slot="${id}|${k}" class="${s.slot === k ? 'active' : ''}">${slotLabel(k)} · ${t[k]}</button>`).join('')}</div>`;
}

function routineDone(id, log) {
  if (log) return `<div class="logged">✓ Routine faite <button class="link" data-unlog="${log.id}">Annuler</button></div>`;
  return `<button class="primary routine-done" data-routine-done="${id}">✓ Routine faite</button>`;
}

const UNIT_SHORT = { répétitions: 'rép.', secondes: 's', kg: 'kg', mètres: 'm' };

function benchForm(date) {
  const bench = (state.benchmarks || []).find((b) => b.date === date);
  const summary = benchSummary(state);
  const summaryHtml = summary.length ? `<h3>Ce que ça change dans tes séances</h3><ul class="small bench-summary">${summary.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  if (bench && editBench !== date) {
    return `<div class="logged">✓ Résultats du ${parseYmd(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} enregistrés
        <button class="link" data-bench-edit="${date}">Modifier</button></div>${summaryHtml}`;
  }
  return `<form data-form="bench" data-date="${date}" class="stack feedback">
      <h3>Tes résultats</h3>
      <div class="grid2">
        ${BENCH_TESTS.map((t) => `<label>${t.label}${t.optional ? ' (optionnel)' : ''}
          <span class="unit-input"><input type="number" inputmode="numeric" min="0" step="1" name="${t.key}" value="${bench?.[t.key] ?? ''}"><span>${UNIT_SHORT[t.unit]}</span></span></label>`).join('')}
      </div>
      <p class="small muted">Laisse vide un test que tu n'as pas fait : l'ancienne valeur est gardée.</p>
      <button class="primary">Enregistrer et adapter mes séances</button>
    </form>`;
}

function feedbackFields(id, free, type, hasRun, maxGrade = null) {
  return `<div class="seg" role="radiogroup" aria-label="Ressenti">
      ${['facile', 'ok', 'dur'].map((f) => `<label><input type="radio" name="feeling" value="${f}" required><span>${feelLabel(f)}</span></label>`).join('')}
    </div>
    ${free || hasRun ? `<label class="row"><input type="checkbox" name="stopped"> J'ai arrêté ${free ? 'la séance' : state.settings.access.course === false ? 'le cardio' : 'la course'} avant la fin</label>` : ''}
    ${free || type === 'escalade' ? `<label>Cotation max enchaînée (escalade) <select name="maxGrade"><option value="">—</option>${GRADES.map((g) => `<option ${g === maxGrade ? 'selected' : ''}>${g}</option>`).join('')}</select></label>` : ''}
    <fieldset class="zones"><legend>Une douleur ? <span class="muted small">Les exercices concernés seront retirés 7 jours</span></legend>${zoneChips('zone')}</fieldset>
    <label>Note <textarea name="note" rows="2" placeholder="Charges, sensations…"></textarea></label>`;
}

const feelLabel = (f) => ({ facile: 'Facile', ok: 'OK', dur: 'Dur' }[f]);
const slotLabel = (s) => ({ midi: 'Midi', soir: 'Soir', weekend: 'Week-end' }[s]);

function submitLog(form) {
  const fd = new FormData(form);
  const extra = form.dataset.form === 'extra';
  let base;
  if (extra) {
    base = { type: fd.get('type'), title: fd.get('title'), date: ymd(new Date()), extra: true };
  } else {
    const s = findSession(`${form.dataset.date}#${form.dataset.index}`);
    base = { type: s.type, title: s.title, date: s.date, sessionIndex: s.index, key: s.key, variant: s.variant, home: s.home, bonus: s.bonus };
  }
  const log = {
    ...base,
    id: `${Date.now()}`,
    feeling: fd.get('feeling'),
    completed: !fd.get('stopped'),
    maxGrade: fd.get('maxGrade') || null,
    zones: fd.getAll('zone'),
    note: fd.get('note') || '',
  };
  log.pain = log.zones.length > 0;
  state.logs.push(log);
  state.logs.sort((a, b) => a.date.localeCompare(b.date));
  const msgs = adapt(state, log);
  if (log.pain) {
    addPains(state, log.zones, log.date);
    msgs.push(`Douleur notée (${log.zones.map((z) => ZONES[z].toLowerCase()).join(', ')}) : les exercices concernés sont retirés pendant 7 jours.`);
  }
  persist();
  render();
  toast(['Séance enregistrée 💪', ...msgs].join('<br>'), msgs.length ? 6000 : 2500);
}

// ---------- Semaine ----------
function renderWeek() {
  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  if (openSession) {
    const s = weekSessions(mondayOf(parseYmd(openSession.date)), state).find((x) => x.index === openSession.index);
    return `<button class="link back" data-action="close-session">← Retour à la semaine</button>${sessionCard(s)}`;
  }
  const info = weekInfo(monday, state.settings.startDate);
  const sessions = weekSessions(monday, state);
  const end = new Date(monday); end.setDate(end.getDate() + 6);
  const f = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `<div class="week-nav">
      <button class="icon-btn" data-week="-1" aria-label="Semaine précédente">‹</button>
      <div><strong>${f(monday)} – ${f(end)}</strong><br><span class="muted small">Semaine ${info.week} · ${info.phase.name}</span></div>
      <button class="icon-btn" data-week="1" aria-label="Semaine suivante">›</button>
    </div>
    <p class="muted small center">${info.phase.note}</p>
    <ul class="days">
      ${DAYS.map((name, d) => {
        const date = new Date(monday); date.setDate(date.getDate() + d);
        const items = sessions.filter((s) => s.day === d);
        const isToday = ymd(date) === ymd(new Date());
        return `<li class="${isToday ? 'today' : ''}"><div class="day-name">${name.slice(0, 3)}<br><span>${date.getDate()}</span></div>
          <div class="day-items">${items.length ? items.map((s) => {
            const log = logFor(s);
            return `<div class="day-session" style="--accent:${TYPES[s.type].color}">
              <button class="link strong" data-open="${s.date}#${s.index}">${esc(s.title)}</button>
              <span class="muted small">${slotLabel(s.slot)} ${s.time} · ${s.duration}${log ? ` · ✓ ${feelLabel(log.feeling)}` : ''}</span>
              <label class="small move">Déplacer au <select data-move="${s.index}" data-monday="${ymd(monday)}">
                ${DAYS.map((n, k) => `<option value="${k}" ${k === d ? 'selected' : ''}>${n.toLowerCase()}</option>`).join('')}
              </select>${s.slot === 'weekend' ? '' : ` <select data-slotsel="${s.date}#${s.index}" aria-label="Créneau">${['midi', 'soir'].map((k) => `<option value="${k}" ${s.slot === k ? 'selected' : ''}>${k === 'midi' ? 'le midi' : 'le soir'}</option>`).join('')}</select>`}</label></div>`;
          }).join('') : '<span class="muted small">Repos</span>'}</div></li>`;
      }).join('')}
    </ul>
    <p class="hint">Un déplacement ou un changement de créneau ne concerne que cette semaine. Évite deux séances d'escalade deux jours de suite pour tes doigts.</p>`;
}

// ---------- Chrono ----------
function renderTimer() {
  const mode = timer.cfg.mode;
  const todays = sessionsOn(new Date(), state);
  return `${guided && !guided.done ? `<button class="primary guided-btn" data-action="resume-guided">▶ Reprendre la séance guidée</button>`
    : todays.map((s) => `<button class="primary guided-btn" data-guided="${s.date}#${s.index}">▶ Séance guidée : ${esc(s.title)} (${s.duration})</button>`).join('')}
    <div class="seg tabs" role="tablist">
      ${[['stopwatch', 'Chrono'], ['countdown', 'Minuteur'], ['interval', 'Intervalles']].map(([m, l]) => `<button data-tmode="${m}" class="${mode === m ? 'active' : ''}">${l}</button>`).join('')}
    </div>
    <div class="timer-face" id="tface">
      <svg viewBox="0 0 200 200" class="ring-svg"><circle cx="100" cy="100" r="90" class="ring-bg"/><circle cx="100" cy="100" r="90" class="ring-fg" id="tring" pathLength="100"/></svg>
      <div class="timer-text"><div id="tlabel" class="tlabel"></div><div id="tdisplay" class="tdisplay"></div><div id="tnext" class="tnext"></div></div>
    </div>
    <div class="controls">
      <button class="ctrl" data-t="reset">Réinitialiser</button>
      <button class="ctrl primary big" data-t="toggle" id="ttoggle">Démarrer</button>
      <button class="ctrl" data-t="${mode === 'stopwatch' ? 'lap' : 'skip'}">${mode === 'stopwatch' ? 'Tour' : 'Passer'}</button>
    </div>
    ${mode === 'stopwatch' ? '<ol id="laps" class="laps"></ol>' : ''}
    ${mode === 'countdown' ? `<form class="card stack" data-form="countdown">
        <label>Durée (secondes) <input type="number" name="countdown" min="5" step="5" value="${timer.cfg.seconds || customCfg.countdown}"></label>
        <button>Appliquer</button></form>` : ''}
    ${mode === 'interval' ? `<form class="card grid2" data-form="interval">
        <label>Effort (s) <input type="number" name="work" min="1" value="${timer.cfg.work ?? customCfg.work}"></label>
        <label>Repos (s) <input type="number" name="rest" min="0" value="${timer.cfg.rest ?? customCfg.rest}"></label>
        <label>Répétitions <input type="number" name="rounds" min="1" value="${timer.cfg.rounds ?? customCfg.rounds}"></label>
        <label>Séries <input type="number" name="sets" min="1" value="${timer.cfg.sets ?? customCfg.sets}"></label>
        <label>Repos entre séries (s) <input type="number" name="setRest" min="0" value="${timer.cfg.setRest ?? customCfg.setRest}"></label>
        <button>Appliquer</button></form>` : ''}
    <h3>Préréglages</h3>
    <div class="chips">${PRESETS.map((p, i) => `<button class="chip" data-preset="${i}">${p.label}</button>`).join('')}</div>
    <p class="hint">L'écran reste allumé pendant le chrono. Son : ${state.settings.sound ? 'activé' : 'coupé'} · Vibration : ${state.settings.vibrate ? 'activée' : 'coupée'} (modifiable dans Réglages).</p>`;
}

function paintTimer() {
  const v = timerView;
  const d = $('#tdisplay');
  if (!d) return;
  d.textContent = fmt(v.display, v.mode === 'stopwatch');
  $('#tlabel').textContent = v.label;
  $('#tnext').textContent = v.next ? `Ensuite : ${v.next}` : '';
  $('#tface').dataset.kind = v.kind || 'idle';
  const pct = v.progress == null ? (v.running ? 100 : 0) : v.progress * 100;
  $('#tring').style.strokeDasharray = `${pct} 100`;
  $('#tface').toggleAttribute('data-empty', pct < 0.5);
  $('#ttoggle').textContent = v.running ? 'Pause' : v.kind === 'done' ? 'Terminé' : timer.elapsed() > 0 ? 'Reprendre' : 'Démarrer';
  const laps = $('#laps');
  if (laps) laps.innerHTML = (v.laps || []).map((l, i, a) => `<li><span>Tour ${a.length - i}</span><span>${fmt(l, true)}</span></li>`).join('');
}

function updateTimerBadge(running) {
  $('nav [data-go="timer"]')?.classList.toggle('running', running);
}

function renderGuided() {
  return `<div class="guided" id="guided">
      <div class="g-top">
        <div><span class="g-caption">Temps restant</span><strong id="g-total" class="g-total"></strong></div>
        <span class="g-tools">
          <button class="icon-btn" data-g="voice" id="g-voice" aria-label="Annonces vocales">${state.settings.voice ? '🔊' : '🔇'}</button>
          <button class="icon-btn" data-g="quit" id="g-quit" aria-label="Quitter la séance">✕</button>
        </span>
      </div>
      <div class="g-progress"><i id="g-bar"></i></div>
      <div class="g-main">
        <div id="g-kind" class="g-kind"></div>
        <h1 id="g-title" class="g-title"></h1>
        <div id="g-sub" class="g-sub"></div>
        <div id="g-time" class="g-time"></div>
        <div id="g-hint" class="g-hint"></div>
        <div id="g-lift" class="g-lift" hidden>
          <div class="stepper"><span class="g-caption">Répétitions</span>
            <div><button data-lstep="reps:-1" aria-label="Une répétition de moins">−</button><input id="g-reps" type="number" inputmode="numeric" min="0" aria-label="Répétitions faites"><button data-lstep="reps:1" aria-label="Une répétition de plus">+</button></div></div>
          <div class="stepper" id="g-kgwrap"><span class="g-caption">Charge (kg)</span>
            <div><button data-lstep="kg:-1" aria-label="Moins lourd">−</button><input id="g-kg" type="number" inputmode="decimal" min="0" aria-label="Charge en kg"><button data-lstep="kg:1" aria-label="Plus lourd">+</button></div></div>
        </div>
        <button class="link" id="g-info" data-info="">ⓘ Comment faire cet exercice</button>
      </div>
      <div class="g-next"><span class="g-caption">Ensuite</span><div id="g-next"></div></div>
      <div class="g-controls">
        <button data-g="prev" aria-label="Étape précédente">⏮</button>
        <button data-g="toggle" id="g-toggle" class="primary big">Pause</button>
        <button data-g="next" id="g-nextbtn">⏭</button>
      </div>
    </div>`;
}

function paintGuided() {
  const v = guidedView;
  const root = $('#guided');
  if (!root || !v) return;
  if (v.done) {
    root.dataset.kind = 'done';
    const ref = guided?.session.reference;
    const bench = ref && (state.benchmarks || []).find((b) => b.date === guided.session.date);
    const results = bench ? BENCH_TESTS.filter((t) => bench[t.key]).map((t) => `<li>${esc(t.label)} : <strong>${bench[t.key]} ${UNIT_SHORT[t.unit]}</strong></li>`).join('') : '';
    root.innerHTML = `<div class="g-main g-end">
        <div class="g-kind">Bravo</div>
        <h1 class="g-title">Séance terminée 💪</h1>
        ${ref ? `${results ? `<ul class="g-results">${results}</ul>` : ''}<p class="g-sub">Tes séances sont recalculées avec ces résultats.</p>`
    : '<p class="g-sub">Note ton ressenti pour que le programme s\'adapte.</p>'}
        <button class="primary big" data-g="quit">${ref ? 'Voir mes résultats' : 'Noter la séance'}</button>
      </div>`;
    return;
  }
  const st = v.step;
  root.dataset.kind = st.kind;
  $('#g-total').textContent = fmt(v.remainingTotal);
  $('#g-bar').style.width = `${Math.max(0, Math.min(1, v.progress)) * 100}%`;
  $('#g-kind').textContent = st.kind === 'prep' ? 'Prépare-toi' : st.kind === 'rest' ? 'Repos' : 'C\'est parti';
  $('#g-title').textContent = st.title;
  $('#g-sub').textContent = st.sub || '';
  const over = v.remaining < 0 && !st.countUp;
  $('#g-time').textContent = st.countUp ? fmt(st.dur * 1000 - v.remaining) : over ? `+${fmt(-v.remaining)}` : fmt(v.remaining);
  $('#g-time').classList.toggle('over', over);
  const lift = guidedLiftEx(st);
  const timeTest = st.countUp && BENCH_TESTS.find((b) => b.key === guided.session.exercises[st.ex].test)?.unit === 'secondes';
  $('#g-hint').textContent = timeTest ? 'Le chrono tourne : appuie sur ✓ dès que tu lâches.'
    : st.countUp ? 'Effort maximal : appuie sur ✓ quand tu t\'arrêtes, puis note ton résultat.' : st.timed ? ''
    : lift ? 'Ajuste ce que tu as fait, puis appuie sur ✓.' : over ? 'Temps estimé dépassé : appuie sur ✓ quand c\'est fait.' : 'Temps estimé. Appuie sur ✓ quand la série est faite.';
  paintLift(v);
  const info = st.info ? [].concat(st.info).join(',') : '';
  $('#g-info').hidden = !info;
  $('#g-info').dataset.info = info;
  $('#g-next').textContent = v.next;
  $('#g-toggle').textContent = v.running ? 'Pause' : 'Reprendre';
  $('#g-nextbtn').textContent = st.timed ? '⏭' : '✓ Fait';
}

// ---------- Suivi ----------
function renderStats() {
  const logs = state.logs;
  const training = logs.filter((l) => !l.mobility);
  const now = new Date();
  const week = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const routines = logs.filter((l) => l.mobility && l.date >= ymd(week)).length;
  const month = training.filter((l) => l.date.slice(0, 7) === ymd(now).slice(0, 7)).length;
  const planned = weekSessions(mondayOf(now), state).filter((s) => s.date <= ymd(now)).length;
  const doneWeek = logs.filter((l) => !l.extra && !l.bonus && ymd(mondayOf(parseYmd(l.date))) === ymd(mondayOf(now))).length;
  const a = state.adapt;
  const pct = (v) => `${Math.round(v * 100)} %`;
  return `<h1>Suivi</h1>
    <div class="tiles">
      <div class="tile"><span class="big-num">${month}</span><span>séances ce mois</span></div>
      <div class="tile"><span class="big-num">${doneWeek}/${planned || 0}</span><span>prévues réalisées cette semaine</span></div>
      <div class="tile"><span class="big-num">${GRADES[a.gradeIdx]}</span><span>niveau cible escalade</span></div>
    </div>
    ${logs.some((l) => l.mobility) ? `<p class="small muted center">🧘 Routine nuque et dos : ${routines} fois ces 7 derniers jours.</p>` : ''}
    <section class="card"><h2>Séances par semaine</h2>${weeklyBars(training)}</section>
    <section class="card"><h2>Ressenti</h2>${feelingDots(training)}</section>
    <section class="card"><h2>Escalade</h2>${climbStats()}</section>
    <section class="card"><h2>Carnet de charges</h2>${liftTable()}</section>
    <section class="card"><h2>Intensité du programme</h2>
      <p class="muted small">100 % = programme de base. L'appli ajuste selon ton ressenti.</p>
      <table class="table"><tbody>
        ${Object.keys(TYPES).map((t) => `<tr><td><i class="dot" style="background:${TYPES[t].color}"></i>${TYPES[t].label}</td><td class="num">${pct(a[t])}</td></tr>`).join('')}
      </tbody></table></section>
    <section class="card"><h2>Prises de référence</h2>${benchTable()}</section>
    <section class="card"><h2>Historique</h2>
      ${logs.length ? `<table class="table"><thead><tr><th>Date</th><th>Séance</th><th>Ressenti</th><th></th></tr></thead><tbody>
        ${[...logs].reverse().map((l) => `<tr><td>${parseYmd(l.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</td>
          <td><i class="dot" style="background:${TYPES[l.type].color}"></i>${esc(l.title)}${l.maxGrade ? ` · ${l.maxGrade}` : ''}${l.completed === false ? ' · arrêtée' : ''}${l.pain ? ` · douleur${l.zones?.length ? ` (${l.zones.map((z) => ZONES[z].toLowerCase()).join(', ')})` : ''}` : ''}${l.note ? `<br><span class="muted small">${esc(l.note)}</span>` : ''}</td>
          <td>${feelLabel(l.feeling)}</td><td><button class="link" data-del="${l.id}" aria-label="Supprimer">✕</button></td></tr>`).join('')}
      </tbody></table>` : '<p class="empty">Aucune séance notée pour l\'instant.</p>'}
    </section>`;
}

function climbStats() {
  const climbs = state.climbs || [];
  if (!climbs.length) return gradeLine(state.logs);
  const since = new Date();
  since.setDate(since.getDate() - 56);
  const recent = climbs.filter((c) => sentClimb(c) && c.date >= ymd(since));
  const max = (kind) => recent.filter((c) => c.kind === kind).reduce((m, c) => Math.max(m, GRADES.indexOf(c.grade)), -1);
  const goal = GRADES.indexOf('7a');
  const voie = max('voie');
  const bloc = max('bloc');
  const gap = voie < 0 ? '' : voie >= goal ? ' · objectif 7a atteint 🎉' : ` · encore ${goal - voie} cotation${goal - voie > 1 ? 's' : ''} avant le 7a`;
  return `<p class="small">Sur 8 semaines : max en voie <strong>${voie < 0 ? '–' : GRADES[voie]}</strong>${gap}, en bloc <strong>${bloc < 0 ? '–' : GRADES[bloc]}</strong>.</p>
    ${climbChart(climbs)}${climbPyramid(climbs)}`;
}

function liftTable() {
  const list = Object.entries(state.lifts || {}).filter(([, l]) => l.length)
    .sort((a, b) => b[1].at(-1).date.localeCompare(a[1].at(-1).date));
  if (!list.length) return '<p class="empty">Note tes séries pendant la séance guidée, ou avec le bouton 📒 d\'un exercice.</p>';
  const delta = (p) => {
    if (!p || !p.delta) return p ? '=' : '';
    const v = `${p.delta > 0 ? '+' : ''}${String(p.delta).replace('.', ',')} ${p.kind === 'kg' ? 'kg' : 'rép.'}`;
    return p.delta > 0 ? `<span class="up">▲ ${v}</span>` : `<span class="down">▼ ${v}</span>`;
  };
  return `<div class="table-scroll"><table class="table lifts"><thead><tr><th>Exercice</th><th>Dernière fois</th><th class="num">Évol.</th></tr></thead><tbody>
    ${list.map(([name, l]) => `<tr><td>${esc(name)}<br><span class="muted small">${l.length} séance${l.length > 1 ? 's' : ''}</span></td>
      <td>${formatSets(l.at(-1))}<br><span class="muted small">${shortDate(l.at(-1).date)}</span></td><td class="num">${delta(liftProgress(l))}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function benchTable() {
  const list = (state.benchmarks || []).slice(-3);
  const due = benchDue(state);
  if (!list.length) return '<p class="empty">Aucune prise de référence. Lance-la depuis l\'onglet Aujourd\'hui.</p>';
  const d = (b) => parseYmd(b.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const rows = BENCH_TESTS.filter((t) => list.some((b) => b[t.key])).map((t) => {
    const vals = list.map((b) => b[t.key]);
    const known = vals.filter((v) => v != null);
    const delta = known.length > 1 ? known.at(-1) - known.at(-2) : null;
    return `<tr><td>${t.label}</td>${vals.map((v) => `<td class="num">${v ?? '–'}</td>`).join('')}
      <td class="num">${delta == null ? '' : delta > 0 ? `<span class="up">▲ +${delta}</span>` : delta < 0 ? `<span class="down">▼ ${delta}</span>` : '='}</td></tr>`;
  }).join('');
  return `<p class="small muted">${due.due ? 'Une nouvelle prise de référence est conseillée.' : `Prochaine dans ${due.inDays} jours.`}</p>
    <div class="table-scroll"><table class="table"><thead><tr><th>Test</th>${list.map((b) => `<th class="num">${d(b)}</th>`).join('')}<th class="num">Évol.</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

// ---------- Réglages ----------
function renderSettings() {
  const s = state.settings;
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const sched = SCHEDULES[s.sessionsPerWeek];
  return `<h1>Réglages</h1>
    <form class="card stack" data-form="settings">
      <h2>Programme</h2>
      <label>Séances par semaine <select name="sessionsPerWeek">${[3, 4, 5].map((n) => `<option ${n === s.sessionsPerWeek ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Début du programme (lundi) <input type="date" name="startDate" value="${s.startDate}"></label>
      <div class="grid3">
        <label>Midi <input type="time" name="midi" value="${s.times.midi}"></label>
        <label>Soir <input type="time" name="soir" value="${s.times.soir}"></label>
        <label>Week-end <input type="time" name="weekend" value="${s.times.weekend}"></label>
      </div>
      <h2>Mes accès</h2>
      <p class="small muted">Sans abonnement, les séances sont remplacées par des versions à la maison (barre de traction, haltère, gilet lesté, pompes). Sans course, le cardio passe sur vélo ou rameur en salle, ou en circuit à la maison.</p>
      <label class="row"><input type="checkbox" name="accessEscalade" ${s.access.escalade ? 'checked' : ''}> Salle d'escalade</label>
      <label class="row"><input type="checkbox" name="accessMuscu" ${s.access.muscu ? 'checked' : ''}> Salle de muscu</label>
      <label class="row"><input type="checkbox" name="accessCourse" ${s.access.course !== false ? 'checked' : ''}> Je peux courir</label>
      <h2>Chrono</h2>
      <label class="row"><input type="checkbox" name="sound" ${s.sound ? 'checked' : ''}> Signal sonore</label>
      <label class="row"><input type="checkbox" name="vibrate" ${s.vibrate ? 'checked' : ''}> Vibration</label>
      <label class="row"><input type="checkbox" name="voice" ${s.voice ? 'checked' : ''}> Annonces vocales pendant la séance guidée</label>
      <button class="primary">Enregistrer</button>
    </form>
    <section class="card stack">
      <h2>Notifications</h2>
      <p class="small muted">Fin de chrono et conseil du jour. Le rappel automatique appli fermée dépend d'Android : installe l'appli sur l'écran d'accueil et ouvre-la de temps en temps pour qu'il reste actif.</p>
      <p class="small">État : <strong>${perm === 'granted' && s.notifications ? 'activées' : perm === 'denied' ? 'bloquées dans le navigateur' : perm === 'unsupported' ? 'non disponibles' : 'désactivées'}</strong></p>
      <div class="row-btns">
        <button data-action="notif-on" class="primary">Activer</button>
        <button data-action="notif-test">Tester</button>
      </div>
    </section>
    <section class="card stack">
      <h2>Rappels dans Google Agenda</h2>
      <p class="small muted">Le plus fiable pour être prévenu avant chaque séance : un événement récurrent par créneau, avec le rappel de ton agenda.</p>
      ${sched.map((x) => { const b = buildSession(x.key, new Date(), state); return `<a class="btn" target="_blank" rel="noopener" href="${googleLink(x, state)}">+ ${esc(b.title)} · ${DAYS[x.day].toLowerCase()} ${s.times[x.day >= 5 ? 'weekend' : x.slot]}</a>`; }).join('')}
      <button data-action="ics">Télécharger les 4 prochaines semaines (.ics)</button>
    </section>
    <section class="card stack" id="cloud-card">${cloudCard()}</section>
    <section class="card stack">
      <h2>Sauvegarde dans un fichier</h2>
      <p class="small muted">Une copie de secours de tes données, à garder où tu veux.</p>
      <div class="row-btns">
        <button data-action="export">Exporter</button>
        <label class="btn">Importer<input type="file" accept="application/json" data-action="import" hidden></label>
      </div>
      <button class="danger" data-action="reset">Tout réinitialiser</button>
      ${cloudStatus().user ? '<p class="small muted">Avec un compte connecté, la réinitialisation est aussi envoyée en ligne. Les sauvegardes des 7 derniers jours restent disponibles.</p>' : ''}
    </section>
    <p class="hint center">Installe l'appli : menu ⋮ de Chrome, puis « Ajouter à l'écran d'accueil ».</p>`;
}

// ---------- Compte et sauvegarde en ligne ----------
const CLOUD_ICON = { synced: '✓', pending: '⏳', syncing: '⏳', loading: '…', offline: '📴', error: '⚠️' };

function cloudLine(c) {
  if (c.state === 'error') return `⚠️ ${esc(c.error)}`;
  if (c.state === 'offline') return '📴 Hors ligne : envoi à la prochaine connexion.';
  if (c.state === 'loading') return 'Connexion…';
  if (c.state === 'syncing') return 'Synchronisation…';
  if (c.state === 'pending' || c.pending) return '⏳ Modifications en attente d\'envoi.';
  if (c.state === 'synced') return `✓ Tout est sauvegardé${c.lastSync ? ` (${new Date(c.lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})` : ''}.`;
  return '';
}

const cloudShape = (c) => `${c.user?.uid || ''}|${c.known?.email || ''}|${c.state === 'off'}`;

function cloudCard() {
  const c = cloudStatus();
  const intro = '<h2>Compte et sauvegarde en ligne</h2>';
  if (c.user) {
    return `${intro}
      <p>Connecté : <strong>${esc(c.user.email || c.user.name)}</strong></p>
      <p class="small" id="cloud-status">${cloudLine(c)}</p>
      <p class="small muted">Chaque changement est envoyé quelques secondes après. Une copie par jour est gardée 7 jours.</p>
      <div class="row-btns">
        <button data-action="cloud-sync">Synchroniser maintenant</button>
        <button data-action="cloud-backups">Sauvegardes en ligne</button>
      </div>
      <div id="cloud-backups"></div>
      <button class="danger" data-action="cloud-out">Se déconnecter</button>`;
  }
  if (c.known && c.state !== 'off') {
    return `${intro}
      <p>Compte : <strong>${esc(c.known.email || c.known.name)}</strong></p>
      <p class="small" id="cloud-status">${cloudLine(c)}</p>
      <button data-action="cloud-retry">Réessayer</button>`;
  }
  return `${intro}
    <p class="small muted">Connecte-toi avec le même compte que BeatForge : séances, charges, références, carnets et réglages sont sauvegardés en ligne quelques secondes après chaque changement, et retrouvés sur un autre téléphone. Sans compte, tout reste sur ce téléphone.</p>
    <button class="primary" data-action="cloud-google">Continuer avec Google</button>
    <details class="cloud-email">
      <summary class="small">Avec un e-mail et un mot de passe</summary>
      <form data-form="cloud-email" class="stack">
        <label>E-mail <input type="email" name="email" autocomplete="email" required></label>
        <label>Mot de passe <input type="password" name="password" autocomplete="current-password" minlength="6" required></label>
        <div class="row-btns">
          <button class="primary" name="mode" value="in">Se connecter</button>
          <button name="mode" value="up">Créer un compte</button>
        </div>
        <button type="button" class="link small" data-action="cloud-reset">Mot de passe oublié</button>
      </form>
    </details>
    <p class="small" id="cloud-status">${cloudLine(c)}</p>`;
}

let cloudDrawn = '';
function paintCloud() {
  const c = cloudStatus();
  const badge = $('#cloud-badge');
  badge.hidden = !(c.user || c.known);
  badge.textContent = `☁️ ${CLOUD_ICON[c.pending && c.state === 'synced' ? 'pending' : c.state] || ''}`;
  badge.title = cloudLine(c).replace(/<[^>]+>/g, '');
  const card = $('#cloud-card');
  if (!card) return;
  if (cloudShape(c) !== cloudDrawn) { cloudDrawn = cloudShape(c); card.innerHTML = cloudCard(); return; }
  const line = $('#cloud-status');
  if (line) line.innerHTML = cloudLine(c);
}

async function cloudAction(fn, okMsg) {
  try {
    await fn();
    if (okMsg) toast(okMsg);
  } catch (err) {
    toast(esc(err.message || 'Erreur.'), 5000);
    $('#cloud-card')?.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    const g = $('[data-action="cloud-google"]');
    if (g) g.textContent = 'Continuer avec Google';
  }
  paintCloud();
}

async function showBackups(box) {
  box.innerHTML = '<p class="small muted">Chargement…</p>';
  try {
    const list = await listBackups();
    box.innerHTML = list.length ? `<ul class="backup-list">${list.map((b) => `<li>
        <span>${parseYmd(b.id).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}<br><span class="muted small">${b.logs} séance${b.logs > 1 ? 's' : ''} notée${b.logs > 1 ? 's' : ''}</span></span>
        <button data-restore="${b.id}">Restaurer</button></li>`).join('')}</ul>
      <p class="small muted">Restaurer remplace tes données actuelles, ici et en ligne.</p>` : '<p class="small muted">Aucune sauvegarde pour l\'instant.</p>';
  } catch (err) {
    box.innerHTML = `<p class="small">⚠️ ${esc(err.message)}</p>`;
  }
}

// ---------- Événements ----------
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button, a');
  if (!t) return;
  unlockAudio();
  const d = t.dataset;
  if (d.go) return go(d.go);
  if (d.timer) return loadTimer(JSON.parse(d.timer));
  if (d.info !== undefined && d.info) return openGuide(d.info);
  if (d.action === 'close-sheet') { $('#sheet').hidden = true; return; }
  if (d.guided) return startGuided(d.guided);
  if (d.benchEdit) { editBench = d.benchEdit; refOpen = true; return render(); }
  if (d.action === 'resume-guided') return go('guided');
  if (d.g === 'toggle') {
    if (guided.running) { guided.pause(); stopSpeaking(); releaseWake(); } else { guided.start(); requestWake(); }
    return;
  }
  if (d.g === 'next') { recordGuidedLift(); return guided.next(); }
  if (d.bstep) {
    const input = t.closest('form').querySelector('input[name=value]');
    input.value = Math.max(0, (Number(input.value) || 0) + Number(d.bstep));
    return;
  }
  if (d.lstep) { const [field, dir] = d.lstep.split(':'); return stepLift(field, Number(dir)); }
  if (d.g === 'voice') {
    state.settings.voice = !state.settings.voice;
    save(state);
    t.textContent = state.settings.voice ? '🔊' : '🔇';
    if (!state.settings.voice) stopSpeaking();
    return toast(state.settings.voice ? 'Annonces vocales activées.' : 'Annonces vocales coupées.', 1500);
  }
  if (d.g === 'prev') return guided.prev();
  if (d.g === 'quit') {
    if (guided.done || t.dataset.confirm) return quitGuided();
    t.dataset.confirm = '1';
    t.textContent = 'Quitter ?';
    t.classList.add('confirm');
    setTimeout(() => { delete t.dataset.confirm; t.textContent = '✕'; t.classList.remove('confirm'); }, 3000);
    return;
  }
  if (d.preset) return loadTimer(PRESETS[d.preset].cfg);
  if (d.tmode) {
    const m = d.tmode;
    timer.reset(m === 'stopwatch' ? { mode: m } : m === 'countdown' ? { mode: m, seconds: customCfg.countdown, label: 'Minuteur' } : { mode: m, ...customCfg, label: 'Intervalles' });
    releaseWake();
    return render();
  }
  if (d.t === 'toggle') {
    if (timer.running) { timer.pause(); releaseWake(); } else { timer.start(); requestWake(); }
    return paintTimer();
  }
  if (d.t === 'reset') { timer.reset(timer.cfg); releaseWake(); return paintTimer(); }
  if (d.t === 'lap') return timer.lap();
  if (d.t === 'skip') return timer.skip();
  if (d.express) {
    state.express ||= {};
    if (state.express[d.express]) delete state.express[d.express]; else state.express[d.express] = true;
    delete state.checks[d.express];
    persist(); return render();
  }
  if (d.lift) { const [id, i] = d.lift.split('|'); return openLiftSheet(id, Number(i)); }
  if (d.formEdit) { formEdit = true; return render(); }
  if (d.slot) {
    const [id, slot] = d.slot.split('|');
    setSlot(state, id, slot);
    persist(); render();
    return toast(`Séance passée ${slot === 'midi' ? 'au midi' : 'au soir'} (${state.settings.times[slot]}), pour ce jour-là.`, 2500);
  }
  if (d.routineDone) {
    const r = findSession(d.routineDone);
    state.logs.push({ id: `${Date.now()}`, type: r.type, title: r.title, date: r.date, sessionIndex: r.index, key: r.key, variant: r.variant, home: true, bonus: true, mobility: true, feeling: 'ok', completed: true, zones: [], note: '' });
    state.logs.sort((a, b) => a.date.localeCompare(b.date));
    routineOpen = false;
    persist(); render();
    return toast('Routine notée 🧘 Ta nuque te remercie.', 2500);
  }
  if (d.heal) {
    healPain(state, d.heal, ymd(new Date()));
    persist(); render();
    return toast(`${ZONES[d.heal]} : exercices de nouveau proposés. Reprends en douceur.`);
  }
  if (d.climbDel) {
    state.climbs = (state.climbs || []).filter((c) => c.id !== d.climbDel);
    persist(); return render();
  }
  if (d.week) { weekOffset += Number(d.week); return render(); }
  if (d.open) { const [date, idx] = d.open.split('#'); openSession = { date, index: Number(idx) }; render(); return window.scrollTo(0, 0); }
  if (d.action === 'close-session') { openSession = null; return render(); }
  if (d.unlog) {
    const log = state.logs.find((l) => l.id === d.unlog);
    state.logs = state.logs.filter((l) => l.id !== d.unlog);
    persist(); render();
    return toast(`Note retirée (${esc(log?.title)}). Tu peux la refaire.`);
  }
  if (d.del) {
    state.logs = state.logs.filter((l) => l.id !== d.del);
    persist(); return render();
  }
  if (d.action === 'notif-on') return enableNotifications();
  if (d.action === 'notif-test') {
    if (window.Notification?.permission !== 'granted') return toast('Active d\'abord les notifications.');
    const reg = await navigator.serviceWorker.ready;
    return reg.showNotification('Personal Trainer', { body: `Test réussi ! ${tipFor('escalade')}`, icon: 'icons/icon-192.png', badge: 'icons/badge.png', vibrate: [200, 100, 200] });
  }
  if (d.action === 'ics') return downloadIcs(state);
  if (d.action === 'cloud-google') { t.disabled = true; t.textContent = 'Connexion…'; return cloudAction(signInGoogle); }
  if (d.action === 'cloud-reset') {
    const email = t.closest('form').querySelector('[name=email]').value;
    if (!email) return toast('Entre ton e-mail, puis appuie sur « Mot de passe oublié ».');
    return cloudAction(() => resetPassword(email), 'E-mail de réinitialisation envoyé.');
  }
  if (d.action === 'cloud-sync') return cloudAction(() => sync());
  if (d.action === 'cloud-retry') return cloudAction(startCloud);
  if (d.action === 'cloud-backups') return showBackups($('#cloud-backups'));
  if (d.action === 'cloud-out') {
    if (!t.dataset.confirm) {
      t.dataset.confirm = '1';
      t.textContent = 'Appuie encore : tes données restent sur ce téléphone';
      setTimeout(() => { delete t.dataset.confirm; t.textContent = 'Se déconnecter'; }, 4000);
      return;
    }
    return cloudAction(signOutCloud, 'Déconnecté. Tes données restent sur ce téléphone.');
  }
  if (d.restore) {
    if (!t.dataset.confirm) {
      t.dataset.confirm = '1';
      t.textContent = 'Confirmer ?';
      setTimeout(() => { delete t.dataset.confirm; t.textContent = 'Restaurer'; }, 4000);
      return;
    }
    return cloudAction(() => restoreBackup(d.restore), 'Sauvegarde restaurée.');
  }
  if (d.action === 'export') {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `personnal-trainer-${ymd(new Date())}.json` });
    a.click();
    return;
  }
  if (d.action === 'reset') {
    if (t.dataset.confirm) { state = { ...defaults(), updatedAt: state.updatedAt }; persist(); go('today'); return toast('Données réinitialisées.'); }
    t.dataset.confirm = '1';
    t.textContent = 'Appuie encore pour confirmer';
    setTimeout(() => { delete t.dataset.confirm; t.textContent = 'Tout réinitialiser'; }, 4000);
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.check) {
    const list = new Set(state.checks[t.dataset.check] || []);
    t.checked ? list.add(Number(t.dataset.i)) : list.delete(Number(t.dataset.i));
    state.checks[t.dataset.check] = [...list];
    t.closest('li').classList.toggle('done', t.checked);
    return save(state);
  }
  if (t.dataset.slotsel) {
    setSlot(state, t.dataset.slotsel, t.value);
    persist(); return render();
  }
  if (t.dataset.move) {
    const wk = (state.moves[t.dataset.monday] ||= {});
    wk[t.dataset.move] = Number(t.value);
    persist(); return render();
  }
  if (t.dataset.action === 'import' && t.files[0]) {
    t.files[0].text().then((txt) => {
      try {
        const data = JSON.parse(txt);
        if (!data.settings || !Array.isArray(data.logs)) throw new Error();
        state = normalize({ ...data, updatedAt: Math.max(data.updatedAt || 0, state.updatedAt || 0) });
        persist(); render(); toast('Données importées.');
      } catch { toast('Fichier invalide.'); }
    });
  }
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const fd = new FormData(f);
  const kind = f.dataset.form;
  if (kind === 'log' || kind === 'extra') return submitLog(f);
  if (kind === 'form') {
    setForm(state, f.dataset.date, Object.fromEntries(FORM_QUESTIONS.map((q) => [q.key, Number(fd.get(q.key))])));
    formEdit = false;
    persist(); render();
    const level = formLevel(state, f.dataset.date);
    return toast(`${FORM_LABELS[level]} : ${FORM_EFFECT[level]}.`, 3000);
  }
  if (kind === 'lift') {
    const s = findSession(f.dataset.id);
    const i = Number(f.dataset.ex);
    const e = s.exercises[i];
    const kg = e.load && fd.get('kg') !== '' ? Number(fd.get('kg')) : null;
    const done = Array.from({ length: e.sets }, (_, k) => Number(fd.get(`reps${k}`))).filter((r) => r > 0).map((reps) => ({ reps, kg }));
    saveLift(state, e.lift.key, s.date, done);
    if (done.length) {
      const list = new Set(state.checks[f.dataset.id] || []);
      list.add(i);
      state.checks[f.dataset.id] = [...list];
    }
    $('#sheet').hidden = true;
    persist(); render();
    if (!done.length) return toast('Séries effacées.');
    const next = suggestLift(e.lift.range, e.load && { ...e.load, kg }, { sets: done });
    return toast(`Séries enregistrées 📒<br>Prochaine fois : ${targetText(next)}${next.reason ? ` (${esc(next.reason)})` : ''}`, 5000);
  }
  if (kind === 'cloud-email') {
    const up = e.submitter?.value === 'up';
    f.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    return cloudAction(() => (up ? signUpEmail : signInEmail)(fd.get('email'), fd.get('password')), up ? 'Compte créé.' : null);
  }
  if (kind === 'bench-one') {
    const value = Number(fd.get('value'));
    if (!(value > 0)) return toast('Note un résultat, ou appuie sur « Plus tard ».');
    const t = BENCH_TESTS.find((b) => b.key === f.dataset.key);
    recordBench(state, f.dataset.date, t.key, value);
    $('#sheet').hidden = true;
    persist();
    if (view !== 'guided' || guided?.done) render();
    return toast(`${t.label} : ${value} ${UNIT_SHORT[t.unit]} enregistré 📏`, 2500);
  }
  if (kind === 'pain') {
    const zones = fd.getAll('zone');
    if (!zones.length) return toast('Choisis au moins une zone.');
    addPains(state, zones, f.dataset.date);
    painOpen = false;
    persist(); render();
    return toast(`Séances adaptées pour 7 jours (${zones.map((z) => ZONES[z].toLowerCase()).join(', ')}). Reprends dès que ça va mieux.`, 5000);
  }
  if (kind === 'climb') {
    const climb = { id: `${Date.now()}`, date: f.dataset.date, kind: fd.get('kind'), grade: fd.get('grade'), style: fd.get('style') };
    state.climbs = [...(state.climbs || []), climb];
    lastClimb = { kind: climb.kind, grade: climb.grade, open: climb.date };
    persist(); render();
    return toast(`${climb.kind === 'voie' ? 'Voie' : 'Bloc'} ${climb.grade} noté${climb.kind === 'voie' ? 'e' : ''} (${CLIMB_STYLES[climb.style].toLowerCase()}).`, 2000);
  }
  if (kind === 'bench') {
    const entry = { date: f.dataset.date };
    BENCH_TESTS.forEach(({ key }) => { const v = Number(fd.get(key)); if (v > 0) entry[key] = v; });
    if (Object.keys(entry).length === 1) return toast('Note au moins un résultat.');
    state.benchmarks = [...(state.benchmarks || []).filter((b) => b.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date));
    editBench = null;
    refOpen = true;
    persist(); render();
    return toast(['Références enregistrées 📏', ...benchSummary(state)].join('<br>'), 8000);
  }
  if (kind === 'countdown') {
    customCfg.countdown = Math.max(5, Number(fd.get('countdown')) || 90);
    timer.reset({ mode: 'countdown', seconds: customCfg.countdown, label: 'Minuteur' });
    return render();
  }
  if (kind === 'interval') {
    ['work', 'rest', 'rounds', 'sets', 'setRest'].forEach((k) => { customCfg[k] = Math.max(k === 'rest' || k === 'setRest' ? 0 : 1, Number(fd.get(k)) || 0); });
    timer.reset({ mode: 'interval', ...customCfg, label: 'Intervalles' });
    return render();
  }
  if (kind === 'settings') {
    const s = state.settings;
    s.sessionsPerWeek = Number(fd.get('sessionsPerWeek'));
    const start = fd.get('startDate');
    if (start) s.startDate = ymd(mondayOf(parseYmd(start)));
    s.times = { midi: fd.get('midi'), soir: fd.get('soir'), weekend: fd.get('weekend') };
    s.access = { escalade: !!fd.get('accessEscalade'), muscu: !!fd.get('accessMuscu'), course: !!fd.get('accessCourse') };
    s.sound = !!fd.get('sound');
    s.vibrate = !!fd.get('vibrate');
    s.voice = !!fd.get('voice');
    persist(); render(); toast('Réglages enregistrés.');
  }
});

$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') e.currentTarget.hidden = true; });

// ---------- Démarrage ----------
bindTooltips(document.body);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
render();
writePlan();
onSave(stateSaved);
onCloud(paintCloud);
initCloud({
  getState: () => state,
  // Données venues du compte (autre téléphone, fusion ou restauration).
  setState: (s) => {
    state = normalize(s);
    save(state, { touch: false });
    writePlan();
    render();
  },
});
paintCloud();
