// Installable app (manifest, install prompt) and offline mode.
export const pwa = {
  shortName: "Bez barier",
  offline: {
    withDate: (date: string) => `Jesteś offline — pokazujemy dane z ${date}.`,
    noDate: "Jesteś offline — pokazujemy ostatnio zapisane dane.",
  },
  offlinePage: {
    title: "Jesteś offline",
    lead: "Tej strony nie ma jeszcze w pamięci urządzenia. Połącz się z internetem albo wróć do strony głównej — pokażemy ostatnio zapisane dane.",
    home: "Strona główna",
  },
  install: {
    label: "Instalacja aplikacji",
    button: "Zainstaluj aplikację",
    lead: "Dodaj Kraków bez barier do ekranu głównego — działa też bez internetu.",
    ios: "Na iPhonie: stuknij Udostępnij, a potem „Do ekranu początkowego”.",
    dismiss: "Nie teraz",
  },
} as const;
