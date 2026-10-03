// UI languages. Adding one: a `<code>/` folder of area files + `<code>.ts` index, then register it here
// and in `messages.ts`.
export const locales = ["pl", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "pl";

/** The chosen language, remembered in the browser; read by Server Components and route handlers alike. */
export const LOCALE_COOKIE = "kbb-lang";

/** One year: a tourist who picked English keeps it on the next visit. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Endonyms, so each option is readable by the person who needs it. */
export const localeNames: Record<Locale, string> = { pl: "Polski", en: "English" };

export const isLocale = (value: unknown): value is Locale => locales.includes(value as Locale);

export const parseLocale = (value: string | null | undefined): Locale => (isLocale(value) ? value : defaultLocale);

/** Reads the language from a `Cookie` header (or `document.cookie`); unknown or missing → default. */
export function localeFromCookies(cookieHeader: string | null | undefined): Locale {
  const entry = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`));
  return parseLocale(entry?.slice(LOCALE_COOKIE.length + 1));
}

export const localeOf = (request: Request): Locale => localeFromCookies(request.headers.get("cookie"));

/** BCP 47 tag for `Intl` formatters. */
export const intlLocale: Record<Locale, string> = { pl: "pl-PL", en: "en-GB" };
