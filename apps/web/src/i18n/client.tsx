"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, defaultLocale, type Locale } from "./locale";
import { messagesFor, type Messages } from "./messages";

type LocaleState = { locale: Locale; setLocale: (locale: Locale) => void };

const LocaleContext = createContext<LocaleState>({ locale: defaultLocale, setLocale: () => {} });

/** The layout passes the locale it read from the cookie; Client Components pick their copy from it. */
export function I18nProvider({ locale: initial, children }: { locale: Locale; children: ReactNode }) {
  const [locale, setLocale] = useState(initial);
  // A server render with another cookie (e.g. a second tab switched the language) wins.
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setLocale(initial);
  }
  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext).locale;

export const useMessages = (): Messages => messagesFor(useLocale());

/**
 * Switches the language: Client Components at once, Server Components after a refresh. API data (chip labels,
 * verdict reasons) is cached per language — every localized query key holds the locale. Remembered in a cookie.
 */
export function useSetLocale() {
  const { setLocale } = useContext(LocaleContext);
  const router = useRouter();
  return useCallback(
    (locale: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
      document.documentElement.lang = locale;
      setLocale(locale);
      router.refresh();
      // Pages stored for offline use are keyed by URL only; store the shell and this page again in the new language.
      for (const url of ["/", "/offline", location.pathname + location.search]) {
        navigator.serviceWorker?.controller?.postMessage({ type: "kbb:warm-page", url, force: true });
      }
    },
    [setLocale, router],
  );
}
