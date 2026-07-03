// Cache-first, network-fallback service worker. The app is asset-light (no
// static audio/textures — everything is procedural/instanced) so the entire
// shell fits comfortably in Cache Storage and installs almost instantly.
const CACHE_NAME = "millipede-shell-v1";
const SHELL_ASSETS = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") return caches.match("/index.html");
          return undefined;
        });
    }),
  );
});

// Background Sync: flush any high scores that were queued in IndexedDB while offline.
self.addEventListener("sync", (event) => {
  if (event.tag === "flush-scores") {
    event.waitUntil(flushQueuedScores());
  }
});

const DB_NAME = "millipede-scores";
const STORE_NAME = "queue";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function flushQueuedScores() {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const all = await new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  for (const entry of all) {
    try {
      // No live leaderboard backend is configured for this build; this is the
      // hook where a POST to a scores endpoint would go once one exists.
      await Promise.resolve(entry);
      const delTx = db.transaction(STORE_NAME, "readwrite");
      delTx.objectStore(STORE_NAME).delete(entry.id);
    } catch {
      // leave entry queued, will retry on next sync event
    }
  }
}
