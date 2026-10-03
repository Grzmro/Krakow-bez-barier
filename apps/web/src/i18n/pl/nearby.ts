import type { LocateFailure } from "@/lib/native/geolocation";
import type { LocationSettings } from "@/lib/native/platform";

// "W mojej okolicy" — the device position action (native prompt in the app, browser API on the web).
export const nearby = {
  action: "W mojej okolicy",
  actionSub: "Ustal moją pozycję",
  locating: "Ustalam pozycję…",
  found: (latitude: string, longitude: string, accuracy: number) =>
    `Jesteś tutaj: ${latitude}° N, ${longitude}° E (dokładność ±${accuracy} m)`,
  privacy: "Pozycja zostaje na Twoim urządzeniu — nie wysyłamy jej na serwer.",
  errors: {
    denied: "Brak zgody na lokalizację.",
    off: "Usługi lokalizacji są wyłączone.",
    unavailable: "Telefon nie zna teraz swojej pozycji.",
    timeout: "Ustalanie pozycji trwało zbyt długo.",
    insecure: "Lokalizacja działa tylko przez bezpieczne połączenie (https).",
    unsupported: "To urządzenie nie udostępnia lokalizacji.",
  } satisfies Record<LocateFailure, string>,
  help: {
    denied: {
      ios: "Na iPhonie lub iPadzie: Ustawienia → Prywatność i ochrona → Usługi lokalizacji → Witryny Safari → „Podczas używania aplikacji” (w Chrome lub Firefoksie: Ustawienia → Chrome/Firefox → Lokalizacja). Potem wróć i spróbuj ponownie.",
      "ios-app": "Ustawienia → Kraków bez barier → Lokalizacja → „Podczas używania aplikacji”. Potem wróć i spróbuj ponownie.",
      android:
        "Na Androidzie: w Chrome dotknij ikony obok adresu (w zainstalowanej aplikacji przytrzymaj jej ikonę → Informacje o aplikacji) → Uprawnienia → Lokalizacja → Zezwalaj. Potem spróbuj ponownie.",
      "android-app":
        "Ustawienia → Aplikacje → Kraków bez barier → Uprawnienia → Lokalizacja → „Zezwalaj tylko podczas korzystania z aplikacji”. Potem spróbuj ponownie.",
      other: "Zezwól na lokalizację w ustawieniach strony (ikona obok adresu) i spróbuj ponownie.",
    } satisfies Record<LocationSettings, string>,
    off: {
      ios: "Włącz je: Ustawienia → Prywatność i ochrona → Usługi lokalizacji. Potem spróbuj ponownie.",
      "ios-app": "Włącz je: Ustawienia → Prywatność i ochrona → Usługi lokalizacji. Potem spróbuj ponownie.",
      android: "Włącz Lokalizację w szybkich ustawieniach (przesuń palcem w dół od góry ekranu) i spróbuj ponownie.",
      "android-app": "Włącz Lokalizację w szybkich ustawieniach (przesuń palcem w dół od góry ekranu) i spróbuj ponownie.",
      other: "Włącz lokalizację w ustawieniach systemu i spróbuj ponownie.",
    } satisfies Record<LocationSettings, string>,
    unavailable: "Sprawdź, czy lokalizacja w telefonie jest włączona, podejdź do okna albo wyjdź na zewnątrz i spróbuj ponownie.",
    timeout: "Spróbuj ponownie — przy dobrym sygnale trwa to kilka sekund.",
    insecure: "Otwórz aplikację pod adresem zaczynającym się od https://.",
  },
  retry: "Spróbuj ponownie",
  manual: {
    open: "Albo wybierz dzielnicę",
    label: "Dzielnica",
    placeholder: "Wybierz dzielnicę…",
    submit: "Pokaż okolicę",
  },
  home: {
    sortOff: "Pokaż miejsca od najbliższych",
    sortOn: "Od najbliższych, odległość od Ciebie",
    sortOnChosen: (place: string) => `Od najbliższych, odległość od: ${place}`,
    privacy:
      "Dokładna pozycja zostaje na urządzeniu. Do wyszukiwania wysyłamy tylko przybliżony obszar w promieniu ok. 2 km, nie Twoją pozycję.",
    announce: "W Twojej okolicy, od najbliższych",
    announceChosen: (place: string) => `W okolicy: ${place}, od najbliższych`,
    you: "Ty",
    emptyHint: "Szukasz tylko w Twojej okolicy (w promieniu ok. 2 km).",
    emptyHintChosen: (place: string) => `Szukasz tylko w okolicy: ${place} (w promieniu ok. 2 km).`,
    nearestOnly: (shown: number, total: number) =>
      `Pokazano ${shown} najbliższych z ${total} miejsc w okolicy. Zawęź wyszukiwanie nazwą, kategorią lub filtrem, żeby zobaczyć pozostałe.`,
    nearestRynekOnly: (shown: number, total: number) =>
      `Pokazano ${shown} najbliższych Rynku z ${total} miejsc. Zawęź wyszukiwanie nazwą, kategorią lub filtrem albo użyj „W mojej okolicy”.`,
  },
  devPage: {
    title: "Funkcje natywne",
    lead: "Diagnostyka: platforma i lokalizacja. Pozycja jest ustalana po wejściu na stronę.",
    platform: "Platforma",
    platforms: { ios: "aplikacja iOS", android: "aplikacja Android", web: "przeglądarka" },
  },
} as const;
