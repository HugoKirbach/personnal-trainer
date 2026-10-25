// Compte et sauvegarde en ligne (Firebase Auth + Firestore, même projet Firebase que BeatForge).
// Facultatif : sans compte, tout reste sur le téléphone. Le SDK n'est chargé qu'à la connexion,
// ou au démarrage si un compte est déjà connecté sur cet appareil.
import { mergeStates, isPristine } from './merge.js';

// Configuration publique du projet : ces valeurs sont faites pour être visibles,
// l'accès aux données est protégé par les règles Firestore (chacun ne lit que users/{son uid}/…).
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBeJDooZkot6cynYHgc_lXDTCg95le2HlY',
  authDomain: 'beatforge-ccd25.firebaseapp.com',
  projectId: 'beatforge-ccd25',
  storageBucket: 'beatforge-ccd25.firebasestorage.app',
  messagingSenderId: '296496192722',
  appId: '1:296496192722:web:d564ae656b01359083a10b',
};
export const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
// Nom d'appli distinct : la session reste séparée de celle de BeatForge (même domaine).
const APP_NAME = 'personnal-trainer';
const META_KEY = 'personnal-trainer:cloud';
// Dernière version synchronisée : point de comparaison pour la fusion à trois voies.
const BASE_KEY = 'personnal-trainer:cloud-base';
const PUSH_DELAY = 4000;
const MAX_BACKUPS = 7;

let hooks = null; // { getState(), setState(state) }
let fb = null;
let loading = null;
let user = null;
let status = { state: 'off', error: '' };
let pushTimer = 0;
let busy = false;
let again = false;
let conflicts = 0;
const listeners = new Set();

const readJson = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const writeJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage plein */ } };
const readMeta = () => readJson(META_KEY, {});
const writeMeta = (m) => writeJson(META_KEY, m);

export function onCloud(fn) { listeners.add(fn); }

export function cloudStatus() {
  const m = readMeta();
  return {
    ...status,
    user,
    lastSync: m.lastSync || null,
    // modifications locales pas encore envoyées
    pending: !!m.uid && (hooks?.getState().updatedAt || 0) > (m.localAt || 0),
    // compte mémorisé sur cet appareil, affiché même hors ligne
    known: m.uid ? { email: m.email || '', name: m.name || '' } : null,
  };
}

function setStatus(state, error = '') {
  status = { state, error };
  listeners.forEach((fn) => fn(cloudStatus()));
}

// À appeler une fois au démarrage de l'appli.
export function initCloud(h) {
  hooks = h;
  if (readMeta().uid) startCloud();
}

// À appeler après chaque sauvegarde locale : envoi différé si un compte est connecté.
export function stateSaved(s) {
  if (!user || busy) return;
  if ((s.updatedAt || 0) > (readMeta().localAt || 0)) schedulePush();
}

async function loadSdk() {
  if (fb) return fb;
  if (!loading) {
    loading = (async () => {
      const [app, auth, fs] = await Promise.all(['app', 'auth', 'firestore'].map((m) => import(`${SDK}firebase-${m}.js`)));
      const a = app.initializeApp(FIREBASE_CONFIG, APP_NAME);
      fb = { A: auth, F: fs, auth: auth.getAuth(a), db: fs.getFirestore(a) };
      auth.onAuthStateChanged(fb.auth, onAuth);
      return fb;
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

export async function startCloud() {
  if (fb) return true;
  setStatus(navigator.onLine ? 'loading' : 'offline');
  try {
    await loadSdk();
    return true;
  } catch (e) {
    console.warn(e);
    setStatus(navigator.onLine ? 'error' : 'offline', 'Impossible de charger le module de compte (réseau ?).');
    return false;
  }
}

async function onAuth(u) {
  user = u ? { uid: u.uid, email: u.email || '', name: u.displayName || '' } : null;
  if (!u) { setStatus('off'); return; }
  await sync({ firstLink: readMeta().uid !== u.uid });
}

const docPath = () => ['users', user.uid, 'apps', 'personnal-trainer'];
const docRef = () => fb.F.doc(fb.db, ...docPath());
const backupCol = () => fb.F.collection(fb.db, ...docPath(), 'backups');

// Envoi transactionnel : refusé si un autre appareil a écrit depuis notre lecture.
async function push(s, expectedAt) {
  const at = Date.now();
  const data = JSON.stringify(s);
  if (data.length > 900000) throw new Error('Données trop volumineuses pour la sauvegarde en ligne.');
  await fb.F.runTransaction(fb.db, async (tx) => {
    const cur = await tx.get(docRef());
    const curAt = cur.exists() ? cur.data().updatedAt || 0 : 0;
    if (curAt !== (expectedAt || 0)) { const e = new Error('conflit'); e.code = 'pt-conflict'; throw e; }
    tx.set(docRef(), { v: 1, data, updatedAt: at, device: navigator.userAgent.slice(0, 120) });
  });
  linked({ localAt: s.updatedAt || 0, remoteAt: at });
  writeJson(BASE_KEY, s);
  await dailyBackup(s);
}

function linked(extra) {
  writeMeta({ ...readMeta(), uid: user.uid, email: user.email, name: user.name, lastSync: Date.now(), ...extra });
}

// Remplace les données de l'appli par celles du compte (ou par la fusion).
function adopt(s, remoteAt) {
  hooks.setState(s);
  const now = hooks.getState();
  writeJson(BASE_KEY, now);
  linked({ localAt: now.updatedAt || 0, remoteAt });
}

// ---------- Une sauvegarde par jour, les 7 dernières sont gardées ----------
const dayId = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function dailyBackup(s) {
  const today = dayId();
  if (readMeta().lastBackup === today) return;
  await fb.F.setDoc(fb.F.doc(fb.db, ...docPath(), 'backups', today), { data: JSON.stringify(s), at: Date.now(), logs: (s.logs || []).length });
  const ids = (await fb.F.getDocs(backupCol())).docs.map((d) => d.id).sort().reverse();
  for (const id of ids.slice(MAX_BACKUPS)) await fb.F.deleteDoc(fb.F.doc(fb.db, ...docPath(), 'backups', id));
  writeMeta({ ...readMeta(), lastBackup: today });
}

export async function listBackups() {
  if (!fb || !user) return [];
  const snap = await fb.F.getDocs(backupCol());
  return snap.docs.map((d) => ({ id: d.id, at: d.data().at, logs: d.data().logs || 0 })).sort((a, b) => b.id.localeCompare(a.id));
}

// Revient à une sauvegarde : elle remplace tout, ici et en ligne.
export async function restoreBackup(id) {
  if (!fb || !user) throw new Error('Connecte-toi d\'abord.');
  const b = await fb.F.getDoc(fb.F.doc(fb.db, ...docPath(), 'backups', id));
  if (!b.exists()) throw new Error('Sauvegarde introuvable.');
  busy = true;
  try {
    writeJson('personnal-trainer:before-restore', hooks.getState());
    const s = { ...JSON.parse(b.data().data), updatedAt: Date.now() };
    const cur = await fb.F.getDoc(docRef());
    hooks.setState(s);
    await push(hooks.getState(), cur.exists() ? cur.data().updatedAt || 0 : 0);
    setStatus('synced');
  } finally {
    busy = false;
  }
}

// Récupère la version en ligne, fusionne si les deux ont changé, puis envoie si besoin.
export async function sync({ firstLink = false } = {}) {
  if (!fb || !user) return;
  if (busy) { again = true; return; }
  if (!navigator.onLine) { setStatus('offline'); return; }
  busy = true;
  clearTimeout(pushTimer);
  setStatus('syncing');
  try {
    const snap = await fb.F.getDoc(docRef());
    const r = snap.exists() ? snap.data() : null;
    const rAt = r ? r.updatedAt || 0 : 0;
    const local = hooks.getState();
    const meta = readMeta();
    if (!r) {
      await push(local, 0);
    } else if (firstLink) {
      // Premier lien de ce téléphone avec le compte : on réunit les deux, rien n'est perdu.
      const remote = JSON.parse(r.data);
      if (isPristine(local)) adopt(remote, rAt);
      else if (isPristine(remote)) await push(local, rAt);
      else { adopt(mergeStates(local, remote), rAt); await push(hooks.getState(), rAt); }
    } else {
      const localDirty = (local.updatedAt || 0) > (meta.localAt || 0);
      const remoteChanged = rAt > (meta.remoteAt || 0);
      if (remoteChanged) {
        const remote = JSON.parse(r.data);
        if (!localDirty) adopt(remote, rAt);
        else { adopt(mergeStates(local, remote, readJson(BASE_KEY, null)), rAt); await push(hooks.getState(), rAt); }
      } else if (localDirty) {
        await push(local, rAt);
      } else {
        linked({});
      }
    }
    conflicts = 0;
    setStatus('synced');
  } catch (e) {
    // Un autre appareil a écrit entre notre lecture et notre envoi : on relit et on refusionne.
    if ((e?.code === 'pt-conflict' || e?.code === 'aborted') && conflicts++ < 3) { again = true; return; }
    console.warn(e);
    setStatus(navigator.onLine ? 'error' : 'offline', fsError(e));
  } finally {
    busy = false;
    if (again) { again = false; schedulePush(500); }
  }
}

function schedulePush(ms = PUSH_DELAY) {
  if (!user) return;
  clearTimeout(pushTimer);
  if (status.state === 'synced') setStatus('pending');
  pushTimer = setTimeout(() => sync(), ms);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { if (user) sync(); else if (readMeta().uid && !fb) startCloud(); });
  window.addEventListener('offline', () => { if (user) setStatus('offline'); });
  let lastVisible = 0;
  document.addEventListener('visibilitychange', () => {
    if (!user) return;
    // Appli mise en arrière-plan : on envoie tout de suite ce qui attend.
    if (document.visibilityState === 'hidden') { if (status.state === 'pending') sync(); return; }
    if (Date.now() - lastVisible > 20000) { lastVisible = Date.now(); sync(); }
  });
}

// ---------- Connexion ----------
async function ready() {
  if (!(await startCloud())) throw new Error(status.error || 'Pas de connexion internet.');
  return fb;
}

export async function signInGoogle() {
  const { A, auth } = await ready();
  try { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); } catch (e) { throw new Error(authError(e)); }
}
export async function signInEmail(email, pw) {
  const { A, auth } = await ready();
  try { await A.signInWithEmailAndPassword(auth, email.trim(), pw); } catch (e) { throw new Error(authError(e)); }
}
export async function signUpEmail(email, pw) {
  const { A, auth } = await ready();
  try { await A.createUserWithEmailAndPassword(auth, email.trim(), pw); } catch (e) { throw new Error(authError(e)); }
}
export async function resetPassword(email) {
  const { A, auth } = await ready();
  try { await A.sendPasswordResetEmail(auth, email.trim()); } catch (e) { throw new Error(authError(e)); }
}

// Déconnexion : les données restent sur le téléphone, la synchro s'arrête.
export async function signOutCloud() {
  if (status.state === 'pending') await sync();
  const { A, auth } = await ready();
  await A.signOut(auth);
  writeMeta({});
  try { localStorage.removeItem(BASE_KEY); } catch { /* stockage indisponible */ }
  user = null;
  setStatus('off');
}

function authError(e) {
  const code = e?.code || '';
  const msg = {
    'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
    'auth/invalid-login-credentials': 'E-mail ou mot de passe incorrect.',
    'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
    'auth/user-not-found': 'Aucun compte avec cet e-mail : crée-le d\'abord.',
    'auth/email-already-in-use': 'Un compte existe déjà avec cet e-mail : connecte-toi.',
    'auth/weak-password': 'Mot de passe trop court (6 caractères minimum).',
    'auth/invalid-email': 'Adresse e-mail invalide.',
    'auth/missing-password': 'Entre un mot de passe.',
    'auth/popup-closed-by-user': 'Fenêtre Google fermée avant la fin.',
    'auth/cancelled-popup-request': 'Fenêtre Google fermée avant la fin.',
    'auth/popup-blocked': 'Fenêtre Google bloquée : autorise les pop-ups, ou utilise l\'e-mail.',
    'auth/network-request-failed': 'Pas de connexion internet.',
    'auth/too-many-requests': 'Trop d\'essais : réessaie dans quelques minutes.',
    'auth/unauthorized-domain': `Domaine non autorisé : ajoute ${location.hostname} dans Firebase › Authentication › Paramètres › Domaines autorisés.`,
    'auth/operation-not-allowed': 'Méthode de connexion non activée dans Firebase › Authentication.',
  }[code];
  return msg || `Connexion impossible (${code || e?.message || 'erreur inconnue'}).`;
}

function fsError(e) {
  const code = e?.code || '';
  if (code === 'permission-denied') return 'Accès refusé par la base : vérifie les règles Firestore.';
  if (code === 'unavailable') return 'Serveur injoignable : synchro à la prochaine connexion.';
  return e?.message || 'Erreur de synchronisation.';
}
