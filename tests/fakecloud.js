// Faux serveur Firebase pour le test de bout en bout : base en mémoire et comptes e-mail.
export function fakeCloud() {
  const db = new Map();
  const accounts = new Map();
  const allowed = (path, uid) => !!uid && (path === `users/${uid}` || path.startsWith(`users/${uid}/`));
  const denied = { __err: 'permission-denied' };
  return {
    db,
    fs(op, args, uid) {
      const [path] = args;
      if (op !== 'commit' && !allowed(path, uid)) return denied;
      if (op === 'get') return db.get(path) ?? null;
      if (op === 'set') { db.set(path, args[1]); return true; }
      if (op === 'del') { db.delete(path); return true; }
      if (op === 'list') return [...db].filter(([k]) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes('/')).map(([k, v]) => [k.split('/').pop(), v]);
      if (op === 'commit') {
        const [reads, writes] = args;
        if (writes.some(([p]) => !allowed(p, uid))) return denied;
        if (Object.entries(reads).some(([p, v]) => JSON.stringify(db.get(p) ?? null) !== v)) return false;
        writes.forEach(([p, d]) => db.set(p, d));
        return true;
      }
      return denied;
    },
    auth(op, [email, pw]) {
      if (op === 'check') return accounts.get(email) === pw;
      if (op === 'create') { if (accounts.has(email)) return false; accounts.set(email, pw); return true; }
      return false;
    },
  };
}
