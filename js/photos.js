// Photos des projets : gardées sur ce téléphone (IndexedDB), jamais envoyées au compte.
const DB = 'personnal-trainer-photos';
const STORE = 'photos';
const MAX_SIDE = 1000;
const urls = new Map(); // id → URL d'objet déjà créée

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req?.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// Réduite à 1000 px de côté en JPEG pour ne pas remplir le téléphone.
async function shrink(file) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * k);
  canvas.height = Math.round(img.height * k);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close?.();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
}

export async function savePhoto(id, file) {
  const blob = await shrink(file);
  await run('readwrite', (s) => s.put(blob, id));
  forget(id);
}

export async function deletePhoto(id) {
  await run('readwrite', (s) => s.delete(id)).catch(() => {});
  forget(id);
}

export async function photoUrl(id) {
  if (urls.has(id)) return urls.get(id);
  const blob = await run('readonly', (s) => s.get(id)).catch(() => null);
  const url = blob ? URL.createObjectURL(blob) : null;
  urls.set(id, url);
  return url;
}

function forget(id) {
  if (urls.get(id)) URL.revokeObjectURL(urls.get(id));
  urls.delete(id);
}

// Remplit les <img data-photo="id"> d'une vue ; cache le cadre quand il n'y a pas de photo.
export async function fillPhotos(root) {
  for (const img of root.querySelectorAll('img[data-photo]')) {
    const url = await photoUrl(img.dataset.photo);
    if (url) { img.src = url; img.closest('.photo')?.removeAttribute('hidden'); }
  }
}
