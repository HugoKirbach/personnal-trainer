// Alimentation : recettes (données) et calculs purs (portions, filtres, liste de courses).
// Recette : { id, name, meal (plat, collation), cuisine, servings, prep, cook, marinate? (min), tools, tags, fridge (jours), freezer,
//   kcal, protein, carbs, fat (par portion, calculés ingrédient par ingrédient), ingredients: [{ qty, unit, name, aisle }], steps: [texte ou { t, min }], tip }

export const TOOLS = { four: 'Four', plaques: 'Plaques', cuiseur: 'Cuiseur à riz', grill: 'Grill-presse', micro: 'Micro-ondes' };
export const MEALS = { plat: 'Plats (dîner ou déjeuner)', collation: 'Collations' };
export const AISLES = {
  frais: 'Viandes, poissons, œufs', cremerie: 'Crèmerie', legumes: 'Fruits et légumes', epicerie: 'Épicerie',
  conserves: 'Conserves', surgeles: 'Surgelés', epices: 'Épices et sauces', boulangerie: 'Pain',
};
export const FILTERS = {
  all: { label: 'Tout', test: () => true },
  rapide: { label: '≤ 25 min', test: (r) => totalTime(r) <= 25 },
  batch: { label: 'À préparer d\'avance', test: (r) => r.tags.includes('batch') },
  proteine: { label: 'Riche en protéines', test: (r) => r.protein >= 40 },
  decouverte: { label: 'À découvrir', test: (r) => r.tags.includes('decouverte') },
};

export const totalTime = (r) => r.prep + r.cook;
export const formatMinutes = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`);
export const stepText = (s) => (typeof s === 'string' ? s : s.t);
export const stepMinutes = (s) => (typeof s === 'string' ? 0 : s.min || 0);

// Arrondi lisible selon l'unité : grammes de 5 en 5, pièces et cuillères à la demie.
export function roundQty(q, unit) {
  if (!q) return q;
  if (unit === 'g' || unit === 'ml') return q >= 100 ? Math.round(q / 10) * 10 : Math.max(5, Math.round(q / 5) * 5);
  if (unit === 'kg' || unit === 'l') return Math.round(q * 10) / 10;
  if (unit === 'cl') return Math.max(1, Math.round(q));
  return Math.max(0.5, Math.round(q * 2) / 2);
}

const FRACTIONS = { 0.5: '½', 0.25: '¼', 0.75: '¾' };
export function formatQty(q, unit) {
  if (q == null) return '';
  // Gros volumes de la liste de courses : 1,13 kg plutôt que 1130 g.
  const big = { g: [1000, 'kg'], ml: [1000, 'l'], cl: [100, 'l'] }[unit];
  if (big && q >= big[0]) return formatQty(Math.round((q / big[0]) * 100) / 100, big[1]);
  const whole = Math.floor(q);
  const frac = FRACTIONS[Math.round((q - whole) * 100) / 100];
  const n = frac ? `${whole || ''}${frac}` : String(q).replace('.', ',');
  return unit ? `${n} ${unit}` : n;
}

export function scaleIngredients(r, servings) {
  const k = servings / r.servings;
  return r.ingredients.map((i) => ({ ...i, qty: i.qty == null ? null : roundQty(i.qty * k, i.unit) }));
}

export function filterRecipes(list, filter = 'all', meal = null, favorites = {}) {
  const test = filter === 'fav' ? (r) => !!favorites[r.id] : (FILTERS[filter] || FILTERS.all).test;
  return list.filter((r) => (!meal || r.meal === meal) && test(r));
}

// Nom de rangement : sans précision entre parenthèses ni après la virgule, au singulier (« gousses d'ail » = « gousse d'ail »).
const baseName = (n) => n.toLowerCase().replace(/\(.*?\)/g, '').split(',')[0].trim().split(/\s+/).map((w) => w.replace(/([^s])s$/, '$1')).join(' ');

// Liste de courses : ingrédients de plusieurs recettes additionnés (même nom et même unité), rangés par rayon.
// Les cuillères se comptent ensemble (1 c. à s. = 3 c. à c.), et un ingrédient commun perd ses précisions entre parenthèses.
const SPOONS = { 'c. à c.': 1, 'c. à s.': 3 };
export function shoppingList(picks, recipes = RECIPES) {
  const items = new Map();
  for (const { id, servings } of picks) {
    const r = recipes.find((x) => x.id === id);
    if (!r) continue;
    const k = servings / r.servings;
    for (const i of r.ingredients) {
      const spoon = SPOONS[i.unit];
      const key = `${baseName(i.name)}|${spoon ? 'cuillère' : i.unit || ''}`;
      const prev = items.get(key);
      const qty = i.qty == null ? null : i.qty * k * (spoon || 1);
      items.set(key, {
        name: prev ? prev.name : i.name, unit: spoon ? 'c. à c.' : i.unit || '', aisle: i.aisle || 'epicerie',
        qty: prev ? (prev.qty == null || qty == null ? null : prev.qty + qty) : qty, from: [...(prev?.from || []), r.name],
      });
    }
  }
  const out = {};
  for (const [key, it] of items) {
    let { qty, unit, name } = it;
    if (unit === 'c. à c.' && qty >= 3) [qty, unit] = [qty / 3, 'c. à s.'];
    if (new Set(it.from).size > 1) name = name.replace(/\s*\(.*?\)/g, '');
    (out[it.aisle] ||= []).push({ ...it, name, unit, key, qty: qty == null ? null : roundQty(qty, unit) });
  }
  Object.values(out).forEach((l) => l.sort((a, b) => a.name.localeCompare(b.name, 'fr')));
  return Object.keys(AISLES).filter((a) => out[a]).map((a) => ({ aisle: a, label: AISLES[a], items: out[a] }));
}

// Recettes cochées pour les courses (state.food.cart), chacune pour ses portions (réglées sur la fiche, sinon celles de la recette).
export function cartPicks(food = {}, recipes = RECIPES) {
  return Object.keys(food.cart || {}).map((id) => recipes.find((r) => r.id === id)).filter(Boolean)
    .map((r) => ({ id: r.id, servings: food.servings?.[r.id] || r.servings }));
}

// ---------- Planning des repas ----------
// state.food.plan[date] = { midi, soir, collation } : id de recette, 'cantine' ou 'dehors' (rien n'est imposé).
export const SLOTS = { midi: 'Midi', soir: 'Soir', collation: 'Collation' };
export const OUTSIDE = { cantine: '🏢 Cantine, au travail', dehors: '🍴 Repas dehors' };

// Repères pour la recomposition (muscle et un peu de gras en moins) : 2 g de protéines par kilo, environ 37 kcal par kilo.
export const proteinTarget = (kg) => Math.round((2 * kg) / 5) * 5;
export const kcalTarget = (kg) => Math.round((37 * kg) / 50) * 50;

// Portions prévues sur des dates : une portion par repas planifié, regroupées par recette.
export function planPicks(plan = {}, dates, recipes = RECIPES) {
  const count = {};
  for (const d of dates) {
    for (const v of Object.values(plan[d] || {})) if (recipes.some((r) => r.id === v)) count[v] = (count[v] || 0) + 1;
  }
  return Object.entries(count).map(([id, servings]) => ({ id, servings }));
}

// Coche les recettes prévues sur ces dates, avec assez de portions pour chaque repas où elles reviennent.
export function cartFromPlan(food = {}, dates, recipes = RECIPES) {
  const cart = { ...food.cart };
  const servings = { ...food.servings };
  for (const { id, servings: n } of planPicks(food.plan, dates, recipes)) {
    cart[id] = true;
    if (n > (servings[id] || recipes.find((r) => r.id === id).servings)) servings[id] = n;
  }
  return { cart, servings };
}

// Apports prévus sur une journée ; outside = un repas hors maison dont on ne connaît pas les apports.
export function dayTotals(day = {}, recipes = RECIPES) {
  const rs = Object.values(day).map((v) => recipes.find((r) => r.id === v)).filter(Boolean);
  return {
    protein: rs.reduce((n, r) => n + r.protein, 0),
    kcal: rs.reduce((n, r) => n + r.kcal, 0),
    outside: Object.values(day).some((v) => OUTSIDE[v]),
  };
}

// Idées selon la journée : avant ou après une séance, des plats riches en glucides ; au repos, moins de féculents.
// La sélection tourne avec la date pour varier d'un jour à l'autre.
export function suggestMeals(training, date, recipes = RECIPES, n = 3) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  const rotate = (list, k) => list.slice(k % list.length).concat(list.slice(0, k % list.length));
  const plats = recipes.filter((r) => r.meal === 'plat').sort((a, b) => (training ? b.carbs - a.carbs : a.carbs - b.carbs) || b.protein - a.protein);
  const pool = plats.slice(0, Math.max(n, Math.ceil(plats.length / 2)));
  const snacks = recipes.filter((r) => r.meal === 'collation' && (training ? r.carbs >= 15 : r.protein >= 15));
  return { dinners: rotate(pool, day).slice(0, n), snack: rotate(snacks, day)[0] || null };
}

// Remplit seulement les soirs vides de la semaine : idées selon les séances, sans répéter un plat.
export function fillDinners(plan = {}, days, recipes = RECIPES) {
  const used = new Set(days.flatMap(({ date }) => Object.values(plan[date] || {})));
  const out = { ...plan };
  for (const { date, training } of days) {
    if (out[date]?.soir) continue;
    const { dinners } = suggestMeals(training, new Date(`${date}T12:00:00`), recipes, recipes.length);
    const pick = dinners.find((r) => !used.has(r.id));
    if (!pick) continue;
    used.add(pick.id);
    out[date] = { ...out[date], soir: pick.id };
  }
  return out;
}

// Apports par portion calculés à partir de valeurs moyennes (table Ciqual), arrondis : des repères, pas une pesée.
export const RECIPES = [
  {
    id: 'saumon-teriyaki', name: 'Saumon teriyaki, riz et haricots verts', meal: 'plat', cuisine: 'Japonaise', servings: 2, prep: 10, cook: 20, tools: ['four', 'cuiseur', 'plaques'], tags: ['emporter'], fridge: 2, freezer: false, kcal: 651, protein: 37, carbs: 81, fat: 18,
    ingredients: [
      { qty: 2, unit: '', name: 'pavés de saumon (environ 130 g chacun)', aisle: 'frais' },
      { qty: 160, unit: 'g', name: 'riz japonais ou basmati', aisle: 'epicerie' },
      { qty: 300, unit: 'g', name: 'haricots verts surgelés', aisle: 'surgeles' },
      { qty: 3, unit: 'c. à s.', name: 'sauce soja', aisle: 'epices' },
      { qty: 1, unit: 'c. à s.', name: 'miel', aisle: 'epicerie' },
      { qty: 1, unit: 'c. à s.', name: 'vinaigre de riz (ou jus de citron)', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'maïzena', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'gousse d\'ail', aisle: 'legumes' },
      { qty: 1, unit: 'c. à c.', name: 'gingembre râpé (frais ou en tube)', aisle: 'legumes' },
      { qty: 1, unit: 'c. à c.', name: 'graines de sésame', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'oignon vert', aisle: 'legumes' },
    ],
    steps: [
      'Rince le riz 3 fois et lance-le au cuiseur avec l\'eau indiquée par la graduation.',
      'Préchauffe le four à 200 °C. Mélange la sauce soja, le miel, le vinaigre, l\'ail écrasé, le gingembre et la maïzena délayée dans 2 c. à s. d\'eau.',
      { t: 'Pose les pavés côté peau dans un plat, nappe-les avec la moitié de la sauce et enfourne.', min: 12 },
      { t: 'Pendant ce temps, fais cuire les haricots verts à l\'eau bouillante salée (ou 5 min au micro-ondes, couverts, avec un fond d\'eau).', min: 8 },
      { t: 'Fais chauffer le reste de la sauce dans une petite casserole jusqu\'à ce qu\'elle nappe la cuillère.', min: 2 },
      'Sers le saumon sur le riz, arrosé de sauce, avec le sésame et l\'oignon vert ciselé, les haricots à côté.',
    ],
    tip: 'Le saumon se garde 2 jours : parfait pour le déjeuner du lendemain, réchauffé 1 min 30 au micro-ondes à puissance moyenne.',
  },
  {
    id: 'oyakodon', name: 'Oyakodon, bol de riz au poulet et à l\'œuf fondant', meal: 'plat', cuisine: 'Japonaise', servings: 2, prep: 10, cook: 15, tools: ['cuiseur', 'plaques'], tags: ['decouverte'], fridge: 1, freezer: false, kcal: 636, protein: 55, carbs: 74, fat: 12,
    ingredients: [
      { qty: 160, unit: 'g', name: 'riz japonais', aisle: 'epicerie' },
      { qty: 300, unit: 'g', name: 'blancs de poulet (ou hauts de cuisse)', aisle: 'frais' },
      { qty: 3, unit: '', name: 'œufs', aisle: 'frais' },
      { qty: 1, unit: '', name: 'oignon', aisle: 'legumes' },
      { qty: 15, unit: 'cl', name: 'bouillon de volaille (ou dashi)', aisle: 'epices' },
      { qty: 3, unit: 'c. à s.', name: 'sauce soja', aisle: 'epices' },
      { qty: 2, unit: 'c. à c.', name: 'sucre (ou 1 c. à s. de mirin)', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'oignon vert', aisle: 'legumes' },
    ],
    steps: [
      'Lance le riz au cuiseur.',
      'Coupe le poulet en morceaux de 2 cm et l\'oignon en fines lamelles.',
      { t: 'Dans une poêle moyenne, porte à frémissement le bouillon, la sauce soja et le sucre. Ajoute l\'oignon.', min: 3 },
      { t: 'Ajoute le poulet, couvre et laisse mijoter en retournant les morceaux à mi-cuisson.', min: 7 },
      { t: 'Bats légèrement les œufs (blancs et jaunes encore marbrés), verse-les en filet sur le poulet, couvre et coupe le feu : ils doivent rester crémeux.', min: 1 },
      'Fais glisser le tout sur le riz chaud et parsème d\'oignon vert. Une pincée de shichimi (mélange 7 épices) si tu en as.',
    ],
    tip: 'Oyako-don veut dire « bol parent et enfant » : le poulet et l\'œuf. Il est meilleur tout juste fait, en 25 min un soir de semaine.',
  },
  {
    id: 'bulgogi', name: 'Bulgogi, bol de riz au bœuf mariné', meal: 'plat', cuisine: 'Coréenne', servings: 2, prep: 15, cook: 10, marinate: 30, tools: ['cuiseur', 'plaques'], tags: ['emporter', 'decouverte'], fridge: 3, freezer: false, kcal: 697, protein: 50, carbs: 82, fat: 18,
    ingredients: [
      { qty: 300, unit: 'g', name: 'bœuf émincé (rumsteck ou bavette) en fines lamelles', aisle: 'frais' },
      { qty: 160, unit: 'g', name: 'riz', aisle: 'epicerie' },
      { qty: 3, unit: 'c. à s.', name: 'sauce soja', aisle: 'epices' },
      { qty: 1, unit: 'c. à s.', name: 'miel', aisle: 'epicerie' },
      { qty: 1, unit: 'c. à s.', name: 'huile de sésame', aisle: 'epicerie' },
      { qty: 2, unit: '', name: 'gousses d\'ail', aisle: 'legumes' },
      { qty: 1, unit: 'c. à c.', name: 'gingembre râpé', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'carotte', aisle: 'legumes' },
      { qty: 0.5, unit: '', name: 'concombre', aisle: 'legumes' },
      { qty: 2, unit: '', name: 'œufs', aisle: 'frais' },
      { qty: 1, unit: 'c. à c.', name: 'graines de sésame', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'oignon vert', aisle: 'legumes' },
      { qty: 2, unit: 'c. à c.', name: 'gochujang (pâte de piment coréenne, facultatif)', aisle: 'epices' },
    ],
    steps: [
      { t: 'Mélange la sauce soja, le miel, l\'huile de sésame, l\'ail écrasé et le gingembre. Ajoute le bœuf, mélange et laisse mariner au frais (ou depuis la veille).', min: 30 },
      'Lance le riz au cuiseur. Râpe la carotte, coupe le concombre en fins bâtonnets, cisèle l\'oignon vert.',
      { t: 'Fais chauffer une grande poêle à feu vif et saisis le bœuf égoutté en deux fournées, sans trop remuer pour qu\'il caramélise.', min: 3 },
      { t: 'Dans la même poêle, fais cuire les œufs au plat, jaune coulant.', min: 3 },
      'Dresse dans des bols : riz, bœuf, carotte, concombre, œuf, sésame et oignon vert. Une touche de gochujang si tu aimes relevé.',
    ],
    tip: 'Pour l\'emporter, garde les crudités à part et remplace l\'œuf au plat par un œuf dur. Gochujang au rayon asiatique.',
  },
  {
    id: 'bo-bun', name: 'Bo bun au porc à la citronnelle', meal: 'plat', cuisine: 'Vietnamienne', servings: 2, prep: 25, cook: 10, marinate: 20, tools: ['plaques'], tags: ['emporter', 'decouverte'], fridge: 2, freezer: false, kcal: 694, protein: 43, carbs: 86, fat: 19,
    ingredients: [
      { qty: 300, unit: 'g', name: 'filet mignon de porc', aisle: 'frais' },
      { qty: 150, unit: 'g', name: 'vermicelles de riz', aisle: 'epicerie' },
      { qty: 4, unit: 'c. à s.', name: 'nuoc-mâm (sauce de poisson)', aisle: 'epices' },
      { qty: 2, unit: 'c. à s.', name: 'sucre', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'tige de citronnelle (ou 1 c. à c. surgelée)', aisle: 'legumes' },
      { qty: 2, unit: '', name: 'gousses d\'ail', aisle: 'legumes' },
      { qty: 1, unit: 'c. à s.', name: 'huile neutre', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'carotte', aisle: 'legumes' },
      { qty: 0.5, unit: '', name: 'concombre', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'cœur de laitue', aisle: 'legumes' },
      { qty: 0.5, unit: '', name: 'bouquet de menthe (et de basilic thaï si tu en trouves)', aisle: 'legumes' },
      { qty: 30, unit: 'g', name: 'cacahuètes grillées non salées', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'citron vert', aisle: 'legumes' },
    ],
    steps: [
      { t: 'Émince finement le porc. Mélange-le avec 2 c. à s. de nuoc-mâm, 1 c. à s. de sucre, l\'ail et la citronnelle hachés et l\'huile. Laisse mariner.', min: 20 },
      'Prépare la sauce : 2 c. à s. de nuoc-mâm, le jus du citron vert, 1 c. à s. de sucre, 4 c. à s. d\'eau, un peu d\'ail et de piment. Remue jusqu\'à ce que le sucre fonde.',
      { t: 'Fais cuire les vermicelles dans l\'eau bouillante (voir le paquet), rince-les à l\'eau froide et égoutte.', min: 4 },
      'Râpe la carotte, coupe le concombre en bâtonnets, émince la laitue, effeuille les herbes et concasse les cacahuètes.',
      { t: 'Saisis le porc à feu vif dans une poêle bien chaude jusqu\'à ce qu\'il soit doré.', min: 5 },
      'Dans de grands bols : laitue, vermicelles, crudités, porc chaud, herbes et cacahuètes. Arrose de sauce au moment de manger.',
    ],
    tip: 'Parfait à emporter : la sauce dans un petit pot à part. Se mange froid, ou avec le porc réchauffé 30 s.',
  },
  {
    id: 'curry-vert', name: 'Curry vert thaï au poulet et courgettes', meal: 'plat', cuisine: 'Thaïe', servings: 4, prep: 15, cook: 20, tools: ['plaques', 'cuiseur'], tags: ['batch'], fridge: 3, freezer: true, kcal: 591, protein: 45, carbs: 71, fat: 14,
    ingredients: [
      { qty: 600, unit: 'g', name: 'blancs de poulet', aisle: 'frais' },
      { qty: 300, unit: 'g', name: 'riz jasmin', aisle: 'epicerie' },
      { qty: 400, unit: 'ml', name: 'lait de coco allégé', aisle: 'conserves' },
      { qty: 2, unit: 'c. à s.', name: 'pâte de curry vert', aisle: 'epices' },
      { qty: 2, unit: '', name: 'courgettes', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'poivron rouge', aisle: 'legumes' },
      { qty: 150, unit: 'g', name: 'haricots verts', aisle: 'surgeles' },
      { qty: 1, unit: 'c. à s.', name: 'nuoc-mâm', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'sucre', aisle: 'epicerie' },
      { qty: 1, unit: 'c. à s.', name: 'huile neutre', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'citron vert', aisle: 'legumes' },
      { qty: 0.5, unit: '', name: 'bouquet de basilic thaï (ou de basilic)', aisle: 'legumes' },
    ],
    steps: [
      'Lance le riz jasmin au cuiseur.',
      'Coupe le poulet en morceaux, les courgettes en demi-rondelles, le poivron en lanières et les haricots en deux.',
      { t: 'Dans une sauteuse, fais revenir la pâte de curry dans l\'huile à feu moyen avec 3 c. à s. de lait de coco, jusqu\'à ce que ça sente fort.', min: 1 },
      { t: 'Ajoute le poulet et fais-le dorer. Verse le reste du lait de coco, le nuoc-mâm et le sucre.', min: 3 },
      { t: 'Ajoute les haricots et le poivron, laisse mijoter 5 min, puis les courgettes 5 min de plus : les légumes restent un peu croquants.', min: 10 },
      'Hors du feu, un trait de citron vert et le basilic. Goûte : plus de nuoc-mâm pour le sel, plus de pâte pour le piquant.',
    ],
    tip: 'Les pâtes de curry n\'ont pas toutes la même force : commence par 1 c. à s. si tu crains le piquant. Congèle le curry sans le riz.',
  },
  {
    id: 'mapo-tofu', name: 'Mapo tofu au porc haché', meal: 'plat', cuisine: 'Chinoise (Sichuan)', servings: 3, prep: 10, cook: 15, tools: ['plaques', 'cuiseur'], tags: ['decouverte'], fridge: 3, freezer: false, kcal: 657, protein: 38, carbs: 70, fat: 24,
    ingredients: [
      { qty: 400, unit: 'g', name: 'tofu ferme', aisle: 'frais' },
      { qty: 200, unit: 'g', name: 'porc haché (ou bœuf haché 5 %)', aisle: 'frais' },
      { qty: 225, unit: 'g', name: 'riz', aisle: 'epicerie' },
      { qty: 2, unit: 'c. à s.', name: 'doubanjiang (pâte de piment aux fèves)', aisle: 'epices' },
      { qty: 1, unit: 'c. à s.', name: 'sauce soja', aisle: 'epices' },
      { qty: 2, unit: '', name: 'gousses d\'ail', aisle: 'legumes' },
      { qty: 1, unit: 'c. à c.', name: 'gingembre râpé', aisle: 'legumes' },
      { qty: 25, unit: 'cl', name: 'bouillon de volaille', aisle: 'epices' },
      { qty: 1, unit: 'c. à s.', name: 'maïzena', aisle: 'epicerie' },
      { qty: 1, unit: 'c. à s.', name: 'huile neutre', aisle: 'epicerie' },
      { qty: 300, unit: 'g', name: 'pak choï (ou épinards)', aisle: 'legumes' },
      { qty: 1, unit: 'c. à c.', name: 'poivre du Sichuan moulu (facultatif)', aisle: 'epices' },
      { qty: 2, unit: '', name: 'oignons verts', aisle: 'legumes' },
    ],
    steps: [
      { t: 'Lance le riz. Coupe le tofu en cubes de 2 cm et plonge-les dans de l\'eau frémissante salée : ils se tiendront mieux. Égoutte.', min: 2 },
      { t: 'Dans une sauteuse chaude, fais revenir le porc dans l\'huile en l\'émiettant jusqu\'à ce qu\'il soit bien doré.', min: 4 },
      { t: 'Ajoute le doubanjiang, l\'ail et le gingembre hachés et remue : l\'huile devient rouge.', min: 1 },
      { t: 'Verse le bouillon et la sauce soja, porte à frémissement et ajoute délicatement le tofu. Laisse mijoter en poussant doucement avec le dos d\'une cuillère.', min: 5 },
      'Délaye la maïzena dans 3 c. à s. d\'eau froide et verse-la en filet en remuant doucement, jusqu\'à ce que la sauce nappe.',
      { t: 'Fais sauter le pak choï coupé en deux dans une poêle avec un peu de sauce soja. Sers sur le riz, poivre du Sichuan et oignon vert par-dessus.', min: 3 },
    ],
    tip: 'Doubanjiang en épicerie asiatique ; à défaut, 1 c. à s. de miso et 1 c. à c. de sambal oelek. Le poivre du Sichuan fait picoter la langue, il ne pique pas.',
  },
  {
    id: 'butter-chicken', name: 'Butter chicken léger au yaourt', meal: 'plat', cuisine: 'Indienne', servings: 4, prep: 15, cook: 25, marinate: 30, tools: ['plaques', 'cuiseur'], tags: ['batch'], fridge: 3, freezer: true, kcal: 579, protein: 47, carbs: 70, fat: 11,
    ingredients: [
      { qty: 600, unit: 'g', name: 'blancs de poulet', aisle: 'frais' },
      { qty: 300, unit: 'g', name: 'riz basmati', aisle: 'epicerie' },
      { qty: 150, unit: 'g', name: 'skyr ou yaourt grec', aisle: 'cremerie' },
      { qty: 2, unit: 'c. à c.', name: 'garam masala', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'curcuma, paprika et cumin (de chaque)', aisle: 'epices' },
      { qty: 400, unit: 'g', name: 'tomates concassées en conserve', aisle: 'conserves' },
      { qty: 1, unit: 'c. à s.', name: 'concentré de tomate', aisle: 'conserves' },
      { qty: 1, unit: '', name: 'oignon', aisle: 'legumes' },
      { qty: 3, unit: '', name: 'gousses d\'ail', aisle: 'legumes' },
      { qty: 1, unit: 'c. à s.', name: 'gingembre râpé', aisle: 'legumes' },
      { qty: 20, unit: 'g', name: 'beurre', aisle: 'cremerie' },
      { qty: 10, unit: 'cl', name: 'crème légère 15 %', aisle: 'cremerie' },
      { qty: 1, unit: 'c. à c.', name: 'sucre', aisle: 'epicerie' },
      { qty: 0.5, unit: '', name: 'bouquet de persil plat', aisle: 'legumes' },
    ],
    steps: [
      { t: 'Coupe le poulet en morceaux et mélange-le avec le skyr, la moitié des épices, 1 gousse d\'ail râpée et du sel. Laisse mariner (ou toute la nuit).', min: 30 },
      'Lance le riz basmati au cuiseur.',
      { t: 'Fais dorer le poulet égoutté dans une grande poêle chaude avec la moitié du beurre, puis réserve-le.', min: 5 },
      { t: 'Dans la même poêle, fais fondre le reste du beurre et revenir l\'oignon haché 5 min, puis l\'ail, le gingembre et le reste des épices 1 min.', min: 6 },
      { t: 'Ajoute les tomates concassées, le concentré et le sucre et laisse mijoter. Mixe si tu veux une sauce lisse (facultatif).', min: 10 },
      { t: 'Remets le poulet, ajoute la crème et laisse mijoter encore. Persil plat ciselé au moment de servir.', min: 5 },
    ],
    tip: 'La marinade au yaourt rend le poulet très tendre : lance-la la veille au soir si tu cuisines le dimanche.',
  },
  {
    id: 'katsu-curry', name: 'Katsu curry, poulet pané au four et sauce curry japonaise', meal: 'plat', cuisine: 'Japonaise', servings: 2, prep: 20, cook: 30, tools: ['four', 'cuiseur', 'plaques'], tags: ['decouverte'], fridge: 2, freezer: false, kcal: 785, protein: 51, carbs: 102, fat: 18,
    ingredients: [
      { qty: 300, unit: 'g', name: 'blancs de poulet (2 filets)', aisle: 'frais' },
      { qty: 140, unit: 'g', name: 'riz japonais', aisle: 'epicerie' },
      { qty: 30, unit: 'g', name: 'panko (chapelure japonaise)', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'œuf', aisle: 'frais' },
      { qty: 3, unit: 'c. à s.', name: 'farine (pour la panure et la sauce)', aisle: 'epicerie' },
      { qty: 1, unit: 'c. à s.', name: 'huile neutre', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'oignon', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'carotte', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'pomme de terre moyenne', aisle: 'legumes' },
      { qty: 15, unit: 'g', name: 'beurre', aisle: 'cremerie' },
      { qty: 2, unit: 'c. à s.', name: 'curry en poudre doux', aisle: 'epices' },
      { qty: 40, unit: 'cl', name: 'bouillon de volaille', aisle: 'epices' },
      { qty: 1, unit: 'c. à s.', name: 'sauce soja', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'miel', aisle: 'epicerie' },
      { qty: 1, unit: 'c. à c.', name: 'concentré de tomate', aisle: 'conserves' },
    ],
    steps: [
      'Lance le riz au cuiseur. Préchauffe le four à 210 °C.',
      'Coupe chaque filet de poulet en deux dans l\'épaisseur pour obtenir des escalopes fines. Sale et poivre.',
      { t: 'Mélange le panko avec l\'huile et fais-le dorer dans une poêle à sec en remuant : c\'est le secret d\'un pané croustillant sans friture.', min: 3 },
      'Passe chaque escalope dans 1 c. à s. de farine, puis dans l\'œuf battu, puis dans le panko doré en appuyant bien.',
      { t: 'Pose-les sur une plaque couverte de papier cuisson et enfourne.', min: 15 },
      { t: 'Pendant ce temps, fais revenir l\'oignon émincé dans le beurre, puis ajoute la carotte et la pomme de terre en petits dés.', min: 5 },
      { t: 'Saupoudre le curry et 2 c. à s. de farine, remue 1 min, puis verse le bouillon petit à petit en remuant. Ajoute la sauce soja, le miel et le concentré, et laisse mijoter jusqu\'à ce que les légumes soient tendres et la sauce nappante.', min: 15 },
      'Tranche le poulet en lanières, pose-le sur le riz et verse la sauce à côté pour garder le pané croustillant.',
    ],
    tip: 'Au Japon, on utilise souvent la sauce en tablettes (rayon asiatique, « Golden Curry ») : remplace alors le curry, la farine de la sauce et le beurre par 2 carrés.',
  },
  {
    id: 'chili', name: 'Chili con carne', meal: 'plat', cuisine: 'Tex-mex', servings: 4, prep: 15, cook: 40, tools: ['plaques', 'cuiseur'], tags: ['batch'], fridge: 4, freezer: true, kcal: 618, protein: 46, carbs: 79, fat: 11,
    ingredients: [
      { qty: 500, unit: 'g', name: 'bœuf haché 5 %', aisle: 'frais' },
      { qty: 500, unit: 'g', name: 'haricots rouges en conserve, égouttés (2 boîtes)', aisle: 'conserves' },
      { qty: 400, unit: 'g', name: 'tomates concassées en conserve', aisle: 'conserves' },
      { qty: 2, unit: 'c. à s.', name: 'concentré de tomate', aisle: 'conserves' },
      { qty: 1, unit: '', name: 'oignon', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'poivron rouge', aisle: 'legumes' },
      { qty: 2, unit: '', name: 'gousses d\'ail', aisle: 'legumes' },
      { qty: 2, unit: 'c. à c.', name: 'cumin', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'paprika fumé et origan (de chaque)', aisle: 'epices' },
      { qty: 1, unit: 'c. à s.', name: 'huile', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'carré de chocolat noir', aisle: 'epicerie' },
      { qty: 240, unit: 'g', name: 'riz', aisle: 'epicerie' },
      { qty: 100, unit: 'g', name: 'skyr (à la place de la crème)', aisle: 'cremerie' },
    ],
    steps: [
      'Hache l\'oignon et l\'ail, coupe le poivron en dés.',
      { t: 'Dans une cocotte, fais dorer le bœuf à feu vif dans l\'huile en l\'émiettant 5 min, puis ajoute l\'oignon et le poivron 5 min.', min: 10 },
      { t: 'Ajoute l\'ail, les épices et le concentré de tomate, et remue.', min: 1 },
      { t: 'Verse les tomates concassées et 20 cl d\'eau, couvre et laisse mijoter à feu doux.', min: 20 },
      { t: 'Ajoute les haricots rincés et le chocolat, laisse mijoter à découvert. Lance le riz pendant ce temps.', min: 10 },
      'Sers sur le riz avec une cuillère de skyr et un peu d\'oignon vert ciselé.',
    ],
    tip: 'Meilleur réchauffé le lendemain : idéal le dimanche. Le chocolat arrondit l\'acidité, on ne le sent pas. Piment de Cayenne selon ton goût.',
  },
  {
    id: 'quesadillas', name: 'Quesadillas poulet, haricots noirs et cheddar', meal: 'plat', cuisine: 'Mexicaine', servings: 2, prep: 10, cook: 12, tools: ['plaques', 'grill'], tags: ['emporter'], fridge: 2, freezer: true, kcal: 787, protein: 59, carbs: 82, fat: 23,
    ingredients: [
      { qty: 4, unit: '', name: 'tortillas de blé moyennes', aisle: 'boulangerie' },
      { qty: 250, unit: 'g', name: 'blancs de poulet', aisle: 'frais' },
      { qty: 120, unit: 'g', name: 'haricots noirs (ou rouges) en conserve, égouttés', aisle: 'conserves' },
      { qty: 60, unit: 'g', name: 'cheddar râpé', aisle: 'cremerie' },
      { qty: 1, unit: '', name: 'poivron', aisle: 'legumes' },
      { qty: 0.5, unit: '', name: 'oignon rouge', aisle: 'legumes' },
      { qty: 1, unit: 'c. à c.', name: 'cumin et paprika (de chaque)', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'huile', aisle: 'epicerie' },
      { qty: 100, unit: 'g', name: 'skyr', aisle: 'cremerie' },
      { qty: 0.5, unit: '', name: 'citron vert', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'oignon vert', aisle: 'legumes' },
    ],
    steps: [
      { t: 'Coupe le poulet en fines lanières, assaisonne de cumin, paprika et sel. Fais-le sauter dans l\'huile avec le poivron et l\'oignon émincés.', min: 6 },
      'Écrase grossièrement les haricots noirs à la fourchette.',
      'Sur une moitié de chaque tortilla : haricots, poulet aux poivrons et cheddar. Replie en demi-lune.',
      { t: 'Cuis les quesadillas au grill-presse préchauffé, deux par deux, jusqu\'à ce qu\'elles soient dorées et le fromage fondu.', min: 4 },
      'Mélange le skyr, le jus de citron vert, l\'oignon vert ciselé et une pincée de sel pour la sauce. Coupe les quesadillas en triangles.',
    ],
    tip: 'Elles se congèlent garnies, avant cuisson : 6 min au grill-presse directement sorties du congélateur.',
  },
  {
    id: 'yassa', name: 'Poulet yassa, citron et oignons confits', meal: 'plat', cuisine: 'Sénégalaise', servings: 4, prep: 20, cook: 45, marinate: 60, tools: ['plaques', 'cuiseur'], tags: ['batch', 'decouverte'], fridge: 4, freezer: true, kcal: 655, protein: 41, carbs: 74, fat: 20,
    ingredients: [
      { qty: 700, unit: 'g', name: 'hauts de cuisse de poulet désossés sans peau (ou blancs)', aisle: 'frais' },
      { qty: 4, unit: '', name: 'gros oignons', aisle: 'legumes' },
      { qty: 3, unit: '', name: 'citrons', aisle: 'legumes' },
      { qty: 2, unit: 'c. à s.', name: 'moutarde', aisle: 'epices' },
      { qty: 3, unit: '', name: 'gousses d\'ail', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'cube de bouillon de volaille', aisle: 'epices' },
      { qty: 1, unit: 'c. à s.', name: 'huile', aisle: 'epicerie' },
      { qty: 60, unit: 'g', name: 'olives vertes dénoyautées', aisle: 'conserves' },
      { qty: 300, unit: 'g', name: 'riz', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'piment (facultatif)', aisle: 'legumes' },
    ],
    steps: [
      { t: 'Émince finement les oignons. Mélange le jus des citrons, la moutarde, l\'ail écrasé, sel et poivre, et fais-y mariner le poulet et les oignons (idéalement une nuit).', min: 60 },
      { t: 'Égoutte le poulet (garde la marinade et les oignons) et fais-le dorer dans l\'huile dans une cocotte, 3 min de chaque côté. Réserve.', min: 6 },
      { t: 'Dans la même cocotte, fais fondre les oignons égouttés à feu moyen en remuant : ils doivent devenir dorés et confits, pas brûlés.', min: 15 },
      { t: 'Ajoute la marinade, le cube émietté, 15 cl d\'eau, le poulet et les olives. Couvre et laisse mijoter. Lance le riz.', min: 20 },
      'Goûte et ajuste avec un peu de citron ou de moutarde : la sauce doit être à la fois acidulée et douce.',
    ],
    tip: 'Un grand classique du Sénégal, simple à faire : tout se joue sur les oignons, confits lentement.',
  },
  {
    id: 'tajine-kefta', name: 'Tajine de boulettes de bœuf aux œufs, semoule', meal: 'plat', cuisine: 'Marocaine', servings: 3, prep: 20, cook: 30, tools: ['plaques', 'micro'], tags: ['decouverte'], fridge: 2, freezer: false, kcal: 621, protein: 51, carbs: 62, fat: 19,
    ingredients: [
      { qty: 450, unit: 'g', name: 'bœuf haché 5 %', aisle: 'frais' },
      { qty: 1, unit: '', name: 'oignon', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'bouquet de persil', aisle: 'legumes' },
      { qty: 2, unit: 'c. à c.', name: 'cumin', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'paprika, et ½ c. à c. de cannelle', aisle: 'epices' },
      { qty: 400, unit: 'g', name: 'tomates concassées en conserve', aisle: 'conserves' },
      { qty: 1, unit: 'c. à s.', name: 'concentré de tomate', aisle: 'conserves' },
      { qty: 1, unit: '', name: 'courgette', aisle: 'legumes' },
      { qty: 3, unit: '', name: 'œufs', aisle: 'frais' },
      { qty: 1, unit: 'c. à s.', name: 'huile d\'olive', aisle: 'epicerie' },
      { qty: 210, unit: 'g', name: 'semoule moyenne', aisle: 'epicerie' },
    ],
    steps: [
      'Mélange le bœuf avec la moitié de l\'oignon râpé, la moitié des herbes hachées, le cumin, le paprika, la cannelle, sel et poivre. Forme une vingtaine de boulettes de la taille d\'une noix.',
      { t: 'Dans une sauteuse avec couvercle, fais revenir le reste de l\'oignon haché dans l\'huile 3 min, puis ajoute les tomates, le concentré, la courgette en dés et 10 cl d\'eau. Laisse mijoter.', min: 13 },
      { t: 'Dépose les boulettes dans la sauce, couvre et laisse cuire en les retournant à mi-cuisson.', min: 12 },
      { t: 'Casse les œufs entre les boulettes et couvre : blancs pris, jaunes encore coulants.', min: 6 },
      { t: 'Pendant ce temps, verse la semoule dans un saladier, couvre-la d\'autant d\'eau bouillante salée (chauffée au micro-ondes), couvre et laisse gonfler, puis égraine à la fourchette avec un filet d\'huile.', min: 5 },
      'Parsème du reste des herbes et sers directement dans la sauteuse.',
    ],
    tip: 'Pour du stock : fais les boulettes en sauce en double et congèle-en la moitié sans les œufs ; ajoute les œufs en réchauffant.',
  },
  {
    id: 'goulash', name: 'Goulash de bœuf au paprika et pommes de terre', meal: 'plat', cuisine: 'Hongroise', servings: 4, prep: 20, cook: 120, tools: ['plaques'], tags: ['batch', 'decouverte'], fridge: 4, freezer: true, kcal: 482, protein: 45, carbs: 42, fat: 14,
    ingredients: [
      { qty: 700, unit: 'g', name: 'bœuf à mijoter (paleron ou macreuse)', aisle: 'frais' },
      { qty: 600, unit: 'g', name: 'pommes de terre', aisle: 'legumes' },
      { qty: 2, unit: '', name: 'oignons', aisle: 'legumes' },
      { qty: 2, unit: '', name: 'poivrons rouges', aisle: 'legumes' },
      { qty: 2, unit: '', name: 'carottes', aisle: 'legumes' },
      { qty: 2, unit: 'c. à s.', name: 'paprika doux (+ 1 c. à c. de fumé)', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'carvi ou cumin', aisle: 'epices' },
      { qty: 2, unit: 'c. à s.', name: 'concentré de tomate', aisle: 'conserves' },
      { qty: 3, unit: '', name: 'gousses d\'ail', aisle: 'legumes' },
      { qty: 1, unit: 'c. à s.', name: 'huile', aisle: 'epicerie' },
      { qty: 1, unit: 'l', name: 'bouillon de bœuf', aisle: 'epices' },
      { qty: 100, unit: 'g', name: 'skyr ou crème légère, pour servir', aisle: 'cremerie' },
    ],
    steps: [
      'Coupe le bœuf en cubes de 3 cm, émince les oignons, coupe les poivrons et les carottes en morceaux et les pommes de terre en gros dés.',
      { t: 'Dans une cocotte, fais dorer le bœuf dans l\'huile en deux fournées, 4 min chacune. Réserve.', min: 8 },
      { t: 'Fais revenir les oignons jusqu\'à ce qu\'ils soient bien dorés. Hors du feu, ajoute le paprika, le carvi, l\'ail et le concentré (le paprika brûle vite).', min: 8 },
      { t: 'Remets la viande, verse le bouillon, couvre et laisse mijoter à feu doux.', min: 60 },
      { t: 'Ajoute carottes, poivrons et pommes de terre. Poursuis 40 min à couvert puis 10 min sans couvercle pour épaissir.', min: 50 },
      'Sers bien chaud avec une cuillère de skyr ou de crème.',
    ],
    tip: 'Le paleron devient fondant après 1 h 30 : ne raccourcis pas la cuisson. Il mijote tout seul pendant que tu fais autre chose.',
  },
  {
    id: 'lasagnes', name: 'Lasagnes à la dinde et aux épinards', meal: 'plat', cuisine: 'Italienne', servings: 5, prep: 30, cook: 45, tools: ['four', 'plaques', 'micro'], tags: ['batch'], fridge: 4, freezer: true, kcal: 584, protein: 46, carbs: 60, fat: 17,
    ingredients: [
      { qty: 600, unit: 'g', name: 'dinde hachée (ou bœuf haché 5 %)', aisle: 'frais' },
      { qty: 250, unit: 'g', name: 'feuilles de lasagne (environ 12)', aisle: 'epicerie' },
      { qty: 800, unit: 'g', name: 'tomates concassées en conserve', aisle: 'conserves' },
      { qty: 1, unit: '', name: 'oignon', aisle: 'legumes' },
      { qty: 2, unit: '', name: 'gousses d\'ail', aisle: 'legumes' },
      { qty: 2, unit: 'c. à c.', name: 'origan ou herbes de Provence', aisle: 'epices' },
      { qty: 400, unit: 'g', name: 'épinards surgelés', aisle: 'surgeles' },
      { qty: 60, unit: 'cl', name: 'lait demi-écrémé', aisle: 'cremerie' },
      { qty: 50, unit: 'g', name: 'maïzena', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'pincée de muscade', aisle: 'epices' },
      { qty: 125, unit: 'g', name: 'mozzarella allégée', aisle: 'cremerie' },
      { qty: 40, unit: 'g', name: 'parmesan râpé', aisle: 'cremerie' },
      { qty: 1, unit: 'c. à s.', name: 'huile d\'olive', aisle: 'epicerie' },
    ],
    steps: [
      { t: 'Fais revenir l\'oignon haché dans l\'huile 3 min, ajoute la dinde et fais-la dorer en l\'émiettant.', min: 9 },
      { t: 'Ajoute l\'ail, les tomates concassées, l\'origan, sel et poivre, et laisse mijoter.', min: 15 },
      { t: 'Décongèle les épinards au micro-ondes puis presse-les pour retirer l\'eau.', min: 5 },
      { t: 'Béchamel légère : délaye la maïzena dans un peu de lait froid. Chauffe le reste du lait, verse la maïzena en fouettant et laisse épaissir sans cesser de fouetter. Sel, poivre, muscade, puis les épinards.', min: 3 },
      'Préchauffe le four à 180 °C. Dans un plat, alterne sauce à la viande, feuilles de lasagne et béchamel aux épinards, en finissant par la béchamel.',
      { t: 'Parsème de mozzarella en morceaux et de parmesan, puis enfourne jusqu\'à ce que le dessus soit gratiné. Laisse reposer 10 min avant de couper.', min: 45 },
    ],
    tip: 'Une fois refroidies, coupe-les en parts et congèle-les une par une : une part se réchauffe en 5 min au micro-ondes.',
  },
  {
    id: 'cabillaud-panko', name: 'Cabillaud en croûte de panko, purée de patate douce', meal: 'plat', cuisine: 'Française', servings: 2, prep: 15, cook: 20, tools: ['four', 'micro', 'plaques'], tags: [], fridge: 2, freezer: false, kcal: 570, protein: 42, carbs: 74, fat: 11,
    ingredients: [
      { qty: 2, unit: '', name: 'dos de cabillaud (environ 150 g chacun)', aisle: 'frais' },
      { qty: 30, unit: 'g', name: 'panko (ou chapelure)', aisle: 'epicerie' },
      { qty: 15, unit: 'g', name: 'parmesan râpé', aisle: 'cremerie' },
      { qty: 1, unit: 'c. à s.', name: 'moutarde', aisle: 'epices' },
      { qty: 1, unit: 'c. à s.', name: 'huile d\'olive', aisle: 'epicerie' },
      { qty: 500, unit: 'g', name: 'patate douce', aisle: 'legumes' },
      { qty: 200, unit: 'g', name: 'petits pois surgelés', aisle: 'surgeles' },
      { qty: 5, unit: 'cl', name: 'lait', aisle: 'cremerie' },
      { qty: 1, unit: '', name: 'citron', aisle: 'legumes' },
      { qty: 0.25, unit: '', name: 'bouquet de persil', aisle: 'legumes' },
    ],
    steps: [
      'Préchauffe le four à 200 °C. Épluche la patate douce et coupe-la en cubes.',
      { t: 'Mets les cubes dans un saladier avec 3 c. à s. d\'eau, couvre et cuis au micro-ondes à pleine puissance, jusqu\'à ce qu\'ils s\'écrasent facilement.', min: 12 },
      'Pose le cabillaud sur une plaque et badigeonne le dessus de moutarde. Mélange le panko, le parmesan, le persil haché, l\'huile et le zeste du citron, puis presse ce mélange sur le poisson.',
      { t: 'Enfourne : la croûte doit être dorée et le poisson se détacher en lamelles.', min: 14 },
      { t: 'Pendant ce temps, cuis les petits pois à l\'eau bouillante. Écrase la patate douce avec le lait chaud, sel et poivre.', min: 4 },
      'Sers avec des quartiers de citron.',
    ],
    tip: 'Le panko, une chapelure japonaise en gros flocons, donne une croûte bien plus croustillante. Rayon asiatique.',
  },
  {
    id: 'nasi-goreng', name: 'Nasi goreng, riz sauté au poulet et œuf au plat', meal: 'plat', cuisine: 'Indonésienne', servings: 2, prep: 10, cook: 15, tools: ['cuiseur', 'plaques'], tags: ['decouverte'], fridge: 2, freezer: false, kcal: 731, protein: 52, carbs: 89, fat: 17,
    ingredients: [
      { qty: 160, unit: 'g', name: 'riz (idéalement cuit la veille)', aisle: 'epicerie' },
      { qty: 250, unit: 'g', name: 'blancs de poulet', aisle: 'frais' },
      { qty: 3, unit: '', name: 'œufs (2 au plat, 1 brouillé dans le riz)', aisle: 'frais' },
      { qty: 1, unit: '', name: 'carotte', aisle: 'legumes' },
      { qty: 100, unit: 'g', name: 'petits pois surgelés', aisle: 'surgeles' },
      { qty: 2, unit: '', name: 'échalotes (ou 1 oignon)', aisle: 'legumes' },
      { qty: 2, unit: '', name: 'gousses d\'ail', aisle: 'legumes' },
      { qty: 2, unit: 'c. à s.', name: 'kecap manis (sauce soja sucrée)', aisle: 'epices' },
      { qty: 1, unit: 'c. à s.', name: 'sauce soja', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'sambal oelek ou sriracha (selon ton goût)', aisle: 'epices' },
      { qty: 2, unit: 'c. à c.', name: 'huile neutre', aisle: 'epicerie' },
      { qty: 0.5, unit: '', name: 'concombre', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'citron vert', aisle: 'legumes' },
    ],
    steps: [
      'Si tu n\'as pas de riz de la veille, cuis-le au cuiseur puis étale-le sur une assiette pour qu\'il refroidisse : un riz chaud et humide colle dans la poêle.',
      'Émince les échalotes et l\'ail, coupe la carotte en petits dés et le poulet en lamelles.',
      { t: 'Dans une grande poêle très chaude avec la moitié de l\'huile, saisis le poulet, puis réserve-le.', min: 5 },
      { t: 'Fais revenir les échalotes, l\'ail, la carotte et le sambal, puis ajoute les petits pois.', min: 3 },
      { t: 'Pousse les légumes sur le côté, brouille 1 œuf au centre, puis ajoute le riz, le poulet, le kecap manis et la sauce soja. Saute à feu vif pour bien enrober chaque grain.', min: 4 },
      { t: 'Dans une autre poêle, cuis les 2 autres œufs au plat dans le reste de l\'huile.', min: 3 },
      'Sers le riz surmonté d\'un œuf, avec des rondelles de concombre et un quartier de citron vert.',
    ],
    tip: 'Le kecap manis se trouve au rayon asiatique. À défaut : 1 c. à s. de sauce soja et 1 c. à s. de miel. Parfait pour finir le riz du week-end.',
  },
  {
    id: 'shawarma', name: 'Bol shawarma au poulet, riz et sauce yaourt à l\'ail', meal: 'plat', cuisine: 'Libanaise', servings: 4, prep: 20, cook: 25, marinate: 30, tools: ['four', 'cuiseur'], tags: ['batch', 'emporter'], fridge: 3, freezer: true, kcal: 645, protein: 48, carbs: 66, fat: 20,
    ingredients: [
      { qty: 700, unit: 'g', name: 'hauts de cuisse de poulet désossés sans peau', aisle: 'frais' },
      { qty: 280, unit: 'g', name: 'riz basmati', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'citron', aisle: 'legumes' },
      { qty: 2, unit: 'c. à s.', name: 'huile d\'olive', aisle: 'epicerie' },
      { qty: 2, unit: 'c. à c.', name: 'cumin et paprika (de chaque)', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'curcuma et cannelle (de chaque)', aisle: 'epices' },
      { qty: 4, unit: '', name: 'gousses d\'ail', aisle: 'legumes' },
      { qty: 300, unit: 'g', name: 'skyr ou yaourt grec', aisle: 'cremerie' },
      { qty: 1, unit: '', name: 'concombre', aisle: 'legumes' },
      { qty: 0.25, unit: '', name: 'chou rouge (ou 2 carottes râpées)', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'oignon rouge', aisle: 'legumes' },
      { qty: 0.5, unit: '', name: 'bouquet de persil', aisle: 'legumes' },
    ],
    steps: [
      { t: 'Mélange le jus d\'un demi-citron, l\'huile, les épices, 2 gousses d\'ail râpées et du sel. Enrobe-en le poulet et laisse mariner (ou toute la nuit au frigo).', min: 30 },
      'Préchauffe le four à 220 °C et lance le riz au cuiseur.',
      { t: 'Étale le poulet sur une plaque couverte de papier cuisson, avec l\'oignon rouge en quartiers, et enfourne. Il doit être doré et un peu grillé sur les bords.', min: 25 },
      'Pendant ce temps, mélange le skyr avec les 2 gousses d\'ail restantes râpées, le jus de l\'autre demi-citron, du sel et un peu d\'eau pour une sauce coulante.',
      'Coupe le concombre en dés, émince finement le chou rouge et hache le persil.',
      'Tranche le poulet en lamelles. Dresse les bols : riz, poulet, oignons rôtis, crudités, sauce et persil.',
    ],
    tip: 'Pour le déjeuner au travail, garde la sauce et les crudités à part et réchauffe seulement le riz et le poulet. Se mange aussi roulé dans un pain pita.',
  },
  {
    id: 'piri-piri', name: 'Poulet piri-piri, pommes de terre et poivrons rôtis', meal: 'plat', cuisine: 'Portugaise', servings: 2, prep: 15, cook: 35, marinate: 15, tools: ['four'], tags: ['decouverte'], fridge: 3, freezer: false, kcal: 656, protein: 49, carbs: 61, fat: 23,
    ingredients: [
      { qty: 350, unit: 'g', name: 'hauts de cuisse de poulet désossés sans peau (ou blancs)', aisle: 'frais' },
      { qty: 500, unit: 'g', name: 'pommes de terre grenaille', aisle: 'legumes' },
      { qty: 2, unit: '', name: 'poivrons rouges', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'oignon rouge', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'citron', aisle: 'legumes' },
      { qty: 3, unit: '', name: 'gousses d\'ail', aisle: 'legumes' },
      { qty: 1.5, unit: 'c. à s.', name: 'huile d\'olive', aisle: 'epicerie' },
      { qty: 2, unit: 'c. à c.', name: 'paprika fumé', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'piment de Cayenne ou flocons de piment (selon ton goût)', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'origan séché', aisle: 'epices' },
      { qty: 1, unit: 'c. à s.', name: 'vinaigre de vin', aisle: 'epices' },
      { qty: 150, unit: 'g', name: 'skyr, pour servir', aisle: 'cremerie' },
    ],
    steps: [
      { t: 'Écrase l\'ail et mélange-le avec le jus du citron, l\'huile, le vinaigre, le paprika, le piment, l\'origan et du sel. Enrobe le poulet avec la moitié de cette marinade.', min: 15 },
      'Préchauffe le four à 220 °C. Coupe les pommes de terre en deux, les poivrons en lanières et l\'oignon en quartiers.',
      { t: 'Mélange les légumes avec le reste de la marinade sur une grande plaque et enfourne-les seuls.', min: 15 },
      { t: 'Ajoute le poulet sur les légumes et poursuis la cuisson en le retournant à mi-cuisson : il doit être bien doré.', min: 20 },
      'Sers avec une cuillère de skyr salé et poivré pour calmer le piquant.',
    ],
    tip: 'Le piri-piri est un petit piment très fort : dose-le progressivement. Les restes se réchauffent très bien au grill-presse, en sandwich.',
  },
  {
    id: 'khao-man-gai', name: 'Khao man gai, poulet et riz parfumé au cuiseur', meal: 'plat', cuisine: 'Thaïe', servings: 2, prep: 10, cook: 35, tools: ['cuiseur'], tags: ['decouverte', 'emporter'], fridge: 2, freezer: false, kcal: 629, protein: 42, carbs: 73, fat: 18,
    ingredients: [
      { qty: 350, unit: 'g', name: 'hauts de cuisse de poulet désossés sans peau', aisle: 'frais' },
      { qty: 160, unit: 'g', name: 'riz jasmin', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'cube de bouillon de volaille', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'huile de sésame', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'morceau de gingembre frais (3 cm)', aisle: 'legumes' },
      { qty: 3, unit: '', name: 'gousses d\'ail', aisle: 'legumes' },
      { qty: 2, unit: 'c. à s.', name: 'sauce soja', aisle: 'epices' },
      { qty: 1, unit: 'c. à s.', name: 'miso ou pâte de soja fermentée', aisle: 'epices' },
      { qty: 1, unit: 'c. à s.', name: 'vinaigre de riz', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'sucre', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'petit piment (facultatif)', aisle: 'legumes' },
      { qty: 0.5, unit: '', name: 'concombre', aisle: 'legumes' },
      { qty: 2, unit: '', name: 'oignons verts', aisle: 'legumes' },
    ],
    steps: [
      'Rince le riz jusqu\'à ce que l\'eau soit claire et mets-le dans le cuiseur avec l\'huile de sésame, la moitié du gingembre en lamelles, 2 gousses d\'ail écrasées et le cube émietté.',
      'Ajoute l\'eau jusqu\'à la graduation, sale le poulet et pose-le à plat sur le riz.',
      { t: 'Lance la cuisson. Quand le cuiseur passe en maintien au chaud, laisse reposer 10 min sans ouvrir.', min: 35 },
      'Pendant ce temps, prépare la sauce : le reste du gingembre et de l\'ail hachés très fin, la sauce soja, la pâte de soja, le vinaigre, le sucre et le piment émincé.',
      'Vérifie que le poulet est cuit à cœur (le jus doit être clair), puis tranche-le.',
      'Sers le poulet sur le riz avec le concombre en rondelles, l\'oignon vert ciselé et la sauce à part.',
    ],
    tip: 'Un classique de la cuisine de rue de Bangkok : une seule machine et rien à surveiller. Le riz cuit dans le jus du poulet, c\'est tout le secret.',
  },
  {
    id: 'paella', name: 'Paella au poulet et chorizo', meal: 'plat', cuisine: 'Espagnole', servings: 4, prep: 15, cook: 35, tools: ['plaques'], tags: ['batch'], fridge: 3, freezer: true, kcal: 674, protein: 42, carbs: 73, fat: 22,
    ingredients: [
      { qty: 600, unit: 'g', name: 'hauts de cuisse de poulet désossés sans peau', aisle: 'frais' },
      { qty: 60, unit: 'g', name: 'chorizo', aisle: 'frais' },
      { qty: 300, unit: 'g', name: 'riz rond (bomba, arborio ou riz à paella)', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'oignon', aisle: 'legumes' },
      { qty: 2, unit: '', name: 'poivrons rouges', aisle: 'legumes' },
      { qty: 3, unit: '', name: 'gousses d\'ail', aisle: 'legumes' },
      { qty: 200, unit: 'g', name: 'tomates concassées en conserve', aisle: 'conserves' },
      { qty: 150, unit: 'g', name: 'petits pois surgelés', aisle: 'surgeles' },
      { qty: 1, unit: '', name: 'dose de safran (ou 1 c. à c. de curcuma)', aisle: 'epices' },
      { qty: 2, unit: 'c. à c.', name: 'paprika fumé', aisle: 'epices' },
      { qty: 90, unit: 'cl', name: 'bouillon de volaille chaud', aisle: 'epices' },
      { qty: 1, unit: 'c. à s.', name: 'huile d\'olive', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'citron', aisle: 'legumes' },
    ],
    steps: [
      'Coupe le poulet en morceaux, le chorizo en rondelles fines, l\'oignon et les poivrons en dés. Fais infuser le safran dans le bouillon chaud.',
      { t: 'Dans ta plus grande poêle, fais dorer le poulet salé dans l\'huile, puis réserve-le.', min: 6 },
      { t: 'Fais revenir le chorizo 1 min (il rend une huile rouge), puis l\'oignon, les poivrons et l\'ail.', min: 6 },
      { t: 'Ajoute le riz et le paprika, remue jusqu\'à ce que les grains soient nacrés, puis les tomates concassées.', min: 2 },
      { t: 'Verse le bouillon, remets le poulet, mélange une dernière fois puis ne touche plus : laisse cuire à feu moyen sans remuer.', min: 15 },
      { t: 'Ajoute les petits pois en surface, couvre (couvercle ou papier alu) et termine à feu doux.', min: 5 },
      'Laisse reposer 5 min hors du feu et sers avec des quartiers de citron. La croûte dorée au fond (le socarrat) est la meilleure partie.',
    ],
    tip: 'C\'est la version de Valence, au poulet et sans fruits de mer. Elle se réchauffe au micro-ondes avec 1 c. à s. d\'eau.',
  },
  {
    id: 'overnight-oats', name: 'Overnight oats au skyr et fruits rouges', meal: 'collation', cuisine: 'Petit-déjeuner ou collation', servings: 1, prep: 5, cook: 0, tools: [], tags: ['batch'], fridge: 3, freezer: false, kcal: 437, protein: 29, carbs: 54, fat: 9,
    ingredients: [
      { qty: 50, unit: 'g', name: 'flocons d\'avoine', aisle: 'epicerie' },
      { qty: 150, unit: 'g', name: 'skyr', aisle: 'cremerie' },
      { qty: 10, unit: 'cl', name: 'lait demi-écrémé', aisle: 'cremerie' },
      { qty: 100, unit: 'g', name: 'fruits rouges surgelés', aisle: 'surgeles' },
      { qty: 1, unit: 'c. à s.', name: 'graines de chia', aisle: 'epicerie' },
      { qty: 1, unit: 'c. à c.', name: 'miel', aisle: 'epicerie' },
    ],
    steps: [
      'Dans un bocal ou une boîte, mélange les flocons d\'avoine, les graines de chia, le skyr et le lait.',
      'Ajoute les fruits rouges encore surgelés et le miel par-dessus.',
      'Ferme et laisse au frigo toute la nuit (au moins 4 h) : l\'avoine absorbe le liquide et devient crémeuse.',
      'Mange froid, ou réchauffe 1 min 30 au micro-ondes si tu préfères.',
    ],
    tip: 'Prépare 3 bocaux le dimanche soir pour les matins ou les collations de la semaine.',
  },
  {
    id: 'bol-skyr', name: 'Bol de skyr, banane et beurre de cacahuète', meal: 'collation', cuisine: 'Collation', servings: 1, prep: 3, cook: 0, tools: [], tags: ['post'], fridge: 0, freezer: false, kcal: 408, protein: 28, carbs: 48, fat: 12,
    ingredients: [
      { qty: 200, unit: 'g', name: 'skyr', aisle: 'cremerie' },
      { qty: 1, unit: '', name: 'banane', aisle: 'legumes' },
      { qty: 1, unit: 'c. à s.', name: 'beurre de cacahuète', aisle: 'epicerie' },
      { qty: 20, unit: 'g', name: 'granola', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'pincée de cannelle', aisle: 'epices' },
    ],
    steps: [
      'Verse le skyr dans un bol et coupe la banane en rondelles par-dessus.',
      'Ajoute le beurre de cacahuète : ramolli 10 s au micro-ondes, il se verse en filet.',
      'Parsème de granola et d\'une pincée de cannelle.',
    ],
    tip: 'Idéal dans l\'heure qui suit la séance : les protéines du skyr et les glucides de la banane aident à récupérer.',
  },
  {
    id: 'croque', name: 'Croque jambon-emmental au grill-presse', meal: 'collation', cuisine: 'Collation', servings: 1, prep: 3, cook: 5, tools: ['grill'], tags: [], fridge: 0, freezer: false, kcal: 380, protein: 31, carbs: 35, fat: 12,
    ingredients: [
      { qty: 2, unit: '', name: 'tranches de pain complet', aisle: 'boulangerie' },
      { qty: 2, unit: '', name: 'tranches de jambon blanc', aisle: 'frais' },
      { qty: 20, unit: 'g', name: 'emmental râpé', aisle: 'cremerie' },
      { qty: 1, unit: 'c. à c.', name: 'moutarde', aisle: 'epices' },
      { qty: 1, unit: 'c. à s.', name: 'skyr', aisle: 'cremerie' },
    ],
    steps: [
      'Préchauffe le grill-presse.',
      'Tartine une tranche de pain de moutarde et l\'autre de skyr.',
      'Garnis de jambon et d\'emmental, puis referme.',
      { t: 'Cuis jusqu\'à ce que le pain soit doré et le fromage fondu.', min: 5 },
    ],
    tip: 'Variante : du poulet restant ou du thon à la place du jambon, et une poignée d\'épinards.',
  },
  {
    id: 'muffins-oeufs', name: 'Muffins aux œufs, jambon et épinards', meal: 'collation', cuisine: 'Collation salée', servings: 6, prep: 10, cook: 20, tools: ['four'], tags: ['batch'], fridge: 4, freezer: true, kcal: 191, protein: 18, carbs: 3, fat: 11,
    ingredients: [
      { qty: 8, unit: '', name: 'œufs', aisle: 'frais' },
      { qty: 150, unit: 'g', name: 'jambon blanc en dés', aisle: 'frais' },
      { qty: 100, unit: 'g', name: 'épinards frais (ou surgelés bien pressés)', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'poivron', aisle: 'legumes' },
      { qty: 50, unit: 'g', name: 'emmental râpé', aisle: 'cremerie' },
      { qty: 5, unit: 'cl', name: 'lait', aisle: 'cremerie' },
      { qty: 1, unit: 'c. à c.', name: 'paprika', aisle: 'epices' },
    ],
    steps: [
      'Préchauffe le four à 180 °C et huile légèrement un moule à 12 muffins (ou prends des moules en silicone).',
      'Coupe le jambon et le poivron en petits dés et hache grossièrement les épinards. Répartis-les dans les empreintes.',
      'Bats les œufs avec le lait, sel, poivre et paprika. Verse aux trois quarts des empreintes et parsème d\'emmental.',
      { t: 'Enfourne jusqu\'à ce qu\'ils soient gonflés et pris au centre.', min: 20 },
    ],
    tip: 'Une portion = 2 muffins. Ils se réchauffent en 30 à 40 s au micro-ondes, même sortis du congélateur (1 min 30).',
  },
  {
    id: 'energy-balls', name: 'Energy balls avoine, cacahuète et chocolat', meal: 'collation', cuisine: 'Collation', servings: 6, prep: 15, cook: 0, tools: [], tags: ['batch'], fridge: 7, freezer: true, kcal: 206, protein: 7, carbs: 20, fat: 11,
    ingredients: [
      { qty: 100, unit: 'g', name: 'flocons d\'avoine', aisle: 'epicerie' },
      { qty: 80, unit: 'g', name: 'beurre de cacahuète', aisle: 'epicerie' },
      { qty: 40, unit: 'g', name: 'miel', aisle: 'epicerie' },
      { qty: 30, unit: 'g', name: 'pépites de chocolat noir', aisle: 'epicerie' },
      { qty: 2, unit: 'c. à s.', name: 'graines de chia', aisle: 'epicerie' },
    ],
    steps: [
      'Mélange tous les ingrédients dans un saladier jusqu\'à obtenir une pâte qui se tient (ajoute 1 c. à s. d\'eau si elle s\'effrite).',
      { t: 'Place la pâte au frigo pour qu\'elle soit plus facile à rouler.', min: 15 },
      'Forme 12 boules de la taille d\'une noix entre tes mains légèrement humides.',
      'Range-les dans une boîte au frais. Une portion = 2 boules.',
    ],
    tip: '2 boules 30 à 60 min avant la séance : de l\'énergie sans te sentir lourd.',
  },
  {
    id: 'onigiri', name: 'Onigiri au thon et à la mayonnaise', meal: 'collation', cuisine: 'Japonaise', servings: 2, prep: 15, cook: 30, tools: ['cuiseur'], tags: ['emporter', 'decouverte'], fridge: 1, freezer: false, kcal: 379, protein: 24, carbs: 59, fat: 4,
    ingredients: [
      { qty: 150, unit: 'g', name: 'riz japonais (rond)', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'boîte de thon au naturel (140 g égoutté)', aisle: 'conserves' },
      { qty: 1, unit: 'c. à s.', name: 'mayonnaise légère', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'sauce soja', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'vinaigre de riz', aisle: 'epices' },
      { qty: 2, unit: '', name: 'feuilles de nori', aisle: 'epicerie' },
      { qty: 1, unit: 'c. à c.', name: 'graines de sésame', aisle: 'epicerie' },
    ],
    steps: [
      'Rince le riz 3 fois et lance-le au cuiseur avec un peu moins d\'eau que d\'habitude : il doit être collant mais pas pâteux.',
      'Mélange le riz encore chaud avec le vinaigre de riz et une pincée de sel, puis laisse tiédir.',
      'Égoutte bien le thon et mélange-le avec la mayonnaise, la sauce soja et le sésame.',
      'Mouille-toi les mains et frotte-les de sel. Prends un quart du riz, creuse-le, mets 1 c. à s. de thon au centre et referme en pressant pour former un triangle. Fais-en 4.',
      'Entoure la base d\'une bande de nori juste avant de manger, pour qu\'elle reste croquante.',
    ],
    tip: 'Une portion = 2 onigiri. Emballés un par un dans du film, ils tiennent jusqu\'au lendemain au frigo : 20 s au micro-ondes pour assouplir le riz.',
  },
  {
    id: 'oeufs-marines', name: 'Œufs marinés au soja (ajitama)', meal: 'collation', cuisine: 'Japonaise', servings: 3, prep: 5, cook: 7, marinate: 240, tools: ['plaques'], tags: ['batch', 'emporter', 'decouverte'], fridge: 4, freezer: false, kcal: 194, protein: 16, carbs: 4, fat: 12,
    ingredients: [
      { qty: 6, unit: '', name: 'œufs', aisle: 'frais' },
      { qty: 10, unit: 'cl', name: 'sauce soja', aisle: 'epices' },
      { qty: 2, unit: 'c. à s.', name: 'sucre (ou 5 cl de mirin)', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'gousse d\'ail', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'oignon vert, pour servir', aisle: 'legumes' },
    ],
    steps: [
      'Porte une casserole d\'eau à ébullition. Sors les œufs du frigo au dernier moment.',
      { t: 'Plonge délicatement les œufs dans l\'eau bouillante avec une cuillère et compte précisément pour un jaune coulant.', min: 7 },
      'Refroidis-les aussitôt 5 min dans un bol d\'eau glacée, puis écale-les sous un filet d\'eau.',
      'Dans une boîte ou un sac congélation, mélange la sauce soja, le sucre, 10 cl d\'eau et l\'ail écrasé. Ajoute les œufs : ils doivent baigner.',
      'Laisse mariner au frigo au moins 4 h (idéalement une nuit), en les retournant une fois.',
    ],
    tip: 'Une portion = 2 œufs. Le jaune reste fondant et la marinade parfume le blanc. Ils accompagnent aussi un bol de riz ou de nouilles.',
  },
  {
    id: 'edamame', name: 'Edamame sautés à l\'ail et au sésame', meal: 'collation', cuisine: 'Japonaise', servings: 1, prep: 2, cook: 5, tools: ['micro', 'plaques'], tags: [], fridge: 2, freezer: false, kcal: 256, protein: 18, carbs: 15, fat: 14,
    ingredients: [
      { qty: 150, unit: 'g', name: 'edamame écossés surgelés', aisle: 'surgeles' },
      { qty: 1, unit: '', name: 'gousse d\'ail', aisle: 'legumes' },
      { qty: 1, unit: 'c. à c.', name: 'huile de sésame', aisle: 'epicerie' },
      { qty: 1, unit: 'c. à c.', name: 'sauce soja', aisle: 'epices' },
      { qty: 1, unit: 'c. à c.', name: 'graines de sésame', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'pincée de piment ou de fleur de sel', aisle: 'epices' },
    ],
    steps: [
      { t: 'Fais décongeler les edamame au micro-ondes dans un bol couvert avec 1 c. à s. d\'eau.', min: 2 },
      { t: 'Fais chauffer l\'huile de sésame dans une poêle, ajoute l\'ail haché et les edamame égouttés, et fais sauter à feu vif.', min: 3 },
      'Hors du feu, ajoute la sauce soja, le sésame et le piment ou la fleur de sel.',
    ],
    tip: 'À grignoter tiède ou froid. Avec leurs cosses, ils se mangent en les pressant entre les dents : compte alors 300 g pour la même portion.',
  },
  {
    id: 'pancakes', name: 'Pancakes à l\'avoine, banane et skyr', meal: 'collation', cuisine: 'Petit-déjeuner ou collation', servings: 2, prep: 10, cook: 10, tools: ['plaques'], tags: ['post'], fridge: 2, freezer: true, kcal: 425, protein: 25, carbs: 52, fat: 12,
    ingredients: [
      { qty: 80, unit: 'g', name: 'flocons d\'avoine fins', aisle: 'epicerie' },
      { qty: 1, unit: '', name: 'banane bien mûre', aisle: 'legumes' },
      { qty: 2, unit: '', name: 'œufs', aisle: 'frais' },
      { qty: 200, unit: 'g', name: 'skyr (dont la moitié pour servir)', aisle: 'cremerie' },
      { qty: 1, unit: 'c. à c.', name: 'levure chimique', aisle: 'epicerie' },
      { qty: 1, unit: 'c. à c.', name: 'huile neutre', aisle: 'epicerie' },
      { qty: 1, unit: 'c. à s.', name: 'miel ou sirop d\'érable', aisle: 'epicerie' },
      { qty: 100, unit: 'g', name: 'fruits rouges surgelés', aisle: 'surgeles' },
    ],
    steps: [
      'Écrase la banane à la fourchette dans un saladier jusqu\'à obtenir une purée.',
      { t: 'Ajoute les œufs, 100 g de skyr, les flocons d\'avoine, la levure et une pincée de sel. Mélange et laisse reposer : l\'avoine gonfle et la pâte épaissit.', min: 5 },
      { t: 'Huile légèrement une poêle à feu moyen. Verse une petite louche de pâte par pancake et retourne-les quand des bulles apparaissent.', min: 8 },
      'Sers avec le reste du skyr, les fruits rouges réchauffés 1 min au micro-ondes et un filet de miel.',
    ],
    tip: 'Ils se congèlent bien : 40 s au micro-ondes ou 2 min au grill-presse pour les réchauffer.',
  },
  {
    id: 'wrap-dinde', name: 'Wrap dinde, fromage frais et crudités', meal: 'collation', cuisine: 'Collation ou déjeuner', servings: 1, prep: 5, cook: 0, tools: [], tags: ['emporter'], fridge: 1, freezer: false, kcal: 399, protein: 35, carbs: 41, fat: 10,
    ingredients: [
      { qty: 1, unit: '', name: 'grande tortilla de blé complet', aisle: 'boulangerie' },
      { qty: 4, unit: '', name: 'tranches de blanc de dinde', aisle: 'frais' },
      { qty: 30, unit: 'g', name: 'fromage frais ail et fines herbes allégé (type St Môret)', aisle: 'cremerie' },
      { qty: 1, unit: '', name: 'carotte râpée', aisle: 'legumes' },
      { qty: 0.25, unit: '', name: 'concombre', aisle: 'legumes' },
      { qty: 1, unit: '', name: 'poignée de jeunes pousses ou de laitue', aisle: 'legumes' },
    ],
    steps: [
      'Tartine toute la tortilla de fromage frais, en laissant 2 cm libres sur un bord.',
      'Coupe le concombre en bâtonnets. Dispose la salade, la dinde, la carotte râpée et le concombre sur le tiers le plus proche de toi.',
      'Roule bien serré en rentrant les côtés, puis coupe en deux en biais.',
    ],
    tip: 'Emballé dans du papier alu, il se transporte sans se défaire. Variante chaude : 3 min au grill-presse avec un peu d\'emmental.',
  },
];

// Photos libres de Wikimedia Commons (img/recettes/<id>.jpg, 800 × 600) : crédit et licence affichés sous la photo.
export const photoSrc = (id) => `img/recettes/${id}.jpg`;
export const photoPage = (ph) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(ph.file.replace(/ /g, '_'))}`;
export const PHOTOS = {
  'bo-bun': { file: 'Bún thịt nướng tại quán Cơm tấm Cali ở Quận 4, đường Hoàng Diệu (1).jpg', author: 'Phương Huy', license: 'Public domain', licenseUrl: '' },
  'bol-skyr': { file: 'Double choc yogurt.jpg', author: '1997SPP', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0' },
  'bulgogi': { file: 'Bulgogi (Marinated beef. Served with rice) - Kogi 2023-09-11.jpg', author: 'Andy Li', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en' },
  'butter-chicken': { file: 'Murgh Makhani (Butter Chicken) (8039245631).jpg', author: 'Luca Nebuloni', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0' },
  'cabillaud-panko': { file: 'Baked Cod & Lentils (39560294202).jpg', author: 'Mack Male from Edmonton, AB, Canada', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0' },
  'chili': { file: 'Bowl of chili.jpg', author: 'Carstor', license: 'CC BY-SA 2.5', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.5' },
  'croque': { file: 'Croque monsieur.jpg', author: 'Michael Brewer', license: 'CC BY-SA 2.5', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.5' },
  'curry-vert': { file: 'Thai green chicken curry at Highgate Cricket Club, Crouch End, London 1.jpg', author: 'Acabashi', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0' },
  'edamame': { file: 'Edamame by jark.jpg', author: 'jark', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0' },
  'energy-balls': { file: 'Energy Balls (Unsplash).jpg', author: 'Toa Heftiba', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en' },
  'goulash': { file: 'Gulyás079.jpg', author: 'Lily15', license: 'CC BY-SA 3.0', licenseUrl: 'http://creativecommons.org/licenses/by-sa/3.0/' },
  'katsu-curry': { file: 'Katsu Curry Rice from Marugame Udon (2024-11-07).jpg', author: 'Wide Awake!', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0' },
  'khao-man-gai': { file: 'Hainanese chicken rice in Singapore.jpg', author: 'Pauloleong2002', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0' },
  'lasagnes': { file: 'Spinach lasagne (3185744041).jpg', author: 'Karen and Brad Emerson', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0' },
  'mapo-tofu': { file: 'Mapo Tofu (8840681150).jpg', author: 'pelican from Tokyo, Japan', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0' },
  'muffins-oeufs': { file: 'Frittata 04.jpg', author: 'Key West Wedding Photography', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0' },
  'nasi-goreng': { file: 'Vegetarian Nasi Goreng.jpg', author: 'Mx. Granger', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en' },
  'oeufs-marines': { file: 'Egg @ Chicken Ramen @ Yatta ! Ramen @ Annecy-le-Vieux (39824443882).jpg', author: 'Guilhem Vellut from Annecy, France', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0' },
  'onigiri': { file: 'Onigiri 002.jpg', author: 'Ocdp', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en' },
  'overnight-oats': { file: 'Protein overnight oats.jpg', author: 'Nervy8924', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0' },
  'oyakodon': { file: 'Solty soup chicken and egg bowl of Nakau.jpg', author: '毒島みるく', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en' },
  'paella': { file: 'Chicken, Chorizo and green beans paella, Brisbane, 2021.jpg', author: 'Kgbo', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0' },
  'pancakes': { file: 'Banana on pancake.jpg', author: 'Brandon Martin-Anderson', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0' },
  'piri-piri': { file: 'African Piri Piri Chicken.jpg', author: 'Valeva1010', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0' },
  'quesadillas': { file: 'Chicken quesadilla - Massachusetts.jpg', author: 'Daderot', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en' },
  'saumon-teriyaki': { file: 'Flickr - Roger T Wong - 20100130-46-Teriyaki salmon at Wagamama in Christchurch.jpg', author: 'Roger Wong from Hobart, Australia', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0' },
  'shawarma': { file: 'Chicken Shwarama plate.jpeg', author: 'CrunchySkies', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'tajine-kefta': { file: 'طاجن بيض ومطيش وكرات د اللحم.jpg', author: 'إيان', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0' },
  'wrap-dinde': { file: 'Wegmans Chicken Caesar Wheat Wrap.jpeg', author: 'Dough4872', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0' },
  'yassa': { file: 'Poulet yassa 01.jpg', author: 'Arnaud 25', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en' },
};
