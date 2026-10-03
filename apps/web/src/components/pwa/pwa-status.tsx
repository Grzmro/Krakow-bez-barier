"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CloudSlash, DeviceMobile, X } from "@phosphor-icons/react";
import { Button, useAnnounce } from "@krakow-bez-barier/ui";
import { pl } from "@/i18n/pl";
import { offlineMessage } from "@/lib/pwa/offline-message";

const t = pl.pwa;
const SW_URL = "/sw.js";
const LAST_SYNC_KEY = "/__kbb/last-sync";
const INSTALL_DISMISSED_KEY = "kbb:install-dismissed";

declare global {
  interface Window {
    /** Set by e2e specs (`page.addInitScript`) to register the service worker under automation or in dev. */
    __kbbServiceWorker?: boolean;
  }
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

/** Service worker registration, the offline banner and the install prompt — mounted once in the layout. */
export function PwaStatus() {
  useServiceWorker();
  return (
    <>
      <OfflineBanner />
      <InstallPrompt />
    </>
  );
}

// Production only, and never under automation unless a spec opts in — keeps `next dev` and the other
// e2e specs free of cached responses.
function useServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const enabled =
      window.__kbbServiceWorker === true || (process.env.NODE_ENV === "production" && !navigator.webdriver);
    if (!enabled) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())));
      return;
    }
    void navigator.serviceWorker
      .register(SW_URL, { scope: "/", updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        const urls = [
          location.pathname + location.search,
          ...performance.getEntriesByType("resource").map((entry) => entry.name),
        ].filter((url) => new URL(url, location.origin).origin === location.origin);
        registration.active?.postMessage({ type: "kbb:warm", urls });
      })
      .catch(() => undefined);
  }, []);
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

async function readLastSync(): Promise<string | null> {
  if (!("caches" in window)) return null;
  const response = await caches.match(LAST_SYNC_KEY).catch(() => undefined);
  return response ? response.text() : null;
}

function OfflineBanner() {
  const online = useOnline();
  const announce = useAnnounce();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (online) return;
    let active = true;
    void readLastSync().then((lastSync) => {
      if (!active) return;
      const text = offlineMessage(lastSync);
      setMessage(text);
      announce(text);
    });
    return () => {
      active = false;
    };
  }, [online, announce]);

  if (online || !message) return null;
  return (
    <div role="note" className="border-b border-border bg-muted">
      <p className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-2.5 text-body font-semibold text-foreground">
        <CloudSlash aria-hidden weight="bold" className="size-5 shrink-0" />
        {message}
      </p>
    </div>
  );
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function readDismissed() {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

const noSubscribe = () => () => {};

function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedNow, setDismissedNow] = useState(false);
  const iosHint = useSyncExternalStore(noSubscribe, () => isIos() && !isStandalone(), () => false);
  const dismissedBefore = useSyncExternalStore(noSubscribe, readDismissed, () => true);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (dismissedBefore || dismissedNow || (!deferred && !iosHint)) return null;

  const dismiss = () => {
    setDismissedNow(true);
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    } catch {
      // Storage blocked: the prompt just comes back next visit.
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    setDeferred(null);
  };

  return (
    <aside aria-label={t.install.label} className="border-b border-border bg-primary-container">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-2.5">
        <DeviceMobile aria-hidden weight="bold" className="size-5 shrink-0 text-foreground" />
        <p className="flex-1 text-body text-foreground">{deferred ? t.install.lead : t.install.ios}</p>
        {deferred && (
          <Button size="sm" onClick={install}>
            {t.install.button}
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label={t.install.dismiss} onClick={dismiss}>
          <X weight="bold" />
        </Button>
      </div>
    </aside>
  );
}
