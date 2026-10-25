import test from 'node:test';
import assert from 'node:assert/strict';
import { benchDue, latestBench, prescriptions, referenceSession, vmaFromCooper, durationLabel, fmtDuration, resolveKey, SCHEDULES, TEMPLATE_KEYS, adapt, buildSession, mondayOf, weekInfo, weekSessions, ymd, parseYmd, activePains, addPains, healPain, strainOf, ZONES, absSession, recordBench, formLevel, setForm, routineSession, setSlot } from '../js/program.js';

const baseState = () => ({
  settings: { sessionsPerWeek: 4, startDate: '2026-10-26', times: { midi: '12:15', soir: '18:00', weekend: '10:00' }, access: { escalade: true, muscu: true } },
  adapt: { escalade: 1, muscu: 1, cardio: 1, gradeIdx: 3 },
  logs: [],
  moves: {},
});

test('mondayOf renvoie le lundi de la semaine', () => {
  assert.equal(ymd(mondayOf(parseYmd('2026-11-01'))), '2026-10-26'); // dimanche
  assert.equal(ymd(mondayOf(parseYmd('2026-10-26'))), '2026-10-26');
});

test('cycle de 4 semaines avec décharge en semaine 4', () => {
  const s = '2026-10-26';
  assert.equal(weekInfo(parseYmd('2026-10-27'), s).week, 1);
  assert.equal(weekInfo(parseYmd('2026-11-16'), s).phase.name, 'Décharge');
  assert.equal(weekInfo(parseYmd('2026-11-23'), s).cycle, 2);
  assert.ok(weekInfo(parseYmd('2026-11-16'), s).mult < weekInfo(parseYmd('2026-11-09'), s).mult);
});

test('chaque répartition donne le bon nombre de séances, sans escalade deux jours de suite', () => {
  for (const n of [3, 4, 5]) {
    const st = { ...baseState(), settings: { ...baseState().settings, sessionsPerWeek: n } };
    const list = weekSessions(parseYmd('2026-10-26'), st);
    assert.equal(list.length, n);
    const climbDays = list.filter((x) => x.type === 'escalade').map((x) => x.day).sort();
    for (let i = 1; i < climbDays.length; i++) assert.ok(climbDays[i] - climbDays[i - 1] > 1);
  }
});

test('tous les modèles produisent des exercices valides', () => {
  const st = baseState();
  for (const key of TEMPLATE_KEYS) {
    for (const d of ['2026-10-27', '2026-11-30', '2026-12-14']) {
      const s = buildSession(key, parseYmd(d), st);
      assert.ok(s.exercises.length >= 3, key);
      s.exercises.forEach((e) => {
        assert.ok(e.name && e.detail, key);
        assert.ok(!/undefined|NaN/.test(e.detail), `${key} : ${e.detail}`);
      });
    }
  }
});

test('pas de poutre avant la semaine 5', () => {
  const st = baseState();
  const early = buildSession('bloc', parseYmd('2026-11-04'), st);
  const later = buildSession('bloc', parseYmd('2026-11-25'), st);
  assert.ok(!early.exercises.some((e) => e.info === 'poutre'));
  assert.ok(later.exercises.some((e) => e.info === 'poutre'));
  assert.ok(early.notes.some((n) => n.includes('poutre')));
});

test('un déplacement ne touche que la semaine concernée', () => {
  const st = baseState();
  st.moves['2026-10-26'] = { 0: 1 };
  assert.equal(weekSessions(parseYmd('2026-10-26'), st)[0].day, 1);
  assert.equal(weekSessions(parseYmd('2026-11-02'), st)[0].day, 0);
});

test('adaptation : facile augmente, dur et douleur allègent', () => {
  const st = baseState();
  const push = (l) => { st.logs.push(l); return adapt(st, l); };
  push({ type: 'muscu', feeling: 'facile', completed: true });
  assert.equal(st.adapt.muscu, 1.05);
  push({ type: 'cardio', feeling: 'ok', completed: false });
  assert.equal(st.adapt.cardio, 0.93);
  push({ type: 'escalade', feeling: 'facile', completed: true });
  push({ type: 'escalade', feeling: 'facile', completed: true });
  assert.equal(st.adapt.gradeIdx, 4);
  const msgs = push({ type: 'escalade', feeling: 'ok', completed: true, pain: true });
  assert.equal(st.adapt.gradeIdx, 3);
  assert.ok(msgs.some((m) => m.includes('Douleur')));
});

test('le volume reste dans les bornes', () => {
  const st = baseState();
  for (let i = 0; i < 30; i++) { const l = { type: 'muscu', feeling: 'dur', completed: false }; st.logs.push(l); adapt(st, l); }
  assert.equal(st.adapt.muscu, 0.7);
});

test('la séance de 5 jours comprend du fractionné', () => {
  assert.ok(SCHEDULES[5].some((s) => s.key === 'fractionne'));
});

const homeState = () => ({ ...baseState(), settings: { ...baseState().settings, access: { escalade: false, muscu: false } } });

test('sans abonnement, toutes les séances passent à la maison', () => {
  for (const n of [3, 4, 5]) {
    const st = homeState();
    st.settings.sessionsPerWeek = n;
    weekSessions(parseYmd('2026-10-26'), st).forEach((s) => {
      if (s.type !== 'cardio') assert.ok(s.home, `${s.key} devrait être à la maison`);
    });
  }
  const mixed = baseState();
  mixed.settings.access = { escalade: true, muscu: false };
  assert.equal(resolveKey('bloc', mixed), 'bloc');
  assert.equal(resolveKey('haut', mixed), 'hautMaison');
});

test('aucun dips dans les séances maison et express', () => {
  const st = homeState();
  for (const key of TEMPLATE_KEYS) {
    for (const express of [false, true]) {
      const s = buildSession(key, parseYmd('2026-12-02'), st, express);
      if (!s.home) continue;
      s.exercises.forEach((e) => assert.ok(!/dips/i.test(e.name), `${s.variant} : ${e.name}`));
    }
  }
});

test('la version express dure entre 20 et 30 minutes', () => {
  const st = baseState();
  for (const key of TEMPLATE_KEYS.filter((k) => !k.startsWith('express'))) {
    const s = buildSession(key, parseYmd('2026-10-28'), st, true);
    assert.ok(s.express && s.variant.startsWith('express'));
    const min = Number(s.duration.match(/\d+/)[0]);
    assert.ok(min >= 20 && min <= 30, `${key} : ${s.duration}`);
  }
});

test('le mode express est mémorisé par séance', () => {
  const st = baseState();
  st.express = { '2026-10-28#1': true };
  const list = weekSessions(parseYmd('2026-10-26'), st);
  assert.ok(list[1].express);
  assert.ok(!list[0].express);
});

test('une séance d\'escalade maison ne change pas le niveau cible', () => {
  const st = baseState();
  for (let i = 0; i < 3; i++) { const l = { type: 'escalade', feeling: 'facile', completed: true, home: true }; st.logs.push(l); adapt(st, l); }
  assert.equal(st.adapt.gradeIdx, 3);
});

test('chaque exercice a une durée, un repos avant le suivant et une fiche tuto valide', async () => {
  const { GUIDES } = await import('../js/guides.js');
  const st = baseState();
  for (const key of TEMPLATE_KEYS) {
    for (const d of ['2026-10-27', '2026-11-25']) {
      const s = buildSession(key, parseYmd(d), st);
      assert.ok(s.totalSeconds > 0 && s.duration, key);
      s.exercises.forEach((e, i) => {
        assert.ok(e.seconds > 0, `${key} : ${e.name}`);
        if (i === s.exercises.length - 1) assert.equal(e.restAfter, 0);
        [].concat(e.info || []).forEach((id) => assert.ok(GUIDES[id], `fiche manquante : ${id}`));
        (e.circuit || []).forEach((c) => [].concat(c.info || []).forEach((id) => assert.ok(GUIDES[id], `fiche manquante : ${id}`)));
      });
      const total = s.exercises.reduce((t, e) => t + e.seconds + e.restAfter, 0);
      assert.equal(total, s.totalSeconds);
    }
  }
});

test('format des durées', () => {
  assert.equal(fmtDuration(45), '45 s');
  assert.equal(fmtDuration(90), '1 min 30');
  assert.equal(fmtDuration(120), '2 min');
  assert.equal(durationLabel(65 * 60), '1h05');
  assert.equal(durationLabel(60 * 60), '1h');
  assert.equal(durationLabel(47 * 60), '45 min');
});

test('les séances maison n\'utilisent qu\'un seul haltère de 10 kg max et un gilet de 8 kg max', () => {
  const st = homeState();
  st.benchmarks = [{ date: '2026-10-25', pullups: 25, pushups: 60, gripper: 60 }];
  for (const key of TEMPLATE_KEYS) {
    for (const express of [false, true]) {
      const s = buildSession(key, parseYmd('2026-12-02'), st, express);
      if (!s.home) continue;
      s.exercises.forEach((e) => {
        const text = `${e.name} ${e.detail}`.replace(/pince à \d+\skg/g, '');
        assert.ok(!/haltères/i.test(text), `${s.variant} : ${text}`);
        for (const m of text.matchAll(/(\d+)\skg/g)) assert.ok(Number(m[1]) <= 10, `${s.variant} : ${text}`);
        for (const m of text.matchAll(/gilet à (\d+)\skg/g)) assert.ok(Number(m[1]) >= 4 && Number(m[1]) <= 8, text);
      });
    }
  }
});

test('la prise de référence adapte répétitions, charges et allures', () => {
  const st = homeState();
  const before = buildSession('blocMaison', parseYmd('2026-10-28'), st);
  assert.ok(before.exercises.some((e) => e.name === 'Tractions' && e.reps === '5 à 8'));
  st.benchmarks = [{ date: '2026-10-25', pullups: 8, hang: 50, gripper: 40, plank: 100, squat: 30, pushups: 20, cooper: 2600 }];
  const after = buildSession('blocMaison', parseYmd('2026-10-28'), st);
  assert.ok(after.exercises.some((e) => e.name === 'Tractions' && e.reps === '4 à 6'));
  assert.equal(after.exercises.find((e) => e.name === 'Suspensions actives').work, 25);
  assert.match(after.exercises.find((e) => e.info === 'pince').detail, /28\skg/);
  const p = prescriptions(latestBench(st));
  assert.equal(p.plank, 60);
  assert.equal(p.squatReps, 18);
  assert.equal(vmaFromCooper(2600), 13.4);
  assert.match(buildSession('fractionne', parseYmd('2026-10-28'), st).exercises[1].detail, /13,4 km\/h/);
  st.benchmarks.push({ date: '2026-11-22', pullups: 12 });
  const strong = buildSession('blocMaison', parseYmd('2026-11-25'), st);
  assert.ok(strong.exercises.some((e) => e.name === 'Tractions lestées'));
  assert.equal(latestBench(st).hang, 50, 'un test sauté garde l\'ancienne valeur');
});

test('rappel de prise de référence toutes les 4 semaines', () => {
  const st = homeState();
  assert.equal(benchDue(st, parseYmd('2026-10-25')).due, true);
  st.benchmarks = [{ date: '2026-10-25', pullups: 8 }];
  assert.equal(benchDue(st, parseYmd('2026-11-10')).due, false);
  assert.equal(benchDue(st, parseYmd('2026-11-10')).inDays, 12);
  assert.equal(benchDue(st, parseYmd('2026-11-22')).due, true);
});

test('la séance de référence contient tous les tests', () => {
  const r = referenceSession(parseYmd('2026-10-25'), homeState());
  const tests = r.exercises.map((e) => e.test).filter(Boolean);
  assert.deepEqual(tests, ['pushups', 'pullups', 'hang', 'gripper', 'plank', 'squat', 'cooper']);
  assert.equal(r.index, 'ref');
});

// ---------- Carnet de charges ----------
const withLifts = (lifts) => ({ ...homeState(), lifts });

test('le carnet de charges fait progresser la charge de l\'haltère, sans dépasser 10 kg', () => {
  const full = (kg) => [{ reps: 15, kg }, { reps: 15, kg }, { reps: 15, kg }];
  let s = buildSession('hautMaison', parseYmd('2026-11-04'), withLifts({ 'Oiseau un bras': [{ date: '2026-10-28', sets: full(3) }] }));
  let e = s.exercises.find((x) => x.name === 'Oiseau un bras');
  assert.equal(e.lift.target.kg, 4);
  assert.equal(e.lift.target.reps, 12);
  assert.match(e.detail, /haltère à 4\skg/);
  s = buildSession('hautMaison', parseYmd('2026-11-04'), withLifts({ 'Rowing haltère un bras': [{ date: '2026-10-28', sets: full(10) }] }));
  e = s.exercises.find((x) => x.name === 'Rowing haltère un bras');
  assert.equal(e.lift.target.kg, 10);
  assert.match(e.lift.target.reason, /charge max/);
});

test('le carnet propose une répétition de plus quand la fourchette n\'est pas atteinte', () => {
  const s = buildSession('hautMaison', parseYmd('2026-11-04'), withLifts({ 'Curl un bras': [{ date: '2026-10-28', sets: [{ reps: 9, kg: 7 }, { reps: 8, kg: 7 }] }] }));
  const e = s.exercises.find((x) => x.name === 'Curl un bras');
  assert.deepEqual([e.lift.target.reps, e.lift.target.kg], [9, 7]);
});

test('en semaine de décharge, la charge ne monte pas', () => {
  const lifts = { 'Oiseau un bras': [{ date: '2026-11-09', sets: [{ reps: 15, kg: 3 }, { reps: 15, kg: 3 }] }] };
  const s = buildSession('hautMaison', parseYmd('2026-11-18'), withLifts(lifts));
  assert.equal(s.phase.name, 'Décharge');
  assert.equal(s.exercises.find((x) => x.name === 'Oiseau un bras').lift.target.kg, 3);
});

test('une nouvelle prise de référence recale le gilet des tractions lestées', () => {
  const st = withLifts({ 'Tractions lestées': [{ date: '2026-11-25', sets: [{ reps: 5, kg: 7 }, { reps: 5, kg: 7 }] }] });
  st.benchmarks = [{ date: '2026-11-22', pullups: 12 }];
  const pick = () => buildSession('blocMaison', parseYmd('2026-12-02'), st).exercises.find((x) => x.name === 'Tractions lestées');
  assert.equal(pick().lift.target.kg, 8, 'progression depuis la dernière séance');
  st.benchmarks.push({ date: '2026-11-30', pullups: 13 });
  assert.equal(pick().lift.target.kg, 6, 'recalé sur la référence (13 tractions → 6 kg)');
});

test('pas de carnet de charges pour la grimpe en salle ni la prise de référence', () => {
  const st = baseState();
  ['bloc', 'voie'].forEach((k) => buildSession(k, parseYmd('2026-11-25'), st).exercises.forEach((e) => assert.equal(e.lift, null, `${k} : ${e.name}`)));
  referenceSession(parseYmd('2026-11-25'), st).exercises.forEach((e) => assert.equal(e.lift, null));
  assert.ok(buildSession('haut', parseYmd('2026-11-25'), st).exercises.some((e) => e.lift && e.load?.tool === 'charge'));
});

test('les charges maison restent dans le matériel d\'Hugo', () => {
  const st = homeState();
  st.benchmarks = [{ date: '2026-10-25', pullups: 30, pushups: 60, gripper: 90 }];
  for (const key of TEMPLATE_KEYS) {
    const s = buildSession(key, parseYmd('2026-12-02'), st);
    if (!s.home) continue;
    s.exercises.filter((e) => e.load).forEach((e) => {
      const { kg, min, max, tool } = e.load;
      assert.ok(kg == null || (kg >= min && kg <= max), `${s.variant} : ${e.name} ${kg}`);
      assert.ok({ haltère: [2, 10], gilet: [4, 8], pince: [5, 60] }[tool].join() === [min, max].join(), `${e.name} : ${tool}`);
    });
  }
});

// ---------- Douleurs ----------
test('une douleur aux doigts retire poutre, suspensions et pince pendant 7 jours', () => {
  const st = homeState();
  addPains(st, ['doigts'], '2026-11-25');
  assert.deepEqual(activePains(st, '2026-12-01'), { doigts: '2026-12-01' });
  assert.deepEqual(activePains(st, '2026-12-02'), {});
  const s = buildSession('blocMaison', parseYmd('2026-11-25'), st);
  const infos = s.exercises.flatMap((e) => [].concat(e.info || []));
  ['suspensions', 'pince', 'poutre'].forEach((i) => assert.ok(!infos.includes(i), i));
  assert.ok(s.exercises.some((e) => e.name === 'Tractions lestées'), 'les tractions restent');
  assert.ok(s.notes[0].includes('Douleur signalée (doigts)'));
  const gym = buildSession('bloc', parseYmd('2026-11-25'), { ...st, settings: baseState().settings });
  assert.ok(!gym.exercises.some((e) => ['projet', 'poutre', 'bloc-niveau'].includes(e.info)));
  assert.ok(gym.notes.some((n) => n.includes('grimpe facile')));
  assert.ok(buildSession('blocMaison', parseYmd('2026-12-02'), st).exercises.some((e) => e.info === 'suspensions'), 'de retour après 7 jours');
});

test('dans un circuit, seuls les exercices douloureux sont retirés', () => {
  const st = homeState();
  addPains(st, ['doigts'], '2026-10-28');
  const s = buildSession('voieMaison', parseYmd('2026-10-28'), st);
  const circuit = s.exercises.find((e) => e.name === 'Circuit endurance');
  assert.deepEqual(circuit.circuit.map((c) => c.name), ['Tractions', 'Pompes', 'Planche']);
  assert.ok(!circuit.detail.includes('suspendu'));
});

test('si tout est retiré, la séance devient de la mobilité douce', () => {
  const st = baseState();
  addPains(st, ['genou'], '2026-10-27');
  const s = buildSession('fractionne', parseYmd('2026-10-27'), st);
  assert.equal(s.exercises.length, 1);
  assert.match(s.exercises[0].name, /Mobilité douce/);
});

test('« ça va mieux » rend la zone disponible dès le jour même', () => {
  const st = homeState();
  addPains(st, ['epaule', 'nuque'], '2026-11-20');
  healPain(st, 'epaule', '2026-11-23');
  assert.deepEqual(Object.keys(activePains(st, '2026-11-22')).sort(), ['epaule', 'nuque']);
  assert.deepEqual(Object.keys(activePains(st, '2026-11-23')), ['nuque']);
  healPain(st, 'nuque', '2026-11-20');
  assert.equal(st.pains.length, 1);
});

test('les zones de douleur sont reconnues pour chaque fiche concernée', async () => {
  const { GUIDES } = await import('../js/guides.js');
  ['poutre', 'tractions', 'goblet-squat', 'course-endurance'].forEach((i) => assert.ok(strainOf(i).length, i));
  assert.deepEqual(strainOf(['mobilite', 'etirements-grimpe', 'face-pull']), []);
  strainOf(Object.keys(GUIDES)).forEach((z) => assert.ok(ZONES[z], z));
});

// ---------- Parcours abdos ----------
test('le parcours abdos passe en version maison sans abonnement de muscu', () => {
  const home = absSession(parseYmd('2026-11-11'), homeState());
  const gym = absSession(parseYmd('2026-11-11'), baseState());
  assert.ok(home.home && home.bonus && home.index === 'abs');
  assert.ok(!gym.home && gym.bonus);
  const names = (s) => s.exercises.flatMap((e) => [e.name, ...(e.circuit || []).map((c) => c.name)]).join(' ');
  assert.ok(!/poulie|chaise romaine|banc|roue/i.test(names(home)), names(home));
  assert.match(names(gym), /poulie/);
  const min = Number(home.duration.match(/\d+/)[0]);
  assert.ok(min >= 20 && min <= 40, home.duration);
});

test('le parcours abdos maison ménage la nuque : pas de crunch classique', () => {
  const s = absSession(parseYmd('2026-11-11'), homeState());
  const comps = s.exercises.flatMap((e) => e.circuit || [e]);
  assert.ok(comps.some((c) => c.info === 'crunch-inverse'));
  assert.ok(!comps.some((c) => /^crunch$/i.test(c.name)));
});

test('un résultat de test saisi en séance complète la prise de référence du jour', () => {
  const st = homeState();
  st.benchmarks = [{ date: '2026-10-25', pullups: 8 }];
  recordBench(st, '2026-11-22', 'pushups', 30);
  recordBench(st, '2026-11-22', 'hang', 42);
  recordBench(st, '2026-11-22', 'hang', 45);
  assert.deepEqual(st.benchmarks.at(-1), { date: '2026-11-22', pushups: 30, hang: 45 });
  assert.equal(st.benchmarks.length, 2);
  assert.equal(latestBench(st).pullups, 8);
});

// ---------- Course décochée ----------
const noRun = (muscu) => ({ ...baseState(), settings: { ...baseState().settings, access: { escalade: false, muscu, course: false } } });
const RUN_INFO = ['course-endurance', 'fractionne-30-30', 'test-cooper'];

test('sans course, aucune séance ne fait courir', () => {
  for (const muscu of [false, true]) {
    for (const n of [3, 4, 5]) {
      const st = noRun(muscu);
      st.settings.sessionsPerWeek = n;
      for (const express of [false, true]) {
        if (express) st.express = Object.fromEntries(weekSessions(parseYmd('2026-11-09'), st).map((s) => [`${s.date}#${s.index}`, true]));
        weekSessions(parseYmd('2026-11-09'), st).forEach((s) => {
          s.exercises.forEach((e) => assert.ok(![].concat(e.info).some((i) => RUN_INFO.includes(i)), `${s.variant} : ${e.name}`));
          assert.ok(!/course/i.test(s.title), s.title);
        });
      }
    }
    assert.ok(!referenceSession(parseYmd('2026-11-09'), noRun(muscu)).exercises.some((e) => e.test === 'cooper'));
  }
});

test('sans course : vélo ou rameur en salle, circuit cardio à la maison', () => {
  assert.equal(resolveKey('fractionne', noRun(true)), 'fractionneVelo');
  assert.equal(resolveKey('fractionne', noRun(false)), 'cardioMaison');
  assert.equal(resolveKey('fractionne', baseState()), 'fractionne');
  const bas = buildSession('bas', parseYmd('2026-11-11'), noRun(true));
  assert.ok(bas.exercises.some((e) => e.info === 'cardio-machine'));
  const home = buildSession('basMaison', parseYmd('2026-11-11'), noRun(false));
  const cardio = home.exercises.at(-1);
  assert.equal(cardio.innerLabels.length, cardio.inner.rounds);
  assert.equal(home.title, 'Bas du corps à la maison et cardio');
});

test('la version express sans course dure entre 20 et 30 minutes', () => {
  const s = buildSession('fractionne', parseYmd('2026-10-28'), noRun(false), true);
  assert.equal(s.variant, 'expressCardio');
  const min = Number(s.duration.match(/\d+/)[0]);
  assert.ok(min >= 20 && min <= 30, s.duration);
});

test('état de forme : petite forme allège, grande forme ajoute une série bonus', () => {
  const st = { ...baseState(), access: undefined };
  st.settings.access = { escalade: false, muscu: false };
  const day = parseYmd('2026-10-26'); // semaine 1, haut du corps à la maison
  const base = buildSession('haut', day, st);
  setForm(st, '2026-10-26', { sleep: 0, energy: 1, sore: 1 });
  assert.equal(formLevel(st, '2026-10-26'), 'low');
  const low = buildSession('haut', day, st);
  assert.equal(low.form, 'low');
  base.exercises.forEach((e, i) => {
    if (e.sets >= 2 && !e.setLabels) assert.equal(low.exercises[i].sets, e.sets - 1, e.name);
  });
  assert.ok(low.totalSeconds < base.totalSeconds);
  assert.ok(low.notes.some((n) => n.startsWith('Petite forme')));
  setForm(st, '2026-10-26', { sleep: 2, energy: 2, sore: 2 });
  const high = buildSession('haut', day, st);
  const bonus = high.exercises.filter((e, i) => e.sets === base.exercises[i].sets + 1);
  assert.equal(bonus.length, 2);
  assert.ok(high.notes.some((n) => n.includes('série bonus')));
  // Grimpe en salle : pas de série bonus sur ce qui charge les doigts.
  const gym = { ...baseState() };
  setForm(gym, '2026-10-28', { sleep: 2, energy: 2, sore: 2 });
  const bloc = buildSession('bloc', parseYmd('2026-10-28'), gym);
  const blocBase = buildSession('bloc', parseYmd('2026-10-28'), baseState());
  assert.deepEqual(bloc.exercises.map((e) => e.sets), blocBase.exercises.map((e) => e.sets));
  assert.ok(bloc.notes.some((n) => n.includes('projets')));
  // Semaine de décharge : pas de série bonus.
  setForm(st, '2026-11-16', { sleep: 2, energy: 2, sore: 2 });
  const deload = buildSession('haut', parseYmd('2026-11-16'), st);
  setForm(st, '2026-11-16', { sleep: 1, energy: 1, sore: 2 });
  assert.equal(formLevel(st, '2026-11-16'), 'normal');
  const normal = buildSession('haut', parseYmd('2026-11-16'), st);
  assert.deepEqual(deload.exercises.map((e) => e.sets), normal.exercises.map((e) => e.sets));
});

test('routine nuque et dos : courte, hors programme, sans effet sur l\'adaptation', () => {
  const st = baseState();
  const r = routineSession(parseYmd('2026-10-28'), st);
  assert.ok(r.mobility && r.bonus && r.index === 'nuque');
  assert.ok(r.totalSeconds >= 5 * 60 && r.totalSeconds <= 9 * 60, `${r.totalSeconds} s`);
  assert.ok(r.exercises.some((e) => e.info === 'menton-rentre'));
  const before = { ...st.adapt };
  const msgs = adapt(st, { type: 'muscu', feeling: 'facile', mobility: true, completed: true });
  assert.deepEqual(st.adapt, before);
  assert.equal(msgs.length, 0);
});

test('une séance de semaine passe du midi au soir pour ce jour-là seulement', () => {
  const st = baseState();
  const monday = parseYmd('2026-10-26');
  const first = weekSessions(monday, st)[0];
  assert.equal(first.slot, 'midi');
  setSlot(st, `${first.date}#0`, 'soir');
  const moved = weekSessions(monday, st)[0];
  assert.equal(moved.slot, 'soir');
  assert.equal(moved.time, '18:00');
  assert.equal(weekSessions(parseYmd('2026-11-02'), st)[0].slot, 'midi');
  setSlot(st, `${first.date}#0`, 'midi');
  assert.deepEqual(st.slots, {});
});
