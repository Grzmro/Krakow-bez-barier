import { isWidgetRoute, routes } from "@/lib/routes";

export type InstallContext = {
  /** Running inside the Capacitor app (iOS/Android). */
  native: boolean;
  /** Already opened from the home screen (`display-mode: standalone`). */
  standalone: boolean;
  ios: boolean;
  /** The browser fired `beforeinstallprompt`, so it can show its own install dialog. */
  canPrompt: boolean;
  /** A page meant for someone else's site or a shared link (widget, event page) or framed by another page. */
  embedded: boolean;
};

/** What the install banner offers: the browser's install button, the iOS "Add to Home Screen" hint, or nothing. */
export type InstallOffer = "button" | "ios-hint" | null;

export function installOffer({ native, standalone, ios, canPrompt, embedded }: InstallContext): InstallOffer {
  if (native || standalone || embedded) return null;
  if (canPrompt) return "button";
  return ios ? "ios-hint" : null;
}

/** Pages that never offer installing the app: the widget sits in a venue's iframe, the event page is the organizer's. */
export function isEmbeddedRoute(pathname: string): boolean {
  return isWidgetRoute(pathname) || pathname.startsWith(routes.event(""));
}
