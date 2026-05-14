import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// --- Aggressive cache invalidation ---
// 1. Compares the build-time version to the one in localStorage. When they
//    differ, all caches and old service workers are removed and the page is
//    reloaded once so the user immediately gets the latest code.
// 2. On every visit, also pings the server with a cache-busting request to
//    detect a newer index.html and reloads if its build version differs.
(() => {
  try {
    const VERSION_KEY = "rt48_app_version";
    const RELOAD_FLAG = "rt48_cache_reload";
    const current = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";
    const stored = localStorage.getItem(VERSION_KEY);
    if (current && stored !== current) {
      const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG);
      localStorage.setItem(VERSION_KEY, current);
      if (!alreadyReloaded) {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        Promise.all([
          "caches" in window
            ? caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            : Promise.resolve(),
          "serviceWorker" in navigator
            ? navigator.serviceWorker
                .getRegistrations()
                .then((regs) => Promise.all(regs.map((r) => r.unregister())))
            : Promise.resolve(),
        ])
          .catch(() => undefined)
          .finally(() => {
            window.location.reload();
          });
        return;
      }
    } else {
      sessionStorage.removeItem(RELOAD_FLAG);
    }
  } catch {
    // localStorage / caches unavailable — proceed normally
  }
})();

// Check the latest index.html from the network on every load. If it advertises
// a newer build version than what is currently running, purge caches and reload
// so the user always sees the freshest deploy without waiting for the SW.
const checkForNewerBuild = async () => {
  try {
    const res = await fetch(`/index.html?_=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) return;
    const html = await res.text();
    const match = html.match(/__APP_VERSION__\s*=\s*["']?(\d+)["']?/);
    // Vite inlines define values into the bundle, not into index.html, so the
    // marker above won't always be present. Fall back to hashing the script
    // tag's src — when Vite emits a new build, the hashed asset filename
    // changes, which is a reliable freshness signal.
    const scriptMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
    const remoteSignature = match?.[1] || scriptMatch?.[1] || "";
    if (!remoteSignature) return;
    const SIG_KEY = "rt48_build_signature";
    const previous = localStorage.getItem(SIG_KEY);
    if (previous && previous !== remoteSignature) {
      const RELOAD_FLAG = "rt48_freshness_reload";
      if (sessionStorage.getItem(RELOAD_FLAG)) return;
      sessionStorage.setItem(RELOAD_FLAG, "1");
      localStorage.setItem(SIG_KEY, remoteSignature);
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch {
        // ignore — still try to reload
      }
      window.location.reload();
    } else {
      localStorage.setItem(SIG_KEY, remoteSignature);
      sessionStorage.removeItem("rt48_freshness_reload");
    }
  } catch {
    // localStorage / caches unavailable — proceed normally
  }
};

// Run immediately and again whenever the tab regains focus / visibility, so
// long-lived sessions also pick up new deploys.
void checkForNewerBuild();
window.addEventListener("focus", () => void checkForNewerBuild());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void checkForNewerBuild();
});
window.setInterval(() => void checkForNewerBuild(), 60_000);

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true).then(() => window.location.reload());
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    const checkForUpdates = () => {
      void registration.update().catch(() => undefined);
    };

    window.addEventListener("load", checkForUpdates, { once: true });
    window.addEventListener("focus", checkForUpdates);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        checkForUpdates();
      }
    });

    window.setInterval(checkForUpdates, 60_000);

    // When a new SW takes control mid-session, force a reload so the freshly
    // cached assets are used immediately.
    if ("serviceWorker" in navigator) {
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    }
  },
});

createRoot(document.getElementById("root")!).render(<App />);
