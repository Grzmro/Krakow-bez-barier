import type { components } from "@krakow-bez-barier/contracts";

type DataAgeBucket = components["schemas"]["DataAgeBucket"];
type Reliability = components["schemas"]["Reliability"];
type SourceKind = components["schemas"]["SourceKind"];

const days = (n: number) => (n === 1 ? "1 dzień" : `${n} dni`);

// Data quality report (/o-danych/jakosc): how good the data is, as tables readable without JavaScript.
export const quality = {
  title: "Jakość danych",
  lead: "Mierzymy, jak dobre są nasze dane: gdzie ich brakuje, jak są stare i gdzie źródła się różnią. Liczby pochodzą z bazy, bez danych osobowych.",
  aboutLink: "Raport jakości danych: pokrycie, wiek, konflikty i luki",
  cityLink: "Raport jakości danych (publiczny)",
  backToAbout: "Wróć do „O danych”",
  computedAt: (date: string) => `Policzone: ${date}`,
  sampleNote: "Tryb przykładowy: liczby z przykładowych miejsc, nie z danych Krakowa.",
  realOnly:
    "Miejsca i fakty oznaczone PRZYKŁAD są pominięte. Pomijamy też kategorie ukryte domyślnie na mapie (miejsca parkingowe, przystanki i podobne), tak jak w panelu dla miasta.",
  unavailable: "Nie udało się teraz policzyć raportu. Spróbuj ponownie za chwilę.",
  dateLocale: "pl-PL",
  timeZone: "Europe/Warsaw",
  none: "Brak danych",
  summary: {
    heading: "W skrócie",
    places: "Miejsca w bazie",
    withData: "Z danymi o dostępności",
    withoutData: "Bez danych („Brak danych”)",
    facts: "Fakty o dostępności",
    medianAge: "Mediana wieku faktów",
    conflicts: "Miejsca ze sprzecznymi źródłami",
    stale: "Miejsca z nieaktualnymi danymi",
    share: (percent: number) => `${percent}% miejsc`,
    days,
  },
  coverage: {
    heading: "Pokrycie wg kategorii",
    caption: "Miejsca z faktem o dostępności i bez danych, według kategorii. Największe luki są na górze.",
    category: "Kategoria",
    places: "Miejsca",
    withData: "Z danymi",
    share: "Odsetek z danymi",
    withoutData: "Bez danych",
    conflicts: "Sprzeczne atrybuty",
    stale: "Nieaktualne atrybuty",
    medianAge: "Mediana wieku faktów",
    empty: "Baza nie ma jeszcze żadnych miejsc do policzenia.",
  },
  gaps: {
    heading: "Największe luki: co zweryfikować",
    lead: "Kategorie, w których najwięcej miejsc nie ma żadnego faktu o dostępności. Brak danych nie znaczy, że miejsce jest dostępne.",
    item: (category: string, without: number, total: number, percent: number) =>
      `${category}: ${without} z ${total} miejsc bez danych (${percent}%)`,
    residents: "Mieszkańcy: otwórz kartę miejsca i zgłoś brakującą cechę — moderator sprawdzi zgłoszenie.",
    city: "Miasto: uzupełnij lub potwierdź dane w tych kategoriach; ranking miejsc do weryfikacji jest w panelu dla miasta.",
    none: "Każde policzone miejsce ma co najmniej jeden fakt o dostępności.",
  },
  attributes: {
    heading: "Pokrycie wg cech",
    caption: "Ile miejsc ma co najmniej jeden fakt o danej cesze. Cechy, o których wiemy najmniej, są na górze.",
    attribute: "Cecha",
    places: "Miejsca z faktem",
    share: "Odsetek miejsc",
  },
  age: {
    heading: "Wiek danych",
    caption: "Fakty według wieku. Wiek liczymy od ostatniego potwierdzenia lub obserwacji, a bez nich od pobrania danych.",
    bucket: "Wiek faktu",
    facts: "Fakty",
    share: "Odsetek faktów",
    buckets: {
      within_90_days: "do 90 dni",
      within_365_days: "91–365 dni",
      older: "ponad rok (nieaktualne)",
    } satisfies Record<DataAgeBucket, string>,
  },
  reliability: {
    heading: "Wiarygodność faktów",
    caption: "Fakty według stopnia wiarygodności, od najmocniejszych.",
    level: "Wiarygodność",
    facts: "Fakty",
    share: "Odsetek faktów",
    levels: {
      confirmed: "Potwierdzone (urząd lub weryfikacja)",
      community: "Społeczność (np. OpenStreetMap)",
      extracted: "Odczytane automatycznie (np. z deklaracji dostępności)",
      user_report: "Zgłoszenie mieszkańca",
      inferred: "Wnioskowane",
      sample: "Przykład",
    } satisfies Record<Reliability, string>,
  },
  conflicts: {
    heading: "Konflikty źródeł",
    body: (places: number, attributes: number) =>
      `Atrybuty, w których źródła podają różne wartości: ${attributes} (miejsca: ${places}). Nie rozstrzygamy ich po cichu: karta miejsca pokazuje obie wartości z datami.`,
    none: "Nie ma teraz atrybutów, w których aktualne źródła by się różniły.",
  },
  sources: {
    heading: "Skąd są fakty",
    caption: "Źródła, z których pochodzą policzone fakty. Licencje i status odświeżania są w „O danych”.",
    source: "Źródło",
    kind: "Rodzaj",
    facts: "Fakty",
    newest: "Najnowsze pobranie",
    kinds: {
      official_open_data: "Otwarte dane urzędu",
      community: "Społeczność",
      venue_owner: "Właściciel miejsca",
      user_report: "Zgłoszenia mieszkańców",
      sample: "Przykład",
    } satisfies Record<SourceKind, string>,
    aboutLink: "Źródła i licencje",
  },
  method: {
    heading: "Jak liczymy",
    items: [
      "Fakty rozstrzygamy tak samo jak na karcie miejsca: sprzeczność, nieaktualność i brak danych znaczą to samo.",
      "Miejsce „z danymi” ma co najmniej jeden aktywny fakt o dostępności. Reszta to „Brak danych”, nigdy „dostępne”.",
      "Fakt jest nieaktualny, gdy ma ponad 12 miesięcy albo pochodzi ze źródła, które przestało się odświeżać.",
      "Liczymy tylko zbiorczo: bez zgłoszeń, komentarzy, zdjęć i danych osobowych.",
    ],
  },
} as const;
