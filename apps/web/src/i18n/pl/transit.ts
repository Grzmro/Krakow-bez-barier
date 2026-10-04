function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}

export const transit = {
  title: "Najbliższe odjazdy",
  lead: (radius: number) =>
    `Przystanki do ${radius} m od miejsca i odjazdy w ciągu godziny. Czy pojazd przyjmie wózek, mówi przewoźnik w danych na żywo.`,
  loading: "Wczytujemy odjazdy…",
  loadError: "Nie udało się wczytać odjazdów. Reszta karty działa normalnie.",
  retry: "Spróbuj ponownie",
  noStops: (radius: number) => `Brak przystanków komunikacji miejskiej w promieniu ${radius} m.`,
  noDepartures: "Brak odjazdów w ciągu najbliższej godziny.",
  distance: (meters: number) => `${meters} m stąd`,
  platform: (platform: string) => `stanowisko ${platform}`,
  mode: { tram: "Tramwaj", bus: "Autobus" },
  towards: "kierunek",
  departs: "odjazd",
  delay: (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    if (minutes === 0) return "o czasie";
    return minutes > 0
      ? `opóźnienie ${minutes} ${plural(minutes, "minuta", "minuty", "minut")}`
      : `przed czasem ${-minutes} ${plural(-minutes, "minuta", "minuty", "minut")}`;
  },
  vehicle: {
    accessible: "Pojazd dostępny dla wózka",
    inaccessible: "Pojazd niedostępny dla wózka",
    unverified: "Niezweryfikowane",
    no_data: "Brak danych o pojeździe",
    declared: "Deklaracja przewoźnika",
    conflict: "Sprzeczne",
  },
  evidenceTitle: "Co mówią źródła",
  evidenceKind: {
    operator_flag: "Flaga przewoźnika (ZTP, dane na żywo)",
    fleet_type: "Typ taboru (konfiguracja miasta)",
    carrier_declaration: "Deklaracja przewoźnika",
  },
  evidenceValue: (accessible: boolean): string => (accessible ? "dostępny dla wózka" : "niedostępny dla wózka"),
  evidenceReliability: {
    confirmed: "potwierdzone",
    community: "społeczność",
    extracted: "wyciągnięte automatycznie",
    user_report: "zgłoszenie użytkownika",
    inferred: "wnioskowane",
    sample: "PRZYKŁAD",
  },
  evidenceLine: (kind: string, value: string, reliability: string, detail: string | null) =>
    `${kind}: ${value}${detail ? ` (${detail})` : ""} · wiarygodność: ${reliability}`,
  vehicleNumber: (label: string) => `pojazd nr ${label}`,
  unverifiedHint:
    "„Niezweryfikowane”: przewoźnik oznacza każdy tramwaj jako dostępny dla wózka, także wysokopodłogowe, więc nie traktujemy tego jako potwierdzenia. „Brak danych”: dane na żywo nic nie mówią o pojeździe — to nie znaczy, że jest dostępny.",
  sourceLabel: "Źródło:",
  fetchedAt: (time: string) => `dane z ${time}`,
  licenseLabel: "licencja:",
  recorded: (time: string) => `Nagranie danych przewoźnika z ${time} — to nie są odjazdy na żywo.`,
  outage: (time: string) => `Dane przewoźnika są teraz niedostępne. Pokazujemy ostatnie pobrane, z ${time}.`,
  stale: (time: string) => `Dane przewoźnika nie odświeżają się od ${time} — odjazdy mogą być nieaktualne.`,
  outageNoData: "Dane przewoźnika są teraz niedostępne i nie mamy wcześniejszych. Sprawdź odjazdy na tablicy przystanku.",
  disabled: "Odjazdy z dostępnością pojazdów pokażemy po potwierdzeniu licencji danych ZTP.",
  statusNote: {
    stale: "Dane przewoźnika nie odświeżają się. Pokazujemy ostatnie, mogą być nieaktualne.",
    disabled: "Nie udostępniamy tych danych: licencja danych ZTP czeka na potwierdzenie.",
    outage: "Dane przewoźnika są niedostępne. Pokazujemy ostatnie pobrane.",
    partialOutage: (modes: ("tram" | "bus")[]) =>
      `Część danych przewoźnika jest niedostępna (${modes.map((m) => (m === "tram" ? "tramwaje" : "autobusy")).join(", ")}). Dla tej części pokazujemy ostatnie pobrane.`,
  },
};
