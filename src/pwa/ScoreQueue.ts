/**
 * Persists high scores locally so a disconnected player never loses one. A
 * Background Sync event (registered here, handled in service-worker.js)
 * flushes the queue the moment connectivity returns, with no further user
 * interaction required.
 */
const DB_NAME = "millipede-scores";
const STORE_NAME = "queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function submitHighScore(score: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add({ score, at: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  const reg = await navigator.serviceWorker.ready.catch(() => null);
  const syncCapableReg = reg as (ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }) | null;
  if (syncCapableReg?.sync) {
    await syncCapableReg.sync.register("flush-scores").catch(() => {});
  }
}

export async function getLocalBestScore(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const scores = (req.result as { score: number }[]).map((r) => r.score);
      resolve(scores.length ? Math.max(...scores) : 0);
    };
    req.onerror = () => reject(req.error);
  });
}
