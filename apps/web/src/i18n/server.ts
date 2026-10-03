import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale, type Locale } from "./locale";
import { messagesFor, type Messages } from "./messages";

/** The language picked in the menu (cookie), for Server Components and metadata; default Polish. */
export async function getLocale(): Promise<Locale> {
  return parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

export async function getMessages(): Promise<Messages> {
  return messagesFor(await getLocale());
}
