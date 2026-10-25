// Faux SDK Firebase (tests) : même API que la vraie bibliothèque, données gardées par le lanceur de tests.
export function initializeApp(config, name) { return { config, name }; }
