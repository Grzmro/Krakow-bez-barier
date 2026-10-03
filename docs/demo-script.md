# Scenariusz demo (wideo ≤ 3:00)

Scenariusz wideo do zgłoszenia (KBB-31) i pokazu na żywo. Nagranie przejścia przez aplikację robi
Playwright; na gotowe wideo wystarczy nagrać lektora z tekstu poniżej.

**Wszystko na prawdziwych danych**: miejsca z OpenStreetMap (ekstrakt Geofabrik) i otwartych danych
Krakowa (MSIP), z bazy, na której działa aplikacja. Żadnych przykładowych miejsc ze specyfikacji API
i żadnej etykiety „PRZYKŁAD” na ekranie.

## Jak nagrać

```bash
npm run db:setup                      # migracje + seed (źródła, toalety MSIP)
npm run ingest -- --source osm        # miejsca z OpenStreetMap
npm run demo:record                   # build bez mocka + dwa `next start` tego repo, nagranie
DEMO_PACE=0.2 npm run demo:record     # szybki przebieg kontrolny (krótsze pauzy)
E2E_BASE_URL=https://<deploy> DEMO_OUTAGE_BASE_URL=https://<deploy z awarią> npm run demo:record
```

- Wynik: `apps/web/demo-output/kbb-demo.webm` i `kbb-demo.mp4` (MP4 tylko, gdy jest `ffmpeg`;
  zgłoszenie wymaga MP4). 1920×1080: aplikacja w ramce telefonu (412×915), obok napis sceny,
  kółko w miejscu „dotknięcia”.
- Test kończy się błędem, gdy przejście trwa dłużej niż 3:00. W konsoli wypisuje czas każdej
  sceny — według niego układamy lektora.
- **Baza jest wymagana.** Bez `DATABASE_URL` nagranie nie startuje (błąd konfiguracji z instrukcją),
  a gdy baza nie odpowiada albo brakuje miejsca ze scenariusza, kończy się błędem na starcie —
  nigdy nie przechodzi po cichu na przykładowe dane. Build ma zawsze `NEXT_PUBLIC_API_MOCK` puste.
- Miejsca są wyszukiwane w API po nazwie (Qubus, Hotel Miodowa) albo po stanie (toaleta, w której
  miasto i OpenStreetMap podają sprzeczne dane o przewijaku), nie po identyfikatorach. Nazwy są w
  jednym miejscu skryptu, `PLACES`.
- **Awaria źródła** to przełącznik operatora `SIMULATE_SOURCE_OUTAGE=msip-toilets` (zmienna serwera,
  KBB-29). Lokalnie nagranie uruchamia drugi `next start` tego samego buildu i tej samej bazy z tym
  przełącznikiem i tylko scena „Źródło niedostępne” oraz „O danych” idą przez niego. Dla wdrożenia
  podaj jego adres w `DEMO_OUTAGE_BASE_URL` (np. wdrożenie podglądowe z przełącznikiem, patrz
  [deployment.md](deployment.md) pkt 7); bez niego nagranie pomija tę scenę z ostrzeżeniem.
- **Scena 5 wysyła prawdziwe zgłoszenie** („Przewijak: Jest”) do bazy, na której działa aplikacja.
  Czeka na moderację i nie zmienia danych. Nagrywaj na bazie demo, nie produkcyjnej.
- **Przed każdym kolejnym nagraniem odrzuć zgłoszenia z poprzedniego** w `/moderator` (albo postaw
  bazę demo od nowa: `npm run db:setup` + ingest). Inaczej karta toalety pokaże starsze wpisy
  „Zgłoszenie użytkownika” obok nowego.
- Skrypt: `apps/web/e2e/demo/record-demo.ts` (osobna konfiguracja `playwright.demo.config.ts`, poza
  `npm run test:e2e`).

## Miejsca w scenariuszu

Stan danych z 2026-10-03 (OSM: ekstrakt Geofabrik z 2026-10-02, MSIP: zapytanie z 2026-10-03).
Przed nagraniem nagranie samo sprawdza, że każde z nich jest w bazie.

Skąd są w bazie: Qubus, Hotel Miodowa i fakty MSIP o toaletach (strona „miasto” konfliktu) pochodzą
ze snapshotu seeda `npm run db:setup` (`packages/db/seed/demo-places.json`), nie z ingestu.
`ingest --source osm` dokłada pozostałe miejsca z ekstraktu i odświeża fakty OSM — także nazwy, stąd
toaleta ma na karcie samą nazwę z OSM, bez ulicy.

| Scena | Miejsce | Co mówią dane |
|---|---|---|
| 2–3 · Fakty | **Qubus** (hotel, Nadwiślańska 6) | OSM: `wheelchair=yes`, 9 kondygnacji, sprawdzone 2026-02-11. Wejście, drzwi, winda, toaleta — brak danych. Werdykt dla profilu „Wózek”: „Brak danych · wejście”. |
| 4 · Niepełne dane | **Hotel Miodowa** (Miodowa 51) | OSM: tylko `wheelchair=yes`; żadnej konkretnej bariery. Na karcie „Brak danych” przy każdej cesze. |
| 4 · Sprzeczne dane | **Toaleta publiczna** (OSM `node/5270846528`, przejście pod ul. Konopnickiej) | MSIP: przewijak „brak”; OpenStreetMap: `changing_table=yes`. Status „Sprzeczne”, obie wartości ze źródłami. |
| 4 · Źródło niedostępne | ta sama toaleta, przy symulowanej awarii MSIP | „Odświeżenie nie powiodło się — dane z 3.10.2026”; fakty MSIP oznaczone jako nieaktualne, przewijak rozstrzyga świeższe OpenStreetMap. |
| 7 · Dla firm | widget hotelu **Qubus** (`/dla-firm?miejsce=<id>`) | Ta sama karta co w aplikacji, z tymi samymi źródłami. |

## Scenariusz

Grupa docelowa: **osoba na wózku** (profil „Wózek”); ten sam przebieg działa dla profilu
„Wózek dziecięcy”. Czasy z przebiegu `npm run demo:record` (plik wideo ok. 2:35); po każdym nagraniu sprawdź je w konsoli.

| Czas | Scena | Co widać | Lektor |
|---|---|---|---|
| 0:00 | 1 · Dla kogo | Strona główna: wyszukiwarka, mapa, lista prawdziwych miejsc | Pani Anna porusza się na wózku. Zanim wyjdzie z domu, chce wiedzieć, czy w miejscu docelowym nie zatrzymają jej schody albo za wąskie drzwi. Nie zakłada konta. |
| 0:06 | 1 · Dla kogo | Wybór profilu „Wózek”, okno „Progi profilu” | Wybiera profil „Wózek”. Profil to tylko progi: ile stopni, jaka szerokość drzwi, czy potrzebna toaleta. Nie pytamy o niepełnosprawność. |
| 0:17 | 2 · Miejsce | Wpisanie „Qubus”, wynik na liście i na mapie | Szuka hotelu Qubus. To prawdziwe miejsca z OpenStreetMap — wynik jest na liście i na mapie, a lista to pełna, tekstowa wersja mapy. |
| 0:22 | 2 · Miejsce | „Brak danych · wejście”, rozwinięte „Dlaczego?”: wejście, drzwi, winda, toaleta — nie wiadomo | Werdykt jest słowem, nie kolorem. OpenStreetMap mówi tylko „dostępny dla wózków” — o stopniach i drzwiach nie mówi nic, więc aplikacja nie udaje, że wie. |
| 0:32 | 3 · Konkretne fakty | Karta miejsca: stopnie, drzwi, winda, toaleta, kondygnacje | Na karcie nie ma etykiety „dostępne”. Są konkretne cechy, a tam, gdzie nikt ich nie sprawdził, „Brak danych”. |
| 0:39 | 3 · Skąd wiemy? | Rozwinięte „Kondygnacje”: źródło OpenStreetMap, data, „Niezweryfikowane” | Przy każdej informacji jest źródło, data i wiarygodność. Jedno źródło społeczności to „niezweryfikowane”, a nie gwarancja. |
| 0:47 | 4 · Niepełne dane | Hotel Miodowa: „Brak danych” przy każdej cesze | Hotel Miodowa: w danych jest tylko ogólne „tak”. Mówimy „brak danych” — szarym kolorem, nigdy jako „dostępne”. Można zapytać obiekt albo uzupełnić dane. |
| 0:55 | 4 · Sprzeczne dane | „Toaleta publiczna” (przejście pod ul. Konopnickiej): „Przewijak: Nie ma / Jest”, oba źródła z datami | Miasto mówi, że przewijaka nie ma, OpenStreetMap — że jest. Pokazujemy obie wersje ze źródłami — decyzję zostawiamy użytkownikowi. |
| 1:08 | 5 · Zgłoszenie | „To się nie zgadza” → „Jest” → „Wyślij” | Pani Anna była na miejscu, więc poprawia dane: trzy kroki, bez konta i bez e-maila. |
| 1:16 | 5 · Zgłoszenie | „Twoje zgłoszenie: Jest · Niezweryfikowane”, fakt dalej „Sprzeczne” | Zgłoszenie czeka na moderację. Do tego czasu nie zmienia danych — jest widoczne obok jako niezweryfikowane. |
| 1:24 | 4 · Źródło niedostępne | Ta sama toaleta przy awarii MSIP: „Odświeżenie nie powiodło się — dane z 3.10.2026” | Symulujemy awarię miejskiego serwera MSIP. Nie ukrywamy jej: dane miasta zostają, z datą i jako nieaktualne. |
| 1:32 | 6 · Źródła danych | „O danych”: MSIP „Niedostępne” (symulowana awaria), OSM działa, zasady wiarygodności | Dane pochodzą z otwartych źródeł: OpenStreetMap i MSIP Krakowa. Dla każdego: licencja, częstotliwość odświeżania i stan — także awaria. Miasto nie utrzymuje żadnej bazy. |
| 1:43 | 7 · Dla firm | Widget z kartą hotelu Qubus na stronie obiektu, kod do wklejenia, API | Hotel osadza na swojej stronie aktualną kartę dostępności jednym kodem. Systemy rezerwacyjne i aplikacje turystyczne biorą te same dane z API. |
| 1:50 | 7 · Model biznesowy | Cennik: karta na stronie, weryfikacja na miejscu | Płacą obiekty — za kartę na stronie i weryfikację na miejscu. Mieszkańcy i turyści korzystają za darmo. |
| 1:57 | 8 · Dostępność | Przejścia klawiszem Tab: „Przejdź do treści”, widoczny fokus, menu | Aplikacja sama jest dostępna: cały scenariusz przejdziemy klawiaturą, statusy są tekstem, nie tylko kolorem, a mapa ma tekstowy odpowiednik. |
| 2:05 | 8 · Dostępność | „Deklaracja dostępności”: co działa, ograniczenia, plan | Celem jest WCAG 2.2 AA. Każdy ekran sprawdzamy automatycznie, a w deklaracji uczciwie piszemy, czego jeszcze nie ma — na przykład testów z czytnikami ekranu — i kiedy to zrobimy. |
| 2:17 | 9 · Od prototypu do usługi | Strona główna | Usługę prowadzi niezależny operator — nie Urząd Miasta, który nie utrzymuje żadnej bazy. Hosting, moderację zgłoszeń i utrzymanie opłacają obiekty: za kartę na swojej stronie i weryfikację na miejscu; mieszkańcy i turyści korzystają za darmo. |
| 2:24 | 9 · Od prototypu do usługi | Strona główna | Plan: pilotaż w Krakowie z testami z użytkownikami, potem panel właściciela obiektu. Kolejne miasto to konfiguracja — obszar OpenStreetMap i lista otwartych źródeł — oraz lokalny moderator; bez nowego kodu. |
| 2:31 | Zakończenie | Strona główna | Kraków bez barier: konkretne fakty, źródło przy każdej informacji, otwarte dane. Dziękujemy. |

## Pokrycie oceny jury

Punkty z [challenge.md](challenge.md) → „How the jury will evaluate it”.

| Punkt jury | Sceny |
|---|---|
| Grupa docelowa i jej potrzeby | 1 (osoba na wózku, profil jako progi, bez pytań o niepełnosprawność) |
| Sprawdzenie miejsca, konkretne bariery i udogodnienia | 2, 3 |
| Pochodzenie danych: źródło, data, wiarygodność | 3, 6 |
| Oznaczenie danych niepełnych, nieaktualnych, niezweryfikowanych | 2–3 (niezweryfikowane, brak danych), 4 (brak danych, nieaktualne) |
| Przypadek awarii: sprzeczne, niepełne, niedostępne źródło; brak informacji ≠ dostępność | 4 (wszystkie trzy, na prawdziwych miejscach) |
| Poprawianie błędnych danych | 5 |
| Kontrola dostępności: klawiatura, czytnik ekranu, kontrast, mapa jako tekst; ograniczenia i plan | 2 (lista = mapa), 8 |
| Prototyp → usługa: właściciel, dane, hosting, plan, kolejne miasto | 6 (dane), 7 (kto płaci), 9 (operator, finansowanie hostingu, plan, warunki dla kolejnego miasta) |

## Kontrola dostępności głównego scenariusza

Automatycznie, w `npm run test:e2e` — `apps/web/e2e/main-scenario-a11y.spec.ts`:

- cały scenariusz samą klawiaturą (wyszukanie → profil → „Progi profilu” i Escape → karta → fakt →
  formularz zgłoszenia, Escape → zgłoszenie wysłane przyciskiem „Wyślij”), axe WCAG 2.2 A/AA na
  każdym kroku; fokus wraca do przycisku, który otworzył okno, po każdym jego zamknięciu;
- każda pinezka mapy ma wiersz na liście z tym samym statusem (mapa jako tekst);
- ekrany ze scenariusza przy powiększeniu 200% (640×400) i szerokości 320 px: bez przewijania
  w poziomie, axe bez błędów (w tym kontrast).

Te testy działają na przykładowych miejscach ze specyfikacji API (serwer deweloperski w trybie mock).
Te same ekrany na prawdziwych danych sprawdzają `places-real-data.prod.spec.ts` i
`business-real-data.prod.spec.ts` (`E2E_PROD=1 npm run test:e2e`).

Ręcznie, przed nagraniem: przejście z VoiceOver (iOS) albo TalkBack (Android). Wyniki, znane
ograniczenia i plan są na stronie „Deklaracja dostępności” (`/deklaracja-dostepnosci`).
