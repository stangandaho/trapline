// Thin promise wrapper around IndexedDB. Everything the app knows lives here;
// there is no server.

// Kept from the app's first name: renaming it would orphan data already on phones
const DB_NAME = 'cataploy';
const DB_VERSION = 1;

const STORES = {
  projects: { keyPath: 'id' },
  devices: { keyPath: 'uid', indexes: ['projectId'] },
  locations: { keyPath: 'uid', indexes: ['projectId'] },
  deployments: { keyPath: 'uid', indexes: ['projectId', 'deviceUid'] },
  checks: { keyPath: 'uid', indexes: ['projectId', 'deploymentUid'] },
  meta: { keyPath: 'key' },
  tiles: {}, // out-of-line keys: "<provider>/<z>/<x>/<y>" -> Blob
};

let dbPromise;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, def] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        const os = def.keyPath ? db.createObjectStore(name, { keyPath: def.keyPath }) : db.createObjectStore(name);
        for (const ix of def.indexes ?? []) os.createIndex(ix, ix);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

async function store(name, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export async function get(name, key) { return wrap((await store(name)).get(key)); }
export async function all(name) { return wrap((await store(name)).getAll()); }
export async function byIndex(name, index, value) { return wrap((await store(name)).index(index).getAll(value)); }
export async function put(name, value, key) { return wrap((await store(name, 'readwrite')).put(value, key)); }
export async function del(name, key) { return wrap((await store(name, 'readwrite')).delete(key)); }
export async function count(name) { return wrap((await store(name)).count()); }

/**
 * Apply several writes atomically. ops: [{store, put: value} | {store, delete: key}]
 * Either all of them land or none do, so a check can never close a deployment
 * without also releasing its device.
 */
export async function commit(ops) {
  const db = await openDB();
  const names = [...new Set(ops.map((o) => o.store))];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite');
    for (const o of ops) {
      const os = tx.objectStore(o.store);
      if ('put' in o) os.put(o.put);
      else os.delete(o.delete);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

/** Count and optionally delete tile keys with a given prefix. */
export async function tileKeys(prefix) {
  const os = await store('tiles');
  const range = IDBKeyRange.bound(prefix, prefix + '￿');
  return wrap(os.getAllKeys(range));
}

export async function deleteTiles(prefix) {
  const os = await store('tiles', 'readwrite');
  return wrap(os.delete(IDBKeyRange.bound(prefix, prefix + '￿')));
}

export async function getMeta(key, fallback = null) {
  const r = await get('meta', key);
  return r ? r.value : fallback;
}
export async function setMeta(key, value) { return put('meta', { key, value }); }
