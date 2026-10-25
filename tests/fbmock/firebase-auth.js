let cb = null;
let current = JSON.parse(localStorage.getItem('__mockUser') || 'null');
const set = (u) => { current = u; localStorage.setItem('__mockUser', JSON.stringify(u)); cb?.(u); };
const fail = (code) => { const e = new Error(code); e.code = code; throw e; };
export function getAuth() { return {}; }
export function onAuthStateChanged(a, f) { cb = f; setTimeout(() => f(current), 10); }
export class GoogleAuthProvider {}
export async function signInWithPopup() { set({ uid: 'u-google', email: 'hugo@test.fr', displayName: 'Hugo' }); }
export async function signInWithEmailAndPassword(a, e, p) {
  if (!(await window.__auth('check', [e, p]))) fail('auth/invalid-credential');
  set({ uid: `u-${e}`, email: e });
}
export async function createUserWithEmailAndPassword(a, e, p) {
  if (p.length < 6) fail('auth/weak-password');
  if (!(await window.__auth('create', [e, p]))) fail('auth/email-already-in-use');
  set({ uid: `u-${e}`, email: e });
}
export async function sendPasswordResetEmail() {}
export async function signOut() { set(null); }
