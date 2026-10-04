"use client";

import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { CloudSlash, DeviceMobile, X } from "@phosphor-icons/react";
import { Button, useAnnounce } from "@krakow-bez-barier/ui";
import { useLocale, useMessages } from "@/i18n/client";
import { appPlatform } from "@/lib/native/platform";
import { installOffer, isEmbeddedRoute } from "@/lib/pwa/install-offer";
import { offlineMessage } from "@/lib/pwa/offline-message";

const SW_URL = `/sw.js?build=${process.env.NEXT_PUBLIC_SW_BUILD}`;
// Set by public/sw.js on every page it stores.
const CACHED_AT_HEADER = "x-kbb-cached-at";
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
        const urls = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((url) => new URL(url).origin === location.origin);
        registration.active?.postMessage({ type: "kbb:warm", urls, page: location.pathname + location.search });
      })
      .catch(() => undefined);
  }, []);

  // Client-side navigations fetch RSC data, which the worker doesn't cache; ask it to store the page's
  // HTML so pages opened from a list also work offline.
  const pathname = usePathname();
  useEffect(() => {
    navigator.serviceWorker?.controller?.postMessage({ type: "kbb:warm-page", url: location.pathname + location.search });
  }, [pathname]);
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

/** When the cached copy of the current page was fetched — the date of the data shown offline. */
async function readCachedAt(): Promise<string | null> {
  if (!("caches" in window)) return null;
  const response = await caches.match(location.origin + location.pathname + location.search).catch(() => undefined);
  return response?.headers.get(CACHED_AT_HEADER) ?? null;
}

function OfflineBanner() {
  const online = useOnline();
  const announce = useAnnounce();
  const locale = useLocale();
  // undefined until the cache answers; null when this page has no cached copy.
  const [cachedAt, setCachedAt] = useState<string | null | undefined>(undefined);
  const message = cachedAt === undefined ? null : offlineMessage(cachedAt, locale);
  const announceOffline = useEffectEvent((at: string | null) => announce(offlineMessage(at, locale)));

  useEffect(() => {
    if (online) return;
    let active = true;
    void readCachedAt().then((at) => {
      if (!active) return;
      setCachedAt(at);
      announceOffline(at);
    });
    return () => {
      active = false;
    };
  }, [online]);

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

function isFramed() {
  try {
    return window.self !== window.top;
  } catch {
    // A cross-origin parent blocks reading `top`: that is a frame too.
    return true;
  }
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
  const t = useMessages().pwa;
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedNow, setDismissedNow] = useState(false);
  const native = useSyncExternalStore(noSubscribe, () => appPlatform() !== "web", () => true);
  const standalone = useSyncExternalStore(noSubscribe, isStandalone, () => true);
  const ios = useSyncExternalStore(noSubscribe, isIos, () => false);
  const dismissedBefore = useSyncExternalStore(noSubscribe, readDismissed, () => true);
  const framed = useSyncExternalStore(noSubscribe, isFramed, () => true);
  const pathname = usePathname();
  const embedded = framed || isEmbeddedRoute(pathname);

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

  const offer = installOffer({ native, standalone, ios, canPrompt: deferred !== null, embedded });
  if (dismissedBefore || dismissedNow || !offer) return null;

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
        <p className="flex-1 text-body text-foreground">{offer === "button" ? t.install.lead : t.install.ios}</p>
        {offer === "button" && (
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
