export type InstallContext = {
  /** Running inside the Capacitor app (iOS/Android). */
  native: boolean;
  /** Already opened from the home screen (`display-mode: standalone`). */
  standalone: boolean;
  ios: boolean;
  /** The browser fired `beforeinstallprompt`, so it can show its own install dialog. */
  canPrompt: boolean;
};

/** What the install banner offers: the browser's install button, the iOS "Add to Home Screen" hint, or nothing. */
export type InstallOffer = "button" | "ios-hint" | null;

export function installOffer({ native, standalone, ios, canPrompt }: InstallContext): InstallOffer {
  if (native || standalone) return null;
  if (canPrompt) return "button";
  return ios ? "ios-hint" : null;
}
