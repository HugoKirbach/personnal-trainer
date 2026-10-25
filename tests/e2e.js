// Test de bout en bout dans Chromium : parcours principal de l'appli sur un écran de téléphone.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.js';
import { fakeCloud } from './fakecloud.js';

const PORT = 4173;
const server = await serve(PORT);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const shots = process.env.SHOTS;
const shot = async (name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); };
const PLAN = 'section.session:not(.ref-session):not(.bonus-session)';
const check = (cond, msg) => { if (!cond) throw new Error(msg); };

try {
  // Démarre le programme un lundi connu, avec une séance de bloc aujourd'hui.
  await page.clock.install({ time: new Date('2026-10-28T18:30:00') });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector('.session');
  check((await page.textContent('#week-badge')).includes('Semaine 1'), 'badge de semaine');
  check((await page.textContent(`${PLAN} h2`)).includes('Force grimpe à la maison'), 'sans abonnement : séance maison');
  await shot('0-maison');

  // Version express puis retour à la séance prévue.
  await page.click(`${PLAN} [data-express]`);
  check((await page.textContent(`${PLAN} h2`)).includes('Express'), 'version express');
  await shot('0b-express');
  await page.click(`${PLAN} [data-express]`);

  // Carnet de charges : noter les séries d'un exercice maison.
  check(await page.isVisible(`${PLAN} .ex-lift`), 'carnet de charges affiché');
  await page.click(`${PLAN} [data-lift] >> nth=0`);
  await page.waitForSelector('[data-form="lift"]');
  await shot('0d-carnet');
  await page.click('[data-form="lift"] button.primary');
  check((await page.textContent('#toast')).includes('Prochaine fois'), 'objectif suivant proposé');
  check((await page.textContent(`${PLAN} .ex-lift.done`)).includes('5 · 5 · 5'), 'séries notées');

  // Séance guidée : compteurs sur une série comptée, annonces vocales coupables.
  await page.click(`${PLAN} [data-guided]`);
  await page.waitForSelector('.guided');
  for (let k = 0; k < 60 && !(await page.isVisible('#g-lift')); k++) await page.click('#g-nextbtn');
  check(await page.isVisible('#g-lift'), 'compteurs de répétitions');
  check((await page.inputValue('#g-reps')) === '5', 'série déjà notée reprise');
  await page.click('[data-lstep="reps:1"]');
  await shot('0f-guidee-series');
  await page.click('#g-voice');
  check((await page.textContent('#g-voice')) === '🔇', 'annonces vocales coupées');
  await page.click('#g-nextbtn');
  await page.click('#g-quit');
  await page.click('#g-quit');
  await page.waitForSelector('.session');
  check((await page.textContent(`${PLAN} .ex-lift.done`)).includes('6 · 5 · 5'), 'série enregistrée depuis la séance guidée');

  // Douleur aux doigts : exercices retirés, puis rétablis.
  await page.click('.pain-card summary');
  await page.click('.pain-card .chip-check:has-text("Doigts")');
  await page.click('[data-form="pain"] button.primary');
  await page.waitForSelector('.pain-card.active');
  check((await page.textContent(PLAN)).includes('Douleur signalée'), 'note sur les exercices retirés');
  check(!(await page.textContent(`${PLAN} .exercises`)).includes('Suspensions actives'), 'suspensions retirées');
  await shot('0e-douleur');
  await page.click('[data-heal="doigts"]');
  check((await page.textContent(`${PLAN} .exercises`)).includes('Suspensions actives'), 'exercices rétablis');

  // Parcours abdos : séance à lancer quand on veut, version maison.
  await page.click('.abs-wrap summary');
  check((await page.textContent('.abs-wrap h2')).includes('Parcours abdos à la maison'), 'parcours abdos maison');
  await shot('0g-abdos');

  // Active les accès en salle.
  await page.click('nav [data-go="settings"]');
  await page.check('input[name=accessEscalade]');
  await page.check('input[name=accessMuscu]');
  await page.click('[data-form="settings"] button.primary');
  await page.click('nav [data-go="today"]');
  check((await page.textContent(`${PLAN} h2`)).includes('Escalade bloc'), 'avec abonnement : séance de bloc');
  check(/au total/.test(await page.textContent(`${PLAN} .total`)), 'temps total affiché');
  check((await page.textContent('.ex-meta >> nth=0')).includes('de repos avant l\'exercice suivant'), 'repos entre exercices affiché');
  await shot('1-aujourdhui');

  // Carnet d'escalade : un bloc enchaîné, repris dans la cotation max.
  await page.click(`${PLAN} .climbs summary`);
  await page.selectOption(`${PLAN} [data-form="climb"] select[name=grade]`, '6b');
  await page.click(`${PLAN} [data-form="climb"] button`);
  check((await page.textContent(`${PLAN} .climb-list`)).includes('6b'), 'bloc noté');
  check((await page.inputValue('[data-form="log"] select[name=maxGrade]')) === '6b', 'cotation max préremplie');
  await shot('1a-carnet-escalade');

  // Prise de référence : saisie des résultats et adaptation.
  check(await page.isVisible('.ref-wrap[open]'), 'prise de référence proposée');
  await page.fill('[data-form="bench"] input[name=pullups]', '8');
  await page.fill('[data-form="bench"] input[name=hang]', '50');
  await page.fill('[data-form="bench"] input[name=gripper]', '40');
  await page.click('[data-form="bench"] button.primary');
  await page.waitForSelector('.bench-summary');
  check((await page.textContent('#toast')).includes('Pince : 28 kg'), 'résumé de l\'adaptation');
  await shot('0c-reference');
  check((await page.textContent('.abs-wrap h2')).includes('en salle'), 'parcours abdos en salle avec l\'abonnement');

  // Prise de référence guidée : résultat saisi à la fin de chaque test, temps tenu proposé à la validation.
  const title = () => page.textContent('#g-title');
  const skipTo = async (name) => {
    for (let k = 0; k < 60 && !(await title()).includes(name); k++) {
      if (await page.isVisible('#sheet')) await page.click('#sheet [data-action="close-sheet"]');
      await page.click('#g-nextbtn');
    }
  };
  await page.click('.ref-wrap:not(.abs-wrap) [data-guided]');
  await page.waitForSelector('.guided');
  await skipTo('Test : pompes');
  await page.click('#g-nextbtn');
  await page.waitForSelector('[data-form="bench-one"]');
  await page.fill('[data-form="bench-one"] input[name=value]', '30');
  await page.click('[data-form="bench-one"] button.primary');
  check((await page.textContent('#toast')).includes('Pompes max : 30'), 'max de pompes saisi en fin de test');
  await skipTo('Test : suspension');
  check((await page.textContent('#g-hint')).includes('dès que tu lâches'), 'consigne du test au temps');
  await page.clock.runFor(42000);
  await page.click('#g-nextbtn');
  await page.waitForSelector('[data-form="bench-one"]');
  check((await page.textContent('.bench-prompt')).includes('Temps mesuré : 42 s'), 'temps tenu mesuré au ✓');
  check((await page.inputValue('[data-form="bench-one"] input[name=value]')) === '42', 'temps proposé à confirmer');
  await shot('0h-test-temps');
  await page.click('[data-form="bench-one"] [data-bstep="1"]');
  await page.click('[data-form="bench-one"] button.primary');
  check((await page.textContent('#toast')).includes('43 s'), 'temps corrigé à la main');
  await page.click('#g-quit');
  await page.click('#g-quit');
  await page.waitForSelector('.session');

  // Fiche tuto d'un exercice.
  await page.click('.info-btn >> nth=1');
  check(await page.isVisible('#sheet'), 'fiche tuto ouverte');
  check((await page.getAttribute('#sheet .video', 'href')).includes('youtube.com/results'), 'lien vers les vidéos');
  await shot('1b-tuto');
  await page.click('.sheet-close');
  check(!(await page.isVisible('#sheet')), 'fiche tuto fermée');

  // Séance guidée : décompte, puis enchaînement automatique.
  await page.click(`${PLAN} [data-guided]`);
  await page.waitForSelector('.guided');
  check((await page.textContent('#g-kind')).includes('Prépare'), 'décompte de départ');
  check(!(await page.isVisible('nav')), 'navigation masquée pendant la séance guidée');
  await page.clock.runFor(11000);
  check((await page.textContent('#g-title')).includes('Inclinaisons de nuque'), 'premier exercice après le décompte');
  check((await page.textContent('#g-next')).length > 3, 'exercice suivant affiché');
  check(/^\d\d:\d\d$/.test(await page.textContent('#g-total')), 'temps global restant');
  await shot('1c-guidee');
  await page.click('#g-toggle');
  check((await page.textContent('#g-toggle')) === 'Reprendre', 'pause');
  await page.click('#g-quit');
  await page.click('#g-quit');
  await page.waitForSelector('.session');

  // Coche un exercice et lance le chrono depuis la séance.
  await page.check('.exercises input[type=checkbox] >> nth=0');
  await page.click(`${PLAN} .exercises [data-timer] >> nth=2`);
  await page.waitForSelector('.timer-face');
  check((await page.textContent('#tdisplay')) === '03:00', 'minuteur de repos chargé à 3 min');
  await shot('2-chrono');

  // Intervalles : préréglage poutre.
  await page.click('[data-preset="5"]');
  check((await page.textContent('#tlabel')).includes('Prépare'), 'préréglage poutre');

  // Note la séance et vérifie l'adaptation.
  await page.click('nav [data-go="today"]');
  await page.click('[data-form="log"] .seg label:has-text("Facile")');
  await page.selectOption('[data-form="log"] select[name=maxGrade]', '6b+');
  await page.click('[data-form="log"] button.primary');
  await page.waitForSelector(`${PLAN} .logged`);
  check((await page.textContent('#toast')).includes('enregistrée'), 'toast de confirmation');

  // Semaine : déplacer une séance.
  await page.click('nav [data-go="week"]');
  check((await page.$$('.day-session')).length === 4, '4 séances par défaut');
  await page.selectOption('[data-move="0"]', '1');
  check((await page.textContent('.days li:nth-child(2)')).includes('haut du corps'), 'séance déplacée au mardi');
  await shot('3-semaine');

  // Suivi : graphiques et historique.
  await page.click('nav [data-go="stats"]');
  check((await page.$$('svg.chart')).length >= 3, 'graphiques affichés');
  check((await page.textContent('.tiles')).includes('6b+'), 'niveau cible relevé par la cotation max');
  check((await page.textContent('.table-scroll >> nth=1')).includes('Tractions max'), 'tableau des références');
  check((await page.textContent('table.lifts')).includes('Tractions'), 'carnet de charges dans le suivi');
  check((await page.textContent('#main')).includes('Pyramide'), 'pyramide d\'escalade');
  await shot('4-suivi');

  // Réglages : passer à 5 séances.
  await page.click('nav [data-go="settings"]');
  await page.selectOption('select[name=sessionsPerWeek]', '5');
  await page.click('[data-form="settings"] button.primary');
  await page.click('nav [data-go="week"]');
  check((await page.$$('.day-session')).length === 5, '5 séances après réglage');
  check((await page.textContent('.days')).includes('Course fractionnée'), 'fractionné en course');

  // Course décochée : le cardio passe sur vélo ou rameur.
  await page.click('nav [data-go="settings"]');
  await page.uncheck('input[name=accessCourse]');
  await page.click('[data-form="settings"] button.primary');
  await page.click('nav [data-go="week"]');
  const week = await page.textContent('.days');
  check(week.includes('Fractionné vélo ou rameur') && !/course/i.test(week), 'plus de course dans la semaine');
  await page.click('nav [data-go="settings"]');
  check(!(await page.isChecked('input[name=voice]')), 'réglage des annonces vocales');
  await shot('5-reglages');

  // Persistance après rechargement.
  await page.reload();
  await page.click('nav [data-go="stats"]');
  check((await page.$$('.table tbody tr')).length >= 4, 'historique conservé');

  // Compte : sauvegarde en ligne puis récupération sur un autre téléphone (faux Firebase).
  const cloud = fakeCloud();
  const phone = async (seed) => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await c.route(/^https:\/\/[^/]*(googleapis\.com|firebaseapp\.com|google\.com)\//, (r) => r.abort());
    await c.route('https://www.gstatic.com/firebasejs/**', (r) => r.fulfill({
      contentType: 'text/javascript', body: readFileSync(new URL(`./fbmock/${r.request().url().split('/').pop()}`, import.meta.url), 'utf8'),
    }));
    await c.exposeFunction('__fs', (op, args, uid) => cloud.fs(op, args, uid));
    await c.exposeFunction('__auth', (op, args) => cloud.auth(op, args));
    if (seed) await c.addInitScript((v) => { if (!localStorage.getItem('personnal-trainer:v1')) localStorage.setItem('personnal-trainer:v1', v); }, seed);
    const p = await c.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(`http://localhost:${PORT}/`);
    await p.waitForSelector('#main h1');
    return p;
  };
  const synced = (p) => p.waitForFunction(() => document.querySelector('#cloud-status')?.textContent.includes('Tout est sauvegardé'));
  const stored = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('personnal-trainer:v1')));

  const phoneA = await phone(await page.evaluate(() => localStorage.getItem('personnal-trainer:v1')));
  await phoneA.click('nav [data-go="settings"]');
  await phoneA.click('[data-action="cloud-google"]');
  await synced(phoneA);
  check(cloud.db.has('users/u-google/apps/personnal-trainer'), 'données envoyées en ligne');
  check([...cloud.db.keys()].some((k) => k.startsWith('users/u-google/apps/personnal-trainer/backups/')), 'sauvegarde du jour');
  check(await phoneA.isVisible('#cloud-badge'), 'indicateur de synchro');
  if (shots) await phoneA.screenshot({ path: `${shots}/6-compte.png` });

  const phoneB = await phone(null);
  await phoneB.click('nav [data-go="settings"]');
  await phoneB.click('[data-action="cloud-google"]');
  await synced(phoneB);
  await phoneB.click('nav [data-go="stats"]');
  check((await phoneB.textContent('#main')).includes('Escalade bloc'), 'historique retrouvé sur le nouveau téléphone');

  // Un bloc noté sur le téléphone B arrive sur le téléphone A.
  await phoneB.click('nav [data-go="today"]');
  await phoneB.click('.climbs summary');
  await phoneB.selectOption('[data-form="climb"] select[name=grade]', '7a');
  await phoneB.click('[data-form="climb"] button');
  await phoneB.click('nav [data-go="settings"]');
  await phoneB.click('[data-action="cloud-sync"]');
  await synced(phoneB);
  await phoneA.click('[data-action="cloud-sync"]');
  await synced(phoneA);
  check((await stored(phoneA)).climbs.some((c) => c.grade === '7a'), 'synchro entre les deux téléphones');
  check((await stored(phoneA)).logs.length >= 1, 'rien de perdu à la fusion');

  await phoneA.click('[data-action="cloud-backups"]');
  await phoneA.waitForSelector('[data-restore]');
  if (shots) await phoneA.locator('#cloud-card').screenshot({ path: `${shots}/6b-sauvegardes.png` });

  // Déconnexion : les données restent sur le téléphone.
  await phoneA.click('[data-action="cloud-out"]');
  await phoneA.click('[data-action="cloud-out"]');
  await phoneA.waitForSelector('[data-action="cloud-google"]');
  check((await stored(phoneA)).logs.length >= 1, 'données gardées après déconnexion');

  check(!errors.length, `erreurs console : ${errors.join(' | ')}`);
  console.log('e2e OK');
} catch (e) {
  console.error('e2e ÉCHEC :', e.message, errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
