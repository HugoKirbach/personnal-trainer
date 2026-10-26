// Test de bout en bout dans Chromium : parcours principal de l'appli sur un écran de téléphone.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

  // État de forme : petite forme, séance allégée, puis forme normale.
  const answer = async (a, b, c) => {
    for (const o of [a, b, c]) await page.click(`.form-card label:has-text("${o}")`);
    await page.click('[data-form="form"] button.primary');
  };
  check(await page.isVisible('[data-form="form"]'), 'questionnaire de forme proposé');
  await answer('Mauvais', 'Fatigué', 'Légères');
  check((await page.textContent('.form-card')).includes('Petite forme'), 'petite forme affichée');
  check((await page.textContent(PLAN)).includes('une série de moins'), 'séance allégée');
  await shot('0i-forme');
  await page.click('[data-form-edit]');
  await answer('Bon', 'Normale', 'Aucune');
  check((await page.textContent('.form-card')).includes('Forme normale'), 'forme normale');
  check(!(await page.textContent(PLAN)).includes('une série de moins'), 'séance prévue rétablie');

  // Routine nuque et dos : courte, notée d'un geste.
  await page.click('.routine-wrap summary');
  check((await page.textContent('.routine-wrap h2')).includes('Routine nuque et dos'), 'routine nuque et dos');
  await shot('0j-routine');
  await page.click('[data-routine-done]');
  check((await page.textContent('.routine-wrap summary')).includes('faite'), 'routine notée');

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

  // Remplacer un exercice pour aujourd'hui, puis revenir à l'original.
  await page.click(`${PLAN} [data-swap] >> nth=0`);
  await page.waitForSelector('.swap-sheet');
  check((await page.textContent('.swap-sheet h2')).includes('Tractions'), 'remplacement des tractions');
  await shot('0k-remplacer');
  await page.click('.swap-list li >> nth=0 >> button:has-text("Aujourd\'hui")');
  check((await page.textContent(`${PLAN} .exercises`)).includes('À la place de Tractions'), 'exercice remplacé');
  await page.click(`${PLAN} li:has(.ex-swap) [data-swap]`);
  await page.click('.swap-sheet .tip button');
  check(!(await page.textContent(`${PLAN} .exercises`)).includes('À la place de'), 'retour à l\'original');

  // Temps dispo : séance ramenée à 30 min, puis complète.
  await page.selectOption(`${PLAN} [data-duration]`, '30');
  check((await page.textContent(`${PLAN} .total`)).includes('30 min'), 'séance ramenée à 30 min');
  check((await page.textContent(PLAN)).includes('Séance ramenée'), 'explication du raccourci');
  await shot('0l-duree');
  await page.selectOption(`${PLAN} [data-duration]`, '');
  check(!(await page.textContent(PLAN)).includes('Séance ramenée'), 'séance complète rétablie');

  // Parcours abdos : séance à lancer quand on veut, version maison.
  await page.click('.abs-wrap summary');
  check((await page.textContent('.abs-wrap h2')).includes('Parcours abdos à la maison'), 'parcours abdos maison');
  await shot('0g-abdos');

  // Parcours détente : zones de courbatures proposées puis cochées, noté d'un geste.
  check((await page.$$eval('#main > *', (els) => els.map((e) => e.className))).indexOf('card meal-card') === 1, 'idée repas juste sous la date');
  await page.click('.relax-wrap summary');
  check((await page.textContent('.relax-wrap h2')).includes('Parcours détente'), 'parcours détente');
  const relaxBefore = await page.textContent('.relax-wrap summary');
  await page.click('.relax-wrap label:has(input[data-sore="mollets"])');
  check((await page.textContent('.relax-wrap')).includes('Étirement des mollets au mur'), 'étirements de la zone cochée');
  check((await page.textContent('.relax-wrap summary')) !== relaxBefore, 'durée recalculée');
  await shot('0i-detente');
  await page.click('.relax-wrap [data-routine-done]');
  check((await page.textContent('.relax-wrap summary')).includes('fait'), 'parcours détente noté');
  // Un menu ouvert ou fermé au doigt garde cet état quand la page se redessine.
  await page.click('.routine-wrap > summary');
  if (await page.$eval('.routine-wrap', (el) => el.open)) await page.click('.routine-wrap > summary');
  if (!(await page.$eval('.abs-wrap', (el) => el.open))) await page.click('.abs-wrap > summary');
  await page.click('.relax-wrap > summary');
  await page.click('.relax-wrap label:has(input[data-sore="cuisses"])');
  check(!(await page.$eval('.routine-wrap', (el) => el.open)), 'menu refermé : il ne se rouvre pas');
  check(await page.$eval('.abs-wrap', (el) => el.open), 'menu ouvert : il reste ouvert');

  // Active les accès en salle.
  await page.click('.top-settings');
  await page.check('input[name=accessEscalade]');
  await page.check('input[name=accessMuscu]');
  await page.click('[data-form="settings"] button.primary');
  await page.click('nav [data-go="today"]');
  check((await page.textContent(`${PLAN} h2`)).includes('Escalade bloc'), 'avec abonnement : séance de bloc');
  check(/au total/.test(await page.textContent(`${PLAN} .total`)), 'temps total affiché');
  check((await page.textContent('.ex-meta >> nth=0')).includes('de repos avant l\'exercice suivant'), 'repos entre exercices affiché');
  await shot('1-aujourdhui');

  // Créneau : la séance du soir passe au midi, puis revient.
  await page.click(`${PLAN} [data-slot$="|midi"]`);
  check((await page.textContent(`${PLAN} .session-head`)).includes('Midi'), 'séance passée au midi');
  await page.click(`${PLAN} [data-slot$="|soir"]`);
  check((await page.textContent(`${PLAN} .session-head`)).includes('Soir'), 'séance revenue au soir');

  // Carnet d'escalade : un bloc enchaîné, repris dans la cotation max.
  await page.click(`${PLAN} .climbs summary`);
  check(!(await page.isVisible(`${PLAN} [data-form="climb"] select[name=grade]`)), 'bloc : niveaux de la salle plutôt que cotation');
  await page.selectOption(`${PLAN} [data-form="climb"] select[name=level]`, 'g1|Rose');
  await page.click(`${PLAN} [data-form="climb"] button`);
  const climbLine = await page.textContent(`${PLAN} .climb-list`);
  check(climbLine.includes('Rose') && climbLine.includes('≈ 6b'), 'bloc noté dans le niveau de la salle');
  check((await page.textContent(`${PLAN} [data-form="log"] select[name=maxGrade] option:checked`)).includes('Rose'), 'cotation max avec les niveaux des salles');
  check((await page.inputValue('[data-form="log"] select[name=maxGrade]')) === '6b', 'cotation max préremplie');
  await shot('1a-carnet-escalade');

  // Projets : un bloc travaillé avec photo, essais, point haut, enchaînement versé au carnet.
  await page.click(`${PLAN} .projects summary`);
  await page.click(`${PLAN} [data-project-new]`);
  check((await page.inputValue('#sheet select[name=level]')) === 'g1|Rouge', 'niveau de projet proposé au-dessus du max');
  await page.fill('#sheet input[name=name]', 'Le dévers jaune');
  await page.setInputFiles('#sheet input[name=photo]', fileURLToPath(new URL('../icons/icon-192.png', import.meta.url)));
  await page.click('#sheet button.primary');
  await page.waitForSelector(`${PLAN} .photo.thumb:not([hidden]) img[src^="blob:"]`);
  await page.click(`${PLAN} [data-ptry$="|1"]`);
  await page.click(`${PLAN} [data-ptry$="|1"]`);
  await page.selectOption(`${PLAN} [data-phigh]`, '75');
  check((await page.textContent(`${PLAN} .projects`)).includes('2 essais, point haut : trois quarts'), 'essais et point haut du projet');
  await shot('1b-projets');
  await page.click(`${PLAN} [data-psend]`);
  check((await page.textContent(`${PLAN} .climb-list`)).includes('projet'), 'projet enchaîné versé au carnet');
  check((await page.textContent(`${PLAN} .sent-line`)).includes('Le dévers jaune'), 'enchaînement célébré');
  await page.click(`${PLAN} .climb-list li:has-text("projet") [data-climb-del]`);
  check((await page.textContent(`${PLAN} .projects summary`)).includes('1 en cours'), 'croix retirée : projet rouvert');
  check((await page.inputValue('[data-form="log"] select[name=maxGrade]')) === '6b', 'cotation max inchangée');

  // Prise de référence : saisie des résultats et adaptation.
  check(await page.isVisible('.bench-wrap[open]'), 'prise de référence proposée');
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
  await page.click('.bench-wrap [data-guided]');
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
  await page.goBack();
  await page.waitForSelector('#sheet', { state: 'hidden' });
  check(await page.isVisible(`${PLAN} [data-guided]`), 'geste retour : fiche tuto fermée, séance toujours affichée');

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

  // Alimentation : la liste de courses suit les recettes cochées, pour leurs portions.
  await page.click('nav [data-go="food"]');
  check((await page.$$('.recipe-item')).length === 30, '20 plats et 10 collations');
  for (const id of ['bulgogi', 'paella', 'onigiri']) await page.check(`input[data-cart="${id}"]`);
  check((await page.textContent('.cart-bar')).includes('3 recettes cochées'), 'recettes cochées pour les courses');
  await page.click('[data-recipe="bulgogi"]');
  check((await page.textContent('#main h1')).includes('Bulgogi'), 'fiche recette ouverte');
  await page.waitForFunction(() => document.querySelector('.recipe-photo img')?.complete);
  check(await page.$eval('.recipe-photo img', (i) => i.naturalWidth === 800), 'photo du plat affichée');
  check((await page.textContent('.recipe-photo figcaption')).includes('Andy Li · CC0 · Wikimedia Commons'), 'crédit de la photo');
  await page.click('[data-servings="bulgogi|1"]');
  check((await page.textContent('.recipe-head')).includes('3 portions'), 'portions ajustées');
  check((await page.textContent('[data-cart-toggle]')).includes('Dans la liste'), 'recette cochée rappelée sur la fiche');
  await shot('3b-recette');
  await page.click('.recipe-nav [data-recipe-step] >> nth=1');
  check((await page.textContent('#main h1')).includes('Bo bun'), 'flèche : plat suivant');
  await page.click('.recipe-nav [data-recipe-step] >> nth=0');
  check((await page.textContent('#main h1')).includes('Bulgogi'), 'flèche : plat précédent');
  await page.goBack();
  await page.waitForSelector('.cart-bar');
  check(!(await page.isVisible('.recipe-nav')), 'geste retour : de la fiche à la liste');
  await page.click('[data-fav="chili"]');
  check(await page.isVisible('[data-fav="chili"].on'), 'favori ajouté depuis la liste');
  await page.click('.cart-bar');
  const shop = await page.textContent('#main');
  check(shop.includes('450 g bœuf émincé'), 'courses pour 3 portions de bulgogi');
  check(shop.includes('chorizo') && shop.includes('thon'), 'ingrédients des recettes cochées');
  check(!shop.includes('saumon'), 'rien des recettes non cochées');
  await page.check('input[data-shop] >> nth=0');
  check((await page.textContent('#main')).includes('1 article sur'), 'article coché dans le panier');
  await page.click('[data-cart-remove="onigiri"]');
  check(!(await page.textContent('#main')).includes('thon'), 'recette retirée avec ses ingrédients');
  await shot('3c-courses');
  await page.click('[data-food-tab="week"]');
  await page.selectOption('.plan-day.today select[data-plan$="|soir"]', 'chili');
  await page.click('[data-plan-fill]');
  check((await page.$$eval('.plan-day select[data-plan$="|soir"]', (els) => els.filter((e) => e.value).length)) >= 2, 'soirs vides remplis selon les séances');
  await page.click('[data-plan-cart]');
  check((await page.textContent('.cart-list')).includes('Chili'), 'recettes de la semaine cochées pour les courses');
  await page.click('nav [data-go="today"]');
  check((await page.textContent('.meal-card')).includes('Chili con carne'), 'repas du soir rappelé sur Aujourd\'hui');

  // Suivi : graphiques et historique.
  await page.click('nav [data-go="stats"]');
  check((await page.$$('svg.chart')).length >= 3, 'graphiques affichés');
  check((await page.textContent('.tiles')).includes('6b+'), 'niveau cible relevé par la cotation max');
  check((await page.textContent('.table-scroll >> nth=1')).includes('Tractions max'), 'tableau des références');
  check((await page.textContent('table.lifts')).includes('Tractions'), 'carnet de charges dans le suivi');
  check((await page.textContent('#main')).includes('Pyramide'), 'pyramide d\'escalade');
  check((await page.textContent('.projects-card')).includes('Le dévers jaune'), 'projets dans le suivi');
  await page.click('.projects-card [data-project]');
  check((await page.textContent('#sheet')).includes('Point haut par séance'), 'fiche du projet avec sa progression');
  await page.click('#sheet [data-action="close-sheet"]');
  await shot('4-suivi');

  // Réglages : passer à 5 séances.
  await page.click('.top-settings');
  await page.selectOption('select[name=sessionsPerWeek]', '5');
  await page.click('[data-form="settings"] button.primary');
  await page.click('nav [data-go="week"]');
  check((await page.$$('.day-session')).length === 5, '5 séances après réglage');
  check((await page.textContent('.days')).includes('Course fractionnée'), 'fractionné en course');

  // Course décochée : le cardio passe sur vélo ou rameur.
  await page.click('.top-settings');
  await page.uncheck('input[name=accessCourse]');
  await page.click('[data-form="settings"] button.primary');
  await page.click('nav [data-go="week"]');
  const week = await page.textContent('.days');
  check(week.includes('Fractionné vélo ou rameur') && !/course/i.test(week), 'plus de course dans la semaine');
  await page.click('.top-settings');
  check(!(await page.isChecked('input[name=voice]')), 'réglage des annonces vocales');
  await shot('5-reglages');

  // Objectif de saison : les cycles deviennent des blocs jusqu'à la date.
  await page.fill('input[name=goal-voie-date]', '2027-06-12');
  await page.selectOption('select[name=goal-bloc]', 'g1|Rouge');
  await page.fill('input[name=goal-bloc-date]', '2027-03-06');
  await page.click('[data-form="settings"] button.primary');
  const goalToast = await page.textContent('#toast');
  check(goalToast.includes('Rouge en bloc : base') && goalToast.includes('7a en voie :'), 'deux plans de saison annoncés');
  check((await page.textContent('#week-badge')).includes('Base'), 'bloc de la semaine dans l\'en-tête');
  await page.click('nav [data-go="stats"]');
  const season = await page.textContent('.season-card');
  check(season.includes('7a en voie') && season.includes('Rouge en bloc') && season.includes('Salle principale'), 'carte des objectifs de saison');
  check((await page.$$('.season-card .blk')).length >= 6, 'blocs des deux plans sur la frise');
  await shot('4b-objectifs');

  // Salles : une équivalence ajustée recale les blocs déjà notés.
  await page.click('.top-settings');
  await page.click('[data-form="gyms"] fieldset >> nth=0 >> summary');
  await page.selectOption('select[name="eq-0-3"]', '6b+');
  await page.click('[data-form="gyms"] button.primary');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('personnal-trainer:v1')));
  check(saved.climbs.some((c) => c.level === 'Rose' && c.grade === '6b+'), 'équivalence de la salle appliquée au carnet');

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
  await phoneA.click('.top-settings');
  await phoneA.click('[data-action="cloud-google"]');
  await synced(phoneA);
  check(cloud.db.has('users/u-google/apps/personnal-trainer'), 'données envoyées en ligne');
  check([...cloud.db.keys()].some((k) => k.startsWith('users/u-google/apps/personnal-trainer/backups/')), 'sauvegarde du jour');
  check(await phoneA.isVisible('#cloud-badge'), 'indicateur de synchro');
  if (shots) await phoneA.screenshot({ path: `${shots}/6-compte.png` });

  const phoneB = await phone(null);
  await phoneB.click('.top-settings');
  await phoneB.click('[data-action="cloud-google"]');
  await synced(phoneB);
  await phoneB.click('nav [data-go="stats"]');
  check((await phoneB.textContent('#main')).includes('Escalade bloc'), 'historique retrouvé sur le nouveau téléphone');

  // Un bloc noté sur le téléphone B arrive sur le téléphone A.
  await phoneB.click('nav [data-go="today"]');
  await phoneB.click('.climbs summary');
  await phoneB.selectOption('[data-form="climb"] select[name=level]', '|7a');
  await phoneB.click('[data-form="climb"] button');
  await phoneB.click('.top-settings');
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
