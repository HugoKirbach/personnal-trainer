// Faux Firestore : chaque appel passe par le lanceur de tests, qui applique la règle « chacun ne lit que users/{son uid} ».
const uid = () => JSON.parse(localStorage.getItem('__mockUser') || 'null')?.uid || null;
async function call(op, args) {
  const r = await window.__fs(op, args, uid());
  if (r && r.__err) { const e = new Error(r.__err); e.code = r.__err; throw e; }
  return r;
}
const snap = (id, d) => ({ id, exists: () => d != null, data: () => (d == null ? undefined : JSON.parse(JSON.stringify(d))) });
export function getFirestore() { return {}; }
export function doc(db, ...p) { return { path: p.join('/'), id: p[p.length - 1] }; }
export function collection(db, ...p) { return { path: p.join('/') }; }
export async function getDoc(r) { return snap(r.id, await call('get', [r.path])); }
export async function setDoc(r, d) { await call('set', [r.path, d]); }
export async function deleteDoc(r) { await call('del', [r.path]); }
export async function getDocs(c) {
  const docs = (await call('list', [c.path])).map(([id, d]) => snap(id, d));
  return { docs, empty: !docs.length, size: docs.length };
}
export async function runTransaction(db, fn) {
  const reads = {};
  const writes = [];
  const tx = {
    get: async (r) => { const d = await call('get', [r.path]); reads[r.path] = JSON.stringify(d ?? null); return snap(r.id, d); },
    set: (r, d) => { writes.push([r.path, d]); return tx; },
  };
  const res = await fn(tx);
  if (!(await call('commit', [reads, writes]))) { const e = new Error('aborted'); e.code = 'aborted'; throw e; }
  return res;
}
