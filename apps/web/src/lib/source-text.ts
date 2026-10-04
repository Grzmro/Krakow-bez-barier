import type { Locale } from "@/i18n/locale";
import { messagesFor } from "@/i18n/messages";

// Source registry text is Polish (names, licences, attributions from Polish public bodies) except a few English
// attributions required by licence ("© OpenStreetMap contributors").
const ENGLISH = /\b(contributors|the|of|and|with|from|licen[cs]e)\b/i;
// Names and licence ids that read the same in both languages: marking them would switch the voice for nothing.
const NEUTRAL = /^(OpenStreetMap|Kraków bez barier|ODbL[\s\d.]*|CC[\s-]BY[\s\w.-]*|MIT)$/i;

/** The language a source wrote this text in, as far as the registry tells: Polish unless it is plainly English or a name. */
export function sourceTextLanguage(text: string): Locale | null {
  if (NEUTRAL.test(text.trim())) return null;
  return ENGLISH.test(text) ? "en" : "pl";
}

/**
 * The `lang` for text a source provided (shown untranslated), so a screen reader switches voice where it differs
 * from the page (WCAG 3.1.2); undefined where the page language already matches or the text is a neutral name.
 */
export function sourceTextLang(text: string, locale: Locale): Locale | undefined {
  const language = sourceTextLanguage(text);
  return language === null || language === locale ? undefined : language;
}

/** Like `sourceTextLang` for a licence, which is our own translated wording when pending or for user reports. */
export function licenseLang(license: string, locale: Locale): Locale | undefined {
  const own: readonly string[] = Object.values(messagesFor(locale).pages.aboutData.licenseNote);
  return own.includes(license) ? undefined : sourceTextLang(license, locale);
}
