import {
  DAYS, GRADES, TYPES, SCHEDULES, adapt, buildSession, mondayOf, parseYmd, sessionsOn, tipFor, weekInfo, weekSessions, ymd,
} from './program.js';
import { load, save, defaults } from './store.js';
import { Timer, PRESETS, fmt, unlockAudio } from './timer.js';
import { weeklyBars, feelingDots, gradeLine, bindTooltips } from './charts.js';
import { downloadIcs, googleLink } from './calendar.js';

let state = load();
let view = 'today';
let weekOffset = 0;
let openSession = null; // { date, index } affiché en détail depuis la semaine
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const persist = () => { save(state); writePlan(); };

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
  if (!document.hidden && timer.running) { requestWake(); timer.tick(); }
});

function loadTimer(cfg) {
  timer.reset(cfg);
  releaseWake();
  go('timer');
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
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.go === view));
  const info = weekInfo(new Date(), state.settings.startDate);
  $('#week-badge').textContent = `Semaine ${info.week} · ${info.phase.name}`;
  const main = $('#main');
  main.innerHTML = {
    today: renderToday, week: renderWeek, timer: renderTimer, stats: renderStats, settings: renderSettings,
  }[view]();
  if (view === 'timer') paintTimer();
}

// ---------- Aujourd'hui ----------
function renderToday() {
  const now = new Date();
  const list = sessionsOn(now, state);
  const dateLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  let html = `<h1 class="cap">${dateLabel}</h1>`;
  if (!list.length) {
    const next = nextSession(now);
    html += `<section class="card rest"><h2>Jour de repos</h2><p>Récupère bien : marche, mobilité douce de la nuque et du dos, hydratation.</p>
      ${next ? `<p class="muted">Prochaine séance : <strong>${esc(next.title)}</strong>, ${parseYmd(next.date).toLocaleDateString('fr-FR', { weekday: 'long' })} à ${next.time}.</p>` : ''}
      <p class="tip">💡 ${esc(tipFor('general'))}</p></section>`;
  }
  list.forEach((s) => { html += sessionCard(s); });
  html += `<details class="card"><summary>Noter une séance hors programme</summary>
    <form data-form="extra" class="stack">
      <label>Type <select name="type">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}</select></label>
      <label>Intitulé <input name="title" placeholder="Ex. grimpe avec des potes" required></label>
      ${feedbackFields('extra', true)}
      <button class="primary">Enregistrer</button>
    </form></details>`;
  return html;
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
  const hasRun = s.type === 'cardio' || ['bas', 'full'].includes(s.key);
  return `<section class="card session" style="--accent:${TYPES[s.type].color}">
    <div class="session-head">
      <span class="pill">${TYPES[s.type].label}</span>
      <span class="muted">${slotLabel(s.slot)} · ${s.time} · ${s.duration}</span>
    </div>
    <h2>${esc(s.title)}</h2>
    <p class="muted small">Semaine ${s.week} · ${s.phase.name} : ${s.phase.note}</p>
    <p class="tip">💡 ${esc(tipFor(s.type, parseYmd(s.date).getTime()))}</p>
    <ol class="exercises">
      ${s.exercises.map((e, i) => `<li class="${done.includes(i) ? 'done' : ''}">
        <label class="check"><input type="checkbox" data-check="${id}" data-i="${i}" ${done.includes(i) ? 'checked' : ''}>
          <span><strong>${esc(e.name)}</strong><br><span class="small">${esc(e.detail)}</span></span></label>
        ${e.timer ? `<button class="icon-btn" data-timer='${esc(JSON.stringify(e.timer))}' aria-label="Lancer le chrono">⏱</button>` : ''}
      </li>`).join('')}
    </ol>
    ${log ? `<div class="logged">✓ Séance notée : <strong>${feelLabel(log.feeling)}</strong>${log.completed === false ? ', arrêtée avant la fin' : ''}${log.maxGrade ? `, max ${log.maxGrade}` : ''}
        <button class="link" data-unlog="${log.id}">Modifier</button></div>`
    : `<form data-form="log" data-date="${s.date}" data-index="${s.index}" class="stack feedback">
        <h3>Comment ça s'est passé ?</h3>
        ${feedbackFields(id, false, s.type, hasRun)}
        <button class="primary">Terminer la séance</button>
      </form>`}
  </section>`;
}

function feedbackFields(id, free, type, hasRun) {
  return `<div class="seg" role="radiogroup" aria-label="Ressenti">
      ${['facile', 'ok', 'dur'].map((f) => `<label><input type="radio" name="feeling" value="${f}" required><span>${feelLabel(f)}</span></label>`).join('')}
    </div>
    ${free || hasRun ? `<label class="row"><input type="checkbox" name="stopped"> J'ai arrêté ${free ? 'la séance' : 'la course'} avant la fin</label>` : ''}
    ${free || type === 'escalade' ? `<label>Cotation max enchaînée (escalade) <select name="maxGrade"><option value="">—</option>${GRADES.map((g) => `<option>${g}</option>`).join('')}</select></label>` : ''}
    <label class="row"><input type="checkbox" name="pain"> Douleur (doigts, nuque, dos…)</label>
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
    const date = parseYmd(form.dataset.date);
    const s = weekSessions(mondayOf(date), state).find((x) => x.index === Number(form.dataset.index));
    base = { type: s.type, title: s.title, date: s.date, sessionIndex: s.index, key: s.key };
  }
  const log = {
    ...base,
    id: `${Date.now()}`,
    feeling: fd.get('feeling'),
    completed: !fd.get('stopped'),
    maxGrade: fd.get('maxGrade') || null,
    pain: !!fd.get('pain'),
    note: fd.get('note') || '',
  };
  state.logs.push(log);
  state.logs.sort((a, b) => a.date.localeCompare(b.date));
  const msgs = adapt(state, log);
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
              </select></label></div>`;
          }).join('') : '<span class="muted small">Repos</span>'}</div></li>`;
      }).join('')}
    </ul>
    <p class="hint">Un déplacement ne concerne que cette semaine. Évite deux séances d'escalade deux jours de suite pour tes doigts.</p>`;
}

// ---------- Chrono ----------
function renderTimer() {
  const mode = timer.cfg.mode;
  return `<div class="seg tabs" role="tablist">
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

// ---------- Suivi ----------
function renderStats() {
  const logs = state.logs;
  const now = new Date();
  const month = logs.filter((l) => l.date.slice(0, 7) === ymd(now).slice(0, 7)).length;
  const planned = weekSessions(mondayOf(now), state).filter((s) => s.date <= ymd(now)).length;
  const doneWeek = logs.filter((l) => !l.extra && ymd(mondayOf(parseYmd(l.date))) === ymd(mondayOf(now))).length;
  const a = state.adapt;
  const pct = (v) => `${Math.round(v * 100)} %`;
  return `<h1>Suivi</h1>
    <div class="tiles">
      <div class="tile"><span class="big-num">${month}</span><span>séances ce mois</span></div>
      <div class="tile"><span class="big-num">${doneWeek}/${planned || 0}</span><span>prévues réalisées cette semaine</span></div>
      <div class="tile"><span class="big-num">${GRADES[a.gradeIdx]}</span><span>niveau cible escalade</span></div>
    </div>
    <section class="card"><h2>Séances par semaine</h2>${weeklyBars(logs)}</section>
    <section class="card"><h2>Ressenti</h2>${feelingDots(logs)}</section>
    <section class="card"><h2>Progression en voie</h2>${gradeLine(logs)}</section>
    <section class="card"><h2>Intensité du programme</h2>
      <p class="muted small">100 % = programme de base. L'appli ajuste selon ton ressenti.</p>
      <table class="table"><tbody>
        ${Object.keys(TYPES).map((t) => `<tr><td><i class="dot" style="background:${TYPES[t].color}"></i>${TYPES[t].label}</td><td class="num">${pct(a[t])}</td></tr>`).join('')}
      </tbody></table></section>
    <section class="card"><h2>Historique</h2>
      ${logs.length ? `<table class="table"><thead><tr><th>Date</th><th>Séance</th><th>Ressenti</th><th></th></tr></thead><tbody>
        ${[...logs].reverse().map((l) => `<tr><td>${parseYmd(l.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</td>
          <td><i class="dot" style="background:${TYPES[l.type].color}"></i>${esc(l.title)}${l.maxGrade ? ` · ${l.maxGrade}` : ''}${l.completed === false ? ' · arrêtée' : ''}${l.pain ? ' · douleur' : ''}${l.note ? `<br><span class="muted small">${esc(l.note)}</span>` : ''}</td>
          <td>${feelLabel(l.feeling)}</td><td><button class="link" data-del="${l.id}" aria-label="Supprimer">✕</button></td></tr>`).join('')}
      </tbody></table>` : '<p class="empty">Aucune séance notée pour l\'instant.</p>'}
    </section>`;
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
      <h2>Chrono</h2>
      <label class="row"><input type="checkbox" name="sound" ${s.sound ? 'checked' : ''}> Signal sonore</label>
      <label class="row"><input type="checkbox" name="vibrate" ${s.vibrate ? 'checked' : ''}> Vibration</label>
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
    <section class="card stack">
      <h2>Sauvegarde</h2>
      <p class="small muted">Tes données restent sur ce téléphone. Exporte-les de temps en temps.</p>
      <div class="row-btns">
        <button data-action="export">Exporter</button>
        <label class="btn">Importer<input type="file" accept="application/json" data-action="import" hidden></label>
      </div>
      <button class="danger" data-action="reset">Tout réinitialiser</button>
    </section>
    <p class="hint center">Installe l'appli : menu ⋮ de Chrome, puis « Ajouter à l'écran d'accueil ».</p>`;
}

// ---------- Événements ----------
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button, a');
  if (!t) return;
  unlockAudio();
  const d = t.dataset;
  if (d.go) return go(d.go);
  if (d.timer) return loadTimer(JSON.parse(d.timer));
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
  if (d.action === 'export') {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `personnal-trainer-${ymd(new Date())}.json` });
    a.click();
    return;
  }
  if (d.action === 'reset') {
    if (t.dataset.confirm) { state = defaults(); persist(); go('today'); return toast('Données réinitialisées.'); }
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
        state = { ...defaults(), ...data };
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
    s.sound = !!fd.get('sound');
    s.vibrate = !!fd.get('vibrate');
    persist(); render(); toast('Réglages enregistrés.');
  }
});

// ---------- Démarrage ----------
bindTooltips(document.body);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
render();
writePlan();
