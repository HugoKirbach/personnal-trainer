// Graphiques SVG faits main (aucune dépendance, fonctionne hors ligne).
import { GRADES, TYPES, mondayOf, ymd, parseYmd } from './program.js';

const ORDER = ['escalade', 'muscu', 'cardio'];
const FEEL = { facile: 3, ok: 2, dur: 1 };
const FEEL_LABEL = { 3: 'Facile', 2: 'OK', 1: 'Dur' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function legend(types = ORDER) {
  return `<div class="legend">${types.map((t) => `<span><i style="background:${TYPES[t].color}"></i>${TYPES[t].label}</span>`).join('')}</div>`;
}

function frame(w, h, inner) {
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img">${inner}</svg>`;
}

// Séances réalisées par semaine, empilées par type.
export function weeklyBars(logs, weeks = 8) {
  const W = 340, H = 180, L = 26, B = 24, T = 10;
  const start = mondayOf(new Date());
  const cols = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const m = new Date(start);
    m.setDate(m.getDate() - 7 * i);
    const key = ymd(m);
    const counts = Object.fromEntries(ORDER.map((t) => [t, 0]));
    logs.forEach((l) => { if (ymd(mondayOf(parseYmd(l.date))) === key) counts[l.type]++; });
    cols.push({ m, counts, total: ORDER.reduce((s, t) => s + counts[t], 0) });
  }
  const max = Math.max(5, ...cols.map((c) => c.total));
  const step = (W - L) / weeks;
  const bw = Math.min(22, step * 0.6);
  const y = (v) => H - B - (v / max) * (H - B - T);
  let g = '';
  for (let v = 0; v <= max; v++) {
    if (v % (max > 6 ? 2 : 1)) continue;
    g += `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${v}</text>`;
  }
  cols.forEach((c, i) => {
    const x = L + i * step + (step - bw) / 2;
    let acc = 0;
    const tip = `Semaine du ${c.m.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} : ${c.total} séance(s)<br>${ORDER.map((t) => `${TYPES[t].label} : ${c.counts[t]}`).join('<br>')}`;
    const segs = ORDER.filter((t) => c.counts[t]);
    segs.forEach((t, k) => {
      const y0 = y(acc), y1 = y(acc + c.counts[t]);
      const top = k === segs.length - 1;
      const hgt = Math.max(0, y0 - y1 - 2); // 2px d'écart entre segments
      g += top
        ? `<path d="${roundedTop(x, y1, bw, hgt)}" fill="${TYPES[t].color}"/>`
        : `<rect x="${x}" y="${y1 + 2}" width="${bw}" height="${hgt}" fill="${TYPES[t].color}"/>`;
      acc += c.counts[t];
    });
    g += `<rect x="${L + i * step}" y="${T}" width="${step}" height="${H - B - T}" class="hit" data-tip="${esc(tip)}"/>`;
    if (i % 2 === weeks % 2 || weeks <= 6) g += `<text x="${x + bw / 2}" y="${H - 6}" class="axis" text-anchor="middle">${c.m.getDate()}/${c.m.getMonth() + 1}</text>`;
  });
  return legend() + frame(W, H, g);
}

function roundedTop(x, y, w, h) {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

// Ressenti des dernières séances (Dur / OK / Facile).
export function feelingDots(logs, n = 20) {
  const items = logs.slice(-n);
  if (!items.length) return empty('Le ressenti s\'affichera après ta première séance notée.');
  const W = 340, H = 150, L = 50, R = 12, T = 14, B = 22;
  const y = (v) => T + (3 - v) * ((H - T - B) / 2);
  const x = (i) => L + (items.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (items.length - 1));
  let g = '';
  [3, 2, 1].forEach((v) => { g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 8}" y="${y(v) + 4}" class="axis" text-anchor="end">${FEEL_LABEL[v]}</text>`; });
  g += `<polyline points="${items.map((l, i) => `${x(i)},${y(FEEL[l.feeling])}`).join(' ')}" class="trend"/>`;
  items.forEach((l, i) => {
    const tip = `${parseYmd(l.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}<br>${esc(l.title)}<br>Ressenti : ${FEEL_LABEL[FEEL[l.feeling]]}${l.completed === false ? '<br>Arrêtée avant la fin' : ''}${l.maxGrade ? `<br>Max : ${l.maxGrade}` : ''}`;
    const cx = x(i), cy = y(FEEL[l.feeling]);
    g += l.completed === false
      ? `<rect x="${cx - 5}" y="${cy - 5}" width="10" height="10" fill="${TYPES[l.type].color}" class="ring"/>`
      : `<circle cx="${cx}" cy="${cy}" r="5" fill="${TYPES[l.type].color}" class="ring"/>`;
    g += `<circle cx="${cx}" cy="${cy}" r="14" class="hit" data-tip="${esc(tip)}"/>`;
  });
  return legend() + frame(W, H, g) + '<p class="hint">Carré : séance arrêtée avant la fin.</p>';
}

// Cotation maximale enchaînée en escalade.
export function gradeLine(logs) {
  const items = logs.filter((l) => l.type === 'escalade' && l.maxGrade);
  if (!items.length) return empty('Note ta cotation max après une séance d\'escalade pour suivre ta progression vers le 7a.');
  const idx = items.map((l) => GRADES.indexOf(l.maxGrade));
  const lo = Math.max(0, Math.min(...idx) - 1), hi = Math.min(GRADES.length - 1, Math.max(...idx, GRADES.indexOf('7a')));
  const W = 340, H = 170, L = 40, R = 12, T = 12, B = 22;
  const y = (v) => H - B - ((v - lo) / Math.max(1, hi - lo)) * (H - T - B);
  const x = (i) => L + (items.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (items.length - 1));
  let g = '';
  for (let v = lo; v <= hi; v++) {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid${GRADES[v] === '7a' ? ' goal' : ''}"/><text x="${L - 8}" y="${y(v) + 4}" class="axis" text-anchor="end">${GRADES[v]}</text>`;
  }
  g += `<polyline points="${idx.map((v, i) => `${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round"/>`;
  items.forEach((l, i) => {
    g += `<circle cx="${x(i)}" cy="${y(idx[i])}" r="4.5" fill="var(--series-1)" class="ring"/>`;
    g += `<circle cx="${x(i)}" cy="${y(idx[i])}" r="14" class="hit" data-tip="${esc(`${parseYmd(l.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${l.title}<br>Max enchaîné : ${l.maxGrade}`)}"/>`;
  });
  return frame(W, H, g) + '<p class="hint">Ligne pointillée : objectif 7a.</p>';
}

// ---------- Carnet d'escalade ----------
export const CLIMB_STYLES = { flash: 'Flash', enchaine: 'Enchaîné', travail: 'En travail' };
const KINDS = { voie: { label: 'Voie', opacity: 1 }, bloc: { label: 'Bloc', opacity: 0.45 } };
const sent = (c) => c.style !== 'travail';

function climbLegend() {
  return `<div class="legend">${Object.entries(KINDS).map(([, k]) => `<span><i style="background:var(--series-1);opacity:${k.opacity}"></i>${k.label}</span>`).join('')}</div>`;
}

// Cotation max enchaînée chaque semaine, en voie et en bloc.
export function climbChart(climbs, weeks = 12) {
  const sends = climbs.filter(sent);
  if (!sends.length) return empty('Note tes voies et blocs enchaînés pendant tes séances en salle pour suivre ta progression vers le 7a.');
  const start = mondayOf(new Date());
  start.setDate(start.getDate() - 7 * (weeks - 1));
  const first = mondayOf(parseYmd(sends[0].date));
  const from = first > start ? first : start;
  const cols = [];
  for (let m = new Date(from); m <= mondayOf(new Date()); m.setDate(m.getDate() + 7)) {
    const key = ymd(m);
    const max = {};
    sends.forEach((c) => {
      if (ymd(mondayOf(parseYmd(c.date))) !== key) return;
      max[c.kind] = Math.max(max[c.kind] ?? -1, GRADES.indexOf(c.grade));
    });
    cols.push({ m: new Date(m), max });
  }
  const all = cols.flatMap((c) => Object.values(c.max));
  if (!all.length) return empty('Aucune voie ni bloc enchaîné ces dernières semaines.');
  const lo = Math.max(0, Math.min(...all) - 1), hi = Math.min(GRADES.length - 1, Math.max(...all, GRADES.indexOf('7a')));
  const W = 340, H = 180, L = 40, R = 12, T = 12, B = 22;
  const y = (v) => H - B - ((v - lo) / Math.max(1, hi - lo)) * (H - T - B);
  const step = (W - L - R) / Math.max(1, cols.length);
  const x = (i) => L + step * i + step / 2;
  let g = '';
  for (let v = lo; v <= hi; v++) {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid${GRADES[v] === '7a' ? ' goal' : ''}"/><text x="${L - 8}" y="${y(v) + 4}" class="axis" text-anchor="end">${GRADES[v]}</text>`;
  }
  Object.entries(KINDS).forEach(([kind, k]) => {
    // Une ligne par suite de semaines consécutives : pas de trait à travers une semaine sans grimpe.
    let seg = [];
    const flush = () => {
      if (seg.length > 1) g += `<polyline points="${seg.join(' ')}" fill="none" stroke="var(--series-1)" stroke-opacity="${k.opacity}" stroke-width="2" stroke-linejoin="round"/>`;
      seg = [];
    };
    cols.forEach((c, i) => {
      if (c.max[kind] == null) return flush();
      seg.push(`${x(i)},${y(c.max[kind])}`);
    });
    flush();
    cols.forEach((c, i) => {
      if (c.max[kind] == null) return;
      g += kind === 'voie'
        ? `<circle cx="${x(i)}" cy="${y(c.max[kind])}" r="4.5" fill="var(--series-1)" class="ring"/>`
        : `<rect x="${x(i) - 4.5}" y="${y(c.max[kind]) - 4.5}" width="9" height="9" rx="1.5" fill="var(--series-1)" fill-opacity="${k.opacity}" class="ring"/>`;
    });
  });
  cols.forEach((c, i) => {
    const tip = `Semaine du ${c.m.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}<br>${Object.entries(KINDS).map(([kind, k]) => `${k.label} : ${c.max[kind] != null ? GRADES[c.max[kind]] : '–'}`).join('<br>')}`;
    g += `<rect x="${L + step * i}" y="${T}" width="${step}" height="${H - B - T}" class="hit" data-tip="${esc(tip)}"/>`;
    if (cols.length <= 6 || i % 2 === (cols.length - 1) % 2) g += `<text x="${x(i)}" y="${H - 6}" class="axis" text-anchor="middle">${c.m.getDate()}/${c.m.getMonth() + 1}</text>`;
  });
  return climbLegend() + frame(W, H, g) + '<p class="hint">Max enchaîné par semaine. Ligne pointillée : objectif 7a.</p>';
}

// Pyramide : nombre de voies et blocs enchaînés par cotation sur les dernières semaines.
export function climbPyramid(climbs, weeks = 8) {
  const since = new Date();
  since.setDate(since.getDate() - 7 * weeks);
  const list = climbs.filter((c) => sent(c) && c.date >= ymd(since));
  if (!list.length) return '';
  const idx = list.map((c) => GRADES.indexOf(c.grade));
  const rows = [];
  for (let v = Math.max(...idx); v >= Math.min(...idx); v--) {
    const at = list.filter((c) => c.grade === GRADES[v]);
    rows.push({ grade: GRADES[v], voie: at.filter((c) => c.kind === 'voie').length, bloc: at.filter((c) => c.kind === 'bloc').length, flash: at.filter((c) => c.style === 'flash').length });
  }
  const max = Math.max(...rows.map((r) => r.voie + r.bloc));
  const W = 340, L = 40, R = 30, row = 22, H = rows.length * row + 4;
  const w = (n) => (n / max) * (W - L - R);
  let g = '';
  rows.forEach((r, i) => {
    const y0 = 2 + i * row;
    const tip = `${r.grade} : ${r.voie} voie${r.voie > 1 ? 's' : ''}, ${r.bloc} bloc${r.bloc > 1 ? 's' : ''}${r.flash ? ` (dont ${r.flash} flash)` : ''}`;
    g += `<text x="${L - 8}" y="${y0 + 15}" class="axis" text-anchor="end">${r.grade}</text>`;
    if (r.voie) g += `<rect x="${L}" y="${y0 + 3}" width="${Math.max(0, w(r.voie) - (r.bloc ? 2 : 0))}" height="${row - 6}" rx="3" fill="var(--series-1)"/>`;
    if (r.bloc) g += `<rect x="${L + w(r.voie)}" y="${y0 + 3}" width="${w(r.bloc)}" height="${row - 6}" rx="3" fill="var(--series-1)" fill-opacity="${KINDS.bloc.opacity}"/>`;
    g += `<text x="${L + w(r.voie + r.bloc) + 6}" y="${y0 + 15}" class="axis value">${r.voie + r.bloc}</text>`;
    g += `<rect x="0" y="${y0}" width="${W}" height="${row}" class="hit" data-tip="${esc(tip)}"/>`;
  });
  return `<h3>Pyramide des ${weeks} dernières semaines</h3>${frame(W, H, g)}`;
}

function empty(text) {
  return `<p class="empty">${text}</p>`;
}

// Infobulle partagée : survol à la souris, appui au doigt.
export function bindTooltips(root) {
  let tip = document.getElementById('tooltip');
  root.addEventListener('pointerover', show);
  root.addEventListener('pointerdown', show);
  root.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse' && e.target.dataset?.tip) tip.hidden = true; });
  document.addEventListener('pointerdown', (e) => { if (!e.target.dataset?.tip) tip.hidden = true; });
  function show(e) {
    const t = e.target.closest?.('[data-tip]');
    if (!t) return;
    tip.innerHTML = t.dataset.tip;
    tip.hidden = false;
    const r = t.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const left = Math.min(window.innerWidth - tw - 8, Math.max(8, r.left + r.width / 2 - tw / 2));
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, r.top + window.scrollY - tip.offsetHeight - 8)}px`;
  }
}
