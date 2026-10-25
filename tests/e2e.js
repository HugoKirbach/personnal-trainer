// Test de bout en bout dans Chromium : parcours principal de l'appli sur un écran de téléphone.
import { chromium } from 'playwright';
import { serve } from './serve.js';

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
const check = (cond, msg) => { if (!cond) throw new Error(msg); };

try {
  // Démarre le programme un lundi connu, avec une séance de bloc aujourd'hui.
  await page.clock.install({ time: new Date('2026-10-28T18:30:00') });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector('.session');
  check((await page.textContent('#week-badge')).includes('Semaine 1'), 'badge de semaine');
  check((await page.textContent('.session h2')).includes('Force grimpe à la maison'), 'sans abonnement : séance maison');
  await shot('0-maison');

  // Version express puis retour à la séance prévue.
  await page.click('[data-express]');
  check((await page.textContent('.session h2')).includes('Express'), 'version express');
  await shot('0b-express');
  await page.click('[data-express]');

  // Active les accès en salle.
  await page.click('nav [data-go="settings"]');
  await page.check('input[name=accessEscalade]');
  await page.check('input[name=accessMuscu]');
  await page.click('[data-form="settings"] button.primary');
  await page.click('nav [data-go="today"]');
  check((await page.textContent('.session h2')).includes('Escalade bloc'), 'avec abonnement : séance de bloc');
  check(/au total/.test(await page.textContent('.session .total')), 'temps total affiché');
  check((await page.textContent('.ex-meta >> nth=0')).includes('de repos avant l\'exercice suivant'), 'repos entre exercices affiché');
  await shot('1-aujourdhui');

  // Fiche tuto d'un exercice.
  await page.click('.info-btn >> nth=1');
  check(await page.isVisible('#sheet'), 'fiche tuto ouverte');
  check((await page.getAttribute('#sheet .video', 'href')).includes('youtube.com/results'), 'lien vers les vidéos');
  await shot('1b-tuto');
  await page.click('.sheet-close');
  check(!(await page.isVisible('#sheet')), 'fiche tuto fermée');

  // Séance guidée : décompte, puis enchaînement automatique.
  await page.click('[data-guided]');
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
  await page.click('.exercises [data-timer] >> nth=2');
  await page.waitForSelector('.timer-face');
  check((await page.textContent('#tdisplay')) === '03:00', 'minuteur de repos chargé à 3 min');
  await shot('2-chrono');

  // Intervalles : préréglage poutre.
  await page.click('[data-preset="5"]');
  check((await page.textContent('#tlabel')).includes('Prépare'), 'préréglage poutre');

  // Note la séance et vérifie l'adaptation.
  await page.click('nav [data-go="today"]');
  await page.click('.feedback .seg label:has-text("Facile")');
  await page.selectOption('.feedback select[name=maxGrade]', '6b+');
  await page.click('.feedback button.primary');
  await page.waitForSelector('.logged');
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
  await shot('4-suivi');

  // Réglages : passer à 5 séances.
  await page.click('nav [data-go="settings"]');
  await page.selectOption('select[name=sessionsPerWeek]', '5');
  await page.click('[data-form="settings"] button.primary');
  await page.click('nav [data-go="week"]');
  check((await page.$$('.day-session')).length === 5, '5 séances après réglage');
  await page.click('nav [data-go="settings"]');
  await shot('5-reglages');

  // Persistance après rechargement.
  await page.reload();
  await page.click('nav [data-go="stats"]');
  check((await page.$$('.table tbody tr')).length >= 4, 'historique conservé');

  check(!errors.length, `erreurs console : ${errors.join(' | ')}`);
  console.log('e2e OK');
} catch (e) {
  console.error('e2e ÉCHEC :', e.message, errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
