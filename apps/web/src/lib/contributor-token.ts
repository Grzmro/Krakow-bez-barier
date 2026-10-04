const STORAGE_KEY = "kbb-contributor";
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

let memory: string | undefined;

// getRandomValues, not randomUUID: the phone loads the dev server over plain http on a LAN IP, not a secure context.
const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * The browser's random contributor token (`X-Contributor-Token`): lets the API keep one pending report or
 * confirmation per device, place and attribute. Generated on the first report or confirmation and kept in this
 * browser only; it says nothing about
 * the person (no account, IP or fingerprint — R4, R7, described on /prywatnosc). Without storage it lasts the session.
 */
export function contributorToken(storage: Pick<Storage, "getItem" | "setItem"> | undefined = safeLocalStorage()): string {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    if (stored && TOKEN.test(stored)) return stored;
    const token = memory ?? randomToken();
    storage?.setItem(STORAGE_KEY, token);
    memory = token;
    return token;
  } catch {
    memory ??= randomToken();
    return memory;
  }
}

/** The token if this browser already has one; never creates it, so only reading a card leaves no identifier. */
export function storedContributorToken(
  storage: Pick<Storage, "getItem"> | undefined = safeLocalStorage(),
): string | undefined {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    if (stored && TOKEN.test(stored)) return stored;
  } catch {
    // fall through to the session token
  }
  return memory;
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
