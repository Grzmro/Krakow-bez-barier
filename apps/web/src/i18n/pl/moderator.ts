import type { components } from "@krakow-bez-barier/contracts";

type ReportStatus = components["schemas"]["ReportStatus"];
type ModerationDecisionKind = components["schemas"]["ModerationDecisionKind"];

// Moderator panel (/moderator): sign-in, report queue, decisions and history.
export const moderator = {
  title: "Panel moderatora",
  signIn: {
    heading: "Logowanie moderatora",
    lead: "Wklej token moderatora od administratora.",
    token: "Token moderatora",
    show: "Pokaż token",
    submit: "Zaloguj",
    checking: "Sprawdzam…",
    required: "Wpisz token moderatora.",
    invalid: "Ten token nie pasuje albo moderacja nie jest włączona na serwerze. Sprawdź, czy skopiowano go w całości.",
    lockedOut: (minutes: number) =>
      `Za dużo nieudanych prób. Spróbuj ponownie za ${minutes} min — to ochrona przed zgadywaniem tokenu.`,
    failed: "Nie udało się połączyć z serwerem. Spróbuj ponownie.",
    signedIn: "Zalogowano. Kolejka zgłoszeń jest poniżej.",
    sessionNote: "Token zostaje tylko w tej karcie przeglądarki i znika po jej zamknięciu.",
    mockNote: "Tryb przykładowy: zadziała dowolny token, a decyzje nie trafiają na serwer.",
  },
  // One-click sign-in to the demo account (shown only when the server has one).
  demoEntry: {
    heading: "Dla jury i do wypróbowania",
    lead: (minutes: number) =>
      `Wejdź bez tokenu na konto demonstracyjne. Jego decyzje działają naprawdę, ale po ${minutes} min cofamy je automatycznie.`,
    button: "Wejdź na konto demonstracyjne (dla jury)",
    entering: "Wchodzę…",
    unavailable: "Konto demonstracyjne jest wyłączone na tym serwerze. Zaloguj się tokenem moderatora.",
    failed: "Nie udało się wejść na konto demonstracyjne. Spróbuj ponownie.",
    or: "Masz token moderatora? Zaloguj się nim poniżej.",
  },
  signOut: "Wyloguj",
  signedOut: "Wylogowano.",
  sessionExpired: "Sesja moderatora wygasła. Zaloguj się ponownie.",
  loading: "Wczytuję kolejkę zgłoszeń…",
  loaded: (count: number) => `Kolejka zgłoszeń: ${count} do decyzji.`,
  loadFailed: "Nie udało się wczytać kolejki zgłoszeń.",
  retry: "Spróbuj ponownie",
  queue: "Kolejka zgłoszeń",
  queueCount: (count: number) => `Kolejka zgłoszeń (${count})`,
  empty: "Kolejka jest pusta — wszystkie zgłoszenia mają decyzję.",
  preview: "Co się zmieni na karcie",
  before: "Teraz",
  after: "Po zatwierdzeniu",
  afterSource: "Źródło: Społeczność, zweryfikowane przez moderatora",
  afterSourceDemo: "Źródło: Konto demonstracyjne moderatora (zmiana tymczasowa)",
  noData: "Brak danych",
  sourceLine: (source: string, date: string) => `${source} · ${date}`,
  reportedOn: (date: string) => `Zgłoszone ${date}`,
  comment: "Komentarz zgłaszającego",
  note: "Notatka do decyzji (opcjonalnie)",
  noteHint: "Przy „Do wyjaśnienia” napisz, czego brakuje. Notatka trafia do historii zmian.",
  approve: "Zatwierdź",
  reject: "Odrzuć",
  clarify: "Do wyjaśnienia",
  deciding: "Zapisuję decyzję…",
  decided: {
    accepted: "Zatwierdzone. Karta pokazuje nową wartość ze źródłem „Społeczność, zweryfikowane przez moderatora”.",
    rejected: "Odrzucone. Zgłoszenie znika z widoku publicznego.",
    needs_info: "Oznaczone „Do wyjaśnienia”. Zgłoszenie zostaje w kolejce.",
  } satisfies Record<ModerationDecisionKind, string>,
  // Mock mode: decisions change only the example queue, never a place card.
  decidedMock: {
    accepted: "Zatwierdzone (tryb przykładowy — karta miejsca się nie zmieni).",
    rejected: "Odrzucone (tryb przykładowy — nic nie trafia na serwer).",
    needs_info: "Oznaczone „Do wyjaśnienia” (tryb przykładowy). Zgłoszenie zostaje w kolejce.",
  } satisfies Record<ModerationDecisionKind, string>,
  // Demo account (MODERATOR_DEMO_TOKEN): decisions are real but undone automatically after `minutes`.
  decidedDemo: {
    accepted: (minutes: number) =>
      `Zatwierdzone na koncie demonstracyjnym. Karta miejsca pokazuje to zgłoszenie jako fakt ze źródłem demonstracyjnym (miejsce dostaje oznaczenie PRZYKŁAD) przez ${minutes} min, potem zmiana zostanie cofnięta.`,
    rejected: (minutes: number) => `Odrzucone na koncie demonstracyjnym. Po ${minutes} min decyzja zostanie cofnięta.`,
    needs_info: (minutes: number) =>
      `Oznaczone „Do wyjaśnienia” na koncie demonstracyjnym. Po ${minutes} min decyzja zostanie cofnięta.`,
  } satisfies Record<ModerationDecisionKind, (minutes: number) => string>,
  demo: {
    heading: "Konto demonstracyjne",
    body: (minutes: number) =>
      `To konto do wypróbowania panelu. Decyzje działają naprawdę: zatwierdzone zgłoszenie od razu zmienia kartę miejsca, ze źródłem „Konto demonstracyjne moderatora (zmiana tymczasowa)”. Po ${minutes} min każdą decyzję tego konta cofamy automatycznie, więc dane miejsc nie zmieniają się na stałe.`,
  },
  // Tabs of the signed-in panel and the "Awarie" tab: active visitor outages a moderator can take down.
  tabs: {
    label: "Sekcje panelu moderatora",
    reports: (count: number) => `Zgłoszenia (${count})`,
    outages: (count: number | null) => (count === null ? "Awarie" : `Awarie (${count})`),
  },
  outages: {
    heading: (count: number) => `Aktywne awarie (${count})`,
    lead: "Awarie wind i podjazdów zgłaszają odwiedzający bez moderacji — od razu widać je na karcie miejsca i w werdyktach. Usuń oczywisty spam albo fałszywe zgłoszenie.",
    loading: "Wczytuję awarie…",
    loadFailed: "Nie udało się wczytać awarii.",
    empty: "Nie ma aktywnych awarii.",
    title: (equipment: string, place: string) => `${place} · ${equipment}`,
    working: (n: number) => `„Działa”: ${n}`,
    reported: (time: string) => `Zgłoszona ${time}`,
    remove: "Usuń",
    removeLabel: (equipment: string, place: string) => `Usuń awarię: ${place} · ${equipment}`,
    removing: "Usuwam awarię…",
    removed: "Usunięto. Awaria zniknęła z karty miejsca i z werdyktów.",
    removedMock: "Usunięto (tryb przykładowy — karta miejsca się nie zmieni).",
    removedDemo: (minutes: number) =>
      `Usunięto na koncie demonstracyjnym. Po ${minutes} min awaria wróci na kartę, jeśli nadal będzie aktywna.`,
    gone: "Ta awaria jest już nieaktualna. Odświeżyłem listę.",
    failed: "Nie udało się usunąć awarii. Spróbuj ponownie.",
  },
  showOnCard: "Zobacz na karcie",
  showOnCardLabel: (place: string) => `Zobacz na karcie: ${place}`,
  alreadyDecided: "Ktoś już podjął decyzję w tej sprawie. Odświeżyłem kolejkę.",
  decideFailed: "Nie udało się zapisać decyzji. Spróbuj ponownie.",
  history: "Historia zmian",
  historyEmpty: "Jeszcze nie ma decyzji.",
  historyEntry: (moderatorName: string, date: string) => `${moderatorName} · ${date}`,
  historySummary: {
    accepted: (place: string, attribute: string, value: string) => `${place} · ${attribute} → ${value}`,
    reported: (place: string, attribute: string, value: string) => `${place} · ${attribute} · zgłoszono: ${value}`,
  },
  loadLockedOut: (minutes: number) => `Za dużo nieudanych prób. Kolejka będzie dostępna za ${minutes} min.`,
  status: {
    new: "Oczekuje",
    needs_info: "Do wyjaśnienia",
    accepted: "Zatwierdzone",
    rejected: "Odrzucone",
  } satisfies Record<ReportStatus, string>,
  decision: {
    accepted: "Zatwierdzone",
    rejected: "Odrzucone",
    needs_info: "Do wyjaśnienia",
  } satisfies Record<ModerationDecisionKind, string>,
} as const;
