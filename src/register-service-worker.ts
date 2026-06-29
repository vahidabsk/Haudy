export const OFFLINE_READY_KEY = "haudy.offlineReady";

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      await navigator.serviceWorker.ready;
      await cacheCurrentAppFiles(registration);
      localStorage.setItem(OFFLINE_READY_KEY, "true");
      window.dispatchEvent(new Event("haudy:offline-ready"));
    }).catch(() => {
      // Offline support is helpful but should never block the audit workflow.
    });
  });
}

function currentAppFileUrls() {
  const urls = ["/", "/index.html", "/manifest.webmanifest", "/sw.js", "/confirmation-logo.png", "/confirmation-safety.png"];
  document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[href]").forEach((element) => {
    const rawUrl = element instanceof HTMLScriptElement ? element.src : element.href;
    const url = new URL(rawUrl, window.location.href);
    if (url.origin === window.location.origin && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/"))) {
      urls.push(url.pathname);
    }
  });
  return [...new Set(urls)];
}

function cacheCurrentAppFiles(registration: ServiceWorkerRegistration) {
  const worker = registration.active || registration.waiting || registration.installing;
  if (!worker) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(resolve, 2500);
    channel.port1.onmessage = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    worker.postMessage({ type: "CACHE_URLS", urls: currentAppFileUrls() }, [channel.port2]);
  });
}
