import test from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES, TOOLS, MEALS, AISLES, formatQty, roundQty, scaleIngredients, shoppingList, filterRecipes, stepText } from '../js/recipes.js';

const fixture = [
  { id: 'a', name: 'Riz poulet', meal: 'plat', cuisine: 'Test', servings: 2, prep: 5, cook: 15, tools: ['cuiseur'], tags: ['batch'], kcal: 600, protein: 45, carbs: 70, fat: 12,
    ingredients: [{ qty: 150, unit: 'g', name: 'riz basmati', aisle: 'epicerie' }, { qty: 2, unit: '', name: 'blancs de poulet', aisle: 'frais' }, { qty: null, name: 'sel', aisle: 'epices' }], steps: ['Cuire.'] },
  { id: 'b', name: 'Riz légumes', meal: 'plat', cuisine: 'Test', servings: 4, prep: 20, cook: 30, tools: ['plaques'], tags: ['decouverte'], kcal: 450, protein: 18, carbs: 70, fat: 10,
    ingredients: [{ qty: 300, unit: 'g', name: 'Riz basmati', aisle: 'epicerie' }], steps: [{ t: 'Mijoter.', min: 20 }] },
];

test('portions : quantités recalculées et arrondies lisiblement', async () => {
  const x = scaleIngredients(fixture[0], 3);
  assert.equal(x[0].qty, 230);
  assert.equal(x[1].qty, 3);
  assert.equal(x[2].qty, null);
  assert.equal(roundQty(1.3, 'c. à s.'), 1.5);
  assert.equal(formatQty(1.5, 'c. à s.'), '1½ c. à s.');
  assert.equal(formatQty(0.5, ''), '½');
  assert.equal(formatQty(250, 'g'), '250 g');
  assert.equal(formatQty(1130, 'g'), '1,13 kg');
  assert.equal(formatQty(130, 'cl'), '1,3 l');
  const { formatMinutes } = await import('../js/recipes.js');
  assert.deepEqual([45, 60, 140, 240].map(formatMinutes), ['45 min', '1 h', '2 h 20', '4 h']);
});

test('filtres et liste de courses additionnée par rayon', async () => {
  assert.deepEqual(filterRecipes(fixture, 'rapide').map((r) => r.id), ['a']);
  assert.deepEqual(filterRecipes(fixture, 'decouverte').map((r) => r.id), ['b']);
  assert.deepEqual(filterRecipes(fixture, 'fav', null, { b: true }).map((r) => r.id), ['b']);
  const list = shoppingList([{ id: 'a', servings: 2 }, { id: 'b', servings: 2 }], fixture);
  const rice = list.find((g) => g.aisle === 'epicerie').items[0];
  assert.equal(rice.qty, 300, 'même ingrédient additionné (150 g + 150 g)');
  assert.deepEqual(list.map((g) => g.aisle), ['frais', 'epicerie', 'epices']);
  // La liste suit les recettes cochées, pour les portions réglées sur la fiche.
  const { cartPicks } = await import('../js/recipes.js');
  assert.deepEqual(cartPicks({ cart: { a: true, b: true, x: true }, servings: { b: 6 } }, fixture), [{ id: 'a', servings: 2 }, { id: 'b', servings: 6 }]);
  assert.deepEqual(cartPicks({}, fixture), []);
  // Singulier et pluriel d'un même ingrédient se regroupent.
  const ail = shoppingList([{ id: 'saumon-teriyaki', servings: 2 }, { id: 'bulgogi', servings: 2 }]).find((g) => g.aisle === 'legumes').items.filter((i) => /ail/.test(i.name));
  assert.equal(ail.length, 1);
  assert.equal(ail[0].qty, 3);
  // Les cuillères s'additionnent : 1 c. à s. de miel (saumon) et 1 c. à c. (katsu) pour 2 portions chacun.
  const lst = shoppingList([{ id: 'saumon-teriyaki', servings: 2 }, { id: 'katsu-curry', servings: 2 }]).flatMap((g) => g.items);
  const miel = lst.filter((i) => /^miel/.test(i.name));
  assert.equal(miel.length, 1);
  assert.equal(formatQty(miel[0].qty, miel[0].unit), '1½ c. à s.');
  assert.equal(lst.find((i) => /^maïzena/.test(i.name)).unit, 'c. à c.', '1 c. à c. reste en cuillères à café');
});

test('recettes : 20 plats et 10 collations', () => {
  assert.equal(RECIPES.filter((r) => r.meal === 'plat').length, 20);
  assert.equal(RECIPES.filter((r) => r.meal === 'collation').length, 10);
});

test('recettes : complètes, matériel d\'Hugo, ni tomate crue ni chèvre', () => {
  const ids = new Set();
  for (const r of RECIPES) {
    assert.ok(!ids.has(r.id), `id unique : ${r.id}`);
    ids.add(r.id);
    assert.ok(MEALS[r.meal], `${r.id} : repas`);
    assert.ok((r.tools.length || !r.cook) && r.tools.every((t) => TOOLS[t]), `${r.id} : matériel`);
    assert.ok(r.ingredients.length >= 3 && r.steps.length >= 3, `${r.id} : recette complète`);
    assert.ok([r.kcal, r.protein, r.carbs, r.fat, r.prep, r.cook, r.servings].every((v) => Number.isFinite(v)), `${r.id} : chiffres`);
    // Contrôle grossier : 4 kcal par gramme de protéines ou de glucides, 9 par gramme de lipides.
    const kcal = 4 * (r.protein + r.carbs) + 9 * r.fat;
    assert.ok(Math.abs(kcal - r.kcal) / r.kcal < 0.15, `${r.id} : ${r.kcal} kcal annoncées, ${kcal} calculées`);
    for (const i of r.ingredients) {
      assert.ok(AISLES[i.aisle], `${r.id} : rayon de ${i.name}`);
      assert.ok(!/ch[èe]vre/i.test(i.name), `${r.id} : pas de chèvre`);
      assert.ok(!/tomate/i.test(i.name) || /concass|coulis|concentr|pel[ée]es|s[ée]ch[ée]es|passata/i.test(i.name), `${r.id} : tomate cuite seulement (${i.name})`);
    }
    r.steps.forEach((st) => assert.ok(stepText(st).length > 10, `${r.id} : étape`));
  }
});

test('planning : portions prévues, apports du jour et idées selon les séances', async () => {
  const { planPicks, dayTotals, suggestMeals, fillDinners, proteinTarget, kcalTarget } = await import('../js/recipes.js');
  assert.equal(proteinTarget(62), 125);
  assert.equal(kcalTarget(62), 2300);
  const plan = { '2026-11-02': { midi: 'cantine', soir: 'chili' }, '2026-11-03': { midi: 'chili', soir: 'paella', collation: 'bol-skyr' } };
  assert.deepEqual(planPicks(plan, ['2026-11-02', '2026-11-03']).sort((a, b) => a.id.localeCompare(b.id)), [{ id: 'bol-skyr', servings: 1 }, { id: 'chili', servings: 2 }, { id: 'paella', servings: 1 }]);
  const t = dayTotals(plan['2026-11-02']);
  assert.ok(t.outside && t.protein === RECIPES.find((r) => r.id === 'chili').protein);
  const d = new Date(2026, 10, 2);
  const train = suggestMeals(true, d);
  const rest = suggestMeals(false, d);
  const avg = (rs) => rs.reduce((n, r) => n + r.carbs, 0) / rs.length;
  assert.ok(avg(train.dinners) > avg(rest.dinners), 'plus de glucides les jours de séance');
  assert.equal(train.dinners.length, 3);
  assert.notDeepEqual(suggestMeals(true, new Date(2026, 10, 3)).dinners.map((r) => r.id), train.dinners.map((r) => r.id), 'les idées changent d\'un jour à l\'autre');
  const days = ['2026-11-02', '2026-11-03', '2026-11-04'].map((date, i) => ({ date, training: i !== 1 }));
  const filled = fillDinners(plan, days);
  assert.equal(filled['2026-11-02'].soir, 'chili', 'un soir déjà prévu ne change pas');
  assert.equal(filled['2026-11-02'].midi, 'cantine');
  // Courses de la semaine : les recettes prévues sont cochées avec assez de portions.
  const { cartFromPlan } = await import('../js/recipes.js');
  const plan3 = { ...plan, '2026-11-04': { soir: 'oyakodon' }, '2026-11-05': { midi: 'oyakodon', soir: 'oyakodon' } };
  const c = cartFromPlan({ plan: plan3, cart: { croque: true }, servings: {} }, ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
  assert.deepEqual(Object.keys(c.cart).sort(), ['bol-skyr', 'chili', 'croque', 'oyakodon', 'paella']);
  assert.equal(c.servings.oyakodon, 3, '3 repas prévus pour une recette de 2 portions');
  assert.equal(c.servings.chili, undefined, '2 repas : les 4 portions de la recette suffisent');
  assert.ok(filled['2026-11-04'].soir && !['chili', 'paella'].includes(filled['2026-11-04'].soir), 'pas de plat répété');
});
