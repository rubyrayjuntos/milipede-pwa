export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    // Base-relative so this resolves correctly both at the domain root (dev)
    // and under a GitHub Pages project subpath (e.g. /milipede-pwa/).
    const swUrl = `${import.meta.env.BASE_URL}service-worker.js`;
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}
