import { en } from "./en";
import { defaultLocale, type Locale } from "./locale";
import { pl } from "./pl";

/** `pl` is the reference catalog: every other language has the same keys and function signatures. */
type Widen<T> = T extends string
  ? string
  : T extends (...args: never[]) => unknown
    ? T
    : T extends readonly (infer E)[]
      ? readonly Widen<E>[]
      : T extends object
        ? { readonly [K in keyof T]: Widen<T[K]> }
        : T;

export type Messages = Widen<typeof pl>;

export const catalogs: Record<Locale, Messages> = { pl, en };

export const messagesFor = (locale: Locale = defaultLocale): Messages => catalogs[locale];
