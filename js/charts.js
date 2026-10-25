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
