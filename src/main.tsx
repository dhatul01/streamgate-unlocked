import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// --- Auto cache invalidation on new build ---
// Compares the build-time version to the one in localStorage. When they
// differ, all caches and old service workers are removed and the page is
// reloaded once so the user immediately gets the latest code.
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

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true);
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
  },
});

createRoot(document.getElementById("root")!).render(<App />);
