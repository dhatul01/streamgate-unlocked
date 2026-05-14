import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("localhost");

const clearRuntimeCaches = async () => {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignore cache cleanup failures
  }
};

if ((isPreviewHost || isInIframe) && "serviceWorker" in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .then(() => clearRuntimeCaches())
    .catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Reload guard
// ---------------------------------------------------------------------------
// Forced reloads are useful to push a new build to users, but if anything
// goes wrong (network flaps, SW that re-activates on every load, server
// returning a different HTML hash on each request) we can end up in a reload
// loop. These helpers cap how often, and how many times per session, we are
// allowed to call window.location.reload().
const RELOAD_COUNT_KEY = "rt48_reload_count";
const RELOAD_LAST_AT_KEY = "rt48_reload_last_at";
const RELOAD_LOCK_KEY = "rt48_reload_lock";
const MAX_RELOADS_PER_SESSION = 4;
const MIN_RELOAD_INTERVAL_MS = 20_000; // 20s debounce

const safeReload = (reason: string): boolean => {
  try {
    if (sessionStorage.getItem(RELOAD_LOCK_KEY)) return false;

    const count = Number(sessionStorage.getItem(RELOAD_COUNT_KEY) || "0");
    if (count >= MAX_RELOADS_PER_SESSION) {
      console.warn(`[rt48] reload (${reason}) blocked: hit session cap`);
      return false;
    }

    const lastAt = Number(localStorage.getItem(RELOAD_LAST_AT_KEY) || "0");
    if (lastAt && Date.now() - lastAt < MIN_RELOAD_INTERVAL_MS) {
      console.warn(`[rt48] reload (${reason}) blocked: debounce window`);
      return false;
    }

    sessionStorage.setItem(RELOAD_LOCK_KEY, "1");
    sessionStorage.setItem(RELOAD_COUNT_KEY, String(count + 1));
    localStorage.setItem(RELOAD_LAST_AT_KEY, String(Date.now()));
  } catch {
    // storage unavailable — fall through and reload anyway, but only once
  }
  window.location.reload();
  return true;
};

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
          !isPreviewHost && !isInIframe && "serviceWorker" in navigator
            ? navigator.serviceWorker
                .getRegistrations()
                .then((regs) => Promise.all(regs.map((r) => r.unregister())))
            : Promise.resolve(),
        ])
          .catch(() => undefined)
          .finally(() => {
            safeReload("version-bump");
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
let inflightCheck: Promise<void> | null = null;
let lastCheckAt = 0;
const CHECK_DEBOUNCE_MS = 15_000;

const checkForNewerBuild = (): Promise<void> => {
  if (inflightCheck) return inflightCheck;
  if (Date.now() - lastCheckAt < CHECK_DEBOUNCE_MS) return Promise.resolve();
  lastCheckAt = Date.now();

  inflightCheck = (async () => {
    try {
      // `nosw=1` is on the SW navigateFallbackDenylist-equivalent path: combined
      // with `cache: "reload"` it forces a true network round-trip and bypasses
      // any precache, so we always see the live deploy.
      const res = await fetch(`/index.html?nosw=1&_=${Date.now()}`, {
        cache: "reload",
        credentials: "same-origin",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (!res.ok) return;
      const html = await res.text();
      const match = html.match(/__APP_VERSION__\s*=\s*["']?(\d+)["']?/);
      // Vite inlines define values into the bundle, not into index.html, so the
      // marker above won't always be present. Fall back to the script tag's
      // hashed src — when Vite emits a new build, the hashed asset filename
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
          if (!isPreviewHost && !isInIframe && "serviceWorker" in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
          }
        } catch {
          // ignore — still try to reload
        }
        safeReload("fresh-build");
      } else {
        localStorage.setItem(SIG_KEY, remoteSignature);
        sessionStorage.removeItem("rt48_freshness_reload");
      }
    } catch {
      // network offline — keep current build
    } finally {
      inflightCheck = null;
    }
  })();

  return inflightCheck;
};

// Run immediately and again whenever the tab regains focus / visibility, so
// long-lived sessions also pick up new deploys.
void checkForNewerBuild();
window.addEventListener("focus", () => void checkForNewerBuild());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void checkForNewerBuild();
});
window.setInterval(() => void checkForNewerBuild(), 60_000);

if (!isPreviewHost && !isInIframe) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true).then(() => safeReload("sw-need-refresh"));
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
      // cached assets are used immediately — but go through safeReload so we
      // never get caught in a loop if the SW keeps re-activating.
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          safeReload("sw-controllerchange");
        });
      }
    },
  });
}

createRoot(document.getElementById("root")!).render(<App />);
